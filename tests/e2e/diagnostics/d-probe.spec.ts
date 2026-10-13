import { test, goTo } from '../fixtures/test';
const names = async (page: any, scope = 'main') => [...new Set(await page.locator(scope).getByRole('button').evaluateAll((bs: any[]) => bs.map(b => (b.getAttribute('aria-label') || b.getAttribute('title') || b.innerText || '').trim().replace(/\s+/g, ' ')).filter(Boolean)))].slice(0, 45).join(' | ');
const ctrls = async (page: any) => (await page.locator('div.fixed').last().locator('input,select,textarea,button').evaluateAll((es: any[]) => es.map(e => `${e.tagName.toLowerCase()}${e.type ? '[' + e.type + ']' : ''} ${(e.getAttribute('aria-label') || e.getAttribute('placeholder') || e.id || e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 28)}`))).slice(0, 40).join(' | ');
test('D probe', async ({ authedPage: page }) => {
  const m = (page.viewportSize()?.width ?? 0) < 768 ? 'M' : 'D';
  for (const [p, open] of [['/budget', 'Create Budget'], ['/forecasting', 'Add Goal'], ['/schedule', 'New Recurring'], ['/schedule', 'Add One-time'], ['/subscriptions', 'New Service'], ['/subscriptions', 'Add Card']] as const) {
    await goTo(page, p);
    if (m === 'D' || p !== '/schedule' || open === 'New Recurring') console.log(m, p, 'BUTTONS:', await names(page));
    const b = page.getByRole('button', { name: open }).first();
    if (await b.count()) { await b.click(); await page.waitForTimeout(700); console.log(m, p, open, 'MODAL:', await ctrls(page)); await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
    else console.log(m, p, open, 'NOT FOUND');
  }
});
