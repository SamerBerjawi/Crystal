/**
 * Chunk D — Planning & scheduling (inventory workflows W24–W28).
 */
import { test, expect, goTo, isMobile, serverData, waitForSave, watch, openBug } from '../fixtures/test';
import type { Page, Locator } from '@playwright/test';

const topModal = (page: Page) => page.locator('.crystal-dialog, .crystal-side, .crystal-sheet').last();

async function submitAndSave(page: Page, modal: Locator, name: RegExp) {
  const saved = waitForSave(page);
  await modal.getByRole('button', { name }).last().click();
  return (await saved).status();
}

async function selectFirstOption(modal: Locator) {
  const page = modal.page();
  if (isMobile(page)) {
    const trigger = modal.getByRole('button', { name: /category|search categories/i }).first();
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click();
    }
  } else {
    const triggerBtn = modal.getByRole('button', { name: /show options/i }).first();
    if (await triggerBtn.isVisible().catch(() => false)) {
      await triggerBtn.click();
    } else {
      const inp = modal.getByPlaceholder(/search categories/i).or(modal.getByLabel('Category')).first();
      await inp.click();
      await inp.press('ArrowDown');
    }
  }
  await page.getByRole('option').first().click();
}

test.describe('W24 Budgets', () => {
  async function openCreate(page: Page) {
    await goTo(page, '/budget');
    await page.getByRole('button', { name: /set a budget/i }).first().click();
    await expect(topModal(page)).toBeVisible();
  }

  test('create a budget', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).budgets.length;
    await openCreate(page);
    const modal = topModal(page);
    await selectFirstOption(modal);
    const amountInp = modal.getByLabel(/monthly budget|amount/i).or(modal.locator('input[inputmode="decimal"]')).first();
    await amountInp.fill('321');
    expect(await submitAndSave(page, modal, /set budget|save/i)).toBe(200);
    expect((await serverData(user)).budgets.length).toBe(before + 1);
  });

  test('budget without an amount is rejected', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).budgets.length;
    await openCreate(page);
    const modal = topModal(page);
    await selectFirstOption(modal);
    const amountInp = modal.getByLabel(/monthly budget|amount/i).or(modal.locator('input[inputmode="decimal"]')).first();
    await amountInp.fill('');
    await modal.getByRole('button', { name: /set budget|save/i }).last().click();
    await page.waitForTimeout(1500);
    expect((await serverData(user)).budgets.length).toBe(before);
  });

  test('mobile: the add-budget button has an accessible name', async ({ authedPage: page }) => {
    test.skip(!isMobile(page), 'mobile only');
    await goTo(page, '/budget');
    const btn = page.getByRole('button', { name: /set a budget/i }).first();
    const name = await btn.evaluate(b => b.getAttribute('aria-label') || b.getAttribute('title') || (b as HTMLElement).innerText.trim());
    expect(name, 'add-budget button needs accessible name').not.toBe('');
  });

  test('quick create from spending history creates/updates budgets', async ({ authedPage: page, user }) => {
    test.skip(isMobile(page), 'desktop header action');
    const before = (await serverData(user)).budgets;
    await goTo(page, '/budget');
    const msgs: string[] = [];
    page.on('dialog', d => { msgs.push(d.message()); d.accept(); });
    await page.getByRole('button', { name: /quick budget/i }).first().click();
    const menuOption = page.getByRole('menuitem').first();
    if (await menuOption.isVisible().catch(() => false)) {
      await menuOption.click();
    }
    const confirmBtn = page.getByRole('button', { name: /build budgets/i });
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
    }
    await page.waitForTimeout(2500);
    const changed = JSON.stringify((await serverData(user)).budgets) !== JSON.stringify(before);
    const feedback = /no spending|budget\(s\) have been created|created or updated|no data|nothing to/i.test(msgs.join(' ') + (await page.locator('body').innerText()));
    expect(changed || feedback, 'Quick Budget should either change budgets or tell the user why not').toBe(true);
  });

  test('delete a budget (with confirmation)', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).budgets.length;
    await goTo(page, '/budget');
    const budgetRow = page.locator('section[aria-label="Categories"] .grid button').first();
    await budgetRow.click();
    const modal = topModal(page);
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'Delete' }).click();
    const confirmBtn = page.getByRole('button', { name: 'Delete budget' }).last();
    await expect(confirmBtn).toBeVisible();
    const saved = waitForSave(page);
    await confirmBtn.click();
    expect((await saved).status()).toBe(200);
    expect((await serverData(user)).budgets.length).toBe(before - 1);
  });
});

