/**
 * Chunk A — Auth, session & persistence (inventory workflows W1–W10).
 */
import { test, expect, registerUser, newEmail, TEST_PASSWORD, watch, waitForSave, serverData, isMobile, goTo, expectSeededDashboard, signInScreen, SETTLE_MS, openBug } from '../fixtures/test';
import type { Page } from '@playwright/test';

async function openSignUp(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /sign up for free/i }).click();
  await expect(page.getByLabel('First Name')).toBeVisible();
}

async function fillSignUp(page: Page, f: { first?: string; last?: string; email?: string; password?: string }) {
  await page.getByLabel('First Name').fill(f.first ?? 'Qa');
  await page.getByLabel('Last Name').fill(f.last ?? 'Tester');
  await page.getByLabel('Email Address').fill(f.email ?? newEmail('ui'));
  await page.getByLabel('Password').fill(f.password ?? TEST_PASSWORD);
  await page.getByRole('button', { name: /create/i }).last().click();
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.locator('form button[type="submit"]').click();
}

async function openProfileMenuAndSignOut(page: Page) {
  if (isMobile(page)) {
    // On mobile the drawer (and Sign Out) is only reachable from pages that render the menu button, e.g. Settings.
    await goTo(page, '/settings');
    await page.getByRole('button', { name: 'Open navigation menu' }).first().click();
  }
  await page.locator('aside button:has(img)').last().click();
  await page.getByRole('button', { name: 'Sign Out' }).click();
}

const signInForm = signInScreen;

test.describe('W1 Sign up', () => {
  test('happy path: new account lands in app and onboarding opens', async ({ page }) => {
    const w = watch(page);
    await openSignUp(page);
    await fillSignUp(page, {});
    await expect(page.getByRole('heading', { name: /welcome, qa!/i })).toBeVisible({ timeout: 15_000 });
    expect(w.apiFailures.filter(f => !/(auth\/me|api\/data) -> 401/.test(f))).toEqual([]);
  });

  test('duplicate email shows a clear error', async ({ page, baseURL }) => {
    const existing = await registerUser(baseURL!, { seed: false });
    await openSignUp(page);
    await fillSignUp(page, { email: existing.email });
    await expect(page.getByText(/email already in use/i)).toBeVisible();
  });

  test('invalid email is blocked by the form', async ({ page }) => {
    await openSignUp(page);
    await fillSignUp(page, { email: 'not-an-email' });
    const valid = await page.getByLabel('Email Address').evaluate((e: HTMLInputElement) => e.checkValidity());
    expect(valid).toBe(false);
    await expect(page.getByLabel('First Name')).toBeVisible();
  });

  test('password shorter than the advertised "Min. 8 characters" is rejected', async ({ page, request }) => {
    const email = newEmail('short');
    await openSignUp(page);
    await expect(page.getByLabel('Password')).toHaveAttribute('placeholder', /min\. 8 characters/i);
    await fillSignUp(page, { email, password: 'a' });
    await page.waitForTimeout(3000);
    // Source of truth: was an account created with a 1-character password?
    const login = await request.post('/api/auth/login', { data: { email, password: 'a' } });
    expect(login.status(), 'an account with a 1-character password should not exist').toBe(401);
  });

  test('very long first name (300 chars) gives a specific validation message', async ({ page }) => {
    await openSignUp(page);
    let registerCalls = 0;
    page.on('request', r => { if (r.url().endsWith('/api/auth/register')) registerCalls++; });
    await fillSignUp(page, { first: 'A'.repeat(300) });
    await expect(page.getByText(/first name.*(too long|100|characters)/i)).toBeVisible({ timeout: 3000 });
    expect(registerCalls, 'client-side validation stops the request').toBe(0);
  });
});

