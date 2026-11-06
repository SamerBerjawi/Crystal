import test from 'node:test';
import assert from 'node:assert/strict';
import type { Account, FinancialGoal, Transaction } from '../../types';
import { accountLinks, applyAssetLoanChoice, assetForLoan, loansForAsset, normalizeLoanAssetLinks, transferPartners } from '../../utils/accountLinks';

const acc = (id: string, type: Account['type'], p: Partial<Account> = {}): Account => ({ id, name: id, type, balance: 0, currency: 'EUR', ...p });

test('an old property link moves onto its loan and the property field goes', () => {
  const accounts = [acc('home', 'Property', { linkedLoanId: 'mortgage' }), acc('mortgage', 'Loan')];
  const next = normalizeLoanAssetLinks(accounts);
  assert.equal(next.find(a => a.id === 'mortgage')!.linkedAssetId, 'home');
  assert.equal('linkedLoanId' in next.find(a => a.id === 'home')!, false);
});

test('a loan that already points elsewhere keeps its own link', () => {
  const accounts = [acc('home', 'Property', { linkedLoanId: 'mortgage' }), acc('flat', 'Property'), acc('mortgage', 'Loan', { linkedAssetId: 'flat' })];
  const next = normalizeLoanAssetLinks(accounts);
  assert.equal(next.find(a => a.id === 'mortgage')!.linkedAssetId, 'flat');
});

test('normalizing with nothing to fold returns the same array', () => {
  const accounts = [acc('a', 'Checking')];
  assert.equal(normalizeLoanAssetLinks(accounts), accounts);
});

test('the asset side is derived from the loan', () => {
  const accounts = [acc('home', 'Property'), acc('mortgage', 'Loan', { linkedAssetId: 'home' })];
  assert.deepEqual(loansForAsset(accounts[0], accounts).map(a => a.id), ['mortgage']);
  assert.equal(assetForLoan(accounts[1], accounts)?.id, 'home');
});

test("a property form's mortgage choice is written to the loan, and the old loan lets go", () => {
  const accounts = [acc('home', 'Property'), acc('old', 'Loan', { linkedAssetId: 'home' }), acc('new', 'Loan')];
  const next = applyAssetLoanChoice(accounts, 'home', 'new');
  assert.equal(next.find(a => a.id === 'new')!.linkedAssetId, 'home');
  assert.equal(next.find(a => a.id === 'old')!.linkedAssetId, undefined);
  const cleared = applyAssetLoanChoice(next, 'home', undefined);
  assert.equal(cleared.find(a => a.id === 'new')!.linkedAssetId, undefined);
});

test('a card and its pay-from account each show the other', () => {
  const accounts = [acc('main', 'Checking'), acc('visa', 'Credit Card', { settlementAccountId: 'main' })];
  assert.deepEqual(accountLinks(accounts[1], { accounts }).map(l => [l.kind, l.target.type === 'account' && l.target.account.id]), [['pays-from', 'main']]);
  assert.deepEqual(accountLinks(accounts[0], { accounts }).map(l => [l.kind, l.target.type === 'account' && l.target.account.id]), [['settles', 'visa']]);
});

test('a mortgage links to its home and payment account, and the home back to it', () => {
  const accounts = [acc('main', 'Checking'), acc('home', 'Property'), acc('mortgage', 'Loan', { linkedAssetId: 'home', linkedAccountId: 'main' })];
  assert.deepEqual(accountLinks(accounts[2], { accounts }).map(l => l.kind), ['pays-from', 'secured-by']);
  assert.deepEqual(accountLinks(accounts[1], { accounts }).map(l => l.kind), ['secures']);
  assert.deepEqual(accountLinks(accounts[0], { accounts }).map(l => l.kind), ['pays-loan']);
});

test('goals show as holds or funds, never both', () => {
  const accounts = [acc('save', 'Savings')];
  const goals = [{ id: 'g', name: 'Trip', paymentAccountId: 'save', destinationAccountId: 'save' } as FinancialGoal];
  assert.deepEqual(accountLinks(accounts[0], { accounts, goals }).map(l => l.kind), ['holds-goal']);
});

test('frequent transfer partners count transfer pairs, newest period only', () => {
  const accounts = [acc('a', 'Checking'), acc('b', 'Savings')];
  const pair = (id: string, date: string): Transaction[] => [
    { id: `${id}-out`, accountId: 'a', date, description: '', amount: -10, category: 'Transfer', type: 'expense', currency: 'EUR', transferId: id },
    { id: `${id}-in`, accountId: 'b', date, description: '', amount: 10, category: 'Transfer', type: 'income', currency: 'EUR', transferId: id },
  ];
  const transactions = [...pair('t1', '2026-10-01'), ...pair('t2', '2026-10-15'), ...pair('t3', '2020-01-01')];
  assert.deepEqual(transferPartners(accounts[0], transactions, accounts, { today: new Date(2026, 10, 1) }).map(p => [p.account.id, p.count]), [['b', 2]]);
  assert.deepEqual(accountLinks(accounts[0], { accounts, transactions, today: new Date(2026, 10, 1) }).map(l => [l.kind, l.count]), [['transfers-with', 2]]);
});
