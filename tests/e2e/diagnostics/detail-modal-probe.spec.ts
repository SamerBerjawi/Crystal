import { test, goTo, expect } from '../fixtures/test';
const cases: [string, string][] = [['Everyday Checking', '^Transaction$'], ['Canal View Apartment', '^Value Update$'], ['Tesla Model 3 LR', '^Add Log$']];
for (const [name, btn] of cases) {
  test(`modal: ${name} ${btn}`, async ({ authedPage: page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 768);
    await goTo(page, '/accounts');
    await page.locator('main').getByText(name, { exact: true }).first().click();
    await page.getByRole('button', { name: /full view/i }).first().click();
    await page.waitForTimeout(1000);
    await page.locator('main').getByRole('button', { name: new RegExp(btn, 'i') }).first().click();
    await page.waitForTimeout(800);
    const overlay = page.locator('div.fixed').filter({ has: page.locator('input') }).last();
    const ctrls = await overlay.locator('input,select,textarea,button').evaluateAll(es => es.map(e => `${e.tagName.toLowerCase()}[${(e as any).type || ''}] ${(e.getAttribute('aria-label') || e.getAttribute('placeholder') || e.getAttribute('name') || e.id || (e as HTMLElement).innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40)}`));
    console.log(name, btn, '=>', ctrls.slice(0, 40).join(' | '));
  });
}
