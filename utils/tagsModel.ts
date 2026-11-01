import { Tag, Transaction } from '../types';
import { convertToEur, parseLocalDate, safeAdd } from '../utils';

export type TagSort = 'count' | 'amount' | 'name';

export interface TagSummary extends Tag {
  count: number;
  netAmount: number;
  /** Spending per month, oldest first, for the row's small chart. */
  history: { value: number }[];
}

const HISTORY_MONTHS = 6;

const monthKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}`;

export const summariseTags = (tags: Tag[], transactions: Transaction[], today = new Date()): TagSummary[] => {
  const months = Array.from({ length: HISTORY_MONTHS }, (_, index) => monthKey(new Date(today.getFullYear(), today.getMonth() - (HISTORY_MONTHS - 1 - index), 1)));
  const stats = new Map(tags.map(tag => [tag.id, { count: 0, netAmount: 0, history: {} as Record<string, number> }]));

  transactions.forEach(transaction => {
    if (!transaction.tagIds?.length) return;
    const amount = convertToEur(transaction.amount, transaction.currency);
    const key = monthKey(parseLocalDate(transaction.date));
    transaction.tagIds.forEach(tagId => {
      const stat = stats.get(tagId);
      if (!stat) return;
      stat.count += 1;
      stat.netAmount = safeAdd(stat.netAmount, amount);
      if (months.includes(key)) stat.history[key] = safeAdd(stat.history[key] || 0, Math.abs(amount));
    });
  });

  return tags.map(tag => {
    const stat = stats.get(tag.id)!;
    return { ...tag, count: stat.count, netAmount: stat.netAmount, history: months.map(key => ({ value: stat.history[key] || 0 })) };
  });
};

export const sortTags = (tags: TagSummary[], sort: TagSort): TagSummary[] =>
  [...tags].sort((a, b) => {
    if (sort === 'amount') return Math.abs(b.netAmount) - Math.abs(a.netAmount);
    if (sort === 'count') return b.count - a.count;
    return a.name.localeCompare(b.name);
  });

/** The share of all transactions with at least one tag. */
export const taggedShare = (transactions: Transaction[]): number => {
  if (transactions.length === 0) return 0;
  return (transactions.filter(transaction => transaction.tagIds?.length).length / transactions.length) * 100;
};
