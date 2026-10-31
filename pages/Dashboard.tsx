import React, { useMemo, useState, useCallback, useEffect, useRef, Suspense, lazy } from 'react';
import { Page, User, Transaction, Account, Category, Duration, CategorySpending, Widget, WidgetConfig, DisplayTransaction, FinancialGoal, RecurringTransaction, BillPayment, Tag, Budget, RecurringTransactionOverride, LoanPaymentOverrides, AccountType, Task, ForecastDuration, Currency, ScheduledItem } from '../types';
import { calculateForecastHorizon, formatCurrency, convertCurrency, convertToEur, generateBalanceForecast, generateSyntheticLoanPayments, generateSyntheticCreditCardPayments, parseLocalDate, getPreferredTimeZone, generateSyntheticPropertyTransactions, toLocalISOString, getDateRange, calculateAccountTotals, calculateStatementPeriods, getCreditCardStatementDetails, formatDateKey, safeRound } from '../utils';
import AddTransactionModal from '../components/AddTransactionModal';
import { DURATION_OPTIONS, LIQUID_ACCOUNT_TYPES, ASSET_TYPES, DEBT_TYPES, ACCOUNT_TYPE_STYLES, INVESTMENT_SUB_TYPE_STYLES, FORECAST_DURATION_OPTIONS, QUICK_CREATE_BUDGET_OPTIONS, CHECKBOX_STYLE, SELECT_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE } from '../constants';
import TransactionDetailModal from '../components/TransactionDetailModal';
import WidgetWrapper from '../components/WidgetWrapper';
import OutflowsChart from '../components/OutflowsChart';
import DurationFilter from '../components/DurationFilter';
import NetWorthChart from '../components/NetWorthChart';
import AssetDebtDonutChart from '../components/AssetDebtDonutChart';
import TransactionList from '../components/TransactionList';
import MultiAccountFilter from '../components/MultiAccountFilter';
import FinancialOverview from '../components/FinancialOverview';
import ForecastOverview from '../components/ForecastOverview';
import AddWidgetModal from '../components/AddWidgetModal';
import { useTransactionMatcher } from '../hooks/useTransactionMatcher';
import { useSyncedBillMatcher, SyncedBillMatchSuggestion } from '../hooks/useSyncedBillMatcher';
import { useMatcherConfig } from '../hooks/useMatcherConfig';
import UnifiedPendingMatchesModal from '../components/UnifiedPendingMatchesModal';
import PendingMatchesView from '../components/PendingMatchesView';
import CreditCardStatementCard from '../components/CreditCardStatementCard';
import BudgetOverviewWidget from '../components/BudgetOverviewWidget';
import AccountBreakdownCard from '../components/AccountBreakdownCard';
import TodayWidget from '../components/TodayWidget';
import { useAccountsContext, usePreferencesContext, useTransactionsContext, usePreferencesSelector } from '../contexts/DomainProviders';
import { useBudgetsContext, useCategoryContext, useGoalsContext, useScheduleContext, useTagsContext } from '../contexts/FinancialDataContext';
import { useInsightsView } from '../contexts/InsightsViewContext';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label, Legend, BarChart, Bar, Cell } from 'recharts';
import { PieChart as BklitPieChart, PieSlice, PieCenter } from '../src/components/charts';
import ForecastDayModal from '../components/ForecastDayModal';
import RecurringTransactionModal from '../components/RecurringTransactionModal';
import RecurringOverrideModal from '../components/RecurringOverrideModal';
import EditRecurrenceModal from '../components/EditRecurrenceModal';
import BillPaymentModal from '../components/BillPaymentModal';
import GoalScenarioModal from '../components/GoalScenarioModal';
import FinancialGoalCard from '../components/FinancialGoalCard';
import ConfirmationModal, { useConfirm } from '../components/ConfirmationModal';
import GoalContributionPlan from '../components/GoalContributionPlan';
import QuickBudgetModal from '../components/QuickBudgetModal';
import BudgetProgressCard from '../components/BudgetProgressCard';
import { useIsMobile } from '../hooks/useIsMobile';
import BudgetModal from '../components/BudgetModal';
import MultiSelectFilter from '../components/MultiSelectFilter';
import { Skeleton } from '../components/ui/States';
import PullToRefresh from '../components/PullToRefresh';
import AssetAllocationWidget from '../components/AssetAllocationWidget';
import { Button, IconButton } from '../components/ui/Actions';
import { Switch } from '../components/ui/Fields';
import { Amount, PrivacyContext, useFirstVisit } from '../components/ui/Money';
import { BottomSheet, FullPanel, Popover } from '../components/ui/Overlays';
import { MultiSelect, Select } from '../components/ui/Pickers';
import { AccountsSummary, KeyRatios, NeedsYou, NetWorthHero, SafeToSpendWidget, WrittenSummary } from '../components/ui/Summaries';
import WidgetGrid, { type WidgetGridItem, type WidgetLayoutItem } from '../components/ui/WidgetGrid';
import { Button as AriaButton } from 'react-aria-components';
import { useBillNotifications } from '../hooks/useBillNotifications';
import { computeSafeToSpend } from '../utils/safeToSpend';
import { buildSummaryFacts, isUncategorised } from '../utils/overviewSummary';
import { OVERVIEW_LAYOUT_KEY, OVERVIEW_PHONE_LAYOUT_KEY, OVERVIEW_WIDGETS, resolveOverviewLayout, toConfig } from '../utils/overviewLayout';

// Analysis widgets
import MerchantParetoWidget from '../components/MerchantParetoWidget';
import FinancialRunwayWidget from '../components/FinancialRunwayWidget';
import WealthVelocityWidget from '../components/WealthVelocityWidget';

import WidgetErrorBoundary from '../components/WidgetErrorBoundary';
import Icon from '../components/ui/Icon';

const TransactionMapWidget = lazy(() => import('../components/TransactionMapWidget'));
const CashflowSankey = lazy(() => import('../components/CashflowSankey'));

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
  setCurrentPage: (page: Page) => void;
  onOpenAccount: (id: string) => void;
  onSyncBanks?: () => void | Promise<void>;
  isSyncingBanks?: boolean;
}

// Define the AssetGroup type to fix type errors
type AssetGroup = {
  types: AccountType[];
  value: number;
  color: string;
  icon: string
};

const findCategoryDetails = (name: string, categories: Category[]): Category | undefined => {
  for (const cat of categories) {
    if (cat.name === name) return cat;
    if (cat.subCategories.length > 0) {
      const found = findCategoryDetails(name, cat.subCategories);
      if (found) return found;
    }
  }
  return undefined;
};

const findCategoryById = (id: string, categories: Category[]): Category | undefined => {
  for (const cat of categories) {
    if (cat.id === id) return cat;
    if (cat.subCategories?.length) {
      const found = findCategoryById(id, cat.subCategories);
      if (found) return found;
    }
  }
  return undefined;
}

type EnrichedTransaction = Transaction & { convertedAmount: number; parsedDate: Date };

