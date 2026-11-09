import { useId } from 'react';

import { CURRENCY_CODES, currencyPreference } from './utils/currencies';
import { Category, Page, AccountType, Currency, RecurrenceFrequency, WeekendAdjustment, DefaultAccountOrder, Duration, InvestmentSubType, PropertyType, FuelType, VehicleOwnership, ForecastDuration, OtherAssetSubType, OtherLiabilitySubType } from './types';
import { ICON_LIBRARY } from './utils/materialSymbols';


/**
 * The Crystal mark: a cluster of three crystals, an amber one between two green ones, with a
 * sparkle (D-153). Colours come from the --logo-* tokens, so it follows light and dark. The amber
 * crystal is cut out of the green ones with a thin gap, so the cluster reads on any background.
 * public/favicon.svg is the same drawing without the sparkle and highlight, for 16 px.
 */
export function CrystalLogo({ showText = true, size }: { showText?: boolean; size?: number }) {
  const px = size ?? (showText ? 120 : 40);
  const maskId = `crystal-logo-${useId().replace(/:/g, '')}`;

  return (
    <svg width={px} height={px} viewBox="3 2.2 58 58" role="img" aria-label="Crystal" className="block shrink-0">
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="-8" y="-8" width="80" height="80"><rect x="-8" y="-8" width="80" height="80" fill="#fff" /><polygon points="22.5,53 22.5,18.78 32,7 41.5,18.78 41.5,53 33.14,57.75" fill="#000" stroke="#000" strokeWidth="3" strokeLinejoin="round" /></mask>
      </defs>
      <g strokeWidth="1" strokeLinejoin="round">
        <g mask={`url(#${maskId})`}>
        <g transform="rotate(-26 22 48)">
        <polygon points="14.5,27.3 22.9,30.3 22.9,51.75 14.5,48" fill="var(--logo-green-2)" stroke="var(--logo-green-2)" />
        <polygon points="22.9,30.3 29.5,27.3 29.5,48 22.9,51.75" fill="var(--logo-green-3)" stroke="var(--logo-green-3)" />
        <polygon points="14.5,27.3 22,18 22.9,30.3" fill="var(--logo-green-1)" stroke="var(--logo-green-1)" />
        <polygon points="22,18 29.5,27.3 22.9,30.3" fill="var(--logo-green-2)" stroke="var(--logo-green-2)" />
        </g>
        <g transform="rotate(26 42 48)">
        <polygon points="34.5,27.3 42.9,30.3 42.9,51.75 34.5,48" fill="var(--logo-green-2)" stroke="var(--logo-green-2)" />
        <polygon points="42.9,30.3 49.5,27.3 49.5,48 42.9,51.75" fill="var(--logo-green-3)" stroke="var(--logo-green-3)" />
        <polygon points="34.5,27.3 42,18 42.9,30.3" fill="var(--logo-green-1)" stroke="var(--logo-green-1)" />
        <polygon points="42,18 49.5,27.3 42.9,30.3" fill="var(--logo-green-2)" stroke="var(--logo-green-2)" />
        </g>
        </g>
        <g>
        <polygon points="22.5,18.78 33.14,22.58 33.14,57.75 22.5,53" fill="var(--logo-amber-2)" stroke="var(--logo-amber-2)" />
        <polygon points="33.14,22.58 41.5,18.78 41.5,53 33.14,57.75" fill="var(--logo-amber-3)" stroke="var(--logo-amber-3)" />
        <polygon points="22.5,18.78 32,7 33.14,22.58" fill="var(--logo-amber-1)" stroke="var(--logo-amber-1)" />
        <polygon points="32,7 41.5,18.78 33.14,22.58" fill="var(--logo-amber-2)" stroke="var(--logo-amber-2)" />
        <rect x="26.3" y="25.43" width="1.9" height="19.32" rx="0.95" fill="var(--logo-amber-1)" stroke="var(--logo-amber-1)" opacity="0.85" />
        </g>
        <path d="M53 4.5Q53.88 9.12 58.5 10Q53.88 10.88 53 15.5Q52.12 10.88 47.5 10Q52.12 9.12 53 4.5Z" fill="var(--logo-spark)" stroke="var(--logo-spark)" />
      </g>
    </svg>
  );
}



