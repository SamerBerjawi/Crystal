import { test, goTo } from '../fixtures/test';
const ctrls = async (page: any) => (await page.locator('div.fixed').filter({ has: page.locator('input,select') }).last().locator('input,select,textarea,button').evaluateAll((es: any[]) => es.map(e => `${e.tagName.toLowerCase()}${e.type ? '[' + e.type + ']' : ''}${e.required ? '*' : ''} ${(e.getAttribute('aria-label') || e.getAttribute('placeholder') || e.id || e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 26)}`))).slice(0, 45).join(' | ');
test('d2', async ({ authedPage: page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 768);
  await goTo(page, '/budget'); await page.getByRole('button', { name: 'Create Budget' }).click(); await page.waitForTimeout(700);
  console.log('BUDGET:', await ctrls(page)); await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  await goTo(page, '/schedule'); await page.getByRole('button', { name: 'New Recurring' }).click(); await page.waitForTimeout(700);
  console.log('RECUR:', await ctrls(page)); await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  await goTo(page, '/subscriptions');
  console.log('SUBS PAGE:', [...new Set(await page.locator('main').getByRole('button').evaluateAll((bs: any[]) => bs.map(b => (b.getAttribute('aria-label') || b.innerText || '').trim().replace(/\s+/g, ' ')).filter(Boolean)))].slice(0, 40).join(' | '));
});
