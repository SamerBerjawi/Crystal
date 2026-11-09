import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy, useRef, Component, ErrorInfo, startTransition } from 'react';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import CommandCenter from './components/CommandCenter';
import PageSkeleton from './components/PageSkeleton';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import { useIsMobile } from './hooks/useIsMobile';
import { PrivacyContext } from './components/ui/Money';
import { ReviewProvider } from './contexts/ReviewContext';
import { applyAppFont } from './hooks/useFont';
import { pageRegistry, useAppRouter } from './hooks/useAppRouter';
import { hasMaterialData, readLocalDevSnapshot, useFinancialPersistence } from './hooks/useFinancialPersistence';
import { PERSISTED_SLICE_KEYS, type PersistedSliceKey } from './utils/sliceRegistry';
import { useDomainCrudHandlers } from './hooks/useDomainCrudHandlers';
import { useEnableBankingSync } from './hooks/useEnableBankingSync';
import { lazyWithRetry } from './utils/lazyWithRetry';

const SignIn = lazyWithRetry(() => import('./pages/SignIn'));
const SignUp = lazyWithRetry(() => import('./pages/SignUp'));
const Dashboard = lazyWithRetry(pageRegistry.Dashboard.loader);
const Accounts = lazyWithRetry(pageRegistry.Accounts.loader);
const Transactions = lazyWithRetry(pageRegistry.Transactions.loader);
const ReportsPage = lazyWithRetry(pageRegistry.Reports.loader);
const Budgeting = lazyWithRetry(pageRegistry.Budget.loader);
const Forecasting = lazyWithRetry(pageRegistry.Forecasting.loader);
const GoalsPage = lazyWithRetry(pageRegistry.Goals.loader);
const ChallengesPage = lazyWithRetry(pageRegistry.Challenges.loader);
const WrappedPage = lazyWithRetry(pageRegistry.Wrapped.loader);
const SchedulePage = lazyWithRetry(pageRegistry['Schedule & Bills'].loader);
const CategoriesPage = lazyWithRetry(pageRegistry.Categories.loader);
const TagsPage = lazyWithRetry(pageRegistry.Tags.loader);
const PersonalInfoPage = lazyWithRetry(pageRegistry['Personal Info'].loader);
const DataImportExportPage = lazyWithRetry(pageRegistry['Data Management'].loader);
const PreferencesPage = lazyWithRetry(pageRegistry.Preferences.loader);
const IntegrationsPage = lazyWithRetry(pageRegistry.Integrations.loader);
const AccountDetail = lazyWithRetry(pageRegistry.AccountDetail.loader);
const EnableBankingCallbackPage = lazyWithRetry(pageRegistry.EnableBankingCallback.loader);
const InvestmentsPage = lazyWithRetry(pageRegistry.Investments.loader);
const TasksPage = lazyWithRetry(pageRegistry.Tasks.loader);
const Documentation = lazyWithRetry(pageRegistry.Documentation.loader);
const SubscriptionsPage = lazyWithRetry(pageRegistry.Subscriptions.loader);
const InvoicesPage = lazyWithRetry(pageRegistry['Quotes & Invoices'].loader);
const MerchantsPage = lazyWithRetry(pageRegistry.Merchants.loader);
const RulesPage = lazyWithRetry(pageRegistry.Rules.loader);