// Semantic Status Tokens from Design System Blueprint
export const STATUS_TOKENS = {
  optimal: {
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    lightBadge: 'bg-emerald-50 text-emerald-900 border-emerald-200/80',
    hex: '#10B981',
  },
  elevated: {
    badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
    lightBadge: 'bg-rose-50 text-rose-900 border-rose-200/80',
    hex: '#EF4444',
  },
  low: {
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    lightBadge: 'bg-amber-50 text-amber-950 border-amber-200/90',
    hex: '#F59E0B',
  },
  normal: {
    badge: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
    lightBadge: 'bg-cyan-50 text-cyan-900 border-cyan-200/80',
    hex: '#06B6D4',
  },
} as const;

// Backward-compatible Status Color Tokens
export const STATUS_DANGER_TEXT = "text-rose-700 dark:text-rose-400";
export const STATUS_DANGER_BG = "bg-rose-500/10 dark:bg-rose-500/20";
export const STATUS_DANGER_BORDER = "border-rose-500/20 dark:border-rose-500/30";
export const STATUS_DANGER_BADGE = "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30";

export const STATUS_SUCCESS_TEXT = "text-emerald-700 dark:text-emerald-400";
export const STATUS_SUCCESS_BG = "bg-emerald-500/10 dark:bg-emerald-500/20";
export const STATUS_SUCCESS_BORDER = "border-emerald-500/20 dark:border-emerald-500/30";
export const STATUS_SUCCESS_BADGE = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30";

export const STATUS_WARNING_TEXT = "text-amber-700 dark:text-amber-400";
export const STATUS_WARNING_BG = "bg-amber-500/10 dark:bg-amber-500/20";
export const STATUS_WARNING_BORDER = "border-amber-500/20 dark:border-amber-500/30";
export const STATUS_WARNING_BADGE = "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30";

export const STATUS_INFO_TEXT = "text-cyan-700 dark:text-cyan-400";
export const STATUS_INFO_BG = "bg-cyan-500/10 dark:bg-cyan-500/20";
export const STATUS_INFO_BORDER = "border-cyan-500/20 dark:border-cyan-500/30";
export const STATUS_INFO_BADGE = "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30";

// Stacking Order Hierarchy


export const BRAND_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

export const CATEGORY_TAG_PRESET_COLORS = [
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#84CC16',
  '#10B981',
  '#06B6D4',
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#F43F5E',
  '#64748B',
];

export interface NavItem {
  name: Page;
  icon: string;
  subItems?: NavItem[];
}

export const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', icon: 'dashboard-square-01' },
  { name: 'Accounts', icon: 'layers-01' },
  { name: 'Transactions', icon: 'arrow-data-transfer-horizontal' },
  { name: 'Reports', icon: 'analytics-01' },
  { name: 'Budget', icon: 'pie-chart-01' },
  { name: 'Forecasting', icon: 'chart-evaluation' },
  { name: 'Investments', icon: 'chart-increase' },
  { name: 'Schedule & Bills', icon: 'calendar-03' },
  { name: 'Subscriptions', icon: 'repeat-one-01' },
  { name: 'Quotes & Invoices', icon: 'invoice-02' },
  { name: 'Tasks', icon: 'task-01' },
  { name: 'Challenges', icon: 'award-01' },
  { name: 'Categories', icon: 'folder-01' },
  { name: 'Tags', icon: 'tag-01' },
  { name: 'Merchants', icon: 'store-01' },
  { name: 'Rules', icon: 'flash' },
  { name: 'Integrations', icon: 'bank' },
  { name: 'Data Management', icon: 'download-04' },
  { name: 'Documentation', icon: 'book-open-01' },
];

