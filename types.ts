

export type Currency = 'USD' | 'EUR' | 'GBP' | 'BTC' | 'RON' | 'JPY' | 'CAD' | 'AUD' | 'CHF' | 'CNY' | 'INR';

export type AccountType = 'Checking' | 'Savings' | 'Credit Card' | 'Investment' | 'Loan' | 'Property' | 'Vehicle' | 'Other Assets' | 'Other Liabilities' | 'Lending';

export type InvestmentSubType = 'Stock' | 'ETF' | 'Crypto' | 'Pension Fund' | 'Spare Change' | 'Other';
export type OtherAssetSubType = 'Cash' | 'Precious Metals' | 'Collectibles' | 'Art' | 'Business Equity' | 'Private Loan' | 'Electronics' | 'Furniture' | 'Other';
export type OtherLiabilitySubType = 'Tax' | 'Private Debt' | 'Legal Settlement' | 'Business Debt' | 'Other';
export type PropertyType = 'Apartment' | 'Detached House' | 'Semi-Detached House' | 'Terraced House' | 'Land' | 'Commercial' | 'Other';
export type VehicleOwnership = 'Owned' | 'Leased';
export type FuelType = 'Gasoline' | 'Diesel' | 'Electric' | 'Hybrid' | 'LPG';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type WeekendAdjustment = 'on' | 'before' | 'after';
export type DefaultAccountOrder = 'manual' | 'name' | 'balance';
export type Duration = 'TODAY' | 'WTD' | 'MTD' | '30D' | '60D' | '90D' | '6M' | 'YTD' | '1Y' | 'ALL';
export type ForecastDuration = '3M' | '6M' | 'EOY' | '1Y';

export type Page = 'Dashboard' | 'Accounts' | 'Transactions' | 'Budget' | 'Forecasting' | 'Investments' | 'Schedule & Bills' | 'Subscriptions' | 'Quotes & Invoices' | 'Tasks' | 'Challenges' | 'Settings' | 'Personal Info' | 'Preferences' | 'Integrations' | 'Merchants' | 'AI Assistant' | 'Data Management' | 'AccountDetail' | 'Categories' | 'Tags' | 'Documentation';

export type Theme = 'light' | 'dark' | 'system';

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
    includeInAnalytics?: boolean;
    status?: 'open' | 'closed';
    
    // Banking
    financialInstitution?: string;
    accountNumber?: string;
    routingNumber?: string;
    apy?: number;
    openingDate?: string;

    // Credit Card
    creditLimit?: number;
    last4?: string;
    expirationDate?: string;
    cardNetwork?: string;
    cardholderName?: string;
    statementStartDate?: number;
    paymentDate?: number;
    settlementAccountId?: string;

    // Investment
    subType?: InvestmentSubType;
    symbol?: string;
    expectedRetirementYear?: number;
    linkedAccountId?: string; // For Spare Change or Loan payment source

    // Property
    propertyType?: PropertyType;
    address?: string;
    purchasePrice?: number;
    principalOwned?: number;
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
    leaseProvider?: string;
    leaseStartDate?: string;
    leaseEndDate?: string;
    annualMileageAllowance?: number;
    leasePaymentAmount?: number;
    leasePaymentDay?: number;
    leasePaymentAccountId?: string;
    mileageLogs?: MileageLog[];
    imageUrl?: string;

    // Loan / Lending
    totalAmount?: number;
    principalAmount?: number;
    interestAmount?: number;
    downPayment?: number;
    duration?: number; // months
    interestRate?: number;
    loanStartDate?: string;
    monthlyPayment?: number;
    paymentDayOfMonth?: number;

    // Other
    otherSubType?: OtherAssetSubType | OtherLiabilitySubType;
    location?: string;
    assetCondition?: string;
    counterparty?: string;
    notes?: string;
    
    // Enable Banking
    balanceLastSyncedAt?: string;
    balanceSource?: 'enable_banking' | 'manual';
}

export interface Transaction {
    id: string;
    accountId: string;
    date: string;
    amount: number;
    currency: Currency;
    description: string;
    category: string;
    type: 'income' | 'expense'; // 'transfer' is handled via transferId usually, but UI might use 'transfer' type temporarily
    merchant?: string;
    transferId?: string;
    isTransfer?: boolean; // UI helper
    tagIds?: string[];
    
