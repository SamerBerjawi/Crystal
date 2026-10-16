/** AUD-13 (SEC-004): the Enable Banking private key is encrypted server-side and never stored in the blob or returned. */
import { test, expect, registerUser } from '../fixtures/test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Client } = require('../../../server/node_modules/pg');

const PEM = '-----BEGIN PRIVATE KEY-----\nQUJDREVGR0g=\n-----END PRIVATE KEY-----';

async function sql<T = any>(query: string, params: unknown[] = []): Promise<T[]> {
  const c = new Client({ host: '127.0.0.1', port: 54329, user: 'crystal', password: 'crystal_qa_pw', database: 'crystal' });
  await c.connect();
  try { return (await c.query(query, params)).rows; } finally { await c.end(); }
}
const userId = async (email: string) => (await sql('SELECT id FROM users WHERE email = $1', [email]))[0].id as number;

test('a key submitted with the connection is moved to the encrypted store and scrubbed from the blob', async ({ baseURL }) => {
  const user = await registerUser(baseURL!, { seed: false, tag: 'ebkey' });
  const conn = { id: 'eb-1', applicationId: 'app-123', countryCode: 'FI', clientCertificate: PEM, status: 'pending', accounts: [] };

  const save = await user.api.post('/api/data', { data: { partial: true, data: { enableBankingConnections: [conn] } } });
  expect(save.status()).toBe(200);

  const blob = await (await user.api.get('/api/data')).json();
  expect(JSON.stringify(blob)).not.toContain('PRIVATE KEY');
  expect(blob.enableBankingConnections[0].clientCertificate).toBeUndefined();
  expect(blob.enableBankingConnections[0].applicationId).toBe('app-123');

  const status = await (await user.api.get('/api/enable-banking/credentials')).json();
  expect(status).toEqual({ configured: true, applicationId: 'app-123' });

  const id = await userId(user.email);
  const [row] = await sql('SELECT encrypted_key FROM enable_banking_credentials WHERE user_id = $1', [id]);
  expect(row.encrypted_key).not.toContain('PRIVATE KEY');
  expect(row.encrypted_key).not.toContain('QUJDREVGR0g');
  const [stored] = await sql('SELECT data::text AS t FROM financial_data WHERE user_id = $1', [id]);
  expect(stored.t).not.toContain('PRIVATE KEY');
  await user.api.dispose();
});

test('pending connections are stored and returned without the key', async ({ baseURL }) => {
  const user = await registerUser(baseURL!, { seed: false, tag: 'ebpending' });
  const res = await user.api.post('/api/enable-banking/pending', { data: { connection: { id: 'eb-p', applicationId: 'app', clientCertificate: PEM } } });
  expect(res.status()).toBe(200);
  const got = await (await user.api.get('/api/enable-banking/pending/eb-p')).json();
  expect(got.connection.clientCertificate).toBeUndefined();
  expect(got.connection.applicationId).toBe('app');
  const [stored] = await sql('SELECT data::text AS t FROM financial_data WHERE user_id = $1', [await userId(user.email)]);
  expect(stored.t).not.toContain('PRIVATE KEY');
  await user.api.dispose();
});

test('a legacy blob that still holds the key is migrated on the next load', async ({ baseURL }) => {
  const user = await registerUser(baseURL!, { seed: false, tag: 'eblegacy' });
  const id = await userId(user.email);
  const legacy = { enableBankingConnections: [{ id: 'eb-old', applicationId: 'old-app', clientCertificate: PEM, accounts: [] }], enableBankingPendingConnections: { 'eb-old': { id: 'eb-old', clientCertificate: PEM } } };
  await sql('UPDATE financial_data SET data = $2::jsonb WHERE user_id = $1', [id, JSON.stringify(legacy)]);

  const blob = await (await user.api.get('/api/data')).json();
  expect(JSON.stringify(blob)).not.toContain('PRIVATE KEY');
  const [stored] = await sql('SELECT data::text AS t FROM financial_data WHERE user_id = $1', [id]);
  expect(stored.t).not.toContain('PRIVATE KEY');
  expect(await (await user.api.get('/api/enable-banking/credentials')).json()).toEqual({ configured: true, applicationId: 'old-app' });
  await user.api.dispose();
});

test('provider calls without stored or supplied credentials are rejected; credentials can be deleted', async ({ baseURL }) => {
  const user = await registerUser(baseURL!, { seed: false, tag: 'ebnone' });
  const noCreds = await user.api.post('/api/enable-banking/aspsps', { data: { applicationId: 'x', countryCode: 'FI' } });
  expect(noCreds.status()).toBe(400);
  expect((await noCreds.json()).message).toMatch(/not configured/i);

  await user.api.post('/api/data', { data: { partial: true, data: { enableBankingConnections: [{ id: 'c', applicationId: 'a', clientCertificate: PEM, accounts: [] }] } } });
  expect((await (await user.api.get('/api/enable-banking/credentials')).json()).configured).toBe(true);
  expect((await user.api.delete('/api/enable-banking/credentials')).status()).toBe(200);
  expect((await (await user.api.get('/api/enable-banking/credentials')).json()).configured).toBe(false);
  await user.api.dispose();
});
