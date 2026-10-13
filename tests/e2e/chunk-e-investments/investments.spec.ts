/**
 * Chunk E — Investments & insights (inventory workflows W29–W33).
 */
import { test, expect, goTo, navigate, isMobile, serverData, waitForSave, watch, openBug } from '../fixtures/test';
import type { Page } from '@playwright/test';

async function openTrade(page: Page) {
  await goTo(page, '/investments');
  await page.getByRole('button', { name: isMobile(page) ? 'Add Investment Action' : 'Trade' }).first().click();
  await expect(page.getByPlaceholder('AAPL, BTC, VWCE')).toBeVisible();
}

async function fillTrade(page: Page, f: { symbol: string; name?: string; qty: string; price: string; sell?: boolean }) {
  if (f.sell) await page.getByRole('button', { name: /^sell$/i }).first().click().catch(() => {});
  await page.getByPlaceholder('AAPL, BTC, VWCE').fill(f.symbol);
  await page.getByPlaceholder(/e\.g\. Apple Inc/).fill(f.name ?? f.symbol);
  const nums = page.locator('input[type="number"]:visible');
  await nums.nth(0).fill(f.qty);
  await nums.nth(1).fill(f.price);
}

const submitTrade = (page: Page) => page.locator('button[type="submit"]:visible').last();

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
    await expect(page.getByText(/exceeds current quantity/i)).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).last().click();
    await page.waitForTimeout(2000);
    expect((await serverData(user)).investmentTransactions.length).toBe(before);
  });

  test('a holding with no price data is not shown as a -100% loss', async ({ authedPage: page }) => {
    openBug('AUD-15');
    test.skip(isMobile(page), 'desktop holdings table');
    await goTo(page, '/investments');
    const row = page.locator('main').getByRole('row').filter({ hasText: 'VWCE' }).first().or(page.locator('main div').filter({ hasText: /^VWCE/ }).first());
    await expect(page.locator('main')).toContainText('VWCE');
    await expect(page.locator('main'), 'missing price should not be valued at €0 (-100%)').not.toContainText('-100.0%');
  });

  test('holding detail opens and survives a refresh', async ({ authedPage: page }) => {
    openBug('AUD-46');
    test.skip(isMobile(page), 'desktop holding table');
    await goTo(page, '/investments');
    await page.getByRole('button', { name: 'Holding Details' }).first().click();
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
    await goTo(page, '/investments');
    await page.getByRole('button', { name: 'Log / Fetch Price' }).first().click();
    const modal = page.locator('div.fixed').filter({ has: page.locator('input[type="number"]') }).last();
    await modal.locator('input[type="number"]').first().fill('123.45');
    const saved = waitForSave(page);
    await modal.locator('button[type="submit"], button').filter({ hasText: /save|log|update|apply|confirm/i }).last().click();
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
    await page.getByRole('button', { name: /sync (market )?prices|update live prices/i }).first().click({ timeout: 5000 });
    await page.waitForTimeout(8000);
    const text = dialogs.join(' ') + ' ' + (await page.locator('body').innerText());
    expect(text, 'expected a message about the missing Twelve Data API key').toMatch(/api key|twelve ?data|configure|integrations|unable to update|failed/i);
  });
});

test.describe('W32 Reports', () => {
  test('every predefined period renders without errors', async ({ authedPage: page }) => {
    const w = watch(page);
    await goTo(page, '/reports');
    for (const p of ['Last 7 Days', 'Last 30 Days', 'This Month', 'Last Month', 'This Year', 'Last Year']) {
      await page.getByRole('button', { name: p, exact: true }).first().click();
      await page.waitForTimeout(300);
    }
    await expect(page.getByText('Something went wrong')).toHaveCount(0);
    expect(w.consoleErrors.filter(e => !/favicon|ResizeObserver/.test(e))).toEqual([]);
    expect(await page.locator('main').evaluate(m => m.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  });

  test('reports for a period with no data show an empty state', async ({ authedPage: page }) => {
    await goTo(page, '/reports');
    await page.getByRole('button', { name: 'Last 7 Days', exact: true }).first().click();
    await page.waitForTimeout(500);
    await expect(page.locator('main')).toContainText(/no (data|transactions|activity)|nothing|€0/i);
  });

  test('leaderboard link navigates to Merchants', async ({ authedPage: page }) => {
    await goTo(page, '/reports');
    await page.getByRole('button', { name: /view detailed profile leaderboard/i }).click();
    await expect(page).toHaveURL(/\/merchants/);
  });

  test('Save View persists the chosen period after refresh', async ({ authedPage: page }) => {
    await goTo(page, '/reports');
    await page.getByRole('button', { name: 'Last Year', exact: true }).first().click();
    await expect(page.getByRole('button', { name: /save view/i })).toBeDisabled();
    await page.getByPlaceholder(/name this report view/i).fill('QA View');
    await page.getByRole('button', { name: /save view/i }).click();
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
    openBug('AUD-45', isMobile(page));
    const w = watch(page);
    await goTo(page, '/challenges');
    for (const t of ['Score', 'Battles', 'Badges', 'Mastery', 'Sprints', 'Predictions', 'Records']) {
      await page.getByRole('button', { name: t, exact: true }).first().click();
      await page.waitForTimeout(300);
    }
    await expect(page.getByText('Something went wrong')).toHaveCount(0);
    expect(w.consoleErrors.filter(e => !/favicon|ResizeObserver/.test(e))).toEqual([]);
    expect(await page.locator('main').evaluate(m => m.scrollWidth), 'no horizontal overflow').toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  });

  test('create a prediction', async ({ authedPage: page, user }) => {
    openBug('AUD-23', isMobile(page));
    const before = ((await serverData(user)).predictions ?? []).length;
    await goTo(page, '/challenges');
    await page.getByRole('button', { name: 'Predictions', exact: true }).first().click();
    await page.getByRole('button', { name: /create prediction/i }).first().click();
    const modal = page.locator('div.fixed').filter({ has: page.locator('input,select') }).last();
    for (const sel of await modal.locator('select').all()) { const n = await sel.locator('option').count(); if (n > 1 && !(await sel.inputValue())) await sel.selectOption({ index: 1 }); }
    const num = modal.locator('input[type="number"]').first();
    if (await num.count()) await num.fill('250');
    const saved = waitForSave(page);
    await modal.locator('button[type="submit"]').last().click();
    expect((await saved).status()).toBe(200);
    expect(((await serverData(user)).predictions ?? []).length).toBe(before + 1);
  });

  test('a started savings sprint is visible on another device', async ({ authedPage: page, user, browser }, testInfo) => {
    openBug('AUD-71');
    await goTo(page, '/challenges');
    await page.getByRole('button', { name: 'Sprints', exact: true }).first().click();
    await page.locator('main').getByText('Start', { exact: true }).first().click();
    await expect(page.getByRole('button', { name: /abandon/i }).first()).toBeVisible();
    const ctx = await browser.newContext({ ...testInfo.project.use, storageState: await user.api.storageState() });
    const p2 = await ctx.newPage();
    await p2.goto('/challenges');
    await expect(p2.locator('main')).toBeVisible({ timeout: 15_000 });
    await p2.getByRole('button', { name: 'Sprints', exact: true }).first().click();
    await expect(p2.getByRole('button', { name: /abandon/i }), 'active sprint should sync with the account').toHaveCount(1);
    await ctx.close();
  });
});
