import type { Page } from '../types';

export interface HubTab {
  label: string;
  page: Page;
  /** For tabs that share one page. */
  tab?: string;
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
 * The seven hubs (D-005, D-017). Tabs list what exists today. Investments, Review queue and Goals gain theirs in modules
 * 8, 5 and 7, when those pages are built.
 */
export const HUBS: Hub[] = [
  { id: 'overview', label: 'Overview', icon: 'nav_overview', home: 'Dashboard', tabs: [] },
  {
    id: 'accounts',
    label: 'Accounts',
    icon: 'nav_accounts',
    home: 'Accounts',
    tabs: [
      { label: 'Cards', page: 'Accounts' },
      { label: 'Accounts', page: 'Accounts', tab: 'accounts' },
      { label: 'Loans', page: 'Accounts', tab: 'loans' },
      { label: 'Assets', page: 'Accounts', tab: 'assets' },
    ],
    otherPages: ['AccountDetail'],
  },
  {
    id: 'transactions',
    label: 'Transactions',
    icon: 'nav_transactions',
    home: 'Transactions',
    tabs: [
      { label: 'Ledger', page: 'Transactions' },
      { label: 'Rules', page: 'Rules' },
      { label: 'Merchants', page: 'Merchants' },
    ],
  },
  {
    id: 'planning',
    label: 'Planning',
    icon: 'nav_planning',
    home: 'Budget',
    tabs: [
      { label: 'Budget', page: 'Budget' },
      { label: 'Forecast', page: 'Forecasting' },
      { label: 'Calendar', page: 'Schedule & Bills' },
      { label: 'Subscriptions', page: 'Subscriptions' },
      { label: 'Tasks', page: 'Tasks' },
    ],
  },
  { id: 'investments', label: 'Investments', icon: 'nav_investments', home: 'Investments', tabs: [], otherPages: ['HoldingDetail'] },
  {
    id: 'reports',
    label: 'Reports',
    icon: 'nav_reports',
    home: 'Reports',
    tabs: [
      { label: 'Reports', page: 'Reports' },
      { label: 'Invoices', page: 'Quotes & Invoices' },
      { label: 'Challenges', page: 'Challenges' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'settings',
    home: 'Personal Info',
    tabs: [
      { label: 'Profile', page: 'Personal Info' },
      { label: 'Preferences', page: 'Preferences' },
      { label: 'Connections', page: 'Integrations' },
      { label: 'Categories', page: 'Categories' },
      { label: 'Tags', page: 'Tags' },
      { label: 'Data', page: 'Data Management' },
      { label: 'Help', page: 'Documentation' },
    ],
    otherPages: ['Settings', 'EnableBankingCallback'],
  },
];

export const PHONE_BAR_HUBS = ['overview', 'accounts', 'transactions', 'planning'];

export const hubForPage = (page: Page): Hub =>
  HUBS.find(hub => hub.home === page || hub.tabs.some(tab => tab.page === page) || hub.otherPages?.includes(page)) ?? HUBS[0];
