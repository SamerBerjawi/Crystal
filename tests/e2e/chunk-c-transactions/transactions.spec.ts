/**
 * Chunk C — Transactions & categorization (inventory workflows W16–W23).
 */
import { test, expect, goTo, isMobile, serverData, waitForSave, openBug } from '../fixtures/test';
import type { Page } from '@playwright/test';

const txByMerchant = async (user: any, m: string) => (await serverData(user)).transactions.filter((t: any) => t.merchant === m);

async function openAdd(page: Page) {
  await goTo(page, '/transactions');
  await page.getByRole('button', { name: /add transaction/i }).first().click();
  await expect(page.getByPlaceholder('0.00')).toBeVisible();
}

async function fillTx(page: Page, f: { amount?: string; merchant?: string; desc?: string; category?: boolean }) {
  if (f.amount !== undefined) await page.getByPlaceholder('0.00').fill(f.amount);
  if (f.merchant !== undefined) await page.getByPlaceholder(/shop, company or person/i).fill(f.merchant);
  if (f.desc !== undefined) await page.getByLabel(/description/i).fill(f.desc);
  if (f.category !== false) {
    const suggestion = page.getByRole('group', { name: 'Suggested categories' }).getByRole('button').first();
    if (await suggestion.isVisible()) {
      await suggestion.click();
    } else {
      const catInput = page.getByRole('combobox', { name: /^category$/i });
      if (await catInput.isVisible()) {
        const toggleBtn = catInput.locator('..').getByRole('button', { name: /Show options/i });
        if (await toggleBtn.isVisible()) {
          await toggleBtn.click();
        } else {
          await catInput.click();
          await catInput.press('ArrowDown');
        }
        await page.getByRole('option').first().click();
      }
    }
  }
}

const confirmTx = (page: Page) => page.getByRole('button', { name: /save transaction|save changes/i });

async function rowMenu(page: Page, text: string, item: RegExp) {
  await page.locator('main').getByRole('row').filter({ hasText: text }).first().click({ button: 'right' });
  await page.getByRole('menuitem', { name: item }).or(page.getByRole('button', { name: item })).first().click();
}

