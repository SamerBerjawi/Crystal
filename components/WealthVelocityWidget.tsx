import React, { useMemo } from 'react';
import { Transaction, Account } from '../types';
import { convertToEur, formatCurrency, parseLocalDate } from '../utils';
import { LineChart, Line, Grid, XAxis, YAxis, ChartTooltip } from '@/src/components/charts';

interface WealthVelocityWidgetProps {
  transactions: Transaction[];
  accounts: Account[];
}

const WealthVelocityWidget: React.FC<WealthVelocityWidgetProps> = ({ transactions }) => {
  const chartData = useMemo(() => {
    const months = 6;
    const today = new Date();
    const data = [];
    
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthKey = d.toLocaleString('default', { month: 'short' });
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

      const monthlyDelta = transactions
        .filter(t => !t.transferId && parseLocalDate(t.date) >= start && parseLocalDate(t.date) <= end)
        .reduce((sum, t) => sum + convertToEur(t.amount, t.currency), 0);

      data.push({ date: d, month: monthKey, delta: monthlyDelta });
    }

    // Calculate 3-month moving average for the line
    return data.map((item, idx, arr) => {
      const startIdx = Math.max(0, idx - 2);
      const window = arr.slice(startIdx, idx + 1);
      const avg = window.reduce((sum, i) => sum + i.delta, 0) / window.length;
      return { ...item, avg };
    });
  }, [transactions]);

  const currentDelta = chartData[chartData.length - 1]?.delta || 0;
  const isAccelerating = currentDelta > (chartData[chartData.length - 1]?.avg || 0);

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex justify-between items-center px-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Growth momentum</p>
          <div className="flex items-center gap-2 mt-0.5">
            <h3 className={`text-2xl font-bold tracking-tight ${currentDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {currentDelta >= 0 ? '+' : ''}{formatCurrency(currentDelta, 'EUR')}
            </h3>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isAccelerating ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'}`}>
              {isAccelerating ? 'Accelerating' : 'Stabilizing'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-grow w-full h-[180px] min-h-[160px]">
        <LineChart
          data={chartData}
          xDataKey="date"
          yDomainTween
          aspectRatio=""
          className="w-full h-full min-h-[160px]"
          margin={{ top: 15, right: 15, bottom: 20, left: 15 }}
        >
          <Grid horizontal stroke="rgba(255, 255, 255, 0.06)" />
          <XAxis />
          <YAxis />
          <Line dataKey="avg" stroke="#94A3B8" strokeWidth={2} strokeDasharray="4,4" />
          <Line dataKey="delta" stroke="#6366F1" strokeWidth={3} fadeEdges />
          <ChartTooltip valueFormatter={(value) => formatCurrency(Number(value), 'EUR')} />
        </LineChart>
      </div>
      
      <p className="text-xs italic text-light-text-secondary dark:text-dark-text-secondary text-center font-normal">
        Dashed line represents your 3-month trailing growth average.
      </p>
    </div>
  );
};

export default WealthVelocityWidget;
