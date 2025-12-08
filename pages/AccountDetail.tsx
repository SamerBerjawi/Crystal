
import React, { useMemo, useState, Suspense } from 'react';
import { Account, Transaction, DisplayTransaction, ScheduledPayment, MileageLog } from '../types';
import { convertToEur, parseDateAsUTC } from '../utils';
import AddTransactionModal from '../components/AddTransactionModal';
import TransactionDetailModal from '../components/TransactionDetailModal';
import AddMileageLogModal from '../components/AddMileageLogModal';
import ConfirmationModal from '../components/ConfirmationModal';
import BalanceAdjustmentModal from '../components/BalanceAdjustmentModal';
import { v4 as uuidv4 } from 'uuid';
import { useAccountsContext, useTransactionsContext } from '../contexts/DomainProviders';
import { useCategoryContext, useScheduleContext, useTagsContext } from '../contexts/FinancialDataContext';

// Lazy load view components
const PropertyAccountView = React.lazy(() => import('../components/PropertyAccountView'));
const LoanAccountView = React.lazy(() => import('../components/LoanAccountView'));
const VehicleAccountView = React.lazy(() => import('../components/VehicleAccountView'));
const CreditCardAccountView = React.lazy(() => import('../components/CreditCardAccountView'));
const GeneralAccountView = React.lazy(() => import('../components/GeneralAccountView'));
const CashAccountView = React.lazy(() => import('../components/CashAccountView'));
const SavingsAccountView = React.lazy(() => import('../components/SavingsAccountView'));
const PensionAccountView = React.lazy(() => import('../components/PensionAccountView'));
const SpareChangeAccountView = React.lazy(() => import('../components/SpareChangeAccountView'));

