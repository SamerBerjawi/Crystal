import { test, goTo, expect } from '../fixtures/test';
for (const name of ['Everyday Checking', 'Canal View Apartment', 'Tesla Model 3 LR']) {
  test(`detail buttons: ${name}`, async ({ authedPage: page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 768);
    await goTo(page, '/accounts');
    await page.locator('main').getByText(name, { exact: true }).first().click();
    await page.getByRole('button', { name: /full view/i }).first().click();
    await expect(page).toHaveURL(/accounts\//);
    await page.waitForTimeout(1200);
    const btns = await page.locator('main').getByRole('button').evaluateAll(bs => bs.map(b => (b.getAttribute('aria-label') || b.getAttribute('title') || (b as HTMLElement).innerText || '').trim().replace(/\s+/g, ' ')).filter(Boolean));
    console.log(name, '=>', [...new Set(btns)].slice(0, 30).join(' | '));
  });
}
