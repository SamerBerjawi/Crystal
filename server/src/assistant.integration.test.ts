/*
 * Runs the real /api/assistant router against a fake Ollama server, with the database stubbed. It checks what the unit
 * tests cannot: that streamed words reach the browser as they are produced (not all at the end), that a download's
 * progress is relayed live, what the user sees when the model server fails, and that the key never comes back out.
 */
import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'net';
import { db } from './database';
import { JWT_SECRET } from './authConfig';
import { decryptSecret } from './crypto';
import assistantRouter, { clearUserCountCache } from './assistant';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(`Test Failed: ${message}`);
}
let hybridRunId = '';
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ---- a stand-in database ----
let settingsRow: any = null;
let mcpRows: any[] = [];
let userCount = 1;
(db as any).query = async (sql: string, params: any[] = []) => {
    if (/FROM user_sessions/.test(sql)) return { rows: [{ id: params[0], locked_at: null }] };
    if (/UPDATE user_sessions/.test(sql)) return { rows: [] };
    if (/FROM users/.test(sql)) return { rows: [{ n: String(userCount) }] };
    if (/INSERT INTO assistant_mcp_servers/.test(sql)) {
        if (mcpRows.some(r => r.name === params[2])) throw Object.assign(new Error('duplicate'), { code: '23505' });
        const row = { id: params[0], user_id: params[1], name: params[2], url: params[3], encrypted_token: params[4], enabled: true };
        mcpRows.push(row);
        return { rows: [row] };
    }
    if (/COUNT\(\*\) AS n FROM assistant_mcp_servers/.test(sql)) return { rows: [{ n: String(mcpRows.length) }] };
    if (/UPDATE assistant_mcp_servers SET enabled/.test(sql)) { const row = mcpRows.find(r => r.id === params[0]); if (row) row.enabled = params[2]; return { rows: row ? [row] : [] }; }
    if (/DELETE FROM assistant_mcp_servers/.test(sql)) { const before = mcpRows.length; mcpRows = mcpRows.filter(r => r.id !== params[0]); return { rows: [], rowCount: before - mcpRows.length }; }
    if (/FROM assistant_mcp_servers WHERE id/.test(sql)) return { rows: mcpRows.filter(r => r.id === params[0]) };
    if (/FROM assistant_mcp_servers/.test(sql)) return { rows: mcpRows.filter(r => !/enabled = TRUE/.test(sql) || r.enabled) };
    if (/FROM financial_data/.test(sql)) return { rows: [{ data: { preferences: { currency: 'EUR' }, accounts: [{ id: 'a1', name: 'Main', type: 'Checking', balance: 1234.5, currency: 'EUR' }] } }] };
    if (/SELECT provider/.test(sql)) return { rows: settingsRow ? [settingsRow] : [] };
    if (/INSERT INTO assistant_settings/.test(sql)) {
        settingsRow = { provider: params[1], base_url: params[2], model: params[3], encrypted_key: params[4] };
        return { rows: [] };
    }
    if (/UPDATE assistant_settings SET model = NULL/.test(sql)) { if (settingsRow) settingsRow.model = null; return { rows: [] }; }
    return { rows: [] };
};

