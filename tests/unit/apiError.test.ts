import test from 'node:test';
import assert from 'node:assert/strict';
import { HTML_ERROR_MESSAGE, looksLikeHtml, parseApiError } from '../../utils/apiError';

test('an HTML error page from a proxy is never shown as the message', () => {
  const cloudflare = '<!DOCTYPE html> <!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->';
  assert.equal(looksLikeHtml(cloudflare), true);
  assert.equal(parseApiError(new Error(cloudflare)).message, HTML_ERROR_MESSAGE);
  assert.equal(parseApiError(new Error('<html><body>502 Bad Gateway</body></html>')).message, HTML_ERROR_MESSAGE);
});

test('a JSON body from our server keeps its message, code and flags', () => {
  const body = JSON.stringify({ message: 'Wait a while', errorCode: 'ASPSP_RATE_LIMIT_EXCEEDED', requiresReauth: false, retryAfterSeconds: 21600 });
  assert.deepEqual(parseApiError(new Error(body)), { message: 'Wait a while', errorCode: 'ASPSP_RATE_LIMIT_EXCEEDED', requiresReauth: false, retryAfterSeconds: 21600 });
});

test('plain text, empty and odd input fall back sensibly', () => {
  assert.equal(parseApiError(new Error('Unable to reach the server')).message, 'Unable to reach the server');
  assert.equal(parseApiError(new Error('x'.repeat(400))).message.length, 298);
  assert.equal(parseApiError(new Error(''), 'Fallback').message, 'Fallback');
  assert.equal(parseApiError(undefined, 'Fallback').message, 'Fallback');
  assert.equal(parseApiError(new Error('{"foo":1}'), 'Fallback').message, 'Fallback');
});
