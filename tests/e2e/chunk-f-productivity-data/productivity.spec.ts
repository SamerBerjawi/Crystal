/**
 * Chunk F — Productivity, settings & data (inventory workflows W34–W40).
 */
import { test, expect, goTo, navigate, isMobile, serverData, waitForSave, watch, SETTLE_MS, openBug } from '../fixtures/test';
import type { Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const drawer = (page: Page) => page.locator('div.fixed').filter({ has: page.locator('input,select,textarea') }).last();

test.describe('W34 Quotes & invoices', () => {
  async function openNewInvoice(page: Page, kind: 'New Invoice' | 'Draft Quote' = 'New Invoice') {
    await goTo(page, '/invoices');
    await page.getByRole('button', { name: kind }).first().click();
    await expect(page.getByPlaceholder('e.g. Acme Corp or Jane Doe')).toBeVisible();
  }
  async function fillInvoice(page: Page, client: string) {
    if (client) await page.getByPlaceholder('e.g. Acme Corp or Jane Doe').fill(client);
    await page.getByPlaceholder(/item or service descriptio/i).first().fill('QA consulting');
    const nums = drawer(page).locator('input[type="number"][required]');
    await nums.nth(0).fill('2');
    await nums.nth(1).fill('150');
  }

  test('issue an invoice', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).invoices.length;
    await openNewInvoice(page);
    await fillInvoice(page, 'QA Client BV');
    const saved = waitForSave(page);
    await page.getByRole('button', { name: /issue invoice/i }).click();
    expect((await saved).status()).toBe(200);
    const inv = (await serverData(user)).invoices;
    expect(inv.length).toBe(before + 1);
    const created = inv.find((i: any) => JSON.stringify(i).includes('QA Client BV'));
    expect(created).toBeTruthy();
    expect(JSON.stringify(created)).toMatch(/300/);
  });

  test('invoice without a client is rejected', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).invoices.length;
    await openNewInvoice(page);
    await fillInvoice(page, '');
    await page.getByRole('button', { name: /issue invoice/i }).click();
    await page.waitForTimeout(2500);
    expect((await serverData(user)).invoices.length).toBe(before);
  });

  test('draft a quote and convert it to an invoice', async ({ authedPage: page, user }) => {
    await openNewInvoice(page, 'Draft Quote');
    await fillInvoice(page, 'QA Quote Client');
    const saved = waitForSave(page);
    await page.locator('div.fixed button:visible').filter({ hasText: /issue|save|create|draft/i }).last().click();
    expect((await saved).status()).toBe(200);
    await page.getByRole('button', { name: /^proposals/i }).first().click().catch(() => {});
    const convert = page.getByRole('button', { name: /convert to invoice/i }).first();
    await expect(convert).toBeVisible();
    const saved2 = waitForSave(page);
    await convert.click();
    expect((await saved2).status()).toBe(200);
    const docs = (await serverData(user)).invoices.filter((i: any) => JSON.stringify(i).includes('QA Quote Client'));
    expect(docs.length, 'the quote and a new invoice').toBe(2);
    const quote = docs.find((d: any) => d.type === 'quote');
    const invoice = docs.find((d: any) => d.type === 'invoice');
    expect(quote?.status).toBe('accepted');
    expect(invoice?.status).toBe('draft');
    expect(invoice.id).not.toBe(quote.id);
    expect(invoice.number).toMatch(/^INV-/);
  });

  test('pagination controls work when there are more records', async ({ authedPage: page, user }) => {
    // 24 invoices -> 3 pages of 10. Seeded through the API so the list is long enough to page.
    const base = (await serverData(user)).invoices.find((i: any) => i.type === 'invoice');
    const many = Array.from({ length: 24 }, (_, i) => ({ ...base, id: `qa-inv-${i}`, number: `INV-QA-${String(i).padStart(3, '0')}`, entityName: `QA Client ${i}`, date: `2026-09-${String((i % 28) + 1).padStart(2, '0')}` }));
    const res = await user.api.post('/api/data', { data: { partial: true, data: { invoices: many } } });
    expect(res.status()).toBe(200);
    await goTo(page, '/invoices');
    const next = page.getByRole('button', { name: 'Next page' });
    const prev = page.getByRole('button', { name: 'Previous page' });
    const rows = page.locator('main tbody tr');
    await expect(prev).toBeDisabled();
    await expect(rows).toHaveCount(10);
    await expect(page.locator('main')).toContainText('Page 1 of 3');
    await next.click();
    await expect(page.locator('main')).toContainText('Page 2 of 3');
    await next.click();
    await expect(page.locator('main')).toContainText('Page 3 of 3');
    await expect(rows).toHaveCount(4);
    await expect(next).toBeDisabled();
    await prev.click();
    await expect(page.locator('main')).toContainText('Page 2 of 3');
  });
});

