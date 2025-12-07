
import React, { Dispatch, SetStateAction } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type Page = 'Dashboard' | 'Accounts' | 'Transactions' | 'Budget' | 'Forecasting' | 'Settings' | 'Schedule & Bills' | 'Tasks' | 'Categories' | 'Tags' | 'Personal Info' | 'Data Management' | 'Preferences' | 'AccountDetail' | 'Investments' | 'InvestmentDetail' | 'Warrants' | 'Documentation' | 'AI Assistant' | 'Subscriptions';

export type AccountType = 'Checking' | 'Savings' | 'Credit Card' | 'Investment' | 'Loan' | 'Property' | 'Vehicle' | 'Other Assets' | 'Other Liabilities' | 'Lending';
export type InvestmentSubType = 'Stock' | 'ETF' | 'Crypto' | 'Pension Fund' | 'Spare Change' | 'Other';
export type OtherAssetSubType = 'Cash' | 'Precious Metals' | 'Collectibles' | 'Art' | 'Business Equity' | 'Private Loan' | 'Electronics' | 'Furniture' | 'Other';
export type OtherLiabilitySubType = 'Tax' | 'Private Debt' | 'Legal Settlement' | 'Business Debt' | 'Other';
export type PropertyType = 'Apartment' | 'Detached House' | 'Semi-Detached House' | 'Terraced House' | 'Land' | 'Commercial' | 'Other';
export type FuelType = 'Gasoline' | 'Diesel' | 'Electric' | 'Hybrid' | 'LPG';
export type VehicleOwnership = 'Owned' | 'Leased';

export type Currency = 'USD' | 'EUR' | 'GBP' | 'BTC' | 'RON';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type WeekendAdjustment = 'before' | 'after' | 'on';
export type BillPaymentStatus = 'paid' | 'unpaid' | 'overdue';

export type Duration = 'TODAY' | 'WTD' | 'MTD' | '30D' | '60D' | '90D' | '6M' | 'YTD' | '1Y' | 'ALL';
export type ForecastDuration = '3M' | '6M' | 'EOY' | '1Y';
export type DefaultAccountOrder = 'manual' | 'name' | 'balance';

export interface User {
  firstName: string;
  lastName: string;
  email: string;
  profilePictureUrl: string;
  role: string;
  phone?: string;
  address?: string;
  is2FAEnabled: boolean;
  status: string;
  lastLogin: string;
}

export interface AppPreferences {
  currency: Currency;
  language: string;
  timezone: string;
  dateFormat: string;
  defaultPeriod: string;
  country: string;
  defaultForecastPeriod?: ForecastDuration;
  defaultAccountOrder: 'manual' | 'name' | 'balance';
  defaultQuickCreatePeriod?: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
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

export interface MileageLog {
  id: string;
  date: string;
  reading: number;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: Currency;
  icon?: string;
  isPrimary?: boolean;
  status?: 'open' | 'closed';
  
  // Banking
  accountNumber?: string;
  routingNumber?: string;
  apy?: number;
  openingDate?: string;
  financialInstitution?: string;

  // Credit Card
  last4?: string;
  expirationDate?: string; // MM/YY
  cardNetwork?: string;
  cardholderName?: string;
  statementStartDate?: number;
  paymentDate?: number; // Day of month
  settlementAccountId?: string;
  creditLimit?: number;

  // Investment
  subType?: InvestmentSubType;
  symbol?: string; // for auto-tracking or warrant association
  expectedRetirementYear?: number;
  linkedAccountId?: string; // For Spare Change or Loan/Property link

  // Loan / Lending
  totalAmount?: number;
  principalAmount?: number;
  interestAmount?: number;
  duration?: number; // months
  interestRate?: number; // %
  loanStartDate?: string;
  monthlyPayment?: number;
  paymentDayOfMonth?: number;
  downPayment?: number;

  // Property
  propertyType?: PropertyType;
  address?: string;
  purchasePrice?: number;
  principalOwned?: number; // If no linked loan
  linkedLoanId?: string;
  propertySize?: number; // m2
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
  // Property Recurring
  propertyTaxAmount?: number;
  propertyTaxDate?: string;
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

  // Vehicle
  make?: string;
  model?: string;
  year?: number;
  licensePlate?: string;
  registrationCountryCode?: string;
  vin?: string;
  fuelType?: FuelType;
  ownership?: VehicleOwnership;
  purchaseDate?: string;
  // Leasing
  leaseProvider?: string;
  leaseStartDate?: string;
  leaseEndDate?: string;
  annualMileageAllowance?: number;
  leasePaymentAmount?: number;
  leasePaymentDay?: number;
  leasePaymentAccountId?: string;
  imageUrl?: string;
  mileageLogs?: MileageLog[];
  
  // Other Assets/Liabilities
  otherSubType?: string;
  location?: string;
  assetCondition?: string;
  counterparty?: string;
  notes?: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  date: string; // ISO Date YYYY-MM-DD
  description: string;
  amount: number;
  category: string;
  type: 'income' | 'expense';
  currency: Currency;
  merchant?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  transferId?: string;
  importId?: string; // ID of the import batch
  tagIds?: string[];
  
