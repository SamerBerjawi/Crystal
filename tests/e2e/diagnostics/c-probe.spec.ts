import { test, goTo } from '../fixtures/test';
const names = async (page: any, scope = 'main') => [...new Set(await page.locator(scope).getByRole('button').evaluateAll((bs: any[]) => bs.map(b => (b.getAttribute('aria-label') || b.getAttribute('title') || b.innerText || '').trim().replace(/\s+/g, ' ')).filter(Boolean)))].slice(0, 60).join(' | ');
test('C probe', async ({ authedPage: page }) => {
  const mobile = (page.viewportSize()?.width ?? 0) < 768;
  await goTo(page, '/transactions');
  console.log(mobile ? 'M' : 'D', 'TX buttons:', await names(page));
  console.log(mobile ? 'M' : 'D', 'TX inputs:', (await page.locator('main input, main select').evaluateAll(es => es.map(e => `${(e as any).type}:${e.getAttribute('placeholder') || e.getAttribute('aria-label') || ''}`))).slice(0, 20).join(' | '));
  if (!mobile) {
    await page.locator('main tbody tr').filter({ hasText: /Purchase|Coffee|Salary|Grocer/i }).first().click({ button: 'right' });
    await page.waitForTimeout(500);
    console.log('D context menu:', (await page.locator('body').getByRole('button').evaluateAll(bs => bs.map(b => (b as HTMLElement).innerText.trim()).filter(t => /edit|split|duplicate|recurring|delete|combine|unsplit/i.test(t)))).join(' | '));
    await page.keyboard.press('Escape');
  }
  for (const p of ['/categories', '/tags', '/rules', '/merchants']) { await goTo(page, p); console.log(mobile ? 'M' : 'D', p, ':', await names(page)); }
});
