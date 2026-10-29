import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCurrencyAmount, toProperCase } from '../../components/bklit/charts/chart-formatters';

test('toProperCase formats chart keys and legend labels to Proper Case', () => {
  // camelCase series keys
  assert.equal(toProperCase('netWorth'), 'Net Worth');
  assert.equal(toProperCase('balance'), 'Balance');
  assert.equal(toProperCase('dailyAvg'), 'Daily Avg');
  assert.equal(toProperCase('monthlyIncome'), 'Monthly Income');
  assert.equal(toProperCase('monthlyContributions'), 'Monthly Contributions');
  assert.equal(toProperCase('annualizedReturnPct'), 'Annualized Return Pct');
  assert.equal(toProperCase('pricePerSqMeter'), 'Price Per Sq Meter');
  assert.equal(toProperCase('desktop'), 'Desktop');
  assert.equal(toProperCase('mobile'), 'Mobile');

  // snake_case and kebab-case
  assert.equal(toProperCase('loan_balance'), 'Loan Balance');
  assert.equal(toProperCase('cost-per-km'), 'Cost Per Km');
  assert.equal(toProperCase('total_equity'), 'Total Equity');

  // Already Proper Case / spaced
  assert.equal(toProperCase('Net Worth'), 'Net Worth');
  assert.equal(toProperCase('Total Balance'), 'Total Balance');

  // Financial and technical uppercase acronyms preserved
  assert.equal(toProperCase('USD'), 'USD');
  assert.equal(toProperCase('EUR'), 'EUR');
  assert.equal(toProperCase('currentLTV'), 'Current LTV');
  assert.equal(toProperCase('estimatedAPY'), 'Estimated APY');

  // Empty / nullish
  assert.equal(toProperCase(''), '');
});

test('formatCurrencyAmount splits amounts into split-weight components', () => {
  // Standard EUR
  const eur = formatCurrencyAmount(12345.67, 'EUR');
  assert.equal(eur.symbol, '€');
  assert.equal(eur.digits, '12,345');
  assert.equal(eur.fraction, '.67');
  assert.equal(eur.sign, '');

  // Negative USD
  const usd = formatCurrencyAmount(-450.5, 'USD');
  assert.equal(usd.symbol, '$');
  assert.equal(usd.digits, '450');
  assert.equal(usd.fraction, '.50');
  assert.equal(usd.sign, '-');

  // Whole round amount GBP
  const gbp = formatCurrencyAmount(1000000, 'GBP');
  assert.equal(gbp.symbol, '£');
  assert.equal(gbp.digits, '1,000,000');
  assert.equal(gbp.fraction, '.00');

  // BTC crypto suffix
  const btc = formatCurrencyAmount(0.0452, 'BTC');
  assert.equal(btc.digits.includes('BTC'), true);
});

