import express from 'express';
import type http from 'http';
import { z } from 'zod';
import { db } from './database';
import { encryptSecret, decryptSecret } from './crypto';
import { authenticateToken, AuthRequest } from './middleware';
import { createRateLimiter } from './rateLimit';
import { parsePublicHttpUrl, safeRequestStream, UrlBlockedError } from './urlGuard';
import {
    CATALOG, MODEL_NAME, builtinOrigin, friendlyUpstreamError, modelSupportsTools, normalizeOpenAiBase, privateUrlsAllowed, sanitizeChatRequest,
} from './assistantCore';

/*
 * Ask Crystal's model connection. The browser works out the answers (the app's own functions run there, on the data
 * it already holds); this server only keeps the connection settings, relays chat to the model, and, for the built-in
 * engine, manages which models are downloaded. Nothing the user types or any figure is stored here.
 */

const router = express.Router();
router.use(authenticateToken);

type Provider = 'builtin' | 'custom';
interface Settings { provider: Provider; baseUrl: string | null; model: string | null; apiKey: string | null }
interface Target { kind: Provider; origin: string; openaiBase: string; apiKey: string | null; allowPrivate: boolean; model: string | null }

const chatLimiter = createRateLimiter({
    namespace: 'assistant-chat',
    windowMs: 60_000,
    maxAttempts: 60,
    blockMs: 30_000,
    message: 'You are asking too quickly. Wait a moment and try again.',
    key: req => String((req as AuthRequest).user?.id ?? req.ip),
});

let userCountCache: { at: number; count: number } | null = null;
const userCount = async (): Promise<number> => {
    if (userCountCache && Date.now() - userCountCache.at < 30_000) return userCountCache.count;
    const count = Number((await db.query(`SELECT COUNT(*) AS n FROM users`)).rows[0]?.n ?? 0);
    userCountCache = { at: Date.now(), count };
    return count;
};

/** For tests: forget the cached user count. */
export const clearUserCountCache = () => { userCountCache = null; };

const loadSettings = async (userId: number): Promise<Settings> => {
    const row = (await db.query(`SELECT provider, base_url, model, encrypted_key FROM assistant_settings WHERE user_id = $1`, [userId])).rows?.[0];
    if (!row) return { provider: 'builtin', baseUrl: null, model: null, apiKey: null };
    return { provider: row.provider === 'custom' ? 'custom' : 'builtin', baseUrl: row.base_url, model: row.model, apiKey: row.encrypted_key ? decryptSecret(row.encrypted_key) : null };
};

const resolveTarget = async (userId: number): Promise<Target> => {
    const settings = await loadSettings(userId);
    if (settings.provider === 'custom' && settings.baseUrl) {
        const base = settings.baseUrl.replace(/\/+$/, '');
        return { kind: 'custom', origin: new URL(base).origin, openaiBase: base, apiKey: settings.apiKey, allowPrivate: privateUrlsAllowed(await userCount()), model: settings.model };
    }
    const origin = builtinOrigin();
    return { kind: 'builtin', origin, openaiBase: `${origin}/v1`, apiKey: null, allowPrivate: true, model: settings.model };
};

const readBody = (stream: http.IncomingMessage, max = 2_000_000): Promise<string> =>
    new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > max) { stream.destroy(); return reject(new Error('The model server sent too much data.')); }
            chunks.push(chunk);
        });
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        stream.on('error', reject);
    });

const authHeaders = (target: Target): Record<string, string> => (target.apiKey ? { Authorization: `Bearer ${target.apiKey}` } : {});

/** A small JSON call to the engine's own API (Ollama). */
const engineJson = async (target: Target, path: string, init: { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown; timeoutMs?: number } = {}) => {
    const response = await safeRequestStream(`${target.origin}${path}`, {
        method: init.method ?? 'GET',
        headers: { 'Content-Type': 'application/json', ...authHeaders(target) },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        idleTimeoutMs: init.timeoutMs ?? 15_000,
        allowPrivate: target.allowPrivate,
    });
    const text = await readBody(response.stream);
    return { status: response.status, text, json: () => { try { return JSON.parse(text); } catch { return null; } } };
};

const builtinStatus = async () => {
    try {
        const target: Target = { kind: 'builtin', origin: builtinOrigin(), openaiBase: `${builtinOrigin()}/v1`, apiKey: null, allowPrivate: true, model: null };
        const result = await engineJson(target, '/api/version', { timeoutMs: 1500 });
        return result.status === 200 ? { reachable: true, version: String(result.json()?.version ?? '') } : { reachable: false };
    } catch {
        return { reachable: false };
    }
};

const sendUpstreamFailure = async (res: express.Response, status: number, stream: http.IncomingMessage) => {
    const text = await readBody(stream, 20_000).catch(() => '');
    const friendly = friendlyUpstreamError(status, text);
    res.status(424).json({ message: friendly.message, errorCode: friendly.code, upstreamStatus: status });
};

