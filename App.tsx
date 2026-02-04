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
  loadDocumentation,
  loadSubscriptionsPage,
  loadInvoicesPage,
  loadMerchantsPage
];

import { Page, Theme, Category, User, Transaction, Account, RecurringTransaction, RecurringTransactionOverride, WeekendAdjustment, FinancialGoal, Budget, ImportExportHistoryItem, AppPreferences, AccountType, InvestmentTransaction, Task, Warrant, ImportDataType, FinancialData, Currency, BillPayment, BillPaymentStatus, Duration, InvestmentSubType, Tag, LoanPaymentOverrides, ScheduledPayment, Membership, Invoice, UserStats, Prediction, PriceHistoryEntry, EnableBankingConnection, EnableBankingAccount, EnableBankingLinkPayload, EnableBankingSyncOptions } from './types';
import { MOCK_INCOME_CATEGORIES, MOCK_EXPENSE_CATEGORIES, LIQUID_ACCOUNT_TYPES } from './constants';
import { createDemoUser, emptyFinancialData, initialFinancialData } from './demoData';
import { v4 as uuidv4 } from 'uuid';
import { convertToEur, CONVERSION_RATES, arrayToCSV, downloadCSV, parseLocalDate, toLocalISOString, toLocalDateTimeString } from './utils';
import { buildHoldingsOverview } from './utils/investments';
import { useDebounce } from './hooks/useDebounce';
import { useAuth } from './hooks/useAuth';
import useLocalStorage from './hooks/useLocalStorage';
const OnboardingModal = lazy(() => import('./components/OnboardingModal'));
import { FinancialDataProvider } from './contexts/FinancialDataContext';
import { AccountsProvider, PreferencesProvider, TransactionsProvider, WarrantsProvider, InvoicesProvider } from './contexts/DomainProviders';
import { InsightsViewProvider } from './contexts/InsightsViewContext';
import { persistPendingConnection, removePendingConnection } from './utils/enableBankingStorage';

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

