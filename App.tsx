// FIX: Import `useMemo` from React to resolve the 'Cannot find name' error.
import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy, useRef } from 'react';
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
const Documentation = lazy(() => import('./pages/Documentation').then(module => ({ default: module.Documentation })));
// UserManagement is removed
// FIX: Import FinancialData from types.ts
// FIX: Add `Tag` to the import from `types.ts`.
import { Page, Theme, Category, User, Transaction, Account, RecurringTransaction, RecurringTransactionOverride, WeekendAdjustment, FinancialGoal, Budget, ImportExportHistoryItem, AppPreferences, AccountType, InvestmentTransaction, Task, Warrant, ScraperConfig, ImportDataType, FinancialData, Currency, BillPayment, BillPaymentStatus, Duration, InvestmentSubType, Tag } from './types';
import { MOCK_INCOME_CATEGORIES, MOCK_EXPENSE_CATEGORIES, LIQUID_ACCOUNT_TYPES } from './constants';
import { v4 as uuidv4 } from 'uuid';
import ChatFab from './components/ChatFab';
const Chatbot = lazy(() => import('./components/Chatbot'));
import { convertToEur, CONVERSION_RATES, arrayToCSV, downloadCSV, parseDateAsUTC } from './utils';
import { useDebounce } from './hooks/useDebounce';
import { useAuth } from './hooks/useAuth';
import useLocalStorage from './hooks/useLocalStorage';
const OnboardingModal = lazy(() => import('./components/OnboardingModal'));