test.describe('W35 Tasks', () => {
  async function openNewTask(page: Page) {
    await goTo(page, '/tasks');
    await page.getByRole('button', { name: 'New Task' }).first().click();
    await expect(page.getByPlaceholder('Define mission goal...')).toBeVisible();
  }

  test('create a task', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).tasks.length;
    await openNewTask(page);
    await page.getByPlaceholder('Define mission goal...').fill('QA task');
    const saved = waitForSave(page);
    await page.getByRole('button', { name: /initialize objective/i }).click();
    expect((await saved).status()).toBe(200);
    expect((await serverData(user)).tasks.length).toBe(before + 1);
  });

  test('task without a title is rejected', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).tasks.length;
    await openNewTask(page);
    await page.getByRole('button', { name: /initialize objective/i }).click();
    await page.waitForTimeout(2500);
    expect((await serverData(user)).tasks.length).toBe(before);
  });

  test('very long task title does not break the layout', async ({ authedPage: page }) => {
    await openNewTask(page);
    await page.getByPlaceholder('Define mission goal...').fill('T'.repeat(400));
    await page.getByRole('button', { name: /initialize objective/i }).click();
    await page.waitForTimeout(1500);
    expect(await page.locator('main').evaluate(m => m.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  });
});

test.describe('W36 Preferences', () => {
  test('theme change applies immediately and survives refresh', async ({ authedPage: page }) => {
    await goTo(page, '/preferences');
    await page.getByRole('button').filter({ hasText: /^dark/i }).first().click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('changing the currency is saved to the account', async ({ authedPage: page, user }) => {
    await goTo(page, '/preferences');
    const sel = page.locator('main select').first();
    const target = await sel.evaluate((s: HTMLSelectElement) => [...s.options].find(o => /USD|\$/.test(o.text))?.value ?? s.options[1].value);
    const saved = waitForSave(page);
    await sel.selectOption(target);
    expect((await saved).status()).toBe(200);
    expect(JSON.stringify((await serverData(user)).preferences.currency)).toMatch(/USD|\$/);
  });
});

test.describe('W37 Data management', () => {
  async function runImport(page: Page, file: string) {
    await goTo(page, '/data-management');
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await page.getByRole('button', { name: /transactions \(csv\)/i }).click();
    await page.locator('input[type=file]').first().setInputFiles(file);
    await page.waitForTimeout(1000);
    for (let i = 0; i < 8; i++) {
      const btn = page.locator('div.fixed button:visible').filter({ hasText: /^(next step|publish|import|finish|confirm)/i }).last();
      if (!(await btn.count())) break;
      await btn.click();
      await page.waitForTimeout(900);
    }
  }

  const imported = (d: any) => d.transactions.filter((t: any) => String(t.importId || '').startsWith('imp-'));

  test('CSV import keeps European-format amounts (-12,50 → -12.50; 1.234,56 → 1234.56)', async ({ authedPage: page, user }) => {
    await runImport(page, 'fixtures/files/eu-transactions.csv');
    await expect.poll(async () => imported(await serverData(user)).length, { timeout: 12_000 }).toBe(3);
    const amounts = imported(await serverData(user)).map((t: any) => t.amount).sort((a: number, b: number) => a - b);
    expect(amounts).toEqual([-45.1, -12.5, 1234.56]);
  });

  test('CSV import auto-maps an obvious "Description" column', async ({ authedPage: page, user }) => {
    await runImport(page, 'fixtures/files/eu-transactions.csv');
    await expect.poll(async () => imported(await serverData(user)).length, { timeout: 12_000 }).toBe(3);
    const descs = imported(await serverData(user)).map((t: any) => t.description).sort();
    expect(descs).toEqual(['QA Coffee', 'QA Groceries', 'QA Salary']);
  });

  test('CSV import that creates a new account attaches transactions to an account that exists', async ({ authedPage: page, user }) => {
    await runImport(page, 'fixtures/files/eu-transactions.csv');
    await expect.poll(async () => imported(await serverData(user)).length, { timeout: 12_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(2000);
    const d = await serverData(user);
    const ids = new Set(d.accounts.map((a: any) => a.id));
    expect(d.accounts.some((a: any) => a.name === 'QA Import Account'), 'new account "QA Import Account" should exist').toBe(true);
    expect(imported(d).filter((t: any) => !ids.has(t.accountId)).length, 'orphaned imported transactions').toBe(0);
  });

  test('full JSON backup downloads valid JSON with the data', async ({ authedPage: page }) => {
    await goTo(page, '/data-management');
    await page.getByRole('button', { name: 'Backup', exact: true }).click();
    await page.getByRole('button', { name: /full json backup/i }).click().catch(() => {});
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: /^export/i }).last().click();
    const file = await dl;
    const body = await file.createReadStream().then(s => s.toArray()).then(c => Buffer.concat(c).toString('utf8'));
    const json = JSON.parse(body);
    expect(Array.isArray(json.accounts) && json.accounts.length).toBeGreaterThan(0);
  });

  test('CSV tables export downloads', async ({ authedPage: page }) => {
    await goTo(page, '/data-management');
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.getByRole('button', { name: /csv tables/i }).click().catch(() => {});
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: /^export/i }).last().click();
    const file = await dl;
    expect(file.suggestedFilename()).toMatch(/\.(csv|zip)$/);
  });

  test('restore a JSON backup brings deleted data back', async ({ authedPage: page, user }) => {
    // Make a backup file from the server copy, then remove a task and restore.
    const d = await serverData(user);
    const backupPath = test.info().outputPath('backup.json');
    writeFileSync(backupPath, JSON.stringify({ tasks: d.tasks }));
    await user.api.post('/api/data', { data: { partial: true, data: { tasks: [] } } });
    await goTo(page, '/data-management');
    await page.getByRole('button', { name: 'Restore', exact: true }).click();
    await page.locator('input[type=file]').first().setInputFiles(backupPath);
    await page.waitForTimeout(800);
    const saved = waitForSave(page);
    await page.getByRole('button', { name: /restore selected data/i }).click();
    page.on('dialog', x => x.accept());
    expect((await saved).status()).toBe(200);
    expect((await serverData(user)).tasks.length).toBe(d.tasks.length);
  });

  test('factory reset: Continue → type RESET → server copy is wiped', async ({ authedPage: page, user }) => {
    await goTo(page, '/data-management');
    await page.getByRole('button', { name: 'Execute Wipe' }).click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByText('Final Confirmation'), 'second confirmation step should appear').toBeVisible({ timeout: 3000 });
    const confirm = page.getByRole('button', { name: 'Reset account' });
    await expect(confirm).toBeDisabled();
    await page.locator('#confirm-input').fill('RESET');
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect.poll(async () => ((await serverData(user)).accounts ?? []).length, { timeout: 10_000 }).toBe(0);
    expect(((await serverData(user)).transactions ?? []).length).toBe(0);
  });
});

