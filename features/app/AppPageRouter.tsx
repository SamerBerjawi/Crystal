import React, { Suspense } from 'react';
import PageSkeleton from '../../components/PageSkeleton';

export interface AppPageRouterProps {
    currentPage: string;
    renderPage: () => React.ReactNode;
}

export const AppPageRouter: React.FC<AppPageRouterProps> = ({ currentPage, renderPage }) => {
    const getSkeletonVariant = (page: string) => {
        if (page === 'Dashboard') return 'dashboard';
        if (['Accounts', 'Investments', 'Budget', 'Categories'].includes(page)) return 'grid';
        return 'list';
    };

    return (
        <Suspense fallback={<PageSkeleton variant={getSkeletonVariant(currentPage)} />}>
            {renderPage()}
        </Suspense>
    );
};

export default AppPageRouter;
