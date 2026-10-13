/** AUD-18/31/36: compression, security headers and conditional GET on the data endpoint. */
import { test, expect, registerUser } from '../fixtures/test';
import { request as pwRequest } from '@playwright/test';

const BACKEND = process.env.E2E_BACKEND_URL || 'http://127.0.0.1:3001';

test('GET /api/data is gzip-compressed and carries security headers; X-Powered-By is gone', async ({ baseURL }) => {
  const user = await registerUser(baseURL!, { tag: 'transport' });
  // Same session, straight to the backend so the preview proxy cannot alter headers.
  const direct = await pwRequest.newContext({ baseURL: BACKEND, extraHTTPHeaders: { 'Accept-Encoding': 'gzip' } });
  expect((await direct.post('/api/auth/login', { data: { email: user.email, password: user.password } })).status()).toBe(200);
  const res = await direct.get('/api/data');
  expect(res.status()).toBe(200);
  const h = res.headers();
  expect(h['content-encoding']).toBe('gzip');
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['x-powered-by']).toBeUndefined();
  await direct.dispose();
  await user.api.dispose();
});

test('an unchanged blob answers 304 to If-None-Match and a changed one answers 200', async ({ baseURL }) => {
  const user = await registerUser(baseURL!, { tag: 'etag' });
  const first = await user.api.get('/api/data');
  const etag = first.headers()['etag'];
  expect(etag).toBeTruthy();

  const same = await user.api.get('/api/data', { headers: { 'If-None-Match': etag } });
  expect(same.status()).toBe(304);

  const save = await user.api.post('/api/data', { data: { partial: true, data: { tags: [{ id: 't1', name: 'x', color: '#fff' }] }, lastUpdatedAt: new Date().toISOString() } });
  expect(save.status()).toBe(200);
  const after = await user.api.get('/api/data', { headers: { 'If-None-Match': etag } });
  expect(after.status()).toBe(200);
  expect(after.headers()['etag']).not.toBe(etag);
  await user.api.dispose();
});
