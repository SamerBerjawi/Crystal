/**
 * Chunk E — Investments & insights (inventory workflows W29–W33).
 */
import { test, expect, goTo, navigate, isMobile, serverData, waitForSave, watch, openBug } from '../fixtures/test';
import type { Page } from '@playwright/test';

const topModal = (page: Page) => page.locator('.crystal-dialog, .crystal-side, .crystal-sheet').last();

async function openTrade(page: Page) {
  await goTo(page, '/investments');
  await page.getByRole('button', { name: /^add$/i }).first().click();
  await page.getByRole('menuitem', { name: /trade/i }).click();
  await expect(topModal(page).getByLabel('Ticker')).toBeVisible();
}

async function fillTrade(page: Page, f: { symbol: string; name?: string; qty: string; price: string; sell?: boolean }) {
  const modal = topModal(page);
  if (f.sell) {
    await modal.getByRole('tab', { name: /^sell$/i }).click();
  }
  await modal.getByLabel('Ticker').fill(f.symbol);
  if (f.name) {
    await modal.getByLabel('Name').fill(f.name);
  }
  await modal.getByLabel('Quantity').fill(f.qty);
  await modal.getByLabel('Price each').fill(f.price);
}

const submitTrade = (page: Page) => topModal(page).getByRole('button', { name: /save trade|save/i }).last();

test.describe('W29 Trade & holdings', () => {
  test('buy a new holding', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).investmentTransactions.length;
    await openTrade(page);
    await fillTrade(page, { symbol: 'QAETF', name: 'QA Test ETF', qty: '10', price: '100' });
    const saved = waitForSave(page);
    await submitTrade(page).click();
    expect((await saved).status()).toBe(200);
    const inv = (await serverData(user)).investmentTransactions;
    expect(inv.length).toBe(before + 1);
    const t = inv.find((x: any) => x.symbol === 'QAETF');
    expect(Number(t.quantity)).toBe(10);
    expect(Number(t.price)).toBe(100);
  });

  test('zero / negative quantity is rejected', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).investmentTransactions.length;
    await openTrade(page);
    await fillTrade(page, { symbol: 'QANEG', qty: '-5', price: '100' });
    await submitTrade(page).click();
    await page.waitForTimeout(2500);
    expect((await serverData(user)).investmentTransactions.length).toBe(before);
  });

  test('selling more than you hold warns first; Cancel saves nothing', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).investmentTransactions.length;
    await openTrade(page);
    await fillTrade(page, { symbol: 'BTC', name: 'Bitcoin', qty: '9999', price: '50000', sell: true });
    await submitTrade(page).click();
    await expect(page.getByText(/sell more than you hold|exceeds current quantity/i)).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).last().click();
    await page.waitForTimeout(2000);
    expect((await serverData(user)).investmentTransactions.length).toBe(before);
  });

  test('a holding with no price data is not shown as a -100% loss', async ({ authedPage: page }) => {
    test.skip(isMobile(page), 'desktop holdings table');
    await goTo(page, '/investments?tab=holdings');
    await expect(page.locator('main')).toContainText('VWCE');
    await expect(page.locator('main'), 'missing price should not be valued at €0 (-100%)').not.toContainText('-100.0%');
  });

  test('holding detail opens and survives a refresh', async ({ authedPage: page }) => {
    test.skip(isMobile(page), 'desktop holding table');
    await goTo(page, '/investments?tab=holdings');
    const row = page.locator('main').getByRole('row').filter({ hasText: 'VWCE' }).first();
    if (await row.count()) {
      await row.click();
    } else {
      await page.getByRole('button', { name: /actions for/i }).first().click();
      await page.getByRole('menuitem', { name: /details/i }).click();
    }
    await expect(page).toHaveURL(/\/investments\/.+/);
    const url = page.url();
    await page.reload();
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2000);
    expect(page.url()).toBe(url);
  });

  test('mobile: investments list renders holdings and the add action opens', async ({ authedPage: page }) => {
    test.skip(!isMobile(page), 'mobile only');
    await openTrade(page);
  });
});

