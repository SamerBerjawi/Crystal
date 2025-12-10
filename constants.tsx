
import React, { useState, useEffect } from 'react';
import { Category, Page, AccountType, Currency, Theme, RecurrenceFrequency, WeekendAdjustment, DefaultAccountOrder, Duration, InvestmentSubType, PropertyType, FuelType, VehicleOwnership, ForecastDuration, OtherAssetSubType, OtherLiabilitySubType } from './types';


// FIX: Renamed AuraFinanceLogo to CrystalLogo to finalize rebranding.
export function CrystalLogo({ showText = true }: { showText?: boolean; }) {
  const size = showText ? 120 : 40;

  return (
    <div className="flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox="0 0 128 128"
        role="img"
        aria-label="Crystal ball logo"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        style={{
          display: 'block',
        }}
      >
        <defs>
          <radialGradient id="crystal-orb" cx="50%" cy="32%" r="60%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="55%" stopColor="#E9ECF7" />
            <stop offset="100%" stopColor="#C8CEE4" />
          </radialGradient>
          <linearGradient id="crystal-base" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#575D86" />
            <stop offset="100%" stopColor="#2F335A" />
          </linearGradient>
          <linearGradient id="crystal-base-shine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8389B3" stopOpacity="0.15" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#8389B3" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <circle
          cx="64"
          cy="54"
          r="44"
          fill="url(#crystal-orb)"
          stroke="#E3E8F7"
          strokeWidth="2"
        />
        <circle cx="46" cy="36" r="12" fill="#FFFFFF" opacity="0.6" />
        <circle cx="78" cy="44" r="6" fill="#FFFFFF" opacity="0.35" />
        <path
          d="M16 92h96v4c0 15.5-21.5 26-48 26S16 111.5 16 96z"
          fill="url(#crystal-base)"
        />
        <path
          d="M24 98c0 10.667 17.4 18 40 18s40-7.333 40-18"
          fill="none"
          stroke="url(#crystal-base-shine)"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.6"
        />
        <ellipse cx="64" cy="94" rx="46" ry="6" fill="#1F223C" opacity="0.25" />
        <g fill="#FFD159" stroke="#FF9800" strokeWidth="1.5" strokeLinejoin="round">
          <path
            d="M8 0L12 8L20 8L12 12L8 20L4 12L-4 12L4 8Z"
            transform="translate(98 28) scale(0.55)"
          />
          <path
            d="M8 0L12 8L20 8L12 12L8 20L4 12L-4 12L4 8Z"
            transform="translate(78 12) scale(0.4)"
          />
          <path
            d="M8 0L12 8L20 8L12 12L8 20L4 12L-4 12L4 8Z"
            transform="translate(36 32) scale(0.35)"
          />
        </g>
      </svg>
    </div>
  );
}

// Common Styles based on Apple HIG
export const BTN_PRIMARY_STYLE = "h-10 flex items-center justify-center bg-primary-700 text-white font-semibold px-4 rounded-lg hover:bg-primary-600 shadow-md hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-light-bg dark:focus:ring-offset-dark-card active:scale-95 whitespace-nowrap";
export const BTN_SECONDARY_STYLE = "h-10 flex items-center justify-center bg-light-fill dark:bg-dark-fill text-light-text dark:text-dark-text font-semibold px-4 rounded-lg border border border-black/10 dark:border-white/20 hover:bg-gray-500/20 dark:hover:bg-gray-400/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 active:scale-95 whitespace-nowrap";
export const BTN_DANGER_STYLE = "h-10 flex items-center justify-center text-semantic-red hover:bg-semantic-red/10 font-semibold px-4 rounded-lg transition-colors active:scale-95 whitespace-nowrap";
export const INPUT_BASE_STYLE = "h-10 w-full appearance-none bg-light-fill dark:bg-dark-fill text-light-text dark:text-dark-text rounded-lg px-3 border border-black/10 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-shadow duration-200";
export const SELECT_STYLE = "h-10 w-full appearance-none bg-light-fill dark:bg-dark-fill text-light-text dark:text-dark-text font-semibold pl-4 pr-10 rounded-lg border border-black/10 dark:border-white/20 hover:bg-gray-500/20 dark:hover:bg-gray-400/20 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 whitespace-nowrap cursor-pointer";
export const SELECT_WRAPPER_STYLE = "relative w-full";
export const SELECT_ARROW_STYLE = "pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-light-text-secondary dark:text-dark-text-secondary";
export const CHECKBOX_STYLE = "h-4 w-4 rounded text-white bg-light-bg dark:bg-dark-fill border border-gray-400 dark:border-gray-500 focus:ring-2 focus:ring-offset-2 focus:ring-offset-light-card dark:focus:ring-offset-dark-card focus:ring-primary-500 checked:bg-primary-500 checked:border-transparent cursor-pointer";


