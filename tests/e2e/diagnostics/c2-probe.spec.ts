import { test, goTo } from '../fixtures/test';
test('c2', async ({ authedPage: page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 768);
  await goTo(page, '/transactions');
  for (const m of ['Netflix', 'Spotify']) await page.locator('main').getByRole('row').filter({ hasText: m }).first().getByRole('checkbox').click({ force: true });
  await page.getByRole('button', { name: 'Categorize', exact: true }).click(); await page.waitForTimeout(700);
  console.log('BULK:', (await page.locator('div.fixed').last().locator('button,select,input').evaluateAll(es => es.map(e => `${e.tagName.toLowerCase()} ${(e.getAttribute('aria-label') || e.getAttribute('placeholder') || (e as HTMLElement).innerText || '').trim().replace(/\s+/g, ' ').slice(0, 25)}`))).slice(0, 25).join(' | '));
  await goTo(page, '/');
  await page.getByRole('button', { name: 'Pending Matches' }).click(); await page.waitForTimeout(800);
  console.log('DASH2:', (await page.locator('main').getByRole('button').evaluateAll(bs => bs.map(b => (b.getAttribute('aria-label') || (b as HTMLElement).innerText || '').trim().replace(/\s+/g, ' ')))).filter(Boolean).slice(-25).join(' | '));
  console.log('DASH matches-ish buttons:', (await page.locator('main').getByRole('button').evaluateAll(bs => bs.map(b => (b.getAttribute('aria-label') || (b as HTMLElement).innerText || '').trim().replace(/\s+/g, ' ')).filter(t => /match|pending|review|reconcil|transfer|link/i.test(t)))).join(' | '));
});
