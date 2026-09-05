import React, { useMemo, useState, useCallback, useEffect, useRef, Suspense, lazy } from 'react';
import { User, Transaction, Account, Category, Duration, CategorySpending, Widget, WidgetConfig, DisplayTransaction, FinancialGoal, RecurringTransaction, BillPayment, Tag, Budget, RecurringTransactionOverride, LoanPaymentOverrides, AccountType, Task, ForecastDuration, Currency, ScheduledItem } from '../types';
import { calculateForecastHorizon, formatCurrency, convertCurrency, convertToEur, generateBalanceForecast, generateSyntheticLoanPayments, generateSyntheticCreditCardPayments, parseLocalDate, getPreferredTimeZone, generateSyntheticPropertyTransactions, toLocalISOString, getDateRange, calculateAccountTotals, calculateStatementPeriods, getCreditCardStatementDetails, formatDateKey } from '../utils';
import AddTransactionModal from '../components/AddTransactionModal';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, LIQUID_ACCOUNT_TYPES, ASSET_TYPES, DEBT_TYPES, ACCOUNT_TYPE_STYLES, INVESTMENT_SUB_TYPE_STYLES, FORECAST_DURATION_OPTIONS, QUICK_CREATE_BUDGET_OPTIONS, CHECKBOX_STYLE, SELECT_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE } from '../constants';
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
import { useLocalStorage } from '../hooks/useLocalStorage';
import AddWidgetModal from '../components/AddWidgetModal';
import { useTransactionMatcher } from '../hooks/useTransactionMatcher';
import TransactionMatcherModal from '../components/TransactionMatcherModal';
import TransactionMatcherCard from '../components/TransactionMatcherCard';
import { useSyncedBillMatcher } from '../hooks/useSyncedBillMatcher';
import SyncedBillMatcherModal from '../components/SyncedBillMatcherModal';
import SyncedBillMatcherCard from '../components/SyncedBillMatcherCard';
import { useMatcherConfig } from '../hooks/useMatcherConfig';
import PendingMatchesView from '../components/PendingMatchesView';
import Card from '../components/Card';
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
import { MobileDashboardView } from '../components/MobileDashboardView';
import { useIsMobile } from '../hooks/useIsMobile';
import BudgetModal from '../components/BudgetModal';
import MultiSelectFilter from '../components/MultiSelectFilter';
import PageHeader from '../components/PageHeader';
import HeaderButton from '../components/HeaderButton';
import { Responsive, WidthProvider } from 'react-grid-layout';

const ResponsiveGridLayout = WidthProvider(Responsive);

// Analysis widgets
import MerchantParetoWidget from '../components/MerchantParetoWidget';
import FinancialRunwayWidget from '../components/FinancialRunwayWidget';
import WealthVelocityWidget from '../components/WealthVelocityWidget';

import WidgetErrorBoundary from '../components/WidgetErrorBoundary';
import Icon from '../components/ui/Icon';
import { BentoGrid, BentoCard } from '../components/ui/bento-grid';
import HeroMetricCard from '../components/ui/HeroMetricCard';
import MetricCardRow from '../components/ui/MetricCardRow';
import SegmentedControl from '../components/ui/SegmentedControl';

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
  onTogglePrivacyMode?: () => void;
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
type DashboardTab = 'overview' | 'analysis' | 'activity' | 'pending_matches';

