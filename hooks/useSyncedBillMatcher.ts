import { useState, useMemo } from 'react';
import { Transaction, RecurringTransaction, BillPayment, Account } from '../types';
import { parseLocalDate, toLocalISOString } from '../utils';
import { MatcherConfig, DEFAULT_MATCHER_CONFIG } from './useMatcherConfig';

export interface SyncedBillMatchSuggestion {
  id: string; // unique identifier for the match suggestion
  transaction: Transaction;
  itemType: 'recurring' | 'bill';
  recurringItem?: RecurringTransaction;
  billItem?: BillPayment;
  matchScore: number; // percentage confidence (e.g. 0 to 100)
  amountDiff: number; // difference in transaction currency
  amountDiffPercent: number; // e.g. 2.5 (%)
  daysDiff: number; // difference in days (e.g. 0, 1, 2)
  matchedDate: string; // planned date YYYY-MM-DD
  matchedAmount: number; // planned amount
  matchedName: string; // planned description or merchant
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Utility for cleaning and comparing merchant / vendor names
export const calculateNameSimilarity = (str1: string, str2: string): number => {
  if (!str1 || !str2) return 0;

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[\d\-_.,/\\#@!$%^&*()+=~`[\]{}|:;<>?]/g, ' ')
      .replace(
        /\b(inc|llc|ltd|gmb|gmbh|sepa|pos|card|payment|direct|debit|transfer|subscription|membership|fee|recurring|corp|corporation|nv|bv|co|company|org)\b/gi,
        ''
      )
      .replace(/\s+/g, ' ')
      .trim();

  const norm1 = normalize(str1);
  const norm2 = normalize(str2);

  if (!norm1 || !norm2) {
    const r1 = str1.toLowerCase().trim();
    const r2 = str2.toLowerCase().trim();
    if (r1 === r2) return 1.0;
    if (r1.includes(r2) || r2.includes(r1)) return 0.8;
    return 0;
  }

  if (norm1 === norm2) return 1.0;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.85;

  const tokens1 = norm1.split(' ').filter(t => t.length >= 2);
  const tokens2 = norm2.split(' ').filter(t => t.length >= 2);

  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  const common = tokens1.filter(t => tokens2.some(t2 => t2.includes(t) || t.includes(t2)));
  if (common.length === 0) return 0;

  return Math.min(1.0, (2 * common.length) / (tokens1.length + tokens2.length));
};

// Helper to get the closest target due date for a recurring transaction relative to txDate
function getClosestRecurringDueDate(rt: RecurringTransaction, txDate: Date): { targetDate: Date; daysDiff: number } {
  const rtNextDate = parseLocalDate(rt.nextDueDate);
  const rtStartDate = rt.startDate ? parseLocalDate(rt.startDate) : rtNextDate;

  const datesToCheck: Date[] = [rtNextDate, rtStartDate];

  const txYear = txDate.getFullYear();
  const txMonth = txDate.getMonth();

  if (rt.frequency === 'monthly') {
    const day = rt.dueDateOfMonth || rtStartDate.getDate() || rtNextDate.getDate() || 1;
    for (let offset = -2; offset <= 2; offset++) {
      const targetMonth = txMonth + offset;
      const d = new Date(txYear, targetMonth, day);
      datesToCheck.push(d);
    }
  } else if (rt.frequency === 'weekly' || rt.frequency === 'biweekly') {
    const intervalDays = rt.frequency === 'biweekly' ? 14 : 7;
    const startMs = rtStartDate.getTime();
    const txMs = txDate.getTime();
    const diffDays = Math.round((txMs - startMs) / ONE_DAY_MS);
    const cycles = Math.round(diffDays / intervalDays);
    const targetMs = startMs + cycles * intervalDays * ONE_DAY_MS;
    datesToCheck.push(new Date(targetMs));
    datesToCheck.push(new Date(targetMs + intervalDays * ONE_DAY_MS));
    datesToCheck.push(new Date(targetMs - intervalDays * ONE_DAY_MS));
  } else if (rt.frequency === 'yearly') {
    const month = rtStartDate.getMonth();
    const day = rtStartDate.getDate();
    for (let offset = -1; offset <= 1; offset++) {
      datesToCheck.push(new Date(txYear + offset, month, day));
    }
  } else if (rt.frequency === 'daily') {
    datesToCheck.push(txDate);
  }

  let closest = datesToCheck[0];
  let minDiffMs = Math.abs(txDate.getTime() - closest.getTime());

  for (let i = 1; i < datesToCheck.length; i++) {
    const diffMs = Math.abs(txDate.getTime() - datesToCheck[i].getTime());
    if (diffMs < minDiffMs) {
      minDiffMs = diffMs;
      closest = datesToCheck[i];
    }
  }

  return {
    targetDate: closest,
    daysDiff: minDiffMs / ONE_DAY_MS,
  };
}

export const useSyncedBillMatcher = (
  transactions: Transaction[],
  recurringTransactions: RecurringTransaction[],
  billsAndPayments: BillPayment[],
  accounts: Account[],
  saveTransaction: (transactionsToSave: (Omit<Transaction, 'id'> & { id?: string })[], idsToDelete?: string[]) => void,
  saveRecurringTransaction: (recurringToSave: RecurringTransaction) => void,
  saveBillPayment: (billToSave: BillPayment) => void,
  config: MatcherConfig = DEFAULT_MATCHER_CONFIG
) => {
  const [ignoredMatchIds, setIgnoredMatchIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('synced_bill_ignored_matches');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const saveIgnoredIds = (ids: string[]) => {
    setIgnoredMatchIds(ids);
    try {
      localStorage.setItem('synced_bill_ignored_matches', JSON.stringify(ids));
    } catch {}
  };

  const suggestions = useMemo(() => {
    const results: SyncedBillMatchSuggestion[] = [];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const lookbackLimit = config.lookbackDays || 7;
    const maxDaysDiff = config.dateVarianceDays ?? 3;
    const maxAmountPercent = config.amountVariancePercent ?? 10;

    // Reference date: latest transaction date in dataset, or today, whichever is later
    let latestTxTime = 0;
    for (const tx of transactions) {
      const t = parseLocalDate(tx.date).getTime();
      if (t > latestTxTime) latestTxTime = t;
    }
    const refTime = Math.max(today.getTime(), latestTxTime);

    // Candidate transactions: non-transfer, non-recurring-linked transactions within lookback window
    const candidateTxs = transactions.filter(tx => {
      if (tx.transferId || tx.recurringSourceId) return false;

      const txDate = parseLocalDate(tx.date);
      const daysOld = (refTime - txDate.getTime()) / ONE_DAY_MS;
      return daysOld <= lookbackLimit && daysOld >= -7;
    });

    if (candidateTxs.length === 0) return results;

    // Track matched item IDs during this run to prevent assigning the same bill/recurring item twice
    const matchedBillIds = new Set<string>();
    const matchedRecurringIds = new Set<string>();

    for (const tx of candidateTxs) {
      const txDate = parseLocalDate(tx.date);
      const txAmountAbs = Math.abs(tx.amount);
      const txMerchantOrDesc = tx.merchant || tx.description;

      let bestMatch: SyncedBillMatchSuggestion | null = null;
      let highestScore = 0;

      // 1. Check against Unpaid Bills
      for (const bill of billsAndPayments) {
        if (bill.status !== 'unpaid') continue;
        if (matchedBillIds.has(bill.id)) continue;

        // Direction / type check
        const isBillPayment = bill.type === 'payment' || bill.amount < 0;
        const isBillDeposit = bill.type === 'deposit' || bill.amount > 0;
        if (tx.type === 'expense' && !isBillPayment) continue;
        if (tx.type === 'income' && !isBillDeposit) continue;

        const billDate = parseLocalDate(bill.dueDate);
        const billAmountAbs = Math.abs(bill.amount);

        // Date variance check
        const daysDiff = Math.abs((txDate.getTime() - billDate.getTime()) / ONE_DAY_MS);
        if (daysDiff > maxDaysDiff + 0.5) continue;

        // Amount variance check
        const amountDiff = Math.abs(txAmountAbs - billAmountAbs);
        const amountDiffPercent = billAmountAbs > 0 ? (amountDiff / billAmountAbs) * 100 : 0;
        if (amountDiffPercent > maxAmountPercent + 0.5 && amountDiff > 2.0) continue;

        // String similarity check
        const nameSim = calculateNameSimilarity(txMerchantOrDesc, bill.description);
        const rawTx = txMerchantOrDesc.toLowerCase();
        const rawBill = bill.description.toLowerCase();
        const isSubstring = rawTx.includes(rawBill) || rawBill.includes(rawTx);

        if (nameSim < 0.2 && !isSubstring) continue;

        // Calculate confidence score (0 - 100)
        const dateScore = Math.max(0, 35 * (1 - daysDiff / (maxDaysDiff + 1)));
        const amountScore = Math.max(0, 35 * (1 - amountDiffPercent / (maxAmountPercent + 1)));
        const nameScore = isSubstring ? Math.max(25, 30 * nameSim) : Math.min(30, 30 * nameSim);
        const score = Math.round(dateScore + amountScore + nameScore);

        if (score >= 35 && score > highestScore) {
          const matchId = `bill-${tx.id}-${bill.id}`;
          if (ignoredMatchIds.includes(matchId)) continue;

          highestScore = score;
          bestMatch = {
            id: matchId,
            transaction: tx,
            itemType: 'bill',
            billItem: bill,
            matchScore: score,
            amountDiff: txAmountAbs - billAmountAbs,
            amountDiffPercent: Math.round(amountDiffPercent * 10) / 10,
            daysDiff: Math.round(daysDiff),
            matchedDate: bill.dueDate,
            matchedAmount: billAmountAbs,
            matchedName: bill.description,
          };
        }
      }

      // 2. Check against Recurring Transactions
      for (const rt of recurringTransactions) {
        if (rt.isSkipped) continue;
        if (matchedRecurringIds.has(rt.id)) continue;

        // Direction check
        if (tx.type !== rt.type && rt.type !== 'transfer') continue;

        const rtAmountAbs = Math.abs(rt.amount);
        const rtMerchantOrDesc = rt.merchant || rt.description;

        // Calculate closest recurring cycle due date
        const { targetDate: rtClosestDate, daysDiff } = getClosestRecurringDueDate(rt, txDate);

        if (daysDiff > maxDaysDiff + 0.5) continue;

        // Amount variance check
        const amountDiff = Math.abs(txAmountAbs - rtAmountAbs);
        const amountDiffPercent = rtAmountAbs > 0 ? (amountDiff / rtAmountAbs) * 100 : 0;
        if (amountDiffPercent > maxAmountPercent + 0.5 && amountDiff > 2.0) continue;

        // String similarity check
        const nameSim = calculateNameSimilarity(txMerchantOrDesc, rtMerchantOrDesc);
        const rawTx = txMerchantOrDesc.toLowerCase();
        const rawRt = rtMerchantOrDesc.toLowerCase();
        const isSubstring = rawTx.includes(rawRt) || rawRt.includes(rawTx);

        if (nameSim < 0.2 && !isSubstring) continue;

        const dateScore = Math.max(0, 35 * (1 - daysDiff / (maxDaysDiff + 1)));
        const amountScore = Math.max(0, 35 * (1 - amountDiffPercent / (maxAmountPercent + 1)));
        const nameScore = isSubstring ? Math.max(25, 30 * nameSim) : Math.min(30, 30 * nameSim);
        const score = Math.round(dateScore + amountScore + nameScore);

        if (score >= 35 && score > highestScore) {
          const matchId = `recurring-${tx.id}-${rt.id}`;
          if (ignoredMatchIds.includes(matchId)) continue;

          highestScore = score;
          bestMatch = {
            id: matchId,
            transaction: tx,
            itemType: 'recurring',
            recurringItem: rt,
            matchScore: score,
            amountDiff: txAmountAbs - rtAmountAbs,
            amountDiffPercent: Math.round(amountDiffPercent * 10) / 10,
            daysDiff: Math.round(daysDiff),
            matchedDate: toLocalISOString(rtClosestDate),
            matchedAmount: rtAmountAbs,
            matchedName: rt.merchant || rt.description,
          };
        }
      }

      if (bestMatch) {
        results.push(bestMatch);
        if (bestMatch.itemType === 'bill' && bestMatch.billItem) {
          matchedBillIds.add(bestMatch.billItem.id);
        } else if (bestMatch.itemType === 'recurring' && bestMatch.recurringItem) {
          matchedRecurringIds.add(bestMatch.recurringItem.id);
        }
      }
    }

    return results;
  }, [transactions, recurringTransactions, billsAndPayments, ignoredMatchIds, config]);

  const confirmMatch = (suggestion: SyncedBillMatchSuggestion) => {
    if (suggestion.itemType === 'bill' && suggestion.billItem) {
      saveBillPayment({
        ...suggestion.billItem,
        status: 'paid',
        accountId: suggestion.transaction.accountId,
        dueDate: suggestion.transaction.date,
      });
      saveTransaction([
        {
          ...suggestion.transaction,
          category: suggestion.transaction.category || 'Bills & Utilities',
        },
      ]);
    } else if (suggestion.itemType === 'recurring' && suggestion.recurringItem) {
      const rt = suggestion.recurringItem;
      saveTransaction([
        {
          ...suggestion.transaction,
          recurringSourceId: rt.id,
          category: rt.category || suggestion.transaction.category,
        },
      ]);

      const postedDate = parseLocalDate(suggestion.transaction.date);
      let nextDueDate = new Date(postedDate);
      const interval = rt.frequencyInterval || 1;
      const startDateLocal = parseLocalDate(rt.startDate);

      switch (rt.frequency) {
        case 'daily':
          nextDueDate.setDate(nextDueDate.getDate() + interval);
          break;
        case 'weekly':
          nextDueDate.setDate(nextDueDate.getDate() + 7 * interval);
          break;
        case 'monthly': {
          const d = rt.dueDateOfMonth || startDateLocal.getDate();
          nextDueDate.setMonth(nextDueDate.getMonth() + interval, 1);
          const lastDayOfNextMonth = new Date(nextDueDate.getFullYear(), nextDueDate.getMonth() + 1, 0).getDate();
          nextDueDate.setDate(Math.min(d, lastDayOfNextMonth));
          break;
        }
        case 'yearly':
          nextDueDate.setFullYear(nextDueDate.getFullYear() + interval);
          break;
      }

      saveRecurringTransaction({
        ...rt,
        nextDueDate: toLocalISOString(nextDueDate),
      });
    }

    saveIgnoredIds([...ignoredMatchIds, suggestion.id]);
  };

  const dismissSuggestion = (suggestion: SyncedBillMatchSuggestion) => {
    saveIgnoredIds([...ignoredMatchIds, suggestion.id]);
  };

  const confirmSelectedBillMatches = (selectedList: SyncedBillMatchSuggestion[]) => {
    const idsToIgnore: string[] = [];
    selectedList.forEach(suggestion => {
      confirmMatch(suggestion);
      idsToIgnore.push(suggestion.id);
    });
    saveIgnoredIds([...ignoredMatchIds, ...idsToIgnore]);
  };

  const dismissSelectedBillMatches = (selectedList: SyncedBillMatchSuggestion[]) => {
    const idsToIgnore = selectedList.map(s => s.id);
    saveIgnoredIds([...ignoredMatchIds, ...idsToIgnore]);
  };

  const confirmAllMatches = () => {
    confirmSelectedBillMatches(suggestions);
  };

  const dismissAllSuggestions = () => {
    dismissSelectedBillMatches(suggestions);
  };

  return {
    billSuggestions: suggestions,
    confirmBillMatch: confirmMatch,
    dismissBillMatch: dismissSuggestion,
    confirmSelectedBillMatches,
    dismissSelectedBillMatches,
    confirmAllBillMatches: confirmAllMatches,
    dismissAllBillMatches: dismissAllSuggestions,
  };
};
