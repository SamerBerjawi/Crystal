import React from 'react';
import { Category, Page, AccountType, Currency, Theme, RecurrenceFrequency, WeekendAdjustment } from './types';


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

// Common Styles
export const BTN_PRIMARY_STYLE = "bg-primary-500 text-white font-semibold py-2 px-4 rounded-lg shadow-card hover:bg-primary-600 transition-all duration-200";
export const BTN_SECONDARY_STYLE = "bg-light-card dark:bg-dark-card text-light-text dark:text-dark-text font-semibold py-2 px-4 rounded-lg shadow-card hover:bg-gray-50 dark:hover:bg-dark-border transition-colors duration-200";
export const BTN_DANGER_STYLE = "text-red-500 hover:text-red-400 font-semibold py-2 px-4 rounded-lg hover:bg-red-500/10 transition-colors";
export const INPUT_BASE_STYLE = "w-full appearance-none bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text rounded-lg py-2 px-4 border border-gray-200 dark:border-dark-border focus:outline-none focus:ring-2 focus:ring-primary-500 transition-shadow duration-200";
export const SELECT_WRAPPER_STYLE = "relative w-full";
export const SELECT_ARROW_STYLE = "pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-light-text-secondary dark:text-dark-text-secondary";

export interface NavItem {
  name: Page;
  icon: React.ReactElement;
  subItems?: NavItem[];
}

export const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', icon: <span className="material-symbols-outlined">dashboard</span> },
  { name: 'Accounts', icon: <span className="material-symbols-outlined">wallet</span> },
  { name: 'Transactions', icon: <span className="material-symbols-outlined">receipt_long</span> },
  { name: 'Budget', icon: <span className="material-symbols-outlined">pie_chart</span> },
  { name: 'Forecasting', icon: <span className="material-symbols-outlined">trending_up</span> },
  { name: 'Investments', icon: <span className="material-symbols-outlined">show_chart</span> },
  { name: 'Warrants', icon: <span className="material-symbols-outlined">verified</span> },
  { name: 'Schedule & Bills', icon: <span className="material-symbols-outlined">calendar_month</span> },
  { name: 'Tasks', icon: <span className="material-symbols-outlined">task_alt</span> },
  { 
    name: 'Settings', 
    icon: <span className="material-symbols-outlined">settings</span>,
    subItems: [
      { name: 'Preferences', icon: <span className="material-symbols-outlined">tune</span> },
      { name: 'Personal Info', icon: <span className="material-symbols-outlined">person</span> },
      { name: 'Categories', icon: <span className="material-symbols-outlined">category</span> },
      { name: 'Tags', icon: <span className="material-symbols-outlined">label</span> },
      { name: 'User Management', icon: <span className="material-symbols-outlined">manage_accounts</span> },
      { name: 'Enable Banking', icon: <span className="material-symbols-outlined">sync</span> },
      { name: 'Data Management', icon: <span className="material-symbols-outlined">settings_backup_restore</span> },
    ]
  },
];

export const ASSET_TYPES: AccountType[] = ['Checking', 'Savings', 'Investment', 'Crypto', 'Property', 'Vehicle', 'Other Assets'];
export const DEBT_TYPES: AccountType[] = ['Credit Card', 'Loan', 'Other Liabilities'];
export const ALL_ACCOUNT_TYPES: AccountType[] = [...ASSET_TYPES, ...DEBT_TYPES];
export const LIQUID_ACCOUNT_TYPES: AccountType[] = ['Checking', 'Savings', 'Credit Card'];
export const CURRENCIES: Currency[] = ['USD', 'EUR', 'GBP', 'BTC', 'RON'];
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

export const ACCOUNT_TYPE_STYLES: { [key in AccountType]: { icon: string; color: string } } = {
    'Checking': { icon: 'account_balance', color: 'text-blue-500' },
    'Savings': { icon: 'savings', color: 'text-green-500' },
    'Credit Card': { icon: 'credit_card', color: 'text-orange-500' },
    'Investment': { icon: 'trending_up', color: 'text-purple-500' },
    'Loan': { icon: 'request_quote', color: 'text-red-500' },
    'Property': { icon: 'home', color: 'text-yellow-500' },
    'Crypto': { icon: 'currency_bitcoin', color: 'text-amber-500' },
    'Vehicle': { icon: 'directions_car', color: 'text-cyan-500' },
    'Other Assets': { icon: 'category', color: 'text-lime-500' },
    'Other Liabilities': { icon: 'receipt_long', color: 'text-pink-500' },
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
    { id: 'exp-11', name: 'Miscellaneous', color: '#78716C', icon: 'category', classification: 'expense', subCategories: [{ id: 'exp-11a', name: 'Services', color: '#78716C', icon: 'miscellaneous_services', classification: 'expense', subCategories: [], parentId: 'exp-11' }, { id: 'exp-11b', name: 'Visa', color: '#78716C', icon: 'airplanemode_active', classification: 'expense', subCategories: [], parentId: 'exp-11' }, { id: 'exp-11c', name: 'Electronics & Gadgets', color: '#78716C', icon: 'devices', classification: 'expense', subCategories: [], parentId: 'exp-11' }, { id: 'exp-11d', name: 'Uncategorized', color: '#78716C', icon: 'help', classification: 'expense', subCategories: [], parentId: 'exp-11' }] }
];

export const ACCOUNT_ICON_LIST: string[] = [
    'account_balance', 'savings', 'credit_card', 'trending_up', 'request_quote', 'home', 'currency_bitcoin', 'directions_car', 'palette', 'school', 'receipt_long', 'category', 'wallet', 'paid', 'account_balance_wallet', 'monetization_on', 'euro_symbol', 'payments', 'store', 'apartment', 'business_center', 'cottage', 'flight', 'local_gas_station', 'local_mall', 'restaurant', 'shopping_cart', 'work', 'build'
];

export const CATEGORY_ICON_LIST: string[] = [
    'restaurant', 'local_cafe', 'local_bar', 'shopping_cart', 'local_mall', 'store', 'house', 'apartment',
    'home_work', 'paid', 'savings', 'trending_up', 'credit_card', 'receipt_long', 'request_quote',
    'flight', 'directions_car', 'train', 'local_taxi', 'commute', 'local_gas_station', 'ev_station', 'local_shipping',
    'healing', 'medication', 'local_hospital', 'health_and_safety', 'monitor_heart', 'volunteer_activism',
    'subscriptions', 'movie', 'music_note', 'sports_esports', 'stadia_controller', 'fitness_center', 'sports_soccer',
    'phone_iphone', 'computer', 'desktop_windows', 'devices', 'videogame_asset', 'checkroom', 'styler', 'diamond', 'wc',
    'child_care', 'pets', 'school', 'card_giftcard', 'redeem', 'celebration', 'family_restroom', 'construction',
    'attach_money', 'work', 'payments', 'account_balance', 'currency_exchange', 'show_chart', 'sell',
    'miscellaneous_services', 'emergency', 'report', 'design_services'
];