import { Theme, Category, User, Transaction, Account, RecurringTransaction, RecurringTransactionOverride, FinancialGoal, Budget, ImportExportHistoryItem, AppPreferences, InvestmentTransaction, Task, Warrant, FinancialData, BillPayment, Tag, LoanPaymentOverrides, Membership, Invoice, UserStats, Prediction, PriceHistoryEntry, EnableBankingConnection } from './types';
import { MOCK_INCOME_CATEGORIES, MOCK_EXPENSE_CATEGORIES } from './constants';
import { createDemoUser, emptyFinancialData, defaultPreferences } from './demoData';
import { v4 as uuidv4 } from 'uuid';
import { linkBudgetsToCategories } from './utils/budgetModel';
import { missingRates, setMainCurrency, convertToMain, updateConversionRates, parseLocalDate, toLocalISOString, getMainCurrency } from './utils';
import { buildHoldingsOverview } from './utils/investments';
import { normalizeLoanAssetLinks } from './utils/accountLinks';
import { useAuth } from './hooks/useAuth';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useBillNotifications } from './hooks/useBillNotifications';
import { moveLocalChoices, reconcileActiveGoals } from './utils/syncedChoices';
import { updateActivityStreak } from './utils/challengesModel';
import LockScreen from './components/LockScreen';
import { Banner, Spinner } from './components/ui/States';
import { useIdleLock } from './hooks/useIdleLock';
import { DEFAULT_AUTO_LOCK_MINUTES } from './utils/lockModel';
import { migrateRules } from './utils/rulesMigration';
import NotificationCenter from './components/NotificationCenter';
const OnboardingModal = lazyWithRetry(() => import('./components/OnboardingModal'));
const AddTransactionModal = lazyWithRetry(() => import('./components/AddTransactionModal'));
import { FinancialDataProvider } from './contexts/FinancialDataContext';
import { InsightsViewProvider } from './contexts/InsightsViewContext';
import { PhoneBar, PhoneTopBar, Sidebar, SkipLink, TabRow, ToolRail, TopBar, type ShellProps } from './components/ui/Shell';
import { fetchAllExchangeRates } from './src/services/twelveDataService';
import { fetchEcbRates } from './src/services/exchangeRates';
import { currenciesInUse } from './utils/currencies';
import { saveDevCache, loadDevCache, clearDevCache } from './utils/browserCache';
import { warnIgnored } from './utils/logging';
import { startPrivacyMask } from './utils/privacyMask';

