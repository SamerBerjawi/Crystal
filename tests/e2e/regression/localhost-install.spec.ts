/**
 * AUD-08 (REL-007, PERF-013): a production build opened on `localhost` is a normal install,
 * not a dev environment. Restoring a backup must not switch the app into demo mode, and later
 * edits must still be saved to the server.
 */
import { test, expect, registerUser, serverData, waitForSave, isMobile } from '../fixtures/test';
import { writeFileSync } from 'node:fs';

const LOCAL = 'http://localhost:4173';

test('restore on localhost keeps the account live; edits afterwards are saved', async ({ browser }, testInfo) => {
  const user = await registerUser(LOCAL, { tag: 'localhost' });
  const ctx = await browser.newContext({ ...testInfo.project.use, baseURL: LOCAL, storageState: await user.api.storageState() });
  const page = await ctx.newPage();

  const seeded = await serverData(user);
  const backup = testInfo.outputPath('backup.json');
  writeFileSync(backup, JSON.stringify({ tasks: seeded.tasks }));

  await page.goto('/data-management');
  await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await page.locator('input[type=file]').first().setInputFiles(backup);
  await page.waitForTimeout(600);
  const restoreSaved = waitForSave(page);
  await page.getByRole('button', { name: /restore selected data/i }).click({ timeout: 5000 }).catch(async () => {
    await page.getByRole('button', { name: /restore selected data/i }).click({ force: true });
  });
  expect((await restoreSaved).status()).toBe(200);

  // Edit something after the restore: it must reach the server (demo mode would drop it).
  await page.goto('/preferences');
  await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1800);
  const before = (await serverData(user)).preferences?.excludeTransfersFromAnalytics ?? false;
  const saved = waitForSave(page);
  await page.getByRole('switch').first().click();
  expect((await saved).status()).toBe(200);
  expect((await serverData(user)).preferences?.excludeTransfersFromAnalytics ?? false).toBe(!before);
  await ctx.close();
  await user.api.dispose();
});

test('a real account never shows the demo bank connections', async ({ authedPage: page }) => {
  await page.goto('/integrations');
  await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1500);
  await expect(page.getByRole('heading', { name: 'BNP Paribas Fortis' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Revolut Bank' })).toHaveCount(0);
});
