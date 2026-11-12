import { round2 } from '../utils';

/*
 * Debt payoff plans: how long, and how much interest, under three ways of paying the same money.
 * Pure, and tested in tests/unit/debtPlan.test.ts.
 *
 *  - minimums: every debt gets its own payment and nothing more. A debt that is paid off does not hand its payment on.
 *  - avalanche: the whole budget stays the same (all minimums plus the extra), and what is left after the minimums goes
 *    to the debt with the highest rate. Paid-off debts hand their payment on.
 *  - snowball: the same, but to the smallest balance first.
 *
 * Interest accrues monthly at the annual rate divided by 12, on the balance after the last payment.
 */

export interface DebtInput {
  id: string;
  name: string;
  /** Owed today, a positive amount. */
  balance: number;
  /** Annual rate in percent. */
  rate: number;
  /** What is paid each month, at least. */
  minimum: number;
}

export type Strategy = 'avalanche' | 'snowball' | 'minimums';

export interface PlanResult {
  strategy: Strategy;
  /** Months until everything is paid, or null when it never is within the horizon. */
  months: number | null;
  /** The month everything is paid, as YYYY-MM. */
  payoff: string | null;
  /** Interest paid over the plan (to the horizon when it never finishes). */
  interest: number;
  /** In the order they were cleared. Debts still open at the horizon are left out. */
  order: { id: string; name: string; month: number }[];
  /** Total owed at the end of each month, starting with today at index 0. */
  balances: number[];
  /** Debts whose payment does not even cover their interest, so they only grow under this plan. */
  stuck: string[];
}

export interface PlanComparison {
  extra: number;
  minimums: PlanResult;
  avalanche: PlanResult;
  snowball: PlanResult;
  /** The strategy with the least interest; avalanche on a tie. */
  cheapest: 'avalanche' | 'snowball';
  /** Interest the extra saves against paying minimums only, for each strategy. */
  saved: { avalanche: number; snowball: number };
}

export const HORIZON_MONTHS = 600;

const monthKey = (today: Date, months: number) => {
  const d = new Date(today.getFullYear(), today.getMonth() + months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const simulatePlan = (debts: DebtInput[], extra: number, strategy: Strategy, today: Date): PlanResult => {
  const live = debts.filter(d => d.balance > 0.005 && d.minimum > 0).map(d => ({ ...d, balance: round2(d.balance), monthly: d.rate / 100 / 12 }));
  const extraPerMonth = strategy === 'minimums' ? 0 : Math.max(0, extra);
  const budget = live.reduce((sum, d) => sum + d.minimum, 0) + extraPerMonth;
  const stuck = live.filter(d => d.minimum <= round2(d.balance * d.monthly) + 1e-9 && extraPerMonth === 0).map(d => d.id);
  const balances = [round2(live.reduce((sum, d) => sum + d.balance, 0))];
  const order: PlanResult['order'] = [];
  let interest = 0;
  let month = 0;
  const priority = (a: typeof live[number], b: typeof live[number]) =>
    strategy === 'snowball' ? a.balance - b.balance || b.rate - a.rate : b.rate - a.rate || a.balance - b.balance;

  while (live.some(d => d.balance > 0.005) && month < HORIZON_MONTHS) {
    month++;
    live.forEach(d => { if (d.balance > 0) { const charge = round2(d.balance * d.monthly); d.balance = round2(d.balance + charge); interest = round2(interest + charge); } });
    let pool = strategy === 'minimums' ? 0 : budget;
    if (strategy === 'minimums') live.forEach(d => { const pay = Math.min(d.minimum, d.balance); d.balance = round2(d.balance - pay); });
    else {
      // Everyone's minimum first, then whatever the budget has left goes down the priority list.
      live.forEach(d => { const pay = Math.min(d.minimum, d.balance); d.balance = round2(d.balance - pay); pool = round2(pool - pay); });
      for (const d of [...live].filter(x => x.balance > 0.005).sort(priority)) {
        if (pool <= 0) break;
        const pay = Math.min(pool, d.balance);
        d.balance = round2(d.balance - pay);
        pool = round2(pool - pay);
      }
    }
    live.forEach(d => { if (d.balance <= 0.005 && d.balance !== 0) d.balance = 0; });
    live.forEach(d => { if (d.balance === 0 && !order.some(o => o.id === d.id)) order.push({ id: d.id, name: d.name, month }); });
    balances.push(round2(live.reduce((sum, d) => sum + d.balance, 0)));
  }

  const done = live.every(d => d.balance <= 0.005);
  return { strategy, months: done ? month : null, payoff: done ? monthKey(today, month) : null, interest, order, balances, stuck };
};

export const comparePlans = (debts: DebtInput[], extra: number, today: Date): PlanComparison => {
  const minimums = simulatePlan(debts, extra, 'minimums', today);
  const avalanche = simulatePlan(debts, extra, 'avalanche', today);
  const snowball = simulatePlan(debts, extra, 'snowball', today);
  return {
    extra, minimums, avalanche, snowball,
    cheapest: snowball.interest < avalanche.interest - 0.005 ? 'snowball' : 'avalanche',
    saved: { avalanche: round2(minimums.interest - avalanche.interest), snowball: round2(minimums.interest - snowball.interest) },
  };
};
