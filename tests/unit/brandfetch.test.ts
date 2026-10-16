import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMerchantLogoUrl } from '../../utils/brandfetch';

test('logo URLs are stable (cacheable) unless a refresh timestamp is supplied', () => {
  const a = getMerchantLogoUrl('netflix.com', 'client123', undefined);
  const b = getMerchantLogoUrl('netflix.com', 'client123', undefined);
  assert.ok(a);
  assert.equal(a, b);
  assert.ok(!/[?&]v=/.test(a!), 'no version parameter by default: ' + a);
  const refreshed = getMerchantLogoUrl('netflix.com', 'client123', undefined, { refreshTimestamp: 1760000000000 });
  assert.match(refreshed!, /[?&]v=1760000000000/);
});
