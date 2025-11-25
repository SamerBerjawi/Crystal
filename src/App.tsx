// FIX: Import `useMemo` from React to resolve the 'Cannot find name' error.
import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy, useRef, Component, ErrorInfo } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Accounts = lazy(() => import('./pages/Accounts'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Budgeting = lazy(() => import('./pages/Budgeting'));
const Forecasting = lazy(() => import('./pages/Forecasting'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const SchedulePage = lazy(() => import('./pages/Schedule'));
const CategoriesPage = lazy(() => import('./pages/Categories'));
const TagsPage = lazy(() => import('./pages/Tags'));
const PersonalInfoPage = lazy(() => import('./pages/PersonalInfo'));
const DataManagement = lazy(() => import('./pages/DataImportExport'));
const PreferencesPage = lazy(() => import('./pages/Preferences'));
const AccountDetail = lazy(() => import('./pages/AccountDetail'));
const InvestmentsPage = lazy(() => import('./pages/Investments'));
const TasksPage = lazy(() => import('./pages/Tasks'));
const WarrantsPage = lazy(() => import('./pages/Warrants'));
const AIAssistantSettingsPage = lazy(() => import('./pages/AIAssistantSettings'));
const Documentation = lazy(() => import('./pages/Documentation'));
// UserManagement is removed
// FIX: Import FinancialData from types.ts
// FIX: Add `Tag` to the import from `types.ts`.
import { Page, Theme, Category, User, Transaction, Account, RecurringTransaction, RecurringTransactionOverride, WeekendAdjustment, FinancialGoal, Budget, ImportExportHistoryItem, AppPreferences, AccountType, InvestmentTransaction, Task, Warrant, ImportDataType, FinancialData, Currency, BillPayment, BillPaymentStatus, Duration, InvestmentSubType, Tag, LoanPaymentOverrides, ScheduledPayment } from './types';
import { MOCK_INCOME_CATEGORIES, MOCK_EXPENSE_CATEGORIES, LIQUID_ACCOUNT_TYPES } from './constants';
import { v4 as uuidv4 } from 'uuid';
import ChatFab from './components/ChatFab';
const Chatbot = lazy(() => import('./components/Chatbot'));
import { convertToEur, CONVERSION_RATES, arrayToCSV, downloadCSV, parseDateAsUTC } from './utils';
import { fetchYahooPrices } from './utils/investmentPrices';
import { useDebounce } from './hooks/useDebounce';
import { useAuth } from './hooks/useAuth';
import useLocalStorage from './hooks/useLocalStorage';
const OnboardingModal = lazy(() => import('./components/OnboardingModal'));
import { FinancialDataProvider } from './contexts/FinancialDataContext';
import { AccountsProvider, PreferencesProvider, TransactionsProvider, WarrantsProvider } from './contexts/DomainProviders';

const initialFinancialData: FinancialData = {
    accounts: [],
    transactions: [],
    investmentTransactions: [],
    recurringTransactions: [],
    recurringTransactionOverrides: [],
    loanPaymentOverrides: {},
    financialGoals: [],
    budgets: [],
    tasks: [],
    warrants: [],
    importExportHistory: [],
    // FIX: Add `tags` to the initial financial data structure.
    tags: [],
    incomeCategories: MOCK_INCOME_CATEGORIES, // Keep default categories
    expenseCategories: MOCK_EXPENSE_CATEGORIES,
    billsAndPayments: [],
    accountOrder: [],
    taskOrder: [],
    manualWarrantPrices: {},
    preferences: {
        currency: 'EUR (€)',
        language: 'English (en)',
        timezone: 'Europe/Brussels',
        dateFormat: 'DD/MM/YYYY',
        defaultPeriod: 'MTD',
        defaultAccountOrder: 'name',
        country: 'Belgium',
        defaultForecastPeriod: '1Y',
    },
};

const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      console.warn(`Failed to read "${key}" from localStorage.`, error);
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.warn(`Failed to write "${key}" to localStorage.`, error);
    }
  },
  removeItem: (key: string) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to remove "${key}" from localStorage.`, error);
    }
  },
};

const PageLoader: React.FC<{ label?: string }> = ({ label = 'Loading content...' }) => (
  <div className="flex items-center justify-center py-10 text-primary-500" role="status" aria-live="polite">
    <svg className="animate-spin h-8 w-8 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <span className="text-sm font-medium">{label}</span>
  </div>
);

// FIX: Explicitly define props and state interfaces for ErrorBoundary to allow correct type inference for `this.props`
interface ErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message?: string;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, message: undefined };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error?.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Crystal UI', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-light-bg dark:bg-dark-bg px-6">
          <div className="bg-white dark:bg-dark-card shadow-2xl rounded-2xl p-6 max-w-lg w-full border border-black/5 dark:border-white/10">
            <h1 className="text-xl font-semibold text-light-text dark:text-dark-text mb-2">Something went wrong</h1>
            <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm mb-4">
              {this.state.message || 'An unexpected error occurred while rendering this page.'}
            </p>
            <button
              className="px-4 py-2 rounded-lg bg-primary-500 text-white font-medium hover:bg-primary-600 transition"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}


// FIX: Changed to a default export to align with the import in index.tsx and fix the module resolution error.
const App: React.FC = () => {
  const { user, setUser, token, isAuthenticated, isLoading: isAuthLoading, error: authError, signIn, signUp, signOut, checkAuthStatus, setError: setAuthError, changePassword } = useAuth();
  const [authPage, setAuthPage] = useState<'signIn' | 'signUp'>('signIn');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoUser, setDemoUser] = useState<User | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const [currentPage, setCurrentPage] = useState<Page>('Dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [accountFilter, setAccountFilter] = useState<string | null>(null);
  const [viewingAccountId, setViewingAccountId] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    const storedTheme = safeLocalStorage.getItem('theme');
    return storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system' ? storedTheme : 'system';
  });
  
  // All financial data states
  const [preferences, setPreferences] = useState<AppPreferences>(initialFinancialData.preferences);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>(initialFinancialData.incomeCategories);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>(initialFinancialData.expenseCategories);
  const [transactions, setTransactions] = useState<Transaction[]>(initialFinancialData.transactions);
  const [investmentTransactions, setInvestmentTransactions] = useState<InvestmentTransaction[]>(initialFinancialData.investmentTransactions);
  const [accounts, setAccounts] = useState<Account[]>(initialFinancialData.accounts);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>(initialFinancialData.recurringTransactions);
  const [recurringTransactionOverrides, setRecurringTransactionOverrides] = useState<RecurringTransactionOverride[]>(initialFinancialData.recurringTransactionOverrides || []);
  const [loanPaymentOverrides, setLoanPaymentOverrides] = useState<LoanPaymentOverrides>(initialFinancialData.loanPaymentOverrides || {});
  const [financialGoals, setFinancialGoals] = useState<FinancialGoal[]>(initialFinancialData.financialGoals);
  const [budgets, setBudgets] = useState<Budget[]>(initialFinancialData.budgets);
  const [tasks, setTasks] = useState<Task[]>(initialFinancialData.tasks);
  const [warrants, setWarrants] = useState<Warrant[]>(initialFinancialData.warrants);
  const [importExportHistory, setImportExportHistory] = useState<ImportExportHistoryItem[]>(initialFinancialData.importExportHistory);
  const [billsAndPayments, setBillsAndPayments] = useState<BillPayment[]>(initialFinancialData.billsAndPayments);
  // FIX: Add state for tags and tag filtering to support the Tags feature.
  const [tags, setTags] = useState<Tag[]>(initialFinancialData.tags || []);
  const latestDataRef = useRef<FinancialData>(initialFinancialData);
  const lastSavedSignatureRef = useRef<string | null>(null);
  const skipNextSaveRef = useRef(false);
  const restoreInProgressRef = useRef(false);
  const dirtySlicesRef = useRef<Set<keyof FinancialData>>(new Set());
  const [dirtySignal, setDirtySignal] = useState(0);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [accountOrder, setAccountOrder] = useLocalStorage<string[]>('crystal-account-order', []);
  const [taskOrder, setTaskOrder] = useLocalStorage<string[]>('crystal-task-order', []);
  
  // State for AI Chat
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // State for Warrant prices
  const [manualWarrantPrices, setManualWarrantPrices] = useState<Record<string, number | undefined>>(initialFinancialData.manualWarrantPrices || {});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [investmentPrices, setInvestmentPrices] = useState<Record<string, number | null>>({});

  const warrantPrices = useMemo(() => {
    const resolved: Record<string, number | null> = {};
    warrants.forEach(warrant => {
      if (manualWarrantPrices[warrant.isin] !== undefined) {
        resolved[warrant.isin] = manualWarrantPrices[warrant.isin];
      } else {
        resolved[warrant.isin] = null;
      }
    });

    return resolved;
  }, [manualWarrantPrices, warrants]);

  // States lifted up for persistence & preference linking
  const [dashboardAccountIds, setDashboardAccountIds] = useState<string[]>([]);
  const [activeGoalIds, setActiveGoalIds] = useState<string[]>([]);
  const [dashboardDuration, setDashboardDuration] = useState<Duration>(preferences.defaultPeriod as Duration);
  const [accountsSortBy, setAccountsSortBy] = useState<'name' | 'balance' | 'manual'>(preferences.defaultAccountOrder);

  // Onboarding flow state
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useLocalStorage('crystal-onboarding-complete', false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  const markSliceDirty = useCallback((slice: keyof FinancialData) => {
    const pending = new Set(dirtySlicesRef.current);
    if (!pending.has(slice)) {
      pending.add(slice);
      dirtySlicesRef.current = pending;
      setDirtySignal(signal => signal + 1);
    }
  }, []);

  useEffect(() => {
    // Set default dashboard account filter only on initial load
    if (accounts.length > 0 && dashboardAccountIds.length === 0) {
        const primaryAccount = accounts.find(a => a.isPrimary);
        if (primaryAccount) {
            setDashboardAccountIds([primaryAccount.id]);
        } else {
            const openAccounts = accounts.filter(a => a.status !== 'closed');
            const fallbackAccount = (openAccounts.length > 0 ? openAccounts : accounts)[0];
            if (fallbackAccount) {
                setDashboardAccountIds([fallbackAccount.id]);
            }
        }
    }
  }, [accounts, dashboardAccountIds.length]);
  
  useEffect(() => {
    // Set default active goals only on initial load
    if (financialGoals.length > 0 && activeGoalIds.length === 0) {
        setActiveGoalIds(financialGoals.map(g => g.id));
    }
  }, [financialGoals, activeGoalIds.length]);

  const refreshInvestmentPrices = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const investmentAccountsWithSymbols = accounts
      .filter(acc => acc.type === 'Investment' && acc.symbol)
      .filter(acc => !warrants.some(w => w.isin === acc.symbol));

    if (investmentAccountsWithSymbols.length === 0) {
      setInvestmentPrices({});
      return;
    }

    const targets = investmentAccountsWithSymbols.map(acc => ({
      symbol: acc.symbol as string,
      subType: acc.subType,
    }));

    const prices = await fetchYahooPrices(targets);
    setInvestmentPrices(prices);
  }, [accounts, warrants]);

  const warrantHoldingsBySymbol = useMemo(() => {
    const holdings: Record<string, number> = {};

    investmentTransactions.forEach(tx => {
      if (!tx.symbol) return;
      holdings[tx.symbol] = (holdings[tx.symbol] || 0) + (tx.type === 'buy' ? tx.quantity : -tx.quantity);
    });

    warrants.forEach(warrant => {
      holdings[warrant.isin] = (holdings[warrant.isin] || 0) + warrant.quantity;
    });

    return holdings;
  }, [investmentTransactions, warrants]);

  useEffect(() => {
    let hasChanges = false;
    const updatedAccounts = accounts.map(account => {
      // FIX: The type 'Crypto' is not a valid AccountType. 'Crypto' is a subtype of 'Investment'.
      // The check is simplified to only verify if the account type is 'Investment'.
      if (account.symbol && account.type === 'Investment' && warrantPrices[account.symbol] !== undefined) {
        const price = warrantPrices[account.symbol];
        const quantity = warrantHoldingsBySymbol[account.symbol] || 0;
        const calculatedBalance = price !== null ? quantity * price : 0;

        if (Math.abs((account.balance || 0) - calculatedBalance) > 0.0001) {
            hasChanges = true;
            return { ...account, balance: calculatedBalance };
        }
      }
      if (account.symbol && account.type === 'Investment' && investmentPrices[account.symbol] !== undefined) {
        const price = investmentPrices[account.symbol];
        const quantity = warrantHoldingsBySymbol[account.symbol] || 0;
        const calculatedBalance = price !== null ? quantity * price : 0;

        if (Math.abs((account.balance || 0) - calculatedBalance) > 0.0001) {
            hasChanges = true;
            return { ...account, balance: calculatedBalance };
        }
      }
      return account;
    });

    if (hasChanges) {
        setAccounts(updatedAccounts);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warrantPrices, investmentPrices, warrantHoldingsBySymbol]);

  useEffect(() => {
    refreshInvestmentPrices();
    if (typeof window === 'undefined') return;
    const intervalId = window.setInterval(refreshInvestmentPrices, 5 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [refreshInvestmentPrices]);

  const loadAllFinancialData = useCallback((data: FinancialData | null, options?: { skipNextSave?: boolean }) => {
    const dataToLoad = data || initialFinancialData;
    setAccounts(dataToLoad.accounts || []);
    setTransactions(dataToLoad.transactions || []);
    setInvestmentTransactions(dataToLoad.investmentTransactions || []);
    setRecurringTransactions(dataToLoad.recurringTransactions || []);
    setRecurringTransactionOverrides(dataToLoad.recurringTransactionOverrides || []);
    setLoanPaymentOverrides(dataToLoad.loanPaymentOverrides || {});
    setFinancialGoals(dataToLoad.financialGoals || []);
    setBudgets(dataToLoad.budgets || []);
    setTasks(dataToLoad.tasks || []);
    setWarrants(dataToLoad.warrants || []);
    setImportExportHistory(dataToLoad.importExportHistory || []);
    setBillsAndPayments(dataToLoad.billsAndPayments || []);
    setManualWarrantPrices(dataToLoad.manualWarrantPrices || {});
    // FIX: Add `tags` to the data loading logic.
    setTags(dataToLoad.tags || []);
    setIncomeCategories(dataToLoad.incomeCategories && dataToLoad.incomeCategories.length > 0 ? dataToLoad.incomeCategories : MOCK_INCOME_CATEGORIES);
    setExpenseCategories(dataToLoad.expenseCategories && dataToLoad.expenseCategories.length > 0 ? dataToLoad.expenseCategories : MOCK_EXPENSE_CATEGORIES);
    
    const loadedPrefs = dataToLoad.preferences || initialFinancialData.preferences;
    setPreferences(loadedPrefs);
    setDashboardDuration(loadedPrefs.defaultPeriod as Duration);
    setAccountsSortBy(loadedPrefs.defaultAccountOrder);

    setAccountOrder(dataToLoad.accountOrder || []);
    setTaskOrder(dataToLoad.taskOrder || []);

    if (options?.skipNextSave) {
      skipNextSaveRef.current = true;
    }
    const dataSignature = JSON.stringify(dataToLoad);
    latestDataRef.current = dataToLoad;
    dirtySlicesRef.current.clear();
    setDirtySignal(0);
    lastSavedSignatureRef.current = dataSignature;
  }, [setAccountOrder, setTaskOrder]);
  
  const handleEnterDemoMode = () => {
    loadAllFinancialData(null); // This will load initialFinancialData
    const mockUser: User = {
        firstName: 'Demo',
        lastName: 'User',
        email: 'demo@crystal.finance',
        profilePictureUrl: `https://i.pravatar.cc/150?u=demo@crystal.finance`,
        role: 'Member',
        phone: undefined,
        address: undefined,
        is2FAEnabled: false,
        status: 'Active',
        lastLogin: new Date().toISOString(),
    };
    setDemoUser(mockUser);
    setIsDemoMode(true);
    setIsDataLoaded(true); // Manually set data as loaded for demo
  };

  // Check auth status and load data on initial load
  useEffect(() => {
    const authAndLoad = async () => {
        const data = await checkAuthStatus();
        if (data) {
          loadAllFinancialData(data, { skipNextSave: true });
        }
        setIsDataLoaded(true);
    };
    if (!isDemoMode) { // Only run if not in demo mode
      authAndLoad();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoMode]);

  // Onboarding flow trigger
  useEffect(() => {
    if (isDataLoaded && isAuthenticated && !isDemoMode && accounts.length === 0 && budgets.length === 0 && !hasCompletedOnboarding) {
      const timer = setTimeout(() => {
        setIsOnboardingOpen(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isDataLoaded, isAuthenticated, isDemoMode, accounts.length, budgets.length, hasCompletedOnboarding]);

  const handleOnboardingFinish = () => {
    setHasCompletedOnboarding(true);
    setIsOnboardingOpen(false);
  };


  const dataToSave: FinancialData = useMemo(() => ({
    accounts, transactions, investmentTransactions, recurringTransactions,
    recurringTransactionOverrides, loanPaymentOverrides, financialGoals, budgets, tasks, warrants, importExportHistory, incomeCategories,
    expenseCategories, preferences, billsAndPayments, accountOrder, taskOrder, tags, manualWarrantPrices
  }), [
    accounts, transactions, investmentTransactions,
    recurringTransactions, recurringTransactionOverrides, loanPaymentOverrides, financialGoals, budgets, tasks, warrants, importExportHistory,
    incomeCategories, expenseCategories, preferences, billsAndPayments, accountOrder, taskOrder, tags, manualWarrantPrices
  ]);

  const debouncedDirtySignal = useDebounce(dirtySignal, 900);

  const buildDirtyPayload = useCallback((dirtySlices: Set<keyof FinancialData>): FinancialData => {
    const payload: Partial<FinancialData> = {};
    if (dirtySlices.has('accounts')) payload.accounts = accounts;
    if (dirtySlices.has('transactions')) payload.transactions = transactions;
    if (dirtySlices.has('investmentTransactions')) payload.investmentTransactions = investmentTransactions;
    if (dirtySlices.has('recurringTransactions')) payload.recurringTransactions = recurringTransactions;
    if (dirtySlices.has('recurringTransactionOverrides')) payload.recurringTransactionOverrides = recurringTransactionOverrides;
    if (dirtySlices.has('loanPaymentOverrides')) payload.loanPaymentOverrides = loanPaymentOverrides;
    if (dirtySlices.has('financialGoals')) payload.financialGoals = financialGoals;
    if (dirtySlices.has('budgets')) payload.budgets = budgets;
    if (dirtySlices.has('tasks')) payload.tasks = tasks;
    if (dirtySlices.has('warrants')) payload.warrants = warrants;
    if (dirtySlices.has('importExportHistory')) payload.importExportHistory = importExportHistory;
    if (dirtySlices.has('incomeCategories')) payload.incomeCategories = incomeCategories;
    if (dirtySlices.has('expenseCategories')) payload.expenseCategories = expenseCategories;
    if (dirtySlices.has('preferences')) payload.preferences = preferences;
    if (dirtySlices.has('billsAndPayments')) payload.billsAndPayments = billsAndPayments;
    if (dirtySlices.has('accountOrder')) payload.accountOrder = accountOrder;
    if (dirtySlices.has('taskOrder')) payload.taskOrder = taskOrder;
    if (dirtySlices.has('tags')) payload.tags = tags;
    if (dirtySlices.has('manualWarrantPrices')) payload.manualWarrantPrices = manualWarrantPrices;

    return { ...latestDataRef.current, ...payload } as FinancialData;
  }, [
    accountOrder,
    accounts,
    billsAndPayments,
    budgets,
    expenseCategories,
    financialGoals,
    importExportHistory,
    incomeCategories,
    investmentTransactions,
    loanPaymentOverrides,
    preferences,
    recurringTransactionOverrides,
    recurringTransactions,
    tags,
    taskOrder,
    tasks,
    transactions,
    warrants,
    manualWarrantPrices,
  ]);
  const debouncedDataToSave = useDebounce(dataToSave, 1500);
  const debouncedDataSignature = useMemo(
    () => JSON.stringify(debouncedDataToSave),
    [debouncedDataToSave]
  );

  useEffect(() => {
    latestDataRef.current = dataToSave;
  }, [dataToSave]);

  useEffect(() => {
    if (!isDataLoaded || restoreInProgressRef.current) return;
    markSliceDirty('accounts');
  }, [accounts, isDataLoaded, markSliceDirty]);

  useEffect(() => {
    if (!isDataLoaded || restoreInProgressRef.current) return;
    markSliceDirty('transactions');
  }, [transactions, isDataLoaded, markSliceDirty]);

  useEffect(() => {
    if (!isDataLoaded || restoreInProgressRef.current) return;
    markSliceDirty('investmentTransactions');
  }, [investmentTransactions, isDataLoaded, markSliceDirty]);

  useEffect(() => {
    if (!isDataLoaded || restoreInProgressRef.current) return;
    markSliceDirty('recurringTransactions');
  }, [recurringTransactions, isDataLoaded, markSliceDirty]);

  useEffect(() => {
    if (!isDataLoaded || restoreInProgressRef.current) return;
    markSliceDirty('recurringTransactionOverrides');
  }, [recurringTransactionOverrides, isDataLoaded, markSliceDirty]);

  useEffect(() => {
    if (!isDataLoaded || restoreInProgressRef.current) return;
    markSliceDirty('loanPaymentOverrides');
  }, [loanPaymentOverrides, isDataLoaded, markSliceDirty]);

  useEffect(() => {
    if (!isDataLoaded || restoreInProgressRef.current) return;
    markSliceDirty('financialGoals');
  }, [financialGoals, isDataLoaded, markSliceDirty]);

  useEffect(() => {
    if (!isDataLoaded || restoreInProgressRef.current) return;
    markSliceDirty('budgets');
  }, [budgets, isDataLoaded, markSliceDirty]);

  useEffect(() => {
    if (!isDataLoaded || restoreInProgressRef.current) return;
    markSliceDirty('tasks');
  }, [tasks, isDataLoaded, markSliceDirty]);

  useEffect(() => {
    if (!isDataLoaded || restoreInProgressRef.current) return;
    markSliceDirty('warrants');
  }, [warrants, isDataLoaded, markSliceDirty]);

  useEffect(() => {
    if (!isDataLoaded || restoreInProgressRef.current) return;
    markSliceDirty('manualWarrantPrices');
  }, [manualWarrantPrices, isDataLoaded, markSliceDirty]);

  useEffect(() => {
    if (!isDataLoaded || restoreInProgressRef.current) return;
    markSliceDirty('importExportHistory');
  }, [importExportHistory, isDataLoaded, markSliceDirty]);

  useEffect(() => {
    if (!isDataLoaded || restoreInProgressRef.current) return;
    markSliceDirty('incomeCategories');
  }, [incomeCategories, isDataLoaded, markSliceDirty]);

  useEffect(() => {
    if (!isDataLoaded || restoreInProgressRef.current) return;
    markSliceDirty('expenseCategories');
  }, [expenseCategories, isDataLoaded, markSliceDirty]);

  useEffect(() => {
    if (!isDataLoaded || restoreInProgressRef.current) return;
    markSliceDirty('preferences');
  }, [preferences, isDataLoaded, markSliceDirty]);

  useEffect(() => {
    if (!isDataLoaded || restoreInProgressRef.current) return;
    markSliceDirty('billsAndPayments');
  }, [billsAndPayments, isDataLoaded, markSliceDirty]);

  useEffect(() => {
    if (!isDataLoaded || restoreInProgressRef.current) return;
    markSliceDirty('accountOrder');
  }, [accountOrder, isDataLoaded, markSliceDirty]);

  useEffect(() => {
    if (!isDataLoaded || restoreInProgressRef.current) return;
    markSliceDirty('taskOrder');
  }, [taskOrder, isDataLoaded, markSliceDirty]);

  useEffect(() => {
    if (!isDataLoaded || restoreInProgressRef.current) return;
    markSliceDirty('tags');
  }, [tags, isDataLoaded, markSliceDirty]);

  // Persist data to backend on change
  const saveData = useCallback(
    async (
      data: FinancialData,
      options?: { keepalive?: boolean; suppressErrors?: boolean