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
import { Menu } from '../components/ui/Menu';
import { Amount } from '../components/ui/Money';
import { ConfirmDialog } from '../components/ui/Overlays';
import SegmentedControl from '../components/ui/SegmentedControl';
import { EmptyState } from '../components/ui/States';
import { useAccountsContext, usePreferencesContext, useTransactionsContext } from '../contexts/DomainProviders';
import { useBudgetsContext, useCategoryContext } from '../contexts/FinancialDataContext';
import { allocation, budgetLines, dailyAllowance, monthOf, monthPace, sortLines, unbudgeted, type LineSort } from '../utils/budgetModel';

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

// Helper to find a parent category by a transaction's category name
const findParentCategory = (categoryName: string, categories: Category[]): Category | undefined => {
  for (const parent of categories) {
    if (parent.name === categoryName) return parent;
    if (parent.subCategories.some(sub => sub.name === categoryName)) return parent;
  }
  return undefined;
};

const eurOnly = (amount: number) => amount;

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

  const handleMonthChange = (offset: number) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(1);
      newDate.setMonth(newDate.getMonth() + offset);
      return newDate;
    });
  };

  const handleApplyQuickBudget = (periodInMonths: number) => {
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), 0);
    const startDate = new Date(endDate);
    startDate.setMonth(startDate.getMonth() - (periodInMonths - 1));
    startDate.setDate(1);

    const liquidAccountIds = new Set(accounts.filter(acc => LIQUID_ACCOUNT_TYPES.includes(acc.type)).map(acc => acc.id));

    const relevantTransactions = transactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate >= startDate && txDate <= endDate && t.type === 'expense' && !t.transferId && liquidAccountIds.has(t.accountId);
    });

    const spending: Record<string, number> = {};
    for (const tx of relevantTransactions) {
      const parentCategory = findParentCategory(tx.category, expenseCategories);
      if (parentCategory) {
        spending[parentCategory.name] = (spending[parentCategory.name] || 0) + Math.abs(convertToMain(tx.amount, tx.currency));
      }
    }

    const averageSpending = Object.entries(spending)
      .map(([categoryName, total]) => ({ categoryName, averageMonthlySpending: Math.round(total / periodInMonths) }))
      .filter(item => item.averageMonthlySpending > 0);

    if (averageSpending.length === 0) {
      toast.info(`No spending found for the last ${periodInMonths === 1 ? 'month' : `${periodInMonths} months`}.`);
      return;
    }

    averageSpending.forEach(item => {
      const existingBudget = budgets.find(b => b.categoryName === item.categoryName);
      saveBudget({ id: existingBudget?.id, categoryName: item.categoryName, amount: item.averageMonthlySpending, period: 'monthly', currency: getMainCurrency() });
    });

    toast.success(`${averageSpending.length} ${averageSpending.length === 1 ? 'budget' : 'budgets'} created or updated from your spending.`);
  };

  const quickOptions = useMemo(() => {
    const preferred = preferences.defaultQuickCreatePeriod || 3;
    return [...QUICK_CREATE_BUDGET_OPTIONS].sort((a, b) => Number(b.value === preferred) - Number(a.value === preferred));
  }, [preferences.defaultQuickCreatePeriod]);

  const { totalBudgeted, totalSpent, spendingByCategory } = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

    const liquidAccountIds = new Set(accounts.filter(acc => LIQUID_ACCOUNT_TYPES.includes(acc.type)).map(acc => acc.id));

    const relevantTransactions = transactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate >= startDate && txDate <= endDate && !t.transferId && liquidAccountIds.has(t.accountId);
    });

    const spending: Record<string, number> = {};

    for (const tx of relevantTransactions) {
      if (tx.type === 'income') continue;
      const parentCategory = findParentCategory(tx.category, expenseCategories);
      if (parentCategory) {
        spending[parentCategory.name] = (spending[parentCategory.name] || 0) + Math.abs(convertToMain(tx.amount, tx.currency));
      } else {
        spending.Uncategorized = (spending.Uncategorized || 0) + Math.abs(convertToMain(tx.amount, tx.currency));
      }
    }

    return {
      totalBudgeted: budgets.reduce((sum, b) => sum + convertToMain(b.amount, b.currency), 0),
      totalSpent: Object.values(spending).reduce((sum, amount) => sum + amount, 0),
      spendingByCategory: spending,
    };
  }, [currentDate, transactions, budgets, expenseCategories, accounts]);

  const totalRemaining = totalBudgeted - totalSpent;
  const overallProgress = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const today = new Date();
  const pace = monthPace(monthOf(currentDate), today);
  const dailySafeSpend = dailyAllowance(totalRemaining, pace);

  const spendMap = useMemo(() => new Map(Object.entries(spendingByCategory)), [spendingByCategory]);
  const lines = useMemo(() => budgetLines(budgets, spendMap, eurOnly, pace), [budgets, spendMap, pace.when, pace.elapsedPct]);
  const counts = useMemo(() => lines.reduce((total, line) => ({ ...total, [line.status]: total[line.status] + 1 }), { over: 0, near: 0, ahead: 0, ok: 0 }), [lines]);
  const shares = useMemo(() => allocation(lines), [lines]);
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

      <div className="flex items-center gap-1">
        <IconButton icon="arrow-left-01" label="Previous month" onPress={() => handleMonthChange(-1)} />
        <h2 className="type-card-title min-w-36 text-center text-ink" aria-live="polite">{monthName}</h2>
        <IconButton icon="arrow-right-01" label="Next month" onPress={() => handleMonthChange(1)} />
        {pace.when !== 'current' && <Button variant="ghost" onPress={() => setCurrentDate(new Date())}>This month</Button>}
      </div>

      <section aria-label="Month summary" className="surface-card flex items-center gap-6 rounded-[var(--radius-xl)] p-6 max-sm:flex-col max-sm:items-start max-md:p-5">
        <ProgressRing value={overallProgress} tone={ringTone} label={`${Math.round(overallProgress)}%`} caption="used" />
        <div className="min-w-0">
          <p className="type-figure-lg text-ink"><Amount value={totalSpent} currency={getMainCurrency()} countUp /> <span className="type-body text-muted">of <Amount value={totalBudgeted} currency={getMainCurrency()} /> budgeted</span></p>
          <p className="type-body mt-1 text-muted">
            {pace.left > 0
              ? totalRemaining >= 0
                ? <><Amount value={totalRemaining} currency={getMainCurrency()} /> left for the next {pace.left} {pace.left === 1 ? 'day' : 'days'}, about <Amount value={dailySafeSpend} currency={getMainCurrency()} /> a day.</>
                : <><Amount value={Math.abs(totalRemaining)} currency={getMainCurrency()} /> over budget, with {pace.left} {pace.left === 1 ? 'day' : 'days'} to go.</>
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

        {shares.length > 0 && (
          <section aria-label="Where the budget goes" className="surface-card self-start rounded-[var(--radius-xl)] p-6 max-md:p-5">
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
      </div>

      {isModalOpen && (
        <BudgetModal
          onClose={closeForm}
          onSave={saveBudget}
          onDelete={editingBudget ? () => setDeletingBudget(editingBudget) : undefined}
          budgetToEdit={editingBudget}
          categoryNameToCreate={categoryNameToCreate}
          existingBudgets={budgets}
          expenseCategories={expenseCategories.filter(c => !c.parentId)}
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
