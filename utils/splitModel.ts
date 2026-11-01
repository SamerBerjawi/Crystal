import { Transaction } from '../types';
import { round2, safeRound } from '../utils';
import { parseAmountInput } from './scheduleModel';

export interface SplitPart {
  id: string;
  amount: string;
  category: string;
  description: string;
}

const amountOf = (part: SplitPart) => parseAmountInput(part.amount) || 0;

/** Two parts that add up exactly, so an odd cent goes to the second. */
export const initialParts = (tx: Transaction): SplitPart[] => {
  const total = Math.abs(tx.amount);
  const half = Math.floor((total / 2) * 100) / 100;
  return [
    { id: '1', amount: half.toFixed(2), category: tx.category, description: `${tx.description} (Part 1)` },
    { id: '2', amount: round2(total - half).toFixed(2), category: tx.category, description: `${tx.description} (Part 2)` },
  ];
};

export const amountLeft = (tx: Transaction, parts: SplitPart[]) => safeRound(Math.abs(tx.amount) - parts.reduce((sum, part) => sum + amountOf(part), 0), 2);

export const buildSplit = (tx: Transaction, parts: SplitPart[], stamp = Date.now()) => ({
  parent: { ...tx, isSplitParent: true } as Transaction,
  subTransactions: parts.map((part, index): Transaction => ({
    ...tx,
    id: `split-${tx.id}-${index}-${stamp}`,
    parentTransactionId: tx.id,
    isSplitParent: false,
    isCombinedParent: false,
    amount: (tx.amount >= 0 ? 1 : -1) * safeRound(amountOf(part), 2),
    category: part.category || tx.category,
    description: part.description.trim() || `${tx.description} (Part ${index + 1})`,
  })),
});
