import React, { useMemo } from 'react';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import type { Category, Currency, DisplayTransaction, FinancialGoal } from '../types';
import { Bar, BarChart, BarXAxis, ChartTooltip, Grid, Line, LineChart, XAxis, YAxis } from '../src/components/charts';
import { formatCurrency, parseLocalDate } from '../utils';
import TransactionList from './TransactionList';
import { IconButton } from './ui/Actions';
import { EmptyState } from './ui/States';
import { cn } from '../lib/utils';

export interface FrameMetric {
  label: string;
  value: React.ReactNode;
  context?: string;
}

/** A section of a tab. */
export const Panel: React.FC<{ title: string; subtitle?: string; className?: string; children: React.ReactNode }> = ({ title, subtitle, className, children }) => (
  <section className={cn('min-w-0 rounded-[var(--radius-xl)] surface-card p-6 max-md:p-5', className)}>
    <h3 className="type-card-title text-ink">{title}</h3>
    {subtitle && <p className="type-caption text-muted">{subtitle}</p>}
    <div className="mt-3">{children}</div>
  </section>
);

/** Summary cards: four across, two by two on tablets, a scrolling row on phones. */
export const MetricRow: React.FC<{ metrics: FrameMetric[] }> = ({ metrics }) => (
  <dl className="no-scrollbar flex gap-3 overflow-x-auto md:grid md:grid-cols-2 md:gap-4 md:overflow-visible lg:grid-cols-4">
    {metrics.map(metric => (
      <div key={metric.label} className="min-w-[160px] shrink-0 rounded-[var(--radius-xl)] surface-card p-5 md:min-w-0">
        <dt className="type-label text-muted">{metric.label}</dt>
        <dd className="type-figure-lg mt-1 truncate text-ink">{metric.value}</dd>
        {metric.context && <dd className="type-caption mt-0.5 text-muted">{metric.context}</dd>}
      </div>
    ))}
  </dl>
);

/** Label and value rows for an account's settings and specifications. */
const copyToClipboard = (label: string, text: string) => {
  // There's no clipboard on a plain http address, which self-hosted installs can use.
  (navigator.clipboard?.writeText(text) ?? Promise.reject()).then(() => toast.success(`${label} copied`), () => toast.error("Couldn't copy that."));
};

export const DetailList: React.FC<{ items: { label: string; value?: React.ReactNode; copy?: string }[] }> = ({ items }) => (
  <dl className="divide-y divide-line">
    {items.filter(item => item.value !== undefined && item.value !== null && item.value !== '').map(item => (
      <div key={item.label} className="flex min-h-10 items-center justify-between gap-4 py-1.5">
        <dt className="type-body shrink-0 text-muted">{item.label}</dt>
        <dd className="type-body-strong flex min-w-0 items-center justify-end gap-1 text-right text-ink">
          <span className={item.copy ? "min-w-0 break-words" : "min-w-0 truncate"}>{item.value}</span>
          {item.copy && <IconButton icon="copy-01" label={`Copy ${item.label.toLowerCase()}`} className="size-8 shrink-0" iconSize={16} tooltipPlacement="left" onPress={() => copyToClipboard(item.label, item.copy!)} />}
        </dd>
      </div>
    ))}
  </dl>
);

export const ProgressBar: React.FC<{ value: number; label: string; className?: string; tone?: 'primary' | 'onHero' }> = ({ value, label, className, tone = 'primary' }) => (
  <div role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} className={cn('h-2 overflow-hidden rounded-full', tone === 'onHero' ? 'bg-on-pine/25' : 'bg-inset', className)}>
    <motion.div className={cn('h-full rounded-full', tone === 'onHero' ? 'bg-on-pine' : 'bg-pill')} initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, value))}%` }} transition={{ duration: 0.9, ease: [0.77, 0, 0.175, 1] }} />
  </div>
);

export const LinkedGoals: React.FC<{ goals: FinancialGoal[] }> = ({ goals }) => (
  <ul className="space-y-3">
    {goals.map(goal => {
      const progress = goal.amount > 0 ? (goal.currentAmount / goal.amount) * 100 : 0;
      return (
        <li key={goal.id}>
          <p className="type-body mb-1 flex justify-between gap-3 text-ink">
            <span className="truncate">{goal.name}</span>
            <span className="type-figure-row shrink-0">{progress.toFixed(0)}%</span>
          </p>
          <ProgressBar value={progress} label={goal.name} />
        </li>
      );
    })}
  </ul>
);

export const MonthlyBars: React.FC<{ data: Record<string, unknown>[]; currency: Currency; bars: { key: string; color: string }[]; stacked?: boolean }> = ({ data, currency, bars, stacked }) => (
  <div className="h-[220px] md:h-[280px]">
    <BarChart data={data} xDataKey="name" stacked={stacked} aspectRatio="auto" margin={{ top: 15, right: 15, left: 15, bottom: 25 }}>
      <Grid horizontal vertical={false} strokeOpacity={0.06} />
      {bars.map(bar => <Bar key={bar.key} dataKey={bar.key} fill={bar.color} lineCap="round" />)}
      <BarXAxis />
      <ChartTooltip valueFormatter={(value: number) => formatCurrency(value, currency)} />
    </BarChart>
  </div>
);

/** A value over time (holdings, portfolio). Rows carry a `date` as YYYY-MM-DD and the value under `dataKey`. */
export const ValueChart: React.FC<{ data: Record<string, unknown>[]; currency: Currency; dataKey: string; trendKey?: string; fitValues?: boolean }> = ({ data, currency, dataKey, trendKey }) => {
  const rows = useMemo(() => data.map(row => ({ ...row, date: typeof row.date === 'string' ? parseLocalDate(row.date) : row.date })), [data]);
  return (
    <LineChart data={rows} xDataKey="date" yDomainTween aspectRatio="" className="h-[220px] w-full md:h-[280px]" margin={{ top: 16, right: 16, bottom: 24, left: 52 }}>
      <Grid horizontal stroke="var(--line)" />
      <XAxis />
      <YAxis tickFormatter={(value: number) => (Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(Math.abs(value) >= 10000 ? 0 : 1)}k` : String(Math.round(value)))} />
      <Line dataKey={dataKey} stroke="var(--chart-1)" strokeWidth={2} />
      {trendKey && <Line dataKey={trendKey} stroke="var(--chart-3)" strokeWidth={1.5} strokeDasharray="4,4" />}
      <ChartTooltip rows={point => [{ color: 'var(--chart-1)', label: 'Value', value: formatCurrency(typeof point[dataKey] === 'number' ? (point[dataKey] as number) : 0, currency) }]} />
    </LineChart>
  );
};

/** The Transactions tab, shared by every type that has one. */
export const AccountTransactions: React.FC<{ transactions: DisplayTransaction[]; categories: Category[]; onOpen: (tx: DisplayTransaction) => void; emptyAction?: () => void }> = ({ transactions, categories, onOpen, emptyAction }) => (
  transactions.length > 0
    ? <div className="rounded-[var(--radius-xl)] surface-card p-4"><TransactionList transactions={transactions} allCategories={categories} onTransactionClick={onOpen} density="high" /></div>
    : <EmptyState icon="receipt" title="No transactions yet" description="They appear here as you add them or sync your bank." actionLabel={emptyAction ? 'Add a transaction' : undefined} onAction={emptyAction} />
);

