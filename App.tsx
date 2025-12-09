// FIX: Import `useMemo` from React to resolve the 'Cannot find name' error.
import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy, useRef, Component, ErrorInfo, startTransition } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
const SignIn = lazy(() => import('./pages/SignIn'));
const SignUp = lazy(() => import('./pages/SignUp'));
const loadDashboard = () => import('./pages/Dashboard');
const Dashboard = lazy(loadDashboard);
const loadAccounts = () => import('./pages/Accounts');
const Accounts = lazy(loadAccounts);
const loadTransactions = () => import('./pages/Transactions');
const Transactions = lazy(loadTransactions);
const loadBudgeting = () => import('./pages/Budgeting');
const Budgeting = lazy(loadBudgeting);
const loadForecasting = () => import('./pages/Forecasting');
const Forecasting = lazy(loadForecasting);
const loadSettingsPage = () => import('./pages/Settings');
const SettingsPage = lazy(loadSettingsPage);
const loadSchedulePage = () => import('./pages/Schedule');
const SchedulePage = lazy(loadSchedulePage);
const loadCategoriesPage = () => import('./pages/Categories');
const CategoriesPage = lazy(loadCategoriesPage);
const loadTagsPage = () => import('./pages/Tags');
const TagsPage = lazy(loadTagsPage);
const loadPersonalInfoPage = () => import('./pages/PersonalInfo');
const PersonalInfoPage = lazy(loadPersonalInfoPage);
const loadDataManagement = () => import('./pages/DataImportExport');
const DataManagement = lazy(loadDataManagement);
const loadPreferencesPage = () => import('./pages/Preferences');
const PreferencesPage = lazy(loadPreferencesPage);
const loadAccountDetail = () => import('./pages/AccountDetail');
// FIX: Use inline function for lazy import to avoid TypeScript error regarding 'default' property missing
const AccountDetail = lazy(() => import('./pages/AccountDetail'));
const loadInvestmentsPage = () => import('./pages/Investments');
const InvestmentsPage = lazy(loadInvestmentsPage);
const loadTasksPage = () => import('./pages/Tasks');
const TasksPage = lazy(loadTasksPage);
const loadWarrantsPage = () => import('./pages/Warrants');
const WarrantsPage = lazy(loadWarrantsPage);
const loadAIAssistantSettingsPage = () => import('./pages/AIAssistantSettings');
const AIAssistantSettingsPage = lazy(loadAIAssistantSettingsPage);
const loadDocumentation = () => import('./pages/Documentation');
const Documentation = lazy(loadDocumentation);
const loadSubscriptionsPage = () => import('./pages/Subscriptions');
const SubscriptionsPage = lazy(loadSubscriptionsPage);
const loadInvoicesPage = () => import('./pages/Invoices');
const InvoicesPage = lazy(loadInvoicesPage);

const pagePreloaders = [
  loadDashboard,
  loadAccounts,
  loadTransactions,
  loadBudgeting,
  loadForecasting,
  loadSettingsPage,
  loadSchedulePage,
  loadCategoriesPage,
  loadTagsPage,
  loadPersonalInfoPage,
  loadDataManagement,
  loadPreferencesPage,
  loadAccountDetail,
  loadInvestmentsPage,
  loadTasksPage,
  loadWarrantsPage,
  loadAIAssistantSettingsPage,
  loadDocumentation,
  loadSubscriptionsPage,
  loadInvoicesPage
];
// UserManagement is removed
// FIX: Import FinancialData from types.ts
// FIX: Add `Tag` to the import from `types.ts`.
import { Page, Theme, Category, User, Transaction, Account, RecurringTransaction, RecurringTransactionOverride, WeekendAdjustment, FinancialGoal, Budget, ImportExportHistoryItem, AppPreferences, AccountType, InvestmentTransaction, Task, Warrant, ImportDataType, FinancialData, Currency, BillPayment, BillPaymentStatus, Duration, InvestmentSubType, Tag, LoanPaymentOverrides, ScheduledPayment, Membership, Invoice } from './types';
import { MOCK_INCOME_CATEGORIES, MOCK_EXPENSE_CATEGORIES, LIQUID_ACCOUNT_TYPES } from './constants';
import { v4 as uuidv4 } from 'uuid';
import ChatFab from './components/ChatFab';
const Chatbot = lazy(() => import('./components/Chatbot'));
import { convertToEur, CONVERSION_RATES, arrayToCSV, downloadCSV, parseDateAsUTC } from './utils';
import { useDebounce } from './hooks/useDebounce';
import { useAuth } from './hooks/useAuth';
import useLocalStorage from './hooks/useLocalStorage';
const OnboardingModal = lazy(() => import('./components/OnboardingModal'));
import { FinancialDataProvider } from './contexts/FinancialDataContext';
import { AccountsProvider, PreferencesProvider, TransactionsProvider, WarrantsProvider, InvoicesProvider } from './contexts/DomainProviders';
import { InsightsViewProvider } from './contexts/InsightsViewContext';

const routePathMap: Record<Page, string> = {
  Dashboard: '/',
  Accounts: '/accounts',
  Transactions: '/transactions',
  Budget: '/budget',
  Forecasting: '/forecasting',
  Settings: '/settings',
  'Schedule & Bills': '/schedule',
  Tasks: '/tasks',
  Categories: '/categories',
  Tags: '/tags',
  'Personal Info': '/personal-info',
  'Data Management': '/data-management',
  Preferences: '/preferences',
  AccountDetail: '/accounts',
  Investments: '/investments',
  Warrants: '/warrants',
  Documentation: '/documentation',
  'AI Assistant': '/ai-assistant',
  Subscriptions: '/subscriptions',
  'Quotes & Invoices': '/invoices',
};

type RouteInfo = { page: Page; matched: boolean; accountId?: string | null };

const parseRoute = (pathname: string): RouteInfo => {
  const rawPath = pathname.split('?')[0] || '/';
  const normalizedPath = rawPath !== '/' && rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;
  const accountMatch = normalizedPath.match(/^\/accounts\/([^/]+)$/);

  if (accountMatch?.[1]) {
    return { page: 'AccountDetail', matched: true, accountId: decodeURIComponent(accountMatch[1]) };
  }

  const matchedPage = (Object.entries(routePathMap) as [Page, string][])
    .find(([, path]) => path === normalizedPath)?.[0];

  if (matchedPage) {
    return { page: matchedPage, matched: true, accountId: null };
  }

  return { page: 'Dashboard', matched: false, accountId: null };
};

