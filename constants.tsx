
import { CURRENCY_CODES, currencyPreference } from './utils/currencies';
import { Category, Page, AccountType, Currency, RecurrenceFrequency, WeekendAdjustment, DefaultAccountOrder, Duration, InvestmentSubType, PropertyType, FuelType, VehicleOwnership, ForecastDuration, OtherAssetSubType, OtherLiabilitySubType } from './types';
import { ICON_LIBRARY } from './utils/materialSymbols';


// FIX: Renamed AuraFinanceLogo to CrystalLogo to finalize rebranding.
export function CrystalLogo({ showText = true }: { showText?: boolean; }) {
  const size = showText ? 120 : 40;

  return (
    <div className="flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        role="img"
        aria-label="Crystal ball logo"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        style={{
          display: 'block',
        }}
      >
        <defs>
          <linearGradient id="base-grad-logo" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f08b53" />
            <stop offset="28%" stopColor="#f08b53" />
            <stop offset="28.1%" stopColor="#fca065" />
            <stop offset="100%" stopColor="#fca065" />
          </linearGradient>

          <linearGradient id="stand-grad-logo" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fbda5c" />
            <stop offset="34%" stopColor="#fbda5c" />
            <stop offset="34.1%" stopColor="#fde675" />
            <stop offset="100%" stopColor="#fde675" />
          </linearGradient>

          <linearGradient id="ball-bg-grad-logo" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#50256e" />
            <stop offset="38%" stopColor="#50256e" />
            <stop offset="38.1%" stopColor="#5f2d7b" />
            <stop offset="100%" stopColor="#5f2d7b" />
          </linearGradient>

          <linearGradient id="cloud-grad-logo" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a585c7" />
            <stop offset="38%" stopColor="#a585c7" />
            <stop offset="38.1%" stopColor="#bca2dc" />
            <stop offset="100%" stopColor="#bca2dc" />
          </linearGradient>

          <clipPath id="ball-clip-logo">
            <circle cx="256" cy="216" r="180" />
          </clipPath>
        </defs>

        <path d="M 126 380 L 386 380 L 421 460 L 91 460 Z" fill="url(#stand-grad-logo)" />

        <rect x="66" y="460" width="380" height="40" rx="20" fill="url(#base-grad-logo)" />

        <g clipPath="url(#ball-clip-logo)">
          <circle cx="256" cy="216" r="180" fill="url(#ball-bg-grad-logo)" />

          <path d="M 70 230 C 110 160, 160 160, 180 200 C 210 130, 290 130, 320 200 C 350 150, 410 150, 442 230 L 442 410 L 70 410 Z" fill="url(#cloud-grad-logo)" />

          <path d="M 175 60 Q 175 115 230 115 Q 175 115 175 170 Q 175 115 120 115 Q 175 115 175 60 Z" fill="#fee77d" />

          <path d="M 370 175 Q 370 230 425 230 Q 370 230 370 285 Q 370 230 315 230 Q 370 230 370 175 Z" fill="#fee77d" />

          <path d="M 220 255 Q 220 300 265 300 Q 220 300 220 345 Q 220 300 175 300 Q 220 300 220 255 Z" fill="#fee77d" />
        </g>
      </svg>
    </div>
  );
}

// Common Styles based on Apple Health & Frosted Glass Architecture
export const BTN_PRIMARY_STYLE = "h-10 pointer-coarse:h-11 inline-flex items-center justify-center gap-2 rounded-full bg-primary hover:bg-primary-hover text-on-primary text-sm font-bold px-[18px] transition-colors duration-[var(--duration-fast)] active:scale-[.98] whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
export const BTN_SECONDARY_STYLE = "h-10 pointer-coarse:h-11 inline-flex items-center justify-center gap-2 rounded-full bg-surface hover:bg-inset text-ink text-sm font-bold px-[18px] border border-line-strong transition-colors duration-[var(--duration-fast)] active:scale-[.98] whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
export const BTN_DANGER_STYLE = "h-10 pointer-coarse:h-11 inline-flex items-center justify-center gap-2 rounded-full bg-money-out text-on-danger hover:brightness-95 text-sm font-bold px-[18px] transition-colors duration-[var(--duration-fast)] active:scale-[.98] whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
export const INPUT_BASE_STYLE = "h-11 max-md:h-12 w-full appearance-none rounded-[var(--radius-md)] bg-inset text-ink border border-line-strong placeholder:text-muted transition-colors duration-[var(--duration-fast)] px-3 text-[.9375rem] max-md:text-base font-medium touch-feedback";
export const SELECT_STYLE = "h-11 max-md:h-12 w-full appearance-none rounded-[var(--radius-md)] bg-inset text-ink border border-line-strong placeholder:text-muted transition-colors duration-[var(--duration-fast)] pl-3 pr-10 text-[.9375rem] max-md:text-base font-medium whitespace-nowrap cursor-pointer touch-feedback";
export const SELECT_WRAPPER_STYLE = "relative w-full";
export const SELECT_ARROW_STYLE = "pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500 dark:text-neutral-400";
export const CHECKBOX_STYLE = "h-5 w-5 rounded-lg accent-primary-500 text-white bg-black/[0.03] dark:bg-white/[0.04] border border-black/15 dark:border-white/20 focus:ring-2 focus:ring-primary-500/40 cursor-pointer touch-feedback";

