import React, { Dispatch, SetStateAction } from 'react';

export type Page = 'Dashboard' | 'Accounts' | 'Transactions' | 'Budget' | 'Forecasting' | 'Settings' | 'Schedule & Bills' | 'Tasks' | 'Categories' | 'Tags' | 'Personal Info' | 'Data Management' | 'Preferences' | 'AccountDetail' | 'Investments' | 'HoldingDetail' | 'Documentation' | 'AI Assistant' | 'Subscriptions' | 'Quotes & Invoices' | 'Challenges' | 'Merchants' | 'Integrations' | 'EnableBankingCallback';

export type Theme = 'light' | 'dark' | 'system';

export type AccountType = 'Checking' | 'Savings' | 'Credit Card' | 'Investment' | 'Loan' | 'Property' | 'Vehicle' | 'Other Assets' | 'Other Liabilities' | 'Lending';

export type Currency = 'EUR' | 'USD' | 'GBP' | 'BTC' | 'RON';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: Currency;
  isPrimary?: boolean;
  includeInAnalytics?: boolean;
  icon?: string;
  status?: 'open' | 'closed';
  
  // Banking
  financialInstitution?: string;
  accountNumber?: string;
  routingNumber?: string;
  apy?: number;
  openingDate?: string;
  last4?: string;
  
  // Credit Card
  expirationDate?: string;
  cardNetwork?: string;
  cardholderName?: string;
  statementStartDate?: number;
  paymentDate?: number;
  settlementAccountId?: string;
  creditLimit?: number;

  // Investment
  subType?: InvestmentSubType;
  symbol?: string;
  expectedRetirementYear?: number;
  linkedAccountId?: string; // For Spare Change or Loan
  
  // Property
  propertyType?: PropertyType;
  address?: string;
  purchasePrice?: number;
  principalOwned?: number;
  linkedLoanId?: string;
  // Property Specs
  propertySize?: number;
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
  leaseProvider?: string;
  leaseStartDate?: string;
  leaseEndDate?: string;
  annualMileageAllowance?: number;
  leasePaymentAmount?: number;
  leasePaymentDay?: number;
  leasePaymentAccountId?: string;
  mileageLogs?: MileageLog[];
  imageUrl?: string;

  // Loan
  totalAmount?: number;
  principalAmount?: number;
  interestAmount?: number;
  duration?: number; // months
  interestRate?: number;
  loanStartDate?: string;
  monthlyPayment?: number;
  paymentDayOfMonth?: number;
  downPayment?: number;

  // Other
  otherSubType?: OtherAssetSubType | OtherLiabilitySubType;
  location?: string;
  assetCondition?: string;
  counterparty?: string;
  notes?: string;

  // Enable Banking
  lastSyncedAt?: string;
  syncStartDate?: string;
  balanceLastSyncedAt?: string;
  balanceSource?: 'manual' | 'enable_banking';
}

export type InvestmentSubType = 'Stock' | 'ETF' | 'Crypto' | 'Pension Fund' | 'Spare Change' | 'Other';
export type PropertyType = 'Detached House' | 'Apartment' | 'Condo' | 'Townhouse' | 'Land' | 'Commercial' | 'Other';
export type FuelType = 'Gasoline' | 'Diesel' | 'Electric' | 'Hybrid' | 'Plug-in Hybrid' | 'Other';
export type VehicleOwnership = 'Owned' | 'Leased' | 'Financed';
export type OtherAssetSubType = 'Cash' | 'Precious Metals' | 'Collectibles' | 'Electronics' | 'Furniture' | 'Art' | 'Jewelry' | 'Other';
export type OtherLiabilitySubType = 'Personal Loan' | 'Tax Owed' | 'Legal Judgment' | 'Other';

export interface MileageLog {
  id: string;
  date: string;
  reading: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  subCategories: Category[];
  classification: 'income' | 'expense';
  parentId?: string;
}

export interface SubTransaction {
  id: string;
  amount: number;
  category: string;
  description?: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  date: string;
  description: string;
  merchant?: string;
  amount: number;
  category: string;
  type: 'income' | 'expense' | 'transfer';
  currency: Currency;
  transferId?: string;
  tagIds?: string[];
  importId?: string;
  isMarketAdjustment?: boolean;
  
  // Loan specific split (optional)
  principalAmount?: number;
  interestAmount?: number;
  
  // Split Transactions
  subTransactions?: SubTransaction[];

