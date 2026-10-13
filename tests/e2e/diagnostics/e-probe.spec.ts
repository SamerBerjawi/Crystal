import { test, goTo } from '../fixtures/test';
const names = async (page: any, scope = 'main') => [...new Set(await page.locator(scope).getByRole('button').evaluateAll((bs: any[]) => bs.map(b => (b.getAttribute('aria-label') || b.getAttribute('title') || b.innerText || '').trim().replace(/\s+/g, ' ')).filter(Boolean)))].slice(0, 50).join(' | ');
const ctrls = async (page: any) => (await page.locator('div.fixed').filter({ has: page.locator('input,select') }).last().locator('input,select,textarea,button').evaluateAll((es: any[]) => es.map(e => `${e.tagName.toLowerCase()}${e.type ? '[' + e.type + ']' : ''}${e.required ? '*' : ''} ${(e.getAttribute('aria-label') || e.getAttribute('placeholder') || e.id || e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 24)}`))).slice(0, 40).join(' | ');
test('E probe', async ({ authedPage: page }) => {
  const m = (page.viewportSize()?.width ?? 0) < 768 ? 'M' : 'D';
  await goTo(page, '/investments'); console.log(m, 'INV:', await names(page));
  const trade = page.getByRole('button', { name: /^trade$/i }).first();
  if (await trade.count()) { await trade.click(); await page.waitForTimeout(700); console.log(m, 'TRADE MODAL:', await ctrls(page)); await page.keyboard.press('Escape'); }
  await goTo(page, '/reports'); console.log(m, 'REPORTS:', await names(page));
  await goTo(page, '/challenges'); console.log(m, 'CHALL:', await names(page));
});