test.describe('W38 Dashboard customization', () => {
  test('add a widget in edit mode and it persists after refresh', async ({ authedPage: page }) => {
    test.skip(isMobile(page), 'desktop dashboard grid');
    await goTo(page, '/');
    await page.getByRole('button', { name: 'Customize' }).click();
    const beforeCount = await page.getByRole('button', { name: 'Remove widget' }).count();
    // Everything is on display by default, so remove one first, then add it back from the picker.
    await page.getByRole('button', { name: 'Remove widget' }).first().click();
    await expect(page.getByRole('button', { name: 'Remove widget' })).toHaveCount(beforeCount - 1);
    await page.getByRole('button', { name: 'Add Widget' }).click();
    // Each available widget is a full-width list button inside the "Add Dashboard Widget" dialog.
    await page.locator('div.fixed button.w-full').first().click();
    await expect(page.getByRole('button', { name: 'Remove widget' })).toHaveCount(beforeCount);
    await page.getByRole('button', { name: 'Finish Editing' }).click();
    await page.waitForTimeout(2500);
    await page.reload();
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(SETTLE_MS);
    await page.getByRole('button', { name: 'Customize' }).click();
    expect(await page.getByRole('button', { name: 'Remove widget' }).count(), 'added widget should persist').toBe(beforeCount);
  });

  test('remove a widget and it stays removed after refresh', async ({ authedPage: page }) => {
    test.skip(isMobile(page), 'desktop dashboard grid');
    await goTo(page, '/');
    await page.getByRole('button', { name: 'Customize' }).click();
    const before = await page.getByRole('button', { name: 'Remove widget' }).count();
    await page.getByRole('button', { name: 'Remove widget' }).first().click();
    await expect(page.getByRole('button', { name: 'Remove widget' })).toHaveCount(before - 1);
    await page.getByRole('button', { name: 'Finish Editing' }).click();
    await page.waitForTimeout(2500);
    await page.reload();
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(SETTLE_MS);
    await page.getByRole('button', { name: 'Customize' }).click();
    expect(await page.getByRole('button', { name: 'Remove widget' }).count(), 'removed widget must not come back').toBe(before - 1);
  });
});

