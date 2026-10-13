import { test as base, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const seed = JSON.parse(readFileSync(new URL('./seed.json', import.meta.url), 'utf8'));

/** Test-only credentials. Each test gets its own throwaway account on the local QA backend. */
export const TEST_PASSWORD = 'QaTest-Passw0rd!';
export const newEmail = (tag = 'user') => `qa-${tag}-${Date.now()}-${randomBytes(3).toString('hex')}@crystal.test`;

export type TestUser = { email: string; password: string; api: APIRequestContext };

export async function registerUser(baseURL: string, opts: { seed?: boolean; tag?: string } = {}): Promise<TestUser> {
  const api = await pwRequest.newContext({ baseURL });
  const email = newEmail(opts.tag);
  const res = await api.post('/api/auth/register', { data: { firstName: 'Qa', lastName: 'Tester', email, password: TEST_PASSWORD } });
  expect(res.status(), await res.text()).toBe(201);
  if (opts.seed !== false) {
    const save = await api.post('/api/data', { data: { ...seed, lastUpdatedAt: '2026-10-13 09:00:00' } });
    expect(save.status(), await save.text()).toBe(200);
  }
  return { email, password: TEST_PASSWORD, api };
}

/** Collects console errors and failed /api responses for assertions and bug reports. */
export function watch(page: Page) {
  const consoleErrors: string[] = [];
  const apiFailures: string[] = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message.slice(0, 200)));
  page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 400) apiFailures.push(`${r.request().method()} ${new URL(r.url()).pathname} -> ${r.status()}`); });
  return { consoleErrors, apiFailures };
}

/** Waits until the debounced autosave has flushed (900 ms debounce + request). */
export async function waitForSave(page: Page, timeout = 6000) {
  return page.waitForResponse(r => r.url().endsWith('/api/data') && r.request().method() === 'POST', { timeout });
}

export async function serverData(user: TestUser) {
  const r = await user.api.get('/api/data');
  return r.json();
}

type Fixtures = { user: TestUser; authedPage: Page; emptyUser: TestUser };

export const test = base.extend<Fixtures>({
  user: async ({ baseURL }, use) => {
    const u = await registerUser(baseURL!, { tag: 'seeded' });
    await use(u);
    await u.api.dispose();
  },
  emptyUser: async ({ baseURL }, use) => {
    const u = await registerUser(baseURL!, { seed: false, tag: 'empty' });
    await use(u);
    await u.api.dispose();
  },
  authedPage: async ({ browser, user }, use, testInfo) => {
    const state = await user.api.storageState();
    const ctx = await browser.newContext({ ...testInfo.project.use, storageState: state });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
    await use(page);
    await ctx.close();
  },
});

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768;

/**
 * The app ignores the first autosave pass after a data load (App.tsx skipNextSave), so edits
 * made in the first ~1s after a page load are dropped (bug QA-A-001). Tests that are not about
 * that bug wait for the app to settle before interacting.
 */
export const SETTLE_MS = 1500;

/** Full navigation to a route, then wait for the app shell and load to settle. */
export async function goTo(page: Page, path: string, settle = true) {
  await page.goto(path);
  await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
  if (settle) await page.waitForTimeout(SETTLE_MS);
}

/** In-app navigation (no reload), like clicking a nav item. */
export async function navigate(page: Page, path: string) {
  await page.evaluate(p => { history.pushState({}, '', p); dispatchEvent(new PopStateEvent('popstate')); }, path);
  await expect(page.locator('main')).toBeVisible();
  await page.waitForTimeout(600);
}

/** Dashboard is loaded with the seeded data (desktop and mobile dashboards word it differently). */
export async function expectSeededDashboard(page: Page) {
  await expect(page.locator('main')).toContainText(/net worth|net portfolio value/i, { timeout: 15_000 });
  await expect(page.locator('main')).toContainText('3,450.75');
}

export const signInScreen = (page: Page) => page.getByText('Welcome Back', { exact: true });

/**
 * Marks a test that documents a still-open audit finding (see audit/plan.md).
 * The test is expected to fail while the bug exists; when the fix lands the test passes,
 * Playwright reports "expected to fail but passed", and the annotation must be removed.
 */
export function openBug(id: string, condition = true) {
  test.fail(condition, `${id} open (audit/plan.md)`);
}

export { expect };
