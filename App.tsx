// FIX: Import `useMemo` from React to resolve the 'Cannot find name' error.
import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy, useRef, Component, ErrorInfo, startTransition } from 'react';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import CommandCenter from './components/CommandCenter';
import { useScrollMemory } from './hooks/useScrollMemory';
import PageSkeleton from './components/PageSkeleton';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import { useIsMobile } from './hooks/useIsMobile';
import { PrivacyContext } from './components/ui/Money';
import { ReviewProvider } from './contexts/ReviewContext';
import { applyAppFont } from './hooks/useFont';
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      const key = 'crystal_chunk_reload_' + (typeof factory === 'function' ? factory.toString().slice(0, 40) : 'page');
      if (typeof window !== 'undefined' && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      sessionStorage.removeItem(key);
      throw error;
    }
  });
}

const SignIn = lazyWithRetry(() => import('./pages/SignIn'));
const SignUp = lazyWithRetry(() => import('./pages/SignUp'));
const pageRegistry = {
  Dashboard: { path: '/', loader: () => import('./pages/Dashboard') },
  Accounts: { path: '/accounts', loader: () => import('./pages/Accounts') },
  Transactions: { path: '/transactions', loader: () => import('./pages/Transactions') },
  Reports: { path: '/reports', loader: () => import('./pages/Reports') },
  Budget: { path: '/budget', loader: () => import('./pages/Budgeting') },
  Forecasting: { path: '/forecasting', loader: () => import('./pages/Forecasting') },
  Goals: { path: '/goals', loader: () => import('./pages/Goals') },
  Challenges: { path: '/challenges', loader: () => import('./pages/Challenges') },
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
  HoldingDetail: { path: '/investments', loader: () => import('./pages/Investments') },
  Documentation: { path: '/documentation', loader: () => import('./pages/Documentation') },
  Subscriptions: { path: '/subscriptions', loader: () => import('./pages/Subscriptions') },
  'Quotes & Invoices': { path: '/invoices', loader: () => import('./pages/Invoices') },
  Merchants: { path: '/merchants', loader: () => import('./pages/Merchants') },
  Rules: { path: '/rules', loader: () => import('./pages/Rules') },
} as const;

const Dashboard = lazyWithRetry(pageRegistry.Dashboard.loader);
const Accounts = lazyWithRetry(pageRegistry.Accounts.loader);
const Transactions = lazyWithRetry(pageRegistry.Transactions.loader);
const ReportsPage = lazyWithRetry(pageRegistry.Reports.loader);
const Budgeting = lazyWithRetry(pageRegistry.Budget.loader);
const Forecasting = lazyWithRetry(pageRegistry.Forecasting.loader);
const GoalsPage = lazyWithRetry(pageRegistry.Goals.loader);
const ChallengesPage = lazyWithRetry(pageRegistry.Challenges.loader);
const SchedulePage = lazyWithRetry(pageRegistry['Schedule & Bills'].loader);
const CategoriesPage = lazyWithRetry(pageRegistry.Categories.loader);
const TagsPage = lazyWithRetry(pageRegistry.Tags.loader);
const PersonalInfoPage = lazyWithRetry(pageRegistry['Personal Info'].loader);
const DataImportExportPage = lazyWithRetry(pageRegistry['Data Management'].loader);
const PreferencesPage = lazyWithRetry(pageRegistry.Preferences.loader);
const IntegrationsPage = lazyWithRetry(pageRegistry.Integrations.loader);
const AccountDetail = lazyWithRetry(pageRegistry.AccountDetail.loader);
const UiKit = import.meta.env.DEV ? lazyWithRetry(() => import('./pages/dev/UiKit')) : null;
const EnableBankingCallbackPage = lazyWithRetry(pageRegistry.EnableBankingCallback.loader);
const InvestmentsPage = lazyWithRetry(pageRegistry.Investments.loader);
const TasksPage = lazyWithRetry(pageRegistry.Tasks.loader);
const Documentation = lazyWithRetry(pageRegistry.Documentation.loader);
const SubscriptionsPage = lazyWithRetry(pageRegistry.Subscriptions.loader);
const InvoicesPage = lazyWithRetry(pageRegistry['Quotes & Invoices'].loader);
const MerchantsPage = lazyWithRetry(pageRegistry.Merchants.loader);
const RulesPage = lazyWithRetry(pageRegistry.Rules.loader);

const pagePreloaders = Object.values(pageRegistry).map(entry => entry.loader);

import { Page, Theme, Category, User, Transaction, Account, RecurringTransaction, RecurringTransactionOverride, WeekendAdjustment, FinancialGoal, Budget, ImportExportHistoryItem, AppPreferences, AccountType, InvestmentTransaction, Task, Warrant, ImportDataType, FinancialData, Currency, BillPayment, BillPaymentStatus, Duration, InvestmentSubType, Tag, LoanPaymentOverrides, ScheduledPayment, Membership, Invoice, UserStats, Prediction, PriceHistoryEntry, EnableBankingConnection, EnableBankingAccount, EnableBankingLinkPayload, EnableBankingSyncOptions, AssetClosureDetails } from './types';
import { MOCK_INCOME_CATEGORIES, MOCK_EXPENSE_CATEGORIES, LIQUID_ACCOUNT_TYPES } from './constants';
import { createDemoUser, emptyFinancialData, defaultPreferences } from './demoData';
import { v4 as uuidv4 } from 'uuid';
import { linkBudgetsToCategories } from './utils/budgetModel';
import { missingRates, setMainCurrency, convertCurrency, convertToMain, updateConversionRates, arrayToCSV, downloadCSV, parseLocalDate, toLocalISOString, toLocalDateTimeString, safeRound, getMainCurrency } from './utils';
import { buildHoldingsOverview } from './utils/investments';
import { applySavedRules, spareChangeFor } from './utils/rules';
import { upsertEntity, removeEntityById } from './utils/collection';
import { useDebounce } from './hooks/useDebounce';
import { useAuth } from './hooks/useAuth';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useBillNotifications } from './hooks/useBillNotifications';
import { moveLocalChoices } from './utils/syncedChoices';
import { syncFill, withEditLocks } from './utils/lockedFields';
import { clearDeleted, deletedIdsByAccount, forgetDeleted, rememberDeleted } from './utils/deletedSync';
import LockScreen from './components/LockScreen';
import { Banner } from './components/ui/States';
import { useIdleLock } from './hooks/useIdleLock';
import { DEFAULT_AUTO_LOCK_MINUTES } from './utils/lockModel';
import { migrateRules } from './utils/rulesMigration';
import { applyBalanceChanges, applyTransactionChanges, planTransactionChanges } from './utils/transactionChanges';
import NotificationCenter from './components/NotificationCenter';
const OnboardingModal = lazyWithRetry(() => import('./components/OnboardingModal'));
const AddTransactionModal = lazyWithRetry(() => import('./components/AddTransactionModal'));
import { FinancialDataProvider } from './contexts/FinancialDataContext';
import { AccountsProvider, PreferencesProvider, TransactionsProvider, WarrantsProvider, InvoicesProvider } from './contexts/DomainProviders';
import { InsightsViewProvider } from './contexts/InsightsViewContext';
import { PhoneBar, PhoneTopBar, Sidebar, SkipLink, TabRow, ToolRail, TopBar, type ShellProps } from './components/ui/Shell';
import { persistPendingConnection, removePendingConnection } from './utils/enableBankingStorage';
import {
  computeSyncDateFrom,
  extractProviderAccountIdentifiers,
  mapEnableBankingTransaction,
  matchExistingProviderAccount,
  matchKnownBrand,
  resolveEnableBankingBalance,
} from './utils/enableBankingMapper';
import { normalizeMerchantKey } from './utils/brandfetch';
import { fetchAllExchangeRates } from './src/services/twelveDataService';
import { fetchEcbRates } from './src/services/exchangeRates';
import { currenciesInUse } from './utils/currencies';
import { saveDevCache, loadDevCache, clearDevCache } from './utils/browserCache';
import { threeWayMerge } from './utils/threeWayMerge';
import { warnIgnored } from './utils/logging';
import { startPrivacyMask } from './utils/privacyMask';

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

