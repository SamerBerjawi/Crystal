import { test, goTo } from '../fixtures/test';
test('what does clicking an account card do', async ({ authedPage: page }) => {
  await goTo(page, '/accounts');
  const h = page.getByRole('heading', { name: 'Everyday Checking', exact: true }).first();
  await h.click();
  await page.waitForTimeout(1500);
  console.log('url after heading click:', page.url());
  console.log('headings now:', (await page.getByRole('heading').allInnerTexts()).slice(0, 6).join(' | '));
  const dialogs = await page.locator('div.fixed').filter({ hasText: 'Everyday Checking' }).count();
  console.log('fixed overlays containing name:', dialogs);
});
