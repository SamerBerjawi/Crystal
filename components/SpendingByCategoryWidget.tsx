import React, { useMemo } from 'react';
import { Account, Budget, Category, CategorySpending, Duration, Transaction } from '../types';
import { convertToMain, getDateRange, getMainCurrency, parseLocalDate, toLocalISOString } from '../utils';
import { addDays } from '../utils/scheduleModel';
import { budgetAccountIds, spendByCategory } from '../utils/budgetModel';
import { monthsInPeriod } from '../utils/reportsModel';
import { PieChart, PieCenter, PieSlice, type PieData } from '../src/components/charts';
import { EntityGlyph } from './EntityIcon';
import { Amount } from './ui/Money';
import { EmptyState } from './ui/States';
import { fitRows, useWidgetBox } from './ui/WidgetGrid';

interface SpendingByCategoryWidgetProps {
  data: CategorySpending[];
  budgets: Budget[];
  transactions: Transaction[];
  expenseCategories: Category[];
  accounts: Account[];
  duration: Duration;
  onCategoryClick: (categoryName: string) => void;
  onBudgetClick: () => void;
}

interface Row {
  name: string;
  color: string;
  icon?: string;
  spent: number;
  /** The budget for the period, when the category has one. */
  limit?: number;
  /** What this category usually comes to over the same stretch, from the months before. */
  usual?: number;
}

/** A tick on a bar track, at a share of its scale. */
const Tick: React.FC<{ at: number; label: string }> = ({ at, label }) => (
  <span aria-hidden title={label} className="absolute -top-0.5 -bottom-0.5 w-0.5 rounded-full bg-ink/70" style={{ left: `${Math.min(Math.max(at, 0), 1) * 100}%` }} />
);

const USUAL_MONTHS = 6;
const MIN_HISTORY_DAYS = 45;

const OTHER_COLOR = 'var(--line-strong)';
const SLICE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

/**
 * Where the money went, by category, with the budget for each category beside it. A donut shows the shares; each row shows
 * either its share of spending or, when it has a budget, how much of that budget is used. Rows open the category.
 */
