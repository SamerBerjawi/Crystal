import type { Account, Transaction } from '../types';
import { convertToMain, parseLocalDate } from '../utils';
import { DEFAULT_MATCHER_CONFIG, type MatcherConfig } from './matcherConfig';

export type TransferSuggestion = {
  expenseTx: Transaction;
  incomeTx: Transaction;
  id: string; // [tx1.id, tx2.id].sort().join('|')
  matchScore: number; // 0 to 100
  daysDiff: number; // difference in days between expense and income
  amountDiff: number;
  amountDiffPercent: number;
};

// Transfer-related keywords in common banking languages
const TRANSFER_KEYWORDS = [
  'transfer', 'transfers', 'transferred',
  'overboeken', 'overboeking', 'overschrijving',
  'virement', 'virer',
  'überweisung', 'überwiesen',
  'traspaso', 'transferencia',
  'bonifico',
  'internal', 'between accounts',
  'own account', 'my account',
  'naar eigen', 'to own',
];

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Returns 0–20 based on how many transfer keywords appear in either description. */
export function descriptionTransferScore(desc1: string, desc2: string): number {
  const combined = `${desc1} ${desc2}`.toLowerCase();
  let hits = 0;
  for (const kw of TRANSFER_KEYWORDS) {
    if (combined.includes(kw)) {
      hits++;
      if (hits >= 2) break;
    }
  }
  return Math.min(20, hits * 12);
}

const isTransferCandidate = (tx: Transaction): boolean =>
  !tx.transferId &&
  !tx.isSplitParent &&
  !tx.isCombinedParent &&
  !tx.isBalanceAdjustment &&
  !tx.isMarketAdjustment;

/**
 * Finds best 1-to-1 internal transfer pairs (an expense on one account and an income on another)
 * within the configured lookback window and tolerance thresholds.
 */
export function findTransferSuggestions(
  transactions: Transaction[],
  config: MatcherConfig = DEFAULT_MATCHER_CONFIG,
  ignoredSuggestionIds: string[] = [],
  now: Date = new Date(),
): TransferSuggestion[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const refTime = today.getTime();

  const lookbackLimit = config.lookbackDays || 30;
  const maxDaysDiff = config.dateVarianceDays ?? 4;
  const maxAmountPercent = config.amountVariancePercent ?? 10;
  const minScore = config.minMatchScore ?? 45;
  const ignoredSet = new Set(ignoredSuggestionIds);

  const candidates = transactions.filter(tx => {
    if (!isTransferCandidate(tx)) return false;
    const txDate = parseLocalDate(tx.date);
    const daysOld = (refTime - txDate.getTime()) / ONE_DAY_MS;
    return daysOld <= lookbackLimit && daysOld >= -7;
  });

  const expenses = candidates.filter(tx => tx.type === 'expense');
  const incomes = candidates.filter(tx => tx.type === 'income');
  const scoredPairs: TransferSuggestion[] = [];

  for (const expense of expenses) {
    const expenseDate = parseLocalDate(expense.date);
    const expenseDesc = expense.merchant || expense.description || '';
    const expenseAbs = Math.abs(expense.amount);
    const expenseMain = Math.abs(convertToMain(expense.amount, expense.currency));

    for (const income of incomes) {
      if (expense.accountId === income.accountId) continue;

      const incomeDate = parseLocalDate(income.date);
      const daysDiff = Math.abs((expenseDate.getTime() - incomeDate.getTime()) / ONE_DAY_MS);
      if (daysDiff > maxDaysDiff + 0.5) continue;

      const sameCurrency = expense.currency === income.currency;
      const incomeAbs = Math.abs(income.amount);
      const incomeMain = sameCurrency ? incomeAbs : Math.abs(convertToMain(income.amount, income.currency));
      const leftAmount = sameCurrency ? expenseAbs : expenseMain;
      const rightAmount = sameCurrency ? incomeAbs : incomeMain;

      // Skip cross-currency pairs when one side cannot be converted to the main currency.
      if (!sameCurrency && ((expenseAbs > 0 && leftAmount === 0) || (incomeAbs > 0 && rightAmount === 0))) {
        continue;
      }

      const amountDiff = Math.abs(leftAmount - rightAmount);
      const amountDiffPct = rightAmount > 0 ? (amountDiff / rightAmount) * 100 : leftAmount === 0 ? 0 : 100;
      if (amountDiffPct > maxAmountPercent + 0.5 && amountDiff > 2.0) continue;

      const suggestionId = [expense.id, income.id].sort().join('|');
      if (ignoredSet.has(suggestionId)) continue;

      const dateScore = Math.max(0, 40 * (1 - daysDiff / (maxDaysDiff + 1)));
      const amountScore = Math.max(0, 40 * (1 - amountDiffPct / (maxAmountPercent + 1)));
      const incomeDesc = income.merchant || income.description || '';
      const descScore = descriptionTransferScore(expenseDesc, incomeDesc);
      const score = Math.round(dateScore + amountScore + descScore);

      if (score >= minScore) {
        scoredPairs.push({
          expenseTx: expense,
          incomeTx: income,
          id: suggestionId,
          matchScore: score,
          daysDiff: Math.round(daysDiff),
          amountDiff: Math.round((leftAmount - rightAmount) * 100) / 100,
          amountDiffPercent: Math.round(amountDiffPct * 10) / 10,
        });
      }
    }
  }

  // Assign highest-confidence pairs first so a weaker candidate never steals a leg from a better match.
  scoredPairs.sort(
    (a, b) =>
      b.matchScore - a.matchScore ||
      a.daysDiff - b.daysDiff ||
      a.amountDiffPercent - b.amountDiffPercent ||
      a.id.localeCompare(b.id),
  );

  const matchedExpenseIds = new Set<string>();
  const matchedIncomeIds = new Set<string>();
  const result: TransferSuggestion[] = [];

  for (const pair of scoredPairs) {
    if (matchedExpenseIds.has(pair.expenseTx.id) || matchedIncomeIds.has(pair.incomeTx.id)) continue;
    matchedExpenseIds.add(pair.expenseTx.id);
    matchedIncomeIds.add(pair.incomeTx.id);
    result.push(pair);
  }

  return result;
}

