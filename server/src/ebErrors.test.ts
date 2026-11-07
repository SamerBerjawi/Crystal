import test from 'node:test';
import assert from 'node:assert/strict';
import { EnableBankingError, buildPsuHeaders, extractPsuHeaders, sanitizeRequiredPsuHeaders, parseErrorCode, parseRetryAfter, publicMessageFor, requiresReauthorization } from './ebErrors';

const req = (ip: string | undefined, ua?: string) => ({ ip, headers: { 'user-agent': ua } }) as any;

test('only session error codes require reauthorization', () => {
  for (const code of ['EXPIRED_SESSION', 'CLOSED_SESSION', 'REVOKED_SESSION', 'SESSION_DOES_NOT_EXIST']) {
    assert.equal(requiresReauthorization(new EnableBankingError(401, 'x', code)), true, code);
  }
  for (const [status, code] of [[401, 'UNAUTHORIZED_ACCESS'], [403, 'UNAUTHORIZED_IP'], [404, undefined], [429, 'ASPSP_RATE_LIMIT_EXCEEDED'], [422, 'PSU_HEADER_NOT_PROVIDED']] as const) {
    assert.equal(requiresReauthorization(new EnableBankingError(status, 'x', code)), false, `${status} ${code}`);
  }
});

test('parseErrorCode reads the error code from an Enable Banking body', () => {
  assert.equal(parseErrorCode(JSON.stringify({ code: 401, message: 'm', error: 'EXPIRED_SESSION' })), 'EXPIRED_SESSION');
  assert.equal(parseErrorCode('<html>bad gateway</html>'), undefined);
  assert.equal(parseErrorCode(JSON.stringify({ error: 'not a code!' })), undefined);
});

test('publicMessageFor prefers the error code and gives a real wait time for rate limits', () => {
  assert.match(publicMessageFor(429, 'ASPSP_RATE_LIMIT_EXCEEDED', 6 * 3600), /about 6 hours/);
  assert.match(publicMessageFor(401, 'EXPIRED_SESSION'), /Reconnect the bank/);
  assert.match(publicMessageFor(401, 'UNAUTHORIZED_ACCESS'), /application ID/);
  assert.match(publicMessageFor(500), /unavailable/);
});

test('parseRetryAfter accepts positive seconds and caps at a day', () => {
  assert.equal(parseRetryAfter('120'), 120);
  assert.equal(parseRetryAfter('999999'), 86400);
  assert.equal(parseRetryAfter('abc'), undefined);
  assert.equal(parseRetryAfter(null), undefined);
});

test('PSU headers are sent together or not at all', () => {
  assert.deepEqual(extractPsuHeaders(req('203.0.113.7', 'Mozilla/5.0')), { 'Psu-User-Agent': 'Mozilla/5.0', 'Psu-Ip-Address': '203.0.113.7' });
  assert.deepEqual(extractPsuHeaders(req('::ffff:203.0.113.7', 'UA')), { 'Psu-User-Agent': 'UA', 'Psu-Ip-Address': '203.0.113.7' });
  assert.deepEqual(extractPsuHeaders(req('127.0.0.1', 'UA')), {});
  assert.deepEqual(extractPsuHeaders(req('::1', 'UA')), {});
  assert.deepEqual(extractPsuHeaders(req('203.0.113.7', undefined)), {});
});

const full = (headers: Record<string, string>, ip = '203.0.113.7') => ({ ip, headers }) as any;

test('sanitizeRequiredPsuHeaders keeps known header names only', () => {
  assert.equal(sanitizeRequiredPsuHeaders(undefined), undefined);
  assert.equal(sanitizeRequiredPsuHeaders('Psu-Accept'), undefined);
  assert.deepEqual(sanitizeRequiredPsuHeaders([]), []);
  assert.deepEqual(sanitizeRequiredPsuHeaders(['psu-ip-address', 'PSU-ACCEPT', 'X-Evil', 'Psu-Ip-Address', 5]), ['Psu-Ip-Address', 'Psu-Accept']);
});

test('buildPsuHeaders sends every required header the server can supply, or none', () => {
  const browser = full({ 'user-agent': 'UA', accept: 'application/json', 'accept-language': 'nl-BE' });
  // No list: IP + user agent pair.
  assert.deepEqual(buildPsuHeaders(browser), { 'Psu-User-Agent': 'UA', 'Psu-Ip-Address': '203.0.113.7' });
  // Bank requires none: still the optional pair.
  assert.deepEqual(buildPsuHeaders(browser, []), { 'Psu-User-Agent': 'UA', 'Psu-Ip-Address': '203.0.113.7' });
  // Required headers all available.
  assert.deepEqual(buildPsuHeaders(browser, ['Psu-Ip-Address', 'Psu-Accept', 'Psu-Accept-Language']), {
    'Psu-User-Agent': 'UA', 'Psu-Ip-Address': '203.0.113.7', 'Psu-Accept': 'application/json', 'Psu-Accept-Language': 'nl-BE',
  });
  // One required header cannot be supplied (no geolocation, no referer): send none rather than a partial set.
  assert.deepEqual(buildPsuHeaders(browser, ['Psu-Ip-Address', 'Psu-Geo-Location']), {});
  assert.deepEqual(buildPsuHeaders(browser, ['Psu-Referer']), {});
  // Loopback has no real client IP.
  assert.deepEqual(buildPsuHeaders(full({ 'user-agent': 'UA' }, '127.0.0.1'), ['Psu-Ip-Address']), {});
});