// ---- a fake model server (Ollama's native API and its OpenAI-style one) ----
const seen: { path: string; method?: string; headers: http.IncomingHttpHeaders; body: any }[] = [];
let engineClosedEarly = false;
const engine = http.createServer((req, res) => {
    let raw = '';
    req.on('data', c => (raw += c));
    req.on('end', async () => {
        let body: any = null;
        try { body = raw ? JSON.parse(raw) : null; } catch { /* not JSON */ }
        seen.push({ path: req.url ?? '', method: req.method, headers: req.headers, body });
        const json = (status: number, value: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
        if (req.url === '/api/version') return json(200, { version: '0.0.0-test' });
        if (req.url === '/api/tags') return json(200, { models: [{ name: 'qwen3:4b', size: 2_500_000_000, details: { parameter_size: '4B', quantization_level: 'Q4_K_M' } }] });
        if (req.url === '/api/show') return json(200, { capabilities: body?.model === 'plain:1b' ? ['completion'] : ['completion', 'tools'] });
        if (req.url === '/api/delete' && req.method === 'DELETE') return body?.model === 'gone:1b' ? json(404, { error: 'not found' }) : json(200, {});
        if (req.url === '/v1/models') return json(200, { data: [{ id: 'llama3.1:8b' }, { id: 'qwen3:8b' }] });
        if (req.url === '/api/pull') {
            res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
            res.write(`${JSON.stringify({ status: 'pulling manifest' })}\n`);
            for (let i = 1; i <= 3; i++) { await sleep(120); res.write(`${JSON.stringify({ status: 'pulling aaa', digest: 'aaa', total: 300, completed: i * 100 })}\n`); }
            res.write(`${JSON.stringify({ status: 'success' })}\n`);
            return res.end();
        }
        if (req.url === '/v1/chat/completions') {
            if (body?.tools?.length && body?.model === 'plain:1b') return json(400, { error: { message: 'registry.ollama.ai/library/plain:1b does not support tools' } });
            if (body?.model === 'missing:1b') return json(404, { error: { message: 'model "missing:1b" not found, try pulling it first' } });
            if (body?.model === 'agent:1b') {
                // A scripted model: look up the summary, then answer with what the tool returned. A browser tool comes first on request.
                const last = body.messages[body.messages.length - 1];
                const asksBrowser = JSON.stringify(body.messages).includes('use_browser');
                const asksExternal = JSON.stringify(body.messages).includes('use_external');
                const call = (name: string) => ({ choices: [{ delta: { tool_calls: [{ index: 0, id: `call_${name}`, function: { name, arguments: '{}' } }] } }] });
                res.writeHead(200, { 'Content-Type': 'text/event-stream' });
                if (last.role === 'user') res.write(`data: ${JSON.stringify(call(asksBrowser ? 'browser_net' : asksExternal ? 'rates__get_rate' : 'get_summary'))}\n\n`);
                else res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: `Answer: ${last.content.includes('4242') ? '4242.00 from your browser' : last.content.includes('0.9137') ? 'Rate 0.9137 from outside' : '1,234.50'}` } }] })}\n\n`);
                res.write('data: [DONE]\n\n');
                return res.end();
            }
            if (!body?.stream) return json(200, { choices: [{ message: { role: 'assistant', content: body?.max_tokens === 16 ? 'ok' : 'plain reply' } }] });
            res.writeHead(200, { 'Content-Type': 'text/event-stream' });
            res.on('close', () => { if (!res.writableEnded) engineClosedEarly = true; });
            for (const word of ['one ', 'two ', 'three ', 'four ', 'five ']) {
                res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: word } }] })}\n\n`);
                await sleep(150);
            }
            res.write('data: [DONE]\n\n');
            return res.end();
        }
        json(404, { error: 'unknown' });
    });
});

const run = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); console.log(`✓ ${name}`); } catch (e: any) { process.exitCode = 1; console.error(`✕ ${name}:`, e.message); }
};

