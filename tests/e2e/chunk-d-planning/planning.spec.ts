/**
 * Chunk D — Planning & scheduling (inventory workflows W24–W28).
 */
import { test, expect, goTo, isMobile, serverData, waitForSave, watch, openBug } from '../fixtures/test';
import type { Page, Locator } from '@playwright/test';

const topModal = (page: Page) => page.locator('div.fixed').filter({ has: page.locator('input,select') }).last();

/** Fill the first empty text input, first number input and pick the first real option in each select. */
async function fillGeneric(modal: Locator, f: { text?: string; amount?: string }) {
  if (f.text) for (const inp of await modal.locator('input[type="text"]').all()) { if (await inp.isVisible() && !(await inp.inputValue())) await inp.fill(f.text); }
  if (f.amount) await modal.locator('input[type="number"]').first().fill(f.amount);
  for (const sel of await modal.locator('select').all()) {
    const v = await sel.inputValue().catch(() => '');
    if (!v) { const opts = await sel.locator('option').count(); if (opts > 1) await sel.selectOption({ index: opts - 1 }); }
  }
}


/** Answer the app's custom confirm dialog (useConfirm) if one is showing. */
async function confirmIfAsked(page: Page) {
  await page.waitForTimeout(500);
  const btn = page.locator('div.fixed').last().getByRole('button', { name: /^(generate|confirm|delete|continue|yes|ok|overwrite|replace|proceed|create)/i }).last();
  if (await btn.isVisible().catch(() => false)) await btn.click();
}

async function submitAndSave(page: Page, modal: Locator, name: RegExp) {
  const saved = waitForSave(page);
  await modal.getByRole('button', { name }).last().click();
  return (await saved).status();
}

test.describe('W24 Budgets', () => {
  async function openCreate(page: Page) {
    await goTo(page, '/budget');
    if (isMobile(page)) await page.locator('main button.bg-purple-600').first().click();
    else await page.getByRole('button', { name: 'Create Budget' }).click();
    await expect(topModal(page)).toBeVisible();
  }

  test('create a budget', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).budgets.length;
    await openCreate(page);
    const modal = topModal(page);
    await fillGeneric(modal, { amount: '321' });
    expect(await submitAndSave(page, modal, /deploy|save|create|confirm/i)).toBe(200);
    expect((await serverData(user)).budgets.length).toBe(before + 1);
  });

  test('budget without an amount is rejected', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).budgets.length;
    await openCreate(page);
    const modal = topModal(page);
    await fillGeneric(modal, {});
    await modal.locator('input[type="number"]').first().fill('');
    await modal.getByRole('button', { name: /deploy|save|create|confirm/i }).last().click();
    await page.waitForTimeout(2500);
    expect((await serverData(user)).budgets.length).toBe(before);
  });

  test('mobile: the add-budget button has an accessible name', async ({ authedPage: page }) => {
    test.skip(!isMobile(page), 'mobile only');
    await goTo(page, '/budget');
    const btn = page.locator('main button.bg-purple-600').first();
    const name = await btn.evaluate(b => b.getAttribute('aria-label') || b.getAttribute('title') || (b as HTMLElement).innerText.trim());
    expect(name, 'icon-only "+" needs aria-label').not.toBe('');
  });

  test('quick create from spending history creates/updates budgets', async ({ authedPage: page, user }) => {
    test.skip(isMobile(page), 'desktop header action');
    const before = (await serverData(user)).budgets;
    await goTo(page, '/budget');
    const msgs: string[] = [];
    page.on('dialog', d => { msgs.push(d.message()); d.accept(); });
    await page.getByRole('button', { name: 'Quick Budget', exact: true }).first().click();
    await confirmIfAsked(page);
    await page.waitForTimeout(2500);
    // Seed transactions are from 2024, so "last 3 months" has no spending: expect either a clear message or a change.
    const changed = JSON.stringify((await serverData(user)).budgets) !== JSON.stringify(before);
    const feedback = /no spending data|budget\(s\) have been created|created or updated|no data|nothing to/i.test(msgs.join(' ') + (await page.locator('body').innerText()));
    expect(changed || feedback, 'Quick Budget should either change budgets or tell the user why not').toBe(true);
  });

  test('delete a budget (with confirmation)', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).budgets.length;
    await goTo(page, '/budget');
    if (isMobile(page)) {
      test.skip(true, 'Blocked — mobile budget Delete is a swipe-revealed action (same SwipeableRow limitation as C9).');
      const del = page.getByRole('button', { name: 'Delete' }).first();
      await del.click({ timeout: 5000 });
      const saved = waitForSave(page);
      await confirmIfAsked(page);
      expect((await saved).status()).toBe(200);
      expect((await serverData(user)).budgets.length).toBe(before - 1);
    } else {
      await page.getByRole('button', { name: 'Edit Budget' }).first().click();
      await page.waitForTimeout(600);
      await page.getByRole('button', { name: 'Delete Budget' }).first().click();
      // The confirmation dialog repeats the label; the last one is the dialog's confirm button.
      await expect(page.getByText('Delete budget?')).toBeVisible();
      const saved = waitForSave(page);
      await page.getByRole('button', { name: 'Delete Budget' }).last().click();
      expect((await saved).status()).toBe(200);
      expect((await serverData(user)).budgets.length).toBe(before - 1);
    }
  });
});

