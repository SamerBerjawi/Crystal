import type { Account, Category, Currency, Page, RecurringTransaction, Transaction } from '../types';
import { round2, safeAdd } from '../utils';
import { averageMonthlySpend, budgetAccountIds, monthBounds, monthOf, shiftMonth, spendByCategory, type Month } from './budgetModel';
import { monthlyEquivalent } from './scheduleModel';
import { serviceStatus, services } from './subscriptionsModel';

/*
 * Insight cards. Plain observations about your money, each one with a reason to look: a dip below zero ahead, cash
 * sitting idle, a category running hot, a swing in your savings rate, what your subscriptions add up to. Pure and
 * strict-typed, so it is unit tested (tests/unit/insightsModel.test.ts). Amounts are converted by an injected
 * `convert`, and written by an injected `format`, so this file needs no rates or locale.
 */

export type InsightKind = 'cashFlow' | 'idleCash' | 'spendingAnomaly' | 'savingsRate' | 'subscriptions';
export type InsightTone = 'attention' | 'positive' | 'neutral';

export interface Insight {
  /** Stable for one observation, and carrying its period, so a dismissed card returns the next month. */
  id: string;
  kind: InsightKind;
  tone: InsightTone;
  title: string;
  body: string;
  /** Where "Open" goes. */
  page?: Page;
}

export interface InsightInput {
  today: Date;
  accounts: Account[];
  /** Transactions to learn from; the caller leaves out what it excludes from analytics. */
  transactions: Transaction[];
  categories: Category[];
  /** Recurring series the user created (not the synthetic loan, card and property ones). */
  recurring: RecurringTransaction[];
  /** The lowest projected total balance over the next few months. */
  lowestBalance?: { date: string; total: number };
  convert: (amount: number, currency: Currency) => number;
  format: (amount: number) => string;
}

const monthKey = (m: Month) => `${m.year}-${String(m.month + 1).padStart(2, '0')}`;
const PRIOR_MONTHS = 3;

/** An average month's spending is the yardstick for several cards. */
const averageSpendTotal = (input: InsightInput, current: Month) => {
  const opts = { accountIds: budgetAccountIds(input.accounts), categories: input.categories, convert: input.convert };
  const byCategory = averageMonthlySpend(input.transactions, current, PRIOR_MONTHS, opts);
  return { byCategory, opts, total: [...byCategory.values()].reduce((sum, value) => safeAdd(sum, value), 0) };
};

/** The balance is projected to go below zero. */
export const cashFlowWarning = (input: InsightInput): Insight[] => {
  const low = input.lowestBalance;
  if (!low || !(low.total < 0)) return [];
  return [{
    id: `cashFlow-${low.date}`,
    kind: 'cashFlow',
    tone: 'attention',
    title: 'Your balance is heading below zero',
    body: `The forecast reaches ${input.format(low.total)} on ${low.date}. Move money in or move a payment before then.`,
    page: 'Forecasting',
  }];
};

/** Checking holds far more than the next couple of months need. */
export const idleCash = (input: InsightInput): Insight[] => {
  const current = monthOf(input.today);
  const { total: monthly } = averageSpendTotal(input, current);
  if (!(monthly > 0)) return [];
  const checking = input.accounts
    .filter(a => a.type === 'Checking' && a.status !== 'closed')
    .reduce((sum, a) => safeAdd(sum, input.convert(a.balance, a.currency)), 0);
  const idle = round2(checking - 2 * monthly);
  if (idle < Math.max(500, monthly * 0.5)) return [];
  return [{
    id: `idleCash-${monthKey(current)}`,
    kind: 'idleCash',
    tone: 'neutral',
    title: `${input.format(idle)} is sitting idle`,
    body: `Your checking accounts hold ${input.format(checking)}, and you spend about ${input.format(monthly)} a month. Savings or investments could put the extra to work.`,
    page: 'Accounts',
  }];
};

/** A category already past 150% of its usual month, and by a worthwhile amount. */
export const spendingAnomalies = (input: InsightInput, limit = 2): Insight[] => {
  const current = monthOf(input.today);
  const { byCategory, opts } = averageSpendTotal(input, current);
  const spent = spendByCategory(input.transactions, monthBounds(current), opts);
  return [...byCategory.entries()]
    .map(([category, usual]) => ({ category, usual, now: spent.get(category) ?? 0 }))
    .filter(item => item.now >= item.usual * 1.5 && item.now - item.usual >= 50)
    .sort((a, b) => (b.now - b.usual) - (a.now - a.usual))
    .slice(0, limit)
    .map(item => ({
      id: `spendingAnomaly-${item.category}-${monthKey(current)}`,
      kind: 'spendingAnomaly' as const,
      tone: 'attention' as const,
      title: `${item.category} is running high`,
      body: `${input.format(item.now)} so far this month, against about ${input.format(item.usual)} in a usual month.`,
      page: 'Budget' as const,
    }));
};

