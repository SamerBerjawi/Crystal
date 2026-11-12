import type { Account, DebtPlanSettings, LoanPaymentOverrides, Transaction } from '../types';
import { convertToMain, generateAmortizationSchedule } from '../utils';
import { computeAccountDisplayBalance } from './accountsModel';
import type { DebtInput } from './debtPlan';

export interface PlanDebt extends DebtInput {
  type: Account['type'];
  /** Loans bring their rate and payment from the schedule; other debts need them from you. */
  needsDetails: boolean;
}

interface Args {
  accounts: Account[];
  transactions: Transaction[];
  loanPaymentOverrides: LoanPaymentOverrides;
  settings: DebtPlanSettings;
  conversionRates?: Record<string, number>;
}

/**
 * Each open loan and other liability you owe on, in your main currency. A loan's balance, rate and payment come from its
 * schedule (the next payment still to make); another liability takes them from what you enter, or from its own rate and
 * payment fields when it has them. Debts you are owed (Lending) are not yours to pay off and are left out.
 */
export const debtsFromAccounts = ({ accounts, transactions, loanPaymentOverrides, settings, conversionRates }: Args): PlanDebt[] => {
  const byAccount = new Map<string, Transaction[]>();
  transactions.forEach(tx => { const list = byAccount.get(tx.accountId); if (list) list.push(tx); else byAccount.set(tx.accountId, [tx]); });
  const out: PlanDebt[] = [];

  accounts.filter(a => a.status !== 'closed' && (a.type === 'Loan' || a.type === 'Other Liabilities')).forEach(account => {
    const txs = byAccount.get(account.id) ?? [];
    const owed = Math.abs(Math.min(0, computeAccountDisplayBalance(account, txs, loanPaymentOverrides, { conversionRates })));
    if (owed < 0.005) return;
    const main = (amount: number) => convertToMain(amount, account.currency, conversionRates);

    if (account.type === 'Loan') {
      const schedule = generateAmortizationSchedule(account, txs, loanPaymentOverrides[account.id] || {});
      const next = schedule.find(p => (p.status === 'Upcoming' || p.status === 'Due' || p.status === 'Overdue') && p.totalPayment > 0);
      if (next) {
        const before = next.outstandingBalance + next.principal;
        const monthlyRate = before > 0 ? next.interest / before : 0;
        out.push({ id: account.id, name: account.name, type: account.type, balance: main(before), rate: monthlyRate * 12 * 100, minimum: main(account.monthlyPayment || next.totalPayment), needsDetails: false });
        return;
      }
    }
    const set = settings.overrides?.[account.id];
    const rate = set?.rate ?? account.interestRate ?? 0;
    const payment = set?.payment ?? account.monthlyPayment ?? 0;
    out.push({ id: account.id, name: account.name, type: account.type, balance: main(owed), rate, minimum: main(payment), needsDetails: payment <= 0 });
  });

  return out.sort((a, b) => b.balance - a.balance);
};