const SpendingByCategoryWidget: React.FC<SpendingByCategoryWidgetProps> = ({ data, budgets, transactions, expenseCategories, accounts, duration, onCategoryClick, onBudgetClick }) => {
  const currency = getMainCurrency();
  const box = useWidgetBox();

  // For the month so far, a budget is the whole month's and a tick shows where an even pace would be today.
  const pace = useMemo(() => {
    if (duration !== 'MTD') return undefined;
    const today = new Date();
    return today.getDate() / new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  }, [duration]);

  const budgetByName = useMemo(() => {
    if (budgets.length === 0) return new Map<string, { spent: number; limit: number }>();
    const { start, end } = getDateRange(duration, transactions);
    const from = toLocalISOString(start);
    const to = toLocalISOString(end);
    const spent = spendByCategory(transactions, { from, to }, { accountIds: budgetAccountIds(accounts), categories: expenseCategories, convert: convertToMain });
    const months = duration === 'MTD' ? 1 : Math.max(1, monthsInPeriod(from, to));
    return new Map(budgets.map(budget => [budget.categoryName, { spent: spent.get(budget.categoryName) || 0, limit: convertToMain(budget.amount, budget.currency) * months }]));
  }, [budgets, transactions, expenseCategories, accounts, duration]);

  // What each category usually comes to over a stretch this long, from up to six months before this period. Needs a month and a half of history.
  const usualByName = useMemo(() => {
    const none = new Map<string, number>();
    if (transactions.length === 0) return none;
    const { start, end } = getDateRange(duration, transactions);
    const earliest = transactions.reduce((min, tx) => (tx.date < min ? tx.date : min), transactions[0].date.slice(0, 10)).slice(0, 10);
    const windowStart = new Date(start.getFullYear(), start.getMonth() - USUAL_MONTHS, start.getDate());
    const from = toLocalISOString(windowStart) > earliest ? toLocalISOString(windowStart) : earliest;
    const to = toLocalISOString(addDays(start, -1));
    const windowDays = Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 86400000) + 1;
    if (windowDays < MIN_HISTORY_DAYS) return none;
    const periodDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    const history = spendByCategory(transactions, { from, to }, { accountIds: budgetAccountIds(accounts), categories: expenseCategories, convert: convertToMain });
    history.forEach((total, name) => none.set(name, (total / windowDays) * periodDays));
    return none;
  }, [transactions, expenseCategories, accounts, duration]);

  const rows = useMemo<Row[]>(() => {
    const named = new Set(data.map(item => item.name));
    const fromSpending: Row[] = data.map(item => {
      const budget = budgetByName.get(item.name);
      return { name: item.name, color: item.color || 'var(--chart-1)', icon: item.icon, spent: budget ? budget.spent : item.value, limit: budget?.limit, usual: budget ? undefined : usualByName.get(item.name) };
    });
    // A budget with nothing spent yet still belongs here, so every budget is on show.
    const unspent: Row[] = Array.from(budgetByName.entries())
      .filter(([name]) => !named.has(name))
      .map(([name, budget]) => ({ name, color: 'var(--chart-1)', spent: budget.spent, limit: budget.limit }));
    return [...fromSpending, ...unspent];
  }, [data, budgetByName, usualByName]);

  const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);

  const slices = useMemo<PieData[]>(() => {
    const top = data.slice(0, 5).map((item, index) => ({ label: item.name, value: item.value, color: SLICE_COLORS[index] }));
    const rest = data.slice(5).reduce((sum, item) => sum + item.value, 0);
    return rest > 0 ? [...top, { label: 'Other', value: rest, color: OTHER_COLOR }] : top;
  }, [data]);

  if (rows.length === 0) {
    return <EmptyState icon="pie-chart-01" title="No spending" description="Nothing went out in this period." className="h-full py-6" />;
  }

  // The donut needs 220px of height and a list needs 300px beside it. Otherwise the list has the whole widget.
  const showDonut = box.height === 0 || (box.height >= 220 && box.width >= 520 && data.length > 0);
  const donutSize = box.height > 0 ? Math.max(120, Math.min(box.height - 8, Math.round(box.width * 0.36), 300)) : 220;
  const rowHeight = 58;
  const fit = fitRows(box, rowHeight, 8);
  const count = box.height === 0 || fit >= rows.length - 1 ? rows.length : Math.max(1, fit - 1);
  const hidden = rows.length - count;
  const max = Math.max(...rows.map(row => Math.max(row.spent, row.usual ?? 0)), 1);

  const statusOf = (ratio: number) => {
    if (ratio >= 1) return { color: 'var(--money-out)', text: 'Over budget' };
    // Ahead of an even pace for the month, even if still well inside the limit.
    if (pace !== undefined && ratio > pace + 0.1) return { color: 'var(--amber)', text: 'Ahead of pace' };
    if (ratio >= 0.8) return { color: 'var(--amber)', text: 'Close to the limit' };
    return { color: undefined, text: pace !== undefined ? 'On pace' : 'On track' };
  };
  const usualText = (spent: number, usual: number) => {
    const gap = spent - usual;
    if (Math.abs(gap) < Math.max(usual * 0.1, 5)) return 'About your usual';
    return <><Amount value={Math.abs(gap)} currency={currency} className="text-ink" /> {gap > 0 ? 'over' : 'under'} your usual</>;
  };

  return (
    <div className="flex h-full gap-5">
      {showDonut && slices.length > 0 && (
        <div className="flex shrink-0 items-center justify-center" style={{ width: donutSize }}>
          <PieChart data={slices} size={donutSize} innerRadius={Math.round(donutSize * 0.3)} cornerRadius={6} padAngle={slices.length > 1 ? 0.04 : 0}>
            {slices.map((_, index) => <PieSlice key={index} index={index} />)}
            <PieCenter defaultLabel="Spent">
              {({ value, label }) => (
                <div className="flex flex-col items-center text-center">
                  <span className="type-caption text-muted">{label}</span>
                  <span className="type-figure-row text-ink"><Amount value={value} currency={currency} /></span>
                </div>
              )}
            </PieCenter>
          </PieChart>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <ul className="no-scrollbar -mx-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {rows.slice(0, count).map(row => {
            const hasBudget = row.limit !== undefined && row.limit > 0;
            const ratio = hasBudget ? row.spent / row.limit! : 0;
            const status = hasBudget ? statusOf(ratio) : null;
            const share = total > 0 ? (row.spent / total) * 100 : 0;
            const fill = status?.color ?? row.color;
            const width = hasBudget ? Math.min(ratio, 1) * 100 : (row.spent / max) * 100;
            return (
              <li key={row.name}>
                <button
                  type="button"
                  onClick={() => onCategoryClick(row.name)}
                  className="w-full rounded-[var(--radius-md)] px-2 py-1.5 text-left transition-colors hover:bg-inset focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
                  aria-label={`${row.name}, show its transactions`}
                >
                  <span className="type-body mb-1 flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-ink">
                      <EntityGlyph icon={row.icon} label={row.name} color={row.color} size={16} />
                      <span className="truncate">{row.name}</span>
                    </span>
                    <span className="type-figure-row shrink-0 text-ink">
                      <Amount value={row.spent} currency={currency} />
                      {hasBudget
                        ? <span className="type-caption ml-1.5 text-muted">of <Amount value={row.limit!} currency={currency} /></span>
                        : <span className="type-caption ml-2 inline-block w-10 text-right text-muted">{share.toFixed(1)}%</span>}
                    </span>
                  </span>
                  <span className="relative block h-1.5 rounded-full bg-inset" role={hasBudget ? 'progressbar' : undefined} aria-label={hasBudget ? `${row.name} budget used` : undefined} aria-valuemin={0} aria-valuemax={100} aria-valuenow={hasBudget ? Math.round(Math.min(ratio, 1) * 100) : undefined}>
                    <span className="block h-full overflow-hidden rounded-full"><span className="block h-full rounded-full" style={{ width: `${Math.max(width, 2)}%`, backgroundColor: fill }} /></span>
                    {hasBudget && pace !== undefined && <Tick at={pace} label="Where an even pace would be today" />}
                    {!hasBudget && row.usual !== undefined && row.usual > 0 && <Tick at={row.usual / max} label="Your usual for this stretch" />}
                  </span>
                  {status && (status.text !== 'On track' && status.text !== 'On pace' || pace !== undefined) && (
                    <span className="type-caption mt-0.5 block text-muted">{status.text}{pace !== undefined && status.text === 'On pace' ? ' · tick is an even pace' : ''}</span>
                  )}
                  {!hasBudget && row.usual !== undefined && row.usual > 0 && (
                    <span className="type-caption mt-0.5 block text-muted">{usualText(row.spent, row.usual)}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-1 flex shrink-0 items-center justify-between gap-3">
          {hidden > 0 ? <p className="type-caption text-muted">+{hidden} more</p> : <span />}
          <button type="button" onClick={onBudgetClick} className="type-caption rounded-full px-1 text-muted underline underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-[var(--focus)]">
            {budgets.length > 0 ? 'Edit budgets' : 'Set budgets'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpendingByCategoryWidget;
