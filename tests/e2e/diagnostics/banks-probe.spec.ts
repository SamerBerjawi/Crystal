import { test, goTo } from '../fixtures/test';
test('find banks probe', async ({ authedPage: page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 768);
  const reqs: string[] = [];
  page.on('request', r => { if (r.url().includes('enable-banking')) reqs.push(r.method() + ' ' + r.url().split('/api/')[1] + ' ' + (r.postData() || '').slice(0, 80)); });
  await page.route('**/api/enable-banking/aspsps', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ name: 'QA Test Bank', country: 'FI' }]) }));
  await goTo(page, '/integrations');
  await page.getByPlaceholder('app_xxxxxxxx').fill('app_qa_test');
  await page.locator('textarea').first().fill('-----BEGIN PRIVATE KEY-----\nQA\n-----END PRIVATE KEY-----');
  await page.getByRole('textbox', { name: 'Country code (2 letters)' }).fill('FI');
  await page.getByRole('button', { name: 'Find Banks' }).click();
  await page.waitForTimeout(2000);
  const selects = await page.locator('select').evaluateAll(ss => ss.map(s => (s as HTMLSelectElement).disabled + ':' + [...(s as HTMLSelectElement).options].map(o => o.text).slice(0, 5).join('/')));
  console.log('requests:', reqs.join(' || '));
  console.log('selects:', selects.join(' ## '));
  console.log('texts:', (await page.locator('main').innerText()).match(/(error|failed|unable|missing|required)[^\n]{0,80}/gi)?.slice(0, 5));
});