export const BRAND_COLORS = ['#fcb045', '#fd1d1d', '#3B82F6', '#22d3ee', '#a78bfa', '#f472b6'];

export interface NavItem {
  name: Page;
  icon: string;
  subItems?: NavItem[];
}

export const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', icon: 'space_dashboard' },
  { name: 'Accounts', icon: 'wallet' },
  { name: 'Transactions', icon: 'receipt_long' },
  { name: 'Quotes & Invoices', icon: 'description' },
  { name: 'Subscriptions', icon: 'loyalty' },
  { name: 'Schedule & Bills', icon: 'calendar_month' },
  { name: 'Forecasting', icon: 'show_chart' },
  { name: 'Budget', icon: 'pie_chart' },
  { name: 'Investments', icon: 'candlestick_chart' },
  { name: 'Tasks', icon: 'task_alt' },
  { name: 'Settings', icon: 'settings' },
];

export const ASSET_TYPES: AccountType[] = ['Checking', 'Savings', 'Investment', 'Property', 'Vehicle', 'Other Assets', 'Lending'];
export const DEBT_TYPES: AccountType[] = ['Credit Card', 'Loan', 'Other Liabilities'];
export const ALL_ACCOUNT_TYPES: AccountType[] = [...ASSET_TYPES, ...DEBT_TYPES];
export const LIQUID_ACCOUNT_TYPES: AccountType[] = ['Checking', 'Savings', 'Credit Card'];
export const CURRENCIES: Currency[] = ['USD', 'EUR', 'GBP', 'BTC', 'RON'];
export const INVESTMENT_SUB_TYPES: InvestmentSubType[] = ['Stock', 'ETF', 'Crypto', 'Pension Fund', 'Spare Change', 'Other'];
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

export const CURRENCY_OPTIONS = [
    'EUR (€)', 'USD ($)', 'GBP (£)', 'RON (lei)', 'JPY (¥)', 'CAD (C$)', 'AUD (A$)', 'CHF (CHF)', 'CNY (¥)', 'INR (₹)'
];

export const TIMEZONE_OPTIONS = [
    "Pacific/Midway", "Pacific/Honolulu", "America/Anchorage", "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "America/Caracas", "America/Halifax", "America/Sao_Paulo", "Atlantic/Azores", "Etc/GMT", "Europe/London", "Europe/Brussels", "Europe/Athens", "Europe/Moscow", "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Dhaka", "Asia/Bangkok", "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland"
];

