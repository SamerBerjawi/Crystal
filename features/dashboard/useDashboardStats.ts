import { useMemo } from 'react';
import { Account, Transaction, LoanPaymentOverrides, AccountType } from '../../types';
import { calculateAccountTotals } from '../../utils';
import { ASSET_TYPES, DEBT_TYPES } from '../../constants';

export interface UseDashboardStatsParams {
    analyticsAccounts: Account[];
    analyticsTransactions: Transaction[];
    loanPaymentOverrides: LoanPaymentOverrides;
    income: number;
    expenses: number;
}

export const useDashboardStats = ({
    analyticsAccounts,
    analyticsTransactions,
    loanPaymentOverrides,
    income,
    expenses,
}: UseDashboardStatsParams) => {
    const { globalTotalAssets, globalTotalDebt, assetGroups, liabilityGroups } = useMemo(() => {
        const openAccounts = analyticsAccounts.filter(acc => acc.status !== 'closed');
        const { totalAssets, totalDebt } = calculateAccountTotals(openAccounts, analyticsTransactions, loanPaymentOverrides);

        const assetGroupsMap: Record<string, { types: AccountType[]; value: number; color: string; icon: string }> = {
            'Liquid Cash': { types: ['Checking', 'Savings'], value: 0, color: '#3B82F6', icon: 'savings' },
            'Investments': { types: ['Investment'], value: 0, color: '#8B5CF6', icon: 'show_chart' },
            'Properties': { types: ['Property'], value: 0, color: '#10B981', icon: 'home' },
            'Vehicles': { types: ['Vehicle'], value: 0, color: '#F59E0B', icon: 'directions_car' },
            'Other Assets': { types: ['Other Assets', 'Lending'], value: 0, color: '#64748B', icon: 'category' },
        };

        const liabilityGroupsMap: Record<string, { types: AccountType[]; value: number; color: string; icon: string }> = {
            'Loans': { types: ['Loan'], value: 0, color: '#EF4444', icon: 'request_quote' },
            'Credit Cards': { types: ['Credit Card'], value: 0, color: '#F43F5E', icon: 'credit_card' },
            'Other Liabilities': { types: ['Other Liabilities'], value: 0, color: '#94A3B8', icon: 'receipt' },
        };

        for (const groupName in assetGroupsMap) {
            const types = assetGroupsMap[groupName].types;
            const groupAccounts = openAccounts.filter(acc => types.includes(acc.type));
            if (groupAccounts.length > 0) {
                const groupTotals = calculateAccountTotals(groupAccounts, analyticsTransactions, loanPaymentOverrides);
                assetGroupsMap[groupName].value = groupTotals.totalAssets + groupTotals.totalDebt;
            }
        }
        for (const groupName in liabilityGroupsMap) {
            const types = liabilityGroupsMap[groupName].types;
            const groupAccounts = openAccounts.filter(acc => types.includes(acc.type));
            if (groupAccounts.length > 0) {
                const groupTotals = calculateAccountTotals(groupAccounts, analyticsTransactions, loanPaymentOverrides);
                liabilityGroupsMap[groupName].value = groupTotals.totalDebt;
            }
        }

        return {
            globalTotalAssets: totalAssets,
            globalTotalDebt: totalDebt,
            assetGroups: assetGroupsMap,
            liabilityGroups: liabilityGroupsMap,
        };
    }, [analyticsAccounts, analyticsTransactions, loanPaymentOverrides]);

    const assetAllocationData = useMemo(() => {
        const data = [
            { name: 'Liquid Cash', value: assetGroups['Liquid Cash']?.value || 0, color: assetGroups['Liquid Cash']?.color || '#A0AEC0' },
            { name: 'Investments', value: assetGroups['Investments']?.value || 0, color: assetGroups['Investments']?.color || '#A0AEC0' },
            { name: 'Properties', value: assetGroups['Properties']?.value || 0, color: assetGroups['Properties']?.color || '#A0AEC0' },
            { name: 'Vehicles', value: assetGroups['Vehicles']?.value || 0, color: assetGroups['Vehicles']?.color || '#A0AEC0' },
            { name: 'Other Assets', value: assetGroups['Other Assets']?.value || 0, color: assetGroups['Other Assets']?.color || '#A0AEC0' },
        ];
        return data.filter(d => d.value > 0).sort((a, b) => b.value - a.value);
    }, [assetGroups]);

    const liquidCash = assetGroups['Liquid Cash']?.value || 0;
    const avgMonthlySpend = expenses > 0 ? expenses : 1;
    const liquidityRatio = liquidCash / avgMonthlySpend;
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

    return {
        globalTotalAssets,
        globalTotalDebt,
        assetGroups,
        liabilityGroups,
        assetAllocationData,
        liquidityRatio,
        savingsRate,
    };
};