/**
 * Returns the expense/income pair when two selected ledger transactions can be linked as
 * an internal transfer across two distinct accounts, or null otherwise.
 */
export function resolveManualTransferPair(
  selectedTransactions: Transaction[],
): { expenseTx: Transaction; incomeTx: Transaction } | null {
  if (selectedTransactions.length !== 2) return null;
  const [first, second] = selectedTransactions;
  if (first.accountId === second.accountId) return null;

  const isEligible = (tx: Transaction) =>
    !tx.transferId && !tx.isSplitParent && !tx.isCombinedParent && !tx.parentTransactionId;
  if (!isEligible(first) || !isEligible(second)) return null;

  const expenseTx = first.type === 'expense' ? first : second.type === 'expense' ? second : null;
  const incomeTx = first.type === 'income' ? first : second.type === 'income' ? second : null;
  if (!expenseTx || !incomeTx) return null;

  return { expenseTx, incomeTx };
}

/** Builds the paired transaction updates that link an expense leg and income leg into one internal transfer. */
export function buildTransferPairUpdates(
  expenseTx: Transaction,
  incomeTx: Transaction,
  accounts: Account[],
  transferId: string,
): [Transaction, Transaction] {
  const expenseAccount = accounts.find(a => a.id === expenseTx.accountId);
  const incomeAccount = accounts.find(a => a.id === incomeTx.accountId);

  let fromAccount = expenseAccount;
  let toAccount = incomeAccount;

  if (expenseAccount && incomeAccount) {
    const toKeywords = ['to ', 'transfer to ', 'naar '];
    const expenseDescIndicatesItIsDestination = toKeywords.some(k =>
      expenseTx.description.toLowerCase().includes(k + expenseAccount.name.toLowerCase()),
    );

    if (expenseDescIndicatesItIsDestination) {
      fromAccount = incomeAccount;
      toAccount = expenseAccount;
    }
  }

  const expenseUpdate: Transaction = {
    ...expenseTx,
    category: 'Transfer',
    transferId,
    description: `Transfer to ${toAccount?.name || 'account'}`,
    ...(expenseTx.needsReview ? { needsReview: false } : {}),
  };

  const incomeUpdate: Transaction = {
    ...incomeTx,
    category: 'Transfer',
    transferId,
    description: `Transfer from ${fromAccount?.name || 'account'}`,
    ...(incomeTx.needsReview ? { needsReview: false } : {}),
  };

  return [expenseUpdate, incomeUpdate];
}
