import express from 'express';
import { z } from 'zod';
import { db } from './database';
import { encryptSecret, decryptSecret } from './crypto';
import { authenticateToken, AuthRequest } from './middleware';
import { parsePublicHttpUrl, UrlBlockedError } from './urlGuard';
import { evaluateAlerts, DEFAULT_RULES, type AlertRules } from './alertRules';
import { CHANNEL_KINDS, channelProblem, privateUrlsAllowed, sendAlert, type ChannelConfig } from './alertChannels';
import { createRateLimiter } from './rateLimit';

const router = express.Router();
router.use(authenticateToken);

const alertTestRateLimiter = createRateLimiter({
    namespace: 'alert-test',
    windowMs: 60 * 1000,
    maxAttempts: 10,
    blockMs: 60 * 1000,
    message: 'Too many test alerts sent. Please wait a minute and try again.',
    key: req => `${req.ip}:${(req as AuthRequest).user?.id || 'anonymous'}`,
});

export interface AlertSettings { enabled: boolean; channel: ChannelConfig | null; rules: AlertRules }

const rulesSchema = z.object({
    consent: z.boolean(),
    budget: z.boolean(),
    budgetThreshold: z.number().min(0.5).max(0.99),
    duplicate: z.boolean(),
    lowBalance: z.boolean(),
    lowBalanceFloor: z.number().min(-1_000_000_000).max(1_000_000_000),
    lowBalanceDays: z.number().int().min(1).max(30),
    priceHike: z.boolean(),
});

const updateSchema = z.object({
    enabled: z.boolean(),
    channel: z.object({
        kind: z.enum(CHANNEL_KINDS as [string, ...string[]]),
        url: z.string().max(500),
        topic: z.string().max(200).optional(),
        /** Omitted keeps the saved token, an empty string removes it. */
        token: z.string().max(500).optional(),
    }).nullable(),
    rules: rulesSchema.partial(),
});

const mergeRules = (stored: unknown): AlertRules => {
    const parsed = rulesSchema.partial().safeParse(stored ?? {});
    return { ...DEFAULT_RULES, ...(parsed.success ? parsed.data : {}) } as AlertRules;
};

export const loadAlertSettings = async (userId: number | string): Promise<AlertSettings> => {
    const row = (await db.query(`SELECT enabled, kind, url, topic, encrypted_token, rules FROM alert_settings WHERE user_id = $1`, [userId])).rows?.[0];
    if (!row) return { enabled: false, channel: null, rules: { ...DEFAULT_RULES } };
    return {
        enabled: Boolean(row.enabled),
        channel: row.kind && row.url ? { kind: row.kind, url: row.url, topic: row.topic || undefined, token: (row.encrypted_token ? decryptSecret(row.encrypted_token) : '') || undefined } : null,
        rules: mergeRules(row.rules),
    };
};

/** What the browser may see: the token is only ever reported as present. */
const publicView = (settings: AlertSettings) => ({
    enabled: settings.enabled,
    channel: settings.channel ? { kind: settings.channel.kind, url: settings.channel.url, topic: settings.channel.topic ?? '', hasToken: Boolean(settings.channel.token) } : null,
    rules: settings.rules,
    privateUrlsAllowed: privateUrlsAllowed(),
});

router.get('/', async (req: AuthRequest, res) => {
    try {
        res.json(publicView(await loadAlertSettings(req.user!.id)));
    } catch (error) {
        console.error('Failed to read alert settings', error);
        res.status(500).json({ message: 'Unable to read alert settings' });
    }
});

