/**
 * Chunk B — Open banking (inventory workflows W13–W15).
 *
 * The real Enable Banking API is not reachable without production credentials, so every
 * /api/enable-banking/* call except the pending-connection store is mocked at the browser.
 * This exercises the full frontend flow (credentials → banks → authorize → callback →
 * session → link → sync → import). The backend ↔ Enable Banking leg is marked Blocked.
 */
import { test, expect, goTo, serverData, waitForSave, openBug, isMobile } from '../fixtures/test';
import type { Page, Route } from '@playwright/test';

const PEM = '-----BEGIN PRIVATE KEY-----\nQA-TEST-ONLY\n-----END PRIVATE KEY-----';

const providerTx = [
  { transaction_id: 'tx-coffee-1', booking_date: '2026-10-10', transaction_amount: { amount: '3.50', currency: 'EUR' }, credit_debit_indicator: 'DBIT', remittance_information: ['COFFEE BAR'], creditor: { name: 'Coffee Bar' } },
  { transaction_id: 'tx-coffee-2', booking_date: '2026-10-10', transaction_amount: { amount: '3.50', currency: 'EUR' }, credit_debit_indicator: 'DBIT', remittance_information: ['COFFEE BAR'], creditor: { name: 'Coffee Bar' } },
  { transaction_id: 'tx-salary-1', booking_date: '2026-10-01', transaction_amount: { amount: '2500.00', currency: 'EUR' }, credit_debit_indicator: 'CRDT', remittance_information: ['SALARY OCT'], debtor: { name: 'Acme Corp' } },
];

type MockOpts = { failBalances?: boolean; failAspsps?: boolean };

async function mockEnableBanking(page: Page, baseURL: string, opts: MockOpts = {}) {
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/enable-banking/aspsps', r => opts.failAspsps ? json(r, { message: 'Enable Banking request failed (401): invalid JWT' }, 500) : json(r, [{ name: 'QA Test Bank', country: 'FI' }, { name: 'Other Bank', country: 'FI' }]));
  await page.route('**/api/enable-banking/authorize', async r => {
    const body = r.request().postDataJSON();
    json(r, { authorizationUrl: `${baseURL}/enable-banking/callback?code=qa-code&state=${encodeURIComponent(body.state)}`, authorizationId: 'auth-qa', redirectUrl: `${baseURL}/enable-banking/callback` });
  });
  await page.route('**/api/enable-banking/session', r => json(r, { session_id: 'sess-qa', access: { valid_until: '2027-01-01T00:00:00Z' }, accounts: [{ uid: 'qa-acc-1', currency: 'EUR' }] }));
  await page.route('**/api/enable-banking/session/fetch', r => json(r, { accounts: [{ uid: 'qa-acc-1', currency: 'EUR', name: 'QA Current' }] }));
  await page.route('**/api/enable-banking/accounts/*/details', r => json(r, { name: 'QA Current', currency: 'EUR' }));
  await page.route('**/api/enable-banking/accounts/*/balances', r => opts.failBalances ? json(r, { message: 'Enable Banking request failed (503)' }, 500) : json(r, { balances: [{ balance_amount: { amount: '250.00', currency: 'EUR' }, balance_type: 'CLBD' }] }));
  await page.route('**/api/enable-banking/accounts/*/transactions', r => json(r, { transactions: providerTx }));
}

async function connectQaBank(page: Page) {
  await goTo(page, '/integrations');
  await page.getByPlaceholder('app_xxxxxxxx').fill('app_qa_test');
  await page.locator('textarea').first().fill(PEM);
  await page.getByRole('textbox', { name: 'Country code (2 letters)' }).fill('FI');
  await page.getByRole('button', { name: 'Find Banks' }).click();
  const select = page.locator('select').filter({ has: page.locator('option', { hasText: 'QA Test Bank' }) });
  await expect(select).toBeEnabled();
  await select.selectOption({ label: 'QA Test Bank (FI)' });
  await page.getByRole('button', { name: 'Authorize Link' }).click();
}

