/** AUD-51 (SEC-010, K10): administrator CLI password reset. */
import { test, expect, registerUser } from '../fixtures/test';
import { execFileSync, spawnSync } from 'node:child_process';
import { request as pwRequest } from '@playwright/test';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), process.cwd().endsWith('e2e') ? '../..' : '.');
const run = (args: string[]) => spawnSync('npx', ['--prefix', ROOT, 'tsx', path.join(ROOT, 'server/src/cli/reset-password.ts'), ...args], {
  cwd: path.join(ROOT, 'server'),
  encoding: 'utf8',
  env: {
    PATH: process.env.PATH, HOME: process.env.HOME,
    DATABASE_HOST: '127.0.0.1', DATABASE_PORT: '54329', DATABASE_USER: 'crystal', DATABASE_PASSWORD: 'crystal_qa_pw', DATABASE_NAME: 'crystal',
    JWT_SECRET: 'cli-test-secret-not-used-for-signing', NODE_ENV: 'development',
  },
});

test('the CLI resets the password, signs the user out, and the new password works', async ({ baseURL }) => {
  const user = await registerUser(baseURL!, { seed: false, tag: 'cli-reset' });
  expect((await user.api.get('/api/auth/me')).status()).toBe(200);

  const out = run([user.email, 'Brand-New-Passw0rd']);
  expect(out.status, out.stderr + out.stdout).toBe(0);

  expect((await user.api.get('/api/auth/me')).status(), 'the old session is revoked').toBe(403);
  const anon = await pwRequest.newContext({ baseURL });
  expect((await anon.post('/api/auth/login', { data: { email: user.email, password: user.password } })).status()).toBe(401);
  expect((await anon.post('/api/auth/login', { data: { email: user.email, password: 'Brand-New-Passw0rd' } })).status()).toBe(200);
  await anon.dispose();
  await user.api.dispose();
});

test('the CLI generates a password when none is given and refuses weak or unknown input', async ({ baseURL }) => {
  const user = await registerUser(baseURL!, { seed: false, tag: 'cli-gen' });
  const gen = run([user.email]);
  expect(gen.status, gen.stderr).toBe(0);
  const generated = /New password: (\S+)/.exec(gen.stdout)?.[1];
  expect(generated).toBeTruthy();
  const anon = await pwRequest.newContext({ baseURL });
  expect((await anon.post('/api/auth/login', { data: { email: user.email, password: generated } })).status()).toBe(200);
  await anon.dispose();

  expect(run([user.email, 'short']).status).toBe(2);
  expect(run(['nobody@crystal.test', 'Long-Enough-123']).status).toBe(1);
  await user.api.dispose();
});
