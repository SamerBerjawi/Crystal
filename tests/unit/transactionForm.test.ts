import test from 'node:test';
import assert from 'node:assert/strict';
import { Account, MerchantRule, Transaction } from '../../types';
import { accountsForType, autofill, editLoanPart, initialTxForm, matchMerchants, merchantSuggestions, mergeBranch, planTransactionSave, roundUpFor, withAutoLoanSplit, type TxForm } from '../../utils/transactionForm';

const accounts = [
  { id: 'main', name: 'Main', type: 'Checking', balance: 100, currency: 'EUR', isPrimary: true },
  { id: 'save', name: 'Save', type: 'Savings', balance: 0, currency: 'EUR' },
  { id: 'loan', name: 'Loan', type: 'Loan', balance: -12000, currency: 'EUR', interestRate: 6 },
  { id: 'spare', name: 'Spare', type: 'Investment', subType: 'Spare Change', linkedAccountId: 'main', balance: 0, currency: 'EUR' },
] as Account[];
const rule = { category: 'Food', defaultDescription: 'Groceries', address: 'Rue 1', city: 'Brussels', country: 'Belgium' } as MerchantRule;
const ctx = { accounts, transactions: [] as Transaction[], merchantRules: { colruyt: rule }, transactionRules: [] };
const blank = (overrides: Partial<TxForm> = {}): TxForm => ({ ...initialTxForm({}, ctx), ...overrides });
const ok = (plan: ReturnType<typeof planTransactionSave>) => { if ('error' in plan) throw new Error(plan.error); return plan; };

test('a transfer never starts with one account on both sides', () => {
  assert.equal(initialTxForm({ type: 'transfer' }, ctx).toAccountId, '');
  assert.equal(initialTxForm({ type: 'transfer', toAccountId: 'main' }, ctx).fromAccountId, '');
  assert.deepEqual(accountsForType({ fromAccountId: 'main', toAccountId: 'main' }, 'transfer'), { toAccountId: '' });
  assert.deepEqual(accountsForType({ fromAccountId: 'main', toAccountId: '' }, 'income'), { toAccountId: 'main' });
});

test('a new form starts on the primary account, today, with the home city', () => {
  const form = initialTxForm({ defaultCity: 'Brussels, Belgium' }, ctx);
  assert.equal(form.fromAccountId, 'main');
  assert.equal(form.city, 'Brussels');
  assert.equal(form.type, 'expense');
});

test('autofill fills from the merchant, and leaves your own edits alone', () => {
  const patch = autofill(blank({ merchant: 'Colruyt' }), ctx);
  assert.equal(patch.category, 'Food');
  assert.equal(patch.description, 'Groceries');
  assert.equal(patch.city, 'Brussels');
  const kept = autofill(blank({ merchant: 'Colruyt', category: 'Mine', categoryEdited: true, description: 'Own', descriptionEdited: true, address: 'Home', locationEdited: true }), ctx);
  assert.equal(kept.category, undefined);
  assert.equal(kept.description, undefined);
  assert.equal(kept.address, undefined);
});

test('choosing a suggestion refills everything even after edits', () => {
  const patch = autofill(blank({ merchant: 'Colruyt', category: 'Mine', categoryEdited: true }), ctx, { category: true, description: true, location: true });
  assert.equal(patch.category, 'Food');
});

test('merchant suggestions rank by frequency, exact and prefix first', () => {
  const tx = (merchant: string) => ({ merchant, category: 'X' }) as Transaction;
  const all = merchantSuggestions([tx('Abc'), tx('Zabc'), tx('Zabc')], {});
  assert.deepEqual(all.map(item => item.name), ['Zabc', 'Abc']);
  assert.equal(matchMerchants(all, 'ab')[0].name, 'Abc');
});

test('loan split takes a month of interest, capped, and parts always add up', () => {
  const form = withAutoLoanSplit(blank({ type: 'transfer', fromAccountId: 'main', toAccountId: 'loan', amount: '100' }), accounts);
  assert.equal(form.interest, '60.00');
  assert.equal(form.principal, '40.00');
  const edited = editLoanPart(form, 'principal', '70');
  assert.equal(edited.interest, '30.00');
  assert.equal(edited.autoLoanSplit, false);
  assert.equal(editLoanPart(form, 'interest', '500').interest, '100');
});

test('a description that just repeats the merchant is replaced', () => {
  assert.equal(autofill(blank({ merchant: 'Colruyt', description: 'colruyt', descriptionEdited: true }), ctx).description, 'Groceries');
});

test('a charge on a loan account is a plain expense, and a payment needs its split', () => {
  const charge = ok(planTransactionSave(blank({ fromAccountId: 'loan', amount: '20', category: 'Fees', description: 'Fee', syncLocationToMerchant: false }), null, ctx));
  assert.equal(charge.toSave[0].amount, -20);
  assert.equal(charge.toSave[0].principalAmount, undefined);
  const noRate = { ...ctx, accounts: accounts.map(account => (account.id === 'loan' ? { ...account, interestRate: undefined } : account)) };
  assert.equal(planTransactionSave(blank({ type: 'income', toAccountId: 'loan', amount: '20', category: 'x', description: 'Pay' }), null, noRate).ok, false);
});

