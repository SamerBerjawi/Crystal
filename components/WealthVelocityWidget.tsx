import React, { useMemo } from 'react';
import { Transaction, Account, Currency } from '../types';
import { convertToMain, formatCurrency, parseLocalDate, getMainCurrency } from '../utils';
import { LineChart, Line, Grid, XAxis, YAxis, ChartTooltip } from '@/src/components/charts';
import { Badge } from './ui/Display';
import { Amount } from './ui/Money';

interface WealthVelocityWidgetProps {
  transactions: Transaction[];
  accounts: Account[];
  currency?: Currency;
  toDisplay?: (eur: number) => number;
}

/** Money in minus money out for each of the last six months, against its three-month average. */
const WealthVelocityWidget: React.FC<WealthVelocityWidgetProps> = ({
  transactions,
  currency = getMainCurrency(),
  toDisplay = (val: number) => val,
}) => {
  const chartData = useMemo(() => {
    const today = new Date();
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const delta = transactions
        .filter(t => !t.transferId && !t.isSplitParent && !t.isCombinedParent && !t.isBalanceAdjustment && parseLocalDate(t.date) >= start && parseLocalDate(t.date) <= end)
        .reduce((sum, t) => sum + toDisplay(convertToMain(t.amount, t.currency)), 0);
      data.push({ date: d, delta });
    }
    return data.map((item, idx, arr) => {
      const window = arr.slice(Math.max(0, idx - 2), idx + 1);
      return { ...item, avg: window.reduce((sum, w) => sum + w.delta, 0) / window.length };
    });
  }, [transactions, toDisplay]);

  const latest = chartData[chartData.length - 1];
  const isAbove = !!latest && latest.delta > latest.avg;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="type-figure-lg text-ink"><Amount value={latest?.delta ?? 0} currency={currency} tone="flow" /></p>
        <Badge tone={isAbove ? 'positive' : 'neutral'}>{isAbove ? 'Above your average' : 'At or below your average'}</Badge>
      </div>
      <p className="type-caption -mt-2 text-muted">Saved this month, after spending</p>

      <div className="h-[180px] min-h-[160px] w-full flex-grow">
        <LineChart data={chartData} xDataKey="date" yDomainTween aspectRatio="" className="h-full min-h-[160px] w-full" margin={{ top: 15, right: 15, bottom: 20, left: 15 }}>
          <Grid horizontal stroke="var(--line)" />
          <XAxis />
          <YAxis />
          <Line dataKey="avg" stroke="var(--chart-3)" strokeWidth={1.5} strokeDasharray="4,4" />
          <Line dataKey="delta" stroke="var(--chart-1)" strokeWidth={2} fadeEdges />
          <ChartTooltip valueFormatter={(value) => formatCurrency(Number(value), currency)} />
        </LineChart>
      </div>

      <ul className="type-caption flex flex-wrap gap-4 text-muted">
        <li className="flex items-center gap-2"><span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: 'var(--chart-1)' }} />Each month</li>
        <li className="flex items-center gap-2"><span className="w-4 border-t-2 border-dashed" style={{ borderColor: 'var(--chart-3)' }} />3-month average</li>
      </ul>
    </div>
  );
};

export default WealthVelocityWidget;