test.describe('W39 Global navigation', () => {
  test('⌘K command center finds and opens a page', async ({ authedPage: page }) => {
    test.skip(isMobile(page), 'keyboard');
    await goTo(page, '/');
    await page.keyboard.press('Meta+k');
    await page.getByPlaceholder('What are you looking for?').fill('Budget');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/budget/);
  });

  test('"g" then "t" goes to Transactions; "?" opens the shortcuts list', async ({ authedPage: page }) => {
    test.skip(isMobile(page), 'keyboard');
    await goTo(page, '/');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('g'); await page.keyboard.press('t');
    await expect(page).toHaveURL(/\/transactions/);
    await page.keyboard.press('Shift+?');
    await expect(page.getByText('Keyboard Shortcuts', { exact: false }).first()).toBeVisible();
  });

  test('privacy mode hides amounts', async ({ authedPage: page }) => {
    openBug('AUD-73');
    test.skip(isMobile(page), 'privacy toggle lives in the off-canvas sidebar on mobile');
    await goTo(page, '/accounts');
    const btn = page.getByRole('button', { name: /privacy mode/i }).filter({ visible: true }).first();
    test.skip((await btn.count()) === 0, 'privacy toggle not reachable at this width (sidebar hidden on mobile)');
    await btn.click();
    await page.waitForTimeout(400);
    const blurred = await page.locator('main').getByText(/€\s?3,450\.75/).first().evaluate(e => { let n: Element | null = e; while (n) { const f = getComputedStyle(n).filter; if (f && f.includes('blur')) return true; n = n.parentElement; } return /•|\*{3}/.test((e as HTMLElement).innerText); }).catch(() => true);
    expect(blurred).toBe(true);
  });

  test('mobile "More" sheet navigates to Tags', async ({ authedPage: page }) => {
    test.skip(!isMobile(page), 'mobile only');
    await goTo(page, '/');
    await page.getByRole('button', { name: /more navigation options/i }).click();
    await page.getByRole('button', { name: 'Tags' }).click();
    await expect(page).toHaveURL(/\/tags/);
  });

  test('unknown URL tells the user the page does not exist', async ({ authedPage: page }) => {
    await goTo(page, '/this-page-does-not-exist', false);
    await expect(page.getByText(/page not found/i), 'broken links must be reported, not silently shown as the Dashboard').toBeVisible({ timeout: 8000 });
  });
});

test.describe('W40 Documentation', () => {
  test('documentation renders and section navigation scrolls', async ({ authedPage: page }) => {
    const w = watch(page);
    await goTo(page, '/documentation');
    await expect(page.locator('main')).toContainText(/documentation|knowledge|guide/i);
    const navBtn = page.locator('main button:visible').nth(2);
    await navBtn.click();
    await page.waitForTimeout(500);
    expect(w.consoleErrors.filter(e => !/favicon|ResizeObserver/.test(e))).toEqual([]);
    expect(await page.locator('main').evaluate(m => m.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  });
});