test.describe('W2/W3 Sign in & session restore', () => {
  test('happy path: seeded user sees their data', async ({ page, user }) => {
    await signIn(page, user.email, user.password);
    await expectSeededDashboard(page);
  });

  test('wrong password shows "Invalid credentials"', async ({ page, user }) => {
    await signIn(page, user.email, 'wrong-password');
    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
    await expect(signInForm(page)).toBeVisible();
  });

  test('6th failed attempt is rate-limited with a clear message', async ({ page, user }) => {
    for (let i = 0; i < 5; i++) {
      await signIn(page, user.email, 'wrong-' + i);
      await expect(page.getByText(/invalid credentials/i)).toBeVisible();
    }
    await signIn(page, user.email, 'wrong-6');
    await expect(page.getByText(/too many sign-in attempts/i)).toBeVisible();
  });

  test('session survives a page refresh', async ({ authedPage: page }) => {
    await page.reload();
    await expectSeededDashboard(page);
    await expect(signInForm(page)).not.toBeVisible();
  });

  test('double-clicking Sign In creates only one session request', async ({ page, user }) => {
    let logins = 0;
    page.on('request', r => { if (r.url().endsWith('/api/auth/login')) logins++; });
    await page.goto('/');
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill(user.password);
    await page.locator('form button[type="submit"]').dblclick();
    await expectSeededDashboard(page);
    expect(logins).toBe(1);
  });

  test('transient 500 on /api/data during startup does not sign the user out', async ({ authedPage: page }) => {
    let failed = false;
    await page.route('**/api/data', async route => {
      if (route.request().method() === 'GET' && !failed) { failed = true; return route.fulfill({ status: 500, body: '{"message":"boom"}' }); }
      return route.continue();
    });
    await page.reload();
    await page.waitForTimeout(2500);
    await page.unroute('**/api/data');
    await page.reload();
    // Expected: still signed in after the blip.
    await expectSeededDashboard(page);
  });
});

test.describe('W4 Sign out', () => {
  test('sign out returns to sign-in and the session is gone after refresh and back', async ({ authedPage: page }) => {
    await openProfileMenuAndSignOut(page);
    await expect(signInForm(page)).toBeVisible();
    await page.reload();
    await expect(signInForm(page)).toBeVisible();
    await page.goBack().catch(() => {});
    await expect(page.locator('main')).toHaveCount(0);
    const me = await page.request.get('/api/auth/me');
    expect(me.status()).toBeGreaterThanOrEqual(401);
  });
});

test.describe('W4 Sign out (mobile reachability)', () => {
  test('mobile: Sign Out is reachable from the Dashboard', async ({ authedPage: page }) => {
    openBug('AUD-47');
    test.skip(!isMobile(page), 'mobile only');
    await goTo(page, '/');
    const viaMenu = await page.getByRole('button', { name: 'Open navigation menu' }).count();
    await page.getByRole('button', { name: /more navigation options/i }).click();
    const viaMore = await page.getByRole('button', { name: /sign out/i }).count();
    expect(viaMenu + viaMore, 'a mobile user on the Dashboard should have a path to Sign Out').toBeGreaterThan(0);
  });
});

test.describe('W5 Password reset', () => {
  test('"Forgot password?" starts a reset flow', async ({ page }) => {
    openBug('AUD-51');
    await page.goto('/');
    const before = page.url();
    await page.getByRole('button', { name: /forgot password/i }).click();
    await page.waitForTimeout(800);
    const changed = page.url() !== before || (await page.getByText(/reset|recover|send.*link/i).count()) > 0;
    expect(changed, 'clicking "Forgot password?" should do something').toBe(true);
  });
});

