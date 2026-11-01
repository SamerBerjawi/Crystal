import test from 'node:test';
import assert from 'node:assert/strict';
import { convertCurrency, convertToMain, currencySign, formatCurrency, getMainCurrency, missingRates, setMainCurrency, updateConversionRates } from '../../utils';
import { ecbRatesFrom } from '../../src/services/exchangeRates';
import { CURRENCY_CODES, currenciesInUse, currencyDigits, currencyName, currencyOptions, currencyPreference, currencySymbol } from '../../utils/currencies';

test.afterEach(() => setMainCurrency('EUR'));

test('the list covers active currencies once each and leaves out retired ones', () => {
  assert.equal(new Set(CURRENCY_CODES).size, CURRENCY_CODES.length);
  assert.ok(CURRENCY_CODES.length > 150);
  for (const code of ['EUR', 'USD', 'JPY', 'KWD', 'BTC', 'RON', 'ZAR']) assert.ok(CURRENCY_CODES.includes(code), code);
  assert.ok(!CURRENCY_CODES.includes('DEM'));
});

test('decimals follow the currency', () => {
  assert.equal(currencyDigits('USD'), 2);
  assert.equal(currencyDigits('JPY'), 0);
  assert.equal(currencyDigits('KWD'), 3);
  assert.equal(currencyDigits('BTC'), 8);
  assert.equal(currencyDigits('NOPE'), 2);
});

test('symbols and names', () => {
  assert.equal(currencySymbol('EUR'), '€');
  assert.equal(currencySymbol('RON'), 'lei');
  assert.equal(currencySymbol('CAD'), 'C$');
  assert.equal(currencyName('JPY'), 'Japanese Yen');
  assert.equal(currencySign('JPY (¥)'), '¥');
  assert.equal(currencySign('INR'), '₹');
  assert.ok(currencyOptions().some(option => option.id === 'SEK' && option.label.includes('Swedish')));
});

test('saved main currency values stay readable', () => {
  assert.equal(currencyPreference('EUR'), 'EUR (€)');
  assert.equal(currencyPreference('RON'), 'RON (lei)');
  setMainCurrency('RON (lei)');
  assert.equal(getMainCurrency(), 'RON');
});

test('amounts format with the right symbol and decimals', () => {
  assert.equal(formatCurrency(1234.5, 'EUR'), '€1,234.50');
  assert.equal(formatCurrency(1234.5, 'JPY'), '¥1,235');
  assert.equal(formatCurrency(1.2345, 'KWD'), 'KWD 1.235'.replace('KWD ', currencySymbol('KWD') === 'KWD' ? 'KWD ' : currencySymbol('KWD')));
  assert.equal(formatCurrency(-12, 'CHF'), '-CHF 12.00');
  assert.equal(formatCurrency(0.5, 'BTC'), '0.50 BTC');
});

test('totals land in the main currency', () => {
  setMainCurrency('USD');
  const rates = { USD: 0.5, GBP: 1, EUR: 1 };
  assert.equal(convertToMain(10, 'USD', rates), 10);
  assert.equal(convertToMain(10, 'EUR', rates), 20);
  assert.equal(convertToMain(10, 'GBP', rates), 20);
  setMainCurrency('EUR');
  assert.equal(convertToMain(10, 'USD', rates), 5);
});

test('with no rate the amount stays out of totals, instead of a 1:1 guess', () => {
  assert.equal(convertCurrency(1000, 'XOF', 'EUR', { EUR: 1 }), 0);
  assert.equal(convertCurrency(1000, 'EUR', 'XOF', { EUR: 1 }), 0);
  assert.equal(convertCurrency(1000, 'XOF', 'XOF', { EUR: 1 }), 1000);
});

test('a partial rate table still finds rates known elsewhere', () => {
  updateConversionRates({ SEK: 0.09 });
  assert.equal(convertCurrency(100, 'SEK', 'EUR', { EUR: 1 }), 9);
});

test('missing rates lists what is in use and has no rate, without the main currency', () => {
  setMainCurrency('XAF');
  assert.deepEqual(missingRates(['EUR', 'XOF', 'XAF', 'xof', '', 'USD'], {}), ['XOF']);
});

test('currencies in use come from any list, once each', () => {
  assert.deepEqual(currenciesInUse([{ currency: 'usd' }, { currency: null }], [{ currency: 'EUR (€)' }, { currency: 'USD' }]), ['EUR', 'USD']);
});

test('ECB rates flip to the value in EUR of one unit, and bad ones are dropped', () => {
  assert.deepEqual(ecbRatesFrom({ rates: { USD: 2, GBP: 0.5, BAD: 0 } }), { EUR: 1, USD: 0.5, GBP: 2 });
  assert.deepEqual(ecbRatesFrom({}), { EUR: 1 });
});
