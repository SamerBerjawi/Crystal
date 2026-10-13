/** AUD-41 (UI-001): documented tokens reach the built CSS. */
import { test, expect } from '../fixtures/test';
import { existsSync } from 'node:fs';
import path from 'node:path';

test('the production stylesheet defines the z-index scale and text-3xs; the dead Tailwind config is gone', async ({ page }) => {
  await page.goto('/');
  const hrefs = await page.locator('link[rel="stylesheet"]').evaluateAll(links => links.map(l => (l as HTMLLinkElement).href).filter(h => h.includes('/assets/')));
  expect(hrefs.length).toBeGreaterThan(0);
  const css = (await Promise.all(hrefs.map(async h => (await page.request.get(h)).text()))).join('\n');
  for (const cls of ['.z-modal', '.z-dropdown', '.z-toast', '.z-max', '.text-3xs']) {
    expect(css, `${cls} has a rule`).toContain(cls);
  }
  expect(css).toMatch(/\.z-modal\{z-index:500\}/);
  expect(existsSync(path.resolve(process.cwd(), process.cwd().endsWith('e2e') ? '../../tailwind.config.js' : 'tailwind.config.js'))).toBe(false);
});