test.describe('W16 Add / edit / delete transaction', () => {
  test('add (happy path) is saved with the right sign and amount', async ({ authedPage: page, user }) => {
    await openAdd(page);
    await fillTx(page, { amount: '42.10', merchant: 'QA Shop', desc: 'QA purchase' });
    const saved = waitForSave(page);
    await confirmTx(page).click();
    expect((await saved).status()).toBe(200);
    const tx = await txByMerchant(user, 'QA Shop');
    expect(tx.length).toBe(1);
    expect(tx[0].amount).toBeCloseTo(-42.1, 2);
  });

  test('missing amount is rejected', async ({ authedPage: page, user }) => {
    await openAdd(page);
    await fillTx(page, { merchant: 'QA NoAmount', desc: 'x' });
    await confirmTx(page).click();
    await page.waitForTimeout(2500);
    expect((await txByMerchant(user, 'QA NoAmount')).length).toBe(0);
  });

  test('double-clicking Confirm creates one transaction', async ({ authedPage: page, user }) => {
    await openAdd(page);
    await fillTx(page, { amount: '9.99', merchant: 'QA Double', desc: 'dbl' });
    await confirmTx(page).dblclick();
    await page.waitForTimeout(3000);
    expect((await txByMerchant(user, 'QA Double')).length).toBe(1);
  });

  test('very long description (1000 chars) is saved and the list does not overflow', async ({ authedPage: page, user }) => {
    await openAdd(page);
    await fillTx(page, { amount: '1', merchant: 'QA Long', desc: 'L'.repeat(1000) });
    await confirmTx(page).click();
    await page.waitForTimeout(2500);
    expect((await txByMerchant(user, 'QA Long'))[0]?.description?.length).toBe(1000);
    expect(await page.locator('main').evaluate(m => m.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  });

  test('"n" keyboard shortcut opens quick add', async ({ authedPage: page }) => {
    test.skip(isMobile(page), 'keyboard shortcut');
    await goTo(page, '/');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('n');
    await expect(page.getByPlaceholder('0.00')).toBeVisible();
  });

  test('edit a transaction (merchant) persists', async ({ authedPage: page, user }) => {
    test.skip(isMobile(page), 'mobile edit covered by swipe row; see mobile test');
    await goTo(page, '/transactions');
    await rowMenu(page, 'Netflix', /edit/i);
    await page.getByPlaceholder(/shop, company or person/i).fill('Netflix QA');
    const saved = waitForSave(page);
    await page.getByRole('button', { name: /save transaction|save changes|save/i }).last().click();
    expect((await saved).status()).toBe(200);
    expect((await txByMerchant(user, 'Netflix QA')).length).toBe(1);
  });

  test('delete a transaction (with confirmation)', async ({ authedPage: page, user }) => {
    test.skip(isMobile(page), 'desktop context menu');
    await goTo(page, '/transactions');
    await rowMenu(page, 'Spotify', /delete/i);
    const holdBtn = page.getByRole('dialog', { name: /delete 1 transaction/i }).getByRole('button', { name: /hold to delete/i });
    await expect(holdBtn).toBeVisible();
    const box = (await holdBtn.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const saved = waitForSave(page);
    await page.mouse.down();
    await page.waitForTimeout(1500);
    await page.mouse.up();
    expect((await saved).status()).toBe(200);
    expect((await txByMerchant(user, 'Spotify')).length).toBe(0);
  });

  test('mobile: transaction list renders seeded rows and filter chips work', async ({ authedPage: page }) => {
    test.skip(!isMobile(page), 'mobile only');
    await goTo(page, '/transactions');
    await expect(page.locator('main')).toContainText('Netflix');
    await page.getByRole('button', { name: /filter/i }).first().click();
    await page.getByRole('radiogroup', { name: 'Show' }).locator('label').filter({ hasText: 'Income' }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('main')).toContainText('Crystal Analytics');
    await expect(page.locator('main')).not.toContainText('Netflix');
  });

  test('mobile: edit a transaction from the list persists', async ({ authedPage: page, user }) => {
    test.skip(!isMobile(page), 'mobile only');
    await goTo(page, '/transactions');
    await page.locator('main').getByText('Netflix').first().click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /^edit$/i }).or(page.getByText(/^edit$/i)).first().click();
    await page.getByPlaceholder(/shop, company or person/i).fill('Netflix QA');
    const saved = waitForSave(page);
    await page.getByRole('button', { name: /save transaction|save changes|save/i }).last().click();
    expect((await saved).status()).toBe(200);
    expect((await txByMerchant(user, 'Netflix QA')).length).toBe(1);
  });

  test('mobile: delete a transaction from the list', async ({ authedPage: page, user }) => {
    test.skip(!isMobile(page), 'mobile only');
    test.skip(true, 'Blocked — mobile delete is only a swipe-left gesture (SwipeableRow); neither pointer drags nor CDP touch events revealed it in headless Chromium.');
    await goTo(page, '/transactions');
    // Mobile delete is a swipe-left action on the row (SwipeableRow); the detail sheet has no Delete.
    const row = page.locator('main').getByText('Spotify').first();
    const box = (await row.boundingBox())!;
    const y = box.y + box.height / 2;
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: string, x: number) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] } as any);
    await touch('touchStart', 330);
    for (const x of [310, 280, 250, 220, 190, 160, 130]) { await touch('touchMove', x); await page.waitForTimeout(16); }
    await touch('touchEnd', 130);
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /^delete$/i }).first().click();
    const confirm = page.getByRole('button', { name: /^delete|confirm/i }).last();
    const saved = waitForSave(page);
    await confirm.click();
    expect((await saved).status()).toBe(200);
    expect((await txByMerchant(user, 'Spotify')).length).toBe(0);
  });
});

