import test from 'node:test';
import assert from 'node:assert/strict';
import { Account } from '../../types';
import { buildAccount, draftFromAccount, emptyDraft, reconcileLoan } from '../../utils/accountForm';
import { computeExtraPaymentSavings } from '../../utils/accountDetailModel';
import { accountHasCard, accountsInTab, topMerchantsThisMonth } from '../../utils/accountsModel';
import { Transaction } from '../../types';

test('a new checking account saves its name, balance and flags', () => {
  const account = buildAccount({ ...emptyDraft(), name: ' Main ', balance: '120.50', isPrimary: true });
  assert.equal(account.name, 'Main');
  assert.equal(account.balance, 120.5);
  assert.equal(account.isPrimary, true);
  assert.equal(account.includeInAnalytics, true);
});

test('loan balance comes from the principal, negative for a loan and positive for lending', () => {
  assert.equal(buildAccount({ ...emptyDraft('Loan'), principalAmount: '1000' }).balance, -1000);
  assert.equal(buildAccount({ ...emptyDraft('Lending'), principalAmount: '1000' }).balance, 1000);
});

test('loan total, principal and interest reconcile', () => {
  const draft = { ...emptyDraft('Loan'), principalAmount: '1000' };
  assert.equal(reconcileLoan(draft, 'interestAmount', '200').totalAmount, '1200.00');
  assert.equal(reconcileLoan({ ...draft, totalAmount: '1000' }, 'totalAmount', '1500').interestAmount, '500.00');
});

test('editing keeps fields the form does not touch, and a computed balance', () => {
  const account = { id: 'a', name: 'Warrants', type: 'Investment', subType: 'Warrant', balance: 500, currency: 'EUR', priceHistory: [{ date: '2026-01-01', price: 1 }] } as unknown as Account;
  const saved = buildAccount({ ...draftFromAccount(account), balance: '9' }, { base: account, isComputed: true });
  assert.equal(saved.id, 'a');
  assert.equal(saved.balance, 500);
  assert.deepEqual(saved.priceHistory, account.priceHistory);
});

test('a legacy Crypto account becomes an Investment', () => {
  const draft = draftFromAccount({ id: 'a', name: 'Coins', type: 'Crypto', balance: 1, currency: 'EUR' } as unknown as Account);
  assert.equal(draft.type, 'Investment');
  assert.equal(draft.subType, 'Crypto');
});

test('card fields are dropped when the account has no card', () => {
  const saved = buildAccount({ ...emptyDraft(), name: 'x', last4: '1234', hasCard: false });
  assert.equal(saved.last4, undefined);
});

test('lease fields save only for a leased vehicle', () => {
  const draft = { ...emptyDraft('Vehicle'), name: 'Car', purchaseDate: '2026-01-01', leaseProvider: 'Co' };
  assert.equal(buildAccount(draft).leaseProvider, undefined);
  assert.equal(buildAccount(draft).purchaseDate, '2026-01-01');
  assert.equal(buildAccount({ ...draft, vehicleOwnership: 'Leased' }).leaseProvider, 'Co');
});

test('a new odometer reading adds one log, and the same reading adds none', () => {
  const logs = [{ id: 'l', date: '2026-01-01', reading: 100 }];
  const base = { ...emptyDraft('Vehicle'), mileageLogs: logs };
  assert.equal(buildAccount({ ...base, currentMileage: '100' }).mileageLogs?.length, 1);
  assert.equal(buildAccount({ ...base, currentMileage: '150' }).mileageLogs?.length, 2);
});

test('a property with a linked loan drops its own price', () => {
  const saved = buildAccount({ ...emptyDraft('Property'), purchasePrice: '100', linkedLoanId: 'loan' });
  assert.equal(saved.purchasePrice, undefined);
  assert.equal(saved.linkedLoanId, 'loan');
});

test('every field survives a round trip through the draft', () => {
  const account = {
    id: 'p', name: 'Home', type: 'Property', balance: 300000, currency: 'EUR', propertyType: 'Apartment', address: 'Rue 1', propertySize: 90, bedrooms: 2,
    hasGarden: true, gardenSize: 20, insuranceProvider: 'AXA', insuranceAmount: 300, insuranceFrequency: 'yearly', isRental: true, rentalIncomeAmount: 900, rentalIncomeFrequency: 'monthly', notes: 'Keys',
  } as unknown as Account;
  const saved = buildAccount(draftFromAccount(account), { base: account });
  for (const key of Object.keys(account) as (keyof Account)[]) assert.equal(saved[key], account[key], key);
});

test('paying extra saves months and interest, and nothing extra saves nothing', () => {
  assert.deepEqual(computeExtraPaymentSavings(10000, 6, 200, 0).monthsSaved, 0);
  const result = computeExtraPaymentSavings(10000, 6, 200, 100);
  assert.ok(result.monthsSaved > 15);
  assert.ok(result.interestSaved > 400);
  assert.equal(result.monthsLeft + result.monthsSaved, computeExtraPaymentSavings(10000, 6, 200, 0).monthsLeft);
});

test('a payment below the interest never clears, so no saving is claimed', () => {
  assert.equal(computeExtraPaymentSavings(10000, 12, 50, 10).monthsSaved, 0);
});

const acc = (overrides: Partial<Account>) => ({ id: 'a', name: 'A', type: 'Checking', balance: 0, currency: 'EUR', ...overrides }) as Account;

test('a card is read from the account: card details, a credit card, or a meal voucher', () => {
  assert.equal(accountHasCard(acc({})), false);
  assert.equal(accountHasCard(acc({ last4: '1234' })), true);
  assert.equal(accountHasCard(acc({ type: 'Credit Card' })), true);
  assert.equal(accountHasCard(acc({ type: 'Other Assets', otherSubType: 'Other', financialInstitution: 'Pluxee' })), true);
});

test('checking with a card is in both tabs, credit cards and vouchers only in Cards', () => {
  const list = [
    acc({ id: 'checking', last4: '1234' }),
    acc({ id: 'savings', type: 'Savings' }),
    acc({ id: 'credit', type: 'Credit Card' }),
    acc({ id: 'voucher', type: 'Other Assets', name: 'Edenred meal' }),
    acc({ id: 'cash', type: 'Other Assets', otherSubType: 'Cash' }),
    acc({ id: 'gold', type: 'Other Assets' }),
    acc({ id: 'loan', type: 'Loan' }),
    acc({ id: 'stock', type: 'Investment' }),
  ];
  const ids = (tab: Parameters<typeof accountsInTab>[1]) => accountsInTab(list, tab).map(item => item.id);
  assert.deepEqual(ids('cards'), ['checking', 'credit', 'voucher']);
  assert.deepEqual(ids('accounts'), ['checking', 'savings', 'cash']);
  assert.deepEqual(ids('loans'), ['loan']);
  assert.deepEqual(ids('assets'), ['gold']);
});

test('top merchants count this month, skip transfers, and rank by amount', () => {
  const tx = (merchant: string, amount: number, date = '2026-10-05', extra = {}) => ({ id: merchant + date, merchant, amount, date, type: 'expense', ...extra }) as unknown as Transaction;
  const result = topMerchantsThisMonth([tx('A', -10), tx('B', -30), tx('A', -25), tx('Old', -99, '2026-09-05'), tx('Move', -50, '2026-10-06', { transferId: 't' })], 3, new Date(2026, 9, 20));
  assert.deepEqual(result, [{ name: 'A', amount: 35 }, { name: 'B', amount: 30 }]);
});
