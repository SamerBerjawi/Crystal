import { test, goTo } from '../fixtures/test';
const ctrls = async (page: any) => (await page.locator('div.fixed').last().locator('input,select,textarea,button').evaluateAll((es: any[]) => es.map(e => `${e.tagName.toLowerCase()}${e.type ? '[' + e.type + ']' : ''} ${(e.getAttribute('aria-label') || e.getAttribute('placeholder') || e.id || e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 30)}`))).slice(0, 40).join(' | ');
test('C modal probe', async ({ authedPage: page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 768);
  await goTo(page, '/transactions');
    await goTo(page, '/transactions');
  const cbs = page.locator('main').getByRole('row').getByRole('checkbox');
  console.log('ROWCB count:', await cbs.count());
  await cbs.nth(1).click({ force: true }); await cbs.nth(2).click({ force: true });
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Categorize' }).click(); await page.waitForTimeout(600);
  console.log('BULKCAT:', await ctrls(page)); await page.keyboard.press('Escape');
  await goTo(page, '/categories'); await page.getByRole('button', { name: 'New Category' }).click(); await page.waitForTimeout(600);
  console.log('NEWCAT:', await ctrls(page)); await page.keyboard.press('Escape');
  await goTo(page, '/tags'); await page.getByRole('button', { name: 'Register New Tag' }).click(); await page.waitForTimeout(600);
  console.log('NEWTAG:', await ctrls(page)); await page.keyboard.press('Escape');
  await goTo(page, '/rules'); await page.getByRole('button', { name: 'New Rule' }).click(); await page.waitForTimeout(600);
  console.log('RULE:', (await page.locator('main form').first().locator('input,select,button').evaluateAll(es => es.map(e => `${e.tagName.toLowerCase()} ${(e.getAttribute('placeholder') || e.getAttribute('aria-label') || (e as HTMLElement).innerText || '').trim().slice(0, 25)}`))).join(' | '));
});
