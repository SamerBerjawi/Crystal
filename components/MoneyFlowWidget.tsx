import React, { useMemo, useState } from 'react';
import type { Account, Category, Currency, Transaction } from '../types';
import { convertToMain, parseLocalDate, toLocalISOString } from '../utils';
import { budgetAccountIds, spendByCategory } from '../utils/budgetModel';
import { Amount } from './ui/Money';
import SegmentedControl from './ui/SegmentedControl';
import { EntityGlyph } from './EntityIcon';
import { EmptyState } from './ui/States';
import { useWidgetBox } from './ui/WidgetGrid';
import { curveNatural } from '@visx/curve';
import { line as d3Line } from 'd3-shape';
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

const HEIGHT = 190;

/**
 * Money in and out, period by period: bars rise for what came in and fall for what went out, a line follows the total
 * balance, and picking a column shows where that period's money went and who it came from.
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

  if (data.every(row => row.inValue === 0 && row.outValue === 0)) {
    return <EmptyState icon="chart-column" title="No money moved" description="Nothing came in or went out in these accounts." className="h-full py-6" />;
  }

  const wide = box.width === 0 || box.width >= 700;
  const chartH = box.height > 0 ? Math.max(130, Math.min(260, box.height - (wide ? 92 : 300))) : HEIGHT;
  const peak = Math.max(...data.map(row => Math.max(row.inValue, row.outValue)), 1);
  const half = chartH / 2;
  const balances = data.map(row => row.balance);
  const lo = Math.min(...balances);
  const hi = Math.max(...balances);
  const yOf = (value: number) => 6 + (hi === lo ? (chartH - 12) / 2 : (1 - (value - lo) / (hi - lo)) * (chartH - 12));
  const colW = 100 / data.length;
  const line = d3Line<{ x: number; y: number }>().x(point => point.x).y(point => point.y).curve(curveNatural)(data.map((row, i) => ({ x: (i + 0.5) * colW, y: yOf(row.balance) }))) ?? '';
  const net = current.inValue - current.outValue;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="type-caption text-muted">Pick a column to see where it went</p>
        <SegmentedControl items={UNITS} activeId={unit} onChange={id => { setUnit(id as Unit); setPicked(null); }} />
      </div>

      <div className={cn('flex min-h-0 flex-1 gap-5', wide ? 'flex-row' : 'flex-col')}>
        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height: chartH }}>
            <div className="absolute inset-x-0 top-1/2 border-t border-line" aria-hidden />
            <div className="absolute inset-0 flex" role="group" aria-label="Money in and out by period">
              {data.map((row, i) => (
                <button
                  key={row.start.getTime()}
                  type="button"
                  onClick={() => setPicked(i)}
                  aria-pressed={i === index}
                  aria-label={`${row.long}: in ${Math.round(row.inValue)}, out ${Math.round(row.outValue)}`}
                  className={cn('relative h-full min-w-0 flex-1 cursor-pointer rounded-md transition-colors hover:bg-inset focus-visible:outline-2 focus-visible:outline-[var(--focus)]', i === index && 'bg-inset')}
                >
                  <span className="absolute left-1/2 w-[46%] max-w-6 -translate-x-1/2 rounded-t-[5px]" style={{ bottom: half, height: Math.max(row.inValue > 0 ? 2 : 0, (row.inValue / peak) * (half - 6)), background: 'var(--money-in)', opacity: i === index ? 1 : 0.55 }} />
                  <span className="absolute left-1/2 w-[46%] max-w-6 -translate-x-1/2 rounded-b-[5px]" style={{ top: half, height: Math.max(row.outValue > 0 ? 2 : 0, (row.outValue / peak) * (half - 6)), background: 'var(--money-out)', opacity: i === index ? 1 : 0.55 }} />
                </button>
              ))}
            </div>
            <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" viewBox={`0 0 100 ${chartH}`} preserveAspectRatio="none" aria-hidden>
              <path d={line} fill="none" stroke="var(--ink)" strokeOpacity=".55" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            </svg>
            <span aria-hidden className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-solid bg-ink" style={{ left: `${(index + 0.5) * colW}%`, top: yOf(current.balance), borderColor: 'var(--solid)' }} />
          </div>
          <div className="mt-1 flex" aria-hidden>
            {data.map((row, i) => <span key={row.start.getTime()} className={cn('type-caption min-w-0 flex-1 truncate text-center', i === index ? 'font-semibold text-ink' : 'text-muted')}>{box.width > 0 && box.width < 520 && unit === 'weeks' ? '' : row.short}</span>)}
          </div>
          <ul className="type-caption mt-2 flex flex-wrap gap-x-4 gap-y-1 text-muted">
            <li className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: 'var(--money-in)' }} />Money in</li>
            <li className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: 'var(--money-out)' }} />Money out</li>
            <li className="flex items-center gap-1.5"><span className="h-0.5 w-3.5 rounded-full bg-ink/55" />Total balance</li>
          </ul>
        </div>

        <aside className={cn('shrink-0 rounded-[var(--radius-lg)] bg-inset p-4', wide ? 'w-[260px] overflow-y-auto' : 'w-full')} aria-label={current.long}>
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
