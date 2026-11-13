import type { CleanupChange, CleanupProposal, Transaction } from '../types';
import { normalizeMerchantKey } from './brandfetch';

/**
 * Tidy-ups Crystal suggests. A proposal holds the exact edits, so applying one is the same as making them by hand,
 * and undoing it puts the old values back. Nothing here touches your data until you approve.
 */

const MIN_OUTLIER_SAMPLE = 6;
const DOMINANT_SHARE = 0.8;

export const isTidyable = (tx: Transaction) => !tx.transferId && !tx.isSplitParent && !tx.isCombinedParent && !tx.isBalanceAdjustment && !tx.isMarketAdjustment;

/** "NETFLIX.COM", "Netflix Inc" and "netflix" are one merchant. */
export const spellingKey = (name: string) =>
  name.toLowerCase()
    .replace(/\.(com|net|org|co\.[a-z]{2}|[a-z]{2})\b/g, '')
    .replace(/\b(inc|llc|ltd|gmbh|corp|sa|sarl|bv)\b\.?/g, '')
    .replace(/[^a-z0-9]/g, '');

const count = <K>(items: K[]) => {
  const tally = new Map<K, number>();
  items.forEach(item => tally.set(item, (tally.get(item) ?? 0) + 1));
  return tally;
};

const top = <K>(tally: Map<K, number>, tieBreak: (a: K, b: K) => number): K | undefined =>
  [...tally.entries()].sort((a, b) => b[1] - a[1] || tieBreak(a[0], b[0]))[0]?.[0];

/** One merchant written several ways. The spelling used most often wins. */
export const findMerchantSpellings = (transactions: Transaction[]): CleanupProposal[] => {
  const groups = new Map<string, Transaction[]>();
  transactions.filter(isTidyable).forEach(tx => {
    const merchant = tx.merchant?.trim();
    if (!merchant) return;
    const key = spellingKey(merchant);
    if (key.length < 3) return;
    groups.set(key, [...(groups.get(key) ?? []), tx]);
  });

  const proposals: CleanupProposal[] = [];
  groups.forEach((group, key) => {
    const spellings = count(group.map(tx => tx.merchant!.trim()));
    if (spellings.size < 2) return;
    const winner = top(spellings, (a, b) => a.length - b.length || a.localeCompare(b))!;
    const changes: CleanupChange[] = group
      .filter(tx => tx.merchant!.trim() !== winner)
      .map(tx => ({ transactionId: tx.id, field: 'merchant', from: tx.merchant!, to: winner }));
    const others = [...spellings.keys()].filter(name => name !== winner);
    proposals.push({
      id: `cleanup:merchant:${key}`,
      kind: 'merchant-spelling',
      title: `Call it ${winner}`,
      detail: `${changes.length} ${changes.length === 1 ? 'transaction says' : 'transactions say'} ${others.map(name => `"${name}"`).join(', ')}.`,
      source: 'crystal',
      status: 'pending',
      createdAt: '',
      changes,
    });
  });
  return proposals;
};

/** A merchant that is almost always one category, with a few filed elsewhere. */
export const findCategoryOutliers = (transactions: Transaction[]): CleanupProposal[] => {
  const byMerchant = new Map<string, Transaction[]>();
  transactions.filter(isTidyable).forEach(tx => {
    const key = normalizeMerchantKey(tx.merchant);
    if (!key || !tx.category) return;
    byMerchant.set(key, [...(byMerchant.get(key) ?? []), tx]);
  });

  const proposals: CleanupProposal[] = [];
  byMerchant.forEach((group, key) => {
    if (group.length < MIN_OUTLIER_SAMPLE) return;
    const categories = count(group.map(tx => tx.category));
    const dominant = top(categories, (a, b) => a.localeCompare(b))!;
    if ((categories.get(dominant) ?? 0) / group.length < DOMINANT_SHARE) return;
    const outliers = group.filter(tx => tx.category !== dominant);
    if (outliers.length === 0) return;
    const name = group.find(tx => tx.merchant)?.merchant!.trim() ?? key;
    proposals.push({
      id: `cleanup:category:${key}`,
      kind: 'category-outlier',
      title: `File ${name} under ${dominant}`,
      detail: `${group.length - outliers.length} of ${group.length} are ${dominant}. ${outliers.length} ${outliers.length === 1 ? 'is' : 'are'} filed elsewhere.`,
      source: 'crystal',
      status: 'pending',
      createdAt: '',
      changes: outliers.map(tx => ({ transactionId: tx.id, field: 'category' as const, from: tx.category, to: dominant })),
    });
  });
  return proposals;
};

/**
 * Brings the list up to date. A tidy-up you have seen (applied or dismissed) is never offered again, and one still
 * waiting is replaced by a fresh look at the data, or dropped when there is nothing left to do.
 */
export const refreshProposals = (transactions: Transaction[], existing: CleanupProposal[], now: string): CleanupProposal[] => {
  const found = [...findMerchantSpellings(transactions), ...findCategoryOutliers(transactions)];
  const resolved = existing.filter(proposal => proposal.status !== 'pending');
  const dismissed = new Set(resolved.filter(proposal => proposal.status === 'dismissed').map(proposal => proposal.id));
  const previous = new Map(existing.map(proposal => [proposal.id, proposal]));
  // A merchant that is tidied and later gets new strays is offered again, under the next round's id.
  const round = (base: string) => resolved.filter(proposal => proposal.status === 'applied' && proposal.id.split('#')[0] === base).length;
  const waiting = found
    .map(proposal => ({ ...proposal, id: round(proposal.id) > 0 ? `${proposal.id}#${round(proposal.id)}` : proposal.id }))
    .filter(proposal => !dismissed.has(proposal.id))
    .map(proposal => ({ ...proposal, createdAt: previous.get(proposal.id)?.createdAt || now }));
  // Proposals other sources queued (Ask Crystal) stay until you decide on them.
  const outside = existing.filter(proposal => proposal.status === 'pending' && proposal.source !== 'crystal');
  return [...resolved, ...outside, ...waiting];
};

const patch = (tx: Transaction, change: CleanupChange, value: string): Transaction => ({
  ...tx,
  [change.field]: value,
  // An edit you approved is yours: sync keeps it.
  ...(change.field === 'merchant' ? { lockedFields: Array.from(new Set([...(tx.lockedFields ?? []), 'merchant' as const])) } : {}),
});

/** Edits only what still looks the way the proposal saw it. Anything you changed since is left alone. */
export const applyProposal = (transactions: Transaction[], proposal: CleanupProposal): { changed: Transaction[]; skipped: number } => {
  const byId = new Map(transactions.map(tx => [tx.id, tx]));
  const changed: Transaction[] = [];
  let skipped = 0;
  proposal.changes.forEach(change => {
    const tx = byId.get(change.transactionId);
    if (!tx || (tx[change.field] ?? '') !== change.from) { skipped++; return; }
    changed.push(patch(tx, change, change.to));
  });
  return { changed, skipped };
};

export const undoProposal = (transactions: Transaction[], proposal: CleanupProposal): { changed: Transaction[]; skipped: number } => {
  const byId = new Map(transactions.map(tx => [tx.id, tx]));
  const changed: Transaction[] = [];
  let skipped = 0;
  proposal.changes.forEach(change => {
    const tx = byId.get(change.transactionId);
    if (!tx || (tx[change.field] ?? '') !== change.to) { skipped++; return; }
    changed.push({ ...tx, [change.field]: change.from });
  });
  return { changed, skipped };
};

export const pendingProposals = (proposals: CleanupProposal[]) => proposals.filter(proposal => proposal.status === 'pending');
