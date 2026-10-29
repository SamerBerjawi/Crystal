import test from 'node:test';
import assert from 'node:assert/strict';
import { Account } from '../../types';
import { computeAccountsHeroModel, filterAndSortAccounts } from '../../utils/accountsModel';

/* Phase 4.4: Accounts list fixes. */

const RATES = { EUR: 1 };
const acc = (p: Partial<Account> & Pick<Account, 'id' | 'type' | 'balance'>): Account => ({ name: p.id, currency: 'EUR', ...p });

test('A2: assets and liabilities each add up to 100 % on their own', () => {
  const hero = computeAccountsHeroModel(
    [
      acc({ id: 'chk', type: 'Checking', balance: 3000 }),
      acc({ id: 'sav', type: 'Savings', balance: 1000 }),
      acc({ id: 'cc', type: 'Credit Card', balance: -250 }),
      acc({ id: 'loan', type: 'Loan', balance: -750 }),
    ],
    [],
    {},
    'EUR',
    { conversionRates: RATES }
  );
  const side = (kind: string) => hero.allocationItems.filter((i) => i.kind === kind).reduce((s, i) => s + i.pct, 0);
  assert.equal(side('asset'), 100);
  assert.equal(side('liability'), 100);
  assert.equal(hero.allocationItems.find((i) => i.id === 'credit_cards')?.pct, 25, 'cards are 25 % of debts, not of everything');
});

test('L-A8: the rate sort ranks APY among assets and APR among debts, assets first', () => {
  const list = [
    acc({ id: 'loan-high', type: 'Loan', balance: -1, interestRate: 9 }),
    acc({ id: 'sav-low', type: 'Savings', balance: 1, apy: 1 }),
    acc({ id: 'loan-low', type: 'Loan', balance: -1, interestRate: 2 }),
    acc({ id: 'sav-high', type: 'Savings', balance: 1, apy: 4 }),
  ];
  const order = filterAndSortAccounts(list, {}, { sortBy: 'apy_apr' }).map((a) => a.id);
  assert.deepEqual(order, ['sav-high', 'sav-low', 'loan-high', 'loan-low']);
});
