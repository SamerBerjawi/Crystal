// FIX: Import `useMemo` from React to resolve the 'Cannot find name' error.
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Transactions from './pages/Transactions';
import Budgeting from './pages/Budgeting';
import Forecasting from './pages/Forecasting';
import Settings from './pages/Settings';
import Schedule from './pages/Schedule';
import Categories from './pages/Categories';
import Tags from './pages/Tags';
import PersonalInfo from './pages/PersonalInfo';
import DataManagement from './pages/DataImportExport';
import Preferences from './pages/Preferences';
import EnableBankingSettingsPage from './pages/EnableBankingSettings';
import AccountDetail from './pages/AccountDetail';
import Investments from './pages/Investments';
import Tasks from './pages/Tasks';
import Warrants from './pages/Warrants';
import UserManagement from './pages/UserManagement';
// FIX: Import FinancialData from types.ts
import { Page, Theme, Category, User, Transaction, Account, RecurringTransaction, WeekendAdjustment, FinancialGoal, Budget, ImportExportHistoryItem, AppPreferences, RemoteAccount, AccountType, EnableBankingSettings, InvestmentTransaction, Task, Warrant, ScraperConfig, ImportDataType, FinancialData, Currency, BillPayment, BillPaymentStatus } from './types';
import { MOCK_INCOME_CATEGORIES, MOCK_EXPENSE_CATEGORIES } from './constants';
import { v4 as uuidv4 } from 'uuid';
import EnableBankingConnectModal from './components/EnableBankingConnectModal';
import EnableBankingLinkAccountsModal from './components/EnableBankingLinkAccountsModal';
import { GoogleGenAI, FunctionDeclaration, Type } from '@google/genai';
import ChatFab from './components/ChatFab';
import Chatbot from './components/Chatbot';
import { convertToEur, CONVERSION_RATES, arrayToCSV, downloadCSV, getApiBaseUrl } from './utils';
import { useDebounce } from './hooks/useDebounce';

const API_BASE_URL = getApiBaseUrl();

const getBankAccountsFunctionDeclaration: FunctionDeclaration = {
  name: 'get_bank_accounts',
  parameters: {
    type: Type.OBJECT,
    description: 'Gets a list of bank accounts from the connected institution.',
    properties: {
      accounts: {
        type: Type.ARRAY,
        description: 'A list of bank accounts.',
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: 'Unique account ID, prefixed with eb-acc-' },
            name: { type: Type.STRING, description: 'Account name or label' },
            balance: { type: Type.NUMBER, description: 'Current account balance' },
            currency: { type: Type.STRING, description: 'ISO currency code (e.g., EUR, USD)' },
            institution: { type: Type.STRING, description: 'The financial institution name' },
            type: { type: Type.STRING, description: 'The type of account (e.g., Checking, Savings)' },
            last4: { type: Type.STRING, description: 'The last 4 digits of the account number' },
          },
          required: ['id', 'name', 'balance', 'currency', 'institution', 'type', 'last4'],
        },
      },
    },
    required: ['accounts'],
  },
};

const initialFinancialData: FinancialData = {
    accounts: [],
    transactions: [],
    investmentTransactions: [],
    recurringTransactions: [],
    financialGoals: [],
    budgets: [],
    tasks: [],
    warrants: [],
    scraperConfigs: [],
    importExportHistory: [],
    incomeCategories: MOCK_INCOME_CATEGORIES, // Keep default categories
    expenseCategories: MOCK_EXPENSE_CATEGORIES,
    billsAndPayments: [],
    preferences: {
        currency: 'EUR (€)',
        language: 'English (en)',
        timezone: '(+01:00) Brussels',
        dateFormat: 'DD/MM/YYYY',
        defaultPeriod: 'Current Year',
        defaultAccountOrder: 'Name (A-Z)',
        country: 'Belgium',
    },
    enableBankingSettings: {
        autoSyncEnabled: true,
        syncFrequency: 'daily',
    },
};


