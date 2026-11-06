

import React, { Dispatch, SetStateAction } from 'react';

// Financial data and page definitions
export type Page = 'Dashboard' | 'Accounts' | 'Transactions' | 'Budget' | 'Forecasting' | 'Goals' | 'Schedule & Bills' | 'Tasks' | 'Categories' | 'Tags' | 'Personal Info' | 'Data Management' | 'Preferences' | 'AccountDetail' | 'Investments' | 'HoldingDetail' | 'Documentation' | 'Subscriptions' | 'Quotes & Invoices' | 'Challenges' | 'Merchants' | 'Rules' | 'Reports' | 'Integrations' | 'EnableBankingCallback';

export interface AccountTypeItem {
  type: AccountType;
  icon: string;
  color: string;
}

export type AccountType = 'Checking' | 'Savings' | 'Credit Card' | 'Investment' | 'Loan' | 'Property' | 'Vehicle' | 'Other Assets' | 'Other Liabilities' | 'Lending';

/** An ISO 4217 code, or BTC. See utils/currencies.ts. */
export type Currency = string;

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

export type InvestmentSubType = 'Stock' | 'ETF' | 'Crypto' | 'Warrant' | 'Pension Fund' | 'Spare Change' | 'Other';
export type PropertyType = 'Apartment' | 'Detached House' | 'Semi-Detached House' | 'Terraced House' | 'Land' | 'Commercial' | 'Other';
export type OtherAssetSubType = 'Cash' | 'Precious Metals' | 'Collectibles' | 'Art' | 'Business Equity' | 'Private Loan' | 'Electronics' | 'Furniture' | 'Meal Voucher' | 'Other';
export type OtherLiabilitySubType = 'Tax' | 'Private Debt' | 'Legal Settlement' | 'Business Debt' | 'Other';

// Vehicle Specific Types
export type FuelType = 'Gasoline' | 'Diesel' | 'Electric' | 'Hybrid' | 'LPG';
export type VehicleOwnership = 'Owned' | 'Leased';

export interface AssetClosureDetails {
  closureType: 'Sold' | 'Returned' | 'Gifted' | 'Written Off' | 'Retired';
  date: string;
  value: number;
  incomeAccountId?: string; // Where the money goes if sold
  notes?: string;
  transactionId?: string; // Linked income transaction
}

export interface MileageLog {
  id: string;
  date: string;
  reading: number;
}

export interface PriceHistoryEntry {
  date: string; // ISO Date YYYY-MM-DD
  price: number;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number; // For Vehicle/Property, this is the CURRENT value.
  currency: Currency;
  icon?: string;
  last4?: string;
  financialInstitution?: string;
  website?: string; // Website / portal URL for institution/account
  symbol?: string; // Ticker symbol for investments/warrants

  // Banking specific
  accountNumber?: string; // IBAN or local account number
  routingNumber?: string; // BIC, SWIFT, Sort Code, or Routing Number
  apy?: number; // Annual Percentage Yield for savings
  openingDate?: string; // Date account was opened
  /** A fixed term (a bill, bond or term deposit) ends on this date, and the money is paid out or rolled into a new term. */
  maturityDate?: string;
  rollsOver?: boolean;
  balanceLastSyncedAt?: string;
  balanceSource?: 'enable_banking' | 'manual';

  // Card specific
  expirationDate?: string; // MM/YY
  cardNetwork?: string; // Visa, Mastercard, etc.
  cardholderName?: string;
  /** How the card is drawn: a colour id, its shade, and a pattern id (see utils/cardStyle). */
  cardColor?: string;
  cardShade?: 'light' | 'dark';
  cardPattern?: string;

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
  apr?: number; // Annual percentage rate (%) charged on a carried balance
  annualFee?: number; // Yearly card fee, in the account currency
  annualFeeDate?: string; // A date the fee is charged (YYYY-MM-DD); it recurs every year on this day. Falls back to the opening date.
  minimumPayment?: number; // Smallest payment that keeps the statement in good standing

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
  linkedAssetId?: string; // For Loans: link to Property or Vehicle

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
  /** Leased vehicles: the contract's residual (buy-out) value. Only then does the car count in net worth (Q5). */
  residualValue?: number;
  leasePaymentDay?: number;
  leasePaymentAccountId?: string;
  // Mileage
  mileageLogs?: MileageLog[];
  imageUrl?: string;
  priceHistory?: PriceHistoryEntry[];

