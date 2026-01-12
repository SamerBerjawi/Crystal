
// FIX: Import `useMemo` from React to resolve the 'Cannot find name' error.
import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy, useRef, Component, ErrorInfo, startTransition } from 'react';
import Sidebar from './components/Sidebar';
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
// FIX: Use inline function for lazy import to match AccountDetail pattern and avoid TS error
const Forecasting = lazy(() => import('./pages/Forecasting'));
const loadChallengesPage = () => import('./pages/Challenges');
const ChallengesPage = lazy(loadChallengesPage);
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
const loadIntegrationsPage = () => import('./pages/Integrations');
const IntegrationsPage = lazy(loadIntegrationsPage);
const loadAccountDetail = () => import('./pages/AccountDetail');
// FIX: Use inline function for lazy import to avoid TypeScript error regarding 'default' property missing
const AccountDetail = lazy(() => import('./pages/AccountDetail'));
const loadEnableBankingCallbackPage = () => import('./pages/EnableBankingCallback');
const EnableBankingCallbackPage = lazy(loadEnableBankingCallbackPage);
const loadInvestmentsPage = () => import('./pages/Investments');
const InvestmentsPage = lazy(loadInvestmentsPage);
const HoldingDetail = lazy(() => import('./pages/HoldingDetail'));
const loadTasksPage = () => import('./pages/Tasks');
const TasksPage = lazy(loadTasksPage);
const loadAIAssistantSettingsPage = () => import('./pages/AIAssistantSettings');
const AIAssistantSettingsPage = lazy(loadAIAssistantSettingsPage);
const loadDocumentation = () => import('./pages/Documentation');
const Documentation = lazy(loadDocumentation);
const loadSubscriptionsPage = () => import('./pages/Subscriptions');
const SubscriptionsPage = lazy(loadSubscriptionsPage);
const loadInvoicesPage = () => import('./pages/Invoices');
const InvoicesPage = lazy(loadInvoicesPage);
const loadMerchantsPage = () => import('./pages/Merchants');
const MerchantsPage = lazy(loadMerchantsPage);

const pagePreloaders = [
  loadDashboard,
  loadAccounts,
  loadTransactions,
  loadBudgeting,
  loadForecasting,
  loadChallengesPage,
  loadSettingsPage,
  loadSchedulePage,
  loadCategoriesPage,
  loadTagsPage,
  loadPersonalInfoPage,
  loadDataManagement,
  loadPreferencesPage,
  loadIntegrationsPage,
  loadAccountDetail,
  loadInvestmentsPage,
  loadTasksPage,
  loadAIAssistantSettingsPage,
  loadDocumentation,
  loadSubscriptionsPage,
  loadInvoicesPage,
  loadMerchantsPage
];
// UserManagement is removed
// FIX: Import FinancialData from types.ts
// FIX: Add `Tag` to the import from `types.ts`.
import { Page, Theme, Category, User, Transaction, Account, RecurringTransaction, RecurringTransactionOverride, WeekendAdjustment, FinancialGoal, Budget, ImportExportHistoryItem, AppPreferences, AccountType, InvestmentTransaction, Task, Warrant, ImportDataType, FinancialData, Currency, BillPayment, BillPaymentStatus, Duration, InvestmentSubType, Tag, LoanPaymentOverrides, ScheduledPayment, Membership, Invoice, UserStats, Prediction, PriceHistoryEntry, EnableBankingConnection, EnableBankingAccount, EnableBankingLinkPayload, EnableBankingSyncOptions } from './types';
import { MOCK_INCOME_CATEGORIES, MOCK_EXPENSE_CATEGORIES, LIQUID_ACCOUNT_TYPES } from './constants';
import { createDemoUser, emptyFinancialData, initialFinancialData } from './demoData';
import { v4 as uuidv4 } from 'uuid';
import ChatFab from './components/ChatFab';
const Chatbot = lazy(() => import('./components/Chatbot'));
import { convertToEur, CONVERSION_RATES, arrayToCSV, downloadCSV, parseLocalDate, toLocalISOString } from './utils';
import { buildHoldingsOverview } from './utils/investments';
import { useDebounce } from './hooks/useDebounce';
import { useAuth } from './hooks/useAuth';
import useLocalStorage from './hooks/useLocalStorage';
const OnboardingModal = lazy(() => import('./components/OnboardingModal'));
import { FinancialDataProvider } from './contexts/FinancialDataContext';
import { AccountsProvider, PreferencesProvider, TransactionsProvider, WarrantsProvider, InvoicesProvider } from './contexts/DomainProviders';
import { InsightsViewProvider } from './contexts/InsightsViewContext';
import { persistPendingConnection, removePendingConnection } from './utils/enableBankingStorage';
import DemoRestorePrompt from './components/DemoRestorePrompt';
import SmartRestoreModal from './components/SmartRestoreModal';

const IBAN_REGEX = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{9,30}$/i;

const normalizeIban = (value?: string | null) => {
  if (!value) return undefined;
  const cleaned = value.replace(/[^A-Za-z0-9]/g, '');
  return IBAN_REGEX.test(cleaned) ? cleaned.toUpperCase() : undefined;
};

const findIbanCandidate = (...sources: any[]): string | undefined => {
  const visited = new WeakSet<object>();

  const search = (input: any): string | undefined => {
    if (!input) return undefined;

    if (typeof input === 'string') {
      return normalizeIban(input);
    }

    if (typeof input !== 'object') {
      return undefined;
    }

    if (visited.has(input)) return undefined;
    visited.add(input);

    if (Array.isArray(input)) {
      for (const item of input) {
        const result = search(item);
        if (result) return result;
      }
      return undefined;
    }

    for (const [key, value] of Object.entries(input)) {
      if (/iban/i.test(key)) {
        const prioritizedValue = typeof value === 'string' ? value : (value as any)?.iban ?? (value as any)?.id ?? value;
        const normalized = normalizeIban(prioritizedValue as any);
        if (normalized) return normalized;
      }
    }

    for (const value of Object.values(input)) {
      const result = search(value);
      if (result) return result;
    }

    return undefined;
  };

  for (const source of sources) {
    const result = search(source);
    if (result) return result;
  }

  return undefined;
};

const routePathMap: Record<Page, string> = {
  Dashboard: '/',
  Accounts: '/accounts',
  Transactions: '/transactions',
  Budget: '/budget',
  Forecasting: '/forecasting',
  Challenges: '/challenges',
  Settings: '/settings',
  'Schedule & Bills': '/schedule',
  Tasks: '/tasks',
  Categories: '/categories',
  Tags: '/tags',
  'Personal Info': '/personal-info',
  'Data Management': '/data-management',
  Preferences: '/preferences',
  Integrations: '/integrations',
  EnableBankingCallback: '/enable-banking/callback',
  AccountDetail: '/accounts',
  Investments: '/investments',
  HoldingDetail: '/investments',
  Documentation: '/documentation',
  'AI Assistant': '/ai-assistant',
  Subscriptions: '/subscriptions',
  'Quotes & Invoices': '/invoices',
  Merchants: '/merchants',
};

type RouteInfo = { page: Page; matched: boolean; accountId?: string | null; holdingSymbol?: string | null };

