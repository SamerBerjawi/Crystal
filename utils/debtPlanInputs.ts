import type { Account, DebtPlanSettings, LoanPaymentOverrides, Transaction } from '../types';
import { convertToMain, generateAmortizationSchedule } from '../utils';
import { computeAccountDisplayBalance } from './accountsModel';
import type { DebtInput } from './debtPlan';

export interface PlanDebt extends DebtInput {
  type: Account['type'];
  /** Loans bring their rate and payment from the schedule; other debts need them from you. */
  needsDetails: boolean;
  /** Whether the user temporarily excluded this debt (e.g., a credit card paid in full monthly). */
  excluded?: boolean;
  /** Whether a manual rate or payment override is active in settings. */
  hasOverride?: boolean;
}

interface Args {
  accounts: Account[];
  transactions: Transaction[];
  loanPaymentOverrides: LoanPaymentOverrides;
  settings: DebtPlanSettings;
  conversionRates?: Record<string, number>;
}

/**
 * Each open loan, credit card with a carried balance, and other liability you owe on, in your main currency.
 * A loan's balance, rate and payment come from its schedule (the next payment still to make), unless overridden;
 * credit cards and other liabilities use overrides or their own APR/rate and minimum/monthly payment fields.
 * Debts you are owed (Lending) are not yours to pay off and are left out.
 */
export const debtsFromAccounts = ({ accounts, transactions, loanPaymentOverrides, settings, conversionRates }: Args): PlanDebt[] => {
  const byAccount = new Map<string, Transaction[]>();
  transactions.forEach(tx => { const list = byAccount.get(tx.accountId); if (list) list.push(tx); else byAccount.set(tx.accountId, [tx]); });
  const excludedSet = new Set(settings.excludedIds ?? []);
  const out: PlanDebt[] = [];

  accounts
    .filter(a => a.status !== 'closed' && (a.type === 'Loan' || a.type === 'Credit Card' || a.type === 'Other Liabilities'))
    .forEach(account => {
      const txs = byAccount.get(account.id) ?? [];
      const owed = Math.abs(Math.min(0, computeAccountDisplayBalance(account, txs, loanPaymentOverrides, { conversionRates })));
      if (owed < 0.005) return;
      const main = (amount: number) => convertToMain(amount, account.currency, conversionRates);
      const set = settings.overrides?.[account.id];
      const hasOverride = set?.rate !== undefined || set?.payment !== undefined;
      const excluded = excludedSet.has(account.id);

      if (account.type === 'Loan') {
        const schedule = generateAmortizationSchedule(account, txs, loanPaymentOverrides[account.id] || {});
        const next = schedule.find(p => (p.status === 'Upcoming' || p.status === 'Due' || p.status === 'Overdue') && p.totalPayment > 0);
        if (next) {
          const before = next.outstandingBalance + next.principal;
          const monthlyRate = before > 0 ? next.interest / before : 0;
          const baseRate = monthlyRate * 12 * 100;
          const basePayment = account.monthlyPayment || next.totalPayment;
          const rate = set?.rate ?? baseRate;
          const payment = set?.payment ?? basePayment;
          out.push({
            id: account.id,
            name: account.name,
            type: account.type,
            balance: main(before),
            rate,
            minimum: main(payment),
            needsDetails: payment <= 0,
            excluded,
            hasOverride,
          });
          return;
        }
      }

      const defaultRate = account.type === 'Credit Card'
        ? (account.apr ?? account.interestRate ?? 0)
        : (account.interestRate ?? 0);
      const defaultPayment = account.type === 'Credit Card'
        ? (account.minimumPayment ?? account.monthlyPayment ?? 0)
        : (account.monthlyPayment ?? 0);
      const rate = set?.rate ?? defaultRate;
      const payment = set?.payment ?? defaultPayment;
      out.push({
        id: account.id,
        name: account.name,
        type: account.type,
        balance: main(owed),
        rate,
        minimum: main(payment),
        needsDetails: payment <= 0,
        excluded,
        hasOverride,
      });
    });

  return out.sort((a, b) => b.balance - a.balance);
};
