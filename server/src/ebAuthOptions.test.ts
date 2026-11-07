import test from 'node:test';
import assert from 'node:assert/strict';
import { derivePsuId, sanitizeAuthMethod, sanitizeCredentials } from './ebAuthOptions';

test('sanitizeAuthMethod accepts plain method names only', () => {
  assert.equal(sanitizeAuthMethod(' Mobile ID '), 'Mobile ID');
  assert.equal(sanitizeAuthMethod('a/b'), undefined);
  assert.equal(sanitizeAuthMethod(''), undefined);
  assert.equal(sanitizeAuthMethod({ x: 1 }), undefined);
});

test('sanitizeCredentials needs an auth method and keeps only short string values', () => {
  assert.equal(sanitizeCredentials({ userId: 'abc' }, undefined), undefined);
  assert.deepEqual(sanitizeCredentials({ userId: ' abc ', bad: 5, 'x y': 'no', empty: '  ' }, 'Method'), { userId: 'abc' });
  assert.equal(sanitizeCredentials({ userId: 'x'.repeat(300) }, 'Method'), undefined);
  assert.equal(sanitizeCredentials(['a'], 'Method'), undefined);
});

test('derivePsuId is stable, opaque and per user', () => {
  assert.equal(derivePsuId(7), derivePsuId('7'));
  assert.notEqual(derivePsuId(7), derivePsuId(8));
  assert.match(derivePsuId(7), /^[0-9a-f]{32}$/);
});