const pageToPath = (page: Page, accountId?: string | null) => {
  if (page === 'AccountDetail' && accountId) {
    return `/accounts/${encodeURIComponent(accountId)}`;
  }

  return routePathMap[page] || '/';
};

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
    memberships: [],
    importExportHistory: [],
    // FIX: Add `tags` to the initial financial data structure.
    tags: [],
    incomeCategories: MOCK_INCOME_CATEGORIES, // Keep default categories
    expenseCategories: MOCK_EXPENSE_CATEGORIES,
    billsAndPayments: [],
    accountOrder: [],
    taskOrder: [],
    manualWarrantPrices: {},
    invoices: [],
    preferences: {
        currency: 'EUR (€)',
        language: 'English (en)',
        timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
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
  // FIX: Explicitly declare state property to fix TS error "Property 'state' does not exist on type 'ErrorBoundary'"
  public state: ErrorBoundaryState = { hasError: false, message: undefined };
  
  // FIX: Explicitly declare props property to fix TS error "Property 'props' does not exist on type 'ErrorBoundary'"
  declare props: Readonly<ErrorBoundaryProps>;

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
  const initialPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  const initialRoute = parseRoute(initialPath);

  const { user, setUser, token, isAuthenticated, isLoading: isAuthLoading, error: authError, signIn, signUp, signOut, checkAuthStatus, setError: setAuthError, changePassword } = useAuth();
  const [authPage, setAuthPage] = useState<'signIn' | 'signUp'>('signIn');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoUser, setDemoUser] = useState<User | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);

  const [currentPath, setCurrentPath] = useState(initialPath);
  const [currentPage, setCurrentPageState] = useState<Page>(initialRoute.page);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [viewingAccountId, setViewingAccountId] = useState<string | null>(initialRoute.accountId ?? null);
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
  const [memberships, setMemberships] = useState<Membership[]>(initialFinancialData.memberships || []);
  const [importExportHistory, setImportExportHistory] = useState<ImportExportHistoryItem[]>(initialFinancialData.importExportHistory);
  const [billsAndPayments, setBillsAndPayments] = useState<BillPayment[]>(initialFinancialData.billsAndPayments);
  const [invoices, setInvoices] = useState<Invoice[]>(initialFinancialData.invoices || []);
  // FIX: Add state for tags and tag filtering to support the Tags feature.
  const [tags, setTags] = useState<Tag[]>(initialFinancialData.tags || []);
  const latestDataRef = useRef<FinancialData>(initialFinancialData);
  const lastSavedSignatureRef = useRef<string | null>(null);
  const skipNextSaveRef = useRef(false);
  const restoreInProgressRef = useRef(false);
  const dirtySlicesRef = useRef<Set<keyof FinancialData>>(new Set());
  const [dirtySignal, setDirtySignal] = useState(0);
  const [accountOrder, setAccountOrder] = useLocalStorage<string[]>('crystal-account-order', []);
  const [taskOrder, setTaskOrder] = useLocalStorage<string[]>('crystal-task-order', []);
  const transactionsViewFilters = useRef<{ accountName?: string | null; tagId?: string | null }>({});
  
  // State for AI Chat
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // State for Warrant prices
  const [manualWarrantPrices, setManualWarrantPrices] = useState<Record<string, number | undefined>>(initialFinancialData.manualWarrantPrices || {});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // FIX: Explicitly type assetPrices to avoid 'unknown' inference and ensure type safety
  const assetPrices = useMemo<Record<string, number | null>>(() => {
    const resolved: Record<string, number | null> = {};

    accounts
      .filter(acc => acc.type === 'Investment' && acc.symbol)
      .forEach(acc => {
        const symbol = acc.symbol as string;
        resolved[symbol] = manualWarrantPrices[symbol] ?? null;
      });

    warrants.forEach(warrant => {
      const symbol = warrant.isin;
      if (resolved[symbol] === undefined) {
        resolved[symbol] = manualWarrantPrices[symbol] ?? null;
      }
    });

    Object.entries(manualWarrantPrices).forEach(([symbol, price]) => {
      if (price !== undefined) {
        resolved[symbol] = price;
      }
    });

    return resolved;
  }, [accounts, manualWarrantPrices, warrants]);

  // FIX: Explicitly type warrantPrices to avoid 'unknown' inference
  const warrantPrices = useMemo<Record<string, number | null>>(() => {
    const resolved: Record<string, number | null> = {};
    warrants.forEach(warrant => {
      const symbol = warrant.isin;
      resolved[symbol] = assetPrices[symbol] ?? null;
    });

    return resolved;
  }, [assetPrices, warrants]);

  const navigateToPath = useCallback((path: string, replace = false) => {
    if (typeof window === 'undefined') return;

    const nextPath = path || '/';
    try {
      if (replace) {
        window.history.replaceState(null, '', nextPath);
      } else {
        window.history.pushState(null, '', nextPath);
      }
    } catch (e) {
      console.warn('Navigation state update failed, falling back to in-memory navigation:', e);
    }
    setCurrentPath(nextPath);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const route = parseRoute(currentPath);
    setCurrentPageState(route.page);
    setViewingAccountId(route.accountId ?? null);

    if (!route.matched && currentPath !== '/') {
      navigateToPath('/', true);
    }
  }, [currentPath, navigateToPath]);

  useEffect(() => {
    if (isPrivacyMode) {
      document.body.classList.add('privacy-mode');
    } else {
      document.body.classList.remove('privacy-mode');
    }
  }, [isPrivacyMode]);

  const setCurrentPage = useCallback((page: Page) => {
    const targetPath = pageToPath(page, page === 'AccountDetail' ? viewingAccountId : null);
    navigateToPath(targetPath);
    setCurrentPageState(page);

    if (page !== 'AccountDetail') {
      setViewingAccountId(null);
    }
  }, [navigateToPath, viewingAccountId]);

  const handleOpenAccountDetail = useCallback((accountId: string) => {
    setViewingAccountId(accountId);
    setCurrentPageState('AccountDetail');
    navigateToPath(pageToPath('AccountDetail', accountId));
  }, [navigateToPath]);

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

  const navigateToTransactions = useCallback((filters?: { accountName?: string | null; tagId?: string | null }) => {
    transactionsViewFilters.current = {
      accountName: filters?.accountName ?? null,
      tagId: filters?.tagId ?? null,
    };
    setCurrentPage('Transactions');
  }, [setCurrentPage]);

  const clearPendingTransactionFilters = useCallback(() => {
    transactionsViewFilters.current = {};
  }, []);
  
  useEffect(() => {
      // Always sync app preference to device timezone on load to prevent "tomorrow/yesterday" bugs
      const deviceTimezone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';
      if (preferences.timezone !== deviceTimezone) {
          setPreferences(prev => ({ ...prev, timezone: deviceTimezone }));
      }
  }, [preferences.timezone]);

  const warrantHoldingsBySymbol = useMemo<Record<string, number>>(() => {
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
      if (account.symbol && account.type === 'Investment' && (assetPrices as Record<string, number | null>)[account.symbol] !== undefined) {
        const price = (assetPrices as Record<string, number | null>)[account.symbol as string];
        const quantity = (warrantHoldingsBySymbol as Record<string, number>)[account.symbol as string] || 0;
        // Fix: Explicitly checking type to silence "unknown not assignable to number" error
        const calculatedBalance = (typeof price === 'number') ? quantity * price : 0;

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
  }, [assetPrices, warrantHoldingsBySymbol]);

  const loadAllFinancialData = useCallback((data: FinancialData | null, options?: { skipNextSave?: boolean }) => {
    const dataToLoad = data || initialFinancialData;
    const loadedPrefs = dataToLoad.preferences || initialFinancialData.preferences;
    const dataSignature = JSON.stringify(dataToLoad);

    startTransition(() => {
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
      setMemberships(dataToLoad.memberships || []);
      setImportExportHistory(dataToLoad.importExportHistory || []);
      setBillsAndPayments(dataToLoad.billsAndPayments || []);
      setManualWarrantPrices(dataToLoad.manualWarrantPrices || {});
      setInvoices(dataToLoad.invoices || []);
      // FIX: Add `tags` to the data loading logic.
      setTags(dataToLoad.tags || []);
      setIncomeCategories(dataToLoad.incomeCategories && dataToLoad.incomeCategories.length > 0 ? dataToLoad.incomeCategories : MOCK_INCOME_CATEGORIES);
      setExpenseCategories(dataToLoad.expenseCategories && dataToLoad.expenseCategories.length > 0 ? dataToLoad.expenseCategories : MOCK_EXPENSE_CATEGORIES);

      setPreferences(loadedPrefs);
      
      setAccountOrder(dataToLoad.accountOrder || []);
      setTaskOrder(dataToLoad.taskOrder || []);

      dirtySlicesRef.current.clear();
      setDirtySignal(0);
      lastSavedSignatureRef.current = dataSignature;
    });

    if (options?.skipNextSave) {
      skipNextSaveRef.current = true;
    }
    latestDataRef.current = dataToLoad;
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
    recurringTransactionOverrides, loanPaymentOverrides, financialGoals, budgets, tasks, warrants, memberships, importExportHistory, incomeCategories,
    expenseCategories, preferences, billsAndPayments, accountOrder, taskOrder, tags, manualWarrantPrices, invoices
  }), [
    accounts, transactions, investmentTransactions,
    recurringTransactions, recurringTransactionOverrides, loanPaymentOverrides, financialGoals, budgets, tasks, warrants, memberships, importExportHistory,
    incomeCategories, expenseCategories, preferences, billsAndPayments, accountOrder, taskOrder, tags, manualWarrantPrices, invoices
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
    if (dirtySlices.has('memberships')) payload.memberships = memberships;
    if (dirtySlices.has('importExportHistory')) payload.importExportHistory = importExportHistory;
    if (dirtySlices.has('incomeCategories')) payload.incomeCategories = incomeCategories;
    if (dirtySlices.has('expenseCategories')) payload.expenseCategories = expenseCategories;
    if (dirtySlices.has('preferences')) payload.preferences = preferences;
    if (dirtySlices.has('billsAndPayments')) payload.billsAndPayments = billsAndPayments;
    if (dirtySlices.has('accountOrder')) payload.accountOrder = accountOrder;
    if (dirtySlices.has('taskOrder')) payload.taskOrder = taskOrder;
    if (dirtySlices.has('tags')) payload.tags = tags;
    if (dirtySlices.has('manualWarrantPrices')) payload.manualWarrantPrices = manualWarrantPrices;
    if (dirtySlices.has('invoices')) payload.invoices = invoices;

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
    memberships,
    manualWarrantPrices,
    invoices
  ]);

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
    markSliceDirty('memberships');
  }, [memberships, isDataLoaded, markSliceDirty]);

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

  useEffect(() => {
    if (!isDataLoaded || restoreInProgressRef.current) return;
    markSliceDirty('invoices');
  }, [invoices, isDataLoaded, markSliceDirty]);

  // Persist data to backend on change
  const saveData = useCallback(
    async (
      data: FinancialData,
      options?: { keepalive?: boolean; suppressErrors?: boolean }
    ): Promise<boolean> => {
      if (!token || isDemoMode) return false;
      try {
        const response = await fetch('/api/data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(data),
          keepalive: options?.keepalive,
        });

        if (!response.ok) {
          if (!options?.suppressErrors) {
            const errorText = await response.text().catch(() => '');
            console.error('Failed to save data:', errorText || response.statusText);
          }
          return false;
        }

        return true;
      } catch (error) {
        if (!options?.suppressErrors) {
          console.error('Failed to save data:', error);
        }
        return false;
      }
    },
    [token, isDemoMode]
  );

  const saveDataWithRetry = useCallback(
    async (
      data: FinancialData,
      options?: { attempts?: number }
    ): Promise<boolean> => {
      const maxAttempts = Math.max(1, options?.attempts ?? 3);
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const succeeded = await saveData(data);
        if (succeeded) {
          return true;
        }

        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
      return false;
    },
    [saveData]
  );

  useEffect(() => {
    if (!isDataLoaded || !isAuthenticated || isDemoMode || restoreInProgressRef.current) {
      return;
    }

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      dirtySlicesRef.current.clear();
      return;
    }

    if (dirtySlicesRef.current.size === 0) return;

    const dirtySlices = new Set(dirtySlicesRef.current);
    const persistDirtySlices = async () => {
      const payload = buildDirtyPayload(dirtySlices);
      const payloadSignature = JSON.stringify(payload);

      if (payloadSignature === lastSavedSignatureRef.current) {
        dirtySlicesRef.current.clear();
        return;
      }

      const succeeded = await saveData(payload);
      if (succeeded) {
        dirtySlices.forEach(slice => dirtySlicesRef.current.delete(slice));
        lastSavedSignatureRef.current = payloadSignature;
      }
    };

    persistDirtySlices();
  }, [buildDirtyPayload, debouncedDirtySignal, isAuthenticated, isDataLoaded, isDemoMode, saveData]);

  useEffect(() => {
    if (!isAuthenticated || isDemoMode || typeof window === 'undefined') {
      return;
    }

    const handleBeforeUnload = () => {
      if (!isDataLoaded || dirtySlicesRef.current.size === 0) {
        return;
      }

      const dirtySlices = new Set(dirtySlicesRef.current);
      const payload = buildDirtyPayload(dirtySlices);
      const payloadSignature = JSON.stringify(payload);

      if (payloadSignature === lastSavedSignatureRef.current) {
        return;
      }

      saveData(payload, { keepalive: true, suppressErrors: true })
        .then(succeeded => {
          if (succeeded) {
            lastSavedSignatureRef.current = payloadSignature;
          }
        })
        .catch(() => {
          // Avoid blocking the unload flow on errors
        });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [buildDirtyPayload, isAuthenticated, isDataLoaded, isDemoMode, saveData]);
  
  // Keep accountOrder in sync with accounts list
  useEffect(() => {
    if (accounts.length > accountOrder.length) {
        const orderedAccountIds = new Set(accountOrder);
        const newAccountIds = accounts.filter(acc => !orderedAccountIds.has(acc.id)).map(acc => acc.id);
        setAccountOrder(prev => [...prev, ...newAccountIds]);
    } else if (accounts.length < accountOrder.length) {
        const accountIds = new Set(accounts.map(a => a.id));
        setAccountOrder(prev => prev.filter(id => accountIds.has(id)));
    }
  }, [accounts, accountOrder, setAccountOrder]);

  // Keep taskOrder in sync with tasks list
  useEffect(() => {
    if (tasks.length > taskOrder.length) {
        const orderedTaskIds = new Set(taskOrder);
        const newTaskIds = tasks.filter(task => !orderedTaskIds.has(task.id)).map(task => task.id);
        setTaskOrder(prev => [...prev, ...newTaskIds]);
    } else if (tasks.length < taskOrder.length) {
        const taskIds = new Set(tasks.map(t => t.id));
        setTaskOrder(prev => prev.filter(id => taskIds.has(id)));
    }
  }, [tasks, taskOrder, setTaskOrder]);

  // Auth handlers
  const handleSignIn = async (email: string, password: string) => {
    setIsDataLoaded(false);
    const financialData = await signIn(email, password);
    if (financialData) {
      loadAllFinancialData(financialData, { skipNextSave: true });
    }
    setIsDataLoaded(true);
  };

  const handleSignUp = async (newUserData: { firstName: string, lastName: string, email: string, password: string }) => {
    setIsDataLoaded(false);
    const financialData = await signUp(newUserData);
    if (financialData) {
      loadAllFinancialData(financialData, { skipNextSave: true });
    }
    setIsDataLoaded(true);
  };

  const finalizeLogout = useCallback(() => {
    signOut();
    loadAllFinancialData(null); // Reset all states
    setHasCompletedOnboarding(false); // Also reset onboarding status
    setAuthPage('signIn');
    setIsDemoMode(false);
    setDemoUser(null);
  }, [
    signOut,
    loadAllFinancialData,
    setHasCompletedOnboarding,
    setAuthPage,
    setIsDemoMode,
    setDemoUser,
  ]);

  const handleLogout = useCallback(() => {
    if (!isDemoMode && isAuthenticated && isDataLoaded) {
      saveData(latestDataRef.current)
        .catch(err => console.error('Failed to save data before logout:', err))
        .finally(finalizeLogout);
      return;
    }
    finalizeLogout();
  }, [finalizeLogout, isAuthenticated, isDataLoaded, isDemoMode, saveData]);

  const handleSetUser = useCallback((updates: Partial<User>) => {
    if (isDemoMode) {
        setDemoUser(prev => prev ? {...prev, ...updates} as User : null);
    } else {
        setUser(updates);
    }
  }, [isDemoMode, setUser]);

  const handleSaveAccount = (accountData: Omit<Account, 'id'> & { id?: string }) => {
    if (accountData.id) { // UPDATE
        setAccounts(prev => {
            // First, apply the update to the target account
            const intermediateAccounts = prev.map(acc => acc.id === accountData.id ? { ...acc, ...accountData } as Account : acc);

            // If this account is now primary, ensure no other account OF THE SAME TYPE is primary
            if (accountData.isPrimary) {
                return intermediateAccounts.map(acc => {
                    // If it's the same type but a different ID, unset primary
                    if (acc.type === accountData.type && acc.id !== accountData.id && acc.isPrimary) {
                        return { ...acc, isPrimary: false };
                    }
                    return acc;
                });
            }
            return intermediateAccounts;
        });
    } else { // ADD
        const newAccount = { ...accountData, id: `acc-${uuidv4()}`, status: 'open' as const } as Account;
        setAccounts(prev => {
            let newAccounts = [...prev, newAccount];
            if (newAccount.isPrimary) {
                newAccounts = newAccounts.map(acc => {
                    if (acc.type === newAccount.type && acc.id !== newAccount.id && acc.isPrimary) {
                        return { ...acc, isPrimary: false };
                    }
                    return acc;
                });
            }
            return newAccounts;
        });
    }
  };

  const handleToggleAccountStatus = (accountId: string) => {
    setAccounts(prev => prev.map(acc => 
        acc.id === accountId 
            ? { ...acc, status: acc.status === 'closed' ? 'open' : 'closed' } 
            : acc
    ));
  };

  const handleDeleteAccount = useCallback((accountId: string) => {
    const accountToDelete = accounts.find(acc => acc.id === accountId);
    const impactedRecurringIds = new Set(
      recurringTransactions
        .filter(rt => rt.accountId === accountId || rt.toAccountId === accountId)
        .map(rt => rt.id)
    );

    setAccounts(prev => prev.filter(acc => acc.id !== accountId));
    setTransactions(prev => prev.filter(tx => tx.accountId !== accountId));
    setRecurringTransactions(prev =>
      prev.filter(rt => rt.accountId !== accountId && rt.toAccountId !== accountId)
    );
    if (impactedRecurringIds.size > 0) {
      setRecurringTransactionOverrides(prev =>
        prev.filter(override => !impactedRecurringIds.has(override.recurringTransactionId))
      );
    }
    setBillsAndPayments(prev => prev.filter(bill => bill.accountId !== accountId));

    if (viewingAccountId === accountId) {
      setViewingAccountId(null);
      setCurrentPage('Accounts');
    }
  }, [
    accounts,
    recurringTransactions,
    viewingAccountId,
    setCurrentPage,
  ]);


    const handleSaveTransaction = useCallback((
    transactionDataArray: (Omit<Transaction, 'id'> & { id?: string })[],
    transactionIdsToDelete: string[] = []
  ) => {
    const balanceChanges: Record<string, number> = {}; // Stores changes in EUR
    const transactionsToUpdate: Transaction[] = [];
    const transactionsToAdd: Transaction[] = [];

    // Part 1: Calculate balance changes from deletions
    if (transactionIdsToDelete.length > 0) {
        const currentTransactions = transactions; // Use a snapshot of current state
        const transactionsToDelete = currentTransactions.filter(t => transactionIdsToDelete.includes(t.id));
        transactionsToDelete.forEach(tx => {
            const account = accounts.find(a => a.id === tx.accountId);
            let changeAmount = tx.amount;
            if (account?.type === 'Loan' && tx.type === 'income' && tx.principalAmount != null) {
                changeAmount = tx.principalAmount;
            }
            const changeInEur = convertToEur(changeAmount, tx.currency);
            balanceChanges[tx.accountId] = (balanceChanges[tx.accountId] || 0) - changeInEur;
        });
    }

    // Part 2: Process transactions to save/update
    transactionDataArray.forEach(transactionData => {
        if (transactionData.id && transactions.some(t => t.id === transactionData.id)) {
            const updatedTx = { ...transactions.find(t => t.id === transactionData.id), ...transactionData } as Transaction;
            const originalTx = transactions.find(t => t.id === updatedTx.id);

            if (originalTx) {
                // Revert original transaction amount from its account
                const originalAccount = accounts.find(a => a.id === originalTx.accountId);
                let originalChangeAmount = originalTx.amount;
                if (originalAccount?.type === 'Loan' && originalTx.type === 'income' && originalTx.principalAmount != null) {
                    originalChangeAmount = originalTx.principalAmount;
                }
                const originalChangeInEur = convertToEur(originalChangeAmount, originalTx.currency);
                balanceChanges[originalTx.accountId] = (balanceChanges[originalTx.accountId] || 0) - originalChangeInEur;
                
                // Apply new transaction amount to its account (which might be new)
                const updatedAccount = accounts.find(a => a.id === updatedTx.accountId);
                let updatedChangeAmount = updatedTx.amount;
                if (updatedAccount?.type === 'Loan' && updatedTx.type === 'income' && updatedTx.principalAmount != null) {
                    updatedChangeAmount = updatedTx.principalAmount;
                }
                const updatedChangeInEur = convertToEur(updatedChangeAmount, updatedTx.currency);
                balanceChanges[updatedTx.accountId] = (balanceChanges[updatedTx.accountId] || 0) + updatedChangeInEur;
                transactionsToUpdate.push(updatedTx);
            }
        } else {
            const newTx: Transaction = {
                ...transactionData,
                category: transactionData.category || 'Transfer', // Default category for transfers
                id: `txn-${uuidv4()}`
            } as Transaction;
            const account = accounts.find(a => a.id === newTx.accountId);
            let changeAmount = newTx.amount;
            if (account?.type === 'Loan' && newTx.type === 'income' && newTx.principalAmount != null) {
                changeAmount = newTx.principalAmount;
            }
            const newChangeInEur = convertToEur(changeAmount, newTx.currency);
            balanceChanges[newTx.accountId] = (balanceChanges[newTx.accountId] || 0) + newChangeInEur;
            transactionsToAdd.push(newTx);
        }
    });

    // Part 3: Apply combined state updates
    setTransactions(prev => {
        let intermediateState = prev;
        // First, filter out deleted transactions if any
        if (transactionIdsToDelete.length > 0) {
            intermediateState = prev.filter(t => !transactionIdsToDelete.includes(t.id));
        }
        
        // Then, apply updates
        const updatedTransactions = intermediateState.map(t => {
            const foundUpdate = transactionsToUpdate.find(ut => ut.id === t.id);
            return foundUpdate ? foundUpdate : t;
        });

        // Finally, add new transactions
        return [...updatedTransactions, ...transactionsToAdd];
    });

    setAccounts(prevAccounts => 
        prevAccounts.map(account => {
            if (balanceChanges[account.id]) {
                // Convert the EUR change back to the account's native currency
                const changeInAccountCurrency = balanceChanges[account.id] / (CONVERSION_RATES[account.currency] || 1);
                const newBalance = account.balance + changeInAccountCurrency;
                return {
                    ...account,
                    balance: parseFloat(newBalance.toFixed(account.currency === 'BTC' ? 8 : 2))
                };
            }
            return account;
        })
    );
  }, [accounts, transactions]);

  const handleDeleteTransactions = (transactionIds: string[]) => {
    if (transactionIds.length > 0) {
      handleSaveTransaction([], transactionIds);
    }
  };
  
  const handleSaveInvestmentTransaction = (
    invTxData: Omit<InvestmentTransaction, 'id'> & { id?: string },
    cashTxData?: Omit<Transaction, 'id'>,
    newAccount?: Omit<Account, 'id'>
  ) => {
      if (invTxData.id) { 
           setInvestmentTransactions(prev => prev.map(t => t.id === invTxData.id ? {...t, ...invTxData} as InvestmentTransaction : t));
      } else { // Adding new
          const newInvTx = { ...invTxData, id: `inv-txn-${uuidv4()}` } as InvestmentTransaction;
          setInvestmentTransactions(prev => [...prev, newInvTx]);
          if (cashTxData) {
              handleSaveTransaction([cashTxData]);
          }
          if (newAccount) {
              handleSaveAccount(newAccount);
          }
      }
  };

  const handleDeleteInvestmentTransaction = (id: string) => {
      setInvestmentTransactions(prev => prev.filter(t => t.id !== id));
  };


  const handleSaveRecurringTransaction = (recurringData: Omit<RecurringTransaction, 'id'> & { id?: string }) => {
    if (recurringData.id) {
        setRecurringTransactions(prev => prev.map(rt => rt.id === recurringData.id ? { ...rt, ...recurringData } as RecurringTransaction : rt));
    } else {
        const newRecurringTx: RecurringTransaction = {
            ...recurringData,
            id: `rec-${uuidv4()}`,
        } as RecurringTransaction;
        setRecurringTransactions(prev => [...prev, newRecurringTx]);
    }
  };

  const handleDeleteRecurringTransaction = (id: string) => {
    setRecurringTransactions(prev => prev.filter(rt => rt.id !== id));
  };

  const handleSaveLoanPaymentOverrides = (accountId: string, overrides: Record<number, Partial<ScheduledPayment>>) => {
    setLoanPaymentOverrides(prev => ({ ...prev, [accountId]: overrides }));
  };

  const handleSaveRecurringOverride = (override: RecurringTransactionOverride) => {
    setRecurringTransactionOverrides(prev => {
      const existingIndex = prev.findIndex(o => o.recurringTransactionId === override.recurringTransactionId && o.originalDate === override.originalDate);
      if (existingIndex > -1) {
        const newOverrides = [...prev];
        newOverrides[existingIndex] = { ...newOverrides[existingIndex], ...override };
        return newOverrides;
      }
      return [...prev, override];
    });
  };

  const handleDeleteRecurringOverride = (recurringTransactionId: string, originalDate: string) => {
    setRecurringTransactionOverrides(prev => 
      prev.filter(o => !(o.recurringTransactionId === recurringTransactionId && o.originalDate === originalDate))
    );
  };
  
  const handleSaveFinancialGoal = (goalData: Omit<FinancialGoal, 'id'> & { id?: string }) => {
    if (goalData.id) {
      setFinancialGoals((prev) => prev.map((g) => (g.id === goalData.id ? { ...g, ...goalData } as FinancialGoal : g)));
    } else {
      const newGoal: FinancialGoal = { ...goalData, id: `goal-${uuidv4()}` } as FinancialGoal;
      setFinancialGoals((prev) => [...prev, newGoal]);
    }
  };

  const handleDeleteFinancialGoal = (id: string) => {
    const goalToDelete = financialGoals.find((g) => g.id === id);
    if (!goalToDelete) return;
  
    let idsToDelete = [id];
    if (goalToDelete.isBucket) {
      const childIds = financialGoals.filter((g) => g.parentId === id).map((g) => g.id);
      idsToDelete.push(...childIds);
    }
  
    setFinancialGoals((prev) => prev.filter((g) => !idsToDelete.includes(g.id)));
  };
  
  const handleSaveBudget = (budgetData: Omit<Budget, 'id'> & { id?: string }) => {
    if (budgetData.id) {
        setBudgets(prev => prev.map(b => b.id === budgetData.id ? { ...b, ...budgetData } as Budget : b));
    } else {
        const newBudget: Budget = { ...budgetData, id: `bud-${uuidv4()}` } as Budget;
        setBudgets(prev => [...prev, newBudget]);
    }
  };

  const handleDeleteBudget = (id: string) => {
    setBudgets(prev => prev.filter(b => b.id !== id));
  };

  const handleSaveTask = (taskData: Omit<Task, 'id'> & { id?: string }) => {
    if (taskData.id) {
        setTasks(prev => prev.map(t => t.id === taskData.id ? { ...t, ...taskData } as Task : t));
    } else {
        const newTask: Task = { ...taskData, id: `task-${uuidv4()}` } as Task;
        setTasks(prev => [...prev, newTask]);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const handleSaveWarrant = (warrantData: Omit<Warrant, 'id'> & { id?: string }) => {
    const isNewWarrant = !warrantData.id;

    if (!isNewWarrant) { // Editing
        setWarrants(prev => prev.map(w => w.id === warrantData.id ? { ...w, ...warrantData } as Warrant : w));
    } else { // Adding new
        const newWarrant: Warrant = { ...warrantData, id: `warr-${uuidv4()}` } as Warrant;
        setWarrants(prev => [...prev, newWarrant]);

        const accountExists = accounts.some(acc => acc.symbol === warrantData.isin.toUpperCase());
        if (!accountExists) {
            const newAccount: Omit<Account, 'id'> = {
                name: warrantData.name,
                type: 'Investment', 
                subType: 'ETF',
                symbol: warrantData.isin.toUpperCase(),
                balance: 0, 
                currency: 'EUR',
            };
            handleSaveAccount(newAccount);
        }
    }
  };

  const handleDeleteWarrant = (warrantId: string) => {
    const warrantToDelete = warrants.find(w => w.id === warrantId);
    setWarrants(prev => prev.filter(w => w.id !== warrantId));

    if (warrantToDelete) {
      const targetIsin = warrantToDelete.isin;
      setManualWarrantPrices(prev => {
        const updated = { ...prev };
        delete updated[targetIsin];
        return updated;
      });
    }
  };

  const handleManualWarrantPrice = (isin: string, price: number | null) => {
    setManualWarrantPrices(prev => {
      const updated = { ...prev };
      if (price === null) {
        delete updated[isin];
      } else {
        updated[isin] = price;
      }
      return updated;
    });
    setLastUpdated(new Date());
  };
  
  // FIX: Add handlers for saving and deleting tags.
  const handleSaveTag = (tagData: Omit<Tag, 'id'> & { id?: string }) => {
    if (tagData.id) {
        setTags(prev => prev.map(t => (t.id === tagData.id ? { ...t, ...tagData } as Tag : t)));
    } else {
        const newTag: Tag = { ...tagData, id: `tag-${uuidv4()}` } as Tag;
        setTags(prev => [...prev, newTag]);
    }
  };

  const handleDeleteTag = (tagId: string) => {
      setTags(prev => prev.filter(t => t.id !== tagId));
      // Also remove this tagId from all transactions
      setTransactions(prev =>
          prev.map(tx => {
              if (tx.tagIds?.includes(tagId)) {
                  return { ...tx, tagIds: tx.tagIds.filter(id => id !== tagId) };
              }
              return tx;
          })
      );
      // Fix: Check ref instead of unknown state
      if (transactionsViewFilters.current.tagId === tagId) {
          transactionsViewFilters.current.tagId = null;
      }
  };
  
  const handleSaveBillPayment = (billData: Omit<BillPayment, 'id'> & { id?: string }) => {
    if (billData.id) {
        setBillsAndPayments(prev => prev.map(b => b.id === billData.id ? {...b, ...billData} as BillPayment : b));
    } else {
        const newBill: BillPayment = { ...billData, id: `bill-${uuidv4()}` } as BillPayment;
        setBillsAndPayments(prev => [...prev, newBill]);
    }
  };

  const handleDeleteBillPayment = (billId: string) => {
    setBillsAndPayments(prev => prev.filter(b => b.id !== billId));
  };

  const handleMarkBillAsPaid = (billId: string, paymentAccountId: string, paymentDate: string) => {
    const bill = billsAndPayments.find(b => b.id === billId);
    if (!bill) return;

    setBillsAndPayments(prev => prev.map(b => 
        b.id === billId ? { ...b, status: 'paid' as BillPaymentStatus, accountId: paymentAccountId, dueDate: paymentDate } : b
    ));

    const paymentAccount = accounts.find(a => a.id === paymentAccountId);
    if (paymentAccount) {
        const transactionData: Omit<Transaction, 'id'> = {
            accountId: paymentAccountId,
            date: paymentDate,
            description: bill.description,
            amount: bill.amount,
            category: bill.amount >= 0 ? 'Income' : 'Bills & Utilities',
            type: bill.amount >= 0 ? 'income' : 'expense',
            currency: paymentAccount.currency,
        };
        handleSaveTransaction([transactionData]);
    }
  };
  
  const handleSaveMembership = (membershipData: Omit<Membership, 'id'> & { id?: string }) => {
    if (membershipData.id) {
      setMemberships(prev => prev.map(m => m.id === membershipData.id ? { ...m, ...membershipData } as Membership : m));
    } else {
      const newMembership: Membership = { ...membershipData, id: `mem-${uuidv4()}` } as Membership;
      setMemberships(prev => [...prev, newMembership]);
    }
  };

  const handleDeleteMembership = (membershipId: string) => {
    setMemberships(prev => prev.filter(m => m.id !== membershipId));
  };

  const handleSaveInvoice = (invoiceData: Omit<Invoice, 'id'> & { id?: string }) => {
      if (invoiceData.id) {
          setInvoices(prev => prev.map(inv => inv.id === invoiceData.id ? { ...inv, ...invoiceData } as Invoice : inv));
      } else {
          const newInvoice: Invoice = { ...invoiceData, id: `inv-${uuidv4()}` } as Invoice;
          setInvoices(prev => [...prev, newInvoice]);
      }
  };

  const handleDeleteInvoice = (id: string) => {
      setInvoices(prev => prev.filter(inv => inv.id !== id));
  };

  // --- Data Import / Export ---
  const handlePublishImport = (
    items: (Omit<Account, 'id'> | Omit<Transaction, 'id'>)[],
    dataType: ImportDataType,
    fileName: string,
    originalData: Record<string, any>[],
    errors: Record<number, Record<string, string>>,
    newAccounts?: Account[]
  ) => {
      const importId = `imp-${uuidv4()}`;
      
      // First save any new accounts created during import mapping
      if (newAccounts && newAccounts.length > 0) {
          newAccounts.forEach(acc => handleSaveAccount(acc));
      }

      if (dataType === 'accounts') {
          const newAccounts = items as Omit<Account, 'id'>[];
          newAccounts.forEach(acc => handleSaveAccount(acc));
      } 
      else if (dataType === 'transactions') {
          const newTransactions = items as Omit<Transaction, 'id'>[];
          const transactionsWithImportId = newTransactions.map(t => ({ ...t, importId }));
          handleSaveTransaction(transactionsWithImportId);
      }
      setImportExportHistory(prev => [...prev, {
          id: importId, type: 'import', dataType, fileName, date: new Date().toISOString(),
          status: Object.keys(errors).length > 0 ? 'Failed' : 'Complete',
          itemCount: items.length, importedData: originalData, errors,
      }]);
  };
  
  const handleDeleteHistoryItem = (id: string) => {
    setImportExportHistory(prev => prev.filter(item => item.id !== id));
  };
  
  const handleDeleteImportedTransactions = (importId: string) => {
    const idsToDelete = transactions.filter(t => t.importId === importId).map(t => t.id);
    if (idsToDelete.length > 0) handleDeleteTransactions(idsToDelete);
  };

  const handleResetAccount = () => {
    if (user) {
        loadAllFinancialData(initialFinancialData);
        alert("Client-side data has been reset.");
    }
  };
  
  const handleExportAllData = () => {
      const blob = new Blob([JSON.stringify(dataToSave)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crystal-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleImportAllData = (file: File) => {
    if (!isAuthenticated && !isDemoMode) {
        // This case should not happen as the UI is not available, but as a safeguard.
        alert("You must be logged in to restore data.");
        return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const data = JSON.parse(event.target?.result as string);
            // A more robust check for a valid backup file.
            if (data && typeof data === 'object' && Array.isArray(data.accounts) && Array.isArray(data.transactions)) {
                // Restores should immediately persist to the backend. Skip any pending
                // autosave (which might still contain stale data) and temporarily pause
                // the persistence effect while we write the imported payload.
                restoreInProgressRef.current = true;
                skipNextSaveRef.current = true;
                loadAllFinancialData(data as FinancialData);
                try {
                    if (!isDemoMode) {
                        const normalizedData = latestDataRef.current;
                        const saveSucceeded = await saveDataWithRetry(normalizedData);
                        if (!saveSucceeded) {
                            alert('Data was loaded locally, but we could not reach the server after multiple attempts. Please try again in a moment.');
                            return;
                        }
                    }
                    if (isDemoMode) {
                        alert('Data successfully restored for this demo session! Note: Changes will not be saved.');
                    } else {
                        alert('Data successfully restored!');
                    }
                } finally {
                    restoreInProgressRef.current = false;
                    skipNextSaveRef.current = false;
                }
            } else {
                throw new Error('Invalid backup file format. The file must contain "accounts" and "transactions" arrays.');
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : 'It may be corrupted or in the wrong format.';
            alert(`Error reading backup file. ${message}`);
            console.error(e);
        }
    };
    reader.readAsText(file);
  };
  
  const handleExportCSV = (types: ImportDataType[]) => {
      const dataMap = {
          accounts,
          transactions,
          investments: investmentTransactions,
          budgets,
          schedule: recurringTransactions,
          categories: [...incomeCategories, ...expenseCategories],
      };

      types.forEach(type => {
          const key = type as keyof typeof dataMap;
          if (dataMap[key] && Array.isArray(dataMap[key])) {
              const csv = arrayToCSV(dataMap[key]);
              downloadCSV(csv, `crystal_${type}_${new Date().toISOString().split('T')[0]}.csv`);
          }
      });
  };

  useEffect(() => {
    if (theme === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', systemPrefersDark);
    } else {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
    safeLocalStorage.setItem('theme', theme);
  }, [theme]);
  
  const viewingAccount = useMemo(() => accounts.find(a => a.id === viewingAccountId), [accounts, viewingAccountId]);
  const currentUser = useMemo(() => isDemoMode ? demoUser : user, [isDemoMode, demoUser, user]);

  // Reset the account detail view if the referenced account no longer exists to avoid state updates during render
  useEffect(() => {
    if (viewingAccountId && !viewingAccount) {
      setViewingAccountId(null);
      setCurrentPage('Dashboard');
    }
  }, [viewingAccount, viewingAccountId]);

  const renderPage = () => {
    if (viewingAccountId) {
      if (viewingAccount) {
        return <AccountDetail
          account={viewingAccount}
          setCurrentPage={setCurrentPage}
          setViewingAccountId={setViewingAccountId}
          saveAccount={handleSaveAccount}
        />
      }
      return <PageLoader label="Loading account..." />;
    }

    switch (currentPage) {
      case 'Dashboard':
        return <Dashboard
            user={currentUser!}
            incomeCategories={incomeCategories}
            expenseCategories={expenseCategories}
            financialGoals={financialGoals}
            recurringTransactions={recurringTransactions} 
            recurringTransactionOverrides={recurringTransactionOverrides}
            loanPaymentOverrides={loanPaymentOverrides}
            tasks={tasks}
            saveTask={handleSaveTask}
        />;
      case 'Accounts':
        return <Accounts accounts={accounts} transactions={transactions} saveAccount={handleSaveAccount} deleteAccount={handleDeleteAccount} setCurrentPage={setCurrentPage} setViewingAccountId={setViewingAccountId} onViewAccount={handleOpenAccountDetail} saveTransaction={handleSaveTransaction} accountOrder={accountOrder} setAccountOrder={setAccountOrder} initialSortBy={preferences.defaultAccountOrder} warrants={warrants} onToggleAccountStatus={handleToggleAccountStatus} onNavigateToTransactions={navigateToTransactions} />;
      case 'Transactions':
        return <Transactions initialAccountFilter={transactionsViewFilters.current.accountName ?? null} initialTagFilter={transactionsViewFilters.current.tagId ?? null} onClearInitialFilters={clearPendingTransactionFilters} />;
      case 'Budget':
        // FIX: Add `preferences` to the `Budgeting` component to resolve the missing prop error.
        return <Budgeting budgets={budgets} transactions={transactions} expenseCategories={expenseCategories} saveBudget={handleSaveBudget} deleteBudget={handleDeleteBudget} accounts={accounts} preferences={preferences} />;
      case 'Forecasting':
        return <Forecasting />;
      case 'Settings':
        return <SettingsPage setCurrentPage={setCurrentPage} user={currentUser!} />;
      case 'Schedule & Bills':
        return <SchedulePage />;
      case 'Categories':
        return <CategoriesPage incomeCategories={incomeCategories} setIncomeCategories={setIncomeCategories} expenseCategories={expenseCategories} setExpenseCategories={setExpenseCategories} setCurrentPage={setCurrentPage} />;
      case 'Tags':
        return <TagsPage tags={tags} transactions={transactions} saveTag={handleSaveTag} deleteTag={handleDeleteTag} setCurrentPage={setCurrentPage} onNavigateToTransactions={navigateToTransactions} />;
      case 'Personal Info':
        return <PersonalInfoPage user={currentUser!} setUser={handleSetUser} onChangePassword={changePassword} setCurrentPage={setCurrentPage} />;
      case 'Data Management':
        return <DataManagement 
            accounts={accounts} transactions={transactions} budgets={budgets} recurringTransactions={recurringTransactions} allCategories={[...incomeCategories, ...expenseCategories]} history={importExportHistory} 
            onPublishImport={handlePublishImport} onDeleteHistoryItem={handleDeleteHistoryItem} onDeleteImportedTransactions={handleDeleteImportedTransactions}
            onResetAccount={handleResetAccount} onExportAllData={handleExportAllData} onImportAllData={handleImportAllData} onExportCSV={handleExportCSV}
            setCurrentPage={setCurrentPage}
            />;
      case 'Preferences':
        return <PreferencesPage preferences={preferences} setPreferences={setPreferences} theme={theme} setTheme={setTheme} setCurrentPage={setCurrentPage} />;
      case 'Investments':
        return <InvestmentsPage accounts={accounts} cashAccounts={accounts.filter(a => a.type === 'Checking' || a.type === 'Savings')} investmentTransactions={investmentTransactions} saveInvestmentTransaction={handleSaveInvestmentTransaction} deleteInvestmentTransaction={handleDeleteInvestmentTransaction} saveTransaction={handleSaveTransaction} warrants={warrants} saveWarrant={handleSaveWarrant} deleteWarrant={handleDeleteWarrant} manualPrices={manualWarrantPrices} onManualPriceChange={handleManualWarrantPrice} prices={assetPrices} />;
      case 'Warrants':
        return <WarrantsPage warrants={warrants} saveWarrant={handleSaveWarrant} deleteWarrant={handleDeleteWarrant} prices={warrantPrices} manualPrices={manualWarrantPrices} lastUpdated={lastUpdated} onManualPriceChange={handleManualWarrantPrice} />;
      case 'Tasks':
        return <TasksPage tasks={tasks} saveTask={handleSaveTask} deleteTask={handleDeleteTask} taskOrder={taskOrder} setTaskOrder={setTaskOrder} />;
      case 'Documentation':
        return <Documentation setCurrentPage={setCurrentPage} />;
      case 'AI Assistant':
        return <AIAssistantSettingsPage setCurrentPage={setCurrentPage} />;
      case 'Subscriptions':
        return <SubscriptionsPage />;
      case 'Quotes & Invoices':
        return <InvoicesPage />;
      default:
        return <div>Page not found</div>;
    }
  };

  const preferencesContextValue = useMemo(() => ({ preferences, setPreferences }), [preferences]);
  const accountsContextValue = useMemo(
    () => ({ accounts, accountOrder, setAccountOrder, saveAccount: handleSaveAccount }),
    [accounts, accountOrder, handleSaveAccount]
  );
  const transactionsContextValue = useMemo(
    () => ({ transactions, saveTransaction: handleSaveTransaction, deleteTransactions: handleDeleteTransactions }),
    [transactions, handleDeleteTransactions, handleSaveTransaction]
  );
  const warrantsContextValue = useMemo(
    () => ({ warrants, prices: warrantPrices }),
    [warrantPrices, warrants]
  );
  const invoicesContextValue = useMemo(
    () => ({ invoices, saveInvoice: handleSaveInvoice, deleteInvoice: handleDeleteInvoice }),
    [invoices]
  );
  const categoryContextValue = useMemo(
    () => ({ incomeCategories, expenseCategories, setIncomeCategories, setExpenseCategories }),
    [expenseCategories, incomeCategories]
  );
  const tagsContextValue = useMemo(
    () => ({ tags, saveTag: handleSaveTag, deleteTag: handleDeleteTag }),
    [tags, handleSaveTag, handleDeleteTag]
  );
  const budgetsContextValue = useMemo(
    () => ({ budgets, saveBudget: handleSaveBudget, deleteBudget: handleDeleteBudget }),
    [budgets, handleDeleteBudget, handleSaveBudget]
  );
  const goalsContextValue = useMemo(
    () => ({ financialGoals, saveFinancialGoal: handleSaveFinancialGoal, deleteFinancialGoal: handleDeleteFinancialGoal }),
    [financialGoals, handleDeleteFinancialGoal, handleSaveFinancialGoal]
  );
  const scheduleContextValue = useMemo(
    () => ({
      recurringTransactions,
      recurringTransactionOverrides,
      loanPaymentOverrides,
      billsAndPayments,
      memberships,
      saveRecurringTransaction: handleSaveRecurringTransaction,
      deleteRecurringTransaction: handleDeleteRecurringTransaction,
      saveRecurringOverride: handleSaveRecurringOverride,
// FIX: In the schedule context value, adjusted the signature of 'deleteRecurringOverride' to accept both 'recurringTransactionId' and 'originalDate' as parameters, aligning it with its implementation in 'handleDeleteRecurringOverride'.
      deleteRecurringOverride: handleDeleteRecurringOverride,
      saveLoanPaymentOverrides: handleSaveLoanPaymentOverrides,
      saveBillPayment: handleSaveBillPayment,
      deleteBillPayment: handleDeleteBillPayment,
      markBillAsPaid: handleMarkBillAsPaid,
      saveMembership: handleSaveMembership,
      deleteMembership: handleDeleteMembership,
    }),
    [
      billsAndPayments,
      memberships,
      handleDeleteBillPayment,
      handleDeleteRecurringOverride,
      handleDeleteRecurringTransaction,
      handleMarkBillAsPaid,
      handleSaveBillPayment,
      handleSaveLoanPaymentOverrides,
      handleSaveRecurringOverride,
      handleSaveRecurringTransaction,
      loanPaymentOverrides,
      recurringTransactionOverrides,
      recurringTransactions,
    ]
  );

  // Loading state
  if (isAuthLoading || !isDataLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-light-bg dark:bg-dark-bg">
          <svg className="animate-spin h-10 w-10 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
      </div>
    );
  }

  // Auth pages
  if (!isAuthenticated && !isDemoMode) {
    return (
      <Suspense fallback={<PageLoader label="Preparing sign-in experience..." />}>
        {authPage === 'signIn' ? (
          <SignIn
            onSignIn={handleSignIn}
            onNavigateToSignUp={() => setAuthPage('signUp')}
            onEnterDemoMode={handleEnterDemoMode}
            isLoading={isAuthLoading}
            error={authError}
          />
        ) : (
          <SignUp
            onSignUp={handleSignUp}
            onNavigateToSignIn={() => setAuthPage('signIn')}
            isLoading={isAuthLoading}
            error={authError}
          />
        )}
      </Suspense>
    );
  }

  // Main app
  return (
    <ErrorBoundary>
      <FinancialDataProvider
        categories={categoryContextValue}
        tags={tagsContextValue}
        budgets={budgetsContextValue}
        goals={goalsContextValue}
        schedule={scheduleContextValue}
        preferences={preferencesContextValue}
        accounts={accountsContextValue}
        transactions={transactionsContextValue}
        warrants={warrantsContextValue}
        invoices={invoicesContextValue}
      >
        <div className={`flex h-screen bg-light-card dark:bg-dark-card text-light-text dark:text-dark-text font-sans`}>
          <Sidebar
            currentPage={currentPage}
            setCurrentPage={(page) => { setViewingAccountId(null); setCurrentPage(page); }}
            isSidebarOpen={isSidebarOpen}
            setSidebarOpen={setSidebarOpen}
            theme={theme}
            isSidebarCollapsed={isSidebarCollapsed}
            setSidebarCollapsed={setSidebarCollapsed}
            onLogout={handleLogout}
            user={currentUser!}
          />
          <div className="flex-1 flex flex-col overflow-hidden relative z-0">
            <Header
              user={currentUser!}
              setSidebarOpen={setSidebarOpen}
              theme={theme}
              setTheme={setTheme}
              currentPage={currentPage}
              titleOverride={viewingAccount?.name}
              isPrivacyMode={isPrivacyMode}
              togglePrivacyMode={() => setIsPrivacyMode(!isPrivacyMode)}
            />
            <InsightsViewProvider
              accounts={accounts}
              financialGoals={financialGoals}
              defaultDuration={preferences.defaultPeriod as Duration}
            >
              <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8 bg-light-bg dark:bg-dark-bg md:rounded-tl-3xl border-l border-t border-black/5 dark:border-white/5 shadow-2xl">
                <Suspense fallback={<PageLoader />}>
                  {renderPage()}
                </Suspense>
              </main>
            </InsightsViewProvider>
          </div>

          {/* AI Chat */}
          <ChatFab onClick={() => setIsChatOpen(prev => !prev)} />
          <Suspense fallback={null}>
            {isChatOpen && (
              <Chatbot
                isOpen={isChatOpen}
                onClose={() => setIsChatOpen(false)}
                financialData={{
                  accounts,
                  transactions,
                  budgets,
                  financialGoals,
                  recurringTransactions,
                  investmentTransactions,
                }}
              />
            )}
          </Suspense>
          <Suspense fallback={null}>
            {isOnboardingOpen && (
              <OnboardingModal
                isOpen={isOnboardingOpen}
                onClose={handleOnboardingFinish}
                user={currentUser!}
                saveAccount={handleSaveAccount}
                saveFinancialGoal={handleSaveFinancialGoal}
                saveRecurringTransaction={handleSaveRecurringTransaction}
                preferences={preferences}
                setPreferences={setPreferences}
                accounts={accounts}
                incomeCategories={incomeCategories}
                expenseCategories={expenseCategories}
              />
            )}
          </Suspense>
        </div>
      </FinancialDataProvider>
    </ErrorBoundary>
  );
};

export default App;