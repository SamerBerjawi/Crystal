import { test, goTo } from '../fixtures/test';
const vbtn = async (page: any) => [...new Set(await page.locator('div.fixed button:visible').evaluateAll((bs: any[]) => bs.map(b => (b.getAttribute('aria-label') || b.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 28)).filter(Boolean)))].slice(0, 30).join(' | ');
const ctrls = async (page: any) => (await page.locator('div.fixed').locator('input:visible,select:visible').evaluateAll((es: any[]) => es.map(e => `${e.tagName.toLowerCase()}[${e.type}] ${(e.getAttribute('aria-label') || e.getAttribute('placeholder') || e.id || e.name || '').slice(0, 22)}=${(e as any).value?.slice?.(0, 20)}`))).slice(0, 25).join(' | ');
test('import probe', async ({ authedPage: page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 768);
  await goTo(page, '/data-management');
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.getByRole('button', { name: /transactions \(csv\)/i }).click(); await page.waitForTimeout(800);
  console.log('S1 BTNS:', await vbtn(page)); console.log('S1 file inputs:', await page.locator('input[type=file]').count());
  await page.locator('input[type=file]').first().setInputFiles('fixtures/files/eu-transactions.csv'); await page.waitForTimeout(1200);
  for (let i = 2; i <= 6; i++) {
    console.log(`S${i} BTNS:`, await vbtn(page)); console.log(`S${i} CTRLS:`, await ctrls(page));
    const next = page.locator('div.fixed button:visible').filter({ hasText: /^(next|continue|preview|review|confirm mapping|map columns)/i }).last();
    if (!(await next.count())) break; await next.click(); await page.waitForTimeout(900);
  }
});