const CreditCardStatementsWidget: React.FC<{ statements: any[] }> = ({ statements }) => {
  if (statements.length === 0) return null;
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-2.5 sm:gap-3 h-full items-stretch">
      {statements.map(statement => (
        <CreditCardStatementCard
          key={statement.accountId}
          noCard={true}
          accountName={statement.accountName}
          accountBalance={statement.accountBalance}
          creditLimit={statement.creditLimit}
          cardNetwork={statement.cardNetwork}
          financialInstitution={statement.financialInstitution}
          currency={statement.currency}
          currentStatement={{
            period: statement.current.period,
            balance: statement.current.balance,
            dueDate: statement.current.paymentDue,
            amountPaid: statement.current.amountPaid,
            previousStatementBalance: statement.current.previousStatementBalance
          }}
          nextStatement={{
            period: statement.future.period,
            balance: statement.future.balance,
            dueDate: statement.future.paymentDue
          }}
        />
      ))}
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ user, tasks, saveTask, onSyncBanks, isSyncingBanks, setCurrentPage, onOpenAccount }) => {
  const { confirm, ConfirmDialog } = useConfirm();
  const { activeGoalIds, setActiveGoalIds, dashboardAccountIds: selectedAccountIds, setDashboardAccountIds: setSelectedAccountIds, dashboardDuration: duration, setDashboardDuration: setDuration } = useInsightsView();
  const { accounts } = useAccountsContext();
  const { transactions, saveTransaction, deleteTransactions, digest: transactionsDigest } = useTransactionsContext();
  const { incomeCategories, expenseCategories } = useCategoryContext();
  const { financialGoals, saveFinancialGoal } = useGoalsContext();
  const {
    recurringTransactions,
    recurringTransactionOverrides,
    loanPaymentOverrides,
    billsAndPayments,
    saveRecurringTransaction,
    saveBillPayment,
    saveRecurringOverride,
    deleteRecurringOverride,
  } = useScheduleContext();
  const { tags } = useTagsContext();
  const { budgets } = useBudgetsContext();
  const { preferences, setPreferences } = usePreferencesContext();
  const preferredCurrency = usePreferencesSelector(p => (p.currency || 'EUR') as Currency);
  const conversionRates = usePreferencesSelector(p => p.conversionRates);
  const showBalanceAdjustments = usePreferencesSelector(p => p.showBalanceAdjustments ?? true);

  // Dashboard Specific State
  const [showForecast, setShowForecast] = useState(true);
  const [showGoals, setShowGoals] = useState(true);
  const [forecastDuration, setForecastDuration] = useState<ForecastDuration>(preferences.defaultForecastPeriod || '1Y');
  const isPrivate = React.useContext(PrivacyContext);
  const isFirstVisit = useFirstVisit('overview');
  const isMobile = useIsMobile();

  // Sync Forecast Duration with Historical Duration by default
  useEffect(() => {
    let target: ForecastDuration = '1Y';
    switch (duration) {
      case 'TODAY':
      case 'WTD':
      case 'MTD':
      case '30D':
        target = '3M';
        break;
      case '60D':
      case '90D':
      case '6M':
        target = '6M';
        break;
      case 'YTD':
      case '1Y':
      case 'ALL':
      default:
        target = '1Y';
        break;
    }
    setForecastDuration(target);
  }, [duration]);

  const transactionsKey = transactionsDigest;
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
  const [isMatchesPanelOpen, setMatchesPanelOpen] = useState(false);
  const [isUnifiedPendingModalOpen, setIsUnifiedPendingModalOpen] = useState(false);
  const [unifiedModalInitialFilter, setUnifiedModalInitialFilter] = useState<'all' | 'transfer' | 'bill'>('all');

  const [selectedForecastDate, setSelectedForecastDate] = useState<string | null>(null);
  const [overrideModalItem, setOverrideModalItem] = useState<ScheduledItem | null>(null);
  const [editChoiceItem, setEditChoiceItem] = useState<ScheduledItem | null>(null);

  // States for Forecast Interaction Modals
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringTransaction | null>(null);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<BillPayment | null>(null);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);

  const { config: matcherConfig, updateConfig: updateMatcherConfig, resetConfig: resetMatcherConfig } = useMatcherConfig();

  const {
    suggestions,
    confirmMatch,
    dismissSuggestion,
    confirmSelectedMatches,
    dismissSelectedMatches,
    confirmAllMatches,
    dismissAllSuggestions,
  } = useTransactionMatcher(transactions, accounts, saveTransaction, matcherConfig);

  const {
    billSuggestions,
    confirmBillMatch,
    dismissBillMatch,
    confirmSelectedBillMatches,
    dismissSelectedBillMatches,
    confirmAllBillMatches,
    dismissAllBillMatches,
  } = useSyncedBillMatcher(
    transactions,
    recurringTransactions,
    billsAndPayments,
    accounts,
    saveTransaction,
    saveRecurringTransaction,
    saveBillPayment,
    matcherConfig
  );

  const allCategories = useMemo(() => [...incomeCategories, ...expenseCategories], [incomeCategories, expenseCategories]);

  const selectedAccounts = useMemo(() =>
    accounts.filter(a => selectedAccountIds.includes(a.id)),
    [accounts, selectedAccountIds]);

  const accountLookup = useMemo(() => new Map(accounts.map(acc => [acc.id, acc])), [accounts]);
  const analyticsAccounts = useMemo(() => accounts.filter(acc => acc.includeInAnalytics ?? true), [accounts]);
  const analyticsSelectedAccounts = useMemo(() => selectedAccounts.filter(acc => acc.includeInAnalytics ?? true), [selectedAccounts]);
  const analyticsSelectedAccountIds = useMemo(() => analyticsSelectedAccounts.map(acc => acc.id), [analyticsSelectedAccounts]);
  const analyticsTransactions = useMemo(() => transactions.filter(tx => {
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
      if (oldestKey) {
        cache.delete(oldestKey);
      }
    }
    cache.set(cacheKey, value);
  }, [aggregateCacheMax]);

  // Combine all recurring items (user-defined + synthetic)
  const { allRecurringItems } = useMemo(() => {
    const syntheticLoanPayments = generateSyntheticLoanPayments(analyticsAccounts, analyticsTransactions, loanPaymentOverrides);
    const syntheticCreditCardPayments = generateSyntheticCreditCardPayments(analyticsAccounts, analyticsTransactions);
    const syntheticPropertyTransactions = generateSyntheticPropertyTransactions(analyticsAccounts);

    const all = [...recurringTransactions, ...syntheticLoanPayments, ...syntheticCreditCardPayments, ...syntheticPropertyTransactions];
    return { allRecurringItems: all };
  }, [analyticsAccounts, analyticsTransactions, loanPaymentOverrides, recurringTransactions]);

  // Forecast Data for Widget (Used for Lowest Balance Cards & Net Worth Chart)
  const { forecastChartData, lowestBalanceForecasts, lowestForecastPoint, forecastTableData } = useMemo(() => {
    const projectionEndDate = new Date();
    // Adjust duration based on filter
    switch (forecastDuration) {
      case '3M': projectionEndDate.setMonth(projectionEndDate.getMonth() + 3); break;
      case '6M': projectionEndDate.setMonth(projectionEndDate.getMonth() + 6); break;
      case 'EOY': projectionEndDate.setFullYear(projectionEndDate.getFullYear(), 11, 31); break;
      case '1Y': projectionEndDate.setMonth(projectionEndDate.getMonth() + 12); break;
      default: projectionEndDate.setMonth(projectionEndDate.getMonth() + 12); break;
    }

    // Use ALL accounts to generate synthetic items.
    const syntheticLoanPayments = generateSyntheticLoanPayments(accounts, transactions, loanPaymentOverrides);
    const syntheticCreditCardPayments = generateSyntheticCreditCardPayments(accounts, transactions);
    const syntheticPropertyTransactions = generateSyntheticPropertyTransactions(accounts);

    const allRecurring = [...recurringTransactions, ...syntheticLoanPayments, ...syntheticCreditCardPayments, ...syntheticPropertyTransactions];
    const activeGoals = financialGoals.filter(g => {
      if (g.disabled) return false;
      if (!activeGoalIds.includes(g.id)) return false;
      if (g.parentId) {
        const parent = financialGoals.find(p => p.id === g.parentId);
        if (parent && (parent.disabled || !activeGoalIds.includes(parent.id))) return false;
      }
      return true;
    });

    const { chartData, lowestPoint, tableData } = generateBalanceForecast(
      selectedAccounts, // The engine will filter impacts based on these selected accounts
      allRecurring,
      activeGoals,
      billsAndPayments,
      projectionEndDate,
      recurringTransactionOverrides
    );

    return {
      forecastChartData: chartData,
      lowestBalanceForecasts: calculateForecastHorizon(chartData),
      lowestForecastPoint: lowestPoint,
      forecastTableData: tableData
    };

  }, [accounts, selectedAccounts, transactions, loanPaymentOverrides, recurringTransactions, financialGoals, activeGoalIds, billsAndPayments, recurringTransactionOverrides, forecastDuration]);

  const selectedDayItems = useMemo(() => {
    if (!selectedForecastDate) return [];
    return forecastTableData.filter(item => item.date === selectedForecastDate);
  }, [selectedForecastDate, forecastTableData]);

  const handleDateClick = (date: string) => {
    setSelectedForecastDate(date);
  };

  const handleEditSingle = () => {
    if (!editChoiceItem) return;
    setOverrideModalItem(editChoiceItem);
    setEditChoiceItem(null);
  };

  const handleEditSeries = () => {
    if (!editChoiceItem) return;
    setEditingRecurring(editChoiceItem.originalItem as RecurringTransaction);
    setIsRecurringModalOpen(true);
    setEditChoiceItem(null);
  };

  const handleEditFuture = () => {
    if (!editChoiceItem) return;
    const item = editChoiceItem;
    const original = item.originalItem as RecurringTransaction;

    const occurrenceDate = parseLocalDate(item.originalDateForOverride || item.date);
    const dayBefore = new Date(occurrenceDate);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const endDateForOld = toLocalISOString(dayBefore);

    const newSeriesStart = item.originalDateForOverride || item.date;
    const newSeriesData: Omit<RecurringTransaction, 'id'> = {
      ...original,
      startDate: newSeriesStart,
      nextDueDate: newSeriesStart,
    };

    saveRecurringTransaction({ ...original, endDate: endDateForOld });

    setEditingRecurring({ ...newSeriesData, id: '' } as RecurringTransaction);
    setEditChoiceItem(null);
    setIsRecurringModalOpen(true);
  };

  const handleEditForecastItem = (item: any) => {
    setSelectedForecastDate(null);
    if (item.type === 'Financial Goal') {
      setEditingGoal(item.originalItem);
      setIsGoalModalOpen(true);
    } else if (item.type === 'Recurring') {
      if (item.originalItem?.isSynthetic) {
        return;
      }
      const originalRt = item.originalItem as RecurringTransaction;
      const isOverride = !!(originalRt as any)?.isOverride;
      const origDateForOverride = (originalRt as any)?.originalDateForOverride || item.date;

      const scheduledItem: ScheduledItem = {
        id: item.id,
        isRecurring: true,
        date: item.date,
        description: item.description,
        amount: item.amount,
        accountName: item.accountName,
        type: originalRt?.type || (item.amount < 0 ? 'expense' : 'income'),
        originalItem: originalRt,
        isTransfer: originalRt?.type === 'transfer',
        isOverride: isOverride,
        originalDateForOverride: origDateForOverride,
        isSkipped: !!(originalRt as any)?.isSkipped,
        category: originalRt?.category,
        merchant: originalRt?.merchant,
        accountId: item.accountId || originalRt?.accountId,
      };

      if (isOverride) {
        setOverrideModalItem(scheduledItem);
      } else {
        setEditChoiceItem(scheduledItem);
      }
    } else if (item.type === 'Bill/Payment') {
      setEditingBill(item.originalItem);
      setIsBillModalOpen(true);
    }
  };

  const handleAddNewToDate = () => {
    setEditingRecurring(null);
    setIsRecurringModalOpen(true);
  };

  const handleOpenTransactionModal = (tx?: Transaction) => {
    setEditingTransaction(tx || null);
    setItemToPost(null);
    setTransactionModalOpen(true);
  };

  const handleCloseTransactionModal = () => {
    setEditingTransaction(null);
    setItemToPost(null);
    setTransactionModalOpen(false);
  };

  const handleProcessItem = (item: RecurringTransaction | BillPayment) => {
    setItemToPost({ item });
    setTransactionModalOpen(true);
  };

  const handleSavePostedTransaction = (transactionsToSave: (Omit<Transaction, 'id'> & { id?: string })[], idsToDelete: string[]) => {
    saveTransaction(transactionsToSave, idsToDelete);

    if (itemToPost) {
      const original = itemToPost.item;
      if ('frequency' in original) {
        // Recurring
        const rt = original as RecurringTransaction;
        if (!rt.isSynthetic) {
          const postedDate = parseLocalDate(transactionsToSave[0].date);
          let nextDueDate = new Date(postedDate);
          const interval = rt.frequencyInterval || 1;
          const startDateLocal = parseLocalDate(rt.startDate);

          // Simple advance logic
          switch (rt.frequency) {
            case 'daily': nextDueDate.setDate(nextDueDate.getDate() + interval); break;
            case 'weekly': nextDueDate.setDate(nextDueDate.getDate() + 7 * interval); break;
            case 'monthly': {
              const d = rt.dueDateOfMonth || startDateLocal.getDate();
              nextDueDate.setMonth(nextDueDate.getMonth() + interval, 1);
              const lastDayOfNextMonth = new Date(nextDueDate.getFullYear(), nextDueDate.getMonth() + 1, 0).getDate();
              nextDueDate.setDate(Math.min(d, lastDayOfNextMonth));
              break;
            }
            case 'yearly': {
              nextDueDate.setFullYear(nextDueDate.getFullYear() + interval);
              break;
            }
          }
          saveRecurringTransaction({ ...rt, nextDueDate: toLocalISOString(nextDueDate) });
        }
      } else {
        // Bill
        const bill = original as BillPayment;
        const postedTransaction = transactionsToSave[0];
        saveBillPayment({ ...bill, status: 'paid', accountId: postedTransaction.accountId, dueDate: postedTransaction.date });
      }
    }

    handleCloseTransactionModal();
  };

  const initialModalData = useMemo(() => {
    if (!itemToPost) return {};

    const item = itemToPost.item;
    let type: 'income' | 'expense' | 'transfer';
    let from, to;
    let category: string | undefined;
    let merchant: string | undefined;

    if ('frequency' in item) {
      const rt = item as RecurringTransaction;
      type = rt.type;
      category = rt.category;
      merchant = rt.merchant;
      if (type === 'transfer') {
        from = rt.accountId;
        to = rt.toAccountId;
      } else if (type === 'income') {
        to = rt.accountId;
      } else {
        from = rt.accountId;
      }
    } else { // Bill
      const bill = item as BillPayment;
      type = bill.type === 'deposit' ? 'income' : 'expense';
      category = type === 'income' ? 'Income' : 'Bills & Utilities';
      merchant = (bill as any).merchant || (bill as any).biller;
      if (bill.accountId) {
        if (type === 'income') to = bill.accountId;
        else from = bill.accountId;
      }
    }

    return {
      initialType: type,
      initialFromAccountId: from,
      initialToAccountId: to,
      initialCategory: category,
      initialDetails: {
        date: 'dueDate' in item ? item.dueDate : (item as RecurringTransaction).nextDueDate,
        amount: safeRound(Math.abs(item.amount), 2).toFixed(2),
        description: item.description,
        merchant: merchant || (item as any)?.merchant || '',
      },
    };
  }, [itemToPost]);


  const handleTransactionClick = useCallback((clickedTx: DisplayTransaction) => {
    if (clickedTx.isTransfer && clickedTx.transferId) {
      const pair = transferLookup.get(clickedTx.transferId) || [];
      setModalTransactions(pair);
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

  const handleDeleteTransaction = useCallback(async (tx: Transaction) => {
    const confirmed = await confirm({
      title: 'Delete Transaction?',
      message: `Are you sure you want to delete "${tx.description}"?`,
      confirmLabel: 'Delete',
      variant: 'danger',
      icon: 'delete',
    });
    if (!confirmed) return;

    deleteTransactions([tx.id]);
    setDetailModalOpen(false);
  }, [confirm, deleteTransactions]);

  const { filteredTransactions, income, expenses } = useMemo(() => {
    const cacheKey = `${transactionsKey}|${selectedAccountIds.join(',')}|${analyticsSelectedAccountIds.join(',')}|${duration}`;
    const cached = aggregateCacheRef.current.get(cacheKey);
    if (cached) return cached;

    const { start, end } = getDateRange(duration, analyticsTransactions);
    const txsInPeriod = analyticsTransactions.filter(tx => {
      const txDate = parseLocalDate(tx.date);
      return txDate >= start && txDate <= end;
    });

    const processedTransferIds = new Set<string>();
    let calculatedIncome = 0;
    let calculatedExpenses = 0;

    txsInPeriod.forEach(tx => {
      if (!analyticsSelectedAccountIds.includes(tx.accountId)) {
        return; // Skip transactions not in selected accounts for calculation.
      }

      const convertedAmount = convertToEur(tx.amount, tx.currency);

      if (tx.transferId) {
        if (processedTransferIds.has(tx.transferId)) return;

        const counterpart = transferLookup.get(tx.transferId)?.find(t => t.id !== tx.id);
        processedTransferIds.add(tx.transferId);

        if (counterpart) {
          const counterpartSelected = analyticsSelectedAccountIds.includes(counterpart.accountId);

          // If counterpart is NOT selected, this is a real in/outflow for the selected group.
          if (!counterpartSelected) {
            if (preferences.excludeTransfersFromAnalytics) return;

            if (tx.type === 'income') {
              calculatedIncome += convertedAmount;
            } else {
              calculatedExpenses += Math.abs(convertedAmount);
            }
          }
        } else { // Orphaned transfer part, treat as regular transaction.
          if (tx.type === 'income') calculatedIncome += convertedAmount;
          else calculatedExpenses += Math.abs(convertedAmount);
        }
      } else { // Regular transaction.
        if (tx.type === 'income') calculatedIncome += convertedAmount;
        else calculatedExpenses += Math.abs(convertedAmount);
      }
    });

    const result = {
      filteredTransactions: txsInPeriod.filter(tx => analyticsSelectedAccountIds.includes(tx.accountId)),
      income: safeRound(calculatedIncome, 2),
      expenses: safeRound(calculatedExpenses, 2),
    };
    cacheAggregateResult(cacheKey, result);
    return result;
  }, [aggregateCacheRef, analyticsSelectedAccountIds, analyticsTransactions, cacheAggregateResult, duration, selectedAccountIds, transactionsKey, transferLookup]);

  const enrichedTransactions: EnrichedTransaction[] = useMemo(
    () =>
      filteredTransactions.map(tx => ({
        ...tx,
        convertedAmount: convertToEur(tx.amount, tx.currency),
        parsedDate: parseLocalDate(tx.date),
      })),
    [filteredTransactions]
  );

  const { incomeChange, expenseChange } = useMemo(() => {
    const { start, end } = getDateRange(duration, transactions);
    const diff = end.getTime() - start.getTime();

    if (duration === 'ALL' || diff <= 0) {
      return { incomeChange: null, expenseChange: null };
    }

    const prevStart = new Date(start.getTime() - diff);
    const prevEnd = new Date(start.getTime() - 1);

    const txsInPrevPeriod = transactions.filter(tx => {
      const txDate = parseLocalDate(tx.date);
      return txDate >= prevStart && txDate <= prevEnd;
    });

    let prevIncome = 0;
    let prevExpenses = 0;

    const processedTransferIds = new Set<string>();
    txsInPrevPeriod.forEach(tx => {
      if (!analyticsSelectedAccountIds.includes(tx.accountId)) return;

      const convertedAmount = convertToEur(tx.amount, tx.currency);

      if (tx.transferId) {
        if (processedTransferIds.has(tx.transferId)) return;
        const counterpart = transferLookup.get(tx.transferId)?.find(t => t.id !== tx.id);
        processedTransferIds.add(tx.transferId);
        if (counterpart && !analyticsSelectedAccountIds.includes(counterpart.accountId)) {
          if (preferences.excludeTransfersFromAnalytics) return;
          if (tx.type === 'income') prevIncome += convertedAmount;
          else prevExpenses += Math.abs(convertedAmount);
        }
      } else {
        if (tx.type === 'income') prevIncome += convertedAmount;
        else prevExpenses += Math.abs(convertedAmount);
      }
    });

    const calculateChangeString = (current: number, previous: number) => {
      if (previous === 0) {
        return null;
      }
      const change = ((current - previous) / previous) * 100;
      if (isNaN(change) || !isFinite(change)) return null;

      return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
    };

    return {
      incomeChange: calculateChangeString(income, safeRound(prevIncome, 2)),
      expenseChange: calculateChangeString(expenses, safeRound(prevExpenses, 2)),
    };
  }, [duration, transactions, analyticsSelectedAccountIds, income, expenses, transferLookup]);

  const outflowsByCategory: CategorySpending[] = useMemo(() => {
    const spending: { [key: string]: CategorySpending } = {};
    const expenseCats = expenseCategories;
    const processedTransferIds = new Set<string>();

    enrichedTransactions.forEach(tx => {
      if (tx.type !== 'expense') return;

      const convertedAmount = tx.convertedAmount;

      if (tx.transferId) {
        if (processedTransferIds.has(tx.transferId)) return;

        const counterpart = transferLookup.get(tx.transferId)?.find(t => t.id !== tx.id);
        processedTransferIds.add(tx.transferId);

        // This is an outflow only if its counterpart is NOT selected.
        if (counterpart && !analyticsSelectedAccountIds.includes(counterpart.accountId)) {
          if (preferences.excludeTransfersFromAnalytics) return;

          const name = `Transfer to ${accountLookup.get(counterpart.accountId)?.name || 'Unknown'}`;
          if (!spending[name]) {
            spending[name] = { name, value: 0, color: '#A0AEC0', icon: 'arrow_upward' };
          }
          spending[name].value += Math.abs(convertedAmount);
        }
      } else {
        const category = findCategoryDetails(tx.category, expenseCats);
        let parentCategory = category;
        if (category?.parentId) {
          parentCategory = findCategoryById(category.parentId, expenseCats) || category;
        }
        const name = parentCategory?.name || 'Uncategorized';
        if (!spending[name]) {
          spending[name] = { name, value: 0, color: parentCategory?.color || '#A0AEC0', icon: parentCategory?.icon };
        }
        spending[name].value += Math.abs(convertedAmount);
      }
    });

    return Object.values(spending).sort((a: CategorySpending, b: CategorySpending) => b.value - a.value);
  }, [enrichedTransactions, analyticsSelectedAccountIds, expenseCategories, transferLookup, preferences.excludeTransfersFromAnalytics, accountLookup]);

  const handleCategoryClick = useCallback((categoryName: string) => {
    const expenseCats = expenseCategories;
    const txs = filteredTransactions.filter(tx => {
      if (categoryName.startsWith('Transfer to ')) {
        if (!tx.transferId || tx.type !== 'expense') return false;
        const counterpart = transferLookup.get(tx.transferId)?.find(t => t.id !== tx.id);
        if (!counterpart) return false;

        const destName = `Transfer to ${accountLookup.get(counterpart.accountId)?.name || 'Unknown'}`;
        return destName === categoryName && !analyticsSelectedAccountIds.includes(counterpart.accountId);
      }

      const category = findCategoryDetails(tx.category, expenseCats);
      let parentCategory = category;
      if (category?.parentId) {
        parentCategory = findCategoryById(category.parentId, expenseCats) || category;
      }
      return parentCategory?.name === categoryName && tx.type === 'expense' && !tx.transferId;
    });
    setModalTransactions(txs);
    setModalTitle(`Transactions for ${categoryName}`);
    setDetailModalOpen(true);
  }, [filteredTransactions, analyticsSelectedAccountIds, expenseCategories, transferLookup, accountLookup]);

  const accountMap = useMemo(() => accounts.reduce((map, acc) => { map[acc.id] = acc.name; return map; }, {} as Record<string, string>), [accounts]);

  const recentTransactions = useMemo(() => {
    const sortedSourceTransactions = analyticsTransactions
      .filter(tx => analyticsSelectedAccountIds.includes(tx.accountId))
      .sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());

    const processedTransferIds = new Set<string>();
    const result: DisplayTransaction[] = [];

    for (const tx of sortedSourceTransactions) {
      if (result.length >= 10) break;

      if (tx.transferId) {
        if (processedTransferIds.has(tx.transferId)) continue;

        const pair = transferLookup.get(tx.transferId)?.find(t => t.id !== tx.id);
        processedTransferIds.add(tx.transferId);

        if (pair) {
          const expensePart = tx.amount < 0 ? tx : pair;
          const incomePart = tx.amount > 0 ? tx : pair;
          result.push({
            ...expensePart,
            id: `transfer-${expensePart.transferId}`,
            originalId: expensePart.id,
            amount: Math.abs(expensePart.amount),
            isTransfer: true,
            type: 'expense', // for consistency
            fromAccountName: accountMap[expensePart.accountId] || 'Unknown',
            toAccountName: accountMap[incomePart.accountId] || 'Unknown',
            category: 'Transfer',
          });
        } else { // Orphaned transfer
          result.push({ ...tx, accountName: accountMap[tx.accountId] });
        }
      } else { // Regular transaction
        result.push({ ...tx, accountName: accountMap[tx.accountId] });
      }
    }
    return result;
  }, [analyticsTransactions, analyticsSelectedAccountIds, accountMap, transferLookup]);

  const { incomeSparkline, expenseSparkline } = useMemo(() => {
    const NUM_POINTS = 90;
    const { start, end } = getDateRange(duration, transactions);
    const timeRange = end.getTime() - start.getTime();
    const interval = timeRange / NUM_POINTS;

    const incomeBuckets = Array(NUM_POINTS).fill(0);
    const expenseBuckets = Array(NUM_POINTS).fill(0);

    const relevantTxs = enrichedTransactions.filter(tx => !tx.transferId);

    for (const tx of relevantTxs) {
      const txTime = tx.parsedDate.getTime();
      const index = Math.floor((txTime - start.getTime()) / interval);
      const convertedAmount = tx.convertedAmount;
      if (index >= 0 && index < NUM_POINTS) {
        if (tx.type === 'income') {
          incomeBuckets[index] += convertedAmount;
        } else {
          expenseBuckets[index] += Math.abs(convertedAmount);
        }
      }
    }

    return {
      incomeSparkline: incomeBuckets.map(value => ({ value })),
      expenseSparkline: expenseBuckets.map(value => ({ value }))
    };

  }, [enrichedTransactions, duration, transactions]);


  const colorClassToHex: { [key: string]: string } = {
    'text-blue-500': '#3b82f6',
    'text-green-500': '#22c55e',
    'text-orange-500': '#f97316',
    'text-purple-500': '#8b5cf6',
    'text-red-500': '#ef4444',
    'text-teal-500': '#14b8a6',
    'text-yellow-500': '#eab308',
    'text-cyan-500': '#06b6d4',
    'text-lime-500': '#84cc16',
    'text-pink-500': '#ec4899',
    'text-amber-500': '#f59e0b',
    'text-indigo-500': '#6366f1',
    'text-lime-600': '#65a30d',
    'text-slate-500': '#64748b'
  };

  const createBreakdown = (accs: Account[]) => {
    const grouped = accs.reduce((acc, account) => {
      const group = acc[account.type] || { value: 0, color: '#A0AEC0' };
      let style;
      if (account.type === 'Investment' && account.subType) {
        style = INVESTMENT_SUB_TYPE_STYLES[account.subType];
      } else {
        style = ACCOUNT_TYPE_STYLES[account.type];
      }

      if (style) {
        group.color = colorClassToHex[style.color] || '#A0AEC0';
      }
      group.value += convertToEur(account.balance, account.currency);
      acc[account.type] = group;
      return acc;
    }, {} as Record<string, { value: number, color: string }>);

    return Object.entries(grouped).map(([name, data]) => ({ name, value: Math.abs(data.value), color: data.color })).filter(item => item.value > 0).sort((a, b) => b.value - a.value);
  };

  const { totalAssets, totalDebt, netWorth } = useMemo(() => {
    const safeAccounts = analyticsSelectedAccounts || [];

    const { totalAssets, totalDebt, netWorth } = calculateAccountTotals(safeAccounts, analyticsTransactions, loanPaymentOverrides);

    return {
      totalAssets,
      totalDebt,
      netWorth,
    };
  }, [analyticsSelectedAccounts, analyticsTransactions, loanPaymentOverrides]);

  const { globalTotalAssets, globalTotalDebt, globalAssetBreakdown, globalDebtBreakdown, assetGroups, liabilityGroups } = useMemo(() => {
    const openAccounts = analyticsAccounts.filter(acc => acc.status !== 'closed');
    const { totalAssets, totalDebt } = calculateAccountTotals(openAccounts, analyticsTransactions, loanPaymentOverrides);

    // Group accounts for the detailed breakdown
    const assetGroups: Record<string, { types: AccountType[], value: number, color: string, icon: string }> = {
      'Liquid Cash': { types: ['Checking', 'Savings'], value: 0, color: '#3B82F6', icon: 'wallet' }, // Blue
      'Investments': { types: ['Investment'], value: 0, color: '#8B5CF6', icon: 'candlestick_chart' }, // Purple
      'Properties': { types: ['Property'], value: 0, color: '#10B981', icon: 'home' }, // Emerald
      'Vehicles': { types: ['Vehicle'], value: 0, color: '#F59E0B', icon: 'directions_car' }, // Amber
      'Other Assets': { types: ['Other Assets', 'Lending'], value: 0, color: '#64748B', icon: 'Box' }, // Slate
    };

    const liabilityGroups: Record<string, { types: AccountType[], value: number, color: string, icon: string }> = {
      'Loans': { types: ['Loan'], value: 0, color: '#EF4444', icon: 'receipt_check' }, // Red
      'Credit Cards': { types: ['Credit Card'], value: 0, color: '#F43F5E', icon: 'credit_card' }, // Rose
      'Other Liabilities': { types: ['Other Liabilities'], value: 0, color: '#94A3B8', icon: 'receipt' }, // Gray
    };

    // Helper to sum a group
    const calculateGroupTotal = (types: AccountType[]) => {
      const groupAccounts = openAccounts.filter(acc => types.includes(acc.type));
      const { totalAssets, totalDebt } = calculateAccountTotals(groupAccounts, analyticsTransactions, loanPaymentOverrides);
      return safeRound(totalAssets + totalDebt, 2); // One will be 0 typically, except for mixed types which we don't have here
    };

    for (const groupName in assetGroups) {
      assetGroups[groupName].value = calculateGroupTotal(assetGroups[groupName].types);
    }
    for (const groupName in liabilityGroups) {
      // Liabilities return positive totalDebt from calculateAccountTotals
      const groupAccounts = openAccounts.filter(acc => liabilityGroups[groupName].types.includes(acc.type));
      const { totalDebt } = calculateAccountTotals(groupAccounts, analyticsTransactions, loanPaymentOverrides);
      liabilityGroups[groupName].value = safeRound(totalDebt, 2);
    }

    return {
      globalTotalAssets: totalAssets,
      globalTotalDebt: totalDebt,
      globalAssetBreakdown: createBreakdown(openAccounts.filter(acc => ASSET_TYPES.includes(acc.type))),
      globalDebtBreakdown: createBreakdown(openAccounts.filter(acc => DEBT_TYPES.includes(acc.type))),
      assetGroups,
      liabilityGroups
    };
  }, [analyticsAccounts, analyticsTransactions, loanPaymentOverrides]);

  const assetAllocationData: { name: string; value: number; color: string }[] = useMemo(() => {
    // Explicitly type the groups to avoid implicit any errors
    const groups = assetGroups as Record<string, AssetGroup>;
    const data = [
      { name: 'Liquid Cash', value: groups?.['Liquid Cash']?.value || 0, color: groups?.['Liquid Cash']?.color || '#A0AEC0' },
      { name: 'Investments', value: groups?.['Investments']?.value || 0, color: groups?.['Investments']?.color || '#A0AEC0' },
      { name: 'Properties', value: groups?.['Properties']?.value || 0, color: groups?.['Properties']?.color || '#A0AEC0' },
      { name: 'Vehicles', value: groups?.['Vehicles']?.value || 0, color: groups?.['Vehicles']?.color || '#A0AEC0' },
      { name: 'Other Assets', value: groups?.['Other Assets']?.value || 0, color: groups?.['Other Assets']?.color || '#A0AEC0' }
    ];
    return data.filter(d => d.value > 0).sort((a, b) => b.value - a.value);
  }, [assetGroups]);

  const netWorthData = useMemo(() => {
    const transferGroups = new Map<string, Transaction[]>();
    transactions.forEach(tx => {
      if (!tx.transferId) return;
      const group = transferGroups.get(tx.transferId) || [];
      group.push(tx);
      transferGroups.set(tx.transferId, group);
    });

    const internalTransferIds = new Set<string>();
    transferGroups.forEach((group, transferId) => {
      if (group.length === 0) return;
      const allAccountsSelected = group.every(tx => analyticsSelectedAccountIds.includes(tx.accountId));
      if (allAccountsSelected) {
        internalTransferIds.add(transferId);
      }
    });

    const { start, end } = getDateRange(duration, transactions);

    if (duration === 'ALL') {
      const fiveYearsAgo = new Date(end);
      fiveYearsAgo.setFullYear(end.getFullYear() - 5);
      if (start < fiveYearsAgo) {
        start.setTime(fiveYearsAgo.getTime());
      }
    }

    const currentNetWorth = netWorth;
    const today = parseLocalDate(toLocalISOString(new Date()));

    const transactionsToReverse = transactions.filter(tx => {
      if (!analyticsSelectedAccountIds.includes(tx.accountId)) return false;
      if (tx.transferId && internalTransferIds.has(tx.transferId)) return false;
      const txDate = parseLocalDate(tx.date);
      return txDate >= start && txDate <= today;
    });

    const totalChangeSinceStart = transactionsToReverse.reduce((sum, tx) => {
      const signedAmount = tx.type === 'expense'
        ? -Math.abs(convertToEur(tx.amount, tx.currency))
        : Math.abs(convertToEur(tx.amount, tx.currency));

      return sum + signedAmount;
    }, 0);

    const startingNetWorth = currentNetWorth - totalChangeSinceStart;

    const transactionsInPeriod = transactions.filter(tx => {
      if (!analyticsSelectedAccountIds.includes(tx.accountId)) return false;
      if (tx.transferId && internalTransferIds.has(tx.transferId)) return false;
      const txDate = parseLocalDate(tx.date);
      return txDate >= start && txDate <= end;
    });

    const dailyChanges = new Map<string, number>();
    for (const tx of transactionsInPeriod) {
      const dateStr = formatDateKey(parseLocalDate(tx.date));
      const signedAmount = tx.type === 'expense'
        ? -Math.abs(convertToEur(tx.amount, tx.currency))
        : Math.abs(convertToEur(tx.amount, tx.currency));

      dailyChanges.set(dateStr, (dailyChanges.get(dateStr) || 0) + signedAmount);
    }

    const data: { name: string, value?: number, forecast?: number }[] = [];
    let runningBalance = startingNetWorth;

    let currentDate = new Date(start);

    while (currentDate <= end) {
      const dateStr = formatDateKey(currentDate);
      runningBalance += dailyChanges.get(dateStr) || 0;
      data.push({ name: dateStr, value: parseFloat(runningBalance.toFixed(2)) });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const todayStr = formatDateKey(today);
    const todayDataPoint = data.find(d => d.name === todayStr);
    if (todayDataPoint) {
      todayDataPoint.value = parseFloat(currentNetWorth.toFixed(2));
    }

    // --- INTEGRATE FORECAST DATA ---
    if (showForecast && forecastChartData && forecastChartData.length > 0) {
      const currentForecastBase = forecastChartData[0].value;
      const currentNetWorthVal = currentNetWorth;

      // Find today's index in history data to connect lines
      const todayIndex = data.findIndex(d => d.name === todayStr);

      if (todayIndex !== -1) {
        // Set the 'forecast' value for today to match 'value' so lines connect
        data[todayIndex].forecast = data[todayIndex].value;

        // Append future points
        forecastChartData.forEach(point => {
          if (point.date > todayStr) {
            // Calculate relative change from forecast engine and apply to current Net Worth
            const predictedChange = point.value - currentForecastBase;
            const projectedNetWorth = currentNetWorthVal + predictedChange;

            data.push({
              name: point.date,
              value: undefined, // No actual value for future
              forecast: parseFloat(projectedNetWorth.toFixed(2))
            });
          }
        });
      }
    }

    return data;
  }, [duration, transactions, analyticsSelectedAccountIds, netWorth, forecastChartData, showForecast]);

  const netWorthTrendColor = useMemo(() => {
    // Check trend based on historical data only
    const historyPoints = netWorthData.filter(d => d.value !== undefined);
    if (historyPoints.length < 2) return '#6366F1';
    const startValue = historyPoints[0].value!;
    const endValue = historyPoints[historyPoints.length - 1].value!;
    return endValue >= startValue ? '#34C759' : '#FF3B30';
  }, [netWorthData]);

  const configuredCreditCards = useMemo(() => {
    return accounts.filter(acc => {
      const isConfiguredCC = acc.type === 'Credit Card' && acc.statementStartDate && acc.paymentDate;
      if (!isConfiguredCC) return false;

      if (selectedAccountIds.includes(acc.id)) return true;

      if (acc.settlementAccountId && selectedAccountIds.includes(acc.settlementAccountId)) return true;

      return false;
    });
  }, [accounts, selectedAccountIds]);

  const creditCardStatements = useMemo(() => {
    if (configuredCreditCards.length === 0) return [];

    return configuredCreditCards.map(account => {
      const periods = calculateStatementPeriods(account.statementStartDate!, account.paymentDate!);

      const { statementBalance: prevBalance, amountPaid: prevAmountPaid } = getCreditCardStatementDetails(account, periods.previous.start, periods.previous.end, transactions);
      const { statementBalance: currentBalance, amountPaid: currentAmountPaid } = getCreditCardStatementDetails(account, periods.current.start, periods.current.end, transactions);
      const { statementBalance: futureBalance, amountPaid: futureAmountPaid } = getCreditCardStatementDetails(account, periods.future.start, periods.future.end, transactions);

      const timeZone = getPreferredTimeZone();
      const formatDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone });
      const formatFullDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone });

      return {
        accountId: account.id,
        accountName: account.name,
        currency: account.currency,
        accountBalance: account.balance,
        creditLimit: account.creditLimit,
        cardNetwork: account.cardNetwork,
        financialInstitution: account.financialInstitution,
        current: {
          balance: currentBalance,
          amountPaid: currentAmountPaid,
          previousStatementBalance: prevBalance,
          period: `${formatDate(periods.current.start)} - ${formatDate(periods.current.end)}`,
          paymentDue: formatFullDate(periods.current.paymentDue)
        },
        future: {
          balance: futureBalance,
          amountPaid: futureAmountPaid,
          period: `${formatDate(periods.future.start)} - ${formatDate(periods.future.end)}`,
          paymentDue: formatFullDate(periods.future.paymentDue)
        }
      };
    });
  }, [configuredCreditCards, transactions]);

  const handleBudgetClick = useCallback(() => {
    if (typeof window === 'undefined') return;
    const targetPath = '/budget';
    window.history.pushState(null, '', targetPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  const { liquidityRatio, savingsRate } = useMemo(() => {
    const openAccounts = analyticsAccounts.filter(acc => acc.status !== 'closed');
    const liquidCash = openAccounts.filter(acc => LIQUID_ACCOUNT_TYPES.includes(acc.type))
      .reduce((sum, acc) => sum + convertToEur(acc.balance, acc.currency), 0);

    const threeMonthsAgo = new Date(); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const expenseTxs = analyticsTransactions.filter(t => {
      const d = parseLocalDate(t.date);
      return d >= threeMonthsAgo && t.type === 'expense' && !t.transferId;
    });
    const totalSpend = expenseTxs.reduce((sum, tx) => sum + Math.abs(convertToEur(tx.amount, tx.currency)), 0);
    const avgMonthlySpend = totalSpend / 3;

    const liquidityRatio = avgMonthlySpend > 0 ? (liquidCash / avgMonthlySpend) : 0;

    let totalIncomePeriod = 0;
    let totalExpensePeriod = 0;
    const { start, end } = getDateRange(duration, analyticsTransactions);
    const periodTxs = analyticsTransactions.filter(t => {
      const d = parseLocalDate(t.date);
      return d >= start && d <= end && !t.transferId;
    });
    periodTxs.forEach(tx => {
      const val = convertToEur(tx.amount, tx.currency);
      if (tx.type === 'income') totalIncomePeriod += val;
      else totalExpensePeriod += Math.abs(val);
    });
    const netFlowPeriod = totalIncomePeriod - totalExpensePeriod;
    const savingsRate = totalIncomePeriod > 0 ? (netFlowPeriod / totalIncomePeriod) * 100 : 0;

    return { liquidityRatio, savingsRate };

  }, [analyticsAccounts, analyticsTransactions, duration]);

  const eurToDisplay = useCallback((eur: number) => convertCurrency(eur, 'EUR', preferredCurrency, conversionRates), [preferredCurrency, conversionRates]);
  const toPreferred = useCallback((amount: number, from: Currency) => convertCurrency(amount, from, preferredCurrency, conversionRates), [preferredCurrency, conversionRates]);

  const setCushion = useCallback((amount: number) => {
    setPreferences(prev => ({ ...prev, safeToSpendCushion: amount }));
  }, [setPreferences]);

  const safeToSpend = useMemo(() => computeSafeToSpend({
    accounts,
    transactions,
    recurringItems: allRecurringItems,
    bills: billsAndPayments,
    overrides: recurringTransactionOverrides,
    cushion: preferences.safeToSpendCushion ?? 0,
  }), [accounts, transactions, allRecurringItems, billsAndPayments, recurringTransactionOverrides, preferences.safeToSpendCushion]);

  const keyRatios = useMemo(() => {
    const { totalAssets: assets, totalDebt: debt } = calculateAccountTotals(analyticsAccounts, analyticsTransactions);
    return [
      { label: 'Liquidity', value: `${liquidityRatio.toFixed(1)} months`, context: 'Runway at your average spend' },
      { label: 'Savings rate', value: `${savingsRate.toFixed(0)}%`, context: 'Of income this period' },
      { label: 'Debt ratio', value: `${(assets > 0 ? (Math.abs(debt) / assets) * 100 : 0).toFixed(1)}%`, context: 'Debts against assets' },
      { label: 'Net flow', value: <Amount value={eurToDisplay(safeRound(income - expenses, 2))} currency={preferredCurrency} tone="flow" />, context: 'Income less spending this period' },
    ];
  }, [analyticsAccounts, analyticsTransactions, liquidityRatio, savingsRate, income, expenses, eurToDisplay, preferredCurrency]);

  // --- Widget Management ---
  const allWidgets: Widget[] = useMemo(() => [
    {
      id: 'financialOverview',
      name: 'Financial Overview',
      icon: 'Activity',
      description: 'Key performance indicators',
      defaultW: 6,
      defaultH: 2,
      component: FinancialOverview,
      props: {
        netWorth,
        income,
        expenses,
        incomeChange,
        expenseChange,
        incomeSparkline,
        expenseSparkline,
        currency: 'EUR'
      }
    },
    {
      id: 'safeToSpend',
      name: 'Safe to spend',
      description: 'What is left until your next income',
      defaultW: 2,
      defaultH: 3,
      component: SafeToSpendWidget,
      props: { data: safeToSpend, currency: preferredCurrency, toDisplay: eurToDisplay, countUp: isFirstVisit, onCushionChange: setCushion }
    },
    {
      id: 'accountsSummary',
      name: 'Accounts',
      description: 'Your biggest accounts',
      defaultW: 2,
      defaultH: 4,
      component: AccountsSummary,
      props: { accounts: selectedAccounts, toDisplay: toPreferred, currency: preferredCurrency, onOpen: onOpenAccount, onAll: () => setCurrentPage('Accounts') }
    },
    {
      id: 'overviewKpis',
      name: 'Key ratios',
      description: 'Liquidity, savings, debt and net flow',
      defaultW: 6,
      defaultH: 2,
      component: KeyRatios,
      props: { items: keyRatios }
    },
    {
      id: 'assetAllocation',
      name: 'Asset allocation',
      description: 'Assets and debts by group',
      defaultW: 6,
      defaultH: 7,
      component: AssetAllocationWidget,
      props: { allocation: assetAllocationData, assetGroups, liabilityGroups, totalAssets: globalTotalAssets, totalDebt: globalTotalDebt, currency: preferredCurrency, toDisplay: eurToDisplay }
    },
    {
      id: 'todayWidget',
      name: 'Today\'s Agenda',
      icon: 'calendar_check',
      description: 'Upcoming tasks and payments',
      defaultW: 6,
      defaultH: 2,
      component: TodayWidget,
      props: {
        tasks: tasks,
        recurringTransactions: allRecurringItems,
        bills: billsAndPayments,
        goals: financialGoals,
        overrides: recurringTransactionOverrides,
        onTaskUpdate: saveTask,
        onProcessItem: handleProcessItem
      }
    },
    {
      id: 'forecastHorizon',
      name: 'Forecast Horizon',
      icon: 'fast_forward',
      description: 'Projected liquidity trends',
      defaultW: 6,
      defaultH: 2,
      component: ForecastOverview,
      props: { forecasts: lowestBalanceForecasts, currency: preferredCurrency, noCard: true }
    },
    {
      id: 'creditCardStatements',
      name: 'Credit Card Statements',
      icon: 'credit_card',
      description: 'Recent and upcoming bills',
      defaultW: 6,
      defaultH: 2,
      component: CreditCardStatementsWidget,
      props: { statements: creditCardStatements }
    },
    // Updated props for Net Worth chart to support toggles
    {
      id: 'netWorthOverTime',
      name: 'Net Worth Over Time',
      icon: 'trending_up',
      description: 'Historical wealth progression',
      defaultW: 12,
      defaultH: 2,
      component: NetWorthChart,
      props: {
        data: netWorthData,
        lineColor: netWorthTrendColor,
        showForecast,
        showGoals,
        // Filter goals to only show those attached to selected accounts OR unlinked goals (which are global)
        goals: financialGoals.filter(g => g.date && (!g.paymentAccountId || selectedAccountIds.includes(g.paymentAccountId)))
      }
    },
    // Removed forecastChart
    { id: 'outflowsByCategory', name: 'Outflows by Category', icon: 'pie_chart', description: 'Spending distribution', defaultW: 6, defaultH: 2, component: OutflowsChart, props: { data: outflowsByCategory, onCategoryClick: handleCategoryClick } },
    { id: 'netWorthBreakdown', name: 'Net Worth Breakdown', icon: 'circle_cut', description: 'Assets vs Liabilities', defaultW: 6, defaultH: 2, component: AssetDebtDonutChart, props: { assets: totalAssets, debt: totalDebt } },
    { id: 'recentActivity', name: 'Recent Activity', icon: 'rows', description: 'Latest transactions', defaultW: 12, defaultH: 3, component: TransactionList, props: { transactions: recentTransactions, allCategories: allCategories, onTransactionClick: handleTransactionClick, maxItems: 15 } },
    { id: 'assetBreakdown', name: 'Asset Breakdown', icon: 'account_balance', description: 'Categorized asset values', defaultW: 6, defaultH: 2, component: AccountBreakdownCard, props: { title: 'Assets', totalValue: globalTotalAssets, breakdownData: globalAssetBreakdown } },
    { id: 'liabilityBreakdown', name: 'Liability Breakdown', icon: 'bank_note', description: 'Categorized debt values', defaultW: 6, defaultH: 2, component: AccountBreakdownCard, props: { title: 'Liabilities', totalValue: Math.abs(globalTotalDebt), breakdownData: globalDebtBreakdown } },
    { id: 'budgetOverview', name: 'Budget Overview', icon: 'sliders', description: 'Spending against limits', defaultW: 6, defaultH: 2, component: BudgetOverviewWidget, props: { budgets: budgets, transactions: transactions, expenseCategories: expenseCategories, accounts: accounts, duration: duration, onBudgetClick: handleBudgetClick } },
    { id: 'transactionMap', name: 'Transaction Map', icon: 'marker_pin', description: 'Geographic spend patterns', defaultW: 6, defaultH: 2, component: TransactionMapWidget, props: { transactions: filteredTransactions } },
    { id: 'cashflowSankey', name: 'Cash Flow Sankey', icon: 'git_branch', description: 'Money movement visualizer', defaultW: 12, defaultH: 2, component: CashflowSankey, props: { transactions: filteredTransactions, incomeCategories, expenseCategories } },

    // ANALYSIS WIDGETS
    { id: 'financialRunway', name: 'Financial Runway', icon: 'hourglass', description: 'Days until zero balance', defaultW: 6, defaultH: 2, component: FinancialRunwayWidget, props: { accounts, transactions: analyticsTransactions } },
    { id: 'merchantPareto', name: 'Merchant Pareto', icon: 'shopping_bag', description: 'Top spending destinations', defaultW: 6, defaultH: 2, component: MerchantParetoWidget, props: { transactions: analyticsTransactions } },
    { id: 'wealthVelocity', name: 'Wealth Velocity', icon: 'zap', description: 'Accumulation rate insights', defaultW: 6, defaultH: 2, component: WealthVelocityWidget, props: { transactions: analyticsTransactions, accounts } }
  ], [safeToSpend, eurToDisplay, toPreferred, isFirstVisit, setCushion, selectedAccounts, onOpenAccount, setCurrentPage, keyRatios, assetAllocationData, assetGroups, liabilityGroups, netWorth, income, expenses, incomeChange, expenseChange, incomeSparkline, expenseSparkline, tasks, allRecurringItems, billsAndPayments, financialGoals, recurringTransactionOverrides, saveTask, handleProcessItem, lowestBalanceForecasts, preferredCurrency, creditCardStatements, netWorthData, netWorthTrendColor, showForecast, showGoals, selectedAccountIds, outflowsByCategory, handleCategoryClick, totalAssets, totalDebt, recentTransactions, allCategories, handleTransactionClick, globalTotalAssets, globalAssetBreakdown, globalTotalDebt, globalDebtBreakdown, budgets, transactions, expenseCategories, accounts, duration, handleBudgetClick, filteredTransactions, incomeCategories, analyticsTransactions]);

  const layout = useMemo(() => resolveOverviewLayout(preferences, isMobile), [preferences.dashboardLayouts, preferences.dashboardHiddenWidgets, isMobile]);
  const layoutKey = isMobile ? OVERVIEW_PHONE_LAYOUT_KEY : OVERVIEW_LAYOUT_KEY;

  const saveLayout = useCallback((next: WidgetConfig[]) => {
    setPreferences(prev => ({ ...prev, dashboardLayouts: { ...(prev.dashboardLayouts || {}), [layoutKey]: next } }));
  }, [layoutKey, setPreferences]);

  const removeWidget = useCallback((widgetId: string) => {
    saveLayout(layout.filter(widget => widget.id !== widgetId));
  }, [layout, saveLayout]);

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
      .filter(widget => !shown.has(widget.id) && OVERVIEW_WIDGETS[widget.id])
      .map(widget => ({ ...widget, name: OVERVIEW_WIDGETS[widget.id].title }));
  }, [layout, allWidgets]);


  const filteredBillSuggestions = useMemo(() => {
    if (selectedAccountIds.length === 0) return billSuggestions;
    return billSuggestions.filter(s => selectedAccountIds.includes(s.transaction.accountId));
  }, [billSuggestions, selectedAccountIds]);

  const filteredTransferSuggestions = useMemo(() => {
    if (selectedAccountIds.length === 0) return suggestions;
    return suggestions.filter(s => selectedAccountIds.includes(s.expenseTx.accountId) || selectedAccountIds.includes(s.incomeTx.accountId));
  }, [suggestions, selectedAccountIds]);

  // Harmonize & deduplicate matches across both transfer and bill matchers
  const { dedupedTransferSuggestions, dedupedBillSuggestions } = useMemo(() => {
    // If a transaction appears in both transfer suggestions and bill suggestions,
    // assign it to whichever matcher produced the higher matchScore to avoid conflicting duplicate prompts.
    const billByTxId = new Map<string, SyncedBillMatchSuggestion>();
    filteredBillSuggestions.forEach(b => {
      billByTxId.set(b.transaction.id, b);
    });

    const suppressedTransferIds = new Set<string>();
    const suppressedBillIds = new Set<string>();

    filteredTransferSuggestions.forEach(t => {
      const expConflict = billByTxId.get(t.expenseTx.id);
      const incConflict = billByTxId.get(t.incomeTx.id);
      const conflict = expConflict || incConflict;

      if (conflict) {
        if (t.matchScore >= conflict.matchScore) {
          suppressedBillIds.add(conflict.id);
        } else {
          suppressedTransferIds.add(t.id);
        }
      }
    });

    return {
      dedupedTransferSuggestions: filteredTransferSuggestions.filter(s => !suppressedTransferIds.has(s.id)),
      dedupedBillSuggestions: filteredBillSuggestions.filter(b => !suppressedBillIds.has(b.id)),
    };
  }, [filteredTransferSuggestions, filteredBillSuggestions]);

  const totalPendingMatchesCount = dedupedTransferSuggestions.length + dedupedBillSuggestions.length;
  const { notificationCount: billsDue } = useBillNotifications({ recurringTransactions, billsAndPayments });

  const toCategorise = useMemo(
    () => analyticsTransactions.filter(tx => isUncategorised(tx) && analyticsSelectedAccountIds.includes(tx.accountId)).length,
    [analyticsTransactions, analyticsSelectedAccountIds]
  );

  const tasksDue = useMemo(() => {
    const today = toLocalISOString(new Date());
    return tasks.filter(task => task.status !== 'Done' && !!task.dueDate && task.dueDate <= today).length;
  }, [tasks]);

  const incomeYesterday = useMemo(() => {
    const day = new Date();
    day.setDate(day.getDate() - 1);
    const yesterday = toLocalISOString(day);
    return safeRound(analyticsTransactions
      .filter(tx => tx.date === yesterday && tx.type === 'income' && !tx.transferId && analyticsSelectedAccountIds.includes(tx.accountId))
      .reduce((sum, tx) => sum + convertToEur(tx.amount, tx.currency), 0), 2);
  }, [analyticsTransactions, analyticsSelectedAccountIds]);

  const openMatches = useCallback((filter: 'all' | 'transfer' | 'bill') => {
    setUnifiedModalInitialFilter(filter);
    setIsUnifiedPendingModalOpen(true);
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
      rows: meta.rows,
      render: size => (
        <WidgetErrorBoundary widgetTitle={meta.title}>
          <Suspense fallback={<Skeleton variant="card" />}>
            <Component {...widget.props} size={size} />
          </Suspense>
        </WidgetErrorBoundary>
      ),
    }];
  }), [layout, allWidgets, creditCardStatements.length]);

  const gridLayout = useMemo<WidgetLayoutItem[]>(() => layout.map(entry => ({ id: entry.id, span: entry.w })), [layout]);

  const handleGridChange = useCallback((next: WidgetLayoutItem[]) => {
    saveLayout(next.map((entry, index) => toConfig(entry.id, entry.span, index)));
  }, [saveLayout]);


  const highConfidencePendingCount = useMemo(() => {
    const highTransfers = dedupedTransferSuggestions.filter(s => s.matchScore >= 80).length;
    const highBills = dedupedBillSuggestions.filter(s => s.matchScore >= 80).length;
    return highTransfers + highBills;
  }, [dedupedTransferSuggestions, dedupedBillSuggestions]);

  const handleQuickReconcileHighConfidence = useCallback(() => {
    const highTransfers = dedupedTransferSuggestions.filter(s => s.matchScore >= 80);
    const highBills = dedupedBillSuggestions.filter(s => s.matchScore >= 80);
    if (highTransfers.length > 0) confirmSelectedMatches(highTransfers);
    if (highBills.length > 0) confirmSelectedBillMatches(highBills);
  }, [dedupedTransferSuggestions, dedupedBillSuggestions, confirmSelectedMatches, confirmSelectedBillMatches]);

  const handleDismissAllPending = useCallback(() => {
    dismissAllSuggestions();
    dismissAllBillMatches();
  }, [dismissAllSuggestions, dismissAllBillMatches]);

  return (
    <div className="relative">
      {isTransactionModalOpen && (
        <AddTransactionModal
          onClose={handleCloseTransactionModal}
          onSave={(data, toDelete) => {
            handleSavePostedTransaction(data, toDelete);
          }}
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
        onDelete={handleDeleteTransaction}
      />
      <AddWidgetModal isOpen={isAddWidgetModalOpen} onClose={() => setIsAddWidgetModalOpen(false)} availableWidgets={availableWidgetsToAdd} onAddWidget={addWidget} />
      {isUnifiedPendingModalOpen && (
        <UnifiedPendingMatchesModal
          isOpen={isUnifiedPendingModalOpen}
          onClose={() => setIsUnifiedPendingModalOpen(false)}
          transferSuggestions={dedupedTransferSuggestions}
          billSuggestions={dedupedBillSuggestions}
          accounts={analyticsAccounts}
          initialFilter={unifiedModalInitialFilter}
          onConfirmTransferMatch={confirmMatch}
          onDismissTransferMatch={dismissSuggestion}
          onConfirmSelectedTransferMatches={confirmSelectedMatches}
          onDismissSelectedTransferMatches={dismissSelectedMatches}
          onConfirmBillMatch={confirmBillMatch}
          onDismissBillMatch={dismissBillMatch}
          onConfirmSelectedBillMatches={confirmSelectedBillMatches}
          onDismissSelectedBillMatches={dismissSelectedBillMatches}
          onConfirmAll={() => {
            confirmAllMatches();
            confirmAllBillMatches();
          }}
          onDismissAll={handleDismissAllPending}
          onOpenFullPageTab={() => {
            setIsUnifiedPendingModalOpen(false);
            setMatchesPanelOpen(true);
          }}
        />
      )}

      {/* Forecast Interaction Modals */}
      {(isRecurringModalOpen || isBillModalOpen) && (
        <RecurringTransactionModal
          isOpen={isRecurringModalOpen || isBillModalOpen}
          onClose={() => {
            setIsRecurringModalOpen(false);
            setIsBillModalOpen(false);
            setEditingRecurring(null);
            setEditingBill(null);
          }}
          onSave={(data) => {
            saveRecurringTransaction(data);
            setIsRecurringModalOpen(false);
            setEditingRecurring(null);
          }}
          onSaveBill={(data) => {
            saveBillPayment(data);
            setIsBillModalOpen(false);
            setEditingBill(null);
          }}
          accounts={accounts}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          recurringTransactionToEdit={editingRecurring}
          billToEdit={editingBill}
          initialMode={isBillModalOpen ? 'one-time' : 'recurring'}
          initialDate={selectedForecastDate || undefined}
        />
      )}
      {isGoalModalOpen && (
        <GoalScenarioModal
          onClose={() => setIsGoalModalOpen(false)}
          onSave={(data) => {
            saveFinancialGoal(data);
            setIsGoalModalOpen(false);
          }}
          goalToEdit={editingGoal}
          financialGoals={financialGoals}
          accounts={accounts}
        />
      )}

      {selectedForecastDate && <ForecastDayModal isOpen={!!selectedForecastDate} onClose={() => setSelectedForecastDate(null)} date={selectedForecastDate} items={selectedDayItems} onEditItem={handleEditForecastItem} onAddTransaction={handleAddNewToDate} />}
      {editChoiceItem && <EditRecurrenceModal isOpen={!!editChoiceItem} onClose={() => setEditChoiceItem(null)} onEditSingle={handleEditSingle} onEditSeries={handleEditSeries} onEditFuture={handleEditFuture} />}
      {overrideModalItem && <RecurringOverrideModal item={overrideModalItem} recurringTransactionOverrides={recurringTransactionOverrides} onClose={() => setOverrideModalItem(null)} onSave={saveRecurringOverride} onDelete={deleteRecurringOverride} />}

      {(() => {
        const chartOptions = (
          <div className="flex flex-col gap-2">
            <Select label="Forecast period" options={FORECAST_DURATION_OPTIONS.map(option => ({ id: option.value, label: option.label }))} value={forecastDuration} onChange={id => setForecastDuration(id as ForecastDuration)} />
            <Switch isSelected={showForecast} onChange={setShowForecast}>Show forecast</Switch>
            <Switch isSelected={showGoals} onChange={setShowGoals}>Show goals</Switch>
          </div>
        );

        const page = (
          <div className="space-y-6">
            <h1 className="sr-only">Overview</h1>
            <WrittenSummary
              facts={summaryFacts}
              isPrivate={isPrivate}
              onFact={fact => {
                if (fact === 'bills') setCurrentPage('Schedule & Bills');
                else if (fact === 'tasks') setCurrentPage('Tasks');
                else if (fact === 'income' || toCategorise > 0) setCurrentPage('Transactions');
                else openMatches('all');
              }}
            />

            <div className={`grid gap-6 max-md:gap-4 lg:grid-cols-3 ${isFirstVisit ? 'crystal-stagger' : ''}`}>
              <div className="lg:col-span-2">
                <NetWorthHero
                  value={eurToDisplay(netWorth)}
                  change={netWorthChange === null ? null : eurToDisplay(netWorthChange)}
                  period={periodLabel}
                  parts={heroParts}
                  debts={eurToDisplay(Math.abs(totalDebt))}
                  currency={preferredCurrency}
                  countUp={isFirstVisit}
                  onOpen={() => setCurrentPage('Accounts')}
                />
              </div>
              <NeedsYou
                items={[
                  { id: 'categorise', label: 'To categorise', count: toCategorise, onOpen: () => setCurrentPage('Transactions') },
                  { id: 'transfers', label: 'Transfers to match', count: dedupedTransferSuggestions.length, onOpen: () => openMatches('transfer') },
                  { id: 'bill-matches', label: 'Bills to match', count: dedupedBillSuggestions.length, onOpen: () => openMatches('bill') },
                  { id: 'bills', label: 'Bills due soon', count: billsDue, onOpen: () => setCurrentPage('Schedule & Bills') },
                  { id: 'tasks', label: 'Tasks due', count: tasksDue, onOpen: () => setCurrentPage('Tasks') },
                ]}
                footer={totalPendingMatchesCount > 0 && (
                  <>
                    {highConfidencePendingCount > 0 && <Button size="sm" variant="soft" onPress={handleQuickReconcileHighConfidence}>Confirm {highConfidencePendingCount} likely</Button>}
                    <Button size="sm" variant="ghost" onPress={handleDismissAllPending}>Dismiss matches</Button>
                  </>
                )}
              />
            </div>

            <div className="relative z-30 flex flex-wrap items-center justify-between gap-2">
              {isMobile ? (
                <Popover
                  title="Filters"
                  trigger={
                    <AriaButton className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-bold text-ink">
                      <Icon name="filter_list" size={20} />
                      Filter
                    </AriaButton>
                  }
                >
                  <div className="flex flex-col gap-4">
                    <MultiSelect label="Accounts" options={accounts.map(account => ({ id: account.id, label: account.name }))} value={selectedAccountIds} onChange={setSelectedAccountIds} />
                    <Select label="Period" options={DURATION_OPTIONS.map(option => ({ id: option.value, label: option.label }))} value={duration} onChange={id => setDuration(id as Duration)} />
                    {chartOptions}
                  </div>
                </Popover>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <MultiAccountFilter accounts={accounts} selectedAccountIds={selectedAccountIds} setSelectedAccountIds={setSelectedAccountIds} />
                  <DurationFilter selectedDuration={duration} onDurationChange={setDuration} />
                  <Popover title="Chart options" trigger={<IconButton icon="tune" label="Chart options" />}>
                    <div className="w-64">{chartOptions}</div>
                  </Popover>
                </div>
              )}
              <div className="flex items-center gap-2">
                {isEditMode && <Button variant="secondary" icon="add" onPress={() => setIsAddWidgetModalOpen(true)}>Add widget</Button>}
                {isMobile
                  ? <Button variant="ghost" icon="tune" onPress={() => setPhoneEditOpen(true)}>Customise</Button>
                  : <Button variant={isEditMode ? 'primary' : 'ghost'} icon={isEditMode ? 'check' : 'tune'} onPress={() => setIsEditMode(!isEditMode)}>{isEditMode ? 'Done' : 'Customise'}</Button>}
              </div>
            </div>

            {isMobile ? (
              <div className="space-y-4">
                {gridItems.map(item => {
                  const height = OVERVIEW_WIDGETS[item.id].phoneHeight;
                  return (
                    <section key={item.id} aria-label={item.title} className="flex flex-col overflow-hidden rounded-[var(--radius-xl)] border border-line bg-surface p-5" style={{ height }}>
                      <h2 className="type-card-title mb-3 shrink-0 text-ink">{item.title}</h2>
                      <div className="min-h-0 flex-1">{item.render('m')}</div>
                    </section>
                  );
                })}
              </div>
            ) : (
              <WidgetGrid
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

        return isMobile && onSyncBanks ? <PullToRefresh onRefresh={async () => { await onSyncBanks(); }}>{page}</PullToRefresh> : page;
      })()}

      <BottomSheet
        isOpen={isPhoneEditOpen}
        onClose={() => setPhoneEditOpen(false)}
        title="Customise Overview"
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

      <FullPanel isOpen={isMatchesPanelOpen} onClose={() => setMatchesPanelOpen(false)} title="Pending matches">
        <PendingMatchesView
          billSuggestions={dedupedBillSuggestions}
          transferSuggestions={dedupedTransferSuggestions}
          accounts={analyticsAccounts}
          config={matcherConfig}
          onUpdateConfig={updateMatcherConfig}
          onResetConfig={resetMatcherConfig}
          onConfirmBillMatch={confirmBillMatch}
          onDismissBillMatch={dismissBillMatch}
          onConfirmSelectedBillMatches={confirmSelectedBillMatches}
          onDismissSelectedBillMatches={dismissSelectedBillMatches}
          onConfirmTransferMatch={confirmMatch}
          onDismissTransferMatch={dismissSuggestion}
          onConfirmSelectedTransferMatches={confirmSelectedMatches}
          onDismissSelectedTransferMatches={dismissSelectedMatches}
        />
      </FullPanel>

      <ConfirmDialog />
    </div>
  );
};

export default React.memo(Dashboard);
