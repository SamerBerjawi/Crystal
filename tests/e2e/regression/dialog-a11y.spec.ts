/** AUD-23 (a11y part): dialogs are announced, trap focus and return focus to the opener. */
import { test, expect, goTo } from '../fixtures/test';

test('a shared-Modal dialog has dialog semantics, traps Tab and restores focus on close', async ({ authedPage: page }) => {
  await goTo(page, '/tags');
  const opener = page.getByRole('button', { name: 'New tag' });
  await opener.focus();
  await opener.press('Enter');

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog).toHaveAccessibleName(/.+/);

  // Focus starts inside, and many Tab presses never leave the dialog.
  const inside = () => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
  expect(await inside()).toBe(true);
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    expect(await inside(), `focus escaped the dialog after ${i + 1} Tab presses`).toBe(true);
  }
  await page.keyboard.press('Shift+Tab');
  expect(await inside()).toBe(true);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('a custom overlay (quick-add transaction) is a labelled modal dialog that traps focus', async ({ authedPage: page }) => {
  await goTo(page, '/transactions');
  await page.getByRole('button', { name: /add transaction/i }).first().click();
  const dialog = page.getByRole('dialog').last();
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), `escaped after ${i + 1} Tabs`).toBe(true);
  }
});