const AccountDetail: React.FC<{
    account: Account;
    setCurrentPage: (page: any) => void;
    setViewingAccountId: (id: string | null) => void;
    saveAccount: (account: Omit<Account, 'id'> & { id?: string }) => void;
}> = ({ account, setCurrentPage, setViewingAccountId, saveAccount }) => {
    const { accounts } = useAccountsContext();
    const { transactions, saveTransaction } = useTransactionsContext();
    const { incomeCategories, expenseCategories } = useCategoryContext();
    const { tags } = useTagsContext();
    const { loanPaymentOverrides, saveLoanPaymentOverrides } = useScheduleContext();
    
    const allCategories = useMemo(() => [...incomeCategories, ...expenseCategories], [expenseCategories, incomeCategories]);
    
    const [isTransactionModalOpen, setTransactionModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [initialModalState, setInitialModalState] = useState<{
        from?: string,
        to?: string,
        type?: 'expense' | 'income' | 'transfer',
        details?: {
            date?: string;
            amount?: string;
            principal?: string;
            interest?: string;
            description?: string;
        }
    }>({});
    
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    const [modalTransactions, setModalTransactions] = useState<Transaction[]>([]);
    const [modalTitle, setModalTitle] = useState('');
    const [isMileageModalOpen, setIsMileageModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<MileageLog | null>(null);
    const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
    const [isAdjustModalOpen, setAdjustModalOpen] = useState(false);

    const handleOpenTransactionModal = (tx?: Transaction) => {
        setEditingTransaction(tx || null);
        // Pre-configure transfer details if it's a loan with a linked account
        if (!tx && (account.type === 'Loan' || account.type === 'Lending') && account.linkedAccountId) {
            setInitialModalState({
                type: 'transfer',
                from: account.type === 'Loan' ? account.linkedAccountId : account.id,
                to: account.type === 'Loan' ? account.id : account.linkedAccountId
            });
        } else if (!tx) {
            setInitialModalState({
                from: account.id,
                to: account.id
            });
        } else {
            setInitialModalState({});
        }
        setTransactionModalOpen(true);
    };
    
    const handleOpenAdjustModal = () => {
        setAdjustModalOpen(true);
    };

    const handleSaveAdjustment = (adjustmentAmount: number, date: string, notes: string, isMarketAdjustment?: boolean) => {
        const txData: Omit<Transaction, 'id'> = {
            accountId: account.id,
            date,
            description: isMarketAdjustment ? 'Market Value Adjustment' : 'Cash Reconciliation',
            merchant: notes || (isMarketAdjustment ? 'Market Update' : 'Manual count adjustment'),
            amount: adjustmentAmount,
            category: isMarketAdjustment 
                ? (adjustmentAmount >= 0 ? 'Investment Income' : 'Investments') 
                : (adjustmentAmount >= 0 ? 'Income' : 'Miscellaneous'),
            type: adjustmentAmount >= 0 ? 'income' : 'expense',
            currency: account.currency,
            isMarketAdjustment,
        };
        
        saveTransaction([txData], []);
        setAdjustModalOpen(false);
    };

    // Specialized handler for Loan/Lending payments
    const handleMakePayment = (payment: ScheduledPayment, description: string) => {
        const isLoan = account.type === 'Loan';
        const fromId = isLoan ? account.linkedAccountId : account.id;
        const toId = isLoan ? account.id : account.linkedAccountId;

        if (!fromId || !toId) {
            alert('A linked account must be set on the loan to record a payment.');
            return;
        }

        setEditingTransaction(null);
        setInitialModalState({
            type: 'transfer',
            from: fromId,
            to: toId,
            details: {
                date: payment.date,
                amount: String(payment.totalPayment.toFixed(2)),
                principal: String(payment.principal.toFixed(2)),
                interest: String(payment.interest.toFixed(2)),
                description: description
            }
        });
        setTransactionModalOpen(true);
    };

    const handleOverridesChange = (newOverrides: Record<number, Partial<ScheduledPayment>>) => {
        saveLoanPaymentOverrides(account.id, newOverrides);
    };

    // Specialized handlers for Mileage Logs
    const handleOpenMileageModal = (log?: MileageLog) => {
        setEditingLog(log || null);
        setIsMileageModalOpen(true);
    };

    const handleSaveMileageLog = (logData: Omit<MileageLog, 'id'> & { id?: string }) => {
        let updatedLogs = [...(account.mileageLogs || [])];
        if (logData.id) {
            updatedLogs = updatedLogs.map(log => log.id === logData.id ? { ...log, ...logData } as MileageLog : log);
        } else {
            updatedLogs.push({ ...logData, id: `log-${uuidv4()}` } as MileageLog);
        }
        saveAccount({ ...account, mileageLogs: updatedLogs });
        setIsMileageModalOpen(false);
    };

    const handleDeleteMileageLog = (id: string) => {
        setDeletingLogId(id);
    };

    const confirmDeleteLog = () => {
        if (deletingLogId) {
            const updatedLogs = (account.mileageLogs || []).filter(log => log.id !== deletingLogId);
            saveAccount({ ...account, mileageLogs: updatedLogs });
            setDeletingLogId(null);
        }
    };

    const accountTransactions = useMemo(() => {
        return transactions
            .filter(tx => tx.accountId === account.id)
            .map(tx => ({
                tx,
                parsedDate: parseDateAsUTC(tx.date),
                convertedAmount: convertToEur(tx.amount, tx.currency)
            }));
    }, [transactions, account.id]);

    const displayTransactionsList: DisplayTransaction[] = useMemo(() => {
        const sorted = [...accountTransactions].sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime()).slice(0, 50);
        return sorted.map(item => ({
            ...item.tx,
            accountName: account.name
        }));
    }, [accountTransactions, account.name]);

    const handleTransactionClick = (tx: DisplayTransaction) => {
        setModalTransactions([tx]);
        setModalTitle('Transaction Details');
        setDetailModalOpen(true);
    };

    const commonProps = {
        account,
        onAddTransaction: () => handleOpenTransactionModal(),
        setViewingAccountId,
        onBack: () => { setViewingAccountId(null); setCurrentPage('Accounts'); }
    };

    const renderContent = () => {
        if (account.type === 'Other Assets' && account.otherSubType === 'Cash') {
            return (
                <CashAccountView
                    {...commonProps}
                    displayTransactionsList={displayTransactionsList}
                    transactions={accountTransactions}
                    allCategories={allCategories}
                    onTransactionClick={handleTransactionClick}
                    onAdjustBalance={handleOpenAdjustModal}
                />
            );
        }

        switch (account.type) {
            case 'Property':
                return (
                    <PropertyAccountView 
                        {...commonProps}
                        accounts={accounts}
                        transactions={transactions}
                    />
                );
            case 'Loan':
            case 'Lending':
                return (
                    <LoanAccountView 
                        {...commonProps}
                        transactions={transactions}
                        accounts={accounts}
                        loanPaymentOverrides={loanPaymentOverrides[account.id] || {}}
                        onOverridesChange={handleOverridesChange}
                        onMakePayment={handleMakePayment}
                    />
                );
            case 'Vehicle':
                return (
                    <VehicleAccountView 
                        {...commonProps}
                        onAddLog={() => handleOpenMileageModal()}
                        onEditLog={handleOpenMileageModal}
                        onDeleteLog={handleDeleteMileageLog}
                    />
                );
            case 'Credit Card':
                return (
                    <CreditCardAccountView
                        {...commonProps}
                        displayTransactionsList={displayTransactionsList}
                        transactions={accountTransactions}
                        allCategories={allCategories}
                        onTransactionClick={handleTransactionClick}
                    />
                );
            case 'Savings':
                return (
                    <SavingsAccountView
                        {...commonProps}
                        displayTransactionsList={displayTransactionsList}
                        transactions={accountTransactions}
                        allCategories={allCategories}
                        onTransactionClick={handleTransactionClick}
                    />
                );
            case 'Investment':
                if (account.subType === 'Pension Fund') {
                    return (
                        <PensionAccountView 
                            {...commonProps}
                            displayTransactionsList={displayTransactionsList}
                            transactions={accountTransactions}
                            allCategories={allCategories}
                            onTransactionClick={handleTransactionClick}
                            onAdjustBalance={handleOpenAdjustModal}
                        />
                    );
                }
                if (account.subType === 'Spare Change') {
                     return (
                        <SpareChangeAccountView 
                            {...commonProps}
                            displayTransactionsList={displayTransactionsList}
                            transactions={accountTransactions}
                            allCategories={allCategories}
                            onTransactionClick={handleTransactionClick}
                            onAdjustBalance={handleOpenAdjustModal}
                        />
                    );
                }
                // Fallthrough to General for other investments for now, or you can add more specific ones later
                return (
                    <GeneralAccountView 
                        {...commonProps}
                        displayTransactionsList={displayTransactionsList}
                        transactions={accountTransactions}
                        allCategories={allCategories}
                        onTransactionClick={handleTransactionClick}
                    />
                );
            default:
                return (
                    <GeneralAccountView 
                        {...commonProps}
                        displayTransactionsList={displayTransactionsList}
                        transactions={accountTransactions}
                        allCategories={allCategories}
                        onTransactionClick={handleTransactionClick}
                    />
                );
        }
    };

    return (
        <>
             {isTransactionModalOpen && (
                <AddTransactionModal
                    onClose={() => setTransactionModalOpen(false)}
                    onSave={(data, toDelete) => { saveTransaction(data, toDelete); setTransactionModalOpen(false); }}
                    accounts={accounts} incomeCategories={incomeCategories} expenseCategories={expenseCategories}
                    transactionToEdit={editingTransaction} transactions={transactions} tags={tags}
                    initialType={initialModalState.type} initialFromAccountId={initialModalState.from}
                    initialToAccountId={initialModalState.to} initialDetails={initialModalState.details}
                />
            )}
            
            <TransactionDetailModal 
                isOpen={isDetailModalOpen} 
                onClose={() => setDetailModalOpen(false)} 
                title={modalTitle} 
                transactions={modalTransactions} 
                accounts={accounts} 
            />
            
            {isAdjustModalOpen && (
                <BalanceAdjustmentModal
                    onClose={() => setAdjustModalOpen(false)}
                    onSave={handleSaveAdjustment}
                    account={account}
                />
            )}

            {isMileageModalOpen && (
                <AddMileageLogModal
                    onClose={() => setIsMileageModalOpen(false)}
                    onSave={handleSaveMileageLog}
                    logToEdit={editingLog}
                />
            )}
            
            <ConfirmationModal
                isOpen={!!deletingLogId}
                onClose={() => setDeletingLogId(null)}
                onConfirm={confirmDeleteLog}
                title="Delete Log"
                message="Are you sure you want to delete this mileage log entry?"
                confirmButtonText="Delete"
            />

            <Suspense fallback={<div className="flex justify-center p-10"><div className="animate-spin h-8 w-8 border-2 border-primary-500 rounded-full border-t-transparent"></div></div>}>
                {renderContent()}
            </Suspense>
        </>
    );
};

export default AccountDetail;
