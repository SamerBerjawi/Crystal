/**
 * Chunk B — Accounts (inventory workflows W11, W12).
 */
import { test, expect, goTo, navigate, isMobile, serverData, waitForSave, watch, openBug } from '../fixtures/test';
import type { Page } from '@playwright/test';

const drawer = (page: Page) => page.locator('div.fixed').filter({ has: page.getByRole('button', { name: 'Close drawer' }) }).last();


/** Card tap opens the Account Overview modal (both widths). */
async function openOverview(page: Page, name: string) {
  await goTo(page, '/accounts');
  await page.locator('main').getByText(name, { exact: true }).first().click();
  await expect(page.getByRole('button', { name: /full view|open full account view/i }).first()).toBeVisible();
}

async function openAddAccount(page: Page) {
  await goTo(page, '/accounts');
  await page.getByRole('button', { name: 'Add Account', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'New Account' })).toBeVisible();
}

test.describe('W11 Manage accounts', () => {
  test('add account (happy path) appears in the list and on the server', async ({ authedPage: page, user }) => {
    await openAddAccount(page);
    await page.getByRole('textbox', { name: 'Account Identifier' }).fill('QA Checking');
    await page.getByRole('spinbutton').first().fill('1234.56');
    const saved = waitForSave(page);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByRole('heading', { name: 'New Account' })).toBeHidden();
    await expect(page.locator('main')).toContainText('QA Checking');
    expect((await saved).status()).toBe(200);
    const acc = (await serverData(user)).accounts.find((a: any) => a.name === 'QA Checking');
    expect(acc?.balance).toBeCloseTo(1234.56, 2);
  });

  test('empty name is rejected', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).accounts.length;
    await openAddAccount(page);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByRole('heading', { name: 'New Account' })).toBeVisible();
    const valid = await page.getByRole('textbox', { name: 'Account Identifier' }).evaluate((e: HTMLInputElement) => e.checkValidity());
    expect(valid).toBe(false);
    await page.waitForTimeout(1500);
    expect((await serverData(user)).accounts.length).toBe(before);
  });

  test('double-clicking Create Account creates exactly one account', async ({ authedPage: page, user }) => {
    await openAddAccount(page);
    await page.getByRole('textbox', { name: 'Account Identifier' }).fill('QA Double');
    await page.getByRole('button', { name: 'Create Account' }).dblclick();
    await page.waitForTimeout(3000);
    const n = (await serverData(user)).accounts.filter((a: any) => a.name === 'QA Double').length;
    expect(n).toBe(1);
  });

  test('very long account name (300 chars) is saved and does not break the layout', async ({ authedPage: page }) => {
    await openAddAccount(page);
    const long = 'Q'.repeat(300);
    await page.getByRole('textbox', { name: 'Account Identifier' }).fill(long);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByRole('heading', { name: 'New Account' })).toBeHidden();
    const vw = page.viewportSize()!.width;
    const mainScroll = await page.locator('main').evaluate(m => m.scrollWidth);
    expect(mainScroll, 'main should not scroll horizontally').toBeLessThanOrEqual(vw + 1);
  });

  test('balance field rejects non-numeric input', async ({ authedPage: page }) => {
    await openAddAccount(page);
    const bal = page.getByRole('spinbutton').first();
    await bal.fill('').catch(() => {});
    await bal.pressSequentially('abc');
    expect(await bal.inputValue()).toBe('');
  });

  test('edit account name persists after refresh', async ({ authedPage: page, user }) => {
    await openOverview(page, 'Everyday Checking');
    await page.getByRole('button', { name: /^edit (account|details)$/i }).last().click();
    const name = page.getByRole('textbox', { name: 'Account Identifier' });
    await name.fill('Renamed Checking');
    const saved = waitForSave(page);
    await page.getByRole('button', { name: /save changes/i }).click();
    expect((await saved).status()).toBe(200);
    await page.reload();
    await expect(page.locator('main')).toContainText('Renamed Checking', { timeout: 15_000 });
  });

  test('adjust balance updates the shown balance and the server', async ({ authedPage: page, user }) => {
    await openOverview(page, 'Everyday Checking');
    await page.getByRole('button', { name: /^adjust balance$/i }).last().click();
    await page.getByRole('spinbutton', { name: /stated target balance/i }).fill('5000');
    const saved = waitForSave(page);
    await page.getByRole('button', { name: /save adjustment/i }).click();
    expect((await saved).status()).toBe(200);
    await expect(page.locator('main')).toContainText('5,000.00');
    const checking = (await serverData(user)).accounts.find((a: any) => a.name === 'Everyday Checking');
    expect(checking.balance).toBeCloseTo(5000, 2);
  });

  test('delete account (Edit > Delete) requires typing DELETE and removes its transactions', async ({ authedPage: page, user }) => {
    const data = await serverData(user);
    const target = data.accounts.find((a: any) => a.name === 'Rainy Day Savings');
    await openOverview(page, 'Rainy Day Savings');
    await page.getByRole('button', { name: /^edit (account|details)$/i }).last().click();
    await page.getByRole('button', { name: /^delete$/i }).click();
    const confirm = page.getByRole('button', { name: 'Delete Account' });
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
    await expect(page.getByRole('button', { name: /view full account/i })).toBeVisible();
    await page.getByRole('button', { name: /view full account/i }).click();
    await expect(page).toHaveURL(/\/accounts\/.+/);
  });

  test('view toggles (layout / style / split) persist across refresh', async ({ authedPage: page }) => {
    test.skip(isMobile(page), 'desktop toolbar');
    await goTo(page, '/accounts');
    await page.getByRole('button', { name: 'Minimalist Rows' }).click();
    await page.getByRole('button', { name: 'List Layout' }).click();
    await page.getByRole('button', { name: 'Combined' }).click();
    const read = () => page.evaluate(() => [localStorage.getItem('crystal_accounts_view_style'), localStorage.getItem('crystal_accounts_section_layout'), localStorage.getItem('crystal_split_assets_liabilities')]);
    const before = await read();
    await page.reload();
    await expect(page.locator('main')).toBeVisible();
    expect(await read()).toEqual(before);
    expect(before.join()).toMatch(/minimal/);
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
    await page.getByRole('button', { name: /full view|open full account view/i }).first().click();
    await expect(page).toHaveURL(/\/accounts\/.+/);
    await expect(page.locator('main')).toContainText(name);
  }

  test('open detail, browser Back returns to the list, refresh keeps the detail', async ({ authedPage: page }) => {
    openBug('AUD-46');
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
    await page.waitForTimeout(4000);
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/loading account/i);
  });

  test('add a transaction from the account detail updates the account', async ({ authedPage: page, user }) => {
    await openDetail(page, 'Everyday Checking');
    await page.locator('main').getByRole('button', { name: /^(transaction|log tx)$/i }).first().click();
    await page.getByPlaceholder('0.00').fill('12.34');
    await page.getByPlaceholder('Store, entity, or person...').fill('QA Detail Shop');
    await page.locator('#tx-category').selectOption({ index: 1 });
    await page.getByPlaceholder('What was this transaction for?').fill('QA detail purchase');
    const saved = waitForSave(page);
    await page.getByRole('button', { name: /confirm transaction/i }).click();
    expect((await saved).status()).toBe(200);
    const tx = (await serverData(user)).transactions.filter((t: any) => t.merchant === 'QA Detail Shop');
    expect(tx.length).toBe(1);
    expect(Math.abs(tx[0].amount)).toBeCloseTo(12.34, 2);
  });

  test('pressing Enter in the amount field saves the transaction (does not close the drawer)', async ({ authedPage: page, user }) => {
    openBug('AUD-74');
    await openDetail(page, 'Everyday Checking');
    await page.locator('main').getByRole('button', { name: /^(transaction|log tx)$/i }).first().click();
    await page.getByPlaceholder('Store, entity, or person...').fill('QA Enter Shop');
    await page.locator('#tx-category').selectOption({ index: 1 });
    await page.getByPlaceholder('What was this transaction for?').fill('QA enter purchase');
    await page.getByPlaceholder('0.00').fill('7.77');
    await page.getByPlaceholder('0.00').press('Enter');
    await page.waitForTimeout(3000);
    const drawerOpen = await page.getByText('New Transaction', { exact: true }).isVisible();
    const tx = (await serverData(user)).transactions.filter((t: any) => t.merchant === 'QA Enter Shop');
    expect(tx.length, `Enter should submit the form (after Enter: drawer ${drawerOpen ? 'still open, nothing saved' : 'closed'})`).toBe(1);
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
    await page.locator('main').getByRole('button', { name: /^(value update|valuation)$/i }).click();
    await page.locator('#new-value').fill('612345');
    const saved = waitForSave(page);
    await page.getByRole('button', { name: /save valuation/i }).click();
    expect((await saved).status()).toBe(200);
    await expect(page.locator('main')).toContainText('612,345');
  });

  test('vehicle: add a mileage log entry', async ({ authedPage: page, user }) => {
    await openDetail(page, 'Tesla Model 3 LR');
    const logs = (d: any) => d.accounts.find((a: any) => a.name === 'Tesla Model 3 LR').mileageLogs?.length ?? 0;
    const before = logs(await serverData(user));
    await page.locator('main').getByRole('button', { name: /^add log$/i }).click();
    await page.getByPlaceholder('e.g. 45000').fill('45678');
    const saved = waitForSave(page);
    await page.getByRole('button', { name: /record mileage/i }).click();
    expect((await saved).status()).toBe(200);
    expect(logs(await serverData(user))).toBe(before + 1);
  });

  test('vehicle: mileage lower than the previous reading is rejected', async ({ authedPage: page }) => {
    openBug('AUD-75');
    await openDetail(page, 'Tesla Model 3 LR');
    await page.locator('main').getByRole('button', { name: /^add log$/i }).click();
    await page.getByPlaceholder('e.g. 45000').fill('1');
    await page.getByRole('button', { name: /record mileage/i }).click();
    await expect(page.getByText(/lower|less than|previous|invalid/i).first()).toBeVisible({ timeout: 3000 });
  });

  test('asset closing actions (Record Sale / Retire Vehicle) are available at this width', async ({ authedPage: page }) => {
    openBug('AUD-47', isMobile(page));
    await openDetail(page, 'Canal View Apartment');
    await expect(page.locator('main').getByRole('button', { name: /record sale|close|sell/i }).first()).toBeVisible();
    await openDetail(page, 'Tesla Model 3 LR');
    await expect(page.locator('main').getByRole('button', { name: /retire vehicle|close|sell/i }).first()).toBeVisible();
  });
});