test.describe('W6 Change password', () => {
  async function openChange(page: Page) {
    await goTo(page, '/personal-info');
    await page.getByRole('button', { name: /rotate credentials/i }).click();
    await expect(page.getByLabel('Current Password')).toBeVisible();
  }

  test('mismatched confirmation is rejected client-side', async ({ authedPage: page }) => {
    test.fixme(isMobile(page), 'AUD-23 open: mobile nav covers the modal footer (hangs); audit/plan.md');
    await openChange(page);
    await page.getByLabel('Current Password').fill(TEST_PASSWORD);
    await page.getByLabel('New Password', { exact: true }).fill('NewPassw0rd!');
    await page.getByLabel('Confirm New Password').fill('Different1!');
    await page.getByRole('button', { name: /update password/i }).click();
    await expect(page.getByText(/do not match/i)).toBeVisible();
  });

  test('wrong current password shows an error', async ({ authedPage: page }) => {
    test.fixme(isMobile(page), 'AUD-23 open: mobile nav covers the modal footer (hangs); audit/plan.md');
    await openChange(page);
    await page.getByLabel('Current Password').fill('not-my-password');
    await page.getByLabel('New Password', { exact: true }).fill('NewPassw0rd!');
    await page.getByLabel('Confirm New Password').fill('NewPassw0rd!');
    await page.getByRole('button', { name: /update password/i }).click();
    await expect(page.getByText(/current password was incorrect/i)).toBeVisible();
  });

  test('happy path: user is signed out, new password works, old one does not', async ({ authedPage: page, user, browser }) => {
    test.fixme(isMobile(page), 'AUD-23 open: mobile nav covers the modal footer (hangs); audit/plan.md');
    await openChange(page);
    await page.getByLabel('Current Password').fill(TEST_PASSWORD);
    await page.getByLabel('New Password', { exact: true }).fill('NewPassw0rd!');
    await page.getByLabel('Confirm New Password').fill('NewPassw0rd!');
    await page.getByRole('button', { name: /update password/i }).click();
    await expect(signInForm(page)).toBeVisible({ timeout: 10_000 });
    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await signIn(p2, user.email, TEST_PASSWORD);
    await expect(p2.getByText(/invalid credentials/i)).toBeVisible();
    await signIn(p2, user.email, 'NewPassw0rd!');
    await expect(p2.locator('main')).toBeVisible({ timeout: 15_000 });
    await ctx.close();
  });
});