test.describe('W17 Bulk & advanced', () => {
  test.beforeEach(async ({ authedPage: page }) => { test.skip(isMobile(page), 'desktop table actions'); });

  test('split: amounts that do not add up are rejected', async ({ authedPage: page, user }) => {
    await goTo(page, '/transactions');
    await rowMenu(page, 'Netflix', /split/i);
    const amounts = page.getByRole('dialog').getByLabel('Amount');
    await amounts.nth(0).fill('5');
    await amounts.nth(1).fill('5');
    await expect(page.getByRole('button', { name: /^split$/i }), 'Split button must stay disabled until parts sum to the total').toBeDisabled();
  });

  test('split: valid split creates child parts and keeps the total', async ({ authedPage: page, user }) => {
    await goTo(page, '/transactions');
    await rowMenu(page, 'Netflix', /split/i);
    const dialog = page.getByRole('dialog');
    const amounts = dialog.getByLabel('Amount');
    await amounts.nth(0).fill('10');
    await amounts.nth(1).fill('9.99');
    const saved = waitForSave(page);
    await page.getByRole('button', { name: /^split$/i }).click();
    expect((await saved).status()).toBe(200);
    const d = await serverData(user);
    const parts = d.transactions.filter((t: any) => t.parentId === 'tx-streaming-netflix' || t.splitParentId === 'tx-streaming-netflix' || (t.merchant === 'Netflix' && t.id !== 'tx-streaming-netflix'));
    const total = parts.reduce((s: number, t: any) => s + t.amount, 0);
    expect(parts.length).toBe(2);
    expect(total).toBeCloseTo(-19.99, 2);
  });

  test('duplicate creates a copy', async ({ authedPage: page, user }) => {
    await goTo(page, '/transactions');
    await rowMenu(page, 'GitHub', /duplicate/i);
    await page.waitForTimeout(500);
    const confirm = page.getByRole('button', { name: /save transaction|save changes|save|duplicate/i }).last();
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    await page.waitForTimeout(2500);
    expect((await txByMerchant(user, 'GitHub')).length).toBe(2);
  });

  test('bulk categorize two transactions', async ({ authedPage: page, user }) => {
    await goTo(page, '/transactions');
    // The selection toolbar appears after the first tick and shifts the rows down, so wait for it before the next click.
    for (const [i, m] of ['Netflix', 'Spotify'].entries()) {
      await page.locator('main').getByRole('row').filter({ hasText: m }).first().getByRole('checkbox').click({ force: true });
      await expect(page.getByText(new RegExp(`^${i + 1} (item|items )?selected$`, 'i'))).toBeVisible();
      await page.waitForTimeout(400);
    }
    await page.getByRole('button', { name: /categorise|categorize/i }).click();
    const dialog = page.getByRole('dialog');
    const catInput = dialog.getByRole('combobox', { name: /category/i });
    await catInput.fill('Entertainment');
    await page.getByRole('option', { name: /Entertainment/i }).first().click();
    const saved = waitForSave(page);
    await dialog.getByRole('button', { name: /assign/i }).click();
    expect((await saved).status()).toBe(200);
    const d = await serverData(user);
    const cats = d.transactions.filter((t: any) => ['Netflix', 'Spotify'].includes(t.merchant)).map((t: any) => t.category);
    expect(new Set(cats).size).toBe(1);
    expect(cats[0]).not.toBe('Streaming Services');
  });
});

test.describe('W18 Filter & export', () => {
  test('search narrows the list; no-match shows an empty state', async ({ authedPage: page }) => {
    await goTo(page, '/transactions');
    const search = page.locator('main').getByPlaceholder(/search/i).first();
    await search.fill('Netflix');
    await page.waitForTimeout(800);
    await expect(page.locator('main')).toContainText('Netflix');
    await expect(page.locator('main')).not.toContainText('GreenMart');
    await search.fill('zzz-no-such-transaction');
    await page.waitForTimeout(800);
    await expect(page.locator('main')).toContainText(/no (transactions|results|matches)|nothing (found|matches)|reset|clear filters/i);
  });

  test('export downloads a CSV with the transactions', async ({ authedPage: page }) => {
    test.skip(isMobile(page), 'export button is desktop-only');
    await goTo(page, '/transactions');
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const file = await dl;
    expect(file.suggestedFilename()).toMatch(/\.csv$/);
    const body = await (await file.createReadStream())!.toArray().then(c => Buffer.concat(c).toString('utf8'));
    expect(body.split('\n').length).toBeGreaterThan(20);
    expect(body).toContain('Netflix');
  });
});

test.describe('W19 Pending matches', () => {
  test('an unmatched transfer pair is suggested and can be approved', async ({ authedPage: page, user }) => {
    test.skip(isMobile(page), 'desktop dashboard tab');
    const d = await serverData(user);
    const today = new Date().toISOString().slice(0, 10);
    const pair = [
      { id: 'qa-xfer-out', accountId: 'acc-checking', date: today, amount: -321.45, description: 'Transfer to savings', merchant: 'Own transfer', category: 'Transfer', type: 'expense', currency: 'EUR' },
      { id: 'qa-xfer-in', accountId: 'acc-savings', date: today, amount: 321.45, description: 'Transfer from checking', merchant: 'Own transfer', category: 'Transfer', type: 'income', currency: 'EUR' },
    ];
    expect((await user.api.post('/api/data', { data: { partial: true, data: { transactions: [...d.transactions, ...pair] } } })).status()).toBe(200);
    await goTo(page, '/');
    await page.getByRole('button', { name: /review matches/i }).first().click();
    const saved = waitForSave(page);
    await page.getByRole('button', { name: /match as transfer/i }).first().click();
    expect((await saved).status()).toBe(200);
    const after = (await serverData(user)).transactions.filter((t: any) => t.id.startsWith('qa-xfer'));
    expect(after.every((t: any) => t.transferId)).toBe(true);
  });
});

