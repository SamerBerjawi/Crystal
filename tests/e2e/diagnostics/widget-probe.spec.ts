import { test, goTo, serverData } from '../fixtures/test';
test('widget probe', async ({ authedPage: page, user }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 768);
  await goTo(page, '/');
  await page.getByRole('button', { name: 'Customize' }).click(); await page.waitForTimeout(500);
  const titles = async () => (await page.locator('main h3, main h4').allInnerTexts()).filter(t => t.length < 40).join(' | ');
  console.log('BEFORE:', await titles(), '| remove btns', await page.locator('button[aria-label="Remove widget"]:visible').count());
  await page.locator('button[aria-label="Remove widget"]:visible').first().click(); await page.waitForTimeout(1200);
  console.log('AFTER REMOVE:', await titles(), '| remove btns', await page.locator('button[aria-label="Remove widget"]:visible').count());
  await page.getByRole('button', { name: 'Add Widget' }).click(); await page.waitForTimeout(700);
  await page.screenshot({ path: 'results/addwidget.png' }); const opts = await page.locator('button:visible').allInnerTexts();
  console.log('ADD WIDGET OPTIONS:', opts.map(o => o.replace(/\s+/g, ' ').slice(0, 30)).join(' | '));
  console.log('server widget prefs keys:', Object.keys((await serverData(user)).preferences || {}).filter(k => /widget|layout|dashboard/i.test(k)).join(','));
});
