/**
 * AUD-02 (REL-001) / AUD-19 (PERF-004) / AUD-62 (REL-017): writers of the per-user data blob must not
 * undo each other, and a save must not require loading the stored blob.
 */
import { test, expect, registerUser, TEST_PASSWORD } from '../fixtures/test';

const task = (id: string) => ({ id, title: 'T ' + id, status: 'To Do', priority: 'Low' });

test('concurrent /pending and /api/data writes never revert each other', async ({ baseURL }) => {
  const user = await registerUser(baseURL!, { seed: false, tag: 'blob-race' });
  let tasks: any[] = [];
  const pendingIds: string[] = [];

  for (let round = 1; round <= 20; round++) {
    const current = await (await user.api.get('/api/data')).json();
    tasks = [...tasks, task('t' + round)];
    pendingIds.push('p' + round);
    const stamp = `2026-10-13 10:00:${String(round).padStart(2, '0')}`;
    const [pending, save] = await Promise.all([
      user.api.post('/api/enable-banking/pending', { data: { connection: { id: 'p' + round, status: 'pending' } } }),
      user.api.post('/api/data', {
        data: { partial: true, data: { tasks }, lastUpdatedAt: stamp, previousUpdatedAt: current.lastUpdatedAt },
      }),
    ]);
    expect(pending.status()).toBe(200);
    expect(save.status(), `round ${round}`).toBe(200);

    const after = await (await user.api.get('/api/data')).json();
    expect(after.tasks.map((t: any) => t.id), `round ${round}: save kept`).toEqual(tasks.map(t => t.id));
    expect(Object.keys(after.enableBankingPendingConnections || {}).sort(), `round ${round}: pending kept`).toEqual([...pendingIds].sort());
    expect(after.lastUpdatedAt, `round ${round}: version not rolled back`).toBe(stamp);
  }
  await user.api.dispose();
});

test('pending connections can be fetched and deleted without touching other data', async ({ baseURL }) => {
  const user = await registerUser(baseURL!, { seed: false, tag: 'blob-pending' });
  await user.api.post('/api/data', { data: { partial: true, data: { tasks: [task('keep')] }, lastUpdatedAt: 'L1' } });
  await user.api.post('/api/enable-banking/pending', { data: { connection: { id: 'abc', status: 'pending', selectedBank: 'X' } } });
  const got = await user.api.get('/api/enable-banking/pending/abc');
  expect(got.status()).toBe(200);
  expect((await got.json()).connection.selectedBank).toBe('X');
  expect((await user.api.delete('/api/enable-banking/pending/abc')).status()).toBe(200);
  expect((await user.api.get('/api/enable-banking/pending/abc')).status()).toBe(404);
  const data = await (await user.api.get('/api/data')).json();
  expect(data.tasks.map((t: any) => t.id)).toEqual(['keep']);
  expect(data.lastUpdatedAt).toBe('L1');
  await user.api.dispose();
});

test('a full save with an empty payload cannot wipe existing data; allowEmpty can', async ({ baseURL }) => {
  const user = await registerUser(baseURL!, { seed: false, tag: 'blob-empty' });
  await user.api.post('/api/data', { data: { tasks: [task('a')], accounts: [], lastUpdatedAt: 'L1' } });
  const refused = await user.api.post('/api/data', { data: { tasks: [], accounts: [], lastUpdatedAt: 'L2', previousUpdatedAt: 'L1' } });
  expect(refused.status()).toBe(409);
  expect((await (await user.api.get('/api/data')).json()).tasks).toHaveLength(1);
  const allowed = await user.api.post('/api/data', { data: { tasks: [], accounts: [], lastUpdatedAt: 'L2', previousUpdatedAt: 'L1', allowEmpty: true } });
  expect(allowed.status()).toBe(200);
  expect((await (await user.api.get('/api/data')).json()).tasks).toEqual([]);
  await user.api.dispose();
});

test('changing the password revokes every session in the same step', async ({ baseURL }) => {
  const user = await registerUser(baseURL!, { seed: false, tag: 'pw-atomic' });
  const res = await user.api.post('/api/users/me/change-password', { data: { currentPassword: TEST_PASSWORD, newPassword: 'Another-Passw0rd!' } });
  expect(res.status()).toBe(200);
  expect((await user.api.get('/api/auth/me')).status()).toBeGreaterThanOrEqual(401);
  await user.api.dispose();
});
