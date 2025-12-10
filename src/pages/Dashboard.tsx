
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
    overview: ['netWorthOverTime'], // Removed 'todayWidget' as it's now hardcoded in the layout
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
             
             // Only advance the date if it is NOT a synthetic transaction.
             // Synthetic transactions (like loan payments) are auto-generated based on the schedule.
             // Once a real payment is made, the schedule logic will see it and stop generating that specific instance.
             if (!rt.isSynthetic) {
                 const postedDate = parseDateAsUTC(transactionsToSave[0].date);
                 let nextDueDate = new Date(postedDate);
                 const interval = rt.frequencyInterval || 1;
                 const startDateUTC = parseDateAsUTC(rt.startDate);
     
                 // Simple advance logic
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

  // ... (rest of the file content until MetricCard usage)

  return (
    <div className="space-y-6">
      {/* ... (Modals) ... */}
      
      {/* ... (Header) ... */}

      {/* Metrics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-cyan-600 text-white border-none relative overflow-hidden p-5 flex flex-col justify-center h-full">
            <div className="relative z-10">
                <p className="text-xs font-bold uppercase opacity-80 tracking-wider">Total Transactions</p>
                <p className="text-3xl font-extrabold mt-1 privacy-blur">{filteredTransactions.length}</p>
                <p className="text-sm opacity-80 mt-1">in selected period</p>
            </div>
            <div className="absolute -right-4 -bottom-6 text-white opacity-10">
                <span className="material-symbols-outlined text-9xl">receipt_long</span>
            </div>
        </Card>
        <MetricCard label="Total Income" value={formatCurrency(totalIncome, 'EUR')} colorClass="text-green-600 dark:text-green-400 privacy-blur" icon="arrow_downward" />
        <MetricCard label="Total Expenses" value={formatCurrency(totalExpense, 'EUR')} colorClass="text-red-600 dark:text-red-400 privacy-blur" icon="arrow_upward" />
        <MetricCard label="Net Cash Flow" value={formatCurrency(netFlow, 'EUR', { showPlusSign: true })} colorClass={`${netFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} privacy-blur`} icon="account_balance_wallet" />
      </div>
      
      {/* ... (Filter Toolbar) ... */}
      
      {/* Transaction List Card */}
      <div className="flex-1 min-w-0 relative">
        <Card className="p-0 h-full flex flex-col relative overflow-hidden border border-black/5 dark:border-white/5 shadow-sm">
            {/* ... (Selection Toolbar or Column Header) ... */}

            <div
              ref={listContainerRef}
              className="flex-grow bg-white dark:bg-dark-card"
              style={{ height: '60vh', minHeight: '400px' }}
            >
              {virtualRows.length > 0 ? (
                <VirtualizedList
                  height={listHeight}
                  itemCount={virtualRows.length}
                  estimatedItemSize={96}
                  getItemSize={getRowSize}
                  itemKey={getRowKey}
                >
                  {({ index, style }) => {
                    const row = virtualRows[index];
                    if (!row) return null;

                    if (row.type === 'header') {
                      return (
                        <div
                          style={style}
                          className="px-6 py-2 border-b border-black/5 dark:border-white/5 bg-gray-50 dark:bg-black/20 flex justify-start gap-4 items-center"
                        >
                          <span className="font-bold text-sm text-light-text dark:text-dark-text">{formatGroupDate(row.date)}</span>
                          <span className={`font-bold text-sm privacy-blur ${row.total > 0 ? 'text-green-600 dark:text-green-400' : row.total < 0 ? 'text-red-600 dark:text-red-400' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                            {formatCurrency(row.total, 'EUR', { showPlusSign: true })}
                          </span>
                        </div>
                      );
                    }

                    // ... (Transaction Row logic) ...

                    return (
                      <div
                        key={tx.id}
                        style={style}
                        className="flex items-center group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors px-6 py-3 cursor-default relative border-b border-black/5 dark:border-white/5"
                        onClick={() => { /* handle row click if needed */ }}
                        onContextMenu={(e) => openContextMenu(e, tx)}
                      >
                        {/* ... (Row Content) ... */}

                          {/* Amount */}
                          <div className={`col-span-4 md:col-span-3 lg:col-span-2 font-mono font-bold text-left text-sm whitespace-nowrap privacy-blur ${amountColor}`}>
                            {tx.isTransfer && selectedAccountIds.length === 0
                              ? '-/+ ' + formatCurrency(convertToEur(Math.abs(amount), tx.currency), 'EUR')
                              : formatCurrency(convertToEur(amount, tx.currency), 'EUR', { showPlusSign: true })}
                          </div>
                        </div>

                        {/* Action Button */}
                        <div className="w-8 flex justify-start opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          {/* ... */}
                        </div>
                      </div>
                    );
                  }}
                </VirtualizedList>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                  <span className="material-symbols-outlined text-5xl mb-2">search_off</span>
                  <p>No transactions match the current filters.</p>
                </div>
              )}
            </div>
          </Card>
      </div>
    </div>
  );
};

export default Transactions;
