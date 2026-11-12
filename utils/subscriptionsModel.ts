import type { Currency, Membership, RecurrenceFrequency, RecurringTransaction, Transaction } from '../types';
import { advanceRecurrenceDate, convertCurrency, parseLocalDate, round2, safeAdd, toLocalISOString } from '../utils';
import { addDays, iso, monthlyEquivalent, nextDates, type Converter } from './scheduleModel';

/*
 * Subscriptions model: spotting subscriptions in your transactions, and the figures on the page.
 * Pure, and tested in tests/unit/subscriptionsModel.test.ts.
 */

export interface DetectedSubscription {
  key: string; // Normalized name
  merchant: string;
  amount: number;
  frequency: RecurrenceFrequency;
  confidence: 'high' | 'medium';
  averageDay: number;
  lastDate: string;
  occurrences: number;
  accountId: string;
  currency: Currency;
}

export const normalizeString = (str: string) => {
    if (!str) return '';
    // 1. Lowercase
    let clean = str.toLowerCase();
    
    // 2. Remove common transaction prefixes/gateway noise
    clean = clean.replace(/^(paypal\s*\*|stripe\s*\*|sq\s*\*|apple\s+bill\s*|google\s*\*|amzn\s*\*|amazon\s*\*|g\.co\/helppay#?)/g, '');
    
    // 3. Remove card numbers and ending details (e.g. *1234, x1234, ending in 1234)
    clean = clean.replace(/(ending\s+in\s+\d+|[\s*-]*[x*]+\d{2,4}\b)/g, '');
    
    // 4. Remove transaction reference codes and dates (e.g. #12345, 12-34, 20240401)
    clean = clean.replace(/(#[a-z0-9_-]+|\b\d{4}-\d{2}-\d{2}\b|\b\d{2}\/\d{2}\/\d{4}\b|\b\d{8,}\b)/g, '');
    
    // 5. Remove common corporate suffixes at the end of words or strings
    clean = clean.replace(/\b(inc|llc|ltd|corp|gmbh|co|com|net|org|srl|sas|se|nl|de|fr|uk|holding|holdings|services|group|pay|payment|bill|billing|subscription|member|membership)\b/g, '');
    
    // 6. Keep only a-z and 0-9 to normalize
    clean = clean.replace(/[^a-z0-9]/g, '');
    
    return clean.trim();
};

const calculateFrequency = (intervals: number[]): RecurrenceFrequency | null => {
    if (intervals.length === 0) return null;
    
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    // Standard deviation to ensure consistency
    const variance = intervals.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    // Set variable tolerances based on subscription frequency average interval (in days)
    // - Daily: avg ~1 day, max stdDev = 0.5
    // - Weekly: avg ~7 days, max stdDev = 2.5 (allows 1-2 days weekend shifts)
    // - Biweekly: avg ~14 days, max stdDev = 3.5 (allows weekend shifts)
    // - Monthly: avg ~30 days, max stdDev = 6.0 (allows variable month lengths + weekends)
    // - Yearly: avg ~365 days, max stdDev = 15.0
    let maxStdDev = 5;
    if (avg >= 0.8 && avg <= 1.5) maxStdDev = 0.5;
    else if (avg >= 5 && avg <= 9) maxStdDev = 2.5;
    else if (avg >= 12 && avg <= 16) maxStdDev = 3.5;
    else if (avg >= 25 && avg <= 35) maxStdDev = 6.0;
    else if (avg >= 350 && avg <= 380) maxStdDev = 15.0;

    if (stdDev > maxStdDev) return null;

    if (avg >= 0.8 && avg <= 1.5) return 'daily';
    if (avg >= 5.5 && avg <= 8.5) return 'weekly';
    if (avg >= 12 && avg <= 16) return 'biweekly';
    if (avg >= 25 && avg <= 35) return 'monthly';
    if (avg >= 350 && avg <= 380) return 'yearly';
    
    return null;
};

/** Finds repeating payments that aren't tracked or ignored yet (SUB-02). */
export const detectSubscriptions = (transactions: Transaction[], recurring: RecurringTransaction[], ignored: string[], today: Date): DetectedSubscription[] => {
  const groups: Record<string, Transaction[]> = {};
  const expenseTransactions = transactions.filter(t => t.type === 'expense' && !t.transferId && !t.isBalanceAdjustment && !t.isSplitParent && !t.isCombinedParent);

  // Group by normalized merchant/description
  expenseTransactions.forEach(tx => {
      const targetStr = tx.merchant || tx.description;
      let key = normalizeString(targetStr);
      if (key.length < 3) {
          // Fallback to simpler normalization of description if it was too aggressively cleaned
          key = tx.description.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 12);
      }
      if (key.length >= 3) {
          if (!groups[key]) groups[key] = [];
          groups[key].push(tx);
      }
  });

  const candidates: DetectedSubscription[] = [];

  Object.entries(groups).forEach(([key, groupTxs]) => {
      // Need at least 2 occurrences to detect a pattern
      if (groupTxs.length < 2) return;

      // Check if already tracked or ignored
      const isTracked = recurring.some(rt => {
          const rtStr = rt.merchant || rt.description;
          let rtKey = normalizeString(rtStr);
          if (rtKey.length < 3) {
              rtKey = rt.description.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 12);
          }
          return rtKey.includes(key) || key.includes(rtKey);
      });
      if (isTracked || ignored.includes(key)) return;

      // Sort by date ascending
      groupTxs.sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());

      // Calculate intervals
      const intervals: number[] = [];
      let lastDate = parseLocalDate(groupTxs[0].date);
      
      for (let i = 1; i < groupTxs.length; i++) {
          const currentDate = parseLocalDate(groupTxs[i].date);
          const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          intervals.push(diffDays);
          lastDate = currentDate;
      }
      
      const frequency = calculateFrequency(intervals);
      
      if (frequency) {
          const lastTx = groupTxs[groupTxs.length - 1];
          const targetCurrency = (lastTx.currency || 'EUR') as Currency;
          // Calculate amounts normalized to the latest transaction's currency
          const amounts = groupTxs.map(t => {
            const raw = Math.abs(t.amount);
            return t.currency && t.currency !== targetCurrency ? convertCurrency(raw, t.currency, targetCurrency) : raw;
          });
          const totalAmount = amounts.reduce((sum, a) => sum + a, 0);
          const avgAmount = totalAmount / amounts.length;
          
          // Amount consistency check: real subscriptions have predictable recurring pricing.
          // Discard random shopping / variable spending clustered at the same merchant.
          const minAmount = Math.min(...amounts);
          const maxAmount = Math.max(...amounts);
          const amountVariance = amounts.reduce((sum, a) => sum + Math.pow(a - avgAmount, 2), 0) / amounts.length;
          const amountStdDev = Math.sqrt(amountVariance);
          
          // Allow up to 20% stdDev or <=25% max/min spread (for slight FX or tier adjustments)
          const isAmountAcceptable = amountStdDev <= (avgAmount * 0.20) || ((maxAmount - minAmount) / (avgAmount || 1) <= 0.25);
          if (!isAmountAcceptable && groupTxs.length > 2) return;

          // Recency check: only detect actively ongoing subscriptions.
          // If the service hasn't billed in > 2.5 cycles, it was likely cancelled/abandoned.
          const lastTxDate = parseLocalDate(lastTx.date);
          const daysSinceLast = Math.round((today.getTime() - lastTxDate.getTime()) / (1000 * 60 * 60 * 24));
          
          const maxDaysSinceLast = 
              frequency === 'daily' ? 7 :
              frequency === 'weekly' ? 21 :
              frequency === 'biweekly' ? 35 :
              frequency === 'monthly' ? 65 : 400;

          if (daysSinceLast > maxDaysSinceLast) return;

          const isAmountConsistent = amountStdDev <= (avgAmount * 0.06); // <=6% variation
          const hasManyOccurrences = groupTxs.length >= 3;
          
          // Timing consistency check based on standard deviation of intervals
          const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          const intervalVariance = intervals.reduce((a, b) => a + Math.pow(b - avgInterval, 2), 0) / intervals.length;
          const intervalStdDev = Math.sqrt(intervalVariance);
          const isTimingConsistent = intervalStdDev <= (frequency === 'weekly' ? 1.0 : frequency === 'biweekly' ? 2.0 : frequency === 'monthly' ? 3.0 : 7.0);

          const confidence = (isAmountConsistent && hasManyOccurrences && isTimingConsistent) ? 'high' : 'medium';

          // Use the latest transaction amount to reflect current subscription tier/pricing
          const detectedAmount = Math.round(Math.abs(lastTx.amount) * 100) / 100;

          candidates.push({
              key,
              merchant: lastTx.merchant || lastTx.description, // Use the most recent description
              amount: detectedAmount,
              frequency,
              confidence,
              averageDay: lastDate.getDate(),
              lastDate: lastTx.date,
              occurrences: groupTxs.length,
              accountId: lastTx.accountId,
              currency: lastTx.currency
          });
      }
  });
  return candidates;
};

/** A found subscription as a draft series, due next on or after today. */
export const seriesFromDetected = (candidate: DetectedSubscription, today: Date): Omit<RecurringTransaction, 'id'> => {
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let next = advanceRecurrenceDate(parseLocalDate(candidate.lastDate), candidate.frequency, 1, parseLocalDate(candidate.lastDate).getDate());
  for (let i = 0; next < midnight && i < 36; i++) next = advanceRecurrenceDate(next, candidate.frequency, 1, parseLocalDate(candidate.lastDate).getDate());
  return {
    accountId: candidate.accountId,
    description: candidate.merchant,
    merchant: candidate.merchant,
    amount: candidate.amount,
    type: 'expense',
    category: 'Subscriptions',
    currency: candidate.currency || 'EUR',
    frequency: candidate.frequency,
    frequencyInterval: 1,
    startDate: candidate.lastDate,
    nextDueDate: toLocalISOString(next),
    weekendAdjustment: 'after',
  };
};

const NON_SERVICE_CATEGORIES = new Set(['housing', 'rent', 'mortgage', 'loan', 'loans', 'taxes', 'tax', 'alimony']);

/** A recurring payment that is a service you could cancel, as opposed to rent, a loan or tax. The Subscriptions page's "Services only". */
export const isDigitalOrService = (item: Pick<RecurringTransaction, 'category'>) => {
  const cat = (item.category || '').trim().toLowerCase();
  if (!cat) return true;
  if (cat.includes('subscription') || cat.includes('streaming') || cat.includes('software') || cat.includes('membership')) return true;
  return !NON_SERVICE_CATEGORIES.has(cat);
};

export type ServiceStatus = 'active' | 'paused' | 'cancelled';

export const serviceStatus = (rt: Pick<RecurringTransaction, 'pausedAt' | 'endDate'>, today: Date): ServiceStatus => {
  if (rt.pausedAt) return 'paused';
  return rt.endDate && rt.endDate < iso(today) ? 'cancelled' : 'active';
};

/** Recurring payments you've added yourself, soonest first. */
export const services = (recurring: RecurringTransaction[]) => recurring
  .filter(rt => rt.type === 'expense' && !rt.isSynthetic)
  .sort((a, b) => (a.nextDueDate < b.nextDueDate ? -1 : 1));

export const pauseService = (rt: RecurringTransaction, today: Date): RecurringTransaction => ({ ...rt, pausedAt: iso(today) });

/** Back on: the next payment is the first date from today, never one missed while it was paused. */
export const resumeService = (rt: RecurringTransaction, today: Date): RecurringTransaction => {
  const anchorDay = rt.dueDateOfMonth || parseLocalDate(rt.startDate || rt.nextDueDate).getDate();
  const todayStr = iso(today);
  let next = parseLocalDate(rt.nextDueDate);
  for (let guard = 0; iso(next) < todayStr && guard < 5000; guard++) next = advanceRecurrenceDate(next, rt.frequency, rt.frequencyInterval, anchorDay);
  return { ...rt, pausedAt: undefined, endDate: undefined, nextDueDate: iso(next) };
};

export const cancelService = (rt: RecurringTransaction, today: Date): RecurringTransaction => ({ ...rt, endDate: iso(addDays(today, -1)) });

export interface ServiceTotals { monthly: number; yearly: number; count: number; dueSoon: number; renewing: number; renewingCount: number }

export interface Renewal { service: RecurringTransaction; date: string; amount: number }

/** Every payment in the next `days` days, soonest first (D-028). */
export const renewals = (active: RecurringTransaction[], today: Date, convert: Converter, days = 30): Renewal[] => {
  const end = iso(addDays(today, days));
  return active
    .flatMap(service => nextDates(service, today, 40).filter(date => date <= end).map(date => ({ service, date, amount: convert(Math.abs(service.amount), service.currency) })))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
};

export const serviceTotals = (active: RecurringTransaction[], today: Date, convert: Converter): ServiceTotals => {
  const monthly = round2(active.reduce((sum, rt) => safeAdd(sum, convert(monthlyEquivalent(rt), rt.currency)), 0));
  const soon = iso(addDays(today, 7));
  const coming = renewals(active, today, convert);
  return {
    monthly,
    yearly: round2(monthly * 12),
    count: active.length,
    dueSoon: active.filter(rt => rt.nextDueDate >= iso(today) && rt.nextDueDate <= soon).length,
    renewing: round2(coming.reduce((sum, item) => safeAdd(sum, item.amount), 0)),
    renewingCount: coming.length,
  };
};

/** What paused services would cost each month. */
export const savedByPausing = (paused: RecurringTransaction[], convert: Converter) =>
  round2(paused.reduce((sum, rt) => safeAdd(sum, convert(monthlyEquivalent(rt), rt.currency)), 0));

/** Cards that run out within `days` days (including today). */
export const expiringCards = (cards: Membership[], today: Date, days = 30) => {
  const from = iso(today);
  const to = iso(addDays(today, days));
  return cards.filter(card => !!card.expiryDate && card.expiryDate.slice(0, 10) >= from && card.expiryDate.slice(0, 10) <= to);
};

export interface SubscriptionPriceChange {
  key: string;
  service: RecurringTransaction;
  previousAmount: number;
  newAmount: number;
  date: string;
}

/**
 * Determines whether a transaction matches an active recurring subscription by comparing full detail.
 * Prevents false positives where unrelated transactions sharing only a parent merchant name
 * (e.g. general banking fees from KBC vs. a specific "Complimentary Pension Plan" or mortgage)
 * would otherwise be flagged as price changes.
 */
export const matchesSubscriptionDetail = (rt: RecurringTransaction, tx: Transaction): boolean => {
  // 1. Explicit link is definitive
  if (tx.recurringSourceId === rt.id) return true;

  // 2. Account mismatch check: if both specify an account, they must match
  if (rt.accountId && tx.accountId && rt.accountId !== tx.accountId) return false;

  // 3. Date check: transaction cannot precede the subscription start date
  if (rt.startDate && tx.date < rt.startDate) return false;

  // 4. Category compatibility check (if both specify specific categories)
  if (rt.category && tx.category) {
    const c1 = rt.category.trim().toLowerCase();
    const c2 = tx.category.trim().toLowerCase();
    const isGeneric = (c: string) =>
      c === 'uncategorised' || c === 'other' || c === 'general' || c === 'subscriptions';
    if (!isGeneric(c1) && !isGeneric(c2) && c1 !== c2 && !c1.includes(c2) && !c2.includes(c1)) {
      return false;
    }
  }

  const rtMerchant = normalizeString(rt.merchant || '');
  const rtDesc = normalizeString(rt.description || '');
  const txMerchant = normalizeString(tx.merchant || '');
  const txDesc = normalizeString(tx.description || '');
  const txRaw = `${tx.merchant || ''} ${tx.description || ''}`.toLowerCase();

  // Case A: Subscription has a distinct description different from merchant
  // (e.g. merchant: "KBC", description: "Complimentary Pension Plan" or "Mortgage")
  if (rtDesc && rtMerchant && rtDesc !== rtMerchant) {
    const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'from', 'monthly', 'recurring', 'plan', 'payment']);
    const descTokens = (rt.description || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(w => w.length >= 3 && !STOPWORDS.has(w));

    const exactNormDescMatch = txDesc === rtDesc || txDesc.includes(rtDesc) || normalizeString(txRaw).includes(rtDesc);
    const tokensMatch = descTokens.length > 0 && descTokens.some(token => txRaw.includes(token));

    if (!exactNormDescMatch && !tokensMatch) {
      return false;
    }

    // Also verify merchant consistency if transaction specifies one
    if (txMerchant && rtMerchant && !txMerchant.includes(rtMerchant) && !rtMerchant.includes(txMerchant)) {
      return false;
    }

    return true;
  }

  // Case B: Subscription description is identical to merchant or one is missing (e.g. "Netflix")
  const primaryKey = rtMerchant || rtDesc;
  if (!primaryKey || primaryKey.length < 3) return false;

  if (txMerchant === primaryKey || txDesc === primaryKey) return true;

  // Check word boundary match in raw transaction detail
  const rawKey = (rt.merchant || rt.description || '').toLowerCase().trim();
  if (rawKey.length >= 3) {
    const cleanKey = rawKey.replace(/[^a-z0-9]/g, '');
    if (cleanKey.length >= 3 && txRaw.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).includes(cleanKey)) {
      return true;
    }
  }

  return normalizeString(txRaw) === primaryKey;
};

