/**
 * Diagnostic: is an edit made right after page load persisted?
 * Logs every /api/data request so the save pipeline can be observed directly.
 */
import { test, expect, serverData } from '../fixtures/test';

for (const delay of [0, 300, 1000, 2500]) {
  test(`edit ${delay}ms after load is persisted`, async ({ authedPage: page, user }) => {
    const log: string[] = [];
    const t0 = Date.now();
    page.on('request', r => { if (r.url().endsWith('/api/data') && r.method() === 'POST') log.push(`${Date.now() - t0}ms POST`); });
    page.on('response', r => { if (r.url().endsWith('/api/data') && r.request().method() === 'POST') log.push(`${Date.now() - t0}ms <- ${r.status()}`); });
    const before = (await serverData(user)).preferences?.excludeTransfersFromAnalytics ?? false;
    await page.goto('/preferences');
    const sw = page.getByRole('switch').first();
    await sw.waitFor();
    await page.waitForTimeout(delay);
    log.push(`${Date.now() - t0}ms click (ui aria-checked before=${await sw.getAttribute('aria-checked')})`);
    await sw.click();
    log.push(`${Date.now() - t0}ms ui aria-checked after=${await sw.getAttribute('aria-checked')}`);
    await page.waitForTimeout(4500);
    const after = (await serverData(user)).preferences?.excludeTransfersFromAnalytics ?? false;
    console.log(`delay=${delay}: server before=${before} after=${after}\n  ` + log.join('\n  '));
    expect(after, 'server value should flip after the edit').toBe(!before);
  });
}
