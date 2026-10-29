import test from 'node:test';
import assert from 'node:assert/strict';
import { Account, Transaction } from '../../types';
import {
  accountsToCSV,
  computeAccount90dSparkline,
  computeAccountsHeroModel,
  computeCashSegmentNetFlow,
  computePortfolio90dNetWorthTrend,
  filterAccountsBySegment,
  filterAndSortAccounts,
  getVisibleAccountsForAccountsPage,
  groupAccountsByType,
  splitAssetsAndLiabilities,
} from '../../utils/accountsModel';

const assertClose = (actual: number, expected: number, tolerance = 0.05) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`
  );
};

test('BUG-01: keeps Pension Fund and Spare Change accounts visible on Accounts page while hiding market Investments', () => {
  const accounts: Account[] = [
    { id: '1', name: 'Main Checking', type: 'Checking', balance: 1200, currency: 'EUR' },
    { id: '2', name: 'S&P 500 ETF', type: 'Investment', subType: 'ETF', balance: 5000, currency: 'EUR' },
    { id: '3', name: 'Retirement Pension', type: 'Investment', subType: 'Pension Fund', balance: 25000, currency: 'EUR' },
    { id: '4', name: 'Round-up Vault', type: 'Investment', subType: 'Spare Change', balance: 145, currency: 'EUR' },
  ];

  const visible = getVisibleAccountsForAccountsPage(accounts);
  assert.deepEqual(
    visible.map((a) => a.id),
    ['1', '3', '4']
  );
});

test('BUG-02: backs out future-dated transactions from today balance before walking backward', () => {
  const account: Account = {
    id: 'acc-1',
    name: 'Checking',
    type: 'Checking',
    balance: 900, // Includes a -100 future transaction tomorrow
    currency: 'EUR',
  };
  const transactions: Transaction[] = [
    {
      id: 'tx-future',
      accountId: 'acc-1',
      date: '2026-06-20',
      description: 'Scheduled Rent',
      amount: -100,
      category: 'Housing',
      type: 'expense',
      currency: 'EUR',
    },
  ];

  const { sparklineData } = computeAccount90dSparkline(account, transactions, undefined, {
    referenceDate: new Date(2026, 5, 15),
  });

  // Today's real balance is 900 - (-100) = 1000
  assertClose(sparklineData[sparklineData.length - 1].value, 1000);
  assertClose(sparklineData[0].value, 1000);
});

test('BUG-03: preserves negative balances on Credit Card and Loan sparklines instead of clamping to 0', () => {
  const ccAccount: Account = {
    id: 'cc-1',
    name: 'Platinum Card',
    type: 'Credit Card',
    balance: -400,
    currency: 'EUR',
  };
  const transactions: Transaction[] = [
    {
      id: 'tx-pay',
      accountId: 'cc-1',
      date: '2026-06-10',
      description: 'Card Payment',
      amount: 200,
      category: 'Transfer',
      type: 'income',
      currency: 'EUR',
    },
  ];

  const { sparklineData, trend, trendPct, isPositiveTrend } = computeAccount90dSparkline(
    ccAccount,
    transactions,
    undefined,
    { referenceDate: new Date(2026, 5, 15) }
  );

  // 90 days ago balance was -600; today is -400
  assertClose(sparklineData[0].value, -600);
  assertClose(sparklineData[sparklineData.length - 1].value, -400);
  assertClose(trend, 200);
  assert.equal(trendPct !== null, true);
  assertClose(trendPct!, 33.3);
  assert.equal(isPositiveTrend, true);
});

test('BUG-04: reconstructs 90-day portfolio net worth respecting Property priceHistory and future txs', () => {
  const accounts: Account[] = [
    {
      id: 'prop-1',
      name: 'Home',
      type: 'Property',
      balance: 350000,
      purchasePrice: 300000,
      currency: 'EUR',
      priceHistory: [
        { date: '2026-01-01', price: 320000 },
        { date: '2026-06-01', price: 350000 },
      ],
    },
  ];

  const trend = computePortfolio90dNetWorthTrend(accounts, [], {}, {
    referenceDate: new Date(2026, 5, 15),
  });

  assertClose(trend[0].value, 320000);
  assertClose(trend[trend.length - 1].value, 350000);
});

test('BUG-05: computes Cash segment net flow over 30 days (not 90 days) and excludes internal transfers', () => {
  const cashAccounts: Account[] = [
    { id: 'c1', name: 'Checking', type: 'Checking', balance: 2000, currency: 'EUR' },
  ];
  const txs: Transaction[] = [
    {
      id: 'tx-10d',
      accountId: 'c1',
      date: '2026-06-05',
      description: 'Salary',
      amount: 500,
      category: 'Salary',
      type: 'income',
      currency: 'EUR',
    },
    {
      id: 'tx-60d',
      accountId: 'c1',
      date: '2026-04-10',
      description: 'Old Bonus (60 days ago)',
      amount: 1000,
      category: 'Bonus',
      type: 'income',
      currency: 'EUR',
    },
    {
      id: 'tx-transfer',
      accountId: 'c1',
      date: '2026-06-06',
      description: 'Transfer to Savings',
      amount: -200,
      category: 'Transfer',
      type: 'expense',
      transferId: 'tr-1',
      currency: 'EUR',
    },
  ];

  const netFlow30d = computeCashSegmentNetFlow(cashAccounts, txs, 30, {
    referenceDate: new Date(2026, 5, 15),
  });
  assertClose(netFlow30d, 500);
});

test('Phase 1 Balance-Sheet Cockpit: segments, hero solvency & attention items, sorting, and CSV export', () => {
  const accounts: Account[] = [
    { id: 'c1', name: 'Main Checking', type: 'Checking', balance: 4000, currency: 'EUR', isPrimary: true },
    { id: 's1', name: 'Idle Savings', type: 'Savings', balance: 6000, apy: 0, currency: 'EUR' },
    { id: 'p1', name: 'Pension Pot', type: 'Investment', subType: 'Pension Fund', balance: 20000, apy: 5, currency: 'EUR' },
    { id: 'cc1', name: 'High Util Card', type: 'Credit Card', balance: -1800, creditLimit: 2000, currency: 'EUR' },
    { id: 'cl1', name: 'Old Closed Account', type: 'Checking', balance: 0, currency: 'EUR', status: 'closed' },
  ];

  const visible = getVisibleAccountsForAccountsPage(accounts);
  assert.equal(filterAccountsBySegment(visible, 'cash').length, 1);
  assert.equal(filterAccountsBySegment(visible, 'savings_pension').length, 2);
  assert.equal(filterAccountsBySegment(visible, 'credit_cards').length, 1);
  assert.equal(filterAccountsBySegment(visible, 'closed').length, 1);

  const hero = computeAccountsHeroModel(accounts, [], {}, 'EUR', {
    referenceDate: new Date(2026, 5, 15),
  });
  assertClose(hero.totalAssets, 30000);
  assertClose(hero.totalLiabilities, 1800);
  assertClose(hero.netWorth, 28200);
  // High utilization CC (90%) + 0% APY Savings should surface in attentionItems
  assert.ok(hero.attentionItems.some((item) => item.accountId === 'cc1' && item.severity === 'danger'));
  assert.ok(hero.attentionItems.some((item) => item.accountId === 's1' && item.severity === 'info'));

  const { assets, liabilities } = splitAssetsAndLiabilities(filterAccountsBySegment(visible, 'all'));
  assert.equal(assets.length, 3);
  assert.equal(liabilities.length, 1);

  const sortedByBal = filterAndSortAccounts(
    filterAccountsBySegment(visible, 'all'),
    { c1: 4000, s1: 6000, p1: 20000, cc1: -1800 },
    { sortBy: 'balance' }
  );
  assert.equal(sortedByBal[0].id, 'p1');

  const csv = accountsToCSV(sortedByBal, { c1: 4000, s1: 6000, p1: 20000, cc1: -1800 }, 'EUR');
  assert.ok(csv.includes('Pension Pot'));
  assert.ok(csv.includes('High Util Card'));
});

test('institution filter keeps accounts from any of the chosen institutions; none chosen means all', () => {
  const accounts: Partial<Account>[] = [
    { id: 'a', name: 'A', type: 'Checking', balance: 1, currency: 'EUR', financialInstitution: 'KBC' },
    { id: 'b', name: 'B', type: 'Savings', balance: 2, currency: 'EUR', financialInstitution: 'ING' },
    { id: 'c', name: 'C', type: 'Checking', balance: 3, currency: 'EUR', financialInstitution: 'Revolut' },
    { id: 'd', name: 'D', type: 'Checking', balance: 4, currency: 'EUR' },
  ];
  const balances = { a: 1, b: 2, c: 3, d: 4 };
  const ids = (institutions?: string[]) =>
    filterAndSortAccounts(accounts as Account[], balances, { institutionFilter: institutions, sortBy: 'name' }).map((x) => x.id);
  assert.deepEqual(ids(), ['a', 'b', 'c', 'd']);
  assert.deepEqual(ids([]), ['a', 'b', 'c', 'd']);
  assert.deepEqual(ids(['KBC']), ['a']);
  assert.deepEqual(ids(['kbc', ' revolut ']), ['a', 'c'], 'case and spaces do not matter');
  assert.deepEqual(ids(['KBC', 'ING', 'Revolut']), ['a', 'b', 'c']);
});

test('groupAccountsByType: groups accounts into ordered type buckets with correct subtotals and modes', () => {
  const accounts: Partial<Account>[] = [
    { id: 'loan1', name: 'Home Mortgage', type: 'Loan', balance: -250000, currency: 'EUR' },
    { id: 'chk1', name: 'Daily Checking', type: 'Checking', balance: 2400, currency: 'EUR' },
    { id: 'cc1', name: 'Visa Gold', type: 'Credit Card', balance: -450, currency: 'EUR' },
    { id: 'sav1', name: 'Emergency Vault', type: 'Savings', balance: 15000, currency: 'EUR' },
    { id: 'voucher1', name: 'Edenred Card', type: 'Other Assets', otherSubType: 'Meal Voucher', balance: 320, currency: 'EUR' },
    { id: 'prop1', name: 'Main Residence', type: 'Property', balance: 400000, currency: 'EUR' },
    { id: 'veh1', name: 'Family Sedan', type: 'Vehicle', balance: 18000, currency: 'EUR' },
  ];

  // 1. Mode 'all': priority order checking -> credit_card -> savings -> meal_voucher -> loan -> property -> vehicle
  const allGroups = groupAccountsByType(accounts as Account[]);
  assert.deepEqual(
    allGroups.map((g) => g.key),
    ['checking', 'credit_card', 'savings', 'meal_voucher', 'loan', 'property', 'vehicle']
  );
  assert.equal(allGroups[0].subtotal, 2400);
  assert.equal(allGroups[1].subtotal, 450); // Debt subtotal as positive magnitude
  assert.equal(allGroups[2].subtotal, 15000);
  assert.equal(allGroups[3].subtotal, 320);
  assert.equal(allGroups[4].subtotal, 250000); // Loan debt magnitude

  // 2. Mode 'assets': only asset categories
  const assetGroups = groupAccountsByType(accounts as Account[], {}, undefined, 'assets');
  assert.deepEqual(
    assetGroups.map((g) => g.key),
    ['checking', 'savings', 'meal_voucher', 'property', 'vehicle']
  );
  assert.ok(assetGroups.every((g) => g.category === 'asset'));

  // 3. Mode 'liabilities': only liability categories
  const liabilityGroups = groupAccountsByType(accounts as Account[], {}, undefined, 'liabilities');
  assert.deepEqual(
    liabilityGroups.map((g) => g.key),
    ['credit_card', 'loan']
  );
  assert.ok(liabilityGroups.every((g) => g.category === 'liability'));

  // 4. Preserves intra-group sort order from input
  const multiAccounts: Partial<Account>[] = [
    { id: 'chk_b', name: 'Checking B', type: 'Checking', balance: 500, currency: 'EUR' },
    { id: 'chk_a', name: 'Checking A', type: 'Checking', balance: 1500, currency: 'EUR' },
  ];
  const multiGroups = groupAccountsByType(multiAccounts as Account[]);
  assert.equal(multiGroups[0].accounts[0].id, 'chk_b');
  assert.equal(multiGroups[0].accounts[1].id, 'chk_a');
});

