import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Budget, Category, Transaction, Account, AppPreferences } from '../types';
import { LIQUID_ACCOUNT_TYPES, QUICK_CREATE_BUDGET_OPTIONS } from '../constants';
import { formatCurrency, convertToMain, getMainCurrency } from '../utils';
import BudgetModal from '../components/BudgetModal';
import BudgetRow from '../components/BudgetRow';
import PageHeader, { type PageStat } from '../components/PageHeader';
import { Button, IconButton } from '../components/ui/Actions';
import { Badge, ProgressRing } from '../components/ui/Display';
import { Switch } from '../components/ui/Fields';
import { Menu } from '../components/ui/Menu';
import { Amount } from '../components/ui/Money';
import { ConfirmDialog } from '../components/ui/Overlays';
import SegmentedControl from '../components/ui/SegmentedControl';
import { EmptyState } from '../components/ui/States';
import { useAccountsContext, usePreferencesContext, useTransactionsContext } from '../contexts/DomainProviders';
import { useBudgetsContext, useCategoryContext } from '../contexts/FinancialDataContext';
import {
  allocation,
  autofillPlan,
  averageMonthlySpend,
  budgetAccountIds,
  budgetLines,
  budgetSuggestions,
  dailyAllowance,
  forecastMonthEnd,
  monthBounds,
  monthOf,
  monthPace,
  sortLines,
  spendByCategory,
  unbudgeted,
  type LineSort,
} from '../utils/budgetModel';

interface BudgetingProps {
  budgets?: Budget[];
  transactions?: Transaction[];
  expenseCategories?: Category[];
  saveBudget?: (budgetData: Omit<Budget, 'id'> & { id?: string }) => void;
  deleteBudget?: (id: string) => void;
  accounts?: Account[];
  preferences?: AppPreferences;
}

type Filter = 'all' | 'attention' | 'none';

const FILTERS = [{ id: 'all', label: 'All' }, { id: 'attention', label: 'Near or over' }, { id: 'none', label: 'No cap' }];
const SORTS = [{ id: 'used', label: '% used' }, { id: 'left', label: 'Left' }, { id: 'name', label: 'A–Z' }];

