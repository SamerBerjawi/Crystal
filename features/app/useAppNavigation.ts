import { useState, useCallback } from 'react';
import { Page } from '../../types';

export function useAppNavigation(initialPage: Page = 'Dashboard') {
    const [activePage, setActivePage] = useState<Page>(initialPage);
    const [pageHistory, setPageHistory] = useState<Page[]>([initialPage]);

    const navigateTo = useCallback((page: Page) => {
        setActivePage(page);
        setPageHistory(prev => [...prev, page]);
    }, []);

    const navigateBack = useCallback(() => {
        setPageHistory(prev => {
            if (prev.length <= 1) return prev;
            const nextHistory = prev.slice(0, -1);
            setActivePage(nextHistory[nextHistory.length - 1]);
            return nextHistory;
        });
    }, []);

    return {
        activePage,
        setActivePage,
        navigateTo,
        navigateBack,
        pageHistory,
    };
}
