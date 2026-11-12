import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type { Page } from '../types';
import { useScrollMemory } from './useScrollMemory';
import { usePageTabSwipe } from '../components/ui/Shell';

export const pageRegistry = {
  Dashboard: { path: '/', loader: () => import('../pages/Dashboard') },
  Accounts: { path: '/accounts', loader: () => import('../pages/Accounts') },
  Transactions: { path: '/transactions', loader: () => import('../pages/Transactions') },
  Reports: { path: '/reports', loader: () => import('../pages/Reports') },
  Budget: { path: '/budget', loader: () => import('../pages/Budgeting') },
  Forecasting: { path: '/forecasting', loader: () => import('../pages/Forecasting') },
  Goals: { path: '/goals', loader: () => import('../pages/Goals') },
  Challenges: { path: '/challenges', loader: () => import('../pages/Challenges') },
  Wrapped: { path: '/wrapped', loader: () => import('../pages/Wrapped') },
  'Weekly Recap': { path: '/weekly', loader: () => import('../pages/WeeklyRecap') },
  FIRE: { path: '/fire', loader: () => import('../pages/Fire') },
  'Schedule & Bills': { path: '/schedule', loader: () => import('../pages/Schedule') },
  Tasks: { path: '/tasks', loader: () => import('../pages/Tasks') },
  Categories: { path: '/categories', loader: () => import('../pages/Categories') },
  Tags: { path: '/tags', loader: () => import('../pages/Tags') },
  'Personal Info': { path: '/personal-info', loader: () => import('../pages/PersonalInfo') },
  'Data Management': { path: '/data-management', loader: () => import('../pages/DataImportExport') },
  Preferences: { path: '/preferences', loader: () => import('../pages/Preferences') },
  Integrations: { path: '/integrations', loader: () => import('../pages/Integrations') },
  EnableBankingCallback: { path: '/enable-banking/callback', loader: () => import('../pages/EnableBankingCallback') },
  AccountDetail: { path: '/accounts', loader: () => import('../pages/AccountDetail') },
  Investments: { path: '/investments', loader: () => import('../pages/Investments') },
  HoldingDetail: { path: '/investments', loader: () => import('../pages/Investments') },
  Documentation: { path: '/documentation', loader: () => import('../pages/Documentation') },
  Subscriptions: { path: '/subscriptions', loader: () => import('../pages/Subscriptions') },
  'Debt Payoff': { path: '/debt-payoff', loader: () => import('../pages/DebtPayoff') },
  'Quotes & Invoices': { path: '/invoices', loader: () => import('../pages/Invoices') },
  Merchants: { path: '/merchants', loader: () => import('../pages/Merchants') },
  Rules: { path: '/rules', loader: () => import('../pages/Rules') },
} as const;

export const routePathMap = Object.entries(pageRegistry).reduce((acc, [page, config]) => {
  acc[page as Page] = config.path;
  return acc;
}, {} as Record<Page, string>);

export type RouteInfo = { page: Page; matched: boolean; accountId?: string | null; holdingSymbol?: string | null };

export const parseRoute = (pathname: string): RouteInfo => {
  const rawPath = pathname.split('?')[0] || '/';
  const normalizedPath = rawPath !== '/' && rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;
  const accountMatch = normalizedPath.match(/^\/accounts\/([^/]+)$/);
  const holdingMatch = normalizedPath.match(/^\/investments\/([^/]+)$/);

  if (accountMatch?.[1]) {
    return { page: 'AccountDetail', matched: true, accountId: decodeURIComponent(accountMatch[1]) };
  }

  if (holdingMatch?.[1]) {
    return { page: 'HoldingDetail', matched: true, holdingSymbol: decodeURIComponent(holdingMatch[1]) };
  }

  // The Settings tile page is gone (D-045). Its old address opens the hub's first tab.
  if (normalizedPath === '/settings') {
    return { page: 'Personal Info', matched: true, accountId: null };
  }

  const matchedPage = (Object.entries(routePathMap) as [Page, string][])
    .find(([, path]) => path === normalizedPath)?.[0];

  if (matchedPage) {
    return { page: matchedPage, matched: true, accountId: null };
  }

  return { page: 'Dashboard', matched: false, accountId: null };
};

export const pageToPath = (page: Page, accountId?: string | null) => {
  if (page === 'AccountDetail' && accountId) {
    return `/accounts/${encodeURIComponent(accountId)}`;
  }

  if (page === 'HoldingDetail' && accountId) {
    return `/investments/${encodeURIComponent(accountId)}`;
  }

  return routePathMap[page] || '/';
};

