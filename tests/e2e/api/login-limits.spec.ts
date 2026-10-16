/** AUD-12 (SEC-003): rotating X-Forwarded-For must not give unlimited password guesses against one account. */
import { test, expect, registerUser, newEmail } from '../fixtures/test';
import { request as pwRequest } from '@playwright/test';

test('guessing one account is limited even when the client address is spoofed', async ({ baseURL }) => {
  const user = await registerUser(baseURL!, { seed: false, tag: 'bruteforce' });
  const attacker = await pwRequest.newContext({ baseURL });
  const statuses: number[] = [];
  for (let i = 0; i < 14; i++) {
    const res = await attacker.post('/api/auth/login', {
      headers: { 'X-Forwarded-For': `10.20.30.${i + 1}` },
      data: { email: user.email, password: `wrong-${i}` },
    });
    statuses.push(res.status());
  }
  expect(statuses.filter(s => s === 401).length, 'first attempts are normal failures').toBeGreaterThanOrEqual(5);
  expect(statuses, `statuses: ${statuses.join(',')}`).toContain(429);
  // Once blocked, even the correct password is refused until the window passes.
  const correct = await attacker.post('/api/auth/login', { data: { email: user.email, password: user.password } });
  expect(correct.status()).toBe(429);
  await attacker.dispose();
  await user.api.dispose();
});

test('a different account is not affected by another account being blocked', async ({ baseURL }) => {
  const attacker = await pwRequest.newContext({ baseURL });
  const victim = await registerUser(baseURL!, { seed: false, tag: 'blocked' });
  for (let i = 0; i < 12; i++) await attacker.post('/api/auth/login', { data: { email: victim.email, password: 'nope' + i } });
  const other = await registerUser(baseURL!, { seed: false, tag: 'bystander' });
  const res = await attacker.post('/api/auth/login', { data: { email: other.email, password: other.password } });
  expect(res.status()).toBe(200);
  await attacker.dispose();
});