const publicSettings = async (userId: number) => {
    const settings = await loadSettings(userId);
    return {
        provider: settings.provider,
        baseUrl: settings.baseUrl ?? '',
        model: settings.model ?? '',
        hasKey: Boolean(settings.apiKey),
        builtin: await builtinStatus(),
        catalog: CATALOG,
        privateUrlsAllowed: privateUrlsAllowed(await userCount()),
    };
};

router.get('/', async (req: AuthRequest, res) => {
    try {
        res.json(await publicSettings(req.user!.id));
    } catch (error) {
        console.error('Failed to read assistant settings', error);
        res.status(500).json({ message: 'Unable to read the assistant settings.' });
    }
});

const settingsSchema = z.object({
    provider: z.enum(['builtin', 'custom']),
    baseUrl: z.string().max(500).optional(),
    model: z.string().max(200).nullable().optional(),
    /** Omitted keeps the saved key, an empty string removes it. */
    apiKey: z.string().max(500).optional(),
});

router.put('/', async (req: AuthRequest, res) => {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Those assistant settings are not valid.' });
    const { provider, model } = parsed.data;
    try {
        const current = await loadSettings(req.user!.id);
        let baseUrl: string | null = null;
        if (provider === 'custom') {
            if (!parsed.data.baseUrl?.trim()) return res.status(400).json({ message: 'Enter the address of your model server.' });
            try {
                baseUrl = normalizeOpenAiBase(parsed.data.baseUrl);
                parsePublicHttpUrl(baseUrl, privateUrlsAllowed(await userCount()));
            } catch (error) {
                const message = error instanceof UrlBlockedError
                    ? `${error.message} Addresses on your own network work when you are the only user on this server, or when ASSISTANT_ALLOW_PRIVATE_URLS=true is set.`
                    : 'That is not a valid address.';
                return res.status(400).json({ message });
            }
        }
        const cleanModel = model?.trim() || null;
        if (cleanModel && !MODEL_NAME.test(cleanModel)) return res.status(400).json({ message: 'That model name is not valid.' });
        const apiKey = parsed.data.apiKey === undefined ? current.apiKey : parsed.data.apiKey || null;
        await db.query(
            `INSERT INTO assistant_settings (user_id, provider, base_url, model, encrypted_key)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id) DO UPDATE
             SET provider = EXCLUDED.provider, base_url = EXCLUDED.base_url, model = EXCLUDED.model,
                 encrypted_key = EXCLUDED.encrypted_key, updated_at = NOW()`,
            [req.user!.id, provider, baseUrl, cleanModel, provider === 'custom' && apiKey ? encryptSecret(apiKey) : null],
        );
        res.json(await publicSettings(req.user!.id));
    } catch (error) {
        console.error('Failed to save assistant settings', error);
        res.status(500).json({ message: 'Unable to save the assistant settings.' });
    }
});

router.get('/models', async (req: AuthRequest, res) => {
    try {
        const target = await resolveTarget(req.user!.id);
        if (target.kind === 'builtin') {
            const result = await engineJson(target, '/api/tags');
            if (result.status !== 200) return res.status(424).json({ message: 'The built-in engine is not answering. Start it, then try again.' });
            const models = (result.json()?.models ?? []).map((m: any) => ({
                name: String(m.name ?? m.model), sizeBytes: Number(m.size) || 0, parameterSize: m.details?.parameter_size ?? null, quantization: m.details?.quantization_level ?? null,
            }));
            return res.json({ models });
        }
        const response = await safeRequestStream(`${target.openaiBase}/models`, { headers: authHeaders(target), idleTimeoutMs: 15_000, allowPrivate: target.allowPrivate });
        if (response.status !== 200) return sendUpstreamFailure(res, response.status, response.stream);
        const body = JSON.parse(await readBody(response.stream));
        const models = (Array.isArray(body?.data) ? body.data : []).map((m: any) => ({ name: String(m.id) })).filter((m: { name: string }) => m.name);
        res.json({ models });
    } catch (error: any) {
        res.status(424).json({ message: error instanceof UrlBlockedError ? error.message : `Could not reach the model server. ${error?.message ?? ''}`.trim() });
    }
});

router.get('/models/info', async (req: AuthRequest, res) => {
    const model = String(req.query.model ?? '');
    if (!MODEL_NAME.test(model)) return res.status(400).json({ message: 'That model name is not valid.' });
    try {
        const target = await resolveTarget(req.user!.id);
        if (target.kind !== 'builtin') return res.json({ supportsTools: null });
        const result = await engineJson(target, '/api/show', { method: 'POST', body: { model } });
        res.json({ supportsTools: result.status === 200 ? modelSupportsTools(result.json()) : null });
    } catch {
        res.json({ supportsTools: null });
    }
});

const pulling = new Set<number>();

