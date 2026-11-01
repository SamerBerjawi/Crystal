import type { Transaction } from '../types';

export type SummaryTarget = 'income' | 'bills' | 'review' | 'tasks';

export interface SummaryFact {
  id: SummaryTarget;
  /** The linked words. */
  link: string;
  rest: string;
}

export interface SummaryInput {
  /** Already formatted, or null when nothing came in. */
  incomeYesterday: string | null;
  billsDue: number;
  toReview: number;
  tasksDue?: number;
}

/** At most three facts, each linked to where you can act. */
export function buildSummaryFacts({ incomeYesterday, billsDue, toReview, tasksDue = 0 }: SummaryInput): SummaryFact[] {
  const facts: SummaryFact[] = [];
  if (incomeYesterday) facts.push({ id: 'income', link: incomeYesterday, rest: ' came in yesterday' });
  if (billsDue > 0) facts.push({ id: 'bills', link: billsDue === 1 ? '1 bill' : `${billsDue} bills`, rest: billsDue === 1 ? ' is due soon' : ' are due soon' });
  if (toReview > 0) facts.push({ id: 'review', link: toReview === 1 ? '1 transaction' : `${toReview} transactions`, rest: toReview === 1 ? ' needs review' : ' need review' });
  if (tasksDue > 0) facts.push({ id: 'tasks', link: tasksDue === 1 ? '1 task' : `${tasksDue} tasks`, rest: tasksDue === 1 ? ' is due' : ' are due' });
  return facts.slice(0, 3);
}

export const isUncategorised = (tx: Transaction) =>
  !tx.transferId && !tx.isBalanceAdjustment && (!tx.category?.trim() || tx.category === 'Uncategorized');

/**
 * Up to three likely categories: what this merchant usually gets, then what's most used for this kind of transaction.
 * The merchant's own rule comes first.
 */
export const suggestCategories = (tx: Transaction, history: Transaction[], ruleCategory?: string, limit = 3): string[] => {
  const key = (tx.merchant || tx.description || '').trim().toLowerCase();
  const ranked = (list: Transaction[]) => {
    const counts = new Map<string, number>();
    list.forEach(item => { if (!isUncategorised(item) && !item.transferId && item.category !== 'Transfer') counts.set(item.category, (counts.get(item.category) ?? 0) + 1); });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  };
  const sameMerchant = history.filter(item => (item.merchant || item.description || '').trim().toLowerCase() === key);
  const sameKind = history.filter(item => item.type === tx.type);
  return [...new Set([...(ruleCategory ? [ruleCategory] : []), ...ranked(sameMerchant), ...ranked(sameKind)])].slice(0, limit);
};
