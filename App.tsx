// FIX: Import `useMemo` from React to resolve the 'Cannot find name' error.
import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy, useRef, Component, ErrorInfo, startTransition } from 'react';
import Sidebar from './components/Sidebar';
import CommandCenter from './components/CommandCenter';
const SignIn = lazy(() => import('./pages/SignIn'));
const SignUp = lazy(() => import('./pages/SignUp'));
const pageRegistry = {
  Dashboard: { path: '/', loader: () => import('./pages/Dashboard') },
  Accounts: { path: '/accounts', loader: () => import('./pages/Accounts') },
  Transactions: { path: '/transactions', loader: () => import('./pages/Transactions') },
  Reports: { path: '/reports', loader: () => import('./pages/Reports') },
  Budget: { path: '/budget', loader: () => import('./pages/Budgeting') },
  Forecasting: { path: '/forecasting', loader: () => import('./pages/Forecasting') },
  Challenges: { path: '/challenges', loader: () => import('./pages/Challenges') },
  Settings: { path: '/settings', loader: () => import('./pages/Settings') },
  'Schedule & Bills': { path: '/schedule', loader: () => import('./pages/Schedule') },
  Tasks: { path: '/tasks', loader: () => import('./pages/Tasks') },
  Categories: { path: '/categories', loader: () => import('./pages/Categories') },
  Tags: { path: '/tags', loader: () => import('./pages/Tags') },
  'Personal Info': { path: '/personal-info', loader: () => import('./pages/PersonalInfo') },
  'Data Management': { path: '/data-management', loader: () => import('./pages/DataImportExport') },
  Preferences: { path: '/preferences', loader: () => import('./pages/Preferences') },
  Integrations: { path: '/integrations', loader: () => import('./pages/Integrations') },
  EnableBankingCallback: { path: '/enable-banking/callback', loader: () => import('./pages/EnableBankingCallback') },
  AccountDetail: { path: '/accounts', loader: () => import('./pages/AccountDetail') },
  Investments: { path: '/investments', loader: () => import('./pages/Investments') },
  HoldingDetail: { path: '/investments', loader: () => import('./pages/HoldingDetail') },
  Documentation: { path: '/documentation', loader: () => import('./pages/Documentation') },
  Subscriptions: { path: '/subscriptions', loader: () => import('./pages/Subscriptions') },
  'Quotes & Invoices': { path: '/invoices', loader: () => import('./pages/Invoices') },
  Merchants: { path: '/merchants', loader: () => import('./pages/Merchants') },
} as const;

const Dashboard = lazy(pageRegistry.Dashboard.loader);
const Accounts = lazy(pageRegistry.Accounts.loader);
const Transactions = lazy(pageRegistry.Transactions.loader);
const ReportsPage = lazy(pageRegistry.Reports.loader);
const Budgeting = lazy(pageRegistry.Budget.loader);
const Forecasting = lazy(pageRegistry.Forecasting.loader);
const ChallengesPage = lazy(pageRegistry.Challenges.loader);
const SettingsPage = lazy(pageRegistry.Settings.loader);
const SchedulePage = lazy(pageRegistry['Schedule & Bills'].loader);
const CategoriesPage = lazy(pageRegistry.Categories.loader);
const TagsPage = lazy(pageRegistry.Tags.loader);
const PersonalInfoPage = lazy(pageRegistry['Personal Info'].loader);
const DataImportExportPage = lazy(pageRegistry['Data Management'].loader);
const PreferencesPage = lazy(pageRegistry.Preferences.loader);
const IntegrationsPage = lazy(pageRegistry.Integrations.loader);
const AccountDetail = lazy(pageRegistry.AccountDetail.loader);
const EnableBankingCallbackPage = lazy(pageRegistry.EnableBankingCallback.loader);
const InvestmentsPage = lazy(pageRegistry.Investments.loader);
const HoldingDetail = lazy(pageRegistry.HoldingDetail.loader);
const TasksPage = lazy(pageRegistry.Tasks.loader);
const Documentation = lazy(pageRegistry.Documentation.loader);
const SubscriptionsPage = lazy(pageRegistry.Subscriptions.loader);
const InvoicesPage = lazy(pageRegistry['Quotes & Invoices'].loader);
const MerchantsPage = lazy(pageRegistry.Merchants.loader);

const pagePreloaders = Object.values(pageRegistry).map(entry => entry.loader);

import { Page, Theme, Category, User, Transaction, Account, RecurringTransaction, RecurringTransactionOverride, WeekendAdjustment, FinancialGoal, Budget, ImportExportHistoryItem, AppPreferences, AccountType, InvestmentTransaction, Task, Warrant, ImportDataType, FinancialData, Currency, BillPayment, BillPaymentStatus, Duration, InvestmentSubType, Tag, LoanPaymentOverrides, ScheduledPayment, Membership, Invoice, UserStats, Prediction, PriceHistoryEntry, EnableBankingConnection, EnableBankingAccount, EnableBankingLinkPayload, EnableBankingSyncOptions, AssetClosureDetails } from './types';
import { MOCK_INCOME_CATEGORIES, MOCK_EXPENSE_CATEGORIES, LIQUID_ACCOUNT_TYPES } from './constants';
import { createDemoUser, emptyFinancialData, initialFinancialData } from './demoData';
import { v4 as uuidv4 } from 'uuid';
import { convertToEur, CONVERSION_RATES, updateConversionRates, arrayToCSV, downloadCSV, parseLocalDate, toLocalISOString, toLocalDateTimeString } from './utils';
import { buildHoldingsOverview } from './utils/investments';
import { upsertEntity, removeEntityById } from './utils/collection';
import { useDebounce } from './hooks/useDebounce';
import { useAuth } from './hooks/useAuth';
import { useLocalStorage } from './hooks/useLocalStorage';
const OnboardingModal = lazy(() => import('./components/OnboardingModal'));
import { FinancialDataProvider } from './contexts/FinancialDataContext';
import { AccountsProvider, PreferencesProvider, TransactionsProvider, WarrantsProvider, InvoicesProvider } from './contexts/DomainProviders';
import { InsightsViewProvider } from './contexts/InsightsViewContext';
import { persistPendingConnection, removePendingConnection } from './utils/enableBankingStorage';
import { fetchAllExchangeRates } from './src/services/twelveDataService';

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

