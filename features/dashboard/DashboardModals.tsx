import React from 'react';
import AddTransactionModal from '../../components/AddTransactionModal';
import TransactionDetailModal from '../../components/TransactionDetailModal';
import ForecastDayModal from '../../components/ForecastDayModal';
import GoalScenarioModal from '../../components/GoalScenarioModal';
import { FinancialGoal, Transaction, Account, Category, Tag } from '../../types';

export interface DashboardModalsProps {
    isAddTxOpen: boolean;
    setIsAddTxOpen: (val: boolean) => void;
    selectedDayForModal: any | null;
    setSelectedDayForModal: (val: any | null) => void;
    selectedGoalForScenario: FinancialGoal | null;
    setSelectedGoalForScenario: (goal: FinancialGoal | null) => void;
    selectedTxForDetail: Transaction | null;
    setSelectedTxForDetail: (tx: Transaction | null) => void;
    accounts: Account[];
    incomeCategories: Category[];
    expenseCategories: Category[];
    tags: Tag[];
    financialGoals: FinancialGoal[];
    saveTransactions: (toSave: (Omit<Transaction, 'id'> & { id?: string })[], toDelete: string[]) => void;
    saveFinancialGoal: (goal: Omit<FinancialGoal, 'id'> & { id?: string }) => void;
    deleteTransactions: (ids: string[]) => void;
}

export const DashboardModals: React.FC<DashboardModalsProps> = ({
    isAddTxOpen,
    setIsAddTxOpen,
    selectedDayForModal,
    setSelectedDayForModal,
    selectedGoalForScenario,
    setSelectedGoalForScenario,
    selectedTxForDetail,
    setSelectedTxForDetail,
    accounts,
    incomeCategories,
    expenseCategories,
    tags,
    financialGoals,
    saveTransactions,
    saveFinancialGoal,
    deleteTransactions,
}) => {
    return (
        <>
            {isAddTxOpen && (
                <AddTransactionModal
                    onClose={() => setIsAddTxOpen(false)}
                    onSave={(toSave, toDelete) => {
                        saveTransactions(toSave, toDelete);
                        setIsAddTxOpen(false);
                    }}
                    accounts={accounts}
                    incomeCategories={incomeCategories}
                    expenseCategories={expenseCategories}
                    tags={tags}
                />
            )}

            {selectedTxForDetail && (
                <TransactionDetailModal
                    isOpen={Boolean(selectedTxForDetail)}
                    onClose={() => setSelectedTxForDetail(null)}
                    title="Transaction Details"
                    transactions={[selectedTxForDetail]}
                    accounts={accounts}
                    tags={tags}
                    onDelete={(tx) => {
                        deleteTransactions([tx.id]);
                        setSelectedTxForDetail(null);
                    }}
                />
            )}

            {selectedDayForModal && (
                <ForecastDayModal
                    isOpen={Boolean(selectedDayForModal)}
                    onClose={() => setSelectedDayForModal(null)}
                    date={selectedDayForModal.date || ''}
                    items={selectedDayForModal.items || []}
                    onEditItem={() => {}}
                    onAddTransaction={() => {
                        setSelectedDayForModal(null);
                        setIsAddTxOpen(true);
                    }}
                />
            )}

            {selectedGoalForScenario && (
                <GoalScenarioModal
                    onClose={() => setSelectedGoalForScenario(null)}
                    onSave={(g) => {
                        saveFinancialGoal(g);
                        setSelectedGoalForScenario(null);
                    }}
                    goalToEdit={selectedGoalForScenario}
                    financialGoals={financialGoals}
                    accounts={accounts}
                />
            )}
        </>
    );
};

export default DashboardModals;