const main = async () => {
    await new Promise<void>(resolve => engine.listen(0, '127.0.0.1', resolve));
    const enginePort = (engine.address() as AddressInfo).port;
    process.env.OLLAMA_URL = `http://127.0.0.1:${enginePort}`;

    const app = express();
    app.use(express.json());
    app.use('/api/assistant', assistantRouter);
    const server = http.createServer(app);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/assistant`;
    const token = jwt.sign({ id: 7, email: 'a@example.test', sid: 'session-1' }, JWT_SECRET);
    const call = (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers } });
    const userMessage = { messages: [{ role: 'user', content: 'hi' }] };
    console.log('--- Running the Ask Crystal server, with a fake model server ---');

    await run('a request without a session is refused', async () => {
        assert((await fetch(`${base}/`)).status === 401, '401');
    });

    await run('settings start unset, see the built-in engine, and list the catalog', async () => {
        const body: any = await (await call('/')).json();
        assert(body.provider === 'builtin' && body.model === '' && body.hasKey === false, 'defaults');
        assert(body.builtin.reachable === true && body.builtin.version === '0.0.0-test', 'the engine answers');
        assert(Array.isArray(body.catalog) && body.catalog.length >= 3, 'catalog');
    });

    await run('a model must be chosen before asking, and its name must be sane', async () => {
        const early: any = await (await call('/chat', { method: 'POST', body: JSON.stringify(userMessage) })).json();
        assert(early.errorCode === 'NO_MODEL', 'asks to choose a model');
        assert((await call('/', { method: 'PUT', body: JSON.stringify({ provider: 'builtin', model: '../../etc/passwd' }) })).status === 400, 'bad name');
        const saved: any = await (await call('/', { method: 'PUT', body: JSON.stringify({ provider: 'builtin', model: 'qwen3:4b' }) })).json();
        assert(saved.model === 'qwen3:4b', 'saved');
    });

    await run('installed models come from the engine with their sizes', async () => {
        const body: any = await (await call('/models')).json();
        assert(body.models[0].name === 'qwen3:4b' && body.models[0].sizeBytes === 2_500_000_000 && body.models[0].parameterSize === '4B', 'listed');
        assert(((await (await call('/models/info?model=plain:1b')).json()) as any).supportsTools === false, 'a model without tools is reported');
        assert(((await (await call('/models/info?model=qwen3:4b')).json()) as any).supportsTools === true, 'and one with');
    });

    await run('a chat turn is cleaned, sent with the saved model, and relayed whole', async () => {
        seen.length = 0;
        const tools = [{ type: 'function', function: { name: 'spending', description: 'x', parameters: { type: 'object', properties: {} } } }];
        const response = await call('/chat', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'system', content: 's', evil: 'x' }, { role: 'user', content: 'hi' }], tools, model: 'ignored-by-server' }) });
        assert(response.status === 200 && ((await response.json()) as any).choices[0].message.content === 'plain reply', 'relayed');
        const sent = seen.find(s => s.path === '/v1/chat/completions')!.body;
        assert(sent.model === 'qwen3:4b', 'the saved model is used, not whatever the browser says');
        assert(sent.temperature === 0.2 && sent.stream === false && sent.tools.length === 1, 'options');
        assert(!('evil' in sent.messages[0]), 'unknown fields are dropped');
    });

    await run('words are relayed as they are written, not all at the end', async () => {
        const started = Date.now();
        const response = await call('/chat', { method: 'POST', body: JSON.stringify({ ...userMessage, stream: true }) });
        assert((response.headers.get('content-type') ?? '').includes('text/event-stream'), 'an event stream');
        assert((response.headers.get('cache-control') ?? '').includes('no-transform'), 'told not to be compressed or buffered');
        const reader = response.body!.getReader();
        const first = await reader.read();
        const firstAfter = Date.now() - started;
        let text = new TextDecoder().decode(first.value);
        for (;;) { const { value, done } = await reader.read(); if (done) break; text += new TextDecoder().decode(value); }
        const total = Date.now() - started;
        assert(text.includes('one ') && text.includes('five ') && text.includes('[DONE]'), 'everything arrived');
        assert(firstAfter < 400 && total > 600, `first words at ${firstAfter}ms, the last at ${total}ms: streamed, not buffered`);
    });

    await run('leaving mid-answer stops the model', async () => {
        engineClosedEarly = false;
        const controller = new AbortController();
        const response = await call('/chat', { method: 'POST', body: JSON.stringify({ ...userMessage, stream: true }), signal: controller.signal });
        await response.body!.getReader().read();
        controller.abort();
        await sleep(400);
        assert(engineClosedEarly, 'the connection to the engine was closed');
    });

    await run('bad requests and model-server errors become messages a person can act on', async () => {
        assert((await call('/chat', { method: 'POST', body: JSON.stringify({ messages: [] }) })).status === 400, 'empty chat');
        assert((await call('/chat', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'root', content: 'x' }] }) })).status === 400, 'unknown role');
        await call('/', { method: 'PUT', body: JSON.stringify({ provider: 'builtin', model: 'plain:1b' }) });
        const noTools = await call('/chat', { method: 'POST', body: JSON.stringify({ ...userMessage, tools: [{ type: 'function', function: { name: 'a', description: '', parameters: { type: 'object' } } }] }) });
        const noToolsBody: any = await noTools.json();
        assert(noTools.status === 424 && noToolsBody.errorCode === 'NO_TOOLS' && /Qwen3|Llama/.test(noToolsBody.message), 'a model without tools');
        await call('/', { method: 'PUT', body: JSON.stringify({ provider: 'builtin', model: 'missing:1b' }) });
        const missing: any = await (await call('/chat', { method: 'POST', body: JSON.stringify(userMessage) })).json();
        assert(missing.errorCode === 'NO_MODEL', 'a model that is not installed');
    });

    await run('a download is relayed line by line, one at a time', async () => {
        const started = Date.now();
        const response = await call('/models/pull', { method: 'POST', body: JSON.stringify({ model: 'qwen3:8b' }) });
        assert((response.headers.get('content-type') ?? '').includes('x-ndjson'), 'progress lines');
        const second = await call('/models/pull', { method: 'POST', body: JSON.stringify({ model: 'llama3.1:8b' }) });
        assert(second.status === 409, 'a second download at once is refused');
        const reader = response.body!.getReader();
        const first = await reader.read();
        assert(Date.now() - started < 300, 'the first progress line arrives at once');
        let text = new TextDecoder().decode(first.value);
        for (;;) { const { value, done } = await reader.read(); if (done) break; text += new TextDecoder().decode(value); }
        const lines = text.trim().split('\n').map(l => JSON.parse(l));
        assert(lines[0].status === 'pulling manifest' && lines[lines.length - 1].status === 'success' && lines.length === 5, 'every line, in order');
        assert((await call('/models/pull', { method: 'POST', body: JSON.stringify({ model: 'a b' }) })).status === 400, 'a bad name');
        await sleep(50);
        assert((await call('/models/pull', { method: 'POST', body: JSON.stringify({ model: 'x:1b' }) })).status === 200, 'allowed again once the first has finished');
    });

    await run('removing a model that was in use clears the choice', async () => {
        await call('/', { method: 'PUT', body: JSON.stringify({ provider: 'builtin', model: 'qwen3:4b' }) });
        assert((await call('/models', { method: 'DELETE', body: JSON.stringify({ model: 'qwen3:4b' }) })).status === 200, 'removed');
        assert(((await (await call('/')).json()) as any).model === '', 'no model selected any more');
        assert((await call('/models', { method: 'DELETE', body: JSON.stringify({ model: 'gone:1b' }) })).status === 404, 'not installed');
    });

    await run('your own server: saved normalised, key encrypted and never returned', async () => {
        userCount = 1; clearUserCountCache();
        const saved: any = await (await call('/', { method: 'PUT', body: JSON.stringify({ provider: 'custom', baseUrl: `http://127.0.0.1:${enginePort}`, model: 'llama3.1:8b', apiKey: 'sk-secret-123' }) })).json();
        assert(saved.provider === 'custom' && saved.baseUrl === `http://127.0.0.1:${enginePort}/v1` && saved.hasKey === true, 'normalised, key present');
        assert(!JSON.stringify(saved).includes('sk-secret-123'), 'the key is not in the answer');
        assert(settingsRow.encrypted_key && settingsRow.encrypted_key !== 'sk-secret-123' && decryptSecret(settingsRow.encrypted_key) === 'sk-secret-123', 'stored encrypted');
        seen.length = 0;
        const models: any = await (await call('/models')).json();
        assert(models.models.map((m: any) => m.name).join() === 'llama3.1:8b,qwen3:8b', 'models come from /v1/models');
        await call('/chat', { method: 'POST', body: JSON.stringify(userMessage) });
        const chat = seen.find(s => s.path === '/v1/chat/completions')!;
        assert(chat.headers.authorization === 'Bearer sk-secret-123' && chat.body.model === 'llama3.1:8b', 'the key and model reach the server');
        const kept: any = await (await call('/', { method: 'PUT', body: JSON.stringify({ provider: 'custom', baseUrl: `http://127.0.0.1:${enginePort}/v1`, model: 'qwen3:8b' }) })).json();
        assert(kept.hasKey === true, 'leaving the key out keeps it');
        const cleared: any = await (await call('/', { method: 'PUT', body: JSON.stringify({ provider: 'custom', baseUrl: `http://127.0.0.1:${enginePort}/v1`, model: 'qwen3:8b', apiKey: '' }) })).json();
        assert(cleared.hasKey === false, 'an empty key removes it');
        assert((await call('/models', { method: 'DELETE', body: JSON.stringify({ model: 'x' }) })).status === 400, 'models are only removed from the built-in engine');
    });

    await run('private addresses are refused once other people share the server', async () => {
        userCount = 2; clearUserCountCache();
        const refused = await call('/', { method: 'PUT', body: JSON.stringify({ provider: 'custom', baseUrl: `http://127.0.0.1:${enginePort}`, model: 'x' }) });
        const body: any = await refused.json();
        assert(refused.status === 400 && /ASSISTANT_ALLOW_PRIVATE_URLS/.test(body.message), 'explains how to allow it');
        // The address saved earlier stops working too, instead of becoming a way into the network.
        const chat = await call('/chat', { method: 'POST', body: JSON.stringify(userMessage) });
        assert(chat.status === 424, 'a saved private address is refused at use');
        userCount = 1; clearUserCountCache();
    });

    await run('the test button reports a reply and whether tools work', async () => {
        await call('/', { method: 'PUT', body: JSON.stringify({ provider: 'builtin', model: 'qwen3:4b' }) });
        const ok: any = await (await call('/test', { method: 'POST' })).json();
        assert(ok.ok === true && ok.reply === 'ok' && ok.supportsTools === true, 'works');
        await call('/', { method: 'PUT', body: JSON.stringify({ provider: 'builtin', model: 'plain:1b' }) });
        const plain: any = await (await call('/test', { method: 'POST' })).json();
        assert(plain.supportsTools === false, 'a model without tools is flagged');
    });

    await run('the agent loop runs on the server, streams its steps, and hands browser tools to the browser', async () => {
        const before = settingsRow;
        settingsRow = { provider: 'builtin', base_url: null, model: 'agent:1b', encrypted_key: null };
        try {
            const readEvents = async (response: Response, onEvent?: (event: any) => Promise<void>) => {
                const events: any[] = [];
                const reader = response.body!.getReader();
                const decoder = new TextDecoder();
                let buffered = '';
                for (;;) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    buffered += decoder.decode(value, { stream: true });
                    const lines = buffered.split('\n');
                    buffered = lines.pop() ?? '';
                    for (const line of lines.filter(Boolean)) { const event = JSON.parse(line); events.push(event); await onEvent?.(event); }
                }
                return events;
            };

            const plain = await readEvents(await call('/agent', { method: 'POST', body: JSON.stringify({ question: 'what is my net worth?' }) }));
            const done = plain.find(e => e.type === 'done');
            assert(plain[0].type === 'run' && done.answer === 'Answer: 1,234.50', `answer ${JSON.stringify(done)}`);
            assert(done.steps.length === 1 && done.steps[0].name === 'get_summary' && done.steps[0].origin === 'crystal', 'ran the server tool');
            assert(done.unverified.length === 0, 'the figure came from the lookup');

            const browserTool = { type: 'function', function: { name: 'browser_net', description: 'x', parameters: { type: 'object', properties: {} } } };
            const hybrid = await readEvents(
                await call('/agent', { method: 'POST', body: JSON.stringify({ question: 'use_browser please', clientTools: [browserTool] }) }),
                async event => {
                    if (event.type === 'tool_request') {
                        const runId = hybridRunId;
                        const reply = await call('/agent/result', { method: 'POST', body: JSON.stringify({ runId, callId: event.callId, result: { summary: 'net', value: '4242.00' } }) });
                        assert(reply.status === 200, 'result accepted');
                    }
                    if (event.type === 'run') hybridRunId = event.runId;
                },
            );
            const hybridDone = hybrid.find(e => e.type === 'done');
            assert(hybrid.some(e => e.type === 'tool_request' && e.name === 'browser_net'), 'browser asked');
            assert(hybridDone.steps[0].origin === 'browser' && hybridDone.answer.includes('4242.00'), `browser answer ${JSON.stringify(hybridDone)}`);

            const bad = await call('/agent', { method: 'POST', body: JSON.stringify({ question: '', history: [] }) });
            assert(bad.status === 400, 'empty question refused');
            assert((await call('/agent/result', { method: 'POST', body: JSON.stringify({ runId: 'nope', callId: 'x' }) })).status === 404, 'unknown run');
        } finally { settingsRow = before; }
    });

    await run('outside MCP servers: added, tested, only read-only tools used, called by the agent', async () => {
        const before = settingsRow;
        settingsRow = { provider: 'builtin', base_url: null, model: 'agent:1b', encrypted_key: null };
        // A real MCP server standing in for an outside one: one tool says it is read-only, one does not.
        const outside = express();
        outside.use(express.json());
        const seenAuth: (string | undefined)[] = [];
        outside.post('/mcp', async (req, res) => {
            seenAuth.push(req.headers.authorization);
            const server = new McpServer({ name: 'rates', version: '1.0.0' });
            server.registerTool('get_rate', { description: 'EUR to USD', annotations: { readOnlyHint: true } }, async () => ({ content: [{ type: 'text', text: '0.9137' }] }));
            server.registerTool('wipe', { description: 'Bad', annotations: { readOnlyHint: false } }, async () => ({ content: [{ type: 'text', text: 'wiped' }] }));
            const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
            res.on('close', () => { void transport.close(); void server.close(); });
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
        });
        const outsideServer = await new Promise<http.Server>(resolve => { const listening = outside.listen(0, '127.0.0.1', () => resolve(listening)); });
        const outsideUrl = `http://127.0.0.1:${(outsideServer.address() as AddressInfo).port}/mcp`;
        try {
            const bad = await call('/mcp-servers', { method: 'POST', body: JSON.stringify({ name: 'Bad Name', url: outsideUrl }) });
            assert(bad.status === 400, 'a bad name is refused');
            const added: any = await (await call('/mcp-servers', { method: 'POST', body: JSON.stringify({ name: 'rates', url: outsideUrl, token: 'secret-token' }) })).json();
            assert(added.name === 'rates' && added.hasToken === true && !('token' in added) && !('encrypted_token' in added), 'saved without the token coming back');
            assert((await call('/mcp-servers', { method: 'POST', body: JSON.stringify({ name: 'rates', url: outsideUrl }) })).status === 409, 'names are unique');
            assert(decryptSecret(mcpRows[0].encrypted_token) === 'secret-token', 'token stored encrypted');

            const tested: any = await (await call(`/mcp-servers/${added.id}/test`, { method: 'POST' })).json();
            assert(tested.exposed.join() === 'get_rate' && tested.hidden.join() === 'wipe', 'only the read-only tool is exposed');
            assert(seenAuth.includes('Bearer secret-token'), 'the token was sent to the outside server');

            const text = await (await call('/agent', { method: 'POST', body: JSON.stringify({ question: 'use_external rate?' }) })).text();
            const events = text.split('\n').filter(Boolean).map(l => JSON.parse(l));
            const done = events.find(e => e.type === 'done');
            assert(done.steps[0].name === 'rates__get_rate' && done.steps[0].origin === 'external', `step ${JSON.stringify(done.steps)}`);
            assert(done.answer.includes('0.9137'), 'the answer used the outside result');

            await call(`/mcp-servers/${added.id}`, { method: 'PATCH', body: JSON.stringify({ enabled: false }) });
            const off = (await (await call('/agent', { method: 'POST', body: JSON.stringify({ question: 'use_external rate?' }) })).text()).split('\n').filter(Boolean).map(l => JSON.parse(l));
            assert(off.find(e => e.type === 'done').steps[0].status === 'error', 'a disabled server is not offered');

            assert((await call(`/mcp-servers/${added.id}`, { method: 'DELETE' })).status === 200 && mcpRows.length === 0, 'removed');
            userCount = 3; clearUserCountCache();
            assert((await call('/mcp-servers', { method: 'POST', body: JSON.stringify({ name: 'lan', url: outsideUrl }) })).status === 400, 'private addresses are refused on a shared server');
        } finally { outsideServer.close(); settingsRow = before; userCount = 1; clearUserCountCache(); }
    });

    await run('with the engine down, the page is told plainly', async () => {
        process.env.OLLAMA_URL = 'http://127.0.0.1:9';
        const body: any = await (await call('/')).json();
        assert(body.builtin.reachable === false, 'not reachable');
        const chat = await call('/chat', { method: 'POST', body: JSON.stringify(userMessage) });
        assert(chat.status === 424 && /Could not reach/.test(((await chat.json()) as any).message), 'a clear error, not a hang');
        process.env.OLLAMA_URL = `http://127.0.0.1:${enginePort}`;
    });

    server.close();
    engine.close();
    engine.closeAllConnections?.();
    setTimeout(() => process.exit(process.exitCode ?? 0), 100);
};

main().catch(error => { console.error(error); process.exit(1); });
