/** AUD-45 / AUD-66: no horizontal overflow at 375 px; interactive controls are at least 24x24 (WCAG 2.2 AA). */
import { test, expect, goTo } from '../fixtures/test';

const PAGES = ['/merchants', '/forecasting', '/challenges', '/integrations', '/preferences', '/personal-info', '/budget', '/accounts'];

for (const path of PAGES) {
  test(`${path}: no horizontal overflow and no tap target under 24 px`, async ({ authedPage: page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-375', 'mobile layout only');
    await goTo(page, path);
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const main = document.querySelector('main')!;
      const small: string[] = [];
      const sel = 'a[href],button,select,textarea,input:not([type=hidden]):not([type=checkbox]):not([type=radio]),[role=switch]';
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0 || getComputedStyle(el).visibility === 'hidden' || el.className.toString().includes('sr-only') || el.closest('[data-sonner-toaster]')) continue;
        if (b.width < 24 || b.height < 24) small.push(`${el.tagName.toLowerCase()} ${Math.round(b.width)}x${Math.round(b.height)} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)}"`);
      }
      return { scrollWidth: main.scrollWidth, small };
    });
    expect(r.scrollWidth, 'main must not scroll horizontally').toBeLessThanOrEqual(376);
    expect(r.small, 'interactive elements under 24x24').toEqual([]);
  });
}
