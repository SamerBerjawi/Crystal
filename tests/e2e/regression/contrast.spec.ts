/** AUD-20/42 (UI-003/008): WCAG AA text contrast (axe color-contrast) on the main pages, light and dark. */
import AxeBuilder from '@axe-core/playwright';
import { test, expect, goTo } from '../fixtures/test';

const PAGES = ['/', '/accounts', '/transactions', '/budget', '/forecasting', '/investments', '/subscriptions', '/merchants', '/preferences', '/tasks'];

for (const scheme of ['light', 'dark'] as const) {
  for (const path of PAGES) {
    test(`color-contrast passes on ${path} (${scheme})`, async ({ authedPage: page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop-1440', 'contrast does not depend on the viewport; checked once');
      await page.emulateMedia({ colorScheme: scheme });
      await goTo(page, path);
      if (scheme === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark'));
      await page.waitForTimeout(1200);
      const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
      const summary = results.violations.flatMap(v => v.nodes.map(n => {
        const d = n.any[0]?.data as { contrastRatio?: number; fgColor?: string; bgColor?: string } | undefined;
        return `${d?.contrastRatio} ${d?.fgColor} on ${d?.bgColor}: ${n.html.slice(0, 110)}`;
      }));
      expect(summary, `contrast violations on ${path} (${scheme})`).toEqual([]);
    });
  }
}