export const ITEM_COLORS: Record<string, string> = {
  'Dashboard': 'indigo',
  'Accounts': 'emerald',
  'Transactions': 'amber',
  'Reports': 'blue',
  'Budget': 'purple',
  'Forecasting': 'teal',
  'Investments': 'teal',
  'Challenges': 'gold',
  'Schedule & Bills': 'orange',
  'Subscriptions': 'rose',
  'Quotes & Invoices': 'violet',
  'Tasks': 'lime',
  'Categories': 'amber',
  'Tags': 'pink',
  'Merchants': 'neutral',
  'Rules': 'teal',
  'Integrations': 'emerald',
  'Data Management': 'amber',
  'Documentation': 'neutral',
};

export const ASSET_TYPES: AccountType[] = ['Checking', 'Savings', 'Investment', 'Property', 'Vehicle', 'Other Assets', 'Lending'];
export const DEBT_TYPES: AccountType[] = ['Credit Card', 'Loan', 'Other Liabilities'];
export const ALL_ACCOUNT_TYPES: AccountType[] = [...ASSET_TYPES, ...DEBT_TYPES];
export const LIQUID_ACCOUNT_TYPES: AccountType[] = ['Checking', 'Savings', 'Credit Card'];
export const CURRENCIES: Currency[] = CURRENCY_CODES;
export const INVESTMENT_SUB_TYPES: InvestmentSubType[] = ['Stock', 'ETF', 'Crypto', 'Warrant', 'Pension Fund', 'Spare Change', 'Other'];
export const PROPERTY_TYPES: PropertyType[] = ['Apartment', 'Detached House', 'Semi-Detached House', 'Terraced House', 'Land', 'Commercial', 'Other'];
export const FUEL_TYPES: FuelType[] = ['Gasoline', 'Diesel', 'Electric', 'Hybrid', 'LPG'];
export const VEHICLE_OWNERSHIP_TYPES: VehicleOwnership[] = ['Owned', 'Leased'];
export const OTHER_ASSET_SUB_TYPES: OtherAssetSubType[] = ['Cash', 'Precious Metals', 'Collectibles', 'Art', 'Business Equity', 'Private Loan', 'Electronics', 'Furniture', 'Other'];
export const OTHER_LIABILITY_SUB_TYPES: OtherLiabilitySubType[] = ['Tax', 'Private Debt', 'Legal Settlement', 'Business Debt', 'Other'];

export const CARD_NETWORKS = ['Visa', 'Mastercard', 'American Express', 'Discover', 'UnionPay', 'JCB', 'Other'];

export const FREQUENCIES: { value: RecurrenceFrequency, label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' }
];

export const WEEKEND_ADJUSTMENTS: { value: WeekendAdjustment, label: string }[] = [
  { value: 'on', label: 'On the exact day' },
  { value: 'before', label: 'Friday before' },
  { value: 'after', label: 'Monday after' },
];

export const CURRENCY_OPTIONS = CURRENCY_CODES.map(currencyPreference);

export const TIMEZONE_OPTIONS = [
  "Pacific/Midway", "Pacific/Honolulu", "America/Anchorage", "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "America/Caracas", "America/Halifax", "America/Sao_Paulo", "Atlantic/Azores", "Etc/GMT", "Europe/London", "Europe/Brussels", "Europe/Athens", "Europe/Moscow", "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Dhaka", "Asia/Bangkok", "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland"
];

export const COUNTRY_OPTIONS = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo, Democratic Republic of the", "Congo, Republic of the", "Costa Rica", "Cote d'Ivoire", "Croatia", "Cuba", "Cyprus", "Czechia", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

