import { test, goTo } from '../fixtures/test';
test('E2', async ({ authedPage: page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 768);
  await goTo(page, '/investments');
  await page.getByRole('button', { name: 'Trade', exact: true }).click(); await page.waitForTimeout(900);
  const all = await page.locator('input,select,textarea').evaluateAll(es => es.filter(e => (e as HTMLElement).offsetParent).map(e => `${e.tagName.toLowerCase()}[${(e as any).type}]${(e as any).required ? '*' : ''} ${(e.getAttribute('aria-label') || e.getAttribute('placeholder') || e.id || '').slice(0, 30)}`));
  console.log('TRADE FIELDS:', all.join(' | '));
  const btns = await page.locator('div.fixed button').evaluateAll(bs => bs.map(b => (b as HTMLElement).innerText.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(-12));
  console.log('TRADE BTNS:', btns.join(' | '));
});
