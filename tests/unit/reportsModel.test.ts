import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Budget, Transaction } from '../../types';
import { automaticReports, budgetAgainstActual, buildReport, comparedWithUsual, daysBetween, monthEndForecast, monthsInPeriod, needsAndWants, recurringPatterns, reportInsights, reportTiles, unusualSpending, NO_FILTERS } from '../../utils/reportsModel';

let id = 0;
const spend = (date: string, amount: number, category = 'Groceries', merchant = 'Shop', extra: Partial<Transaction> = {}) =>
  ({ id: String(++id), date, amount: -amount, currency: 'EUR', category, merchant, description: merchant, type: 'expense', accountId: 'a', ...extra }) as Transaction;
const filters = (startDate: string, endDate: string, extra = {}) => ({ startDate, endDate, ...NO_FILTERS, ...extra });

test('comparisons cover the same category as the report', () => {
  const rows = [spend('2026-02-10', 100, 'Dining'), spend('2026-01-10', 50, 'Dining'), spend('2026-01-11', 900, 'Rent')];
  const report = buildReport(rows, [], filters('2026-02-01', '2026-02-28', { category: 'Dining' }), true, 'merchant', '2026-03-15');
  assert.equal(report.totalSpend, 100);
  assert.equal(report.previousSpend, 50);
  assert.equal(report.changePct, 100);
});

test('transfers never count, and balance adjustments follow the preference', () => {
  const rows = [spend('2026-02-10', 10), spend('2026-02-11', 20, 'Groceries', 'Shop', { transferId: 't' }), spend('2026-02-12', 40, 'Groceries', 'Shop', { isBalanceAdjustment: true })];
  assert.equal(buildReport(rows, [], filters('2026-02-01', '2026-02-28'), true, 'merchant', '2026-03-01').totalSpend, 50);
  assert.equal(buildReport(rows, [], filters('2026-02-01', '2026-02-28'), false, 'merchant', '2026-03-01').totalSpend, 10);
});

test('period length counts both ends across a clock change', () => {
  assert.equal(daysBetween('2026-03-01', '2026-03-31'), 31);
});

test('automatic reports cover the year so far and the recent months', () => {
  const reports = automaticReports('2026-10-15');
  assert.deepEqual(reports[0], { id: 'year', name: 'Year to date', startDate: '2026-01-01', endDate: '2026-10-15' });
  assert.equal(reports[1].name, 'October so far');
  assert.equal(reports[1].endDate, '2026-10-15');
  assert.deepEqual(reports[2], { id: 'month-1', name: 'September', startDate: '2026-09-01', endDate: '2026-09-30' });
  assert.equal(reports.length, 7);
});

test('the year to date follows a financial year that starts later', () => {
  assert.equal(automaticReports('2026-02-15', 4)[0].startDate, '2025-04-01');
  assert.equal(automaticReports('2026-05-15', 4)[0].startDate, '2026-04-01');
});

test('usual spending averages only the earlier periods that have spending', () => {
  const rows = [spend('2026-03-05', 150), spend('2026-02-05', 100), spend('2026-01-20', 50)];
  const scope = filters('2026-03-02', '2026-03-29');
  const usual = comparedWithUsual(rows.filter(tx => tx.date >= '2026-03-02'), rows, scope, true);
  assert.deepEqual(usual, [{ category: 'Groceries', spent: 150, usual: 75, difference: 75 }]);
});

test('usual spending is empty with no history', () => {
  assert.deepEqual(comparedWithUsual([spend('2026-03-05', 10)], [spend('2026-03-05', 10)], filters('2026-03-01', '2026-03-31'), true), []);
});

test('needs and wants come from category names', () => {
  const parts = needsAndWants([spend('2026-01-01', 60, 'Groceries'), spend('2026-01-02', 30, 'Dining Out'), spend('2026-01-03', 10, 'Misc')]);
  assert.deepEqual(parts.map(part => part.value), [60, 30, 10]);
});

test('whole months count as months, and other periods by days', () => {
  assert.equal(monthsInPeriod('2026-01-01', '2026-03-31'), 3);
  assert.equal(monthsInPeriod('2026-02-01', '2026-02-28'), 1);
  assert.ok(Math.abs(monthsInPeriod('2026-01-01', '2026-01-15') - 15 / 30.44) < 0.001);
});

test('a monthly budget scales to the period', () => {
  const budgets = [{ id: 'b', categoryName: 'Groceries', amount: 100, currency: 'EUR' }] as unknown as Budget[];
  const [row] = budgetAgainstActual([spend('2026-02-10', 250)], budgets, '2026-01-01', '2026-03-31');
  assert.equal(row.budgetEur, 300);
  assert.equal(row.varianceEur, 50);
});

test('repeat merchants are found by their gaps', () => {
  const rows = [spend('2026-01-01', 10, 'TV', 'Netflix'), spend('2026-02-01', 10, 'TV', 'Netflix'), spend('2026-03-01', 10, 'TV', 'Netflix'), spend('2026-01-03', 5, 'Food', 'Once')];
  assert.deepEqual(recurringPatterns(rows).map(row => [row.merchant, row.frequency, row.estimatedMonthlyEur]), [['Netflix', 'Monthly', 10]]);
});

test('unusual payments stand far above the rest, and need enough payments', () => {
  const rows = [...Array.from({ length: 9 }, (_, index) => spend(`2026-01-0${index + 1}`, 10)), spend('2026-01-10', 500)];
  assert.equal(unusualSpending(rows).length, 1);
  assert.equal(unusualSpending(rows.slice(5)).length, 0);
});

test('the forecast stops at today when a period ends later', () => {
  const forecast = monthEndForecast([spend('2026-04-05', 100)], filters('2026-04-01', '2026-04-30'), true, '2026-04-10');
  assert.equal(forecast.mtdSpendEur, 100);
  assert.equal(forecast.dailyAverage, 10);
  assert.equal(forecast.remainingDays, 20);
  assert.equal(forecast.projectedMonthEnd, 300);
});

test('an empty period still reads sensibly', () => {
  const report = buildReport([], [], filters('2026-02-01', '2026-02-28'), true, 'merchant', '2026-03-01');
  const tiles = reportTiles(report);
  assert.equal(tiles.summary.says, 'There is no spending in this period.');
  assert.equal(tiles.needs.value, 'None');
  assert.equal(reportInsights(report).length, 1);
});
