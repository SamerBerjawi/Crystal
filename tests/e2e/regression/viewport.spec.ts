/** AUD-21 (UI-004): users must be able to pinch-zoom (WCAG 1.4.4). */
import { test, expect } from '../fixtures/test';

test('the viewport meta does not disable zoom', async ({ page }) => {
  await page.goto('/');
  const content = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(content).toBeTruthy();
  expect(content).not.toMatch(/user-scalable\s*=\s*(no|0)/i);
  expect(content).not.toMatch(/maximum-scale\s*=\s*1(\.0)?\b/i);
});
