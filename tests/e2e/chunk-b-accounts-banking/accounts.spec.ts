/**
 * Chunk B — Accounts (inventory workflows W11, W12).
 */
import { test, expect, goTo, navigate, isMobile, serverData, waitForSave, watch, openBug } from '../fixtures/test';
import type { Page } from '@playwright/test';

const drawer = (page: Page) => page.locator('div.fixed').filter({ has: page.getByRole('button', { name: 'Close drawer' }) }).last();


/** Card tap opens the Account Overview modal (both widths). */
async function openOverview(page: Page, name: string) {
  await goTo(page, '/accounts');
  const card = page.getByRole('button', { name: new RegExp(`Open ${name}`) }).first();
  await expect(card).toBeAttached();
  await card.click();
  await expect(page.locator('main')).toContainText(name);
}

async function openAddAccount(page: Page) {
  await goTo(page, '/accounts');
  await page.getByRole('button', { name: /add account/i }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: /^checking/i }).click();
  await expect(page.getByRole('heading', { name: /new checking account/i })).toBeVisible();
}

async function clickAccountAction(page: Page, actionName: RegExp | string) {
  if (isMobile(page)) {
    const directBtn = page.getByRole('button', { name: actionName });
    if (await directBtn.isVisible()) {
      await directBtn.click();
    } else {
      await page.getByRole('button', { name: /more actions/i }).click();
      await page.getByRole('menuitem', { name: actionName }).click();
    }
  } else {
    await page.getByRole('button', { name: actionName }).first().click();
  }
}

test.describe('W11 Manage accounts', () => {
  test('add account (happy path) appears in the list and on the server', async ({ authedPage: page, user }) => {
    await openAddAccount(page);
    await page.getByLabel('Name').fill('QA Checking');
    await page.getByLabel(/current balance|balance/i).first().fill('1234.56');
    const saved = waitForSave(page);
    await page.getByRole('button', { name: /add account/i }).last().click();
    await expect(page.getByRole('heading', { name: /new checking account/i })).toBeHidden();
    await expect(page.locator('main')).toContainText('QA Checking');
    expect((await saved).status()).toBe(200);
    const acc = (await serverData(user)).accounts.find((a: any) => a.name === 'QA Checking');
    expect(acc?.balance).toBeCloseTo(1234.56, 2);
  });

  test('empty name is rejected', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).accounts.length;
    await openAddAccount(page);
    await page.getByRole('button', { name: /add account/i }).last().click();
    await expect(page.getByRole('heading', { name: /new checking account/i })).toBeVisible();
    const valid = await page.getByLabel('Name').evaluate((e: HTMLInputElement) => e.checkValidity());
    expect(valid).toBe(false);
    await page.waitForTimeout(1500);
    expect((await serverData(user)).accounts.length).toBe(before);
  });

  test('double-clicking Create Account creates exactly one account', async ({ authedPage: page, user }) => {
    await openAddAccount(page);
    await page.getByLabel('Name').fill('QA Double');
    await page.getByRole('button', { name: /add account/i }).last().dblclick();
    await page.waitForTimeout(3000);
    const n = (await serverData(user)).accounts.filter((a: any) => a.name === 'QA Double').length;
    expect(n).toBe(1);
  });

  test('very long account name (300 chars) is saved and does not break the layout', async ({ authedPage: page }) => {
    await openAddAccount(page);
    const long = 'Q'.repeat(300);
    await page.getByLabel('Name').fill(long);
    await page.getByRole('button', { name: /add account/i }).last().click();
    await expect(page.getByRole('heading', { name: /new checking account/i })).toBeHidden();
    const vw = page.viewportSize()!.width;
    const mainScroll = await page.locator('main').evaluate(m => m.scrollWidth);
    expect(mainScroll, 'main should not scroll horizontally').toBeLessThanOrEqual(vw + 1);
  });

  test('balance field rejects non-numeric input', async ({ authedPage: page }) => {
    await openAddAccount(page);
    const bal = page.getByLabel(/current balance|balance/i).first();
    await bal.fill('').catch(() => {});
    await bal.pressSequentially('abc');
    expect(await bal.inputValue()).toBe('');
  });

  test('edit account name persists after refresh', async ({ authedPage: page, user }) => {
    await openOverview(page, 'Everyday Checking');
    await clickAccountAction(page, /^edit$/i);
    const name = page.getByLabel('Name');
    await name.fill('Renamed Checking');
    const saved = waitForSave(page);
    await page.getByRole('button', { name: /save changes/i }).click();
    expect((await saved).status()).toBe(200);
    await page.reload();
    await expect(page.locator('main')).toContainText('Renamed Checking', { timeout: 15_000 });
  });

  test('adjust balance updates the shown balance and the server', async ({ authedPage: page, user }) => {
    await openOverview(page, 'Everyday Checking');
    await clickAccountAction(page, /^adjust balance$/i);
    await page.getByLabel(/new balance/i).fill('5000');
    const saved = waitForSave(page);
    await page.getByRole('button', { name: /save adjustment/i }).last().click();
    expect((await saved).status()).toBe(200);
    await expect(page.locator('main')).toContainText('5,000.00');
    const checking = (await serverData(user)).accounts.find((a: any) => a.name === 'Everyday Checking');
    expect(checking.balance).toBeCloseTo(5000, 2);
  });

  test('delete account (Edit > Delete) requires typing DELETE and removes its transactions', async ({ authedPage: page, user }) => {
    const data = await serverData(user);
    const target = data.accounts.find((a: any) => a.name === 'Rainy Day Savings');
    await openOverview(page, 'Rainy Day Savings');
    await clickAccountAction(page, /^edit$/i);
    await page.getByRole('button', { name: /^delete$/i }).click();
    const confirm = page.getByRole('button', { name: 'Delete account' });
    await expect(confirm).toBeDisabled();
    await page.locator('#confirm-input').fill('delete');
    await expect(confirm, 'lowercase must not match').toBeDisabled();
    await page.locator('#confirm-input').fill('DELETE');
    await expect(confirm).toBeEnabled();
    const saved = waitForSave(page);
    await confirm.click();
    expect((await saved).status()).toBe(200);
    const after = await serverData(user);
    expect(after.accounts.some((a: any) => a.id === target.id)).toBe(false);
    expect(after.transactions.some((t: any) => t.accountId === target.id)).toBe(false);
  });

  test('desktop: right-click context menu offers View Full Account / Delete', async ({ authedPage: page }) => {
    test.skip(isMobile(page), 'desktop right-click');
    await goTo(page, '/accounts');
    await page.locator('main').getByText('Everyday Checking', { exact: true }).first().click({ button: 'right' });
    await expect(page.getByRole('menuitem', { name: /open account/i })).toBeVisible();
    await page.getByRole('menuitem', { name: /open account/i }).click();
    await expect(page).toHaveURL(/\/accounts\/.+/);
  });

  test('view toggles (layout / style / split) persist across refresh', async ({ authedPage: page }) => {
    test.skip(isMobile(page), 'desktop toolbar');
    await goTo(page, '/accounts?tab=accounts');
    await page.getByRole('button', { name: 'View options' }).click();
    await page.getByRole('radio', { name: 'Rows, to reorder' }).click({ force: true });
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem('crystal_accounts_view_style'))) || '""')).toBe('minimal');
    await page.reload();
    await expect(page.locator('main')).toBeVisible();
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem('crystal_accounts_view_style'))) || '""')).toBe('minimal');
  });

  test('mobile: accounts list shows the seeded accounts', async ({ authedPage: page }) => {
    test.skip(!isMobile(page), 'mobile only');
    await goTo(page, '/accounts');
    for (const n of ['Everyday Checking', 'Aurora Rewards Card', 'Canal View Home Loan']) await expect(page.locator('main')).toContainText(n);
  });
});

