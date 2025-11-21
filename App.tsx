
// FIX: Import `useMemo` from React to resolve the 'Cannot find name' error.
import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Accounts = lazy(() => import('./pages/Accounts'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Budgeting = lazy(() => import('./pages/Budgeting'));
const Forecasting = lazy(() => import('./pages/Forecasting'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const SchedulePage = lazy(() => import('./pages/Schedule'));
const CategoriesPage = lazy(() => import('./pages/Categories'));
const TagsPage = lazy(() => import('./pages/Tags'));
const PersonalInfoPage = lazy(() => import('./pages/PersonalInfo'));
const DataManagement = lazy(() => import('./pages/DataImportExport'));
const PreferencesPage = lazy(() => import('./pages/Preferences'));
const AccountDetail = lazy(() => import('./pages/AccountDetail'));
const InvestmentsPage = lazy(() => import('./pages/Investments'));
const TasksPage = lazy(() => import('./pages/Tasks'));
const WarrantsPage = lazy(() => import('./pages/Warrants'));
const AIAssistantSettingsPage = lazy(() => import('./pages/AIAssistantSettings'));
const Documentation = lazy(() => import('./pages/Documentation').then(module => ({ default: module.Documentation })));
// UserManagement is removed
// FIX: Import FinancialData from types.ts
// FIX: Add `Tag` to the import from `types.ts`.
import { Page, Theme, Category, User, Transaction, Account, RecurringTransaction, RecurringTransactionOverride, WeekendAdjustment, FinancialGoal, Budget, ImportExportHistoryItem, AppPreferences, AccountType, InvestmentTransaction, Task, Warrant, ScraperConfig, ImportDataType, FinancialData, Currency, BillPayment, BillPaymentStatus, Duration, InvestmentSubType, Tag, LoanPaymentOverrides, ScheduledPayment } from './types';
import { MOCK_INCOME_CATEGORIES, MOCK_EXPENSE_CATEGORIES, LIQUID_ACCOUNT_TYPES } from './constants';
import { v4 as uuidv4 } from 'uuid';
import ChatFab from './components/ChatFab';
const Chatbot = lazy(() => import('./components/Chatbot'));
import { convertToEur, CONVERSION_RATES, arrayToCSV, downloadCSV, parseDateAsUTC } from './utils';
import { useDebounce } from './hooks/useDebounce';
import { useAuth } from './hooks/useAuth';
import useLocalStorage from './hooks/useLocalStorage';
const OnboardingModal = lazy(() => import('./components/OnboardingModal'));

const initialFinancialData: FinancialData = {
    accounts: [],
    transactions: [],
    investmentTransactions: [],
    recurringTransactions: [],
    recurringTransactionOverrides: [],
    loanPaymentOverrides: {},
    financialGoals: [],
    budgets: [],
    tasks: [],
    warrants: [],
    scraperConfigs: [],
    importExportHistory: [],
    // FIX: Add `tags` to the initial financial data structure.
    tags: [],
    incomeCategories: MOCK_INCOME_CATEGORIES, // Keep default categories
    expenseCategories: MOCK_EXPENSE_CATEGORIES,
    billsAndPayments: [],
    accountOrder: [],
    taskOrder: [],
    preferences: {
        currency: 'EUR (€)',
        language: 'English (en)',
        timezone: 'Europe/Brussels',
        dateFormat: 'DD/MM/YYYY',
        defaultPeriod: 'MTD',
        defaultAccountOrder: 'name',
        country: 'Belgium',
    },
};

const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      console.warn(`Failed to read "${key}" from localStorage.`, error);
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.warn(`Failed to write "${key}" to localStorage.`, error);
    }
  },
  removeItem: (key: string) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to remove "${key}" from localStorage.`, error);
    }
  },
};

const PageLoader: React.FC<{ label?: string }> = ({ label = 'Loading content...' }) => (
  <div className="flex items-center justify-center py-10 text-primary-500" role="status" aria-live="polite">
    <svg className="animate-spin h-8 w-8 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 1