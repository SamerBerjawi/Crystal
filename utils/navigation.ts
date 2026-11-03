import type { Page } from '../types';

export interface HubTab {
  label: string;
  page: Page;
  /** For tabs that share one page. */
  tab?: string;
  /** Hugeicon identifier (free stroke rounded) */
  icon?: string;
}

export interface Hub {
  id: string;
  label: string;
  icon: string;
  /** Where the pill goes. */
  home: Page;
  tabs: HubTab[];
  /** Pages in this hub with no tab of their own. */
  otherPages?: Page[];
}

/**
 * The seven hubs (D-005, D-017). Tabs list what exists today. Investments gains theirs in module 7, when
 * those pages are built.
 */
export const HUBS: Hub[] = [
  { id: 'overview', label: 'Overview', icon: 'nav_overview', home: 'Dashboard', tabs: [] },
  {
    id: 'accounts',
    label: 'Accounts',
    icon: 'nav_accounts',
    home: 'Accounts',
    tabs: [
      { label: 'Cards', page: 'Accounts', icon: 'credit-card' },
      { label: 'Accounts', page: 'Accounts', tab: 'accounts', icon: 'wallet-02' },
      { label: 'Loans', page: 'Accounts', tab: 'loans', icon: 'bank' },
      { label: 'Assets', page: 'Accounts', tab: 'assets', icon: 'home-01' },
    ],
    otherPages: ['AccountDetail'],
  },
  {
    id: 'transactions',
    label: 'Transactions',
    icon: 'nav_transactions',
    home: 'Transactions',
    tabs: [
      { label: 'Ledger', page: 'Transactions', icon: 'arrow-data-transfer-horizontal' },
      { label: 'Review queue', page: 'Transactions', tab: 'review', icon: 'tick-02' },
      { label: 'Rules', page: 'Rules', icon: 'flash' },
      { label: 'Merchants', page: 'Merchants', icon: 'store-01' },
    ],
  },
  {
    id: 'planning',
    label: 'Planning',
    icon: 'nav_planning',
    home: 'Forecasting',
    tabs: [
      { label: 'Forecast', page: 'Forecasting', icon: 'chart-decrease' },
      { label: 'Budget', page: 'Budget', icon: 'pie-chart-01' },
      { label: 'Goals', page: 'Goals', icon: 'piggy-bank' },
      { label: 'Calendar', page: 'Schedule & Bills', icon: 'calendar-03' },
      { label: 'Subscriptions', page: 'Subscriptions', icon: 'repeat-one-01' },
      { label: 'Tasks', page: 'Tasks', icon: 'task-01' },
    ],
  },
  {
    id: 'investments',
    label: 'Investments',
    icon: 'nav_investments',
    home: 'Investments',
    tabs: [
      { label: 'Portfolio', page: 'Investments', icon: 'chart-line-data-01' },
      { label: 'Holdings', page: 'Investments', tab: 'holdings', icon: 'coins-01' },
      { label: 'Activity', page: 'Investments', tab: 'activity', icon: 'arrow-data-transfer-horizontal' },
    ],
    otherPages: ['HoldingDetail'],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: 'nav_reports',
    home: 'Reports',
    tabs: [
      { label: 'Reports', page: 'Reports', icon: 'analytics-01' },
      { label: 'Invoices', page: 'Quotes & Invoices', icon: 'invoice-02' },
      { label: 'Challenges', page: 'Challenges', icon: 'award-01' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'settings',
    home: 'Personal Info',
    tabs: [
      { label: 'Profile', page: 'Personal Info', icon: 'user' },
      { label: 'Preferences', page: 'Preferences', icon: 'sliders-horizontal' },
      { label: 'Connections', page: 'Integrations', icon: 'bank' },
      { label: 'Categories', page: 'Categories', icon: 'folder-01' },
      { label: 'Tags', page: 'Tags', icon: 'tag-01' },
      { label: 'Data', page: 'Data Management', icon: 'download-04' },
      { label: 'Help', page: 'Documentation', icon: 'book-open-01' },
    ],
    otherPages: ['EnableBankingCallback'],
  },
];

export const PHONE_BAR_HUBS = ['overview', 'accounts', 'transactions', 'planning'];

export const hubForPage = (page: Page): Hub =>
  HUBS.find(hub => hub.home === page || hub.tabs.some(tab => tab.page === page) || hub.otherPages?.includes(page)) ?? HUBS[0];