const LOCK_CHANNEL = 'crystal-lock';

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
  <div className="flex items-center justify-center py-10 text-primary" role="status" aria-live="polite">
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
          <div className="surface-card rounded-[var(--radius-xl)] p-6 max-w-lg w-full border border-line shadow-lg">
            <h1 className="type-card-title text-ink mb-2">Something went wrong</h1>
            <p className="type-body text-muted mb-4">
              {this.state.message || 'An unexpected error occurred while rendering this page.'}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-full bg-primary text-on-primary text-sm font-bold hover:bg-primary-hover transition cursor-pointer"
                onClick={() => this.setState({ hasError: false, message: undefined })}
              >
                Try again
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-full bg-inset text-ink text-sm font-bold hover:opacity-85 transition cursor-pointer"
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
  const { isLocked, lockedOnLoadRef, user, setUser, isAuthenticated, isLoading: isAuthLoading, error: authError, signIn, signUp, signOut, checkAuthStatus, setError: setAuthError, changePassword, authorizedFetch } = useAuth();
  const [authPage, setAuthPage] = useState<'signIn' | 'signUp'>('signIn');
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const isDev = Boolean((import.meta as any)?.env?.DEV);
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
      const isDev = Boolean((import.meta as any)?.env?.DEV);
      if (isDev && safeLocalStorage.getItem('crystal_dev_mode_active') === 'true') {
        const parsed = readLocalDevSnapshot({ isDevEnvironment: isDev, isDemoMode: true, isAuthenticated: false });
        if (parsed?.userProfile) return parsed.userProfile;
        return createDemoUser();
      }
    }
    return null;
  });
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);

  const isPhone = useIsMobile();
  const {
    currentPage,
    setCurrentPage,
    viewingAccountId,
    setViewingAccountId,
    viewingHoldingSymbol,
    setViewingHoldingSymbol,
    handleOpenAccountDetail,
    transactionsViewFilters,
    navigateToTransactions,
    clearPendingTransactionFilters,
    pageSwipe,
  } = useAppRouter(isAuthenticated, isDataLoaded);

  const [theme, setTheme] = useState<Theme>(() => {
    const storedTheme = safeLocalStorage.getItem('theme');
    return storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system' ? storedTheme : 'system';
  });

  const [preferences, setPreferences] = useState<AppPreferences>(emptyFinancialData.preferences);
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
    isShortcutsModalOpen,
    onLock: hasPin ? () => {
      setIsShortcutsModalOpen(false);
      lockRef.current();
    } : undefined,
    onTogglePrivacyMode: () => setIsPrivacyMode(prev => !prev),
    isDisabled: (!isAuthenticated && !isDemoMode) || isLocked || !isDataLoaded,
  });

  const latestDataRef = useRef<FinancialData>(emptyFinancialData);
  const lastUpdatedAtRef = useRef<string | null>(null);
  const restoreInProgressRef = useRef(false);
  const allowEmptySaveRef = useRef(false);
  const savedSlicesRef = useRef<Partial<Record<keyof FinancialData, unknown>>>({});
  const baselinePendingRef = useRef(true);
  const [loadGeneration, setLoadGeneration] = useState(0);
  const [accountOrder, setAccountOrder] = useLocalStorage<string[]>('crystal-account-order', []);
  const [taskOrder, setTaskOrder] = useLocalStorage<string[]>('crystal-task-order', []);
  const [goalOrder, setGoalOrderState] = useState<string[]>(emptyFinancialData.goalOrder || []);
  const streakUpdatedRef = useRef(false);
  const [manualWarrantPrices, setManualWarrantPrices] = useState<Record<string, number | undefined>>(emptyFinancialData.manualWarrantPrices || {});
  const [priceHistory, setPriceHistory] = useState<Record<string, PriceHistoryEntry[]>>(emptyFinancialData.priceHistory || {});
  const [, setLastUpdated] = useState<Date | null>(null);

  const isJustLoadedRef = useRef(true);
  useEffect(() => {
    if (isDataLoaded) {
      isJustLoadedRef.current = true;
      const timer = setTimeout(() => { isJustLoadedRef.current = false; }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isDataLoaded]);

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

  const isDevEnvironment = import.meta.env.DEV;

  const loadAllFinancialData = useCallback((data: FinancialData | null, _options?: { skipNextSave?: boolean }) => {
    const dataToLoad = data ?? emptyFinancialData;
    const loadedPrefs = migrateRules({
      ...defaultPreferences,
      ...(dataToLoad.preferences || {}),
    }, dataToLoad.transactions || [], new Date().toISOString());

    const deviceTimezone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'local';
    const reconciledGoals = reconcileActiveGoals(
      dataToLoad.financialGoals || [],
      loadedPrefs.activeGoalIds,
      loadedPrefs.knownGoalIds
    );
    const finalPrefs = {
      ...loadedPrefs,
      timezone: loadedPrefs.timezone || deviceTimezone,
      ...reconciledGoals,
    };

    lastUpdatedAtRef.current = dataToLoad.lastUpdatedAt ?? null;
    baselinePendingRef.current = true;

    startTransition(() => {
      const loadedWarrantIsins = new Set((dataToLoad.warrants || []).map(w => w.isin?.toUpperCase()).filter(Boolean));
      const tradedSymbols = new Set((dataToLoad.investmentTransactions || []).map(t => t.symbol?.toUpperCase()).filter(Boolean));
      const migratedAccounts = (dataToLoad.accounts || []).map(acc => {
        const sym = acc.symbol?.toUpperCase();
        if (acc.type === 'Investment' && acc.subType === 'ETF' && sym && loadedWarrantIsins.has(sym) && !tradedSymbols.has(sym)) {
          return { ...acc, subType: 'Warrant' as const };
        }
        return acc;
      });
      const loadedExpenseCats = dataToLoad.expenseCategories && dataToLoad.expenseCategories.length > 0 ? dataToLoad.expenseCategories : MOCK_EXPENSE_CATEGORIES;
      const loadedIncomeCats = dataToLoad.incomeCategories && dataToLoad.incomeCategories.length > 0 ? dataToLoad.incomeCategories : MOCK_INCOME_CATEGORIES;
      const linkedBudgets = linkBudgetsToCategories(dataToLoad.budgets || [], loadedExpenseCats);

      const todayStr = toLocalISOString(new Date());
      const rawStats = dataToLoad.userStats || emptyFinancialData.userStats!;
      const normalizedStats = updateActivityStreak(rawStats, todayStr);

      setAccounts(normalizeLoanAssetLinks(migratedAccounts));
      setTransactions(dataToLoad.transactions || []);
      setInvestmentTransactions(dataToLoad.investmentTransactions || []);
      setRecurringTransactions(dataToLoad.recurringTransactions || []);
      setRecurringTransactionOverrides(dataToLoad.recurringTransactionOverrides || []);
      setLoanPaymentOverrides(dataToLoad.loanPaymentOverrides || {});
      setFinancialGoals(dataToLoad.financialGoals || []);
      setBudgets(linkedBudgets);
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
      setIncomeCategories(loadedIncomeCats);
      setExpenseCategories(loadedExpenseCats);
      setUserStats(normalizedStats);
      streakUpdatedRef.current = true;
      setEnableBankingConnections(dataToLoad.enableBankingConnections || []);
      setPreferences(finalPrefs);
      if (finalPrefs.conversionRates) {
        updateConversionRates(finalPrefs.conversionRates);
      }
      setAccountOrder(dataToLoad.accountOrder || []);
      setTaskOrder(dataToLoad.taskOrder || []);
      setGoalOrderState(dataToLoad.goalOrder || []);
      setLoadGeneration(generation => generation + 1);
      setIsDataLoaded(true);
    });
    latestDataRef.current = dataToLoad;
  }, [setAccountOrder, setTaskOrder]);

  const {
    syncStatus,
    setDirtySignal,
    markSliceDirty,
    getDirtyKeys,
    saveData,
    savePartialData,
    savePartialDataWithRetry,
  } = useFinancialPersistence({
    isAuthenticated,
    isDemoMode,
    isDataLoaded,
    isDevEnvironment,
    dataToSave,
    authorizedFetch,
    loadAllFinancialData,
    latestDataRef,
    lastUpdatedAtRef,
    restoreInProgressRef,
    allowEmptySaveRef,
    savedSlicesRef,
    baselinePendingRef,
    loadGeneration,
  });

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

  useEffect(() => {
    if (isPrivacyMode) { document.body.classList.add('privacy-mode'); }
    else { document.body.classList.remove('privacy-mode'); }
    return isPrivacyMode ? startPrivacyMask() : undefined;
  }, [isPrivacyMode]);

  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useLocalStorage('crystal-onboarding-complete', false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  useEffect(() => {
    const deviceTimezone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'local';
    if (!preferences.timezone) {
      setPreferences(prev => ({ ...prev, timezone: deviceTimezone }));
    }
  }, [preferences.timezone]);

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
    if (!isDataLoaded) return;
    setAccounts(prevAccounts => {
      let hasChanges = false;
      const updatedAccounts = prevAccounts.map(account => {
        if (account.symbol && account.type === 'Investment' && (assetPrices as Record<string, number | null>)[account.symbol] !== undefined) {
          const price = (assetPrices as Record<string, number | null>)[account.symbol as string];
          if (typeof price !== 'number') return account;
          const quantity = ((warrantHoldingsBySymbol as Record<string, number>)[account.symbol as string] as number) || 0;
          const calculatedBalance = quantity * price;
          if (Math.abs((account.balance || 0) - calculatedBalance) > 0.0001) {
            hasChanges = true;
            return { ...account, balance: calculatedBalance };
          }
        }
        return account;
      });
      return hasChanges ? updatedAccounts : prevAccounts;
    });
  }, [assetPrices, isDataLoaded, warrantHoldingsBySymbol]);

  const usedCurrencies = useMemo(
    () => currenciesInUse(accounts, transactions, budgets, financialGoals, recurringTransactions, billsAndPayments),
    [accounts, transactions, budgets, financialGoals, recurringTransactions, billsAndPayments],
  );
  const ratelessCurrencies = useMemo(() => missingRates(usedCurrencies, preferences.conversionRates), [usedCurrencies, preferences.conversionRates, preferences.currency]);

  const hasMovedLocalChoices = useRef(false);
  useEffect(() => {
    if (!isDataLoaded || hasMovedLocalChoices.current) return;
    hasMovedLocalChoices.current = true;
    const moved = moveLocalChoices(preferences, window.localStorage);
    if (moved.hasChanged) setPreferences(moved.preferences);
  }, [isDataLoaded, preferences]);

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

    fetchRates();

    const interval = setInterval(fetchRates, 4 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [preferences.twelveDataApiKey, isDataLoaded, markSliceDirty, usedCurrencies]);

  useEffect(() => {
    if (isAuthenticated && isDemoMode) {
      setIsDemoMode(false);
      safeLocalStorage.removeItem('crystal_dev_mode_active');
    }
  }, [isAuthenticated, isDemoMode]);

  const handleEnterDemoMode = async () => {
    if (isDevEnvironment) {
      try {
        const cached = await loadDevCache({ isDevEnvironment, isDemoMode: true, isAuthenticated: false });
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

      if (lockedOnLoadRef.current) return;

      if (data) {
        setIsDemoMode(false);
        safeLocalStorage.removeItem('crystal_dev_mode_active');
        loadAllFinancialData(data, { skipNextSave: true });
        return;
      }

      if (isDevEnvironment) {
        try {
          const cached = await loadDevCache({ isDevEnvironment, isDemoMode: true, isAuthenticated: false });
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

      if (isDevEnvironment && safeLocalStorage.getItem('crystal_dev_mode_active') === 'true') {
        setDemoUser(createDemoUser());
        setIsDemoMode(true);
        const { initialFinancialData: demoSeed } = await import('./demoSeed');
        loadAllFinancialData(demoSeed);
      }
      setIsDataLoaded(true);
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

  useEffect(() => { if (!isDataLoaded || baselinePendingRef.current || restoreInProgressRef.current) return; markSliceDirty('accounts'); }, [accounts, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || baselinePendingRef.current || restoreInProgressRef.current) return; markSliceDirty('transactions'); }, [transactions, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || baselinePendingRef.current || restoreInProgressRef.current) return; markSliceDirty('investmentTransactions'); }, [investmentTransactions, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || baselinePendingRef.current || restoreInProgressRef.current) return; markSliceDirty('recurringTransactions'); }, [recurringTransactions, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || baselinePendingRef.current || restoreInProgressRef.current) return; markSliceDirty('recurringTransactionOverrides'); }, [recurringTransactionOverrides, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || baselinePendingRef.current || restoreInProgressRef.current) return; markSliceDirty('loanPaymentOverrides'); }, [loanPaymentOverrides, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || baselinePendingRef.current || restoreInProgressRef.current) return; markSliceDirty('financialGoals'); }, [financialGoals, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || baselinePendingRef.current || restoreInProgressRef.current) return; markSliceDirty('budgets'); }, [budgets, isDataLoaded, markSliceDirty]);
  useEffect(() => {
    if (!isDataLoaded || baselinePendingRef.current || restoreInProgressRef.current) return;
    setBudgets(prev => linkBudgetsToCategories(prev, expenseCategories));
  }, [expenseCategories, isDataLoaded]);
  useEffect(() => { if (!isDataLoaded || baselinePendingRef.current || restoreInProgressRef.current) return; markSliceDirty('tasks'); }, [tasks, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || baselinePendingRef.current || restoreInProgressRef.current) return; markSliceDirty('warrants'); }, [warrants, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || baselinePendingRef.current || restoreInProgressRef.current) return; markSliceDirty('memberships'); }, [memberships, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || baselinePendingRef.current || restoreInProgressRef.current) return; markSliceDirty('manualWarrantPrices'); }, [manualWarrantPrices, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || baselinePendingRef.current || restoreInProgressRef.current) return; markSliceDirty('priceHistory'); }, [priceHistory, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || baselinePendingRef.current || restoreInProgressRef.current) return; markSliceDirty('importExportHistory'); }, [importExportHistory, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || baselinePendingRef.current || restoreInProgressRef.current) return; markSliceDirty('incomeCategories'); }, [incomeCategories, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || baselinePendingRef.current || restoreInProgressRef.current) return; markSliceDirty('expenseCategories'); }, [expenseCategories, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || baselinePendingRef.current || restoreInProgressRef.current) return; markSliceDirty('preferences'); }, [preferences, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || baselinePendingRef.current || restoreInProgressRef.current) return; markSliceDirty('billsAndPayments'); }, [billsAndPayments, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || baselinePendingRef.current || restoreInProgressRef.current) return; markSliceDirty('accountOrder'); }, [accountOrder, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || baselinePendingRef.current || restoreInProgressRef.current) return; markSliceDirty('taskOrder'); }, [taskOrder, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || baselinePendingRef.current || restoreInProgressRef.current) return; markSliceDirty('tags'); }, [tags, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || baselinePendingRef.current || restoreInProgressRef.current) return; markSliceDirty('invoices'); }, [invoices, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || baselinePendingRef.current || restoreInProgressRef.current) return; markSliceDirty('userStats'); }, [userStats, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || baselinePendingRef.current || restoreInProgressRef.current) return; markSliceDirty('predictions'); }, [predictions, isDataLoaded, markSliceDirty]);
  useEffect(() => { if (!isDataLoaded || baselinePendingRef.current || restoreInProgressRef.current) return; markSliceDirty('enableBankingConnections'); }, [enableBankingConnections, isDataLoaded, markSliceDirty]);

  const handleRestoreData = useCallback((data: FinancialData) => {
    restoreInProgressRef.current = true;

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

    const updatedHistory = [historyItem, ...(data.importExportHistory || [])];
    const dataWithHistory = { ...data, importExportHistory: updatedHistory };

    if (data.userProfile) { handleSetUser(data.userProfile); }
    loadAllFinancialData(dataWithHistory);

    if (isDevEnvironment && !isAuthenticated) {
      void saveDevCache(dataWithHistory, { isDevEnvironment, isDemoMode: true, isAuthenticated: false });
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
            savedSlicesRef.current = {};
            toast.error('The restored data could not be saved to the server yet. It will be retried.');
          }
        })
        .catch(console.error)
        .finally(() => { restoreInProgressRef.current = false; setDirtySignal(signal => signal + 1); });
    } else {
      restoreInProgressRef.current = false;
    }
  }, [demoUser, handleSetUser, isAuthenticated, isDemoMode, isDevEnvironment, loadAllFinancialData, saveData, setDirtySignal]);

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
  }, [signOut, loadAllFinancialData, setHasCompletedOnboarding, isDevEnvironment]);

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

  const {
    transactionsRef,
    handleSaveAccount,
    handleToggleAccountStatus,
    handleCloseAsset,
    handleRevertAccountClosure,
    handleDeleteAccount,
    handleSaveTransaction,
    handleDeleteTransactions,
    handleSaveInvestmentTransaction,
    handleDeleteInvestmentTransaction,
    handleSaveRecurringTransaction,
    handleDeleteRecurringTransaction,
    handleSaveLoanPaymentOverrides,
    handleSaveRecurringOverride,
    handleDeleteRecurringOverride,
    handleSaveFinancialGoal,
    handleDeleteFinancialGoal,
    handleSetGoalOrder,
    handleSaveBudget,
    handleDeleteBudget,
    handleSaveTask,
    handleDeleteTask,
    handleSaveWarrant,
    handleDeleteWarrant,
    handleManualWarrantPrice,
    handleSaveTag,
    handleDeleteTag,
    handleSaveBillPayment,
    handleDeleteBillPayment,
    handleMarkBillAsPaid,
    handleSaveMembership,
    handleDeleteMembership,
    handleSaveInvoice,
    handleDeleteInvoice,
    handleSavePrediction,
    handleDeletePrediction,
    handleRenameCategory,
    handleDeleteCategoryCascade,
    handlePublishImport,
    handleLogExport,
    handleDeleteHistoryItem,
    handleDeleteImportedTransactions,
  } = useDomainCrudHandlers({
    accounts,
    setAccounts,
    transactions,
    setTransactions,
    investmentTransactions,
    setInvestmentTransactions,
    recurringTransactions,
    setRecurringTransactions,
    setRecurringTransactionOverrides,
    setLoanPaymentOverrides,
    setFinancialGoals,
    setGoalOrderState,
    budgets,
    setBudgets,
    tasks,
    setTasks,
    warrants,
    setWarrants,
    setManualWarrantPrices,
    setPriceHistory,
    setLastUpdated,
    assetPrices,
    setTags,
    billsAndPayments,
    setBillsAndPayments,
    setMemberships,
    setInvoices,
    setPredictions,
    incomeCategories,
    setIncomeCategories,
    expenseCategories,
    setExpenseCategories,
    preferences,
    setPreferences,
    setEnableBankingConnections,
    setImportExportHistory,
    setUserStats,
    viewingAccountId,
    setViewingAccountId,
    viewingHoldingSymbol,
    setViewingHoldingSymbol,
    setCurrentPage,
    transactionsViewFilters,
    markSliceDirty,
  });

  const {
    isSyncingBanks,
    handleFetchEnableBankingBanks,
    handleCreateEnableBankingConnection,
    handleSyncEnableBankingConnection,
    handleSyncAllEnableBankingConnections,
    handleResetDeletedBankTransactions,
    handleDeleteEnableBankingConnection,
    handleLinkEnableBankingAccount,
    linkedEnableBankingAccountIds,
    enableBankingLinkMap,
  } = useEnableBankingSync({
    isAuthenticated,
    isDataLoaded,
    isDemoMode,
    user,
    demoUser,
    accounts,
    setAccounts,
    transactionsRef,
    preferences,
    setPreferences,
    enableBankingConnections,
    setEnableBankingConnections,
    authorizedFetch,
    savePartialDataWithRetry,
    handleSaveAccount,
    handleSaveTransaction,
    setCurrentPage,
  });

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
    const saved = await saveData(emptyFinancialData, { allowEmpty: true });
    if (saved) {
      allowEmptySaveRef.current = false;
      toast.success('All data has been reset');
    } else {
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

    const metaThemeColor = document.getElementById('theme-color-meta');
    if (metaThemeColor) {
      const canvas = getComputedStyle(root).getPropertyValue('--canvas').trim();
      metaThemeColor.setAttribute('content', canvas || (isDark ? '#100F0C' : '#EBE8E1'));
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
    tasks,
    dismissedIds: dismissedBillNotifications,
    onDismiss: ids => setPreferences(prev => ({ ...prev, dismissedBillNotifications: [...(prev.dismissedBillNotifications ?? []), ...ids] })),
  });

  const handleNotificationProcessItem = useCallback((item: RecurringTransaction | BillPayment | Task) => {
    if ('title' in item) {
      handleSaveTask({ ...item, status: 'Done' });
      const targetStr = item.reminderDate || item.dueDate;
      if (targetStr) dismissNotification(`task-${item.id}-${targetStr}`);
      toast.success(`Completed task "${item.title}"!`);
      return;
    }
    const defaultAccount = cashAccounts[0] || accounts[0];
    const todayStr = toLocalISOString(new Date());

    if ('status' in item) {
      handleMarkBillAsPaid(item.id, item.accountId || defaultAccount?.id || '', todayStr);
      dismissNotification(`bill-${item.id}-${item.dueDate}`);
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
        recurringSourceId: item.id,
        recurringOccurrenceDate: item.nextDueDate,
      }]);
      if (item.nextDueDate) {
        dismissNotification(`recurring-${item.id}-${item.nextDueDate}`);
      }
      toast.success(`Recorded payment for "${item.description}"!`);
    }
  }, [accounts, cashAccounts, dismissNotification, handleMarkBillAsPaid, handleSaveTask, handleSaveTransaction]);

  useEffect(() => {
    if (isDataLoaded) {
      if (viewingAccountId && !viewingAccount) { toast.error('Account not found'); setViewingAccountId(null); setCurrentPage('Accounts'); }
      if (viewingHoldingSymbol && !viewingHolding) { toast.error('Holding not found'); setViewingHoldingSymbol(null); setCurrentPage('Investments'); }
    }
  }, [isDataLoaded, viewingAccount, viewingAccountId, viewingHolding, viewingHoldingSymbol, setCurrentPage, setViewingAccountId, setViewingHoldingSymbol]);

  const renderInvestments = (linkedSymbol?: string) => <InvestmentsPage accounts={accounts} cashAccounts={cashAccounts} investmentTransactions={investmentTransactions} saveInvestmentTransaction={handleSaveInvestmentTransaction} saveAccount={handleSaveAccount} deleteInvestmentTransaction={handleDeleteInvestmentTransaction} saveTransaction={handleSaveTransaction} warrants={warrants} saveWarrant={handleSaveWarrant} deleteWarrant={handleDeleteWarrant} manualPrices={manualWarrantPrices} onManualPriceChange={handleManualWarrantPrice} prices={assetPrices} onToggleAccountStatus={handleToggleAccountStatus} deleteAccount={handleDeleteAccount} transactions={transactions} onViewAccount={handleOpenAccountDetail} priceHistory={priceHistory} linkedSymbol={linkedSymbol} onCloseLinkedHolding={() => setCurrentPage('Investments')} />;

  const renderPage = () => {
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
      case 'Wrapped': return <WrappedPage />;
      case 'Challenges': return <ChallengesPage userStats={userStats} accounts={accounts} transactions={transactions} predictions={predictions} savePrediction={handleSavePrediction} deletePrediction={handleDeletePrediction} saveUserStats={setUserStats} investmentTransactions={investmentTransactions} warrants={warrants} assetPrices={assetPrices} />;
      case 'Schedule & Bills': return <SchedulePage />;
      case 'Categories': return <CategoriesPage incomeCategories={incomeCategories} setIncomeCategories={setIncomeCategories} expenseCategories={expenseCategories} setExpenseCategories={setExpenseCategories} setCurrentPage={setCurrentPage} onRenameCategory={handleRenameCategory} onDeleteCategory={handleDeleteCategoryCascade} />;
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
    if ((!isAuthenticated && !isDemoMode) || isLocked || !isDataLoaded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsShortcutsModalOpen(false);
        setIsCommandCenterOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthenticated, isDataLoaded, isDemoMode, isLocked]);

  const preferencesContextValue = useMemo(() => ({ preferences, setPreferences }), [preferences]);
  const accountsContextValue = useMemo(() => ({ accounts, accountOrder, setAccountOrder, saveAccount: handleSaveAccount }), [accounts, accountOrder, setAccountOrder, handleSaveAccount]);
  const transactionsVersionRef = useRef(0);
  const prevTransactionsRef = useRef(transactions);
  if (prevTransactionsRef.current !== transactions) {
    prevTransactionsRef.current = transactions;
    transactionsVersionRef.current += 1;
  }
  const transactionsDigest = `txs:v${transactionsVersionRef.current}:${transactions.length}`;
  const transactionsContextValue = useMemo(
    () => ({
      transactions,
      saveTransaction: handleSaveTransaction,
      deleteTransactions: handleDeleteTransactions,
      digest: transactionsDigest,
    }),
    [transactions, handleDeleteTransactions, handleSaveTransaction, transactionsDigest]
  );
  const warrantsContextValue = useMemo(() => ({ warrants, prices: warrantPrices }), [warrantPrices, warrants]);
  const invoicesContextValue = useMemo(() => ({ invoices, saveInvoice: handleSaveInvoice, deleteInvoice: handleDeleteInvoice }), [invoices, handleSaveInvoice, handleDeleteInvoice]);
  const categoryContextValue = useMemo(() => ({ incomeCategories, expenseCategories, setIncomeCategories, setExpenseCategories }), [expenseCategories, incomeCategories]);
  const tagsContextValue = useMemo(() => ({ tags, saveTag: handleSaveTag, deleteTag: handleDeleteTag }), [tags, handleSaveTag, handleDeleteTag]);
  const budgetsContextValue = useMemo(() => ({ budgets, saveBudget: handleSaveBudget, deleteBudget: handleDeleteBudget }), [budgets, handleDeleteBudget, handleSaveBudget]);
  const goalsContextValue = useMemo(() => ({
    financialGoals,
    goalOrder,
    saveFinancialGoal: handleSaveFinancialGoal,
    deleteFinancialGoal: handleDeleteFinancialGoal,
    setGoalOrder: handleSetGoalOrder,
  }), [financialGoals, goalOrder, handleDeleteFinancialGoal, handleSaveFinancialGoal, handleSetGoalOrder]);
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

  if (isAuthLoading || !isDataLoaded) return <div role="status" aria-label="Loading Crystal" className="flex min-h-screen items-center justify-center bg-canvas text-primary"><Spinner className="size-10" /></div>;

  if (!isAuthenticated && !isDemoMode) {
    return (
      <Suspense fallback={<PageLoader label="Preparing sign-in experience..." />}>
        {authPage === 'signIn' ? (
          <SignIn
            onSignIn={handleSignIn}
            onNavigateToSignUp={() => { setAuthError(null); setAuthPage('signUp'); }}
            onEnterDemoMode={() => { setAuthError(null); void handleEnterDemoMode(); }}
            isLoading={isAuthLoading}
            error={authError}
          />
        ) : (
          <SignUp
            onSignUp={handleSignUp}
            onNavigateToSignIn={() => { setAuthError(null); setAuthPage('signIn'); }}
            isLoading={isAuthLoading}
            error={authError}
          />
        )}
      </Suspense>
    );
  }

  if (!currentUser) return <PageLoader label="Loading user profile..." />;

  const lockAction = isAuthenticated && !isDemoMode
    ? () => {
        if (hasPin) void handleLock();
        else { toast.info('Set a PIN first'); setCurrentPage('Personal Info'); }
      }
    : undefined;

  const shellProps: ShellProps = {
    onLock: lockAction,
    syncStatus: isAuthenticated && !isDemoMode ? syncStatus : undefined,
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
            <main className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden scroll-touch focus:outline-none" id="main-content" tabIndex={-1} {...(isPhone ? pageSwipe : {})}>
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
            onCreateTransaction={() => setIsQuickAddTxModalOpen(true)}
            onSyncBanks={handleSyncAllEnableBankingConnections}
            onLock={lockAction}
            onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
            onOpenSetupWizard={() => setIsOnboardingOpen(true)}
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