test.describe('W25 Goals', () => {
  async function openAddGoal(page: Page) {
    await goTo(page, '/forecasting');
    if (isMobile(page)) {
      await page.getByRole('button', { name: /^goals/i }).first().click();
      await page.getByRole('button', { name: 'New Goal' }).click();
    } else await page.getByRole('button', { name: 'Add Goal' }).click();
    await expect(page.getByPlaceholder(/vacation fund/i)).toBeVisible();
  }

  test('create a goal', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).financialGoals.length;
    await openAddGoal(page);
    const modal = topModal(page);
    await page.getByPlaceholder(/vacation fund/i).fill('QA Goal');
    await modal.locator('input[type="number"]').first().fill('5000');
    expect(await submitAndSave(page, modal, /deploy goal/i)).toBe(200);
    const goals = (await serverData(user)).financialGoals;
    expect(goals.length).toBe(before + 1);
    expect(goals.some((g: any) => g.name === 'QA Goal' && Number(g.amount) === 5000)).toBe(true);
  });

  test('goal without a name is rejected', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).financialGoals.length;
    await openAddGoal(page);
    await topModal(page).locator('input[type="number"]').first().fill('100');
    await topModal(page).getByRole('button', { name: /deploy goal/i }).click();
    await page.waitForTimeout(2500);
    expect((await serverData(user)).financialGoals.length).toBe(before);
  });

  test('negative goal amount is rejected', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).financialGoals.length;
    await openAddGoal(page);
    await page.getByPlaceholder(/vacation fund/i).fill('QA Negative');
    await topModal(page).locator('input[type="number"]').first().fill('-500');
    await topModal(page).getByRole('button', { name: /deploy goal/i }).click();
    await page.waitForTimeout(2500);
    expect((await serverData(user)).financialGoals.some((g: any) => g.name === 'QA Negative')).toBe(false);
  });
});

