import React, { useMemo, useState, useCallback, useEffect, useRef, Suspense, lazy } from 'react';
import { forecastFromData, horizonTiles, warrantTaxBills } from '../utils/forecastModel';
import { sortAccountsByType } from '../utils/accountsModel';
import { Page, User, Transaction, Account, Category, Duration, CategorySpending, Widget, WidgetConfig, DisplayTransaction, FinancialGoal, RecurringTransaction, BillPayment, Tag, Budget, RecurringTransactionOverride, LoanPaymentOverrides, AccountType, Task, ForecastDuration, Currency, ScheduledItem } from '../types';
import PageHeader from '../components/PageHeader';
import { liveSeries } from '../utils/scheduleModel';
import { formatCurrency, convertCurrency, convertToMain, generateSyntheticLoanPayments, generateSyntheticCreditCardPayments, parseLocalDate, getPreferredTimeZone, generateSyntheticPropertyTransactions, toLocalISOString, getDateRange, calculateAccountTotals, calculateStatementPeriods, getCreditCardStatementDetails, formatDateKey, safeRound, getMainCurrency } from '../utils';
import AddTransactionModal from '../components/AddTransactionModal';
import { DURATION_OPTIONS, LIQUID_ACCOUNT_TYPES, ASSET_TYPES, DEBT_TYPES, FORECAST_DURATION_OPTIONS, QUICK_CREATE_BUDGET_OPTIONS } from '../constants';
import TransactionDetailModal from '../components/TransactionDetailModal';
import SpendingByCategoryWidget from '../components/SpendingByCategoryWidget';
import SpendingCalendarWidget from '../components/SpendingCalendarWidget';
import GoalsRingsWidget from '../components/GoalsRingsWidget';
import PeriodFlowWidget, { type FlowBucket } from '../components/PeriodFlowWidget';
import DurationFilter from '../components/DurationFilter';
import NetWorthChart from '../components/NetWorthChart';
import TransactionList from '../components/TransactionList';
import MultiAccountFilter from '../components/MultiAccountFilter';
import ForecastOverview from '../components/ForecastOverview';
import AddWidgetModal from '../components/AddWidgetModal';
import { useReview } from '../contexts/ReviewContext';
import CreditCardStatementCard from '../components/CreditCardStatementCard';
import AccountBreakdownCard from '../components/AccountBreakdownCard';
import TodayWidget from '../components/TodayWidget';
import { useAccountsContext, usePreferencesContext, useTransactionsContext, usePreferencesSelector, useWarrantsContext } from '../contexts/DomainProviders';
import { useBudgetsContext, useCategoryContext, useGoalsContext, useScheduleContext, useTagsContext } from '../contexts/FinancialDataContext';
import { useInsightsView } from '../contexts/InsightsViewContext';
import { useIsMobile } from '../hooks/useIsMobile';
import BudgetModal from '../components/BudgetModal';
import { EmptyState, Skeleton } from '../components/ui/States';
import PullToRefresh from '../components/PullToRefresh';
import AssetAllocationWidget from '../components/AssetAllocationWidget';
import { Button, IconButton } from '../components/ui/Actions';
import { Switch } from '../components/ui/Fields';
import { Amount, PrivacyContext, useFirstVisit } from '../components/ui/Money';
import { BottomSheet, Popover } from '../components/ui/Overlays';
import { MultiSelect, Select } from '../components/ui/Pickers';
import { AccountsSummary, KeyRatios, NeedsYou, NetWorthHero, SafeToSpendWidget, WrittenSummary } from '../components/ui/Summaries';
import WidgetGrid, { WidgetBody, useWidgetBox, type WidgetGridItem, type WidgetLayoutItem } from '../components/ui/WidgetGrid';
import { Button as AriaButton } from 'react-aria-components';
import { useBillNotifications } from '../hooks/useBillNotifications';
import { resolveTransferInfo } from '../utils/transferDetails';
import { computeSafeToSpend } from '../utils/safeToSpend';
import { buildSummaryFacts, isUncategorised } from '../utils/overviewSummary';
import { OVERVIEW_TABS, OVERVIEW_WIDGETS, isOverviewTab, overviewTabKey, resolveTabLayout, toConfig } from '../utils/overviewLayout';
import { setUrlTab, useUrlTab } from '../hooks/useUrlTab';

// Analysis widgets
import MerchantParetoWidget from '../components/MerchantParetoWidget';
import FinancialRunwayWidget from '../components/FinancialRunwayWidget';
import WealthVelocityWidget from '../components/WealthVelocityWidget';
import InsightsWidget from '../components/InsightsWidget';
import { generateInsights, visibleInsights } from '../utils/insightsModel';

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

