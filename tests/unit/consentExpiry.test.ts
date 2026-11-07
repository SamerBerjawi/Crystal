import test from 'node:test';
import assert from 'node:assert/strict';
import { describeConsentExpiry, getConsentExpiry } from '../../utils/consentExpiry';

const NOW = Date.parse('2026-06-01T12:00:00Z');
const inDays = (d: number) => new Date(NOW + d * 24 * 60 * 60 * 1000).toISOString();

test('getConsentExpiry stages by days left', () => {
  assert.equal(getConsentExpiry(undefined, NOW), null);
  assert.equal(getConsentExpiry('not a date', NOW), null);
  assert.equal(getConsentExpiry(inDays(30), NOW), null);
  assert.equal(getConsentExpiry(inDays(14), NOW)?.level, 'fortnight');
  assert.equal(getConsentExpiry(inDays(7), NOW)?.level, 'week');
  assert.equal(getConsentExpiry(inDays(0.5), NOW)?.level, 'last-day');
  assert.equal(getConsentExpiry(inDays(-1), NOW)?.level, 'expired');
});

test('describeConsentExpiry names the bank and the urgency', () => {
  assert.match(describeConsentExpiry('KBC', getConsentExpiry(inDays(5), NOW)!), /KBC access ends in 5 days/);
  assert.match(describeConsentExpiry('KBC', getConsentExpiry(inDays(-2), NOW)!), /has ended/);
});
