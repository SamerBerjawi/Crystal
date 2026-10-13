/** AUD-10 (SEC-001): the price-scraping proxy must be authenticated and must not reach internal addresses. */
import { test, expect, registerUser } from '../fixtures/test';
import { request as pwRequest } from '@playwright/test';

const enc = encodeURIComponent;

test('smart-fetch requires a signed-in user', async ({ baseURL }) => {
  const anon = await pwRequest.newContext({ baseURL });
  const res = await anon.get(`/api/smart-fetch?url=${enc('http://127.0.0.1:3001/api')}`);
  expect(res.status()).toBe(401);
  await anon.dispose();
});

test('smart-fetch refuses internal and non-http targets for signed-in users', async ({ baseURL }) => {
  const user = await registerUser(baseURL!, { seed: false, tag: 'ssrf' });
  for (const target of [
    'http://127.0.0.1:3001/api/health',
    'http://localhost:3001/api/health',
    'http://[::1]:3001/',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.5/',
    'http://2130706433/',
    'file:///etc/passwd',
    'ftp://example.com/',
    'http://user:pw@example.com/',
  ]) {
    const res = await user.api.get(`/api/smart-fetch?url=${enc(target)}`);
    expect(res.status(), `${target} should be blocked`).toBe(400);
  }
  const missing = await user.api.get('/api/smart-fetch');
  expect(missing.status()).toBe(400);
  await user.api.dispose();
});

test('smart-fetch is rate limited per user', async ({ baseURL }) => {
  const user = await registerUser(baseURL!, { seed: false, tag: 'ssrf-rate' });
  let limited = false;
  for (let i = 0; i < 40 && !limited; i++) {
    const res = await user.api.get(`/api/smart-fetch?url=${enc('http://127.0.0.1/')}`);
    limited = res.status() === 429;
  }
  expect(limited).toBe(true);
  await user.api.dispose();
});
