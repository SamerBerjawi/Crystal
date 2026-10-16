import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';

/** Starts `server.ts` (the dev server) on a spare port and waits until it is listening. */
const start = (port: number, env: Record<string, string>): Promise<ChildProcess> =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
      cwd: new URL('../..', import.meta.url).pathname,
      env: { ...process.env, PORT: String(port), VITE_BACKEND_URL: '', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => { child.kill(); reject(new Error('dev server did not start')); }, 40_000);
    child.stdout!.on('data', d => { if (String(d).includes('Server running')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', code => { clearTimeout(timer); reject(new Error('dev server exited early: ' + code)); });
  });

const MOCK_PORT = 3991;
const NO_MOCK_PORT = 3992;
let mock: ChildProcess;
let noMock: ChildProcess;

before(async () => {
  [mock, noMock] = await Promise.all([
    start(MOCK_PORT, { CRYSTAL_MOCK_API: '1' }),
    start(NO_MOCK_PORT, {}),
  ]);
});
after(() => { mock?.kill(); noMock?.kill(); });

const api = (port: number, path: string, init: RequestInit = {}) => fetch(`http://127.0.0.1:${port}${path}`, init);
const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('without CRYSTAL_MOCK_API the dev server does not fake an API', async () => {
  const res = await api(NO_MOCK_PORT, '/api/data');
  assert.equal(res.status, 503);
  assert.match((await res.json()).message, /VITE_BACKEND_URL|CRYSTAL_MOCK_API/);
});

test('mock: a wrong password is rejected, the right one signs in', async () => {
  const wrong = await api(MOCK_PORT, '/api/auth/login', json({ email: 'demo@crystal.app', password: 'WRONG' }));
  assert.equal(wrong.status, 401);
  const unknown = await api(MOCK_PORT, '/api/auth/login', json({ email: 'nobody@crystal.app', password: 'x' }));
  assert.equal(unknown.status, 401);
  const ok = await api(MOCK_PORT, '/api/auth/login', json({ email: 'demo@crystal.app', password: 'password' }));
  assert.equal(ok.status, 200);
});

test('mock: data requires a session and users cannot see each other', async () => {
  assert.equal((await api(MOCK_PORT, '/api/data')).status, 401);
  assert.equal((await api(MOCK_PORT, '/api/auth/me')).status, 401);
  const reg = await api(MOCK_PORT, '/api/auth/register', json({ firstName: 'A', lastName: 'B', email: 'a@x.test', password: 'password-1' }));
  assert.equal(reg.status, 201);
  const cookie = reg.headers.get('set-cookie')!.split(';')[0];
  await api(MOCK_PORT, '/api/data', { ...json({ accounts: [{ id: 'mine' }] }), headers: { 'Content-Type': 'application/json', cookie } });
  const mine = await (await api(MOCK_PORT, '/api/data', { headers: { cookie } })).json();
  assert.equal(mine.accounts[0].id, 'mine');
  const reg2 = await api(MOCK_PORT, '/api/auth/register', json({ firstName: 'C', lastName: 'D', email: 'c@x.test', password: 'password-2' }));
  const cookie2 = reg2.headers.get('set-cookie')!.split(';')[0];
  const theirs = await (await api(MOCK_PORT, '/api/data', { headers: { cookie: cookie2 } })).json();
  assert.deepEqual(theirs, {});
});

test('the open AI proxy is gone and smart-fetch refuses loopback targets', async () => {
  assert.equal((await api(MOCK_PORT, '/api/ai/proxy', json({ endpoint: 'http://127.0.0.1/', method: 'GET', headers: {} }))).status, 404);
  const reg = await api(MOCK_PORT, '/api/auth/register', json({ firstName: 'E', lastName: 'F', email: 'e@x.test', password: 'password-3' }));
  const cookie = reg.headers.get('set-cookie')!.split(';')[0];
  const noAuth = await api(MOCK_PORT, `/api/smart-fetch?url=${encodeURIComponent('http://127.0.0.1:' + MOCK_PORT + '/api')}`);
  assert.equal(noAuth.status, 401);
  const blocked = await api(MOCK_PORT, `/api/smart-fetch?url=${encodeURIComponent('http://127.0.0.1:' + MOCK_PORT + '/api')}`, { headers: { cookie } });
  assert.equal(blocked.status, 400);
});

test('mock: cross-origin requests get no CORS grant', async () => {
  const res = await api(MOCK_PORT, '/api/auth/me', { headers: { Origin: 'http://evil.example' } });
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});
