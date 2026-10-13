import { test, goTo } from '../fixtures/test';
const ctrls = async (page: any) => (await page.locator('input:visible,select:visible,textarea:visible').evaluateAll((es: any[]) => es.map(e => `${e.tagName.toLowerCase()}[${e.type}] ${(e.getAttribute('aria-label') || e.getAttribute('placeholder') || e.id || '').trim().slice(0, 26)}`))).slice(0, 20).join(' | ');
const vbtn = async (page: any) => [...new Set(await page.locator('button:visible').evaluateAll((bs: any[]) => bs.map(b => (b.getAttribute('aria-label') || b.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 30)).filter(Boolean)))].slice(-20).join(' | ');
test('F2', async ({ authedPage: page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 768);
  for (const b of ['Import', 'Export', 'Backup', 'Restore']) {
    try { await goTo(page, '/data-management'); await page.getByRole('button', { name: b, exact: true }).click({ timeout: 4000 }); await page.waitForTimeout(800);
      console.log('DM', b, 'FIELDS:', await ctrls(page)); console.log('DM', b, 'BTNS:', await vbtn(page)); } catch (e: any) { console.log('DM', b, 'ERR', e.message.split('\n')[0]); }
  }
  try { await goTo(page, '/'); await page.getByRole('button', { name: 'Customize' }).click(); await page.waitForTimeout(600); console.log('DASH after Customize BTNS:', await vbtn(page)); } catch (e: any) { console.log('DASH ERR', e.message.split('\n')[0]); }
  await goTo(page, '/'); await page.keyboard.press('Meta+k'); await page.waitForTimeout(500); console.log('CMDK FIELDS:', await ctrls(page));
  await page.keyboard.press('Escape'); await page.locator('body').click({ position: { x: 5, y: 5 } }); await page.keyboard.press('Shift+?'); await page.waitForTimeout(500); console.log('SHORTCUTS visible:', (await page.locator('body').innerText()).match(/keyboard shortcuts[\s\S]{0,80}/i)?.[0]?.replace(/\n/g, ' '));
});
