
import React, { Dispatch, SetStateAction } from 'react';

// FIX: Add 'AI Assistant' to Page type
export type Page = 'Dashboard' | 'Accounts' | 'Transactions' | 'Budget' | 'Forecasting' | 'Settings' | 'Schedule & Bills' | 'Tasks' | 'Categories' | 'Tags' | 'Personal Info' | 'Data Management' | 'Preferences' | 'AccountDetail' | 'Investments' | 'Warrants' | 'Documentation' | 'AI Assistant' | 'Subscriptions';

export type AccountType = 'Checking' | 'Savings' | 'Credit Card' | 'Investment' | 'Loan' | 'Property' | 'Vehicle' | 'Other Assets' | 'Other Liabilities' | 'Lending';

export type Currency = 'USD' | 'EUR' | 'GBP' | 'BTC' | 'RON';

export type Theme = 'light' | 'dark' | 'system';

export type Duration = 'TODAY' | 'WTD' | 'MTD' | '30D' | '60D' | '90D' | '6M' | 'YTD' | '1Y' | 'ALL';
export type ForecastDuration = '3M' | '6M' | 'EOY' | '1Y';

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
export type PropertyType = 'Apartment' | 'Detached House' | 'Semi-Detached House' | 'Terraced House' | 'Land' | 'Commercial' | 'Other';
export type OtherAssetSubType = 'Cash' | 'Precious Metals' | 'Collectibles' | 'Art' | 'Business Equity' | 'Private Loan' | 'Electronics' | 'Furniture' | 'Other';
export type OtherLiabilitySubType = 'Tax' | 'Private Debt' | 'Legal Settlement' | 'Business Debt' | 'Other';

// Vehicle Specific Types
export type FuelType = 'Gasoline' | 'Diesel' | 'Electric' | 'Hybrid' | 'LPG';
export type VehicleOwnership = 'Owned' | 'Leased';

export interface MileageLog {
    id: string;
    date: string;
    reading: number;
}

export interface Account {
  id:string;
  name: string;
  type: AccountType;
  balance: number; // For Vehicle/Property, this is the CURRENT value.
  currency: Currency;
  icon?: string;
  last4?: string;
  financialInstitution?: string;
  symbol?: string; // Ticker symbol for investments/warrants

  // Banking specific
  accountNumber?: string; // IBAN or local account number
  routingNumber?: string; // BIC, SWIFT, Sort Code, or Routing Number
  apy?: number; // Annual Percentage Yield for savings
  openingDate?: string; // Date account was opened

  // Card specific
  expirationDate?: string; // MM/YY
  cardNetwork?: string; // Visa, Mastercard, etc.
  cardholderName?: string;

  // Investment specific
  subType?: InvestmentSubType;
  expectedRetirementYear?: number; // For Pension Funds
  
  // Other Assets/Liabilities specific
  otherSubType?: OtherAssetSubType | OtherLiabilitySubType;
  counterparty?: string; // Who owes you or who you owe
  assetCondition?: string; // Mint, Good, Fair
  location?: string; // Physical location of asset

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
  linkedAccountId?: string; // Used for Loans (Debit account) and Spare Change (Source account)
  downPayment?: number;
  monthlyPayment?: number;
  paymentDayOfMonth?: number;

  // Vehicle specific
  make?: string;
  model?: string;
  year?: number;
  licensePlate?: string;
  registrationCountryCode?: string;
  vin?: string;
  fuelType?: FuelType;
  ownership?: VehicleOwnership;
  // If Owned
  purchaseDate?: string;
  // If Leased
  leaseProvider?: string;
  leaseStartDate?: string;
  leaseEndDate?: string;
  annualMileageAllowance?: number;
  leasePaymentAmount?: number;
  leasePaymentDay?: number;
  leasePaymentAccountId?: string;
  // Mileage
  mileageLogs?: MileageLog[];
  imageUrl?: string;

  // Property specific
  address?: string;
  propertyType?: PropertyType;
  purchasePrice?: number; // Shared with Vehicle
  principalOwned?: number;
  linkedLoanId?: string;
  propertySize?: number; // sq meters
  yearBuilt?: number;
  floors?: number;
  bedrooms?: number;
  bathrooms?: number;
  hasBasement?: boolean;
  hasAttic?: boolean;
  indoorParkingSpaces?: number;
  outdoorParkingSpaces?: number;
  hasGarden?: boolean;
  gardenSize?: number;
  hasTerrace?: boolean;
  terraceSize?: number;
  
  // Property Recurring Costs
  propertyTaxAmount?: number;
  propertyTaxDate?: string; // Next due date
  
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceAmount?: number;
  insuranceFrequency?: RecurrenceFrequency;
  insurancePaymentDate?: string;

  hoaFeeAmount?: number;
  hoaFeeFrequency?: RecurrenceFrequency;
  
  isRental?: boolean;
  rentalIncomeAmount?: number;
  rentalIncomeFrequency?: RecurrenceFrequency;

  // Other Assets/Liabilities
  notes?: string;
  
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

export type LoanPaymentOverrides = Record<string, Record<number, Partial<ScheduledPayment>>>;

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
  // Location data
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
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
    component: React.ComponentType<any>;
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
  paymentAccountId?: string;
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
  defaultQuickCreatePeriod?: number;
  defaultForecastPeriod?: ForecastDuration;
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

export interface AccountDetailProps {
  account: Account;
  setCurrentPage: (page: Page) => void;
  setViewingAccountId: (id: string | null) => void;
  saveAccount: (account: Omit<Account, 'id'> & { id?: string }) => void;
}

// FIX: Move FinancialData interface from App.tsx to types.ts to resolve import error in mockData.ts
export interface FinancialData {
    accounts: Account[];
    transactions: Transaction[];
    investmentTransactions: InvestmentTransaction[];
    recurringTransactions: RecurringTransaction[];
    recurringTransactionOverrides?: RecurringTransactionOverride[];
    loanPaymentOverrides?: LoanPaymentOverrides;
    financialGoals: FinancialGoal[];
    budgets: Budget[];
    tasks: Task[];
    taskOrder?: string[];
    warrants: Warrant[];
    importExportHistory: ImportExportHistoryItem[];
    incomeCategories: Category[];
    expenseCategories: Category[];
    preferences: AppPreferences;
    billsAndPayments: BillPayment[];
    accountOrder?: string[];
    tags?: Tag[];
    manualWarrantPrices?: Record<string, number | undefined>;
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
