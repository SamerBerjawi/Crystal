import React, { useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import type { Account, AppPreferences, Budget, Category, Transaction } from '../../types';
import { useBudgetData } from '../../hooks/useBudgetData';
import {
  allocation,
  budgetLines,
  dailyAllowance,
  LINE_SORTS,
  monthOf,
  monthPace,
  projectedSpend,
  sameMonth,
  shiftMonth,
  sortLines,
  summarize,
  unbudgeted,
  type BudgetLine,
  type LineSort,
  type Month,
} from '../../utils/budgetModel';
import {
  HeaderControls,
  HeaderTools,
  usePageAction,
  usePageSearch,
  usePageTabs,
} from '../../components/new/shellContext';
import { FilterChip, PeriodPill, TwoToneTitle } from '../../components/new/tile';
import { Button, Card, EmptyState, IconButton, Money, MoreButton, ProgressBar } from '../../components/new/ui';
import { NvIcon } from '../../components/new/NvIcon';
import {
  AllocationRing,
  BudgetRow,
  CategoryDisc,
  DayDots,
  FigureCell,
  GoalRings,
  MonthNav,
  PaceBar,
  RingGauge,
  StatusBadge,
  GOAL_ACCENTS,
} from '../../components/new/budget/parts';
import {
  AutofillSheet,
  BudgetSheet,
  SuggestionsSheet,
  UnbudgetedSheet,
} from '../../components/new/budget/sheets';

/*
 * BudgetNew (UI_UX_DESIGN_REFERENCE.md §5.1, §11 Reference 3):
 * - Built completely from scratch following the New design system.
 * - Month navigation in header controls with current-day pace tracking.
 * - Split hero tile: dark ring gauge (R8) & dot-matrix days (R8) with daily safe spend & pace projections.
 * - Category budget cards with pace bars, attention badges and inline drill-in.
 * - Dynamic allocation donut breakdown.
 * - Intelligent recommendations drawer & unbudgeted spending review.
 * - Auto-fill drawer with historical average preview.
 * - Savings Goals tab with concentric activity rings and bucket progress.
 */

export interface BudgetNewProps {
  budgets?: Budget[];
  transactions?: Transaction[];
  expenseCategories?: Category[];
  saveBudget?: (budgetData: Omit<Budget, 'id'> & { id?: string }) => void;
  deleteBudget?: (id: string) => void;
  accounts?: Account[];
  preferences?: AppPreferences;
}

type BudgetTab = 'budgets' | 'goals';

const formatMonthLabel = (m: Month) => {
  const d = new Date(m.year, m.month, 1);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

export const BudgetNew: React.FC<BudgetNewProps> = () => {
  const data = useBudgetData();
  const today = useMemo(() => new Date(), []);
  const currentMonth = useMemo(() => monthOf(today), [today]);

  const [tab, setTab] = useState<BudgetTab>('budgets');
  const [selectedMonth, setSelectedMonth] = useState<Month>(currentMonth);
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<LineSort>('used');
  const [statusFilter, setStatusFilter] = useState<'all' | 'attention' | 'over'>('all');

  // Drawers state
  const [budgetSheetOpen, setBudgetSheetOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [initialCategoryName, setInitialCategoryName] = useState<string | undefined>();
  const [autofillOpen, setAutofillOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [unbudgetedOpen, setUnbudgetedOpen] = useState(false);

  // Goals expansion state
  const [expandedGoalIds, setExpandedGoalIds] = useState<Set<string>>(() => new Set());
  const toggleExpandGoal = (id: string) => {
    setExpandedGoalIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const displayedGoals = useMemo(() => {
    if (!searchQuery.trim() || tab !== 'goals') return data.goals;
    const q = searchQuery.toLowerCase();
    return data.goals.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.subGoals?.some(sg => sg.name.toLowerCase().includes(q))
    );
  }, [data.goals, searchQuery, tab]);

  const goalsWithSub = useMemo(
    () => data.goals.filter(g => (g.subGoals && g.subGoals.length > 0) || g.parts > 0),
    [data.goals]
  );
  const allSubGoalsExpanded =
    goalsWithSub.length > 0 && goalsWithSub.every(g => expandedGoalIds.has(g.id));
  const toggleAllSubGoals = () => {
    if (allSubGoalsExpanded) {
      setExpandedGoalIds(new Set());
    } else {
      setExpandedGoalIds(new Set(goalsWithSub.map(g => g.id)));
    }
  };

  // Month navigation
  const isCurrent = sameMonth(selectedMonth, currentMonth);
  const pace = useMemo(() => monthPace(selectedMonth, today), [selectedMonth, today]);
  const monthLabel = useMemo(() => formatMonthLabel(selectedMonth), [selectedMonth]);

  // Spending & Budgets calculation
  const spend = useMemo(() => data.spendFor(selectedMonth), [data, selectedMonth]);
  const lines = useMemo(
    () => budgetLines(data.budgets, spend, data.convert, pace),
    [data.budgets, spend, data.convert, pace]
  );
  const summary = useMemo(() => summarize(lines, spend), [lines, spend]);
  const unbudgetedList = useMemo(() => unbudgeted(spend, data.budgets), [spend, data.budgets]);
  const suggestions = useMemo(() => data.suggestionsFor(selectedMonth, 3), [data, selectedMonth]);
  const slices = useMemo(() => allocation(lines), [lines]);

  // Derived metrics
  const dailySafe = useMemo(() => dailyAllowance(summary.remaining, pace), [summary.remaining, pace]);
  const projected = useMemo(() => projectedSpend(summary.spent, pace), [summary.spent, pace]);

  // Filtered & sorted lines
  const filteredLines = useMemo(() => {
    let result = lines;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l => l.name.toLowerCase().includes(q));
    }
    if (statusFilter === 'over') {
      result = result.filter(l => l.status === 'over');
    } else if (statusFilter === 'attention') {
      result = result.filter(l => l.status !== 'ok');
    }
    return sortLines(result, sort);
  }, [lines, searchQuery, statusFilter, sort]);

  // Header integration
  usePageTabs<BudgetTab>({
    label: 'Budget views',
    value: tab,
    onChange: setTab,
    items: [
      { id: 'budgets', label: 'Monthly Budget' },
      { id: 'goals', label: `Savings Goals (${data.goals.length})` },
    ],
  });

  usePageSearch({
    value: searchQuery,
    onChange: setSearchQuery,
    placeholder: tab === 'budgets' ? 'Search budget categories' : 'Search goals',
  });

  usePageAction({
    label: 'New budget',
    icon: 'add',
    onClick: () => {
      setEditingBudget(null);
      setInitialCategoryName(undefined);
      setBudgetSheetOpen(true);
    },
  });

  const openEdit = (b: Budget) => {
    setEditingBudget(b);
    setInitialCategoryName(b.categoryName);
    setBudgetSheetOpen(true);
  };

  const openCreateFor = (categoryName: string) => {
    setEditingBudget(null);
    setInitialCategoryName(categoryName);
    setBudgetSheetOpen(true);
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      {/* ── Top Header Controls & Tools ─────────────────────────────────── */}
      <HeaderTools>
        <Button
          variant="secondary"
          size="sm"
          icon="refresh"
          onClick={() => setAutofillOpen(true)}
          aria-label="Auto-fill budgets"
        >
          Auto-fill
        </Button>
      </HeaderTools>

      <HeaderControls>
        <div className="flex flex-wrap items-center gap-2">
          <MonthNav
            label={monthLabel}
            onPrev={() => setSelectedMonth(m => shiftMonth(m, -1))}
            onNext={() => setSelectedMonth(m => shiftMonth(m, 1))}
            onToday={!isCurrent ? () => setSelectedMonth(currentMonth) : undefined}
          />

          {tab === 'budgets' && (
            <>
              <PeriodPill<LineSort>
                label="Sort"
                value={sort}
                onChange={setSort}
                options={LINE_SORTS}
              />

              <FilterChip
                label="All budgets"
                active={statusFilter === 'all'}
                onClick={() => setStatusFilter('all')}
              />

              {summary.counts.over > 0 && (
                <FilterChip
                  label={`${summary.counts.over} over limit`}
                  icon="alert"
                  active={statusFilter === 'over'}
                  onClick={() => setStatusFilter(f => (f === 'over' ? 'all' : 'over'))}
                />
              )}

              {summary.counts.near > 0 && (
                <FilterChip
                  label={`${summary.counts.near + summary.counts.ahead} needs review`}
                  icon="warning"
                  active={statusFilter === 'attention'}
                  onClick={() => setStatusFilter(f => (f === 'attention' ? 'all' : 'attention'))}
                />
              )}

              {suggestions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSuggestionsOpen(true)}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-nv-violet/40 bg-nv-violet-soft px-4 text-sm font-medium text-nv-violet-text transition-colors hover:bg-nv-violet/10"
                >
                  <NvIcon name="sparkles" size={16} />
                  <span>{suggestions.length} recommendations</span>
                </button>
              )}

              {summary.outside > 0 && (
                <button
                  type="button"
                  onClick={() => setUnbudgetedOpen(true)}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-nv-line bg-nv-surface px-4 text-sm font-medium text-nv-ink hover:bg-nv-inset"
                >
                  <NvIcon name="warning" size={16} className="text-nv-orange-text" />
                  <span>
                    Unbudgeted: <Money amount={summary.outside} currency={data.displayCurrency} />
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      </HeaderControls>

      {/* ── Budgets View Tab ────────────────────────────────────────────── */}
      {tab === 'budgets' && (
        <>
          {/* Split Hero Card (§11 R2, R8) */}
          <Card
            tone="tile"
            top={
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-nv-violet-soft text-nv-violet-text">
                      <NvIcon name="budget" size={16} />
                    </span>
                    <TwoToneTitle
                      first="Monthly Budget"
                      second={`· ${monthLabel}`}
                      as="h1"
                      className="text-lg font-semibold"
                    />
                  </div>

                  <div>
                    <p className="text-[13px] text-nv-muted">Total spending this month</p>
                    <div className="mt-1 flex flex-wrap items-baseline gap-2">
                      <Money amount={summary.spent} currency={data.displayCurrency} size="hero" />
                      <span className="text-lg font-medium text-nv-muted">
                        of{' '}
                        <Money
                          amount={summary.budgeted}
                          currency={data.displayCurrency}
                          className="font-semibold text-nv-ink"
                        />{' '}
                        limit
                      </span>
                    </div>

                    <p className="mt-2 text-[14px] text-nv-muted">
                      {summary.remaining >= 0 ? (
                        <>
                          <span className="font-semibold text-nv-ink">
                            <Money amount={summary.remaining} currency={data.displayCurrency} />
                          </span>{' '}
                          remaining · {Math.round(summary.pct)}% used
                          {pace.when === 'current' && (
                            <span> · {pace.left} day{pace.left === 1 ? '' : 's'} left</span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="font-semibold text-nv-red-text">
                            <Money amount={Math.abs(summary.remaining)} currency={data.displayCurrency} />
                          </span>{' '}
                          over budget limit ({Math.round(summary.pct)}%)
                        </>
                      )}
                    </p>
                  </div>

                  {/* Pace bar and days */}
                  <div className="max-w-xl space-y-2 pt-1">
                    <PaceBar pct={summary.pct} elapsedPct={pace.elapsedPct} />
                    <DayDots pace={pace} className="pt-1" />
                  </div>
                </div>

                {/* Right Hero Gauge */}
                <div className="flex shrink-0 items-center justify-center pt-2 lg:pt-0">
                  <RingGauge
                    pct={summary.pct}
                    elapsedPct={pace.elapsedPct}
                    label="spent"
                    size={176}
                  />
                </div>
              </div>
            }
          >
            {/* Split lower band: 4 Key Health Figures */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <FigureCell
                icon="wallet"
                accent="green"
                label="Daily Safe Spend"
                note={pace.when === 'current' ? `${pace.left} days left` : undefined}
              >
                <Money amount={dailySafe} currency={data.displayCurrency} size="lg" />
              </FigureCell>

              <FigureCell
                icon="forecast"
                accent="sky"
                label="Month-End Forecast"
                note={pace.when === 'current' ? 'Based on current pace' : undefined}
              >
                <Money amount={projected} currency={data.displayCurrency} size="lg" />
              </FigureCell>

              <FigureCell
                icon="checkCircle"
                accent={summary.counts.over > 0 ? 'orange' : 'violet'}
                label="Budget Health"
                note={
                  summary.counts.over > 0
                    ? `${summary.counts.over} over limit`
                    : 'All within limit'
                }
              >
                <span className="nv-tabular text-xl font-semibold text-nv-ink">
                  {summary.counts.ok} / {lines.length}
                </span>
              </FigureCell>

              <FigureCell
                icon="money"
                accent="orange"
                label="Outside Budget"
                note={
                  unbudgetedList.length > 0
                    ? `${unbudgetedList.length} unbudgeted categories`
                    : 'None'
                }
              >
                <Money amount={summary.outside} currency={data.displayCurrency} size="lg" />
              </FigureCell>
            </div>
          </Card>

          {/* ── Main Bento Grid ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Left Column: Budget List (8 cols) */}
            <div className="space-y-4 lg:col-span-8">
              <Card tone="surface">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-nv-ink">Category Budgets</h2>
                    <span className="nv-tabular rounded-full bg-nv-inset px-2.5 py-0.5 text-xs font-semibold text-nv-muted">
                      {filteredLines.length}
                    </span>
                  </div>

                  <Button
                    variant="cta"
                    size="sm"
                    icon="add"
                    onClick={() => {
                      setEditingBudget(null);
                      setInitialCategoryName(undefined);
                      setBudgetSheetOpen(true);
                    }}
                  >
                    Add budget
                  </Button>
                </div>

                {filteredLines.length === 0 ? (
                  lines.length === 0 ? (
                    <EmptyState
                      icon="budget"
                      title="No budgets created yet"
                      body="Set category limits to track your monthly spending pace and save more."
                      action={
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <Button
                            variant="primary"
                            icon="add"
                            onClick={() => {
                              setEditingBudget(null);
                              setInitialCategoryName(undefined);
                              setBudgetSheetOpen(true);
                            }}
                          >
                            Create first budget
                          </Button>
                          <Button
                            variant="secondary"
                            icon="refresh"
                            onClick={() => setAutofillOpen(true)}
                          >
                            Auto-fill from history
                          </Button>
                        </div>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon="search"
                      title="No matching budgets"
                      body="Try clearing your search query or status filter."
                      action={
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setSearchQuery('');
                            setStatusFilter('all');
                          }}
                        >
                          Clear filters
                        </Button>
                      }
                    />
                  )
                ) : (
                  <ul className="divide-y divide-nv-line">
                    {filteredLines.map(line => {
                      const look = data.lookOf(line.name);
                      return (
                        <BudgetRow
                          key={line.budget.id}
                          line={line}
                          currency={data.displayCurrency}
                          color={look?.color}
                          icon={look?.icon}
                          elapsedPct={pace.elapsedPct}
                          onOpen={() => openEdit(line.budget)}
                        />
                      );
                    })}
                  </ul>
                )}
              </Card>

              {/* Unbudgeted categories list inside main flow if any */}
              {unbudgetedList.length > 0 && (
                <Card tone="tile">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-[15px] font-semibold text-nv-ink">
                        Spending without a budget
                      </h3>
                      <p className="text-[12px] text-nv-muted">
                        Expenses recorded this month in categories without a limit
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setUnbudgetedOpen(true)}
                    >
                      View all ({unbudgetedList.length})
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {unbudgetedList.slice(0, 4).map(item => {
                      const look = data.lookOf(item.name);
                      return (
                        <div
                          key={item.name}
                          className="flex items-center justify-between rounded-nv-tile border border-nv-line bg-nv-surface p-3"
                        >
                          <div className="flex items-center gap-2.5">
                            <CategoryDisc
                              name={item.name}
                              color={look?.color}
                              icon={look?.icon}
                              size={34}
                            />
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-medium text-nv-ink">
                                {item.name}
                              </p>
                              <p className="text-[12px] text-nv-muted">
                                <Money amount={item.spent} currency={data.displayCurrency} />
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => openCreateFor(item.name)}
                            className="inline-flex h-8 items-center gap-1 rounded-full border border-nv-line px-2.5 text-[12px] font-medium text-nv-ink hover:bg-nv-inset"
                          >
                            <NvIcon name="add" size={14} />
                            <span>Budget</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </div>

            {/* Right Column: Allocation & Insights Rail (4 cols) */}
            <div className="space-y-4 lg:col-span-4">
              {/* Allocation Donut */}
              <Card tone="surface">
                <h2 className="mb-4 text-base font-semibold text-nv-ink">Budget Allocation</h2>
                {slices.length === 0 ? (
                  <p className="py-6 text-center text-sm text-nv-muted">
                    No active budget limits to display.
                  </p>
                ) : (
                  <div className="flex flex-col items-center">
                    <AllocationRing
                      slices={slices}
                      total={summary.budgeted}
                      currency={data.displayCurrency}
                      colorOf={name => data.lookOf(name)?.color ?? 'var(--nv-violet)'}
                    />

                    <div className="mt-5 w-full space-y-2 border-t border-nv-line pt-4">
                      {slices.map(slice => {
                        const look = data.lookOf(slice.name);
                        return (
                          <div
                            key={slice.name}
                            className="flex items-center justify-between text-[13px]"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{
                                  background: look?.color ?? 'var(--nv-violet)',
                                }}
                                aria-hidden
                              />
                              <span className="text-nv-ink font-medium">{slice.name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-nv-muted">
                              <span>
                                <Money amount={slice.value} currency={data.displayCurrency} />
                              </span>
                              <span className="nv-tabular w-8 text-right font-semibold text-nv-ink">
                                {Math.round(slice.pct)}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>

              {/* Recommendations Callout */}
              {suggestions.length > 0 && (
                <Card tone="tile">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nv-violet-soft text-nv-violet-text">
                        <NvIcon name="sparkles" size={18} />
                      </span>
                      <div>
                        <h3 className="text-[14px] font-semibold text-nv-ink">
                          {suggestions.length} Budget Adjustments
                        </h3>
                        <p className="text-[12px] text-nv-muted">
                          Trends diverge from your limits
                        </p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSuggestionsOpen(true)}
                    >
                      Review
                    </Button>
                  </div>

                  <div className="mt-3 divide-y divide-nv-line rounded-nv-tile border border-nv-line bg-nv-surface">
                    {suggestions.slice(0, 2).map(s => (
                      <div key={s.categoryName} className="p-3 text-[13px]">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-nv-ink">{s.categoryName}</span>
                          <span className="text-nv-violet-text font-semibold">
                            → <Money amount={s.suggested} currency={data.displayCurrency} />
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-nv-muted">
                          Avg: <Money amount={s.average} currency={data.displayCurrency} />
                          {s.current !== undefined && (
                            <span> (currently <Money amount={s.current} currency={data.displayCurrency} />)</span>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Quick Auto-Fill Prompt Card */}
              <Card tone="tile" className="text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-nv-surface text-nv-ink">
                  <NvIcon name="refresh" size={20} />
                </div>
                <h3 className="mt-2.5 text-[15px] font-semibold text-nv-ink">
                  Auto-generate Budgets
                </h3>
                <p className="mt-1 text-[12px] text-nv-muted">
                  Use your actual 1 to 12 month spending history to quickly set smart targets.
                </p>
                <div className="mt-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => setAutofillOpen(true)}
                  >
                    Open Auto-fill
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* ── Goals View Tab ──────────────────────────────────────────────── */}
      {tab === 'goals' && (
        <div className="space-y-5">
          {/* Goals Hero Card */}
          <Card
            tone="tile"
            top={
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-nv-green-soft text-nv-green-text">
                      <NvIcon name="award" size={16} />
                    </span>
                    <TwoToneTitle
                      first="Savings Goals"
                      second="· Progress overview"
                      as="h1"
                      className="text-lg font-semibold"
                    />
                  </div>

                  <div>
                    <p className="text-[13px] text-nv-muted">Total saved towards goals</p>
                    <div className="mt-1 flex flex-wrap items-baseline gap-2">
                      <Money
                        amount={data.goals.reduce((s, g) => s + g.saved, 0)}
                        currency={data.displayCurrency}
                        size="hero"
                      />
                      <span className="text-lg font-medium text-nv-muted">
                        of{' '}
                        <Money
                          amount={data.goals.reduce((s, g) => s + g.target, 0)}
                          currency={data.displayCurrency}
                          className="font-semibold text-nv-ink"
                        />{' '}
                        target
                      </span>
                    </div>

                    <p className="mt-2 text-[14px] text-nv-muted">
                      {data.goals.filter(g => g.done).length} of {data.goals.length} goals achieved
                    </p>
                  </div>
                </div>

                {/* Concentric Activity Rings */}
                {data.goals.length > 0 && (
                  <div className="flex shrink-0 items-center justify-center">
                    <GoalRings goals={data.goals} size={150} withLegend />
                  </div>
                )}
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <FigureCell
                icon="wallet"
                accent="green"
                label="Active Goals"
                note={`${data.goals.filter(g => g.recurring).length} recurring`}
              >
                <span className="nv-tabular text-xl font-semibold text-nv-ink">
                  {data.goals.filter(g => !g.done).length}
                </span>
              </FigureCell>

              <FigureCell
                icon="checkCircle"
                accent="violet"
                label="Completed"
                note="Goals reached"
              >
                <span className="nv-tabular text-xl font-semibold text-nv-ink">
                  {data.goals.filter(g => g.done).length}
                </span>
              </FigureCell>

              <FigureCell
                icon="calendar"
                accent="sky"
                label="Monthly Contributions"
                note="Planned per month"
              >
                <Money
                  amount={data.goals.reduce((s, g) => s + (g.monthly ?? 0), 0)}
                  currency={data.displayCurrency}
                  size="lg"
                />
              </FigureCell>
            </div>
          </Card>

          {/* Goals Grid List */}
          <div className="space-y-3">
            {goalsWithSub.length > 0 && (
              <div className="flex items-center justify-between px-1 text-[13px]">
                <span className="font-medium text-nv-muted">
                  {displayedGoals.length} {displayedGoals.length === 1 ? 'Goal' : 'Goals'}
                </span>
                <button
                  type="button"
                  onClick={toggleAllSubGoals}
                  className="inline-flex items-center gap-1.5 font-medium text-nv-violet-text hover:underline text-[12px]"
                >
                  <NvIcon
                    name="arrowDown"
                    size={13}
                    className={cn('transition-transform duration-200', allSubGoalsExpanded && 'rotate-180')}
                  />
                  <span>{allSubGoalsExpanded ? 'Collapse all sub-goals' : 'Expand all sub-goals'}</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
              {displayedGoals.length === 0 ? (
                <div className="col-span-full">
                  <Card tone="surface">
                    <EmptyState
                      icon="award"
                      title={searchQuery ? 'No goals match your search' : 'No savings goals set'}
                      body={
                        searchQuery
                          ? 'Try clearing your search query.'
                          : 'Define target amounts and dates to stay motivated and track your wealth journey.'
                      }
                    />
                  </Card>
                </div>
              ) : (
                displayedGoals.map((g, index) => {
                  const accent = GOAL_ACCENTS[index % GOAL_ACCENTS.length];
                  const hasSub = (g.subGoals && g.subGoals.length > 0) || g.parts > 0;
                  const isExpanded = expandedGoalIds.has(g.id);
                  return (
                    <Card key={g.id} tone="surface" className="flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-base font-semibold text-nv-ink">{g.name}</h3>
                              {hasSub && (
                                <button
                                  type="button"
                                  onClick={() => toggleExpandGoal(g.id)}
                                  aria-expanded={isExpanded}
                                  aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${g.name} sub-goals`}
                                  className={cn(
                                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
                                    isExpanded
                                      ? 'border-nv-ink bg-nv-ink text-nv-on-ink'
                                      : 'border-nv-line bg-nv-inset text-nv-ink hover:bg-nv-tile'
                                  )}
                                >
                                  <span>{g.parts} sub-goals</span>
                                  <NvIcon
                                    name="arrowDown"
                                    size={12}
                                    className={cn(
                                      'transition-transform duration-200',
                                      isExpanded ? 'rotate-180 text-nv-on-ink' : 'text-nv-muted'
                                    )}
                                  />
                                </button>
                              )}
                            </div>
                            {g.due && (
                              <p className="mt-0.5 text-[12px] text-nv-muted">Target: {g.due}</p>
                            )}
                          </div>

                          {g.done ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-nv-green/40 bg-nv-green-soft px-2.5 py-0.5 text-xs font-semibold text-nv-green-text">
                              <NvIcon name="check" size={14} /> Completed
                            </span>
                          ) : (
                            <span className="nv-tabular shrink-0 text-sm font-semibold text-nv-ink">
                              {Math.round(g.pct)}%
                            </span>
                          )}
                        </div>

                        <div className="mt-4">
                          <ProgressBar
                            value={g.pct}
                            tone={accent === 'sky' ? 'violet' : accent}
                            label={`${g.name} progress`}
                            showValue={false}
                            className="h-2.5"
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex items-baseline justify-between border-t border-nv-line pt-3 text-[13px]">
                        <div>
                          <span className="text-nv-muted">Saved: </span>
                          <Money
                            amount={g.saved}
                            currency={data.displayCurrency}
                            className="font-semibold text-nv-ink"
                          />
                        </div>
                        <div>
                          <span className="text-nv-muted">Target: </span>
                          <Money amount={g.target} currency={data.displayCurrency} />
                        </div>
                      </div>

                      {/* Expandable sub-goals tray */}
                      {hasSub && isExpanded && (
                        <div className="mt-3.5 space-y-2 rounded-nv-tile border border-nv-line bg-nv-tile/60 p-3">
                          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-nv-muted">
                            <span>Sub-goal</span>
                            <span>Progress</span>
                          </div>
                          {g.subGoals && g.subGoals.length > 0 ? (
                            <div className="divide-y divide-nv-line/60">
                              {g.subGoals.map(sg => (
                                <div key={sg.id} className="py-2.5 first:pt-1 last:pb-0">
                                  <div className="flex items-baseline justify-between gap-2">
                                    <span className="truncate text-[13px] font-medium text-nv-ink">
                                      {sg.name}
                                    </span>
                                    <div className="flex shrink-0 items-center gap-1.5">
                                      {sg.done ? (
                                        <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-nv-green-text">
                                          <NvIcon name="check" size={12} /> Reached
                                        </span>
                                      ) : (
                                        <span className="nv-tabular text-[12px] font-semibold text-nv-ink">
                                          {Math.round(sg.pct)}%
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="mt-1.5 flex items-center gap-2">
                                    <div className="flex-1">
                                      <ProgressBar
                                        value={sg.pct}
                                        tone={sg.done ? 'green' : (accent === 'sky' ? 'violet' : accent)}
                                        label={`${sg.name} progress`}
                                        showValue={false}
                                        className="h-1.5"
                                      />
                                    </div>
                                    <span className="shrink-0 text-[11px] text-nv-muted">
                                      <Money amount={sg.saved} currency={data.displayCurrency} /> /{' '}
                                      <Money amount={sg.target} currency={data.displayCurrency} />
                                    </span>
                                  </div>

                                  {sg.due && (
                                    <p className="mt-1 text-[11px] text-nv-muted">
                                      Target: {sg.due}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="py-2 text-center text-[12px] text-nv-muted">
                              No sub-goals found in this bucket.
                            </p>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Drawers / Sheets ────────────────────────────────────────────── */}
      <BudgetSheet
        open={budgetSheetOpen}
        onOpenChange={setBudgetSheetOpen}
        data={data}
        month={selectedMonth}
        editingBudget={editingBudget}
        initialCategoryName={initialCategoryName}
      />

      <AutofillSheet
        open={autofillOpen}
        onOpenChange={setAutofillOpen}
        data={data}
        month={selectedMonth}
      />

      <SuggestionsSheet
        open={suggestionsOpen}
        onOpenChange={setSuggestionsOpen}
        suggestions={suggestions}
        data={data}
      />

      <UnbudgetedSheet
        open={unbudgetedOpen}
        onOpenChange={setUnbudgetedOpen}
        unbudgetedList={unbudgetedList}
        data={data}
        onAddBudget={(cat, amount) => {
          setEditingBudget(null);
          setInitialCategoryName(cat);
          setBudgetSheetOpen(true);
        }}
      />
    </div>
  );
};
