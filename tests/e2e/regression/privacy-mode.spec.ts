/** AUD-73 (QA-F-010): with privacy mode on, no currency amount is readable on the main pages. */
import { test, expect, goTo, navigate } from '../fixtures/test';

test('privacy mode blurs every currency amount on the main pages', async ({ authedPage: page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440', 'the privacy toggle lives in the sidebar, which is desktop-only');
  await goTo(page, '/accounts');
  await page.getByRole('button', { name: /privacy mode/i }).filter({ visible: true }).first().click();
  await page.waitForTimeout(1200);

  const unblurred: string[] = [];
  for (const path of ['/accounts', '/', '/transactions', '/investments', '/budget', '/forecasting', '/subscriptions', '/schedule', '/merchants', '/reports']) {
    await navigate(page, path);
    await page.waitForTimeout(1200);
    const found = await page.locator('main').evaluate(main => {
      const out: string[] = [];
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      while ((n = walker.nextNode())) {
        const t = n.textContent || '';
        if (!/[€$£]\s?-?[\d,]+(\.\d{2})?/.test(t)) continue;
        let el: Element | null = n.parentElement;
        let blurred = false;
        while (el && el !== main.parentElement) {
          const f = getComputedStyle(el).filter;
          if (f && f.includes('blur')) { blurred = true; break; }
          el = el.parentElement;
        }
        if (!blurred) out.push(t.trim().slice(0, 30));
      }
      return out;
    });
    found.forEach(t => unblurred.push(`${path}: ${t}`));
  }
  expect(unblurred, 'amounts still readable in privacy mode').toEqual([]);
});