/** Income and spending of one month, transfers and adjustments left out. */
const monthFlow = (input: InsightInput, m: Month) => {
  const { from, to } = monthBounds(m);
  let income = 0;
  let spend = 0;
  for (const t of input.transactions) {
    const day = t.date.slice(0, 10);
    if (day < from || day > to) continue;
    if (t.transferId || t.isBalanceAdjustment || t.isSplitParent || t.isCombinedParent) continue;
    const amount = Math.abs(input.convert(t.amount, t.currency));
    if (t.type === 'income') income = safeAdd(income, amount);
    else if (t.type === 'expense') spend = safeAdd(spend, amount);
  }
  return { income, spend };
};

/** Last full month's savings rate against the three before it, when it moved by 10 points or more. */
export const savingsRateChange = (input: InsightInput): Insight[] => {
  const last = shiftMonth(monthOf(input.today), -1);
  const rate = (m: Month) => {
    const { income, spend } = monthFlow(input, m);
    return income > 0 ? ((income - spend) / income) * 100 : null;
  };
  const latest = rate(last);
  const before = [1, 2, 3].map(back => rate(shiftMonth(last, -back))).filter((r): r is number => r !== null);
  if (latest === null || before.length < 2) return [];
  const usual = before.reduce((sum, r) => sum + r, 0) / before.length;
  const delta = latest - usual;
  if (Math.abs(delta) < 10) return [];
  const up = delta > 0;
  return [{
    id: `savingsRate-${monthKey(last)}`,
    kind: 'savingsRate',
    tone: up ? 'positive' : 'attention',
    title: up ? 'You saved more than usual' : 'You saved less than usual',
    body: `You kept ${Math.round(latest)}% of your income last month, ${up ? 'up' : 'down'} ${Math.round(Math.abs(delta))} points on the ${Math.round(usual)}% of the months before.`,
    page: 'Reports' as Page,
  }];
};

/** What the active subscriptions add up to, with the biggest one and any free trial ending soon. */
export const subscriptionAudit = (input: InsightInput): Insight[] => {
  const active = services(input.recurring).filter(rt => serviceStatus(rt, input.today) === 'active');
  if (active.length < 3) return [];
  const priced = active.map(rt => ({ rt, monthly: input.convert(monthlyEquivalent(rt), rt.currency) }));
  const monthly = round2(priced.reduce((sum, item) => safeAdd(sum, item.monthly), 0));
  if (!(monthly > 0)) return [];
  const biggest = priced.reduce((top, item) => (item.monthly > top.monthly ? item : top), priced[0]);
  const todayStr = input.today.toISOString().slice(0, 10);
  const soon = new Date(input.today.getFullYear(), input.today.getMonth(), input.today.getDate() + 7).toISOString().slice(0, 10);
  const trial = active.find(rt => rt.trialEndsOn && rt.trialEndsOn >= todayStr && rt.trialEndsOn <= soon);
  const parts = [
    `${active.length} subscriptions cost ${input.format(monthly)} a month, ${input.format(round2(monthly * 12))} a year.`,
    `${biggest.rt.merchant || biggest.rt.description} is the biggest at ${input.format(round2(biggest.monthly))} a month.`,
  ];
  if (trial) parts.push(`${trial.merchant || trial.description}'s free trial ends on ${trial.trialEndsOn}.`);
  return [{
    id: `subscriptions-${monthKey(monthOf(input.today))}`,
    kind: 'subscriptions',
    tone: trial ? 'attention' : 'neutral',
    title: 'Check what you subscribe to',
    body: parts.join(' '),
    page: 'Subscriptions',
  }];
};

const TONE_ORDER: Record<InsightTone, number> = { attention: 0, positive: 1, neutral: 2 };

/** Every card, the ones that need you first. */
export const generateInsights = (input: InsightInput): Insight[] =>
  [
    ...cashFlowWarning(input),
    ...spendingAnomalies(input),
    ...savingsRateChange(input),
    ...idleCash(input),
    ...subscriptionAudit(input),
  ].sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);

/** Without the cards you dismissed. */
export const visibleInsights = (insights: Insight[], dismissed: string[]) => insights.filter(insight => !dismissed.includes(insight.id));