    // Investment specific
    price?: number;
    quantity?: number;
    symbol?: string;
    
    // Location
    city?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    
    // Meta
    isMarketAdjustment?: boolean;
    importId?: string;
    
    // Split loan payment details attached to transaction
    principalAmount?: number;
    interestAmount?: number;
    
    // Original IDs for tracking
    originalId?: string;
}

export interface DisplayTransaction extends Transaction {
    accountName?: string;
    fromAccountName?: string;
    toAccountName?: string;
    transferExpenseAmount?: number;
    transferExpenseCurrency?: Currency;
    transferIncomeAmount?: number;
    transferIncomeCurrency?: Currency;
    spareChangeAmount?: number;
    formattedDate?: string;
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

export interface Budget {
    id: string;
    categoryName: string;
    amount: number;
    period: 'monthly' | 'yearly';
    currency: Currency;
}

export type GoalType = 'one-time' | 'recurring';

export interface FinancialGoal {
    id: string;
    name: string;
    amount: number;
    currentAmount: number;
    currency: Currency;
    transactionType: 'income' | 'expense';
    
    // Target Date (One-time)
    type: GoalType;
    date?: string; // Target date

    // Recurring
    frequency?: RecurrenceFrequency;
    startDate?: string;
    monthlyContribution?: number;
    dueDateOfMonth?: number;
    
    // Bucket
    isBucket?: boolean;
    parentId?: string;
    
    // Linking
    paymentAccountId?: string;
    
