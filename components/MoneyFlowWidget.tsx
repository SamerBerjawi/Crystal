import React, { useEffect, useMemo, useState } from 'react';
import type { Account, Category, Currency, Transaction } from '../types';
import { convertToMain, formatCurrency, parseLocalDate, toLocalISOString } from '../utils';
import { budgetAccountIds, spendByCategory } from '../utils/budgetModel';
import { Bar, BarChart, BarXAxis, ChartTooltip, Grid, TrendLine, YAxis } from '../src/components/charts';
import { useChart } from '../src/components/charts/chart-context';
import { Amount } from './ui/Money';
import SegmentedControl from './ui/SegmentedControl';
import { EntityGlyph } from './EntityIcon';
import { EmptyState } from './ui/States';
import { useWidgetBox } from './ui/WidgetGrid';
import { cn } from '../lib/utils';

type Unit = 'weeks' | 'months' | 'quarters';

const UNITS = [{ id: 'weeks', label: 'Weeks' }, { id: 'months', label: 'Months' }, { id: 'quarters', label: 'Quarters' }];
const COUNT: Record<Unit, number> = { weeks: 12, months: 12, quarters: 8 };

interface Period {
  start: Date;
  end: Date;
  short: string;
  long: string;
  /** The period has not finished yet. */
  isOpen: boolean;
}

interface MoneyFlowWidgetProps {
  accounts: Account[];
  /** Every transaction of the accounts counted in analytics. The widget narrows it to the selected accounts. */
  transactions: Transaction[];
  selectedAccountIds: string[];
  expenseCategories: Category[];
  currency: Currency;
  /** Converts an amount in the main currency to the display currency. */
  toDisplay: (eur: number) => number;
  onCategoryClick?: (name: string) => void;
}

const addMonths = (date: Date, months: number) => new Date(date.getFullYear(), date.getMonth() + months, 1);

