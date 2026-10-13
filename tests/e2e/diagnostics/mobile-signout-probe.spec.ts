/** Diagnostic: where can a mobile user find "Sign Out"? */
import { test, goTo } from '../fixtures/test';

test('find a sign-out path on mobile', async ({ authedPage: page }) => {
  test.skip((page.viewportSize()?.width ?? 1440) >= 768, 'mobile only');
  const out: string[] = [];
  for (const path of ['/', '/accounts', '/transactions', '/settings', '/personal-info', '/preferences']) {
    await goTo(page, path);
    const menuBtn = page.getByRole('button', { name: 'Open navigation menu' });
    const signOutVisible = await page.getByRole('button', { name: 'Sign Out' }).isVisible().catch(() => false);
    out.push(`${path}: menuButton=${await menuBtn.count()} signOutVisible=${signOutVisible}`);
  }
  await goTo(page, '/');
  await page.getByRole('button', { name: /more navigation options/i }).click();
  await page.waitForTimeout(500);
  const sheet = await page.locator('body').innerText();
  out.push('More sheet mentions sign out/log out: ' + /sign out|log out|logout/i.test(sheet));
  await page.keyboard.press('Escape');
  await goTo(page, '/accounts');
  const menu = page.getByRole('button', { name: 'Open navigation menu' }).first();
  if (await menu.count()) {
    await menu.click(); await page.waitForTimeout(500);
    const avatar = page.locator('aside button:has(img)').last();
    out.push('drawer avatar visible=' + await avatar.isVisible());
    if (await avatar.isVisible()) { await avatar.click(); await page.waitForTimeout(300); out.push('Sign Out visible after avatar=' + await page.getByRole('button', { name: 'Sign Out' }).isVisible()); }
  }
  console.log(out.join('\n'));
});