// Icon Button Styles — Minimum 44x44px touch targets per Apple HIG
export const ICON_BUTTON_STYLE = "w-11 h-11 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-white/10 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer shrink-0 touch-feedback";
export const ICON_BUTTON_SM_STYLE = "w-9 h-9 min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-white/10 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer shrink-0 touch-feedback";
export const CLOSE_BTN_STYLE = "size-10 pointer-coarse:size-11 inline-flex items-center justify-center rounded-full text-ink hover:bg-inset transition-colors cursor-pointer shrink-0";

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
export const Z_INDEX = {
  BASE: 'z-0',
  DROPDOWN: 'z-dropdown',
  STICKY: 'z-sticky',
  POPOVER: 'z-popover',
  MODAL: 'z-modal',
  TOAST: 'z-toast',
  MAX: 'z-max',
} as const;


export const BRAND_COLORS = ['#fcb045', '#fd1d1d', '#3B82F6', '#22d3ee', '#a78bfa', '#f472b6'];

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


export const ACCOUNT_TYPE_STYLES: { [key in AccountType]: { icon: string; color: string } } = {
  'Checking': { icon: 'bank', color: 'text-blue-500' },
  'Savings': { icon: 'piggy-bank', color: 'text-green-500' },
  'Credit Card': { icon: 'credit-card', color: 'text-rose-500' },
  'Investment': { icon: 'chart-line-data-01', color: 'text-purple-500' },
  'Loan': { icon: 'agreement-01', color: 'text-red-500' },
  'Lending': { icon: 'money-receive-01', color: 'text-teal-500' },
  'Property': { icon: 'building-03', color: 'text-sky-500' },
  'Vehicle': { icon: 'car-01', color: 'text-slate-500' },
  'Other Assets': { icon: 'package', color: 'text-lime-500' },
  'Other Liabilities': { icon: 'receipt', color: 'text-pink-500' },
};

export const ACCOUNT_TYPE_ACCENT_STYLES: { [key in AccountType]: { bar: string; pill: string } } = {
  'Checking': { bar: 'bg-blue-500', pill: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  'Savings': { bar: 'bg-green-500', pill: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  'Credit Card': { bar: 'bg-rose-500', pill: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
  'Investment': { bar: 'bg-purple-500', pill: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  'Loan': { bar: 'bg-red-500', pill: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  'Lending': { bar: 'bg-teal-500', pill: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' },
  'Property': { bar: 'bg-sky-500', pill: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  'Vehicle': { bar: 'bg-slate-500', pill: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300' },
  'Other Assets': { bar: 'bg-lime-500', pill: 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300' },
  'Other Liabilities': { bar: 'bg-pink-500', pill: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' },
};

export const INVESTMENT_SUB_TYPE_STYLES: { [key in InvestmentSubType]: { icon: string; color: string } } = {
  'Stock': { icon: 'chart-line-data-01', color: 'text-purple-500' },
  'ETF': { icon: 'chart-column', color: 'text-teal-500' },
  'Crypto': { icon: 'bitcoin', color: 'text-amber-500' },
  'Warrant': { icon: 'certificate-01', color: 'text-rose-500' },
  'Pension Fund': { icon: 'safe', color: 'text-indigo-500' },
  'Spare Change': { icon: 'coins-01', color: 'text-cyan-500' },
  'Other': { icon: 'package', color: 'text-slate-500' },
};

export const OTHER_ASSET_SUB_TYPE_STYLES: { [key in OtherAssetSubType]: { icon: string; color: string } } = {
  'Cash': { icon: 'wallet-02', color: 'text-green-500' },
  'Precious Metals': { icon: 'coins-01', color: 'text-yellow-500' },
  'Collectibles': { icon: 'shopping-bag-01', color: 'text-purple-500' },
  'Art': { icon: 'palette', color: 'text-pink-500' },
  'Business Equity': { icon: 'store-01', color: 'text-blue-500' },
  'Private Loan': { icon: 'agreement-01', color: 'text-teal-500' },
  'Electronics': { icon: 'laptop', color: 'text-gray-500' },
  'Furniture': { icon: 'home-01', color: 'text-orange-500' },
  'Meal Voucher': { icon: 'credit-card', color: 'text-emerald-500' },
  'Other': { icon: 'package', color: 'text-slate-500' },
};

export const OTHER_LIABILITY_SUB_TYPE_STYLES: { [key in OtherLiabilitySubType]: { icon: string; color: string } } = {
  'Tax': { icon: 'balance-scale', color: 'text-red-500' },
  'Private Debt': { icon: 'agreement-01', color: 'text-orange-500' },
  'Legal Settlement': { icon: 'balance-scale', color: 'text-purple-500' },
  'Business Debt': { icon: 'store-01', color: 'text-blue-500' },
  'Other': { icon: 'receipt', color: 'text-slate-500' },
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