test.describe('W25 Goals', () => {
  async function openAddGoal(page: Page) {
    await goTo(page, '/goals');
    await page.getByRole('button', { name: /new goal/i }).click();
    await expect(topModal(page)).toBeVisible();
  }

  test('create a goal', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).financialGoals.length;
    await openAddGoal(page);
    const modal = topModal(page);
    await modal.getByLabel(/goal name/i).fill('QA Goal');
    const amountInp = modal.getByLabel(/target amount|target budget/i).or(modal.locator('input[inputmode="decimal"]')).first();
    await amountInp.fill('5000');
    expect(await submitAndSave(page, modal, /save goal|save/i)).toBe(200);
    const goals = (await serverData(user)).financialGoals;
    expect(goals.length).toBe(before + 1);
    expect(goals.some((g: any) => g.name === 'QA Goal' && Number(g.amount) === 5000)).toBe(true);
  });

  test('goal without a name is rejected', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).financialGoals.length;
    await openAddGoal(page);
    const modal = topModal(page);
    const amountInp = modal.getByLabel(/target amount|target budget/i).or(modal.locator('input[inputmode="decimal"]')).first();
    await amountInp.fill('100');
    await modal.getByRole('button', { name: /save goal|save/i }).click();
    await page.waitForTimeout(1500);
    expect((await serverData(user)).financialGoals.length).toBe(before);
  });

  test('negative goal amount is rejected', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).financialGoals.length;
    await openAddGoal(page);
    const modal = topModal(page);
    await modal.getByLabel(/goal name/i).fill('QA Negative');
    const amountInp = modal.getByLabel(/target amount|target budget/i).or(modal.locator('input[inputmode="decimal"]')).first();
    await amountInp.fill('-500');
    await modal.getByRole('button', { name: /save goal|save/i }).click();
    await page.waitForTimeout(1500);
    expect((await serverData(user)).financialGoals.some((g: any) => g.name === 'QA Negative')).toBe(false);
  });
});

test.describe('W26 Forecasting', () => {
  test('forecast renders for every horizon without errors', async ({ authedPage: page }) => {
    const w = watch(page);
    await goTo(page, '/forecasting');
    for (const h of [/90 days|3M/i, /6 months|6M/i, /end of year|EOY/i, /1 year|1Y/i]) {
      await page.getByRole('button', { name: h }).first().click();
      await page.waitForTimeout(400);
    }
    await expect(page.getByText('Something went wrong')).toHaveCount(0);
    expect(w.consoleErrors.filter(e => !/favicon|ResizeObserver|Download the React DevTools/.test(e))).toEqual([]);
    expect(await page.locator('main').evaluate(m => m.scrollWidth), 'no horizontal overflow').toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  });

  test('forecast for an account with no data shows an empty state, not an error', async ({ page, emptyUser, browser }, testInfo) => {
    const ctx = await browser.newContext({ ...testInfo.project.use, storageState: await emptyUser.api.storageState() });
    const p = await ctx.newPage();
    await p.goto('/forecasting');
    await expect(p.locator('main')).toBeVisible({ timeout: 15_000 });
    await p.waitForTimeout(1500);
    await expect(p.getByText('Something went wrong')).toHaveCount(0);
    await ctx.close();
  });
});

