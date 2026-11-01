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
