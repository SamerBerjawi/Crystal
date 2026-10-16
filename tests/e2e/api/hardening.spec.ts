/** AUD-52/54/55/56/57/65: backend hardening bundle (SEC-011, 013, 014, 015, 016, PERF-012). */
import { test, expect, registerUser, newEmail, TEST_PASSWORD } from '../fixtures/test';
import { request as pwRequest } from '@playwright/test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Client } = require('../../../server/node_modules/pg');
async function sql<T = any>(query: string, params: unknown[] = []): Promise<T[]> {
  const c = new Client({ host: '127.0.0.1', port: 54329, user: 'crystal', password: 'crystal_qa_pw', database: 'crystal' });
  await c.connect();
  try { return (await c.query(query, params)).rows; } finally { await c.end(); }
}

test('form-encoded bodies are rejected with 415', async ({ baseURL }) => {
  const api = await pwRequest.newContext({ baseURL });
  const res = await api.post('/api/auth/login', { form: { email: 'a@b.c', password: 'x' } });
  expect(res.status()).toBe(415);
  await api.dispose();
});

test('an oversized body is refused with 413 outside /api/data', async ({ baseURL }) => {
  const api = await pwRequest.newContext({ baseURL });
  const res = await api.post('/api/auth/login', { data: { email: 'a@b.c', password: 'x'.repeat(200_000) } });
  expect(res.status()).toBe(413);
  expect((await res.json()).message).toMatch(/too large/i);
  await api.dispose();
});

test('the large /api/data body is only accepted after authentication', async () => {
  // Straight to the backend: the dev preview proxy turns an early 401 on a large upload into its own 500.
  const api = await pwRequest.newContext({ baseURL: process.env.E2E_BACKEND_URL || 'http://127.0.0.1:3001' });
  const res = await api.post('/api/data', { data: { transactions: [], filler: 'x'.repeat(1_000_000) } });
  expect(res.status()).toBe(401);
  await api.dispose();
});

test('cross-site state-changing requests are blocked; same-origin browser requests are not', async ({ baseURL }) => {
  const api = await pwRequest.newContext({ baseURL });
  const blocked = await api.post('/api/auth/login', {
    headers: { 'Sec-Fetch-Site': 'cross-site', Origin: 'https://evil.example' },
    data: { email: 'nobody@crystal.test', password: 'whatever-123' },
  });
  expect(blocked.status()).toBe(403);
  const sameOrigin = await api.post('/api/auth/login', {
    headers: { 'Sec-Fetch-Site': 'same-origin', Origin: baseURL! },
    data: { email: 'nobody@crystal.test', password: 'whatever-123' },
  });
  expect(sameOrigin.status()).toBe(401); // reached the handler: wrong credentials, not a CSRF block
  await api.dispose();
});

test('new accounts get a local initials avatar, not a third-party URL with the email', async ({ baseURL }) => {
  const api = await pwRequest.newContext({ baseURL });
  const res = await api.post('/api/auth/register', { data: { firstName: 'Ada', lastName: 'Lovelace', email: newEmail('avatar'), password: TEST_PASSWORD } });
  expect(res.status()).toBe(201);
  const { user } = await res.json();
  expect(user.profilePictureUrl).toMatch(/^data:image\/svg\+xml;base64,/);
  expect(user.profilePictureUrl).not.toContain('pravatar');
  await api.dispose();
});

test('session last_seen_at is refreshed at most every five minutes', async ({ baseURL }) => {
  const user = await registerUser(baseURL!, { seed: false, tag: 'lastseen' });
  const [{ id }] = await sql('SELECT id FROM users WHERE email = $1', [user.email]);
  const seen = async () => (await sql('SELECT last_seen_at FROM user_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [id]))[0].last_seen_at.getTime();

  await user.api.get('/api/auth/me');
  const first = await seen();
  await new Promise(r => setTimeout(r, 1200));
  await user.api.get('/api/auth/me');
  expect(await seen(), 'a request within five minutes must not write').toBe(first);

  await sql(`UPDATE user_sessions SET last_seen_at = NOW() - INTERVAL '10 minutes' WHERE user_id = $1`, [id]);
  const stale = await seen();
  await user.api.get('/api/auth/me');
  expect(await seen(), 'a stale value is refreshed').toBeGreaterThan(stale);
  await user.api.dispose();
});

test('the health endpoint reveals nothing beyond status', async ({ baseURL }) => {
  const api = await pwRequest.newContext({ baseURL });
  const res = await api.get('/api/health');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Object.keys(body).sort()).toEqual(['status', 'timestamp', 'uptime']);
  await api.dispose();
});