export const COUNTRY_OPTIONS = [
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo, Democratic Republic of the", "Congo, Republic of the", "Costa Rica", "Cote d'Ivoire", "Croatia", "Cuba", "Cyprus", "Czechia", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

export const DURATION_OPTIONS: { label: string; value: Duration }[] = [
  { label: 'Today', value: 'TODAY' },
  { label: 'Week to Date', value: 'WTD' },
  { label: 'Month to Date', value: 'MTD' },
  { label: '30 Days', value: '30D' },
  { label: '60 Days', value: '60D' },
  { label: '90 Days', value: '90D' },
  { label: '6 Months', value: '6M' },
  { label: 'Year to Date', value: 'YTD' },
  { label: '1 Year', value: '1Y' },
  { label: 'All Time', value: 'ALL' },
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
    'Checking': { icon: 'account_balance', color: 'text-blue-500' },
    'Savings': { icon: 'savings', color: 'text-green-500' },
    'Credit Card': { icon: 'credit_card', color: 'text-orange-500' },
    'Investment': { icon: 'show_chart', color: 'text-purple-500' },
    'Loan': { icon: 'request_quote', color: 'text-red-500' },
    'Lending': { icon: 'real_estate_agent', color: 'text-teal-500' },
    'Property': { icon: 'home', color: 'text-yellow-500' },
    'Vehicle': { icon: 'directions_car', color: 'text-cyan-500' },
    'Other Assets': { icon: 'category', color: 'text-lime-500' },
    'Other Liabilities': { icon: 'receipt', color: 'text-pink-500' },
};

export const INVESTMENT_SUB_TYPE_STYLES: { [key in InvestmentSubType]: { icon: string; color: string } } = {
    'Stock': { icon: 'show_chart', color: 'text-purple-500' },
    'ETF': { icon: 'account_tree', color: 'text-teal-500' },
    'Crypto': { icon: 'currency_bitcoin', color: 'text-amber-500' },
    'Pension Fund': { icon: 'assured_workload', color: 'text-indigo-500' },
    'Spare Change': { icon: 'monetization_on', color: 'text-lime-600' },
    'Other': { icon: 'category', color: 'text-slate-500' },
};

export const OTHER_ASSET_SUB_TYPE_STYLES: { [key in OtherAssetSubType]: { icon: string; color: string } } = {
    'Cash': { icon: 'payments', color: 'text-green-500' },
    'Precious Metals': { icon: 'diamond', color: 'text-yellow-600' },
    'Collectibles': { icon: 'local_mall', color: 'text-purple-500' },
    'Art': { icon: 'palette', color: 'text-pink-500' },
    'Business Equity': { icon: 'store', color: 'text-blue-500' },
    'Private Loan': { icon: 'handshake', color: 'text-teal-500' },
    'Electronics': { icon: 'devices', color: 'text-gray-500' },
    'Furniture': { icon: 'chair', color: 'text-orange-500' },
    'Other': { icon: 'category', color: 'text-slate-500' },
};

export const OTHER_LIABILITY_SUB_TYPE_STYLES: { [key in OtherLiabilitySubType]: { icon: string; color: string } } = {
    'Tax': { icon: 'receipt_long', color: 'text-red-500' },
    'Private Debt': { icon: 'handshake', color: 'text-orange-500' },
    'Legal Settlement': { icon: 'gavel', color: 'text-purple-500' },
    'Business Debt': { icon: 'store', color: 'text-blue-500' },
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
    { id: 'inc-1', name: 'Salary', color: '#10B981', icon: 'work', classification: 'income', subCategories: [{ id: 'inc-1a', name: 'Fixed Salary', color: '#10B981', icon: 'work', classification: 'income', subCategories: [], parentId: 'inc-1' }, { id: 'inc-1b', name: 'Bonus Salary', color: '#10B981', icon: 'work', classification: 'income', subCategories: [], parentId: 'inc-1' }] },
    { id: 'inc-6', name: 'Side Hustle / Freelance', color: '#14B8A6', icon: 'engineering', classification: 'income', subCategories: [] },
    { id: 'inc-7', name: 'Rental Income', color: '#8B5CF6', icon: 'real_estate_agent', classification: 'income', subCategories: [] },
    { id: 'inc-5', name: 'Investments & Dividends', color: '#6366F1', icon: 'trending_up', classification: 'income', subCategories: [] },
    { id: 'inc-2', name: 'Refunds & Payback', color: '#F59E0B', icon: 'assignment_return', classification: 'income', subCategories: [] },
    { id: 'inc-3', name: 'Government & Benefits', color: '#3B82F6', icon: 'account_balance', classification: 'income', subCategories: [] },
    { id: 'inc-8', name: 'Gifts Received', color: '#EC4899', icon: 'card_giftcard', classification: 'income', subCategories: [] },
    { id: 'inc-4', name: 'Other Income', color: '#64748B', icon: 'attach_money', classification: 'income', subCategories: [] },
];

export const MOCK_EXPENSE_CATEGORIES: Category[] = [
    { id: 'exp-1', name: 'Housing', color: '#EF4444', icon: 'house', classification: 'expense', subCategories: [
        { id: 'exp-1a', name: 'Mortgage', color: '#EF4444', icon: 'account_balance', classification: 'expense', subCategories: [], parentId: 'exp-1' },
        { id: 'exp-1d', name: 'Rent', color: '#EF4444', icon: 'apartment', classification: 'expense', subCategories: [], parentId: 'exp-1' },
        { id: 'exp-1b', name: 'Maintenance & Repairs', color: '#EF4444', icon: 'home_repair_service', classification: 'expense', subCategories: [], parentId: 'exp-1' },
        { id: 'exp-1e', name: 'Home Insurance', color: '#EF4444', icon: 'shield', classification: 'expense', subCategories: [], parentId: 'exp-1' },
        { id: 'exp-1f', name: 'HOA / Body Corp', color: '#EF4444', icon: 'groups', classification: 'expense', subCategories: [], parentId: 'exp-1' }
    ]},
    { id: 'exp-2', name: 'Food & Groceries', color: '#F97316', icon: 'restaurant', classification: 'expense', subCategories: [
        { id: 'exp-2a', name: 'Supermarket', color: '#F97316', icon: 'shopping_cart', classification: 'expense', subCategories: [], parentId: 'exp-2' },
        { id: 'exp-2b', name: 'Dining Out', color: '#F97316', icon: 'restaurant_menu', classification: 'expense', subCategories: [], parentId: 'exp-2' },
        { id: 'exp-2c', name: 'Cafes & Snacks', color: '#F97316', icon: 'local_cafe', classification: 'expense', subCategories: [], parentId: 'exp-2' },
        { id: 'exp-2d', name: 'Delivery & Takeaway', color: '#F97316', icon: 'delivery_dining', classification: 'expense', subCategories: [], parentId: 'exp-2' }
    ]},
    { id: 'exp-3', name: 'Transportation', color: '#3B82F6', icon: 'commute', classification: 'expense', subCategories: [
        { id: 'exp-3a', name: 'Public Transport', color: '#3B82F6', icon: 'train', classification: 'expense', subCategories: [], parentId: 'exp-3' },
        { id: 'exp-3c', name: 'Fuel / Charging', color: '#3B82F6', icon: 'local_gas_station', classification: 'expense', subCategories: [], parentId: 'exp-3' },
        { id: 'exp-3f', name: 'Vehicle Insurance', color: '#3B82F6', icon: 'car_crash', classification: 'expense', subCategories: [], parentId: 'exp-3' },
        { id: 'exp-3g', name: 'Service & Maintenance', color: '#3B82F6', icon: 'car_repair', classification: 'expense', subCategories: [], parentId: 'exp-3' },
        { id: 'exp-3b', name: 'Ride-Hailing', color: '#3B82F6', icon: 'local_taxi', classification: 'expense', subCategories: [], parentId: 'exp-3' },
        { id: 'exp-3d', name: 'Parking & Tolls', color: '#3B82F6', icon: 'local_parking', classification: 'expense', subCategories: [], parentId: 'exp-3' }
    ]},
    { id: 'exp-4', name: 'Shopping & Lifestyle', color: '#8B5CF6', icon: 'shopping_bag', classification: 'expense', subCategories: [
        { id: 'exp-4b', name: 'Clothing & Apparel', color: '#8B5CF6', icon: 'checkroom', classification: 'expense', subCategories: [], parentId: 'exp-4' },
        { id: 'exp-4a', name: 'Electronics & Gadgets', color: '#8B5CF6', icon: 'devices', classification: 'expense', subCategories: [], parentId: 'exp-4' },
        { id: 'exp-4c', name: 'Home & Garden', color: '#8B5CF6', icon: 'chair', classification: 'expense', subCategories: [], parentId: 'exp-4' },
        { id: 'exp-4d', name: 'Beauty & Personal Care', color: '#8B5CF6', icon: 'face', classification: 'expense', subCategories: [], parentId: 'exp-4' }
    ]},
    { id: 'exp-5', name: 'Bills & Utilities', color: '#0EA5E9', icon: 'receipt_long', classification: 'expense', subCategories: [
        { id: 'exp-5b', name: 'Utilities (Gas, Water, Elec)', color: '#0EA5E9', icon: 'bolt', classification: 'expense', subCategories: [], parentId: 'exp-5' },
        { id: 'exp-5a', name: 'Internet & TV', color: '#0EA5E9', icon: 'router', classification: 'expense', subCategories: [], parentId: 'exp-5' },
        { id: 'exp-5d', name: 'Mobile Phone', color: '#0EA5E9', icon: 'smartphone', classification: 'expense', subCategories: [], parentId: 'exp-5' },
        { id: 'exp-5c', name: 'Services', color: '#0EA5E9', icon: 'cleaning_services', classification: 'expense', subCategories: [], parentId: 'exp-5' }
    ]},
    { id: 'exp-12', name: 'Software & Subscriptions', color: '#6366F1', icon: 'cloud_download', classification: 'expense', subCategories: [
        { id: 'exp-12a', name: 'Streaming Services', color: '#6366F1', icon: 'movie', classification: 'expense', subCategories: [], parentId: 'exp-12' },
        { id: 'exp-12b', name: 'Apps & Software', color: '#6366F1', icon: 'apps', classification: 'expense', subCategories: [], parentId: 'exp-12' },
        { id: 'exp-12c', name: 'Cloud Storage', color: '#6366F1', icon: 'cloud', classification: 'expense', subCategories: [], parentId: 'exp-12' }
    ]},
    { id: 'exp-6', name: 'Entertainment', color: '#EC4899', icon: 'theaters', classification: 'expense', subCategories: [
        { id: 'exp-6b', name: 'Concerts & Events', color: '#EC4899', icon: 'confirmation_number', classification: 'expense', subCategories: [], parentId: 'exp-6' },
        { id: 'exp-6c', name: 'Hobbies', color: '#EC4899', icon: 'palette', classification: 'expense', subCategories: [], parentId: 'exp-6' },
        { id: 'exp-6d', name: 'Sports & Recreation', color: '#EC4899', icon: 'sports_soccer', classification: 'expense', subCategories: [], parentId: 'exp-6' }
    ]},
    { id: 'exp-13', name: 'Family & Kids', color: '#F59E0B', icon: 'family_restroom', classification: 'expense', subCategories: [
        { id: 'exp-13a', name: 'Childcare', color: '#F59E0B', icon: 'child_care', classification: 'expense', subCategories: [], parentId: 'exp-13' },
        { id: 'exp-13b', name: 'School Fees', color: '#F59E0B', icon: 'school', classification: 'expense', subCategories: [], parentId: 'exp-13' },
        { id: 'exp-13c', name: 'Toys & Activities', color: '#F59E0B', icon: 'toys', classification: 'expense', subCategories: [], parentId: 'exp-13' }
    ]},
    { id: 'exp-14', name: 'Education & Self-Improvement', color: '#14B8A6', icon: 'school', classification: 'expense', subCategories: [
        { id: 'exp-14a', name: 'Tuition', color: '#14B8A6', icon: 'account_balance', classification: 'expense', subCategories: [], parentId: 'exp-14' },
        { id: 'exp-14b', name: 'Courses & Training', color: '#14B8A6', icon: 'cast_for_education', classification: 'expense', subCategories: [], parentId: 'exp-14' },
        { id: 'exp-14c', name: 'Books & Materials', color: '#14B8A6', icon: 'menu_book', classification: 'expense', subCategories: [], parentId: 'exp-14' }
    ]},
    { id: 'exp-7', name: 'Health & Wellness', color: '#10B981', icon: 'monitor_heart', classification: 'expense', subCategories: [
        { id: 'exp-7a', name: 'Fitness / Gym', color: '#10B981', icon: 'fitness_center', classification: 'expense', subCategories: [], parentId: 'exp-7' },
        { id: 'exp-7b', name: 'Medical & Dental', color: '#10B981', icon: 'medical_services', classification: 'expense', subCategories: [], parentId: 'exp-7' },
        { id: 'exp-7c', name: 'Pharmacy', color: '#10B981', icon: 'medication', classification: 'expense', subCategories: [], parentId: 'exp-7' }
    ]},
    { id: 'exp-8', name: 'Travel', color: '#F59E0B', icon: 'flight', classification: 'expense', subCategories: [
        { id: 'exp-8a', name: 'Flights', color: '#F59E0B', icon: 'flight_takeoff', classification: 'expense', subCategories: [], parentId: 'exp-8' },
        { id: 'exp-8b', name: 'Accommodation', color: '#F59E0B', icon: 'hotel', classification: 'expense', subCategories: [], parentId: 'exp-8' },
        { id: 'exp-8c', name: 'Activities & Tours', color: '#F59E0B', icon: 'tour', classification: 'expense', subCategories: [], parentId: 'exp-8' },
        { id: 'exp-8d', name: 'Visa & Passport', color: '#F59E0B', icon: 'badge', classification: 'expense', subCategories: [], parentId: 'exp-8' }
    ]},
    { id: 'exp-9', name: 'Personal', color: '#64748B', icon: 'person', classification: 'expense', subCategories: [
        { id: 'exp-9b', name: 'Gifts & Donations', color: '#64748B', icon: 'volunteer_activism', classification: 'expense', subCategories: [], parentId: 'exp-9' },
        { id: 'exp-9c', name: 'Pet Care', color: '#64748B', icon: 'pets', classification: 'expense', subCategories: [], parentId: 'exp-9' }
    ]},
    { id: 'exp-10', name: 'Finances', color: '#A855F7', icon: 'account_balance', classification: 'expense', subCategories: [
        { id: 'exp-10a', name: 'Bank Fees', color: '#A855F7', icon: 'price_check', classification: 'expense', subCategories: [], parentId: 'exp-10' },
        { id: 'exp-10d', name: 'Taxes', color: '#A855F7', icon: 'gavel', classification: 'expense', subCategories: [], parentId: 'exp-10' },
        { id: 'exp-10e', name: 'Life Insurance', color: '#A855F7', icon: 'security', classification: 'expense', subCategories: [], parentId: 'exp-10' },
        { id: 'exp-10c', name: 'Investments', color: '#A855F7', icon: 'trending_up', classification: 'expense', subCategories: [], parentId: 'exp-10' }
    ]},
    { id: 'exp-11', name: 'Miscellaneous', color: '#78716C', icon: 'category', classification: 'expense', subCategories: [
        { id: 'exp-11a', name: 'Uncategorized', color: '#78716C', icon: 'help_outline', classification: 'expense', subCategories: [], parentId: 'exp-11' }
    ]}
];

export const ACCOUNT_ICON_LIST: string[] = [
    'account_balance', 'savings', 'credit_card', 'show_chart', 'request_quote', 'home', 'currency_bitcoin', 'directions_car', 'palette', 'school', 'receipt', 'category', 'wallet', 'paid', 'account_balance_wallet', 'monetization_on', 'euro_symbol', 'payments', 'store', 'apartment', 'business_center', 'cottage', 'flight', 'local_gas_station', 'local_mall', 'restaurant', 'shopping_cart', 'work', 'build', 'real_estate_agent', 'diamond', 'handshake', 'devices', 'chair', 'gavel'
];

export const CATEGORY_ICON_LIST: string[] = [
    'restaurant', 'local_cafe', 'local_bar', 'shopping_cart', 'local_mall', 'store', 'house', 'apartment',
    'home_work', 'paid', 'savings', 'show_chart', 'credit_card', 'receipt_long', 'request_quote',
    'flight', 'directions_car', 'train', 'local_taxi', 'commute', 'local_gas_station', 'ev_station', 'local_shipping',
    'healing', 'medication', 'local_hospital', 'health_and_safety', 'monitor_heart', 'volunteer_activism',
    'subscriptions', 'movie', 'music_note', 'sports_esports', 'stadia_controller', 'fitness_center', 'sports_soccer',
    'phone_iphone', 'computer', 'desktop_windows', 'devices', 'videogame_asset', 'checkroom', 'styler', 'diamond', 'wc',
    'child_care', 'pets', 'school', 'card_giftcard', 'redeem', 'celebration', 'family_restroom', 'construction', 'build',
    'attach_money', 'work', 'payments', 'account_balance', 'currency_exchange', 'sell',
    'emergency', 'report'
];