// FIX: Add export to create a named export for the App component.
export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authPage, setAuthPage] = useState<'signIn' | 'signUp'>('signIn');
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState<Page>('Dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [accountFilter, setAccountFilter] = useState<string | null>(null);
  const [viewingAccountId, setViewingAccountId] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(
    (localStorage.getItem('theme') as Theme) || 'system'
  );
  
  const [user, setUser] = useState<User | null>(null);
  
  // All financial data states, initialized to be empty
  const [preferences, setPreferences] = useState<AppPreferences>(initialFinancialData.preferences);
  const [enableBankingSettings, setEnableBankingSettings] = useState<EnableBankingSettings>(initialFinancialData.enableBankingSettings);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>(initialFinancialData.incomeCategories);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>(initialFinancialData.expenseCategories);
  const [transactions, setTransactions] = useState<Transaction[]>(initialFinancialData.transactions);
  const [investmentTransactions, setInvestmentTransactions] = useState<InvestmentTransaction[]>(initialFinancialData.investmentTransactions);
  const [accounts, setAccounts] = useState<Account[]>(initialFinancialData.accounts);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>(initialFinancialData.recurringTransactions);
  const [financialGoals, setFinancialGoals] = useState<FinancialGoal[]>(initialFinancialData.financialGoals);
  const [budgets, setBudgets] = useState<Budget[]>(initialFinancialData.budgets);
  const [tasks, setTasks] = useState<Task[]>(initialFinancialData.tasks);
  const [warrants, setWarrants] = useState<Warrant[]>(initialFinancialData.warrants);
  const [scraperConfigs, setScraperConfigs] = useState<ScraperConfig[]>(initialFinancialData.scraperConfigs);
  const [importExportHistory, setImportExportHistory] = useState<ImportExportHistoryItem[]>(initialFinancialData.importExportHistory);
  const [billsAndPayments, setBillsAndPayments] = useState<BillPayment[]>(initialFinancialData.billsAndPayments);
  
  // State for Bank Sync Flow
  const [isConnectModalOpen, setConnectModalOpen] = useState(false);
  const [isLinkModalOpen, setLinkModalOpen] = useState(false);
  const [isConnectingToBank, setIsConnectingToBank] = useState(false);
  const [remoteAccounts, setRemoteAccounts] = useState<RemoteAccount[]>([]);

  // State for AI Chat
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // State for Sure integration
  const [sureApiUrl, setSureApiUrl] = useState('https://finance.samxr.com/api/v1');
  const [sureApiKey, setSureApiKey] = useState('');
  const [isSureSyncing, setIsSureSyncing] = useState(false);

  // Load/save Sure settings from/to localStorage
  useEffect(() => {
    const storedUrl = localStorage.getItem('finaura_sure_api_url');
    const storedKey = localStorage.getItem('finaura_sure_api_key');
    if (storedUrl) setSureApiUrl(storedUrl);
    if (storedKey) setSureApiKey(storedKey);
  }, []);

  const handleSetSureApiUrl = (url: string) => {
    setSureApiUrl(url);
    localStorage.setItem('finaura_sure_api_url', url);
  };
  
  const handleSetSureApiKey = (key: string) => {
    setSureApiKey(key);
    localStorage.setItem('finaura_sure_api_key', key);
  };

  // Check auth status on initial load
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('finaura_token');
      if (token) {
        try {
          const res = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (res.ok) {
            const { user, financialData } = await res.json();
            loadUserData(financialData, user);
          } else {
            handleLogout();
          }
        } catch (error) {
          console.error('Auth check failed', error);
          handleLogout();
        }
      }
      setIsLoading(false);
    };
    checkAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const dataToSave: FinancialData = useMemo(() => ({
    accounts, transactions, investmentTransactions, recurringTransactions,
    financialGoals, budgets, tasks, warrants, scraperConfigs, importExportHistory, incomeCategories,
    expenseCategories, preferences, enableBankingSettings, billsAndPayments
  }), [
    accounts, transactions, investmentTransactions,
    recurringTransactions, financialGoals, budgets, tasks, warrants, scraperConfigs, importExportHistory,
    incomeCategories, expenseCategories, preferences, enableBankingSettings, billsAndPayments
  ]);

  const debouncedDataToSave = useDebounce(dataToSave, 1500);

  // Persist data to backend on change
  useEffect(() => {
    const saveData = async () => {
      if (isAuthenticated && user) {
        const token = localStorage.getItem('finaura_token');
        try {
          await fetch(`${API_BASE_URL}/data`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(debouncedDataToSave),
          });
        } catch (error) {
          console.error("Failed to save data to backend", error);
        }
      }
    };
    saveData();
  }, [debouncedDataToSave, isAuthenticated, user]);

  const loadUserData = (data: FinancialData, userData: User) => {
    setAccounts(data.accounts || []);
    setTransactions(data.transactions || []);
    setInvestmentTransactions(data.investmentTransactions || []);
    setRecurringTransactions(data.recurringTransactions || []);
    setFinancialGoals(data.financialGoals || []);
    setBudgets(data.budgets || []);
    setTasks(data.tasks || []);
    setWarrants(data.warrants || []);
    setScraperConfigs(data.scraperConfigs || []);
    setImportExportHistory(data.importExportHistory || []);
    setBillsAndPayments(data.billsAndPayments || []);
    setIncomeCategories(data.incomeCategories && data.incomeCategories.length > 0 ? data.incomeCategories : MOCK_INCOME_CATEGORIES);
    setExpenseCategories(data.expenseCategories && data.expenseCategories.length > 0 ? data.expenseCategories : MOCK_EXPENSE_CATEGORIES);
    setPreferences(data.preferences || initialFinancialData.preferences);
    setEnableBankingSettings(data.enableBankingSettings || initialFinancialData.enableBankingSettings);
    
    // Normalize user data from DB
    const normalizedUser = {
      firstName: userData.first_name,
      lastName: userData.last_name,
      profilePictureUrl: userData.profile_picture_url,
      is2FAEnabled: userData.is_2fa_enabled,
      ...userData
    };

    setUser(normalizedUser);
    setIsAuthenticated(true);
    setIsLoading(false);
  };

  // Auth handlers
  const handleSignIn = async (email: string, password: string) => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const { token, user, financialData } = await res.json();
        localStorage.setItem('finaura_token', token);
        loadUserData(financialData, user);
      } else {
        const { message } = await res.json();
        setAuthError(message || 'Invalid email or password.');
      }
    } catch (error) {
      setAuthError('Failed to sign in. Please check your connection and try again.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignUp = async (newUserData: { firstName: string, lastName: string, email: string, password: string }) => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserData),
      });
      if (res.ok) {
        const { token, user, financialData } = await res.json();
        localStorage.setItem('finaura_token', token);
        loadUserData(financialData, user);
      } else {
        const { message } = await res.json();
        setAuthError(message || 'Failed to sign up.');
      }
    } catch (error) {
      setAuthError('Failed to sign up. Please check your connection and try again.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('finaura_token');
    setIsAuthenticated(false);
    setUser(null);
    // Reset all states to initial empty state to ensure no data leaks between sessions
    setAccounts(initialFinancialData.accounts);
    setTransactions(initialFinancialData.transactions);
    setInvestmentTransactions(initialFinancialData.investmentTransactions);
    setRecurringTransactions(initialFinancialData.recurringTransactions);
    setFinancialGoals(initialFinancialData.financialGoals);
    setBudgets(initialFinancialData.budgets);
    setTasks(initialFinancialData.tasks);
    setWarrants(initialFinancialData.warrants);
    setScraperConfigs(initialFinancialData.scraperConfigs);
    setImportExportHistory(initialFinancialData.importExportHistory);
    setBillsAndPayments(initialFinancialData.billsAndPayments);
    setIncomeCategories(initialFinancialData.incomeCategories);
    setExpenseCategories(initialFinancialData.expenseCategories);
    setPreferences(initialFinancialData.preferences);
    setEnableBankingSettings(initialFinancialData.enableBankingSettings);
    
    setAuthPage('signIn');
  };

  // User Management Handlers (These are now just wrappers for API calls)
  const handleUpdateUser = useCallback(async (email: string, updates: Partial<User>) => {
    // API call logic will be in UserManagement.tsx
    // This is for updating the current user's profile
    setUser(prev => prev ? { ...prev, ...updates } as User : null);
  }, []);

  // FIX: Removed async/Promise to match the synchronous boolean return type expected by the PersonalInfo and ChangePasswordModal components.
  const handleChangePassword = useCallback((email: string, current: string, newPass: string): boolean => {
    // API call logic will be in PersonalInfo.tsx or its modal
    return true; // Placeholder
  }, []);
  
    const handleSaveTransaction = (
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
            const changeInEur = convertToEur(tx.amount, tx.currency);
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
                const originalChangeInEur = convertToEur(originalTx.amount, originalTx.currency);
                balanceChanges[originalTx.accountId] = (balanceChanges[originalTx.accountId] || 0) - originalChangeInEur;
                
                // Apply new transaction amount to its account (which might be new)
                const updatedChangeInEur = convertToEur(updatedTx.amount, updatedTx.currency);
                balanceChanges[updatedTx.accountId] = (balanceChanges[updatedTx.accountId] || 0) + updatedChangeInEur;
                transactionsToUpdate.push(updatedTx);
            }
        } else {
            const newTx: Transaction = {
                ...transactionData,
                category: transactionData.category || 'Transfer', // Default category for transfers
                id: `txn-${uuidv4()}`
            } as Transaction;
            const newChangeInEur = convertToEur(newTx.amount, newTx.currency);
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
  };

  const handleDeleteTransactions = (transactionIds: string[]) => {
    if (transactionIds.length > 0) {
      handleSaveTransaction([], transactionIds);
    }
  };
  
  const handleSaveInvestmentTransaction = (
    invTxData: Omit<InvestmentTransaction, 'id'> & { id?: string },
    cashTxData?: Omit<Transaction, 'id'>
  ) => {
      if (invTxData.id) { 
           // For simplicity, editing an investment transaction won't automatically update a previously linked cash transaction.
           setInvestmentTransactions(prev => prev.map(t => t.id === invTxData.id ? {...t, ...invTxData} as InvestmentTransaction : t));
      } else { // Adding new
          const newInvTx = { ...invTxData, id: `inv-txn-${uuidv4()}` } as InvestmentTransaction;
          setInvestmentTransactions(prev => [...prev, newInvTx]);
          if (cashTxData) {
              handleSaveTransaction([cashTxData]);
          }
      }
  };

  const handleDeleteInvestmentTransaction = (id: string) => {
      // Deleting an investment transaction will not automatically delete its linked cash transaction for simplicity.
      setInvestmentTransactions(prev => prev.filter(t => t.id !== id));
  };


  const handleSaveRecurringTransaction = (recurringData: Omit<RecurringTransaction, 'id'> & { id?: string }) => {
    if (recurringData.id) {
        // Update
        setRecurringTransactions(prev => prev.map(rt => rt.id === recurringData.id ? { ...rt, ...recurringData } as RecurringTransaction : rt));
    } else {
        // Add
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
    if (warrantData.id) {
        setWarrants(prev => prev.map(w => w.id === warrantData.id ? { ...w, ...warrantData } as Warrant : w));
    } else {
        const newWarrant: Warrant = { ...warrantData, id: `warr-${uuidv4()}` } as Warrant;
        setWarrants(prev => [...prev, newWarrant]);
    }
  };

  const handleDeleteWarrant = (warrantId: string) => {
    setWarrants(prev => prev.filter(w => w.id !== warrantId));
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
          setAccounts(prev => [...prev, ...newAccounts.map(a => ({...a, id: `acc-${uuidv4()}`}))]);
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
        // This should now be an API call, but for simplicity, we keep it client-side
        // to reset the current session state. A real reset would be on the backend.
        loadUserData(initialFinancialData, user);
        alert("Client-side data has been reset.");
    }
  };
  
  const handleExportAllData = () => {
      const blob = new Blob([JSON.stringify(dataToSave)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finaura-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleImportAllData = (file: File) => {
    if (!user) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target?.result as string) as FinancialData;
            if (data.accounts && data.transactions) {
                loadUserData(data, user);
                alert('Data successfully restored! Changes will be saved to the database.');
            } else {
                throw new Error('Invalid backup file format.');
            }
        } catch (e) {
            alert('Error reading backup file. It may be corrupted or in the wrong format.');
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
              downloadCSV(csv, `finaura_${type}_${new Date().toISOString().split('T')[0]}.csv`);
          }
      });
  };

  const handleSureSync = async () => {
    if (!sureApiKey || !sureApiUrl) {
      alert('Please set your Sure API URL and Key in Data Management settings.');
      return;
    }
    setIsSureSyncing(true);
    
    const proxy = 'https://corsproxy.io/?';
    const baseUrl = sureApiUrl.endsWith('/') ? sureApiUrl.slice(0, -1) : sureApiUrl;

    try {
      // Fetch accounts
      const accountsUrl = `${baseUrl}/accounts`;
      const proxiedAccountsUrl = `${proxy}${encodeURIComponent(accountsUrl)}`;
      const accountsResponse = await fetch(proxiedAccountsUrl, { headers: { 'Authorization': `Bearer ${sureApiKey}` } });

      if (!accountsResponse.ok) {
        const errorText = await accountsResponse.text();
        let displayError = `Sure API Accounts Fetch Error: ${accountsResponse.statusText}.`;
        if (accountsResponse.status === 403) {
          displayError = `Permission Denied: 403 Forbidden. Your API key may lack permissions. Please check the key's 'read' scope for accounts and transactions in your Sure dashboard.`;
        } else if (errorText) {
          displayError += ` Server response: "${errorText}"`;
        }
        throw new Error(displayError);
      }
      const sureAccounts: any[] = await accountsResponse.json();

      // Fetch transactions
      const transactionsUrl = `${baseUrl}/transactions`;
      const proxiedTransactionsUrl = `${proxy}${encodeURIComponent(transactionsUrl)}`;
      const transactionsResponse = await fetch(proxiedTransactionsUrl, { headers: { 'Authorization': `Bearer ${sureApiKey}` } });


      if (!transactionsResponse.ok) {
        const errorText = await transactionsResponse.text();
        let displayError = `Sure API Transactions Fetch Error: ${transactionsResponse.statusText}.`;
        if (transactionsResponse.status === 403) {
          displayError = `Permission Denied: 403 Forbidden. Your API key may lack permissions. Please check the key's 'read' scope for accounts and transactions in your Sure dashboard.`;
        } else if (errorText) {
          displayError += ` Server response: "${errorText}"`;
        }
        throw new Error(displayError);
      }
      const sureTransactions: any[] = await transactionsResponse.json();

      const updatedAccounts = [...accounts];
      const newTransactions: Omit<Transaction, 'id'>[] = [];

      sureAccounts.forEach((sureAcc) => {
        const existingAccount = updatedAccounts.find(a => a.sureId === sureAcc.id);
        if (existingAccount) {
          existingAccount.balance = sureAcc.balance;
        } else {
          updatedAccounts.push({
            id: `acc-${uuidv4()}`, sureId: sureAcc.id, name: sureAcc.name, type: sureAcc.type as AccountType || 'Checking',
            balance: sureAcc.balance, currency: sureAcc.currency as Currency || 'EUR', last4: sureAcc.last4,
          });
        }
      });

      sureTransactions.forEach((sureTx) => {
        if (!transactions.some(t => t.sureId === sureTx.id)) {
          const targetAccount = updatedAccounts.find(a => a.sureId === sureTx.account_id);
          if (targetAccount) {
            newTransactions.push({
              sureId: sureTx.id, accountId: targetAccount.id, date: new Date(sureTx.date).toISOString().split('T')[0],
              description: sureTx.description, merchant: sureTx.merchant, amount: sureTx.amount,
              category: sureTx.category || 'Uncategorized', type: sureTx.amount >= 0 ? 'income' : 'expense',
              currency: targetAccount.currency,
            });
          }
        }
      });

      setAccounts(updatedAccounts);
      if (newTransactions.length > 0) handleSaveTransaction(newTransactions);

      alert(`Sync successful! ${newTransactions.length} new transactions imported.`);

    } catch (e: any) {
      alert(`Sure sync failed:\n${e.message || String(e)}`);
    } finally {
      setIsSureSyncing(false);
    }
  };

  useEffect(() => {
    if (theme === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', systemPrefersDark);
    } else {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  const viewingAccount = useMemo(() => accounts.find(a => a.id === viewingAccountId), [accounts, viewingAccountId]);
  
  const renderPage = () => {
    if (currentPage === 'AccountDetail' && viewingAccount) {
        return <AccountDetail account={viewingAccount} accounts={accounts} transactions={transactions} allCategories={[...incomeCategories, ...expenseCategories]} setCurrentPage={setCurrentPage} saveTransaction={handleSaveTransaction} />;
    }
    switch (currentPage) {
        case 'Dashboard': return <Dashboard user={user!} transactions={transactions} accounts={accounts} saveTransaction={handleSaveTransaction} incomeCategories={incomeCategories} expenseCategories={expenseCategories} />;
        case 'Accounts': return <Accounts accounts={accounts} transactions={transactions} setAccounts={setAccounts} setCurrentPage={setCurrentPage} setAccountFilter={setAccountFilter} onStartConnection={()=>setConnectModalOpen(true)} setViewingAccountId={setViewingAccountId} saveTransaction={handleSaveTransaction} />;
        case 'Transactions': return <Transactions transactions={transactions} saveTransaction={handleSaveTransaction} deleteTransactions={handleDeleteTransactions} accounts={accounts} accountFilter={accountFilter} setAccountFilter={setAccountFilter} incomeCategories={incomeCategories} expenseCategories={expenseCategories} />;
        case 'Budget': return <Budgeting budgets={budgets} transactions={transactions} expenseCategories={expenseCategories} saveBudget={handleSaveBudget} deleteBudget={handleDeleteBudget} accounts={accounts} />;
        case 'Forecasting': return <Forecasting accounts={accounts} transactions={transactions} recurringTransactions={recurringTransactions} financialGoals={financialGoals} saveFinancialGoal={handleSaveFinancialGoal} deleteFinancialGoal={handleDeleteFinancialGoal} expenseCategories={expenseCategories}/>;
        case 'Settings': return <Settings setCurrentPage={setCurrentPage} user={user!} />;
        case 'Schedule & Bills': return <Schedule recurringTransactions={recurringTransactions} saveRecurringTransaction={handleSaveRecurringTransaction} deleteRecurringTransaction={handleDeleteRecurringTransaction} billsAndPayments={billsAndPayments} saveBillPayment={handleSaveBillPayment} deleteBillPayment={handleDeleteBillPayment} markBillAsPaid={handleMarkBillAsPaid} accounts={accounts} incomeCategories={incomeCategories} expenseCategories={expenseCategories} />;
        case 'Categories': return <Categories incomeCategories={incomeCategories} setIncomeCategories={setIncomeCategories} expenseCategories={expenseCategories} setExpenseCategories={setExpenseCategories} />;
        case 'Tags': return <Tags />;
        case 'Personal Info': return <PersonalInfo user={user!} setUser={(updatedUser) => handleUpdateUser(updatedUser.email, updatedUser)} onChangePassword={handleChangePassword} />;
        case 'Data Management': return <DataManagement accounts={accounts} transactions={transactions} budgets={budgets} recurringTransactions={recurringTransactions} allCategories={[...incomeCategories, ...expenseCategories]} history={importExportHistory} onPublishImport={handlePublishImport} onDeleteHistoryItem={handleDeleteHistoryItem} onDeleteImportedTransactions={handleDeleteImportedTransactions} onResetAccount={handleResetAccount} onExportAllData={handleExportAllData} onImportAllData={handleImportAllData} onExportCSV={handleExportCSV} sureApiUrl={sureApiUrl} setSureApiUrl={handleSetSureApiUrl} sureApiKey={sureApiKey} setSureApiKey={handleSetSureApiKey} onSureSync={handleSureSync} isSureSyncing={isSureSyncing} />;
        case 'Preferences': return <Preferences preferences={preferences} setPreferences={setPreferences} theme={theme} setTheme={setTheme} />;
        case 'Enable Banking': return <EnableBankingSettingsPage linkedAccounts={accounts.filter(a => a.enableBankingId)} settings={enableBankingSettings} setSettings={setEnableBankingSettings} onStartConnection={() => setConnectModalOpen(true)} onUnlinkAccount={()=>{}} onManualSync={()=>{}} />;
        case 'Investments': return <Investments investmentAccounts={accounts.filter(a => a.type === 'Investment' || a.type === 'Crypto')} cashAccounts={accounts.filter(a => a.type === 'Checking' || a.type === 'Savings')} investmentTransactions={investmentTransactions} saveInvestmentTransaction={handleSaveInvestmentTransaction} deleteInvestmentTransaction={handleDeleteInvestmentTransaction} />;
        case 'Tasks': return <Tasks tasks={tasks} saveTask={handleSaveTask} deleteTask={handleDeleteTask} />;
        case 'Warrants': return <Warrants warrants={warrants} saveWarrant={handleSaveWarrant} deleteWarrant={handleDeleteWarrant} scraperConfigs={scraperConfigs} saveScraperConfig={handleSaveScraperConfig} />;
        case 'User Management': return <UserManagement currentUser={user!} />;
        default: return <Dashboard user={user!} transactions={transactions} accounts={accounts} saveTransaction={handleSaveTransaction} incomeCategories={incomeCategories} expenseCategories={expenseCategories} />;
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen bg-light-bg dark:bg-dark-bg"><div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500"></div></div>;
  }

  if (!isAuthenticated || !user) {
    return authPage === 'signIn' 
        ? <SignIn onSignIn={handleSignIn} onNavigateToSignUp={() => { setAuthPage('signUp'); setAuthError(null); }} error={authError} isLoading={isAuthLoading} />
        : <SignUp onSignUp={handleSignUp} onNavigateToSignIn={() => { setAuthPage('signIn'); setAuthError(null); }} error={authError} isLoading={isAuthLoading} />;
  }

  return (
    <div className={`flex min-h-screen text-light-text dark:text-dark-text font-sans antialiased`}>
      <EnableBankingConnectModal 
        isOpen={isConnectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        isConnecting={isConnectingToBank}
        onConnect={() => {
            setIsConnectingToBank(true);
            setTimeout(() => {
                // Mock API call to get accounts
                const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
                ai.models.generateContent({
                    model: 'gemini-flash-lite-latest',
                    contents: "Generate a list of 3-5 sample bank accounts in JSON format, using the 'get_bank_accounts' function.",
                    config: { tools: [{ functionDeclarations: [getBankAccountsFunctionDeclaration] }] }
                }).then(response => {
                    const functionCall = response.functionCalls?.[0];
                    if (functionCall && functionCall.name === 'get_bank_accounts' && functionCall.args?.accounts) {
                        setRemoteAccounts(functionCall.args.accounts as RemoteAccount[]);
                    } else {
                         // Fallback mock data if Gemini fails
                        setRemoteAccounts([
                            {id: 'eb-acc-1', name: 'BNP Checking', balance: 5420.12, currency: 'EUR', institution: 'BNP Paribas', type: 'Checking', last4: '9876'},
                            {id: 'eb-acc-2', name: 'BNP Savings', balance: 12800.50, currency: 'EUR', institution: 'BNP Paribas', type: 'Savings', last4: '5432'}
                        ]);
                    }
                }).catch(err => {
                    console.error("Gemini call failed, using fallback accounts.", err);
                    setRemoteAccounts([
                        {id: 'eb-acc-1', name: 'BNP Checking', balance: 5420.12, currency: 'EUR', institution: 'BNP Paribas', type: 'Checking', last4: '9876'},
                        {id: 'eb-acc-2', name: 'BNP Savings', balance: 12800.50, currency: 'EUR', institution: 'BNP Paribas', type: 'Savings', last4: '5432'}
                    ]);
                }).finally(() => {
                    setIsConnectingToBank(false);
                    setConnectModalOpen(false);
                    setLinkModalOpen(true);
                });
            }, 2000);
        }}
      />
      <EnableBankingLinkAccountsModal
        isOpen={isLinkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        remoteAccounts={remoteAccounts}
        existingAccounts={accounts}
        onLinkAndSync={(links) => {
            const newAccounts: Account[] = [];
            const updatedAccounts = accounts.map(acc => {
                const remoteId = Object.keys(links).find(key => links[key] === acc.id);
                if (remoteId) {
                    const remoteAcc = remoteAccounts.find(ra => ra.id === remoteId);
                    if (remoteAcc) {
                        return { 
                            ...acc, 
                            balance: remoteAcc.balance, 
                            enableBankingId: remoteId, 
                            enableBankingInstitution: remoteAcc.institution,
                            lastSync: new Date().toISOString()
                        };
                    }
                }
                return acc;
            });

            Object.keys(links).forEach(remoteId => {
                if (links[remoteId] === 'CREATE_NEW') {
                    const remoteAcc = remoteAccounts.find(ra => ra.id === remoteId);
                    if (remoteAcc) {
                        newAccounts.push({
                            id: `acc-${uuidv4()}`,
                            name: remoteAcc.name,
                            type: remoteAcc.type,
                            balance: remoteAcc.balance,
                            currency: remoteAcc.currency,
                            last4: remoteAcc.last4,
                            enableBankingId: remoteId,
                            enableBankingInstitution: remoteAcc.institution,
                            lastSync: new Date().toISOString()
                        });
                    }
                }
            });

            setAccounts([...updatedAccounts, ...newAccounts]);
            setLinkModalOpen(false);
            setCurrentPage('Accounts');
        }}
      />
      
      <Sidebar 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage} 
        isSidebarOpen={isSidebarOpen} 
        setSidebarOpen={setSidebarOpen} 
        theme={theme}
        isSidebarCollapsed={isSidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        onLogout={handleLogout}
        user={user}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
            currentPage={currentPage} 
            user={user} 
            setSidebarOpen={setSidebarOpen} 
            theme={theme} 
            setTheme={setTheme} 
        />
        <main className="flex-1 overflow-x-hidden p-4 md:p-8 bg-light-bg dark:bg-dark-bg">
            {renderPage()}
        </main>
      </div>
      <Chatbot 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
        financialData={{ accounts, transactions, budgets, financialGoals, recurringTransactions }}
      />
      <ChatFab onClick={() => setIsChatOpen(!isChatOpen)} />
    </div>
  );
}