const initialFinancialData: FinancialData = {
    accounts: [],
    transactions: [],
    investmentTransactions: [],
    recurringTransactions: [],
    recurringTransactionOverrides: [],
    financialGoals: [],
    budgets: [],
    tasks: [],
    warrants: [],
    scraperConfigs: [],
    importExportHistory: [],
    // FIX: Add `tags` to the initial financial data structure.
    tags: [],
    incomeCategories: MOCK_INCOME_CATEGORIES, // Keep default categories
    expenseCategories: MOCK_EXPENSE_CATEGORIES,
    billsAndPayments: [],
    accountOrder: [],
    preferences: {
        currency: 'EUR (€)',
        language: 'English (en)',
        timezone: 'Europe/Brussels',
        dateFormat: 'DD/MM/YYYY',
        defaultPeriod: 'MTD',
        defaultAccountOrder: 'name',
        country: 'Belgium',
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


// FIX: Add export to create a named export for the App component.
export const App: React.FC = () => {
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
  const [financialGoals, setFinancialGoals] = useState<FinancialGoal[]>(initialFinancialData.financialGoals);
  const [budgets, setBudgets] = useState<Budget[]>(initialFinancialData.budgets);
  const [tasks, setTasks] = useState<Task[]>(initialFinancialData.tasks);
  const [warrants, setWarrants] = useState<Warrant[]>(initialFinancialData.warrants);
  const [scraperConfigs, setScraperConfigs] = useState<ScraperConfig[]>(initialFinancialData.scraperConfigs);
  const [importExportHistory, setImportExportHistory] = useState<ImportExportHistoryItem[]>(initialFinancialData.importExportHistory);
  const [billsAndPayments, setBillsAndPayments] = useState<BillPayment[]>(initialFinancialData.billsAndPayments);
  // FIX: Add state for tags and tag filtering to support the Tags feature.
  const [tags, setTags] = useState<Tag[]>(initialFinancialData.tags || []);
  const latestDataRef = useRef<FinancialData>(initialFinancialData);
  const skipNextSaveRef = useRef(false);
  const restoreInProgressRef = useRef(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [accountOrder, setAccountOrder] = useLocalStorage<string[]>('crystal-account-order', []);
  
  // State for AI Chat
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // State for Warrant prices
  const [warrantPrices, setWarrantPrices] = useState<Record<string, number | null>>({});
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // States lifted up for persistence & preference linking
  const [dashboardAccountIds, setDashboardAccountIds] = useState<string[]>([]);
  const [activeGoalIds, setActiveGoalIds] = useState<string[]>([]);
  const [dashboardDuration, setDashboardDuration] = useState<Duration>(preferences.defaultPeriod as Duration);
  const [accountsSortBy, setAccountsSortBy] = useState<'name' | 'balance' | 'manual'>(preferences.defaultAccountOrder);

  // Onboarding flow state
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useLocalStorage('crystal-onboarding-complete', false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);


  useEffect(() => {
    // Set default dashboard account filter only on initial load
    if (accounts.length > 0 && dashboardAccountIds.length === 0) {
        const primaryAccount = accounts.find(a => a.isPrimary);
        if (primaryAccount) {
            setDashboardAccountIds([primaryAccount.id]);
        } else {
            setDashboardAccountIds(accounts.filter(a => LIQUID_ACCOUNT_TYPES.includes(a.type)).map(a => a.id));
        }
    }
  }, [accounts, dashboardAccountIds.length]);
  
  useEffect(() => {
    // Set default active goals only on initial load
    if (financialGoals.length > 0 && activeGoalIds.length === 0) {
        setActiveGoalIds(financialGoals.map(g => g.id));
    }
  }, [financialGoals, activeGoalIds.length]);

  const fetchWarrantPrices = useCallback(async () => {
    const uniqueIsins = [...new Set(warrants.map(w => w.isin))];
    const configsToRun = scraperConfigs.filter(c => uniqueIsins.includes(c.id));
    if (isLoadingPrices || configsToRun.length === 0) return;

    setIsLoadingPrices(true);
    const newPrices: Record<string, number | null> = {};
    const CORS_PROXIES = [
        'https://api.allorigins.win/raw?url=',
        'https://corsproxy.io/?',
        'https://thingproxy.freeboard.io/fetch/',
        'https://cors.eu.org/',
    ];

    for (const config of configsToRun) {
        let success = false;
        // Shuffle proxies to distribute load and increase success rate on retries
        const shuffledProxies = [...CORS_PROXIES].sort(() => Math.random() - 0.5);

        for (const proxy of shuffledProxies) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), (config.resource.timeout || 15) * 1000);

            try {
                let urlToFetch = '';
                // Proxies that take the URL as a query parameter (containing '?') need it to be URI-encoded.
                // Proxies that take the URL as part of the path do not.
                if (proxy.includes('?')) {
                    urlToFetch = `${proxy}${encodeURIComponent(config.resource.url)}`;
                } else {
                    urlToFetch = `${proxy}${config.resource.url}`;
                }
                
                const response = await fetch(urlToFetch, { signal: controller.signal });
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    console.warn(`Proxy ${proxy} failed for ${config.resource.url} with status ${response.status}`);
                    continue; // Try next proxy
                }
                
                const htmlString = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlString, 'text/html');
                const elements = doc.querySelectorAll(config.options.select);

                if (elements.length > config.options.index) {
                    const targetElement = elements[config.options.index];
                    const rawValue = config.options.attribute ? targetElement.getAttribute(config.options.attribute) : targetElement.textContent;
                    if (rawValue) {
                        const priceString = rawValue.match(/[0-9.,\s]+/)?.[0]?.trim() || '';
                        const numberString = priceString.replace(/\./g, '').replace(',', '.');
                        const price = parseFloat(numberString);
                        newPrices[config.id] = isNaN(price) ? null : price;
                    } else {
                        newPrices[config.id] = null;
                    }
                } else {
                    newPrices[config.id] = null;
                }
                
                success = true;
                break; // Success, break from proxy loop
            } catch (error: any) {
                clearTimeout(timeoutId);
                if (error.name === 'AbortError') {
                    console.warn(`Proxy ${proxy} timed out for ${config.id}.`);
                } else {
                    console.warn(`Proxy ${proxy} failed for ${config.id}:`, error);
                }
                // Continue to next proxy
            }
        }
        
        if (!success) {
            console.error(`Failed to scrape ${config.id} with all available proxies.`);
            newPrices[config.id] = null;
        }
    }
    setWarrantPrices(prev => ({...prev, ...newPrices}));
    setLastUpdated(new Date());
    setIsLoadingPrices(false);
  }, [scraperConfigs, warrants, isLoadingPrices]);

  useEffect(() => {
    if (warrants.length > 0) {
        fetchWarrantPrices();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warrants, scraperConfigs]);

  useEffect(() => {
    const updatedAccounts = accounts.map(account => {
        // FIX: The type 'Crypto' is not a valid AccountType. 'Crypto' is a subtype of 'Investment'.
        // The check is simplified to only verify if the account type is 'Investment'.
        if (account.symbol && account.type === 'Investment' && warrantPrices[account.symbol] !== undefined) {
            const price = warrantPrices[account.symbol];
            const quantity = investmentTransactions
                .filter(tx => tx.symbol === account.symbol)
                .reduce((total, tx) => total + (tx.type === 'buy' ? tx.quantity : -tx.quantity), 0)
                + warrants
                .filter(w => w.isin === account.symbol)
                .reduce((total, w) => total + w.quantity, 0);
            
            return { ...account, balance: price !== null ? quantity * price : 0 };
        }
        return account;
    });

    if (JSON.stringify(updatedAccounts) !== JSON.stringify(accounts)) {
        setAccounts(updatedAccounts);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warrantPrices]);

  const loadAllFinancialData = useCallback((data: FinancialData | null, options?: { skipNextSave?: boolean }) => {
    const dataToLoad = data || initialFinancialData;
    setAccounts(dataToLoad.accounts || []);
    setTransactions(dataToLoad.transactions || []);
    setInvestmentTransactions(dataToLoad.investmentTransactions || []);
    setRecurringTransactions(dataToLoad.recurringTransactions || []);
    setRecurringTransactionOverrides(dataToLoad.recurringTransactionOverrides || []);
    setFinancialGoals(dataToLoad.financialGoals || []);
    setBudgets(dataToLoad.budgets || []);
    setTasks(dataToLoad.tasks || []);
    setWarrants(dataToLoad.warrants || []);
    setScraperConfigs(dataToLoad.scraperConfigs || []);
    setImportExportHistory(dataToLoad.importExportHistory || []);
    setBillsAndPayments(dataToLoad.billsAndPayments || []);
    // FIX: Add `tags` to the data loading logic.
    setTags(dataToLoad.tags || []);
    setIncomeCategories(dataToLoad.incomeCategories && dataToLoad.incomeCategories.length > 0 ? dataToLoad.incomeCategories : MOCK_INCOME_CATEGORIES);
    setExpenseCategories(dataToLoad.expenseCategories && dataToLoad.expenseCategories.length > 0 ? dataToLoad.expenseCategories : MOCK_EXPENSE_CATEGORIES);
    
    const loadedPrefs = dataToLoad.preferences || initialFinancialData.preferences;
    setPreferences(loadedPrefs);
    setDashboardDuration(loadedPrefs.defaultPeriod as Duration);
    setAccountsSortBy(loadedPrefs.defaultAccountOrder);

    setAccountOrder(dataToLoad.accountOrder || []);

    if (options?.skipNextSave) {
      skipNextSaveRef.current = true;
    }
    latestDataRef.current = dataToLoad;
  }, [setAccountOrder]);
  
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
    recurringTransactionOverrides, financialGoals, budgets, tasks, warrants, scraperConfigs, importExportHistory, incomeCategories,
    expenseCategories, preferences, billsAndPayments, accountOrder, tags,
  }), [
    accounts, transactions, investmentTransactions,
    recurringTransactions, recurringTransactionOverrides, financialGoals, budgets, tasks, warrants, scraperConfigs, importExportHistory,
    incomeCategories, expenseCategories, preferences, billsAndPayments, accountOrder, tags,
  ]);

  const debouncedDataToSave = useDebounce(dataToSave, 1500);

  useEffect(() => {
    latestDataRef.current = dataToSave;
  }, [dataToSave]);

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
      return;
    }

    saveData(debouncedDataToSave);
  }, [debouncedDataToSave, isDataLoaded, isAuthenticated, isDemoMode, saveData]);

  useEffect(() => {
    if (!isAuthenticated || isDemoMode || typeof window === 'undefined') {
      return;
    }

    const handleBeforeUnload = () => {
      if (!isDataLoaded) {
        return;
      }
      saveData(latestDataRef.current, { keepalive: true, suppressErrors: true });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isAuthenticated, isDataLoaded, isDemoMode, saveData]);
  
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
            const updatedAccounts = prev.map(acc => acc.id === accountData.id ? { ...acc, ...accountData } as Account : acc);
            if (accountData.isPrimary) {
                return updatedAccounts.map(acc => acc.id === accountData.id ? acc : { ...acc, isPrimary: false });
            }
            return updatedAccounts;
        });
    } else { // ADD
        const newAccount = { ...accountData, id: `acc-${uuidv4()}` } as Account;
        setAccounts(prev => {
            const newAccounts = [...prev, newAccount];
            if (newAccount.isPrimary) {
                return newAccounts.map(acc => acc.id === newAccount.id ? acc : { ...acc, isPrimary: false });
            }
            return newAccounts;
        });
    }
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
    setDashboardAccountIds(prev => prev.filter(id => id !== accountId));

    if (viewingAccountId === accountId) {
      setViewingAccountId(null);
      setCurrentPage('Accounts');
    }

    if (accountToDelete && accountFilter === accountToDelete.name) {
      setAccountFilter(null);
    }
  }, [
    accounts,
    recurringTransactions,
    accountFilter,
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
        setFinancialGoals(prev => prev.map(g => g.id === goalData.id ? { ...g, ...goalData } as FinancialGoal : g));
    } else {
        const newGoal: FinancialGoal = { ...goalData, id: `goal-${uuidv4()}` } as FinancialGoal;
        setFinancialGoals(prev => [...prev, newGoal]);
    }
  };

  const handleDeleteFinancialGoal = (id: string) => {
    setFinancialGoals(prev => prev.filter(g => g.id !== id));
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
    setWarrants(prev => prev.filter(w => w.id !== warrantId));
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
      if (tagFilter === tagId) {
          setTagFilter(null);
      }
  };
  
  const handleSaveScraperConfig = (config: ScraperConfig) => {
    setScraperConfigs(prev => {
        const index = prev.findIndex(c => c.id === config.id);
        if (index > -1) {
            const newConfigs = [...prev];
            newConfigs[index] = config;
            return newConfigs;
        }
        return [...prev, config];
    });
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


  // --- Data Import / Export ---
  const handlePublishImport = (
    items: (Omit<Account, 'id'> | Omit<Transaction, 'id'>)[],
    dataType: ImportDataType,
    fileName: string,
    originalData: Record<string, any>[],
    errors: Record<number, Record<string, string>>
  ) => {
      const importId = `imp-${uuidv4()}`;
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

  const renderPage = () => {
    if (viewingAccountId) {
      if (viewingAccount) {
        return <AccountDetail 
          account={viewingAccount}
          accounts={accounts}
          transactions={transactions}
          allCategories={[...incomeCategories, ...expenseCategories]}
          setCurrentPage={setCurrentPage}
          saveTransaction={handleSaveTransaction}
          recurringTransactions={recurringTransactions}
          setViewingAccountId={setViewingAccountId}
          tags={tags}
        />
      } else {
        setViewingAccountId(null); // Account not found, go back to dashboard
        setCurrentPage('Dashboard');
      }
    }

    switch (currentPage) {
      case 'Dashboard':
        return <Dashboard user={currentUser!} transactions={transactions} accounts={accounts} saveTransaction={handleSaveTransaction} incomeCategories={incomeCategories} expenseCategories={expenseCategories} financialGoals={financialGoals} recurringTransactions={recurringTransactions} billsAndPayments={billsAndPayments} selectedAccountIds={dashboardAccountIds} setSelectedAccountIds={setDashboardAccountIds} duration={dashboardDuration} setDuration={setDashboardDuration} tags={tags} />;
      case 'Accounts':
        return <Accounts accounts={accounts} transactions={transactions} saveAccount={handleSaveAccount} deleteAccount={handleDeleteAccount} setCurrentPage={setCurrentPage} setAccountFilter={setAccountFilter} setViewingAccountId={setViewingAccountId} saveTransaction={handleSaveTransaction} accountOrder={accountOrder} setAccountOrder={setAccountOrder} sortBy={accountsSortBy} setSortBy={setAccountsSortBy} />;
      case 'Transactions':
        return <Transactions transactions={transactions} saveTransaction={handleSaveTransaction} deleteTransactions={handleDeleteTransactions} accounts={accounts} accountFilter={accountFilter} setAccountFilter={setAccountFilter} incomeCategories={incomeCategories} expenseCategories={expenseCategories} tags={tags} tagFilter={tagFilter} setTagFilter={setTagFilter} saveRecurringTransaction={handleSaveRecurringTransaction} />;
      case 'Budget':
        return <Budgeting budgets={budgets} transactions={transactions} expenseCategories={expenseCategories} saveBudget={handleSaveBudget} deleteBudget={handleDeleteBudget} accounts={accounts} />;
      case 'Forecasting':
        return <Forecasting accounts={accounts} transactions={transactions} recurringTransactions={recurringTransactions} financialGoals={financialGoals} saveFinancialGoal={handleSaveFinancialGoal} deleteFinancialGoal={handleDeleteFinancialGoal} expenseCategories={expenseCategories} billsAndPayments={billsAndPayments} activeGoalIds={activeGoalIds} setActiveGoalIds={setActiveGoalIds} />;
      case 'Settings':
        return <SettingsPage setCurrentPage={setCurrentPage} user={currentUser!} />;
      case 'Schedule & Bills':
        return <SchedulePage recurringTransactions={recurringTransactions} saveRecurringTransaction={handleSaveRecurringTransaction} deleteRecurringTransaction={handleDeleteRecurringTransaction} billsAndPayments={billsAndPayments} saveBillPayment={handleSaveBillPayment} deleteBillPayment={handleDeleteBillPayment} markBillAsPaid={handleMarkBillAsPaid} accounts={accounts} incomeCategories={incomeCategories} expenseCategories={expenseCategories} recurringTransactionOverrides={recurringTransactionOverrides} saveRecurringOverride={handleSaveRecurringOverride} deleteRecurringOverride={handleDeleteRecurringOverride} saveTransaction={handleSaveTransaction} tags={tags} />;
      case 'Categories':
        return <CategoriesPage incomeCategories={incomeCategories} setIncomeCategories={setIncomeCategories} expenseCategories={expenseCategories} setExpenseCategories={setExpenseCategories} setCurrentPage={setCurrentPage} />;
      case 'Tags':
        return <TagsPage tags={tags} transactions={transactions} saveTag={handleSaveTag} deleteTag={handleDeleteTag} setCurrentPage={setCurrentPage} setTagFilter={setTagFilter} />;
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
        return <InvestmentsPage accounts={accounts} cashAccounts={accounts.filter(a => a.type === 'Checking' || a.type === 'Savings')} investmentTransactions={investmentTransactions} saveInvestmentTransaction={handleSaveInvestmentTransaction} deleteInvestmentTransaction={handleDeleteInvestmentTransaction} />;
      case 'Warrants':
        return <WarrantsPage warrants={warrants} saveWarrant={handleSaveWarrant} deleteWarrant={handleDeleteWarrant} scraperConfigs={scraperConfigs} saveScraperConfig={handleSaveScraperConfig} prices={warrantPrices} isLoadingPrices={isLoadingPrices} lastUpdated={lastUpdated} refreshPrices={fetchWarrantPrices} />;
      case 'Tasks':
        return <TasksPage tasks={tasks} saveTask={handleSaveTask} deleteTask={handleDeleteTask} />;
      case 'Documentation':
        return <Documentation setCurrentPage={setCurrentPage} />;
      case 'AI Assistant':
        return <AIAssistantSettingsPage setCurrentPage={setCurrentPage} />;
      default:
        return <div>Page not found</div>;
    }
  };

  // Loading state
  if (isAuthLoading || !isDataLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-light-bg dark:bg-dark-bg">
        <svg className="animate-spin h-10 w-10 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 * 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  // Auth pages
  if (!isAuthenticated && !isDemoMode) {
    if (authPage === 'signIn') {
      return <SignIn onSignIn={handleSignIn} onNavigateToSignUp={() => setAuthPage('signUp')} onEnterDemoMode={handleEnterDemoMode} isLoading={isAuthLoading} error={authError} />;
    }
    return <SignUp onSignUp={handleSignUp} onNavigateToSignIn={() => setAuthPage('signIn')} isLoading={isAuthLoading} error={authError} />;
  }

  // Main app
  return (
    <div className={`flex h-screen bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text font-sans`}>
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
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          user={currentUser!}
          setSidebarOpen={setSidebarOpen}
          theme={theme}
          setTheme={setTheme}
          currentPage={currentPage}
          titleOverride={viewingAccount?.name}
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8 bg-light-bg dark:bg-dark-bg">
          <Suspense fallback={<PageLoader />}>
            {renderPage()}
          </Suspense>
        </main>
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
  );
};