const parseRoute = (pathname: string): RouteInfo => {
  const rawPath = pathname.split('?')[0] || '/';
  const normalizedPath = rawPath !== '/' && rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;
  const accountMatch = normalizedPath.match(/^\/accounts\/([^/]+)$/);
  const holdingMatch = normalizedPath.match(/^\/investments\/([^/]+)$/);

  if (accountMatch?.[1]) {
    return { page: 'AccountDetail', matched: true, accountId: decodeURIComponent(accountMatch[1]) };
  }

  if (holdingMatch?.[1]) {
    return { page: 'HoldingDetail', matched: true, holdingSymbol: decodeURIComponent(holdingMatch[1]) };
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

  if (page === 'HoldingDetail' && accountId) {
    return `/investments/${encodeURIComponent(accountId)}`;
  }

  return routePathMap[page] || '/';
};

const MATERIAL_DATA_ARRAY_KEYS: (keyof FinancialData)[] = [
  'accounts',
  'transactions',
  'investmentTransactions',
  'recurringTransactions',
  'recurringTransactionOverrides',
  'financialGoals',
  'budgets',
  'tasks',
  'warrants',
  'memberships',
  'importExportHistory',
  'billsAndPayments',
  'invoices',
  'tags',
  'predictions',
  'enableBankingConnections',
  'incomeCategories',
  'expenseCategories',
  'accountOrder',
  'taskOrder',
];

const MATERIAL_DATA_OBJECT_KEYS: (keyof FinancialData)[] = [
  'loanPaymentOverrides',
  'manualWarrantPrices',
  'priceHistory',
];

const hasMaterialData = (data: Partial<FinancialData> | null | undefined) => {
  if (!data) return false;

  const hasArrays = MATERIAL_DATA_ARRAY_KEYS.some(key => {
    const value = data[key];
    return Array.isArray(value) && value.length > 0;
  });

  if (hasArrays) return true;

  return MATERIAL_DATA_OBJECT_KEYS.some(key => {
    const value = data[key];
    return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
  });
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
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 dark:from-black dark:to-[#171717] px-6">
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

  // Demo Restore Prompts
  const [isDemoRestorePromptOpen, setIsDemoRestorePromptOpen] = useState(false);
  const [isGlobalRestoreOpen, setIsGlobalRestoreOpen] = useState(false);

  const [currentPath, setCurrentPath] = useState(initialPath);
  const [currentPage, setCurrentPageState] = useState<Page>(initialRoute.page);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [viewingAccountId, setViewingAccountId] = useState<string | null>(initialRoute.accountId ?? null);
  const [viewingHoldingSymbol, setViewingHoldingSymbol] = useState<string | null>(initialRoute.holdingSymbol ?? null);
  const [theme, setTheme] = useState<Theme>(() => {
    const storedTheme = safeLocalStorage.getItem('theme');
    return storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system' ? storedTheme : 'system';
  });
  
  // All financial data states
  const [preferences, setPreferences] = useState<AppPreferences>(emptyFinancialData.preferences);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>(emptyFinancialData.incomeCategories);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>(emptyFinancialData.expenseCategories);
  const [transactions, setTransactions] = useState<Transaction[]>(emptyFinancialData.transactions);
  const [investmentTransactions, setInvestmentTransactions] = useState<InvestmentTransaction[]>(emptyFinancialData.investmentTransactions);
  const [accounts, setAccounts] = useState<Account[]>(emptyFinancialData.accounts);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>(emptyFinancialData.recurringTransactions);
  const [recurringTransactionOverrides, setRecurringTransactionOverrides] = useState<RecurringTransactionOverride[]>(emptyFinancialData.recurringTransactionOverrides || []);
  const [loanPaymentOverrides, setLoanPaymentOverrides] = useState<LoanPaymentOverrides>(emptyFinancialData.loanPaymentOverrides || {});
  const [financialGoals, setFinancialGoals] = useState<FinancialGoal[]>(emptyFinancialData.financialGoals);
  const [budgets, setBudgets] = useState<Budget[]>(emptyFinancialData.budgets);
  const [tasks, setTasks] = useState<Task[]>(emptyFinancialData.tasks);
  const [warrants, setWarrants] = useState<Warrant[]>(emptyFinancialData.warrants);
  const [memberships, setMemberships] = useState<Membership[]>(emptyFinancialData.memberships || []);
  const [importExportHistory, setImportExportHistory] = useState<ImportExportHistoryItem[]>(emptyFinancialData.importExportHistory);
  const [billsAndPayments, setBillsAndPayments] = useState<BillPayment[]>(emptyFinancialData.billsAndPayments);
  const [invoices, setInvoices] = useState<Invoice[]>(emptyFinancialData.invoices || []);
  // FIX: Add state for tags and tag filtering to support the Tags feature.
  const [tags, setTags] = useState<Tag[]>(emptyFinancialData.tags || []);
  const [userStats, setUserStats] = useState<UserStats>(emptyFinancialData.userStats || { currentStreak: 0, longestStreak: 0, lastLogDate: '' });
  const [predictions, setPredictions] = useState<Prediction[]>(emptyFinancialData.predictions || []);
  const [enableBankingConnections, setEnableBankingConnections] = useState<EnableBankingConnection[]>(emptyFinancialData.enableBankingConnections || []);

  const latestDataRef = useRef<FinancialData>(emptyFinancialData);
  const lastUpdatedAtRef = useRef<string | null>(null);
  const lastSavedSignatureRef = useRef<string | null>(null);
  const skipNextSaveRef = useRef(false);
  const restoreInProgressRef = useRef(false);
  const allowEmptySaveRef = useRef(false);
  const dirtySlicesRef = useRef<Set<keyof FinancialData>>(new Set());
  const [dirtySignal, setDirtySignal] = useState(0);
  const [accountOrder, setAccountOrder] = useLocalStorage<string[]>('crystal-account-order', []);
  const [taskOrder, setTaskOrder] = useLocalStorage<string[]>('crystal-task-order', []);
  const transactionsViewFilters = useRef<{ accountName?: string | null; tagId?: string | null }>({});
  const streakUpdatedRef = useRef(false);
  
  // State for AI Chat
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // State for Warrant prices and history
  const [manualWarrantPrices, setManualWarrantPrices] = useState<Record<string, number | undefined>>(emptyFinancialData.manualWarrantPrices || {});
  const [priceHistory, setPriceHistory] = useState<Record<string, PriceHistoryEntry[]>>(emptyFinancialData.priceHistory || {});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const markSliceDirty = useCallback((slice: keyof FinancialData) => {
    const pending = new Set(dirtySlicesRef.current);
    if (!pending.has(slice)) {
      pending.add(slice);
      dirtySlicesRef.current = pending;
      setDirtySignal(signal => signal + 1);
    }
  }, []);
  
  // Update Streak Logic
  useEffect(() => {
    if (!isDataLoaded || !isAuthenticated || streakUpdatedRef.current) return;

    const todayStr = toLocalISOString(new Date());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = toLocalISOString(yesterday);

    const lastLogDate = userStats.lastLogDate || '';
    
    // Only update if not already logged today
    if (lastLogDate !== todayStr) {
       streakUpdatedRef.current = true;
       let newStreak = 1;
       
       if (lastLogDate === yesterdayStr) {
           newStreak = (userStats.currentStreak || 0) + 1;
       }
       
       const newStats = {
           ...userStats,
           currentStreak: newStreak,
           longestStreak: Math.max(newStreak, userStats.longestStreak || 0),
           lastLogDate: todayStr
       };
       
       setUserStats(newStats);
       markSliceDirty('userStats');
    } else {
       streakUpdatedRef.current = true;
    }
  }, [isDataLoaded, isAuthenticated, userStats.lastLogDate, userStats.currentStreak, markSliceDirty]);

  // Reset streak update guard on authentication change (e.g., logout/login)
  useEffect(() => {
    if (!isAuthenticated) {
      streakUpdatedRef.current = false;
    }
  }, [isAuthenticated]);


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
      const numericPrice = typeof price === 'number' ? price : undefined;

      if (numericPrice !== undefined) {
        resolved[symbol] = numericPrice;
      }
    });

    return resolved;
  }, [accounts, manualWarrantPrices, warrants]);

  const investmentAccounts = useMemo(() => (
    accounts || []
  ).filter(a => a.type === 'Investment' && ['Stock', 'ETF', 'Crypto'].includes(a.subType || '') && a.status !== 'closed'), [accounts]);

  const holdingsOverview = useMemo(() => buildHoldingsOverview(investmentAccounts, investmentTransactions, warrants, assetPrices), [investmentAccounts, investmentTransactions, warrants, assetPrices]);

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
    setViewingHoldingSymbol(route.holdingSymbol ?? null);

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
    const targetPath = pageToPath(page, page === 'AccountDetail' ? viewingAccountId : page === 'HoldingDetail' ? viewingHoldingSymbol : null);
    navigateToPath(targetPath);
    setCurrentPageState(page);

    if (page !== 'AccountDetail') {
      setViewingAccountId(null);
    }
    if (page !== 'HoldingDetail') {
      setViewingHoldingSymbol(null);
    }
  }, [navigateToPath, viewingAccountId, viewingHoldingSymbol]);

  const handleOpenAccountDetail = useCallback((accountId: string) => {
    setViewingAccountId(accountId);
    setCurrentPageState('AccountDetail');
    navigateToPath(pageToPath('AccountDetail', accountId));
  }, [navigateToPath]);

  const handleOpenHoldingDetail = useCallback((symbol: string) => {
    setViewingHoldingSymbol(symbol);
    setCurrentPageState('HoldingDetail');
    navigateToPath(pageToPath('HoldingDetail', symbol));
  }, [navigateToPath]);

  // Onboarding flow state
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useLocalStorage('crystal-onboarding-complete', false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

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
      // Sync to device timezone only when unset to avoid overriding user preferences.
      const deviceTimezone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'local';
      if (!preferences.timezone) {
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
        const quantity = ((warrantHoldingsBySymbol as Record<string, number>)[account.symbol as string] as number) || 0;
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

  const loadAllFinancialData = useCallback((data: FinancialData | null, options?: { skipNextSave?: boolean; useDemoDefaults?: boolean }) => {
    const dataToLoad = data ?? (options?.useDemoDefaults ? initialFinancialData : emptyFinancialData);
    const loadedPrefs = {
      ...initialFinancialData.preferences,
      ...(dataToLoad.preferences || {}),
    };
    const dataSignature = JSON.stringify(dataToLoad);
    lastUpdatedAtRef.current = dataToLoad.lastUpdatedAt ?? null;

    startTransition(() => {
      // Only set properties if they exist in the incoming payload, otherwise default to empty or initial
      // When merging, we need to be careful not to overwrite with empty arrays if not intended,
      // but `loadAllFinancialData` typically implies a full state replacement or hydration.
      // For partial updates (merge), see `handleRestoreData`.
      
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
      setPriceHistory(dataToLoad.priceHistory || {});
      setInvoices(dataToLoad.invoices || []);
      // FIX: Add `tags` to the data loading logic.
      setTags(dataToLoad.tags || []);
      setPredictions(dataToLoad.predictions || []);
      setIncomeCategories(dataToLoad.incomeCategories && dataToLoad.incomeCategories.length > 0 ? dataToLoad.incomeCategories : MOCK_INCOME_CATEGORIES);
      setExpenseCategories(dataToLoad.expenseCategories && dataToLoad.expenseCategories.length > 0 ? dataToLoad.expenseCategories : MOCK_EXPENSE_CATEGORIES);

      if (dataToLoad.userStats) {
          setUserStats(dataToLoad.userStats);
          // If we are loading fresh data, we should allow the streak logic to run again once per session
          streakUpdatedRef.current = false;
      }

      setEnableBankingConnections(dataToLoad.enableBankingConnections || []);

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
    loadAllFinancialData(null, { useDemoDefaults: true }); // This will load initialFinancialData
    setDemoUser(createDemoUser());
    setIsDemoMode(true);
    setIsDataLoaded(true); // Manually set data as loaded for demo
    setIsDemoRestorePromptOpen(true); // Trigger the restore prompt
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
  
  const handleSetUser = useCallback((updates: Partial<User>) => {
    if (isDemoMode) {
        setDemoUser(prev => prev ? {...prev, ...updates} as User : null);
    } else {
        setUser(updates);
    }
  }, [isDemoMode, setUser]);

  const currentUser = useMemo(() => isDemoMode ? demoUser : user, [isDemoMode, demoUser, user]);

  const dataToSave: FinancialData = useMemo(() => ({
    accounts, transactions, investmentTransactions, recurringTransactions,
    recurringTransactionOverrides, loanPaymentOverrides, financialGoals, budgets, tasks, warrants, memberships, importExportHistory, incomeCategories,
    expenseCategories, preferences, billsAndPayments, accountOrder, taskOrder, tags, manualWarrantPrices, priceHistory, invoices, userStats, predictions,
    enableBankingConnections, userProfile: currentUser || undefined
  }), [
    accounts, transactions, investmentTransactions,
    recurringTransactions, recurringTransactionOverrides, loanPaymentOverrides, financialGoals, budgets, tasks, warrants, memberships, importExportHistory,
    incomeCategories, expenseCategories, preferences, billsAndPayments, accountOrder, taskOrder, tags, manualWarrantPrices, priceHistory, invoices, userStats, predictions, enableBankingConnections, currentUser
  ]);

  const debouncedDirtySignal = useDebounce(dirtySignal, 900);

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
    markSliceDirty('priceHistory');
  }, [priceHistory, isDataLoaded, markSliceDirty]);

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
  
  useEffect(() => {
      if (!isDataLoaded || restoreInProgressRef.current) return;
      markSliceDirty('userStats');
  }, [userStats, isDataLoaded, markSliceDirty]);

  useEffect(() => {
      if (!isDataLoaded || restoreInProgressRef.current) return;
      markSliceDirty('predictions');
  }, [predictions, isDataLoaded, markSliceDirty]);

  useEffect(() => {
    if (!isDataLoaded || restoreInProgressRef.current) return;
    markSliceDirty('enableBankingConnections');
  }, [enableBankingConnections, isDataLoaded, markSliceDirty]);

  // Persist data to backend on change
  const postData = useCallback(
    async (
      payload: Record<string, unknown>,
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
          body: JSON.stringify(payload),
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

  const saveData = useCallback(
    async (
      data: FinancialData,
      options?: { keepalive?: boolean; suppressErrors?: boolean; allowEmpty?: boolean }
    ): Promise<boolean> => {
      if (!options?.allowEmpty && !hasMaterialData(data) && lastUpdatedAtRef.current) {
        console.warn('Skipping save to avoid overwriting existing data with an empty payload.');
        return false;
      }
      const now = new Date().toISOString();
      const payload = {
        ...data,
        lastUpdatedAt: now,
        previousUpdatedAt: lastUpdatedAtRef.current,
        ...(options?.allowEmpty ? { allowEmpty: true } : {}),
      };
      const succeeded = await postData(payload, options);
      if (succeeded) {
        lastUpdatedAtRef.current = now;
      }
      return succeeded;
    },
    [postData]
  );

  const savePartialData = useCallback(
    async (
      data: Partial<FinancialData>,
      options?: { keepalive?: boolean; suppressErrors?: boolean }
    ): Promise<boolean> => {
      const now = new Date().toISOString();
      const payload = {
        partial: true,
        data,
        lastUpdatedAt: now,
        previousUpdatedAt: lastUpdatedAtRef.current,
      };
      const succeeded = await postData(payload, options);
      if (succeeded) {
        lastUpdatedAtRef.current = now;
      }
      return succeeded;
    },
    [postData]
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

  const savePartialDataWithRetry = useCallback(
    async (
      data: Partial<FinancialData>,
      options?: { attempts?: number }
    ): Promise<boolean> => {
      const maxAttempts = Math.max(1, options?.attempts ?? 3);
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const succeeded = await savePartialData(data);
        if (succeeded) {
          return true;
        }

        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
      return false;
    },
    [savePartialData]
  );

  // Handler for granular restore that allows merging
  const handleRestoreData = useCallback((data: FinancialData) => {
      // This function triggers a save to the backend to persist the changes immediately,
      // similar to how full import works but it assumes `data` is already the merged result.
      restoreInProgressRef.current = true;
      skipNextSaveRef.current = true;
      
      // Update user state first if included in restore
      if (data.userProfile) {
          handleSetUser(data.userProfile);
      }

      loadAllFinancialData(data); // Update local state
      
      // Persist to backend
      if (!isDemoMode && token) {
           saveData(data, { suppressErrors: true })
            .catch(console.error)
            .finally(() => {
                restoreInProgressRef.current = false;
                skipNextSaveRef.current = false;
            });
      } else {
          restoreInProgressRef.current = false;
          skipNextSaveRef.current = false;
      }
  }, [isDemoMode, token, loadAllFinancialData, saveData, handleSetUser]);

  // Global handler for merging logic used by SmartRestoreModal and DemoRestorePrompt
  const handleGranularRestore = useCallback((data: FinancialData, strategy: Record<string, 'merge' | 'replace'>) => {
    // Construct new data based on strategy
    const current = dataToSave; // Use the memoized current state
    const mergedData = { ...current };

    Object.keys(data).forEach((key) => {
        const k = key as keyof FinancialData;
        const incoming = data[k];
        const existing = current[k];
        const strat = strategy[key] || 'merge';

        if (Array.isArray(incoming) && Array.isArray(existing)) {
            if (strat === 'replace') {
                // @ts-ignore
                mergedData[k] = incoming;
            } else {
                // Merge - Naive concat. In a real app we might check IDs to avoid duplicates.
                // But for now, we assume user knows what they are doing or we generate new IDs during import (hard here).
                // We'll filter out exact ID matches to prevent hard errors, but logic issues might remain.
                const existingIds = new Set(existing.map((i: any) => i.id).filter(Boolean));
                const newItems = incoming.filter((i: any) => !existingIds.has(i.id));
                // @ts-ignore
                mergedData[k] = [...existing, ...newItems];
            }
        } else if (typeof incoming === 'object' && incoming !== null) {
            // Objects like preferences or manual prices
            if (strat === 'replace') {
                // @ts-ignore
                mergedData[k] = incoming;
            } else {
                // @ts-ignore
                mergedData[k] = { ...existing, ...incoming };
            }
        }
    });

    handleRestoreData(mergedData);
  }, [dataToSave, handleRestoreData]);

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

    const persistDirtySlices = async () => {
      const payloadSignature = JSON.stringify(dataToSave);

      if (payloadSignature === lastSavedSignatureRef.current) {
        dirtySlicesRef.current.clear();
        return;
      }

      if (!allowEmptySaveRef.current && !hasMaterialData(dataToSave) && lastUpdatedAtRef.current) {
        console.warn('Skipping save to avoid overwriting existing data with an empty payload.');
        dirtySlicesRef.current.clear();
        lastSavedSignatureRef.current = payloadSignature;
        return;
      }

      const allowEmpty = allowEmptySaveRef.current;
      const succeeded = await saveData(dataToSave, { allowEmpty });
      if (succeeded) {
        dirtySlicesRef.current.clear();
        lastSavedSignatureRef.current = payloadSignature;
        if (allowEmpty) {
          allowEmptySaveRef.current = false;
        }
      }
    };

    persistDirtySlices();
  }, [dataToSave, debouncedDirtySignal, isAuthenticated, isDataLoaded, isDemoMode, saveData]);

  useEffect(() => {
    if (!isAuthenticated || isDemoMode || typeof window === 'undefined') {
      return;
    }

    const handleBeforeUnload = () => {
      if (!isDataLoaded || dirtySlicesRef.current.size === 0) {
        return;
      }

      const payloadSignature = JSON.stringify(dataToSave);

      if (payloadSignature === lastSavedSignatureRef.current) {
        return;
      }

      saveData(dataToSave, { keepalive: true, suppressErrors: true })
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
  }, [dataToSave, isAuthenticated, isDataLoaded, isDemoMode, saveData]);
  
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
  const handleSignIn = async (email: string, password: string): Promise<FinancialData | null> => {
    setIsDataLoaded(false);
    const response = await signIn(email, password);
    if (response?.financialData) {
      loadAllFinancialData(response.financialData, { skipNextSave: true });
      setIsDataLoaded(true);
      return response.financialData;
    }
    setIsDataLoaded(true);
    return null;
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

  const handleSaveAccount = (accountData: Omit<Account, 'id'> & { id?: string }) => {
    const accountWithDefaults = { ...accountData, includeInAnalytics: accountData.includeInAnalytics ?? true } as Omit<Account, 'id'> & { id?: string };

    if (accountData.id) { // UPDATE
        setAccounts(prev => {
            // First, apply the update to the target account
            const intermediateAccounts = prev.map(acc => acc.id === accountData.id ? { ...acc, ...accountWithDefaults } as Account : acc);

            // If this account is now primary, ensure no other account OF THE SAME TYPE is primary
            if (accountWithDefaults.isPrimary) {
                return intermediateAccounts.map(acc => {
                    // If it's the same type but a different ID, unset primary
                    if (acc.type === accountWithDefaults.type && acc.id !== accountWithDefaults.id && acc.isPrimary) {
                        return { ...acc, isPrimary: false };
                    }
                    return acc;
                });
            }
            return intermediateAccounts;
        });
    } else { // ADD
        const newAccount = { ...accountWithDefaults, id: `acc-${uuidv4()}`, status: 'open' as const } as Account;
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
    if (!accountToDelete) return;

    const impactedRecurringIds = new Set(
      recurringTransactions
        .filter(rt => rt.accountId === accountId || rt.toAccountId === accountId)
        .map(rt => rt.id)
    );

    setAccounts(prev => prev.filter(acc => acc.id !== accountId));
    setTransactions(prev => prev.filter(tx => tx.accountId !== accountId));
    setInvestmentTransactions(prev => prev.filter(tx => tx.symbol !== accountToDelete.symbol));
    setWarrants(prev => prev.filter(w => w.isin !== accountToDelete.symbol));
    setManualWarrantPrices(prev => {
      const { [accountToDelete.symbol]: _, ...rest } = prev;
      return rest;
    });
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

    if (viewingHoldingSymbol === accountToDelete.symbol) {
      setViewingHoldingSymbol(null);
      setCurrentPage('Investments');
    }
  }, [
    accounts,
    recurringTransactions,
    viewingAccountId,
    viewingHoldingSymbol,
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

  const handleManualWarrantPrice = (isin: string, priceOrEntries: number | null | {date: string, price: number}[], date?: string) => {
    
    // Check if it's a bulk update
    if (Array.isArray(priceOrEntries)) {
        const entries = priceOrEntries;
        
        setPriceHistory(prev => {
            const currentList = prev[isin] ? [...prev[isin]] : [];
            // Create a map for existing entries for easier update
            const historyMap = new Map(currentList.map(item => [item.date, item]));
            
            // Upsert new entries
            entries.forEach(entry => {
                historyMap.set(entry.date, entry);
            });
            
            // Convert back to array
            const newList = Array.from(historyMap.values());
            newList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            // Update current price pointer if we changed something
            const latest = newList.length > 0 ? newList[newList.length - 1] : null;
            
            setManualWarrantPrices(currentPrices => {
                 const newPrices = { ...currentPrices };
                 if (latest) {
                     newPrices[isin] = latest.price;
                 } else {
                     // If bulk update cleared everything (unlikely but possible logic)
                     // Or if history became empty
                     if (newList.length === 0) {
                         delete newPrices[isin];
                     }
                 }
                 return newPrices;
            });

            return { ...prev, [isin]: newList };
        });
        
        setLastUpdated(new Date());
        return;
    }

    // Existing single entry logic
    const price = priceOrEntries;
    const targetDate = date || toLocalISOString(new Date());
    
    setPriceHistory(prev => {
        const currentList = prev[isin] ? [...prev[isin]] : [];
        let newList = [...currentList];
        
        if (price === null) {
            // Remove entry if price is null (clearing override)
            newList = newList.filter(item => item.date !== targetDate);
        } else {
            const index = newList.findIndex(item => item.date === targetDate);
            if (index > -1) {
                newList[index] = { date: targetDate, price };
            } else {
                newList.push({ date: targetDate, price });
            }
        }
        
        newList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Update the current price pointer if we changed something
        const latest = newList.length > 0 ? newList[newList.length - 1] : null;
        
        setManualWarrantPrices(currentPrices => {
            const newPrices = { ...currentPrices };
            if (latest) {
                newPrices[isin] = latest.price;
            } else {
                // If history is empty or cleared, we remove the current price override
                // But only if we are the ones who cleared it via null. 
                // If user just updated a past date, the current price remains the latest one.
                if (price === null && newList.length === 0) {
                     delete newPrices[isin];
                } else if (latest) {
                     newPrices[isin] = latest.price;
                }
            }
            return newPrices;
        });

        return { ...prev, [isin]: newList };
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

  const handleSavePrediction = (predictionData: Omit<Prediction, 'id'> & { id?: string }) => {
      if (predictionData.id) {
          setPredictions(prev => prev.map(p => p.id === predictionData.id ? { ...p, ...predictionData } as Prediction : p));
      } else {
          const newPrediction: Prediction = { ...predictionData, id: `pred-${uuidv4()}` } as Prediction;
          setPredictions(prev => [...prev, newPrediction]);
      }
  };

  const handleDeletePrediction = (id: string) => {
      setPredictions(prev => prev.filter(p => p.id !== id));
  };

  // --- Enable Banking integration ---
  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || response.statusText);
    }

    return response;
  }, [token]);

  const handleFetchEnableBankingBanks = useCallback(async ({
    applicationId,
    countryCode,
    clientCertificate,
  }: {
    applicationId: string;
    countryCode: string;
    clientCertificate: string;
  }) => {
    if (!token) {
      throw new Error('You must be signed in to load banks for Enable Banking.');
    }

    const response = await fetchWithAuth('/api/enable-banking/aspsps', {
      method: 'POST',
      body: JSON.stringify({
        applicationId: applicationId.trim(),
        countryCode: countryCode.trim().toUpperCase(),
        clientCertificate: clientCertificate.trim(),
      }),
    });

    const data = await response.json();
    const items: any[] = Array.isArray(data) ? data : data?.aspsps || [];

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('No banks returned for the selected country.');
    }

    return items.map((item: any, index: number) => ({
      id: item.id || item.aspsp_id || item.bank_id || item.name || `aspsp-${index}`,
      name: item.name || item.full_name || item.fullName || 'Bank',
      country: item.country || countryCode,
    }));
  }, [enableBankingConnections, fetchWithAuth, isDemoMode, saveDataWithRetry, token]);

  const handleCreateEnableBankingConnection = useCallback(async (payload: {
    applicationId: string;
    countryCode: string;
    clientCertificate: string;
    selectedBank: string;
    connectionId?: string;
  }) => {
    if (!token) {
      alert('You must be signed in to start an Enable Banking connection.');
      return;
    }

    const connectionId = payload.connectionId || `eb-${uuidv4()}`;
    const existingConnection = payload.connectionId
      ? enableBankingConnections.find(conn => conn.id === payload.connectionId)
      : undefined;
    const baseConnection: EnableBankingConnection = existingConnection
      ? {
          ...existingConnection,
          applicationId: payload.applicationId.trim(),
          countryCode: payload.countryCode.trim().toUpperCase(),
          clientCertificate: payload.clientCertificate.trim(),
          status: 'pending',
          selectedBank: payload.selectedBank,
          authorizationId: undefined,
          lastError: undefined,
        }
      : {
          id: connectionId,
          applicationId: payload.applicationId.trim(),
          countryCode: payload.countryCode.trim().toUpperCase(),
          clientCertificate: payload.clientCertificate.trim(),
          status: 'pending',
          selectedBank: payload.selectedBank,
          accounts: [],
        };

    let nextConnections: EnableBankingConnection[] = [];
    setEnableBankingConnections(prev => {
      nextConnections = existingConnection
        ? prev.map(conn => (conn.id === connectionId ? baseConnection : conn))
        : [...prev, baseConnection];
      return nextConnections;
    });
    persistPendingConnection(baseConnection);
    if (!isDemoMode) {
      if (isDataLoaded) {
        void savePartialDataWithRetry({ enableBankingConnections: nextConnections });
      } else {
        console.warn('Skipping Enable Banking save until data has finished loading.');
      }
      void fetchWithAuth('/api/enable-banking/pending', {
        method: 'POST',
        body: JSON.stringify({ connection: baseConnection }),
      }).catch(error => {
        console.warn('Failed to persist pending Enable Banking connection on server', error);
      });
    }

    try {
      const response = await fetchWithAuth('/api/enable-banking/authorize', {
        method: 'POST',
        body: JSON.stringify({
          applicationId: baseConnection.applicationId,
          clientCertificate: baseConnection.clientCertificate,
          countryCode: baseConnection.countryCode,
          aspspName: payload.selectedBank,
          state: connectionId,
        }),
      });

      const data = await response.json();
      setEnableBankingConnections(prev => prev.map(conn => conn.id === connectionId ? {
        ...conn,
        authorizationId: data.authorizationId,
        lastError: undefined,
      } : conn));

      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      }
    } catch (error: any) {
      console.error('Failed to start Enable Banking authorization', error);
      setEnableBankingConnections(prev => prev.map(conn => conn.id === connectionId ? {
        ...conn,
        status: 'requires_update',
        lastError: error?.message || 'Unable to start authorization',
      } : conn));
    }
  }, [enableBankingConnections, fetchWithAuth, isDataLoaded, isDemoMode, savePartialDataWithRetry, token]);

  const resolveProviderAccountId = useCallback((account: any) => {
    return (
      account?.account_id?.id ||
      account?.account_id ||
      account?.resource_id ||
      account?.uid ||
      account?.id
    );
  }, []);

  const hashString = useCallback((value: string) => {
    let hash = 5381;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 33) ^ value.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
  }, []);

  const normalizeProviderTransactionId = useCallback((providerTx: any) => {
    return (
      providerTx?.transaction_id ||
      providerTx?.transactionId ||
      providerTx?.entry_reference ||
      providerTx?.entryReference
    );
  }, []);

  const mapProviderTransaction = useCallback((providerTx: any, linkedAccountId: string | undefined, providerAccountId: string, currency: Currency, connectionId: string): Transaction | null => {
    const amountRaw = providerTx?.transaction_amount?.amount ?? providerTx?.amount?.amount ?? providerTx?.transactionAmount?.amount;
    if (amountRaw === undefined || amountRaw === null) return null;
    if (!linkedAccountId) return null;

    const creditDebit = providerTx?.credit_debit_indicator || providerTx?.creditDebitIndicator;
    const signedAmount = Number(amountRaw) * (creditDebit === 'CRDT' ? 1 : -1);

    const date =
      providerTx?.booking_date ||
      providerTx?.bookingDate ||
      providerTx?.booking_date_time ||
      providerTx?.bookingDateTime ||
      providerTx?.value_date ||
      providerTx?.valueDate;

    const descriptionCandidates = [
      Array.isArray(providerTx?.remittance_information_unstructured_array)
        ? providerTx.remittance_information_unstructured_array.join(' ')
        : undefined,
      Array.isArray(providerTx?.remittanceInformationUnstructuredArray)
        ? providerTx.remittanceInformationUnstructuredArray.join(' ')
        : undefined,
      providerTx?.remittance_information_unstructured,
      providerTx?.remittanceInformationUnstructured,
      providerTx?.remittance_information_structured?.reference,
      providerTx?.remittanceInformationStructured?.reference,
      providerTx?.remittance_information_structured?.creditor_reference,
      providerTx?.remittanceInformationStructured?.creditorReference,
      providerTx?.additional_information,
      providerTx?.additionalInformation,
      providerTx?.booking_text,
      providerTx?.bookingText,
      providerTx?.description,
      providerTx?.entry_reference,
      providerTx?.entryReference,
      providerTx?.transaction_id,
      providerTx?.transactionId,
    ];

    const description = descriptionCandidates.find(val => typeof val === 'string' && val.trim().length > 0)?.trim() || 'Transaction';

    const counterpartyCandidates = signedAmount < 0
      ? [
          providerTx?.merchant_name,
          providerTx?.merchantName,
          providerTx?.merchant?.name,
          providerTx?.creditor?.name,
          providerTx?.creditor_name,
          providerTx?.ultimate_creditor?.name,
          providerTx?.ultimateCreditor?.name,
          providerTx?.counterparty_name,
          providerTx?.counterpartyName,
          providerTx?.debtor_name,
          providerTx?.debtor?.name,
        ]
      : [
          providerTx?.merchant_name,
          providerTx?.merchantName,
          providerTx?.merchant?.name,
          providerTx?.debtor?.name,
          providerTx?.debtor_name,
          providerTx?.ultimate_debtor?.name,
          providerTx?.ultimateDebtor?.name,
          providerTx?.creditor_name,
          providerTx?.creditor?.name,
          providerTx?.counterparty_name,
          providerTx?.counterpartyName,
        ];

    const merchant = counterpartyCandidates.find(val => typeof val === 'string' && val.trim().length > 0)?.trim();

    const normalizedProviderId = normalizeProviderTransactionId(providerTx);
    const fallbackPayload = {
      amount: signedAmount,
      date: date || '',
      description,
      merchant: merchant || '',
      currency,
      creditDebit: creditDebit || '',
    };
    const fallbackHash = hashString(JSON.stringify(fallbackPayload));
    const idSource = normalizedProviderId || `hash-${fallbackHash}`;

    return {
      id: `eb-${connectionId}-${providerAccountId}-${idSource}`,
      accountId: linkedAccountId,
      date: date || toLocalISOString(new Date()),
      description,
      merchant: merchant || undefined,
      amount: signedAmount,
      category: 'Uncategorized',
      type: signedAmount >= 0 ? 'income' : 'expense',
      currency,
      importId: `enable-banking-${connectionId}-${linkedAccountId}`,
    };
  }, [hashString, normalizeProviderTransactionId]);

  const handleSyncEnableBankingConnection = useCallback(async (
    connectionId: string,
    connectionOverride?: EnableBankingConnection,
    syncOptions?: EnableBankingSyncOptions,
  ) => {
    if (!token) {
      alert('Please sign in to sync Enable Banking connections.');
      return;
    }

    const connection = connectionOverride || enableBankingConnections.find(c => c.id === connectionId);
    if (!connection || !connection.sessionId) {
      alert('Connection is missing a session. Please re-authorize.');
      return;
    }

    const safeAccounts = connection.accounts || [];
    const targetAccountIds = (syncOptions?.targetAccountIds || []).filter(Boolean);
    const targetAccountSet = targetAccountIds.length ? new Set(targetAccountIds) : null;
    const safeAccountsForSync = targetAccountSet
      ? safeAccounts.filter(account => targetAccountSet.has(account.id))
      : safeAccounts;

    const { transactionMode = 'full', updateBalance = true, syncStartDate } = syncOptions || {};
    const shouldSyncTransactions = transactionMode !== 'none';
    const ninetyDaysAgoStr = toLocalISOString(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
    const todayStr = toLocalISOString(new Date());
    const clampSyncStartDate = (value?: string) => {
      if (!value) return value;
      const parsed = new Date(value);
      const min = new Date(ninetyDaysAgoStr);
      const max = new Date(todayStr);

      if (parsed < min) return ninetyDaysAgoStr;
      if (parsed > max) return todayStr;
      return toLocalISOString(parsed);
    };

    try {
      setEnableBankingConnections(prev => prev.map(conn => conn.id === connectionId ? { ...conn, status: 'pending', lastError: undefined } : conn));

      const session = await fetchWithAuth('/api/enable-banking/session/fetch', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: connection.sessionId,
          applicationId: connection.applicationId,
          clientCertificate: connection.clientCertificate,
        }),
      }).then(res => res.json());

      const normalizeAccounts = () => {
        const possibleCollections: any[] = [
          session?.accounts,
          session?.access?.accounts,
          session?.access?.resources,
          session?.consents?.[0]?.accounts,
          session?.consents?.[0]?.resources,
        ].filter(Array.isArray);

        const flattened = possibleCollections.flat();
        const uniqueById = new Map<string, any>();

        flattened.forEach(account => {
          const candidate = account?.account || account?.resource || account;
          const providerAccountId = typeof candidate === 'string' ? candidate : resolveProviderAccountId(candidate);

          if (!providerAccountId) return;

          if (targetAccountSet && !targetAccountSet.has(providerAccountId)) return;

          if (!uniqueById.has(providerAccountId)) {
            const normalized =
              typeof candidate === 'string'
                ? { id: providerAccountId }
                : { ...candidate, id: candidate.id || providerAccountId };

            uniqueById.set(providerAccountId, normalized);
          }
        });

        return Array.from(uniqueById.values());
      };

      let accountsFromSession: any[] = normalizeAccounts();
      const providerIdFromAccount = (account: any) => resolveProviderAccountId(account);

      if (!accountsFromSession.length && safeAccountsForSync.length > 0) {
        accountsFromSession = safeAccountsForSync.map(account => ({
          id: account.id,
          name: account.name,
          currency: account.currency,
        }));
      }

      if (!accountsFromSession.length) {
        if (targetAccountSet?.size) {
          throw new Error('No matching accounts returned for this session. Confirm access and try again.');
        }

        throw new Error('No accounts returned for this session. Please re-authorize and ensure accounts are permitted.');
      }

      const accountsToSync = accountsFromSession.filter(account => {
        if (!targetAccountSet) return true;
        const providerId = providerIdFromAccount(account);
        return providerId && targetAccountSet.has(providerId);
      });

      if (targetAccountSet && accountsToSync.length === 0) {
        throw new Error('No matching accounts found to sync for this connection.');
      }

      const selectedAccounts = accountsToSync.length > 0 ? accountsToSync : accountsFromSession;
      const updatedAccounts: EnableBankingAccount[] = [];
      const importedTransactions: Transaction[] = [];
      const unlinkedProviderAccounts: string[] = [];
      const now = new Date().toISOString();

      const concurrencyLimit = 3;
      const processAccount = async (account: any) => {
        const providerAccountId = providerIdFromAccount(account);
        if (!providerAccountId) return { account: null, transactions: [] as Transaction[] };

        const existing = safeAccounts.find(
          a => a.id === account?.uid || a.id === account?.account_id || a.id === account?.id || a.id === providerAccountId,
        );

        const [details, balances] = await Promise.all([
          fetchWithAuth(`/api/enable-banking/accounts/${encodeURIComponent(providerAccountId)}/details`, {
            method: 'POST',
            body: JSON.stringify({
              applicationId: connection.applicationId,
              clientCertificate: connection.clientCertificate,
              sessionId: connection.sessionId,
            }),
          }).then(res => res.json()).catch(() => null),
          fetchWithAuth(`/api/enable-banking/accounts/${encodeURIComponent(providerAccountId)}/balances`, {
            method: 'POST',
            body: JSON.stringify({
              applicationId: connection.applicationId,
              clientCertificate: connection.clientCertificate,
              sessionId: connection.sessionId,
            }),
          }).then(res => res.json()),
        ]);

        const balanceEntries: any[] = balances?.balances || [];
        const preferredBalance =
          balanceEntries.find((b: any) => b.balance_type === 'closingBooked' || b.balanceType === 'closingBooked') ||
          balanceEntries.find((b: any) =>
            ['interimAvailable', 'forwardAvailable', 'interimBooked'].includes(b.balance_type) ||
            ['interimAvailable', 'forwardAvailable', 'interimBooked'].includes(b.balanceType)
          ) ||
          balanceEntries[0] || {};

        const extractBalance = (entry: any) => {
          const balanceSource = entry?.balance || entry?.balanceAmount || entry?.balance_amount || {};
          const amountCandidates = [
            balanceSource?.amount,
            balanceSource?.balanceAmount?.amount,
            balanceSource?.balance_amount?.amount,
            balanceSource?.value,
            entry?.amount,
          ];
          const rawAmount = amountCandidates.find(val => val !== undefined && val !== null);
          const parsedAmount = Number(rawAmount ?? 0);

          const currencyFromBalance =
            balanceSource?.currency ||
            balanceSource?.balanceAmount?.currency ||
            balanceSource?.balance_amount?.currency ||
            entry?.currency;

          return {
            amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
            currency: currencyFromBalance,
          };
        };

        const { amount: numericBalance, currency: balanceCurrency } = extractBalance(preferredBalance);
        const currency = (account?.currency || balanceCurrency || details?.currency || existing?.currency || 'EUR') as Currency;

        const baseSyncStart =
          clampSyncStartDate(syncStartDate) || clampSyncStartDate(existing?.syncStartDate) || ninetyDaysAgoStr;
        const accountLastSyncedAt = clampSyncStartDate(existing?.lastSyncedAt);
        const incrementalSyncStart =
          transactionMode === 'incremental'
            ? accountLastSyncedAt && new Date(accountLastSyncedAt) > new Date(baseSyncStart)
              ? accountLastSyncedAt
              : baseSyncStart
            : baseSyncStart;
        const syncStart = incrementalSyncStart;
        const shouldMarkSynced = shouldSyncTransactions || updateBalance;
        const providerTransactions: any[] = [];

        if (shouldSyncTransactions) {
          if (!existing?.linkedAccountId) {
            unlinkedProviderAccounts.push(providerAccountId);
          }
          let continuationKey: string | undefined;
          let transactionsPage: any = null;

          do {
            transactionsPage = await fetchWithAuth(`/api/enable-banking/accounts/${encodeURIComponent(providerAccountId)}/transactions`, {
              method: 'POST',
              body: JSON.stringify({
                applicationId: connection.applicationId,
                clientCertificate: connection.clientCertificate,
                dateFrom: syncStart,
                continuationKey,
                sessionId: connection.sessionId,
              }),
            }).then(res => res.json());
            const rawItems = transactionsPage?.booked || transactionsPage?.transactions || [];
            const pageItems = rawItems.filter((tx: any) => {
              const status = tx?.transaction_status || tx?.transactionStatus || tx?.status;
              if (!status) return true;
              const normalized = String(status).toUpperCase();
              return ['BOOK', 'BOOKED', 'COMPLETED', 'POSTED'].includes(normalized);
            });
            providerTransactions.push(...pageItems);
            continuationKey = transactionsPage?.continuation_key || transactionsPage?.continuationKey;
          } while (continuationKey);
        }

        const mappedTx = providerTransactions.length
          ? providerTransactions
              .map(tx => mapProviderTransaction(tx, existing?.linkedAccountId, providerAccountId, currency, connectionId))
              .filter((tx): tx is Transaction => Boolean(tx))
          : [];

        const detailSource = (details?.account || details?.details || details) as any;
        const detailName = detailSource?.name || detailSource?.product || detailSource?.display_name;
        const accountIban =
          findIbanCandidate(
            detailSource,
            detailSource?.account,
            detailSource?.account_id,
            detailSource?.identification,
            detailSource?.account?.identification,
            account,
            account?.account,
            account?.account_id,
            account?.identification,
            account?.resource,
            balances,
            existing?.accountNumber,
          );
        const normalizedAccountIban = normalizeIban(accountIban);

        const updatedAccount: EnableBankingAccount = {
          id: providerAccountId,
          name: detailName || account?.name || account?.product || account?.account_id?.iban || account?.iban || 'Bank account',
          bankName: connection.selectedBank || 'Enable Banking',
          currency,
          balance: updateBalance ? numericBalance : existing?.balance ?? numericBalance,
          accountNumber: normalizedAccountIban || account?.iban || account?.account_id?.iban || existing?.accountNumber,
          linkedAccountId: existing?.linkedAccountId,
          syncStartDate: baseSyncStart,
          lastSyncedAt: shouldMarkSynced ? now : existing?.lastSyncedAt,
        };

        return { account: updatedAccount, transactions: mappedTx };
      };

      for (let index = 0; index < selectedAccounts.length; index += concurrencyLimit) {
        const batch = selectedAccounts.slice(index, index + concurrencyLimit);
        const results = await Promise.all(batch.map(processAccount));
        results.forEach(result => {
          if (result.account) updatedAccounts.push(result.account);
          if (result.transactions.length) importedTransactions.push(...result.transactions);
        });
      }

      const mergedAccounts = new Map<string, EnableBankingAccount>();
      safeAccounts.forEach(acc => mergedAccounts.set(acc.id, acc));
      updatedAccounts.forEach(acc => mergedAccounts.set(acc.id, acc));
      const finalAccounts = Array.from(mergedAccounts.values());

      const latestSyncedAt = finalAccounts.reduce<string | undefined>((latest, account) => {
        if (!account.lastSyncedAt) return latest;
        if (!latest) return account.lastSyncedAt;
        return new Date(account.lastSyncedAt) > new Date(latest) ? account.lastSyncedAt : latest;
      }, undefined);

      // Update account balances when linked
      setAccounts(prev => prev.map(acc => {
        const linked = finalAccounts.find(a => a.linkedAccountId === acc.id);
        if (!linked) return acc;
        return {
          ...acc,
          balance: linked.balance,
          currency: linked.currency,
          balanceLastSyncedAt: now,
          balanceSource: 'enable_banking',
        };
      }));

      if (importedTransactions.length) {
        setTransactions(prev => {
          const existingTransactionIds = new Set(prev.map(tx => tx.id));
          const uniqueImports = new Map<string, Transaction>();

          importedTransactions.forEach(tx => {
            if (!uniqueImports.has(tx.id)) {
              uniqueImports.set(tx.id, tx);
            }
          });

          const dedupedImports: Transaction[] = [];
          uniqueImports.forEach(tx => {
            if (existingTransactionIds.has(tx.id)) return;
            existingTransactionIds.add(tx.id);
            dedupedImports.push(tx);
          });

          if (!dedupedImports.length) {
            return prev;
          }

          return [...prev, ...dedupedImports];
        });
      }

      const unlinkedMessage = unlinkedProviderAccounts.length
        ? `Transactions skipped for ${unlinkedProviderAccounts.length} unlinked account(s). Link them to import transactions.`
        : undefined;
      setEnableBankingConnections(prev => prev.map(conn => conn.id === connectionId ? {
        ...conn,
        status: 'ready',
        lastError: unlinkedMessage,
        lastSyncedAt: shouldSyncTransactions || updateBalance ? (latestSyncedAt || conn.lastSyncedAt) : conn.lastSyncedAt,
        sessionExpiresAt: connection.sessionExpiresAt,
        accounts: finalAccounts,
      } : conn));
    } catch (error: any) {
      console.error('Enable Banking sync failed', error);
      const rawMessage = error?.message || 'Sync failed';
      const requiresReauth = /session|expired|unauthori|consent/i.test(rawMessage);
      const message = requiresReauth
        ? 'Session expired or invalid. Please re-authorize this connection to continue syncing.'
        : rawMessage;
      setEnableBankingConnections(prev => prev.map(conn => conn.id === connectionId ? {
        ...conn,
        status: 'requires_update',
        lastError: message,
      } : conn));
    }
  }, [enableBankingConnections, fetchWithAuth, mapProviderTransaction, resolveProviderAccountId, setAccounts, setTransactions, token]);

  const handleDeleteEnableBankingConnection = useCallback((connectionId: string) => {
    setEnableBankingConnections(prev => prev.filter(conn => conn.id !== connectionId));
    removePendingConnection(connectionId);
    if (!isDemoMode) {
      void fetchWithAuth(`/api/enable-banking/pending/${encodeURIComponent(connectionId)}`, {
        method: 'DELETE',
      }).catch(error => {
        console.warn('Failed to remove pending Enable Banking connection on server', error);
      });
    }
  }, [fetchWithAuth, isDemoMode]);

  const handleLinkEnableBankingAccount = useCallback(
    (connectionId: string, providerAccountId: string, payload: EnableBankingLinkPayload) => {
      let finalLinkedAccountId: string | undefined = 'linkedAccountId' in payload ? payload.linkedAccountId : undefined;

      if ('newAccount' in payload) {
        const generatedId = `acc-${uuidv4()}`;
        handleSaveAccount({ ...payload.newAccount, id: generatedId });
        finalLinkedAccountId = generatedId;
      }

      if (!finalLinkedAccountId) return;

      const minSyncDate = toLocalISOString(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
      const maxSyncDate = toLocalISOString(new Date());
      const chosenDate = new Date(payload.syncStartDate);

      const syncStartDate =
        chosenDate < new Date(minSyncDate)
          ? minSyncDate
          : chosenDate > new Date(maxSyncDate)
            ? maxSyncDate
            : payload.syncStartDate;

      setEnableBankingConnections(prev => prev.map(conn => {
        if (conn.id !== connectionId) return conn;

        const updatedAccounts = conn.accounts.map(account => account.id === providerAccountId ? {
          ...account,
          linkedAccountId: finalLinkedAccountId,
          syncStartDate,
        } : account);

        return { ...conn, accounts: updatedAccounts };
      }));
    },
    [handleSaveAccount]
  );

  // --- Data Import / Export ---
  // FIX: Fixed syntax error in parameter types (|| to |) and resolved shadowing of newAccounts.
  const handlePublishImport = (
    items: (Omit<Account, 'id'> | Omit<Transaction, 'id'>)[],
    dataType: ImportDataType,
    fileName: string,
    originalData: Record<string, any>[],
    errors: Record<number, Record<string, string>>,
    newAccountsArg?: Account[]
  ) => {
      const importId = `imp-${uuidv4()}`;
      
      // First save any new accounts created during import mapping
      if (newAccountsArg && newAccountsArg.length > 0) {
          newAccountsArg.forEach(acc => handleSaveAccount(acc));
      }

      if (dataType === 'accounts') {
          const importedAccounts = items as Omit<Account, 'id'>[];
          importedAccounts.forEach(acc => handleSaveAccount(acc));
      } 
      else if (dataType === 'transactions') {
          const importedTransactions = items as Omit<Transaction, 'id'>[];
          const transactionsWithImportId = importedTransactions.map(t => ({ ...t, importId }));
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
        allowEmptySaveRef.current = true;
        loadAllFinancialData(emptyFinancialData);
        alert("Client-side data has been reset.");
    }
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
  const viewingHolding = useMemo(() => holdingsOverview.holdings.find(h => h.symbol === viewingHoldingSymbol), [holdingsOverview, viewingHoldingSymbol]);
  // Removed duplicate currentUser declaration here
  const linkedEnableBankingAccountIds = useMemo(() => {
    const ids = new Set<string>();
    enableBankingConnections.forEach(connection => {
      connection.accounts?.forEach(account => {
        if (account.linkedAccountId) ids.add(account.linkedAccountId);
      });
    });
    return ids;
  }, [enableBankingConnections]);

  const enableBankingLinkMap = useMemo(() => {
    const map = new Map<string, { connection: EnableBankingConnection; account: EnableBankingAccount }>();
    enableBankingConnections.forEach(connection => {
      connection.accounts?.forEach(account => {
        if (account.linkedAccountId) {
          map.set(account.linkedAccountId, { connection, account });
        }
      });
    });
    return map;
  }, [enableBankingConnections]);

  // Reset the account detail view if the referenced account no longer exists to avoid state updates during render
  useEffect(() => {
    if (!isDataLoaded) return;

    if (viewingAccountId && !viewingAccount) {
      setViewingAccountId(null);
      setCurrentPage('Dashboard');
    }
  }, [isDataLoaded, viewingAccount, viewingAccountId]);

  useEffect(() => {
    if (!isDataLoaded) return;

    if (viewingHoldingSymbol && !viewingHolding) {
      setViewingHoldingSymbol(null);
      setCurrentPage('Investments');
    }
  }, [isDataLoaded, viewingHolding, viewingHoldingSymbol]);

  useEffect(() => {
    if (viewingHoldingSymbol && !viewingHolding) {
      setViewingHoldingSymbol(null);
      setCurrentPage('Investments');
    }
  }, [viewingHolding, viewingHoldingSymbol]);

  const renderPage = () => {
    if (viewingHoldingSymbol) {
      if (viewingHolding) {
        return <HoldingDetail
          holdingSymbol={viewingHoldingSymbol}
          holdingsOverview={holdingsOverview}
          accounts={accounts}
          cashAccounts={accounts.filter(a => a.type === 'Checking' || a.type === 'Savings')}
          investmentTransactions={investmentTransactions}
          saveInvestmentTransaction={handleSaveInvestmentTransaction}
          warrants={warrants}
          saveWarrant={handleSaveWarrant}
          manualPrices={manualWarrantPrices}
          onManualPriceChange={handleManualWarrantPrice}
          onBack={() => setCurrentPage('Investments')}
          priceHistory={priceHistory} // Pass history down
        />
      }
      return <PageLoader label="Loading holding..." />;
    }

    if (viewingAccountId) {
      if (viewingAccount) {
        return <AccountDetail
          account={viewingAccount}
          setCurrentPage={setCurrentPage}
          setViewingAccountId={setViewingAccountId}
          saveAccount={handleSaveAccount}
          enableBankingLink={enableBankingLinkMap.get(viewingAccount.id)}
          onTriggerEnableBankingSync={handleSyncEnableBankingConnection}
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
        return <Accounts accounts={accounts} transactions={transactions} saveAccount={handleSaveAccount} deleteAccount={handleDeleteAccount} setCurrentPage={setCurrentPage} setViewingAccountId={setViewingAccountId} onViewAccount={handleOpenAccountDetail} saveTransaction={handleSaveTransaction} accountOrder={accountOrder} setAccountOrder={setAccountOrder} initialSortBy={preferences.defaultAccountOrder} warrants={warrants} onToggleAccountStatus={handleToggleAccountStatus} onNavigateToTransactions={navigateToTransactions} linkedEnableBankingAccountIds={linkedEnableBankingAccountIds} />;
      case 'Transactions':
        return <Transactions initialAccountFilter={transactionsViewFilters.current.accountName ?? null} initialTagFilter={transactionsViewFilters.current.tagId ?? null} onClearInitialFilters={clearPendingTransactionFilters} />;
      case 'Budget':
        return <Budgeting budgets={budgets} transactions={transactions} expenseCategories={expenseCategories} saveBudget={handleSaveBudget} deleteBudget={handleDeleteBudget} accounts={accounts} preferences={preferences} />;
      case 'Forecasting':
        return <Forecasting />;
      case 'Challenges':
        return <ChallengesPage 
          userStats={userStats} 
          accounts={accounts} 
          transactions={transactions} 
          predictions={predictions}
          savePrediction={handleSavePrediction}
          deletePrediction={handleDeletePrediction}
          saveUserStats={setUserStats}
          investmentTransactions={investmentTransactions}
          warrants={warrants}
          assetPrices={assetPrices}
        />;
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
            onResetAccount={handleResetAccount} 
            setCurrentPage={setCurrentPage}
            onRestoreData={handleRestoreData}
            fullFinancialData={dataToSave} // Pass full current state for granular export
            />;
      case 'Preferences':
        return <PreferencesPage preferences={preferences} setPreferences={setPreferences} theme={theme} setTheme={setTheme} setCurrentPage={setCurrentPage} />;
      case 'EnableBankingCallback':
        return (
          <EnableBankingCallbackPage
            connections={enableBankingConnections}
            setConnections={setEnableBankingConnections}
            onSync={handleSyncEnableBankingConnection}
            setCurrentPage={setCurrentPage}
            authToken={token}
          />
        );
      case 'Integrations':
        return <IntegrationsPage
          preferences={preferences}
          setPreferences={setPreferences}
          setCurrentPage={setCurrentPage}
          enableBankingConnections={enableBankingConnections}
          accounts={accounts}
          onCreateConnection={handleCreateEnableBankingConnection}
          onFetchBanks={handleFetchEnableBankingBanks}
          onDeleteConnection={handleDeleteEnableBankingConnection}
          onLinkAccount={handleLinkEnableBankingAccount}
          onTriggerSync={handleSyncEnableBankingConnection}
        />;
      case 'Investments':
        return <InvestmentsPage accounts={accounts} cashAccounts={accounts.filter(a => a.type === 'Checking' || a.type === 'Savings')} investmentTransactions={investmentTransactions} saveInvestmentTransaction={handleSaveInvestmentTransaction} saveAccount={handleSaveAccount} deleteInvestmentTransaction={handleDeleteInvestmentTransaction} saveTransaction={handleSaveTransaction} warrants={warrants} saveWarrant={handleSaveWarrant} deleteWarrant={handleDeleteWarrant} manualPrices={manualWarrantPrices} onManualPriceChange={handleManualWarrantPrice} prices={assetPrices} onOpenHoldingDetail={handleOpenHoldingDetail} holdingsOverview={holdingsOverview} onToggleAccountStatus={handleToggleAccountStatus} deleteAccount={handleDeleteAccount} transactions={transactions} onViewAccount={handleOpenAccountDetail} />;
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
      case 'Merchants':
        return <MerchantsPage setCurrentPage={setCurrentPage} />;
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
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 dark:from-black dark:to-[#171717]">
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
        <div className={`flex h-screen bg-gradient-to-br from-gray-50 to-gray-200 dark:from-black dark:to-[#171717] text-light-text dark:text-dark-text font-sans`}>
          <Sidebar
            currentPage={currentPage}
            setCurrentPage={(page) => { setViewingAccountId(null); setCurrentPage(page); }}
            isSidebarOpen={isSidebarOpen}
            setSidebarOpen={setSidebarOpen}
            theme={theme}
            setTheme={setTheme}
            isSidebarCollapsed={isSidebarCollapsed}
            setSidebarCollapsed={setSidebarCollapsed}
            onLogout={handleLogout}
            user={currentUser!}
            isPrivacyMode={isPrivacyMode}
            togglePrivacyMode={() => setIsPrivacyMode(!isPrivacyMode)}
          />
          <div className="flex-1 flex flex-col overflow-hidden relative z-0 bg-transparent">
             {/* Header removed here */}
             
             {/* Add Mobile Toggle */}
             <div className="md:hidden pt-4 px-4 flex-shrink-0">
                <button 
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 rounded-lg text-light-text dark:text-dark-text hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                  <span className="material-symbols-outlined">menu</span>
                </button>
             </div>

            <InsightsViewProvider
              accounts={accounts}
              financialGoals={financialGoals}
              defaultDuration={preferences.defaultPeriod as Duration}
            >
              <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8">
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
          {isDemoRestorePromptOpen && (
             <Suspense fallback={null}>
                <DemoRestorePrompt 
                    onClose={() => setIsDemoRestorePromptOpen(false)} 
                    onConfirm={() => {
                        setIsDemoRestorePromptOpen(false);
                        setIsGlobalRestoreOpen(true);
                    }}
                />
             </Suspense>
          )}
          {isGlobalRestoreOpen && (
             <Suspense fallback={null}>
                <SmartRestoreModal 
                    onClose={() => setIsGlobalRestoreOpen(false)} 
                    onRestore={handleGranularRestore} 
                    currentData={dataToSave}
                />
             </Suspense>
          )}
        </div>
      </FinancialDataProvider>
    </ErrorBoundary>
  );
};

export default App;