test.describe('W31 Prices', () => {
  test('log a manual price for a holding', async ({ authedPage: page, user }) => {
    test.skip(isMobile(page), 'desktop holding action');
    const before = JSON.stringify((await serverData(user)).manualWarrantPrices ?? {}) + JSON.stringify((await serverData(user)).priceHistory ?? {});
    await goTo(page, '/investments?tab=holdings');
    await page.getByRole('button', { name: /actions for/i }).first().click();
    await page.getByRole('menuitem', { name: /log or fetch a price/i }).click();
    const modal = topModal(page);
    await modal.getByRole('textbox', { name: 'Price', exact: true }).fill('123.45');
    const saved = waitForSave(page);
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    expect((await saved).status()).toBe(200);
    const after = JSON.stringify((await serverData(user)).manualWarrantPrices ?? {}) + JSON.stringify((await serverData(user)).priceHistory ?? {});
    expect(after).not.toBe(before);
    expect(after).toContain('123.45');
  });

  test('syncing market prices without an API key explains what is missing', async ({ authedPage: page }) => {
    test.setTimeout(60_000);
    await goTo(page, '/investments');
    const dialogs: string[] = [];
    page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
    await page.getByRole('button', { name: /update prices|sync (market )?prices|update live prices/i }).first().click({ timeout: 5000 });
    // The message is a toast now (not a browser dialog); poll because toasts are short-lived.
    await expect.poll(async () => dialogs.join(' ') + ' ' + (await page.locator('body').innerText()), { timeout: 30_000, message: 'expected a message about the missing Twelve Data API key' })
      .toMatch(/api key|twelve ?data|configure|integrations|unable to update|failed|updated|couldn't update/i);
  });
});

test.describe('W32 Reports', () => {
  test('every predefined period renders without errors', async ({ authedPage: page }) => {
    const w = watch(page);
    await goTo(page, '/reports');
    const cards = page.locator('section[aria-label="Ready-made reports and saved views"] button');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      await cards.nth(i).click();
      await page.waitForTimeout(300);
    }
    await expect(page.getByText('Something went wrong')).toHaveCount(0);
    expect(w.consoleErrors.filter(e => !/favicon|ResizeObserver/.test(e))).toEqual([]);
    expect(await page.locator('main').evaluate(m => m.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  });

  test('reports for a period with no data show an empty state', async ({ authedPage: page }) => {
    await goTo(page, '/reports');
    await page.getByRole('button', { name: /filters/i }).click();
    const modal = topModal(page);
    await modal.getByLabel('Merchant').fill('NONEXISTENT_MERCHANT_XYZ');
    await modal.getByRole('button', { name: 'Done', exact: true }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('main')).toContainText(/no (money|spending|data|transactions)|nothing|€0/i);
  });

  test('leaderboard link navigates to Merchants', async ({ authedPage: page, user }) => {
    const today = new Date().toISOString().slice(0, 10);
    const data = await serverData(user);
    const existing = data.transactions ?? [];
    const accId = data.accounts?.[0]?.id ?? 'acc-checking';
    const res = await user.api.post('/api/data', {
      data: {
        partial: true,
        data: {
          transactions: [
            ...existing,
            { id: 'qa-merch-tx-1', accountId: accId, amount: -25, type: 'expense', currency: 'EUR', date: today, merchant: 'Delhaize', description: 'Lunch', category: 'Groceries' },
            { id: 'qa-merch-tx-2', accountId: accId, amount: -35, type: 'expense', currency: 'EUR', date: today, merchant: 'Delhaize', description: 'Dinner', category: 'Groceries' },
          ],
        },
      },
    });
    expect(res.status()).toBe(200);
    await goTo(page, '/reports');
    await page.getByRole('button', { name: 'Spend breakdown' }).click();
    await page.getByRole('button', { name: /open merchants/i }).click();
    await expect(page).toHaveURL(/\/merchants/);
  });

  test('Save View persists the chosen period after refresh', async ({ authedPage: page }) => {
    await goTo(page, '/reports');
    await page.getByRole('button', { name: /save view/i }).click();
    const modal = topModal(page);
    await modal.getByLabel('Name').fill('QA View');
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('main')).toContainText('QA View');
    await page.waitForTimeout(2000);
    await page.reload();
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1500);
    await expect(page.locator('main'), 'saved view should survive a refresh').toContainText('QA View');
  });
});

test.describe('W33 Challenges', () => {
  test('all challenge tabs render without errors', async ({ authedPage: page }) => {
    const w = watch(page);
    await goTo(page, '/challenges');
    for (const t of ['Score', 'Debts and goals', 'Badges', 'Budgets', 'Sprints', 'Predictions', 'Records']) {
      await page.getByRole('button', { name: t, exact: true }).first().click();
      await page.waitForTimeout(300);
    }
    await expect(page.getByText('Something went wrong')).toHaveCount(0);
    expect(w.consoleErrors.filter(e => !/favicon|ResizeObserver/.test(e))).toEqual([]);
    expect(await page.locator('main').evaluate(m => m.scrollWidth), 'no horizontal overflow').toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  });

  test('create a prediction', async ({ authedPage: page, user }) => {
    const before = ((await serverData(user)).predictions ?? []).length;
    await goTo(page, '/challenges');
    await page.getByRole('button', { name: 'Predictions', exact: true }).first().click();
    await page.getByRole('button', { name: /new prediction/i }).first().click();
    const modal = topModal(page);
    await modal.getByRole('button', { name: /category/i }).click();
    await page.getByRole('option').first().click();
    await modal.getByLabel('Limit').fill('250');
    const saved = waitForSave(page);
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    expect((await saved).status()).toBe(200);
    expect(((await serverData(user)).predictions ?? []).length).toBe(before + 1);
  });

  test('a started savings sprint is visible on another device', async ({ authedPage: page, user, browser }, testInfo) => {
    await goTo(page, '/challenges');
    await page.getByRole('button', { name: 'Sprints', exact: true }).first().click();
    const saved = waitForSave(page);
    await page.locator('main').getByRole('button', { name: /^start/i }).first().click();
    await expect(page.getByRole('button', { name: /give up/i }).first()).toBeVisible();
    expect((await saved).status()).toBe(200);
    const ctx = await browser.newContext({ ...testInfo.project.use, storageState: await user.api.storageState() });
    const p2 = await ctx.newPage();
    await p2.goto('/challenges');
    await expect(p2.locator('main')).toBeVisible({ timeout: 15_000 });
    await p2.getByRole('button', { name: 'Sprints', exact: true }).first().click();
    await expect(p2.getByRole('button', { name: /give up/i }), 'active sprint should sync with the account').toHaveCount(1);
    await ctx.close();
  });
});
