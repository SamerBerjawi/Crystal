import { test, serverData, navigate } from '../fixtures/test';
import { readFileSync } from 'node:fs';
test('link+sync probe', async ({ authedPage: page, user, baseURL }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 768);
  const tx = [
    { transaction_id: 'tx-coffee-1', booking_date: '2026-10-10', transaction_amount: { amount: '3.50', currency: 'EUR' }, credit_debit_indicator: 'DBIT', remittance_information: ['COFFEE BAR'], creditor: { name: 'Coffee Bar' } },
    { transaction_id: 'tx-coffee-2', booking_date: '2026-10-10', transaction_amount: { amount: '3.50', currency: 'EUR' }, credit_debit_indicator: 'DBIT', remittance_information: ['COFFEE BAR'], creditor: { name: 'Coffee Bar' } },
    { transaction_id: 'tx-salary-1', booking_date: '2026-10-01', transaction_amount: { amount: '2500.00', currency: 'EUR' }, credit_debit_indicator: 'CRDT', remittance_information: ['SALARY OCT'], debtor: { name: 'Acme Corp' } },
  ];
  const json = (r: any, b: any) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  const log: string[] = []; const t0 = Date.now();
  page.on('response', r => { const u = r.url(); if (u.endsWith('/api/data') && r.request().method() === 'POST') log.push(`${Date.now() - t0}ms POST data -> ${r.status()}`); if (u.includes('/enable-banking/pending')) log.push(`${Date.now() - t0}ms ${r.request().method()} pending -> ${r.status()}`); });
  await page.route('**/api/enable-banking/aspsps', r => json(r, [{ name: 'QA Test Bank', country: 'FI' }]));
  await page.route('**/api/enable-banking/authorize', r => json(r, { authorizationUrl: `${baseURL}/enable-banking/callback?code=qa&state=${encodeURIComponent(r.request().postDataJSON().state)}`, authorizationId: 'a' }));
  await page.route('**/api/enable-banking/session', r => json(r, { session_id: 'sess-qa', accounts: [{ uid: 'qa-acc-1', currency: 'EUR' }] }));
  await page.route('**/api/enable-banking/session/fetch', r => json(r, { accounts: [{ uid: 'qa-acc-1', currency: 'EUR', name: 'QA Current' }] }));
  await page.route('**/api/enable-banking/accounts/*/details', r => json(r, { name: 'QA Current', currency: 'EUR' }));
  await page.route('**/api/enable-banking/accounts/*/balances', r => json(r, { balances: [{ balance_amount: { amount: '250.00', currency: 'EUR' } }] }));
  await page.route('**/api/enable-banking/accounts/*/transactions', r => json(r, { transactions: tx }));
  await page.goto('/integrations'); await page.waitForTimeout(1500);
  await page.getByPlaceholder('app_xxxxxxxx').fill('app_qa');
  await page.locator('textarea').first().fill('-----BEGIN PRIVATE KEY-----\nQA\n-----END PRIVATE KEY-----');
  await page.getByRole('textbox', { name: 'Country code (2 letters)' }).fill('FI');
  await page.getByRole('button', { name: 'Find Banks' }).click();
  await page.locator('select').first().selectOption({ label: 'QA Test Bank (FI)' });
  await page.getByRole('button', { name: 'Authorize Link' }).click();
  await page.waitForURL(/integrations/, { timeout: 15000 }); await page.waitForTimeout(2500);
  log.push('--- linking');
  await page.getByRole('button', { name: 'New', exact: true }).last().click();
  await page.getByRole('textbox', { name: 'Account name' }).last().fill('QA Bank Current');
  await page.getByRole('button', { name: /^save$/i }).last().click();
  await page.waitForTimeout(2500);
  log.push('--- after link UI: ' + ((await page.locator('main').innerText()).match(/QA Current[\s\S]{0,60}/)?.[0]?.replace(/\n/g, ' | ')));
  log.push('--- sync');
  await page.getByRole('button', { name: /^sync$/i }).last().click();
  await page.waitForTimeout(1000);
  const dialogBtns = await page.locator('div.fixed').last().getByRole('button').allInnerTexts();
  log.push('--- after Sync click, overlay buttons: ' + dialogBtns.join(' / '));
  const start = page.getByRole('button', { name: /start sync|sync now|confirm|^sync$/i }).last();
  await start.click().catch(e => log.push('no confirm: ' + e.message.slice(0, 60)));
  await page.waitForTimeout(5000);
  await navigate(page, '/transactions');
  const coffeeRows = await page.locator('main').getByText('Coffee Bar').count();
  const srv = await serverData(user);
  const acc = srv.accounts.find((a: any) => a.name === 'QA Bank Current');
  const coffees = srv.transactions.filter((t: any) => /coffee/i.test((t.merchant || '') + (t.description || ''))); const ids = new Set(srv.accounts.map((a: any) => a.id)); log.push('ORPHANS: ' + JSON.stringify(coffees.filter((t: any) => !ids.has(t.accountId)).map((t: any) => t.accountId)) + ' NEW ACCOUNTS: ' + JSON.stringify(srv.accounts.filter((a: any) => !/^acc-(checking|savings|hysa|amex|card|loan|mortgage|car|prop|metal|inv|crypto|pension|spare|warrant|etf|broker|vault|ev|tesla|canal)/.test(a.id)).map((a: any) => a.id + ':' + a.name))); log.push('SERVER coffee tx: ' + JSON.stringify(coffees.map((t: any) => ({ id: t.id, acc: t.accountId, amt: t.amount, imp: t.importId })))); log.push(`UI: Coffee Bar rows in transactions=${coffeeRows}; SERVER: account=${!!acc} txForAccount=${acc ? srv.transactions.filter((t: any) => t.accountId === acc.id).length : 'n/a'} conn=${srv.enableBankingConnections?.find((c: any) => c.selectedBank === 'QA Test Bank')?.status}`);
  console.log(log.filter(l => !/GET auth/.test(l)).join('\n'));
});