const CreditCardStatementsWidget: React.FC<{ statements: any[] }> = ({ statements }) => {
  if (statements.length === 0) return null;
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-3">
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

const WIDGET_TABS: Record<DashboardTab, string[]> = {
  overview: ['financialOverview', 'todayWidget', 'netWorthOverTime', 'forecastHorizon', 'creditCardStatements'],
  analysis: ['budgetOverview', 'financialRunway', 'wealthVelocity'],
  activity: ['transactionMap', 'outflowsByCategory', 'netWorthBreakdown', 'recentActivity', 'cashflowSankey'],
  pending_matches: []
};


const Dashboard: React.FC<DashboardProps> = ({ user, tasks, saveTask, onTogglePrivacyMode, onSyncBanks, isSyncingBanks }) => {
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
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const isMobile = useIsMobile();

  // Touch Pull-to-Refresh
  const touchStartRef = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return;
    const touchEnd = e.changedTouches[0].clientY;
    const diff = touchEnd - touchStartRef.current;
    if (diff > 90 && onSyncBanks && !isSyncingBanks) {
      onSyncBanks();
    }
    touchStartRef.current = null;
  };

  const layoutKey = useMemo(() => `${activeTab}-${isMobile ? 'mobile' : 'pc'}`, [activeTab, isMobile]);

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
  const [isMatcherModalOpen, setIsMatcherModalOpen] = useState(false);
  const [isBillMatcherModalOpen, setIsBillMatcherModalOpen] = useState(false);

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
    const activeGoals = financialGoals.filter(g => activeGoalIds.includes(g.id));

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
        amount: String(Math.abs(item.amount)),
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
      income: calculatedIncome,
      expenses: calculatedExpenses,
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
      incomeChange: calculateChangeString(income, prevIncome),
      expenseChange: calculateChangeString(expenses, prevExpenses),
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
      return totalAssets + totalDebt; // One will be 0 typically, except for mixed types which we don't have here
    };

    for (const groupName in assetGroups) {
      assetGroups[groupName].value = calculateGroupTotal(assetGroups[groupName].types);
    }
    for (const groupName in liabilityGroups) {
      // Liabilities return positive totalDebt from calculateAccountTotals
      const groupAccounts = openAccounts.filter(acc => liabilityGroups[groupName].types.includes(acc.type));
      const { totalDebt } = calculateAccountTotals(groupAccounts, analyticsTransactions, loanPaymentOverrides);
      liabilityGroups[groupName].value = totalDebt;
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
  ], [netWorth, income, expenses, incomeChange, expenseChange, incomeSparkline, expenseSparkline, tasks, allRecurringItems, billsAndPayments, financialGoals, recurringTransactionOverrides, saveTask, handleProcessItem, lowestBalanceForecasts, preferredCurrency, creditCardStatements, netWorthData, netWorthTrendColor, showForecast, showGoals, selectedAccountIds, outflowsByCategory, handleCategoryClick, totalAssets, totalDebt, recentTransactions, allCategories, handleTransactionClick, globalTotalAssets, globalAssetBreakdown, globalTotalDebt, globalDebtBreakdown, budgets, transactions, expenseCategories, accounts, duration, handleBudgetClick, filteredTransactions, incomeCategories, analyticsTransactions]);

  const initialLayouts = useMemo(() => {
    return allWidgets.map((w, index) => ({
      id: w.id,
      title: w.name,
      x: (index % 2) * 6,
      y: Math.floor(index / 2) * 2,
      w: w.defaultW,
      h: w.defaultH
    }));
  }, [allWidgets]);

  const widgets = useMemo(() => {
    const rawWidgets = preferences.dashboardLayouts?.[layoutKey] ||
      preferences.dashboardLayouts?.[activeTab] || // Fallback to old layout for migration
      initialLayouts.filter(w => WIDGET_TABS[activeTab].includes(w.id));

    // Migration: Scale up old 4-column layout to 12-column layout
    // Heuristic: If every widget is within the old 4x4 coordinate space, assume it's an old legacy layout.
    if (rawWidgets.length > 0 && rawWidgets.every(w => w.w <= 4 && (w.x + w.w) <= 4)) {
      return rawWidgets.map(w => ({
        ...w,
        x: w.x * 3,
        w: w.w * 3
      }));
    }

    return rawWidgets;
  }, [preferences.dashboardLayouts, activeTab, initialLayouts]);

  const saveLayouts = useCallback((newWidgets: WidgetConfig[]) => {
    setPreferences(prev => ({
      ...prev,
      dashboardLayouts: {
        ...(prev.dashboardLayouts || {}),
        [layoutKey]: newWidgets
      }
    }));
  }, [layoutKey, setPreferences]);

  // Ensure activity dashboard always includes its required widgets (including Cash Flow Sankey)
  useEffect(() => {
    if (!widgets.length) return;

    const requiredWidgets = WIDGET_TABS[activeTab];
    const currentIds = new Set(widgets.map(w => w.id));
    const missing = requiredWidgets.filter(id => !currentIds.has(id));

    let newWidgets = widgets.filter(w => requiredWidgets.includes(w.id));
    let changed = false;

    if (newWidgets.length !== widgets.length) changed = true;

    // Net worth chart specifically needs more width to be readable in overview
    newWidgets = newWidgets.map(w => {
      if (activeTab === 'overview' && w.id === 'netWorthOverTime' && w.w < 6) {
        changed = true;
        return { ...w, w: 12 };
      }
      return w;
    });

    if (missing.length) {
      changed = true;
      const additions = missing
        .map((id, index) => {
          const widgetDef = allWidgets.find(w => w.id === id);
          const yOffset = Math.max(0, ...newWidgets.map(w => w.y + w.h));
          return widgetDef ? { id: widgetDef.id, title: widgetDef.name, x: (index % 2) * 6, y: yOffset + index, w: widgetDef.defaultW, h: widgetDef.defaultH } : null;
        })
        .filter(Boolean) as WidgetConfig[];
      newWidgets = [...newWidgets, ...additions];
    }

    if (changed) {
      saveLayouts(newWidgets);
    }
  }, [activeTab, allWidgets, widgets, saveLayouts]);


  const [currentBreakpoint, setCurrentBreakpoint] = useState<string>('lg');
  const GRID_COLS = useMemo(() => ({ lg: 12, md: 12, sm: 6, xs: 2, xxs: 1 }), []);

  const getBreakpointLayout = useCallback((bp: 'lg' | 'md' | 'sm' | 'xs' | 'xxs', baseWidgets: WidgetConfig[]) => {
    const saved = preferences.dashboardLayouts?.[`${activeTab}-${bp}`];
    if (saved && saved.length > 0) {
      return saved.map(w => ({
        i: w.id,
        x: w.x,
        y: w.y,
        w: w.w,
        h: w.h,
        isResizable: isEditMode
      }));
    }
    const maxCols = GRID_COLS[bp];
    return baseWidgets.map((w, idx) => {
      const colWidth = Math.min(w.w, maxCols);
      return {
        i: w.id,
        x: (idx * colWidth) % maxCols,
        y: Math.floor((idx * colWidth) / maxCols) * w.h,
        w: colWidth,
        h: w.h,
        isResizable: isEditMode
      };
    });
  }, [preferences.dashboardLayouts, activeTab, isEditMode, GRID_COLS]);

  const responsiveLayouts = useMemo(() => {
    const activeWidgets = widgets.filter(w => WIDGET_TABS[activeTab].includes(w.id));
    return {
      lg: getBreakpointLayout('lg', activeWidgets),
      md: getBreakpointLayout('md', activeWidgets),
      sm: getBreakpointLayout('sm', activeWidgets),
      xs: getBreakpointLayout('xs', activeWidgets),
      xxs: getBreakpointLayout('xxs', activeWidgets),
    };
  }, [getBreakpointLayout, widgets, activeTab]);

  const removeWidget = (widgetId: string) => {
    saveLayouts(widgets.filter(w => w.id !== widgetId));
  };

  const updateWidgetWidth = (widgetId: string, newWidth: number) => {
    saveLayouts(widgets.map(w => w.id === widgetId ? { ...w, w: newWidth } : w));
  };

  const addWidget = (widgetId: string) => {
    const widgetToAdd = allWidgets.find(w => w.id === widgetId);
    if (widgetToAdd) {
      const yOffset = Math.max(0, ...widgets.map(w => w.y + w.h));
      const newWidget = { id: widgetToAdd.id, title: widgetToAdd.name, x: 0, y: yOffset, w: widgetToAdd.defaultW, h: widgetToAdd.defaultH };
      saveLayouts([...widgets, newWidget]);
    }
    setIsAddWidgetModalOpen(false);
  };

  const handleLayoutChange = useCallback((currentLayout: any[]) => {
    if (!isEditMode) return;
    const bpKey = `${activeTab}-${currentBreakpoint}`;
    const updated = widgets.map(w => {
      const layoutItem = currentLayout.find(l => l.i === w.id);
      if (layoutItem) {
        return { ...w, x: layoutItem.x, y: layoutItem.y, w: layoutItem.w, h: layoutItem.h };
      }
      return w;
    });
    setPreferences(prev => ({
      ...prev,
      dashboardLayouts: {
        ...(prev.dashboardLayouts || {}),
        [bpKey]: updated,
        ...(currentBreakpoint === 'lg' ? { [layoutKey]: updated } : {})
      }
    }));
  }, [isEditMode, activeTab, currentBreakpoint, widgets, layoutKey, setPreferences]);

  const availableWidgetsToAdd = useMemo(() => {
    const currentWidgetIds = widgets.map(w => w.id);
    const allowedWidgets = WIDGET_TABS[activeTab];
    return allWidgets.filter(w => !currentWidgetIds.includes(w.id) && allowedWidgets.includes(w.id));
  }, [widgets, allWidgets, activeTab]);

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

  const allocationData: { name: string; value: number; color: string }[] = useMemo(() => {
    return budgets.map(b => {
      const cat = expenseCategories.find(c => c.name === b.categoryName);
      return {
        name: b.categoryName,
        value: b.amount,
        color: cat?.color || '#cbd5e1'
      };
    }).sort((a, b) => b.value - a.value);
  }, [budgets, expenseCategories]);

  const totalPendingMatchesCount = suggestions.length + billSuggestions.length;
  const tabs: DashboardTab[] = ['overview', 'analysis', 'activity', 'pending_matches'];

  const filteredBillSuggestions = useMemo(() => {
    if (selectedAccountIds.length === 0) return billSuggestions;
    return billSuggestions.filter(s => selectedAccountIds.includes(s.transaction.accountId));
  }, [billSuggestions, selectedAccountIds]);

  const filteredTransferSuggestions = useMemo(() => {
    if (selectedAccountIds.length === 0) return suggestions;
    return suggestions.filter(s => selectedAccountIds.includes(s.expenseTx.accountId) || selectedAccountIds.includes(s.incomeTx.accountId));
  }, [suggestions, selectedAccountIds]);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="space-y-6 pb-12 animate-fade-in-up relative z-0"
    >
      {/* ... existing modals */}
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
      {isMatcherModalOpen && (
        <TransactionMatcherModal
          isOpen={isMatcherModalOpen}
          onClose={() => setIsMatcherModalOpen(false)}
          suggestions={suggestions}
          accounts={accounts}
          onConfirmMatch={confirmMatch}
          onDismissSuggestion={dismissSuggestion}
          onConfirmAll={confirmAllMatches}
          onDismissAll={dismissAllSuggestions}
          onConfirmSelected={confirmSelectedMatches}
          onDismissSelected={dismissSelectedMatches}
        />
      )}
      {isBillMatcherModalOpen && (
        <SyncedBillMatcherModal
          isOpen={isBillMatcherModalOpen}
          onClose={() => setIsBillMatcherModalOpen(false)}
          suggestions={billSuggestions}
          accounts={accounts}
          onConfirmMatch={confirmBillMatch}
          onDismissSuggestion={dismissBillMatch}
          onConfirmAll={confirmAllBillMatches}
          onDismissAll={dismissAllBillMatches}
          onConfirmSelected={confirmSelectedBillMatches}
          onDismissSelected={dismissSelectedBillMatches}
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

      {isMobile ? (
        <MobileDashboardView
          userProfile={user}
          categories={allCategories}
          accounts={accounts}
          transactions={transactions}
          analyticsAccounts={analyticsAccounts}
          analyticsTransactions={analyticsTransactions}
          selectedAccountIds={selectedAccountIds}
          setSelectedAccountIds={setSelectedAccountIds}
          netWorthData={netWorthData}
          duration={duration}
          setDuration={setDuration}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabs={tabs}
          forecastDuration={forecastDuration}
          setForecastDuration={setForecastDuration}
          showForecast={showForecast}
          setShowForecast={setShowForecast}
          showGoals={showGoals}
          setShowGoals={setShowGoals}
          globalTotalAssets={globalTotalAssets}
          globalTotalDebt={globalTotalDebt}
          liquidityRatio={liquidityRatio}
          savingsRate={savingsRate}
          widgets={widgets}
          allWidgets={allWidgets}
          WIDGET_TABS={WIDGET_TABS}
          removeWidget={removeWidget}
          updateWidgetWidth={updateWidgetWidth}
          isEditMode={isEditMode}
          setIsEditMode={setIsEditMode}
          setIsAddWidgetModalOpen={setIsAddWidgetModalOpen}
          isPrivacyMode={!!preferences.isPrivacyMode}
          setIsPrivacyMode={(val) => {
            if (onTogglePrivacyMode) onTogglePrivacyMode();
            else setPreferences(prev => ({ ...prev, isPrivacyMode: val }));
          }}
          formatCurrency={formatCurrency}
          convertCurrency={convertCurrency}
          preferredCurrency={preferredCurrency}
          conversionRates={conversionRates}
          handleOpenTransactionModal={handleOpenTransactionModal}
          isSyncingBanks={isSyncingBanks}
          onSyncBanks={onSyncBanks}
          suggestions={suggestions}
          setIsMatcherModalOpen={setIsMatcherModalOpen}
          dismissAllSuggestions={dismissAllSuggestions}
          billSuggestions={billSuggestions}
          setIsBillMatcherModalOpen={setIsBillMatcherModalOpen}
          dismissAllBillMatches={dismissAllBillMatches}
          calculateAccountTotals={calculateAccountTotals}
          assetAllocationData={allocationData}
          assetGroups={assetGroups}
          liabilityGroups={liabilityGroups}
          FORECAST_DURATION_OPTIONS={FORECAST_DURATION_OPTIONS}
          SELECT_WRAPPER_STYLE={SELECT_WRAPPER_STYLE}
          SELECT_STYLE={SELECT_STYLE}
          SELECT_ARROW_STYLE={SELECT_ARROW_STYLE}
          brandfetchClientId={preferences.brandfetchClientId}
        />
      ) : (
        <div>
        {/* Header Section */}
        <div className="mb-6 mt-2 md:mt-0">
          <PageHeader
            accentColor="emerald"
            markerIcon="Command"
            markerLabel="Command Center"
            title="Dashboard"
            subtitle="Real-time financial pulse across accounts, investments, and commitments."
            actions={
              <div className="flex items-center gap-2">
                <HeaderButton
                  variant={isEditMode ? 'primary' : 'ghost'}
                  icon={isEditMode ? 'CheckCircle' : 'Grid01'}
                  onClick={() => setIsEditMode(!isEditMode)}
                  title={isEditMode ? 'Finish Editing' : 'Edit Layout'}
                >
                  {isEditMode ? 'Finish Editing' : 'Customize'}
                </HeaderButton>

                {isEditMode && (
                  <HeaderButton
                    variant="secondary"
                    icon="PlusSquare"
                    onClick={() => setIsAddWidgetModalOpen(true)}
                  >
                    Add Widget
                  </HeaderButton>
                )}

                <HeaderButton
                  variant="emerald"
                  icon="sync"
                  isLoading={isSyncingBanks}
                  onClick={() => {
                    if (onSyncBanks) {
                      onSyncBanks();
                    } else {
                      const syncBtn = document.querySelector('[data-eb-sync-all]');
                      if (syncBtn) (syncBtn as HTMLElement).click();
                    }
                  }}
                  title="Sync Connected Banks"
                >
                  {isSyncingBanks ? 'Syncing...' : 'Sync Banks'}
                </HeaderButton>

                <HeaderButton
                  variant="primary"
                  icon="PlusCircle"
                  onClick={() => handleOpenTransactionModal()}
                >
                  Add Transaction
                </HeaderButton>
              </div>
            }
          />
        </div>

        {suggestions.length > 0 && (
          <TransactionMatcherCard
            suggestionsCount={suggestions.length}
            onReview={() => setIsMatcherModalOpen(true)}
            onDismiss={dismissAllSuggestions}
          />
        )}

        {billSuggestions.length > 0 && (
          <SyncedBillMatcherCard
            suggestionsCount={billSuggestions.length}
            onReview={() => setIsBillMatcherModalOpen(true)}
            onDismiss={dismissAllBillMatches}
          />
        )}

        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 sm:gap-4 bg-white/60 dark:bg-black/20 backdrop-blur-xl p-1.5 sm:p-2 rounded-2xl sm:rounded-[2rem] border border-slate-200/60 dark:border-white/5 shadow-[4px_6px_12px_rgba(0,0,0,0.06)] dark:shadow-[4px_6px_12px_rgba(0,0,0,0.25)] relative z-30">
            {/* Unified Tabs (SegmentedControl) */}
            <div className="w-full lg:w-auto overflow-x-auto no-scrollbar">
              <SegmentedControl
                mode="tabs"
                items={[
                  { id: 'overview', label: 'Overview', icon: 'layout_alt' },
                  { id: 'analysis', label: 'Analysis', icon: 'bar_chart' },
                  { id: 'activity', label: 'Activity', icon: 'receipt' },
                  {
                    id: 'pending_matches',
                    label: 'Pending Matches',
                    icon: 'file_check',
                    badge: totalPendingMatchesCount > 0 ? totalPendingMatchesCount : undefined,
                  },
                ]}
                activeTab={activeTab}
                onTabChange={(id) => setActiveTab(id as DashboardTab)}
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full lg:w-auto justify-between lg:justify-end px-0.5 lg:px-0">
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 sm:gap-1 bg-slate-900/[0.03] dark:bg-white/[0.03] border border-slate-900/[0.06] dark:border-white/[0.06] p-1 rounded-2xl sm:rounded-[1.5rem] w-full sm:w-auto min-h-[48px] sm:h-12">
                {/* Forecast Controls (Only visible in overview) */}
                {activeTab === 'overview' && (
                  <>
                    <div className="relative flex-1 sm:flex-initial h-10">
                      <select
                        value={forecastDuration}
                        onChange={(e) => setForecastDuration(e.target.value as ForecastDuration)}
                        className="appearance-none bg-transparent hover:bg-black/5 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white h-10 pl-3.5 pr-8 rounded-xl sm:rounded-[1.25rem] text-xs font-bold tracking-wide transition-all cursor-pointer border-0 outline-none focus:ring-2 focus:ring-primary-500/30"
                      >
                        {FORECAST_DURATION_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{opt.label}</option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 dark:text-slate-500">
                        <Icon name="expand_more" className="text-base" />
                      </div>
                    </div>

                    <div className="w-[1px] h-5 bg-slate-200 dark:bg-white/10 mx-0.5 hidden sm:block"></div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setShowForecast(!showForecast)}
                        className={`w-10 h-10 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl sm:rounded-[1.25rem] transition-all ${showForecast ? 'bg-white/95 dark:bg-white/[0.1] shadow-xs border border-slate-200/80 dark:border-white/10 text-primary-600 dark:text-primary-400' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-black/5'}`}
                        title={showForecast ? "Hide Forecast" : "Show Forecast"}
                        aria-label="Toggle Forecast"
                      >
                        <Icon name="candlestick_chart" className={`text-lg sm:text-xl ${showForecast ? '' : ''}`} />
                      </button>

                      <button
                        onClick={() => setShowGoals(!showGoals)}
                        className={`w-10 h-10 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl sm:rounded-[1.25rem] transition-all ${showGoals ? 'bg-white/95 dark:bg-white/[0.1] shadow-xs border border-slate-200/80 dark:border-white/10 text-primary-600 dark:text-primary-400' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-black/5'}`}
                        title={showGoals ? "Hide Goals" : "Show Goals"}
                        aria-label="Toggle Goals"
                      >
                        <Icon name="target" className={`text-lg sm:text-xl ${showGoals ? '' : ''}`} />
                      </button>
                    </div>

                    <div className="h-6 sm:h-8 w-px bg-black/5 dark:bg-white/10 mx-0.5 hidden sm:block"></div>
                  </>
                )}

                <div className="flex items-center gap-2 sm:gap-3 ml-auto sm:ml-0 relative z-50 shrink-0">
                  <MultiAccountFilter accounts={accounts} selectedAccountIds={selectedAccountIds} setSelectedAccountIds={setSelectedAccountIds} />
                  <DurationFilter selectedDuration={duration} onDurationChange={setDuration} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {activeTab === 'analysis' && (
          <div className="space-y-8 animate-fade-in-up">
            <MetricCardRow columns={4}>
              <HeroMetricCard
                variant="primary"
                label="Liquidity Ratio"
                value={`${liquidityRatio.toFixed(1)} months`}
                subtext="Runway based on avg. spend"
                icon="clock"
                iconColor="blue"
                privacyBlur
              />
              <HeroMetricCard
                variant="secondary"
                label="Savings Rate"
                value={`${savingsRate.toFixed(0)}%`}
                subtext={`of total income (${duration})`}
                icon="piggy_bank"
                iconColor="emerald"
                privacyBlur
                trend={savingsRate >= 20 ? 'up' : savingsRate <= 0 ? 'down' : 'neutral'}
              />
              <HeroMetricCard
                variant="secondary"
                label="Debt Ratio"
                value={`${(calculateAccountTotals(analyticsAccounts, analyticsTransactions).netWorth > 0 ? (Math.abs(calculateAccountTotals(analyticsAccounts, analyticsTransactions).totalDebt) / calculateAccountTotals(analyticsAccounts, analyticsTransactions).totalAssets) * 100 : 0).toFixed(1)}%`}
                subtext="Liabilities / Assets"
                icon="scale"
                iconColor="purple"
                privacyBlur
              />
              <HeroMetricCard
                variant="secondary"
                label="Net Flow"
                value={formatCurrency(calculateAccountTotals(analyticsAccounts, analyticsTransactions).netWorth - calculateAccountTotals(analyticsAccounts, analyticsTransactions).netWorth, 'EUR')}
                subtext="Period change"
                icon="coins_stacked"
                iconColor="amber"
                privacyBlur
              />
            </MetricCardRow>

            {/* Dynamic widgets grid */}
            {widgets.filter(w => WIDGET_TABS.analysis.includes(w.id)).length > 0 && (
              <ResponsiveGridLayout
                className="layout"
                layouts={responsiveLayouts}
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                cols={{ lg: 12, md: 12, sm: 6, xs: 2, xxs: 1 }}
                rowHeight={180}
                isDraggable={isEditMode}
                isResizable={isEditMode}
                onBreakpointChange={setCurrentBreakpoint}
                onLayoutChange={handleLayoutChange}
                draggableHandle=".drag-handle"
                margin={isMobile ? [12, 12] : [24, 24]}
                containerPadding={[0, 0]}
              >
                {widgets
                  .filter(widget => WIDGET_TABS.analysis.includes(widget.id))
                  .map(widget => {
                    const widgetDetails = allWidgets.find(w => w.id === widget.id);
                    if (!widgetDetails) return null;
                    const WidgetComponent = widgetDetails.component;
                    const isCompactValue = ['forecastHorizon', 'creditCardStatements'].includes(widget.id);

                    return (
                      <div key={widget.id}>
                        <WidgetWrapper
                          title={widget.title}
                          subtitle={widgetDetails.description}
                          icon={widgetDetails.icon}
                          onRemove={() => removeWidget(widget.id)}
                          onWidthChange={(w) => updateWidgetWidth(widget.id, w)}
                          currentWidth={widget.w}
                          isEditMode={isEditMode}
                          isCompact={isCompactValue}
                          className="h-full"
                        >
                          <Suspense fallback={<div className="p-4 text-center">Loading...</div>}>
                            <WidgetComponent {...widgetDetails.props as any} />
                          </Suspense>
                        </WidgetWrapper>
                      </div>
                    );
                  })}
              </ResponsiveGridLayout>
            )}

            <Card className="overflow-hidden rounded-[2.5rem] p-8 mt-8">
              <div className="flex flex-col lg:flex-row gap-8">
                <div className="lg:w-1/3 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-black/5 dark:border-white/5 pb-8 lg:pb-0 lg:pr-8">
                  <h3 className="text-lg font-semibold tracking-tight text-light-text dark:text-dark-text mb-8 self-start">Asset allocation</h3>
                  <div className="h-64 w-full relative flex items-center justify-center">
                    <BklitPieChart
                      data={assetAllocationData.map((item: any) => ({
                        label: item.name,
                        value: item.value,
                        color: item.color,
                      }))}
                      innerRadius={70}
                      cornerRadius={6}
                      padAngle={assetAllocationData.length > 1 ? 0.04 : 0}
                      className="w-full h-64"
                    >
                      {assetAllocationData.map((_: any, index: number) => (
                        <PieSlice key={index} index={index} showGlow />
                      ))}
                      <PieCenter defaultLabel="Net worth">
                        {({ value, label, isHovered }) => (
                          <div className="flex flex-col items-center justify-center text-center">
                            <span className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-gray-400 opacity-70">
                              {label}
                            </span>
                            <span className="text-xl lg:text-2xl font-bold text-light-text dark:text-white tracking-tight privacy-blur leading-tight">
                              {formatCurrency(
                                convertCurrency(isHovered ? value : globalTotalAssets - Math.abs(globalTotalDebt), 'EUR', preferredCurrency, conversionRates),
                                preferredCurrency
                              )}
                            </span>
                          </div>
                        )}
                      </PieCenter>
                    </BklitPieChart>
                  </div>
                  <div className="w-full mt-10 grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 text-center">
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">Assets</p>
                      <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400 privacy-blur tracking-tight">{formatCurrency(convertCurrency(globalTotalAssets, 'EUR', preferredCurrency, conversionRates), preferredCurrency)}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10 text-center">
                      <p className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-1">Liabilities</p>
                      <p className="text-lg font-semibold text-rose-600 dark:text-rose-400 privacy-blur tracking-tight">{formatCurrency(convertCurrency(Math.abs(globalTotalDebt), 'EUR', preferredCurrency, conversionRates), preferredCurrency)}</p>
                    </div>
                  </div>
                </div>

                <div className="lg:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-10">
                  <div>
                    <h4 className="text-base font-semibold text-light-text dark:text-dark-text mb-6 tracking-tight">Assets breakdown</h4>
                    <div className="space-y-5">
                      {Object.entries(assetGroups as Record<string, { value: number; color: string; icon: string }>).map(([name, group]) => {
                        if (group.value === 0) return null;
                        return (
                          <div key={name} className="group">
                            <div className="flex justify-between text-sm mb-2">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-sm ring-1 ring-white/10" style={{ backgroundColor: group.color }}>
                                  <Icon name={group.icon} className="text-base" />
                                </div>
                                <span className="font-semibold text-light-text dark:text-dark-text tracking-tight">{name}</span>
                              </div>
                              <span className="font-bold text-light-text dark:text-dark-text privacy-blur tracking-tight">{formatCurrency(convertCurrency(group.value, 'EUR', preferredCurrency, conversionRates), preferredCurrency)}</span>
                            </div>
                            <div className="w-full bg-black/5 dark:bg-white/5 rounded-full h-1.5 overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${(group.value / globalTotalAssets) * 100}%`, backgroundColor: group.color }}></div>
                            </div>
                            <div className="flex justify-end mt-1">
                              <span className="text-xs font-medium text-light-text-secondary dark:text-gray-400 opacity-70 group-hover:opacity-100 transition-opacity">
                                {((group.value / globalTotalAssets) * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {globalTotalAssets === 0 && <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">No assets found.</p>}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-base font-semibold text-light-text dark:text-dark-text mb-6 tracking-tight">Liabilities breakdown</h4>
                    <div className="space-y-5">
                      {Object.entries(liabilityGroups as Record<string, { value: number; color: string; icon: string }>).map(([name, group]) => {
                        if (group.value === 0) return null;
                        return (
                          <div key={name} className="group">
                            <div className="flex justify-between text-sm mb-2">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-sm ring-1 ring-white/10" style={{ backgroundColor: group.color }}>
                                  <Icon name={group.icon} className="text-base" />
                                </div>
                                <span className="font-semibold text-light-text dark:text-dark-text tracking-tight">{name}</span>
                              </div>
                              <span className="font-bold text-light-text dark:text-dark-text privacy-blur tracking-tight">{formatCurrency(convertCurrency(group.value, 'EUR', preferredCurrency, conversionRates), preferredCurrency)}</span>
                            </div>
                            <div className="w-full bg-black/5 dark:bg-white/5 rounded-full h-1.5 overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${(group.value / Math.abs(globalTotalDebt)) * 100}%`, backgroundColor: group.color }}></div>
                            </div>
                            <div className="flex justify-end mt-1">
                              <span className="text-xs font-medium text-light-text-secondary dark:text-gray-400 opacity-70 group-hover:opacity-100 transition-opacity">
                                {((group.value / Math.abs(globalTotalDebt)) * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {globalTotalDebt === 0 && (
                        <div className="p-6 text-center text-xs text-light-text-secondary bg-black/5 dark:bg-white/5 rounded-2xl border border-dashed border-black/10">
                          No liabilities recorded.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'pending_matches' && (
          <PendingMatchesView
            billSuggestions={filteredBillSuggestions}
            transferSuggestions={filteredTransferSuggestions}
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
        )}

        {(activeTab === 'overview' || activeTab === 'activity') && (
          <div className="animate-fade-in-up">
            <ResponsiveGridLayout
              className="layout"
              layouts={responsiveLayouts}
              breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
              cols={{ lg: 12, md: 12, sm: 6, xs: 2, xxs: 1 }}
              rowHeight={180}
              isDraggable={isEditMode}
              isResizable={isEditMode}
              onBreakpointChange={setCurrentBreakpoint}
              onLayoutChange={handleLayoutChange}
              draggableHandle=".drag-handle"
              margin={isMobile ? [12, 12] : [24, 24]}
              containerPadding={[0, 0]}
            >
              {widgets
                .filter(widget => WIDGET_TABS[activeTab].includes(widget.id))
                .map(widget => {
                  const widgetDetails = allWidgets.find(w => w.id === widget.id);
                  if (!widgetDetails) return null;
                  const WidgetComponent = widgetDetails.component;

                  const isCompactValue = ['forecastHorizon', 'creditCardStatements'].includes(widget.id);
                  return (
                    <div key={widget.id}>
                      <WidgetWrapper
                        title={widget.title}
                        subtitle={widgetDetails.description}
                        icon={widgetDetails.icon}
                        onRemove={() => removeWidget(widget.id)}
                        onWidthChange={(w) => updateWidgetWidth(widget.id, w)}
                        currentWidth={widget.w}
                        isEditMode={isEditMode}
                        isCompact={isCompactValue}
                        className="h-full"
                      >
                        <WidgetErrorBoundary widgetTitle={(widgetDetails as any).title || widget.id}>
                          <Suspense fallback={(
                            <div className="p-4 text-sm text-light-text-secondary dark:text-dark-text-secondary text-center">
                              Loading widget...
                            </div>
                          )}>
                            <WidgetComponent {...widgetDetails.props as any} />
                          </Suspense>
                        </WidgetErrorBoundary>
                      </WidgetWrapper>
                    </div>
                  );
                })}
            </ResponsiveGridLayout>
          </div>
        )}
      </div>
      )}
      <ConfirmDialog />
    </div>
  );
};

export default React.memo(Dashboard);