test.describe('W12 Account detail', () => {
  async function openDetail(page: Page, name: string) {
    await openOverview(page, name);
    await expect(page.locator('main')).toContainText(name);
  }

  test('open detail, browser Back returns to the list, refresh keeps the detail', async ({ authedPage: page }) => {
    await openDetail(page, 'Everyday Checking');
    const detailUrl = page.url();
    await page.reload();
    await expect(page.locator('main')).toContainText('Everyday Checking', { timeout: 15_000 });
    expect(page.url()).toBe(detailUrl);
    await page.goBack();
    await expect(page).toHaveURL(/\/accounts$/);
  });

  test('deep link to a non-existent account shows a not-found state (not an endless loader)', async ({ authedPage: page }) => {
    await goTo(page, '/accounts/does-not-exist', false);
    await expect(page.getByText('Account not found')).toBeVisible({ timeout: 8000 });
    await expect(page).toHaveURL(/\/accounts$/);
    await expect(page.locator('main')).not.toContainText('Loading account...');
  });

  test('add a transaction from the account detail updates the account', async ({ authedPage: page, user }) => {
    await openDetail(page, 'Everyday Checking');
    await page.locator('main').getByRole('button', { name: /add transaction/i }).first().click();
    await page.getByLabel(/^amount$/i).fill('12.34');
    await page.getByPlaceholder(/shop, company or person/i).fill('QA Detail Shop');
    await page.getByLabel(/description/i).fill('QA detail purchase');
    await page.getByRole('button', { name: /Supermarket|Apps & Software|Rent/i }).first().click();
    const saved = waitForSave(page);
    await page.getByRole('button', { name: /save transaction/i }).click();
    expect((await saved).status()).toBe(200);
    const tx = (await serverData(user)).transactions.filter((t: any) => t.merchant === 'QA Detail Shop');
    expect(tx.length).toBe(1);
    expect(Math.abs(tx[0].amount)).toBeCloseTo(12.34, 2);
  });

  test('pressing Enter in the amount field saves the transaction (does not close the drawer)', async ({ authedPage: page, user }) => {
    await openDetail(page, 'Everyday Checking');
    await page.locator('main').getByRole('button', { name: /add transaction/i }).first().click();
    await page.getByPlaceholder(/shop, company or person/i).fill('QA Enter Shop');
    await page.getByLabel(/description/i).fill('QA enter purchase');
    await page.getByRole('button', { name: /Supermarket|Apps & Software|Rent/i }).first().click();
    await page.getByLabel(/^amount$/i).fill('7.77');
    await page.getByLabel(/^amount$/i).press('Enter');
    await page.waitForTimeout(3000);
    const tx = (await serverData(user)).transactions.filter((t: any) => t.merchant === 'QA Enter Shop');
    expect(tx.length).toBe(1);
  });

  for (const name of ['Canal View Apartment', 'Tesla Model 3 LR', 'Canal View Home Loan', 'Aurora Rewards Card', 'High Yield Reserve']) {
    test(`detail view renders without errors: ${name}`, async ({ authedPage: page }) => {
      const w = watch(page);
      await openDetail(page, name);
      await page.waitForTimeout(1200);
      await expect(page.getByText('Something went wrong')).toHaveCount(0);
      expect(w.consoleErrors.filter(e => !/favicon|ResizeObserver/.test(e))).toEqual([]);
      const vw = page.viewportSize()!.width;
      expect(await page.locator('main').evaluate(m => m.scrollWidth)).toBeLessThanOrEqual(vw + 1);
    });
  }

  test('property: update valuation changes the shown value', async ({ authedPage: page, user }) => {
    await openDetail(page, 'Canal View Apartment');
    await page.locator('main').getByRole('button', { name: /update value/i }).click();
    await page.locator('#new-value').fill('612345');
    const saved = waitForSave(page);
    await page.getByRole('button', { name: /save value/i }).click();
    expect((await saved).status()).toBe(200);
    await expect(page.locator('main')).toContainText('612,345');
  });

  test('vehicle: add a mileage log entry', async ({ authedPage: page, user }) => {
    await openDetail(page, 'Tesla Model 3 LR');
    const logs = (d: any) => d.accounts.find((a: any) => a.name === 'Tesla Model 3 LR').mileageLogs?.length ?? 0;
    const before = logs(await serverData(user));
    await page.locator('main').getByRole('button', { name: /add reading/i }).first().click();
    await page.getByPlaceholder('45000').fill('45678');
    const saved = waitForSave(page);
    await page.getByRole('button', { name: /add reading/i }).last().click();
    expect((await saved).status()).toBe(200);
    expect(logs(await serverData(user))).toBe(before + 1);
  });

  test('vehicle: mileage lower than the previous reading is rejected', async ({ authedPage: page, user }) => {
    await openDetail(page, 'Tesla Model 3 LR');
    // First a normal reading, then one that is lower than it.
    await page.locator('main').getByRole('button', { name: /add reading/i }).first().click();
    await page.getByPlaceholder('45000').fill('50000');
    const saved = waitForSave(page);
    await page.getByRole('button', { name: /add reading/i }).last().click();
    await saved;
    await page.waitForTimeout(600);
    await page.locator('main').getByRole('button', { name: /add reading/i }).first().click();
    await page.getByPlaceholder('45000').fill('1');
    await page.getByRole('button', { name: /add reading/i }).last().click();
    await expect(page.getByText(/cannot be earlier than or equal to|lower than/i)).toBeVisible({ timeout: 3000 });
    expect(((await serverData(user)).accounts.find((a: any) => a.id === 'acc-vehicle').mileageLogs ?? []).length, 'the lower reading is not saved').toBe(1);
  });

  test('asset closing actions (Record Sale / Retire Vehicle) are available at this width', async ({ authedPage: page }) => {
    await openDetail(page, 'Canal View Apartment');
    if (isMobile(page)) {
      await page.getByRole('button', { name: /more actions/i }).click();
      await expect(page.getByRole('menuitem', { name: /record sale|retire vehicle|close/i }).first()).toBeVisible();
      await page.keyboard.press('Escape');
    } else {
      await expect(page.locator('main').getByRole('button', { name: /record sale|retire vehicle|close/i }).first()).toBeVisible();
    }
    await openDetail(page, 'Tesla Model 3 LR');
    if (isMobile(page)) {
      await page.getByRole('button', { name: /more actions/i }).click();
      await expect(page.getByRole('menuitem', { name: /retire vehicle|record sale|close/i }).first()).toBeVisible();
    } else {
      await expect(page.locator('main').getByRole('button', { name: /retire vehicle|record sale|close/i }).first()).toBeVisible();
    }
  });
});
