import { safeFetchText } from './urlGuard';
import type { AlertCandidate } from './alertRules';

export type ChannelKind = 'ntfy' | 'gotify' | 'webhook';
export const CHANNEL_KINDS: ChannelKind[] = ['ntfy', 'gotify', 'webhook'];

export interface ChannelConfig {
    kind: ChannelKind;
    /** Server address. For ntfy this is the server (https://ntfy.sh); the topic is separate. */
    url: string;
    /** ntfy only. */
    topic?: string;
    /** ntfy access token, Gotify application token, or a webhook bearer token. */
    token?: string;
}

/** Operators who run ntfy or Gotify on their own network opt in. Otherwise only public addresses are allowed. */
export const privateUrlsAllowed = () => process.env.ALERTS_ALLOW_PRIVATE_URLS === 'true';

export type AlertMessage = Pick<AlertCandidate, 'title' | 'message' | 'priority'> & { key?: string; kind?: string };

export interface Delivery { url: string; headers: Record<string, string>; body: string }

/** What goes over the wire for a channel. Pure, so it can be tested without a network. */
export const buildDelivery = (channel: ChannelConfig, alert: AlertMessage): Delivery => {
    const base = channel.url.replace(/\/+$/, '');
    const auth: Record<string, string> = channel.token ? { Authorization: `Bearer ${channel.token}` } : {};
    if (channel.kind === 'ntfy') {
        const topic = encodeURIComponent((channel.topic || '').trim());
        return {
            url: `${base}/${topic}`,
            // Header values must be plain ASCII; the text itself travels in the body.
            headers: { ...auth, 'Content-Type': 'text/plain; charset=utf-8', Title: alert.title.replace(/[^\x20-\x7e]/g, ''), Priority: alert.priority === 'high' ? 'high' : 'default', Tags: 'moneybag' },
            body: alert.message,
        };
    }
    if (channel.kind === 'gotify') {
        return {
            url: `${base}/message`,
            headers: { 'Content-Type': 'application/json', ...(channel.token ? { 'X-Gotify-Key': channel.token } : {}) },
            body: JSON.stringify({ title: alert.title, message: alert.message, priority: alert.priority === 'high' ? 8 : 5 }),
        };
    }
    return {
        url: base,
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ title: alert.title, message: alert.message, priority: alert.priority, kind: alert.kind, key: alert.key }),
    };
};

/** Why a channel is not usable, or null when it is. */
export const channelProblem = (channel: Partial<ChannelConfig>): string | null => {
    if (!channel.kind || !CHANNEL_KINDS.includes(channel.kind)) return 'Choose ntfy, Gotify or a webhook.';
    if (!channel.url || !channel.url.trim()) return 'Enter the server address.';
    if (channel.kind === 'ntfy' && !(channel.topic || '').trim()) return 'Enter the ntfy topic.';
    if (channel.kind === 'gotify' && !channel.token) return 'Enter the Gotify application token.';
    return null;
};

export const sendAlert = async (channel: ChannelConfig, alert: AlertMessage): Promise<void> => {
    const delivery = buildDelivery(channel, alert);
    const result = await safeFetchText(delivery.url, {
        method: 'POST',
        headers: delivery.headers,
        body: delivery.body,
        timeoutMs: 8000,
        maxBytes: 64 * 1024,
        maxRedirects: 0,
        allowPrivate: privateUrlsAllowed(),
    });
    if (result.status < 200 || result.status >= 300) throw new Error(`The server answered ${result.status}.`);
};