export const DURATION_OPTIONS: { label: string; value: Duration }[] = [
  { label: 'Today', value: 'TODAY' },
  { label: 'Week to date', value: 'WTD' },
  { label: 'Month to date', value: 'MTD' },
  { label: '30 days', value: '30D' },
  { label: '60 days', value: '60D' },
  { label: '90 days', value: '90D' },
  { label: '6 months', value: '6M' },
  { label: 'Year to date', value: 'YTD' },
  { label: '1 year', value: '1Y' },
  { label: 'All time', value: 'ALL' },
];

export const FORECAST_DURATION_OPTIONS: { label: string; value: ForecastDuration }[] = [
  { label: '3M', value: '3M' },
  { label: '6M', value: '6M' },
  { label: 'EOY', value: 'EOY' },
  { label: '1Y', value: '1Y' },
];

export const DEFAULT_ACCOUNT_ORDER_OPTIONS: { value: DefaultAccountOrder, label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'name', label: 'Name (A-Z)' },
  { value: 'balance', label: 'Balance (High-Low)' },
];

export const QUICK_CREATE_BUDGET_OPTIONS: { value: number, label: string, shortLabel: string }[] = [
  { value: 1, label: "Replicate last month's spending", shortLabel: 'Last Month' },
  { value: 3, label: 'Average of previous 3 months', shortLabel: '3-Month Avg' },
  { value: 6, label: 'Average of previous 6 months', shortLabel: '6-Month Avg' },
  { value: 12, label: 'Average of previous 12 months', shortLabel: '12-Month Avg' },
];


export const ACCOUNT_TYPE_STYLES: { [key in AccountType]: { icon: string } } = {
  'Checking': { icon: 'bank' },
  'Savings': { icon: 'piggy-bank' },
  'Credit Card': { icon: 'credit-card' },
  'Investment': { icon: 'chart-line-data-01' },
  'Loan': { icon: 'agreement-01' },
  'Lending': { icon: 'money-receive-01' },
  'Property': { icon: 'building-03' },
  'Vehicle': { icon: 'car-01' },
  'Other Assets': { icon: 'package' },
  'Other Liabilities': { icon: 'receipt' },
};

export const INVESTMENT_SUB_TYPE_STYLES: { [key in InvestmentSubType]: { icon: string } } = {
  'Stock': { icon: 'chart-line-data-01' },
  'ETF': { icon: 'chart-column' },
  'Crypto': { icon: 'bitcoin' },
  'Warrant': { icon: 'certificate-01' },
  'Pension Fund': { icon: 'safe' },
  'Spare Change': { icon: 'coins-01' },
  'Other': { icon: 'package' },
};

export const OTHER_ASSET_SUB_TYPE_STYLES: { [key in OtherAssetSubType]: { icon: string } } = {
  'Cash': { icon: 'wallet-02' },
  'Precious Metals': { icon: 'coins-01' },
  'Collectibles': { icon: 'shopping-bag-01' },
  'Art': { icon: 'palette' },
  'Business Equity': { icon: 'store-01' },
  'Private Loan': { icon: 'agreement-01' },
  'Electronics': { icon: 'laptop' },
  'Furniture': { icon: 'home-01' },
  'Meal Voucher': { icon: 'credit-card' },
  'Other': { icon: 'package' },
};

export const OTHER_LIABILITY_SUB_TYPE_STYLES: { [key in OtherLiabilitySubType]: { icon: string } } = {
  'Tax': { icon: 'balance-scale' },
  'Private Debt': { icon: 'agreement-01' },
  'Legal Settlement': { icon: 'balance-scale' },
  'Business Debt': { icon: 'store-01' },
  'Other': { icon: 'receipt' },
};


// Mock data for current prices, as we don't have a live API
export const MOCK_CURRENT_PRICES: Record<string, number> = {
  'AAPL': 175.50,
  'GOOGL': 115.20,
  'TSLA': 240.80,
  'MSFT': 310.00,
  'BTC': 68000.00,
};

