import React, { useMemo } from 'react';
import { Account, Transaction } from '../types';
import { convertCurrency, formatCurrency, parseLocalDate, toLocalISOString, calculateTrendLine } from '../utils';
import { computeAccountDisplayBalance } from '../utils/accountsModel';
import { resolveRealTodayBalance } from '../utils/accountDetailModel';
import { accountForecast, warrantTaxBills } from '../utils/forecastModel';
import { useScheduleContext, useGoalsContext } from '../contexts/FinancialDataContext';
import { useAccountsContext, usePreferencesSelector, useWarrantsContext } from '../contexts/DomainProviders';
import { useInsightsView } from '../contexts/InsightsViewContext';
import { Panel } from './AccountFrame';
import { Amount } from './ui/Money';
import {
  LineChart,
  Line,
  Grid,
  XAxis,
  YAxis,
  ChartTooltip,
  ChartMarkers,
  LineSeriesTerminalMarker,
  type ChartMarker,
} from '../src/components/charts';

interface HistoricalBalanceTrendProps {
  account: Account;
  transactions: Transaction[];
}

const HISTORY_DAYS = 180;
const AHEAD_MONTHS = 3;

/** Six months of balance and three months ahead, from the same forecast as Overview and Forecast (D-111). */
const HistoricalBalanceTrend: React.FC<HistoricalBalanceTrendProps> = ({ account, transactions }) => {
  const { recurringTransactions, recurringTransactionOverrides, loanPaymentOverrides, billsAndPayments } = useScheduleContext();
  const { financialGoals } = useGoalsContext();
  const { activeGoalIds } = useInsightsView();
  const { accounts } = useAccountsContext();
  const { warrants } = useWarrantsContext();
  const conversionRates = usePreferencesSelector((p) => p.conversionRates);

  const accountTransactions = useMemo(
    () => transactions.filter((tx) => tx.accountId === account.id),
    [transactions, account.id]
  );

  const displayBalance = useMemo(
    () => computeAccountDisplayBalance(account, accountTransactions, loanPaymentOverrides),
    [account, accountTransactions, loanPaymentOverrides]
  );

  const { points, todayIndex, startBalance, todayBalance, endBalance } = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayIso = toLocalISOString(today);

    // Future-dated transactions are backed out of today's balance. Amortised loans come from the schedule, which
    // already ignores future payments.
    const isScheduledLoan =
      (account.type === 'Loan' || account.type === 'Lending') &&
      !!(account.principalAmount && account.duration && account.loanStartDate && account.interestRate !== undefined);
    const currentBal = isScheduledLoan
      ? displayBalance
      : resolveRealTodayBalance(displayBalance, account.currency, accountTransactions, { conversionRates, referenceDate: today, accountId: account.id });

    const byDate: Record<string, number> = {};
    for (const tx of accountTransactions) {
      if (tx.date > todayIso) continue;
      byDate[tx.date] = (byDate[tx.date] || 0) + convertCurrency(tx.amount, tx.currency, account.currency, conversionRates);
    }

    const history: { date: string; value: number }[] = [];
    const cursor = new Date(today);
    let running = currentBal;
    for (let i = 0; i < HISTORY_DAYS; i++) {
      const date = toLocalISOString(cursor);
      history.push({ date, value: Number(running.toFixed(2)) });
      running -= byDate[date] || 0;
      cursor.setDate(cursor.getDate() - 1);
    }
    history.reverse();

    const end = new Date(today);
    end.setMonth(end.getMonth() + AHEAD_MONTHS);
    const ahead = accountForecast(
      {
        recurring: recurringTransactions,
        overrides: recurringTransactionOverrides,
        // Warrant taxes land on the primary account, as on Forecast with nothing selected.
        bills: [...billsAndPayments, ...warrantTaxBills(warrants, [], accounts)],
        accounts: accounts.length > 0 ? accounts : [account],
        transactions,
        loanPaymentOverrides,
      },
      account,
      currentBal,
      financialGoals,
      activeGoalIds,
      today,
      end,
      conversionRates
    ).filter((day) => day.date > todayIso);

    const combined = [
      ...history.map((h) => ({ date: parseLocalDate(h.date), balance: h.value, isProjected: false })),
      ...ahead.map((d) => ({ date: parseLocalDate(d.date), balance: d.value, isProjected: true })),
    ];
    const trend = calculateTrendLine(combined, (item) => item.balance);

    return {
      points: combined.map((item, index) => ({ ...item, trend: trend[index] })),
      todayIndex: history.length - 1,
      startBalance: history[0]?.value ?? 0,
      todayBalance: currentBal,
      endBalance: ahead.at(-1)?.value ?? currentBal,
    };
  }, [account, accounts, transactions, accountTransactions, displayBalance, conversionRates, loanPaymentOverrides, recurringTransactions, recurringTransactionOverrides, financialGoals, activeGoalIds, billsAndPayments, warrants]);

  const hasAhead = todayIndex < points.length - 1;
  const markers = useMemo<ChartMarker[]>(
    () => (points[todayIndex] ? [{ date: points[todayIndex].date, title: 'Today', color: 'var(--muted)' }] : []),
    [points, todayIndex]
  );

  const figures = [
    { label: 'Change in 6 months', value: <Amount value={todayBalance - startBalance} currency={account.currency} tone="flow" /> },
    { label: 'In 3 months', value: <Amount value={endBalance} currency={account.currency} tone="loss" /> },
    { label: '6 months ago', value: <Amount value={startBalance} currency={account.currency} tone="loss" /> },
  ];

  return (
    <Panel title="Balance" subtitle="Six months back, and three ahead from your schedule and goals.">
      <dl className="mb-4 grid grid-cols-3 gap-3 max-md:grid-cols-1 max-md:gap-2">
        {figures.map((figure) => (
          <div key={figure.label} className="max-md:flex max-md:items-baseline max-md:justify-between">
            <dt className="type-label text-muted">{figure.label}</dt>
            <dd className="type-figure-row mt-0.5 text-ink">{figure.value}</dd>
          </div>
        ))}
      </dl>
      <LineChart
        data={points}
        xDataKey="date"
        yDomainTween
        aspectRatio=""
        className="h-[220px] w-full md:h-[260px]"
        margin={{ top: 16, right: 16, bottom: 24, left: 52 }}
      >
        <Grid horizontal stroke="var(--line)" />
        <XAxis />
        <YAxis
          tickFormatter={(val) => {
            if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
            if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
            return String(val);
          }}
        />
        <Line
          dataKey="balance"
          stroke="var(--chart-1)"
          strokeWidth={2}
          dashFromIndex={hasAhead ? todayIndex : undefined}
          dashArray="6,4"
          fadeEdges
        />
        <Line dataKey="trend" stroke="var(--chart-3)" strokeWidth={1.5} strokeDasharray="4,4" />
        {hasAhead && <LineSeriesTerminalMarker dataKey="balance" stroke="var(--chart-1)" />}
        {markers.length > 0 && <ChartMarkers items={markers} />}
        <ChartTooltip
          rows={(point) => [
            {
              color: 'var(--chart-1)',
              label: point.isProjected ? 'Expected' : 'Balance',
              value: formatCurrency(typeof point.balance === 'number' ? point.balance : 0, account.currency),
            },
          ]}
        />
      </LineChart>
    </Panel>
  );
};

export default HistoricalBalanceTrend;
