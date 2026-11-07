import type { Currency, RecurringTransaction, Transaction } from '../types';
import { convertCurrency, getMainCurrency, parseLocalDate, round2, safeAdd } from '../utils';
import { addDays, iso, monthlyEquivalent, type Converter } from './scheduleModel';
import { normalizeString } from './subscriptionsModel';

/*
 * Subscription audit: what your active services cost, and what is worth a second look. Pure, and tested in
 * tests/unit/subscriptionAudit.test.ts. It only reads what Crystal already holds, so a finding is a question
 * ("still using this?") and never a claim about the provider.
 */

export type AuditKind = 'creep' | 'stale' | 'overlap' | 'trial';

/** A sentence in pieces, so amounts can be drawn by the money component and hidden in privacy mode. */
export type DetailPart = string | { amount: number; currency: Currency };

export interface AuditFinding {
  /** Changes when the facts change, so a dismissed finding comes back if it gets worse. */
  key: string;
  kind: AuditKind;
  /** The service the finding is about; for an overlap, the dearest one. */
  service: RecurringTransaction;
  /** Every service involved. One for creep, stale and trial. */
  services: RecurringTransaction[];
  title: string;
  detail: DetailPart[];
  /** What acting on it could save in a year, in the main currency. Zero when nothing is saved by it. */
  yearlySaving: number;
  /** The one service that would be cancelled to get that saving. For an overlap, the cheapest. */
  savingServiceId?: string;
}

export interface AuditCost { service: RecurringTransaction; yearly: number }

