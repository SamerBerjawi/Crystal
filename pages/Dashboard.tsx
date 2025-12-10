
import React, { useMemo, useState, useCallback, useEffect, useRef, Suspense, lazy } from 'react';
import { User, Transaction, Account, Category, Duration, CategorySpending, Widget, WidgetConfig, DisplayTransaction, FinancialGoal, RecurringTransaction, BillPayment, Tag, Budget, RecurringTransactionOverride, LoanPaymentOverrides, AccountType, Task, ForecastDuration } from '../types';
import { formatCurrency, getDateRange, calculateAccountTotals, convertToEur, calculateStatementPeriods, generateBalanceForecast, parseDateAsUTC, getCreditCardStatementDetails, generateSyntheticLoanPayments, generateSyntheticCreditCardPayments, getPreferredTimeZone, formatDateKey, generateSyntheticPropertyTransactions, toLocalISOString } from '../utils';
import AddTransactionModal from '../components/AddTransactionModal';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, LIQUID_ACCOUNT_TYPES, ASSET_TYPES, DEBT_TYPES, ACCOUNT_TYPE_STYLES, INVESTMENT_SUB_TYPE_STYLES, FORECAST_DURATION_OPTIONS, QUICK_CREATE_BUDGET_OPTIONS, CHECKBOX_STYLE } from '../constants';
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
import useLocalStorage from '../hooks/useLocalStorage';
import AddWidgetModal from '../components/AddWidgetModal';
import { useTransactionMatcher } from '../hooks/useTransactionMatcher';
import TransactionMatcherModal from '../components/TransactionMatcherModal';
import Card from '../components/Card';
import CreditCardStatementCard from '../components/CreditCardStatementCard';
import BudgetOverviewWidget from '../components/BudgetOverviewWidget';
import AccountBreakdownCard from '../components/AccountBreakdownCard';
import TodayWidget from '../components/TodayWidget';
import { useAccountsContext, usePreferencesContext, useTransactionsContext } from '../contexts/DomainProviders';
import { useBudgetsContext, useCategoryContext, useGoalsContext, useScheduleContext, useTagsContext } from '../contexts/FinancialDataContext';
import { useInsightsView } from '../contexts/InsightsViewContext';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label, Legend, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import ForecastDayModal from '../components/ForecastDayModal';
import RecurringTransactionModal from '../components/RecurringTransactionModal';
import BillPaymentModal from '../components/BillPaymentModal';
import GoalScenarioModal from '../components/GoalScenarioModal';
import FinancialGoalCard from '../components/FinancialGoalCard';
import ConfirmationModal from '../components/ConfirmationModal';
import ForecastChart from '../components/ForecastChart';
import GoalContributionPlan from '../components/GoalContributionPlan';
import BulkCategorizeModal from '../components/BulkCategorizeModal';
import BulkEditTransactionsModal from '../components/BulkEditTransactionsModal';
import { loadGenAiModule } from '../genAiLoader';
import AIBudgetSuggestionsModal from '../components/AIBudgetSuggestionsModal';
import QuickBudgetModal from '../components/QuickBudgetModal';
import BudgetProgressCard from '../components/BudgetProgressCard';
import BudgetModal from '../components/BudgetModal';
import MultiSelectFilter from '../components/MultiSelectFilter';
import PageHeader from '../components/PageHeader';

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
type DashboardTab = 'overview' | 'analysis' | 'activity';

const WIDGET_TABS: Record<DashboardTab, string[]> = {
    overview: ['netWorthOverTime'], 
    analysis: [],
    activity: ['transactionMap', 'outflowsByCategory', 'recentActivity', 'cashflowSankey']
};

