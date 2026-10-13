import { test, goTo } from '../fixtures/test';
const ctrls = async (page: any) => (await page.locator('input:visible,select:visible,textarea:visible').evaluateAll((es: any[]) => es.map(e => `${e.tagName.toLowerCase()}[${e.type}]${e.required ? '*' : ''} ${(e.getAttribute('aria-label') || e.getAttribute('placeholder') || e.id || '').trim().slice(0, 26)}`))).slice(0, 30).join(' | ');
const vbtn = async (page: any) => [...new Set(await page.locator('button:visible').evaluateAll((bs: any[]) => bs.map(b => (b.getAttribute('aria-label') || b.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 30)).filter(Boolean)))].slice(-22).join(' | ');
test('F probe', async ({ authedPage: page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 768);
  const step = async (label: string, path: string, open: string) => {
    try {
      await goTo(page, path);
      await page.getByRole('button', { name: open }).first().click({ timeout: 5000 }); await page.waitForTimeout(800);
      console.log(label, 'FIELDS:', await ctrls(page)); console.log(label, 'BTNS:', await vbtn(page));
    } catch (e: any) { console.log(label, 'ERR', e.message.split('\n')[0]); }
  };
  await step('INVOICE', '/invoices', 'New Invoice');
  await step('TASK', '/tasks', 'New Task');
  await step('IMPORT', '/data-management', 'New Import');
  await step('WIDGET', '/', 'Add Widget');
  await goTo(page, '/data-management'); console.log('DM PAGE BTNS:', await vbtn(page));
  await goTo(page, '/invoices'); console.log('INV PAGE BTNS:', await vbtn(page));
});