  // Property specific
  address?: string;
  propertyType?: PropertyType;
  purchasePrice?: number; // Shared with Vehicle
  principalOwned?: number;
  /** Legacy. The loan's `linkedAssetId` is the only link now; this is migrated on load and only sent by the form. */
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
  /** Rentals: the months (YYYY-MM) the property stood empty. Rent isn't expected then. */
  vacantMonths?: string[];

  // Other Assets/Liabilities
  notes?: string;

  isPrimary?: boolean;
  includeInAnalytics?: boolean;
  sureId?: string;
  status?: 'open' | 'closed';
  closureDetails?: AssetClosureDetails;
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';
export type WeekendAdjustment = 'before' | 'after' | 'on';

export type EnableBankingConnectionStatus = 'disconnected' | 'pending' | 'ready' | 'requires_update';

export interface EnableBankingAccount {
  id: string;
  /** Persistent Enable Banking hash identifying the account across consent renewals. */
  identificationHash?: string;
  name: string;
  bankName: string;
  currency: Currency;
  balance: number;
  accountNumber?: string;
  linkedAccountId?: string;
  syncStartDate?: string;
  lastSyncedAt?: string;
  /** The bank's ids of synced transactions you deleted; sync skips them (utils/deletedSync.ts). */
  deletedTransactionIds?: string[];
}

export interface EnableBankingConnection {
  id: string;
  applicationId: string;
  countryCode: string;
  /** Never populated from the server; the private key is held server-side only (AUD-13). */
  clientCertificate?: string;
  status: EnableBankingConnectionStatus;
  selectedBank?: string;
  selectedBankId?: string;
  bankLogoUrl?: string;
  psuType?: 'personal' | 'business';
  maximumConsentValidity?: number;
  sessionId?: string;
  sessionExpiresAt?: string;
  authorizationId?: string;
  accounts: EnableBankingAccount[];
  lastSyncedAt?: string;
  lastError?: string;
}

export interface EnableBankingSyncOptions {
  transactionMode?: 'full' | 'incremental' | 'none';
  updateBalance?: boolean;
  syncStartDate?: string;
  targetAccountIds?: string[];
  /** Suppress the per-connection success toast (used by "sync all", which reports once). */
  silent?: boolean;
}

export type EnableBankingLinkPayload =
  | { linkedAccountId: string; syncStartDate: string }
  | { newAccount: Omit<Account, 'id'>; syncStartDate: string };

export interface RecurringTransaction {
  id: string;
  accountId: string; // from account for transfers
  toAccountId?: string; // to account for transfers
  description: string;
  merchant?: string; // Explicit merchant name
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
  /** The day you paused it. A paused item leaves totals and forecasts until you resume it (D-093). */
  pausedAt?: string;
  isSkipped?: boolean;
  /** Pays itself (a direct debit or card on file). Shown as a badge; no payment to make by hand. */
  autopay?: boolean;
  /** Where to pay or manage it online. */
  paymentUrl?: string;
  /** Days ahead to remind you (default 3). */
  notifyDaysBefore?: number;
  /** Days after the due date before it counts as overdue (default 0). */
  overdueGraceDays?: number;
  /** When a free trial ends and the first charge lands; you get a reminder. */
  trialEndsOn?: string;
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
  /** The occurrence of `recurringSourceId` this transaction paid (its original date). */
  recurringOccurrenceDate?: string;
  importId?: string;
  sureId?: string;
  principalAmount?: number;
  interestAmount?: number;
  tagIds?: string[];
  notes?: string;
  /** A property or vehicle this money was for: rent received, repairs, fuel, insurance. Feeds the asset's page. */
  assetId?: string;
  // Location & Physical Address data
  address?: string; // Full formatted address string
  placeName?: string; // Business / POI / Building name
  street?: string; // Street name + house number
  city?: string;
  postalCode?: string; // Postal code / ZIP
  state?: string; // State / Region / Province
  country?: string;
  latitude?: number;
  longitude?: number;
  locationLabel?: string; // Branch name or nickname (e.g. "Zaventem Branch")
  // Investment helpers
  isMarketAdjustment?: boolean;
  isBalanceAdjustment?: boolean;
  // Hierarchy helpers for Split & Combine transactions
  parentTransactionId?: string;
  isSplitParent?: boolean;
  isCombinedParent?: boolean;
  /** A one-off you do not want counted against budgets (a laptop, a deposit). Everything else still counts it. */
  excludeFromBudget?: boolean;
  /** Fields you edited on a bank-synced transaction. Sync leaves them alone (utils/lockedFields.ts). */
  lockedFields?: ('merchant' | 'description')[];
}

export interface DisplayTransaction extends Transaction {
  accountName?: string;
  isTransfer?: boolean;
  fromAccountName?: string;
  toAccountName?: string;
  fromAccountId?: string;
  toAccountId?: string;
  transferKind?: 'credit_card_settlement' | 'mortgage_payment' | 'loan_payment' | 'spare_change';
  transferLabel?: string;
  originalId?: string; // To keep track of the real ID for editing transfers
  spareChangeAmount?: number;
  transferExpenseAmount?: number;
  transferExpenseCurrency?: Currency;
  transferIncomeAmount?: number;
  transferIncomeCurrency?: Currency;
  isSubTransaction?: boolean;
  subItemCount?: number;
  isExpanded?: boolean;
}

export interface InvestmentTransaction {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  price: number; // Price per unit
  date: string;
  type: 'buy' | 'sell';
  /** The currency of `price`. Older trades have none and count as EUR (D-026). */
  currency?: Currency;
}

export interface HoldingSummary {
  symbol: string;
  name: string;
  quantity: number;
  remainingQuantity?: number;
  totalCost: number;
  currentValue: number;
  /** In the holding's own currency. `currentValue` and `totalCost` are in EUR. */
  currentPrice: number;
  currency?: Currency;
  /** True when no live or manual price exists, so currentValue falls back to the last trade price or cost basis. */
  priceUnavailable?: boolean;
  type: 'Standard' | 'Warrant';
  subType?: InvestmentSubType;
  warrantId?: string;
  color?: string;
}

export interface HoldingDistribution {
  name: string;
  value: number;
  color: string;
  [key: string]: any;
}

export interface HoldingsOverview {
  holdings: HoldingSummary[];
  totalValue: number;
  totalCostBasis: number;
  /** Cost basis of holdings without a price; excluded from gain/loss percentages. */
  unpricedCostBasis?: number;
  unpricedValue?: number;
  investedCapital: number;
  grantedCapital: number;
  distributionData: HoldingDistribution[];
  typeBreakdown: HoldingDistribution[];
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
  defaultCity?: string;
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
  icon?: string;
  description?: string;
}

export interface WidgetConfig {
  id: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type GoalType = 'one-time' | 'recurring';

export type GoalCategory = 'savings' | 'expense' | 'income';

export type GoalProjectionStatus = 'on-track' | 'at-risk' | 'off-track';

export interface GoalProjection {
  projectedDate: string;
  status: GoalProjectionStatus;
}

export interface FinancialGoal {
  id: string;
  name: string;
  type: GoalType;
  goalCategory?: GoalCategory;
  transactionType: 'income' | 'expense';
  amount: number; // This is the TARGET amount
  currentAmount: number; // This is the current saved amount
  currency: Currency;
  parentId?: string;
  isBucket?: boolean;
  paymentAccountId?: string;
  /** Savings goals: the account the money goes into. Contributions are a transfer from `paymentAccountId`. */
  destinationAccountId?: string;
  // One-time
  date?: string;
  // Recurring
  frequency?: RecurrenceFrequency;
  startDate?: string;
  endDate?: string;
  monthlyContribution?: number;
  dueDateOfMonth?: number;
  completed?: boolean;
  disabled?: boolean;
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
  categoryName: string; // Parent category name; kept in step with `categoryId` on load and on rename
  categoryId?: string; // Parent expense category id (Q8): survives a rename
  amount: number;
  period: 'monthly'; // For now, only monthly
  currency: Currency;
}

export interface BudgetSuggestion {
  categoryName: string;
  averageSpending: number;
  suggestedBudget: number;
}

export type HistoryType = 'import' | 'export' | 'restore';
export type HistoryStatus = 'Complete' | 'Failed' | 'In Progress';
export type ImportDataType = 'transactions' | 'accounts' | 'categories' | 'tags' | 'budgets' | 'schedule' | 'investments' | 'mint' | 'all' | 'snapshot';

export interface ImportExportHistoryItem {
  id: string;
  type: HistoryType;
  dataType: ImportDataType;
  fileName: string;
  date: string;
  status: HistoryStatus;
  itemCount: number;
  details?: string; // Summary of changes (e.g. "Restored 15 accounts, 200 transactions")
  importedData?: Record<string, any>[];
  errors?: Record<number, Record<string, string>>;
}

export type DefaultAccountOrder = 'manual' | 'name' | 'balance';

export interface MerchantLocation {
  id: string; // Unique identifier for the branch
  label?: string; // Branch nickname or label (e.g. "Zaventem", "Flagship Store", "Downtown")
  address: string; // Full formatted address string
  placeName?: string; // Business / POI / Building name (e.g. "IKEA")
  street?: string; // Street name + house number
  city?: string; // City / Municipality
  postalCode?: string; // Postal code / ZIP
  state?: string; // State / Region
  country?: string; // Country name
  latitude?: number; // Geocoded latitude
  longitude?: number; // Geocoded longitude
  isPrimary?: boolean; // Indicates the primary or default branch
}

export interface MerchantRule {
  category?: string;
  website?: string;
  logo?: string; // Custom logo override (e.g. 'amazon.com')
  notes?: string;
  isHidden?: boolean;
  isOnline?: boolean; // Online / Digital business (e.g. Amazon, Netflix, Spotify)
  defaultDescription?: string;
  address?: string; // Full formatted address string (primary/fallback)
  placeName?: string; // Business / POI / Building name (e.g. 'IKEA')
  street?: string; // Street name and house number (e.g. 'Weiveldlaan 19')
  city?: string; // City / Town
  postalCode?: string; // Postal code / ZIP
  state?: string; // State / Province
  country?: string; // Country name
  latitude?: number; // Geocoded latitude
  longitude?: number; // Geocoded longitude
  locations?: MerchantLocation[]; // Multiple addresses / branches
}

export interface RegexCategorizationRule {
  id: string;
  pattern: string;
  category: string;
  isActive: boolean;
  description?: string;
}

export type RuleFieldCondition = 'description' | 'merchant' | 'amount' | 'type' | 'category' | 'text';
export type RuleOperator = 'contains' | 'equals' | 'greater_than' | 'less_than' | 'starts_with' | 'ends_with' | 'matches' | 'is_merchant';
/** assetId's value is a Property or Vehicle account id (D-148). */
export type RuleFieldAction = 'merchant' | 'description' | 'category' | 'assetId';

export interface TransactionRuleCondition {
  field: RuleFieldCondition;
  operator: RuleOperator;
  value: string;
}

export interface TransactionRuleAction {
  field: RuleFieldAction;
  value: string;
}

export interface TransactionRule {
  id: string;
  name: string;
  isActive: boolean;
  conditions: TransactionRuleCondition[];
  actions: TransactionRuleAction[];
  priority?: number; // Order/priority of evaluation (higher numbers executed first)
  conditionLogic?: 'AND' | 'OR'; // Defaults to 'AND' for backward compatibility
  /** "Always file": one merchant's category and description. These run before other rules (D-105). */
  kind?: 'always';
}

export interface RuleExecutionLog {
  id: string;
  ruleId: string;
  ruleName: string;
  timestamp: string;
  txId: string;
  txDescription: string;
  txAmount: number;
  changeDetails: string;
  isReverted?: boolean;
  batchId?: string;
}

export interface RuleRunBackup {
  id?: string;
  batchId?: string;
  timestamp: string;
  ruleName?: string;
  transactions: {
    id: string;
    originalCategory: string;
    originalMerchant: string;
    originalDescription: string;
    /** Only on runs that could set a property or vehicle. Older runs never changed it. */
    originalAssetId?: string;
  }[];
}

export type AppFontCategory = 'sans' | 'serif' | 'display';

export type AppFont =
  | 'manrope'
  | 'plus-jakarta'
  | 'plus-jakarta-sans'
  | 'inter'
  | 'open-sans'
  | 'montserrat'
  | 'ubuntu'
  | 'delius'
  | 'crimson-pro'
  | 'neuton'
  | 'dm-serif-display'
  | 'noto-serif'
  | 'crete-round';

export interface SmartPriceBinding {
  url: string;
  selector: string;
  cookies?: string;
  lastFetchedPrice?: number;
  lastFetchedAt?: string;
}

export type InvestmentPriceSource = 'twelvedata' | 'web' | 'manual';

export interface InvestmentPriceConfig {
  source?: InvestmentPriceSource;
  ticker?: string;
  /** The listing to quote, for tickers traded in several places (D-026). */
  exchange?: string;
  /** The currency its prices are in. Without one, they count as EUR. */
  currency?: Currency;
  binding?: SmartPriceBinding;
  lastFetchedPrice?: number;
  lastFetchedAt?: string;
}

export interface AppPreferences {
  savedReportViews?: import('./utils/reportsModel').SavedReportView[];
  // Choices that follow you across devices (S-002).
  ignoredSubscriptions?: string[];
  ignoredBillMatches?: string[];
  dismissedBillNotifications?: string[];
  /** Insight card ids you dismissed on the Overview (utils/insightsModel.ts). */
  dismissedInsights?: string[];
  matcherConfig?: import('./utils/matcherConfig').MatcherConfig;
  /** Goals counted in the forecast. Unset until the first time goals are known. */
  activeGoalIds?: string[];
  knownGoalIds?: string[];
  currency: string;
  displayCurrency?: Currency;
  financialYearStartMonth?: number; // 1-12 (1 = Jan, 4 = April)
  language: string;
  timezone: string;
  dateFormat: string;
  defaultPeriod: Duration;
  defaultAccountOrder: DefaultAccountOrder;
  country: string;
  appFont?: AppFont;
  defaultQuickCreatePeriod?: number;
  defaultForecastPeriod?: ForecastDuration;
  brandfetchClientId?: string;
  twelveDataApiKey?: string;
  smartPriceBindings?: Record<string, SmartPriceBinding>;
  investmentPriceConfigs?: Record<string, InvestmentPriceConfig>;
  conversionRates?: Record<string, number>;
  /** Rates you set yourself, as the value in EUR of one unit. They win over fetched rates. */
  manualRates?: Record<string, number>;
  ratesUpdatedAt?: string;
  merchantLogoOverrides?: Record<string, string>; // Deprecated in favor of merchantRules, kept for backward compat if needed
  merchantRules?: Record<string, MerchantRule>; // Key is normalized merchant name
  hiddenMerchants?: string[]; // Deprecated in favor of merchantRules[x].isHidden
  isPrivacyMode?: boolean;
  excludeTransfersFromAnalytics?: boolean;
  dashboardLayouts?: Record<string, WidgetConfig[]>;
  /** Widget ids the user removed, per layout key; they are not re-added automatically. */
  dashboardHiddenWidgets?: Record<string, string[]>;
  /** Held back from Safe to spend, in EUR. */
  safeToSpendCushion?: number;
  /** Account-level flag (kept with the data, not the browser) so onboarding does not reappear on a new device. */
  onboardingCompleted?: boolean;
  /** Savings sprints the user started; synced across devices. */
  activeSprints?: { id: string; startDate: string }[];
  showBalanceAdjustments?: boolean;
  /** Moved into transactionRules. Only old data has this (D-105). */
  regexCategorizationRules?: RegexCategorizationRule[];
  transactionRules?: TransactionRule[];
  rulesVersion?: number;
  /** Idle minutes before Crystal locks. 0 means never. Unset means the default. */
  autoLockMinutes?: number;
  rulesMigrationBackup?: import('./utils/rulesMigration').RulesMigrationBackup;
  lastRuleRunBackup?: RuleRunBackup;
  ruleExecutionHistory?: RuleRunBackup[];
  ruleExecutionLogs?: RuleExecutionLog[];
}

// New types for Bills & Payments
export type BillPaymentStatus = 'unpaid' | 'paid' | 'expired';

export interface BillPayment {
  id: string;
  description: string;
  amount: number; // positive for deposit, negative for payment
  type: 'deposit' | 'payment';
  currency: Currency;
  dueDate: string;
  status: BillPaymentStatus;
  accountId?: string; // The account it was paid from/to
  warrantId?: string;
}

export interface AccountDetailProps {
  account: Account;
  setCurrentPage: (page: Page, tab?: string | null) => void;
  setViewingAccountId: (id: string | null) => void;
  saveAccount: (account: Omit<Account, 'id'> & { id?: string }) => void;
}

export interface Membership {
  id: string;
  provider: string; // e.g. "British Airways", "Starbucks"
  memberId: string;
  tier?: string; // e.g. "Gold"
  holderName?: string; // New: e.g. "John Doe"
  memberSince?: string; // New: e.g. "2019" or ISO date
  points?: string; // New: e.g. "50,000 pts" or "€150.00"
  expiryDate?: string; // ISO date
  color: string;
  icon: string;
  notes?: string;
  website?: string;
  category?: string;
}

// Invoice & Quote Types
export type InvoiceType = 'quote' | 'invoice';
export type InvoiceDirection = 'sent' | 'received';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'accepted' | 'rejected';

export interface InvoiceItem {
  id: string;
  sku?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  total: number;
}

export interface PaymentTerm {
  id: string;
  label: string; // e.g. "Deposit", "Completion"
  percentage: number; // % of total
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid';
}

export interface Invoice {
  id: string;
  type: InvoiceType;
  direction: InvoiceDirection;
  number: string;
  date: string; // ISO Date
  dueDate?: string; // ISO Date