test.describe('W13 Connect a bank', () => {
  test('a user with no bank connections sees none (no demo connections injected)', async ({ authedPage: page, user }) => {
    expect((await serverData(user)).enableBankingConnections ?? []).toEqual([]);
    await goTo(page, '/integrations');
    await expect(page.getByRole('heading', { name: 'BNP Paribas Fortis' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Revolut Bank' })).toHaveCount(0);
  });

  test('deleting all connections is permanent (they do not come back after refresh)', async ({ authedPage: page, user }) => {
    await goTo(page, '/integrations');
    page.on('dialog', d => d.accept());
    for (let i = 0; i < 5 && (await page.getByRole('button', { name: 'Delete connection' }).count()) > 0; i++) {
      await page.getByRole('button', { name: 'Delete connection' }).first().click();
      await page.waitForTimeout(400);
    }
    await expect(page.getByRole('button', { name: 'Delete connection' })).toHaveCount(0);
    await page.waitForTimeout(2500);
    await page.reload();
    await page.waitForTimeout(2500);
    await expect(page.getByRole('button', { name: 'Delete connection' }), 'deleted connections reappeared after refresh').toHaveCount(0);
  });

  test('Find Banks without credentials shows a validation message', async ({ authedPage: page }) => {
    await goTo(page, '/integrations');
    await page.getByPlaceholder('app_xxxxxxxx').fill('');
    await page.locator('textarea').first().fill('');
    await page.getByRole('button', { name: 'Find Banks' }).click();
    await expect(page.getByText(/application id|certificate|credentials|required/i).first()).toBeVisible();
  });

  test('invalid credentials: the provider error is shown to the user', async ({ authedPage: page, baseURL }) => {
    await mockEnableBanking(page, baseURL!, { failAspsps: true });
    await goTo(page, '/integrations');
    await page.getByPlaceholder('app_xxxxxxxx').fill('app_bad');
    await page.locator('textarea').first().fill(PEM);
    await page.getByRole('textbox', { name: 'Country code (2 letters)' }).fill('FI');
    await page.getByRole('button', { name: 'Find Banks' }).click();
    await expect(page.getByText(/invalid|failed|unable|error/i).first()).toBeVisible();
  });

  test('happy path (mocked provider): authorize → callback → connection ready, pending record cleaned up', async ({ authedPage: page, baseURL, user }) => {
    await mockEnableBanking(page, baseURL!);
    await connectQaBank(page);
    await expect(page).toHaveURL(/enable-banking\/callback|integrations/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'QA Test Bank' })).toBeVisible({ timeout: 15_000 });
    await expect.poll(async () => ((await serverData(user)).enableBankingConnections || []).find((c: any) => c.selectedBank === 'QA Test Bank')?.status, { timeout: 12_000 }).toBe('ready');
    const data = await serverData(user);
    expect(data.enableBankingConnections.find((c: any) => c.selectedBank === 'QA Test Bank').sessionId).toBe('sess-qa');
    expect(Object.keys(data.enableBankingPendingConnections || {})).toEqual([]);
  });

  test('callback without code/state shows an error and a way back', async ({ authedPage: page }) => {
    await goTo(page, '/enable-banking/callback', false);
    await expect(page.getByText(/missing|error|failed/i).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /back to integrations/i }).click();
    await expect(page).toHaveURL(/integrations/);
  });

  test('Blocked: real Enable Banking API (needs production credentials)', async () => {
    test.skip(true, 'Blocked — real Enable Banking credentials and a sandbox bank are required.');
  });
});

test.describe('W14 Link & sync', () => {
  async function connectAndLinkNew(page: Page, baseURL: string, opts: MockOpts = {}) {
    await mockEnableBanking(page, baseURL, opts);
    await connectQaBank(page);
    await page.waitForURL(/integrations/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'QA Test Bank' })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2500);
    // The newest connection (QA Test Bank) renders last; its row controls are the last matches on the page.
    await page.getByRole('button', { name: 'New', exact: true }).last().click();
    await page.getByRole('textbox', { name: 'Account name' }).last().fill('QA Bank Current');
    await page.getByRole('button', { name: /^save$/i }).last().click();
    await page.waitForTimeout(2500);
  }

  const imported = (d: any) => d.transactions.filter((t: any) => String(t.importId || '').startsWith('enable-banking-') && /^eb-eb-/.test(t.id) && /qa-acc-1/.test(t.id));
  async function syncLast(page: Page) {
    const exact = page.getByRole('button', { name: /^sync$/i });
    await ((await exact.count()) ? exact.last() : page.getByRole('button', { name: /sync this account/i }).last()).click();
    await page.waitForTimeout(800);
    // First click opens the sync-options prompt (EnableBankingSyncModal); confirm it.
    await page.getByRole('button', { name: /start sync|sync now|confirm|^sync$/i }).last().click();
    await page.waitForTimeout(1500);
  }

  test('sync imports every provider transaction, including two distinct same-day €3.50 purchases', async ({ authedPage: page, baseURL, user }) => {
    openBug('AUD-06');
    await connectAndLinkNew(page, baseURL!);
    await syncLast(page);
    await expect.poll(async () => imported(await serverData(user)).length, { timeout: 12_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(2000);
    const tx = imported(await serverData(user));
    expect(tx.length, 'expected 3 imported (coffee-1, coffee-2, salary)').toBe(3);
  });

  test('imported transactions belong to an account that exists on the server (no orphans)', async ({ authedPage: page, baseURL, user }) => {
    await connectAndLinkNew(page, baseURL!);
    await syncLast(page);
    await expect.poll(async () => imported(await serverData(user)).length, { timeout: 12_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(2000);
    const d = await serverData(user);
    const ids = new Set(d.accounts.map((a: any) => a.id));
    const tx = imported(d);
    expect(tx.filter((t: any) => !ids.has(t.accountId)).length, 'transactions pointing at a missing account').toBe(0);
  });

  test('after Save on a "New" destination the row shows as linked', async ({ authedPage: page, baseURL }) => {
    await connectAndLinkNew(page, baseURL!);
    await expect(page.locator('main').getByText('QA Current').locator('..').locator('..')).not.toContainText('Not linked');
  });

  test('re-syncing does not duplicate transactions', async ({ authedPage: page, baseURL, user }) => {
    await connectAndLinkNew(page, baseURL!);
    await syncLast(page);
    await expect.poll(async () => imported(await serverData(user)).length, { timeout: 12_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(2000);
    const first = imported(await serverData(user)).length;
    await syncLast(page);
    await page.waitForTimeout(5000);
    expect(imported(await serverData(user)).length).toBe(first);
  });

  test('sync failure is shown to the user', async ({ authedPage: page, baseURL }) => {
    test.fixme(isMobile(page), 'AUD-25 open: mobile sync button differs (hangs); audit/plan.md');
    openBug('AUD-25', !isMobile(page));
    const opts: MockOpts = {};
    await connectAndLinkNew(page, baseURL!, opts);
    opts.failBalances = true;       // the provider starts failing only after the connection is set up
    await syncLast(page);
    await page.waitForTimeout(2500);
    await expect(page.getByText(/couldn.t sync|sync failed|requires update|reauthori|503/i).first()).toBeVisible({ timeout: 5000 });
  });
});