export function useAppRouter(isAuthenticated: boolean, isDataLoaded: boolean) {
  const initialPath = typeof window !== 'undefined' ? (window.location.pathname + window.location.search) : '/';
  const initialRoute = parseRoute(initialPath);

  const [currentPath, setCurrentPath] = useState(initialPath);
  const [currentPage, setCurrentPageState] = useState<Page>(initialRoute.page);
  useScrollMemory(currentPage);

  const [viewingAccountId, setViewingAccountId] = useState<string | null>(initialRoute.accountId ?? null);
  const [viewingHoldingSymbol, setViewingHoldingSymbol] = useState<string | null>(initialRoute.holdingSymbol ?? null);
  const transactionsViewFilters = useRef<{ accountName?: string | null; tagId?: string | null }>({});

  const navigateToPath = useCallback((path: string, replace = false, state?: any) => {
    if (typeof window === 'undefined') return;
    const nextPath = path || '/';
    const historyState = { internal: true, ...state };
    try {
      if (replace) { window.history.replaceState(historyState, '', nextPath); }
      else { window.history.pushState(historyState, '', nextPath); }
    } catch (e) {
      console.warn('Navigation state update failed, falling back to in-memory navigation:', e);
    }
    setCurrentPath(nextPath);
    window.dispatchEvent(new Event('crystal:tab'));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      setCurrentPath((window.location.pathname + window.location.search) || '/');
      window.dispatchEvent(new Event('crystal:tab'));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isAuthenticated || !isDataLoaded) return;
    const preloadRoutes = async () => {
      const primaryLoaders = [
        pageRegistry.Accounts.loader,
        pageRegistry.Transactions.loader,
        pageRegistry.Budget.loader,
        pageRegistry['Schedule & Bills'].loader,
        pageRegistry.Reports.loader,
        pageRegistry.Forecasting.loader,
        pageRegistry.Investments.loader,
        pageRegistry.Subscriptions.loader,
      ];
      for (const loader of primaryLoaders) {
        try {
          await loader();
          await new Promise(r => setTimeout(r, 120));
        } catch { /* ignore */ }
      }
    };

    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(preloadRoutes, { timeout: 3000 });
    } else {
      setTimeout(preloadRoutes, 1500);
    }
  }, [isAuthenticated, isDataLoaded]);

  const notFoundNoticeRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isDataLoaded || !notFoundNoticeRef.current) return;
    toast.error(`Page not found: ${notFoundNoticeRef.current}`);
    notFoundNoticeRef.current = null;
  }, [isDataLoaded]);

  useEffect(() => {
    const route = parseRoute(currentPath);
    setCurrentPageState(route.page);
    setViewingAccountId(route.accountId ?? null);
    setViewingHoldingSymbol(route.holdingSymbol ?? null);
    if (!route.matched && currentPath !== '/') {
      notFoundNoticeRef.current = currentPath;
      navigateToPath('/', true);
    }
  }, [currentPath, navigateToPath]);

  const setCurrentPage = useCallback((page: Page, tab?: string | null) => {
    let targetPath = pageToPath(page, page === 'AccountDetail' ? viewingAccountId : page === 'HoldingDetail' ? viewingHoldingSymbol : null);
    const resolvedTab = tab !== undefined ? tab : (page === 'Accounts' && typeof window !== 'undefined' && window.location.pathname.startsWith('/accounts') ? new URLSearchParams(window.location.search).get('tab') : null);
    if (resolvedTab) {
      targetPath += `?tab=${encodeURIComponent(resolvedTab)}`;
    }
    navigateToPath(targetPath);
    setCurrentPageState(page);
    if (page !== 'AccountDetail') { setViewingAccountId(null); }
    if (page !== 'HoldingDetail') { setViewingHoldingSymbol(null); }
  }, [navigateToPath, viewingAccountId, viewingHoldingSymbol]);

  const pageSwipe = usePageTabSwipe(currentPage, setCurrentPage);

  const handleOpenAccountDetail = useCallback((accountId: string, tab?: string | null) => {
    setViewingAccountId(accountId);
    setCurrentPageState('AccountDetail');
    const activeTab = tab !== undefined ? tab : (typeof window !== 'undefined' && window.location.pathname.startsWith('/accounts/') ? new URLSearchParams(window.location.search).get('tab') : null);
    const tabSuffix = activeTab ? `?tab=${encodeURIComponent(activeTab)}` : '';
    navigateToPath(pageToPath('AccountDetail', accountId) + tabSuffix, false, { fromAccounts: true });
  }, [navigateToPath]);

  const handleOpenHoldingDetail = useCallback((holdingSymbol: string) => {
    setViewingHoldingSymbol(holdingSymbol);
    setCurrentPageState('HoldingDetail');
    navigateToPath(pageToPath('HoldingDetail', holdingSymbol), false);
  }, [navigateToPath]);

  const navigateToTransactions = useCallback((filters?: { accountName?: string | null; tagId?: string | null }) => {
    transactionsViewFilters.current = {
      accountName: filters?.accountName ?? null,
      tagId: filters?.tagId ?? null,
    };
    setCurrentPage('Transactions');
  }, [setCurrentPage]);

  const clearPendingTransactionFilters = useCallback(() => {
    transactionsViewFilters.current = {};
  }, []);

  return {
    currentPage,
    setCurrentPage,
    viewingAccountId,
    setViewingAccountId,
    viewingHoldingSymbol,
    setViewingHoldingSymbol,
    handleOpenAccountDetail,
    handleOpenHoldingDetail,
    transactionsViewFilters,
    navigateToTransactions,
    clearPendingTransactionFilters,
    pageSwipe,
  };
}