test.describe('W20 Categories', () => {
  test('add a category; empty name is rejected', async ({ authedPage: page, user }) => {
    await goTo(page, '/categories');
    await page.getByRole('button', { name: /new category/i }).click();
    await expect(page.getByRole('button', { name: /add category/i })).toBeDisabled();
    await page.getByLabel('Name').fill('QA Category');
    const saved = waitForSave(page);
    await page.getByRole('button', { name: /add category/i }).click();
    expect((await saved).status()).toBe(200);
    const d = await serverData(user);
    expect(d.expenseCategories.some((c: any) => c.name === 'QA Category')).toBe(true);
  });

  test('delete a category asks for confirmation and removes it', async ({ authedPage: page, user }) => {
    await goTo(page, '/categories');
    await page.getByRole('button', { name: 'More for Miscellaneous' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    const btn = page.getByRole('button', { name: 'Delete category' });
    await expect(btn).toBeVisible();
    await page.waitForTimeout(600);
    const onTop = await btn.evaluate(b => { const r = b.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!hit && (hit === b || b.contains(hit)); });
    expect(onTop, 'the confirmation button must be the top-most element (dialog not hidden behind page content)').toBe(true);
    const saved = waitForSave(page);
    await btn.click();
    expect((await saved).status()).toBe(200);
    expect((await serverData(user)).expenseCategories.some((c: any) => c.name === 'Miscellaneous')).toBe(false);
  });
});

test.describe('W21 Tags', () => {
  test('register a tag; it is saved', async ({ authedPage: page, user }) => {
    await goTo(page, '/tags');
    await page.getByRole('button', { name: 'New tag' }).click();
    const modal = page.locator('div.fixed').last();
    await modal.locator('input[type="text"]').first().fill('QA Tag');
    const saved = waitForSave(page);
    await modal.getByRole('button', { name: /save|create|register|add/i }).last().click();
    expect((await saved).status()).toBe(200);
    expect((await serverData(user)).tags.some((t: any) => t.name === 'QA Tag')).toBe(true);
  });

  test('tag cards expose named edit/delete actions', async ({ authedPage: page }) => {
    await goTo(page, '/tags');
    await expect(page.locator('main')).toContainText('Work');
    await expect(page.locator('main').getByRole('button', { name: /more for/i }).first()).toBeAttached();
  });
});

test.describe('W22 Rules', () => {
  test('create a rule (description contains Netflix → category) and apply to existing', async ({ authedPage: page, user }) => {
    await goTo(page, '/rules');
    await page.getByRole('button', { name: /new rule/i }).first().click();
    const sidePanel = page.getByRole('dialog');
    await sidePanel.getByLabel('Value').first().fill('Netflix');
    if (isMobile(page)) {
      await sidePanel.getByRole('button', { name: 'Next' }).click();
      await sidePanel.getByRole('button', { name: /^to$/i }).click();
      const option = page.getByRole('option', { name: /Entertainment/i }).first();
      await option.click();
    } else {
      const catInput = sidePanel.getByRole('combobox', { name: /^to$/i });
      const toggleBtn = catInput.locator('..').getByRole('button', { name: /Show options/i });
      if (await toggleBtn.isVisible()) {
        await toggleBtn.click();
      } else {
        await catInput.click();
        await catInput.press('ArrowDown');
      }
      const option = page.getByRole('option', { name: /Entertainment/i }).first();
      await option.click();
    }
    await sidePanel.getByLabel(/name \(optional\)/i).fill('QA Netflix rule');
    const saved = waitForSave(page);
    await sidePanel.getByRole('button', { name: /save rule/i }).click();
    expect((await saved).status()).toBe(200);
    await expect(page.locator('main')).toContainText(/When description contains Netflix|QA Netflix rule/i);
    const applyToast = page.getByRole('button', { name: /apply to/i });
    if (await applyToast.isVisible({ timeout: 5000 }).catch(() => false)) {
      await applyToast.click();
      await page.waitForTimeout(2000);
    }
    const tx = (await serverData(user)).transactions.find((t: any) => t.id === 'tx-streaming-netflix');
    expect(tx.category).toContain('Entertainment');
  });
});

test.describe('W23 Merchants', () => {
  test('merchants page lists seeded merchants and opens the detail configuration', async ({ authedPage: page }) => {
    await goTo(page, '/merchants');
    for (const m of ['Netflix', 'Spotify']) await expect(page.locator('main')).toContainText(m);
    await page.locator('main').getByRole('button', { name: /netflix/i }).first().click();
    await page.getByRole('button', { name: /edit/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('hide a merchant persists', async ({ authedPage: page, user }) => {
    await goTo(page, '/merchants');
    const before = JSON.stringify((await serverData(user)).preferences);
    await page.locator('main').getByRole('button', { name: /netflix/i }).first().click();
    await page.getByRole('button', { name: /actions for netflix/i }).click();
    const saved = waitForSave(page);
    await page.getByRole('menuitem', { name: /hide from lists/i }).click();
    expect((await saved).status()).toBe(200);
    expect(JSON.stringify((await serverData(user)).preferences)).not.toBe(before);
  });
});
