import React, { useMemo, useState } from 'react';
import { formatShortDate } from '../../utils/dateFormat';
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
  forecastMonthEnd,
  sameMonth,
  shiftMonth,
  sortLines,
  summarize,
  unbudgeted,
  type BudgetLine,
  type LineSort,
  type Month,
} from '../../utils/budgetModel';
import { usePageAction, usePageSearch } from '../../components/new/shellContext';
import { TwoToneTitle } from '../../components/new/tile';
import {
  ActiveFilters,
  ChoiceChips,
  FilterButton,
  FilterSection,
  FilterSheet,
  PageToolbar,
  ToolButton,
  ToolbarSpacer,
  type ActiveFilter,
} from '../../components/new/PageToolbar';
import { Badge, Button, Card, EmptyState, Money, ProgressBar, SegmentedTabs } from '../../components/new/ui';
import { NvIcon } from '../../components/new/NvIcon';
import {
  AllocationRing,
  BudgetRow,
  CategoryDisc,
  DayDots,
  FigureCell,
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
 * - Month navigation and Auto-fill above the hero, with current-day pace tracking. The header keeps only search and
 *   New budget; the tabs sit at the top of the page and the one Filters button above the category list (§21, N20 to N24).
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
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Drawers state
  const [budgetSheetOpen, setBudgetSheetOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [initialCategoryName, setInitialCategoryName] = useState<string | undefined>();
  const [initialAmount, setInitialAmount] = useState<number | undefined>();
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
  const suggestions = useMemo(() => data.suggestionsFor(selectedMonth, data.suggestionMonths), [data, selectedMonth]);
  const slices = useMemo(() => allocation(lines), [lines]);

  // Derived metrics
  const dailySafe = useMemo(() => dailyAllowance(summary.remaining, pace), [summary.remaining, pace]);
  // Fixed bills count once; only the rest is extrapolated. Null in the first days of the month.
  const projected = useMemo(
    () => forecastMonthEnd(summary.spent, pace, data.recurringFor(selectedMonth, today)),
    [summary.spent, pace, data, selectedMonth, today]
  );

  // Goals total summary
  const totalGoalsSaved = useMemo(() => data.goals.reduce((s, g) => s + g.saved, 0), [data.goals]);
  const totalGoalsTarget = useMemo(() => data.goals.reduce((s, g) => s + g.target, 0), [data.goals]);
  const totalGoalsPct = totalGoalsTarget > 0 ? Math.round((totalGoalsSaved / totalGoalsTarget) * 100) : 0;

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
      setInitialAmount(undefined);
      setBudgetSheetOpen(true);
    },
  });

  const clearBudgetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
  };
  const activeFilters: ActiveFilter[] = [
    ...(searchQuery.trim() !== '' && tab === 'budgets'
      ? [{ key: 'search', label: `“${searchQuery.trim()}”`, icon: 'search' as const, onRemove: () => setSearchQuery('') }]
      : []),
    ...(statusFilter === 'over'
      ? [{ key: 'over', label: 'Over limit', icon: 'alert' as const, onRemove: () => setStatusFilter('all') }]
      : statusFilter === 'attention'
        ? [{ key: 'attention', label: 'Needs review', icon: 'warning' as const, onRemove: () => setStatusFilter('all') }]
        : []),
  ];

  const openEdit = (b: Budget) => {
    setEditingBudget(b);
    setInitialCategoryName(b.categoryName);
    setInitialAmount(undefined);
    setBudgetSheetOpen(true);
  };

  const openCreateFor = (categoryName: string) => {
    setEditingBudget(null);
    setInitialCategoryName(categoryName);
    setInitialAmount(undefined);
    setBudgetSheetOpen(true);
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      {/* ── Tabs, then (on the budgets tab) the month and Auto-fill; alerts only while there are some (N21, N23) ── */}
      <div className="space-y-3">
        <SegmentedTabs<BudgetTab>
          label="Budget views"
          value={tab}
          onChange={setTab}
          items={[
            { id: 'budgets', label: 'Monthly budget' },
            { id: 'goals', label: `Savings goals (${data.goals.length})` },
          ]}
        />

        {tab === 'budgets' && (
          <>
            <PageToolbar>
              <MonthNav
                label={monthLabel}
                onPrev={() => setSelectedMonth(m => shiftMonth(m, -1))}
                onNext={() => setSelectedMonth(m => shiftMonth(m, 1))}
                onToday={!isCurrent ? () => setSelectedMonth(currentMonth) : undefined}
              />
              <ToolbarSpacer />
              <ToolButton icon="refresh" label="Auto-fill" onClick={() => setAutofillOpen(true)} />
            </PageToolbar>

            {(suggestions.length > 0 || summary.outside > 0) && (
              <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
                {suggestions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSuggestionsOpen(true)}
                    className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-nv-line bg-nv-surface px-4 text-sm font-medium text-nv-ink transition-colors hover:bg-nv-inset"
                  >
                    <NvIcon name="sparkles" size={16} className="text-nv-violet-text" />
                    <span>{suggestions.length} recommendations</span>
                  </button>
                )}
                {summary.outside > 0 && (
                  <button
                    type="button"
                    onClick={() => setUnbudgetedOpen(true)}
                    className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-nv-line bg-nv-surface px-4 text-sm font-medium text-nv-ink hover:bg-nv-inset"
                  >
                    <NvIcon name="warning" size={16} className="text-nv-orange-text" />
                    <span>
                      Unbudgeted: <Money amount={summary.outside} currency={data.displayCurrency} />
                    </span>
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

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
                      first="Monthly budget"
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

                </div>

                {/* Right: pace bar and days */}
                <div className="w-full space-y-3 lg:w-[46%] lg:max-w-xl lg:shrink-0">
                  <PaceBar pct={summary.pct} elapsedPct={pace.elapsedPct} />
                  <DayDots pace={pace} />
                </div>
              </div>
            }
          >
            {/* Split lower band: 4 Key Health Figures */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <FigureCell
                icon="wallet"
                accent="green"
                label="Daily safe spend"
                note={pace.when === 'current' ? `${pace.left} days left` : undefined}
              >
                <Money amount={dailySafe} currency={data.displayCurrency} size="lg" />
              </FigureCell>

              <FigureCell
                icon="forecast"
                accent="sky"
                label="Month-end forecast"
                note={pace.when === 'current' ? (projected === null ? 'From day 5' : 'Based on current pace') : undefined}
              >
                {projected === null ? (
                  <span className="nv-tabular text-lg font-semibold text-nv-muted">—</span>
                ) : (
                  <Money amount={projected} currency={data.displayCurrency} size="lg" />
                )}
              </FigureCell>

              <FigureCell
                icon="checkCircle"
                accent={summary.counts.over > 0 ? 'orange' : 'violet'}
                label="Budget health"
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
                label="Outside budget"
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
              <Card>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-nv-ink">Category budgets</h2>
                    <span className="nv-tabular rounded-full bg-nv-inset px-2.5 py-0.5 text-xs font-semibold text-nv-muted">
                      {filteredLines.length}
                    </span>
                  </div>
                  <FilterButton count={statusFilter !== 'all' ? 1 : 0} onClick={() => setFiltersOpen(true)} />
                </div>
                <ActiveFilters filters={activeFilters} onClearAll={clearBudgetFilters} className="mb-3" />

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
                              setInitialAmount(undefined);
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
                          onClick={clearBudgetFilters}
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
                          className="flex items-center justify-between rounded-nv-sub bg-nv-surface p-3"
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
                            className="inline-flex h-11 items-center gap-1 rounded-full border border-nv-line px-2.5 text-[12px] font-medium text-nv-ink hover:bg-nv-inset"
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
              <Card>
                <h2 className="mb-4 text-base font-semibold text-nv-ink">Budget allocation</h2>
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

                  <div className="mt-3 divide-y divide-nv-line rounded-nv-sub bg-nv-surface">
                    {suggestions.slice(0, 2).map(s => (
                      <div key={s.categoryName} className="p-3 text-[13px]">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-nv-ink">{s.categoryName}</span>
                          <span className="text-nv-violet-text font-semibold">
                            → <Money amount={s.suggested} currency={data.displayCurrency} />
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-nv-muted">
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
                  Auto-generate budgets
                </h3>
                <div className="mt-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => setAutofillOpen(true)}
                  >
                    Open auto-fill
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
                      first="Savings goals"
                      second="· Progress overview"
                      as="h1"
                      className="text-lg font-semibold"
                    />
                  </div>

                  <div>
                    <p className="text-[13px] text-nv-muted">Total saved towards goals</p>
                    <div className="mt-1 flex flex-wrap items-baseline gap-2">
                      <Money
                        amount={totalGoalsSaved}
                        currency={data.displayCurrency}
                        size="hero"
                      />
                      <span className="text-lg font-medium text-nv-muted">
                        of{' '}
                        <Money
                          amount={totalGoalsTarget}
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

                {/* Total Goals Combined Gauge Chart */}
                {data.goals.length > 0 && (
                  <div className="flex shrink-0 items-center justify-center">
                    <RingGauge
                      pct={totalGoalsPct}
                      label="saved"
                      size={170}
                      activeFill={totalGoalsPct >= 100 ? 'var(--nv-green)' : 'var(--nv-violet)'}
                    />
                  </div>
                )}
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <FigureCell
                icon="wallet"
                accent="green"
                label="Active goals"
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
                label="Monthly contributions"
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
                  <Card>
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
                    <Card key={g.id} className="flex flex-col justify-between">
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
                                    "relative inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors after:absolute after:-inset-x-1 after:-inset-y-3 after:content-['']",
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
                              <p className="mt-0.5 text-[12px] text-nv-muted">Target: {formatShortDate(g.due)}</p>
                            )}
                          </div>

                          {g.done ? (
                            <Badge tone="green" icon="check" className="shrink-0">Completed</Badge>
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
                        <div className="mt-3.5 space-y-2 rounded-nv-sub bg-nv-surface p-3">
                          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-nv-muted">
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
                                        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-nv-green-text">
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
                                    <span className="shrink-0 text-xs text-nv-muted">
                                      <Money amount={sg.saved} currency={data.displayCurrency} /> /{' '}
                                      <Money amount={sg.target} currency={data.displayCurrency} />
                                    </span>
                                  </div>

                                  {sg.due && (
                                    <p className="mt-1 text-xs text-nv-muted">
                                      Target: {formatShortDate(sg.due)}
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
        initialAmount={initialAmount}
      />

      <FilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        resultLabel={`Show ${filteredLines.length} ${filteredLines.length === 1 ? 'budget' : 'budgets'}`}
        onReset={() => {
          clearBudgetFilters();
          setSort('used');
        }}
      >
        <FilterSection title="Sort by">
          <ChoiceChips
            label="Sort by"
            options={LINE_SORTS.map(o => ({ id: o.value, label: o.label }))}
            selected={[sort]}
            onChange={([id]) => setSort(id as LineSort)}
          />
        </FilterSection>
        <FilterSection title="Status" count={statusFilter !== 'all' ? 1 : 0}>
          <ChoiceChips
            label="Status"
            options={[
              { id: 'all', label: 'All budgets' },
              { id: 'over', label: `Over limit${summary.counts.over ? ` · ${summary.counts.over}` : ''}`, icon: 'alert' },
              { id: 'attention', label: `Needs review${summary.counts.near + summary.counts.ahead ? ` · ${summary.counts.near + summary.counts.ahead}` : ''}`, icon: 'warning' },
            ]}
            selected={[statusFilter]}
            onChange={([id]) => setStatusFilter(id as 'all' | 'attention' | 'over')}
          />
        </FilterSection>
      </FilterSheet>

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
          setInitialAmount(amount);
          setBudgetSheetOpen(true);
        }}
      />
    </div>
  );
};
