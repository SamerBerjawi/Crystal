import { test, goTo, serverData } from '../fixtures/test';
test('import + wipe probe', async ({ authedPage: page, user }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 768);
  const posts: string[] = []; page.on('response', r => { if (r.url().endsWith('/api/data') && r.request().method() === 'POST') posts.push(`${r.status()} ${(r.request().postData() || '').slice(0, 70)}`); });
  await goTo(page, '/data-management');
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.getByRole('button', { name: /transactions \(csv\)/i }).click();
  await page.locator('input[type=file]').first().setInputFiles('fixtures/files/eu-transactions.csv'); await page.waitForTimeout(1000);
  for (let i = 0; i < 8; i++) { const b = page.locator('div.fixed button:visible').filter({ hasText: /^(next step|publish|import|finish|confirm)/i }).last(); if (!(await b.count())) break; console.log('click:', await b.innerText()); await b.click(); await page.waitForTimeout(900); }
  await page.waitForTimeout(4000);
  const d = await serverData(user);
  const imp = d.transactions.filter((t: any) => String(t.importId || '').startsWith('imp-'));
  console.log('POSTS:', posts.join(' || '));
  console.log('SERVER imported:', JSON.stringify(imp.map((t: any) => ({ d: t.description, m: t.merchant, a: t.amount, acc: t.accountId }))));
  console.log('SERVER accounts named QA Import:', d.accounts.filter((a: any) => /QA Import/.test(a.name)).map((a: any) => a.id));
  console.log('UI transactions page has QA Coffee?', await (async () => { await page.evaluate(() => { history.pushState({}, '', '/transactions'); dispatchEvent(new PopStateEvent('popstate')); }); await page.waitForTimeout(1200); return /QA Coffee|QA Salary/.test(await page.locator('main').innerText()); })());
});
