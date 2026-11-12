import React, { useContext, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Page, Transaction } from '../types';
import { useCategoryContext } from '../contexts/FinancialDataContext';
import { convertToMain, formatCurrency, parseLocalDate, getMainCurrency } from '../utils';
import { reportInsights, type GroupBy, type Report, type ReportId } from '../utils/reportsModel';
import { PieCenter, PieChart, PieSlice } from '../src/components/charts';
import { LINE_MOTION } from '../src/components/charts/animation';
import CashflowSankey from './CashflowSankey';
import { Button } from './ui/Actions';
import { Badge, ShowMore } from './ui/Display';
import Icon from './ui/Icon';
import { Amount, PrivacyContext } from './ui/Money';
import SegmentedControl from './ui/SegmentedControl';
import { cn } from '../lib/utils';

const GROUPS = [{ id: 'merchant', label: 'Merchants' }, { id: 'category', label: 'Categories' }];
const SLICE_COLORS = ['var(--chart-1)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-2)'];
const PART_COLORS: Record<string, string> = { Needs: 'var(--chart-1)', Wants: 'var(--chart-4)', Others: 'var(--muted)' };
const STEP = 12;
const COMPARE = [{ id: 'now', label: 'This period' }, { id: 'compare', label: 'Vs period before' }];

const shortDate = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const share = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '0.0%');

const Row: React.FC<{ title: React.ReactNode; detail?: React.ReactNode; value: React.ReactNode; note?: React.ReactNode }> = ({ title, detail, value, note }) => (
  <li className="flex min-h-14 items-center justify-between gap-3 py-1.5">
    <span className="min-w-0">
      <span className="type-body-strong block truncate text-ink">{title}</span>
      {detail && <span className="type-caption block truncate text-muted">{detail}</span>}
    </span>
    <span className="shrink-0 text-right">
      <span className="type-figure-row block text-ink">{value}</span>
      {note && <span className="type-caption block text-muted">{note}</span>}
    </span>
  </li>
);

const Rows: React.FC<{ children: React.ReactNode }> = ({ children }) => <ul className="divide-y divide-line">{children}</ul>;

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="type-body py-8 text-center text-muted">{children}</p>;

const Figure: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <dt className="type-label text-muted">{label}</dt>
    <dd className="type-figure-row text-ink">{children}</dd>
  </div>
);

const SpendingChart: React.FC<{ report: Report }> = ({ report }) => {
  const isPrivate = useContext(PrivacyContext);
  return (
    <>
      <ul className="mb-2 flex gap-4" aria-label="Legend">
        <li className="type-caption flex items-center gap-1.5 text-muted"><span className="h-0.5 w-4 rounded-full bg-chart-1" />This period</li>
        <li className="type-caption flex items-center gap-1.5 text-muted"><span className="h-0.5 w-4 rounded-full bg-muted" />Period before</li>
      </ul>
      <div className="h-[260px] md:h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={report.velocity.map(point => ({ ...point, label: shortDate(point.date) }))}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} minTickGap={48} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} width={48} />
            <Tooltip contentStyle={{ background: 'var(--solid)', border: '1px solid var(--line)', borderRadius: 12 }} formatter={(value: number, name: string) => [isPrivate ? '•••' : formatCurrency(value, getMainCurrency()), name === 'current' ? 'This period' : 'Period before']} />
            <Line {...LINE_MOTION} type="natural" dataKey="previous" stroke="var(--muted)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
            <Line {...LINE_MOTION} type="natural" dataKey="current" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
};

const CategoryReport: React.FC<{ report: Report }> = ({ report }) => {
  const [shown, setShown] = useState(STEP);
  const [compare, setCompare] = useState(false);
  const before = useMemo(() => new Map(report.previousCategories.map(row => [row.category, row.totalEur])), [report.previousCategories]);
  const top = report.categories.slice(0, 5);
  const rest = report.totalSpend - top.reduce((sum, row) => sum + row.totalEur, 0);
  const slices = [...top.map((row, index) => ({ label: row.category, value: row.totalEur, color: SLICE_COLORS[index] })), ...(rest > 0.005 ? [{ label: 'Other', value: rest, color: 'var(--muted)' }] : [])];
  if (slices.length === 0) return <Empty>There is no spending in this period.</Empty>;
  return (
    <div className="grid grid-cols-1 gap-5 min-[900px]:grid-cols-[220px_minmax(0,1fr)]">
      <div className="mx-auto w-[220px] max-w-full">
        <PieChart data={slices} innerRadius={70} padAngle={0.03}>
          {slices.map((_, index) => <PieSlice key={index} index={index} />)}
          <PieCenter defaultLabel="Spent">
            {({ value, label, isHovered }) => (
              <span className="flex flex-col items-center">
                <span className="type-caption text-muted">{label}</span>
                <span className="type-figure-row text-ink"><Amount value={isHovered ? value : report.totalSpend} currency={getMainCurrency()} /></span>
              </span>
            )}
          </PieCenter>
        </PieChart>
      </div>
      <div className="min-w-0">
        <div className="mb-1 flex justify-end"><SegmentedControl items={COMPARE} activeId={compare ? 'compare' : 'now'} onChange={id => setCompare(id === 'compare')} /></div>
        <Rows>
          {report.categories.slice(0, shown).map((row, index) => (
            <Row
              key={row.category}
              title={<span className="flex items-center gap-2"><span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: SLICE_COLORS[index] ?? 'var(--muted)' }} /><span className="truncate">{row.category}</span></span>}
              value={<Amount value={row.totalEur} currency={getMainCurrency()} />}
              note={compare ? <Change current={row.totalEur} previous={before.get(row.category) ?? 0} /> : share(row.totalEur, report.totalSpend)}
            />
          ))}
        </Rows>
        <ShowMore remaining={report.categories.length - shown} onPress={() => setShown(count => count + STEP)} />
      </div>
    </div>
  );
};


/** Compares one figure with the period before, as a percentage. More spending is bad, so it reads in the warning colour. */
const Change: React.FC<{ current: number; previous: number }> = ({ current, previous }) => {
  if (previous <= 0) return <span className="type-caption text-muted">New</span>;
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.5) return <span className="type-caption text-muted">No change</span>;
  return <span className={pct > 0 ? 'type-caption text-tomato' : 'type-caption text-pine'}>{pct > 0 ? '+' : '−'}{Math.abs(pct).toFixed(0)}% vs before</span>;
};

const monthLabel = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });

/** Every category against every month. The darker the cell, the more went out; the biggest cell is the darkest. */
const CategoryMonthsReport: React.FC<{ report: Report }> = ({ report }) => {
  const isPrivate = useContext(PrivacyContext);
  const compactMoney = (value: number) => isPrivate ? '•••' : formatCurrency(value, getMainCurrency(), { compact: true });
  const [shown, setShown] = useState(STEP);
  const { months, table, monthTotals, max } = report.byMonth;
  if (table.length === 0) return <Empty>There is no spending in this period.</Empty>;
  return (
    <>
      <div className="-mx-1 max-h-[600px] overflow-auto px-1">
        <table className="w-full min-w-[500px] border-separate border-spacing-y-1 text-left">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="type-label sticky top-0 left-0 z-20 bg-surface py-2 pr-3 text-muted">Category</th>
              {months.map(key => <th key={key} scope="col" className="type-label sticky top-0 z-10 bg-surface px-1 py-2 text-right text-muted">{monthLabel(key)}</th>)}
              <th scope="col" className="type-label sticky top-0 z-10 bg-surface py-2 pl-3 text-right text-muted">Total</th>
            </tr>
          </thead>
          <tbody>
            {table.slice(0, shown).map(row => (
              <tr key={row.category}>
                <th scope="row" className="type-body sticky left-0 z-10 max-w-[160px] truncate bg-surface py-1 pr-3 text-left font-normal text-ink">{row.category}</th>
                {months.map(key => {
                  const value = row.cells[key] ?? 0;
                  const strength = max > 0 ? Math.round((value / max) * 70) : 0;
                  return (
                    <td key={key} className="px-0.5 py-0">
                      <span
                        title={`${row.category}, ${monthLabel(key)}: ${isPrivate ? '•••' : formatCurrency(value, getMainCurrency())}`}
                        className="type-caption privacy-blur block rounded-md px-2 py-1.5 text-right tabular-nums text-ink transition-transform hover:scale-105 hover:ring-1 hover:ring-primary/40 cursor-default"
                        style={{ background: value > 0 ? `color-mix(in srgb, var(--chart-1) ${Math.max(8, strength)}%, transparent)` : 'transparent' }}
                      >
                        {value > 0 ? compactMoney(value) : '–'}
                      </span>
                    </td>
                  );
                })}
                <td className="type-figure-row py-1 pl-3 text-right text-ink"><Amount value={row.totalEur} currency={getMainCurrency()} /></td>
              </tr>
            ))}
            <tr className="border-t border-line">
              <th scope="row" className="type-body-strong sticky left-0 z-10 bg-surface pt-2.5 pr-3 text-left text-ink">All spending</th>
              {monthTotals.map((value, index) => <td key={months[index]} className="type-caption privacy-blur px-2 pt-2.5 text-right tabular-nums text-ink">{value > 0 ? compactMoney(value) : '–'}</td>)}
              <td className="type-figure-row pl-3 pt-2.5 text-right text-ink"><Amount value={report.totalSpend} currency={getMainCurrency()} /></td>
            </tr>
          </tbody>
        </table>
      </div>
      <ShowMore remaining={table.length - shown} onPress={() => setShown(count => count + STEP)} />
    </>
  );
};