/** The last N weeks, months or quarters, oldest first, ending with the one that holds today. */
const periodsFor = (unit: Unit, today: Date): Period[] => {
  const count = COUNT[unit];
  const periods: Period[] = [];
  for (let back = count - 1; back >= 0; back -= 1) {
    let start: Date;
    let end: Date;
    if (unit === 'weeks') {
      const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7) - back * 7);
      start = monday;
      end = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    } else if (unit === 'months') {
      start = addMonths(new Date(today.getFullYear(), today.getMonth(), 1), -back);
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    } else {
      const quarterStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
      start = addMonths(quarterStart, -back * 3);
      end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
    }
    const short = unit === 'months' ? start.toLocaleDateString(undefined, { month: 'short' }) : unit === 'quarters' ? `Q${Math.floor(start.getMonth() / 3) + 1}` : start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    const long = unit === 'months'
      ? start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : unit === 'quarters'
        ? `Q${Math.floor(start.getMonth() / 3) + 1} ${start.getFullYear()}`
        : `${start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} to ${end.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
    periods.push({ start, end, short, long, isOpen: end >= new Date(today.getFullYear(), today.getMonth(), today.getDate()) });
  }
  return periods;
};

const ActivePeriod: React.FC<{ onActive: (index: number) => void }> = ({ onActive }) => {
  const { tooltipData } = useChart();
  const index = tooltipData?.index ?? null;
  useEffect(() => { if (index !== null) onActive(index); }, [index, onActive]);
  return null;
};
(ActivePeriod as unknown as { __isPostOverlay: boolean }).__isPostOverlay = true;

/**
 * Money in and out, period by period on Bklit BarChart: bars show what came in and went out, with a trend line,
 * and picking a column shows where that period's money went and who it came from.
 */
const MoneyFlowWidget: React.FC<MoneyFlowWidgetProps> = ({ accounts, transactions, selectedAccountIds, expenseCategories, currency, toDisplay, onCategoryClick }) => {
  const box = useWidgetBox();
  const [unit, setUnit] = useState<Unit>('months');
  const [picked, setPicked] = useState<number | null>(null);

  const today = useMemo(() => new Date(), []);
  const periods = useMemo(() => periodsFor(unit, today), [unit, today]);
  const selected = useMemo(() => new Set(selectedAccountIds), [selectedAccountIds]);
  const scoped = useMemo(() => transactions.filter(tx => selected.has(tx.accountId)), [transactions, selected]);

  const data = useMemo(() => {
    const cash = accounts.filter(account => selected.has(account.id) && account.status !== 'closed' && (account.type === 'Checking' || account.type === 'Savings'));
    const balanceNow = cash.reduce((sum, account) => sum + convertToMain(account.balance, account.currency), 0);
    const cashIds = new Set(cash.map(account => account.id));
    const rows = periods.map(period => ({ ...period, inEur: 0, outEur: 0, afterEur: 0 }));
    const firstStart = periods[0].start.getTime();
    for (const tx of scoped) {
      const day = parseLocalDate(tx.date).getTime();
      const eur = convertToMain(tx.amount, tx.currency);
      // Everything after a period ends is what the balance moved by since, so the balance at its end follows from today's.
      for (const row of rows) if (cashIds.has(tx.accountId) && day > row.end.getTime()) row.afterEur += eur;
      if (tx.transferId || tx.isBalanceAdjustment || tx.isSplitParent || day < firstStart) continue;
      const row = rows.find(item => day >= item.start.getTime() && day <= item.end.getTime());
      if (!row) continue;
      if (tx.type === 'income') row.inEur += Math.abs(eur);
      else if (tx.type === 'expense') row.outEur += Math.abs(eur);
    }
    return rows.map(row => ({ ...row, inValue: toDisplay(row.inEur), outValue: toDisplay(row.outEur), balance: toDisplay(balanceNow - row.afterEur) }));
  }, [accounts, scoped, selected, periods, toDisplay]);

  const index = picked !== null && picked < data.length ? picked : data.length - 1;
  const current = data[index];

  const detail = useMemo(() => {
    if (!current) return null;
    const from = toLocalISOString(current.start);
    const to = toLocalISOString(current.end);
    const spent = spendByCategory(transactions, { from, to }, { accountIds: budgetAccountIds(accounts.filter(account => selected.has(account.id))), categories: expenseCategories, convert: (amount, from2) => toDisplay(convertToMain(amount, from2)) });
    const topLevel = new Map(expenseCategories.filter(category => !category.parentId).map(category => [category.name, category]));
    const total = [...spent.values()].reduce((sum, value) => sum + value, 0);
    const categories = [...spent.entries()].filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, value]) => ({ name, value, share: total > 0 ? value / total : 0, color: topLevel.get(name)?.color || 'var(--muted)', icon: topLevel.get(name)?.icon }));
    const sources = new Map<string, number>();
    for (const tx of scoped) {
      if (tx.type !== 'income' || tx.transferId || tx.isBalanceAdjustment || tx.isSplitParent || tx.date < from || tx.date > to) continue;
      const name = tx.merchant?.trim() || tx.description;
      sources.set(name, (sources.get(name) ?? 0) + toDisplay(Math.abs(convertToMain(tx.amount, tx.currency))));
    }
    const top = [...sources.entries()].sort((a, b) => b[1] - a[1])[0];
    return { categories, topSource: top ? { name: top[0], value: top[1] } : null };
  }, [current, transactions, accounts, selected, expenseCategories, scoped, toDisplay]);

  const hasDuplicateShort = useMemo(() => new Set(data.map(r => r.short)).size < data.length, [data]);
  const chartData = useMemo(() => data.map(row => ({
    month: hasDuplicateShort ? row.long : row.short,
    'Money in': row.inValue,
    'Money out': row.outValue,
  })), [data, hasDuplicateShort]);

  if (data.every(row => row.inValue === 0 && row.outValue === 0)) {
    return <EmptyState icon="chart-column" title="No money moved" description="Nothing came in or went out in these accounts." className="h-full py-6" />;
  }

  const wide = box.width === 0 || box.width >= 700;
  const net = current.inValue - current.outValue;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <p className="type-caption text-muted">Pick a column to see where it went</p>
        <SegmentedControl items={UNITS} activeId={unit} onChange={id => { setUnit(id as Unit); setPicked(null); }} />
      </div>

      <div className={cn('flex min-h-0 flex-1 gap-5', wide ? 'flex-row' : 'flex-col')}>
        <div className="flex min-w-0 flex-1 flex-col h-full min-h-0">
          <div className="min-h-[160px] w-full flex-1">
            <BarChart data={chartData} xDataKey="month" aspectRatio="auto" className="h-full w-full" margin={{ top: 8, right: 8, bottom: 40, left: 56 }}>
              <Grid horizontal />
              <Bar dataKey="Money in" lineCap="round" onClick={(_d, i) => setPicked(i)} />
              <Bar dataKey="Money out" fill="var(--chart-3)" lineCap="round" onClick={(_d, i) => setPicked(i)} />
              <YAxis yAxisId="left" />
              <TrendLine dataKey="Money in" stroke="var(--chart-1)" />
              <BarXAxis />
              <ChartTooltip valueFormatter={(value: number) => formatCurrency(value, currency)} />
              <ActivePeriod onActive={setPicked} />
            </BarChart>
          </div>
          <ul className="type-caption mt-2 flex shrink-0 flex-wrap gap-x-4 gap-y-1 text-muted">
            <li className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: 'var(--chart-line-primary)' }} />Money in</li>
            <li className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: 'var(--chart-3)' }} />Money out</li>
          </ul>
        </div>

        <aside className={cn('shrink-0 rounded-[var(--radius-lg)] bg-inset p-4', wide ? 'w-[260px] overflow-y-auto h-full' : 'w-full')} aria-label={current.long}>
          <p className="flex items-center justify-between gap-2 text-ink">
            <span className="type-body-strong">{current.long}</span>
            {current.isOpen && <span className="type-caption rounded-full bg-[var(--money-in-soft)] px-2 py-0.5 text-[var(--money-in)]">So far</span>}
          </p>
          <dl className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between"><dt className="type-caption flex items-center gap-1.5 text-muted"><span className="size-2 rounded-full" style={{ background: 'var(--money-in)' }} />In</dt><dd className="type-figure-row text-ink"><Amount value={current.inValue} currency={currency} /></dd></div>
            <div className="flex items-center justify-between"><dt className="type-caption flex items-center gap-1.5 text-muted"><span className="size-2 rounded-full" style={{ background: 'var(--money-out)' }} />Out</dt><dd className="type-figure-row text-ink"><Amount value={current.outValue} currency={currency} /></dd></div>
            <div className="flex items-center justify-between border-t border-line pt-1.5"><dt className="type-caption text-muted">Net</dt><dd className="type-figure-row"><Amount value={net} currency={currency} tone="flow" className={net >= 0 ? 'text-[var(--money-in)]' : undefined} /></dd></div>
          </dl>

          {detail && detail.categories.length > 0 && (
            <>
              <p className="type-label mt-4 text-muted">Where it went</p>
              <ul className="mt-1.5 space-y-2">
                {detail.categories.map(category => (
                  <li key={category.name}>
                    <button type="button" onClick={() => onCategoryClick?.(category.name)} className="w-full cursor-pointer text-left">
                      <span className="flex items-center justify-between gap-2">
                        <span className="type-body flex min-w-0 items-center gap-2 text-ink"><EntityGlyph icon={category.icon} label={category.name} color={category.color} size={14} /><span className="truncate">{category.name}</span></span>
                        <span className="type-figure-row shrink-0 text-ink"><Amount value={category.value} currency={currency} /></span>
                      </span>
                      <span className="mt-1 block h-1 rounded-full bg-line"><span className="block h-full rounded-full" style={{ width: `${Math.max(4, category.share * 100)}%`, background: category.color }} /></span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {detail?.topSource && (
            <p className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
              <span className="min-w-0"><span className="type-caption block text-muted">Top source</span><span className="type-body-strong block truncate text-ink">{detail.topSource.name}</span></span>
              <span className="type-figure-row shrink-0 text-ink"><Amount value={detail.topSource.value} currency={currency} /></span>
            </p>
          )}
        </aside>
      </div>
    </div>
  );
};

export default MoneyFlowWidget;
