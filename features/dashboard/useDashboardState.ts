import { useState, useCallback } from 'react';
import { Duration, FinancialGoal, Transaction } from '../../types';

export type DashboardTab = 'overview' | 'analysis' | 'activity' | 'pending_matches';

export function useDashboardState() {
    const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
    const [duration, setDuration] = useState<Duration>('30D');
    const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
    
    // Modal states
    const [isAddTxOpen, setIsAddTxOpen] = useState(false);
    const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
    const [isTransactionMatcherOpen, setIsTransactionMatcherOpen] = useState(false);
    const [isSyncedBillMatcherOpen, setIsSyncedBillMatcherOpen] = useState(false);
    const [isBulkCategorizeOpen, setIsBulkCategorizeOpen] = useState(false);
    const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
    const [isQuickBudgetOpen, setIsQuickBudgetOpen] = useState(false);
    const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);

    // Selected detail states
    const [selectedDayForModal, setSelectedDayForModal] = useState<any | null>(null);
    const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);
    const [selectedGoalForPlan, setSelectedGoalForPlan] = useState<FinancialGoal | null>(null);
    const [selectedGoalForScenario, setSelectedGoalForScenario] = useState<FinancialGoal | null>(null);
    const [selectedTxForDetail, setSelectedTxForDetail] = useState<Transaction | null>(null);
    const [selectedAccountForBreakdown, setSelectedAccountForBreakdown] = useState<string | null>(null);

    const toggleAccountSelection = useCallback((accountId: string) => {
        setSelectedAccountIds(prev =>
            prev.includes(accountId) ? prev.filter(id => id !== accountId) : [...prev, accountId]
        );
    }, []);

    const clearAccountSelection = useCallback(() => {
        setSelectedAccountIds([]);
    }, []);

    return {
        activeTab,
        setActiveTab,
        duration,
        setDuration,
        selectedAccountIds,
        setSelectedAccountIds,
        toggleAccountSelection,
        clearAccountSelection,
        // Modals
        isAddTxOpen,
        setIsAddTxOpen,
        isAddWidgetOpen,
        setIsAddWidgetOpen,
        isTransactionMatcherOpen,
        setIsTransactionMatcherOpen,
        isSyncedBillMatcherOpen,
        setIsSyncedBillMatcherOpen,
        isBulkCategorizeOpen,
        setIsBulkCategorizeOpen,
        isBulkEditOpen,
        setIsBulkEditOpen,
        isQuickBudgetOpen,
        setIsQuickBudgetOpen,
        isBudgetModalOpen,
        setIsBudgetModalOpen,
        // Selected details
        selectedDayForModal,
        setSelectedDayForModal,
        editingGoal,
        setEditingGoal,
        selectedGoalForPlan,
        setSelectedGoalForPlan,
        selectedGoalForScenario,
        setSelectedGoalForScenario,
        selectedTxForDetail,
        setSelectedTxForDetail,
        selectedAccountForBreakdown,
        setSelectedAccountForBreakdown,
    };
}
