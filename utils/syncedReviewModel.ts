import type { Account, Transaction } from '../types';
import { safeAdd, safeRound } from '../utils';
import { isUncategorised } from './overviewSummary';

export interface SyncedAccountGroup {
  accountId: string;
  accountName: string;
  bankName?: string;
  currency: Account['currency'];
  account?: Account;
  transactions: Transaction[];
  netAmount: number;
  uncategorisedCount: number;
}

export interface SyncedReviewSummary {
  totalCount: number;
  uncategorisedCount: number;
  groups: SyncedAccountGroup[];
}

/**
 * True when a bank-synced transaction has not been reviewed yet. Excludes structural split/combined parents
 * and synthetic spare-change transfers so the user only reviews genuine incoming bank items.
 */
export function isUnreviewedSync(tx: Transaction): boolean {
  return Boolean(tx.needsReview) && !tx.isSplitParent && !tx.isCombinedParent && !tx.transferId?.startsWith('spare-');
}

/**
 * Groups all unreviewed synced transactions by account, newest transactions first,
 * preserving each account's currency and uncategorised count for one-pass review.
 */
export function groupUnreviewedByAccount(transactions: Transaction[], accounts: Account[]): SyncedReviewSummary {
  const accountMap = new Map(accounts.map(acc => [acc.id, acc]));
  const byAccount = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    if (!isUnreviewedSync(tx)) continue;
    const existing = byAccount.get(tx.accountId);
    if (existing) existing.push(tx);
    else byAccount.set(tx.accountId, [tx]);
  }

  let totalCount = 0;
  let uncategorisedCount = 0;
  const groups: SyncedAccountGroup[] = [];

  for (const [accountId, list] of byAccount.entries()) {
    const sorted = [...list].sort(
      (a, b) => b.date.localeCompare(a.date) || (b.syncedAt ?? '').localeCompare(a.syncedAt ?? '') || a.id.localeCompare(b.id),
    );
    const acc = accountMap.get(accountId);
    const netAmount = safeRound(sorted.reduce((sum, tx) => safeAdd(sum, tx.amount), 0), 2);
    const uncat = sorted.filter(isUncategorised).length;

    totalCount += sorted.length;
    uncategorisedCount += uncat;
    groups.push({
      accountId,
      accountName: acc?.name || 'Synced Account',
      bankName: acc?.financialInstitution,
      currency: acc?.currency || sorted[0]?.currency || 'EUR',
      account: acc,
      transactions: sorted,
      netAmount,
      uncategorisedCount: uncat,
    });
  }

  groups.sort(
    (a, b) => (b.transactions[0]?.date ?? '').localeCompare(a.transactions[0]?.date ?? '') || a.accountName.localeCompare(b.accountName),
  );

  return { totalCount, uncategorisedCount, groups };
}

/**
 * Produces minimal transaction updates that mark the selected synced transaction IDs as reviewed
 * (`needsReview: false`), omitting any transactions already reviewed.
 */
export function markTransactionsReviewedPatch(transactions: Transaction[], ids: Iterable<string>): Transaction[] {
  const target = new Set(ids);
  if (target.size === 0) return [];
  const patches: Transaction[] = [];
  for (const tx of transactions) {
    if (target.has(tx.id) && tx.needsReview) {
      patches.push({ ...tx, needsReview: false });
    }
  }
  return patches;
}