test.describe('W26 Forecasting', () => {
  test('forecast renders for every horizon without errors', async ({ authedPage: page }) => {
    const w = watch(page);
    await goTo(page, '/forecasting');
    for (const h of ['3M', '6M', 'EOY', '1Y']) {
      await page.getByRole('button', { name: h, exact: true }).first().click();
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
    if (isMobile(page)) {
      await page.getByRole('button', { name: /^rules/i }).first().click();
      await page.getByRole('button', { name: 'Add Rule' }).click();
    } else await page.getByRole('button', { name: 'New Recurring' }).click();
    await expect(topModal(page)).toBeVisible();
  }

  test('create a recurring transaction', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).recurringTransactions.length;
    await openNewRecurring(page);
    const modal = topModal(page);
    await fillGeneric(modal, { text: 'QA Recurring', amount: '25' });
    const desc = modal.getByPlaceholder(/description|what|name/i).first();
    if (await desc.count()) await desc.fill('QA Recurring');
    expect(await submitAndSave(page, modal, /store card|commit|deploy|save|create|confirm|schedule|add/i)).toBe(200);
    expect((await serverData(user)).recurringTransactions.length).toBe(before + 1);
  });

  test('add a one-time bill', async ({ authedPage: page, user }) => {
    test.skip(isMobile(page), 'mobile entry point differs (see report)');
    const before = (await serverData(user)).billsAndPayments.length;
    await goTo(page, '/schedule');
    await page.getByRole('button', { name: 'Add One-time' }).click();
    const modal = topModal(page);
    await fillGeneric(modal, { text: 'QA Bill', amount: '75' });
    expect(await submitAndSave(page, modal, /store card|commit|deploy|save|create|confirm|schedule|add/i)).toBe(200);
    expect((await serverData(user)).billsAndPayments.length).toBe(before + 1);
  });

  test('mark an overdue item as done records it', async ({ authedPage: page, user }) => {
    test.skip(!isMobile(page), 'uses mobile "Mark Done"; desktop equivalent is "Post Transaction"');
    const before = (await serverData(user)).transactions.length;
    await goTo(page, '/schedule');
    await page.getByRole('button', { name: /overdue/i }).first().click();
    await page.getByRole('button', { name: 'Pay Now' }).first().click();
    const modal = page.locator('div.fixed').last();
    const confirm = modal.getByRole('button', { name: /confirm|save|record|pay/i }).last();
    const saved = waitForSave(page);
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    expect((await saved).status()).toBe(200);
    expect((await serverData(user)).transactions.length).toBeGreaterThan(before);
  });

  test('desktop: post a scheduled transaction from the calendar', async ({ authedPage: page, user }) => {
    test.skip(isMobile(page), 'desktop calendar');
    const before = (await serverData(user)).transactions.length;
    await goTo(page, '/schedule');
    await page.getByRole('button', { name: 'Post Transaction' }).first().click();
    const modal = page.locator('div.fixed').last();
    const confirm = modal.getByRole('button', { name: /confirm|save|record|post/i }).last();
    const saved = waitForSave(page);
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    expect((await saved).status()).toBe(200);
    expect((await serverData(user)).transactions.length).toBeGreaterThan(before);
  });

  test('notification center lists bills and can be cleared', async ({ authedPage: page }) => {
    await goTo(page, '/');
    const bell = page.getByRole('button', { name: /bill notifications/i });
    expect(await bell.count(), 'bill notifications must be reachable at this width').toBeGreaterThan(0);
    await bell.first().click();
    const panel = page.locator('div').filter({ hasText: /notification|bill|upcoming|overdue/i }).last();
    await expect(panel).toBeVisible();
    const clear = page.getByRole('button', { name: /clear all/i });
    if (await clear.count()) { await clear.click(); await expect(page.getByRole('button', { name: /pay \/ record/i })).toHaveCount(0); }
  });
});

test.describe('W28 Subscriptions & memberships', () => {
  test('add a subscription service', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).recurringTransactions.length;
    await goTo(page, '/subscriptions');
    await page.getByRole('button', { name: isMobile(page) ? 'Add Subscription' : 'New Service' }).first().click();
    const modal = topModal(page);
    await fillGeneric(modal, { text: 'QA Streaming', amount: '7.99' });
    expect(await submitAndSave(page, modal, /store card|commit|deploy|save|create|confirm|schedule|add/i)).toBe(200);
    expect((await serverData(user)).recurringTransactions.length).toBe(before + 1);
  });

  test('add a loyalty/membership card', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).memberships.length;
    await goTo(page, '/subscriptions');
    const wallet = page.getByRole('button', { name: /^wallet/i }).first();
    if (await wallet.count()) await wallet.click();
    const add = page.getByRole('button', { name: /add card/i }).first();
    expect(await add.count(), 'an "Add Card" entry point should exist at this width').toBeGreaterThan(0);
    await add.click();
    const modal = topModal(page);
    await fillGeneric(modal, { text: 'QA Loyalty' });
    expect(await submitAndSave(page, modal, /store card|commit|deploy|save|create|confirm|schedule|add/i)).toBe(200);
    expect((await serverData(user)).memberships.length).toBe(before + 1);
  });

  test('ignored subscription suggestions stay ignored on another device', async ({ authedPage: page, user, browser }, testInfo) => {
    await goTo(page, '/subscriptions');
    const ignore = page.getByRole('button', { name: 'Ignore' }).first();
    test.skip((await ignore.count()) === 0, 'no detected subscriptions to ignore in seed data');
    await ignore.click();
    await page.waitForTimeout(1500);
    const ctx = await browser.newContext({ ...testInfo.project.use, storageState: await user.api.storageState() });
    const p2 = await ctx.newPage();
    await p2.goto('/subscriptions');
    await p2.waitForTimeout(2000);
    const before = await page.getByRole('button', { name: 'Ignore' }).count();
    expect(await p2.getByRole('button', { name: 'Ignore' }).count()).toBe(before);
    await ctx.close();
  });
});
