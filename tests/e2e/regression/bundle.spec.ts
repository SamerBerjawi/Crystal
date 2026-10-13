/** AUD-16/17/39/64: the sign-in screen stays light and heavy libraries are not part of startup. */
import { test, expect } from '../fixtures/test';

test('sign-in loads a small, bounded set of scripts and preloads no charting/map libraries', async ({ page }) => {
  const scripts: { url: string; bytes: number }[] = [];
  page.on('response', async r => {
    if (r.request().resourceType() === 'script') {
      const body = await r.body().catch(() => Buffer.alloc(0));
      scripts.push({ url: r.url(), bytes: body.length });
    }
  });
  await page.goto('/');
  await expect(page.getByText('Welcome Back', { exact: true })).toBeVisible();
  await page.waitForTimeout(2500); // long enough for any idle-time route preloading to have started

  const html = await (await page.request.get('/')).text();
  expect(html, 'index.html must not modulepreload recharts or leaflet').not.toMatch(/modulepreload[^>]*(recharts|leaflet)/i);

  expect(scripts.length, `scripts loaded on the sign-in page: ${scripts.map(s => s.url.split('/').pop()).join(', ')}`).toBeLessThanOrEqual(10);
  const names = scripts.map(s => s.url.split('/').pop() || '');
  expect(names.filter(n => /recharts|leaflet|Dashboard|Transactions|Forecasting/i.test(n)), 'no page or charting chunks on the sign-in page').toEqual([]);

  const entry = scripts.find(s => /\/assets\/index-.*\.js$/.test(s.url));
  expect(entry, 'entry chunk was loaded').toBeTruthy();
  expect(entry!.bytes, 'entry chunk (raw) stays under 800 kB').toBeLessThan(800_000);
});