  // Location
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  
  // Recurring
  recurringSourceId?: string;
}

export interface DisplayTransaction extends Transaction {
  accountName?: string;
  fromAccountName?: string;
  toAccountName?: string;
  isTransfer?: boolean;
  transferExpenseAmount?: number;
  transferExpenseCurrency?: Currency;
  transferIncomeAmount?: number;
  transferIncomeCurrency?: Currency;
  spareChangeAmount?: number;
  originalId?: string; // for transfer pairs
  formattedDate?: string;
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
  toAccountId?: string;
  description: string;
  amount: number;
  category: string; // or 'Transfer'
  type: 'income' | 'expense' | 'transfer';
  currency: Currency;
  frequency: RecurrenceFrequency;
  frequencyInterval?: number;
  startDate: string;
  nextDueDate: string;
  endDate?: string;
  weekendAdjustment?: WeekendAdjustment;
  dueDateOfMonth?: number;
  isSynthetic?: boolean;
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type WeekendAdjustment = 'before' | 'after' | 'on';

export interface RecurringTransactionOverride {
    recurringTransactionId: string;
    originalDate: string;
    date?: string;
    amount?: number;
    description?: string;
    isSkipped?: boolean;
}

export interface FinancialGoal {
  id: string;
  name: string;
  type: 'one-time' | 'recurring';
  transactionType: 'income' | 'expense';
  amount: number;
  currentAmount: number;
  currency: Currency;
  // One-time
  date?: string;
  // Recurring
  frequency?: RecurrenceFrequency;
  startDate?: string;
  monthlyContribution?: number;
  dueDateOfMonth?: number;
  
  paymentAccountId?: string;
  
  // Bucket
  isBucket?: boolean;
  parentId?: string;
  
  projection?: {
      projectedDate: string;
      status: 'on-track' | 'at-risk' | 'off-track';
  };
}

export type GoalType = 'one-time' | 'recurring';

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
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  reminderDate?: string;
}

export type TaskStatus = 'To Do' | 'In Progress' | 'Done';
export type TaskPriority = 'Low' | 'Medium' | 'High';

export interface BillPayment {
  id: string;
  description: string;
  amount: number;
  type: 'payment' | 'deposit';
  currency: Currency;
  dueDate: string;
  status: BillPaymentStatus;
  accountId?: string;
}

export type BillPaymentStatus = 'paid' | 'unpaid' | 'overdue';

export interface Membership {
  id: string;
  provider: string;
  memberId: string;
  tier?: string;
  holderName?: string;
  memberSince?: string;
  points?: string;
  expiryDate?: string;
  color: string;
  icon: string;
  notes?: string;
  website?: string;
  category?: string;
}

export interface Invoice {
    id: string;
    type: InvoiceType;
    direction: InvoiceDirection;
    number: string;
    date: string;
    dueDate?: string;
    entityName: string;
    entityEmail?: string;
    entityAddress?: string;
    currency: Currency;
    items: InvoiceItem[];
    subtotal: number;
    globalDiscountValue?: number;
    taxRate?: number;
    taxAmount: number;
    total: number;
    paymentTerms?: PaymentTerm[]; // Optional structured terms
    status: InvoiceStatus;
    notes?: string;
}

export type InvoiceType = 'invoice' | 'quote';
export type InvoiceDirection = 'sent' | 'received';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'accepted' | 'rejected';

export interface InvoiceItem {
    id: string;
    description: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
    discountPercent?: number;
    total: number;
}

export interface PaymentTerm {
    days: number;
    percentage: number;
    description?: string;
}

export interface Prediction {
    id: string;
    type: PredictionType;
    targetId?: string; // Account ID or Symbol or 'all_net_worth'
    targetName: string;
    targetAmount: number;
    startDate: string;
    endDate: string;
    status: 'active' | 'won' | 'lost';
    finalAmount?: number;
}

export type PredictionType = 'spending_cap' | 'net_worth_goal' | 'price_target';

export interface ImportExportHistoryItem {
  id: string;
  type: 'import' | 'export';
  dataType: ImportDataType;
  fileName: string;
  date: string;
  status: HistoryStatus;
  itemCount: number;
  importedData?: any[];
  errors?: Record<number, Record<string, string>>;
}

export type ImportDataType = 'transactions' | 'accounts';
export type HistoryStatus = 'Complete' | 'Failed' | 'In Progress';

