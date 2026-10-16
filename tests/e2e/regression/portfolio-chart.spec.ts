/** The portfolio candlestick chart renders a sane, finite return for every timeframe. */
import { test, expect, goTo, watch } from '../fixtures/test';

test('candlestick performance shows finite figures for every timeframe', async ({ authedPage: page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440', 'chart lives in the desktop investments layout');
  const w = watch(page);
  await goTo(page, '/investments');
  const chart = page.locator('div.glass-section').filter({ hasText: 'Candlestick Performance' }).first();
  await expect(chart).toBeVisible();
  for (const tf of ['1M', '3M', '6M', '1Y', 'All Time']) {
    await chart.getByRole('button', { name: tf, exact: true }).click();
    await page.waitForTimeout(400);
    const text = await chart.innerText();
    expect(text, `no NaN/Infinity for ${tf}`).not.toMatch(/NaN|Infinity/);
    expect(text).toMatch(/-?\d+(\.\d)?%/);
  }
  expect(w.consoleErrors.filter(e => !/favicon|ResizeObserver/.test(e))).toEqual([]);
});
