import React, { useContext, useMemo } from 'react';
import { curveNatural } from '@visx/curve';
import { Transaction, Account, Currency } from '../types';
import { convertToMain, formatCurrency, parseLocalDate, getMainCurrency } from '../utils';
import { LineChart, Line, Grid, XAxis, YAxis, ChartTooltip, LineSeriesTerminalMarker } from '@/src/components/charts';
import { SpotlightIndicator } from '@/src/components/charts/spotlight-indicator';
import { HorizonArea } from './ForecastHorizonChart';
import { Badge } from './ui/Display';
import { Amount, PrivacyContext } from './ui/Money';
import { useWidgetBox } from './ui/WidgetGrid';

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

  const isPrivate = useContext(PrivacyContext);
  const box = useWidgetBox();
  // The chart needs about 110px of its own, under the figure. The legend and the caption come with more room.
  const showChart = box.height === 0 || box.height >= 230;
  const showLegend = box.height === 0 || box.height >= 300;
  const latest = chartData[chartData.length - 1];
  const isAbove = !!latest && latest.delta > latest.avg;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="type-figure-lg text-ink"><Amount value={latest?.delta ?? 0} currency={currency} tone="flow" /></p>
        <Badge tone={isAbove ? 'positive' : 'neutral'}>{isAbove ? 'Above your average' : 'At or below your average'}</Badge>
      </div>
      <p className="type-caption -mt-2 text-muted">Saved this month, after spending</p>

      {showChart && <div className="min-h-[100px] w-full flex-1">
        <LineChart data={chartData} xDataKey="date" yDomainTween aspectRatio="" className="h-full min-h-[100px] w-full" margin={{ top: 15, right: 15, bottom: 20, left: 48 }}>
          <Grid horizontal numTicksRows={4} stroke="var(--line)" />
          <SpotlightIndicator seriesKey="delta" color="var(--chart-1)" />
          <HorizonArea seriesKey="delta" color="var(--chart-1)" curve={curveNatural} />
          <XAxis />
          <YAxis numTicks={4} tickFormatter={v => (isPrivate ? '•••' : formatCurrency(v, currency, { compact: true }))} />
          <Line dataKey="avg" label="3-month average" stroke="var(--chart-3)" strokeWidth={1.5} strokeDasharray="4,4" curve={curveNatural} fadeEdges={false} />
          <Line dataKey="delta" label="Each month" stroke="var(--chart-1)" strokeWidth={2.25} curve={curveNatural} fadeEdges={false} />
          <LineSeriesTerminalMarker dataKey="delta" stroke="var(--chart-1)" fill="var(--chart-1)" />
          <ChartTooltip
            showCrosshair
            rows={point => [
              { color: 'var(--chart-1)', label: 'Each month', value: isPrivate ? '•••' : formatCurrency(Number(point.delta ?? 0), currency) },
              { color: 'var(--chart-3)', label: '3-month average', value: isPrivate ? '•••' : formatCurrency(Number(point.avg ?? 0), currency) },
            ]}
          />
        </LineChart>
      </div>}

      {showChart && showLegend && <ul className="type-caption flex flex-wrap gap-4 text-muted">
        <li className="flex items-center gap-2"><span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: 'var(--chart-1)' }} />Each month</li>
        <li className="flex items-center gap-2"><span className="w-4 border-t-2 border-dashed" style={{ borderColor: 'var(--chart-3)' }} />3-month average</li>
      </ul>}
    </div>
  );
};

export default WealthVelocityWidget;
