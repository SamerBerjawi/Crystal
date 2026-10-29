import type { Page } from '../types';

/**
 * URLs of the New pages (UI_UX_DESIGN_REFERENCE.md §5.0). Each New page lives at its own `-new` path
 * beside the original page, with no feature flag. Pure, so it is unit tested (tests/unit/newRoutes.test.ts).
 */

export type NewPage =
  | 'Dashboard' | 'Accounts' | 'AccountDetail' | 'Transactions' | 'Reports'
  | 'Budget' | 'Forecasting' | 'Schedule & Bills' | 'Investments' | 'HoldingDetail'
  | 'Subscriptions' | 'Quotes & Invoices' | 'Tasks' | 'Challenges' | 'Settings';

/** Top-level New pages and their paths. Detail pages (`AccountDetail`, `HoldingDetail`) take an id segment. */
export const NEW_PAGE_PATHS: Record<Exclude<NewPage, 'AccountDetail' | 'HoldingDetail'>, string> = {
  Dashboard: '/dashboard-new',
  Accounts: '/accounts-new',
  Transactions: '/transactions-new',
  Reports: '/reports-new',
  Budget: '/budget-new',
  Forecasting: '/forecasting-new',
  'Schedule & Bills': '/schedule-new',
  Investments: '/investments-new',
  Subscriptions: '/subscriptions-new',
  'Quotes & Invoices': '/invoices-new',
  Tasks: '/tasks-new',
  Challenges: '/challenges-new',
  Settings: '/settings-new',
};

/** Short titles for the shell header and placeholders. */
export const NEW_PAGE_TITLES: Record<NewPage, string> = {
  Dashboard: 'Dashboard', Accounts: 'Accounts', AccountDetail: 'Account', Transactions: 'Transactions',
  Reports: 'Reports', Budget: 'Budget', Forecasting: 'Forecasting', 'Schedule & Bills': 'Schedule',
  Investments: 'Investments', HoldingDetail: 'Holding', Subscriptions: 'Subscriptions',
  'Quotes & Invoices': 'Invoices', Tasks: 'Tasks', Challenges: 'Challenges', Settings: 'Settings',
};

/** One line under the shell header title (carried over from the classic page headers). */
export const NEW_PAGE_SUBTITLES: Record<NewPage, string> = {
  Dashboard: 'Real-time financial pulse across accounts, investments, and commitments.',
  Accounts: 'Track cash, property, debt and investments to see your real-time net worth.',
  AccountDetail: 'Balance, activity and forecast for this account.',
  Transactions: 'Every inflow and outflow, with filters, splits and tags.',
  Reports: 'Dive into spending habits, budget performance and automated insights.',
  Budget: 'Set envelopes, guardrails and spending alerts that adapt to your cash flow.',
  Forecasting: 'Projected cash, income and obligations to plan weeks and months ahead.',
  'Schedule & Bills': 'Track subscriptions, insurance, salary, loan payments and billing cycles.',
  Investments: 'Track equities, ETFs, crypto and warrants, with yield metrics in real time.',
  HoldingDetail: 'Position, performance and transactions for this holding.',
  Subscriptions: 'Track digital products, contracts, memberships and loyalty cards in one place.',
  'Quotes & Invoices': 'Track invoices and quotes through their full lifecycle.',
  Tasks: 'Keep track of your financial to-dos.',
  Challenges: 'Complete challenges, unlock badges and beat your personal bests.',
  Settings: 'Preferences, security, categories and integrations.',
};

/** Dev-only token and primitive gallery. */
export const NEW_GALLERY_PATH = '/design-new';

/**
 * Classic pages that become sections of another New page (decision Q10). Opening the classic page's
 * equivalent in the New UI lands on the page that now holds it.
 */
const MERGED_INTO: Partial<Record<Page, NewPage>> = {
  Warrants: 'Investments',
  Categories: 'Settings',
  Tags: 'Settings',
  Rules: 'Settings',
  Merchants: 'Settings',
  Preferences: 'Settings',
  'Personal Info': 'Settings',
  'Data Management': 'Settings',
  Integrations: 'Settings',
  Documentation: 'Settings',
} as Partial<Record<Page, NewPage>>;

export type NewRoute =
  | { kind: 'page'; page: NewPage; id?: string }
  | { kind: 'gallery' }
  | { kind: 'notFound'; path: string };

const normalize = (pathname: string) => {
  const raw = pathname.split(/[?#]/)[0] || '/';
  return raw !== '/' && raw.endsWith('/') ? raw.slice(0, -1) : raw;
};

/** True for any path in the New UI's URL space (a `-new` segment), recognised or not. */
export const isNewPath = (pathname: string): boolean => /^\/[a-z-]+-new(\/|$)/.test(normalize(pathname));

/** Resolves a path to a New route, or `null` when the path belongs to the classic UI. */
export const parseNewRoute = (pathname: string): NewRoute | null => {
  const path = normalize(pathname);
  if (!isNewPath(path)) return null;
  if (path === NEW_GALLERY_PATH) return { kind: 'gallery' };

  const detail = path.match(/^\/(accounts|investments)-new\/([^/]+)$/);
  if (detail) {
    let id: string;
    try { id = decodeURIComponent(detail[2]); } catch { return { kind: 'notFound', path }; }
    return { kind: 'page', page: detail[1] === 'accounts' ? 'AccountDetail' : 'HoldingDetail', id };
  }

  const match = (Object.entries(NEW_PAGE_PATHS) as [NewPage, string][]).find(([, p]) => p === path);
  return match ? { kind: 'page', page: match[0] } : { kind: 'notFound', path };
};

/** The New UI path for a page. Merged classic pages resolve to the New page that holds them. */
export const newPathFor = (page: Page | NewPage, id?: string | null): string => {
  if (page === 'AccountDetail') return id ? `/accounts-new/${encodeURIComponent(id)}` : NEW_PAGE_PATHS.Accounts;
  if (page === 'HoldingDetail') return id ? `/investments-new/${encodeURIComponent(id)}` : NEW_PAGE_PATHS.Investments;
  const target = (MERGED_INTO[page as Page] ?? page) as keyof typeof NEW_PAGE_PATHS;
  return NEW_PAGE_PATHS[target] ?? NEW_PAGE_PATHS.Dashboard;
};

/** The nav item that stays highlighted for a page (detail pages belong to their list page). */
export const newNavPageFor = (page: NewPage): NewPage =>
  page === 'AccountDetail' ? 'Accounts' : page === 'HoldingDetail' ? 'Investments' : page;
