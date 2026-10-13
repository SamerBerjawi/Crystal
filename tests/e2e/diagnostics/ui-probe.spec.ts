/**
 * Diagnostic: dump accessible snapshots of a page / opened modal to learn selectors.
 * Usage: PROBE='{"path":"/accounts","click":"Add Account"}' npx playwright test diagnostics/ui-probe --project=desktop-1440
 */
import { test, goTo } from '../fixtures/test';

test('ui probe', async ({ authedPage: page }) => {
  const cfg = JSON.parse(process.env.PROBE || '{"path":"/"}');
  await goTo(page, cfg.path);
  for (const step of cfg.steps || []) {
    if (step.click) await page.getByRole(step.role || 'button', { name: new RegExp(step.click, 'i') }).first().click();
    if (step.text) await page.getByText(new RegExp(step.text, 'i')).first().click({ button: step.button || 'left' });
    if (step.wait) await page.waitForTimeout(step.wait);
  }
  await page.waitForTimeout(600);
  const scope = cfg.scope ? page.locator(cfg.scope).last() : page.locator('body');
  const snap = await scope.ariaSnapshot();
  console.log(snap.split('\n').filter(l => !/^\s*- (img|generic)\s*$/.test(l)).slice(0, cfg.lines || 160).join('\n'));
});
