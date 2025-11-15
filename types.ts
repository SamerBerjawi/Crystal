

import React, { Dispatch, SetStateAction } from 'react';

// FIX: Add 'AI Assistant' to Page type
export type Page = 'Dashboard' | 'Accounts' | 'Transactions' | 'Budget' | 'Forecasting' | 'Settings' | 'Schedule & Bills' | 'Tasks' | 'Categories' | 'Tags' | 'Personal Info' | 'Data Management' | 'Preferences' | 'AccountDetail' | 'Investments' | 'Warrants' | 'Documentation' | 'Enable Banking' | 'AI Assistant';

export type AccountType = 'Checking' | 'Savings' | 'Credit Card' | 'Investment' | 'Loan' | 'Property' | 'Vehicle' | 'Other Assets' | 'Other Liabilities' | 'Lending';

export type Currency = 'USD' | 'EUR' | 'GBP' | 'BTC' | 'RON';

export type Theme = 'light' | 'dark' | 'system';

export type Duration = 'TODAY' | 'WTD' | 'MTD' | '30D' | '60D' | '90D' | '6M' | 'YTD' | '1Y' | 'ALL';

export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
  classification: 'income' | 'expense';
  subCategories: Category[];
  parentId?: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export type InvestmentSubType = 'Stock' | 'ETF' | 'Crypto' | 'Pension Fund' | 'Spare Change' | 'Other';
export type PropertyType = 'House' | 'Apartment' | 'Land' | 'Commercial' | 'Other';

export interface Account {
  id:string;
  name: string;
  type: AccountType;
  balance: number; // For Vehicle/Property, this is the CURRENT value.
  currency: Currency;
  icon?: string;
  last4?: string;
  symbol?: string; // Ticker symbol for investments/warrants

  // Investment specific
  subType?: InvestmentSubType;

  // Credit Card specific fields
  statementStartDate?: number; // Day of the month (1-31)
  paymentDate?: number; // Day of themonth (1-31)
  settlementAccountId?: string; // ID of a checking account
  creditLimit?: number;

  // Loan specific
  totalAmount?: number;
  principalAmount?: number;
  interestAmount?: number;
  duration?: number; // in months
  interestRate?: number; // percentage
  loanStartDate?: string;
  linkedAccountId?: string;
  downPayment?: number;
  monthlyPayment?: number;
  paymentDayOfMonth?: number;

  // Vehicle specific
  make?: string;
  model?: string;
  year?: number;

  // Property specific
  address?: string;
  propertyType?: PropertyType;
  purchasePrice?: number; // Shared with Vehicle
  principalOwned?: number;
  linkedLoanId?: string;
  
  // Other Assets/Liabilities
  notes?: string;
  
  // FIX: Add properties for Enable Banking integration
  enableBankingId?: string;
  enableBankingInstitution?: string;
  lastSync?: string;
  isPrimary?: boolean;
  sureId?: string;
  status?: 'open' | 'closed';
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
  isSynthetic?: boolean;
}

export interface RecurringTransactionOverride {
  recurringTransactionId: string;
  originalDate: string; // The original date of the occurrence, YYYY-MM-DD
  date?: string; // New date if overridden
  amount?: number; // New amount if overridden (signed)
  description?: string; // New description if overridden
  isSkipped?: boolean;
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
  principalAmount?: number;
  interestAmount?: number;
  tagIds?: string[];
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
  parentId?: string;
  isBucket?: boolean;
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

export interface BudgetSuggestion {
    categoryName: string;
    averageSpending: number;
    suggestedBudget: number;
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

export type DefaultAccountOrder = 'manual' | 'name' | 'balance';

export interface AppPreferences {
  currency: string;
  language: string;
  timezone: string;
  dateFormat: string;
  defaultPeriod: Duration;
  defaultAccountOrder: DefaultAccountOrder;
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

export interface AccountDetailProps {
  account: Account;
  accounts: Account[];
  transactions: Transaction[];
  allCategories: Category[];
  setCurrentPage: (page: Page) => void;
  saveTransaction: (transactions: (Omit<Transaction, 'id'> & { id?: string })[], idsToDelete?: string[]) => void;
  recurringTransactions: RecurringTransaction[];
  setViewingAccountId: (id: string | null) => void;
  tags: Tag[];
}

// FIX: Move FinancialData interface from App.tsx to types.ts to resolve import error in mockData.ts
export interface FinancialData {
    accounts: Account[];
    transactions: Transaction[];
    investmentTransactions: InvestmentTransaction[];
    recurringTransactions: RecurringTransaction[];
    recurringTransactionOverrides?: RecurringTransactionOverride[];
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
    tags?: Tag[];
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

export interface ScheduledPayment {
  paymentNumber: number;
  date: string;
  totalPayment: number;
  principal: number;
  interest: number;
  outstandingBalance: number;
  status: 'Paid' | 'Due' | 'Upcoming' | 'Overdue';
  transactionId?: string;
}

// FIX: Moved ScheduledItem type from pages/Schedule.tsx to make it globally available.
export type ScheduledItem = {
    id: string;
    isRecurring: boolean;
    date: string;
    description: string;
    amount: number;
    accountName: string;
    isTransfer?: boolean;
    type: 'income' | 'expense' | 'transfer' | 'payment' | 'deposit';
    originalItem: RecurringTransaction | BillPayment;
    isOverride?: boolean;
    originalDateForOverride?: string;
};