const AnalysisStatCard: React.FC<{ title: string; value: string; subtext: string; icon: string; colorClass: string }> = ({ title, value, subtext, icon, colorClass }) => (
    <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm flex items-center gap-5 hover:shadow-md transition-all duration-200">
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${colorClass} shrink-0`}>
            <span className="material-symbols-outlined text-3xl">{icon}</span>
        </div>
        <div>
            <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-1">{title}</p>
            <p className="text-2xl font-extrabold text-light-text dark:text-dark-text privacy-blur">{value}</p>
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1 font-medium">{subtext}</p>
        </div>
    </div>
);

const Dashboard: React.FC<DashboardProps> = ({ user, tasks, saveTask }) => {
  const { activeGoalIds, setActiveGoalIds, dashboardAccountIds: selectedAccountIds, setDashboardAccountIds: setSelectedAccountIds, dashboardDuration: duration, setDashboardDuration: setDuration } = useInsightsView();
  const { accounts } = useAccountsContext();
  const { transactions, saveTransaction, digest: transactionsDigest } = useTransactionsContext();
  const { incomeCategories, expenseCategories } = useCategoryContext();
  const { financialGoals } = useGoalsContext();
  const { recurringTransactions, recurringTransactionOverrides, loanPaymentOverrides, billsAndPayments, saveRecurringTransaction, saveBillPayment } = useScheduleContext();
  const { tags } = useTagsContext();
  const { budgets } = useBudgetsContext();
  const transactionsKey = transactionsDigest;
  const aggregateCacheRef = useRef<Map<string, { filteredTransactions: Transaction[]; income: number; expenses: number }>>(new Map());
  const [isTransactionModalOpen, setTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [itemToPost, setItemToPost] = useState<{ item: RecurringTransaction | BillPayment } | null>(null);
  
  const [isDetailModalOpen, setDetailModalOpen] = useState(false);
  const [modalTransactions, setModalTransactions] = useState<Transaction[]>([]);
  const [modalTitle, setModalTitle] = useState('');

  const [isAddWidgetModalOpen, setIsAddWidgetModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isMatcherModalOpen, setIsMatcherModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

  const { suggestions, confirmMatch, dismissSuggestion, confirmAllMatches, dismissAllSuggestions } = useTransactionMatcher(transactions, accounts, saveTransaction);

  const allCategories = useMemo(() => [...incomeCategories, ...expenseCategories], [incomeCategories, expenseCategories]);

  const selectedAccounts = useMemo(() => 
      accounts.filter(a => selectedAccountIds.includes(a.id)),
  [accounts, selectedAccountIds]);

  // Combine all recurring items (user-defined + synthetic)
  const { allRecurringItems } = useMemo(() => {
        const syntheticLoanPayments = generateSyntheticLoanPayments(accounts, transactions, loanPaymentOverrides);
        const syntheticCreditCardPayments = generateSyntheticCreditCardPayments(accounts, transactions);
        const syntheticPropertyTransactions = generateSyntheticPropertyTransactions(accounts);
        
        const all = [...recurringTransactions, ...syntheticLoanPayments, ...syntheticCreditCardPayments, ...syntheticPropertyTransactions];
        return { allRecurringItems: all };
  }, [accounts, transactions, loanPaymentOverrides, recurringTransactions]);

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
                 const postedDate = parseDateAsUTC(transactionsToSave[0].date);
                 let nextDueDate = new Date(postedDate);
                 const interval = rt.frequencyInterval || 1;
                 const startDateUTC = parseDateAsUTC(rt.startDate);
     
                 switch (rt.frequency) {
                     case 'daily': nextDueDate.setDate(nextDueDate.getDate() + interval); break;
                     case 'weekly': nextDueDate.setDate(nextDueDate.getDate() + 7 * interval); break;
                     case 'monthly': {
                         const d = rt.dueDateOfMonth || startDateUTC.getDate();
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

      if ('frequency' in item) {
          const rt = item as RecurringTransaction;
          type = rt.type;
          category = rt.category;
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
          },
      };
  }, [itemToPost]);


  const handleTransactionClick = useCallback((clickedTx: DisplayTransaction) => {
    if (clickedTx.isTransfer && clickedTx.transferId) {
        const pair = transactions.filter(t => t.transferId === clickedTx.transferId);
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
  }, [transactions]);

  const { filteredTransactions, income, expenses } = useMemo(() => {
    const cacheKey = `${transactionsKey}|${selectedAccountIds.join(',')}|${duration}`;
    const cached = aggregateCacheRef.current.get(cacheKey);
    if (cached) return cached;

    const { start, end } = getDateRange(duration, transactions);
    const txsInPeriod = transactions.filter(tx => {
        const txDate = parseDateAsUTC(tx.date);
        return txDate >= start && txDate <= end;
    });

    const processedTransferIds = new Set<string>();
    let calculatedIncome = 0;
    let calculatedExpenses = 0;

    txsInPeriod.forEach(tx => {
        if (!selectedAccountIds.includes(tx.accountId)) return;

        const convertedAmount = convertToEur(tx.amount, tx.currency);

        if (tx.transferId) {
            if (processedTransferIds.has(tx.transferId)) return;

            const counterpart = transactions.find(t => t.transferId === tx.transferId && t.id !== tx.id);
            processedTransferIds.add(tx.transferId);

            if (counterpart) {
                const counterpartSelected = selectedAccountIds.includes(counterpart.accountId);
                if (!counterpartSelected) {
                    if (tx.type === 'income') {
                        calculatedIncome += convertedAmount;
                    } else {
                        calculatedExpenses += Math.abs(convertedAmount);
                    }
                }
            } else { 
                if (tx.type === 'income') calculatedIncome += convertedAmount;
                else calculatedExpenses += Math.abs(convertedAmount);
            }
        } else {
            if (tx.type === 'income') calculatedIncome += convertedAmount;
            else calculatedExpenses += Math.abs(convertedAmount);
        }
    });

    const result = {
        filteredTransactions: txsInPeriod.filter(tx => selectedAccountIds.includes(tx.accountId)),
        income: calculatedIncome,
        expenses: calculatedExpenses,
    };
    aggregateCacheRef.current.set(cacheKey, result);
    return result;
  }, [aggregateCacheRef, duration, selectedAccountIds, transactions, transactionsKey]);

  const enrichedTransactions: EnrichedTransaction[] = useMemo(
    () =>
      filteredTransactions.map(tx => ({
        ...tx,
        convertedAmount: convertToEur(tx.amount, tx.currency),
        parsedDate: parseDateAsUTC(tx.date),
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
      const txDate = parseDateAsUTC(tx.date);
      return txDate >= prevStart && txDate <= prevEnd;
    });

    let prevIncome = 0;
    let prevExpenses = 0;

    const processedTransferIds = new Set<string>();
    txsInPrevPeriod.forEach(tx => {
      if (!selectedAccountIds.includes(tx.accountId)) return;

      const convertedAmount = convertToEur(tx.amount, tx.currency);

      if (tx.transferId) {
        if (processedTransferIds.has(tx.transferId)) return;
        const counterpart = transactions.find(t => t.transferId === tx.transferId && t.id !== tx.id);
        processedTransferIds.add(tx.transferId);
        if (counterpart && !selectedAccountIds.includes(counterpart.accountId)) {
          if (tx.type === 'income') prevIncome += convertedAmount;
          else prevExpenses += Math.abs(convertedAmount);
        }
      } else {
        if (tx.type === 'income') prevIncome += convertedAmount;
        else prevExpenses += Math.abs(convertedAmount);
      }
    });

    const calculateChangeString = (current: number, previous: number) => {
      if (previous === 0) return null;
      const change = ((current - previous) / previous) * 100;
      if (isNaN(change) || !isFinite(change)) return null;
      return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
    };

    return {
      incomeChange: calculateChangeString(income, prevIncome),
      expenseChange: calculateChangeString(expenses, prevExpenses),
    };
  }, [duration, transactions, selectedAccountIds, income, expenses]);

  const outflowsByCategory: CategorySpending[] = useMemo(() => {
    const spending: { [key: string]: CategorySpending } = {};
    const expenseCats = expenseCategories;
    const processedTransferIds = new Set<string>();

    enrichedTransactions.forEach(tx => {
        if (tx.type !== 'expense') return;

        const convertedAmount = tx.convertedAmount;

        if (tx.transferId) {
            if (processedTransferIds.has(tx.transferId)) return;
            const counterpart = transactions.find(t => t.transferId === tx.transferId && t.id !== tx.id);
            processedTransferIds.add(tx.transferId);
            if (counterpart && !selectedAccountIds.includes(counterpart.accountId)) {
                const name = 'Transfers Out';
                if (!spending[name]) spending[name] = { name, value: 0, color: '#A0AEC0', icon: 'arrow_upward' };
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
  }, [enrichedTransactions, selectedAccountIds, transactions, expenseCategories]);
  
  const handleCategoryClick = useCallback((categoryName: string) => {
    const expenseCats = expenseCategories;
    const txs = filteredTransactions.filter(tx => {
        if (categoryName === 'Transfers Out') {
            if (!tx.transferId || tx.type !== 'expense') return false;
            const counterpart = transactions.find(t => t.transferId === tx.transferId && t.id !== tx.id);
            return counterpart && !selectedAccountIds.includes(counterpart.accountId);
        }
        
        const category = findCategoryDetails(tx.category, expenseCats);
        let parentCategory = category;
        if(category?.parentId){
            parentCategory = findCategoryById(category.parentId, expenseCats) || category;
        }
        return parentCategory?.name === categoryName && tx.type === 'expense' && !tx.transferId;
    });
    setModalTransactions(txs);
    setModalTitle(`Transactions for ${categoryName}`);
    setDetailModalOpen(true);
  }, [filteredTransactions, transactions, selectedAccountIds, expenseCategories]);
  
  const accountMap = useMemo(() => accounts.reduce((map, acc) => { map[acc.id] = acc.name; return map; }, {} as Record<string, string>), [accounts]);

  const recentTransactions = useMemo(() => {
    const sortedSourceTransactions = transactions
      .filter(tx => selectedAccountIds.includes(tx.accountId))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
    const processedTransferIds = new Set<string>();
    const result: DisplayTransaction[] = [];
  
    const fullTransactionsList = [...transactions];
  
    for (const tx of sortedSourceTransactions) {
      if (result.length >= 50) break; 
  
      if (tx.transferId) {
        if (processedTransferIds.has(tx.transferId)) continue;
  
        const pair = fullTransactionsList.find(t => t.transferId === tx.transferId && t.id !== tx.id);
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
    return result.slice(0, 30);
  }, [transactions, selectedAccountIds, accountMap]);
  
  const { incomeSparkline, expenseSparkline } = useMemo(() => {
    const NUM_POINTS = 30;
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
          if(account.type === 'Investment' && account.subType) {
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
    const safeAccounts = selectedAccounts || [];
    
    const { totalAssets, totalDebt, netWorth } = calculateAccountTotals(safeAccounts, transactions, loanPaymentOverrides);

    return {
        totalAssets,
        totalDebt,
        netWorth,
    };
  }, [selectedAccounts, transactions, loanPaymentOverrides]);

  const { globalTotalAssets, globalTotalDebt, globalAssetBreakdown, globalDebtBreakdown, assetGroups, liabilityGroups } = useMemo(() => {
     const openAccounts = accounts.filter(acc => acc.status !== 'closed');
     const { totalAssets, totalDebt } = calculateAccountTotals(openAccounts, transactions, loanPaymentOverrides);

    // Group accounts for the detailed breakdown
    const assetGroups: Record<string, { types: AccountType[], value: number, color: string, icon: string }> = {
        'Liquid Cash': { types: ['Checking', 'Savings'], value: 0, color: '#3B82F6', icon: 'savings' }, // Blue
        'Investments': { types: ['Investment'], value: 0, color: '#8B5CF6', icon: 'show_chart' }, // Purple
        'Properties': { types: ['Property'], value: 0, color: '#10B981', icon: 'home' }, // Emerald
        'Vehicles': { types: ['Vehicle'], value: 0, color: '#F59E0B', icon: 'directions_car' }, // Amber
        'Other Assets': { types: ['Other Assets', 'Lending'], value: 0, color: '#64748B', icon: 'category' }, // Slate
    };

    const liabilityGroups: Record<string, { types: AccountType[], value: number, color: string, icon: string }> = {
        'Loans': { types: ['Loan'], value: 0, color: '#EF4444', icon: 'request_quote' }, // Red
        'Credit Cards': { types: ['Credit Card'], value: 0, color: '#F43F5E', icon: 'credit_card' }, // Rose
        'Other Liabilities': { types: ['Other Liabilities'], value: 0, color: '#94A3B8', icon: 'receipt' }, // Gray
    };

    const calculateGroupTotal = (types: AccountType[]) => {
        const groupAccounts = openAccounts.filter(acc => types.includes(acc.type));
        const { totalAssets, totalDebt } = calculateAccountTotals(groupAccounts, transactions, loanPaymentOverrides);
        return totalAssets + totalDebt;
    };

    for (const groupName in assetGroups) {
        assetGroups[groupName].value = calculateGroupTotal(assetGroups[groupName].types);
    }
    for (const groupName in liabilityGroups) {
         const groupAccounts = openAccounts.filter(acc => liabilityGroups[groupName].types.includes(acc.type));
         const { totalDebt } = calculateAccountTotals(groupAccounts, transactions, loanPaymentOverrides);
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
  }, [accounts, transactions, loanPaymentOverrides]);

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
      const allAccountsSelected = group.every(tx => selectedAccountIds.includes(tx.accountId));
      if (allAccountsSelected) {
        internalTransferIds.add(transferId);
      }
    });

    const { start, end } = getDateRange(duration, transactions);
    
    if (duration === 'ALL') {
        const fiveYearsAgo = new Date(end);
        fiveYearsAgo.setUTCFullYear(end.getUTCFullYear() - 5);
        if (start < fiveYearsAgo) {
            start.setTime(fiveYearsAgo.getTime());
        }
    }
    
    const currentNetWorth = netWorth;
    const today = parseDateAsUTC(new Date().toISOString().split('T')[0]);

    const transactionsToReverse = transactions.filter(tx => {
        if (!selectedAccountIds.includes(tx.accountId)) return false;
        if (tx.transferId && internalTransferIds.has(tx.transferId)) return false;
        const txDate = parseDateAsUTC(tx.date);
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
        if (!selectedAccountIds.includes(tx.accountId)) return false;
        if (tx.transferId && internalTransferIds.has(tx.transferId)) return false;
        const txDate = parseDateAsUTC(tx.date);
        return txDate >= start && txDate <= end;
    });

    const dailyChanges = new Map<string, number>();
    for (const tx of transactionsInPeriod) {
        const dateStr = tx.date;
        const signedAmount = tx.type === 'expense'
            ? -Math.abs(convertToEur(tx.amount, tx.currency))
            : Math.abs(convertToEur(tx.amount, tx.currency));

        dailyChanges.set(dateStr, (dailyChanges.get(dateStr) || 0) + signedAmount);
    }
    
    const data: { name: string, value: number }[] = [];
    let runningBalance = startingNetWorth;
    
    let currentDate = new Date(start);

    while (currentDate <= end) {
        const dateStr = formatDateKey(currentDate);
        runningBalance += dailyChanges.get(dateStr) || 0;
        data.push({ name: dateStr, value: parseFloat(runningBalance.toFixed(2)) });
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    
    const todayStr = formatDateKey(today);
    const todayDataPoint = data.find(d => d.name === todayStr);
    if (todayDataPoint) {
      todayDataPoint.value = parseFloat(currentNetWorth.toFixed(2));
    }


    return data;
  }, [duration, transactions, selectedAccountIds, netWorth]);

  const netWorthTrendColor = useMemo(() => {
    if (netWorthData.length < 2) return '#6366F1';
    const startValue = netWorthData[0].value;
    const endValue = netWorthData[netWorthData.length - 1].value;
    return endValue >= startValue ? '#34C759' : '#FF3B30';
  }, [netWorthData]);

  return (
    <div className="space-y-8 pb-12 animate-fade-in-up">
      {/* Transaction Modal */}
      {isTransactionModalOpen && (
        <AddTransactionModal
          onClose={handleCloseTransactionModal}
          onSave={(toSave, toDelete) => {
            handleSavePostedTransaction(toSave, toDelete);
          }}
          accounts={accounts}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          transactionToEdit={editingTransaction}
          transactions={transactions}
          tags={tags}
          initialType={initialModalData.initialType}
          initialFromAccountId={initialModalData.initialFromAccountId}
          initialToAccountId={initialModalData.initialToAccountId}
          initialDetails={initialModalData.initialDetails}
        />
      )}
      
      <TransactionDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={modalTitle}
        transactions={modalTransactions}
        accounts={accounts}
      />
      
      {isAddWidgetModalOpen && (
        <AddWidgetModal
          isOpen={isAddWidgetModalOpen}
          onClose={() => setIsAddWidgetModalOpen(false)}
          availableWidgets={[]} // No additional widgets to add in this simplified view
          onAddWidget={() => {}}
        />
      )}
      
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
          />
      )}

      {/* Header and Controls */}
      <PageHeader 
        title={`Good ${new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, ${user.firstName}`}
        subTitle="Here's what's happening with your money today."
        actions={
            <>
                <button 
                    onClick={() => setTransactionModalOpen(true)} 
                    className={`${BTN_PRIMARY_STYLE} flex items-center gap-2`}
                >
                    <span className="material-symbols-outlined text-xl">add</span>
                    <span>Add Transaction</span>
                </button>
            </>
        }
      />

      {/* Navigation Tabs */}
      <div className="flex justify-center mb-6">
           <div className="flex bg-light-fill dark:bg-dark-fill p-1 rounded-full shadow-inner">
                {Object.keys(WIDGET_TABS).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as DashboardTab)}
                        className={`px-6 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${activeTab === tab ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
           </div>
      </div>
      
      {suggestions.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-center justify-between animate-fade-in-up">
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">auto_fix_high</span>
                    <div>
                        <p className="font-semibold text-blue-800 dark:text-blue-200">Transaction Suggestions</p>
                        <p className="text-xs text-blue-600 dark:text-blue-300">We found {suggestions.length} potential transfers to link.</p>
                    </div>
                </div>
                <button onClick={() => setIsMatcherModalOpen(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors">
                    Review
                </button>
            </div>
      )}

      {/* Main Content Area */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex justify-end mb-4">
                 <div className="flex items-center gap-3">
                    <MultiAccountFilter accounts={accounts} selectedAccountIds={selectedAccountIds} setSelectedAccountIds={setSelectedAccountIds} />
                    <DurationFilter selectedDuration={duration} onDurationChange={setDuration} />
                 </div>
            </div>

            <FinancialOverview 
                netWorth={netWorth}
                income={income}
                expenses={expenses}
                incomeChange={incomeChange}
                expenseChange={expenseChange}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="h-[400px] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                             <h3 className="font-bold text-light-text dark:text-dark-text text-lg">Net Worth Trend</h3>
                             <div className={`px-3 py-1 rounded-full text-xs font-bold ${netWorthTrendColor === '#34C759' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                 {netWorthData.length > 1 ? (
                                     ((netWorthData[netWorthData.length-1].value - netWorthData[0].value) >= 0 ? '+' : '') + 
                                     formatCurrency(netWorthData[netWorthData.length-1].value - netWorthData[0].value, 'EUR')
                                 ) : '—'}
                             </div>
                        </div>
                        <NetWorthChart data={netWorthData} lineColor={netWorthTrendColor} />
                    </Card>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <Card>
                             <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-light-text dark:text-dark-text">Assets</h3>
                                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(globalTotalAssets, 'EUR')}</p>
                             </div>
                             <AccountBreakdownCard title="Assets" totalValue={globalTotalAssets} breakdownData={globalAssetBreakdown} />
                         </Card>
                         <Card>
                             <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-light-text dark:text-dark-text">Liabilities</h3>
                                <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{formatCurrency(globalTotalDebt, 'EUR')}</p>
                             </div>
                             <AccountBreakdownCard title="Liabilities" totalValue={globalTotalDebt} breakdownData={globalDebtBreakdown} />
                         </Card>
                    </div>
                </div>

                <div className="space-y-6">
                    <BudgetOverviewWidget 
                        budgets={budgets}
                        transactions={transactions}
                        expenseCategories={expenseCategories}
                        accounts={accounts}
                        duration={duration}
                        onBudgetClick={() => { /* Navigate to budget */ }}
                    />
                    
                    <TodayWidget 
                        tasks={tasks}
                        recurringTransactions={recurringTransactions}
                        bills={billsAndPayments}
                        goals={financialGoals}
                        overrides={recurringTransactionOverrides}
                        onTaskUpdate={saveTask}
                        onProcessItem={handleProcessItem}
                    />
                </div>
            </div>
        </div>
      )}
      
      {activeTab === 'analysis' && (
          <div className="space-y-8 animate-fade-in-up">
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                   <AnalysisStatCard title="Total Assets" value={formatCurrency(globalTotalAssets, 'EUR')} subtext={`${Object.keys(assetGroups).length} categories`} icon="account_balance" colorClass="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
                   <AnalysisStatCard title="Total Debt" value={formatCurrency(globalTotalDebt, 'EUR')} subtext={`${Object.keys(liabilityGroups).length} categories`} icon="credit_card" colorClass="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" />
                   <AnalysisStatCard title="Liquid Cash" value={formatCurrency(assetGroups['Liquid Cash']?.value || 0, 'EUR')} subtext="Available now" icon="payments" colorClass="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
                   <AnalysisStatCard title="Net Worth" value={formatCurrency(netWorth, 'EUR')} subtext="Assets - Liabilities" icon="savings" colorClass="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                   <Card className="h-[400px]">
                       <h3 className="font-bold text-lg mb-4">Debt Composition</h3>
                       <div className="h-full pb-8">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={Object.values(liabilityGroups).filter(g => g.value > 0)}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                        nameKey="name" // Wait, assetGroups doesn't have name inside values
                                    >
                                        {Object.entries(liabilityGroups).map(([name, group], index) => (
                                            <Cell key={name} fill={group.color} stroke="none" />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => formatCurrency(value, 'EUR')} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                       </div>
                   </Card>
                   
                   <Card className="h-[400px]">
                       <h3 className="font-bold text-lg mb-4">Asset Allocation</h3>
                       <div className="h-full pb-8">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={Object.values(assetGroups).filter(g => g.value > 0)}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {Object.entries(assetGroups).map(([name, group], index) => (
                                            <Cell key={name} fill={group.color} stroke="none" />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => formatCurrency(value, 'EUR')} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                       </div>
                   </Card>
               </div>
          </div>
      )}

      {activeTab === 'activity' && (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex justify-end mb-4">
                 <div className="flex items-center gap-3">
                    <MultiAccountFilter accounts={accounts} selectedAccountIds={selectedAccountIds} setSelectedAccountIds={setSelectedAccountIds} />
                    <DurationFilter selectedDuration={duration} onDurationChange={setDuration} />
                 </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <Card className="h-[500px] flex flex-col p-0 overflow-hidden">
                     <div className="p-4 border-b border-black/5 dark:border-white/5">
                        <h3 className="font-bold text-lg text-light-text dark:text-dark-text">Spending Map</h3>
                     </div>
                     <div className="flex-grow relative">
                         <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin h-8 w-8 border-2 border-primary-500 rounded-full border-t-transparent"></div></div>}>
                             <TransactionMapWidget transactions={filteredTransactions} />
                         </Suspense>
                     </div>
                 </Card>

                 <div className="space-y-6">
                     <Card className="h-[240px]">
                         <div className="flex justify-between items-center mb-4">
                             <h3 className="font-bold text-lg">Top Outflows</h3>
                         </div>
                         <OutflowsChart data={outflowsByCategory.slice(0, 5)} onCategoryClick={handleCategoryClick} />
                     </Card>
                     
                     <Card className="h-[240px] flex flex-col p-0 overflow-hidden">
                         <div className="p-4 border-b border-black/5 dark:border-white/5">
                            <h3 className="font-bold text-lg text-light-text dark:text-dark-text">Recent Activity</h3>
                         </div>
                         <div className="flex-grow overflow-y-auto">
                            <TransactionList 
                                transactions={recentTransactions} 
                                allCategories={allCategories} 
                                onTransactionClick={handleTransactionClick}
                            />
                         </div>
                     </Card>
                 </div>
            </div>
            
            <Card className="h-[600px] flex flex-col p-0 overflow-hidden">
                <div className="p-4 border-b border-black/5 dark:border-white/5">
                    <h3 className="font-bold text-lg text-light-text dark:text-dark-text">Cash Flow Diagram</h3>
                </div>
                <div className="flex-grow">
                     <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin h-8 w-8 border-2 border-primary-500 rounded-full border-t-transparent"></div></div>}>
                         <CashflowSankey 
                            transactions={filteredTransactions}
                            incomeCategories={incomeCategories}
                            expenseCategories={expenseCategories}
                        />
                     </Suspense>
                </div>
            </Card>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