export const MOCK_INCOME_CATEGORIES: Category[] = [
  { id: 'inc-1', name: 'Salary', color: '#10B981', icon: 'briefcase-01', classification: 'income', subCategories: [{ id: 'inc-1a', name: 'Fixed Salary', color: '#10B981', icon: 'briefcase-01', classification: 'income', subCategories: [], parentId: 'inc-1' }, { id: 'inc-1b', name: 'Bonus Salary', color: '#10B981', icon: 'coins-01', classification: 'income', subCategories: [], parentId: 'inc-1' }] },
  { id: 'inc-6', name: 'Side Hustle / Freelance', color: '#14B8A6', icon: 'laptop', classification: 'income', subCategories: [] },
  { id: 'inc-7', name: 'Rental Income', color: '#8B5CF6', icon: 'building-03', classification: 'income', subCategories: [] },
  { id: 'inc-5', name: 'Investments & Dividends', color: '#6366F1', icon: 'chart-increase', classification: 'income', subCategories: [] },
  { id: 'inc-2', name: 'Refunds & Payback', color: '#F59E0B', icon: 'arrow-turn-backward', classification: 'income', subCategories: [] },
  { id: 'inc-3', name: 'Government & Benefits', color: '#3B82F6', icon: 'agreement-01', classification: 'income', subCategories: [] },
  { id: 'inc-8', name: 'Gifts Received', color: '#EC4899', icon: 'gift', classification: 'income', subCategories: [] },
  { id: 'inc-4', name: 'Other Income', color: '#64748B', icon: 'coins-01', classification: 'income', subCategories: [] },
];

