import React from 'react';
import { Category, Page, AccountType, Currency, Theme, RecurrenceFrequency, WeekendAdjustment, DefaultAccountOrder, Duration, InvestmentSubType, PropertyType } from './types';


export function FinauraLogo({ theme }: { theme: Theme }) {
  return (
    <div className="flex items-center justify-center">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="40" height="40" rx="8" fill="#6366F1"/>
            <path d="M13 29V11H28M13 19H23" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    </div>
  );
}

// Common Styles based on Apple HIG
export const BTN_PRIMARY_STYLE = "h-10 flex items-center justify-center bg-primary-500 text-white font-semibold px-4 rounded-lg hover:bg-primary-600 shadow-md hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-light-bg dark:focus:ring-offset-dark-card active:scale-95 whitespace-nowrap";
export const BTN_SECONDARY_STYLE = "h-10 flex items-center justify-center bg-light-fill dark:bg-dark-fill text-light-text dark:text-dark-text font-semibold px-4 rounded-lg hover:bg-gray-500/20 dark:hover:bg-gray-400/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 active:scale-95 whitespace-nowrap";
export const BTN_DANGER_STYLE = "h-10 flex items-center justify-center text-semantic-red hover:bg-semantic-red/10 font-semibold px-4 rounded-lg transition-colors active:scale-95 whitespace-nowrap";
export const INPUT_BASE_STYLE = "h-10 w-full appearance-none bg-light-fill dark:bg-dark-fill text-light-text dark:text-dark-text rounded-lg px-3 border border-light-separator/50 dark:border-dark-separator/50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow duration-200";
export const SELECT_STYLE = "h-10 w-full appearance-none bg-light-fill dark:bg-dark-fill text-light-text dark:text-dark-text font-semibold pl-4 pr-10 rounded-lg hover:bg-gray-500/20 dark:hover:bg-gray-400/20 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500";
export const SELECT_WRAPPER_STYLE = "relative w-full";
export const SELECT_ARROW_STYLE = "pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-light-text-secondary dark:text-dark-text-secondary";

export interface NavItem {
  name: Page;
  icon: string;
  subItems?: NavItem[];
}

export const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', icon: 'space_dashboard' },
  { name: 'Accounts', icon: 'wallet' },
  { name: 'Transactions', icon: 'receipt_long' },
  { name: 'Budget', icon: 'pie_chart' },
  { name: 'Forecasting', icon: 'show_chart' },
  { name: 'Investments', icon: 'candlestick_chart' },
  { name: 'Warrants', icon: 'verified' },
  { name: 'Schedule & Bills', icon: 'calendar_month' },
  { name: 'Tasks', icon: 'task_alt' },
  { name: 'Settings', icon: 'settings' },
];

export const ASSET_TYPES: AccountType[] = ['Checking', 'Savings', 'Investment', 'Property', 'Vehicle', 'Other Assets'];
export const DEBT_TYPES: AccountType[] = ['Credit Card', 'Loan', 'Other Liabilities'];
export const ALL_ACCOUNT_TYPES: AccountType[] = [...ASSET_TYPES, ...DEBT_TYPES];
export const LIQUID_ACCOUNT_TYPES: AccountType[] = ['Checking', 'Savings', 'Credit Card'];
export const CURRENCIES: Currency[] = ['USD', 'EUR', 'GBP', 'BTC', 'RON'];
export const INVESTMENT_SUB_TYPES: InvestmentSubType[] = ['Stock', 'ETF', 'Crypto', 'Pension Fund', 'Spare Change', 'Other'];
export const PROPERTY_TYPES: PropertyType[] = ['House', 'Apartment', 'Land', 'Commercial', 'Other'];
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

export const DEFAULT_ACCOUNT_ORDER_OPTIONS: { value: DefaultAccountOrder, label: string }[] = [
    { value: 'manual', label: 'Manual' },
    { value: 'name', label: 'Name (A-Z)' },
    { value: 'balance', label: 'Balance (High-Low)' },
];


