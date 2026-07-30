import React from 'react';
import AddTransactionModal from '../../components/AddTransactionModal';
import CommandCenter from '../../components/CommandCenter';
import KeyboardShortcutsModal from '../../components/KeyboardShortcutsModal';
import { Account, Category, Page, Transaction, Tag } from '../../types';

export interface AppGlobalModalsProps {
    isAddTransactionModalOpen: boolean;
    setIsAddTransactionModalOpen: (val: boolean) => void;
    isCommandCenterOpen: boolean;
    setIsCommandCenterOpen: (val: boolean) => void;
    isKeyboardShortcutsModalOpen: boolean;
    setIsKeyboardShortcutsModalOpen: (val: boolean) => void;
    accounts: Account[];
    incomeCategories: Category[];
    expenseCategories: Category[];
    tags: Tag[];
    transactions: Transaction[];
    saveTransactions: (transactionsToSave: (Omit<Transaction, 'id'> & { id?: string })[], idsToDelete: string[]) => void;
    onNavigate: (page: Page) => void;
}

export const AppGlobalModals: React.FC<AppGlobalModalsProps> = ({
    isAddTransactionModalOpen,
    setIsAddTransactionModalOpen,
    isCommandCenterOpen,
    setIsCommandCenterOpen,
    isKeyboardShortcutsModalOpen,
    setIsKeyboardShortcutsModalOpen,
    accounts,
    incomeCategories,
    expenseCategories,
    tags,
    transactions,
    saveTransactions,
    onNavigate,
}) => {
    return (
        <>
            {isAddTransactionModalOpen && (
                <AddTransactionModal
                    onClose={() => setIsAddTransactionModalOpen(false)}
                    onSave={(toSave, toDelete) => {
                        saveTransactions(toSave, toDelete);
                        setIsAddTransactionModalOpen(false);
                    }}
                    accounts={accounts}
                    incomeCategories={incomeCategories}
                    expenseCategories={expenseCategories}
                    tags={tags}
                />
            )}

            {isCommandCenterOpen && (
                <CommandCenter
                    isOpen={isCommandCenterOpen}
                    onClose={() => setIsCommandCenterOpen(false)}
                    setCurrentPage={onNavigate}
                    accounts={accounts}
                    transactions={transactions}
                    onOpenAccount={() => {}}
                    togglePrivacyMode={() => {}}
                    isPrivacyMode={false}
                    theme="dark"
                    setTheme={() => {}}
                />
            )}

            {isKeyboardShortcutsModalOpen && (
                <KeyboardShortcutsModal
                    isOpen={isKeyboardShortcutsModalOpen}
                    onClose={() => setIsKeyboardShortcutsModalOpen(false)}
                />
            )}
        </>
    );
};

export default AppGlobalModals;