export const MOCK_EXPENSE_CATEGORIES: Category[] = [
  {
    id: 'exp-1', name: 'Housing', color: '#EF4444', icon: 'home-01', classification: 'expense', subCategories: [
      { id: 'exp-1a', name: 'Mortgage', color: '#EF4444', icon: 'agreement-01', classification: 'expense', subCategories: [], parentId: 'exp-1' },
      { id: 'exp-1d', name: 'Rent', color: '#EF4444', icon: 'building-03', classification: 'expense', subCategories: [], parentId: 'exp-1' },
      { id: 'exp-1b', name: 'Maintenance & Repairs', color: '#EF4444', icon: 'wrench-01', classification: 'expense', subCategories: [], parentId: 'exp-1' },
      { id: 'exp-1e', name: 'Home Insurance', color: '#EF4444', icon: 'shield-01', classification: 'expense', subCategories: [], parentId: 'exp-1' },
      { id: 'exp-1f', name: 'HOA / Body Corp', color: '#EF4444', icon: 'key-01', classification: 'expense', subCategories: [], parentId: 'exp-1' }
    ]
  },
  {
    id: 'exp-2', name: 'Food & Groceries', color: '#F97316', icon: 'shopping-cart-01', classification: 'expense', subCategories: [
      { id: 'exp-2a', name: 'Supermarket', color: '#F97316', icon: 'shopping-cart-01', classification: 'expense', subCategories: [], parentId: 'exp-2' },
      { id: 'exp-2b', name: 'Dining Out', color: '#F97316', icon: 'restaurant-01', classification: 'expense', subCategories: [], parentId: 'exp-2' },
      { id: 'exp-2c', name: 'Cafes & Snacks', color: '#F97316', icon: 'coffee-01', classification: 'expense', subCategories: [], parentId: 'exp-2' },
      { id: 'exp-2d', name: 'Delivery & Takeaway', color: '#F97316', icon: 'package', classification: 'expense', subCategories: [], parentId: 'exp-2' }
    ]
  },
  {
    id: 'exp-3', name: 'Transportation', color: '#3B82F6', icon: 'car-01', classification: 'expense', subCategories: [
      { id: 'exp-3a', name: 'Public Transport', color: '#3B82F6', icon: 'bus-01', classification: 'expense', subCategories: [], parentId: 'exp-3' },
      { id: 'exp-3c', name: 'Fuel / Charging', color: '#3B82F6', icon: 'fuel-station', classification: 'expense', subCategories: [], parentId: 'exp-3' },
      { id: 'exp-3f', name: 'Vehicle Insurance', color: '#3B82F6', icon: 'shield-01', classification: 'expense', subCategories: [], parentId: 'exp-3' },
      { id: 'exp-3g', name: 'Service & Maintenance', color: '#3B82F6', icon: 'wrench-01', classification: 'expense', subCategories: [], parentId: 'exp-3' },
      { id: 'exp-3b', name: 'Ride-Hailing', color: '#3B82F6', icon: 'car-01', classification: 'expense', subCategories: [], parentId: 'exp-3' },
      { id: 'exp-3d', name: 'Parking & Tolls', color: '#3B82F6', icon: 'ticket-01', classification: 'expense', subCategories: [], parentId: 'exp-3' },
      { id: 'exp-3h', name: 'Fines (Parking, Speeding & Traffic)', color: '#3B82F6', icon: 'balance-scale', classification: 'expense', subCategories: [], parentId: 'exp-3' }
    ]
  },
  {
    id: 'exp-4', name: 'Shopping & Lifestyle', color: '#8B5CF6', icon: 'shopping-bag-01', classification: 'expense', subCategories: [
      { id: 'exp-4b', name: 'Clothing & Apparel', color: '#8B5CF6', icon: 'shopping-bag-01', classification: 'expense', subCategories: [], parentId: 'exp-4' },
      { id: 'exp-4a', name: 'Electronics & Gadgets', color: '#8B5CF6', icon: 'cpu', classification: 'expense', subCategories: [], parentId: 'exp-4' },
      { id: 'exp-4c', name: 'Home & Garden', color: '#8B5CF6', icon: 'home-01', classification: 'expense', subCategories: [], parentId: 'exp-4' },
      { id: 'exp-4d', name: 'Beauty & Personal Care', color: '#8B5CF6', icon: 'sparkles', classification: 'expense', subCategories: [], parentId: 'exp-4' }
    ]
  },
  {
    id: 'exp-5', name: 'Bills & Utilities', color: '#0EA5E9', icon: 'invoice-02', classification: 'expense', subCategories: [
      { id: 'exp-5b', name: 'Utilities (Gas, Water, Elec)', color: '#0EA5E9', icon: 'flash', classification: 'expense', subCategories: [], parentId: 'exp-5' },
      { id: 'exp-5a', name: 'Internet & TV', color: '#0EA5E9', icon: 'wifi-01', classification: 'expense', subCategories: [], parentId: 'exp-5' },
      { id: 'exp-5d', name: 'Mobile Phone', color: '#0EA5E9', icon: 'smart-phone-01', classification: 'expense', subCategories: [], parentId: 'exp-5' },
      { id: 'exp-5c', name: 'Services', color: '#0EA5E9', icon: 'wrench-01', classification: 'expense', subCategories: [], parentId: 'exp-5' }
    ]
  },
  {
    id: 'exp-12', name: 'Software & Subscriptions', color: '#6366F1', icon: 'repeat-one-01', classification: 'expense', subCategories: [
      { id: 'exp-12a', name: 'Streaming Services', color: '#6366F1', icon: 'video-01', classification: 'expense', subCategories: [], parentId: 'exp-12' },
      { id: 'exp-12b', name: 'Apps & Software', color: '#6366F1', icon: 'laptop', classification: 'expense', subCategories: [], parentId: 'exp-12' },
      { id: 'exp-12c', name: 'Cloud Storage', color: '#6366F1', icon: 'cloud', classification: 'expense', subCategories: [], parentId: 'exp-12' }
    ]
  },
  {
    id: 'exp-6', name: 'Entertainment', color: '#EC4899', icon: 'video-01', classification: 'expense', subCategories: [
      { id: 'exp-6b', name: 'Concerts & Events', color: '#EC4899', icon: 'ticket-01', classification: 'expense', subCategories: [], parentId: 'exp-6' },
      { id: 'exp-6c', name: 'Hobbies', color: '#EC4899', icon: 'palette', classification: 'expense', subCategories: [], parentId: 'exp-6' },
      { id: 'exp-6d', name: 'Sports & Recreation', color: '#EC4899', icon: 'basketball-01', classification: 'expense', subCategories: [], parentId: 'exp-6' }
    ]
  },
  {
    id: 'exp-13', name: 'Family & Kids', color: '#F59E0B', icon: 'user-group', classification: 'expense', subCategories: [
      { id: 'exp-13a', name: 'Childcare', color: '#F59E0B', icon: 'user-group', classification: 'expense', subCategories: [], parentId: 'exp-13' },
      { id: 'exp-13b', name: 'School Fees & Supplies', color: '#F59E0B', icon: 'mortarboard-01', classification: 'expense', subCategories: [], parentId: 'exp-13' },
      { id: 'exp-13c', name: 'Toys & Activities', color: '#F59E0B', icon: 'game-controller-01', classification: 'expense', subCategories: [], parentId: 'exp-13' },
      { id: 'exp-13d', name: 'Baby Essentials & Diapers', color: '#F59E0B', icon: 'package', classification: 'expense', subCategories: [], parentId: 'exp-13' },
      { id: 'exp-13e', name: 'Kids Clothing & Footwear', color: '#F59E0B', icon: 'shopping-bag-01', classification: 'expense', subCategories: [], parentId: 'exp-13' },
      { id: 'exp-13f', name: 'Extracurriculars & Sports Clubs', color: '#F59E0B', icon: 'basketball-01', classification: 'expense', subCategories: [], parentId: 'exp-13' },
      { id: 'exp-13g', name: 'Pocket Money & Allowance', color: '#F59E0B', icon: 'coins-01', classification: 'expense', subCategories: [], parentId: 'exp-13' },
      { id: 'exp-13h', name: 'Babysitting & Nannying', color: '#F59E0B', icon: 'user', classification: 'expense', subCategories: [], parentId: 'exp-13' },
      { id: 'exp-13i', name: 'Pediatric & Child Health', color: '#F59E0B', icon: 'medicine-01', classification: 'expense', subCategories: [], parentId: 'exp-13' }
    ]
  },
  {
    id: 'exp-14', name: 'Education & Self-Improvement', color: '#14B8A6', icon: 'mortarboard-01', classification: 'expense', subCategories: [
      { id: 'exp-14a', name: 'Tuition', color: '#14B8A6', icon: 'graduation-cap', classification: 'expense', subCategories: [], parentId: 'exp-14' },
      { id: 'exp-14b', name: 'Courses & Training', color: '#14B8A6', icon: 'laptop', classification: 'expense', subCategories: [], parentId: 'exp-14' },
      { id: 'exp-14c', name: 'Books & Materials', color: '#14B8A6', icon: 'book-open-01', classification: 'expense', subCategories: [], parentId: 'exp-14' }
    ]
  },
  {
    id: 'exp-7', name: 'Health & Wellness', color: '#10B981', icon: 'pulse-01', classification: 'expense', subCategories: [
      { id: 'exp-7a', name: 'Fitness / Gym', color: '#10B981', icon: 'pulse-01', classification: 'expense', subCategories: [], parentId: 'exp-7' },
      { id: 'exp-7b', name: 'Medical & Dental', color: '#10B981', icon: 'hospital-01', classification: 'expense', subCategories: [], parentId: 'exp-7' },
      { id: 'exp-7c', name: 'Pharmacy', color: '#10B981', icon: 'medicine-01', classification: 'expense', subCategories: [], parentId: 'exp-7' }
    ]
  },
  {
    id: 'exp-8', name: 'Travel', color: '#F59E0B', icon: 'luggage-01', classification: 'expense', subCategories: [
      { id: 'exp-8a', name: 'Flights', color: '#F59E0B', icon: 'airplane-take-off-01', classification: 'expense', subCategories: [], parentId: 'exp-8' },
      { id: 'exp-8b', name: 'Accommodation', color: '#F59E0B', icon: 'bed', classification: 'expense', subCategories: [], parentId: 'exp-8' },
      { id: 'exp-8c', name: 'Activities & Tours', color: '#F59E0B', icon: 'ticket-01', classification: 'expense', subCategories: [], parentId: 'exp-8' },
      { id: 'exp-8d', name: 'Visa & Passport', color: '#F59E0B', icon: 'doc-01', classification: 'expense', subCategories: [], parentId: 'exp-8' }
    ]
  },
  {
    id: 'exp-9', name: 'Personal', color: '#64748B', icon: 'user', classification: 'expense', subCategories: [
      { id: 'exp-9b', name: 'Gifts & Donations', color: '#64748B', icon: 'gift', classification: 'expense', subCategories: [], parentId: 'exp-9' },
      { id: 'exp-9c', name: 'Pet Care', color: '#64748B', icon: 'favourite', classification: 'expense', subCategories: [], parentId: 'exp-9' }
    ]
  },
  {
    id: 'exp-10', name: 'Finances', color: '#A855F7', icon: 'bank', classification: 'expense', subCategories: [
      { id: 'exp-10a', name: 'Bank Fees', color: '#A855F7', icon: 'receipt', classification: 'expense', subCategories: [], parentId: 'exp-10' },
      { id: 'exp-10d', name: 'Taxes', color: '#A855F7', icon: 'invoice-02', classification: 'expense', subCategories: [], parentId: 'exp-10' },
      { id: 'exp-10e', name: 'Life Insurance', color: '#A855F7', icon: 'shield-01', classification: 'expense', subCategories: [], parentId: 'exp-10' },
      { id: 'exp-10c', name: 'Investments', color: '#A855F7', icon: 'chart-increase', classification: 'expense', subCategories: [], parentId: 'exp-10' },
      { id: 'exp-10f', name: 'Fines & Legal Penalties', color: '#A855F7', icon: 'balance-scale', classification: 'expense', subCategories: [], parentId: 'exp-10' }
    ]
  },
  {
    id: 'exp-11', name: 'Miscellaneous', color: '#78716C', icon: 'folder-01', classification: 'expense', subCategories: [
      { id: 'exp-11a', name: 'Uncategorized', color: '#78716C', icon: 'help-circle', classification: 'expense', subCategories: [], parentId: 'exp-11' },
      { id: 'exp-11b', name: 'Cash Withdrawals & ATM', color: '#78716C', icon: 'coins-01', classification: 'expense', subCategories: [], parentId: 'exp-11' },
      { id: 'exp-11c', name: 'Fines & Penalties', color: '#78716C', icon: 'balance-scale', classification: 'expense', subCategories: [], parentId: 'exp-11' },
      { id: 'exp-11d', name: 'Lost & Stolen Adjustments', color: '#78716C', icon: 'cancel-circle', classification: 'expense', subCategories: [], parentId: 'exp-11' },
      { id: 'exp-11e', name: 'One-off Contingencies', color: '#78716C', icon: 'puzzle', classification: 'expense', subCategories: [], parentId: 'exp-11' },
      { id: 'exp-11f', name: 'Government & Admin Fees', color: '#78716C', icon: 'doc-01', classification: 'expense', subCategories: [], parentId: 'exp-11' },
      { id: 'exp-11g', name: 'Tips & Gratuities', color: '#78716C', icon: 'coins-01', classification: 'expense', subCategories: [], parentId: 'exp-11' },
      { id: 'exp-11h', name: 'Currency Conversion & FX Fees', color: '#78716C', icon: 'exchange-01', classification: 'expense', subCategories: [], parentId: 'exp-11' }
    ]
  }
];

export const ACCOUNT_ICON_LIST: string[] = [...ICON_LIBRARY];

export const CATEGORY_ICON_LIST: string[] = [...ICON_LIBRARY];