  // Loan specific
  principalAmount?: number;
  interestAmount?: number;
}

export interface InvestmentTransaction {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  date: string;
  type: 'buy' | 'sell';
}

export interface Warrant {
  id: string;
  isin: string;
  name: string;
  grantDate: string;
  quantity: number;
  grantPrice: number;
}

export interface RecurringTransaction {
  id: string;
  accountId: string;
  toAccountId?: string; // For transfers
  description: string;
  amount: number;
  category?: string;
  type: 'income' | 'expense' | 'transfer';
  currency: Currency;
  frequency: RecurrenceFrequency;
  frequencyInterval?: number; // e.g., every 2 weeks
  startDate: string;
  endDate?: string;
  nextDueDate: string;
  dueDateOfMonth?: number; // Specific day for monthly/yearly
  weekendAdjustment?: WeekendAdjustment;
  isSynthetic?: boolean; // If generated from other data (loans etc)
}

export interface RecurringTransactionOverride {
  recurringTransactionId: string;
  originalDate: string;
  date?: string;
  amount?: number;
  description?: string;
  isSkipped?: boolean;
}

export type GoalType = 'one-time' | 'recurring';

export interface FinancialGoal {
  id: string;
  name: string;
  amount: number;
  currentAmount: number;
  currency: Currency;
  type: GoalType;
  transactionType: 'income' | 'expense'; // Is this a saving goal (expense from cashflow view) or income goal? Usually expense (saving up)
  date?: string; // Target date for one-time
  frequency?: RecurrenceFrequency; // For recurring goals
  startDate?: string;
  monthlyContribution?: number; // Planned contribution
  dueDateOfMonth?: number;
  isBucket?: boolean;
  parentId?: string; // If part of a bucket
  paymentAccountId?: string; // Account to pay from/to
  projection?: {
      projectedDate: string;
      status: 'on-track' | 'at-risk' | 'off-track';
  };
}

export interface Budget {
  id: string;
  categoryName: string;
  amount: number;
  period: 'monthly' | 'yearly';
  currency: Currency;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'To Do' | 'In Progress' | 'Done';
  priority: 'Low' | 'Medium' | 'High';
  dueDate?: string;
  reminderDate?: string;
}

export type TaskStatus = Task['status'];
export type TaskPriority = Task['priority'];

export interface BillPayment {
    id: string;
    description: string;
    amount: number;
    dueDate: string;
    status: 'paid' | 'unpaid' | 'overdue';
    accountId?: string; // Optional: preferred payment account
    type: 'payment' | 'deposit'; // Bill (out) or Expected Deposit (in)
    currency: Currency;
}

export interface LoyaltyProgram {
    id: string;
    name: string;
    programName: string;
    membershipId: string;
    pointsBalance: number;
    pointsUnit: string;
    tier?: string;
    expiryDate?: string;
    color: string;
    icon: string;
    websiteUrl?: string;
    notes?: string;
    category?: string;
}

export type ImportDataType = 'transactions' | 'accounts' | 'mint';
export type HistoryStatus = 'Complete' | 'Failed' | 'In Progress';

export interface ImportExportHistoryItem {
  id: string;
  type: 'import' | 'export';
  dataType: ImportDataType;
  fileName: string;
  date: string;
  status: HistoryStatus;
  itemCount: number;
  importedData?: Record<string, any>[]; // Original data for debugging/review
  errors?: Record<number, Record<string, string>>; // Row index -> Field -> Error message
}

export type LoanPaymentOverrides = Record<string, Record<number, Partial<ScheduledPayment>>>;

export interface ScheduledPayment {
    paymentNumber: number;
    date: string;
    totalPayment: number;
    principal: number;
    interest: number;
    outstandingBalance: number;
    status: 'Paid' | 'Overdue' | 'Upcoming';
    transactionId?: string;
}

export interface FinancialData {
    accounts: Account[];
    transactions: Transaction[];
    investmentTransactions: InvestmentTransaction[];
    recurringTransactions: RecurringTransaction[];
    recurringTransactionOverrides: RecurringTransactionOverride[];
    loanPaymentOverrides: LoanPaymentOverrides;
    financialGoals: FinancialGoal[];
    budgets: Budget[];
    tasks: Task[];
    warrants: Warrant[];
    importExportHistory: ImportExportHistoryItem[];
    tags: Tag[];
    incomeCategories: Category[];
    expenseCategories: Category[];
    billsAndPayments: BillPayment[];
    loyaltyPrograms: LoyaltyProgram[];
    accountOrder: string[];
    taskOrder: string[];
    manualWarrantPrices: Record<string, number | undefined>;
    preferences: AppPreferences;
}

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
    id: string; // linked to warrant ISIN
    resource: ScraperResource;
    options: ScraperOptions;
}

export interface BudgetSuggestion {
  categoryName: string;
  averageSpending: number;
  suggestedBudget: number;
}

export interface DisplayTransaction extends Transaction {
  accountName?: string;
  fromAccountName?: string;
  toAccountName?: string;
  originalId?: string;
  isTransfer?: boolean;
}

export interface Widget {
  id: string;
  name: string;
  defaultW: number;
  defaultH: number;
  component: React.FC<any>;
  props?: Record<string, any>;
}

export interface WidgetConfig {
  id: string;
  title: string;
  w: number;
  h: number;
}

export interface ContributionPlanStep {
    date: string;
    amount: number;
    accountName: string;
    notes?: string;
}

export interface CategorySpending {
  name: string;
  value: number;
  color: string;
  icon?: string;
}

export interface ScheduledItem {
    id: string;
    date: string;
    description: string;
    amount: number;
    accountName?: string;
    type: 'income' | 'expense' | 'transfer' | 'payment' | 'deposit';
    isRecurring: boolean;
    isTransfer?: boolean;
    originalItem: RecurringTransaction | BillPayment;
    isOverride?: boolean;
    originalDateForOverride?: string;
}
