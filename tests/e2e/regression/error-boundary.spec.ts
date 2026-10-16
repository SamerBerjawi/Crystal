/** AUD-34 (REL-011): a page that crashes must not take every other page down with it. */
import { test, expect, goTo, navigate } from '../fixtures/test';

test('after a page crash, navigating to another page renders it (no reload needed)', async ({ authedPage: page }) => {
  // Serve a blob with a structurally wrong value; the Tasks page cannot render it.
  await page.route('**/api/data', async route => {
    if (route.request().method() !== 'GET') return route.continue();
    const res = await route.fetch();
    const body = await res.json();
    body.tasks = 'not-a-list';
    body.taskOrder = 'not-a-list';
    await route.fulfill({ response: res, json: body });
  });
  await goTo(page, '/tasks');
  await expect(page.getByText('Something went wrong')).toBeVisible({ timeout: 10_000 });

  await navigate(page, '/dashboard');
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  await expect(page.locator('main')).toContainText(/net worth|net portfolio value/i, { timeout: 10_000 });
});