const CreditCardStatementsWidget: React.FC<{ statements: any[]; size?: 's' | 'm' | 'l' }> = ({ statements, size = 'm' }) => {
  const box = useWidgetBox();
  if (statements.length === 0) return null;
  // A statement card is about 320px wide and 240px high: as many as fit across and down, the rest on the Accounts page.
  const fallback = size === 's' ? 1 : size === 'm' ? 2 : statements.length;
  const fitted = box.width > 0 && box.height > 0 ? Math.max(1, Math.floor(box.width / 320)) * Math.max(1, Math.floor(box.height / 240)) : fallback;
  const displayed = statements.slice(0, Math.max(1, Math.min(statements.length, box.height > 0 ? Math.max(fitted, 1) : fallback)));
  return (
    <div className="grid h-full grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] items-stretch gap-2.5 overflow-y-auto sm:gap-3">
      {displayed.map(statement => (
        <CreditCardStatementCard
          key={statement.accountId}
          noCard={true}
          accountName={statement.accountName}
          accountBalance={statement.accountBalance}
          creditLimit={statement.creditLimit}
          cardNetwork={statement.cardNetwork}
          financialInstitution={statement.financialInstitution}
          currency={statement.currency}
          previousStatement={{
            period: statement.previous.period,
            balance: statement.previous.balance,
            dueDate: statement.previous.paymentDue,
            // What settles the last statement is paid after it closes, so it shows in the current period.
            amountPaid: statement.current.amountPaid
          }}
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

const EMPTY_IDS: string[] = [];

const Dashboard: React.FC<DashboardProps> = ({ user, tasks, saveTask, onSyncBanks, isSyncingBanks, setCurrentPage, onOpenAccount }) => {
  const { activeGoalIds, dashboardAccountIds: selectedAccountIds, setDashboardAccountIds: setSelectedAccountIds, dashboardDuration: duration, setDashboardDuration: setDuration } = useInsightsView();
  const { accounts } = useAccountsContext();
  const { warrants } = useWarrantsContext();
  const { transactions, saveTransaction, deleteTransactions, digest: transactionsDigest } = useTransactionsContext();
  const { incomeCategories, expenseCategories } = useCategoryContext();
  const { financialGoals } = useGoalsContext();
  const {
    recurringTransactions: everySeries,
    recurringTransactionOverrides,
    loanPaymentOverrides,
    billsAndPayments,
    saveRecurringTransaction,
    saveBillPayment,
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



  const review = useReview();

  const allCategories = useMemo(() => [...incomeCategories, ...expenseCategories], [incomeCategories, expenseCategories]);

  const selectedAccounts = useMemo(() =>
    accounts.filter(a => selectedAccountIds.includes(a.id)),
    [accounts, selectedAccountIds]);

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
      if (oldestKey) {
        cache.delete(oldestKey);
      }
    }
    cache.set(cacheKey, value);
  }, [aggregateCacheMax]);

  // Combine all recurring items (user-defined + synthetic)
  const recurringTransactions = useMemo(() => liveSeries(everySeries), [everySeries]);

  const monthFlow = useMemo(() => {
    const monthPrefix = toLocalISOString(new Date()).slice(0, 7);
    return analyticsTransactions.reduce((flow, tx) => {
      if (tx.transferId || !tx.date.startsWith(monthPrefix)) return flow;
      const eur = convertToMain(tx.amount, tx.currency);
      if (tx.type === 'income') flow.income += eur;
      else flow.spending += Math.abs(eur);
      return flow;
    }, { income: 0, spending: 0 });
  }, [analyticsTransactions]);

  /** The last 30 days, one point a day, for the trends beside the header figures. EUR. */
  const dayTrends = useMemo(() => {
    const days = 30;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    const first = toLocalISOString(start);
    const income = Array<number>(days).fill(0);
    const spending = Array<number>(days).fill(0);
    for (const tx of analyticsTransactions) {
      if (tx.transferId || tx.date < first) continue;
      const index = Math.round((parseLocalDate(tx.date).getTime() - start.getTime()) / 86400000);
      if (index < 0 || index >= days) continue;
      const eur = convertToMain(tx.amount, tx.currency);
      if (tx.type === 'income') income[index] += eur;
      else spending[index] += Math.abs(eur);
    }
    const toSeries = (values: number[]) => values.map(value => ({ value }));
    return { income: toSeries(income), spending: toSeries(spending) };
  }, [analyticsTransactions]);

  const { allRecurringItems } = useMemo(() => {
    const syntheticLoanPayments = generateSyntheticLoanPayments(analyticsAccounts, analyticsTransactions, loanPaymentOverrides);
    const syntheticCreditCardPayments = generateSyntheticCreditCardPayments(analyticsAccounts, analyticsTransactions);
    const syntheticPropertyTransactions = generateSyntheticPropertyTransactions(analyticsAccounts);

    const all = [...recurringTransactions, ...syntheticLoanPayments, ...syntheticCreditCardPayments, ...syntheticPropertyTransactions];
    return { allRecurringItems: all };
  }, [analyticsAccounts, analyticsTransactions, loanPaymentOverrides, recurringTransactions]);

  // Forecast Data for Widget (Used for Lowest Balance Cards & Net Worth Chart)
  const { forecastChartData, lowestBalanceForecasts } = useMemo(() => {
    const projectionEndDate = new Date();
    // Adjust duration based on filter
    switch (forecastDuration) {
      case '3M': projectionEndDate.setMonth(projectionEndDate.getMonth() + 3); break;
      case '6M': projectionEndDate.setMonth(projectionEndDate.getMonth() + 6); break;
      case 'EOY': projectionEndDate.setFullYear(projectionEndDate.getFullYear(), 11, 31); break;
      case '1Y': projectionEndDate.setMonth(projectionEndDate.getMonth() + 12); break;
      default: projectionEndDate.setMonth(projectionEndDate.getMonth() + 12); break;
    }

    // The tiles always reach the end of Forecast's 12-month period, whatever length the chart shows.
    const today = new Date();
    const aYearOut = new Date(today.getFullYear(), today.getMonth() + 13, 0);
    const projection = forecastFromData(
      { recurring: recurringTransactions, overrides: recurringTransactionOverrides, bills: [...billsAndPayments, ...warrantTaxBills(warrants, selectedAccounts, accounts)], accounts, transactions, loanPaymentOverrides },
      selectedAccounts, financialGoals, activeGoalIds, today, projectionEndDate > aYearOut ? projectionEndDate : aYearOut, convertToMain,
    );
    const chartEnd = toLocalISOString(projectionEndDate);
    const chartData = projection.days.filter(day => day.date <= chartEnd).map(day => ({ date: day.date, value: day.total }));

    return { forecastChartData: chartData, lowestBalanceForecasts: horizonTiles(projection.days, today) };

  }, [accounts, selectedAccounts, transactions, loanPaymentOverrides, recurringTransactions, financialGoals, activeGoalIds, billsAndPayments, warrants, recurringTransactionOverrides, forecastDuration]);

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
            case 'biweekly': nextDueDate.setDate(nextDueDate.getDate() + 14 * interval); break;
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

  const handleDeleteTransactions = useCallback((ids: string[]) => {
    setDetailModalOpen(false);
    deleteTransactions(ids);
  }, [deleteTransactions]);

  const { filteredTransactions, income, expenses } = useMemo(() => {
    const ratesKey = JSON.stringify(conversionRates ?? {});
    const cacheKey = `${transactionsKey}|${selectedAccountIds.join(',')}|${analyticsSelectedAccountIds.join(',')}|${duration}|${showBalanceAdjustments}|${Boolean(preferences.excludeTransfersFromAnalytics)}|${preferredCurrency}|${ratesKey}`;
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

      const convertedAmount = convertToMain(tx.amount, tx.currency);

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
  }, [aggregateCacheRef, analyticsSelectedAccountIds, analyticsTransactions, cacheAggregateResult, conversionRates, duration, preferences.excludeTransfersFromAnalytics, preferredCurrency, selectedAccountIds, showBalanceAdjustments, transactionsKey, transferLookup]);

  const enrichedTransactions: EnrichedTransaction[] = useMemo(
    () =>
      filteredTransactions.map(tx => ({
        ...tx,
        convertedAmount: convertToMain(tx.amount, tx.currency),
        parsedDate: parseLocalDate(tx.date),
      })),
    [filteredTransactions]
  );

  const { incomeChange, expenseChange } = useMemo(() => {
    const { start, end } = getDateRange(duration, analyticsTransactions);
    const diff = end.getTime() - start.getTime();

    if (duration === 'ALL' || diff <= 0) {
      return { incomeChange: null, expenseChange: null };
    }

    const prevStart = new Date(start.getTime() - diff);
    const prevEnd = new Date(start.getTime() - 1);

    const txsInPrevPeriod = analyticsTransactions.filter(tx => {
      const txDate = parseLocalDate(tx.date);
      return txDate >= prevStart && txDate <= prevEnd;
    });

    let prevIncome = 0;
    let prevExpenses = 0;

    const processedTransferIds = new Set<string>();
    txsInPrevPeriod.forEach(tx => {
      if (!analyticsSelectedAccountIds.includes(tx.accountId)) return;

      const convertedAmount = convertToMain(tx.amount, tx.currency);

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
  }, [duration, analyticsTransactions, analyticsSelectedAccountIds, income, expenses, transferLookup, preferences.excludeTransfersFromAnalytics]);

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
            spending[name] = { name, value: 0, color: 'var(--muted)', icon: 'arrow_upward' };
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
          spending[name] = { name, value: 0, color: parentCategory?.color || 'var(--muted)', icon: parentCategory?.icon };
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

  /** What the spending calendar counts: the accounts in view, whatever the period. */
  const calendarTransactions = useMemo(
    () => analyticsTransactions.filter(tx => analyticsSelectedAccountIds.includes(tx.accountId)),
    [analyticsTransactions, analyticsSelectedAccountIds]
  );

  const handleCalendarDay = useCallback((date: string) => {
    setModalTransactions(calendarTransactions.filter(tx => tx.date === date && tx.type === 'expense' && !tx.transferId));
    setModalTitle(`Spending on ${parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}`);
    setDetailModalOpen(true);
  }, [calendarTransactions]);

  const accountMap = useMemo(() => accounts.reduce((map, acc) => { map[acc.id] = acc.name; return map; }, {} as Record<string, string>), [accounts]);

  const recentTransactions = useMemo(() => {
    // Spare change moves a few cents at a time between your own accounts. It is not activity worth listing.
    const sortedSourceTransactions = analyticsTransactions
      .filter(tx => analyticsSelectedAccountIds.includes(tx.accountId) && !(tx.transferId && resolveTransferInfo(tx, accounts, transferLookup.get(tx.transferId)?.find(t => t.id !== tx.id))?.kind === 'spare_change'))
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
  }, [analyticsTransactions, analyticsSelectedAccountIds, accountMap, transferLookup, accounts]);

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

  const eurToDisplay = useCallback((eur: number) => convertCurrency(eur, getMainCurrency(), preferredCurrency, conversionRates), [preferredCurrency, conversionRates]);

  /** Money in and out for each stretch of the period: days for a short one, weeks for a few months, months beyond. Display currency. */
  const periodFlowBuckets = useMemo<FlowBucket[]>(() => {
    const { start, end } = getDateRange(duration, transactions);
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
    const unit: 'day' | 'week' | 'month' = days <= 14 ? 'day' : days <= 100 ? 'week' : 'month';
    const keyOf = (date: Date) => {
      if (unit === 'month') return new Date(date.getFullYear(), date.getMonth(), 1);
      if (unit === 'week') {
        const offset = Math.floor((date.getTime() - start.getTime()) / (7 * 86400000));
        return new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset * 7);
      }
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    };
    const labelOf = (date: Date) => unit === 'month' ? date.toLocaleDateString('en-GB', { month: 'short' }) : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const buckets = new Map<number, FlowBucket>();
    const ensure = (date: Date) => {
      const key = keyOf(date);
      if (!buckets.has(key.getTime())) buckets.set(key.getTime(), { name: labelOf(key), 'Money in': 0, 'Money out': 0 });
      return buckets.get(key.getTime())!;
    };
    // Every stretch in the range gets a bar, even an empty one, so gaps read as gaps.
    for (let cursor = keyOf(start); cursor <= end; cursor = unit === 'month' ? new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1) : new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + (unit === 'week' ? 7 : 1))) {
      ensure(cursor);
    }
    for (const tx of enrichedTransactions) {
      if (tx.transferId) continue;
      const bucket = ensure(tx.parsedDate);
      const amount = eurToDisplay(tx.convertedAmount);
      if (tx.type === 'income') bucket['Money in'] += amount;
      else bucket['Money out'] += Math.abs(amount);
    }
    const ordered = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]).map(([, bucket]) => ({ ...bucket, 'Money in': safeRound(bucket['Money in'], 2), 'Money out': safeRound(bucket['Money out'], 2) }));
    // A long range runs from where the money starts to where it ends, and shows at most the last two years of that.
    const used = (bucket: FlowBucket) => bucket['Money in'] > 0 || bucket['Money out'] > 0;
    const first = ordered.findIndex(used);
    const last = ordered.length - 1 - [...ordered].reverse().findIndex(used);
    return (duration === 'ALL' && first >= 0 ? ordered.slice(first, last + 1) : ordered).slice(-24);
  }, [enrichedTransactions, duration, transactions, eurToDisplay]);


  /** The biggest four types get the chart colours in order and the rest share one grey. The list beside the chart names each. */
  const createBreakdown = (accs: Account[]) => {
    const grouped = accs.reduce((acc, account) => {
      acc[account.type] = (acc[account.type] || 0) + convertToMain(account.balance, account.currency);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value: Math.abs(value) }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((item, index) => ({ ...item, color: index < 4 ? `var(--chart-${index + 1})` : 'var(--muted)' }));
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
      'Liquid Cash': { types: ['Checking', 'Savings'], value: 0, color: 'var(--chart-1)', icon: 'wallet' },
      'Investments': { types: ['Investment'], value: 0, color: 'var(--chart-2)', icon: 'candlestick_chart' },
      'Properties': { types: ['Property'], value: 0, color: 'var(--chart-3)', icon: 'home' },
      'Vehicles': { types: ['Vehicle'], value: 0, color: 'var(--chart-4)', icon: 'directions_car' },
      'Other Assets': { types: ['Other Assets', 'Lending'], value: 0, color: 'var(--chart-5)', icon: 'Box' },
    };

    const liabilityGroups: Record<string, { types: AccountType[], value: number, color: string, icon: string }> = {
      'Loans': { types: ['Loan'], value: 0, color: 'var(--chart-1)', icon: 'receipt_check' },
      'Credit Cards': { types: ['Credit Card'], value: 0, color: 'var(--chart-2)', icon: 'credit_card' },
      'Other Liabilities': { types: ['Other Liabilities'], value: 0, color: 'var(--chart-3)', icon: 'receipt' },
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
      { name: 'Liquid Cash', value: groups?.['Liquid Cash']?.value || 0, color: groups?.['Liquid Cash']?.color || 'var(--muted)' },
      { name: 'Investments', value: groups?.['Investments']?.value || 0, color: groups?.['Investments']?.color || 'var(--muted)' },
      { name: 'Properties', value: groups?.['Properties']?.value || 0, color: groups?.['Properties']?.color || 'var(--muted)' },
      { name: 'Vehicles', value: groups?.['Vehicles']?.value || 0, color: groups?.['Vehicles']?.color || 'var(--muted)' },
      { name: 'Other Assets', value: groups?.['Other Assets']?.value || 0, color: groups?.['Other Assets']?.color || 'var(--muted)' }
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

    const signedTxAmount = (tx: Transaction) =>
      tx.type === 'expense'
        ? -Math.abs(convertToMain(tx.amount, tx.currency))
        : Math.abs(convertToMain(tx.amount, tx.currency));

    // Back out future-dated transactions included in account.balance so today's baseline is accurate
    const futureTransactionsDelta = analyticsTransactions
      .filter(tx => {
        if (!analyticsSelectedAccountIds.includes(tx.accountId)) return false;
        if (tx.transferId && internalTransferIds.has(tx.transferId)) return false;
        const txDate = parseLocalDate(tx.date);
        return txDate > today;
      })
      .reduce((sum, tx) => sum + signedTxAmount(tx), 0);

    const todayNetWorth = currentNetWorth - futureTransactionsDelta;

    const transactionsToReverse = analyticsTransactions.filter(tx => {
      if (!analyticsSelectedAccountIds.includes(tx.accountId)) return false;
      if (tx.transferId && internalTransferIds.has(tx.transferId)) return false;
      const txDate = parseLocalDate(tx.date);
      return txDate >= start && txDate <= today;
    });

    const totalChangeSinceStart = transactionsToReverse.reduce((sum, tx) => sum + signedTxAmount(tx), 0);

    const startingNetWorth = todayNetWorth - totalChangeSinceStart;

    const transactionsInPeriod = analyticsTransactions.filter(tx => {
      if (!analyticsSelectedAccountIds.includes(tx.accountId)) return false;
      if (tx.transferId && internalTransferIds.has(tx.transferId)) return false;
      const txDate = parseLocalDate(tx.date);
      return txDate >= start && txDate <= end;
    });

    const dailyChanges = new Map<string, number>();
    for (const tx of transactionsInPeriod) {
      const dateStr = formatDateKey(parseLocalDate(tx.date));
      dailyChanges.set(dateStr, (dailyChanges.get(dateStr) || 0) + signedTxAmount(tx));
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
  }, [duration, transactions, analyticsTransactions, analyticsSelectedAccountIds, netWorth, forecastChartData, showForecast]);

  const netWorthTrendColor = useMemo(() => {
    // Check trend based on historical data only
    const historyPoints = netWorthData.filter(d => d.value !== undefined);
    if (historyPoints.length < 2) return 'var(--chart-1)';
    const startValue = historyPoints[0].value!;
    const endValue = historyPoints[historyPoints.length - 1].value!;
    return endValue >= startValue ? 'var(--money-in)' : 'var(--money-out)';
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
        previous: {
          balance: prevBalance,
          amountPaid: prevAmountPaid,
          period: `${formatDate(periods.previous.start)} - ${formatDate(periods.previous.end)}`,
          paymentDue: formatFullDate(periods.previous.paymentDue)
        },
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
      .reduce((sum, acc) => sum + convertToMain(acc.balance, acc.currency), 0);

    const threeMonthsAgo = new Date(); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const expenseTxs = analyticsTransactions.filter(t => {
      const d = parseLocalDate(t.date);
      return d >= threeMonthsAgo && t.type === 'expense' && !t.transferId;
    });
    const totalSpend = expenseTxs.reduce((sum, tx) => sum + Math.abs(convertToMain(tx.amount, tx.currency)), 0);
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
      const val = convertToMain(tx.amount, tx.currency);
      if (tx.type === 'income') totalIncomePeriod += val;
      else totalExpensePeriod += Math.abs(val);
    });
    const netFlowPeriod = totalIncomePeriod - totalExpensePeriod;
    const savingsRate = totalIncomePeriod > 0 ? (netFlowPeriod / totalIncomePeriod) * 100 : 0;

    return { liquidityRatio, savingsRate };

  }, [analyticsAccounts, analyticsTransactions, duration]);

  const displayToEur = useCallback((val: number) => convertCurrency(val, preferredCurrency, getMainCurrency(), conversionRates), [preferredCurrency, conversionRates]);
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
    const debtRatio = assets > 0 ? (Math.abs(debt) / assets) * 100 : 0;
    // Each ratio is read against a target: runway against a year, savings against 40%, debt against half of what you own.
    const runway = liquidityRatio < 3 ? { tone: 'loss' as const, status: 'Low' } : liquidityRatio < 6 ? { tone: 'amber' as const, status: 'Building' } : { tone: 'pine' as const, status: 'Healthy' };
    const saving = savingsRate < 0 ? { tone: 'loss' as const, status: 'Overspending' } : savingsRate < 10 ? { tone: 'amber' as const, status: 'Thin' } : { tone: 'pine' as const, status: 'On track' };
    const owing = debtRatio > 60 ? { tone: 'loss' as const, status: 'High' } : debtRatio > 35 ? { tone: 'amber' as const, status: 'Watch' } : { tone: 'pine' as const, status: 'Low' };
    return [
      { label: 'Liquidity', value: `${liquidityRatio.toFixed(1)} months`, context: 'Runway at your average spend', gauge: { fill: (liquidityRatio / 12) * 100, display: liquidityRatio.toFixed(1), ...runway, status: `${runway.status} · months` } },
      { label: 'Savings rate', value: `${savingsRate.toFixed(0)}%`, context: 'Of income this period', gauge: { fill: (savingsRate / 40) * 100, display: `${savingsRate.toFixed(0)}%`, ...saving } },
      { label: 'Debt ratio', value: `${debtRatio.toFixed(1)}%`, context: 'Debts against assets', gauge: { fill: (debtRatio / 100) * 100, display: `${debtRatio.toFixed(0)}%`, ...owing } },
      { label: 'Net flow', value: <Amount value={eurToDisplay(safeRound(income - expenses, 2))} currency={preferredCurrency} tone="flow" />, context: 'Income less spending this period' },
    ];
  }, [analyticsAccounts, analyticsTransactions, liquidityRatio, savingsRate, income, expenses, eurToDisplay, preferredCurrency]);

  // --- Widget Management ---
  const dismissedInsights = useMemo(() => preferences.dismissedInsights ?? EMPTY_IDS, [preferences.dismissedInsights]);
  const dismissInsight = useCallback((id: string) => {
    setPreferences(prev => ({
      ...prev,
      dismissedInsights: Array.from(new Set([...(prev.dismissedInsights ?? []), id])),
    }));
  }, [setPreferences]);

  const activeInsights = useMemo(() => {
    const threeMonthsTile = lowestBalanceForecasts.find(tile => tile.period === 'Next 3 Months') ?? lowestBalanceForecasts[0];
    const lowestBalance = threeMonthsTile
      ? { date: threeMonthsTile.date, total: eurToDisplay(threeMonthsTile.lowestBalance) }
      : undefined;
    const all = generateInsights({
      today: new Date(),
      accounts: analyticsAccounts,
      transactions: analyticsTransactions,
      categories: expenseCategories,
      recurring: everySeries,
      lowestBalance,
      convert: toPreferred,
      format: amount => formatCurrency(amount, preferredCurrency),
    });
    return visibleInsights(all, dismissedInsights);
  }, [lowestBalanceForecasts, eurToDisplay, analyticsAccounts, analyticsTransactions, expenseCategories, everySeries, toPreferred, preferredCurrency, dismissedInsights]);

  const allWidgets: Widget[] = useMemo(() => [
    {
      id: 'financialOverview',
      name: 'This period',
      icon: 'pulse-01',
      description: 'What you kept, what came in and went out, and how it compares',
      defaultW: 6,
      defaultH: 2,
      component: PeriodFlowWidget,
      props: {
        income: eurToDisplay(income),
        expenses: eurToDisplay(expenses),
        incomeChange,
        expenseChange,
        buckets: periodFlowBuckets,
        currency: preferredCurrency,
      }
    },
    {
      id: 'safeToSpend',
      name: 'Safe to spend',
      icon: 'shield-01',
      description: 'What is left until your next income',
      defaultW: 2,
      defaultH: 3,
      component: SafeToSpendWidget,
      props: { data: safeToSpend, currency: preferredCurrency, toDisplay: eurToDisplay, fromDisplay: displayToEur, countUp: true, onCushionChange: setCushion }
    },
    {
      id: 'accountsSummary',
      name: 'Accounts',
      icon: 'wallet-02',
      description: 'Your biggest accounts',
      defaultW: 2,
      defaultH: 4,
      component: AccountsSummary,
      props: { accounts, transactions, conversionRates, toDisplay: toPreferred, currency: preferredCurrency, onOpen: onOpenAccount, onAll: () => setCurrentPage('Accounts') }
    },
    {
      id: 'overviewKpis',
      name: 'Key ratios',
      icon: 'balance-scale',
      description: 'Liquidity, savings, debt and net flow',
      defaultW: 6,
      defaultH: 2,
      component: KeyRatios,
      props: { items: keyRatios }
    },
    {
      id: 'assetAllocation',
      name: 'Asset allocation',
      icon: 'safe',
      description: 'Assets and debts by group',
      defaultW: 6,
      defaultH: 7,
      component: AssetAllocationWidget,
      props: { allocation: assetAllocationData, assetGroups, liabilityGroups, totalAssets: globalTotalAssets, totalDebt: globalTotalDebt, currency: preferredCurrency, toDisplay: eurToDisplay }
    },
    {
      id: 'todayWidget',
      name: 'Today\'s Agenda',
      icon: 'calendar-check-in-01',
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
      icon: 'clock-01',
      description: 'Your lowest balance ahead',
      defaultW: 6,
      defaultH: 2,
      component: ForecastOverview,
      props: { forecasts: lowestBalanceForecasts, currency: preferredCurrency}
    },
    {
      id: 'creditCardStatements',
      name: 'Credit Card Statements',
      icon: 'credit-card',
      description: 'This statement and the next, for each card',
      defaultW: 6,
      defaultH: 2,
      component: CreditCardStatementsWidget,
      props: { statements: creditCardStatements }
    },
    // Updated props for Net Worth chart to support toggles
    { id: 'spendingCalendar', name: 'Spending calendar', icon: 'calendar-03', description: 'A dot for every day, coloured by what went out', defaultW: 6, defaultH: 3, component: SpendingCalendarWidget, props: { transactions: calendarTransactions, currency: preferredCurrency, toDisplay: eurToDisplay, onDayClick: handleCalendarDay } },
    { id: 'goalsRings', name: 'Goals', icon: 'target-01', description: 'Progress towards each goal', defaultW: 6, defaultH: 3, component: GoalsRingsWidget, props: { goals: financialGoals, currency: preferredCurrency, toDisplay: toPreferred, onOpenGoals: () => setCurrentPage('Goals') } },
    {
      id: 'netWorthOverTime',
      name: 'Net Worth Over Time',
      icon: 'chart-line-data-01',
      description: 'How your net worth has changed',
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
    { id: 'outflowsByCategory', name: 'Spending by category', icon: 'pie-chart-01', description: 'Where your money went, against your budgets', defaultW: 6, defaultH: 2, component: SpendingByCategoryWidget, props: { data: outflowsByCategory, budgets, transactions, expenseCategories, accounts, duration, onCategoryClick: handleCategoryClick, onBudgetClick: handleBudgetClick } },
    { id: 'recentActivity', name: 'Recent Activity', icon: 'clock-03', description: 'Latest transactions', defaultW: 12, defaultH: 3, component: TransactionList, props: { transactions: recentTransactions, allCategories: allCategories, onTransactionClick: handleTransactionClick, maxItems: 15 } },
    { id: 'assetBreakdown', name: 'Asset Breakdown', icon: 'bank', description: 'What you own, by account type', defaultW: 6, defaultH: 2, component: AccountBreakdownCard, props: { title: 'Assets', totalValue: globalTotalAssets, breakdownData: globalAssetBreakdown } },
    { id: 'liabilityBreakdown', name: 'Liability Breakdown', icon: 'receipt', description: 'What you owe, by account type', defaultW: 6, defaultH: 2, component: AccountBreakdownCard, props: { title: 'Liabilities', totalValue: Math.abs(globalTotalDebt), breakdownData: globalDebtBreakdown } },
    { id: 'transactionMap', name: 'Transaction Map', icon: 'maps', description: 'Where you spent, on a map', defaultW: 6, defaultH: 2, component: TransactionMapWidget, props: { transactions: filteredTransactions } },
    { id: 'cashflowSankey', name: 'Cash Flow Sankey', icon: 'hierarchy-square-01', description: 'How money flows from income to spending', defaultW: 12, defaultH: 2, component: CashflowSankey, props: { transactions: filteredTransactions, incomeCategories, expenseCategories } },

    // ANALYSIS WIDGETS
    { id: 'financialRunway', name: 'Financial Runway', icon: 'timer-01', description: 'How many months your cash would last', defaultW: 6, defaultH: 2, component: FinancialRunwayWidget, props: { accounts, transactions: analyticsTransactions } },
    { id: 'merchantPareto', name: 'Merchant Pareto', icon: 'store-01', description: 'Where most of your spending goes', defaultW: 6, defaultH: 2, component: MerchantParetoWidget, props: { transactions: analyticsTransactions, currency: preferredCurrency, toDisplay: eurToDisplay } },
    { id: 'wealthVelocity', name: 'Wealth Velocity', icon: 'flash', description: 'What you saved each month', defaultW: 6, defaultH: 2, component: WealthVelocityWidget, props: { transactions: analyticsTransactions, accounts, currency: preferredCurrency, toDisplay: eurToDisplay } },
    { id: 'insights', name: 'Insights', icon: 'lightbulb', description: 'Low balances ahead, idle cash and unusual spending', defaultW: 6, defaultH: 2, component: InsightsWidget, props: { insights: activeInsights, onDismiss: dismissInsight, onNavigate: setCurrentPage } }
  ], [calendarTransactions, handleCalendarDay, conversionRates, periodFlowBuckets, activeInsights, dismissInsight, safeToSpend, eurToDisplay, displayToEur, toPreferred, isFirstVisit, setCushion, selectedAccounts, onOpenAccount, setCurrentPage, keyRatios, assetAllocationData, assetGroups, liabilityGroups, netWorth, income, expenses, incomeChange, expenseChange, incomeSparkline, expenseSparkline, tasks, allRecurringItems, billsAndPayments, financialGoals, recurringTransactionOverrides, saveTask, handleProcessItem, lowestBalanceForecasts, preferredCurrency, creditCardStatements, netWorthData, netWorthTrendColor, showForecast, showGoals, selectedAccountIds, outflowsByCategory, handleCategoryClick, totalAssets, totalDebt, recentTransactions, allCategories, handleTransactionClick, globalTotalAssets, globalAssetBreakdown, globalTotalDebt, globalDebtBreakdown, budgets, transactions, expenseCategories, accounts, duration, handleBudgetClick, filteredTransactions, incomeCategories, analyticsTransactions]);

  const urlTab = useUrlTab();
  const activeTab = isOverviewTab(urlTab) ? urlTab : 'summary';
  const activeView = OVERVIEW_TABS.find(view => view.id === activeTab)!;
  const layout = useMemo(() => resolveTabLayout(preferences, isMobile, activeTab), [preferences.dashboardLayouts, preferences.dashboardHiddenWidgets, isMobile, activeTab]);
  const layoutKey = overviewTabKey(activeTab, isMobile);

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
      .filter(widget => !shown.has(widget.id) && OVERVIEW_WIDGETS[widget.id]?.tab === activeTab)
      .map(widget => ({ ...widget, name: OVERVIEW_WIDGETS[widget.id].title, description: OVERVIEW_WIDGETS[widget.id].purpose }));
  }, [layout, allWidgets, activeTab]);


  const dedupedTransferSuggestions = useMemo(() => (selectedAccountIds.length === 0 ? review.transfers : review.transfers.filter(s => selectedAccountIds.includes(s.expenseTx.accountId) || selectedAccountIds.includes(s.incomeTx.accountId))), [review.transfers, selectedAccountIds]);
  const dedupedBillSuggestions = useMemo(() => (selectedAccountIds.length === 0 ? review.billMatches : review.billMatches.filter(s => selectedAccountIds.includes(s.transaction.accountId))), [review.billMatches, selectedAccountIds]);

  const totalPendingMatchesCount = dedupedTransferSuggestions.length + dedupedBillSuggestions.length;
  const { notificationCount: billsDue } = useBillNotifications({ recurringTransactions, billsAndPayments, dismissedIds: usePreferencesSelector(p => p.dismissedBillNotifications) ?? EMPTY_IDS });

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
      .reduce((sum, tx) => sum + convertToMain(tx.amount, tx.currency), 0), 2);
  }, [analyticsTransactions, analyticsSelectedAccountIds]);

  const openReview = useCallback(() => {
    setCurrentPage('Transactions');
    setUrlTab('review');
  }, [setCurrentPage]);

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
        onDelete={handleDeleteTransactions}
      />
      <AddWidgetModal isOpen={isAddWidgetModalOpen} onClose={() => setIsAddWidgetModalOpen(false)} availableWidgets={availableWidgetsToAdd} onAddWidget={addWidget} viewLabel={activeView.label} />


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
            <PageHeader
              title="Overview"
              stats={[
                { label: 'Money in this month', icon: 'arrow_downward', value: eurToDisplay(monthFlow.income), format: 'money', currency: preferredCurrency, trend: dayTrends.income },
                { label: 'Money out this month', icon: 'arrow_upward', value: eurToDisplay(monthFlow.spending), format: 'money', currency: preferredCurrency, trend: dayTrends.spending },
                { label: 'Saved this month', icon: 'savings', value: monthFlow.income > 0 ? ((monthFlow.income - monthFlow.spending) / monthFlow.income) * 100 : 0, format: 'percent' },
              ]}
              className="!mb-0"
            />
            {activeTab !== 'summary' && <p className="type-sentence !mt-1 text-muted md:!mt-2">{activeView.blurb}.</p>}
            {activeTab === 'summary' && <>
            <WrittenSummary
              facts={summaryFacts}
              isPrivate={isPrivate}
              className="!mt-1 md:!mt-2"
              onFact={fact => {
                if (fact === 'bills') setCurrentPage('Schedule & Bills');
                else if (fact === 'tasks') setCurrentPage('Tasks');
                else if (fact === 'income') setCurrentPage('Transactions');
                else openReview();
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
                  countUp
                  onOpen={() => setCurrentPage('Accounts')}
                />
              </div>
              <NeedsYou
                items={[
                  { id: 'categorise', label: 'To categorise', count: toCategorise, onOpen: openReview },
                  { id: 'transfers', label: 'Transfers to match', count: dedupedTransferSuggestions.length, onOpen: openReview },
                  { id: 'bill-matches', label: 'Bills to match', count: dedupedBillSuggestions.length, onOpen: openReview },
                  { id: 'bills', label: 'Bills due soon', count: billsDue, onOpen: () => setCurrentPage('Schedule & Bills') },
                  { id: 'tasks', label: 'Tasks due', count: tasksDue, onOpen: () => setCurrentPage('Tasks') },
                ]}
                footer={totalPendingMatchesCount > 0 && (
                  <>
                    {review.likelyCount > 0 && <Button size="sm" variant="soft" onPress={review.confirmLikely}>Confirm {review.likelyCount} likely</Button>}
                    <Button size="sm" variant="ghost" onPress={review.dismissAll}>Dismiss matches</Button>
                  </>
                )}
              />
            </div>
            </>}

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
                    <MultiSelect
                      label="Accounts"
                      options={sortAccountsByType(accounts).map(account => ({
                        id: account.id,
                        label: account.name,
                        group: account.status === 'closed' ? 'Closed' : account.type,
                      }))}
                      value={selectedAccountIds}
                      onChange={setSelectedAccountIds}
                    />
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

        return isMobile && onSyncBanks ? <PullToRefresh onRefresh={async () => { await onSyncBanks(); }}>{page}</PullToRefresh> : page;
      })()}

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

    </div>
  );
};

export default React.memo(Dashboard);
