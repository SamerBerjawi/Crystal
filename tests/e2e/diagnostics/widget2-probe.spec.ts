import { test, goTo, serverData } from '../fixtures/test';
test('widget remove persistence', async ({ authedPage: page, user }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 768);
  await goTo(page, '/');
  await page.getByRole('button', { name: 'Customize' }).click(); await page.waitForTimeout(500);
  const before = JSON.stringify((await serverData(user)).preferences?.dashboardLayouts ?? null);
  const hdrs = async () => (await page.locator('main [class*="react-grid-item"]:visible').allInnerTexts()).map(t => t.split('\n')[0]).join(' | ');
  console.log('GRID BEFORE:', await hdrs());
  await page.locator('button[aria-label="Remove widget"]:visible').first().click(); await page.waitForTimeout(3000);
  console.log('GRID AFTER:', await hdrs());
  const after = JSON.stringify((await serverData(user)).preferences?.dashboardLayouts ?? null);
  console.log('server layouts changed?', before !== after, 'len', before.length, after.length);
});
