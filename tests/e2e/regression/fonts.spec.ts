/** AUD-40 (PERF-009): no third-party font requests until a non-default font is chosen. */
import { test, expect, registerUser, goTo } from '../fixtures/test';

test('the sign-in page and the app make no Google Fonts requests; choosing a font loads only then', async ({ browser, baseURL }, testInfo) => {
  const user = await registerUser(baseURL!, { tag: 'fonts' });
  const ctx = await browser.newContext({ ...testInfo.project.use, storageState: await user.api.storageState() });
  const page = await ctx.newPage();
  const fontRequests: string[] = [];
  page.on('request', r => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) fontRequests.push(r.url()); });
  // Keep the test hermetic: answer the font stylesheet locally.
  await page.route(/fonts\.googleapis\.com/, route => route.fulfill({ contentType: 'text/css', body: '/* stub */' }));

  const anon = await browser.newContext(testInfo.project.use);
  const anonPage = await anon.newPage();
  anonPage.on('request', r => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) fontRequests.push('signin:' + r.url()); });
  await anonPage.goto('/');
  await expect(anonPage.getByText('Welcome Back', { exact: true })).toBeVisible();
  await anonPage.waitForTimeout(1000);
  await anon.close();
  expect(fontRequests, 'sign-in page must not touch Google Fonts').toEqual([]);

  await goTo(page, '/');
  await page.waitForTimeout(500);
  expect(fontRequests, 'the dashboard with the default font must not touch Google Fonts').toEqual([]);

  await goTo(page, '/preferences');
  await page.waitForTimeout(800);
  expect(fontRequests.length, 'opening the font picker loads the previews on demand').toBeGreaterThan(0);
  await ctx.close();
  await user.api.dispose();
});
