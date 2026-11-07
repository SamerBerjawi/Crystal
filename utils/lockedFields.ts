import type { Transaction } from '../types';

/*
 * Locked fields. Bank sync fills a synced transaction's merchant and description when they are empty. When you edit
 * one of those fields on a synced transaction, it is locked so a later sync leaves your value alone, even if you
 * cleared it. Pure, so it is unit tested (tests/unit/lockedFields.test.ts).
 */

export const LOCKABLE_FIELDS = ['merchant', 'description'] as const;
export type LockableField = (typeof LOCKABLE_FIELDS)[number];

/** A transaction brought in by a bank connection (as opposed to one you entered or imported from a file). */
export const isBankSynced = (tx: Pick<Transaction, 'importId'>) => !!tx.importId?.startsWith('enable-banking-');

export const isLocked = (tx: Pick<Transaction, 'lockedFields'>, field: LockableField) => !!tx.lockedFields?.includes(field);

/**
 * `next` with every lockable field you changed on a bank-synced transaction added to `lockedFields`.
 * Anything not synced, or not changed, comes back untouched.
 */
export const withEditLocks = <T extends Partial<Transaction>>(previous: Transaction | undefined, next: T): T => {
  if (!previous || !isBankSynced(previous)) return next;
  const locked = new Set<LockableField>(previous.lockedFields ?? []);
  for (const field of LOCKABLE_FIELDS) {
    if (field in next && (next[field] ?? '') !== (previous[field] ?? '')) locked.add(field);
  }
  if (locked.size === (previous.lockedFields?.length ?? 0)) return next;
  return { ...next, lockedFields: LOCKABLE_FIELDS.filter(field => locked.has(field)) };
};

/**
 * What a sync may fill on an existing transaction: an empty merchant or description from the bank's record
 * (and a merchant that earlier syncs wrongly set to Apple), never a locked field. Undefined when there is nothing to change.
 */
export const syncFill = (existing: Transaction, incoming: Pick<Transaction, 'merchant' | 'description'>): Transaction | undefined => {
  // Earlier syncs read "Apple Pay" in card text as the merchant Apple. When the bank record now resolves to a
  // different merchant and you never edited it, correct it. A real Apple purchase resolves to Apple again.
  const wrongApple = existing.merchant === 'Apple' && !!incoming.merchant && incoming.merchant !== 'Apple';
  const merchant = (!existing.merchant || wrongApple) && incoming.merchant && !isLocked(existing, 'merchant') ? incoming.merchant : existing.merchant;
  const description = !existing.description && incoming.description && !isLocked(existing, 'description') ? incoming.description : existing.description;
  if (merchant === existing.merchant && description === existing.description) return undefined;
  return { ...existing, merchant, description };
};
