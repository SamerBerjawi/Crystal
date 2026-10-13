/** AUD-32 (SEC-009): the server validates account fields instead of accepting 1-char passwords or 500ing on long names. */
import { test, expect, registerUser, newEmail, TEST_PASSWORD } from '../fixtures/test';
import { request as pwRequest } from '@playwright/test';

const base = { firstName: 'Qa', lastName: 'Tester', password: TEST_PASSWORD };

test('register rejects short/long passwords, long names and bad emails with a 400 and a field message', async ({ baseURL }) => {
  const api = await pwRequest.newContext({ baseURL });
  const cases: [Record<string, string>, RegExp][] = [
    [{ password: 'short' }, /at least 8/i],
    [{ password: 'é'.repeat(40) }, /at most 72 bytes/i],
    [{ firstName: 'A'.repeat(300) }, /first name.*100 characters/i],
    [{ lastName: 'B'.repeat(300) }, /last name.*100 characters/i],
    [{ email: 'not-an-email' }, /valid email/i],
  ];
  for (const [override, message] of cases) {
    const res = await api.post('/api/auth/register', { data: { ...base, email: newEmail('val'), ...override } });
    expect(res.status(), JSON.stringify(override).slice(0, 60)).toBe(400);
    expect((await res.json()).message).toMatch(message);
  }
  await api.dispose();
});

test('change-password enforces the same password policy', async ({ baseURL }) => {
  const user = await registerUser(baseURL!, { seed: false, tag: 'chpw' });
  const res = await user.api.post('/api/users/me/change-password', { data: { currentPassword: user.password, newPassword: 'abc' } });
  expect(res.status()).toBe(400);
  expect((await res.json()).message).toMatch(/at least 8/i);
  await user.api.dispose();
});

test('an 8-character password is accepted', async ({ baseURL }) => {
  const api = await pwRequest.newContext({ baseURL });
  const res = await api.post('/api/auth/register', { data: { ...base, email: newEmail('ok8'), password: '12345678' } });
  expect(res.status()).toBe(201);
  await api.dispose();
});
