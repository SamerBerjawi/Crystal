import test from 'node:test';
import assert from 'node:assert/strict';
import { hasIdledOut, isValidPin, pinAfterKey, triesLeftMessage } from '../../utils/lockModel';

test('a PIN is exactly four digits', () => {
  assert.ok(isValidPin('0123'));
  assert.ok(!isValidPin('123'));
  assert.ok(!isValidPin('12345'));
  assert.ok(!isValidPin('12a4'));
});

test('idle time counts from the last activity, and zero means never', () => {
  const start = 1_000_000;
  assert.ok(!hasIdledOut(start, start + 14 * 60_000, 15));
  assert.ok(hasIdledOut(start, start + 15 * 60_000, 15));
  assert.ok(!hasIdledOut(start, start + 999 * 60_000, 0));
});

test('typing a PIN takes digits only and stops at four', () => {
  assert.equal(pinAfterKey('', '1'), '1');
  assert.equal(pinAfterKey('12', 'a'), '12');
  assert.equal(pinAfterKey('1234', '5'), '1234');
  assert.equal(pinAfterKey('123', 'Backspace'), '12');
  assert.equal(pinAfterKey('', 'Backspace'), '');
});

test('the warning reads naturally', () => {
  assert.equal(triesLeftMessage(1), 'Wrong PIN. 1 try left, then you’ll be signed out.');
  assert.equal(triesLeftMessage(3), 'Wrong PIN. 3 tries left, then you’ll be signed out.');
});