export const ACCOUNT_TYPE_STYLES: { [key in AccountType]: { icon: string; color: string } } = {
    'Checking': { icon: 'account_balance', color: 'text-blue-500' },
    'Savings': { icon: 'savings', color: 'text-green-500' },
    'Credit Card': { icon: 'credit_card', color: 'text-orange-500' },
    'Investment': { icon: 'show_chart', color: 'text-purple-500' }, // This will be the default for Investment
    'Loan': { icon: 'request_quote', color: 'text-red-500' },
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
    { id: 'inc-2', name: 'Refunds & Payback', color: '#F59E0B', icon: 'assignment_return', classification: 'income', subCategories: [] },
    { id: 'inc-3', name: 'Meal Vouchers', color: '#3B82F6', icon: 'restaurant_menu', classification: 'income', subCategories: [] },
    { id: 'inc-4', name: 'Income', color: '#84CC16', icon: 'attach_money', classification: 'income', subCategories: [] },
    { id: 'inc-5', name: 'Investment Income', color: '#6366F1', icon: 'show_chart', classification: 'income', subCategories: [] }
];

export const MOCK_EXPENSE_CATEGORIES: Category[] = [
    { id: 'exp-1', name: 'Housing', color: '#EF4444', icon: 'house', classification: 'expense', subCategories: [{ id: 'exp-1a', name: 'Mortgage', color: '#EF4444', icon: 'house', classification: 'expense', subCategories: [], parentId: 'exp-1' }, { id: 'exp-1b', name: 'Maintenance & Repairs', color: '#EF4444', icon: 'construction', classification: 'expense', subCategories: [], parentId: 'exp-1' }] },
    { id: 'exp-2', name: 'Food & Groceries', color: '#F97316', icon: 'shopping_cart', classification: 'expense', subCategories: [{ id: 'exp-2a', name: 'Supermarket', color: '#F97316', icon: 'shopping_cart', classification: 'expense', subCategories: [], parentId: 'exp-2' }, { id: 'exp-2b', name: 'Dining Out', color: '#F97316', icon: 'restaurant', classification: 'expense', subCategories: [], parentId: 'exp-2' }, { id: 'exp-2c', name: 'Cafes & Snacks', color: '#F97316', icon: 'local_cafe', classification: 'expense', subCategories: [], parentId: 'exp-2' }, { id: 'exp-2d', name: 'Delivery & Takeaway', color: '#F97316', icon: 'delivery_dining', classification: 'expense', subCategories: [], parentId: 'exp-2' }] },
    { id: 'exp-3', name: 'Transportation', color: '#3B82F6', icon: 'commute', classification: 'expense', subCategories: [{ id: 'exp-3a', name: 'Public Transport', color: '#3B82F6', icon: 'train', classification: 'expense', subCategories: [], parentId: 'exp-3' }, { id: 'exp-3b', name: 'Ride-Hailing', color: '#3B82F6', icon: 'local_taxi', classification: 'expense', subCategories: [], parentId: 'exp-3' }, { id: 'exp-3c', name: 'EV Charging / Fuel', color: '#3B82F6', icon: 'ev_station', classification: 'expense', subCategories: [], parentId: 'exp-3' }, { id: 'exp-3d', name: 'Parking & Tolls', color: '#3B82F6', icon: 'local_parking', classification: 'expense', subCategories: [], parentId: 'exp-3' }, { id: 'exp-3e', name: 'Transportation (Car Rental, Train)', color: '#3B82F6', icon: 'directions_car', classification: 'expense', subCategories: [], parentId: 'exp-3' }] },
    { id: 'exp-4', name: 'Shopping', color: '#8B5CF6', icon: 'shopping_bag', classification: 'expense', subCategories: [] },
    { id: 'exp-5', name: 'Bills & Utilities', color: '#0EA5E9', icon: 'receipt_long', classification: 'expense', subCategories: [{ id: 'exp-5a', name: 'Internet & TV', color: '#0EA5E9', icon: 'router', classification: 'expense', subCategories: [], parentId: 'exp-5' }, { id: 'exp-5b', name: 'Utilities (Gas, Water, Electricity)', color: '#0EA5E9', icon: 'bolt', classification: 'expense', subCategories: [], parentId: 'exp-5' }] },
    { id: 'exp-6', name: 'Entertainment', color: '#EC4899', icon: 'movie', classification: 'expense', subCategories: [{ id: 'exp-6a', name: 'Streaming', color: '#EC4899', icon: 'subscriptions', classification: 'expense', subCategories: [], parentId: 'exp-6' }, { id: 'exp-6b', name: 'Concerts & Events', color: '#EC4899', icon: 'local_activity', classification: 'expense', subCategories: [], parentId: 'exp-6' }, { id: 'exp-6c', name: 'Hobbies & Sports', color: '#EC4899', icon: 'sports_soccer', classification: 'expense', subCategories: [], parentId: 'exp-6' }] },
    { id: 'exp-7', name: 'Health & Wellness', color: '#10B981', icon: 'healing', classification: 'expense', subCategories: [{ id: 'exp-7a', name: 'Fitness', color: '#10B981', icon: 'fitness_center', classification: 'expense', subCategories: [], parentId: 'exp-7' }, { id: 'exp-7b', name: 'Health Insurance', color: '#10B981', icon: 'health_and_safety', classification: 'expense', subCategories: [], parentId: 'exp-7' }, { id: 'exp-7c', name: 'Medical (Doctor, Dentist, Pharmacy)', color: '#10B981', icon: 'medication', classification: 'expense', subCategories: [], parentId: 'exp-7' }] },
    { id: 'exp-8', name: 'Travel', color: '#F59E0B', icon: 'flight_takeoff', classification: 'expense', subCategories: [{ id: 'exp-8a', name: 'Flights', color: '#F59E0B', icon: 'flight', classification: 'expense', subCategories: [], parentId: 'exp-8' }, { id: 'exp-8b', name: 'Accommodation', color: '#F59E0B', icon: 'hotel', classification: 'expense', subCategories: [], parentId: 'exp-8' }, { id: 'exp-8c', name: 'Activities & Tours', color: '#F59E0B', icon: 'tour', classification: 'expense', subCategories: [], parentId: 'exp-8' }] },
    { id: 'exp-9', name: 'Personal', color: '#64748B', icon: 'person', classification: 'expense', subCategories: [{ id: 'exp-9a', name: 'Personal Care', color: '#64748B', icon: 'spa', classification: 'expense', subCategories: [], parentId: 'exp-9' }, { id: 'exp-9b', name: 'Gifts & Donations', color: '#64748B', icon: 'card_giftcard', classification: 'expense', subCategories: [], parentId: 'exp-9' }, { id: 'exp-9c', name: 'Pet Care', color: '#64748B', icon: 'pets', classification: 'expense', subCategories: [], parentId: 'exp-9' }] },
    { id: 'exp-10', name: 'Finances', color: '#A855F7', icon: 'account_balance', classification: 'expense', subCategories: [{ id: 'exp-10a', name: 'Bank Fees', color: '#A855F7', icon: 'price_check', classification: 'expense', subCategories: [], parentId: 'exp-10' }, { id: 'exp-10b', name: 'Retirement Contribution', color: '#A855F7', icon: 'savings', classification: 'expense', subCategories: [], parentId: 'exp-10' }, { id: 'exp-10c', name: 'Investments', color: '#A855F7', icon: 'show_chart', classification: 'expense', subCategories: [], parentId: 'exp-10' }] },
    { id: 'exp-11', name: 'Miscellaneous', color: '#78716C', icon: 'category', classification: 'expense', subCategories: [{ id: 'exp-11a', name: 'Services', color: '#78716C', icon: 'build', classification: 'expense', subCategories: [], parentId: 'exp-11' }, { id: 'exp-11b', name: 'Visa', color: '#78716C', icon: 'airplanemode_active', classification: 'expense', subCategories: [], parentId: 'exp-11' }, { id: 'exp-11c', name: 'Electronics & Gadgets', color: '#78716C', icon: 'devices', classification: 'expense', subCategories: [], parentId: 'exp-11' }, { id: 'exp-11d', name: 'Uncategorized', color: '#78716C', icon: 'help', classification: 'expense', subCategories: [], parentId: 'exp-11' }] }
];

export const ACCOUNT_ICON_LIST: string[] = [
    'account_balance', 'savings', 'credit_card', 'show_chart', 'request_quote', 'home', 'currency_bitcoin', 'directions_car', 'palette', 'school', 'receipt', 'category', 'wallet', 'paid', 'account_balance_wallet', 'monetization_on', 'euro_symbol', 'payments', 'store', 'apartment', 'business_center', 'cottage', 'flight', 'local_gas_station', 'local_mall', 'restaurant', 'shopping_cart', 'work', 'build'
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
    'emergency', 'report', 'design_services'
];