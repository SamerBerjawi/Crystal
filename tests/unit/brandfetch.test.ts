import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEffectiveMerchantLogoOverrides, findMerchantOverride, getMerchantLogoUrl } from '../../utils/brandfetch';

test('logo URLs are stable (cacheable) unless a refresh timestamp is supplied', () => {
  const a = getMerchantLogoUrl('netflix.com', 'client123', undefined);
  const b = getMerchantLogoUrl('netflix.com', 'client123', undefined);
  assert.ok(a);
  assert.equal(a, b);
  assert.ok(!/[?&]v=/.test(a!), 'no version parameter by default: ' + a);
  const refreshed = getMerchantLogoUrl('netflix.com', 'client123', undefined, { refreshTimestamp: 1760000000000 });
  assert.match(refreshed!, /[?&]v=1760000000000/);
});

test('buildEffectiveMerchantLogoOverrides merges merchantRules over legacy overrides', () => {
  const legacy = {
    carrefour: 'carrefour.fr',
    delhaize: 'delhaize.be',
  };
  const rules = {
    delhaize: { logo: 'delhaize.com' },
    starbucks: { logo: 'https://images.example.com/starbucks.png' },
  };
  const effective = buildEffectiveMerchantLogoOverrides(legacy, rules);
  assert.equal(effective.carrefour, 'carrefour.fr');
  assert.equal(effective.delhaize, 'delhaize.com');
  assert.equal(effective.starbucks, 'https://images.example.com/starbucks.png');
});

test('getMerchantLogoUrl follows logo configured in merchantRules/overrides across variations', () => {
  const overrides = {
    carrefour: 'https://images.example.com/carrefour.png',
    delhaize: 'delhaize.be',
  };

  // Direct match with custom image URL
  const customImg = getMerchantLogoUrl('Carrefour', 'client123', overrides);
  assert.equal(customImg, 'https://images.example.com/carrefour.png');

  // Multi-word transaction name matching rule key
  const variationImg = getMerchantLogoUrl('Carrefour Express Brussels', 'client123', overrides);
  assert.equal(variationImg, 'https://images.example.com/carrefour.png');

  // Domain override
  const domainUrl = getMerchantLogoUrl('Delhaize Supermarket', 'client123', overrides);
  assert.ok(domainUrl);
  assert.match(domainUrl!, /cdn\.brandfetch\.io\/delhaize\.be/);
});

test('getMerchantLogoUrl does not assume a logo or domain when unconfigured in merchants', () => {
  assert.equal(getMerchantLogoUrl('Carrefour Express', 'client123', undefined), null);
  assert.equal(getMerchantLogoUrl('Random Merchant', 'client123', {}), null);
  assert.equal(getMerchantLogoUrl('Bakery Shop', 'client123', { othermerchant: 'other.com' }), null);
});
