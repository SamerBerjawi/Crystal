import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPem, pemProblem } from '../../utils/pem';

test('classifyPem tells keys from certificates', () => {
  assert.equal(classifyPem(''), 'empty');
  assert.equal(classifyPem('-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----'), 'private-key');
  assert.equal(classifyPem('-----BEGIN RSA PRIVATE KEY-----\nabc'), 'private-key');
  assert.equal(classifyPem('-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----'), 'certificate');
  assert.equal(classifyPem('-----BEGIN ENCRYPTED PRIVATE KEY-----\nabc'), 'encrypted-private-key');
  assert.equal(classifyPem('-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----\n-----BEGIN PRIVATE KEY-----\nxyz'), 'private-key');
  assert.equal(classifyPem('hello'), 'unknown');
});

test('pemProblem explains what is wrong, and is null for a usable key', () => {
  assert.equal(pemProblem('-----BEGIN PRIVATE KEY-----\nabc'), null);
  assert.match(pemProblem('-----BEGIN CERTIFICATE-----\nabc')!, /certificate/i);
  assert.match(pemProblem('-----BEGIN ENCRYPTED PRIVATE KEY-----\nabc')!, /password/i);
  assert.match(pemProblem('nope')!, /PEM private key/);
  assert.match(pemProblem('  ')!, /Paste or choose/);
});
