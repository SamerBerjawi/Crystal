import { useMemo } from 'react';
import type { Account, Transaction } from '../../types';
import { convertCurrency } from '../../utils';
import { accountLinks } from '../../utils/accountLinks';
import { dailyBalanceHistory, isoDay, toDatedAmounts, type DatedAmount } from '../../utils/accountPagesModel';
import { forecastFromData, warrantTaxBills, type ForecastEvent } from '../../utils/forecastModel';
import { makeConverter } from '../../utils/scheduleModel';
import { resolveRealTodayBalance } from '../../utils/accountDetailModel';
import { useAccountsContext, usePreferencesSelector, useTransactionsContext, useWarrantsContext } from '../../contexts/DomainProviders';
import { useGoalsContext, useScheduleContext } from '../../contexts/FinancialDataContext';
import { useInsightsView } from '../../contexts/InsightsViewContext';
import { sortAccountsByType } from '../../utils/accountsModel';

/** What every account page needs: its links, neighbours, its transactions as amounts in its own currency, and today's balance. */
export function useAccountPage(account: Account, options: { showBalanceAdjustments: boolean }) {
  const { accounts } = useAccountsContext();
  const { transactions } = useTransactionsContext();
  const { financialGoals } = useGoalsContext();
  const conversionRates = usePreferencesSelector(p => p.conversionRates);

  const own = useMemo(
    () => transactions.filter(tx => tx.accountId === account.id && !tx.isSplitParent && !tx.isCombinedParent && (options.showBalanceAdjustments || !tx.isBalanceAdjustment)),
    [transactions, account.id, options.showBalanceAdjustments]
  );
  const convert = useMemo(() => (tx: Transaction) => convertCurrency(tx.amount, tx.currency || account.currency, account.currency, conversionRates), [account.currency, conversionRates]);
  const amounts = useMemo<DatedAmount[]>(() => toDatedAmounts(own, convert), [own, convert]);
  const todayBalance = useMemo(
    () => resolveRealTodayBalance(account, transactions.filter(tx => tx.accountId === account.id), { conversionRates }),
    [account, transactions, conversionRates]
  );
  const links = useMemo(() => accountLinks(account, { accounts, goals: financialGoals, transactions }), [account, accounts, financialGoals, transactions]);

  const siblings = useMemo(() => {
    const kin = sortAccountsByType(accounts.filter(item => item.type === account.type && item.status !== 'closed'));
    const index = kin.findIndex(item => item.id === account.id);
    return index === -1 ? undefined : { previous: kin[index - 1], next: kin[index + 1] };
  }, [accounts, account.id, account.type]);

  return { accounts, transactions, own, amounts, convert, todayBalance, links, siblings, goals: financialGoals, conversionRates };
}

/** Change of the balance over the last `days` days, from the daily history. */
export function useBalanceChange(todayBalance: number, amounts: DatedAmount[], days = 30) {
  return useMemo(() => {
    const history = dailyBalanceHistory(todayBalance, amounts, days + 1);
    return { history, change: todayBalance - (history[0]?.value ?? todayBalance) };
  }, [todayBalance, amounts, days]);
}

/**
 * The account's forecast for the next `daysAhead` days and what moves it, from the same projection as Forecast
 * and Overview (D-111), in the account's currency.
 */
export function useAccountProjection(account: Account, todayBalance: number, daysAhead = 30) {
  const { accounts } = useAccountsContext();
  const { transactions } = useTransactionsContext();
  const { warrants } = useWarrantsContext();
  const { financialGoals } = useGoalsContext();
  const { activeGoalIds } = useInsightsView();
  const { recurringTransactions, recurringTransactionOverrides, loanPaymentOverrides, billsAndPayments } = useScheduleContext();
  const conversionRates = usePreferencesSelector(p => p.conversionRates);

  return useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + daysAhead);
    const projection = forecastFromData(
      {
        recurring: recurringTransactions,
        overrides: recurringTransactionOverrides,
        bills: [...billsAndPayments, ...warrantTaxBills(warrants, [], accounts)],
        accounts: accounts.length ? accounts : [account],
        transactions,
        loanPaymentOverrides,
      },
      [account],
      financialGoals,
      activeGoalIds,
      start,
      end,
      makeConverter(account.currency, conversionRates)
    );
    const shift = todayBalance - (projection.startByAccount[account.id] ?? 0);
    const todayIso = isoDay(start);
    const days = projection.days.filter(day => day.date > todayIso).map(day => ({ date: day.date, value: Math.round(((day.byAccount[account.id] ?? 0) + shift) * 100) / 100 }));
    const events: (ForecastEvent & { own: number })[] = projection.events
      .map(event => ({ ...event, own: event.legs.filter(leg => leg.accountId === account.id).reduce((sum, leg) => sum + leg.amount, 0) }))
      .filter(event => event.own !== 0);
    const lowest = days.reduce<{ date: string; value: number } | null>((low, day) => (!low || day.value < low.value ? day : low), null);
    return { days, events, lowest };
  }, [account, accounts, transactions, warrants, financialGoals, activeGoalIds, recurringTransactions, recurringTransactionOverrides, loanPaymentOverrides, billsAndPayments, conversionRates, todayBalance, daysAhead]);
}
