import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChecklist, buildTaxSummary, summaryCsv, toCsv } from '../../utils/taxPack';
import { countryByCode, countryForCity, taxYearOf, taxYearRange } from '../../utils/taxCountries';
import type { InvestmentTransaction, Transaction } from '../../types';

let n = 0;
const tx = (date: string, category: string, amount: number, type: 'income' | 'expense', extra: Partial<Transaction> = {}): Transaction => ({
  id: `t${++n}`, accountId: 'a', date, description: category, amount, category, type, currency: 'EUR', ...extra,
});
const trade = (date: string, type: 'buy' | 'sell', quantity: number, price: number): InvestmentTransaction => ({ id: `i${++n}`, symbol: 'VWCE', name: 'World', quantity, price, date, type, currency: 'EUR' });
const toMain = (a: number) => a;
const BE = countryByCode('BE');

test('country comes from the city in Settings, with or without the country', () => {
  assert.equal(countryForCity('Brussels'), 'BE');
  assert.equal(countryForCity('  brüssel '), undefined);
  assert.equal(countryForCity('Springfield, Belgium'), 'BE');
  assert.equal(countryForCity('Beirut'), 'LB');
  assert.equal(countryForCity('Zürich'), 'CH');
  assert.equal(countryForCity(''), undefined);
  assert.equal(countryForCity('Atlantis'), undefined);
});

test('tax years follow the country, not always the calendar', () => {
  assert.deepEqual(taxYearRange(BE, 2025), { start: '2025-01-01', end: '2025-12-31', label: '2025' });
  assert.deepEqual(taxYearRange(countryByCode('GB'), 2025), { start: '2025-04-06', end: '2026-04-05', label: '2025/26' });
  assert.equal(taxYearOf(countryByCode('GB'), '2026-03-01'), 2025);
  assert.equal(taxYearOf(countryByCode('GB'), '2025-04-06'), 2025);
  assert.equal(taxYearOf(countryByCode('AU'), '2025-06-30'), 2024);
});

test('summary splits income, investment income and deductible spending, and skips transfers', () => {
  const s = buildTaxSummary({
    year: 2025, country: BE, toMain, investmentTransactions: [],
    transactions: [
      tx('2025-03-01', 'Salary', 3000, 'income'), tx('2025-04-01', 'Salary', 3000, 'income'),
      tx('2025-05-01', 'Dividends', 120.5, 'income'),
      tx('2025-06-01', 'Childcare', -200, 'expense'), tx('2025-06-02', 'Groceries', -50, 'expense'),
      tx('2025-06-03', 'Salary', 999, 'income', { transferId: 'x' }),
      tx('2024-12-31', 'Salary', 500, 'income'), tx('2026-01-01', 'Salary', 500, 'income'),
    ],
  });
  assert.equal(s.incomeTotal, 6000);
  assert.equal(s.income[0].count, 2);
  assert.equal(s.investmentIncomeTotal, 120.5);
  assert.equal(s.deductibleTotal, 200);
  assert.deepEqual(s.deductible.map(l => l.category), ['Childcare']);
});

test('sales use the average cost of what was held', () => {
  const s = buildTaxSummary({
    year: 2025, country: BE, toMain, transactions: [],
    investmentTransactions: [trade('2024-01-01', 'buy', 10, 100), trade('2024-06-01', 'buy', 10, 200), trade('2025-02-01', 'sell', 5, 300), trade('2026-02-01', 'sell', 5, 300)],
  });
  assert.equal(s.sales.length, 1);
  assert.equal(s.salesProceeds, 1500);
  assert.equal(s.sales[0].costBasis, 750);
  assert.equal(s.salesGain, 750);
});

test('checklist marks what is attached, missing and not needed', () => {
  const s = buildTaxSummary({ year: 2025, country: BE, toMain, investmentTransactions: [], transactions: [tx('2025-05-01', 'Dividends', 10, 'income')] });
  const rows = buildChecklist(BE, s, [{ checklistKey: 'income' }]);
  const by = (key: string) => rows.find(r => r.key === key)!;
  assert.equal(by('income').status, 'have');
  assert.equal(by('dividends').status, 'missing');
  assert.equal(by('brokerage').status, 'optional');
  assert.equal(by('childcare').status, 'optional');
});

test('CSV cells cannot run as formulas and quote what needs it', () => {
  assert.equal(toCsv([['=HYPERLINK("x")', 'a,b', 5]]), `'=HYPERLINK(""x"")",\"a,b\",5\n`.replace(`'=HYPERLINK(""x"")"`, `"'=HYPERLINK(""x"")"`));
  const s = buildTaxSummary({ year: 2025, country: BE, toMain, investmentTransactions: [], transactions: [] });
  assert.match(summaryCsv(s, BE, 'EUR'), /Tax year,2025/);
});