const routePathMap = Object.entries(pageRegistry).reduce((acc, [page, config]) => {
  acc[page as Page] = config.path;
  return acc;
}, {} as Record<Page, string>);

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

  const { user, setUser, isAuthenticated, isLoading: isAuthLoading, error: authError, signIn, signUp, signOut, checkAuthStatus, setError: setAuthError, changePassword, authorizedFetch } = useAuth();
  const [authPage, setAuthPage] = useState<'signIn' | 'signUp'>('signIn');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoUser, setDemoUser] = useState<User | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [isSyncingBanks, setIsSyncingBanks] = useState(false);

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
  const [isCommandCenterOpen, setIsCommandCenterOpen] = useState(false);

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

    const today = parseLocalDate(toLocalISOString(new Date()));
    const toDayStart = (dateStr: string): Date | null => {
      if (!dateStr) return null;
      const normalized = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      if (!normalized) return null;
      return parseLocalDate(normalized);
    };

    const lastLogDate = toDayStart(userStats.lastLogDate || '');
    const diffDays = lastLogDate
      ? Math.floor((today.getTime() - lastLogDate.getTime()) / (1000 * 60 * 60 * 24))
      : Number.POSITIVE_INFINITY;

    streakUpdatedRef.current = true;

    if (diffDays <= 0) {
      return;
    }

    setUserStats(prev => {
      const nextStreak = diffDays === 1 ? (prev.currentStreak || 0) + 1 : 1;
      return {
        ...prev,
        currentStreak: nextStreak,
        longestStreak: Math.max(nextStreak, prev.longestStreak || 0),
        lastLogDate: toLocalISOString(today),
      };
    });
    markSliceDirty('userStats');
  }, [isDataLoaded, isAuthenticated, userStats.lastLogDate, markSliceDirty]);

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
      if (loadedPrefs.conversionRates) {
        updateConversionRates(loadedPrefs.conversionRates);
      }
      setAccountOrder(dataToLoad.accountOrder || []);
      setTaskOrder(dataToLoad.taskOrder || []);
      dirtySlicesRef.current.clear();
      setDirtySignal(0);
      lastSavedSignatureRef.current = dataSignature;
      setIsDataLoaded(true);
    });
    latestDataRef.current = dataToLoad;
  }, [setAccountOrder, setTaskOrder]);

  // FX Rates Auto-update
  useEffect(() => {
    if (!preferences.twelveDataApiKey || !isDataLoaded) return;

    const fetchRates = async () => {
      try {
        const targets: Currency[] = ['USD', 'GBP', 'BTC', 'RON', 'EUR'];
        const rates = await fetchAllExchangeRates('EUR', targets, preferences.twelveDataApiKey!);
        
        setPreferences(prev => {
          const hasChanged = JSON.stringify(prev.conversionRates) !== JSON.stringify(rates);
          if (!hasChanged) return prev;
          updateConversionRates(rates);
          return { ...prev, conversionRates: rates };
        });
        markSliceDirty('preferences');
      } catch (error) {
        console.error('Failed to fetch FX rates:', error);
      }
    };

    // Fetch on load
    fetchRates();
    
    // Refresh every 4 hours
    const interval = setInterval(fetchRates, 4 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [preferences.twelveDataApiKey, isDataLoaded, markSliceDirty]);
  
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
      if (!isAuthenticated || isDemoMode) return false;
      try {
        const response = await authorizedFetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: options?.keepalive,
        });
        if (!response.ok) { return false; }
        return true;
      } catch (error) { return false; }
    }, [authorizedFetch, isAuthenticated, isDemoMode]
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

      // Create restoration summary
      const summaryParts: string[] = [];
      if (data.accounts?.length) summaryParts.push(`${data.accounts.length} accounts`);
      if (data.transactions?.length) summaryParts.push(`${data.transactions.length} transactions`);
      if (data.budgets?.length) summaryParts.push(`${data.budgets.length} budgets`);
      if (data.recurringTransactions?.length) summaryParts.push(`${data.recurringTransactions.length} repeating items`);
      if (data.financialGoals?.length) summaryParts.push(`${data.financialGoals.length} goals`);
      
      const summaryText = summaryParts.length > 0 
        ? `Restored: ${summaryParts.join(', ')}`
        : 'Restored full system snapshot';

      const historyItem: ImportExportHistoryItem = {
        id: `restore-${uuidv4()}`,
        type: 'restore',
        dataType: 'snapshot',
        fileName: 'Cloud Snapshot',
        date: new Date().toISOString(),
        status: 'Complete',
        itemCount: summaryParts.length,
        details: summaryText
      };

      // Add to history
      const updatedHistory = [historyItem, ...(data.importExportHistory || [])];
      const dataWithHistory = { ...data, importExportHistory: updatedHistory };

      if (data.userProfile) { handleSetUser(data.userProfile); }
      loadAllFinancialData(dataWithHistory);
      if (!isDemoMode && isAuthenticated) {
           saveData(dataWithHistory, { suppressErrors: true })
            .catch(console.error)
            .finally(() => { restoreInProgressRef.current = false; skipNextSaveRef.current = false; });
      } else {
          restoreInProgressRef.current = false;
          skipNextSaveRef.current = false;
      }
  }, [isAuthenticated, isDemoMode, loadAllFinancialData, saveData, handleSetUser]);

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
    
    let finalAccountId: string;
    let isNew = false;
    
    if (accountData.id) {
        finalAccountId = accountData.id;
    } else {
        finalAccountId = `acc-${uuidv4()}`;
        isNew = true;
    }

    const savedAccount = { ...accountWithDefaults, id: finalAccountId } as Account;
    if (isNew) savedAccount.status = 'open';

    setAccounts(prev => {
        // 1. Update/Add the primary account
        let nextAccounts: Account[];
        if (isNew) {
            nextAccounts = [...prev, savedAccount];
        } else {
            nextAccounts = prev.map(acc => acc.id === finalAccountId ? savedAccount : acc);
        }

        // 2. Handle Primary status logic
        if (savedAccount.isPrimary) {
            nextAccounts = nextAccounts.map(acc => {
                if (acc.type === savedAccount.type && acc.id !== savedAccount.id && acc.isPrimary) {
                    return { ...acc, isPrimary: false };
                }
                return acc;
            });
        }

        // 3. Bidirectional Linking Logic
        // If savedAccount is a Loan, link to its Asset
        if (savedAccount.type === 'Loan' && savedAccount.linkedAssetId) {
            nextAccounts = nextAccounts.map(acc => {
                if (acc.id === savedAccount.linkedAssetId) {
                    return { ...acc, linkedLoanId: savedAccount.id };
                }
                // Clear previous links if this asset was linked to another loan
                if (acc.linkedLoanId === savedAccount.id && acc.id !== savedAccount.linkedAssetId) {
                    return { ...acc, linkedLoanId: undefined };
                }
                return acc;
            });
        }
        
        // If savedAccount is an Asset (Property/Vehicle), link to its Loan
        if ((savedAccount.type === 'Property' || savedAccount.type === 'Vehicle') && savedAccount.linkedLoanId) {
            nextAccounts = nextAccounts.map(acc => {
                if (acc.id === savedAccount.linkedLoanId) {
                    return { ...acc, linkedAssetId: savedAccount.id };
                }
                // Clear previous links if this loan was linked to another asset
                if (acc.linkedAssetId === savedAccount.id && acc.id !== savedAccount.linkedLoanId) {
                    return { ...acc, linkedAssetId: undefined };
                }
                return acc;
            });
        }

        // 4. Handle Link Removals
        // If it's a Loan and linkedAssetId was removed
        if (savedAccount.type === 'Loan' && !savedAccount.linkedAssetId) {
             nextAccounts = nextAccounts.map(acc => {
                if (acc.linkedLoanId === savedAccount.id) {
                    return { ...acc, linkedLoanId: undefined };
                }
                return acc;
            });
        }
        // If it's an Asset and linkedLoanId was removed
        if ((savedAccount.type === 'Property' || savedAccount.type === 'Vehicle') && !savedAccount.linkedLoanId) {
             nextAccounts = nextAccounts.map(acc => {
                if (acc.linkedAssetId === savedAccount.id) {
                    return { ...acc, linkedAssetId: undefined };
                }
                return acc;
            });
        }

        return nextAccounts;
    });
  };

  const handleToggleAccountStatus = (accountId: string) => {
    setAccounts(prev => prev.map(acc => acc.id === accountId ? { ...acc, status: acc.status === 'closed' ? 'open' : 'closed', closureDetails: undefined } : acc));
  };

  const handleCloseAsset = useCallback((accountId: string, details: AssetClosureDetails) => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;

    let incomeTx: Transaction | undefined;
    // If sold, we create a transaction and potentially update the destination account's balance
    if (details.closureType === 'Sold' && details.incomeAccountId) {
      incomeTx = {
        id: `tx-${uuidv4()}`,
        accountId: details.incomeAccountId,
        date: details.date,
        description: `Sale of ${account.name}`,
        amount: details.value,
        category: 'Other Income',
        type: 'income',
        currency: account.currency
      };
      
      setTransactions(txs => [incomeTx!, ...txs]);
    }

    setAccounts(prev => {
      return prev.map(acc => {
        if (acc.id === accountId) {
          return { 
            ...acc, 
            status: 'closed' as const, 
            closureDetails: incomeTx ? { ...details, transactionId: incomeTx.id } : details,
            balance: 0 
          };
        }
        if (incomeTx && acc.id === details.incomeAccountId) {
          return { ...acc, balance: acc.balance + details.value };
        }
        return acc;
      });
    });

    setViewingAccountId(null);
    setCurrentPageState('Accounts');
    navigateToPath('/accounts');
  }, [accounts, navigateToPath]);

  const handleRevertAccountClosure = useCallback((accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (!account || !account.closureDetails) return;

    const details = account.closureDetails;
    const transactionId = details.transactionId;

    if (transactionId) {
      setTransactions(txs => txs.filter(tx => tx.id !== transactionId));
    }

    setAccounts(prev => {
      return prev.map(acc => {
        if (acc.id === accountId) {
          return { 
            ...acc, 
            status: 'open' as const, 
            closureDetails: undefined,
            balance: details.value
          };
        }
        if (details.closureType === 'Sold' && details.incomeAccountId && acc.id === details.incomeAccountId) {
          return { ...acc, balance: acc.balance - details.value };
        }
        return acc;
      });
    });
  }, [accounts]);

  const handleDeleteAccount = useCallback((accountId: string) => {
    const accountToDelete = accounts.find(acc => acc.id === accountId);
    if (!accountToDelete) return;
    const impactedRecurringIds = new Set(recurringTransactions.filter(rt => rt.accountId === accountId || rt.toAccountId === accountId).map(rt => rt.id));
    setAccounts(prev => prev.filter(acc => acc.id !== accountId).map(acc => {
        if (acc.linkedAssetId === accountId) return { ...acc, linkedAssetId: undefined };
        if (acc.linkedLoanId === accountId) return { ...acc, linkedLoanId: undefined };
        return acc;
    }));
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

  const handleSaveTransaction = useCallback((transactionDataArray: (Omit<Transaction, 'id'> & { id?: string })[], transactionIdsToDelete: string[] = [], options?: { autoSpareChange?: boolean }) => {
    const finalTxArray = [...transactionDataArray];
    
    // Automatic Spare Change Logic
    if (options?.autoSpareChange) {
      transactionDataArray.forEach(tx => {
        if (tx.id) return; // Only for brand new transactions
        if (tx.transferId?.startsWith('spare-')) return; // Avoid recursive spare change
        if (tx.type !== 'expense') return; // Only for outflows (spending or outgoing transfer side)
        
        const linkedSpareChangeAccount = accounts.find(a => 
          a.type === 'Investment' && 
          a.subType === 'Spare Change' && 
          a.linkedAccountId === tx.accountId
        );
        
        if (linkedSpareChangeAccount) {
          const absVal = Math.abs(tx.amount);
          const remainder = absVal % 1;
          const cleanRemainder = parseFloat(remainder.toFixed(2));
          const spareAmount = cleanRemainder === 0 ? 0 : parseFloat((1.00 - cleanRemainder).toFixed(2));
          
          if (spareAmount > 0) {
            const spareTransferId = `spare-${uuidv4()}`;
            const sourceAcc = accounts.find(a => a.id === tx.accountId);
            if (sourceAcc) {
              finalTxArray.push({
                accountId: tx.accountId,
                date: tx.date,
                description: `Spare change for ${tx.description || 'Synced Transaction'}`,
                merchant: 'Round Up',
                amount: -spareAmount,
                category: 'Transfer',
                type: 'expense',
                currency: sourceAcc.currency,
                transferId: spareTransferId,
              });
              finalTxArray.push({
                accountId: linkedSpareChangeAccount.id,
                date: tx.date,
                description: `Spare change from ${tx.description || 'Synced Transaction'}`,
                merchant: 'Round Up',
                amount: spareAmount,
                category: 'Transfer',
                type: 'income',
                currency: linkedSpareChangeAccount.currency,
                transferId: spareTransferId,
              });
            }
          }
        }
      });
    }

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
    finalTxArray.forEach(transactionData => {
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
    setRecurringTransactions(prev => upsertEntity(prev, recurringData, () => `rec-${uuidv4()}`));
  };
  const handleDeleteRecurringTransaction = (id: string) => { setRecurringTransactions(prev => removeEntityById(prev, id)); };
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
    setFinancialGoals(prev => upsertEntity(prev, goalData, () => `goal-${uuidv4()}`));
  };
  const handleDeleteFinancialGoal = (id: string) => {
    const goalToDelete = financialGoals.find((g) => g.id === id);
    if (!goalToDelete) return;
    let idsToDelete = [id];
    if (goalToDelete.isBucket) { idsToDelete.push(...financialGoals.filter((g) => g.parentId === id).map((g) => g.id)); }
    setFinancialGoals((prev) => prev.filter((g) => !idsToDelete.includes(g.id)));
  };
  const handleSaveBudget = (budgetData: Omit<Budget, 'id'> & { id?: string }) => {
    setBudgets(prev => upsertEntity(prev, budgetData, () => `bud-${uuidv4()}`));
  };
  const handleDeleteBudget = (id: string) => { setBudgets(prev => removeEntityById(prev, id)); };
  const handleSaveTask = (taskData: Omit<Task, 'id'> & { id?: string }) => {
    setTasks(prev => upsertEntity(prev, taskData, () => `task-${uuidv4()}`));
  };
  const handleDeleteTask = (taskId: string) => { setTasks(prev => removeEntityById(prev, taskId)); };
  const handleSaveWarrant = (warrantData: Omit<Warrant, 'id'> & { id?: string }) => {
    let warrantId = warrantData.id;
    if (warrantData.id) { 
        setWarrants(prev => prev.map(w => w.id === warrantData.id ? { ...w, ...warrantData } as Warrant : w)); 
    } 
    else {
        warrantId = `warr-${uuidv4()}`;
        setWarrants(prev => [...prev, { ...warrantData, id: warrantId } as Warrant]);
        if (warrantData.isin && !accounts.some(acc => acc.symbol === warrantData.isin.toUpperCase())) {
            handleSaveAccount({ name: warrantData.name || 'Warrant', type: 'Investment', subType: 'ETF', symbol: warrantData.isin.toUpperCase(), balance: 0, currency: 'EUR' });
        }
    }

    // Sync tax payments to billsAndPayments
    if (warrantId) {
        setBillsAndPayments(prev => {
            const otherBills = prev.filter(b => b.warrantId !== warrantId);
            const newBills: BillPayment[] = (warrantData.taxPayments || []).map((tp, index) => ({
                id: `bill-tax-${warrantId}-${index}`,
                description: `Tax Payment: ${warrantData.name} (${warrantData.isin})`,
                amount: -tp.amount,
                type: 'payment',
                currency: 'EUR',
                dueDate: tp.dueDate,
                status: 'unpaid',
                warrantId: warrantId
            }));
            return [...otherBills, ...newBills];
        });
    }
  };
  const handleDeleteWarrant = (warrantId: string) => {
    const warrantToDelete = warrants.find(w => w.id === warrantId);
    setWarrants(prev => prev.filter(w => w.id !== warrantId));
    setBillsAndPayments(prev => prev.filter(b => b.warrantId !== warrantId));
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
    setTags(prev => upsertEntity(prev, tagData, () => `tag-${uuidv4()}`));
  };
  const handleDeleteTag = (tagId: string) => {
      setTags(prev => prev.filter(t => t.id !== tagId));
      setTransactions(prev => prev.map(tx => tx.tagIds?.includes(tagId) ? { ...tx, tagIds: tx.tagIds.filter(id => id !== tagId) } : tx));
      if (transactionsViewFilters.current.tagId === tagId) transactionsViewFilters.current.tagId = null;
  };
  const handleSaveBillPayment = (billData: Omit<BillPayment, 'id'> & { id?: string }) => {
    setBillsAndPayments(prev => upsertEntity(prev, billData, () => `bill-${uuidv4()}`));
  };
  const handleDeleteBillPayment = (billId: string) => { setBillsAndPayments(prev => removeEntityById(prev, billId)); };
  const handleMarkBillAsPaid = (billId: string, paymentAccountId: string, paymentDate: string) => {
    const bill = billsAndPayments.find(b => b.id === billId);
    if (!bill) return;
    setBillsAndPayments(prev => prev.map(b => b.id === billId ? { ...b, status: 'paid' as BillPaymentStatus, accountId: paymentAccountId, dueDate: paymentDate } : b));
    const paymentAccount = accounts.find(a => a.id === paymentAccountId);
    if (paymentAccount) { handleSaveTransaction([{ accountId: paymentAccountId, date: paymentDate, description: bill.description, amount: bill.amount, category: bill.amount >= 0 ? 'Income' : 'Bills & Utilities', type: bill.amount >= 0 ? 'income' : 'expense', currency: paymentAccount.currency, }]); }
  };
  const handleSaveMembership = (membershipData: Omit<Membership, 'id'> & { id?: string }) => {
    setMemberships(prev => upsertEntity(prev, membershipData, () => `mem-${uuidv4()}`));
  };
  const handleDeleteMembership = (membershipId: string) => { setMemberships(prev => removeEntityById(prev, membershipId)); };
  const handleSaveInvoice = (invoiceData: Omit<Invoice, 'id'> & { id?: string }) => {
      setInvoices(prev => upsertEntity(prev, invoiceData, () => `inv-${uuidv4()}`));
  };
  const handleDeleteInvoice = (id: string) => { setInvoices(prev => removeEntityById(prev, id)); };
  const handleSavePrediction = (predictionData: Omit<Prediction, 'id'> & { id?: string }) => {
      setPredictions(prev => upsertEntity(prev, predictionData, () => `pred-${uuidv4()}`));
  };
  const handleDeletePrediction = (id: string) => { setPredictions(prev => removeEntityById(prev, id)); };

  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
    const response = await authorizedFetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    if (!response.ok) { const text = await response.text(); throw new Error(text || response.statusText); }
    return response;
  }, [authorizedFetch]);

  const handleFetchEnableBankingBanks = useCallback(async (payload: { applicationId: string; countryCode: string; clientCertificate: string; }) => {
    if (!isAuthenticated) throw new Error('You must be signed in to load banks.');
    const response = await fetchWithAuth('/api/enable-banking/aspsps', { method: 'POST', body: JSON.stringify({ applicationId: payload.applicationId.trim(), countryCode: payload.countryCode.trim().toUpperCase(), clientCertificate: payload.clientCertificate.trim(), }), });
    const data = await response.json();
    const items: any[] = Array.isArray(data) ? data : data?.aspsps || [];
    if (items.length === 0) throw new Error('No banks returned.');
    return items.map((item: any, index: number) => ({ id: item.id || item.aspsp_id || item.bank_id || item.name || `aspsp-${index}`, name: item.name || item.full_name || item.fullName || 'Bank', country: item.country || payload.countryCode, }));
  }, [fetchWithAuth, isAuthenticated]);

  const handleCreateEnableBankingConnection = useCallback(async (payload: { applicationId: string; countryCode: string; clientCertificate: string; selectedBank: string; connectionId?: string; }) => {
    if (!isAuthenticated) return;
    
    let selectedBankId = '';
    let selectedBankName = '';
    try {
        const bankData = JSON.parse(payload.selectedBank);
        selectedBankId = bankData.id;
        selectedBankName = bankData.name;
    } catch (e) {
        selectedBankName = payload.selectedBank;
    }

    const connectionId = payload.connectionId || `eb-${uuidv4()}`;
    const existingConnection = payload.connectionId ? enableBankingConnections.find(conn => conn.id === payload.connectionId) : undefined;
    const baseConnection: EnableBankingConnection = {
          id: connectionId,
          applicationId: (payload.applicationId || '').trim(),
          countryCode: (payload.countryCode || '').trim().toUpperCase(),
          clientCertificate: (payload.clientCertificate || '').trim(),
          status: 'pending',
          selectedBank: selectedBankName,
          selectedBankId: selectedBankId,
          accounts: existingConnection?.accounts || [],
          ...(existingConnection && { ...existingConnection })
    };
    let nextConnections: EnableBankingConnection[] = [];
    setEnableBankingConnections(prev => { nextConnections = existingConnection ? prev.map(conn => (conn.id === connectionId ? baseConnection : conn)) : [...prev, baseConnection]; return nextConnections; });
    persistPendingConnection(baseConnection);
    fetchWithAuth('/api/enable-banking/pending', {
      method: 'POST',
      body: JSON.stringify({ connection: baseConnection }),
    }).catch(error => {
      console.warn('Failed to persist pending Enable Banking connection to server', error);
    });
    if (!isDemoMode && isDataLoaded) { void savePartialDataWithRetry({ enableBankingConnections: nextConnections }); }
    try {
      const response = await fetchWithAuth('/api/enable-banking/authorize', { method: 'POST', body: JSON.stringify({ applicationId: baseConnection.applicationId, clientCertificate: baseConnection.clientCertificate, countryCode: baseConnection.countryCode, aspspName: baseConnection.selectedBank, aspspId: baseConnection.selectedBankId, state: connectionId, }), });
      const data = await response.json();
      setEnableBankingConnections(prev => prev.map(conn => conn.id === connectionId ? { ...conn, authorizationId: data.authorizationId, lastError: undefined, } : conn));
      if (data.authorizationUrl) { window.location.href = data.authorizationUrl; }
    } catch (error: any) {
      setEnableBankingConnections(prev => prev.map(conn => conn.id === connectionId ? { ...conn, status: 'requires_update', lastError: error?.message || 'Unable to start authorization', } : conn));
    }
  }, [enableBankingConnections, fetchWithAuth, isDataLoaded, isDemoMode, savePartialDataWithRetry, isAuthenticated]);

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

  const resolveBalanceAmount = useCallback((balances: any) => {
    const balanceEntries: any[] = Array.isArray(balances)
      ? balances
      : balances?.balances || balances?.account?.balances || [];
    if (!Array.isArray(balanceEntries) || balanceEntries.length === 0) {
      return { amount: 0, currency: undefined as string | undefined };
    }

    const prioritizedBalance =
      balanceEntries.find(entry => entry?.balanceType === 'closingBooked')
      || balanceEntries.find(entry => entry?.balance_type === 'closingBooked')
      || balanceEntries.find(entry => entry?.balanceType === 'expected')
      || balanceEntries.find(entry => entry?.balance_type === 'expected')
      || balanceEntries[0];

    const amountRaw = prioritizedBalance?.balanceAmount?.amount
      ?? prioritizedBalance?.balance_amount?.amount
      ?? prioritizedBalance?.amount?.amount
      ?? prioritizedBalance?.amount;
    const parsedAmount = Number(amountRaw);
    const currency = prioritizedBalance?.balanceAmount?.currency
      ?? prioritizedBalance?.balance_amount?.currency
      ?? prioritizedBalance?.amount?.currency;

    return {
      amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
      currency: typeof currency === 'string' ? currency : undefined,
    };
  }, []);

  const pickFirstText = useCallback((...values: any[]): string | undefined => {
    for (const value of values) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) return trimmed;
      }
      if (Array.isArray(value)) {
        const nested = pickFirstText(...value);
        if (nested) return nested;
      }
    }
    return undefined;
  }, []);

  const mapProviderTransaction = useCallback((
    providerTx: any,
    linkedAccountId: string | undefined,
    providerAccountId: string,
    currency: Currency,
    connectionId: string,
    accountDisplayName?: string,
    ownerName?: string,
  ): Transaction | null => {
    const amountRaw = 
      providerTx?.transaction_amount?.amount ?? 
      providerTx?.transaction_amount?.value ?? 
      providerTx?.amount?.amount ?? 
      providerTx?.amount?.value ?? 
      providerTx?.transactionAmount?.amount ?? 
      providerTx?.transactionAmount?.value;
    if (amountRaw === undefined || amountRaw === null || !linkedAccountId) return null;

    const creditDebit = providerTx?.credit_debit_indicator || providerTx?.creditDebitIndicator;
    const isCredit = creditDebit === 'CRDT' || (typeof amountRaw === 'string' && !amountRaw.startsWith('-') && creditDebit !== 'DBIT');
    const signedAmount = Math.abs(Number(amountRaw)) * (isCredit ? 1 : -1);
    // Support negative strings directly if no indicator
    const finalAmount = (signedAmount === Math.abs(Number(amountRaw)) && typeof amountRaw === 'string' && amountRaw.startsWith('-')) 
      ? Number(amountRaw) 
      : signedAmount;

    if (Number.isNaN(finalAmount)) return null;

    const resolveTransactionDate = () => {
      const candidate = pickFirstText(
        providerTx?.booking_date,
        providerTx?.bookingDate,
        providerTx?.transaction_date,
        providerTx?.transactionDate,
        providerTx?.booking_date_time,
        providerTx?.bookingDateTime,
        providerTx?.value_date,
        providerTx?.valueDate,
        providerTx?.date,
      );
      if (!candidate) return toLocalISOString(new Date());
      return candidate.includes('T') ? candidate.slice(0, 10) : candidate;
    };

    const stableIdFromFallback = (...parts: (string | number | undefined)[]) => {
      const input = parts.filter(Boolean).join('|');
      let hash = 0;
      for (let i = 0; i < input.length; i += 1) {
        hash = ((hash << 5) - hash) + input.charCodeAt(i);
        hash |= 0;
      }
      return `fallback-${Math.abs(hash)}`;
    };

    const sanitizeMerchant = (candidate?: string) => {
      if (!candidate) return undefined;
      const trimmed = candidate.trim();
      const normalized = trimmed.toLowerCase();
      
      const identities = [
        accountDisplayName?.trim().toLowerCase(),
        ownerName?.trim().toLowerCase(),
        user ? `${user.firstName} ${user.lastName}`.trim().toLowerCase() : undefined,
        demoUser ? `${demoUser.firstName} ${demoUser.lastName}`.trim().toLowerCase() : undefined,
      ].filter(Boolean) as string[];

      if (!trimmed) return undefined;
      
      // Filter out raw IBANs and numeric IDs
      const cleanedForIbanCheck = trimmed.replace(/\s+/g, '');
      if (/^([A-Z]{2}\d{2}[A-Z0-9]{8,30}|\d{8,})$/i.test(cleanedForIbanCheck)) return undefined;

      for (const identity of identities) {
        if (normalized === identity) return undefined;
        // Fuzzy match: if transaction party name is very similar to account holder name, ignore it.
        // We only do this if the identity is long enough to avoid false positives (e.g. filtering "Nike" if user name is "Nike" - unlikely but possible).
        if (identity.length > 3 && (normalized.includes(identity) || identity.includes(normalized))) {
          return undefined;
        }
        
        const nameParts = identity.split(/\s+/).filter(p => p.length > 2);
        if (nameParts.length >= 2) {
          const hasAllParts = nameParts.every(part => normalized.includes(part));
          if (hasAllParts && normalized.length < identity.length + 5) {
            return undefined;
          }
        }
      }

      // Clean the Name: Remove junk strings like "BE-", "PURCHASE", "WWW.", transaction IDs, or date stamps
      let cleaned = trimmed;
      // Remove prefixes like "WWW.", "BE-", "PURCHASE"
      cleaned = cleaned.replace(/^(BE-|PURCHASE\s*|AANKOOP\s*|PAIEMENT\s*|WWW\.|HTTP[S]?:\/\/)/i, '');
      // Remove specific bank routing text like "RETAIL BRUSSELS BE "
      cleaned = cleaned.replace(/RETAIL\s+[a-zA-Z\s]+\s+[A-Z]{2}\s+/i, '');
      // Remove trailing info separated by * (e.g., AMZN MKTP*29384 -> AMZN MKTP)
      cleaned = cleaned.replace(/\*[A-Z0-9_\-\s]+$/i, '');
      // Remove generic TLDs at the end
      cleaned = cleaned.replace(/\.(COM|NET|ORG|BE|EU|CO\.UK|FR|DE|IT|ES)$/i, '');
      // Remove generic dates
      cleaned = cleaned.replace(/\b\d{4}-\d{2}-\d{2}\b/g, ''); 
      cleaned = cleaned.replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, '');
      // Remove obvious long alphanumeric transaction IDs
      cleaned = cleaned.replace(/\b(?:[A-Z0-9]{10,})\b/g, '');
      
      cleaned = cleaned.trim();

      if (cleaned.match(/^AMZN\s*MKTP/i)) {
        cleaned = 'Amazon';
      }

      return cleaned || undefined;
    };

    const pickJoinedText = (...values: any[]): string | undefined => {
      const segments: string[] = [];
      const visit = (value: any) => {
        if (!value) return;
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (trimmed && !segments.includes(trimmed)) segments.push(trimmed);
          return;
        }
        if (Array.isArray(value)) {
          value.forEach(visit);
          return;
        }
        if (typeof value === 'object') {
          visit(value?.remittance_line);
          visit(value?.remittanceLine);
          visit(value?.reference);
        }
      };
      values.forEach(visit);
      return segments.length > 0 ? segments.join(' / ') : undefined;
    };

    const pickFirstValidMerchant = (...values: any[]): string | undefined => {
      for (const value of values) {
        if (!value) continue;
        if (typeof value === 'string') {
          const sanitized = sanitizeMerchant(value);
          if (sanitized) return sanitized;
        }
        if (Array.isArray(value)) {
          const nested = pickFirstValidMerchant(...value);
          if (nested) return nested;
        }
      }
      return undefined;
    };

    // Counterparty fields vary by bank. For outgoing payments prefer creditor-side fields;
    // for incoming payments (income/refunds) prefer debtor-side fields.
    
    // Try to extract a clean merchant from unstructured remittance first, as some banks (like KBC)
    // put the user's name or generic text in the creditor/debtor field and the actual merchant in the remittance.
    const extractMerchantFromRemittance = (remStr: any): string | undefined => {
      if (!remStr) return undefined;
      // Handle case where it might be an array (common in Enable Banking)
      const actualStr = Array.isArray(remStr) ? remStr[0] : remStr;
      if (typeof actualStr !== 'string') return undefined;
      
      const upper = actualStr.toUpperCase();
      // Look for common "card purchase" prefixes
      if (upper.includes('RETAIL ') || upper.startsWith('PURCHASE ') || upper.startsWith('AANKOOP') || upper.startsWith('PAIEMENT')) {
         return sanitizeMerchant(actualStr);
      }
      return undefined;
    };
    
    const unstructuredMerchant = 
      extractMerchantFromRemittance(providerTx?.remittance_information_unstructured) ||
      extractMerchantFromRemittance(providerTx?.remittanceInformationUnstructured) ||
      extractMerchantFromRemittance(providerTx?.remittance_information);

    const merchant = pickFirstValidMerchant(
      unstructuredMerchant,
      providerTx?.merchant_name,
      providerTx?.merchantName,
      providerTx?.merchant?.name,
      providerTx?.merchant?.display_name,
      providerTx?.merchant?.displayName,
      providerTx?.card_acceptor?.name,
      providerTx?.cardAcceptor?.name,
      providerTx?.counterparty_name,
      providerTx?.counterpartyName,
      providerTx?.counterparty?.name,
      ...(isCredit
        ? [
            providerTx?.debtor_name,
            providerTx?.debtorName,
            providerTx?.debtor?.name,
            providerTx?.debtor?.account?.name,
            providerTx?.debtorAccount?.name,
            providerTx?.ultimate_debtor,
            providerTx?.ultimateDebtor,
            // Fallbacks in case debtor is empty
            providerTx?.creditor_name,
            providerTx?.creditorName,
            providerTx?.creditor?.name,
          ]
        : [
            providerTx?.creditor_name,
            providerTx?.creditorName,
            providerTx?.creditor?.name,
            providerTx?.creditor?.account?.name,
            providerTx?.creditorAccount?.name,
            providerTx?.ultimate_creditor,
            providerTx?.ultimateCreditor,
            // Fallbacks in case creditor is empty
            providerTx?.debtor_name,
            providerTx?.debtorName,
            providerTx?.debtor?.name,
          ]),
      providerTx?.remittance_information_unstructured,
      providerTx?.remittanceInformationUnstructured,
      providerTx?.remittance_information,
      providerTx?.remittance_information_unstructured_array,
      providerTx?.remittanceInformationUnstructuredArray,
      providerTx?.remittance_information_structured,
      providerTx?.remittanceInformationStructured,
    );

    const desc = pickFirstText(
      pickJoinedText(
        providerTx?.remittance_information_unstructured,
        providerTx?.remittanceInformationUnstructured,
        providerTx?.remittance_information,
        providerTx?.remittance_information_unstructured_array,
        providerTx?.remittanceInformationUnstructuredArray,
        providerTx?.remittance_information_structured,
        providerTx?.remittanceInformationStructured,
        providerTx?.remittance_information_structured_array,
        providerTx?.remittanceInformationStructuredArray,
        providerTx?.remittance_information_reference,
        providerTx?.remittanceInformationReference,
      ),
      providerTx?.additional_information,
      providerTx?.additionalInformation,
      providerTx?.booking_text,
      providerTx?.bookingText,
      providerTx?.description,
      providerTx?.proprietary_bank_transaction_code?.description,
      providerTx?.proprietaryBankTransactionCode?.description,
      merchant,
    ) || 'Transaction';

    const date = resolveTransactionDate();
    const providerTransactionId = pickFirstText(
      providerTx?.transaction_id,
      providerTx?.transactionId,
      providerTx?.entry_reference,
      providerTx?.entryReference,
      providerTx?.end_to_end_id,
      providerTx?.endToEndId,
      providerTx?.internal_transaction_id,
      providerTx?.internalTransactionId,
    ) || stableIdFromFallback(providerAccountId, amountRaw, creditDebit, date, desc, merchant);

    return {
      id: `eb-${connectionId}-${providerAccountId}-${providerTransactionId}`,
      sureId: providerTransactionId,
      accountId: linkedAccountId,
      date,
      description: desc,
      merchant,
      amount: finalAmount,
      category: 'Uncategorized',
      type: finalAmount >= 0 ? 'income' : 'expense',
      currency,
      importId: `enable-banking-${connectionId}-${linkedAccountId}`,
    };
  }, [pickFirstText, user, demoUser]);

  const handleSyncEnableBankingConnection = useCallback(async (connectionId: string, connectionOverride?: EnableBankingConnection, syncOptions?: EnableBankingSyncOptions) => {
    if (!isAuthenticated) return;
    const connection = connectionOverride || enableBankingConnections.find(c => c.id === connectionId);
    if (!connection?.sessionId) return;
    try {
      setEnableBankingConnections(prev => prev.map(conn => conn.id === connectionId ? { ...conn, status: 'pending', lastError: undefined } : conn));
      const session = await fetchWithAuth('/api/enable-banking/session/fetch', { method: 'POST', body: JSON.stringify({ sessionId: connection.sessionId, applicationId: connection.applicationId, clientCertificate: connection.clientCertificate, }), }).then(res => res.json());
      const accountsFromSession: any[] = session?.accounts || [];
      const existingAccountsById = new Map(connection.accounts.map(account => [account.id, account]));
      const updatedAccounts: EnableBankingAccount[] = [];
      const importedTransactions: Transaction[] = [];
      const shouldSyncTransactions = (syncOptions?.transactionMode || 'full') !== 'none';
      const shouldUpdateLinkedAccountBalances = syncOptions?.updateBalance ?? true;
      const linkedAccountBalanceUpdates = new Map<string, { balance: number; currency: Currency }>();
      for (const account of accountsFromSession) {
          const providerAccountId = resolveProviderAccountId(account);
          if (!providerAccountId) {
            console.warn('Enable Banking account missing provider account id. Skipping.', account);
            continue;
          }
          const existingAccount = existingAccountsById.get(providerAccountId);
          const [details, balances] = await Promise.all([
            fetchWithAuth(`/api/enable-banking/accounts/${encodeURIComponent(providerAccountId)}/details`, { method: 'POST', body: JSON.stringify({ applicationId: connection.applicationId, clientCertificate: connection.clientCertificate, sessionId: connection.sessionId, }), }).then(res => res.json()).catch(() => null),
            fetchWithAuth(`/api/enable-banking/accounts/${encodeURIComponent(providerAccountId)}/balances`, { method: 'POST', body: JSON.stringify({ applicationId: connection.applicationId, clientCertificate: connection.clientCertificate, sessionId: connection.sessionId, }), }).then(res => res.json()),
          ]);
          const resolvedBalance = resolveBalanceAmount(balances);
          const currency = (account?.currency || details?.currency || resolvedBalance.currency || 'EUR') as Currency;
          const existingLinkedAccount = connection.accounts?.find(a => a.id === providerAccountId);
          const linkedAccountId = existingLinkedAccount?.linkedAccountId;
          updatedAccounts.push({ id: providerAccountId, name: details?.name || account?.name || 'Bank account', bankName: connection.selectedBank || 'Enable Banking', currency, balance: resolvedBalance.amount, linkedAccountId, syncStartDate: existingLinkedAccount?.syncStartDate, lastSyncedAt: toLocalDateTimeString(new Date()) });

          if (shouldUpdateLinkedAccountBalances && linkedAccountId && Number.isFinite(resolvedBalance.amount)) {
            linkedAccountBalanceUpdates.set(linkedAccountId, {
              balance: resolvedBalance.amount,
              currency,
            });
          }

          const accountTargeted = !syncOptions?.targetAccountIds?.length || syncOptions.targetAccountIds.includes(providerAccountId);
          if (!shouldSyncTransactions || !linkedAccountId || !accountTargeted) {
            continue;
          }

          const dateFrom = syncOptions?.transactionMode === 'incremental'
            ? (existingLinkedAccount?.lastSyncedAt ? existingLinkedAccount.lastSyncedAt.slice(0, 10) : existingLinkedAccount?.syncStartDate)
            : (syncOptions?.syncStartDate || existingLinkedAccount?.syncStartDate);

          let continuationKey: string | undefined;
          const seenPageKeys = new Set<string>();
          for (let page = 0; page < 100; page += 1) {
            const txResponse = await fetchWithAuth(`/api/enable-banking/accounts/${encodeURIComponent(providerAccountId)}/transactions`, {
              method: 'POST',
              body: JSON.stringify({
                applicationId: connection.applicationId,
                clientCertificate: connection.clientCertificate,
                sessionId: connection.sessionId,
                dateFrom,
                continuationKey,
              }),
            }).then(res => res.json());

            const bookedTransactions = txResponse?.transactions?.booked || txResponse?.booked || txResponse?.transactions || [];
            bookedTransactions.forEach((providerTx: any) => {
              const mappedTx = mapProviderTransaction(
                providerTx,
                linkedAccountId,
                providerAccountId,
                currency,
                connectionId,
                details?.name || account?.name,
                details?.owner_name || details?.ownerName,
              );
              if (mappedTx) importedTransactions.push(mappedTx);
            });

            const nextContinuationKey = txResponse?.continuation_key || txResponse?.continuationKey;
            if (!nextContinuationKey || seenPageKeys.has(nextContinuationKey)) break;
            seenPageKeys.add(nextContinuationKey);
            continuationKey = nextContinuationKey;
          }

          updatedAccounts[updatedAccounts.length - 1] = {
            ...updatedAccounts[updatedAccounts.length - 1],
            lastSyncedAt: toLocalDateTimeString(new Date()),
          };
      }

      if (importedTransactions.length > 0) {
        const existingTxMapCountId = new Map<string, Transaction>(transactions.map(tx => [tx.id, tx]));
        const existingTxMapSureId = new Map<string, Transaction>(
          transactions.filter(tx => tx.importId?.startsWith(`enable-banking-${connectionId}-`) && tx.sureId).map(tx => [tx.sureId as string, tx])
        );
        const existingFingerprints = new Map<string, Transaction>(
           transactions
            .filter(tx => tx.importId?.startsWith(`enable-banking-${connectionId}-`))
            .map(tx => [`${tx.accountId}|${tx.date}|${tx.amount}|${(tx.description || '').trim().toLowerCase()}|${(tx.merchant || '').trim().toLowerCase()}`, tx])
        );

        const deduped: Transaction[] = [];
        const toUpdate: Transaction[] = [];

        for (const tx of importedTransactions) {
          const fingerprint = `${tx.accountId}|${tx.date}|${tx.amount}|${(tx.description || '').trim().toLowerCase()}|${(tx.merchant || '').trim().toLowerCase()}`;
          const existing = existingTxMapCountId.get(tx.id) || (tx.sureId ? existingTxMapSureId.get(tx.sureId) : undefined) || existingFingerprints.get(fingerprint);

          if (existing) {
             if ((!existing.merchant && tx.merchant) || (!existing.description && tx.description)) {
                const updatedTx = { 
                  ...existing, 
                  merchant: existing.merchant || tx.merchant, 
                  description: existing.description || tx.description 
                };
                toUpdate.push(updatedTx);
             }
          } else {
             deduped.push(tx);
             existingTxMapCountId.set(tx.id, tx);
             if (tx.sureId) existingTxMapSureId.set(tx.sureId, tx);
             existingFingerprints.set(fingerprint, tx);
          }
        }

        const allCategories = [...MOCK_INCOME_CATEGORIES, ...MOCK_EXPENSE_CATEGORIES, ...incomeCategories, ...expenseCategories];

        if (deduped.length > 0) {
          handleSaveTransaction(deduped, [], { autoSpareChange: true });
        }

        if (toUpdate.length > 0) {
          handleSaveTransaction(toUpdate);
        }
      }

      if (linkedAccountBalanceUpdates.size > 0) {
        setAccounts(prev => prev.map(acc => {
          const update = linkedAccountBalanceUpdates.get(acc.id);
          if (!update) return acc;
          return {
            ...acc,
            balance: update.balance,
            currency: update.currency,
          };
        }));
      }

      setEnableBankingConnections(prev => prev.map(conn => conn.id === connectionId ? { ...conn, status: 'ready', accounts: updatedAccounts, lastSyncedAt: toLocalDateTimeString(new Date()) } : conn));
    } catch (error: any) {
      setEnableBankingConnections(prev => prev.map(conn => conn.id === connectionId ? { ...conn, status: 'requires_update', lastError: error?.message || 'Sync failed', } : conn));
    }
  }, [enableBankingConnections, fetchWithAuth, handleSaveTransaction, mapProviderTransaction, resolveBalanceAmount, resolveProviderAccountId, isAuthenticated, transactions, user, demoUser, incomeCategories, expenseCategories]);

  const handleSyncAllEnableBankingConnections = useCallback(async () => {
    const activeConnections = enableBankingConnections.filter(c => c.sessionId && c.status !== 'pending');
    if (activeConnections.length === 0) return;
    
    setIsSyncingBanks(true);
    try {
      for (const connection of activeConnections) {
        await handleSyncEnableBankingConnection(connection.id, connection, { transactionMode: 'incremental' });
      }
    } finally {
      setIsSyncingBanks(false);
    }
  }, [enableBankingConnections, handleSyncEnableBankingConnection]);

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

  const handlePublishImport = async (items: any[], dataType: ImportDataType, fileName: string, originalData: Record<string, any>[], errors: Record<number, Record<string, string>>, newAccountsArg?: Account[]) => {
      const importId = `imp-${uuidv4()}`;
      if (newAccountsArg) { newAccountsArg.forEach(acc => handleSaveAccount(acc)); }
      if (dataType === 'accounts') { items.forEach(acc => handleSaveAccount(acc)); } 
      else if (dataType === 'transactions') { 
        const allCategories = [...MOCK_INCOME_CATEGORIES, ...MOCK_EXPENSE_CATEGORIES, ...incomeCategories, ...expenseCategories];
        const txsWithImportId = items.map(t => ({ ...t, importId }));
        handleSaveTransaction(txsWithImportId, [], { autoSpareChange: true }); 
      }
      
      const details = `Imported ${items.length} ${dataType}${newAccountsArg?.length ? ` and created ${newAccountsArg.length} new accounts` : ''}.`;

      setImportExportHistory(prev => [{ 
        id: importId, 
        type: 'import', 
        dataType, 
        fileName, 
        date: toLocalDateTimeString(new Date()), 
        status: Object.keys(errors).length > 0 ? 'Failed' : 'Complete', 
        itemCount: items.length, 
        details,
        importedData: originalData, 
        errors, 
      }, ...prev]);
  };

  const handleLogExport = (dataType: ImportDataType, format: 'csv' | 'json', itemCount: number) => {
    const exportId = `exp-${uuidv4()}`;
    setImportExportHistory(prev => [{
      id: exportId,
      type: 'export',
      dataType,
      fileName: `Export (${format.toUpperCase()})`,
      date: new Date().toISOString(),
      status: 'Complete',
      itemCount,
      details: `Exported ${itemCount} items as ${format.toUpperCase()}.`
    }, ...prev]);
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
  const cashAccounts = useMemo(() => accounts.filter(a => a.type === 'Checking' || a.type === 'Savings'), [accounts]);

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
      if (viewingHolding) return <HoldingDetail holdingSymbol={viewingHoldingSymbol} holdingsOverview={holdingsOverview} accounts={accounts} cashAccounts={cashAccounts} investmentTransactions={investmentTransactions} saveInvestmentTransaction={handleSaveInvestmentTransaction} warrants={warrants} saveWarrant={handleSaveWarrant} manualPrices={manualWarrantPrices} onManualPriceChange={handleManualWarrantPrice} onBack={() => setCurrentPage('Investments')} priceHistory={priceHistory} />;
      return <PageLoader label="Loading holding..." />;
    }
    if (viewingAccountId) {
      if (viewingAccount) return <AccountDetail account={viewingAccount} setCurrentPage={setCurrentPage} setViewingAccountId={setViewingAccountId} saveAccount={handleSaveAccount} enableBankingLink={enableBankingLinkMap.get(viewingAccount.id)} onTriggerEnableBankingSync={handleSyncEnableBankingConnection} onCloseAsset={handleCloseAsset} onRevertClosure={handleRevertAccountClosure} />;
      return <PageLoader label="Loading account..." />;
    }
    switch (currentPage) {
      case 'Dashboard': return <Dashboard user={currentUser!} incomeCategories={incomeCategories} expenseCategories={expenseCategories} financialGoals={financialGoals} recurringTransactions={recurringTransactions} recurringTransactionOverrides={recurringTransactionOverrides} loanPaymentOverrides={loanPaymentOverrides} tasks={tasks} saveTask={handleSaveTask} onTogglePrivacyMode={() => setIsPrivacyMode(!isPrivacyMode)} onSyncBanks={handleSyncAllEnableBankingConnections} isSyncingBanks={isSyncingBanks} />;
      case 'Accounts': return <Accounts accounts={accounts} transactions={transactions} saveAccount={handleSaveAccount} deleteAccount={handleDeleteAccount} setCurrentPage={setCurrentPage} setViewingAccountId={setViewingAccountId} onViewAccount={handleOpenAccountDetail} saveTransaction={handleSaveTransaction} accountOrder={accountOrder} setAccountOrder={setAccountOrder} initialSortBy={preferences.defaultAccountOrder} warrants={warrants} onToggleAccountStatus={handleToggleAccountStatus} onNavigateToTransactions={navigateToTransactions} linkedEnableBankingAccountIds={linkedEnableBankingAccountIds} />;
      case 'Transactions': return <Transactions initialAccountFilter={transactionsViewFilters.current.accountName ?? null} initialTagFilter={transactionsViewFilters.current.tagId ?? null} onClearInitialFilters={clearPendingTransactionFilters} />;
      case 'Reports': return <ReportsPage />;
      case 'Budget': return <Budgeting budgets={budgets} transactions={transactions} expenseCategories={expenseCategories} saveBudget={handleSaveBudget} deleteBudget={handleDeleteBudget} accounts={accounts} preferences={preferences} />;
      case 'Forecasting': return <Forecasting />;
      case 'Challenges': return <ChallengesPage userStats={userStats} accounts={accounts} transactions={transactions} predictions={predictions} savePrediction={handleSavePrediction} deletePrediction={handleDeletePrediction} saveUserStats={setUserStats} investmentTransactions={investmentTransactions} warrants={warrants} assetPrices={assetPrices} />;
      case 'Settings': return <SettingsPage setCurrentPage={setCurrentPage} user={currentUser!} />;
      case 'Schedule & Bills': return <SchedulePage />;
      case 'Categories': return <CategoriesPage incomeCategories={incomeCategories} setIncomeCategories={setIncomeCategories} expenseCategories={expenseCategories} setExpenseCategories={setExpenseCategories} setCurrentPage={setCurrentPage} />;
      case 'Tags': return <TagsPage tags={tags} transactions={transactions} saveTag={handleSaveTag} deleteTag={handleDeleteTag} setCurrentPage={setCurrentPage} onNavigateToTransactions={navigateToTransactions} />;
      case 'Personal Info': return <PersonalInfoPage user={currentUser!} setUser={handleSetUser} onChangePassword={changePassword} setCurrentPage={setCurrentPage} />;
      case 'Data Management': return <DataImportExportPage accounts={accounts} transactions={transactions} budgets={budgets} recurringTransactions={recurringTransactions} allCategories={[...incomeCategories, ...expenseCategories]} history={importExportHistory} onPublishImport={handlePublishImport} onDeleteHistoryItem={handleDeleteHistoryItem} onDeleteImportedTransactions={handleDeleteImportedTransactions} onResetAccount={handleResetAccount} setCurrentPage={setCurrentPage} onRestoreData={handleRestoreData} onLogExport={handleLogExport} fullFinancialData={dataToSave} />;
      case 'Preferences': return <PreferencesPage preferences={preferences} setPreferences={setPreferences} theme={theme} setTheme={setTheme} setCurrentPage={setCurrentPage} />;
      case 'EnableBankingCallback': return <EnableBankingCallbackPage connections={enableBankingConnections} setConnections={setEnableBankingConnections} onSync={handleSyncEnableBankingConnection} setCurrentPage={setCurrentPage} />;
      case 'Integrations': return <IntegrationsPage preferences={preferences} setPreferences={setPreferences} setCurrentPage={setCurrentPage} enableBankingConnections={enableBankingConnections} accounts={accounts} onCreateConnection={handleCreateEnableBankingConnection} onFetchBanks={handleFetchEnableBankingBanks} onDeleteConnection={handleDeleteEnableBankingConnection} onLinkAccount={handleLinkEnableBankingAccount} onTriggerSync={handleSyncEnableBankingConnection} />;
      case 'Investments': return <InvestmentsPage accounts={accounts} cashAccounts={cashAccounts} investmentTransactions={investmentTransactions} saveInvestmentTransaction={handleSaveInvestmentTransaction} saveAccount={handleSaveAccount} deleteInvestmentTransaction={handleDeleteInvestmentTransaction} saveTransaction={handleSaveTransaction} warrants={warrants} saveWarrant={handleSaveWarrant} deleteWarrant={handleDeleteWarrant} manualPrices={manualWarrantPrices} onManualPriceChange={handleManualWarrantPrice} prices={assetPrices} onOpenHoldingDetail={handleOpenHoldingDetail} holdingsOverview={holdingsOverview} onToggleAccountStatus={handleToggleAccountStatus} deleteAccount={handleDeleteAccount} transactions={transactions} onViewAccount={handleOpenAccountDetail} />;
      case 'Tasks': return <TasksPage tasks={tasks} saveTask={handleSaveTask} deleteTask={handleDeleteTask} taskOrder={taskOrder} setTaskOrder={setTaskOrder} />;
      case 'Documentation': return <Documentation setCurrentPage={setCurrentPage} />;
      case 'Subscriptions': return <SubscriptionsPage />;
      case 'Quotes & Invoices': return <InvoicesPage />;
      case 'Merchants': return <MerchantsPage setCurrentPage={setCurrentPage} />;
      default: return <div>Page not found</div>;
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandCenterOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
                    <button
                      onClick={() => setSidebarOpen(true)}
                      className="md:hidden absolute top-4 left-4 z-20 p-2 rounded-lg bg-white/90 dark:bg-[#1E1E20]/90 text-light-text-secondary dark:text-dark-text-secondary shadow-sm border border-black/5 dark:border-white/10 backdrop-blur hover:bg-white dark:hover:bg-[#252528] transition-colors"
                      aria-label="Open navigation menu"
                    >
                      <span className="material-symbols-outlined">menu</span>
                    </button>
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative scroll-smooth focus:outline-none" id="main-content">
                         <ErrorBoundary><Suspense fallback={<PageLoader />}>{renderPage()}</Suspense></ErrorBoundary>
                    </main>
                </div>
                {isOnboardingOpen && <OnboardingModal isOpen={isOnboardingOpen} onClose={handleOnboardingFinish} user={currentUser} saveAccount={handleSaveAccount} saveFinancialGoal={handleSaveFinancialGoal} saveRecurringTransaction={handleSaveRecurringTransaction} preferences={preferences} setPreferences={setPreferences} accounts={accounts} incomeCategories={incomeCategories} expenseCategories={expenseCategories} />}
                <CommandCenter 
                    isOpen={isCommandCenterOpen} 
                    onClose={() => setIsCommandCenterOpen(false)} 
                    setCurrentPage={setCurrentPage} 
                    accounts={accounts} 
                    transactions={transactions} 
                    onOpenAccount={handleOpenAccountDetail} 
                    togglePrivacyMode={() => setIsPrivacyMode(!isPrivacyMode)} 
                    isPrivacyMode={isPrivacyMode} 
                    theme={theme} 
                    setTheme={setTheme} 
                />
             </div>
        </InsightsViewProvider>
    </FinancialDataProvider>
  );
};

export default App;
