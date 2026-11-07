import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRedirectUrl } from './ebRedirect';

test('configured redirect URL always wins', () => {
  assert.equal(resolveRedirectUrl({ configuredUrl: 'https://crystal.example/enable-banking/callback', protocol: 'http', host: 'evil.test' }), 'https://crystal.example/enable-banking/callback');
});

test('derives the redirect from forwarded headers or the request host', () => {
  assert.equal(resolveRedirectUrl({ protocol: 'http', host: 'localhost:3000' }), 'http://localhost:3000/enable-banking/callback');
  assert.equal(resolveRedirectUrl({ protocol: 'http', host: 'internal', forwardedProto: 'https, http', forwardedHost: 'crystal.example.com, proxy' }), 'https://crystal.example.com/enable-banking/callback');
});

test('rejects hosts and schemes that are not plain host[:port] / http(s)', () => {
  for (const host of ['evil.test/path', 'evil.test@good.test', 'a b.test', 'evil.test#x', 'evil.test?x=1', '']) {
    assert.equal(resolveRedirectUrl({ protocol: 'https', host }), null, host);
  }
  assert.equal(resolveRedirectUrl({ protocol: 'javascript', host: 'good.test' }), null);
  assert.equal(resolveRedirectUrl({ protocol: 'https', forwardedProto: 'ftp', host: 'good.test' }), null);
});