const LOCK_CHANNEL = 'crystal-lock';

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

  // The Settings tile page is gone (D-045). Its old address opens the hub's first tab.
  if (normalizedPath === '/settings') {
    return { page: 'Personal Info', matched: true, accountId: null };
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

/**
 * Slices of FinancialData the app persists. A slice is "dirty" when its current value is no longer the
 * same object as the one last loaded from / confirmed saved to the server (see savedSlicesRef).
 */
const PERSISTED_SLICE_KEYS = [
  'accounts', 'transactions', 'investmentTransactions', 'recurringTransactions', 'recurringTransactionOverrides',
  'loanPaymentOverrides', 'financialGoals', 'goalOrder', 'budgets', 'tasks', 'warrants', 'memberships',
  'importExportHistory', 'incomeCategories', 'expenseCategories', 'preferences', 'billsAndPayments',
  'accountOrder', 'taskOrder', 'tags', 'manualWarrantPrices', 'priceHistory', 'invoices', 'userStats',
  'predictions', 'enableBankingConnections',
] as const satisfies readonly (keyof FinancialData)[];

/** Largest body a browser will send in a `keepalive` request (64 KiB), minus headroom. */
const KEEPALIVE_MAX_BYTES = 60_000;

const hasMaterialData = (data: Partial<FinancialData> | null | undefined) => {
  if (!data) return false;

  const hasArrays = MATERIAL_DATA_ARRAY_KEYS.some(key => {
    const value = data[key];
    return Array.isArray(value) && value.length > 0;
  });

  if (hasArrays) return true;

  const hasMaterialObjects = MATERIAL_DATA_OBJECT_KEYS.some(key => {
    const value = data[key];
    return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
  });

  if (hasMaterialObjects) return true;

  return !!(data.preferences && data.preferences.dashboardLayouts && Object.keys(data.preferences.dashboardLayouts).length > 0);
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
  /** When this value changes the boundary clears its error, so navigating away from a crashed page recovers. */
  resetKey?: string;
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

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, message: undefined });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="flex items-center justify-center min-h-[50vh] px-6">
          <div className="bg-white dark:bg-dark-card shadow-2xl rounded-2xl p-6 max-w-lg w-full border border-black/5 dark:border-white/10">
            <h1 className="text-xl font-semibold text-light-text dark:text-dark-text mb-2">Something went wrong</h1>
            <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm mb-4">
              {this.state.message || 'An unexpected error occurred while rendering this page.'}
            </p>
            <div className="flex gap-3">
              <button
                className="px-4 py-2 rounded-lg bg-primary-500 text-white font-medium hover:bg-primary-600 transition"
                onClick={() => this.setState({ hasError: false, message: undefined })}
              >
                Try again
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-black/5 dark:bg-white/10 text-light-text dark:text-dark-text font-medium hover:bg-black/10 dark:hover:bg-white/15 transition"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const App: React.FC = () => {
  const initialPath = typeof window !== 'undefined' ? (window.location.pathname + window.location.search) : '/';
  const initialRoute = parseRoute(initialPath);

  const { isLocked, lockedOnLoadRef, user, setUser, isAuthenticated, isLoading: isAuthLoading, error: authError, signIn, signUp, signOut, checkAuthStatus, setError: setAuthError, changePassword, authorizedFetch } = useAuth();
  const [authPage, setAuthPage] = useState<'signIn' | 'signUp'>('signIn');
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || Boolean((import.meta as any)?.env?.DEV);
      if (isDev && safeLocalStorage.getItem('crystal_dev_mode_active') === 'true') {
        return true;
      }
    }
    return false;
  });
  const appRenderCountRef = useRef(0);
  appRenderCountRef.current += 1;
  useEffect(() => {
    const timer = setTimeout(() => { appRenderCountRef.current = 0; }, 100);
    return () => clearTimeout(timer);
  });
  if (appRenderCountRef.current > 25) {
    console.error('[DIAGNOSTIC] Infinite loop in App! Render count exceeded 25 in 100ms window.');
  }

  const [demoUser, setDemoUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || Boolean((import.meta as any)?.env?.DEV);
      if (isDev && safeLocalStorage.getItem('crystal_dev_mode_active') === 'true') {
        try {
          const cached = safeLocalStorage.getItem('crystal_dev_financial_data_cache');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed?.userProfile) return parsed.userProfile;
          }
        } catch (error) { warnIgnored('reading the cached dev profile', error); }
        return createDemoUser();
      }
    }
    return null;
  });
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [isSyncingBanks, setIsSyncingBanks] = useState(false);

  const [currentPath, setCurrentPath] = useState(initialPath);
  const [currentPage, setCurrentPageState] = useState<Page>(initialRoute.page);
  useScrollMemory(currentPage);
  const isPhone = useIsMobile();
  const [viewingAccountId, setViewingAccountId] = useState<string | null>(initialRoute.accountId ?? null);
  const [viewingHoldingSymbol, setViewingHoldingSymbol] = useState<string | null>(initialRoute.holdingSymbol ?? null);
  const [theme, setTheme] = useState<Theme>(() => {
    const storedTheme = safeLocalStorage.getItem('theme');
    return storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system' ? storedTheme : 'system';
  });

  const [preferences, setPreferences] = useState<AppPreferences>(emptyFinancialData.preferences);
  // Set while rendering, so every total below this reads the right currency on its first pass.
  setMainCurrency(preferences.currency);
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
  const [enableBankingConnections, setEnableBankingConnections] = useState<EnableBankingConnection[]>([]);
  const [isCommandCenterOpen, setIsCommandCenterOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isQuickAddTxModalOpen, setIsQuickAddTxModalOpen] = useState(false);

  const [hasPin, setHasPin] = useState(false);
  const lockRef = useRef<() => void>(() => undefined);

  useKeyboardShortcuts({
    onNavigate: (page) => {
      setIsShortcutsModalOpen(false);
      setCurrentPage(page);
    },
    onOpenNewTransaction: () => {
      setIsShortcutsModalOpen(false);
      setIsQuickAddTxModalOpen(true);
    },
    onToggleShortcutsModal: () => setIsShortcutsModalOpen(prev => !prev),
    onCloseShortcutsModal: () => setIsShortcutsModalOpen(false),
    onLock: hasPin ? () => {
      setIsShortcutsModalOpen(false);
      lockRef.current();
    } : undefined,
  });

  const latestDataRef = useRef<FinancialData>(emptyFinancialData);
  const lastUpdatedAtRef = useRef<string | null>(null);
  const restoreInProgressRef = useRef(false);
  const allowEmptySaveRef = useRef(false);
  // The value of each slice as last loaded from, or confirmed saved to, the server. Anything that differs
  // by reference is unsaved. This replaces the old "just loaded" timer and skip-next-save flag, which
  // silently discarded real edits made shortly after a load (QA-A-001) or during a save (REL-003).
  const savedSlicesRef = useRef<Partial<Record<keyof FinancialData, unknown>>>({});
  const baselinePendingRef = useRef(true);   // true until the freshly loaded data has been captured as the baseline
  const saveInFlightRef = useRef(false);
  const saveAgainRef = useRef(false);
  const syncingConnectionIdsRef = useRef<Set<string>>(new Set());
  const lastSaveFailureRef = useRef<{ ok: boolean; status?: number } | null>(null);
  const retryDelayRef = useRef(5000);
  const [loadGeneration, setLoadGeneration] = useState(0);
  const [dirtySignal, setDirtySignal] = useState(0);
  const getDirtyKeys = useCallback(
    (data: FinancialData) => PERSISTED_SLICE_KEYS.filter(key => data[key] !== savedSlicesRef.current[key]),
    [],
  );
  const [accountOrder, setAccountOrder] = useLocalStorage<string[]>('crystal-account-order', []);
  const [taskOrder, setTaskOrder] = useLocalStorage<string[]>('crystal-task-order', []);
  const [goalOrder, setGoalOrderState] = useState<string[]>(emptyFinancialData.goalOrder || []);
  const transactionsViewFilters = useRef<{ accountName?: string | null; tagId?: string | null }>({});
  const streakUpdatedRef = useRef(false);
  const [manualWarrantPrices, setManualWarrantPrices] = useState<Record<string, number | undefined>>(emptyFinancialData.manualWarrantPrices || {});
  const [priceHistory, setPriceHistory] = useState<Record<string, PriceHistoryEntry[]>>(emptyFinancialData.priceHistory || {});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Still used by the order-sync effects below to avoid reacting to the load itself.
  const isJustLoadedRef = useRef(true);
  useEffect(() => {
    if (isDataLoaded) {
      isJustLoadedRef.current = true;
      const timer = setTimeout(() => { isJustLoadedRef.current = false; }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isDataLoaded]);

  // Asks for a (debounced) save pass. Which slices actually need saving is decided by comparing them
  // with savedSlicesRef, so it is always safe to call this.
  const markSliceDirty = useCallback((_slice?: keyof FinancialData) => {
    if (restoreInProgressRef.current) return;
    setDirtySignal(signal => signal + 1);
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

  const holdingsOverview = useMemo(() => {
    const overview = buildHoldingsOverview(investmentAccounts, investmentTransactions, warrants, assetPrices, {
      currencyOf: symbol => preferences.investmentPriceConfigs?.[symbol]?.currency ?? 'EUR',
      toEur: (amount, currency) => convertToMain(amount, currency, preferences.conversionRates),
    });
    return {
      ...overview,
      holdings: overview.holdings.map(h => ({
        ...h,
        remainingQuantity: h.quantity
      }))
    };
  }, [investmentAccounts, investmentTransactions, warrants, assetPrices, preferences.investmentPriceConfigs, preferences.conversionRates]);

  const warrantPrices = useMemo<Record<string, number | null>>(() => {
    const resolved: Record<string, number | null> = {};
    warrants.forEach(warrant => {
      const symbol = warrant.isin;
      resolved[symbol] = assetPrices[symbol] ?? null;
    });
    return resolved;
  }, [assetPrices, warrants]);

  const navigateToPath = useCallback((path: string, replace = false, state?: any) => {
    if (typeof window === 'undefined') return;
    const nextPath = path || '/';
    const historyState = { internal: true, ...state };
    try {
      if (replace) { window.history.replaceState(historyState, '', nextPath); }
      else { window.history.pushState(historyState, '', nextPath); }
    } catch (e) {
      console.warn('Navigation state update failed, falling back to in-memory navigation:', e);
    }
    setCurrentPath(nextPath);
    window.dispatchEvent(new Event('crystal:tab'));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      setCurrentPath((window.location.pathname + window.location.search) || '/');
      window.dispatchEvent(new Event('crystal:tab'));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Preload primary route chunks when browser is idle for instant tab switching. Only once the user is signed in
  // and their data is loaded: the sign-in screen used to pull ~3 MB of pages nobody had asked for (AUD-39).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isAuthenticated || !isDataLoaded) return;
    const preloadRoutes = async () => {
      const primaryLoaders = [
        pageRegistry.Accounts.loader,
        pageRegistry.Transactions.loader,
        pageRegistry.Budget.loader,
        pageRegistry['Schedule & Bills'].loader,
        pageRegistry.Reports.loader,
        pageRegistry.Forecasting.loader,
        pageRegistry.Investments.loader,
        pageRegistry.Subscriptions.loader,
      ];
      for (const loader of primaryLoaders) {
        try {
          await loader();
          await new Promise(r => setTimeout(r, 120));
        } catch { /* ignore */ }
      }
    };

    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(preloadRoutes, { timeout: 3000 });
    } else {
      setTimeout(preloadRoutes, 1500);
    }
  }, [isAuthenticated, isDataLoaded]);

  const notFoundNoticeRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isDataLoaded || !notFoundNoticeRef.current) return;
    toast.error(`Page not found: ${notFoundNoticeRef.current}`);
    notFoundNoticeRef.current = null;
  }, [isDataLoaded]);

  useEffect(() => {
    const route = parseRoute(currentPath);
    setCurrentPageState(route.page);
    setViewingAccountId(route.accountId ?? null);
    setViewingHoldingSymbol(route.holdingSymbol ?? null);
    if (!route.matched && currentPath !== '/') {
      // The Toaster is not mounted until the app has loaded; show the notice after that.
      notFoundNoticeRef.current = currentPath;
      navigateToPath('/', true);
    }
  }, [currentPath, navigateToPath]);

  useEffect(() => {
    if (isPrivacyMode) { document.body.classList.add('privacy-mode'); }
    else { document.body.classList.remove('privacy-mode'); }
    // Catch amounts that are not individually marked with .privacy-blur (AUD-73).
    return isPrivacyMode ? startPrivacyMask() : undefined;
  }, [isPrivacyMode]);

  const setCurrentPage = useCallback((page: Page, tab?: string | null) => {
    let targetPath = pageToPath(page, page === 'AccountDetail' ? viewingAccountId : page === 'HoldingDetail' ? viewingHoldingSymbol : null);
    const resolvedTab = tab !== undefined ? tab : (page === 'Accounts' && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null);
    if (resolvedTab) {
      targetPath += `?tab=${encodeURIComponent(resolvedTab)}`;
    }
    navigateToPath(targetPath);
    setCurrentPageState(page);
    if (page !== 'AccountDetail') { setViewingAccountId(null); }
    if (page !== 'HoldingDetail') { setViewingHoldingSymbol(null); }
  }, [navigateToPath, viewingAccountId, viewingHoldingSymbol]);

  const handleOpenAccountDetail = useCallback((accountId: string, tab?: string | null) => {
    setViewingAccountId(accountId);
    setCurrentPageState('AccountDetail');
    const activeTab = tab !== undefined ? tab : (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null);
    const tabSuffix = activeTab ? `?tab=${encodeURIComponent(activeTab)}` : '';
    navigateToPath(pageToPath('AccountDetail', accountId) + tabSuffix, false, { fromAccounts: true });
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

  // Dynamic Font Synchronization
  useEffect(() => {
    const activeFont = preferences.appFont || 'manrope';
    applyAppFont(activeFont);
    try {
      localStorage.setItem('crystal_font', activeFont);
    } catch (error) { warnIgnored('remembering the font preference', error); }
  }, [preferences.appFont]);

  const warrantHoldingsBySymbol = useMemo<Record<string, number>>(() => {
    const holdings: Record<string, number> = {};
    investmentTransactions.forEach(tx => {
      if (!tx.symbol) return;
      const q = Number(tx.quantity) || 0;
      const isBuy = tx.type?.toLowerCase() === 'buy';
      holdings[tx.symbol] = (holdings[tx.symbol] || 0) + (isBuy ? q : -q);
    });
    warrants.forEach(warrant => {
      const q = Number(warrant.quantity) || 0;
      holdings[warrant.isin] = (holdings[warrant.isin] || 0) + q;
    });
    return holdings;
  }, [investmentTransactions, warrants]);

  useEffect(() => {
    setAccounts(prevAccounts => {
      let hasChanges = false;
      const updatedAccounts = prevAccounts.map(account => {
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
      return hasChanges ? updatedAccounts : prevAccounts;
    });
  }, [assetPrices, warrantHoldingsBySymbol]);

  const loadAllFinancialData = useCallback((data: FinancialData | null, options?: { skipNextSave?: boolean }) => {
    const dataToLoad = data ?? emptyFinancialData;
    const loadedPrefs = migrateRules({
      ...defaultPreferences,
      ...(dataToLoad.preferences || {}),
    }, dataToLoad.transactions || [], new Date().toISOString());
    lastUpdatedAtRef.current = dataToLoad.lastUpdatedAt ?? null;

    // Whatever ends up on screen after this load is, by definition, what the server has: it becomes the
    // baseline for change detection. (`options.skipNextSave` is accepted for compatibility but no longer needed.)
    baselinePendingRef.current = true;

    startTransition(() => {
      // Migration: grant-created accounts used to be hardcoded as 'ETF'. Reclassify accounts that
      // are backed only by equity grants (no market trades) as 'Warrant'.
      const loadedWarrantIsins = new Set((dataToLoad.warrants || []).map(w => w.isin?.toUpperCase()).filter(Boolean));
      const tradedSymbols = new Set((dataToLoad.investmentTransactions || []).map(t => t.symbol?.toUpperCase()).filter(Boolean));
      const migratedAccounts = (dataToLoad.accounts || []).map(acc => {
        const sym = acc.symbol?.toUpperCase();
        if (acc.type === 'Investment' && acc.subType === 'ETF' && sym && loadedWarrantIsins.has(sym) && !tradedSymbols.has(sym)) {
          return { ...acc, subType: 'Warrant' as const };
        }
        return acc;
      });
      setAccounts(migratedAccounts);
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
      // Never fall back to the demo connections for a real account: an empty list is a valid state.
      setEnableBankingConnections(dataToLoad.enableBankingConnections || []);
      setPreferences(loadedPrefs);
      if (loadedPrefs.conversionRates) {
        updateConversionRates(loadedPrefs.conversionRates);
      }
      setAccountOrder(dataToLoad.accountOrder || []);
      setTaskOrder(dataToLoad.taskOrder || []);
      setGoalOrderState(dataToLoad.goalOrder || []);
      setLoadGeneration(generation => generation + 1);
      setIsDataLoaded(true);
    });
    latestDataRef.current = dataToLoad;
  }, [setAccountOrder, setTaskOrder]);

  const usedCurrencies = useMemo(
    () => currenciesInUse(accounts, transactions, budgets, financialGoals, recurringTransactions, billsAndPayments),
    [accounts, transactions, budgets, financialGoals, recurringTransactions, billsAndPayments],
  );
  const ratelessCurrencies = useMemo(() => missingRates(usedCurrencies, preferences.conversionRates), [usedCurrencies, preferences.conversionRates, preferences.currency]);

  // FX Rates Auto-update
  // Choices that used to stay in this browser move to preferences once, as a normal change so they get saved (S-002).
  const hasMovedLocalChoices = useRef(false);
  useEffect(() => {
    if (!isDataLoaded || hasMovedLocalChoices.current) return;
    hasMovedLocalChoices.current = true;
    const moved = moveLocalChoices(preferences, window.localStorage);
    if (moved.hasChanged) setPreferences(moved.preferences);
  }, [isDataLoaded, preferences]);

  // Free ECB rates cover the majors. A Twelve Data key adds what's in use, and rates you set yourself win over both (D-109).
  useEffect(() => {
    if (!isDataLoaded) return;

    const fetchRates = async () => {
      const results = await Promise.allSettled([
        fetchEcbRates(),
        preferences.twelveDataApiKey
          ? fetchAllExchangeRates('EUR', [...new Set(['USD', 'GBP', 'BTC', 'RON', 'EUR', ...usedCurrencies])], preferences.twelveDataApiKey)
          : Promise.resolve({}),
      ]);
      results.forEach(result => { if (result.status === 'rejected') console.error('Failed to fetch FX rates:', result.reason); });
      const fetched = Object.assign({}, ...results.map(result => (result.status === 'fulfilled' ? result.value : {}))) as Record<string, number>;
      if (Object.keys(fetched).length === 0) return;

      setPreferences(prev => {
        const rates = { ...prev.conversionRates, ...fetched, ...prev.manualRates };
        if (JSON.stringify(prev.conversionRates) === JSON.stringify(rates)) return prev;
        updateConversionRates(rates);
        return { ...prev, conversionRates: rates, ratesUpdatedAt: new Date().toISOString() };
      });
      markSliceDirty('preferences');
    };

    // Fetch on load
    fetchRates();

    // Refresh every 4 hours
    const interval = setInterval(fetchRates, 4 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [preferences.twelveDataApiKey, isDataLoaded, markSliceDirty, usedCurrencies]);

  const handleSetUser = useCallback((updates: Partial<User>): Promise<boolean> => {
    if (isDemoMode) { setDemoUser(prev => prev ? { ...prev, ...updates } as User : null); return Promise.resolve(true); }
    return setUser(updates);
  }, [isDemoMode, setUser]);

  const currentUser = useMemo(() => isDemoMode ? demoUser : user, [isDemoMode, demoUser, user]);

  const dataToSave: FinancialData = useMemo(() => ({
    accounts, transactions, investmentTransactions, recurringTransactions,
    recurringTransactionOverrides, loanPaymentOverrides, financialGoals, goalOrder, budgets, tasks, warrants, memberships, importExportHistory, incomeCategories,
    expenseCategories, preferences, billsAndPayments, accountOrder, taskOrder, tags, manualWarrantPrices, priceHistory, invoices, userStats, predictions,
    enableBankingConnections, userProfile: currentUser || undefined
  }), [
    accounts, transactions, investmentTransactions,
    recurringTransactions, recurringTransactionOverrides, loanPaymentOverrides, financialGoals, goalOrder, budgets, tasks, warrants, memberships, importExportHistory,
    incomeCategories, expenseCategories, preferences, billsAndPayments, accountOrder, taskOrder, tags, manualWarrantPrices, priceHistory, invoices, userStats, predictions, enableBankingConnections, currentUser
  ]);

  const debouncedDirtySignal = useDebounce(dirtySignal, 900);

  // Dev-only behaviours (IndexedDB data cache, auto demo mode) belong to the Vite dev build only.
  // They must never key off the hostname: a production install opened on localhost is not "dev".
  const isDevEnvironment = import.meta.env.DEV;

  type SaveOutcome = { ok: boolean; status?: number; currentUpdatedAt?: string; isConflict?: boolean };
  const mergedFromOtherDeviceRef = useRef(false);

  const postData = useCallback(
    async (payload: Record<string, unknown>, options?: { keepalive?: boolean; suppressErrors?: boolean }): Promise<SaveOutcome> => {
      if (!isAuthenticated || isDemoMode) return { ok: false };
      try {
        const response = await authorizedFetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: options?.keepalive,
        });
        // Another tab locked this session, so this one follows.
        if (response.status === 423 && !options?.keepalive) window.location.reload();
        if (response.ok) return { ok: true, status: response.status };
        const body = await response.json().catch(() => ({} as any));
        return {
          ok: false,
          status: response.status,
          currentUpdatedAt: typeof body?.currentUpdatedAt === 'string' ? body.currentUpdatedAt : undefined,
          isConflict: response.status === 409 && /data conflict/i.test(String(body?.message || '')),
        };
      } catch (error) {
        return { ok: false };
      }
    }, [authorizedFetch, isAuthenticated, isDemoMode]
  );

  // Tell the user when a save did not go through (it used to fail silently), and clear the notice on success.
  const reportSaveSuccess = useCallback(() => { toast.dismiss('save-status'); }, []);
  const reportSaveFailure = useCallback((outcome: SaveOutcome, suppress?: boolean) => {
    if (suppress) return;
    if (outcome.status === 401 || outcome.status === 403) {
      toast.error('Your session has expired', {
        id: 'save-status', duration: Infinity,
        description: 'Your latest changes are not saved. Sign in again and repeat them.',
      });
    } else if (outcome.status === 409) {
      toast.error("Your changes couldn't be saved", {
        id: 'save-status', duration: Infinity,
        description: 'Newer data exists on the server. Reload the page to continue with the latest version.',
      });
    } else {
      toast.error('Changes not saved', {
        id: 'save-status', duration: Infinity,
        description: (typeof navigator !== 'undefined' && navigator.onLine === false)
          ? "You're offline. Your changes will be saved when you reconnect."
          : "The server couldn't be reached. Retrying…",
      });
    }
  }, []);

  /**
   * Sends a payload. If another device saved first (409 conflict) the slices being sent are three-way merged
   * with the server's current copy (see utils/threeWayMerge.ts) and sent again, so neither side's edits are lost.
   */
  const sendWithConflictRetry = useCallback(
    async (
      mode: 'partial' | 'full',
      data: Partial<FinancialData>,
      options?: { keepalive?: boolean; suppressErrors?: boolean; allowEmpty?: boolean },
    ): Promise<boolean> => {
      const build = (slices: Partial<FinancialData>, previousUpdatedAt: string | null) => {
        const now = toLocalDateTimeString(new Date());
        const payload = mode === 'partial'
          ? { partial: true, data: slices, lastUpdatedAt: now, previousUpdatedAt }
          : { ...slices, lastUpdatedAt: now, previousUpdatedAt, ...(options?.allowEmpty ? { allowEmpty: true } : {}) };
        return { now, payload: payload as Record<string, unknown> };
      };

      let { now, payload } = build(data, lastUpdatedAtRef.current);
      let outcome = await postData(payload, options);

      if (!outcome.ok && outcome.isConflict && outcome.currentUpdatedAt) {
        let merged: Partial<FinancialData> = data;
        try {
          const response = await authorizedFetch('/api/data');
          if (response.ok) {
            const serverCopy = await response.json() as Record<string, unknown>;
            merged = { ...data };
            for (const key of PERSISTED_SLICE_KEYS) {
              if (!(key in data)) continue;
              (merged as any)[key] = threeWayMerge(savedSlicesRef.current[key], (data as any)[key], serverCopy[key]);
            }
          }
        } catch { /* fall back to sending this device's slices unchanged */ }
        ({ now, payload } = build(merged, outcome.currentUpdatedAt));
        outcome = await postData(payload, options);
        if (outcome.ok) mergedFromOtherDeviceRef.current = true;
      }

      if (outcome.ok) {
        lastUpdatedAtRef.current = now;
        reportSaveSuccess();
      } else {
        lastSaveFailureRef.current = outcome;
        reportSaveFailure(outcome, options?.suppressErrors);
      }
      return outcome.ok;
    }, [postData, authorizedFetch, reportSaveSuccess, reportSaveFailure]
  );

  const saveData = useCallback(
    async (data: FinancialData, options?: { keepalive?: boolean; suppressErrors?: boolean; allowEmpty?: boolean }): Promise<boolean> => {
      if (!options?.allowEmpty && !hasMaterialData(data)) {
        console.warn('Skipping auto-save of empty data payload to prevent potential data loss.');
        return false;
      }
      return sendWithConflictRetry('full', data, options);
    }, [sendWithConflictRetry]
  );

  const savePartialData = useCallback(
    async (data: Partial<FinancialData>, options?: { keepalive?: boolean; suppressErrors?: boolean }): Promise<boolean> => {
      return sendWithConflictRetry('partial', data, options);
    }, [sendWithConflictRetry]
  );

  useEffect(() => {
    latestDataRef.current = dataToSave;
    if (!(isDevEnvironment && isDataLoaded && hasMaterialData(dataToSave))) return;
    // Debounced: serializing the whole dataset on every state change is expensive.
    const timer = setTimeout(() => { void saveDevCache(dataToSave); }, 1500);
    return () => clearTimeout(timer);
  }, [dataToSave, isDevEnvironment, isDataLoaded]);

  const handleEnterDemoMode = async () => {
    if (isDevEnvironment) {
      try {
        const cached = await loadDevCache();
        if (cached && hasMaterialData(cached)) {
          loadAllFinancialData(cached, { skipNextSave: true });
          setDemoUser(cached.userProfile || createDemoUser());
          setIsDemoMode(true);
          safeLocalStorage.setItem('crystal_dev_mode_active', 'true');
          return;
        }
      } catch (e) {
        console.warn('[Dev Cache] Failed loading cache on enter demo mode:', e);
      }
    }
    const { initialFinancialData: demoSeed } = await import('./demoSeed');
    loadAllFinancialData(demoSeed);
    setDemoUser(createDemoUser());
    setIsDemoMode(true);
    if (isDevEnvironment) {
      safeLocalStorage.setItem('crystal_dev_mode_active', 'true');
    }
  };

  useEffect(() => {
    const authAndLoad = async () => {
      let data: FinancialData | null = null;
      try {
        data = await checkAuthStatus();
      } catch (err) {
        console.warn('Auth check error:', err);
      }

      // Locked: the server sent nothing, and nothing may load, not even the dev cache (D-107).
      if (lockedOnLoadRef.current) return;

      if (data && hasMaterialData(data)) {
        if (isDevEnvironment) {
          void saveDevCache(data);
        }
        // loadAllFinancialData flips isDataLoaded inside the same transition as the data itself;
        // setting it again here would let isDataLoaded commit before accounts do (QA-B-006).
        loadAllFinancialData(data, { skipNextSave: true });
      } else {
        if (isDevEnvironment) {
          try {
            const cached = await loadDevCache();
            if (cached && hasMaterialData(cached)) {
              console.info('[Dev Cache] Restoring financial data from local browser cache...');
              const devUser = cached.userProfile || createDemoUser();
              setDemoUser(devUser);
              setIsDemoMode(true);
              safeLocalStorage.setItem('crystal_dev_mode_active', 'true');
              loadAllFinancialData(cached, { skipNextSave: true });
              return;
            }
          } catch (e) {
            console.warn('[Dev Cache] Failed to load cached dev data', e);
          }
        }
        if (data) {
          loadAllFinancialData(data, { skipNextSave: true });
        } else {
          if (isDevEnvironment && safeLocalStorage.getItem('crystal_dev_mode_active') === 'true') {
            setDemoUser(createDemoUser());
            setIsDemoMode(true);
            const { initialFinancialData: demoSeed } = await import('./demoSeed');
            loadAllFinancialData(demoSeed);
          }
          setIsDataLoaded(true);
        }
      }
    };
    authAndLoad();
  }, [isDevEnvironment, loadAllFinancialData, checkAuthStatus, lockedOnLoadRef]);

  useEffect(() => {
    if (isDataLoaded && isAuthenticated && !isDemoMode && accounts.length === 0 && budgets.length === 0 && !hasCompletedOnboarding && !preferences.onboardingCompleted) {
      const timer = setTimeout(() => { setIsOnboardingOpen(true); }, 500);
      return () => clearTimeout(timer);
    }
  }, [isDataLoaded, isAuthenticated, isDemoMode, accounts.length, budgets.length, hasCompletedOnboarding, preferences.onboardingCompleted]);

  const handleOnboardingFinish = () => {
    setHasCompletedOnboarding(true);
    setPreferences(prev => (prev.onboardingCompleted ? prev : { ...prev, onboardingCompleted: true }));
    setIsOnboardingOpen(false);
  };

  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('accounts'); }, [accounts, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('transactions'); }, [transactions, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('investmentTransactions'); }, [investmentTransactions, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('recurringTransactions'); }, [recurringTransactions, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('recurringTransactionOverrides'); }, [recurringTransactionOverrides, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('loanPaymentOverrides'); }, [loanPaymentOverrides, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('financialGoals'); }, [financialGoals, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || restoreInProgressRef.current) return; markSliceDirty('budgets'); }, [budgets, isDataLoaded, markSliceDirty]);
  // Budgets follow their category by id (Q8): fills `categoryId` once and renames budgets with their category.
  useEffect(() => {
    if (!isDataLoaded || restoreInProgressRef.current) return;
    setBudgets(prev => linkBudgetsToCategories(prev, expenseCategories));
  }, [expenseCategories, budgets, isDataLoaded]);
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
      fileName: 'Backup restore',
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

    if (isDevEnvironment) {
      void saveDevCache(dataWithHistory);
      if (data.userProfile) {
        setDemoUser(data.userProfile);
      } else if (!demoUser) {
        setDemoUser(createDemoUser());
      }
      setIsDemoMode(true);
    }

    if (!isDemoMode && isAuthenticated) {
      saveData(dataWithHistory, { suppressErrors: true })
        .then(saved => {
          if (!saved) {
            // The restored state is on screen but not on the server: make every slice count as unsaved.
            savedSlicesRef.current = {};
            toast.error('The restored data could not be saved to the server yet. It will be retried.');
          }
        })
        .catch(console.error)
        .finally(() => { restoreInProgressRef.current = false; setDirtySignal(signal => signal + 1); });
    } else {
      restoreInProgressRef.current = false;
    }
  }, [isAuthenticated, isDemoMode, loadAllFinancialData, saveData, handleSetUser]);

  // After a conflict merge the server holds this device's edits plus another device's. Adopt that copy so
  // the screen matches the account again, unless there are newer local edits waiting to be saved.
  const refreshFromServer = useCallback(async () => {
    if (getDirtyKeys(latestDataRef.current).length > 0) return;
    try {
      const response = await authorizedFetch('/api/data');
      if (!response.ok) return;
      const serverData = await response.json() as FinancialData;
      if (getDirtyKeys(latestDataRef.current).length > 0) return;
      loadAllFinancialData(serverData);
      toast.info('Synced with changes from another device');
    } catch { /* the next successful save will reconcile */ }
  }, [authorizedFetch, getDirtyKeys, loadAllFinancialData]);

  // Come back online: retry right away instead of waiting for the next edit.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOnline = () => setDirtySignal(signal => signal + 1);
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  // Capture the baseline on the first commit after every load, then watch for real changes.
  useEffect(() => {
    if (!isDataLoaded) return;
    if (baselinePendingRef.current) {
      const baseline: Partial<Record<keyof FinancialData, unknown>> = {};
      for (const key of PERSISTED_SLICE_KEYS) baseline[key] = dataToSave[key];
      savedSlicesRef.current = baseline;
      baselinePendingRef.current = false;
      return;
    }
    if (getDirtyKeys(dataToSave).length > 0) setDirtySignal(signal => signal + 1);
  }, [dataToSave, loadGeneration, isDataLoaded, getDirtyKeys]);

  useEffect(() => {
    if (!isDataLoaded || !isAuthenticated || isDemoMode || restoreInProgressRef.current) return;
    if (baselinePendingRef.current) return;

    const persistDirtySlices = async () => {
      if (saveInFlightRef.current) { saveAgainRef.current = true; return; }

      const currentData = latestDataRef.current;
      const dirtyKeys = getDirtyKeys(currentData);
      if (dirtyKeys.length === 0) return;

      const allowEmpty = allowEmptySaveRef.current;
      if (!allowEmpty && !hasMaterialData(currentData)) {
        // Never overwrite server data with an empty state; treat it as already saved.
        for (const key of dirtyKeys) savedSlicesRef.current[key] = currentData[key];
        return;
      }

      saveInFlightRef.current = true;
      let succeeded = false;
      try {
        if (allowEmpty || dirtyKeys.length >= PERSISTED_SLICE_KEYS.length) {
          succeeded = await saveData(currentData, { allowEmpty });
        } else {
          const partialPayload: Partial<FinancialData> = {};
          for (const key of dirtyKeys) (partialPayload as any)[key] = currentData[key];
          succeeded = await savePartialData(partialPayload);
        }
      } finally {
        saveInFlightRef.current = false;
      }

      if (succeeded) {
        // Only what was actually sent becomes "saved"; edits made while the request was in flight stay dirty.
        for (const key of dirtyKeys) savedSlicesRef.current[key] = currentData[key];
        if (allowEmpty) allowEmptySaveRef.current = false;
        retryDelayRef.current = 5000;
        if (mergedFromOtherDeviceRef.current) {
          mergedFromOtherDeviceRef.current = false;
          await refreshFromServer();
        }
      } else {
        // Keep the slices dirty and try again with a growing delay. Expired sessions and permanent
        // conflicts need the user, so those are not retried blindly.
        const status = lastSaveFailureRef.current?.status;
        if (status !== 401 && status !== 403 && status !== 409) {
          const delay = retryDelayRef.current;
          retryDelayRef.current = Math.min(delay * 2, 30_000);
          setTimeout(() => setDirtySignal(signal => signal + 1), delay);
        }
      }
      if (succeeded && (saveAgainRef.current || getDirtyKeys(latestDataRef.current).length > 0)) {
        saveAgainRef.current = false;
        setDirtySignal(signal => signal + 1);
      }
    };
    void persistDirtySlices();
  }, [debouncedDirtySignal, isAuthenticated, isDataLoaded, isDemoMode, saveData, savePartialData, getDirtyKeys, refreshFromServer]);

  useEffect(() => {
    if (!isAuthenticated || isDemoMode || typeof window === 'undefined') return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDataLoaded || baselinePendingRef.current || restoreInProgressRef.current) return;
      const currentData = latestDataRef.current;
      const dirtyKeys = getDirtyKeys(currentData);
      if (dirtyKeys.length === 0) return;
      if (!allowEmptySaveRef.current && !hasMaterialData(currentData)) return;

      // Send only what changed: a full snapshot easily exceeds the 64 KiB keepalive limit (REL-004).
      const partialPayload: Partial<FinancialData> = {};
      for (const key of dirtyKeys) (partialPayload as any)[key] = currentData[key];
      if (JSON.stringify(partialPayload).length <= KEEPALIVE_MAX_BYTES) {
        void savePartialData(partialPayload, { keepalive: true, suppressErrors: true });
      } else {
        // Too large to send while the page is closing: let the browser ask before throwing the edits away.
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isAuthenticated, isDataLoaded, isDemoMode, savePartialData, getDirtyKeys]);

  useEffect(() => {
    if (!isDataLoaded || isJustLoadedRef.current) return;
    if (accounts.length > accountOrder.length) {
      const orderedAccountIds = new Set(accountOrder);
      const newAccountIds = accounts.filter(acc => !orderedAccountIds.has(acc.id)).map(acc => acc.id);
      if (newAccountIds.length > 0) {
        setAccountOrder(prev => [...prev, ...newAccountIds]);
      }
    } else if (accounts.length < accountOrder.length) {
      const accountIds = new Set(accounts.map(a => a.id));
      const nextOrder = accountOrder.filter(id => accountIds.has(id));
      if (nextOrder.length !== accountOrder.length) {
        setAccountOrder(nextOrder);
      }
    }
  }, [accounts, accountOrder, setAccountOrder, isDataLoaded]);

  useEffect(() => {
    if (!isDataLoaded || isJustLoadedRef.current) return;
    if (tasks.length > taskOrder.length) {
      const orderedTaskIds = new Set(taskOrder);
      const newTaskIds = tasks.filter(task => !orderedTaskIds.has(task.id)).map(task => task.id);
      if (newTaskIds.length > 0) {
        setTaskOrder(prev => [...prev, ...newTaskIds]);
      }
    } else if (tasks.length < taskOrder.length) {
      const taskIds = new Set(tasks.map(t => t.id));
      const nextOrder = taskOrder.filter(id => taskIds.has(id));
      if (nextOrder.length !== taskOrder.length) {
        setTaskOrder(nextOrder);
      }
    }
  }, [tasks, taskOrder, setTaskOrder, isDataLoaded]);

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
    if (isDevEnvironment) {
      safeLocalStorage.removeItem('crystal_dev_mode_active');
    }
  }, [signOut, loadAllFinancialData, setHasCompletedOnboarding, setAuthPage, setIsDemoMode, setDemoUser, isDevEnvironment]);

  const forceLogoutRef = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || isDemoMode || !isDataLoaded) return;
    let isCurrent = true;
    authorizedFetch('/api/lock/status')
      .then(response => (response.ok ? response.json() : null))
      .then(status => { if (isCurrent && status) setHasPin(!!status.hasPin); })
      .catch(() => undefined);
    return () => { isCurrent = false; };
  }, [authorizedFetch, isAuthenticated, isDataLoaded, isDemoMode]);

  // Saves first, then reloads once locked, so no data stays in the browser and nothing empty can be saved back (D-107).
  const handleLock = useCallback(async () => {
    const currentData = latestDataRef.current;
    const dirtyKeys = getDirtyKeys(currentData);
    if (dirtyKeys.length > 0 && hasMaterialData(currentData)) {
      const partialPayload: Partial<FinancialData> = {};
      for (const key of dirtyKeys) (partialPayload as any)[key] = currentData[key];
      const saved = await savePartialData(partialPayload);
      if (!saved) {
        toast.error('Crystal didn’t lock', { id: 'lock-failed', description: 'Your latest changes couldn’t be saved first. Check your connection and try again.' });
        return;
      }
    }
    try {
      const response = await authorizedFetch('/api/lock/lock', { method: 'POST' });
      if (!response.ok) throw new Error('Lock refused');
      new BroadcastChannel(LOCK_CHANNEL).postMessage('locked');
      window.location.reload();
    } catch {
      toast.error('Crystal didn’t lock', { id: 'lock-failed', description: 'Check your connection and try again.' });
    }
  }, [authorizedFetch, getDirtyKeys, savePartialData]);
  lockRef.current = handleLock;

  useEffect(() => {
    const channel = new BroadcastChannel(LOCK_CHANNEL);
    channel.onmessage = () => window.location.reload();
    return () => channel.close();
  }, []);

  useIdleLock(preferences.autoLockMinutes ?? DEFAULT_AUTO_LOCK_MINUTES, hasPin && isDataLoaded && !isDemoMode, handleLock);

  const handleLogout = useCallback(async () => {
    if (!isDemoMode && isAuthenticated && isDataLoaded && !baselinePendingRef.current) {
      const currentData = latestDataRef.current;
      const dirtyKeys = getDirtyKeys(currentData);
      if (dirtyKeys.length > 0 && hasMaterialData(currentData)) {
        const partialPayload: Partial<FinancialData> = {};
        for (const key of dirtyKeys) (partialPayload as any)[key] = currentData[key];
        const saved = await savePartialData(partialPayload);
        if (!saved && !forceLogoutRef.current) {
          forceLogoutRef.current = true;
          toast.error("Your latest changes couldn't be saved", {
            description: 'Check your connection and try again, or sign out again to leave without saving.',
          });
          return;
        }
      }
    }
    forceLogoutRef.current = false;
    finalizeLogout();
  }, [finalizeLogout, isAuthenticated, isDataLoaded, isDemoMode, savePartialData, getDirtyKeys]);

  const handleSaveAccount = (accountData: Omit<Account, 'id'> & { id?: string }) => {
    const accountWithDefaults = { ...accountData, includeInAnalytics: accountData.includeInAnalytics ?? true } as Omit<Account, 'id'> & { id?: string };

    // A caller may pre-assign an id to a brand-new account (bank linking, CSV import);
    // whether it is new is decided by whether the id already exists, not by having an id.
    const finalAccountId = accountData.id || `acc-${uuidv4()}`;
    const savedAccount = { ...accountWithDefaults, id: finalAccountId } as Account;

    setAccounts(prev => {
      const isNew = !prev.some(acc => acc.id === finalAccountId);
      if (isNew) savedAccount.status = 'open';

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
          const convertedSaleProceeds = convertCurrency(
            details.value,
            account.currency,
            acc.currency,
            preferences.conversionRates
          );
          return { ...acc, balance: safeRound(acc.balance + convertedSaleProceeds) };
        }
        return acc;
      });
    });

    setViewingAccountId(null);
    setCurrentPage('Accounts');
  }, [accounts, preferences.conversionRates, setCurrentPage]);

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
          const convertedSaleProceeds = convertCurrency(
            details.value,
            account.currency,
            acc.currency,
            preferences.conversionRates
          );
          return { ...acc, balance: safeRound(acc.balance - convertedSaleProceeds) };
        }
        return acc;
      });
    });
  }, [accounts, preferences.conversionRates]);

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

  // Several saves can land before the next render, so each plans from the one before it.
  const transactionsRef = useRef(transactions);
  transactionsRef.current = transactions;

  const handleSaveTransaction = useCallback((
    transactionDataArray: (Omit<Transaction, 'id'> & { id?: string })[],
    transactionIdsToDelete: string[] = [],
    options?: { autoSpareChange?: boolean; skipRules?: boolean; applyRules?: boolean; isNew?: boolean; fromSync?: boolean; resyncable?: boolean }
  ) => {
    // Bank records arrive with their own id, so `isNew` says they're new rather than edits (DEF-06).
    const isNewRecord = (tx: { id?: string }) => !tx.id || options?.isNew;
    const finalTxArray = [...transactionDataArray];

    if (!options?.skipRules) {
      finalTxArray.forEach((tx, index) => {
        if (isNewRecord(tx) || options?.applyRules) finalTxArray[index] = applySavedRules(tx, preferences);
      });
    }

    // Automatic Spare Change Logic
    if (options?.autoSpareChange) {
      finalTxArray.slice().forEach(tx => {
        if (!isNewRecord(tx)) return; // Only for brand new transactions
        if (tx.transferId?.startsWith('spare-')) return; // Avoid recursive spare change
        if (tx.type !== 'expense') return; // Only for outflows (spending or outgoing transfer side)

        const linkedSpareChangeAccount = accounts.find(a =>
          a.type === 'Investment' &&
          a.subType === 'Spare Change' &&
          a.linkedAccountId === tx.accountId
        );

        if (linkedSpareChangeAccount) {
          const spareAmount = spareChangeFor(tx.amount);

          if (spareAmount > 0) {
            const newTxId = tx.id || uuidv4();
            tx.id = newTxId;
            const spareTransferId = `spare-${newTxId}`;
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

    // Your edits to a bank-synced transaction lock the fields you changed, so the next sync keeps them.
    if (!options?.fromSync && !options?.isNew) {
      finalTxArray.forEach((tx, index) => {
        if (!tx.id) return;
        finalTxArray[index] = withEditLocks(transactionsRef.current.find(existing => existing.id === tx.id), tx);
      });
    }

    // A bank-synced transaction you delete is remembered so the next sync does not bring it back; restoring it forgets that.
    // `resyncable` deletes (a whole import) are left out, so the bank can fetch them again.
    if (!options?.fromSync) {
      const removed = transactionsRef.current.filter(tx => transactionIdsToDelete.includes(tx.id));
      if (removed.length > 0 && !options?.resyncable) setEnableBankingConnections(prev => rememberDeleted(prev, removed));
      if (!options?.isNew) {
        const restored = finalTxArray.filter(tx => tx.id && !transactionsRef.current.some(existing => existing.id === tx.id)) as Transaction[];
        if (restored.length > 0) setEnableBankingConnections(prev => forgetDeleted(prev, restored));
      }
    }

    const changes = planTransactionChanges(transactionsRef.current, finalTxArray, transactionIdsToDelete, accounts);
    transactionsRef.current = applyTransactionChanges(transactionsRef.current, changes);
    setTransactions(prev => applyTransactionChanges(prev, changes));
    if (Object.keys(changes.balanceChanges).length > 0) setAccounts(prev => applyBalanceChanges(prev, changes.balanceChanges));
  }, [accounts, preferences]);

  const handleDeleteTransactions = useCallback((transactionIds: string[], options?: { resyncable?: boolean }) => {
    if (transactionIds.length === 0) return;
    const deletedTxs = transactions.filter(t => transactionIds.includes(t.id));
    handleSaveTransaction([], transactionIds, { resyncable: options?.resyncable });
    toast.success(
      deletedTxs.length === 1 
        ? `Deleted "${deletedTxs[0].description}"`
        : `Deleted ${deletedTxs.length} transactions`,
      {
        duration: 10000,
        action: {
          label: 'Undo',
          onClick: () => {
            handleSaveTransaction(deletedTxs);
            toast.info('Restored transaction(s)');
          }
        }
      }
    );
  }, [transactions, handleSaveTransaction]);
  const handleSaveInvestmentTransaction = (invTxData: Omit<InvestmentTransaction, 'id'> & { id?: string }, cashTxData?: Omit<Transaction, 'id'>, newAccount?: Omit<Account, 'id'>) => {
    const symbol = invTxData.symbol.toUpperCase();
    const type = invTxData.type?.toLowerCase();

    // Calculate current holdings for this symbol excluding the transaction being edited (if editing)
    let currentHoldingQty = 0;
    investmentTransactions.forEach(t => {
      if (t.symbol?.toUpperCase() === symbol && t.id !== invTxData.id) {
        const q = Number(t.quantity) || 0;
        if (t.type?.toLowerCase() === 'buy') {
          currentHoldingQty += q;
        } else if (t.type?.toLowerCase() === 'sell') {
          currentHoldingQty -= q;
        }
      }
    });
    warrants.forEach(w => {
      if (w.isin?.toUpperCase() === symbol) {
        currentHoldingQty += Number(w.quantity) || 0;
      }
    });

    if (type === 'sell') {
      const sellQty = Number(invTxData.quantity) || 0;
      if (sellQty > currentHoldingQty) {
        toast.error(`Cannot process sale of ${sellQty} shares. You only hold ${currentHoldingQty} shares of ${symbol}.`);
        return;
      }
    }

    let nextTxList: InvestmentTransaction[];
    if (invTxData.id) {
      nextTxList = investmentTransactions.map(t => t.id === invTxData.id ? { ...t, ...invTxData } as InvestmentTransaction : t);
      setInvestmentTransactions(nextTxList);
    } else {
      const newTx = { ...invTxData, id: `inv-txn-${uuidv4()}` } as InvestmentTransaction;
      nextTxList = [...investmentTransactions, newTx];
      setInvestmentTransactions(nextTxList);
      if (cashTxData) handleSaveTransaction([cashTxData]);
    }

    // Calculate remaining quantity of this symbol based on the updated transactions list
    let remainingQtyForSymbol = 0;
    nextTxList.forEach(t => {
      if (t.symbol?.toUpperCase() === symbol) {
        const q = Number(t.quantity) || 0;
        if (t.type?.toLowerCase() === 'buy') {
          remainingQtyForSymbol += q;
        } else if (t.type?.toLowerCase() === 'sell') {
          remainingQtyForSymbol -= q;
        }
      }
    });
    warrants.forEach(w => {
      if (w.isin?.toUpperCase() === symbol) {
        remainingQtyForSymbol += Number(w.quantity) || 0;
      }
    });

    // Recalculate remaining balance or quantity based on final holding quantity and current asset price
    const price = assetPrices[symbol] ?? invTxData.price;
    const finalBalance = remainingQtyForSymbol * price;

    if (newAccount) {
      const accountWithBalance = { ...newAccount, balance: finalBalance };
      handleSaveAccount(accountWithBalance);
    }

    // Update the accounts state for the matching Investment account
    setAccounts(prevAccounts => prevAccounts.map(account => {
      if (account.symbol?.toUpperCase() === symbol && account.type === 'Investment') {
        return {
          ...account,
          balance: parseFloat(finalBalance.toFixed(account.currency === 'BTC' ? 8 : 2))
        };
      }
      return account;
    }));
  };
  const handleDeleteInvestmentTransaction = (id: string) => { setInvestmentTransactions(prev => prev.filter(t => t.id !== id)); };
  const handleSaveRecurringTransaction = (recurringData: Omit<RecurringTransaction, 'id'> & { id?: string }) => {
    setRecurringTransactions(prev => upsertEntity(prev, recurringData, () => `rec-${uuidv4()}`));
  };
  const handleDeleteRecurringTransaction = (id: string) => {
    const item = recurringTransactions.find(r => r.id === id);
    setRecurringTransactions(prev => removeEntityById(prev, id));
    if (item) {
      toast.success(`Removed subscription "${item.description || item.merchant}"`, {
        action: {
          label: 'Undo',
          onClick: () => {
            setRecurringTransactions(prev => [...prev, item]);
            toast.info('Restored subscription');
          }
        }
      });
    }
  };
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
  const handleDeleteBudget = (id: string) => {
    const item = budgets.find(b => b.id === id);
    setBudgets(prev => removeEntityById(prev, id));
    if (item) {
      toast.success(`Deleted budget for "${item.categoryName}"`, {
        action: {
          label: 'Undo',
          onClick: () => {
            // Idempotent: a second click (or a second Undo elsewhere) must not duplicate it.
            setBudgets(prev => prev.some(b => b.id === item.id) ? prev : [...prev, item]);
            toast.info('Restored budget');
          }
        }
      });
    }
  };
  const handleSaveTask = (taskData: Omit<Task, 'id'> & { id?: string }) => {
    setTasks(prev => upsertEntity(prev, taskData, () => `task-${uuidv4()}`));
  };
  const handleDeleteTask = (taskId: string) => {
    const item = tasks.find(t => t.id === taskId);
    setTasks(prev => removeEntityById(prev, taskId));
    if (item) {
      toast.success(`Deleted task "${item.title}"`, {
        action: {
          label: 'Undo',
          onClick: () => {
            setTasks(prev => [...prev, item]);
            toast.info('Restored task');
          }
        }
      });
    }
  };
  const handleSaveWarrant = (warrantData: Omit<Warrant, 'id'> & { id?: string }) => {
    let warrantId = warrantData.id;
    if (warrantData.id) {
      setWarrants(prev => prev.map(w => w.id === warrantData.id ? { ...w, ...warrantData } as Warrant : w));
    }
    else {
      warrantId = `warr-${uuidv4()}`;
      setWarrants(prev => [...prev, { ...warrantData, id: warrantId } as Warrant]);
      if (warrantData.isin && !accounts.some(acc => acc.type === 'Investment' && acc.symbol?.toUpperCase() === warrantData.isin.toUpperCase())) {
        handleSaveAccount({ name: warrantData.name || 'Warrant', type: 'Investment', subType: 'Warrant', symbol: warrantData.isin.toUpperCase(), balance: 0, currency: 'EUR' });
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
  const handleManualWarrantPrice = (isin: string, priceOrEntries: number | null | { date: string, price: number }[], date?: string) => {
    if (Array.isArray(priceOrEntries)) {
      setPriceHistory((prev: Record<string, PriceHistoryEntry[]>) => {
        const historyMap = new Map<string, PriceHistoryEntry>((prev[isin] || []).map((item: PriceHistoryEntry) => [item.date, item]));
        priceOrEntries.forEach((entry: { date: string, price: number }) => historyMap.set(entry.date, entry as PriceHistoryEntry));
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
    return items.map((item: any, index: number) => ({
      id: item.id || item.aspsp_id || item.bank_id || item.name || `aspsp-${index}`,
      name: item.name || item.full_name || item.fullName || 'Bank',
      country: item.country || payload.countryCode,
      logo: typeof item.logo === 'string' ? item.logo : undefined,
      psuTypes: Array.isArray(item.psu_types || item.psuTypes) ? (item.psu_types || item.psuTypes) : undefined,
      maximumConsentValidity: Number.isFinite(Number(item.maximum_consent_validity ?? item.maximumConsentValidity))
        ? Number(item.maximum_consent_validity ?? item.maximumConsentValidity)
        : undefined,
    }));
  }, [fetchWithAuth, isAuthenticated]);

  const handleCreateEnableBankingConnection = useCallback(async (payload: { applicationId: string; countryCode: string; clientCertificate: string; selectedBank: string; connectionId?: string; }) => {
    if (!isAuthenticated) return;

    let selectedBankId = '';
    let selectedBankName = '';
    let bankLogoUrl: string | undefined;
    let psuType: 'personal' | 'business' | undefined;
    let maximumConsentValidity: number | undefined;
    try {
      const bankData = JSON.parse(payload.selectedBank);
      selectedBankId = bankData.id;
      selectedBankName = bankData.name;
      if (typeof bankData.logo === 'string') bankLogoUrl = bankData.logo;
      if (bankData.psuType === 'personal' || bankData.psuType === 'business') psuType = bankData.psuType;
      if (Number.isFinite(Number(bankData.maximumConsentValidity))) maximumConsentValidity = Number(bankData.maximumConsentValidity);
    } catch (e) {
      selectedBankName = payload.selectedBank;
    }

    const connectionId = payload.connectionId || `eb-${uuidv4()}`;
    const existingConnection = payload.connectionId ? enableBankingConnections.find(conn => conn.id === payload.connectionId) : undefined;
    const baseConnection: EnableBankingConnection = {
      ...(existingConnection && { ...existingConnection }),
      id: connectionId,
      applicationId: (payload.applicationId || '').trim(),
      countryCode: (payload.countryCode || '').trim().toUpperCase(),
      status: 'pending',
      selectedBank: selectedBankName || existingConnection?.selectedBank,
      selectedBankId: selectedBankId || existingConnection?.selectedBankId,
      bankLogoUrl: bankLogoUrl || existingConnection?.bankLogoUrl,
      psuType: psuType || existingConnection?.psuType || 'personal',
      maximumConsentValidity: maximumConsentValidity ?? existingConnection?.maximumConsentValidity,
      accounts: existingConnection?.accounts || [],
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
      const response = await fetchWithAuth('/api/enable-banking/authorize', {
        method: 'POST',
        body: JSON.stringify({
          applicationId: baseConnection.applicationId,
          clientCertificate: (payload.clientCertificate || '').trim() || undefined,
          countryCode: baseConnection.countryCode,
          aspspName: baseConnection.selectedBank,
          aspspId: baseConnection.selectedBankId,
          psuType: baseConnection.psuType,
          maximumConsentValidity: baseConnection.maximumConsentValidity,
          state: connectionId,
        }),
      });
      const data = await response.json();
      setEnableBankingConnections(prev => prev.map(conn => conn.id === connectionId ? { ...conn, authorizationId: data.authorizationId, lastError: undefined, } : conn));
      if (data.authorizationUrl) { window.location.href = data.authorizationUrl; }
    } catch (error: any) {
      setEnableBankingConnections(prev => prev.map(conn => conn.id === connectionId ? { ...conn, status: 'requires_update', lastError: error?.message || 'Unable to start authorization', } : conn));
    }
  }, [enableBankingConnections, fetchWithAuth, isDataLoaded, isDemoMode, savePartialDataWithRetry, isAuthenticated]);

  const handleSyncEnableBankingConnection = useCallback(async (connectionId: string, connectionOverride?: EnableBankingConnection, syncOptions?: EnableBankingSyncOptions) => {
    if (!isAuthenticated) return;
    const connection = connectionOverride || enableBankingConnections.find(c => c.id === connectionId);
    if (!connection?.sessionId) return;
    // One sync per connection at a time: overlapping runs both dedupe against the same snapshot and import twice.
    if (syncingConnectionIdsRef.current.has(connectionId)) return;
    syncingConnectionIdsRef.current.add(connectionId);
    let newTransactionCount = 0;
    let updatedTransactionCount = 0;
    const truncatedAccountNames: string[] = [];
    try {
      // The status is deliberately not set to 'pending' here: 'pending' is persisted, so a tab closed
      // mid-sync used to leave the connection stuck and excluded from "Sync all" forever.
      setEnableBankingConnections(prev => prev.map(conn => conn.id === connectionId ? { ...conn, lastError: undefined } : conn));
      const session = await fetchWithAuth('/api/enable-banking/session/fetch', { method: 'POST', body: JSON.stringify({ sessionId: connection.sessionId, applicationId: connection.applicationId, }), }).then(res => res.json());
      const accountsFromSession: any[] = session?.accounts || [];
      const updatedAccounts: EnableBankingAccount[] = [];
      const importedTransactions: Transaction[] = [];
      const shouldSyncTransactions = (syncOptions?.transactionMode || 'full') !== 'none';
      const shouldUpdateLinkedAccountBalances = syncOptions?.updateBalance ?? true;
      const linkedAccountBalanceUpdates = new Map<string, { balance: number; currency: Currency }>();

      const existingMerchantNames = Array.from(
        new Set([
          ...Object.keys(preferences.merchantRules || {}),
          ...transactions.map(t => t.merchant).filter((m): m is string => Boolean(m && m.trim())),
        ])
      );
      const linkedIbanToAccountName: Record<string, string> = {};
      for (const acc of accounts) {
        if (acc.accountNumber) {
          const clean = acc.accountNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
          if (clean) linkedIbanToAccountName[clean] = acc.name;
        }
      }
      for (const conn of enableBankingConnections) {
        for (const ebAcc of conn.accounts || []) {
          if (ebAcc.accountNumber) {
            const clean = ebAcc.accountNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            const linkedCrystal = ebAcc.linkedAccountId ? accounts.find(a => a.id === ebAcc.linkedAccountId) : undefined;
            if (clean) linkedIbanToAccountName[clean] = linkedCrystal?.name || ebAcc.name;
          }
        }
      }

      const userIdentities = [
        user ? `${user.firstName} ${user.lastName}`.trim() : undefined,
        demoUser ? `${demoUser.firstName} ${demoUser.lastName}`.trim() : undefined,
      ].filter((v): v is string => Boolean(v));

      for (const account of accountsFromSession) {
        const initialIds = extractProviderAccountIdentifiers(account);
        if (!initialIds.uid) {
          console.warn('Enable Banking account missing provider account id. Skipping.', account);
          continue;
        }
        const providerAccountId = initialIds.uid;
        const [details, balances] = await Promise.all([
          fetchWithAuth(`/api/enable-banking/accounts/${encodeURIComponent(providerAccountId)}/details`, { method: 'POST', body: JSON.stringify({ applicationId: connection.applicationId, sessionId: connection.sessionId, }), }).then(res => res.json()).catch(() => null),
          fetchWithAuth(`/api/enable-banking/accounts/${encodeURIComponent(providerAccountId)}/balances`, { method: 'POST', body: JSON.stringify({ applicationId: connection.applicationId, sessionId: connection.sessionId, }), }).then(res => res.json()),
        ]);
        const identifiers = extractProviderAccountIdentifiers(account, details);
        const existingLinkedAccount = matchExistingProviderAccount(connection.accounts || [], identifiers);
        const resolvedBalance = resolveEnableBankingBalance(balances);
        const currency = (account?.currency || details?.currency || resolvedBalance.currency || existingLinkedAccount?.currency || 'EUR') as Currency;
        const linkedAccountId = existingLinkedAccount?.linkedAccountId;
        const accountName = details?.name || details?.product || account?.name || account?.product || existingLinkedAccount?.name || 'Bank account';

        if (identifiers.accountNumber) {
          const cleanOwn = identifiers.accountNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
          const linkedCrystal = linkedAccountId ? accounts.find(a => a.id === linkedAccountId) : undefined;
          if (cleanOwn) linkedIbanToAccountName[cleanOwn] = linkedCrystal?.name || accountName;
        }

        updatedAccounts.push({
          id: providerAccountId,
          identificationHash: identifiers.identificationHash || existingLinkedAccount?.identificationHash,
          accountNumber: identifiers.accountNumber || existingLinkedAccount?.accountNumber,
          name: accountName,
          bankName: connection.selectedBank || 'Enable Banking',
          currency,
          balance: resolvedBalance.amount,
          linkedAccountId,
          syncStartDate: existingLinkedAccount?.syncStartDate,
          deletedTransactionIds: existingLinkedAccount?.deletedTransactionIds,
          lastSyncedAt: toLocalDateTimeString(new Date()),
        });

        if (shouldUpdateLinkedAccountBalances && linkedAccountId && Number.isFinite(resolvedBalance.amount)) {
          linkedAccountBalanceUpdates.set(linkedAccountId, {
            balance: resolvedBalance.amount,
            currency,
          });
        }

        const accountTargeted = !syncOptions?.targetAccountIds?.length
          || syncOptions.targetAccountIds.includes(providerAccountId)
          || (existingLinkedAccount?.id ? syncOptions.targetAccountIds.includes(existingLinkedAccount.id) : false);
        if (!shouldSyncTransactions || !linkedAccountId || !accountTargeted) {
          continue;
        }

        const dateFrom = computeSyncDateFrom({
          transactionMode: syncOptions?.transactionMode,
          syncStartDate: syncOptions?.syncStartDate,
          accountSyncStartDate: existingLinkedAccount?.syncStartDate,
          accountLastSyncedAt: existingLinkedAccount?.lastSyncedAt,
        });
        const strategy = syncOptions?.transactionMode === 'incremental' ? 'default' : 'longest';

        let continuationKey: string | undefined;
        const seenPageKeys = new Set<string>();
        let pageCapReached = true;
        for (let page = 0; page < 100; page += 1) {
          const txResponse = await fetchWithAuth(`/api/enable-banking/accounts/${encodeURIComponent(providerAccountId)}/transactions`, {
            method: 'POST',
            body: JSON.stringify({
              applicationId: connection.applicationId,
              sessionId: connection.sessionId,
              dateFrom,
              continuationKey,
              strategy,
            }),
          }).then(res => res.json());

          const bookedTransactions = txResponse?.transactions?.booked || txResponse?.booked || txResponse?.transactions || [];
          bookedTransactions.forEach((providerTx: any) => {
            const mappedTx = mapEnableBankingTransaction(providerTx, {
              linkedAccountId,
              providerAccountId,
              currency,
              connectionId,
              accountDisplayName: accountName,
              ownerName: details?.owner_name || details?.ownerName || account?.owner_name,
              userIdentities,
              existingMerchantNames,
              linkedIbanToAccountName,
              ownAccountNumbers: identifiers.accountNumber ? [identifiers.accountNumber] : [],
            });
            if (mappedTx) importedTransactions.push(mappedTx);
          });

          const nextContinuationKey = txResponse?.continuation_key || txResponse?.continuationKey;
          if (!nextContinuationKey || seenPageKeys.has(nextContinuationKey)) { pageCapReached = false; break; }
          seenPageKeys.add(nextContinuationKey);
          continuationKey = nextContinuationKey;
        }

        if (pageCapReached) {
          // Not everything was fetched: keep the old checkpoint so the next sync resumes from there.
          truncatedAccountNames.push(updatedAccounts[updatedAccounts.length - 1].name);
          updatedAccounts[updatedAccounts.length - 1] = {
            ...updatedAccounts[updatedAccounts.length - 1],
            lastSyncedAt: existingLinkedAccount?.lastSyncedAt,
          };
        } else {
          updatedAccounts[updatedAccounts.length - 1] = {
            ...updatedAccounts[updatedAccounts.length - 1],
            lastSyncedAt: toLocalDateTimeString(new Date()),
          };
        }
      }

      if (importedTransactions.length > 0) {
        const existingTxMapCountId = new Map<string, Transaction>(transactions.map(tx => [tx.id, tx]));
        const existingTxMapSureId = new Map<string, Transaction>(
          transactions.filter(tx => tx.importId?.startsWith(`enable-banking-${connectionId}-`) && tx.sureId).map(tx => [tx.sureId as string, tx])
        );
        // Only used for transactions the bank gave no identifier for. Each stored transaction can be
        // matched at most once, so two genuine identical purchases are not collapsed into one.
        const fingerprintOf = (tx: Transaction) => `${tx.accountId}|${tx.date}|${tx.amount}|${(tx.description || '').trim().toLowerCase()}|${(tx.merchant || '').trim().toLowerCase()}`;
        const existingByFingerprint = new Map<string, Transaction[]>();
        for (const tx of transactions) {
          if (!tx.importId?.startsWith(`enable-banking-${connectionId}-`)) continue;
          const key = fingerprintOf(tx);
          const list = existingByFingerprint.get(key);
          if (list) list.push(tx); else existingByFingerprint.set(key, [tx]);
        }

        const deletedByAccount = deletedIdsByAccount(connection);
        const deduped: Transaction[] = [];
        const toUpdate: Transaction[] = [];
        const occurrencesOfFallbackId = new Map<string, number>();

        for (let candidate of importedTransactions) {
          const hasBankIdentifier = !!candidate.sureId && !candidate.sureId.startsWith('fallback-');
          if (!hasBankIdentifier) {
            // No bank id: the id is a hash of the fields, so identical rows collide. Number repeats within
            // the batch so each genuine row keeps its own stable id.
            const seen = occurrencesOfFallbackId.get(candidate.id) || 0;
            occurrencesOfFallbackId.set(candidate.id, seen + 1);
            if (seen > 0) candidate = { ...candidate, id: `${candidate.id}-${seen}`, sureId: candidate.sureId ? `${candidate.sureId}-${seen}` : candidate.sureId };
          }
          const tx = candidate;

          let existing = existingTxMapCountId.get(tx.id) || (tx.sureId ? existingTxMapSureId.get(tx.sureId) : undefined);
          if (!existing && !hasBankIdentifier) {
            const matches = existingByFingerprint.get(fingerprintOf(tx));
            existing = matches?.shift();
          }

          if (existing) {
            const filled = syncFill(existing, tx);
            if (filled) toUpdate.push(filled);
          } else if (tx.sureId && deletedByAccount.get(tx.accountId)?.has(tx.sureId)) {
            continue; // You deleted this one; the bank still lists it.
          } else {
            deduped.push(tx);
            existingTxMapCountId.set(tx.id, tx);
            if (tx.sureId) existingTxMapSureId.set(tx.sureId, tx);
          }
        }
        newTransactionCount = deduped.length;
        updatedTransactionCount = toUpdate.length;

        // Auto-populate brand domain logos for newly detected known merchants
        const brandUpdates: Record<string, string> = {};
        for (const tx of [...deduped, ...toUpdate]) {
          if (!tx.merchant) continue;
          const known = matchKnownBrand(tx.merchant);
          if (!known?.domain) continue;
          const logoKey = normalizeMerchantKey(tx.merchant);
          if (logoKey && !preferences.merchantRules?.[logoKey]?.logo) {
            brandUpdates[logoKey] = known.domain;
          }
        }
        if (Object.keys(brandUpdates).length > 0) {
          setPreferences(prev => {
            const nextRules = { ...(prev.merchantRules || {}) };
            for (const [logoKey, domain] of Object.entries(brandUpdates)) {
              if (!nextRules[logoKey]?.logo) {
                nextRules[logoKey] = { ...(nextRules[logoKey] || {}), logo: domain };
              }
            }
            return { ...prev, merchantRules: nextRules };
          });
        }

        if (deduped.length > 0) {
          handleSaveTransaction(deduped, [], { autoSpareChange: true, isNew: true });
        }

        if (toUpdate.length > 0) {
          handleSaveTransaction(toUpdate, [], { fromSync: true });
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

      setEnableBankingConnections(prev => prev.map(conn => conn.id === connectionId ? {
        ...conn,
        status: 'ready',
        sessionExpiresAt: session?.access?.valid_until || conn.sessionExpiresAt,
        accounts: updatedAccounts.map(account => ({
          ...account,
          deletedTransactionIds: matchExistingProviderAccount(conn.accounts || [], {
            uid: account.id,
            identificationHash: account.identificationHash,
            accountNumber: account.accountNumber,
          })?.deletedTransactionIds ?? account.deletedTransactionIds,
        })),
        lastSyncedAt: toLocalDateTimeString(new Date()),
      } : conn));
      const bankName = connection.selectedBank || 'your bank';
      if (truncatedAccountNames.length > 0) {
        toast.warning(`${bankName}: sync incomplete`, { description: `Very long history for ${truncatedAccountNames.join(', ')}. Sync again to fetch the rest.` });
      } else if (!syncOptions?.silent) {
        toast.success(`${bankName} synced`, {
          description: `${newTransactionCount} new transaction${newTransactionCount === 1 ? '' : 's'}${updatedTransactionCount ? `, ${updatedTransactionCount} updated` : ''}.`,
        });
      }
    } catch (error: any) {
      const rawMessage = error?.message || 'Sync failed';
      let cleanMessage = rawMessage;
      let requiresReauth = true;
      try {
        const parsed = JSON.parse(rawMessage);
        if (typeof parsed?.message === 'string') cleanMessage = parsed.message;
        if (typeof parsed?.requiresReauth === 'boolean') requiresReauth = parsed.requiresReauth;
      } catch { /* raw string message */ }
      setEnableBankingConnections(prev => prev.map(conn => conn.id === connectionId ? {
        ...conn,
        status: requiresReauth ? 'requires_update' : conn.status,
        lastError: cleanMessage,
      } : conn));
      toast.error(`${connection.selectedBank || 'Bank'} sync failed`, { description: cleanMessage.length > 160 ? cleanMessage.slice(0, 157) + '…' : cleanMessage });
    } finally {
      syncingConnectionIdsRef.current.delete(connectionId);
    }
  }, [accounts, enableBankingConnections, fetchWithAuth, handleSaveTransaction, isAuthenticated, preferences.merchantRules, transactions, user, demoUser]);

  const handleSyncAllEnableBankingConnections = useCallback(async () => {
    const activeConnections = enableBankingConnections.filter(c => c.sessionId && c.status !== 'pending');
    if (activeConnections.length === 0) {
      toast.info('No connected banks to sync yet', { description: 'Add a bank under Settings → Connections.' });
      return;
    }

    setIsSyncingBanks(true);
    try {
      for (const connection of activeConnections) {
        await handleSyncEnableBankingConnection(connection.id, connection, { transactionMode: 'incremental', silent: true });
      }
      toast.success(`Synced ${activeConnections.length} bank connection${activeConnections.length === 1 ? '' : 's'}`);
    } finally {
      setIsSyncingBanks(false);
    }
  }, [enableBankingConnections, handleSyncEnableBankingConnection]);

  const handleResetDeletedBankTransactions = useCallback((connectionId: string) => {
    setEnableBankingConnections(prev => clearDeleted(prev, connectionId));
    toast.success('Deleted transactions reset. The next sync can bring them back.');
  }, []);

  const handleDeleteEnableBankingConnection = useCallback((connectionId: string) => {
    const existing = enableBankingConnections.find(conn => conn.id === connectionId);
    if (existing?.sessionId) {
      fetchWithAuth(`/api/enable-banking/session/${encodeURIComponent(existing.sessionId)}`, {
        method: 'DELETE',
        body: JSON.stringify({ applicationId: existing.applicationId }),
      }).catch(() => { /* best-effort upstream consent revocation */ });
    }
    setEnableBankingConnections(prev => prev.filter(conn => conn.id !== connectionId));
    removePendingConnection(connectionId);
  }, [enableBankingConnections, fetchWithAuth]);

  const handleLinkEnableBankingAccount = useCallback((connectionId: string, providerAccountId: string, payload: EnableBankingLinkPayload) => {
    const connection = enableBankingConnections.find(conn => conn.id === connectionId);
    const providerAccount = connection?.accounts.find(a => a.id === providerAccountId);
    let finalLinkedAccountId: string | undefined = 'linkedAccountId' in payload ? payload.linkedAccountId : undefined;
    if ('newAccount' in payload) {
      const generatedId = `acc-${uuidv4()}`;
      handleSaveAccount({
        ...payload.newAccount,
        id: generatedId,
        accountNumber: providerAccount?.accountNumber || payload.newAccount.accountNumber,
        financialInstitution: connection?.selectedBank || providerAccount?.bankName || payload.newAccount.financialInstitution,
      });
      finalLinkedAccountId = generatedId;
    }
    if (!finalLinkedAccountId) return;
    setEnableBankingConnections(prev => prev.map(conn => {
      if (conn.id !== connectionId) return conn;
      return { ...conn, accounts: conn.accounts.map(a => a.id === providerAccountId ? { ...a, linkedAccountId: finalLinkedAccountId, syncStartDate: payload.syncStartDate } : a) };
    }));
  }, [enableBankingConnections, handleSaveAccount]);

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
  const handleDeleteImportedTransactions = (importId: string) => { const idsToDelete = transactions.filter(t => t.importId === importId).map(t => t.id); if (idsToDelete.length > 0) handleDeleteTransactions(idsToDelete, { resyncable: true }); };
  const handleResetAccount = async () => {
    if (!(user || isDemoMode)) return;
    allowEmptySaveRef.current = true;
    if (isDevEnvironment) {
      void clearDevCache();
    }
    loadAllFinancialData(emptyFinancialData);
    if (isDemoMode || !isAuthenticated) {
      toast.success('Data reset');
      return;
    }
    // loadAllFinancialData marks the new state as already saved, so persist it explicitly.
    const saved = await saveData(emptyFinancialData, { allowEmpty: true });
    if (saved) {
      allowEmptySaveRef.current = false;
      toast.success('All data has been reset');
    } else {
      // Keep allowEmpty armed and count everything as unsaved so the reset is retried.
      savedSlicesRef.current = {};
      setDirtySignal(signal => signal + 1);
      toast.error('Your data was cleared here but could not be reset on the server. It will be retried.');
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.classList.toggle('dark', isDark);
    safeLocalStorage.setItem('theme', theme);

    // Update meta theme-color for iOS / Android PWA status bar
    const metaThemeColor = document.getElementById('theme-color-meta');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', isDark ? '#020617' : '#f8fafc');
    }
  }, [theme]);

  const viewingAccount = useMemo(() => accounts.find(a => a.id === viewingAccountId), [accounts, viewingAccountId]);
  const viewingHolding = useMemo(() => holdingsOverview.holdings.find(h => h.symbol === viewingHoldingSymbol), [holdingsOverview, viewingHoldingSymbol]);
  const cashAccounts = useMemo(() => accounts.filter(a => a.type === 'Checking' || a.type === 'Savings'), [accounts]);

  const dismissedBillNotifications = useMemo(() => preferences.dismissedBillNotifications ?? [], [preferences.dismissedBillNotifications]);
  const {
    upcomingBillNotifications,
    notificationCount,
    dismissNotification,
    clearAllNotifications
  } = useBillNotifications({
    recurringTransactions,
    billsAndPayments,
    dismissedIds: dismissedBillNotifications,
    onDismiss: ids => setPreferences(prev => ({ ...prev, dismissedBillNotifications: [...(prev.dismissedBillNotifications ?? []), ...ids] })),
  });

  const handleNotificationProcessItem = useCallback((item: RecurringTransaction | BillPayment) => {
    const defaultAccount = cashAccounts[0] || accounts[0];
    const todayStr = toLocalISOString(new Date());

    if ('status' in item) {
      handleMarkBillAsPaid(item.id, item.accountId || defaultAccount?.id || '', todayStr);
      toast.success(`Marked bill "${item.description}" as paid!`);
    } else {
      handleSaveTransaction([{
        accountId: item.accountId || defaultAccount?.id || '',
        date: todayStr,
        description: item.description,
        amount: Math.abs(item.amount),
        category: item.category || 'Bills & Utilities',
        type: item.type === 'income' ? 'income' : 'expense',
        currency: item.currency || defaultAccount?.currency || 'EUR',
      }]);
      toast.success(`Recorded payment for "${item.description}"!`);
    }
  }, [accounts, cashAccounts, handleMarkBillAsPaid, handleSaveTransaction]);

  const linkedEnableBankingAccountIds = useMemo(() => new Set(enableBankingConnections.flatMap(c => (c.accounts || []).map(a => a.linkedAccountId).filter(Boolean))), [enableBankingConnections]);
  const enableBankingLinkMap = useMemo(() => {
    const map = new Map<string, { connection: EnableBankingConnection; account: EnableBankingAccount }>();
    enableBankingConnections.forEach(c => (c.accounts || []).forEach(a => { if (a.linkedAccountId) map.set(a.linkedAccountId, { connection: c, account: a }); }));
    return map;
  }, [enableBankingConnections]);

  useEffect(() => {
    if (isDataLoaded) {
      if (viewingAccountId && !viewingAccount) { toast.error('Account not found'); setViewingAccountId(null); setCurrentPage('Accounts'); }
      if (viewingHoldingSymbol && !viewingHolding) { toast.error('Holding not found'); setViewingHoldingSymbol(null); setCurrentPage('Investments'); }
    }
  }, [isDataLoaded, viewingAccount, viewingAccountId, viewingHolding, viewingHoldingSymbol, setCurrentPage]);

  const renderInvestments = (linkedSymbol?: string) => <InvestmentsPage accounts={accounts} cashAccounts={cashAccounts} investmentTransactions={investmentTransactions} saveInvestmentTransaction={handleSaveInvestmentTransaction} saveAccount={handleSaveAccount} deleteInvestmentTransaction={handleDeleteInvestmentTransaction} saveTransaction={handleSaveTransaction} warrants={warrants} saveWarrant={handleSaveWarrant} deleteWarrant={handleDeleteWarrant} manualPrices={manualWarrantPrices} onManualPriceChange={handleManualWarrantPrice} prices={assetPrices} onToggleAccountStatus={handleToggleAccountStatus} deleteAccount={handleDeleteAccount} transactions={transactions} onViewAccount={handleOpenAccountDetail} priceHistory={priceHistory} linkedSymbol={linkedSymbol} onCloseLinkedHolding={() => setCurrentPage('Investments')} />;

  const renderPage = () => {
    if (UiKit && window.location.search.includes('ui-kit')) return <UiKit />;
    if (viewingHoldingSymbol) {
      if (viewingHolding) return renderInvestments(viewingHoldingSymbol);
      return <PageLoader label="Loading holding..." />;
    }
    if (viewingAccountId) {
      if (viewingAccount) return <AccountDetail account={viewingAccount} setCurrentPage={setCurrentPage} setViewingAccountId={setViewingAccountId} onOpenAccount={handleOpenAccountDetail} saveAccount={handleSaveAccount} enableBankingLink={enableBankingLinkMap.get(viewingAccount.id)} onTriggerEnableBankingSync={handleSyncEnableBankingConnection} onCloseAsset={handleCloseAsset} onRevertClosure={handleRevertAccountClosure} />;
      return <PageLoader label="Loading account..." />;
    }
    switch (currentPage) {
      case 'Dashboard': return <Dashboard user={currentUser!} incomeCategories={incomeCategories} expenseCategories={expenseCategories} financialGoals={financialGoals} recurringTransactions={recurringTransactions} recurringTransactionOverrides={recurringTransactionOverrides} loanPaymentOverrides={loanPaymentOverrides} tasks={tasks} saveTask={handleSaveTask} setCurrentPage={setCurrentPage} onOpenAccount={handleOpenAccountDetail} onSyncBanks={handleSyncAllEnableBankingConnections} isSyncingBanks={isSyncingBanks} />;
      case 'Accounts': return <Accounts accounts={accounts} transactions={transactions} saveAccount={handleSaveAccount} deleteAccount={handleDeleteAccount} setCurrentPage={setCurrentPage} setViewingAccountId={setViewingAccountId} onViewAccount={handleOpenAccountDetail} saveTransaction={handleSaveTransaction} accountOrder={accountOrder} setAccountOrder={setAccountOrder} initialSortBy={preferences.defaultAccountOrder} warrants={warrants} onToggleAccountStatus={handleToggleAccountStatus} onNavigateToTransactions={navigateToTransactions} linkedEnableBankingAccountIds={linkedEnableBankingAccountIds} onSyncBanks={handleSyncAllEnableBankingConnections} isSyncingBanks={isSyncingBanks} />;
      case 'Transactions': return <Transactions user={currentUser!} initialAccountFilter={transactionsViewFilters.current.accountName ?? null} initialTagFilter={transactionsViewFilters.current.tagId ?? null} onClearInitialFilters={clearPendingTransactionFilters} onSyncBanks={handleSyncAllEnableBankingConnections} isSyncingBanks={isSyncingBanks} />;
      case 'Reports': return <ReportsPage setCurrentPage={setCurrentPage} />;
      case 'Budget': return <Budgeting />;
      case 'Forecasting': return <Forecasting />;
      case 'Goals': return <GoalsPage />;
      case 'Challenges': return <ChallengesPage userStats={userStats} accounts={accounts} transactions={transactions} predictions={predictions} savePrediction={handleSavePrediction} deletePrediction={handleDeletePrediction} saveUserStats={setUserStats} investmentTransactions={investmentTransactions} warrants={warrants} assetPrices={assetPrices} />;
      case 'Schedule & Bills': return <SchedulePage />;
      case 'Categories': return <CategoriesPage incomeCategories={incomeCategories} setIncomeCategories={setIncomeCategories} expenseCategories={expenseCategories} setExpenseCategories={setExpenseCategories} setCurrentPage={setCurrentPage} />;
      case 'Tags': return <TagsPage tags={tags} transactions={transactions} saveTag={handleSaveTag} deleteTag={handleDeleteTag} setCurrentPage={setCurrentPage} onNavigateToTransactions={navigateToTransactions} />;
      case 'Personal Info': return <PersonalInfoPage user={currentUser!} setUser={handleSetUser} onChangePassword={changePassword} setCurrentPage={setCurrentPage} lock={isAuthenticated && !isDemoMode ? { hasPin, fetcher: authorizedFetch, onChanged: setHasPin } : undefined} />;
      case 'Data Management': return <DataImportExportPage accounts={accounts} transactions={transactions} budgets={budgets} recurringTransactions={recurringTransactions} allCategories={[...incomeCategories, ...expenseCategories]} history={importExportHistory} onPublishImport={handlePublishImport} onDeleteHistoryItem={handleDeleteHistoryItem} onDeleteImportedTransactions={handleDeleteImportedTransactions} onResetAccount={handleResetAccount} setCurrentPage={setCurrentPage} onRestoreData={handleRestoreData} onLogExport={handleLogExport} fullFinancialData={dataToSave} />;
      case 'Preferences': return <PreferencesPage currenciesInUse={usedCurrencies} preferences={preferences} setPreferences={setPreferences} theme={theme} setTheme={setTheme} setCurrentPage={setCurrentPage} />;
      case 'EnableBankingCallback': return <EnableBankingCallbackPage connections={enableBankingConnections} setConnections={setEnableBankingConnections} onSync={handleSyncEnableBankingConnection} setCurrentPage={setCurrentPage} />;
      case 'Integrations': return <IntegrationsPage preferences={preferences} setPreferences={setPreferences} setCurrentPage={setCurrentPage} enableBankingConnections={enableBankingConnections} accounts={accounts} onCreateConnection={handleCreateEnableBankingConnection} onFetchBanks={handleFetchEnableBankingBanks} onDeleteConnection={handleDeleteEnableBankingConnection} onResetDeletedTransactions={handleResetDeletedBankTransactions} onLinkAccount={handleLinkEnableBankingAccount} onTriggerSync={handleSyncEnableBankingConnection} />;
      case 'Investments': return renderInvestments();
      case 'Tasks': return <TasksPage tasks={tasks} saveTask={handleSaveTask} deleteTask={handleDeleteTask} taskOrder={taskOrder} setTaskOrder={setTaskOrder} />;
      case 'Documentation': return <Documentation setCurrentPage={setCurrentPage} />;
      case 'Subscriptions': return <SubscriptionsPage />;
      case 'Quotes & Invoices': return <InvoicesPage />;
      case 'Merchants': return <MerchantsPage setCurrentPage={setCurrentPage} />;
      case 'Rules': return <RulesPage preferences={preferences} setPreferences={setPreferences} transactions={transactions} saveTransaction={handleSaveTransaction} incomeCategories={incomeCategories} expenseCategories={expenseCategories} setCurrentPage={setCurrentPage} />;
      default: return <div>Page not found</div>;
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsShortcutsModalOpen(false);
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
  const goalsContextValue = useMemo(() => ({
    financialGoals,
    goalOrder,
    saveFinancialGoal: handleSaveFinancialGoal,
    deleteFinancialGoal: handleDeleteFinancialGoal,
    setGoalOrder: (order: string[]) => {
      setGoalOrderState(order);
      markSliceDirty('goalOrder');
    }
  }), [financialGoals, goalOrder, handleDeleteFinancialGoal, handleSaveFinancialGoal, markSliceDirty]);
  const scheduleContextValue = useMemo(() => ({ recurringTransactions, recurringTransactionOverrides, loanPaymentOverrides, billsAndPayments, memberships, saveRecurringTransaction: handleSaveRecurringTransaction, deleteRecurringTransaction: handleDeleteRecurringTransaction, saveRecurringOverride: handleSaveRecurringOverride, deleteRecurringOverride: handleDeleteRecurringOverride, saveLoanPaymentOverrides: handleSaveLoanPaymentOverrides, saveBillPayment: handleSaveBillPayment, deleteBillPayment: handleDeleteBillPayment, markBillAsPaid: handleMarkBillAsPaid, saveMembership: handleSaveMembership, deleteMembership: handleDeleteMembership, }), [billsAndPayments, memberships, handleDeleteBillPayment, handleDeleteRecurringOverride, handleDeleteRecurringTransaction, handleMarkBillAsPaid, handleSaveBillPayment, handleSaveLoanPaymentOverrides, handleSaveRecurringOverride, handleSaveRecurringTransaction, loanPaymentOverrides, recurringTransactionOverrides, recurringTransactions,]);

  if (isLocked && user) {
    return (
      <LockScreen
        user={user}
        fetcher={authorizedFetch}
        onUnlocked={() => window.location.reload()}
        onSignOut={() => { void authorizedFetch('/api/auth/logout', { method: 'POST' }).finally(() => window.location.reload()); }}
      />
    );
  }

  if (isAuthLoading || !isDataLoaded) return <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 dark:from-black dark:to-[#171717]"><svg className="animate-spin h-10 w-10 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>;

  if (!isAuthenticated && !isDemoMode) {
    return <Suspense fallback={<PageLoader label="Preparing sign-in experience..." />}>{authPage === 'signIn' ? <SignIn onSignIn={handleSignIn} onNavigateToSignUp={() => setAuthPage('signUp')} onEnterDemoMode={handleEnterDemoMode} isLoading={isAuthLoading} error={authError} /> : <SignUp onSignUp={handleSignUp} onNavigateToSignIn={() => setAuthPage('signIn')} isLoading={isAuthLoading} error={authError} />}</Suspense>;
  }

  if (!currentUser) return <PageLoader label="Loading user profile..." />;

  const shellProps: ShellProps = {
    onLock: isAuthenticated && !isDemoMode ? () => { if (hasPin) void handleLock(); else { toast.info('Set a PIN first'); setCurrentPage('Personal Info'); } } : undefined,
    currentPage,
    setCurrentPage,
    user: currentUser,
    theme,
    setTheme,
    isPrivacyMode,
    togglePrivacyMode: () => setIsPrivacyMode(!isPrivacyMode),
    isSyncing: isSyncingBanks,
    onSync: handleSyncAllEnableBankingConnections,
    onSearch: () => {
      setIsShortcutsModalOpen(false);
      setIsCommandCenterOpen(true);
    },
    onCreate: () => {
      setIsShortcutsModalOpen(false);
      setIsQuickAddTxModalOpen(true);
    },
    onLogout: handleLogout,
    notifications: (
      <NotificationCenter
        notifications={upcomingBillNotifications}
        notificationCount={notificationCount}
        onDismiss={dismissNotification}
        onClearAll={clearAllNotifications}
        onProcessItem={handleNotificationProcessItem}
        setCurrentPage={setCurrentPage}
      />
    ),
  };

  return (
    <FinancialDataProvider categories={categoryContextValue} tags={tagsContextValue} budgets={budgetsContextValue} goals={goalsContextValue} schedule={scheduleContextValue} preferences={preferencesContextValue} accounts={accountsContextValue} transactions={transactionsContextValue} warrants={warrantsContextValue} invoices={invoicesContextValue} >
      <InsightsViewProvider accounts={accounts} financialGoals={financialGoals} defaultDuration={preferences.defaultPeriod} preferences={preferences} setPreferences={setPreferences}>
        <PrivacyContext.Provider value={isPrivacyMode}>
        <ReviewProvider>
        <Toaster
          position="bottom-center"
          duration={5000}
          closeButton
          offset={{ bottom: 'var(--toast-bottom)' }}
          mobileOffset={{ bottom: 'var(--toast-phone-bottom)', left: '16px', right: '16px' }}
          style={{ '--normal-bg': 'var(--solid)', '--normal-border': 'var(--line)', '--normal-text': 'var(--ink)', '--border-radius': 'var(--radius-lg)' } as React.CSSProperties}
        />
        <div className={`flex h-dvh text-ink font-sans ${isPrivacyMode ? 'privacy-mode' : ''}`}>
          <SkipLink />
          {!isPhone && <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />}
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="safe-top shrink-0">
              {isPhone ? (
                <>
                  <PhoneTopBar {...shellProps} />
                  <TabRow currentPage={currentPage} setCurrentPage={setCurrentPage} />
                </>
              ) : (
                <TopBar {...shellProps} />
              )}
            </header>
            {!isPhone && <ToolRail {...shellProps} />}
            <main className="relative min-h-0 flex-1 overflow-y-auto scroll-touch focus:outline-none" id="main-content" tabIndex={-1}>
              <div className="mx-auto w-full max-w-[1488px] px-4 pb-[calc(96px+env(safe-area-inset-bottom,0px))] pt-4 md:pb-24 md:px-6 md:pt-6 lg:px-8 lg:pt-8">
                <ErrorBoundary resetKey={`${currentPage}|${viewingAccountId || ''}|${viewingHoldingSymbol || ''}`}>
                  {ratelessCurrencies.length > 0 && (
                    <Banner tone="attention" className="mb-4" actionLabel="Add a rate" onAction={() => setCurrentPage('Preferences')}>
                      Totals leave out {ratelessCurrencies.join(', ')}, which {ratelessCurrencies.length === 1 ? 'has' : 'have'} no exchange rate.
                    </Banner>
                  )}
                  <Suspense key={getMainCurrency()} fallback={<PageSkeleton variant={currentPage === 'Dashboard' ? 'dashboard' : ['Accounts', 'Investments', 'Budget', 'Categories'].includes(currentPage) ? 'grid' : (viewingAccountId || viewingHoldingSymbol) ? 'detail' : 'list'} />}>
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentPage + (viewingAccountId || '') + (viewingHoldingSymbol || '')}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15, ease: 'easeInOut' }}
                      >
                        {renderPage()}
                      </motion.div>
                    </AnimatePresence>
                  </Suspense>
                </ErrorBoundary>
              </div>
            </main>
            {isPhone && <PhoneBar {...shellProps} />}
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
          <KeyboardShortcutsModal
            isOpen={isShortcutsModalOpen}
            onClose={() => setIsShortcutsModalOpen(false)}
          />
          {isQuickAddTxModalOpen && (
            <Suspense fallback={null}>
              <AddTransactionModal
                onClose={() => setIsQuickAddTxModalOpen(false)}
                onSave={(txs) => { handleSaveTransaction(txs); setIsQuickAddTxModalOpen(false); }}
                accounts={accounts}
                incomeCategories={incomeCategories}
                expenseCategories={expenseCategories}
                transactions={transactions}
                tags={tags}
                userProfile={currentUser!}
              />
            </Suspense>
          )}
        </div>
        </ReviewProvider>
        </PrivacyContext.Provider>
      </InsightsViewProvider>
    </FinancialDataProvider>
  );
};

export default App;