test('round-up goes to the next unit, by the multiplier, and whole amounts follow the choice', () => {
  assert.equal(roundUpFor({ amount: '3.25', roundUpBehavior: 'skip', roundUpMultiplier: '2' }), 1.5);
  assert.equal(roundUpFor({ amount: '3', roundUpBehavior: 'skip', roundUpMultiplier: '1' }), 0);
  assert.equal(roundUpFor({ amount: '3', roundUpBehavior: 'unit', roundUpMultiplier: '1' }), 1);
});

test('a plain expense saves negative, with its round-up pair and its branch', () => {
  const plan = ok(planTransactionSave(blank({ amount: '3.25', category: 'Food', description: 'Lunch', merchant: 'Cafe', city: 'Ghent', address: 'Ghent' }), null, ctx));
  assert.equal(plan.toSave[0].amount, -3.25);
  assert.equal(plan.toSave.length, 3);
  assert.equal(plan.toSave[1].transferId, `spare-${plan.toSave[0].id}`);
  assert.equal(plan.toSave[2].accountId, 'spare');
  assert.equal(plan.branch?.key, 'cafe');
});

test('a transfer saves a linked pair, and rejects the same account twice', () => {
  const plan = ok(planTransactionSave(blank({ type: 'transfer', amount: '10', toAccountId: 'save', description: 'Move' }), null, ctx));
  assert.equal(plan.toSave[0].transferId, plan.toSave[1].transferId);
  assert.equal(plan.toSave[0].amount, -10);
  assert.equal(plan.toSave[1].merchant, 'Internal Transfer');
  assert.equal(planTransactionSave(blank({ type: 'transfer', amount: '10', description: 'Move' }), null, ctx).ok, false);
});

test('missing amount, description or category stop the save', () => {
  assert.equal(planTransactionSave(blank({ description: 'x', category: 'y' }), null, ctx).ok, false);
  assert.equal(planTransactionSave(blank({ amount: '1', category: 'y' }), null, ctx).ok, false);
  assert.equal(planTransactionSave(blank({ amount: '1', description: 'x' }), null, ctx).ok, false);
});

test('editing keeps the id, and turning a transfer into an expense removes the pair', () => {
  const edit = { id: 't1', accountId: 'main', type: 'expense', amount: -5, date: '2026-01-01', description: 'Old', category: 'Food', currency: 'EUR' } as Transaction;
  const form = initialTxForm({ edit }, { ...ctx, transactions: [edit] });
  assert.equal(form.amount, '5.00');
  assert.equal(ok(planTransactionSave({ ...form, syncLocationToMerchant: false }, edit, { accounts, transactions: [edit] })).toSave[0].id, 't1');

  const out = { ...edit, id: 'a', transferId: 'x' } as Transaction;
  const into = { ...edit, id: 'b', transferId: 'x', accountId: 'save', type: 'income', amount: 5 } as Transaction;
  const transfer = initialTxForm({ edit: out }, { ...ctx, transactions: [out, into] });
  assert.equal(transfer.type, 'transfer');
  assert.equal(transfer.toAccountId, 'save');
  const plan = ok(planTransactionSave({ ...transfer, type: 'expense', category: 'Food' }, out, { accounts, transactions: [out, into] }));
  assert.deepEqual(plan.toDelete.sort(), ['a', 'b']);
});

test('turning round-up off removes both sides of the old one', () => {
  const edit = { id: 't1', accountId: 'main', type: 'expense', amount: -3.25, date: '2026-01-01', description: 'Old', category: 'Food', currency: 'EUR' } as Transaction;
  const side = (id: string, accountId: string) => ({ id, accountId, transferId: 'spare-t1', merchant: 'Round Up', description: 'x', date: edit.date }) as Transaction;
  const transactions = [edit, side('s1', 'main'), side('s2', 'spare')];
  const form = initialTxForm({ edit }, { ...ctx, transactions });
  assert.equal(form.existingRoundUpId, 's1');
  const plan = ok(planTransactionSave({ ...form, roundUpOn: false, syncLocationToMerchant: false }, edit, { accounts, transactions }));
  assert.deepEqual(plan.toDelete.sort(), ['s1', 's2']);
});

test('a location joins a merchant as a new branch, or updates the same address', () => {
  const branch = { id: 'n', label: 'New', address: 'Rue 2', isPrimary: true };
  const first = mergeBranch({}, branch);
  assert.equal(first.locations?.length, 1);
  assert.equal(first.address, 'Rue 2');
  const again = mergeBranch(first, { ...branch, id: 'm', label: 'Renamed' });
  assert.equal(again.locations?.length, 1);
  assert.equal(again.locations?.[0].label, 'Renamed');
  assert.equal(again.locations?.[0].id, 'n');
});