interface ErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message?: string;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, message: undefined };
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
  const [viewingHoldingSymbol, setViewingHoldingSymbol] = useState<string | null>(initialRoute.holdingSymbol ?? null);
  const [theme, setTheme] = useState<Theme>(() => {
    const storedTheme = safeLocalStorage.getItem('theme');
    return storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system' ? storedTheme : 'system';
  });
  
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
  
  useEffect(() => {
    if (!isDataLoaded || !isAuthenticated || streakUpdatedRef.current) return;

    const now = new Date();
    const todayStr = toLocalISOString(now);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = toLocalISOString(yesterday);

    let lastLogStr = userStats.lastLogDate || '';
    if (lastLogStr.includes('T')) {
        lastLogStr = lastLogStr.split('T')[0];
    }
    
    if (lastLogStr !== todayStr) {
       streakUpdatedRef.current = true;
       let newStreak = 1;
       if (lastLogStr === yesterdayStr) {
           newStreak = (userStats.currentStreak || 0) + 1;
       } else if (lastLogStr === todayStr) {
           newStreak = userStats.currentStreak || 1;
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

  useEffect(() => {
    if (!isAuthenticated) {
      streakUpdatedRef.current = false;
    }
  }, [isAuthenticated]);

  const assetPrices = useMemo<Record<string, number | null>>(() => {
    const resolved: Record<string, number | null> = {};
    accounts.filter(acc => acc.type === 'Investment' && acc.symbol).forEach(acc => {
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
      if (typeof price === 'number') {
        resolved[symbol] = price;
      }
    });
    return resolved;
  }, [accounts, manualWarrantPrices, warrants]);

  const investmentAccounts = useMemo(() => (
    accounts || []
  ).filter(a => a.type === 'Investment' && ['Stock', 'ETF', 'Crypto'].includes(a.subType || '') && a.status !== 'closed'), [accounts]);

  const holdingsOverview = useMemo(() => buildHoldingsOverview(investmentAccounts, investmentTransactions, warrants, assetPrices), [investmentAccounts, investmentTransactions, warrants, assetPrices]);

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
      if (replace) { window.history.replaceState(null, '', nextPath); } 
      else { window.history.pushState(null, '', nextPath); }
    } catch (e) {
      console.warn('Navigation state update failed, falling back to in-memory navigation:', e);
    }
    setCurrentPath(nextPath);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => { setCurrentPath(window.location.pathname || '/'); };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const route = parseRoute(currentPath);
    setCurrentPageState(route.page);
    setViewingAccountId(route.accountId ?? null);
    setViewingHoldingSymbol(route.holdingSymbol ?? null);
    if (!route.matched && currentPath !== '/') { navigateToPath('/', true); }
  }, [currentPath, navigateToPath]);

  useEffect(() => {
    if (isPrivacyMode) { document.body.classList.add('privacy-mode'); } 
    else { document.body.classList.remove('privacy-mode'); }
  }, [isPrivacyMode]);

  const setCurrentPage = useCallback((page: Page) => {
    const targetPath = pageToPath(page, page === 'AccountDetail' ? viewingAccountId : page === 'HoldingDetail' ? viewingHoldingSymbol : null);
    navigateToPath(targetPath);
    setCurrentPageState(page);
    if (page !== 'AccountDetail') { setViewingAccountId(null); }
    if (page !== 'HoldingDetail') { setViewingHoldingSymbol(null); }
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
      if (account.symbol && account.type === 'Investment' && (assetPrices as Record<string, number | null>)[account.symbol] !== undefined) {
        const price = (assetPrices as Record<string, number | null>)[account.symbol as string];
        const quantity = ((warrantHoldingsBySymbol as Record<string, number>)[account.symbol as string] as number) || 0;
        const calculatedBalance = (typeof price === 'number') ? quantity * price : 0;
        if (Math.abs((account.balance || 0) - calculatedBalance) > 0.0001) {
            hasChanges = true;
            return { ...account, balance: calculatedBalance };
        }
      }
      return account;
    });
    if (hasChanges) { setAccounts(updatedAccounts); }
  }, [assetPrices, warrantHoldingsBySymbol]);

  const loadAllFinancialData = useCallback((data: FinancialData | null, options?: { skipNextSave?: boolean; useDemoDefaults?: boolean }) => {
    const dataToLoad = data ?? (options?.useDemoDefaults ? initialFinancialData : emptyFinancialData);
    const loadedPrefs = {
      ...initialFinancialData.preferences,
      ...(dataToLoad.preferences || {}),
    };
    const dataSignature = JSON.stringify(dataToLoad);
    lastUpdatedAtRef.current = dataToLoad.lastUpdatedAt ?? null;

    if (options?.skipNextSave) { skipNextSaveRef.current = true; }

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
      setPriceHistory(dataToLoad.priceHistory || {});
      setInvoices(dataToLoad.invoices || []);
      setTags(dataToLoad.tags || []);
      setPredictions(dataToLoad.predictions || []);
      setIncomeCategories(dataToLoad.incomeCategories && dataToLoad.incomeCategories.length > 0 ? dataToLoad.incomeCategories : MOCK_INCOME_CATEGORIES);
      setExpenseCategories(dataToLoad.expenseCategories && dataToLoad.expenseCategories.length > 0 ? dataToLoad.expenseCategories : MOCK_EXPENSE_CATEGORIES);
      if (dataToLoad.userStats) { setUserStats(dataToLoad.userStats); } 
      else { setUserStats(emptyFinancialData.userStats!); }
      streakUpdatedRef.current = false;
      setEnableBankingConnections(dataToLoad.enableBankingConnections || []);
      setPreferences(loadedPrefs);
      setAccountOrder(dataToLoad.accountOrder || []);
      setTaskOrder(dataToLoad.taskOrder || []);
      dirtySlicesRef.current.clear();
      setDirtySignal(0);
      lastSavedSignatureRef.current = dataSignature;
      setIsDataLoaded(true);
    });
    latestDataRef.current = dataToLoad;
  }, [setAccountOrder, setTaskOrder]);
  
  const handleEnterDemoMode = () => {
    loadAllFinancialData(null, { useDemoDefaults: true });
    setDemoUser(createDemoUser());
    setIsDemoMode(true);
  };

  useEffect(() => {
    const authAndLoad = async () => {
        const data = await checkAuthStatus();
        if (data) { loadAllFinancialData(data, { skipNextSave: true }); } 
        else { setIsDataLoaded(true); }
    };
    if (!isDemoMode) { authAndLoad(); }
  }, [isDemoMode]);

  useEffect(() => {
    if (isDataLoaded && isAuthenticated && !isDemoMode && accounts.length === 0 && budgets.length === 0 && !hasCompletedOnboarding) {
      const timer = setTimeout(() => { setIsOnboardingOpen(true); }, 500);
      return () => clearTimeout(timer);
    }
  }, [isDataLoaded, isAuthenticated, isDemoMode, accounts.length, budgets.length, hasCompletedOnboarding]);

  const handleOnboardingFinish = () => {
    setHasCompletedOnboarding(true);
    setIsOnboardingOpen(false);
  };
  
  const handleSetUser = useCallback((updates: Partial<User>) => {
    if (isDemoMode) { setDemoUser(prev => prev ? {...prev, ...updates} as User : null); } 
    else { setUser(updates); }
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

  useEffect(() => { latestDataRef.current = dataToSave; }, [dataToSave]);

  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('accounts'); }, [accounts, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('transactions'); }, [transactions, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('investmentTransactions'); }, [investmentTransactions, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('recurringTransactions'); }, [recurringTransactions, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('recurringTransactionOverrides'); }, [recurringTransactionOverrides, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('loanPaymentOverrides'); }, [loanPaymentOverrides, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('financialGoals'); }, [financialGoals, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('budgets'); }, [budgets, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('tasks'); }, [tasks, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('warrants'); }, [warrants, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('memberships'); }, [memberships, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('manualWarrantPrices'); }, [manualWarrantPrices, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('priceHistory'); }, [priceHistory, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('importExportHistory'); }, [importExportHistory, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('incomeCategories'); }, [incomeCategories, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('expenseCategories'); }, [expenseCategories, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('preferences'); }, [preferences, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('billsAndPayments'); }, [billsAndPayments, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('accountOrder'); }, [accountOrder, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('taskOrder'); }, [taskOrder, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('tags'); }, [tags, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('invoices'); }, [invoices, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('userStats'); }, [userStats, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('predictions'); }, [predictions, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('enableBankingConnections'); }, [enableBankingConnections, isDataLoaded, markSliceDirty]);

  const postData = useCallback(
    async (payload: Record<string, unknown>, options?: { keepalive?: boolean; suppressErrors?: boolean }): Promise<boolean> => {
      if (!token || isDemoMode) return false;
      try {
        const response = await fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, },
          body: JSON.stringify(payload),
          keepalive: options?.keepalive,
        });
        if (!response.ok) { return false; }
        return true;
      } catch (error) { return false; }
    }, [token, isDemoMode]
  );

  const saveData = useCallback(
    async (data: FinancialData, options?: { keepalive?: boolean; suppressErrors?: boolean; allowEmpty?: boolean }): Promise<boolean> => {
      if (!options?.allowEmpty && !hasMaterialData(data)) {
          console.warn('Skipping auto-save of empty data payload to prevent potential data loss.');
          return false;
      }
      const now = toLocalDateTimeString(new Date());
      const payload = { ...data, lastUpdatedAt: now, previousUpdatedAt: lastUpdatedAtRef.current, ...(options?.allowEmpty ? { allowEmpty: true } : {}), };
      const succeeded = await postData(payload, options);
      if (succeeded) { lastUpdatedAtRef.current = now; }
      return succeeded;
    }, [postData]
  );

  const savePartialData = useCallback(
    async (data: Partial<FinancialData>, options?: { keepalive?: boolean; suppressErrors?: boolean }): Promise<boolean> => {
      const now = toLocalDateTimeString(new Date());
      const payload = { partial: true, data, lastUpdatedAt: now, previousUpdatedAt: lastUpdatedAtRef.current, };
      const succeeded = await postData(payload, options);
      if (succeeded) { lastUpdatedAtRef.current = now; }
      return succeeded;
    }, [postData]
  );

  const saveDataWithRetry = useCallback(
    async (data: FinancialData, options?: { attempts?: number }): Promise<boolean> => {
      const maxAttempts = Math.max(1, options?.attempts ?? 3);
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const succeeded = await saveData(data);
        if (succeeded) return true;
        if (attempt < maxAttempts) await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
      return false;
    }, [saveData]
  );

  const savePartialDataWithRetry = useCallback(
    async (data: Partial<FinancialData>, options?: { attempts?: number }): Promise<boolean> => {
      const maxAttempts = Math.max(1, options?.attempts ?? 3);
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const succeeded = await savePartialData(data);
        if (succeeded) return true;
        if (attempt < maxAttempts) await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
      return false;
    }, [savePartialData]
  );

  const handleRestoreData = useCallback((data: FinancialData) => {
      restoreInProgressRef.current = true;
      skipNextSaveRef.current = true;
      if (data.userProfile) { handleSetUser(data.userProfile); }
      loadAllFinancialData(data);
      if (!isDemoMode && token) {
           saveData(data, { suppressErrors: true })
            .catch(console.error)
            .finally(() => { restoreInProgressRef.current = false; skipNextSaveRef.current = false; });
      } else {
          restoreInProgressRef.current = false;
          skipNextSaveRef.current = false;
      }
  }, [isDemoMode, token, loadAllFinancialData, saveData, handleSetUser]);

  useEffect(() => {
    if (!isDataLoaded || !isAuthenticated || isDemoMode || restoreInProgressRef.current) return;
    if (skipNextSaveRef.current) { skipNextSaveRef.current = false; dirtySlicesRef.current.clear(); return; }
    if (dirtySlicesRef.current.size === 0) return;
    const persistDirtySlices = async () => {
      const payloadSignature = JSON.stringify(dataToSave);
      if (payloadSignature === lastSavedSignatureRef.current) { dirtySlicesRef.current.clear(); return; }
      if (!allowEmptySaveRef.current && !hasMaterialData(dataToSave)) { dirtySlicesRef.current.clear(); lastSavedSignatureRef.current = payloadSignature; return; }
      const allowEmpty = allowEmptySaveRef.current;
      const succeeded = await saveData(dataToSave, { allowEmpty });
      if (succeeded) {
        dirtySlicesRef.current.clear();
        lastSavedSignatureRef.current = payloadSignature;
        if (allowEmpty) allowEmptySaveRef.current = false;
      }
    };
    persistDirtySlices();
  }, [dataToSave, debouncedDirtySignal, isAuthenticated, isDataLoaded, isDemoMode, saveData]);

  useEffect(() => {
    if (!isAuthenticated || isDemoMode || typeof window === 'undefined') return;
    const handleBeforeUnload = () => {
      if (!isDataLoaded || dirtySlicesRef.current.size === 0) return;
      const payloadSignature = JSON.stringify(dataToSave);
      if (payloadSignature === lastSavedSignatureRef.current) return;
      saveData(dataToSave, { keepalive: true, suppressErrors: true }).catch(() => {});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dataToSave, isAuthenticated, isDataLoaded, isDemoMode, saveData]);
  
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

  const handleSignIn = async (email: string, password: string) => {
    setIsDataLoaded(false);
    const financialData = await signIn(email, password);
    if (financialData) { loadAllFinancialData(financialData, { skipNextSave: true }); } 
    else { setIsDataLoaded(true); }
  };

  const handleSignUp = async (newUserData: { firstName: string, lastName: string, email: string, password: string }) => {
    setIsDataLoaded(false);
    const financialData = await signUp(newUserData);
    if (financialData) { loadAllFinancialData(financialData, { skipNextSave: true }); } 
    else { setIsDataLoaded(true); }
  };

  const finalizeLogout = useCallback(() => {
    signOut();
    loadAllFinancialData(null);
    setHasCompletedOnboarding(false);
    setAuthPage('signIn');
    setIsDemoMode(false);
    setDemoUser(null);
    streakUpdatedRef.current = false;
  }, [signOut, loadAllFinancialData, setHasCompletedOnboarding, setAuthPage, setIsDemoMode, setDemoUser]);

  const handleLogout = useCallback(() => {
    if (!isDemoMode && isAuthenticated && isDataLoaded) {
      saveData(latestDataRef.current).catch(err => {}).finally(finalizeLogout);
      return;
    }
    finalizeLogout();
  }, [finalizeLogout, isAuthenticated, isDataLoaded, isDemoMode, saveData]);

  const handleSaveAccount = (accountData: Omit<Account, 'id'> & { id?: string }) => {
    const accountWithDefaults = { ...accountData, includeInAnalytics: accountData.includeInAnalytics ?? true } as Omit<Account, 'id'> & { id?: string };
    if (accountData.id) {
        setAccounts(prev => {
            const intermediateAccounts = prev.map(acc => acc.id === accountData.id ? { ...acc, ...accountWithDefaults } as Account : acc);
            if (accountWithDefaults.isPrimary) {
                return intermediateAccounts.map(acc => {
                    if (acc.type === accountWithDefaults.type && acc.id !== accountWithDefaults.id && acc.isPrimary) {
                        return { ...acc, isPrimary: false };
                    }
                    return acc;
                });
            }
            return intermediateAccounts;
        });
    } else {
        const newAccount = { ...accountWithDefaults, id: `acc-${uuidv4()}`, status: 'open' as const } as Account;
        setAccounts(prev => {
            let newAccounts = [...prev, newAccount];
            if (newAccount.isPrimary) {
                newAccounts = newAccounts.map(acc => {
                    if (acc.type === newAccount.type && acc.id !== newAccount.id && acc.isPrimary) { return { ...acc, isPrimary: false }; }
                    return acc;
                });
            }
            return newAccounts;
        });
    }
  };

  const handleToggleAccountStatus = (accountId: string) => {
    setAccounts(prev => prev.map(acc => acc.id === accountId ? { ...acc, status: acc.status === 'closed' ? 'open' : 'closed' } : acc));
  };

  const handleDeleteAccount = useCallback((accountId: string) => {
    const accountToDelete = accounts.find(acc => acc.id === accountId);
    if (!accountToDelete) return;
    const impactedRecurringIds = new Set(recurringTransactions.filter(rt => rt.accountId === accountId || rt.toAccountId === accountId).map(rt => rt.id));
    setAccounts(prev => prev.filter(acc => acc.id !== accountId));
    setTransactions(prev => prev.filter(tx => tx.accountId !== accountId));
    setInvestmentTransactions(prev => prev.filter(tx => tx.symbol !== accountToDelete.symbol));
    setWarrants(prev => prev.filter(w => w.isin !== accountToDelete.symbol));
    setManualWarrantPrices(prev => { const { [accountToDelete.symbol || '']: _, ...rest } = prev; return rest; });
    setRecurringTransactions(prev => prev.filter(rt => rt.accountId !== accountId && rt.toAccountId !== accountId));
    if (impactedRecurringIds.size > 0) { setRecurringTransactionOverrides(prev => prev.filter(override => !impactedRecurringIds.has(override.recurringTransactionId))); }
    setBillsAndPayments(prev => prev.filter(bill => bill.accountId !== accountId));
    if (viewingAccountId === accountId) { setViewingAccountId(null); setCurrentPage('Accounts'); }
    if (viewingHoldingSymbol === accountToDelete.symbol) { setViewingHoldingSymbol(null); setCurrentPage('Investments'); }
  }, [accounts, recurringTransactions, viewingAccountId, viewingHoldingSymbol, setCurrentPage]);

  const handleSaveTransaction = useCallback((transactionDataArray: (Omit<Transaction, 'id'> & { id?: string })[], transactionIdsToDelete: string[] = []) => {
    const balanceChanges: Record<string, number> = {};
    const transactionsToUpdate: Transaction[] = [];
    const transactionsToAdd: Transaction[] = [];
    if (transactionIdsToDelete.length > 0) {
        const transactionsToDelete = transactions.filter(t => transactionIdsToDelete.includes(t.id));
        transactionsToDelete.forEach(tx => {
            const account = accounts.find(a => a.id === tx.accountId);
            let changeAmount = tx.amount;
            if (account?.type === 'Loan' && tx.type === 'income' && tx.principalAmount != null) { changeAmount = tx.principalAmount; }
            balanceChanges[tx.accountId] = (balanceChanges[tx.accountId] || 0) - convertToEur(changeAmount, tx.currency);
        });
    }
    transactionDataArray.forEach(transactionData => {
        if (transactionData.id && transactions.some(t => t.id === transactionData.id)) {
            const updatedTx = { ...transactions.find(t => t.id === transactionData.id), ...transactionData } as Transaction;
            const originalTx = transactions.find(t => t.id === updatedTx.id);
            if (originalTx) {
                const originalAccount = accounts.find(a => a.id === originalTx.accountId);
                let originalChangeAmount = originalTx.amount;
                if (originalAccount?.type === 'Loan' && originalTx.type === 'income' && originalTx.principalAmount != null) { originalChangeAmount = originalTx.principalAmount; }
                balanceChanges[originalTx.accountId] = (balanceChanges[originalTx.accountId] || 0) - convertToEur(originalChangeAmount, originalTx.currency);
                const updatedAccount = accounts.find(a => a.id === updatedTx.accountId);
                let updatedChangeAmount = updatedTx.amount;
                if (updatedAccount?.type === 'Loan' && updatedTx.type === 'income' && updatedTx.principalAmount != null) { updatedChangeAmount = updatedTx.principalAmount; }
                balanceChanges[updatedTx.accountId] = (balanceChanges[updatedTx.accountId] || 0) + convertToEur(updatedChangeAmount, updatedTx.currency);
                transactionsToUpdate.push(updatedTx);
            }
        } else {
            const newTx: Transaction = { ...transactionData, category: transactionData.category || 'Transfer', id: `txn-${uuidv4()}` } as Transaction;
            const account = accounts.find(a => a.id === newTx.accountId);
            let changeAmount = newTx.amount;
            if (account?.type === 'Loan' && newTx.type === 'income' && newTx.principalAmount != null) { changeAmount = newTx.principalAmount; }
            balanceChanges[newTx.accountId] = (balanceChanges[newTx.accountId] || 0) + convertToEur(changeAmount, newTx.currency);
            transactionsToAdd.push(newTx);
        }
    });
    setTransactions(prev => {
        let intermediateState = transactionIdsToDelete.length > 0 ? prev.filter(t => !transactionIdsToDelete.includes(t.id)) : prev;
        const updatedTransactions = intermediateState.map(t => transactionsToUpdate.find(ut => ut.id === t.id) || t);
        return [...updatedTransactions, ...transactionsToAdd];
    });
    setAccounts(prevAccounts => prevAccounts.map(account => {
            if (balanceChanges[account.id]) {
                const changeInAccountCurrency = balanceChanges[account.id] / (CONVERSION_RATES[account.currency] || 1);
                const newBalance = account.balance + changeInAccountCurrency;
                return { ...account, balance: parseFloat(newBalance.toFixed(account.currency === 'BTC' ? 8 : 2)) };
            }
            return account;
        })
    );
  }, [accounts, transactions]);

  const handleDeleteTransactions = (transactionIds: string[]) => { if (transactionIds.length > 0) handleSaveTransaction([], transactionIds); };
  const handleSaveInvestmentTransaction = (invTxData: Omit<InvestmentTransaction, 'id'> & { id?: string }, cashTxData?: Omit<Transaction, 'id'>, newAccount?: Omit<Account, 'id'>) => {
      if (invTxData.id) { setInvestmentTransactions(prev => prev.map(t => t.id === invTxData.id ? {...t, ...invTxData} as InvestmentTransaction : t)); } 
      else {
          setInvestmentTransactions(prev => [...prev, { ...invTxData, id: `inv-txn-${uuidv4()}` } as InvestmentTransaction]);
          if (cashTxData) handleSaveTransaction([cashTxData]);
          if (newAccount) handleSaveAccount(newAccount);
      }
  };
  const handleDeleteInvestmentTransaction = (id: string) => { setInvestmentTransactions(prev => prev.filter(t => t.id !== id)); };
  const handleSaveRecurringTransaction = (recurringData: Omit<RecurringTransaction, 'id'> & { id?: string }) => {
    if (recurringData.id) { setRecurringTransactions(prev => prev.map(rt => rt.id === recurringData.id ? { ...rt, ...recurringData } as RecurringTransaction : rt)); } 
    else { setRecurringTransactions(prev => [...prev, { ...recurringData, id: `rec-${uuidv4()}` } as RecurringTransaction]); }
  };
  const handleDeleteRecurringTransaction = (id: string) => { setRecurringTransactions(prev => prev.filter(rt => rt.id !== id)); };
  const handleSaveLoanPaymentOverrides = (accountId: string, overrides: Record<number, Partial<ScheduledPayment>>) => { setLoanPaymentOverrides(prev => ({ ...prev, [accountId]: overrides })); };
  const handleSaveRecurringOverride = (override: RecurringTransactionOverride) => {
    setRecurringTransactionOverrides(prev => {
      const existingIndex = prev.findIndex(o => o.recurringTransactionId === override.recurringTransactionId && o.originalDate === override.originalDate);
      if (existingIndex > -1) { const newOverrides = [...prev]; newOverrides[existingIndex] = { ...newOverrides[existingIndex], ...override }; return newOverrides; }
      return [...prev, override];
    });
  };
  const handleDeleteRecurringOverride = (recurringTransactionId: string, originalDate: string) => { setRecurringTransactionOverrides(prev => prev.filter(o => !(o.recurringTransactionId === recurringTransactionId && o.originalDate === originalDate))); };
  const handleSaveFinancialGoal = (goalData: Omit<FinancialGoal, 'id'> & { id?: string }) => {
    if (goalData.id) { setFinancialGoals((prev) => prev.map((g) => (g.id === goalData.id ? { ...g, ...goalData } as FinancialGoal : g))); } 
    else { setFinancialGoals((prev) => [...prev, { ...goalData, id: `goal-${uuidv4()}` } as FinancialGoal]); }
  };
  const handleDeleteFinancialGoal = (id: string) => {
    const goalToDelete = financialGoals.find((g) => g.id === id);
    if (!goalToDelete) return;
    let idsToDelete = [id];
    if (goalToDelete.isBucket) { idsToDelete.push(...financialGoals.filter((g) => g.parentId === id).map((g) => g.id)); }
    setFinancialGoals((prev) => prev.filter((g) => !idsToDelete.includes(g.id)));
  };
  const handleSaveBudget = (budgetData: Omit<Budget, 'id'> & { id?: string }) => {
    if (budgetData.id) { setBudgets(prev => prev.map(b => b.id === budgetData.id ? { ...b, ...budgetData } as Budget : b)); } 
    else { setBudgets(prev => [...prev, { ...budgetData, id: `bud-${uuidv4()}` } as Budget]); }
  };
  const handleDeleteBudget = (id: string) => { setBudgets(prev => prev.filter(b => b.id !== id)); };
  const handleSaveTask = (taskData: Omit<Task, 'id'> & { id?: string }) => {
    if (taskData.id) { setTasks(prev => prev.map(t => t.id === taskData.id ? { ...t, ...taskData } as Task : t)); } 
    else { setTasks(prev => [...prev, { ...taskData, id: `task-${uuidv4()}` } as Task]); }
  };
  const handleDeleteTask = (taskId: string) => { setTasks(prev => prev.filter(t => t.id !== taskId)); };
  const handleSaveWarrant = (warrantData: Omit<Warrant, 'id'> & { id?: string }) => {
    if (warrantData.id) { setWarrants(prev => prev.map(w => w.id === warrantData.id ? { ...w, ...warrantData } as Warrant : w)); } 
    else {
        setWarrants(prev => [...prev, { ...warrantData, id: `warr-${uuidv4()}` } as Warrant]);
        if (!accounts.some(acc => acc.symbol === warrantData.isin.toUpperCase())) {
            handleSaveAccount({ name: warrantData.name, type: 'Investment', subType: 'ETF', symbol: warrantData.isin.toUpperCase(), balance: 0, currency: 'EUR' });
        }
    }
  };
  const handleDeleteWarrant = (warrantId: string) => {
    const warrantToDelete = warrants.find(w => w.id === warrantId);
    setWarrants(prev => prev.filter(w => w.id !== warrantId));
    if (warrantToDelete) {
      setManualWarrantPrices(prev => { const updated = { ...prev }; delete updated[warrantToDelete.isin]; return updated; });
    }
  };
  const handleManualWarrantPrice = (isin: string, priceOrEntries: number | null | {date: string, price: number}[], date?: string) => {
    if (Array.isArray(priceOrEntries)) {
        setPriceHistory((prev: Record<string, PriceHistoryEntry[]>) => {
            const historyMap = new Map<string, PriceHistoryEntry>((prev[isin] || []).map((item: PriceHistoryEntry) => [item.date, item]));
            priceOrEntries.forEach((entry: {date: string, price: number}) => historyMap.set(entry.date, entry as PriceHistoryEntry));
            const newList = Array.from(historyMap.values()).sort((a: PriceHistoryEntry, b: PriceHistoryEntry) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const latest = newList.length > 0 ? newList[newList.length - 1] : null;
            setManualWarrantPrices(cp => { const np = { ...cp }; if (latest) np[isin] = latest.price; else if (newList.length === 0) delete np[isin]; return np; });
            return { ...prev, [isin]: newList };
        });
        setLastUpdated(new Date());
        return;
    }
    setPriceHistory((prev: Record<string, PriceHistoryEntry[]>) => {
        let newList = prev[isin] ? [...prev[isin]] : [];
        const targetDate = date || toLocalISOString(new Date());
        if (priceOrEntries === null) { 
            newList = newList.filter((item: PriceHistoryEntry) => item.date !== targetDate); 
        } 
        else {
            const index = newList.findIndex((item: PriceHistoryEntry) => item.date === targetDate);
            if (index > -1) newList[index] = { date: targetDate, price: priceOrEntries };
            else newList.push({ date: targetDate, price: priceOrEntries });
        }
        newList.sort((a: PriceHistoryEntry, b: PriceHistoryEntry) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const latest = newList.length > 0 ? newList[newList.length - 1] : null;
        setManualWarrantPrices(cp => { const np = { ...cp }; if (latest) np[isin] = latest.price; else if (priceOrEntries === null && newList.length === 0) delete np[isin]; return np; });
        return { ...prev, [isin]: newList };
    });
    setLastUpdated(new Date());
  };
  const handleSaveTag = (tagData: Omit<Tag, 'id'> & { id?: string }) => {
    if (tagData.id) { setTags(prev => prev.map(t => (t.id === tagData.id ? { ...t, ...tagData } as Tag : t))); } 
    else { setTags(prev => [...prev, { ...tagData, id: `tag-${uuidv4()}` } as Tag]); }
  };
  const handleDeleteTag = (tagId: string) => {
      setTags(prev => prev.filter(t => t.id !== tagId));
      setTransactions(prev => prev.map(tx => tx.tagIds?.includes(tagId) ? { ...tx, tagIds: tx.tagIds.filter(id => id !== tagId) } : tx));
      if (transactionsViewFilters.current.tagId === tagId) transactionsViewFilters.current.tagId = null;
  };
  const handleSaveBillPayment = (billData: Omit<BillPayment, 'id'> & { id?: string }) => {
    if (billData.id) { setBillsAndPayments(prev => prev.map(b => b.id === billData.id ? {...b, ...billData} as BillPayment : b)); } 
    else { setBillsAndPayments(prev => [...prev, { ...billData, id: `bill-${uuidv4()}` } as BillPayment]); }
  };
  const handleDeleteBillPayment = (billId: string) => { setBillsAndPayments(prev => prev.filter(b => b.id !== billId)); };
  const handleMarkBillAsPaid = (billId: string, paymentAccountId: string, paymentDate: string) => {
    const bill = billsAndPayments.find(b => b.id === billId);
    if (!bill) return;
    setBillsAndPayments(prev => prev.map(b => b.id === billId ? { ...b, status: 'paid' as BillPaymentStatus, accountId: paymentAccountId, dueDate: paymentDate } : b));
    const paymentAccount = accounts.find(a => a.id === paymentAccountId);
    if (paymentAccount) { handleSaveTransaction([{ accountId: paymentAccountId, date: paymentDate, description: bill.description, amount: bill.amount, category: bill.amount >= 0 ? 'Income' : 'Bills & Utilities', type: bill.amount >= 0 ? 'income' : 'expense', currency: paymentAccount.currency, }]); }
  };
  const handleSaveMembership = (membershipData: Omit<Membership, 'id'> & { id?: string }) => {
    if (membershipData.id) { setMemberships(prev => prev.map(m => m.id === membershipData.id ? { ...m, ...membershipData } as Membership : m)); } 
    else { setMemberships(prev => [...prev, { ...membershipData, id: `mem-${uuidv4()}` } as Membership]); }
  };
  const handleDeleteMembership = (membershipId: string) => { setMemberships(prev => prev.filter(m => m.id !== membershipId)); };
  const handleSaveInvoice = (invoiceData: Omit<Invoice, 'id'> & { id?: string }) => {
      if (invoiceData.id) { setInvoices(prev => prev.map(inv => inv.id === invoiceData.id ? { ...inv, ...invoiceData } as Invoice : inv)); } 
      else { setInvoices(prev => [...prev, { ...invoiceData, id: `inv-${uuidv4()}` } as Invoice]); }
  };
  const handleDeleteInvoice = (id: string) => { setInvoices(prev => prev.filter(inv => inv.id !== id)); };
  const handleSavePrediction = (predictionData: Omit<Prediction, 'id'> & { id?: string }) => {
      if (predictionData.id) { setPredictions(prev => prev.map(p => p.id === predictionData.id ? { ...p, ...predictionData } as Prediction : p)); } 
      else { setPredictions(prev => [...prev, { ...predictionData, id: `pred-${uuidv4()}` } as Prediction]); } // Changed setInvoices to setPredictions
  };
  const handleDeletePrediction = (id: string) => { setPredictions(prev => prev.filter(p => p.id !== id)); };

  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), }, });
    if (!response.ok) { const text = await response.text(); throw new Error(text || response.statusText); }
    return response;
  }, [token]);

  const handleFetchEnableBankingBanks = useCallback(async (payload: { applicationId: string; countryCode: string; clientCertificate: string; }) => {
    if (!token) throw new Error('You must be signed in to load banks.');
    const response = await fetchWithAuth('/api/enable-banking/aspsps', { method: 'POST', body: JSON.stringify({ applicationId: payload.applicationId.trim(), countryCode: payload.countryCode.trim().toUpperCase(), clientCertificate: payload.clientCertificate.trim(), }), });
    const data = await response.json();
    const items: any[] = Array.isArray(data) ? data : data?.aspsps || [];
    if (items.length === 0) throw new Error('No banks returned.');
    return items.map((item: any, index: number) => ({ id: item.id || item.aspsp_id || item.bank_id || item.name || `aspsp-${index}`, name: item.name || item.full_name || item.fullName || 'Bank', country: item.country || payload.countryCode, }));
  }, [fetchWithAuth, token]);

  const handleCreateEnableBankingConnection = useCallback(async (payload: { applicationId: string; countryCode: string; clientCertificate: string; selectedBank: string; connectionId?: string; }) => {
    if (!token) return;
    const connectionId = payload.connectionId || `eb-${uuidv4()}`;
    const existingConnection = payload.connectionId ? enableBankingConnections.find(conn => conn.id === payload.connectionId) : undefined;
    const baseConnection: EnableBankingConnection = {
          id: connectionId,
          applicationId: payload.applicationId.trim(),
          countryCode: payload.countryCode.trim().toUpperCase(),
          clientCertificate: payload.clientCertificate.trim(),
          status: 'pending',
          selectedBank: payload.selectedBank,
          accounts: existingConnection?.accounts || [],
          ...(existingConnection && { ...existingConnection })
    };
    let nextConnections: EnableBankingConnection[] = [];
    setEnableBankingConnections(prev => { nextConnections = existingConnection ? prev.map(conn => (conn.id === connectionId ? baseConnection : conn)) : [...prev, baseConnection]; return nextConnections; });
    persistPendingConnection(baseConnection);
    if (!isDemoMode && isDataLoaded) { void savePartialDataWithRetry({ enableBankingConnections: nextConnections }); }
    try {
      const response = await fetchWithAuth('/api/enable-banking/authorize', { method: 'POST', body: JSON.stringify({ applicationId: baseConnection.applicationId, clientCertificate: baseConnection.clientCertificate, countryCode: baseConnection.countryCode, aspspName: payload.selectedBank, state: connectionId, }), });
      const data = await response.json();
      setEnableBankingConnections(prev => prev.map(conn => conn.id === connectionId ? { ...conn, authorizationId: data.authorizationId, lastError: undefined, } : conn));
      if (data.authorizationUrl) { window.location.href = data.authorizationUrl; }
    } catch (error: any) {
      setEnableBankingConnections(prev => prev.map(conn => conn.id === connectionId ? { ...conn, status: 'requires_update', lastError: error?.message || 'Unable to start authorization', } : conn));
    }
  }, [enableBankingConnections, fetchWithAuth, isDataLoaded, isDemoMode, savePartialDataWithRetry, token]);

  const resolveProviderAccountId = useCallback((account: any) => {
    if (typeof account === 'string') return account;
    if (!account) return undefined;
    if (typeof account.account_id === 'string') return account.account_id;
    return account?.account_id?.id
      || account?.accountId
      || account?.account?.id
      || account?.resource_id
      || account?.uid
      || account?.id;
  }, []);
  const mapProviderTransaction = useCallback((providerTx: any, linkedAccountId: string | undefined, providerAccountId: string, currency: Currency, connectionId: string): Transaction | null => {
    const amountRaw = providerTx?.transaction_amount?.amount ?? providerTx?.amount?.amount ?? providerTx?.transactionAmount?.amount;
    if (amountRaw === undefined || amountRaw === null || !linkedAccountId) return null;
    const creditDebit = providerTx?.credit_debit_indicator || providerTx?.creditDebitIndicator;
    const signedAmount = Number(amountRaw) * (creditDebit === 'CRDT' ? 1 : -1);
    const date = providerTx?.booking_date || providerTx?.bookingDate || providerTx?.booking_date_time || providerTx?.bookingDateTime || providerTx?.value_date || providerTx?.valueDate;
    const desc = providerTx?.remittance_information_unstructured || providerTx?.description || 'Transaction';
    return { id: `eb-${connectionId}-${providerAccountId}-${providerTx?.transaction_id || uuidv4()}`, accountId: linkedAccountId, date: date || toLocalISOString(new Date()), description: desc, amount: signedAmount, category: 'Uncategorized', type: signedAmount >= 0 ? 'income' : 'expense', currency, importId: `enable-banking-${connectionId}-${linkedAccountId}`, };
  }, []);

  const handleSyncEnableBankingConnection = useCallback(async (connectionId: string, connectionOverride?: EnableBankingConnection, syncOptions?: EnableBankingSyncOptions) => {
    if (!token) return;
    const connection = connectionOverride || enableBankingConnections.find(c => c.id === connectionId);
    if (!connection?.sessionId) return;
    try {
      setEnableBankingConnections(prev => prev.map(conn => conn.id === connectionId ? { ...conn, status: 'pending', lastError: undefined } : conn));
      const session = await fetchWithAuth('/api/enable-banking/session/fetch', { method: 'POST', body: JSON.stringify({ sessionId: connection.sessionId, applicationId: connection.applicationId, clientCertificate: connection.clientCertificate, }), }).then(res => res.json());
      const accountsFromSession: any[] = session?.accounts || [];
      const updatedAccounts: EnableBankingAccount[] = [];
      const importedTransactions: Transaction[] = [];
      for (const account of accountsFromSession) {
          const providerAccountId = resolveProviderAccountId(account);
          if (!providerAccountId) {
            console.warn('Enable Banking account missing provider account id. Skipping.', account);
            continue;
          }
          const [details, balances] = await Promise.all([
            fetchWithAuth(`/api/enable-banking/accounts/${encodeURIComponent(providerAccountId)}/details`, { method: 'POST', body: JSON.stringify({ applicationId: connection.applicationId, clientCertificate: connection.clientCertificate, sessionId: connection.sessionId, }), }).then(res => res.json()).catch(() => null),
            fetchWithAuth(`/api/enable-banking/accounts/${encodeURIComponent(providerAccountId)}/balances`, { method: 'POST', body: JSON.stringify({ applicationId: connection.applicationId, clientCertificate: connection.clientCertificate, sessionId: connection.sessionId, }), }).then(res => res.json()),
          ]);
          const balanceEntry = balances?.balances?.[0] || {};
          const currency = (account?.currency || details?.currency || 'EUR') as Currency;
          updatedAccounts.push({ id: providerAccountId, name: details?.name || account?.name || 'Bank account', bankName: connection.selectedBank || 'Enable Banking', currency, balance: Number(balanceEntry?.balanceAmount?.amount || 0), linkedAccountId: connection.accounts?.find(a=>a.id === providerAccountId)?.linkedAccountId, lastSyncedAt: toLocalDateTimeString(new Date()) });
      }
      setEnableBankingConnections(prev => prev.map(conn => conn.id === connectionId ? { ...conn, status: 'ready', accounts: updatedAccounts, lastSyncedAt: toLocalDateTimeString(new Date()) } : conn));
    } catch (error: any) {
      setEnableBankingConnections(prev => prev.map(conn => conn.id === connectionId ? { ...conn, status: 'requires_update', lastError: error?.message || 'Sync failed', } : conn));
    }
  }, [enableBankingConnections, fetchWithAuth, resolveProviderAccountId, token]);

  const handleDeleteEnableBankingConnection = useCallback((connectionId: string) => {
    setEnableBankingConnections(prev => prev.filter(conn => conn.id !== connectionId));
    removePendingConnection(connectionId);
  }, []);

  const handleLinkEnableBankingAccount = useCallback((connectionId: string, providerAccountId: string, payload: EnableBankingLinkPayload) => {
      let finalLinkedAccountId: string | undefined = 'linkedAccountId' in payload ? payload.linkedAccountId : undefined;
      if ('newAccount' in payload) {
        const generatedId = `acc-${uuidv4()}`;
        handleSaveAccount({ ...payload.newAccount, id: generatedId });
        finalLinkedAccountId = generatedId;
      }
      if (!finalLinkedAccountId) return;
      setEnableBankingConnections(prev => prev.map(conn => {
        if (conn.id !== connectionId) return conn;
        return { ...conn, accounts: conn.accounts.map(a => a.id === providerAccountId ? { ...a, linkedAccountId: finalLinkedAccountId, syncStartDate: payload.syncStartDate } : a) };
      }));
    }, [handleSaveAccount]);

  const handlePublishImport = (items: any[], dataType: ImportDataType, fileName: string, originalData: Record<string, any>[], errors: Record<number, Record<string, string>>, newAccountsArg?: Account[]) => {
      const importId = `imp-${uuidv4()}`;
      if (newAccountsArg) { newAccountsArg.forEach(acc => handleSaveAccount(acc)); }
      if (dataType === 'accounts') { items.forEach(acc => handleSaveAccount(acc)); } 
      else if (dataType === 'transactions') { handleSaveTransaction(items.map(t => ({ ...t, importId }))); }
      setImportExportHistory(prev => [...prev, { id: importId, type: 'import', dataType, fileName, date: toLocalDateTimeString(new Date()), status: Object.keys(errors).length > 0 ? 'Failed' : 'Complete', itemCount: items.length, importedData: originalData, errors, }]);
  };
  
  const handleDeleteHistoryItem = (id: string) => { setImportExportHistory(prev => prev.filter(item => item.id !== id)); };
  const handleDeleteImportedTransactions = (importId: string) => { const idsToDelete = transactions.filter(t => t.importId === importId).map(t => t.id); if (idsToDelete.length > 0) handleDeleteTransactions(idsToDelete); };
  const handleResetAccount = () => { if (user) { allowEmptySaveRef.current = true; loadAllFinancialData(emptyFinancialData); alert("Client-side data reset."); } };
  
  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.classList.toggle('dark', isDark);
    safeLocalStorage.setItem('theme', theme);
  }, [theme]);
  
  const viewingAccount = useMemo(() => accounts.find(a => a.id === viewingAccountId), [accounts, viewingAccountId]);
  const viewingHolding = useMemo(() => holdingsOverview.holdings.find(h => h.symbol === viewingHoldingSymbol), [holdingsOverview, viewingHoldingSymbol]);

  const linkedEnableBankingAccountIds = useMemo(() => new Set(enableBankingConnections.flatMap(c => (c.accounts || []).map(a => a.linkedAccountId).filter(Boolean))), [enableBankingConnections]);
  const enableBankingLinkMap = useMemo(() => {
    const map = new Map<string, { connection: EnableBankingConnection; account: EnableBankingAccount }>();
    enableBankingConnections.forEach(c => (c.accounts || []).forEach(a => { if (a.linkedAccountId) map.set(a.linkedAccountId, { connection: c, account: a }); }));
    return map;
  }, [enableBankingConnections]);

  useEffect(() => {
    if (isDataLoaded) {
      if (viewingAccountId && !viewingAccount) { setViewingAccountId(null); setCurrentPage('Dashboard'); }
      if (viewingHoldingSymbol && !viewingHolding) { setViewingHoldingSymbol(null); setCurrentPage('Investments'); }
    }
  }, [isDataLoaded, viewingAccount, viewingAccountId, viewingHolding, viewingHoldingSymbol, setCurrentPage]);

  const renderPage = () => {
    if (viewingHoldingSymbol) {
      if (viewingHolding) return <HoldingDetail holdingSymbol={viewingHoldingSymbol} holdingsOverview={holdingsOverview} accounts={accounts} cashAccounts={accounts.filter(a => a.type === 'Checking' || a.type === 'Savings')} investmentTransactions={investmentTransactions} saveInvestmentTransaction={handleSaveInvestmentTransaction} warrants={warrants} saveWarrant={handleSaveWarrant} manualPrices={manualWarrantPrices} onManualPriceChange={handleManualWarrantPrice} onBack={() => setCurrentPage('Investments')} priceHistory={priceHistory} />;
      return <PageLoader label="Loading holding..." />;
    }
    if (viewingAccountId) {
      if (viewingAccount) return <AccountDetail account={viewingAccount} setCurrentPage={setCurrentPage} setViewingAccountId={setViewingAccountId} saveAccount={handleSaveAccount} enableBankingLink={enableBankingLinkMap.get(viewingAccount.id)} onTriggerEnableBankingSync={handleSyncEnableBankingConnection} />;
      return <PageLoader label="Loading account..." />;
    }
    switch (currentPage) {
      case 'Dashboard': return <Dashboard user={currentUser!} incomeCategories={incomeCategories} expenseCategories={expenseCategories} financialGoals={financialGoals} recurringTransactions={recurringTransactions} recurringTransactionOverrides={recurringTransactionOverrides} loanPaymentOverrides={loanPaymentOverrides} tasks={tasks} saveTask={handleSaveTask} />;
      case 'Accounts': return <Accounts accounts={accounts} transactions={transactions} saveAccount={handleSaveAccount} deleteAccount={handleDeleteAccount} setCurrentPage={setCurrentPage} setViewingAccountId={setViewingAccountId} onViewAccount={handleOpenAccountDetail} saveTransaction={handleSaveTransaction} accountOrder={accountOrder} setAccountOrder={setAccountOrder} initialSortBy={preferences.defaultAccountOrder} warrants={warrants} onToggleAccountStatus={handleToggleAccountStatus} onNavigateToTransactions={navigateToTransactions} linkedEnableBankingAccountIds={linkedEnableBankingAccountIds} />;
      case 'Transactions': return <Transactions initialAccountFilter={transactionsViewFilters.current.accountName ?? null} initialTagFilter={transactionsViewFilters.current.tagId ?? null} onClearInitialFilters={clearPendingTransactionFilters} />;
      case 'Budget': return <Budgeting budgets={budgets} transactions={transactions} expenseCategories={expenseCategories} saveBudget={handleSaveBudget} deleteBudget={handleDeleteBudget} accounts={accounts} preferences={preferences} />;
      case 'Forecasting': return <Forecasting />;
      case 'Challenges': return <ChallengesPage userStats={userStats} accounts={accounts} transactions={transactions} predictions={predictions} savePrediction={handleSavePrediction} deletePrediction={handleDeletePrediction} saveUserStats={setUserStats} investmentTransactions={investmentTransactions} warrants={warrants} assetPrices={assetPrices} />;
      case 'Settings': return <SettingsPage setCurrentPage={setCurrentPage} user={currentUser!} />;
      case 'Schedule & Bills': return <SchedulePage />;
      case 'Categories': return <CategoriesPage incomeCategories={incomeCategories} setIncomeCategories={setIncomeCategories} expenseCategories={expenseCategories} setExpenseCategories={setExpenseCategories} setCurrentPage={setCurrentPage} />;
      case 'Tags': return <TagsPage tags={tags} transactions={transactions} saveTag={handleSaveTag} deleteTag={handleDeleteTag} setCurrentPage={setCurrentPage} onNavigateToTransactions={navigateToTransactions} />;
      case 'Personal Info': return <PersonalInfoPage user={currentUser!} setUser={handleSetUser} onChangePassword={changePassword} setCurrentPage={setCurrentPage} />;
      case 'Data Management': return <DataManagement accounts={accounts} transactions={transactions} budgets={budgets} recurringTransactions={recurringTransactions} allCategories={[...incomeCategories, ...expenseCategories]} history={importExportHistory} onPublishImport={handlePublishImport} onDeleteHistoryItem={handleDeleteHistoryItem} onDeleteImportedTransactions={handleDeleteImportedTransactions} onResetAccount={handleResetAccount} setCurrentPage={setCurrentPage} onRestoreData={handleRestoreData} fullFinancialData={dataToSave} />;
      case 'Preferences': return <PreferencesPage preferences={preferences} setPreferences={setPreferences} theme={theme} setTheme={setTheme} setCurrentPage={setCurrentPage} />;
      case 'EnableBankingCallback': return <EnableBankingCallbackPage connections={enableBankingConnections} setConnections={setEnableBankingConnections} onSync={handleSyncEnableBankingConnection} setCurrentPage={setCurrentPage} authToken={token} />;
      case 'Integrations': return <IntegrationsPage preferences={preferences} setPreferences={setPreferences} setCurrentPage={setCurrentPage} enableBankingConnections={enableBankingConnections} accounts={accounts} onCreateConnection={handleCreateEnableBankingConnection} onFetchBanks={handleFetchEnableBankingBanks} onDeleteConnection={handleDeleteEnableBankingConnection} onLinkAccount={handleLinkEnableBankingAccount} onTriggerSync={handleSyncEnableBankingConnection} />;
      case 'Investments': return <InvestmentsPage accounts={accounts} cashAccounts={accounts.filter(a => a.type === 'Checking' || a.type === 'Savings')} investmentTransactions={investmentTransactions} saveInvestmentTransaction={handleSaveInvestmentTransaction} saveAccount={handleSaveAccount} deleteInvestmentTransaction={handleDeleteInvestmentTransaction} saveTransaction={handleSaveTransaction} warrants={warrants} saveWarrant={handleSaveWarrant} deleteWarrant={handleDeleteWarrant} manualPrices={manualWarrantPrices} onManualPriceChange={handleManualWarrantPrice} prices={assetPrices} onOpenHoldingDetail={handleOpenHoldingDetail} holdingsOverview={holdingsOverview} onToggleAccountStatus={handleToggleAccountStatus} deleteAccount={handleDeleteAccount} transactions={transactions} onViewAccount={handleOpenAccountDetail} />;
      case 'Tasks': return <TasksPage tasks={tasks} saveTask={handleSaveTask} deleteTask={handleDeleteTask} taskOrder={taskOrder} setTaskOrder={setTaskOrder} />;
      case 'Documentation': return <Documentation setCurrentPage={setCurrentPage} />;
      case 'Subscriptions': return <SubscriptionsPage />;
      case 'Quotes & Invoices': return <InvoicesPage />;
      case 'Merchants': return <MerchantsPage setCurrentPage={setCurrentPage} />;
      default: return <div>Page not found</div>;
    }
  };

  const preferencesContextValue = useMemo(() => ({ preferences, setPreferences }), [preferences]);
  const accountsContextValue = useMemo(() => ({ accounts, accountOrder, setAccountOrder, saveAccount: handleSaveAccount }), [accounts, accountOrder, handleSaveAccount]);
  const transactionsContextValue = useMemo(() => ({ transactions, saveTransaction: handleSaveTransaction, deleteTransactions: handleDeleteTransactions }), [transactions, handleDeleteTransactions, handleSaveTransaction]);
  const warrantsContextValue = useMemo(() => ({ warrants, prices: warrantPrices }), [warrantPrices, warrants]);
  const invoicesContextValue = useMemo(() => ({ invoices, saveInvoice: handleSaveInvoice, deleteInvoice: handleDeleteInvoice }), [invoices]);
  const categoryContextValue = useMemo(() => ({ incomeCategories, expenseCategories, setIncomeCategories, setExpenseCategories }), [expenseCategories, incomeCategories]);
  const tagsContextValue = useMemo(() => ({ tags, saveTag: handleSaveTag, deleteTag: handleDeleteTag }), [tags, handleSaveTag, handleDeleteTag]);
  const budgetsContextValue = useMemo(() => ({ budgets, saveBudget: handleSaveBudget, deleteBudget: handleDeleteBudget }), [budgets, handleDeleteBudget, handleSaveBudget]);
  const goalsContextValue = useMemo(() => ({ financialGoals, saveFinancialGoal: handleSaveFinancialGoal, deleteFinancialGoal: handleDeleteFinancialGoal }), [financialGoals, handleDeleteFinancialGoal, handleSaveFinancialGoal]);
  const scheduleContextValue = useMemo(() => ({ recurringTransactions, recurringTransactionOverrides, loanPaymentOverrides, billsAndPayments, memberships, saveRecurringTransaction: handleSaveRecurringTransaction, deleteRecurringTransaction: handleDeleteRecurringTransaction, saveRecurringOverride: handleSaveRecurringOverride, deleteRecurringOverride: handleDeleteRecurringOverride, saveLoanPaymentOverrides: handleSaveLoanPaymentOverrides, saveBillPayment: handleSaveBillPayment, deleteBillPayment: handleDeleteBillPayment, markBillAsPaid: handleMarkBillAsPaid, saveMembership: handleSaveMembership, deleteMembership: handleDeleteMembership, }), [billsAndPayments, memberships, handleDeleteBillPayment, handleDeleteRecurringOverride, handleDeleteRecurringTransaction, handleMarkBillAsPaid, handleSaveBillPayment, handleSaveLoanPaymentOverrides, handleSaveRecurringOverride, handleSaveRecurringTransaction, loanPaymentOverrides, recurringTransactionOverrides, recurringTransactions, ]);

  if (isAuthLoading || !isDataLoaded) return <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 dark:from-black dark:to-[#171717]"><svg className="animate-spin h-10 w-10 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>;

  if (!isAuthenticated && !isDemoMode) {
    return <Suspense fallback={<PageLoader label="Preparing sign-in experience..." />}>{authPage === 'signIn' ? <SignIn onSignIn={handleSignIn} onNavigateToSignUp={() => setAuthPage('signUp')} onEnterDemoMode={handleEnterDemoMode} isLoading={isAuthLoading} error={authError} /> : <SignUp onSignUp={handleSignUp} onNavigateToSignIn={() => setAuthPage('signIn')} isLoading={isAuthLoading} error={authError} />}</Suspense>;
  }

  if (!currentUser) return <PageLoader label="Loading user profile..." />;

  return (
    <FinancialDataProvider categories={categoryContextValue} tags={tagsContextValue} budgets={budgetsContextValue} goals={goalsContextValue} schedule={scheduleContextValue} preferences={preferencesContextValue} accounts={accountsContextValue} transactions={transactionsContextValue} warrants={warrantsContextValue} invoices={invoicesContextValue} >
        <InsightsViewProvider accounts={accounts} financialGoals={financialGoals} defaultDuration={preferences.defaultPeriod}>
             <div className={`flex h-screen bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text transition-colors duration-200 font-sans ${isPrivacyMode ? 'privacy-mode' : ''}`}>
                <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} isSidebarOpen={isSidebarOpen} setSidebarOpen={setSidebarOpen} theme={theme} setTheme={setTheme} isSidebarCollapsed={isSidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed} onLogout={handleLogout} user={currentUser} isPrivacyMode={isPrivacyMode} togglePrivacyMode={() => setIsPrivacyMode(!isPrivacyMode)} />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                    <Header user={currentUser} setSidebarOpen={setSidebarOpen} theme={theme} setTheme={setTheme} currentPage={currentPage} isPrivacyMode={isPrivacyMode} togglePrivacyMode={() => setIsPrivacyMode(!isPrivacyMode)} />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative scroll-smooth focus:outline-none" id="main-content">
                         <ErrorBoundary><Suspense fallback={<PageLoader />}>{renderPage()}</Suspense></ErrorBoundary>
                    </main>
                </div>
                {isOnboardingOpen && <OnboardingModal isOpen={isOnboardingOpen} onClose={handleOnboardingFinish} user={currentUser} saveAccount={handleSaveAccount} saveFinancialGoal={handleSaveFinancialGoal} saveRecurringTransaction={handleSaveRecurringTransaction} preferences={preferences} setPreferences={setPreferences} accounts={accounts} incomeCategories={incomeCategories} expenseCategories={expenseCategories} />}
             </div>
        </InsightsViewProvider>
    </FinancialDataProvider>
  );
};

export default App;