const Budgeting: React.FC<BudgetingProps> = ({
  budgets: propsBudgets,
  transactions: propsTransactions,
  expenseCategories: propsExpenseCategories,
  saveBudget: propsSaveBudget,
  deleteBudget: propsDeleteBudget,
  accounts: propsAccounts,
  preferences: propsPreferences,
}) => {
  const contextBudgets = useBudgetsContext();
  const contextCategories = useCategoryContext();
  const contextTransactions = useTransactionsContext();
  const contextAccounts = useAccountsContext();
  const contextPreferences = usePreferencesContext();

  const budgets = propsBudgets || contextBudgets.budgets;
  const transactions = propsTransactions || contextTransactions.transactions;
  const expenseCategories = propsExpenseCategories || contextCategories.expenseCategories;
  const saveBudget = propsSaveBudget || contextBudgets.saveBudget;
  const deleteBudget = propsDeleteBudget || contextBudgets.deleteBudget;
  const accounts = propsAccounts || contextAccounts.accounts;
  const preferences = propsPreferences || contextPreferences.preferences;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [categoryNameToCreate, setCategoryNameToCreate] = useState<string | undefined>();
  const [quickPeriod, setQuickPeriod] = useState<number | null>(null);
  const [deletingBudget, setDeletingBudget] = useState<Budget | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<LineSort>('used');
  const [rolloverEnabled, setRolloverEnabled] = useState(false);

  const handleMonthChange = (offset: number) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(1);
      newDate.setMonth(newDate.getMonth() + offset);
      return newDate;
    });
  };

  const accountIds = useMemo(() => budgetAccountIds(accounts), [accounts]);
  const currentMonth = useMemo(() => monthOf(currentDate), [currentDate]);

  const handleApplyQuickBudget = (periodInMonths: number) => {
    const todayMonth = monthOf(new Date());
    const avgMap = averageMonthlySpend(transactions, todayMonth, periodInMonths, {
      accountIds,
      categories: expenseCategories,
      convert: convertToMain,
    });
    const drafts = autofillPlan(avgMap, budgets, getMainCurrency(), {
      keepExisting: false,
      categories: expenseCategories,
    });

    if (drafts.length === 0) {
      toast.info(`No spending found for the last ${periodInMonths === 1 ? 'month' : `${periodInMonths} months`}.`);
      return;
    }

    drafts.forEach(draft => saveBudget(draft));
    toast.success(`${drafts.length} ${drafts.length === 1 ? 'budget' : 'budgets'} created or updated from your spending.`);
  };

  const quickOptions = useMemo(() => {
    const preferred = preferences.defaultQuickCreatePeriod || 3;
    return [...QUICK_CREATE_BUDGET_OPTIONS].sort((a, b) => Number(b.value === preferred) - Number(a.value === preferred));
  }, [preferences.defaultQuickCreatePeriod]);

  const spendMap = useMemo(
    () =>
      spendByCategory(transactions, monthBounds(currentMonth), {
        accountIds,
        categories: expenseCategories,
        convert: convertToMain,
      }),
    [transactions, currentMonth, accountIds, expenseCategories]
  );

  const prevMonthSpendMap = useMemo(() => {
    const prevDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    return spendByCategory(transactions, monthBounds(monthOf(prevDate)), {
      accountIds,
      categories: expenseCategories,
      convert: convertToMain,
    });
  }, [transactions, currentDate, accountIds, expenseCategories]);

  const historyByCategory = useMemo(() => {
    const result = new Map<string, { label: string; spent: number }[]>();
    const months = [-3, -2, -1].map(offset => {
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
      const label = d.toLocaleString('default', { month: 'short' });
      const map = spendByCategory(transactions, monthBounds(monthOf(d)), {
        accountIds,
        categories: expenseCategories,
        convert: convertToMain,
      });
      return { label, map };
    });
    for (const cat of expenseCategories.filter(c => !c.parentId)) {
      result.set(
        cat.name,
        months.map(m => ({ label: m.label, spent: m.map.get(cat.name) ?? 0 }))
      );
    }
    return result;
  }, [transactions, currentDate, accountIds, expenseCategories]);

  const effectiveBudgets = useMemo(() => {
    if (!rolloverEnabled) return budgets;
    return budgets.map(b => {
      const baseLimit = convertToMain(b.amount, b.currency || getMainCurrency());
      const prevSpent = prevMonthSpendMap.get(b.categoryName) ?? 0;
      const rolloverDelta = baseLimit - prevSpent;
      const rolledAmount = Math.max(0, baseLimit + rolloverDelta);
      return { ...b, amount: rolledAmount, currency: getMainCurrency() };
    });
  }, [budgets, rolloverEnabled, prevMonthSpendMap]);

  const { totalBudgeted, totalSpent } = useMemo(() => {
    let spent = 0;
    for (const amount of spendMap.values()) spent += amount;
    return {
      totalBudgeted: effectiveBudgets.reduce((sum, b) => sum + convertToMain(b.amount, b.currency || getMainCurrency()), 0),
      totalSpent: spent,
    };
  }, [spendMap, effectiveBudgets]);

  const totalRemaining = totalBudgeted - totalSpent;
  const overallProgress = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const today = new Date();
  const pace = monthPace(currentMonth, today);
  const dailySafeSpend = dailyAllowance(totalRemaining, pace);
  const projectedMonthEnd = useMemo(() => forecastMonthEnd(totalSpent, pace), [totalSpent, pace]);

  const lines = useMemo(
    () => budgetLines(effectiveBudgets, spendMap, (amount, currency) => convertToMain(amount, currency || getMainCurrency()), pace),
    [effectiveBudgets, spendMap, pace.when, pace.elapsedPct]
  );
  const counts = useMemo(() => lines.reduce((total, line) => ({ ...total, [line.status]: total[line.status] + 1 }), { over: 0, near: 0, ahead: 0, ok: 0 }), [lines]);
  const shares = useMemo(() => allocation(lines), [lines]);
  const suggestions = useMemo(() => {
    const avg3m = averageMonthlySpend(transactions, monthOf(today), 3, {
      accountIds,
      categories: expenseCategories,
      convert: convertToMain,
    });
    return budgetSuggestions(avg3m, budgets, (amount, currency) => convertToMain(amount, currency || getMainCurrency())).slice(0, 4);
  }, [transactions, accountIds, expenseCategories, budgets]);
  const categoryOf = (name: string) => expenseCategories.find(category => category.name === name);

  const shownLines = useMemo(() => {
    if (filter === 'none') return [];
    const sorted = sortLines(lines, sort);
    return filter === 'attention' ? sorted.filter(line => line.status === 'over' || line.status === 'near') : sorted;
  }, [lines, sort, filter]);

  const uncapped = useMemo(() => {
    if (filter === 'attention') return [];
    const withSpend = unbudgeted(spendMap, budgets);
    if (filter === 'all') return withSpend;
    const spentNames = new Set(withSpend.map(item => item.name));
    const quiet = expenseCategories
      .filter(category => !category.parentId && !spentNames.has(category.name) && !budgets.some(budget => budget.categoryName === category.name))
      .map(category => ({ name: category.name, spent: 0 }));
    return [...withSpend, ...quiet];
  }, [filter, spendMap, budgets, expenseCategories]);

  const openForm = (budget?: Budget, categoryName?: string) => {
    setEditingBudget(budget || null);
    setCategoryNameToCreate(budget ? undefined : categoryName);
    setIsModalOpen(true);
  };

  const closeForm = () => {
    setIsModalOpen(false);
    setEditingBudget(null);
    setCategoryNameToCreate(undefined);
  };

  const pageStats: PageStat[] = [
    { label: 'Budgeted this month', icon: 'pie-chart-01', value: totalBudgeted, format: 'money' },
    { label: 'Spent so far', icon: 'money-send-01', value: totalSpent, format: 'money' },
    { label: 'Left to spend', icon: 'piggy-bank', value: totalRemaining, format: 'money' },
  ];

  const ringTone = overallProgress > 100 ? 'loss' : overallProgress >= 85 ? 'amber' : 'pine';

  return (
    <div className="space-y-6 pb-8 max-md:space-y-4">
      <PageHeader
        title="Budget"
        stats={pageStats}
        actions={
          <>
            <Menu
              title="Quick budget"
              trigger={<Button variant="secondary" icon="flash">Quick budget</Button>}
              items={quickOptions.map(option => ({ id: String(option.value), label: option.label, onAction: () => setQuickPeriod(option.value) }))}
            />
            <Button icon="add-01" onPress={() => openForm()}>Set a budget</Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <IconButton icon="arrow-left-01" label="Previous month" onPress={() => handleMonthChange(-1)} />
          <h2 className="type-card-title min-w-36 text-center text-ink" aria-live="polite">{monthName}</h2>
          <IconButton icon="arrow-right-01" label="Next month" onPress={() => handleMonthChange(1)} />
          {pace.when !== 'current' && <Button variant="ghost" onPress={() => setCurrentDate(new Date())}>This month</Button>}
        </div>
        <Switch isSelected={rolloverEnabled} onChange={setRolloverEnabled}>Roll over last month</Switch>
      </div>

      <section aria-label="Month summary" className="surface-card flex items-center gap-6 rounded-[var(--radius-xl)] p-6 max-sm:flex-col max-sm:items-start max-md:p-5">
        <ProgressRing value={overallProgress} tone={ringTone} label={`${Math.round(overallProgress)}%`} caption="used" />
        <div className="min-w-0">
          <p className="type-figure-lg text-ink"><Amount value={totalSpent} currency={getMainCurrency()} countUp /> <span className="type-body text-muted">of <Amount value={totalBudgeted} currency={getMainCurrency()} /> budgeted</span></p>
          <p className="type-body mt-1 text-muted">
            {pace.left > 0
              ? totalRemaining >= 0
                ? <><Amount value={totalRemaining} currency={getMainCurrency()} /> left for the next {pace.left} {pace.left === 1 ? 'day' : 'days'}, about <Amount value={dailySafeSpend} currency={getMainCurrency()} /> a day.{projectedMonthEnd !== null && <> At this pace, month-end spending will reach <Amount value={projectedMonthEnd} currency={getMainCurrency()} />.</>}</>
                : <><Amount value={Math.abs(totalRemaining)} currency={getMainCurrency()} /> over budget, with {pace.left} {pace.left === 1 ? 'day' : 'days'} to go.{projectedMonthEnd !== null && <> At this pace, month-end spending will reach <Amount value={projectedMonthEnd} currency={getMainCurrency()} />.</>}</>
              : totalRemaining >= 0
                ? <>This month closed with <Amount value={totalRemaining} currency={getMainCurrency()} /> left.</>
                : <>This month closed <Amount value={Math.abs(totalRemaining)} currency={getMainCurrency()} /> over budget.</>}
          </p>
          {lines.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {counts.over > 0 && <Badge tone="negative">{counts.over} over</Badge>}
              {counts.near + counts.ahead > 0 && <Badge tone="attention">{counts.near + counts.ahead} to watch</Badge>}
              {counts.ok > 0 && <Badge tone="positive">{counts.ok} on track</Badge>}
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-6 max-md:gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-label="Categories" className="surface-card min-w-0 rounded-[var(--radius-xl)] p-6 max-md:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="type-card-title text-ink">Categories</h2>
              <p className="type-caption text-muted">The tick on each bar is where even spending would be today. Select a row to change its budget.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <SegmentedControl items={FILTERS} activeId={filter} onChange={id => setFilter(id as Filter)} />
              {filter !== 'none' && <SegmentedControl items={SORTS} activeId={sort} onChange={id => setSort(id as LineSort)} />}
            </div>
          </div>

          {shownLines.length + uncapped.length > 0 ? (
            <div className="mt-4 grid gap-x-6 gap-y-1 lg:grid-cols-2">
              {shownLines.map(line => {
                const category = categoryOf(line.name);
                return (
                  <BudgetRow
                    key={line.budget.id}
                    name={line.name}
                    icon={category?.icon}
                    color={category?.color}
                    spent={line.spent}
                    limit={line.limit}
                    pct={line.pct}
                    status={line.status}
                    pacePct={pace.when === 'current' ? pace.elapsedPct : undefined}
                    currency={getMainCurrency()}
                    onPress={() => openForm(line.budget)}
                  />
                );
              })}
              {uncapped.map(item => {
                const category = categoryOf(item.name);
                return <BudgetRow key={item.name} name={item.name} icon={category?.icon} color={category?.color} spent={item.spent} currency={getMainCurrency()} onPress={() => openForm(undefined, category ? item.name : undefined)} />;
              })}
            </div>
          ) : (
            <EmptyState
              icon="pie-chart-01"
              title={filter === 'attention' ? 'Nothing near its cap' : 'No budgets yet'}
              description={filter === 'attention' ? 'Every budget is within its limit.' : 'Set a budget, or build them all from your recent spending.'}
              actionLabel={filter === 'attention' ? undefined : 'Set a budget'}
              onAction={filter === 'attention' ? undefined : () => openForm()}
            />
          )}
        </section>

        {(shares.length > 0 || suggestions.length > 0) && (
          <div className="space-y-4 self-start">
            {shares.length > 0 && (
              <section aria-label="Where the budget goes" className="surface-card rounded-[var(--radius-xl)] p-6 max-md:p-5">
                <h2 className="type-card-title text-ink">Where the budget goes</h2>
                <ul className="mt-3 space-y-3">
                  {shares.map(share => (
                    <li key={share.name}>
                      <p className="type-body flex justify-between gap-3 text-ink">
                        <span className="truncate">{share.name}</span>
                        <span className="type-figure-row shrink-0">{formatCurrency(share.value, getMainCurrency())}</span>
                      </p>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-inset">
                        <div className="h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${share.pct}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {suggestions.length > 0 && (
              <section aria-label="Suggested adjustments" className="surface-card rounded-[var(--radius-xl)] p-6 max-md:p-5">
                <h2 className="type-card-title text-ink">Suggested from 3-month spend</h2>
                <ul className="mt-3 divide-y divide-line">
                  {suggestions.map(suggestion => {
                    const existing = budgets.find(b => b.categoryName === suggestion.categoryName);
                    const matchedCat = categoryOf(suggestion.categoryName);
                    return (
                      <li key={suggestion.categoryName} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="type-body-strong truncate text-ink">{suggestion.categoryName}</p>
                          <p className="type-caption text-muted">
                            Avg {formatCurrency(suggestion.average, getMainCurrency())}/mo · suggest {formatCurrency(suggestion.suggested, getMainCurrency())}
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onPress={() =>
                            saveBudget({
                              id: existing?.id,
                              categoryId: matchedCat?.id ?? existing?.categoryId,
                              categoryName: suggestion.categoryName,
                              amount: suggestion.suggested,
                              currency: getMainCurrency(),
                              period: 'monthly',
                            })
                          }
                        >
                          Apply
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>

      {isModalOpen && (
        <BudgetModal
          onClose={closeForm}
          onSave={saveBudget}
          onDelete={editingBudget ? () => setDeletingBudget(editingBudget) : undefined}
          budgetToEdit={editingBudget ? (budgets.find(b => b.id === editingBudget.id) ?? editingBudget) : null}
          categoryNameToCreate={categoryNameToCreate}
          existingBudgets={budgets}
          expenseCategories={expenseCategories.filter(c => !c.parentId)}
          historyByCategory={historyByCategory}
        />
      )}

      <ConfirmDialog
        isOpen={quickPeriod !== null}
        onClose={() => setQuickPeriod(null)}
        onConfirm={() => { if (quickPeriod !== null) handleApplyQuickBudget(quickPeriod); setQuickPeriod(null); }}
        title="Build budgets from your spending?"
        message={`This creates or updates a budget for each category you spent in, using ${quickOptions.find(option => option.value === quickPeriod)?.label.toLowerCase() ?? 'your history'}.`}
        confirmLabel="Build budgets"
      />

      <ConfirmDialog
        isOpen={!!deletingBudget}
        onClose={() => setDeletingBudget(null)}
        onConfirm={() => {
          if (deletingBudget) deleteBudget(deletingBudget.id);
          setDeletingBudget(null);
          closeForm();
        }}
        title={`Delete the ${deletingBudget?.categoryName ?? ''} budget?`}
        message="Your transactions stay as they are."
        confirmLabel="Delete budget"
        isDestructive
      />
    </div>
  );
};

export default Budgeting;