/** Money in: the sources, and how it came month by month. */
const IncomeReport: React.FC<{ report: Report }> = ({ report }) => {
  const isPrivate = useContext(PrivacyContext);
  const { total, sources, months } = report.incomeReport;
  if (total <= 0) return <Empty>No money came in during this period.</Empty>;
  const top = Math.max(...months.map(month => month.totalEur), 1);
  const kept = report.income - report.totalSpend;
  return (
    <>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 min-[900px]:grid-cols-3">
        <Figure label="Money in"><Amount value={total} currency={getMainCurrency()} /></Figure>
        <Figure label="Money out"><Amount value={report.totalSpend} currency={getMainCurrency()} /></Figure>
        <Figure label="Kept"><Amount value={kept} currency={getMainCurrency()} tone="flow" /></Figure>
      </dl>
      {months.length > 1 && (
        <div className="mt-5 flex h-32 items-end gap-2" role="img" aria-label="Money in by month">
          {months.map(month => (
            <div key={month.key} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${monthLabel(month.key)}: ${isPrivate ? '•••' : formatCurrency(month.totalEur, getMainCurrency())}`}>
              <div className="w-full rounded-t-md bg-chart-1" style={{ height: `${Math.max(2, (month.totalEur / top) * 100)}%` }} />
              <span className="type-caption text-muted">{monthLabel(month.key)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 border-t border-line pt-2">
        <Rows>
          {sources.map(row => <Row key={row.category} title={row.category} value={<Amount value={row.totalEur} currency={getMainCurrency()} />} note={share(row.totalEur, total)} />)}
        </Rows>
      </div>
    </>
  );
};

const BreakdownReport: React.FC<{ report: Report; groupBy: GroupBy; onGroupBy: (group: GroupBy) => void; setCurrentPage?: (page: Page) => void }> = ({ report, groupBy, onGroupBy, setCurrentPage }) => {
  const [shown, setShown] = useState(STEP);
  return (
    <>
      <SegmentedControl items={GROUPS} activeId={groupBy} onChange={id => { onGroupBy(id as GroupBy); setShown(STEP); }} />
      {report.groups.length === 0 ? <Empty>There is no spending in this period.</Empty> : (
        <>
          <div className="mt-3">
            <Rows>
              {report.groups.slice(0, shown).map(row => (
                <Row key={row.label} title={row.label} detail={`${row.count} ${row.count === 1 ? 'payment' : 'payments'}`} value={<Amount value={row.totalEur} currency={getMainCurrency()} />} note={share(row.totalEur, report.totalSpend)} />
              ))}
            </Rows>
            <ShowMore remaining={report.groups.length - shown} onPress={() => setShown(count => count + STEP)} />
          </div>
          <section aria-label="Regulars" className="mt-5 border-t border-line pt-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="type-card-title text-ink">Your regulars</h3>
              {setCurrentPage && <Button variant="secondary" size="sm" onPress={() => setCurrentPage('Merchants')}>Open Merchants</Button>}
            </div>
            <Rows>
              {report.loyalty.map(row => <Row key={row.label} title={row.label} detail={`${row.count} visits`} value={<Amount value={row.avgPerVisit} currency={getMainCurrency()} />} note="a visit" />)}
            </Rows>
          </section>
        </>
      )}
    </>
  );
};

/** On phones a Sankey can't fit its labels, so the money in and out reads as a structured waterfall (`D-034`). */
const PhoneCashflow: React.FC<{ report: Report }> = ({ report }) => {
  const net = report.income - report.totalSpend;
  const isSurplus = net >= 0;

  return (
    <div className="space-y-3.5">
      {/* Inflow Step */}
      <div className="rounded-[var(--radius-lg)] border border-line bg-inset/30 p-3.5">
        <div className="flex items-center justify-between">
          <span className="type-body-strong flex items-center gap-2 text-ink">
            <span className="size-2 shrink-0 rounded-full bg-pine" />
            <span>Money In</span>
          </span>
          <span className="type-figure-row text-pine">
            +<Amount value={report.income} currency={getMainCurrency()} />
          </span>
        </div>
      </div>

      {/* Outflow Step */}
      <div className="space-y-2.5 rounded-[var(--radius-lg)] border border-line bg-surface p-3.5">
        <div className="flex items-center justify-between border-b border-line pb-2">
          <span className="type-body-strong flex items-center gap-2 text-ink">
            <span className="size-2 shrink-0 rounded-full bg-tomato" />
            <span>Money Out</span>
          </span>
          <span className="type-figure-row text-ink">
            −<Amount value={report.totalSpend} currency={getMainCurrency()} />
          </span>
        </div>

        <ul className="divide-y divide-line/60">
          {report.categories.slice(0, 6).map(row => (
            <li key={row.category} className="flex items-center justify-between py-1.5 text-xs">
              <span className="mr-2 truncate text-muted">{row.category}</span>
              <div className="flex shrink-0 items-center gap-2 text-right">
                <span className="tabular-nums font-medium text-ink">
                  <Amount value={row.totalEur} currency={getMainCurrency()} />
                </span>
                {report.income > 0 && (
                  <span className="w-12 text-right text-[11px] text-muted">
                    {share(row.totalEur, report.income)}
                  </span>
                )}
              </div>
            </li>
          ))}
          {report.categories.length > 6 && (
            <li className="flex items-center justify-between py-1.5 text-xs text-muted">
              <span>{report.categories.length - 6} other categories</span>
              <span className="tabular-nums font-medium">
                <Amount value={report.categories.slice(6).reduce((sum, row) => sum + row.totalEur, 0)} currency={getMainCurrency()} />
              </span>
            </li>
          )}
        </ul>
      </div>

      {/* Net Outcome */}
      <div className={cn(
        'flex items-center justify-between rounded-[var(--radius-lg)] border p-3.5',
        isSurplus ? 'border-pine/30 bg-pine/10 text-pine' : 'border-tomato/30 bg-tomato/10 text-tomato'
      )}>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider">
            {isSurplus ? 'Net Left Over (Surplus)' : 'Net Deficit (From Savings)'}
          </div>
          <div className="mt-0.5 text-xs text-muted">
            {report.income > 0 ? `${Math.abs(Math.round((net / report.income) * 100))}% of period income` : 'No income recorded'}
          </div>
        </div>
        <div className="text-lg font-bold tabular-nums">
          <Amount value={net} currency={getMainCurrency()} tone="flow" />
        </div>
      </div>
    </div>
  );
};

const SummaryReport: React.FC<{ report: Report; setCurrentPage?: (page: Page) => void }> = ({ report, setCurrentPage }) => {
  const isPrivate = useContext(PrivacyContext);
  const insights = reportInsights(report);

  // Cumulative spending velocity trajectory
  const cumulativeVelocity = useMemo(() => {
    let cumCurrent = 0;
    let cumPrevious = 0;
    return report.velocity.map(pt => {
      cumCurrent += pt.current;
      cumPrevious += pt.previous;
      return {
        date: pt.date,
        label: shortDate(pt.date),
        current: Number(cumCurrent.toFixed(2)),
        previous: Number(cumPrevious.toFixed(2)),
      };
    });
  }, [report.velocity]);

  // Donut slices for top 4 categories + other
  const topCategories = report.categories.slice(0, 4);
  const restSpend = Math.max(0, report.totalSpend - topCategories.reduce((sum, row) => sum + row.totalEur, 0));
  const donutSlices = useMemo(() => [
    ...topCategories.map((row, index) => ({
      label: row.category,
      value: row.totalEur,
      color: SLICE_COLORS[index] ?? 'var(--muted)',
    })),
    ...(restSpend > 0.005 ? [{
      label: 'Other',
      value: restSpend,
      color: 'var(--muted)',
    }] : [])
  ], [topCategories, restSpend]);

  // Top merchants by spend in this period
  const topMerchants = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    report.rows.forEach(tx => {
      const name = tx.merchant || tx.description || 'Unknown';
      const entry = map.get(name) || { total: 0, count: 0 };
      entry.total += Math.abs(convertToMain(tx.amount, tx.currency));
      entry.count += 1;
      map.set(name, entry);
    });
    return Array.from(map.entries())
      .map(([name, { total, count }]) => ({ name, total, count }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);
  }, [report.rows]);

  // 50/30/20 Breakdown metrics
  const needsItem = report.needs.find(n => n.name === 'Needs');
  const wantsItem = report.needs.find(n => n.name === 'Wants');
  const othersItem = report.needs.find(n => n.name === 'Others');
  const needsVal = needsItem?.value ?? 0;
  const wantsVal = wantsItem?.value ?? 0;
  const othersVal = othersItem?.value ?? 0;
  const netSavings = report.income - report.totalSpend;
  const isSurplus = netSavings >= 0;

  // Periods & Velocity pacing
  const daysInPeriod = Math.max(1, report.velocity.length);
  const dailyRunRate = report.totalSpend / daysInPeriod;
  const overBudgets = report.budget.filter(b => b.varianceEur < 0);

  return (
    <div className="space-y-6">
      {/* 1. Executive Headline KPI Cards */}
      <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
        {/* Outflow / Total Spend */}
        <div className="rounded-[var(--radius-lg)] border border-line bg-inset/30 p-3.5">
          <div className="flex items-center justify-between">
            <span className="type-label text-muted">Total Outflow</span>
            {report.changePct !== null && (
              <Badge tone={report.changePct > 0 ? 'attention' : 'positive'} className="px-1.5 py-0.5 text-[11px]">
                {report.changePct >= 0 ? '+' : ''}{report.changePct.toFixed(0)}%
              </Badge>
            )}
          </div>
          <div className="type-figure-row mt-1 text-ink">
            <Amount value={report.totalSpend} currency={getMainCurrency()} />
          </div>
          <div className="type-caption mt-1 text-muted">
            {report.count} payments · <Amount value={dailyRunRate} currency={getMainCurrency()} />/day
          </div>
        </div>

        {/* Inflow / Total Income */}
        <div className="rounded-[var(--radius-lg)] border border-line bg-inset/30 p-3.5">
          <div className="flex items-center justify-between">
            <span className="type-label text-muted">Total Inflow</span>
            <span className="size-2 shrink-0 rounded-full bg-pine" />
          </div>
          <div className="type-figure-row mt-1 text-pine">
            +<Amount value={report.income} currency={getMainCurrency()} />
          </div>
          <div className="type-caption mt-1 text-muted">
            {report.incomeReport.sources.length} sources · {report.incomeReport.count} deposits
          </div>
        </div>

        {/* Net Savings & Savings Rate */}
        <div className="rounded-[var(--radius-lg)] border border-line bg-inset/30 p-3.5">
          <div className="flex items-center justify-between">
            <span className="type-label text-muted">Net Cash Flow</span>
            <Badge tone={isSurplus ? 'positive' : 'negative'} className="px-1.5 py-0.5 text-[11px]">
              {report.savingsRate.toFixed(0)}% saved
            </Badge>
          </div>
          <div className="type-figure-row mt-1">
            <Amount value={netSavings} currency={getMainCurrency()} tone="flow" />
          </div>
          <div className="type-caption mt-1 text-muted">
            {isSurplus ? 'Period surplus retained' : 'Funded from savings'}
          </div>
        </div>

        {/* Fixed Commitments */}
        <div className="rounded-[var(--radius-lg)] border border-line bg-inset/30 p-3.5">
          <div className="flex items-center justify-between">
            <span className="type-label text-muted">Repeat Commitments</span>
            <span className="type-caption font-medium text-muted">{report.recurring.length} svcs</span>
          </div>
          <div className="type-figure-row mt-1 text-ink">
            <Amount value={report.recurringImpact} currency={getMainCurrency()} />
          </div>
          <div className="type-caption mt-1 text-muted">
            Estimated monthly baseline
          </div>
        </div>
      </div>

      {/* 2. Visual Graphs & Charts Row (Trajectory & Categories Donut) */}
      <div className="grid gap-5 min-[900px]:grid-cols-2">
        {/* Left: Cumulative Spending Trajectory Chart */}
        <div className="flex flex-col justify-between rounded-[var(--radius-lg)] border border-line bg-surface p-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
              <div>
                <h3 className="type-body-strong text-ink">Cumulative Trajectory</h3>
                <p className="type-caption text-muted">Daily pace vs prior period</p>
              </div>
              <ul className="flex items-center gap-3 text-xs" aria-label="Legend">
                <li className="flex items-center gap-1.5 font-medium text-ink">
                  <span className="h-1 w-3.5 rounded-full bg-chart-1" />
                  <span>This period</span>
                </li>
                <li className="flex items-center gap-1.5 text-muted">
                  <span className="h-0.5 w-3.5 rounded-full bg-muted border-dashed" />
                  <span>Prior</span>
                </li>
              </ul>
            </div>
            {cumulativeVelocity.length < 2 ? (
              <div className="flex h-[200px] items-center justify-center text-xs text-muted">
                Insufficient velocity data in this timeframe
              </div>
            ) : (
              <div className="h-[210px] w-full pt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cumulativeVelocity}>
                    <defs>
                      <linearGradient id="summarySpendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--line)" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'var(--muted)', fontSize: 11 }}
                      minTickGap={28}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'var(--muted)', fontSize: 11 }}
                      width={44}
                      tickFormatter={val => isPrivate ? '•••' : formatCurrency(val, getMainCurrency(), { compact: true })}
                    />
                    <Tooltip
                      contentStyle={{ background: 'var(--solid)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 12 }}
                      formatter={(val: number, name: string) => [
                        isPrivate ? '•••' : formatCurrency(val, getMainCurrency()),
                        name === 'current' ? 'This period' : 'Prior period'
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="previous"
                      stroke="var(--muted)"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="current"
                      stroke="var(--chart-1)"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#summarySpendGrad)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-line/60 pt-2 text-xs text-muted">
            <span>Period Total: <span className="font-semibold text-ink"><Amount value={report.totalSpend} currency={getMainCurrency()} /></span></span>
            <span>Prior Total: <span className="font-medium text-ink"><Amount value={report.previousSpend} currency={getMainCurrency()} /></span></span>
          </div>
        </div>

        {/* Right: Category Distribution Donut Chart */}
        <div className="flex flex-col justify-between rounded-[var(--radius-lg)] border border-line bg-surface p-4">
          <div>
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <div>
                <h3 className="type-body-strong text-ink">Category Distribution</h3>
                <p className="type-caption text-muted">Top spending buckets</p>
              </div>
              <span className="type-caption text-muted">{report.categories.length} total categories</span>
            </div>

            {donutSlices.length === 0 ? (
              <div className="flex h-[200px] items-center justify-center text-xs text-muted">
                No categorical spending recorded
              </div>
            ) : (
              <div className="grid grid-cols-1 items-center gap-4 pt-3 sm:grid-cols-[140px_minmax(0,1fr)]">
                <div className="mx-auto size-[140px]">
                  <PieChart data={donutSlices} innerRadius={46} padAngle={0.03}>
                    {donutSlices.map((_, index) => <PieSlice key={index} index={index} />)}
                    <PieCenter defaultLabel="Spent">
                      {({ value, label, isHovered }) => (
                        <span className="flex flex-col items-center">
                          <span className="text-[10px] font-semibold uppercase text-muted">{label}</span>
                          <span className="text-xs font-bold text-ink">
                            <Amount value={isHovered ? value : report.totalSpend} currency={getMainCurrency()} />
                          </span>
                        </span>
                      )}
                    </PieCenter>
                  </PieChart>
                </div>

                <ul className="min-w-0 space-y-1.5">
                  {donutSlices.map((slice) => {
                    const pct = report.totalSpend > 0 ? (slice.value / report.totalSpend) * 100 : 0;
                    return (
                      <li key={slice.label} className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex min-w-0 items-center gap-2 truncate">
                          <span className="size-2 shrink-0 rounded-full" style={{ background: slice.color }} />
                          <span className="truncate text-ink">{slice.label}</span>
                        </span>
                        <div className="flex shrink-0 items-center gap-2 text-right">
                          <span className="tabular-nums font-medium text-ink">
                            <Amount value={slice.value} currency={getMainCurrency()} />
                          </span>
                          <span className="w-9 text-right tabular-nums text-[11px] text-muted">
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-line/60 pt-2 text-xs text-muted">
            <span>Leading: <span className="font-semibold text-ink">{topCategories[0]?.category ?? 'None'}</span></span>
            {topCategories[0] && (
              <span>{((topCategories[0].totalEur / Math.max(1, report.totalSpend)) * 100).toFixed(0)}% of total</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Financial Wellness & 50 / 30 / 20 Allocation Gauge */}
      <div className="space-y-3.5 rounded-[var(--radius-lg)] border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
          <div>
            <h3 className="type-body-strong text-ink">Allocation Balance (50 · 30 · 20)</h3>
            <p className="type-caption text-muted">Needs vs Wants vs Net Savings / Retention</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-chart-1" />Needs (50% target)</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-chart-4" />Wants (30% target)</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-pine" />Savings (20% target)</span>
          </div>
        </div>

        {/* Tripartite multi-segment progress bar */}
        <div className="relative flex h-3 w-full overflow-hidden rounded-full bg-inset">
          {needsVal > 0 && (
            <div
              className="h-full bg-chart-1 transition-all duration-normal"
              style={{ width: `${(needsVal / Math.max(1, needsVal + wantsVal + Math.max(0, netSavings) + othersVal)) * 100}%` }}
              title={`Needs: ${formatCurrency(needsVal, getMainCurrency())}`}
            />
          )}
          {wantsVal > 0 && (
            <div
              className="h-full bg-chart-4 transition-all duration-normal"
              style={{ width: `${(wantsVal / Math.max(1, needsVal + wantsVal + Math.max(0, netSavings) + othersVal)) * 100}%` }}
              title={`Wants: ${formatCurrency(wantsVal, getMainCurrency())}`}
            />
          )}
          {netSavings > 0 && (
            <div
              className="h-full bg-pine transition-all duration-normal"
              style={{ width: `${(netSavings / Math.max(1, needsVal + wantsVal + Math.max(0, netSavings) + othersVal)) * 100}%` }}
              title={`Savings: ${formatCurrency(netSavings, getMainCurrency())}`}
            />
          )}
          {othersVal > 0 && (
            <div
              className="h-full bg-muted transition-all duration-normal"
              style={{ width: `${(othersVal / Math.max(1, needsVal + wantsVal + Math.max(0, netSavings) + othersVal)) * 100}%` }}
              title={`Other / Unclassified: ${formatCurrency(othersVal, getMainCurrency())}`}
            />
          )}
        </div>

        {/* 3 Allocation Cards */}
        <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-3">
          <div className="rounded-md border border-line/60 bg-inset/30 p-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-ink">Needs (Essentials)</span>
              <span className="text-muted">Target 50%</span>
            </div>
            <div className="type-body-strong mt-1 text-ink">
              <Amount value={needsVal} currency={getMainCurrency()} />
            </div>
            <div className="type-caption mt-0.5 text-muted">
              {report.totalSpend > 0 ? `${((needsVal / report.totalSpend) * 100).toFixed(0)}% of expenses` : '0%'}
            </div>
          </div>

          <div className="rounded-md border border-line/60 bg-inset/30 p-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-ink">Wants (Lifestyle)</span>
              <span className="text-muted">Target 30%</span>
            </div>
            <div className="type-body-strong mt-1 text-ink">
              <Amount value={wantsVal} currency={getMainCurrency()} />
            </div>
            <div className="type-caption mt-0.5 text-muted">
              {report.totalSpend > 0 ? `${((wantsVal / report.totalSpend) * 100).toFixed(0)}% of expenses` : '0%'}
            </div>
          </div>

          <div className="rounded-md border border-line/60 bg-inset/30 p-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-ink">Savings / Buffer</span>
              <span className="text-muted">Target 20%</span>
            </div>
            <div className="type-body-strong mt-1">
              <Amount value={netSavings} currency={getMainCurrency()} tone="flow" />
            </div>
            <div className="type-caption mt-0.5 text-muted">
              {report.income > 0 ? `${report.savingsRate.toFixed(0)}% of period income` : 'No income'}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Top Merchants & Operational Health Spotlight */}
      <div className="grid gap-5 min-[900px]:grid-cols-2">
        {/* Top Merchants List */}
        <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-4">
          <div className="mb-3 flex items-center justify-between border-b border-line pb-2.5">
            <div>
              <h3 className="type-body-strong text-ink">Leading Merchants</h3>
              <p className="type-caption text-muted">Where the largest sums were paid</p>
            </div>
            {setCurrentPage && (
              <Button variant="ghost" size="sm" onPress={() => setCurrentPage('Merchants')} className="-mr-1">
                View all
              </Button>
            )}
          </div>

          {topMerchants.length === 0 ? (
            <p className="type-caption py-6 text-center text-muted">No merchant data in this range</p>
          ) : (
            <ul className="divide-y divide-line/60">
              {topMerchants.map((m, idx) => (
                <li key={m.name} className="flex items-center justify-between py-2 text-xs">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-inset text-[10px] font-bold text-muted">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink">{m.name}</div>
                      <div className="text-[11px] text-muted">{m.count} {m.count === 1 ? 'payment' : 'payments'}</div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="tabular-nums font-semibold text-ink">
                      <Amount value={m.total} currency={getMainCurrency()} />
                    </div>
                    <div className="text-[11px] text-muted">
                      Avg <Amount value={m.total / m.count} currency={getMainCurrency()} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Operational Signals & Alerts */}
        <div className="flex flex-col justify-between rounded-[var(--radius-lg)] border border-line bg-surface p-4">
          <div>
            <div className="mb-3 border-b border-line pb-2.5">
              <h3 className="type-body-strong text-ink">Period Signals & Health</h3>
              <p className="type-caption text-muted">Budget pacing, velocity, and statistical alerts</p>
            </div>

            <div className="space-y-3">
              {/* Daily burn rate */}
              <div className="flex items-start gap-3 rounded-md border border-line/50 bg-inset/20 p-2.5">
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-inset text-primary">
                  <Icon name="trend-up-01" size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-ink">
                    <span>Daily Burn Rate</span>
                    <span className="tabular-nums font-bold"><Amount value={dailyRunRate} currency={getMainCurrency()} />/day</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted">
                    Averaged across {daysInPeriod} active days in this selected period
                  </p>
                </div>
              </div>

              {/* Budget health */}
              <div className="flex items-start gap-3 rounded-md border border-line/50 bg-inset/20 p-2.5">
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-inset text-primary">
                  <Icon name="wallet-02" size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-ink">
                    <span>Budget Tracking</span>
                    {overBudgets.length > 0 ? (
                      <Badge tone="negative" className="text-[11px]">{overBudgets.length} over limit</Badge>
                    ) : (
                      <Badge tone="positive" className="text-[11px]">All on track</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {report.budget.length === 0
                      ? 'No active budgets established for this period'
                      : overBudgets.length > 0
                        ? `${overBudgets.length} of ${report.budget.length} category budgets exceeded their limits`
                        : `${report.budget.length} active category budgets remained within spending targets`}
                  </p>
                </div>
              </div>

              {/* Statistical Outliers */}
              <div className="flex items-start gap-3 rounded-md border border-line/50 bg-inset/20 p-2.5">
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-inset text-primary">
                  <Icon name="alert-02" size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-ink">
                    <span>Outlier Payments</span>
                    {report.unusual.length > 0 ? (
                      <Badge tone="attention" className="text-[11px]">{report.unusual.length} detected</Badge>
                    ) : (
                      <Badge tone="neutral" className="text-[11px]">Normal variance</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {report.unusual.length > 0
                      ? `${report.unusual.length} transactions deviated by more than 2σ from your normal payments`
                      : 'No unusual large anomalies detected in this timeframe'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Key Insights Cards */}
      <div className="space-y-3">
        <div className="type-body-strong flex items-center gap-2 text-ink">
          <Icon name="sparkles" size={16} className="text-primary" />
          <span>Executive Takeaways</span>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {insights.map((line, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-line bg-surface p-3.5 shadow-xs transition-colors hover:border-line-strong hover:bg-inset/30"
            >
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-inset text-primary">
                <Icon name={idx === 0 ? 'analytics-01' : idx === 1 ? 'trend-up-01' : idx === 2 ? 'repeat-01' : 'wallet-02'} size={15} />
              </div>
              <p className="type-body text-sm leading-relaxed text-ink">{line}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const UsualReport: React.FC<{ report: Report }> = ({ report }) => {
  if (report.usual.length === 0) return <Empty>There's no earlier spending to compare with.</Empty>;

  const overCount = report.usual.filter(r => r.difference > 0.01).length;
  const underCount = report.usual.filter(r => r.difference < -0.01).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div className="type-caption text-muted">
          Comparing category spending against your 3-period historical baseline
        </div>
        <div className="flex items-center gap-2">
          {overCount > 0 && <Badge tone="attention">{overCount} over usual</Badge>}
          {underCount > 0 && <Badge tone="positive">{underCount} under usual</Badge>}
        </div>
      </div>

      <div className="divide-y divide-line">
        {report.usual.map(row => {
          const maxVal = Math.max(row.spent, row.usual, 1);
          const spentPct = Math.min(100, (row.spent / maxVal) * 100);
          const usualPct = Math.min(100, (row.usual / maxVal) * 100);
          const isOver = row.difference > 0.005;
          const isUnder = row.difference < -0.005;
          const diffPct = row.usual > 0 ? (row.difference / row.usual) * 100 : 0;

          return (
            <div key={row.category} className="space-y-2 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="type-body-strong truncate text-ink">{row.category}</div>
                  <div className="type-caption flex items-center gap-2 text-muted">
                    <span>Usually <Amount value={row.usual} currency={getMainCurrency()} /></span>
                    <span>·</span>
                    <span>Spent <Amount value={row.spent} currency={getMainCurrency()} /></span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="type-figure-row text-ink">
                    <Amount value={row.spent} currency={getMainCurrency()} />
                  </div>
                  <div className="type-caption">
                    {!isOver && !isUnder ? (
                      <span className="text-muted">Spot on</span>
                    ) : isOver ? (
                      <span className="font-medium text-tomato">
                        +<Amount value={row.difference} currency={getMainCurrency()} /> (+{Math.abs(diffPct).toFixed(0)}%)
                      </span>
                    ) : (
                      <span className="font-medium text-pine">
                        −<Amount value={Math.abs(row.difference)} currency={getMainCurrency()} /> (−{Math.abs(diffPct).toFixed(0)}%)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Visual Variance Bar with Baseline Marker */}
              <div className="relative h-2 w-full rounded-full bg-inset">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-normal',
                    isOver ? 'bg-tomato' : isUnder ? 'bg-pine' : 'bg-muted'
                  )}
                  style={{ width: `${spentPct}%` }}
                />
                <div
                  className="absolute -top-0.5 -bottom-0.5 w-0.5 rounded-full bg-ink shadow-xs"
                  style={{ left: `${usualPct}%` }}
                  title={`Baseline: ${formatCurrency(row.usual, getMainCurrency())}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const BudgetReport: React.FC<{ report: Report }> = ({ report }) => {
  const [sortMode, setSortMode] = useState<'overspend' | 'budget' | 'remaining'>('overspend');

  if (report.budget.length === 0) return <Empty>You have no budgets yet.</Empty>;

  const totalBudget = report.budget.reduce((sum, b) => sum + b.budgetEur, 0);
  const totalActual = report.budget.reduce((sum, b) => sum + b.actualEur, 0);
  const overCount = report.budget.filter(b => b.varianceEur < 0).length;

  const sortedRows = [...report.budget].sort((a, b) => {
    if (sortMode === 'overspend') return a.varianceEur - b.varianceEur;
    if (sortMode === 'budget') return b.budgetEur - a.budgetEur;
    return b.varianceEur - a.varianceEur;
  });

  const SORT_ITEMS = [
    { id: 'overspend', label: 'Worst overspend' },
    { id: 'budget', label: 'Largest budget' },
    { id: 'remaining', label: 'Most left' },
  ];

  return (
    <div className="space-y-4">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
        <div className="rounded-[var(--radius-lg)] border border-line bg-inset/30 p-3">
          <div className="type-label text-muted">Total Budgeted</div>
          <div className="type-figure-row mt-1 text-ink"><Amount value={totalBudget} currency={getMainCurrency()} /></div>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-line bg-inset/30 p-3">
          <div className="type-label text-muted">Actual Spent</div>
          <div className="type-figure-row mt-1 text-ink"><Amount value={totalActual} currency={getMainCurrency()} /></div>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-line bg-inset/30 p-3">
          <div className="type-label text-muted">Remaining Balance</div>
          <div className="type-figure-row mt-1">
            <Amount value={totalBudget - totalActual} currency={getMainCurrency()} tone="flow" />
          </div>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-line bg-inset/30 p-3">
          <div className="type-label text-muted">Status</div>
          <div className="type-figure-row mt-1">
            {overCount > 0 ? (
              <span className="font-semibold text-tomato">{overCount} over limit</span>
            ) : (
              <span className="font-semibold text-pine">All within limit</span>
            )}
          </div>
        </div>
      </div>

      {/* Sort switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
        <div className="type-caption text-muted">Limits scaled to selected period</div>
        <SegmentedControl items={SORT_ITEMS} activeId={sortMode} onChange={id => setSortMode(id as any)} />
      </div>

      {/* Rows */}
      <div className="divide-y divide-line">
        {sortedRows.map(row => {
          const ratio = row.budgetEur > 0 ? (row.actualEur / row.budgetEur) : 0;
          const pct = Math.round(ratio * 100);
          const isOver = row.varianceEur < 0;
          const isWarning = !isOver && ratio >= 0.8;
          const fillWidth = Math.min(100, Math.max(0, ratio * 100));

          return (
            <div key={row.categoryName} className="space-y-2 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="type-body-strong truncate text-ink">{row.categoryName}</div>
                  <div className="type-caption text-muted">
                    Limit: <Amount value={row.budgetEur} currency={getMainCurrency()} />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="type-figure-row text-ink">
                    <Amount value={row.actualEur} currency={getMainCurrency()} />
                  </div>
                  <div className="type-caption">
                    {isOver ? (
                      <Badge tone="negative" className="mt-0.5">
                        <Amount value={Math.abs(row.varianceEur)} currency={getMainCurrency()} /> over ({pct}%)
                      </Badge>
                    ) : isWarning ? (
                      <Badge tone="attention" className="mt-0.5">
                        <Amount value={row.varianceEur} currency={getMainCurrency()} /> left ({pct}%)
                      </Badge>
                    ) : (
                      <span className="font-medium text-pine">
                        <Amount value={row.varianceEur} currency={getMainCurrency()} /> left ({pct}%)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress gauge bar */}
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-inset">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-normal',
                    isOver ? 'bg-tomato' : isWarning ? 'bg-amber' : 'bg-pine'
                  )}
                  style={{ width: `${fillWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const RecurringReport: React.FC<{ report: Report }> = ({ report }) => {
  if (report.recurring.length === 0) return <Empty>Nothing here repeats on a steady schedule.</Empty>;

  const frequencies = ['Monthly', 'Every two weeks', 'Weekly'];
  const grouped = useMemo(() => {
    const map = new Map<string, typeof report.recurring>();
    report.recurring.forEach(item => {
      const list = map.get(item.frequency) || [];
      list.push(item);
      map.set(item.frequency, list);
    });
    return map;
  }, [report.recurring]);

  return (
    <div className="space-y-6">
      {/* Top figures */}
      <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-3">
        <div className="rounded-[var(--radius-lg)] border border-line bg-inset/30 p-3.5">
          <div className="type-label text-muted">Repeat monthly cost</div>
          <div className="type-figure-row mt-1 text-ink"><Amount value={report.recurringImpact} currency={getMainCurrency()} /></div>
          <div className="type-caption mt-1 text-muted">Across all frequencies</div>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-line bg-inset/30 p-3.5">
          <div className="type-label text-muted">Active Merchants</div>
          <div className="type-figure-row mt-1 text-ink">{report.recurring.length}</div>
          <div className="type-caption mt-1 text-muted">Recurring subscriptions & bills</div>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-line bg-inset/30 p-3.5">
          <div className="type-label text-muted">Annual Equivalent</div>
          <div className="type-figure-row mt-1 text-ink"><Amount value={report.recurringImpact * 12} currency={getMainCurrency()} /></div>
          <div className="type-caption mt-1 text-muted">Estimated yearly spend</div>
        </div>
      </div>

      {/* Grouped lists */}
      {frequencies.map(freq => {
        const items = grouped.get(freq);
        if (!items || items.length === 0) return null;
        const subtotal = items.reduce((sum, item) => sum + item.estimatedMonthlyEur, 0);

        return (
          <div key={freq} className="space-y-2">
            <div className="flex items-center justify-between border-b border-line pb-1.5">
              <span className="type-label flex items-center gap-2 font-semibold text-ink">
                <span>{freq}</span>
                <span className="rounded-full bg-inset px-2 py-0.5 text-xs font-normal text-muted">{items.length}</span>
              </span>
              <span className="type-caption font-medium text-muted">
                Subtotal: <Amount value={subtotal} currency={getMainCurrency()} />/mo
              </span>
            </div>
            <ul className="divide-y divide-line">
              {items.map(row => (
                <Row
                  key={row.merchant}
                  title={row.merchant}
                  detail={`${row.occurrences} payments detected · Avg <Amount value={row.averageEur} />/charge`}
                  value={<Amount value={row.estimatedMonthlyEur} currency={getMainCurrency()} />}
                  note="a month"
                />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

const UnusualReport: React.FC<{ report: Report }> = ({ report }) => {
  if (report.unusual.length === 0) return <Empty>Nothing stands out.</Empty>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-line pb-2 type-caption text-muted">
        <span>Transactions statistically deviating (&gt;2σ) from your period average</span>
        <Badge tone="attention">{report.unusual.length} outliers detected</Badge>
      </div>

      <ul className="divide-y divide-line">
        {report.unusual.map(row => {
          const ratio = report.average > 0 ? (row.amountEur / report.average).toFixed(1) : null;
          return (
            <li key={row.id} className="flex min-h-14 items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="type-body-strong truncate text-ink">{row.merchant}</span>
                  <Badge tone="attention" className="px-1.5 py-0.5 text-[11px] font-medium">
                    {ratio ? `${ratio}× normal` : `+${row.zScore.toFixed(1)}σ`}
                  </Badge>
                </div>
                <div className="type-caption mt-0.5 text-muted">
                  {row.category} · {shortDate(row.date)}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="type-figure-row text-ink">
                  <Amount value={row.amountEur} currency={getMainCurrency()} />
                </div>
                <div className="type-caption text-muted">
                  avg was <Amount value={report.average} currency={getMainCurrency()} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const ForecastReport: React.FC<{ report: Report }> = ({ report }) => {
  const f = report.forecast;
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const dayOfMonth = Math.min(daysInMonth, Math.max(1, daysInMonth - f.remainingDays));
  const monthProgress = Math.round((dayOfMonth / daysInMonth) * 100);

  const prevDiffPct = report.previousSpend > 0 ? ((f.projectedMonthEnd - report.previousSpend) / report.previousSpend) * 100 : null;

  return (
    <div className="space-y-6">
      {/* 4 KPI Figures */}
      <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
        <div className="rounded-[var(--radius-lg)] border border-line bg-inset/30 p-3.5">
          <div className="type-label text-muted">Spent so far</div>
          <div className="type-figure-row mt-1 text-ink"><Amount value={f.mtdSpendEur} currency={getMainCurrency()} /></div>
          <div className="type-caption mt-1 text-muted">Day {dayOfMonth} of {daysInMonth}</div>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-line bg-inset/30 p-3.5">
          <div className="type-label text-muted">Daily burn rate</div>
          <div className="type-figure-row mt-1 text-ink"><Amount value={f.dailyAverage} currency={getMainCurrency()} /></div>
          <div className="type-caption mt-1 text-muted">Average per day</div>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-line bg-inset/30 p-3.5">
          <div className="type-label text-muted">Days remaining</div>
          <div className="type-figure-row mt-1 text-ink">{f.remainingDays}</div>
          <div className="type-caption mt-1 text-muted">In current month</div>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-line bg-inset/30 p-3.5">
          <div className="type-label text-muted">Projected month-end</div>
          <div className="type-figure-row mt-1 text-primary"><Amount value={f.projectedMonthEnd} currency={getMainCurrency()} /></div>
          <div className="type-caption mt-1 text-muted">Estimated final spend</div>
        </div>
      </div>

      {/* Trajectory & Pacing Card */}
      <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="type-body-strong text-ink">Month-End Trajectory</div>
            <div className="type-caption text-muted">
              {monthProgress}% of month elapsed ({dayOfMonth} of {daysInMonth} days)
            </div>
          </div>
          {prevDiffPct !== null && (
            <Badge tone={prevDiffPct > 5 ? 'attention' : prevDiffPct < -5 ? 'positive' : 'neutral'}>
              {prevDiffPct > 0 ? '+' : ''}{prevDiffPct.toFixed(0)}% vs last month (<Amount value={report.previousSpend} currency={getMainCurrency()} />)
            </Badge>
          )}
        </div>

        {/* Visual Progress Bar */}
        <div className="space-y-1.5">
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-inset">
            <div
              className="h-full rounded-full bg-primary transition-all duration-normal"
              style={{ width: `${Math.min(100, Math.max(2, (f.mtdSpendEur / Math.max(1, f.projectedMonthEnd)) * 100))}%` }}
            />
          </div>
          <div className="flex justify-between type-caption text-muted">
            <span>MTD: <Amount value={f.mtdSpendEur} currency={getMainCurrency()} /></span>
            <span>Est. total: <Amount value={f.projectedMonthEnd} currency={getMainCurrency()} /></span>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-md border border-line/60 bg-inset/40 p-3 text-xs text-muted">
          <Icon name="analytics-01" size={16} className="mt-0.5 shrink-0 text-primary" />
          <p className="leading-relaxed">
            At your current pace of <span className="font-semibold text-ink"><Amount value={f.dailyAverage} currency={getMainCurrency()} />/day</span> across the next <span className="font-semibold text-ink">{f.remainingDays} days</span>, month-end spending is estimated to land at <span className="font-semibold text-ink"><Amount value={f.projectedMonthEnd} currency={getMainCurrency()} /></span>.
          </p>
        </div>
      </div>
    </div>
  );
};

interface ReportPanelProps {
  id: ReportId;
  report: Report;
  cashflowTransactions: Transaction[];
  groupBy: GroupBy;
  onGroupBy: (group: GroupBy) => void;
  isPhone: boolean;
  setCurrentPage?: (page: Page) => void;
}

/** The body of one report, below its "What it says" sentence (D-027). */
const ReportPanel: React.FC<ReportPanelProps> = ({ id, report, cashflowTransactions, groupBy, onGroupBy, isPhone, setCurrentPage }) => {
  const { incomeCategories, expenseCategories } = useCategoryContext();

  switch (id) {
    case 'summary':
      return <SummaryReport report={report} setCurrentPage={setCurrentPage} />;
    case 'spending':
      return <SpendingChart report={report} />;
    case 'categories':
      return <CategoryReport report={report} />;
    case 'usual':
      return <UsualReport report={report} />;
    case 'needs':
      return report.needs.length === 0 ? <Empty>There is no spending in this period.</Empty> : (
        <ul className="space-y-5">
          {report.needs.map(part => {
            const percent = (part.value / report.totalSpend) * 100;
            return (
              <li key={part.name}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="type-body-strong text-ink">{part.name}</span>
                  <span className="type-caption shrink-0 text-muted"><Amount value={part.value} currency={getMainCurrency()} />, {percent.toFixed(1)}% of a {part.target}% guide</span>
                </div>
                <div className="relative mt-1.5 h-2 rounded-full bg-inset">
                  <div className="h-full rounded-full" style={{ width: `${percent}%`, background: PART_COLORS[part.name] }} />
                  <span aria-hidden className="absolute -top-1 h-4 w-0.5 rounded-full bg-ink" style={{ left: `${part.target}%` }} />
                </div>
                <p className="type-caption mt-1 text-muted">{part.description}</p>
              </li>
            );
          })}
        </ul>
      );
    case 'breakdown':
      return <BreakdownReport report={report} groupBy={groupBy} onGroupBy={onGroupBy} setCurrentPage={setCurrentPage} />;
    case 'cashflow':
      return isPhone ? <PhoneCashflow report={report} /> : <CashflowSankey transactions={cashflowTransactions} incomeCategories={incomeCategories} expenseCategories={expenseCategories} />;
    case 'budget':
      return <BudgetReport report={report} />;
    case 'recurring':
      return <RecurringReport report={report} />;
    case 'unusual':
      return <UnusualReport report={report} />;
    case 'categoryMonths':
      return <CategoryMonthsReport report={report} />;
    case 'income':
      return <IncomeReport report={report} />;
    case 'forecast':
      return <ForecastReport report={report} />;
  }
};

export default ReportPanel;
