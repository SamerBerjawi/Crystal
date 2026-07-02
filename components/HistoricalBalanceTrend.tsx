import React, { useMemo } from 'react';
import { Account, Transaction } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { convertToEur, formatCurrency, generateAmortizationSchedule, parseLocalDate, toLocalISOString } from '../utils';
import { useScheduleContext } from '../contexts/FinancialDataContext';

interface HistoricalBalanceTrendProps {
  account: Account;
  transactions: Transaction[];
}

const HistoricalBalanceTrend: React.FC<HistoricalBalanceTrendProps> = ({ account, transactions }) => {
  const { loanPaymentOverrides } = useScheduleContext();

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

  const { chartData, startBalance, endBalance, netChange, changePercent, isPositiveTrend } = useMemo(() => {
    const NUM_DAYS = 180; // Last 6 months
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const sortedTransactions = [...transactions]
      .filter(tx => tx.accountId === account.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let currentBal = displayBalance;

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

    const data = history.reverse();
    const startVal = data[0]?.value ?? 0;
    const endVal = data[data.length - 1]?.value ?? 0;
    const changeVal = endVal - startVal;
    const pct = startVal !== 0 ? (changeVal / Math.abs(startVal)) * 100 : 0;

    return {
      chartData: data,
      startBalance: startVal,
      endBalance: endVal,
      netChange: changeVal,
      changePercent: pct,
      isPositiveTrend: changeVal >= 0
    };
  }, [account.id, transactions, displayBalance]);

  const chartColor = isPositiveTrend ? '#10B981' : '#F43F5E';
  const gradientId = `trendGradient-${account.id}`;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const date = parseLocalDate(label);
      return (
        <div className="bg-white dark:bg-neutral-900 p-3.5 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800/80 backdrop-blur-md">
          <p className="font-bold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider text-[10px]">
            {date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: chartColor }} />
            <span className="font-mono font-black text-sm text-neutral-800 dark:text-neutral-100">
              {formatCurrency(payload[0].value, account.currency)}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-dark-card rounded-[2.5rem] border border-black/5 dark:border-white/5 p-6 sm:p-8 flex flex-col group relative overflow-hidden shadow-sm">
      <div className="absolute top-0 right-0 p-8 opacity-5">
        <span className="material-symbols-outlined text-8xl">trending_up</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: chartColor }} />
            <h3 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight">6-Month Balance Trend</h3>
          </div>
          <p className="text-xs font-semibold text-light-text-secondary/60 dark:text-dark-text-secondary/70 tracking-wide">
            Historical balance progression over the last 180 days
          </p>
        </div>

        <div className="flex items-center gap-6 bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 px-5 py-3 rounded-2xl">
          <div>
            <p className="text-[9px] font-bold text-light-text-secondary/40 dark:text-dark-text-secondary/50 uppercase tracking-widest">Net Change</p>
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
          <div className="w-px h-8 bg-black/10 dark:bg-white/10" />
          <div>
            <p className="text-[9px] font-bold text-light-text-secondary/40 dark:text-dark-text-secondary/50 uppercase tracking-widest">Start Balance</p>
            <p className="text-sm font-bold font-mono text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
              {formatCurrency(startBalance, account.currency)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-grow w-full h-[220px] relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColor} stopOpacity={0.12} />
                <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.06} />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'currentColor', opacity: 0.3, fontSize: 10, fontWeight: 900 }}
              tickFormatter={(val) => {
                const d = parseLocalDate(val);
                return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              }}
              minTickGap={40}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'currentColor', opacity: 0.3, fontSize: 10, fontWeight: 900 }}
              tickFormatter={(val) => {
                if (Math.abs(val) >= 1000) {
                  return `${(val / 1000).toFixed(0)}k`;
                }
                return String(val);
              }}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={chartColor}
              strokeWidth={3}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 6, strokeWidth: 0, fill: chartColor }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default HistoricalBalanceTrend;
