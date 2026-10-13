import { test, goTo } from '../fixtures/test';
const ctrls = async (page: any) => (await page.locator('div.fixed').filter({ has: page.locator('input,select') }).last().locator('input,select,textarea,button').evaluateAll((es: any[]) => es.map(e => `${e.tagName.toLowerCase()}${e.type ? '[' + e.type + ']' : ''}${e.required ? '*' : ''} ${(e.getAttribute('aria-label') || e.getAttribute('placeholder') || e.id || e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 26)}`))).slice(0, 45).join(' | ');
const names = async (page: any) => [...new Set(await page.locator('main').getByRole('button').evaluateAll((bs: any[]) => bs.map(b => (b.getAttribute('aria-label') || b.innerText || '').trim().replace(/\s+/g, ' ')).filter(Boolean)))].slice(0, 40).join(' | ');
test('d3', async ({ authedPage: page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 768);
  await goTo(page, '/subscriptions');
  console.log('SUBS PAGE:', await names(page));
  await page.getByRole('button', { name: 'New Service' }).first().click(); await page.waitForTimeout(700);
  console.log('SUBS MODAL:', await ctrls(page));
  await page.goto('/budget'); await page.waitForTimeout(1800);
  await page.getByRole('button', { name: 'Edit Budget' }).first().click(); await page.waitForTimeout(700);
  console.log('BUDGET EDIT:', await ctrls(page));
});
