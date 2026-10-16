/** AUD-24/22/69: controls have accessible names; clickable cards are keyboard operable. (axe: button-name, select-name, label) */
import AxeBuilder from '@axe-core/playwright';
import { test, expect, goTo } from '../fixtures/test';

const PAGES = ['/transactions', '/investments', '/tags', '/preferences', '/accounts', '/budget', '/forecasting', '/subscriptions', '/invoices', '/merchants', '/tasks', '/reports', '/integrations', '/'];

for (const path of PAGES) {
  test(`axe naming rules pass on ${path}`, async ({ authedPage: page }) => {
    await goTo(page, path);
    await page.waitForTimeout(800);
    const results = await new AxeBuilder({ page })
      .withRules(['button-name', 'select-name', 'label', 'aria-required-attr', 'link-name', 'input-button-name'])
      .analyze();
    const summary = results.violations.map(v => `${v.id} x${v.nodes.length}: ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`);
    expect(summary, `axe violations on ${path}`).toEqual([]);
  });
}

test('clickable account cards are keyboard operable (Enter opens the detail page)', async ({ authedPage: page }) => {
  await goTo(page, '/accounts');
  const card = page.getByRole('button', { name: /^Open Everyday Checking$/ }).first();
  await expect(card, 'the account card has a keyboard entry point').toBeAttached();
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog').filter({ hasText: 'Everyday Checking' }).first(), 'Enter opens the account overview').toBeVisible();
});

test('every page exposes a main landmark and a single h1', async ({ authedPage: page }) => {
  for (const path of ['/', '/accounts', '/transactions', '/budget', '/forecasting', '/investments']) {
    await goTo(page, path);
    await expect(page.locator('main'), `main landmark on ${path}`).toHaveCount(1);
    expect(await page.locator('h1').count(), `exactly one h1 on ${path}`).toBe(1);
  }
});
