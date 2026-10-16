/** AUD-29 (SEC-006): a hostile merchant logo URL must not run script inside the map pin markup. */
import { test, expect, goTo, serverData } from '../fixtures/test';

test('a logo override containing an attribute break-out does not execute', async ({ authedPage: page, user }) => {
  const data = await serverData(user);
  const payload = 'https://qa.invalid/logo.png" onerror="window.__pwned=1" x="';
  const res = await user.api.post('/api/data', {
    data: {
      partial: true,
      data: {
        preferences: { ...data.preferences, merchantLogoOverrides: { netflix: payload } },
        // The map (and therefore the pin markup) only renders for transactions with coordinates.
        transactions: data.transactions.map((t: any) => (t.merchant === 'Netflix' ? { ...t, latitude: 59.3293, longitude: 18.0686 } : t)),
      },
    },
  });
  expect(res.status()).toBe(200);

  await goTo(page, '/transactions');
  await page.evaluate(() => { (window as any).__pwned = 0; });
  await page.locator('main').getByText('Netflix', { exact: false }).first().click();
  await expect(page.locator('.custom-apple-neon-pin').first(), 'the map pin must have rendered').toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => (window as any).__pwned)).toBe(0);
});
