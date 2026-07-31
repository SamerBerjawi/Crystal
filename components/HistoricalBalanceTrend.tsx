import React, { useMemo } from 'react';
import { Account, Transaction } from '../types';
import {
  formatCurrency,
  generateAmortizationSchedule,
  parseLocalDate,
  toLocalISOString,
  calculateTrendLine,
  generateBalanceForecast,
  generateSyntheticLoanPayments,
  generateSyntheticCreditCardPayments,
  generateSyntheticPropertyTransactions,
} from '../utils';
import { useScheduleContext, useGoalsContext } from '../contexts/FinancialDataContext';
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

const HistoricalBalanceTrend: React.FC<HistoricalBalanceTrendProps> = ({ account, transactions }) => {
  const { recurringTransactions, recurringTransactionOverrides, loanPaymentOverrides, billsAndPayments } = useScheduleContext();
  const { financialGoals } = useGoalsContext();

  const displayBalance = useMemo(() => {
    if (account.type === 'Loan' || account.type === 'Lending') {
      if (account.principalAmount && account.duration && account.loanStartDate && account.interestRate !== undefined) {
        const overrides = loanPaymentOverrides[account.id] || {};
        const schedule = generateAmortizationSchedule(account, transactions, overrides);

        const totalScheduledPrincipal = schedule.reduce((sum, p) => sum + p.principal, 0);
        const totalPaidPrincipal = schedule.reduce((acc, p) => p.status === 'Paid' ? acc + p.principal : acc, 0);
        const totalScheduledInterest = schedule.reduce((sum, p) => sum + p.interest, 0);
        const totalPaidInterest = schedule.reduce((acc, p) => p.status === 'Paid' ? acc + p.interest : acc, 0);

        const outstandingPrincipal = Math.max(0, totalScheduledPrincipal - totalPaidPrincipal);
        const outstandingInterest = Math.max(0, totalScheduledInterest - totalPaidInterest);

        const totalOutstanding = outstandingPrincipal + outstandingInterest;
        return account.type === 'Loan' ? -totalOutstanding : totalOutstanding;
      }

      if (account.totalAmount) {
        const isLending = account.type === 'Lending';
        const loanPayments = transactions.filter(tx => tx.type === (isLending ? 'expense' : 'income'));
        const totalPaid = loanPayments.reduce((sum, tx) => {
          const totalPayment = (tx.principalAmount || 0) + (tx.interestAmount || 0);
          return sum + (totalPayment > 0 ? totalPayment : tx.amount);
        }, 0);
        const outstanding = account.totalAmount - totalPaid;
        return isLending ? outstanding : -outstanding;
      }
    }
    return account.balance;
  }, [account, transactions, loanPaymentOverrides]);

  const {
    combinedData,
    lastActualIndex,
    startBalance,
    todayBalance,
    endProjectedBalance,
    netChange,
    changePercent,
    isPositiveTrend,
    projectionColor,
  } = useMemo(() => {
    const NUM_DAYS = 180; // Last 6 months
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const sortedTransactions = [...transactions]
      .filter(tx => tx.accountId === account.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const currentBal = displayBalance;

    const txsByDate: Record<string, number> = {};
    sortedTransactions.forEach(tx => {
      const dateStr = tx.date;
      txsByDate[dateStr] = (txsByDate[dateStr] || 0) + tx.amount;
    });

    const runningDate = new Date(endDate);
    const history: { date: string; value: number }[] = [];
    let runningBal = currentBal;

    for (let i = 0; i < NUM_DAYS; i++) {
      const dateStr = toLocalISOString(runningDate);
      history.push({
        date: dateStr,
        value: Number(runningBal.toFixed(2))
      });
      const change = txsByDate[dateStr] || 0;
      runningBal -= change;
      runningDate.setDate(runningDate.getDate() - 1);
    }

    const historyPoints = history.reverse();
    const lastActualIdx = historyPoints.length - 1;
    const todayStr = historyPoints[lastActualIdx]?.date;

    // --- 3-MONTH FORECAST PROJECTION ---
    const projectionEndDate = new Date(endDate);
    projectionEndDate.setMonth(projectionEndDate.getMonth() + 3);

    const syntheticLoanPayments = generateSyntheticLoanPayments([account], transactions, loanPaymentOverrides);
    const syntheticCreditCardPayments = generateSyntheticCreditCardPayments([account], transactions);
    const syntheticPropertyTransactions = generateSyntheticPropertyTransactions([account]);

    const allRecurring = [
      ...(recurringTransactions || []),
      ...syntheticLoanPayments,
      ...syntheticCreditCardPayments,
      ...syntheticPropertyTransactions,
    ];

    const { chartData: rawForecastData } = generateBalanceForecast(
      [account],
      allRecurring,
      financialGoals || [],
      billsAndPayments || [],
      projectionEndDate,
      recurringTransactionOverrides || []
    );

    const combined: {
      name: string;
      date: Date;
      balance?: number;
      actual?: number;
      forecast?: number;
      isProjected: boolean;
      trend?: number;
    }[] = [];

    historyPoints.forEach((hp) => {
      combined.push({
        name: hp.date,
        date: parseLocalDate(hp.date),
        balance: hp.value,
        actual: hp.value,
        forecast: hp.date === todayStr ? hp.value : undefined,
        isProjected: false,
      });
    });

    if (rawForecastData && rawForecastData.length > 0) {
      const currentForecastBase = rawForecastData[0].value;
      rawForecastData.forEach((point) => {
        if (point.date > todayStr) {
          const predictedChange = point.value - currentForecastBase;
          const projectedVal = Number((currentBal + predictedChange).toFixed(2));
          combined.push({
            name: point.date,
            date: parseLocalDate(point.date),
            balance: projectedVal,
            actual: undefined,
            forecast: projectedVal,
            isProjected: true,
          });
        }
      });
    }

    const trendValues = calculateTrendLine(combined, (item) => item.balance ?? 0);
    const finalCombinedData = combined.map((item, index) => ({
      ...item,
      trend: trendValues[index],
    }));

    const startVal = historyPoints[0]?.value ?? 0;
    const todayVal = historyPoints[lastActualIdx]?.value ?? 0;
    const endProjVal = finalCombinedData[finalCombinedData.length - 1]?.balance ?? todayVal;

    const changeVal = todayVal - startVal;
    const pct = startVal !== 0 ? (changeVal / Math.abs(startVal)) * 100 : 0;
    const projColor = endProjVal < todayVal ? '#F43F5E' : '#10B981';

    return {
      combinedData: finalCombinedData,
      lastActualIndex: lastActualIdx,
      startBalance: startVal,
      todayBalance: todayVal,
      endProjectedBalance: endProjVal,
      netChange: changeVal,
      changePercent: pct,
      isPositiveTrend: changeVal >= 0,
      projectionColor: projColor,
    };
  }, [
    account,
    transactions,
    displayBalance,
    loanPaymentOverrides,
    recurringTransactions,
    recurringTransactionOverrides,
    financialGoals,
    billsAndPayments,
  ]);

  const chartColor = isPositiveTrend ? '#10B981' : '#F43F5E';
  const isDashedProjection = lastActualIndex >= 0 && lastActualIndex < combinedData.length - 1;

  const markers = useMemo<ChartMarker[]>(() => {
    const items: ChartMarker[] = [];
    if (combinedData.length > 0 && lastActualIndex >= 0 && lastActualIndex < combinedData.length) {
      items.push({
        date: combinedData[lastActualIndex].date,
        title: 'Today',
        color: '#6366F1',
      });
    }
    return items;
  }, [combinedData, lastActualIndex]);

  return (
    <div className="bg-white dark:bg-dark-card rounded-[2.5rem] border border-black/5 dark:border-white/5 p-6 sm:p-8 flex flex-col group relative overflow-hidden shadow-sm">
      <div className="absolute top-0 right-0 p-8 opacity-5">
        <span className="material-symbols-outlined text-8xl">trending_up</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: chartColor }} />
            <h3 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight">
              6-Month Trend &amp; 3-Month Projection
            </h3>
          </div>
          <p className="text-xs font-semibold text-light-text-secondary/60 dark:text-dark-text-secondary/70 tracking-wide">
            180-day historical progression &amp; 90-day forecast based on scheduled bills and recurring transactions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-6 bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 px-5 py-3 rounded-2xl">
          <div>
            <p className="text-[9px] font-bold text-light-text-secondary/40 dark:text-dark-text-secondary/50 tracking-widest">6-Mo Net Change</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`material-symbols-outlined text-sm font-bold ${isPositiveTrend ? 'text-emerald-500' : 'text-rose-500'}`}>
                {isPositiveTrend ? 'arrow_upward' : 'arrow_downward'}
              </span>
              <span className={`text-base font-black font-mono tracking-tight ${isPositiveTrend ? 'text-emerald-500' : 'text-rose-500'}`}>
                {formatCurrency(Math.abs(netChange), account.currency)}
              </span>
              <span className={`text-xs font-bold font-mono opacity-80 ${isPositiveTrend ? 'text-emerald-500' : 'text-rose-500'}`}>
                ({isPositiveTrend ? '+' : ''}{changePercent.toFixed(1)}%)
              </span>
            </div>
          </div>

          <div className="w-px h-8 bg-black/10 dark:bg-white/10 hidden sm:block" />

          <div>
            <p className="text-[9px] font-bold text-light-text-secondary/40 dark:text-dark-text-secondary/50 tracking-widest">3-Mo Projected</p>
            <p className={`text-sm font-bold font-mono mt-0.5 ${endProjectedBalance >= todayBalance ? 'text-emerald-500' : 'text-rose-500'}`}>
              {formatCurrency(endProjectedBalance, account.currency)}
            </p>
          </div>

          <div className="w-px h-8 bg-black/10 dark:bg-white/10 hidden sm:block" />

          <div>
            <p className="text-[9px] font-bold text-light-text-secondary/40 dark:text-dark-text-secondary/50 tracking-widest">Start Balance</p>
            <p className="text-sm font-bold font-mono text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
              {formatCurrency(startBalance, account.currency)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-grow w-full h-[240px] relative z-10">
        <LineChart
          data={combinedData}
          xDataKey="date"
          yDomainTween
          aspectRatio=""
          className="w-full h-[240px]"
          margin={{ top: 20, right: 20, bottom: 25, left: 55 }}
        >
          <Grid horizontal stroke="rgba(255, 255, 255, 0.06)" />
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
            stroke={chartColor}
            dashStroke={projectionColor}
            strokeWidth={3}
            dashFromIndex={isDashedProjection ? lastActualIndex : undefined}
            dashArray="6,4"
            fadeEdges
          />
          <Line
            dataKey="trend"
            stroke="#6366f1"
            strokeWidth={1.5}
            strokeDasharray="4,4"
          />
          {isDashedProjection && (
            <LineSeriesTerminalMarker dataKey="balance" stroke={projectionColor} />
          )}
          {markers.length > 0 && <ChartMarkers items={markers} />}
          <ChartTooltip
            rows={(point) => {
              const isProjected = Boolean(point.isProjected);
              const label = isProjected ? '3-Mo Projected Balance' : 'Historical Balance';
              const val = typeof point.balance === 'number' ? point.balance : 0;
              const strokeColor = isProjected ? projectionColor : chartColor;
              return [
                {
                  color: strokeColor,
                  label,
                  value: formatCurrency(val, account.currency),
                },
              ];
            }}
          />
        </LineChart>
      </div>
    </div>
  );
};

export default HistoricalBalanceTrend;
