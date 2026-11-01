import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultCategory, isUncategorised } from '../../utils/overviewSummary';

test('a transaction saved with no category goes to review, unless it is a transfer', () => {
  assert.equal(defaultCategory({ transferId: undefined }), 'Uncategorized');
  assert.equal(defaultCategory({ transferId: 'pair-1' }), 'Transfer');
  assert.ok(isUncategorised({ category: defaultCategory({}) } as any));
});
