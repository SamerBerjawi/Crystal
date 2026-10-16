import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';

/** AUD-09 (REL-005): with PostgreSQL unreachable, requests must fail with a JSON 500 and the process must survive. */
const PORT = 3993;
let backend: ChildProcess;
let exited = false;

before(async () => {
  backend = spawn(process.execPath, ['--import', 'tsx', 'server/src/index.ts'], {
    cwd: new URL('../..', import.meta.url).pathname,
    env: { ...process.env, PORT: String(PORT), DATABASE_HOST: '127.0.0.1', DATABASE_PORT: '1', DATABASE_USER: 'x', DATABASE_PASSWORD: 'x', DATABASE_NAME: 'x', JWT_SECRET: 'test-secret', NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  backend.on('exit', () => { exited = true; });
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('backend did not start')), 40_000);
    backend.stdout!.on('data', d => { if (String(d).includes('Server is running')) { clearTimeout(t); resolve(); } });
  });
});
after(() => backend?.kill());

const post = (path: string, body: unknown) => fetch(`http://127.0.0.1:${PORT}${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

test('register with the database down returns a JSON 500 and the server stays up', async () => {
  const res = await post('/api/auth/register', { firstName: 'A', lastName: 'B', email: 'a@b.test', password: 'password-1' });
  assert.equal(res.status, 500);
  assert.equal((await res.json()).message, 'Failed to register user.');
  assert.equal(exited, false, 'process must not have crashed');
  assert.equal((await fetch(`http://127.0.0.1:${PORT}/api`)).status, 200);
});

test('saving data with the database down does not crash the server either', async () => {
  // No session: expect 401 from the auth layer; the point is the process keeps answering.
  const res = await post('/api/data', { accounts: [] });
  assert.ok([401, 403, 500].includes(res.status));
  assert.equal(exited, false);
  assert.equal((await fetch(`http://127.0.0.1:${PORT}/health`)).status, 503);
});