/** Detects active recurring services whose latest matching transaction differs in price (converted to the service's currency). */
export const priceChanges = (
  active: RecurringTransaction[],
  transactions: Transaction[],
  dismissedKeys: string[] = []
): SubscriptionPriceChange[] => {
  const changes: SubscriptionPriceChange[] = [];
  for (const rt of active) {
    const expected = round2(Math.abs(rt.amount));
    if (expected <= 0) continue;

    const matching = transactions
      .filter(
        tx =>
          tx.type === 'expense' &&
          !tx.transferId &&
          !tx.isBalanceAdjustment &&
          !tx.isSplitParent &&
          !tx.isCombinedParent
      )
      .filter(tx => matchesSubscriptionDetail(rt, tx))
      .sort((a, b) => b.date.localeCompare(a.date));

    const latest = matching[0];
    if (!latest) continue;

    const rtCurrency = (rt.currency || 'EUR') as Currency;
    const latestInRtCurrency = round2(
      latest.currency && latest.currency !== rtCurrency
        ? convertCurrency(Math.abs(latest.amount), latest.currency, rtCurrency)
        : Math.abs(latest.amount)
    );

    const diff = Math.abs(latestInRtCurrency - expected);

    // Plausible subscription price change bounds:
    // An unlinked match must fall within 0.5x to 2.0x of expected amount to prevent
    // small incidental fees or large unrelated purchases from triggering false price alerts.
    const isExplicitlyLinked = latest.recurringSourceId === rt.id;
    if (!isExplicitlyLinked) {
      if (latestInRtCurrency < expected * 0.5 || latestInRtCurrency > expected * 2.0) {
        continue;
      }
    }

    if (diff >= 0.5 && diff / expected >= 0.03 && diff / expected <= 1.0) {
      const key = `${rt.id}:${latest.id}:${latestInRtCurrency}`;
      if (!dismissedKeys.includes(key)) {
        changes.push({
          key,
          service: rt,
          previousAmount: expected,
          newAmount: latestInRtCurrency,
          date: latest.date,
        });
      }
    }
  }
  return changes;
};

/**
 * Gives each label on a timeline a lane so none overlap. Positions are sorted, in the same units as the width. A label
 * with no free lane gets null and shows as a dot alone, which keeps its own name and date.
 */
export const assignLabelLanes = (positions: number[], labelWidth: number, laneCount: number): (number | null)[] => {
  const laneEnds: number[] = Array(laneCount).fill(-Infinity);
  return positions.map(position => {
    const lane = laneEnds.findIndex(end => position - labelWidth / 2 >= end);
    if (lane === -1) return null;
    laneEnds[lane] = position + labelWidth / 2;
    return lane;
  });
};

