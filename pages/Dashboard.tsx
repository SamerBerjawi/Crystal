import React, { useMemo, useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { Page, User, Transaction, Account, Category, CategorySpending, Widget, WidgetConfig, DisplayTransaction, FinancialGoal, RecurringTransaction, BillPayment, RecurringTransactionOverride, LoanPaymentOverrides, AccountType, Task, ForecastDuration, Currency } from '../types';
import PageHeader from '../components/PageHeader';
import { liveSeries } from '../utils/scheduleModel';
import { formatCurrency, convertCurrency, convertToMain, generateSyntheticLoanPayments, generateSyntheticCreditCardPayments, parseLocalDate, generateSyntheticPropertyTransactions, toLocalISOString, calculateAccountTotals, safeRound, getMainCurrency } from '../utils';
import AddTransactionModal from '../components/AddTransactionModal';
import { DURATION_OPTIONS } from '../constants';
import TransactionDetailModal from '../components/TransactionDetailModal';
import { type HorizonNext30 } from '../components/CashHorizonWidget';
import AddWidgetModal from '../components/AddWidgetModal';
import PendingMatchesModal from '../components/PendingMatchesModal';
import { useReview } from '../contexts/ReviewContext';
import { useAccountsContext, usePreferencesContext, useTransactionsContext, usePreferencesSelector, useWarrantsContext } from '../contexts/DomainProviders';
import { useBudgetsContext, useCategoryContext, useGoalsContext, useScheduleContext, useTagsContext } from '../contexts/FinancialDataContext';
import { useInsightsView } from '../contexts/InsightsViewContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { EmptyState, Skeleton } from '../components/ui/States';
import PullToRefresh from '../components/PullToRefresh';
import { Button, IconButton } from '../components/ui/Actions';
import { Amount, PrivacyContext, useFirstVisit } from '../components/ui/Money';
import { BottomSheet } from '../components/ui/Overlays';
import WidgetGrid, { WidgetBody, type WidgetGridItem, type WidgetLayoutItem } from '../components/ui/WidgetGrid';
import { useBillNotifications } from '../hooks/useBillNotifications';
import { computeSafeToSpend } from '../utils/safeToSpend';
import { buildSummaryFacts, isUncategorised } from '../utils/overviewSummary';
import { OVERVIEW_TABS, OVERVIEW_WIDGETS, isOverviewTab, overviewTabKey, resolveTabLayout, toConfig } from '../utils/overviewLayout';
import { setUrlTab, useUrlTab } from '../hooks/useUrlTab';
import { generateInsights, visibleInsights } from '../utils/insightsModel';
import WidgetErrorBoundary from '../components/WidgetErrorBoundary';
import {
  EnrichedTransaction,
  buildAssetAllocationData,
  buildInitialPostedModalData,
  buildRecentDashboardTransactions,
  computeAdvancedNextDueDate,
  computeCreditCardStatements,
  computeDashboardForecast,
  computeDashboardSparklines,
  computeDayTrends,
  computeGlobalAssetAndLiabilityGroups,
  computeKeyRatioGauges,
  computeLiquidityAndSavingsRate,
  computeMonthDeltas,
  computeMonthFlow,
  computeNetWorthSeries,
  computeOutflowsByCategory,
  computePeriodAggregate,
  computePeriodChanges,
  computePeriodFlowBuckets,
  filterTransactionsForCategory,
  mapHistoricalDurationToForecast,
} from '../utils/dashboardModel';
import { DashboardFilterToolbar, DashboardSummarySection, buildDashboardWidgets } from '../components/dashboard/DashboardWidgets';

interface DashboardProps {
  user: User;
  incomeCategories: Category[];
  expenseCategories: Category[];
  financialGoals: FinancialGoal[];
  recurringTransactions: RecurringTransaction[];
  recurringTransactionOverrides: RecurringTransactionOverride[];
  loanPaymentOverrides: LoanPaymentOverrides;
  tasks: Task[];
  saveTask: (task: Omit<Task, 'id'> & { id?: string }) => void;
  setCurrentPage: (page: Page, tab?: string | null) => void;
  onOpenAccount: (id: string) => void;
  onSyncBanks?: () => void | Promise<void>;
  isSyncingBanks?: boolean;
}

const EMPTY_IDS: string[] = [];

const Dashboard: React.FC<DashboardProps> = ({ user, tasks, saveTask, onSyncBanks, setCurrentPage, onOpenAccount }) => {
  const { activeGoalIds, dashboardAccountIds: selectedAccountIds, setDashboardAccountIds: setSelectedAccountIds, dashboardDuration: duration, setDashboardDuration: setDuration } = useInsightsView();
  const { accounts } = useAccountsContext();
  const { warrants } = useWarrantsContext();
  const { transactions, saveTransaction, deleteTransactions, digest: transactionsDigest } = useTransactionsContext();
  const { incomeCategories, expenseCategories } = useCategoryContext();
  const { financialGoals } = useGoalsContext();
  const { recurringTransactions: everySeries, recurringTransactionOverrides, loanPaymentOverrides, billsAndPayments, saveRecurringTransaction, saveBillPayment } = useScheduleContext();
  const { tags } = useTagsContext();
  const { budgets } = useBudgetsContext();
  const { preferences, setPreferences } = usePreferencesContext();
  const preferredCurrency = usePreferencesSelector(p => (p.currency || 'EUR') as Currency);
  const conversionRates = usePreferencesSelector(p => p.conversionRates);
  const showBalanceAdjustments = usePreferencesSelector(p => p.showBalanceAdjustments ?? true);

  const [showForecast, setShowForecast] = useState(true);
  const [showGoals, setShowGoals] = useState(true);
  const [forecastDuration, setForecastDuration] = useState<ForecastDuration>(preferences.defaultForecastPeriod || '1Y');
  const isPrivate = React.useContext(PrivacyContext);
  const isFirstVisit = useFirstVisit('overview');
  const isMobile = useIsMobile();

  useEffect(() => {
    setForecastDuration(mapHistoricalDurationToForecast(duration));
  }, [duration]);

  const transactionsKey = transactionsDigest || `txs:${transactions.length}`;
  const aggregateCacheRef = useRef<Map<string, { filteredTransactions: Transaction[]; income: number; expenses: number }>>(new Map());
  const aggregateCacheMax = 25;
  const [isTransactionModalOpen, setTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [itemToPost, setItemToPost] = useState<{ item: RecurringTransaction | BillPayment } | null>(null);

  const [isDetailModalOpen, setDetailModalOpen] = useState(false);
  const [modalTransactions, setModalTransactions] = useState<Transaction[]>([]);
  const [modalTitle, setModalTitle] = useState('');

  const [isAddWidgetModalOpen, setIsAddWidgetModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isPhoneEditOpen, setPhoneEditOpen] = useState(false);
  const [isMatchesModalOpen, setMatchesModalOpen] = useState(false);
  const [matchesModalFilter, setMatchesModalFilter] = useState<'all' | 'transfer' | 'bill'>('all');

  const review = useReview();
  const allCategories = useMemo(() => [...incomeCategories, ...expenseCategories], [incomeCategories, expenseCategories]);
  const selectedAccounts = useMemo(() => accounts.filter(a => selectedAccountIds.includes(a.id)), [accounts, selectedAccountIds]);
  const accountLookup = useMemo(() => new Map(accounts.map(acc => [acc.id, acc])), [accounts]);
  const analyticsAccounts = useMemo(() => accounts.filter(acc => acc.includeInAnalytics ?? true), [accounts]);
  const analyticsSelectedAccounts = useMemo(() => selectedAccounts.filter(acc => acc.includeInAnalytics ?? true), [selectedAccounts]);
  const analyticsSelectedAccountIds = useMemo(() => analyticsSelectedAccounts.map(acc => acc.id), [analyticsSelectedAccounts]);
  const analyticsTransactions = useMemo(() => transactions.filter(tx => {
    if (tx.isSplitParent || tx.isCombinedParent) return false;
    if (!showBalanceAdjustments && tx.isBalanceAdjustment) return false;
    const account = accountLookup.get(tx.accountId);
    return account ? (account.includeInAnalytics ?? true) : true;
  }), [transactions, accountLookup, showBalanceAdjustments]);

  const transferLookup = useMemo(() => {
    const lookup = new Map<string, Transaction[]>();
    transactions.forEach(tx => {
      if (!tx.transferId) return;
      const group = lookup.get(tx.transferId) || [];
      group.push(tx);
      lookup.set(tx.transferId, group);
    });
    return lookup;
  }, [transactions]);

  const cacheAggregateResult = useCallback((cacheKey: string, value: { filteredTransactions: Transaction[]; income: number; expenses: number }) => {
    const cache = aggregateCacheRef.current;
    if (!cache.has(cacheKey) && cache.size >= aggregateCacheMax) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }
    cache.set(cacheKey, value);
  }, [aggregateCacheMax]);

  const recurringTransactions = useMemo(() => liveSeries(everySeries), [everySeries]);
  const monthFlow = useMemo(() => computeMonthFlow(analyticsTransactions), [analyticsTransactions]);
  const monthDeltas = useMemo(() => computeMonthDeltas(analyticsTransactions, monthFlow), [analyticsTransactions, monthFlow]);
  const dayTrends = useMemo(() => computeDayTrends(analyticsTransactions), [analyticsTransactions]);

  const { allRecurringItems } = useMemo(() => ({
    allRecurringItems: [
      ...recurringTransactions,
      ...generateSyntheticLoanPayments(analyticsAccounts, analyticsTransactions, loanPaymentOverrides),
      ...generateSyntheticCreditCardPayments(analyticsAccounts, analyticsTransactions),
      ...generateSyntheticPropertyTransactions(analyticsAccounts),
    ],
  }), [analyticsAccounts, analyticsTransactions, loanPaymentOverrides, recurringTransactions]);

  const { forecastChartData, lowestBalanceForecasts, next30Raw } = useMemo(
    () => computeDashboardForecast({ accounts, selectedAccounts, transactions, loanPaymentOverrides, recurringTransactions, financialGoals, activeGoalIds, billsAndPayments, warrants, recurringTransactionOverrides, forecastDuration }),
    [accounts, selectedAccounts, transactions, loanPaymentOverrides, recurringTransactions, financialGoals, activeGoalIds, billsAndPayments, warrants, recurringTransactionOverrides, forecastDuration]
  );

  const handleOpenTransactionModal = useCallback((tx?: Transaction) => {
    setEditingTransaction(tx || null);
    setItemToPost(null);
    setTransactionModalOpen(true);
  }, []);

  const handleCloseTransactionModal = useCallback(() => {
    setEditingTransaction(null);
    setItemToPost(null);
    setTransactionModalOpen(false);
  }, []);

  const handleProcessItem = useCallback((item: RecurringTransaction | BillPayment) => {
    setItemToPost({ item });
    setTransactionModalOpen(true);
  }, []);

  const handleSavePostedTransaction = useCallback((transactionsToSave: (Omit<Transaction, 'id'> & { id?: string })[], idsToDelete: string[]) => {
    const isRecurring = itemToPost && 'frequency' in itemToPost.item;
    const rt = isRecurring ? (itemToPost.item as RecurringTransaction) : null;
    saveTransaction(rt && !rt.isSynthetic ? transactionsToSave.map(tx => ({ ...tx, recurringSourceId: rt.id })) : transactionsToSave, idsToDelete);

    if (itemToPost) {
      const original = itemToPost.item;
      if ('frequency' in original) {
        const recurringItem = original as RecurringTransaction;
        if (!recurringItem.isSynthetic) {
          saveRecurringTransaction({ ...recurringItem, nextDueDate: computeAdvancedNextDueDate(recurringItem, transactionsToSave[0].date) });
        }
      } else {
        const bill = original as BillPayment;
        const postedTransaction = transactionsToSave[0];
        saveBillPayment({ ...bill, status: 'paid', accountId: postedTransaction.accountId, dueDate: postedTransaction.date });
      }
    }
    handleCloseTransactionModal();
  }, [itemToPost, saveTransaction, saveRecurringTransaction, saveBillPayment, handleCloseTransactionModal]);

  const initialModalData = useMemo(() => buildInitialPostedModalData(itemToPost?.item), [itemToPost]);

  const handleTransactionClick = useCallback((clickedTx: DisplayTransaction) => {
    if (clickedTx.isTransfer && clickedTx.transferId) {
      setModalTransactions(transferLookup.get(clickedTx.transferId) || []);
      setModalTitle('Transfer Details');
    } else {
      const originalTx = transactions.find(t => t.id === clickedTx.id);
      if (originalTx) {
        setModalTransactions([originalTx]);
        setModalTitle('Transaction Details');
      }
    }
    setDetailModalOpen(true);
  }, [transactions, transferLookup]);

  const handleEditTransaction = useCallback((tx: Transaction) => {
    setDetailModalOpen(false);
    handleOpenTransactionModal(tx);
  }, [handleOpenTransactionModal]);

  const handleDeleteTransactions = useCallback((ids: string[]) => {
    setDetailModalOpen(false);
    deleteTransactions(ids);
  }, [deleteTransactions]);

  const { filteredTransactions, income, expenses } = useMemo(() => {
    const ratesKey = JSON.stringify(conversionRates ?? {});
    const cacheKey = `${transactionsKey}|${selectedAccountIds.join(',')}|${analyticsSelectedAccountIds.join(',')}|${duration}|${showBalanceAdjustments}|${Boolean(preferences.excludeTransfersFromAnalytics)}|${preferredCurrency}|${ratesKey}`;
    const cached = aggregateCacheRef.current.get(cacheKey);
    if (cached) return cached;

    const result = computePeriodAggregate({ duration, analyticsTransactions, analyticsSelectedAccountIds, transferLookup, excludeTransfersFromAnalytics: preferences.excludeTransfersFromAnalytics });
    cacheAggregateResult(cacheKey, result);
    return result;
  }, [analyticsSelectedAccountIds, analyticsTransactions, cacheAggregateResult, conversionRates, duration, preferences.excludeTransfersFromAnalytics, preferredCurrency, selectedAccountIds, showBalanceAdjustments, transactionsKey, transferLookup]);

  const enrichedTransactions: EnrichedTransaction[] = useMemo(
    () => filteredTransactions.map(tx => ({ ...tx, convertedAmount: convertToMain(tx.amount, tx.currency), parsedDate: parseLocalDate(tx.date) })),
    [filteredTransactions]
  );

  const { incomeChange, expenseChange } = useMemo(
    () => computePeriodChanges({ duration, analyticsTransactions, analyticsSelectedAccountIds, income, expenses, transferLookup, excludeTransfersFromAnalytics: preferences.excludeTransfersFromAnalytics }),
    [duration, analyticsTransactions, analyticsSelectedAccountIds, income, expenses, transferLookup, preferences.excludeTransfersFromAnalytics]
  );

  const outflowsByCategory: CategorySpending[] = useMemo(
    () => computeOutflowsByCategory({ enrichedTransactions, analyticsSelectedAccountIds, expenseCategories, transferLookup, excludeTransfersFromAnalytics: preferences.excludeTransfersFromAnalytics, accountLookup }),
    [enrichedTransactions, analyticsSelectedAccountIds, expenseCategories, transferLookup, preferences.excludeTransfersFromAnalytics, accountLookup]
  );

  const handleCategoryClick = useCallback((categoryName: string) => {
    setModalTransactions(filterTransactionsForCategory({ categoryName, filteredTransactions, analyticsSelectedAccountIds, expenseCategories, transferLookup, accountLookup }));
    setModalTitle(`Transactions for ${categoryName}`);
    setDetailModalOpen(true);
  }, [filteredTransactions, analyticsSelectedAccountIds, expenseCategories, transferLookup, accountLookup]);

  const calendarTransactions = useMemo(() => analyticsTransactions.filter(tx => analyticsSelectedAccountIds.includes(tx.accountId)), [analyticsTransactions, analyticsSelectedAccountIds]);

  const handleCalendarDay = useCallback((date: string) => {
    setModalTransactions(calendarTransactions.filter(tx => tx.date === date && tx.type === 'expense' && !tx.transferId));
    setModalTitle(`Spending on ${parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}`);
    setDetailModalOpen(true);
  }, [calendarTransactions]);

  const accountMap = useMemo(() => accounts.reduce((map, acc) => { map[acc.id] = acc.name; return map; }, {} as Record<string, string>), [accounts]);

  const recentTransactions = useMemo(
    () => buildRecentDashboardTransactions({ analyticsTransactions, analyticsSelectedAccountIds, accountMap, transferLookup, accounts }),
    [analyticsTransactions, analyticsSelectedAccountIds, accountMap, transferLookup, accounts]
  );

  const { incomeSparkline, expenseSparkline } = useMemo(() => computeDashboardSparklines(enrichedTransactions, duration, transactions), [enrichedTransactions, duration, transactions]);
  const eurToDisplay = useCallback((eur: number) => convertCurrency(eur, getMainCurrency(), preferredCurrency, conversionRates), [preferredCurrency, conversionRates]);

  const next30 = useMemo<HorizonNext30>(() => ({
    days: next30Raw.days.map(day => ({ date: day.date, total: eurToDisplay(day.total) })),
    expectedIn: eurToDisplay(next30Raw.expectedIn),
    goingOut: eurToDisplay(next30Raw.goingOut),
    lowest: next30Raw.lowest ? { value: eurToDisplay(next30Raw.lowest.value), date: next30Raw.lowest.date } : null,
    buffer: eurToDisplay(preferences.safeToSpendCushion ?? 0),
  }), [next30Raw, eurToDisplay, preferences.safeToSpendCushion]);

  const periodFlowBuckets = useMemo(() => computePeriodFlowBuckets({ enrichedTransactions, duration, transactions, eurToDisplay }), [enrichedTransactions, duration, transactions, eurToDisplay]);
  const { totalAssets, totalDebt, netWorth } = useMemo(() => calculateAccountTotals(analyticsSelectedAccounts || [], analyticsTransactions, loanPaymentOverrides), [analyticsSelectedAccounts, analyticsTransactions, loanPaymentOverrides]);

  const { globalTotalAssets, globalTotalDebt, globalAssetBreakdown, globalDebtBreakdown, assetGroups, liabilityGroups } = useMemo(
    () => computeGlobalAssetAndLiabilityGroups(analyticsAccounts, analyticsTransactions, loanPaymentOverrides),
    [analyticsAccounts, analyticsTransactions, loanPaymentOverrides]
  );

  const assetAllocationData = useMemo(() => buildAssetAllocationData(assetGroups), [assetGroups]);

  const netWorthData = useMemo(
    () => computeNetWorthSeries({ duration, transactions, analyticsTransactions, analyticsSelectedAccountIds, netWorth, forecastChartData, showForecast }),
    [duration, transactions, analyticsTransactions, analyticsSelectedAccountIds, netWorth, forecastChartData, showForecast]
  );

  const netWorthTrendColor = useMemo(() => {
    const historyPoints = netWorthData.filter(d => d.value !== undefined);
    if (historyPoints.length < 2) return 'var(--chart-1)';
    return historyPoints[historyPoints.length - 1].value! >= historyPoints[0].value! ? 'var(--money-in)' : 'var(--money-out)';
  }, [netWorthData]);

  const configuredCreditCards = useMemo(() => accounts.filter(acc => {
    if (acc.type !== 'Credit Card' || !acc.statementStartDate || !acc.paymentDate) return false;
    return selectedAccountIds.includes(acc.id) || Boolean(acc.settlementAccountId && selectedAccountIds.includes(acc.settlementAccountId));
  }), [accounts, selectedAccountIds]);

  const creditCardStatements = useMemo(() => computeCreditCardStatements(configuredCreditCards, transactions), [configuredCreditCards, transactions]);

  const handleBudgetClick = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.history.pushState(null, '', '/budget');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  const { liquidityRatio, savingsRate } = useMemo(() => computeLiquidityAndSavingsRate(analyticsAccounts, analyticsTransactions, duration), [analyticsAccounts, analyticsTransactions, duration]);
  const displayToEur = useCallback((val: number) => convertCurrency(val, preferredCurrency, getMainCurrency(), conversionRates), [preferredCurrency, conversionRates]);
  const toPreferred = useCallback((amount: number, from: Currency) => convertCurrency(amount, from, preferredCurrency, conversionRates), [preferredCurrency, conversionRates]);
  const setCushion = useCallback((amount: number) => setPreferences(prev => ({ ...prev, safeToSpendCushion: amount })), [setPreferences]);

  const safeToSpend = useMemo(() => computeSafeToSpend({
    accounts,
    transactions,
    recurringItems: allRecurringItems,
    bills: billsAndPayments,
    overrides: recurringTransactionOverrides,
    cushion: preferences.safeToSpendCushion ?? 0,
  }), [accounts, transactions, allRecurringItems, billsAndPayments, recurringTransactionOverrides, preferences.safeToSpendCushion]);

  const keyRatios = useMemo(() => {
    const { debtRatio, runway, saving, owing } = computeKeyRatioGauges(analyticsAccounts, analyticsTransactions, liquidityRatio, savingsRate);
    return [
      { label: 'Liquidity', value: `${liquidityRatio.toFixed(1)} months`, context: 'Months of runway at average spend', gauge: { fill: (liquidityRatio / 12) * 100, display: liquidityRatio.toFixed(1), ...runway } },
      { label: 'Savings rate', value: `${savingsRate.toFixed(0)}%`, context: 'Of income this period', gauge: { fill: (savingsRate / 40) * 100, display: `${savingsRate.toFixed(0)}%`, ...saving } },
      { label: 'Debt ratio', value: `${debtRatio.toFixed(1)}%`, context: 'Debts against assets', gauge: { fill: (debtRatio / 100) * 100, display: `${debtRatio.toFixed(0)}%`, ...owing } },
      { label: 'Net flow', value: <Amount value={eurToDisplay(safeRound(income - expenses, 2))} currency={preferredCurrency} tone="flow" />, context: 'Income less spending this period' },
    ];
  }, [analyticsAccounts, analyticsTransactions, liquidityRatio, savingsRate, income, expenses, eurToDisplay, preferredCurrency]);

  const dismissedInsights = useMemo(() => preferences.dismissedInsights ?? EMPTY_IDS, [preferences.dismissedInsights]);
  const dismissInsight = useCallback((id: string) => {
    setPreferences(prev => ({ ...prev, dismissedInsights: Array.from(new Set([...(prev.dismissedInsights ?? []), id])) }));
  }, [setPreferences]);

  const activeInsights = useMemo(() => {
    const threeMonthsTile = lowestBalanceForecasts.find(tile => tile.period === 'Next 3 Months') ?? lowestBalanceForecasts[0];
    const lowestBalance = threeMonthsTile ? { date: threeMonthsTile.date, total: eurToDisplay(threeMonthsTile.lowestBalance) } : undefined;
    const all = generateInsights({ today: new Date(), accounts: analyticsAccounts, transactions: analyticsTransactions, categories: expenseCategories, recurring: everySeries, lowestBalance, convert: toPreferred, format: amount => formatCurrency(amount, preferredCurrency) });
    return visibleInsights(all, dismissedInsights);
  }, [lowestBalanceForecasts, eurToDisplay, analyticsAccounts, analyticsTransactions, expenseCategories, everySeries, toPreferred, preferredCurrency, dismissedInsights]);

  const allWidgets: Widget[] = useMemo(
    () => buildDashboardWidgets({
      income, expenses, incomeChange, expenseChange, periodFlowBuckets, preferredCurrency, eurToDisplay, displayToEur, toPreferred, safeToSpend, setCushion, accounts, transactions, conversionRates, onOpenAccount, setCurrentPage, keyRatios, assetAllocationData, assetGroups, liabilityGroups, globalTotalAssets, globalTotalDebt, globalAssetBreakdown, globalDebtBreakdown, tasks, allRecurringItems, billsAndPayments, financialGoals, recurringTransactionOverrides, saveTask, handleProcessItem, next30, lowestBalanceForecasts, creditCardStatements, analyticsTransactions, analyticsSelectedAccountIds, expenseCategories, incomeCategories, allCategories, handleCategoryClick, calendarTransactions, handleCalendarDay, netWorthData, netWorthTrendColor, showForecast, showGoals, selectedAccountIds, budgets, duration, handleBudgetClick, recentTransactions, handleTransactionClick, filteredTransactions, activeInsights, dismissInsight,
    }),
    [next30, calendarTransactions, handleCalendarDay, conversionRates, periodFlowBuckets, activeInsights, dismissInsight, safeToSpend, eurToDisplay, displayToEur, toPreferred, isFirstVisit, setCushion, selectedAccounts, onOpenAccount, setCurrentPage, keyRatios, assetAllocationData, assetGroups, liabilityGroups, netWorth, income, expenses, incomeChange, expenseChange, incomeSparkline, expenseSparkline, tasks, allRecurringItems, billsAndPayments, financialGoals, recurringTransactionOverrides, saveTask, handleProcessItem, lowestBalanceForecasts, preferredCurrency, creditCardStatements, netWorthData, netWorthTrendColor, showForecast, showGoals, selectedAccountIds, analyticsSelectedAccountIds, outflowsByCategory, handleCategoryClick, totalAssets, totalDebt, recentTransactions, allCategories, handleTransactionClick, globalTotalAssets, globalAssetBreakdown, globalTotalDebt, globalDebtBreakdown, budgets, transactions, expenseCategories, accounts, duration, handleBudgetClick, filteredTransactions, incomeCategories, analyticsTransactions]
  );

  const urlTab = useUrlTab();
  const activeTab = isOverviewTab(urlTab) ? urlTab : 'summary';
  const activeView = OVERVIEW_TABS.find(view => view.id === activeTab)!;
  const layout = useMemo(() => resolveTabLayout(preferences, isMobile, activeTab), [preferences.dashboardLayouts, preferences.dashboardHiddenWidgets, isMobile, activeTab]);
  const layoutKey = overviewTabKey(activeTab, isMobile);

  const saveLayout = useCallback((next: WidgetConfig[]) => {
    setPreferences(prev => ({ ...prev, dashboardLayouts: { ...(prev.dashboardLayouts || {}), [layoutKey]: next } }));
  }, [layoutKey, setPreferences]);

  const removeWidget = useCallback((widgetId: string) => saveLayout(layout.filter(widget => widget.id !== widgetId)), [layout, saveLayout]);

  const addWidget = (widgetId: string) => {
    saveLayout([...layout, toConfig(widgetId, OVERVIEW_WIDGETS[widgetId].span, layout.length)]);
    setIsAddWidgetModalOpen(false);
  };

  const moveWidget = (widgetId: string, step: number) => {
    const index = layout.findIndex(widget => widget.id === widgetId);
    const target = index + step;
    if (index < 0 || target < 0 || target >= layout.length) return;
    const next = [...layout];
    next.splice(target, 0, next.splice(index, 1)[0]);
    saveLayout(next);
  };

  const availableWidgetsToAdd = useMemo(() => {
    const shown = new Set(layout.map(widget => widget.id));
    return allWidgets
      .filter(widget => !shown.has(widget.id) && OVERVIEW_WIDGETS[widget.id]?.tab === activeTab)
      .map(widget => ({ ...widget, name: OVERVIEW_WIDGETS[widget.id].title, description: OVERVIEW_WIDGETS[widget.id].purpose }));
  }, [layout, allWidgets, activeTab]);

  const dedupedTransferSuggestions = useMemo(() => (selectedAccountIds.length === 0 ? review.transfers : review.transfers.filter(s => selectedAccountIds.includes(s.expenseTx.accountId) || selectedAccountIds.includes(s.incomeTx.accountId))), [review.transfers, selectedAccountIds]);
  const dedupedBillSuggestions = useMemo(() => (selectedAccountIds.length === 0 ? review.billMatches : review.billMatches.filter(s => selectedAccountIds.includes(s.transaction.accountId))), [review.billMatches, selectedAccountIds]);
  const totalPendingMatchesCount = dedupedTransferSuggestions.length + dedupedBillSuggestions.length;
  const { notificationCount: billsDue } = useBillNotifications({ recurringTransactions, billsAndPayments, dismissedIds: usePreferencesSelector(p => p.dismissedBillNotifications) ?? EMPTY_IDS });
  const toCategorise = useMemo(() => analyticsTransactions.filter(tx => isUncategorised(tx) && analyticsSelectedAccountIds.includes(tx.accountId)).length, [analyticsTransactions, analyticsSelectedAccountIds]);
  const tasksDue = useMemo(() => {
    const today = toLocalISOString(new Date());
    return tasks.filter(task => task.status !== 'Done' && !!task.dueDate && task.dueDate <= today).length;
  }, [tasks]);

  const incomeYesterday = useMemo(() => {
    const day = new Date();
    day.setDate(day.getDate() - 1);
    const yesterday = toLocalISOString(day);
    return safeRound(analyticsTransactions.filter(tx => tx.date === yesterday && tx.type === 'income' && !tx.transferId && analyticsSelectedAccountIds.includes(tx.accountId)).reduce((sum, tx) => sum + convertToMain(tx.amount, tx.currency), 0), 2);
  }, [analyticsTransactions, analyticsSelectedAccountIds]);

  const openReview = useCallback(() => {
    setCurrentPage('Transactions');
    setUrlTab('review');
  }, [setCurrentPage]);

  const openMatches = useCallback((filter: 'all' | 'transfer' | 'bill' = 'all') => {
    setMatchesModalFilter(filter);
    setMatchesModalOpen(true);
  }, []);

  const summaryFacts = buildSummaryFacts({
    incomeYesterday: incomeYesterday > 0 ? formatCurrency(eurToDisplay(incomeYesterday), preferredCurrency) : null,
    billsDue,
    toReview: toCategorise + dedupedTransferSuggestions.length + dedupedBillSuggestions.length,
    tasksDue,
  });

  const heroParts = useMemo(() => {
    const sumOf = (types: AccountType[]) => calculateAccountTotals(analyticsSelectedAccounts.filter(acc => types.includes(acc.type)), analyticsTransactions, loanPaymentOverrides).totalAssets;
    const cash = sumOf(['Checking', 'Savings']);
    const investments = sumOf(['Investment']);
    return [
      { label: 'Cash', value: eurToDisplay(cash) },
      { label: 'Investments', value: eurToDisplay(investments) },
      { label: 'Property and other', value: eurToDisplay(Math.max(0, totalAssets - cash - investments)) },
    ];
  }, [analyticsSelectedAccounts, analyticsTransactions, loanPaymentOverrides, totalAssets, eurToDisplay]);

  const netWorthChange = useMemo(() => {
    const history = netWorthData.filter(point => point.value !== undefined);
    return history.length < 2 ? null : safeRound(netWorth - history[0].value!, 2);
  }, [netWorthData, netWorth]);

  const periodLabel = (DURATION_OPTIONS.find(option => option.value === duration)?.label ?? 'this period').toLowerCase();

  const gridItems = useMemo<WidgetGridItem[]>(() => layout.flatMap(entry => {
    const widget = allWidgets.find(item => item.id === entry.id);
    const meta = OVERVIEW_WIDGETS[entry.id];
    if (!widget || !meta || (entry.id === 'creditCardStatements' && creditCardStatements.length === 0)) return [];
    const Component = widget.component;
    return [{
      id: entry.id,
      title: meta.title,
      defaultSpan: meta.span,
      rows: entry.h ?? meta.rows,
      render: size => (
        <WidgetErrorBoundary widgetTitle={meta.title}>
          <Suspense fallback={<Skeleton variant="card" />}>
            <Component {...widget.props} size={size} />
          </Suspense>
        </WidgetErrorBoundary>
      ),
    }];
  }), [layout, allWidgets, creditCardStatements.length]);

  const gridLayout = useMemo<WidgetLayoutItem[]>(() => layout.map(entry => ({
    id: entry.id,
    span: entry.w,
    rows: entry.h ?? OVERVIEW_WIDGETS[entry.id]?.rows ?? 3,
  })), [layout]);

  const handleGridChange = useCallback((next: WidgetLayoutItem[]) => {
    saveLayout(next.map((entry, index) => toConfig(entry.id, entry.span, index, entry.rows)));
  }, [saveLayout]);

  const page = (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        stats={[
          { label: 'Money in this month', icon: 'arrow_downward', value: eurToDisplay(monthFlow.income), format: 'money', currency: preferredCurrency, trend: dayTrends.income, badge: monthDeltas.income.badge, badgeTitle: `Money in, ${monthDeltas.since}`, badgeTone: monthDeltas.income.tone },
          { label: 'Money out this month', icon: 'arrow_upward', value: eurToDisplay(monthFlow.spending), format: 'money', currency: preferredCurrency, trend: dayTrends.spending, badge: monthDeltas.spending.badge, badgeTitle: `Money out, ${monthDeltas.since}`, badgeTone: monthDeltas.spending.tone },
          { label: 'Saved this month', icon: 'savings', value: monthFlow.income > 0 ? ((monthFlow.income - monthFlow.spending) / monthFlow.income) * 100 : 0, format: 'percent', badge: monthDeltas.saved.badge, badgeTitle: `Share saved, ${monthDeltas.since}`, badgeTone: monthDeltas.saved.tone },
        ]}
        className="!mb-0"
      />
      {activeTab !== 'summary' && <p className="type-sentence !mt-1 text-muted md:!mt-2">{activeView.blurb}.</p>}
      {activeTab === 'summary' && (
        <DashboardSummarySection
          summaryFacts={summaryFacts}
          isPrivate={isPrivate}
          isFirstVisit={isFirstVisit}
          setCurrentPage={setCurrentPage}
          openMatches={openMatches}
          openReview={openReview}
          totalPendingMatchesCount={totalPendingMatchesCount}
          transferCount={dedupedTransferSuggestions.length}
          billCount={dedupedBillSuggestions.length}
          likelyCount={review.likelyCount}
          dismissAllMatches={review.dismissAll}
          confirmLikelyMatches={review.confirmLikely}
          netWorthDisplay={eurToDisplay(netWorth)}
          netWorthChangeDisplay={netWorthChange === null ? null : eurToDisplay(netWorthChange)}
          periodLabel={periodLabel}
          heroParts={heroParts}
          debtsDisplay={eurToDisplay(Math.abs(totalDebt))}
          preferredCurrency={preferredCurrency}
          toCategorise={toCategorise}
          billsDue={billsDue}
          tasksDue={tasksDue}
        />
      )}

      <DashboardFilterToolbar
        isMobile={isMobile}
        accounts={accounts}
        selectedAccountIds={selectedAccountIds}
        setSelectedAccountIds={setSelectedAccountIds}
        duration={duration}
        setDuration={setDuration}
        forecastDuration={forecastDuration}
        setForecastDuration={setForecastDuration}
        showForecast={showForecast}
        setShowForecast={setShowForecast}
        showGoals={showGoals}
        setShowGoals={setShowGoals}
        isEditMode={isEditMode}
        setIsEditMode={setIsEditMode}
        setIsAddWidgetModalOpen={setIsAddWidgetModalOpen}
        setPhoneEditOpen={setPhoneEditOpen}
      />

      {gridItems.length === 0 ? (
        <EmptyState
          icon="dashboard-square-add"
          title={`Nothing on ${activeView.label} yet`}
          description={`${activeView.blurb}. Add a widget to build this view.`}
          actionLabel="Add a widget"
          onAction={() => setIsAddWidgetModalOpen(true)}
          className="py-16"
        />
      ) : isMobile ? (
        <div className="space-y-4">
          {gridItems.map(item => {
            const height = OVERVIEW_WIDGETS[item.id].phoneHeight;
            return (
              <section key={item.id} aria-label={item.title} className="flex flex-col overflow-hidden rounded-[var(--radius-xl)] surface-card p-5" style={{ height }}>
                <h2 className="type-card-title mb-3 shrink-0 text-ink">{item.title}</h2>
                <WidgetBody size="m" className="min-h-0 flex-1">{item.render('m')}</WidgetBody>
              </section>
            );
          })}
        </div>
      ) : (
        <WidgetGrid
          key={activeTab}
          className={isFirstVisit ? 'crystal-stagger-grid' : undefined}
          items={gridItems}
          layout={gridLayout}
          onLayoutChange={handleGridChange}
          isEditing={isEditMode}
          onRemove={removeWidget}
        />
      )}
    </div>
  );

  return (
    <div className="relative">
      {isTransactionModalOpen && (
        <AddTransactionModal
          onClose={handleCloseTransactionModal}
          onSave={(data, toDelete) => handleSavePostedTransaction(data, toDelete)}
          accounts={accounts}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          transactionToEdit={editingTransaction}
          transactions={transactions}
          tags={tags}
          userProfile={user}
          initialType={initialModalData.initialType}
          initialFromAccountId={initialModalData.initialFromAccountId}
          initialToAccountId={initialModalData.initialToAccountId}
          initialCategory={initialModalData.initialCategory}
          initialDetails={initialModalData.initialDetails}
        />
      )}
      <TransactionDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={modalTitle}
        transactions={modalTransactions}
        accounts={accounts}
        tags={tags}
        onEdit={handleEditTransaction}
        onDelete={handleDeleteTransactions}
      />
      <AddWidgetModal isOpen={isAddWidgetModalOpen} onClose={() => setIsAddWidgetModalOpen(false)} availableWidgets={availableWidgetsToAdd} onAddWidget={addWidget} viewLabel={activeView.label} />

      {isMobile && onSyncBanks ? <PullToRefresh onRefresh={async () => { await onSyncBanks(); }}>{page}</PullToRefresh> : page}

      <BottomSheet
        isOpen={isPhoneEditOpen}
        onClose={() => setPhoneEditOpen(false)}
        title={`Customise ${activeView.label}`}
        footer={<Button block size="lg" variant="secondary" icon="add" onPress={() => setIsAddWidgetModalOpen(true)} isDisabled={availableWidgetsToAdd.length === 0}>Add a widget</Button>}
      >
        <ul className="divide-y divide-line">
          {layout.map((entry, index) => (
            <li key={entry.id} className="flex min-h-14 items-center gap-1">
              <span className="type-body-strong min-w-0 flex-1 truncate text-ink">{OVERVIEW_WIDGETS[entry.id].title}</span>
              <IconButton icon="arrow_upward" label={`Move ${OVERVIEW_WIDGETS[entry.id].title} up`} isDisabled={index === 0} onPress={() => moveWidget(entry.id, -1)} />
              <IconButton icon="arrow_downward" label={`Move ${OVERVIEW_WIDGETS[entry.id].title} down`} isDisabled={index === layout.length - 1} onPress={() => moveWidget(entry.id, 1)} />
              <IconButton icon="visibility_off" label={`Hide ${OVERVIEW_WIDGETS[entry.id].title}`} onPress={() => removeWidget(entry.id)} />
            </li>
          ))}
        </ul>
      </BottomSheet>

      <PendingMatchesModal isOpen={isMatchesModalOpen} onClose={() => setMatchesModalOpen(false)} initialFilter={matchesModalFilter} onOpenFullQueue={openReview} />
    </div>
  );
};

export default React.memo(Dashboard);
