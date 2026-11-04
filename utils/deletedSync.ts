import type { EnableBankingConnection, Transaction } from '../types';

/*
 * Deleted bank transactions. When you delete a transaction that a bank connection synced, the bank's id for it is
 * remembered on the linked bank account, so a later sync does not bring it back. Restoring it (Undo) forgets the id.
 * Pure, so it is unit tested (tests/unit/deletedSync.test.ts).
 */

/** The most ids kept per bank account; the oldest go first. */
export const MAX_REMEMBERED = 5000;

const importIdOf = (connectionId: string, linkedAccountId: string) => `enable-banking-${connectionId}-${linkedAccountId}`;

/** Applies `change` to the bank account each transaction was synced into; the same array comes back if nothing changed. */
const updateRemembered = (
  connections: EnableBankingConnection[],
  transactions: Pick<Transaction, 'importId' | 'sureId'>[],
  change: (current: string[], sureIds: string[]) => string[],
): EnableBankingConnection[] => {
  let changed = false;
  const next = connections.map(connection => {
    let touched = false;
    const accounts = (connection.accounts ?? []).map(account => {
      if (!account.linkedAccountId) return account;
      const importId = importIdOf(connection.id, account.linkedAccountId);
      const sureIds = transactions.filter(tx => tx.importId === importId && tx.sureId).map(tx => tx.sureId as string);
      if (sureIds.length === 0) return account;
      const current = account.deletedTransactionIds ?? [];
      const updated = change(current, sureIds);
      if (updated.length === current.length && updated.every((id, i) => id === current[i])) return account;
      touched = true;
      return { ...account, deletedTransactionIds: updated };
    });
    if (!touched) return connection;
    changed = true;
    return { ...connection, accounts };
  });
  return changed ? next : connections;
};

export const rememberDeleted = (connections: EnableBankingConnection[], deleted: Pick<Transaction, 'importId' | 'sureId'>[]) =>
  updateRemembered(connections, deleted, (current, sureIds) => [...current, ...sureIds.filter(id => !current.includes(id))].slice(-MAX_REMEMBERED));

export const forgetDeleted = (connections: EnableBankingConnection[], restored: Pick<Transaction, 'importId' | 'sureId'>[]) =>
  updateRemembered(connections, restored, (current, sureIds) => current.filter(id => !sureIds.includes(id)));

/** The deleted bank ids to skip, per linked Crystal account id. */
export const deletedIdsByAccount = (connection: Pick<EnableBankingConnection, 'accounts'>) =>
  new Map((connection.accounts ?? []).filter(a => a.linkedAccountId && a.deletedTransactionIds?.length).map(a => [a.linkedAccountId as string, new Set(a.deletedTransactionIds)]));

/** How many deleted bank transactions a connection is holding back. */
export const countDeleted = (connection: Pick<EnableBankingConnection, 'accounts'>) =>
  (connection.accounts ?? []).reduce((sum, account) => sum + (account.deletedTransactionIds?.length ?? 0), 0);

/** Forgets every deleted bank transaction of one connection, so the next sync can bring them back. */
export const clearDeleted = (connections: EnableBankingConnection[], connectionId: string): EnableBankingConnection[] =>
  connections.map(connection => (connection.id !== connectionId || countDeleted(connection) === 0
    ? connection
    : { ...connection, accounts: connection.accounts.map(({ deletedTransactionIds: _forgotten, ...account }) => account) }));
