import React, { useMemo } from 'react';
import { curveNatural } from '@visx/curve';
import { Grid, Line, LineChart, ChartTooltip, XAxis, YAxis } from '../src/components/charts';
import { currencySign, formatCurrency, getMainCurrency } from '../utils';
import { coastNumber, dateInMonths, type ValuePoint } from '../utils/fireModel';

interface FireChartProps {
  history: ValuePoint[];
  /** The portfolio month by month from today. The first value is today's. */
  projection: number[];
  today: Date;
  target: number;
  coast?: { yearsToRetirement: number } | null;
  expectedReturn: number;
}

interface Row {
  date: Date;
  portfolio: number;
  target: number;
  coast?: number;
  isProjected: boolean;
}

const MAX_PROJECTED_POINTS = 240;

/** €250k, €1.2M. The shared axis formatter only knows thousands, and a long road reaches millions. */
const axisMoney = (value: number) => {
  const sign = currencySign(getMainCurrency());
  const abs = Math.abs(value);
  const text = abs >= 1e6 ? `${Math.round(abs / 1e5) / 10}M` : abs >= 1e3 ? `${Math.round(abs / 100) / 10}k` : String(Math.round(abs));
  return `${value < 0 ? '-' : ''}${sign}${text}`;
};

/**
 * What you have, what it is on course to become, and the line you are heading for. Solid is what happened (paid in
 * and out, not market moves), dashed is the projection, and the Coast FI line shows how much you would need at each
 * point for growth alone to carry you to retirement.
 */
const FireChart: React.FC<FireChartProps> = ({ history, projection, today, target, coast, expectedReturn }) => {
  const currency = getMainCurrency();

  const { rows, todayIndex } = useMemo(() => {
    // What growth alone needed to be worth at a given point to reach the FI number by retirement. It is defined for every
    // row (what you needed then, what you will need then), and after retirement it is the FI number itself. A series
    // with gaps is drawn badly, so there are none.
    const needed = (monthsFromToday: number) => (coast ? coastNumber(target, coast.yearsToRetirement - monthsFromToday / 12, expectedReturn) : undefined);
    const todayIndex = history.length - 1;
    const out: Row[] = history.map((point, index) => {
      const [year, month] = point.month.split('-').map(Number);
      return { date: new Date(year, month - 1, 1), portfolio: point.value, target, isProjected: false, coast: needed(index - todayIndex) };
    });
    const step = Math.max(1, Math.ceil((projection.length - 1) / MAX_PROJECTED_POINTS));
    for (let i = step; i < projection.length; i += step) {
      out.push({ date: dateInMonths(today, i), portfolio: projection[i], target, isProjected: true, coast: needed(i) });
    }
    return { rows: out, todayIndex };
  }, [history, projection, today, target, coast, expectedReturn]);

  const hasCoast = rows.some(row => row.coast !== undefined);
  // Over many years a month and day mean nothing; over a short span the month and year do.
  const spanYears = rows.length > 1 ? (rows[rows.length - 1].date.getTime() - rows[0].date.getTime()) / (365.25 * 86400000) : 0;
  const dateTick = (value: Date) => (spanYears > 6 ? String(value.getFullYear()) : value.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }));
  const legend = [
    { label: 'Your portfolio', color: 'var(--chart-1)', dashed: false },
    { label: 'Projected', color: 'var(--chart-2)', dashed: true },
    { label: 'FI number', color: 'var(--amber)', dashed: true },
    ...(hasCoast ? [{ label: 'Coast FI', color: 'var(--chart-4)', dashed: true }] : []),
  ];

  return (
    <div className="flex h-full w-full flex-col gap-2">
      <div className="relative min-h-0 w-full flex-1">
        <LineChart data={rows as unknown as Record<string, unknown>[]} xDataKey="date" revealSignature={`${rows.length}-${target}`} yDomainTween aspectRatio="" className="h-full w-full" margin={{ top: 16, right: 16, bottom: 28, left: 8 }}>
          <Grid horizontal numTicksRows={4} />
          <XAxis numTicks={5} tickFormatter={dateTick} />
          <YAxis numTicks={4} tickFormatter={axisMoney} />
          <Line dataKey="target" stroke="var(--amber)" strokeWidth={1.5} strokeDasharray="2,5" fadeEdges={false} showHighlight={false} animate={false} />
          {hasCoast && <Line dataKey="coast" stroke="var(--chart-4)" strokeWidth={1.5} strokeDasharray="6,4" fadeEdges={false} showHighlight={false} curve={curveNatural} />}
          <Line dataKey="portfolio" stroke="var(--chart-1)" dashStroke="var(--chart-2)" strokeWidth={2.5} dashFromIndex={todayIndex >= 0 && todayIndex < rows.length - 1 ? todayIndex : undefined} dashArray="6,4" curve={curveNatural} fadeEdges={false} />
          <ChartTooltip
            showCrosshair={false}
            rows={point => [
              { color: point.isProjected ? 'var(--chart-2)' : 'var(--chart-1)', label: point.isProjected ? 'Projected portfolio' : 'Portfolio', value: formatCurrency(Number(point.portfolio ?? 0), currency) },
              ...(typeof point.coast === 'number' ? [{ color: 'var(--chart-4)', label: 'Coast FI needs', value: formatCurrency(point.coast, currency) }] : []),
              { color: 'var(--amber)', label: 'FI number', value: formatCurrency(Number(point.target ?? 0), currency) },
            ]}
          />
        </LineChart>
      </div>
      <ul className="type-caption flex shrink-0 flex-wrap gap-x-4 gap-y-1 text-muted">
        {legend.map(item => (
          <li key={item.label} className="flex items-center gap-2">
            <span className={item.dashed ? 'w-4 border-t-2 border-dashed' : 'h-0.5 w-4 rounded-full'} style={item.dashed ? { borderColor: item.color } : { backgroundColor: item.color }} aria-hidden />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FireChart;
