import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toProperCase } from '../../src/components/charts/chart-formatters';

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
