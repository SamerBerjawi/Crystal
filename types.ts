import React, { Dispatch, SetStateAction } from 'react';

// FIX: Add 'Enable Banking' to Page type
export type Page = 'Dashboard' | 'Accounts' | 'Transactions' | 'Budget' | 'Forecasting' | 'Settings' | 'Schedule & Bills' | 'Tasks' | 'Categories' | 'Tags' | 'Personal Info' | 'Data Management' | 'Preferences' | 'AccountDetail' | 'Investments' | 'Warrants' | 'User Management' | 'Documentation' | 'Enable Banking';

export type AccountType = 'Checking' | 'Savings' | 'Credit Card' | 'Investment' | 'Loan' | 'Property' | 'Crypto' | 'Vehicle' | 'Other Assets' | 'Other Liabilities';

export type Currency = 'USD' | 'EUR' | 'GBP' | 'BTC' | 'RON';

export type Theme = 'light' | 'dark' | 'system';

export type Duration = '7D' | '30D' | '90D' | 'YTD' | '1Y' | '2Y' | '3Y' | '4Y' | '5Y' | '10Y' | 'ALL';

export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
  classification: 'income' | 'expense';
  subCategories: Category[];
  parentId?: string;
}

export interface Account {
  id:string;
  name: string;
  type: AccountType;
  balance: number;
  currency: Currency;
  icon?: string;
  last4?: string;
  symbol?: string; // Ticker symbol for investments/warrants
  // Credit Card specific fields
  statementStartDate?: number; // Day of the month (1-31)
  paymentDate?: number; // Day of themonth (1-31)
  settlementAccountId?: string; // ID of a checking account
  // FIX: Add properties for Enable Banking integration
  enableBankingId?: string;
  enableBankingInstitution?: string;
  lastSync?: string;
  isPrimary?: boolean;
  sureId?: string;
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type WeekendAdjustment = 'before' | 'after' | 'on';

export interface RecurringTransaction {
  id: string;
  accountId: string; // from account for transfers
  toAccountId?: string; // to account for transfers
  description: string;
  amount: number; // Always positive
  category?: string;
  type: 'income' | 'expense' | 'transfer';
  currency: Currency;
  frequency: RecurrenceFrequency;
  frequencyInterval?: number;
  startDate: string;
  endDate?: string;
  nextDueDate: string;
  dueDateOfMonth?: number; // Day of month (1-31) for monthly/yearly recurrences
  weekendAdjustment: WeekendAdjustment;
}

export interface Transaction {
  id: string;
  accountId: string;
  date: string;
  description: string;
  merchant?: string;
  amount: number;
  category: string;
  type: 'income' | 'expense';
  currency: Currency;
  transferId?: string;
  recurringSourceId?: string;
  importId?: string;
  sureId?: string;
}

export interface DisplayTransaction extends Transaction {
    accountName?: string;
    isTransfer?: boolean;
    fromAccountName?: string;
    toAccountName?: string;
    originalId?: string; // To keep track of the real ID for editing transfers
}

export interface InvestmentTransaction {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  price: number; // Price per unit
  date: string;
  type: 'buy' | 'sell';
}

export interface CategorySpending {
  name: string;
  value: number;
  color: string;
  icon?: string;
}

export interface User {
  firstName: string;
  lastName: string;
  email: string;
  profilePictureUrl: string;
  role: 'Administrator' | 'Member';
  phone?: string;
  address?: string;
  is2FAEnabled: boolean;
  status: 'Active' | 'Inactive';
  lastLogin: string;
}


export interface Widget {
    id: string;
    name: string;
    component: React.FC<any>;
    defaultW: number;
    defaultH: number;
    // FIX: Add props property to the Widget interface to fix type errors in Dashboard.tsx and AccountDetail.tsx
    props: any;
}

export interface WidgetConfig {
  id: string;
  title: string;
  w: number;
  h: number;
}

export type GoalType = 'one-time' | 'recurring';

export type GoalProjectionStatus = 'on-track' | 'at-risk' | 'off-track';

export interface GoalProjection {
  projectedDate: string;
  status: GoalProjectionStatus;
}

export interface FinancialGoal {
  id: string;
  name: string;
  type: GoalType;
  transactionType: 'income' | 'expense';
  amount: number; // This is the TARGET amount
  currentAmount: number; // This is the current saved amount
  currency: Currency;
  // One-time
  date?: string; 
  // Recurring
  frequency?: RecurrenceFrequency;
  startDate?: string;
  endDate?: string;
  monthlyContribution?: number;
  dueDateOfMonth?: number;
  // For UI display, calculated dynamically
  projection?: GoalProjection;
}

export interface ContributionPlanStep {
  goalName: string;
  date: string; 
  amount: number;
  accountName: string;
  notes?: string;
}

export interface Budget {
  id: string;
  categoryName: string; // Budget by parent category name for simplicity
  amount: number;
  period: 'monthly'; // For now, only monthly
  currency: Currency;
}

export type HistoryType = 'import' | 'export';
export type HistoryStatus = 'Complete' | 'Failed' | 'In Progress';
export type ImportDataType = 'transactions' | 'accounts' | 'categories' | 'tags' | 'budgets' | 'schedule' | 'investments' | 'mint' | 'all';

export interface ImportExportHistoryItem {
  id: string;
  type: HistoryType;
  dataType: ImportDataType;
  fileName: string;
  date: string;
  status: HistoryStatus;
  itemCount: number;
  importedData?: Record<string, any>[];
  errors?: Record<number, Record<string, string>>;
}

export interface AppPreferences {
  currency: string;
  language: string;
  timezone: string;
  dateFormat: string;
  defaultPeriod: string;
  defaultAccountOrder: string;
  country: string;
}

// New types for Bills & Payments
export type BillPaymentStatus = 'unpaid' | 'paid';

export interface BillPayment {
    id: string;
    description: string;
    amount: number; // positive for deposit, negative for payment
    type: 'deposit' | 'payment';
    currency: Currency;
    dueDate: string;
    status: BillPaymentStatus;
    accountId?: string; // The account it was paid from/to
}

// FIX: Add RemoteAccount interface for Enable Banking flow.
export interface RemoteAccount {
  id: string;
  name: string;
  balance: number;
  currency: Currency;
  institution: string;
  type: AccountType;
  last4: string;
}

// FIX: Add EnableBankingSettings interface.
export interface EnableBankingSettings {
  autoSyncEnabled: boolean;
  syncFrequency: 'daily' | 'twice_daily';
  clientId: string;
  clientSecret: string;
}


// FIX: Move FinancialData interface from App.tsx to types.ts to resolve import error in mockData.ts
export interface FinancialData {
    accounts: Account[];
    transactions: Transaction[];
    investmentTransactions: InvestmentTransaction[];
    recurringTransactions: RecurringTransaction[];
    financialGoals: FinancialGoal[];
    budgets: Budget[];
    tasks: Task[];
    warrants: Warrant[];
    scraperConfigs: ScraperConfig[];
    importExportHistory: ImportExportHistoryItem[];
    incomeCategories: Category[];
    expenseCategories: Category[];
    preferences: AppPreferences;
    billsAndPayments: BillPayment[];
    accountOrder?: string[];
    // FIX: Add enableBankingSettings property.
    enableBankingSettings?: EnableBankingSettings;
}

// New types for Tasks feature
export type TaskStatus = 'To Do' | 'In Progress' | 'Done';
export type TaskPriority = 'Low' | 'Medium' | 'High';

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  status: TaskStatus;
  priority: TaskPriority;
  reminderDate?: string;
}

export interface Warrant {
  id: string;
  isin: string;
  name: string;
  grantDate: string;
  quantity: number;
  grantPrice: number;
}

// New types for Scraper feature
export interface ScraperResource {
  url: string;
  method: 'GET' | 'POST';
  authType: 'none' | 'basic' | 'digest';
  username?: string;
  password?: string;
  verifySsl: boolean;
  timeout: number;
  encoding: string;
}

export interface ScraperOptions {
  select: string;
  index: number;
  attribute: string;
}

export interface ScraperConfig {
  id: string; // ISIN
  resource: ScraperResource;
  options: ScraperOptions;
}