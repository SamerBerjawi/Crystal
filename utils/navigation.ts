import type { Page } from '../types';
import { OVERVIEW_TABS } from './overviewLayout';

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
  { id: 'overview', label: 'Home', icon: 'home-02', home: 'Dashboard',
    tabs: OVERVIEW_TABS.map((view, index) => ({ label: view.label, page: 'Dashboard' as Page, tab: index === 0 ? undefined : view.id, icon: view.icon })),
  },
  {
    id: 'accounts',
    label: 'Accounts',
    icon: 'layers-01',
    home: 'Accounts',
    tabs: [
      { label: 'All', page: 'Accounts', icon: 'layers-01' },
      { label: 'Cash', page: 'Accounts', tab: 'accounts', icon: 'wallet-02' },
      { label: 'Cards', page: 'Accounts', tab: 'cards', icon: 'credit-card' },
      { label: 'Loans', page: 'Accounts', tab: 'loans', icon: 'agreement-01' },
      { label: 'Assets', page: 'Accounts', tab: 'assets', icon: 'home-01' },
    ],
    otherPages: ['AccountDetail'],
  },
  {
    id: 'transactions',
    label: 'Transactions',
    icon: 'arrow-data-transfer-horizontal',
    home: 'Transactions',
    tabs: [
      { label: 'Ledger', page: 'Transactions', icon: 'logs' },
      { label: 'Queue', page: 'Transactions', tab: 'review', icon: 'tick-02' },
      { label: 'Rules', page: 'Rules', icon: 'flash' },
      { label: 'Merchants', page: 'Merchants', icon: 'store-01' },
    ],
  },
  {
    id: 'planning',
    label: 'Planning',
    icon: 'compass-01',
    home: 'Forecasting',
    tabs: [
      { label: 'Forecast', page: 'Forecasting', icon: 'chart-evaluation' },
      { label: 'Budget', page: 'Budget', icon: 'pie-chart-01' },
      { label: 'Goals', page: 'Goals', icon: 'target-01' },
      { label: 'Debt payoff', page: 'Debt Payoff', icon: 'target-02' },
      { label: 'Calendar', page: 'Schedule & Bills', icon: 'calendar-03' },
      { label: 'Subscriptions', page: 'Subscriptions', icon: 'repeat-one-01' },
      { label: 'Tasks', page: 'Tasks', icon: 'task-01' },
    ],
  },
  {
    id: 'investments',
    label: 'Investments',
    icon: 'chart-increase',
    home: 'Investments',
    tabs: [
      { label: 'Portfolio', page: 'Investments', icon: 'chart-candlestick' },
      { label: 'Holdings', page: 'Investments', tab: 'holdings', icon: 'coins-01' },
      { label: 'Performance', page: 'Investments', tab: 'performance', icon: 'chart-increase' },
      { label: 'Activity', page: 'Investments', tab: 'activity', icon: 'clock-01' },
    ],
    otherPages: ['HoldingDetail'],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: 'analytics-01',
    home: 'Reports',
    tabs: [
      { label: 'Reports', page: 'Reports', icon: 'chart-column' },
      { label: 'Weekly', page: 'Weekly Recap', icon: 'calendar-03' },
      { label: 'Invoices', page: 'Quotes & Invoices', icon: 'invoice-02' },
      { label: 'Challenges', page: 'Challenges', icon: 'award-01' },
      { label: 'Wrapped', page: 'Wrapped', icon: 'gift' },
      { label: 'FIRE', page: 'FIRE', icon: 'fire' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'settings-05',
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
