import { User, FinancialData, Account, Transaction, RecurringTransaction, Budget, FinancialGoal, BillPayment } from './types';
import { v4 as uuidv4 } from 'uuid';

export const MOCK_USER: User & { password?: string } = {
  firstName: 'Alex',
  lastName: 'Demo',
  email: 'alex.demo@finaura.app',
  password: 'password123',
  profilePictureUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=1964&auto=format&fit=crop&ixlib-rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  role: 'Administrator',
  phone: '+1 123-456-7890',
  address: '123 Finaura St, Brussels, Belgium',
  is2FAEnabled: false,
  status: 'Active',
  lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
};

const CHECKING_ID = `acc-mock-checking`;
const SAVINGS_ID = `acc-mock-savings`;
const CREDIT_CARD_ID = `acc-mock-credit`;

const generateTransactions = (): Transaction[] => {
    const txs: Transaction[] = [];
    const today = new Date();
    
    // Monthly salary
    for (let i = 0; i < 12; i++) {
        const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
        txs.push({
            id: `txn-${uuidv4()}`,
            accountId: CHECKING_ID,
            date: date.toISOString().split('T')[0],
            description: 'Monthly Salary',
            merchant: 'Finaura Inc.',
            amount: 3500,
            category: 'Salary',
            type: 'income',
            currency: 'EUR',
        });
    }

    const expenses = [
        { desc: 'Supermarket', cat: 'Supermarket', amount: -80 },
        { desc: 'Dining Out', cat: 'Dining Out', amount: -45 },
        { desc: 'Netflix Subscription', cat: 'Streaming', amount: -15.99 },
        { desc: 'Mortgage Payment', cat: 'Mortgage', amount: -1200 },
        { desc: 'Internet Bill', cat: 'Internet & TV', amount: -55 },
        { desc: 'Gas Station', cat: 'EV Charging / Fuel', amount: -60 },
        { desc: 'Shopping - Clothes', cat: 'Shopping', amount: -120 },
        { desc: 'Gym Membership', cat: 'Fitness', amount: -40 },
    ];
    
    // Weekly/Bi-weekly expenses
    for (let i = 0; i < 52; i++) {
        const expense = expenses[i % expenses.length];
        const date = new Date(today.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        txs.push({
            id: `txn-${uuidv4()}`,
            accountId: (i % 3 === 0) ? CREDIT_CARD_ID : CHECKING_ID,
            date: date.toISOString().split('T')[0],
            description: expense.desc,
            merchant: expense.desc.split(' - ')[0],
            amount: expense.amount * (1 + (Math.random() - 0.5) * 0.2), // +/- 10% variance
            category: expense.cat,
            type: 'expense',
            currency: 'EUR',
        });
    }

    // Monthly transfer to savings
    for (let i = 0; i < 12; i++) {
        const date = new Date(today.getFullYear(), today.getMonth() - i, 15);
        const transferId = `xfer-${uuidv4()}`;
        txs.push({
            id: `txn-${uuidv4()}`,
            accountId: CHECKING_ID,
            date: date.toISOString().split('T')[0],
            description: 'Transfer to Savings',
            amount: -300,
            category: 'Transfer',
            type: 'expense',
            currency: 'EUR',
            transferId,
        });
        txs.push({
            id: `txn-${uuidv4()}`,
            accountId: SAVINGS_ID,
            date: date.toISOString().split('T')[0],
            description: 'Transfer from Checking',
            amount: 300,
            category: 'Transfer',
            type: 'income',
            currency: 'EUR',
            transferId,
        });
    }
    
    return txs;
};

const mockAccounts: Account[] = [
    { id: CHECKING_ID, name: 'KBC Checking Account', type: 'Checking', balance: 0, currency: 'EUR', icon: 'account_balance', last4: '1234' },
    { id: SAVINGS_ID, name: 'ING Savings', type: 'Savings', balance: 0, currency: 'EUR', icon: 'savings' },
    { id: CREDIT_CARD_ID, name: 'Visa Gold', type: 'Credit Card', balance: 0, currency: 'EUR', icon: 'credit_card', last4: '5678' },
];

const mockTransactions = generateTransactions();

// Calculate final balances for mock accounts based on generated transactions
const initialBalances: Record<string, number> = {
    [CHECKING_ID]: 2000,
    [SAVINGS_ID]: 8000,
    [CREDIT_CARD_ID]: 0,
};

const txBalanceChanges = mockTransactions.reduce((acc, tx) => {
    acc[tx.accountId] = (acc[tx.accountId] || 0) + tx.amount;
    return acc;
}, {} as Record<string, number>);

mockAccounts.forEach(acc => {
    acc.balance = (initialBalances[acc.id] || 0) + (txBalanceChanges[acc.id] || 0);
});


const mockRecurring: RecurringTransaction[] = [
    {
        id: `rec-${uuidv4()}`,
        accountId: CHECKING_ID,
        description: 'Netflix Subscription',
        amount: 15.99,
        category: 'Streaming',
        type: 'expense',
        currency: 'EUR',
        frequency: 'monthly',
        startDate: '2023-01-08',
        nextDueDate: '2024-07-08',
        dueDateOfMonth: 8,
        weekendAdjustment: 'after',
    },
    {
        id: `rec-${uuidv4()}`,
        accountId: CHECKING_ID,
        description: 'Gym Membership',
        amount: 40,
        category: 'Fitness',
        type: 'expense',
        currency: 'EUR',
        frequency: 'monthly',
        startDate: '2023-01-20',
        nextDueDate: '2024-07-20',
        dueDateOfMonth: 20,
        weekendAdjustment: 'on',
    },
];

const mockBudgets: Budget[] = [
    { id: `bud-${uuidv4()}`, categoryName: 'Food & Groceries', amount: 400, period: 'monthly', currency: 'EUR' },
    { id: `bud-${uuidv4()}`, categoryName: 'Shopping', amount: 250, period: 'monthly', currency: 'EUR' },
];

const mockGoals: FinancialGoal[] = [
    {
        id: `goal-${uuidv4()}`,
        name: 'Vacation to Japan',
        type: 'one-time',
        transactionType: 'expense',
        amount: 5000,
        currentAmount: 2100,
        currency: 'EUR',
        date: '2025-04-01',
    }
];

const getFutureDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
};

const getPastDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
}

const mockBillsAndPayments: BillPayment[] = [
    {
        id: `bill-${uuidv4()}`,
        description: 'Electricity Bill',
        amount: -85.50,
        type: 'payment',
        currency: 'EUR',
        dueDate: getFutureDate(5),
        status: 'unpaid',
        accountId: CHECKING_ID,
    },
    {
        id: `bill-${uuidv4()}`,
        description: 'Tax Return',
        amount: 450.00,
        type: 'deposit',
        currency: 'EUR',
        dueDate: getFutureDate(20),
        status: 'unpaid',
    },
    {
        id: `bill-${uuidv4()}`,
        description: 'House Renovation Invoice',
        amount: -2500.00,
        type: 'payment',
        currency: 'EUR',
        dueDate: getPastDate(10),
        status: 'paid',
        accountId: SAVINGS_ID
    },
];


export const MOCK_FINANCIAL_DATA: FinancialData = {
    accounts: mockAccounts,
    transactions: mockTransactions,
    investmentTransactions: [],
    recurringTransactions: mockRecurring,
    financialGoals: mockGoals,
    budgets: mockBudgets,
    tasks: [],
    warrants: [],
    scraperConfigs: [],
    importExportHistory: [],
    incomeCategories: [], // Will use default from constants
    expenseCategories: [], // Will use default from constants
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
    billsAndPayments: mockBillsAndPayments,
};