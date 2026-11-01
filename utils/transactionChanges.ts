import { v4 as uuidv4 } from 'uuid';
import { Account, Transaction } from '../types';
import { convertCurrency } from '../utils';
import { defaultCategory } from './overviewSummary';

export type TransactionInput = Omit<Transaction, 'id'> & { id?: string };

export interface TransactionChanges {
  deletedIds: string[];
  updated: Transaction[];
  added: Transaction[];
  /** By account id, in that account's own currency. */
  balanceChanges: Record<string, number>;
}

/** A loan payment that's split only moves the balance by its principal. */
const balanceEffect = (tx: Transaction, account?: Account) => {
  const amount = account?.type === 'Loan' && tx.type === 'income' && tx.principalAmount != null ? tx.principalAmount : tx.amount;
  return account ? convertCurrency(amount, tx.currency, account.currency) : 0;
};

/**
 * Works out a save once, with its ids and balance changes settled. React may run a state updater twice, so the updaters
 * that apply this must do nothing but apply it.
 */
export const planTransactionChanges = (current: Transaction[], saved: TransactionInput[], idsToDelete: string[], accounts: Account[]): TransactionChanges => {
  const balanceChanges: Record<string, number> = {};
  const accountOf = (id: string) => accounts.find(account => account.id === id);
  const splitParents = new Set([...current, ...saved].filter(tx => tx.isSplitParent).map(tx => tx.id));
  // A split's parts and a combined total restate money the account already holds.
  const isRestated = (tx: Transaction) => tx.isCombinedParent || (!!tx.parentTransactionId && splitParents.has(tx.parentTransactionId));
  const move = (tx: Transaction, sign: 1 | -1) => {
    if (isRestated(tx)) return;
    balanceChanges[tx.accountId] = (balanceChanges[tx.accountId] || 0) + sign * balanceEffect(tx, accountOf(tx.accountId));
  };

  current.filter(tx => idsToDelete.includes(tx.id)).forEach(tx => move(tx, -1));
  const remaining = idsToDelete.length > 0 ? current.filter(tx => !idsToDelete.includes(tx.id)) : current;

  const updated: Transaction[] = [];
  const added: Transaction[] = [];
  saved.forEach(data => {
    const original = data.id ? remaining.find(tx => tx.id === data.id) : undefined;
    if (original) {
      const next = { ...original, ...data } as Transaction;
      move(original, -1);
      move(next, 1);
      updated.push(next);
    } else {
      const next = { ...data, category: data.category || defaultCategory(data), id: data.id || `txn-${uuidv4()}` } as Transaction;
      move(next, 1);
      added.push(next);
    }
  });

  return { deletedIds: idsToDelete, updated, added, balanceChanges };
};

export const applyTransactionChanges = (transactions: Transaction[], { deletedIds, updated, added }: TransactionChanges): Transaction[] => {
  const kept = deletedIds.length > 0 ? transactions.filter(tx => !deletedIds.includes(tx.id)) : transactions;
  return [...kept.map(tx => updated.find(item => item.id === tx.id) || tx), ...added];
};

export const applyBalanceChanges = (accounts: Account[], balanceChanges: Record<string, number>): Account[] => accounts.map(account => {
  const change = balanceChanges[account.id];
  if (!change) return account;
  return { ...account, balance: parseFloat((account.balance + change).toFixed(account.currency === 'BTC' ? 8 : 2)) };
});