    // UI
    projection?: {
        projectedDate?: string;
        status: 'on-track' | 'at-risk' | 'off-track';
    };
}

export interface RecurringTransaction {
    id: string;
    accountId: string;
    toAccountId?: string;
    description: string;
    amount: number;
    currency: Currency;
    type: 'income' | 'expense' | 'transfer';
    category?: string;
    frequency: RecurrenceFrequency;
    frequencyInterval?: number;
    startDate: string;
    endDate?: string;
    nextDueDate: string;
    dueDateOfMonth?: number;
    weekendAdjustment?: WeekendAdjustment;
    isSynthetic?: boolean;
    isSkipped?: boolean;
}

export interface BillPayment {
    id: string;
    description: string;
    amount: number;
    currency: Currency;
    dueDate: string;
    status: 'paid' | 'unpaid';
    type: 'payment' | 'deposit';
    accountId?: string;
    category?: string;
}

export interface RecurringTransactionOverride {
    recurringTransactionId: string;
    originalDate: string;
    date?: string;
    amount?: number;
    description?: string;
    isSkipped?: boolean;
    principal?: number;
    interest?: number;
    totalPayment?: number;
}

export interface LoanPaymentOverrides {
    [accountId: string]: Record<number, Partial<ScheduledPayment>>;
}

export interface ScheduledPayment {
    paymentNumber: number;
    date: string;
    totalPayment: number;
    principal: number;
    interest: number;
    outstandingBalance: number;
    status: 'Paid' | 'Upcoming' | 'Overdue';
    transactionId?: string;
}

export interface ScheduledItem {
    id: string;
    date: string;
    description: string;
    amount: number;
    type: 'income' | 'expense' | 'transfer' | 'payment' | 'deposit';
    accountName?: string;
    isRecurring: boolean;
    originalItem: RecurringTransaction | BillPayment;
    isTransfer?: boolean;
    isOverride?: boolean;
    originalDateForOverride?: string;
    isSkipped?: boolean;
}

export interface Tag {
    id: string;
    name: string;
    color: string;
    icon: string;
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

export interface PriceHistoryEntry {
    date: string;
    price: number;
}

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

export type TaskPriority = 'Low' | 'Medium' | 'High';
export type TaskStatus = 'To Do' | 'In Progress' | 'Done';

export interface Task {
    id: string;
    title: string;
    description?: string;
    dueDate?: string;
    reminderDate?: string;
    status: TaskStatus;
    priority: TaskPriority;
}

export type ImportDataType = 'transactions' | 'accounts';
export type HistoryStatus = 'Complete' | 'Failed' | 'In Progress';

export interface ImportExportHistoryItem {
    id: string;
    date: string;
    type: 'import' | 'export';
    dataType: string;
    fileName?: string;
    itemCount: number;
    status: HistoryStatus;
    importedData?: any[];
    errors?: Record<number, any>;
}

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

export interface UserStats {
    currentStreak: number;
    longestStreak: number;
    lastLogDate: string;
    predictionWins: number;
    predictionTotal: number;
}

export interface AppPreferences {
    currency: string; // e.g. "EUR (€)"
    language: string;
    timezone: string;
    dateFormat: string;
    defaultPeriod: Duration;
    defaultAccountOrder: DefaultAccountOrder;
    country: string;
    defaultForecastPeriod: ForecastDuration;
    defaultQuickCreatePeriod?: number;
    brandfetchClientId?: string;
    twelveDataApiKey?: string;
    geminiApiKey?: string;
    merchantLogoOverrides?: Record<string, string>;
    hiddenMerchants?: string[];
}

export type PredictionType = 'spending_cap' | 'net_worth_goal' | 'price_target';

export interface Prediction {
    id: string;
    type: PredictionType;
    targetId?: string; // Category Name, Account ID, or Symbol
    targetName: string;
    targetAmount: number;
    startDate: string;
    endDate: string;
    status: 'active' | 'won' | 'lost';
    finalAmount?: number;
}

// Enable Banking
export interface EnableBankingConnection {
  id: string;
  applicationId: string;
  countryCode: string;
  clientCertificate: string;
  selectedBank: string;
  status: 'pending' | 'ready' | 'requires_update' | 'disconnected';
  sessionId?: string;
  sessionExpiresAt?: string;
  authorizationId?: string;
  lastSyncedAt?: string;
  lastError?: string;
  accounts: EnableBankingAccount[];
}

export interface EnableBankingAccount {
  id: string; // ASPSP account ID
  accountNumber?: string;
  currency?: string;
  linkedAccountId?: string;
  lastSyncedAt?: string;
  syncStartDate?: string;
}

export interface EnableBankingLinkPayload {
    linkedAccountId?: string;
    newAccount?: Partial<Account>;
    syncStartDate: string;
}

export interface EnableBankingSyncOptions {
    transactionMode?: 'full' | 'incremental' | 'none';
    updateBalance?: boolean;
    syncStartDate?: string;
    targetAccountIds?: string[];
}

export interface BudgetSuggestion {
    categoryName: string;
    averageSpending: number;
    suggestedBudget: number;
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
    color?: string;
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

export interface HoldingDistribution {
    name: string;
    value: number;
    color: string;
}

export interface CategorySpending {
    name: string;
    value: number;
    color: string;
    icon?: string;
}

export interface Widget {
    id: string;
    name: string;
    type: string;
    w: number;
    h: number;
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
    tags: Tag[];
    incomeCategories: Category[];
    expenseCategories: Category[];
    billsAndPayments: BillPayment[];
    accountOrder: string[];
    taskOrder: string[];
    manualWarrantPrices: Record<string, number | undefined>;
    priceHistory: Record<string, PriceHistoryEntry[]>;
    invoices: Invoice[]; 
    userStats: UserStats;
    predictions: Prediction[];
    enableBankingConnections: EnableBankingConnection[];
    // Key: YYYY-MM-DD, Value: Balance
    forecastSnapshots?: Record<string, number>;
    lastUpdatedAt?: string;
    userProfile?: User;
    preferences?: AppPreferences;
    enableBankingPendingConnections?: Record<string, EnableBankingConnection>;
}

export interface InvoiceItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    discountPercent?: number;
    sku?: string;
}

export type InvoiceType = 'invoice' | 'quote';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'accepted' | 'rejected';
export type InvoiceDirection = 'sent' | 'received';

export interface PaymentTerm {
    id: string;
    label: string;
    days: number;
}

export interface Invoice {
    id: string;
    type: InvoiceType;
    direction: InvoiceDirection;
    number: string;
    date: string;
    dueDate?: string;
    
    // Entity
    entityName: string;
    entityEmail?: string;
    entityAddress?: string;
    
    // Financials
    currency: Currency;
    items: InvoiceItem[];
    subtotal: number;
    globalDiscountValue?: number;
    taxRate?: number;
    taxAmount?: number;
    total: number;
    
    status: InvoiceStatus;
    notes?: string;
    paymentTerms?: PaymentTerm[];
}