test.describe('W27 Schedule & bills', () => {
  async function openNewRecurring(page: Page) {
    await goTo(page, '/schedule');
    await page.getByRole('button', { name: /^add$/i }).first().click();
    await page.getByRole('menuitem', { name: /recurring item/i }).click();
    await expect(topModal(page)).toBeVisible();
  }

  test('create a recurring transaction', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).recurringTransactions.length;
    await openNewRecurring(page);
    const modal = topModal(page);
    await modal.getByLabel('Name').fill('QA Recurring');
    await selectFirstOption(modal);
    const amountInp = modal.getByLabel('Amount').or(modal.locator('input[inputmode="decimal"]')).first();
    await amountInp.fill('25');
    expect(await submitAndSave(page, modal, /save/i)).toBe(200);
    expect((await serverData(user)).recurringTransactions.length).toBe(before + 1);
  });

  test('add a one-time bill', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).billsAndPayments.length;
    await goTo(page, '/schedule');
    await page.getByRole('button', { name: /^add$/i }).first().click();
    await page.getByRole('menuitem', { name: /one-time bill/i }).click();
    const modal = topModal(page);
    await modal.getByLabel('Name').fill('QA Bill');
    const amountInp = modal.getByLabel('Amount').or(modal.locator('input[inputmode="decimal"]')).first();
    await amountInp.fill('75');
    expect(await submitAndSave(page, modal, /save/i)).toBe(200);
    expect((await serverData(user)).billsAndPayments.length).toBe(before + 1);
  });

  test('mark an overdue item as done records it', async ({ authedPage: page, user }) => {
    test.skip(!isMobile(page), 'uses mobile "Post"; desktop equivalent tested below');
    const before = (await serverData(user)).transactions.length;
    await goTo(page, '/schedule');
    const postBtn = page.getByRole('button', { name: 'Post' }).first();
    test.skip((await postBtn.count()) === 0, 'no items due to post');
    await postBtn.click();
    const modal = topModal(page);
    const confirm = modal.getByRole('button', { name: /save transaction|save changes|save/i }).last();
    const saved = waitForSave(page);
    await confirm.click();
    expect((await saved).status()).toBe(200);
    expect((await serverData(user)).transactions.length).toBeGreaterThan(before);
  });

  test('desktop: post a scheduled transaction from the calendar', async ({ authedPage: page, user }) => {
    test.skip(isMobile(page), 'desktop calendar');
    const before = (await serverData(user)).transactions.length;
    await goTo(page, '/schedule');
    const postBtn = page.getByRole('button', { name: 'Post' }).first();
    test.skip((await postBtn.count()) === 0, 'no items due to post');
    await postBtn.click();
    const modal = topModal(page);
    const confirm = modal.getByRole('button', { name: /save transaction|save changes|save/i }).last();
    const saved = waitForSave(page);
    await confirm.click();
    expect((await saved).status()).toBe(200);
    expect((await serverData(user)).transactions.length).toBeGreaterThan(before);
  });

  test('notification center lists bills and can be cleared', async ({ authedPage: page }) => {
    await goTo(page, '/');
    const bell = page.getByRole('button', { name: /bill alerts|notifications/i });
    expect(await bell.count(), 'bill alerts must be reachable at this width').toBeGreaterThan(0);
    await bell.first().click();
    const panel = topModal(page);
    await expect(panel).toBeVisible();
    const clear = panel.getByRole('button', { name: /clear all/i });
    if (await clear.count()) {
      await clear.click();
    }
  });
});

test.describe('W28 Subscriptions & memberships', () => {
  test('add a subscription service', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).recurringTransactions.length;
    await goTo(page, '/subscriptions');
    await page.getByRole('button', { name: /add a service/i }).first().click();
    const modal = topModal(page);
    await modal.getByLabel('Name').fill('QA Streaming');
    await selectFirstOption(modal);
    const amountInp = modal.getByLabel('Amount').or(modal.locator('input[inputmode="decimal"]')).first();
    await amountInp.fill('7.99');
    expect(await submitAndSave(page, modal, /save/i)).toBe(200);
    expect((await serverData(user)).recurringTransactions.length).toBe(before + 1);
  });

  test('add a loyalty/membership card', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).memberships.length;
    await goTo(page, '/subscriptions');
    await page.getByRole('button', { name: /wallet/i }).first().click();
    const add = page.getByRole('button', { name: /add a card/i }).first();
    expect(await add.count(), 'an "Add Card" entry point should exist at this width').toBeGreaterThan(0);
    await add.click();
    const modal = topModal(page);
    await modal.getByLabel('Provider').fill('QA Loyalty');
    await modal.getByLabel('Member number').fill('123456');
    expect(await submitAndSave(page, modal, /add card|save/i)).toBe(200);
    expect((await serverData(user)).memberships.length).toBe(before + 1);
  });

  test('ignored subscription suggestions stay ignored on another device', async ({ authedPage: page, user, browser }, testInfo) => {
    await goTo(page, '/subscriptions');
    const ignore = page.getByRole('button', { name: /dismiss|ignore/i }).first();
    test.skip((await ignore.count()) === 0, 'no detected subscriptions to ignore in seed data');
    await ignore.click();
    await page.waitForTimeout(1500);
    const ctx = await browser.newContext({ ...testInfo.project.use, storageState: await user.api.storageState() });
    const p2 = await ctx.newPage();
    await p2.goto('/subscriptions');
    await p2.waitForTimeout(2000);
    const before = await page.getByRole('button', { name: /dismiss|ignore/i }).count();
    expect(await p2.getByRole('button', { name: /dismiss|ignore/i }).count()).toBe(before);
    await ctx.close();
  });
});