/** Downloads a model into the built-in engine and relays its progress lines as they arrive. */
router.post('/models/pull', async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const model = String(req.body?.model ?? '').trim();
    if (!MODEL_NAME.test(model)) return res.status(400).json({ message: 'That model name is not valid.' });
    if (pulling.has(userId)) return res.status(409).json({ message: 'A download is already running. Wait for it to finish.' });
    try {
        const target = await resolveTarget(userId);
        if (target.kind !== 'builtin') return res.status(400).json({ message: 'Downloads work with the built-in engine only.' });
        pulling.add(userId);
        const upstream = await safeRequestStream(`${target.origin}/api/pull`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, stream: true }), idleTimeoutMs: 600_000, allowPrivate: true,
        });
        if (upstream.status !== 200) { pulling.delete(userId); return sendUpstreamFailure(res, upstream.status, upstream.stream); }
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' });
        res.on('close', () => { upstream.abort(); pulling.delete(userId); });
        upstream.stream.on('error', () => { if (!res.writableEnded) res.write(`${JSON.stringify({ error: 'The connection to the built-in engine dropped.' })}\n`); res.end(); });
        upstream.stream.pipe(res);
    } catch (error: any) {
        pulling.delete(userId);
        if (!res.headersSent) res.status(424).json({ message: 'The built-in engine is not reachable. Start it, then try again.' });
        else res.end();
    }
});

router.delete('/models', async (req: AuthRequest, res) => {
    const model = String(req.body?.model ?? '').trim();
    if (!MODEL_NAME.test(model)) return res.status(400).json({ message: 'That model name is not valid.' });
    try {
        const target = await resolveTarget(req.user!.id);
        if (target.kind !== 'builtin') return res.status(400).json({ message: 'Models are removed from the built-in engine only.' });
        const result = await engineJson(target, '/api/delete', { method: 'DELETE', body: { model } });
        if (result.status === 404) return res.status(404).json({ message: 'That model is not installed.' });
        if (result.status !== 200) return res.status(424).json({ message: 'The built-in engine could not remove the model.' });
        const settings = await loadSettings(req.user!.id);
        if (settings.model === model) await db.query(`UPDATE assistant_settings SET model = NULL, updated_at = NOW() WHERE user_id = $1`, [req.user!.id]);
        res.json({ message: 'Removed' });
    } catch {
        res.status(424).json({ message: 'The built-in engine is not reachable.' });
    }
});

/** One chat turn: validated, sent to the model, and relayed back (streamed when asked). */
router.post('/chat', chatLimiter, async (req: AuthRequest, res) => {
    let request: ReturnType<typeof sanitizeChatRequest>;
    try { request = sanitizeChatRequest(req.body); } catch (error: any) { return res.status(400).json({ message: error.message }); }
    const wantsStream = Boolean(req.body?.stream);
    try {
        const target = await resolveTarget(req.user!.id);
        if (!target.model) return res.status(400).json({ message: 'Choose a model first, in Settings, Connections.', errorCode: 'NO_MODEL' });
        const upstream = await safeRequestStream(`${target.openaiBase}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders(target) },
            body: JSON.stringify({ model: target.model, messages: request.messages, ...(request.tools.length ? { tools: request.tools } : {}), stream: wantsStream, temperature: 0.2 }),
            // A model that is still loading into memory can be silent for minutes on a small machine.
            idleTimeoutMs: 600_000,
            allowPrivate: target.allowPrivate,
        });
        if (upstream.status >= 400) return sendUpstreamFailure(res, upstream.status, upstream.stream);
        res.on('close', () => upstream.abort());
        if (!wantsStream) {
            const text = await readBody(upstream.stream);
            return res.type('application/json').send(text);
        }
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no', Connection: 'keep-alive' });
        upstream.stream.on('error', () => res.end());
        upstream.stream.pipe(res);
    } catch (error: any) {
        if (res.headersSent) return res.end();
        const blocked = error instanceof UrlBlockedError;
        res.status(424).json({ message: blocked ? error.message : `Could not reach the model server. ${error?.message ?? ''}`.trim() });
    }
});

router.post('/test', async (req: AuthRequest, res) => {
    try {
        const target = await resolveTarget(req.user!.id);
        if (!target.model) return res.status(400).json({ message: 'Choose a model first.' });
        const upstream = await safeRequestStream(`${target.openaiBase}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders(target) },
            body: JSON.stringify({ model: target.model, messages: [{ role: 'user', content: 'Reply with the single word: ok' }], stream: false, max_tokens: 16, temperature: 0 }),
            idleTimeoutMs: 300_000,
            allowPrivate: target.allowPrivate,
        });
        if (upstream.status >= 400) return sendUpstreamFailure(res, upstream.status, upstream.stream);
        const body = JSON.parse(await readBody(upstream.stream));
        let supportsTools: boolean | null = null;
        if (target.kind === 'builtin') {
            const info = await engineJson(target, '/api/show', { method: 'POST', body: { model: target.model } }).catch(() => null);
            supportsTools = info && info.status === 200 ? modelSupportsTools(info.json()) : null;
        }
        res.json({ ok: true, reply: String(body?.choices?.[0]?.message?.content ?? '').slice(0, 200), supportsTools });
    } catch (error: any) {
        res.status(424).json({ message: error instanceof UrlBlockedError ? error.message : `Could not reach the model server. ${error?.message ?? ''}`.trim() });
    }
});

export default router;