export interface SubscriptionAudit {
  yearlyCost: number;
  /** Share of the last 12 months' income, 0 to 1. Undefined without income. */
  incomeShare?: number;
  findings: AuditFinding[];
  /** Up to the most that acting on every finding could save in a year. */
  potentialSaving: number;
  priciest: AuditCost[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const daysBetween = (from: string, to: string) => Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / DAY_MS);

/** Services that people tend to double up on. A shared category elsewhere (two loans, say) is not a finding. */
const OVERLAP_WORDS = ['stream', 'video', 'music', 'tv', 'news', 'cloud', 'storage', 'game', 'gaming', 'fitness', 'gym', 'software', 'app', 'subscription', 'podcast', 'book', 'learning'];
const overlapProne = (category: string) =>
  category.toLowerCase().split(/[^a-z]+/).some(token => OVERLAP_WORDS.some(word => token === word || token === `${word}s` || (word.length > 4 && token.startsWith(word))));

const intervalDays = (rt: RecurringTransaction) => {
  const step = Math.max(1, rt.frequencyInterval || 1);
  const base = rt.frequency === 'daily' ? 1 : rt.frequency === 'weekly' ? 7 : rt.frequency === 'biweekly' ? 14 : rt.frequency === 'yearly' ? 365 : 30;
  return base * step;
};

const yearlyOf = (rt: RecurringTransaction, convert: Converter) => round2(convert(monthlyEquivalent(rt) * 12, rt.currency));
const label = (rt: RecurringTransaction) => rt.merchant || rt.description;

/**
 * Real charges that belong to a service, oldest first, in the service's own currency. Charges linked to the series
 * always count. Others are matched by name, and only from the day the series starts: an older charge at the same
 * merchant may be another plan, and "since you started" should not reach back before you did.
 */
const chargesOf = (rt: RecurringTransaction, transactions: Transaction[]) => {
  const name = normalizeString(rt.merchant || rt.description);
  const currency = (rt.currency || 'EUR') as Currency;
  return transactions
    .filter(tx => tx.type === 'expense' && !tx.transferId && !tx.isBalanceAdjustment && !tx.isSplitParent && !tx.isCombinedParent)
    .filter(tx => tx.recurringSourceId === rt.id || (name.length >= 3 && tx.date >= rt.startDate && normalizeString(tx.merchant || tx.description) === name))
    .map(tx => ({ id: tx.id, date: tx.date, amount: round2(tx.currency && tx.currency !== currency ? convertCurrency(Math.abs(tx.amount), tx.currency, currency) : Math.abs(tx.amount)) }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

export const subscriptionAudit = (
  active: RecurringTransaction[],
  transactions: Transaction[],
  today: Date,
  convert: Converter,
  /** Keys the user dismissed. */
  dismissed: string[] = [],
): SubscriptionAudit => {
  const todayIso = iso(today);
  const findings: AuditFinding[] = [];

  active.forEach(rt => {
    const charges = chargesOf(rt, transactions).filter(charge => charge.date <= todayIso);
    const first = charges[0];
    const last = charges[charges.length - 1];
    const perYear = Math.max(1, Math.round(365 / intervalDays(rt)));

    if (first && last && first.id !== last.id && first.amount > 0) {
      const rise = last.amount - first.amount;
      if (rise >= 0.5 && rise / first.amount >= 0.05) {
        findings.push({
          key: `audit:creep:${rt.id}:${last.id}`, kind: 'creep', service: rt, services: [rt], yearlySaving: 0,
          title: `${label(rt)} has crept up ${Math.round((rise / first.amount) * 100)}%`,
          detail: ['It was ', { amount: first.amount, currency: rt.currency }, ` in ${first.date.slice(0, 7)} and is now `, { amount: last.amount, currency: rt.currency }, ', about ', { amount: round2(convert(rise * perYear, rt.currency)), currency: getMainCurrency() }, ' a year more than at the start.'],
        });
      }
    }

    if (last && !rt.trialEndsOn) {
      const quiet = daysBetween(last.date, todayIso);
      const threshold = Math.max(45, Math.round(intervalDays(rt) * 2.5));
      if (quiet > threshold && daysBetween(rt.startDate, todayIso) > threshold) {
        findings.push({
          key: `audit:stale:${rt.id}:${last.date}`, kind: 'stale', service: rt, services: [rt], yearlySaving: 0,
          title: `No charge from ${label(rt)} since ${last.date}`,
          detail: [`That is ${quiet} days, longer than a ${rt.frequency} payment should take. It may have ended, or be paid from an account Crystal does not see. It still counts in your totals and forecast.`],
        });
      }
    }

    if (rt.trialEndsOn && rt.trialEndsOn >= todayIso && rt.trialEndsOn <= iso(addDays(today, 14))) {
      findings.push({
        key: `audit:trial:${rt.id}:${rt.trialEndsOn}`, kind: 'trial', service: rt, services: [rt], yearlySaving: yearlyOf(rt, convert), savingServiceId: rt.id,
        title: `${label(rt)} trial ends ${rt.trialEndsOn}`,
        detail: ['The first charge of ', { amount: Math.abs(rt.amount), currency: rt.currency }, ' follows. Cancel before then if you do not want to keep it.'],
      });
    }
  });

  const groups = new Map<string, RecurringTransaction[]>();
  active.filter(rt => rt.category && overlapProne(rt.category)).forEach(rt => {
    const key = rt.category!.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), rt]);
  });
  groups.forEach((members, category) => {
    if (members.length < 2) return;
    const ranked = [...members].sort((a, b) => yearlyOf(b, convert) - yearlyOf(a, convert));
    const cheapest = ranked[ranked.length - 1];
    findings.push({
      key: `audit:overlap:${category}:${members.map(m => m.id).sort().join(',')}`, kind: 'overlap', service: ranked[0], services: ranked, yearlySaving: yearlyOf(cheapest, convert), savingServiceId: cheapest.id,
      title: `${members.length} services in ${members[0].category}`,
      detail: [`${ranked.map(label).join(', ')} together cost `, { amount: round2(ranked.reduce((sum, m) => safeAdd(sum, yearlyOf(m, convert)), 0)), currency: getMainCurrency() }, ` a year. Dropping the cheapest, ${label(cheapest)}, saves `, { amount: yearlyOf(cheapest, convert), currency: getMainCurrency() }, '.'],
    });
  });

  const visible = findings.filter(finding => !dismissed.includes(finding.key));
  const yearlyCost = round2(active.reduce((sum, rt) => safeAdd(sum, yearlyOf(rt, convert)), 0));

  const yearStart = iso(addDays(today, -365));
  const income = transactions
    .filter(tx => tx.type === 'income' && !tx.transferId && !tx.isBalanceAdjustment && !tx.isMarketAdjustment && !tx.isSplitParent && !tx.isCombinedParent && tx.date >= yearStart && tx.date <= todayIso)
    .reduce((sum, tx) => safeAdd(sum, convert(Math.abs(tx.amount), tx.currency)), 0);

  return {
    yearlyCost,
    incomeShare: income > 0 ? yearlyCost / income : undefined,
    findings: visible,
    // A trial and an overlap can name the same service; each service counts once, at the larger saving.
    potentialSaving: round2(Object.values(visible.reduce<Record<string, number>>((best, f) => {
      if (f.savingServiceId && f.yearlySaving > (best[f.savingServiceId] ?? 0)) best[f.savingServiceId] = f.yearlySaving;
      return best;
    }, {})).reduce((sum, value) => safeAdd(sum, value), 0)),
    priciest: active.map(service => ({ service, yearly: yearlyOf(service, convert) })).sort((a, b) => b.yearly - a.yearly).slice(0, 3),
  };
};
