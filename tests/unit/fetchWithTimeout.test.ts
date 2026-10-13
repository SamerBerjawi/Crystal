import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

const serve = (handler: http.RequestListener) => new Promise<{ url: string; close: () => void }>(resolve => {
    const server = http.createServer(handler).listen(0, '127.0.0.1', () => {
        const { port } = server.address() as any;
        resolve({ url: `http://127.0.0.1:${port}`, close: () => { server.closeAllConnections?.(); server.close(); } });
    });
});

test('rejects with a timeout error when the server stalls', async () => {
    const s = await serve(() => { /* never respond */ });
    try {
        await assert.rejects(fetchWithTimeout(s.url, { timeoutMs: 150 }), /timed out/i);
    } finally { s.close(); }
});
test('passes through a normal response', async () => {
    const s = await serve((_req, res) => res.end('ok'));
    try {
        const r = await fetchWithTimeout(s.url, { timeoutMs: 1000 });
        assert.equal(await r.text(), 'ok');
    } finally { s.close(); }
});
test('honours a caller abort signal', async () => {
    const s = await serve(() => { /* never respond */ });
    try {
        const c = new AbortController();
        const p = fetchWithTimeout(s.url, { timeoutMs: 5000, signal: c.signal });
        setTimeout(() => c.abort(), 50);
        await assert.rejects(p, error => !/timed out/i.test(String((error as Error).message)));
    } finally { s.close(); }
});
