import { test, goTo, serverData } from '../fixtures/test';
test('wipe probe', async ({ authedPage: page, user }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 768);
  const posts: string[] = []; page.on('response', r => { if (r.url().endsWith('/api/data') && r.request().method() === 'POST') posts.push(`${r.status()} ${(r.request().postData() || '').slice(0, 60)}`); });
  const dialogs: string[] = []; page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  await goTo(page, '/data-management');
  await page.getByRole('button', { name: 'Execute Wipe' }).click(); await page.waitForTimeout(600);
  const btns1 = await page.locator('div.fixed button:visible').allInnerTexts(); console.log('STEP1 BTNS:', btns1.join(' | '));
  await page.locator('div.fixed button:visible').filter({ hasText: /confirm|wipe|reset|delete|continue|proceed/i }).last().click(); await page.waitForTimeout(700);
  await page.waitForTimeout(800);
  console.log('STEP2 overlay:', (await page.locator('div.fixed').last().innerText()).replace(/\n/g, ' ').slice(0, 260));
  console.log('STEP2 inputs:', await page.locator('div.fixed input:visible').count(), 'buttons:', (await page.locator('div.fixed button:visible').allInnerTexts()).join(' | '));
  const req = page.locator('div.fixed input:visible').last(); console.log('typed-confirm present:', await req.count());
  if (await req.count()) { await req.fill('DELETE'); await page.locator('div.fixed button:visible').filter({ hasText: /confirm|wipe|reset|delete|execute/i }).last().click(); }
  await page.waitForTimeout(5000);
  const d = await serverData(user);
  console.log('DIALOGS:', dialogs.join(' / '), '| POSTS:', posts.join(' || '), '| SERVER accounts:', d.accounts?.length);
  await page.goto('/accounts'); await page.waitForTimeout(3000);
  console.log('AFTER RELOAD UI has Everyday Checking?', /Everyday Checking|3,450/.test(await page.locator('body').innerText()));
});