test.describe('W7 Edit profile', () => {
  test('profile changes persist on the server', async ({ authedPage: page, user }) => {
    await goTo(page, '/personal-info');
    page.once('dialog', d => d.accept());
    const first = page.getByLabel('Given Name');
    await first.fill('Renamed');
    const put = page.waitForResponse(r => r.url().endsWith('/api/users/me') && r.request().method() === 'PUT');
    await page.getByRole('button', { name: /commit changes/i }).click();
    expect((await put).status()).toBe(200);
    const me = await (await user.api.get('/api/auth/me')).json();
    expect(me.firstName).toBe('Renamed');
  });

  test('a failed profile save is reported to the user (not a success message)', async ({ authedPage: page }) => {
    await goTo(page, '/personal-info');
    await page.route('**/api/users/me', r => (r.request().method() === 'PUT' ? r.fulfill({ status: 500, body: '{"message":"db down"}' }) : r.continue()));
    await page.getByLabel('Given Name').fill('ShouldFail');
    await page.getByRole('button', { name: /commit changes/i }).click();
    await expect(page.getByText(/could not save your profile/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Profile updated', { exact: false })).toHaveCount(0);
  });
});

test.describe('W8 Demo mode', () => {
  test('demo mode loads demo data and never writes to the server', async ({ page }) => {
    const posts: string[] = [];
    page.on('request', r => { if (r.url().includes('/api/data') && r.method() === 'POST') posts.push(r.url()); });
    await page.goto('/');
    await page.getByRole('button', { name: /explore demo mode/i }).click();
    await expectSeededDashboard(page);
    await page.waitForTimeout(2000);
    expect(posts).toEqual([]);
  });
});

test.describe('W9 Onboarding', () => {
  test('new user can complete onboarding by skipping; it does not reappear on refresh', async ({ page }) => {
    await openSignUp(page);
    await fillSignUp(page, {});
    await expect(page.getByRole('heading', { name: /welcome, qa!/i })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /skip for now/i }).click();
    await expect(page.getByRole('heading', { name: /welcome, qa!/i })).not.toBeVisible();
    await page.reload();
    await page.waitForTimeout(1500);
    await expect(page.getByRole('heading', { name: /welcome, qa!/i })).not.toBeVisible();
  });

  test('onboarding completion follows the account to a new browser', async ({ page, browser, baseURL }) => {
    openBug('AUD-71');
    const email = newEmail('onb');
    await openSignUp(page);
    await fillSignUp(page, { email });
    await page.getByRole('button', { name: /skip for now/i }).click();
    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await signIn(p2, email, TEST_PASSWORD);
    await expect(p2.locator('main')).toBeVisible({ timeout: 15_000 });
    await p2.waitForTimeout(1500);
    await expect(p2.getByRole('heading', { name: /welcome, qa!/i })).not.toBeVisible();
    await ctx.close();
  });
});

test.describe('W10 Autosave & conflicts', () => {
  test('an edit made right after page load is saved (not silently dropped)', async ({ authedPage: page, user }) => {
    // Let the fixture page's own start-up save finish first; otherwise its (409-conflicting, AUD-04) save races ours.
    await page.waitForTimeout(2500);
    await goTo(page, '/preferences', false);
    const sw = page.getByRole('switch').first();
    await sw.waitFor();
    const before = (await serverData(user)).preferences?.excludeTransfersFromAnalytics ?? false;
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', String(!before));
    await page.waitForTimeout(4000);
    const after = (await serverData(user)).preferences?.excludeTransfersFromAnalytics ?? false;
    expect(after, 'UI shows the change; server must have it too').toBe(!before);
  });

  async function togglePrivacyPref(page: Page) {
    await goTo(page, '/preferences');
    const sw = page.getByRole('switch').first();
    await sw.scrollIntoViewIfNeeded();
    await sw.click();
    return sw;
  }

  test('an edit is saved to the server and survives refresh', async ({ authedPage: page, user }) => {
    const before = (await serverData(user)).preferences;
    const saved = waitForSave(page);
    await togglePrivacyPref(page);
    expect((await saved).status()).toBe(200);
    const after = (await serverData(user)).preferences;
    expect(JSON.stringify(after)).not.toBe(JSON.stringify(before));
  });

  test('a failed save (network down) is surfaced to the user', async ({ authedPage: page }) => {
    await page.route('**/api/data', r => (r.request().method() === 'POST' ? r.abort('internetdisconnected') : r.continue()));
    await togglePrivacyPref(page);
    await page.waitForTimeout(2500);
    await expect(page.getByText(/not saved|unsaved|offline|failed to save|couldn.t save|retry/i).first()).toBeVisible({ timeout: 3000 });
  });

  test('two tabs: a save that loses a race is merged on top of the other tab\'s version', async ({ authedPage: page, user, browser }, testInfo) => {
    const ctx2 = await browser.newContext({ ...testInfo.project.use, storageState: await user.api.storageState() });
    const tab2 = await ctx2.newPage();
    // Both tabs open the same page and settle; neither reloads afterwards.
    await goTo(page, '/preferences');
    await goTo(tab2, '/preferences');
    const initial = (await serverData(user)).preferences;
    const s1 = waitForSave(page);
    await page.getByRole('switch').first().click();
    expect((await s1).status()).toBe(200);
    // Tab 2 still holds the older version: its save is rejected once (409) and then re-applied on top.
    const statuses: number[] = [];
    tab2.on('response', r => { if (r.url().endsWith('/api/data') && r.request().method() === 'POST') statuses.push(r.status()); });
    await tab2.getByRole('switch').nth(1).click();
    await expect.poll(() => statuses.length, { timeout: 8000 }).toBeGreaterThanOrEqual(2);
    expect(statuses.slice(0, 2)).toEqual([409, 200]);
    await expect(tab2.getByText('Synced with changes from another device')).toBeVisible({ timeout: 5000 });
    // Neither edit was lost, on the server or on screen.
    const merged = (await serverData(user)).preferences;
    expect(merged.excludeTransfersFromAnalytics ?? false).toBe(!(initial.excludeTransfersFromAnalytics ?? false));
    expect(merged.showBalanceAdjustments ?? false).toBe(!(initial.showBalanceAdjustments ?? false));
    await ctx2.close();
  });

  test('session revoked elsewhere: the next edit prompts re-login instead of silently failing', async ({ authedPage: page, user }) => {
    await goTo(page, '/preferences');
    // Revoke this browser's session by changing the password via the API (revokes all sessions).
    const r = await user.api.post('/api/users/me/change-password', { data: { currentPassword: TEST_PASSWORD, newPassword: 'Another-Passw0rd!' } });
    expect(r.status()).toBe(200);
    const save = waitForSave(page);
    await page.getByRole('switch').first().click();
    expect((await save).status()).toBe(403);
    await expect(page.getByText(/sign in again|session expired|signed out|log in/i).first()).toBeVisible({ timeout: 3000 });
  });
});

test.describe('W10 Autosave — edits during and around saves (AUD-01)', () => {
  test('an edit made while a save is in flight is also saved', async ({ authedPage: page, user }) => {
    await goTo(page, '/preferences');
    const switches = page.getByRole('switch');
    const before = await serverData(user);
    const flagA = before.preferences?.excludeTransfersFromAnalytics ?? false;
    const flagB = before.preferences?.showBalanceAdjustments ?? false;

    // Hold the first save open so the second edit lands while it is in flight.
    let release!: () => void;
    const gate = new Promise<void>(r => { release = r; });
    let held = false;
    await page.route('**/api/data', async route => {
      if (route.request().method() === 'POST' && !held) { held = true; await gate; }
      await route.continue();
    });

    await switches.nth(0).click();
    await expect.poll(() => held, { timeout: 5000 }).toBe(true);
    await switches.nth(1).click();      // second edit while the first request is still open
    await page.waitForTimeout(1500);    // longer than the debounce
    release();

    await expect.poll(async () => {
      const d = await serverData(user);
      return [d.preferences?.excludeTransfersFromAnalytics ?? false, d.preferences?.showBalanceAdjustments ?? false];
    }, { timeout: 10_000 }).toEqual([!flagA, !flagB]);
  });

  test('an edit shortly after load, then a refresh, is not lost', async ({ authedPage: page, user }) => {
    await goTo(page, '/tasks', false);
    const before = (await serverData(user)).tasks.length;
    await page.getByRole('button', { name: 'New Task' }).first().click();
    await page.getByPlaceholder('Define mission goal...').fill('QA early edit');
    await page.getByRole('button', { name: /initialize objective/i }).click();
    await expect.poll(async () => (await serverData(user)).tasks.length, { timeout: 8000 }).toBe(before + 1);
  });

  test('closing the tab with unsaved edits sends them (small keepalive payload)', async ({ authedPage: page, user }) => {
    await goTo(page, '/tasks');
    const before = (await serverData(user)).tasks.length;
    await page.getByRole('button', { name: 'New Task' }).first().click();
    await page.getByPlaceholder('Define mission goal...').fill('QA unload edit');
    // Block the debounced autosave so only the unload handler can persist the change.
    await page.route('**/api/data', route => (route.request().method() === 'POST' && !route.request().headers()['x-keepalive-test'] ? route.fulfill({ status: 200, body: '{}' , contentType: 'application/json' }) : route.continue()));
    await page.getByRole('button', { name: /initialize objective/i }).click();
    await page.unroute('**/api/data');
    await page.evaluate(() => window.dispatchEvent(new Event('beforeunload', { cancelable: true })));
    await expect.poll(async () => (await serverData(user)).tasks.length, { timeout: 8000 }).toBe(before + 1);
  });
});
