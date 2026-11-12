import React, { useContext, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Page, Transaction } from '../types';
import { useCategoryContext } from '../contexts/FinancialDataContext';
import { formatCurrency, parseLocalDate, getMainCurrency } from '../utils';
import { reportInsights, type GroupBy, type Report, type ReportId } from '../utils/reportsModel';
import { PieCenter, PieChart, PieSlice } from '../src/components/charts';
import { LINE_MOTION } from '../src/components/charts/animation';
import CashflowSankey from './CashflowSankey';
import { Button } from './ui/Actions';
import { Badge, ShowMore } from './ui/Display';
import { Amount, PrivacyContext } from './ui/Money';
import SegmentedControl from './ui/SegmentedControl';

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
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[480px] border-separate border-spacing-y-1 text-left">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="type-label py-1.5 pr-3 text-muted">Category</th>
              {months.map(key => <th key={key} scope="col" className="type-label px-1 py-1.5 text-right text-muted">{monthLabel(key)}</th>)}
              <th scope="col" className="type-label py-1.5 pl-3 text-right text-muted">Total</th>
            </tr>
          </thead>
          <tbody>
            {table.slice(0, shown).map(row => (
              <tr key={row.category}>
                <th scope="row" className="type-body max-w-[160px] truncate py-1 pr-3 text-left font-normal text-ink">{row.category}</th>
                {months.map(key => {
                  const value = row.cells[key] ?? 0;
                  const strength = max > 0 ? Math.round((value / max) * 70) : 0;
                  return (
                    <td key={key} className="px-0.5 py-0">
                      <span
                        title={`${row.category}, ${monthLabel(key)}: ${isPrivate ? '•••' : formatCurrency(value, getMainCurrency())}`}
                        className="type-caption privacy-blur block rounded-md px-2 py-1.5 text-right tabular-nums text-ink"
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
              <th scope="row" className="type-body-strong pt-2.5 pr-3 text-left text-ink">All spending</th>
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

/** On phones a Sankey can't fit its labels, so the money in and out reads as a list (`D-034`). */
const PhoneCashflow: React.FC<{ report: Report }> = ({ report }) => (
  <Rows>
    <Row title="Money in" value={<Amount value={report.income} currency={getMainCurrency()} />} />
    {report.categories.slice(0, 6).map(row => <Row key={row.category} title={row.category} value={<Amount value={row.totalEur} currency={getMainCurrency()} />} note={report.income > 0 ? share(row.totalEur, report.income) : undefined} />)}
    {report.categories.length > 6 && <Row title={`${report.categories.length - 6} others`} value={<Amount value={report.categories.slice(6).reduce((sum, row) => sum + row.totalEur, 0)} currency={getMainCurrency()} />} />}
    <Row title="Left over" value={<Amount value={report.income - report.totalSpend} currency={getMainCurrency()} tone="flow" />} />
  </Rows>
);

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
      return (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 min-[900px]:grid-cols-4">
            <Figure label="Money in"><Amount value={report.income} currency={getMainCurrency()} /></Figure>
            <Figure label="Period before"><Amount value={report.previousSpend} currency={getMainCurrency()} /></Figure>
            <Figure label="Average payment"><Amount value={report.average} currency={getMainCurrency()} /></Figure>
            <Figure label="Repeat costs a month"><Amount value={report.recurringImpact} currency={getMainCurrency()} /></Figure>
          </dl>
          <ul className="mt-4 space-y-2 border-t border-line pt-4">
            {reportInsights(report).map(line => <li key={line} className="type-body text-ink">{line}</li>)}
          </ul>
        </>
      );
    case 'spending':
      return <SpendingChart report={report} />;
    case 'categories':
      return <CategoryReport report={report} />;
    case 'usual':
      return report.usual.length === 0 ? <Empty>There's no earlier spending to compare with.</Empty> : (
        <Rows>
          {report.usual.map(row => (
            <Row
              key={row.category}
              title={row.category}
              detail={<>Usually <Amount value={row.usual} currency={getMainCurrency()} /></>}
              value={<Amount value={row.spent} currency={getMainCurrency()} />}
              note={Math.abs(row.difference) < 0.005 ? 'As usual' : <><Amount value={Math.abs(row.difference)} currency={getMainCurrency()} /> {row.difference > 0 ? 'over' : 'under'}</>}
            />
          ))}
        </Rows>
      );
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
      return report.budget.length === 0 ? <Empty>You have no budgets yet.</Empty> : (
        <Rows>
          {report.budget.map(row => (
            <Row
              key={row.categoryName}
              title={row.categoryName}
              detail={<>Limit <Amount value={row.budgetEur} currency={getMainCurrency()} /></>}
              value={<Amount value={row.actualEur} currency={getMainCurrency()} />}
              note={row.varianceEur < 0 ? <Badge tone="negative"><Amount value={-row.varianceEur} currency={getMainCurrency()} /> over</Badge> : <><Amount value={row.varianceEur} currency={getMainCurrency()} /> left</>}
            />
          ))}
        </Rows>
      );
    case 'recurring':
      return report.recurring.length === 0 ? <Empty>Nothing here repeats on a steady schedule.</Empty> : (
        <Rows>
          {report.recurring.map(row => (
            <Row key={row.merchant} title={row.merchant} detail={`${row.frequency}, ${row.occurrences} payments`} value={<Amount value={row.estimatedMonthlyEur} currency={getMainCurrency()} />} note="a month" />
          ))}
        </Rows>
      );
    case 'unusual':
      return report.unusual.length === 0 ? <Empty>Nothing stands out.</Empty> : (
        <Rows>
          {report.unusual.map(row => <Row key={row.id} title={row.merchant} detail={`${row.category}, ${shortDate(row.date)}`} value={<Amount value={row.amountEur} currency={getMainCurrency()} />} />)}
        </Rows>
      );
    case 'categoryMonths':
      return <CategoryMonthsReport report={report} />;
    case 'income':
      return <IncomeReport report={report} />;
    case 'forecast':
      return (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 min-[900px]:grid-cols-4">
          <Figure label="Spent this month"><Amount value={report.forecast.mtdSpendEur} currency={getMainCurrency()} /></Figure>
          <Figure label="A day"><Amount value={report.forecast.dailyAverage} currency={getMainCurrency()} /></Figure>
          <Figure label="Days left">{report.forecast.remainingDays}</Figure>
          <Figure label="Month ends on"><Amount value={report.forecast.projectedMonthEnd} currency={getMainCurrency()} /></Figure>
        </dl>
      );
  }
};

export default ReportPanel;
