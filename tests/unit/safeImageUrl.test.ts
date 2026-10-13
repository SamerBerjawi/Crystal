import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeImageSrcAttr } from '../../utils/safeImageUrl';

test('http(s) and data:image URLs pass; the value is attribute-safe', () => {
  assert.equal(safeImageSrcAttr('https://cdn.brandfetch.io/netflix.com?c=abc&w=96'), 'https://cdn.brandfetch.io/netflix.com?c=abc&amp;w=96');
  assert.ok(safeImageSrcAttr('data:image/png;base64,AAAA'));
  assert.ok(safeImageSrcAttr('  http://example.com/a.png '));
});

test('attribute break-outs and script/data URLs are rejected or neutralised', () => {
  assert.equal(safeImageSrcAttr('javascript:alert(1)'), null);
  assert.equal(safeImageSrcAttr('data:text/html;base64,PHNjcmlwdD4='), null);
  assert.equal(safeImageSrcAttr('vbscript:x'), null);
  assert.equal(safeImageSrcAttr(''), null);
  assert.equal(safeImageSrcAttr(undefined), null);
  const broken = safeImageSrcAttr('https://x.test/a" onerror="alert(1)');
  assert.ok(broken === null || !/"/.test(broken), 'no raw double quote may survive: ' + broken);
  assert.ok(!/onerror="/.test(String(broken)));
});