  // Entity Info (Client if sent, Merchant if received)
  entityName: string;
  entityEmail?: string;
  entityAddress?: string;

  // Financials
  currency: Currency;
  items: InvoiceItem[];
  subtotal: number;
  globalDiscountValue?: number; // Flat discount on total
  taxRate?: number; // %
  taxAmount: number;
  total: number;

  // Payment Terms
  paymentTerms?: PaymentTerm[];

  status: InvoiceStatus;
  notes?: string;
}

export interface UserStats {
  currentStreak: number;
  longestStreak: number;
  lastLogDate: string; // ISO Date YYYY-MM-DD
  predictionWins?: number;
  predictionTotal?: number;
}

export type PredictionType = 'spending_cap' | 'net_worth_goal' | 'price_target';
export type PredictionStatus = 'active' | 'won' | 'lost';

export interface Prediction {
  id: string;
  type: PredictionType;
  targetId?: string; // Category Name for spending, Account ID for Net Worth (or null for total)
  targetName: string;
  targetAmount: number;
  startDate: string;
  endDate: string;
  status: PredictionStatus;
  finalAmount?: number; // Snapshot when resolved
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
  goalOrder?: string[];
  budgets: Budget[];
  tasks: Task[];
  taskOrder?: string[];
  warrants: Warrant[];
  memberships?: Membership[];
  importExportHistory: ImportExportHistoryItem[];
  incomeCategories: Category[];
  expenseCategories: Category[];
  preferences: AppPreferences;
  billsAndPayments: BillPayment[];
  accountOrder?: string[];
  tags?: Tag[];
  manualWarrantPrices?: Record<string, number | undefined>;
  priceHistory?: Record<string, PriceHistoryEntry[]>; // New field for price history
  invoices?: Invoice[];
  userStats?: UserStats;
  predictions?: Prediction[];
  enableBankingConnections?: EnableBankingConnection[];
  lastUpdatedAt?: string;
  userProfile?: User;
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
  linkedPage?: Page;
}

export interface Warrant {
  id: string;
  isin: string;
  name: string;
  grantDate: string;
  quantity: number;
  grantPrice: number;
  taxType?: 'amount' | 'percentage';
  taxValue?: number;
  taxAmount?: number;
  taxPayments?: PaymentTerm[];
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
  status: 'Paid' | 'Due' | 'Upcoming' | 'Overdue' | 'Deferred';
  deferralType?: 'full' | 'interest_only';
  extraPrincipal?: number;
  transactionId?: string;
  note?: string;
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
  isSkipped?: boolean;
  category?: string;
  merchant?: string;
  accountId?: string;
};