router.put('/', async (req: AuthRequest, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Those alert settings are not valid.' });
    const { enabled, channel, rules } = parsed.data;
    try {
        const current = await loadAlertSettings(req.user!.id);
        let next: ChannelConfig | null = null;
        if (channel) {
            const token = channel.token === undefined ? current.channel?.token : channel.token || undefined;
            next = { kind: channel.kind as ChannelConfig['kind'], url: channel.url.trim(), topic: channel.topic?.trim() || undefined, token };
            const problem = channelProblem(next);
            if (problem) return res.status(400).json({ message: problem });
            try { parsePublicHttpUrl(next.url, privateUrlsAllowed()); } catch (error) {
                if (error instanceof UrlBlockedError) return res.status(400).json({ message: privateUrlsAllowed() ? error.message : `${error.message} Private network addresses need ALERTS_ALLOW_PRIVATE_URLS=true on the server.` });
                throw error;
            }
        }
        if (enabled && !next) return res.status(400).json({ message: 'Set up a way to send alerts before turning them on.' });
        const merged = { ...current.rules, ...rules };
        await db.query(
            `INSERT INTO alert_settings (user_id, enabled, kind, url, topic, encrypted_token, rules)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (user_id) DO UPDATE
             SET enabled = EXCLUDED.enabled, kind = EXCLUDED.kind, url = EXCLUDED.url, topic = EXCLUDED.topic,
                 encrypted_token = EXCLUDED.encrypted_token, rules = EXCLUDED.rules, updated_at = NOW()`,
            [req.user!.id, enabled, next?.kind ?? null, next?.url ?? null, next?.topic ?? null, next?.token ? encryptSecret(next.token) : null, JSON.stringify(merged)],
        );
        res.json(publicView(await loadAlertSettings(req.user!.id)));
    } catch (error) {
        console.error('Failed to save alert settings', error);
        res.status(500).json({ message: 'Unable to save alert settings' });
    }
});

router.post('/test', alertTestRateLimiter, async (req: AuthRequest, res) => {
    try {
        const { channel } = await loadAlertSettings(req.user!.id);
        if (!channel) return res.status(400).json({ message: 'Save a way to send alerts first.' });
        await sendAlert(channel, { title: 'Crystal alerts', message: 'This is a test. Alerts will arrive here.', priority: 'default' });
        res.json({ message: 'Test sent' });
    } catch (error: any) {
        // The destination answered badly or could not be reached. The detail helps the user fix the address.
        res.status(424).json({ message: `Could not deliver the test. ${error?.message ?? ''}`.trim() });
    }
});

const MAX_PER_RUN = 5;

/** Runs the rules for one user and sends what is new. Returns how many alerts went out. */
export const runAlertsForUser = async (userId: number, now = new Date()): Promise<number> => {
    const settings = await loadAlertSettings(userId);
    if (!settings.enabled || !settings.channel) return 0;
    const row = (await db.query(`SELECT data FROM financial_data WHERE user_id = $1`, [userId])).rows?.[0];
    if (!row?.data) return 0;

    const candidates = evaluateAlerts(row.data, settings.rules, now);
    if (candidates.length === 0) return 0;
    const sent = new Set<string>((await db.query(`SELECT alert_key FROM alert_log WHERE user_id = $1 AND alert_key = ANY($2)`, [userId, candidates.map(c => c.key)])).rows.map((r: any) => r.alert_key));

    let delivered = 0;
    for (const alert of candidates.filter(c => !sent.has(c.key)).slice(0, MAX_PER_RUN)) {
        try {
            await sendAlert(settings.channel, alert);
            // Recorded only after delivery, so a destination that is down is retried on the next run.
            await db.query(`INSERT INTO alert_log (user_id, alert_key) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, alert.key]);
            delivered += 1;
        } catch (error: any) {
            console.warn(`Alert delivery failed for user ${userId}: ${error?.message || error}`);
            break;
        }
    }
    return delivered;
};

let running = false;

export const runAlertsForAllUsers = async () => {
    if (running) return;
    running = true;
    try {
        const users = (await db.query(`SELECT user_id FROM alert_settings WHERE enabled = TRUE`)).rows as { user_id: number }[];
        for (const { user_id } of users) {
            try { await runAlertsForUser(user_id); } catch (error: any) { console.warn(`Alerts failed for user ${user_id}: ${error?.message || error}`); }
        }
        await db.query(`DELETE FROM alert_log WHERE sent_at < NOW() - INTERVAL '120 days'`);
    } catch (error: any) {
        console.warn('Alert run failed:', error?.message || error);
    } finally {
        running = false;
    }
};

/** Checks every user's data on a timer. ALERTS_INTERVAL_MINUTES sets how often (default 30, at least 5). */
export const startAlertScheduler = () => {
    if (process.env.ALERTS_ENABLED === 'false') return;
    const minutes = Math.max(5, Number(process.env.ALERTS_INTERVAL_MINUTES) || 30);
    setTimeout(() => void runAlertsForAllUsers(), 60_000).unref();
    setInterval(() => void runAlertsForAllUsers(), minutes * 60_000).unref();
};

export default router;