export interface AppPreferences {
  currency: string;
  language: string;
  timezone: string;
  dateFormat: string;
  defaultPeriod: string;
  defaultAccountOrder: 'name' | 'balance' | 'manual';
  country: string;
  defaultForecastPeriod?: string;
  defaultQuickCreatePeriod?: number;
  brandfetchClientId?: string;
  twelveDataApiKey?: string;
  merchantLogoOverrides?: Record<string, string>;
  geminiApiKey?: string;
}

export interface UserStats {
    currentStreak: number;
    longestStreak: number;
    lastLogDate: string;
    predictionWins: number;
    predictionTotal: number;
}

export interface User {
  id?: number;
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
  memberships: Membership[];
  importExportHistory: ImportExportHistoryItem[];
  incomeCategories: Category[];
  expenseCategories: Category[];
  preferences: AppPreferences;
  billsAndPayments: BillPayment[];
  accountOrder: string[];
  taskOrder: string[];
  tags: Tag[];
  manualWarrantPrices: Record<string, number | undefined>;
  priceHistory: Record<string, PriceHistoryEntry[]>;
  invoices: Invoice[];
  userStats: UserStats;
  predictions: Prediction[];
  enableBankingConnections: EnableBankingConnection[];
  
  userProfile?: User;
  lastUpdatedAt?: string;
  previousUpdatedAt?: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export type LoanPaymentOverrides = Record<string, Record<number, Partial<ScheduledPayment>>>;

export interface ScheduledPayment {
  paymentNumber: number;
  date: string;
  totalPayment: number;
  principal: number;
  interest: number;
  outstandingBalance: number;
  status: 'Upcoming' | 'Paid' | 'Overdue';
  transactionId?: string;
}

export interface PriceHistoryEntry {
    date: string;
    price: number;
}

export interface EnableBankingConnection {
  id: string;
  status: 'pending' | 'ready' | 'disconnected' | 'requires_update';
  applicationId: string;
  countryCode: string;
  clientCertificate: string;
  selectedBank?: string;
  sessionId?: string;
  sessionExpiresAt?: string;
  authorizationId?: string;
  lastSyncedAt?: string;
  lastError?: string;
  accounts?: EnableBankingAccount[];
}

export interface EnableBankingAccount {
  id: string; // provider's account id
  name: string;
  bankName: string;
  currency: Currency;
  balance: number;
  accountNumber?: string;
  linkedAccountId?: string;
  lastSyncedAt?: string;
  syncStartDate?: string;
}

export type EnableBankingLinkPayload =
  | { linkedAccountId: string; syncStartDate: string }
  | { newAccount: Omit<Account, 'id'>; syncStartDate: string };

export interface EnableBankingSyncOptions {
  transactionMode?: 'full' | 'incremental' | 'none';
  updateBalance?: boolean;
  syncStartDate?: string;
  targetAccountIds?: string[];
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

export type Duration = 'TODAY' | 'WTD' | 'MTD' | '30D' | '60D' | '90D' | '6M' | 'YTD' | '1Y' | 'ALL';
export type ForecastDuration = '3M' | '6M' | 'EOY' | '1Y';

export interface CategorySpending {
  name: string;
  value: number;
  color: string;
  icon?: string;
}

export interface BudgetSuggestion {
  categoryName: string;
  averageSpending: number;
  suggestedBudget: number;
}

export interface ContributionPlanStep {
    date: string;
    amount: number;
    accountName: string;
    notes?: string;
}

export interface ScheduledItem {
    id: string;
    date: string;
    description: string;
    amount: number;
    accountName: string;
    type: 'income' | 'expense' | 'transfer' | 'payment' | 'deposit';
    isRecurring: boolean;
    isTransfer?: boolean;
    isOverride?: boolean;
    originalItem: RecurringTransaction | BillPayment;
    originalDateForOverride?: string;
}

export interface HoldingSummary {
    symbol: string;
    name: string;
    quantity: number;
    totalCost: number;
    currentValue: number;
    currentPrice: number;
    type: 'Standard' | 'Warrant';
    subType?: InvestmentSubType;
    warrantId?: string;
    color?: string; // For charts
}

export interface HoldingDistribution {
    name: string;
    value: number;
    color: string;
}

export interface HoldingsOverview {
    holdings: HoldingSummary[];
    totalValue: number;
    totalCostBasis: number;
    investedCapital: number;
    grantedCapital: number;
    distributionData: HoldingDistribution[];
    typeBreakdown: HoldingDistribution[];
}
