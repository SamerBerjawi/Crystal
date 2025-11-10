import React, { useState, useEffect } from 'react';
import { Category, Page, AccountType, Currency, Theme, RecurrenceFrequency, WeekendAdjustment, DefaultAccountOrder, Duration, InvestmentSubType, PropertyType } from './types';


// FIX: Renamed AuraFinanceLogo to CrystalLogo to finalize rebranding.
export function CrystalLogo({ showText = true }: { showText?: boolean; }) {
  const logoSrc = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9InVybCgjcGFpbnQwX2xpbmVhcl8xMDJfMzkxKSIvPgo8cGF0aCBkPSJNMjAuMDAwMyAzMy4zMzM3TDEwIDIwLjAwMDNMMjAuMDAwMyA2LjY2Njk5TDMwIDIwLjAwMDNMMjAuMDAwMyAzMy4zMzM3WiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJwYWludDBfbGluZWFyXzEwMl8zOTEiIHgxPSIwIiB5MT0iMCIgeDI9IjQwIiB5Mj0iNDAiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KPHN0b3Agb2Zmc2V0PSIwLjI4IiBzdG9wLWNvbG9yPSIjRkY5NTAwIi8+CjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI0ZEMUQxRCIvPgo8L2xpbmVhckdyYWRpZW50Pgo8L2RlZnM+Cjwvc3ZnPgo=`;

  return (
    <div className="flex items-center gap-2">
      <img src={logoSrc} alt="Crystal Logo" className="h-8 w-8" />
      {showText && <span className="font-bold text-xl">Crystal</span>}
    </div>
  );
}

export type NavItem = {
  name: Page;
  icon: string;
  subItems?: NavItem[];
};

export const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', icon: 'space_dashboard' },
  { name: 'Accounts', icon: 'wallet' },
  { name: 'Transactions', icon: 'receipt_long' },
  { name: 'Investments', icon: 'candlestick_chart' },
  { name: 'Budget', icon: 'pie_chart' },
  { name: 'Forecasting', icon: 'show_chart' },
  { name: 'Schedule & Bills', icon: 'calendar_month' },
  { name: 'Tasks', icon: 'task_alt' },
  { name: 'Settings', icon: 'settings', subItems: [
    { name: 'Preferences', icon: 'tune' },
    { name: 'Personal Info', icon: 'person' },
    { name: 'AI Assistant', icon: 'smart_toy' },
    { name: 'Categories', icon: 'category' },
    { name: 'Tags', icon: 'label' },
    { name: 'Data Management', icon: 'database' },
  ]},
];

export const MOCK_INCOME_CATEGORIES: Category[] = [
    { id: 'inc-1', name: 'Salary', color: '#10B981', icon: 'work', classification: 'income', subCategories: [] },
    { id: 'inc-2', name: 'Freelance', color: '#3B82F6', icon: 'computer', classification: 'income', subCategories: [] },
    { id: 'inc-3', name: 'Investment Income', color: '#FBBF24', icon: 'trending_up', classification: 'income', subCategories: [] },
];

export const MOCK_EXPENSE_CATEGORIES: Category[] = [
    { id: 'exp-1', name: 'Food & Groceries', color: '#F97316', icon: 'shopping_cart', classification: 'expense', subCategories: [] },
    { id: 'exp-2', name: 'Housing', color: '#6366F1', icon: 'home', classification: 'expense', subCategories: [] },
    { id: 'exp-3', name: 'Transportation', color: '#EF4444', icon: 'commute', classification: 'expense', subCategories: [] },
    { id: 'exp-4', name: 'Bills & Utilities', color: '#3B82F6', icon: 'receipt', classification: 'expense', subCategories: [] },
    { id: 'exp-5', name: 'Entertainment', color: '#8B5CF6', icon: 'movie', classification: 'expense', subCategories: [] },
    { id: 'exp-6', name: 'Shopping', color: '#EC4899', icon: 'shopping_bag', classification: 'expense', subCategories: [] },
    { id: 'exp-7', name: 'Health & Wellness', color: '#10B981', icon: 'local_hospital', classification: 'expense', subCategories: [] },
];

export const BTN_PRIMARY_STYLE = "bg-primary-500 text-white font-semibold py-2 px-4 rounded-lg shadow-card hover:bg-primary-600 transition-all duration-200";
export const BTN_SECONDARY_STYLE = "bg-light-fill dark:bg-dark-fill text-light-text dark:text-dark-text font-semibold py-2 px-4 rounded-lg shadow-card hover:bg-black/10 dark:hover:bg-white/10 transition-all duration-200";
export const BTN_DANGER_STYLE = "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-semibold py-2 px-4 rounded-lg shadow-card hover:bg-red-200 dark:hover:bg-red-900/60 transition-all duration-200";
export const INPUT_BASE_STYLE = "w-full bg-light-fill dark:bg-dark-fill h-10 px-3 rounded-lg border-2 border-transparent focus:outline-none focus:border-primary-500 transition-colors";
export const SELECT_STYLE = "w-full bg-light-fill dark:bg-dark-fill h-10 pl-3 pr-8 rounded-lg border-2 border-transparent focus:outline-none focus:border-primary-500 transition-colors appearance-none";
export const SELECT_WRAPPER_STYLE = "relative w-full";
export const SELECT_ARROW_STYLE = "absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-light-text-secondary dark:text-dark-text-secondary";

export const ALL_ACCOUNT_TYPES: AccountType[] = ['Checking', 'Savings', 'Credit Card', 'Investment', 'Loan', 'Lending', 'Property', 'Vehicle', 'Other Assets', 'Other Liabilities'];
export const ASSET_TYPES: AccountType[] = ['Checking', 'Savings', 'Investment', 'Property', 'Vehicle', 'Other Assets', 'Lending'];
export const DEBT_TYPES: AccountType[] = ['Credit Card', 'Loan', 'Other Liabilities'];
export const LIQUID_ACCOUNT_TYPES: AccountType[] = ['Checking', 'Savings'];

export const INVESTMENT_SUB_TYPES: InvestmentSubType[] = ['Stock', 'ETF', 'Crypto', 'Pension Fund', 'Spare Change', 'Other'];
export const PROPERTY_TYPES: PropertyType[] = ['House', 'Apartment', 'Land', 'Commercial', 'Other'];


export const ACCOUNT_TYPE_STYLES: Record<AccountType, { icon: string; color: string }> = {
    'Checking': { icon: 'account_balance', color: 'text-blue-500' },
    'Savings': { icon: 'savings', color: 'text-green-500' },
    'Credit Card': { icon: 'credit_card', color: 'text-orange-500' },
    'Investment': { icon: 'trending_up', color: 'text-purple-500' },
    'Loan': { icon: 'request_quote', color: 'text-red-500' },
    'Lending': { icon: 'real_estate_agent', color: 'text-lime-500' },
    'Property': { icon: 'home', color: 'text-amber-500' },
    'Vehicle': { icon: 'directions_car', color: 'text-cyan-500' },
    'Other Assets': { icon: 'inventory_2', color: 'text-pink-500' },
    'Other Liabilities': { icon: 'receipt_long', color: 'text-yellow-500' },
};

export const INVESTMENT_SUB_TYPE_STYLES: Record<InvestmentSubType, { icon: string; color: string }> = {
    'Stock': { icon: 'show_chart', color: 'text-purple-500' },
    'ETF': { icon: 'hub', color: 'text-indigo-500' },
    'Crypto': { icon: 'currency_bitcoin', color: 'text-orange-400' },
    'Pension Fund': { icon: 'elderly', color: 'text-sky-500' },
    'Spare Change': { icon: 'toll', color: 'text-lime-500' },
    'Other': { icon: 'inventory_2', color: 'text-fuchsia-500' },
};

export const CURRENCIES: Currency[] = ['EUR', 'USD', 'GBP', 'BTC', 'RON'];

export const CURRENCY_OPTIONS = ['EUR (€)', 'USD ($)', 'GBP (£)', 'RON (lei)'];
export const TIMEZONE_OPTIONS = ['(UTC-05:00) Eastern Time (US & Canada)', '(UTC) Coordinated Universal Time', '(+01:00) Brussels', '(+02:00) Athens, Bucharest', '(+09:00) Tokyo'];
export const COUNTRY_OPTIONS = ['United States', 'United Kingdom', 'France', 'Germany', 'Spain', 'Italy', 'Canada', 'Australia', 'Japan', 'Romania', 'Belgium'];
export const DURATION_OPTIONS: { label: string, value: Duration }[] = [
    { label: 'Today', value: 'TODAY' },
    { label: 'This Week', value: 'WTD' },
    { label: 'This Month', value: 'MTD' },
    { label: 'Last 30 Days', value: '30D' },
    { label: 'Last 60 Days', value: '60D' },
    { label: 'Last 90 Days', value: '90D' },
    { label: 'Last 6 Months', value: '6M' },
    { label: 'This Year', value: 'YTD' },
    { label: 'Last 12 Months', value: '1Y' },
    { label: 'All Time', value: 'ALL' },
];
export const DEFAULT_ACCOUNT_ORDER_OPTIONS: { label: string, value: DefaultAccountOrder }[] = [
    { label: 'Manual', value: 'manual'},
    { label: 'Name (A-Z)', value: 'name' },
    { label: 'Balance (High-Low)', value: 'balance' },
];

export const FREQUENCIES: { label: string; value: RecurrenceFrequency }[] = [
    { label: 'Daily', value: 'daily' },
    { label: 'Weekly', value: 'weekly' },
    { label: 'Monthly', value: 'monthly' },
    { label: 'Yearly', value: 'yearly' },
];

export const WEEKEND_ADJUSTMENTS: { label: string; value: WeekendAdjustment }[] = [
    { label: 'On the exact day', value: 'on' },
    { label: 'Move to following business day', value: 'after' },
    { label: 'Move to preceding business day', value: 'before' },
];

export const CATEGORY_ICON_LIST = ['shopping_cart', 'home', 'commute', 'receipt', 'movie', 'shopping_bag', 'local_hospital', 'work', 'computer', 'trending_up', 'school', 'flight', 'restaurant', 'fitness_center', 'pets', 'family_restroom', 'build', 'phone_iphone', 'checkroom', 'savings', 'redeem', 'sell', 'monitoring', 'account_balance', 'paid', 'request_quote'];

export const ACCOUNT_ICON_LIST = [ 'account_balance', 'wallet', 'savings', 'credit_card', 'trending_up', 'request_quote', 'real_estate_agent', 'home', 'directions_car', 'inventory_2', 'receipt_long', 'show_chart', 'hub', 'currency_bitcoin', 'elderly', 'toll', 'inventory_2', 'business_center', 'store', 'payments' ];

export const BRAND_COLORS = ['#6366F1', '#FBBF24', '#10B981', '#EF4444', '#3B82F6', '#8B5CF6', '#F97316', '#EC4899', '#06B6D4', '#84CC16'];
