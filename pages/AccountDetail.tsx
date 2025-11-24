
import React, { useMemo, useState, useCallback } from 'react';
import { Account, Transaction, Category, Duration, Page, CategorySpending, Widget, WidgetConfig, DisplayTransaction, RecurringTransaction, AccountDetailProps, Tag, ScheduledPayment, MileageLog } from '../types';
import { formatCurrency, getDateRange, convertToEur, calculateStatementPeriods, getCreditCardStatementDetails, parseDateAsUTC, formatDateKey } from '../utils';
import AddTransactionModal from '../components/AddTransactionModal';
import { BTN_PRIMARY_STYLE, MOCK_EXPENSE_CATEGORIES, BTN_SECONDARY_STYLE, ACCOUNT_TYPE_STYLES } from '../constants';
import TransactionDetailModal from '../components/TransactionDetailModal';
import WidgetWrapper from '../components/WidgetWrapper';
import OutflowsChart from '../components/OutflowsChart';
import DurationFilter from '../components/DurationFilter';
import BalanceCard from '../components/BalanceCard';
import NetBalanceCard from '../components/SpendingChart';
import NetWorthChart from '../components/NetWorthChart';
import TransactionList from '../components/TransactionList';
import CurrentBalanceCard from '../components/CurrentBalanceCard';
import useLocalStorage from '../hooks/useLocalStorage';
import AddWidgetModal from '../components/AddWidgetModal';
import CreditCardStatementCard from '../components/CreditCardStatementCard';
import LoanProgressCard from '../components/LoanProgressCard';
import Card from '../components/Card';
import PaymentPlanTable from '../components/PaymentPlanTable';
import VehicleMileageChart from '../components/VehicleMileageChart';
import AddMileageLogModal from '../components/AddMileageLogModal';
import ConfirmationModal from '../components/ConfirmationModal';
import { v4 as uuidv4 } from 'uuid';
import { useAccountsContext, useTransactionsContext } from '../contexts/DomainProviders';
import { useCategoryContext, useScheduleContext, useTagsContext } from '../contexts/FinancialDataContext';

const findCategoryDetails = (name: string, categories: Category[]): Category | undefined => {
    for (const cat of categories) {
      if (cat.name === name) return cat;
      if (cat.subCategories.length > 0) {
        const found = findCategoryDetails(name, cat.subCategories);
        if (found) return found;
      }
    }
    return undefined;
};

const findCategoryById = (id: string, categories: Category[]): Category | undefined => {
    for (const cat of categories) {
        if (cat.id === id) return cat;
        if (cat.subCategories?.length) {
            const found = findCategoryById(id, cat.subCategories);
            if (found) return found;
        }
    }
    return undefined;
};

const toYYYYMMDD = (date: Date) => {
    // FIX: Corrected to use UTC date parts to avoid timezone inconsistencies.
    const y = date.getUTCFullYear();
    const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const d = date.getUTCDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
};

type EnrichedAccountTransaction = {
    tx: Transaction;
    parsedDate: Date;
    convertedAmount: number;
};

const AccountDetail: React.FC<AccountDetailProps> = ({ account, setCurrentPage, setViewingAccountId, saveAccount }) => {
  const { accounts } = useAccountsContext();
  const { transactions, saveTransaction } = useTransactionsContext();
  const { incomeCategories, expenseCategories } = useCategoryContext();
  const { tags } = useTagsContext();
  const { recurringTransactions, loanPaymentOverrides, saveLoanPaymentOverrides } = useScheduleContext();
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
  
    const [duration, setDuration] = useState<Duration>('1Y');
    const [isAddWidgetModalOpen, setIsAddWidgetModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    const handleOpenTransactionModal = (tx?: Transaction) => {
        setEditingTransaction(tx || null);
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

    const { balanceHistory, totalIncome, totalExpenses } = useMemo(() => {
        const { start, end } = getDateRange(duration, transactions);
        const filteredTxs = accountTransactions.filter(item => item.parsedDate >= start && item.parsedDate <= end);
        
        let totalIncome = 0;
        let totalExpenses = 0;
        
        // Calculate starting balance
        const txsBeforePeriod = accountTransactions.filter(item => item.parsedDate < start);
        const balanceChangeBefore = txsBeforePeriod.reduce((sum, item) => sum + item.convertedAmount, 0);
        // Assuming account.balance is current. We need to backtrack.
        // Current Balance - (Change During Period) - (Change After Period) = Start Balance?
        // Actually easier: Start Balance = Current Balance - (All changes after start date)
        // But this assumes transactions are the only source of truth.
        // Let's stick to a relative graph or simple accumulation if we trust the tx history.
        
        // A better approach for individual accounts is to just show the flow during the period
        // Or try to reconstruct if possible.
        // Let's just show the running total of the *transactions in the period* relative to 0 for now,
        // or if it's a simple account, we can try to project back.
        
        // Let's project back from current balance.
        const txsAfterPeriod = accountTransactions.filter(item => item.parsedDate > end);
        const changeAfter = txsAfterPeriod.reduce((sum, item) => sum + item.convertedAmount, 0);
        
        const changeDuring = filteredTxs.reduce((sum, item) => sum + item.convertedAmount, 0);
        
        let currentRunningBalance = convertToEur(account.balance, account.currency) - changeAfter - changeDuring;
        
        const history = [];
        // Group by day
        const dailyMap = new Map<string, number>();
        filteredTxs.forEach(item => {
            const key = formatDateKey(item.parsedDate);
            dailyMap.set(key, (dailyMap.get(key) || 0) + item.convertedAmount);
            
            if (item.convertedAmount > 0) totalIncome += item.convertedAmount;
            else totalExpenses += Math.abs(item.convertedAmount);
        });
        
        let iterDate = new Date(start);
        while (iterDate <= end) {
            const key = formatDateKey(iterDate);
            const change = dailyMap.get(key) || 0;
            currentRunningBalance += change;
            history.push({ date: key, value: currentRunningBalance });
            iterDate.setUTCDate(iterDate.getUTCDate() + 1);
        }
        
        return { balanceHistory: history, totalIncome, totalExpenses };
    }, [accountTransactions, duration, account]);

    // Prepare display transactions
    const displayTransactionsList: DisplayTransaction[] = useMemo(() => {
        // Only show last 50 for performance in this view
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

    // --- Vehicle Specific Helpers ---
    const currentMileage = useMemo(() => {
        if (!account.mileageLogs || account.mileageLogs.length === 0) return 0;
        return Math.max(...account.mileageLogs.map(l => l.reading));
    }, [account.mileageLogs]);

    const leaseStats = useMemo(() => {
        if (account.ownership !== 'Leased' || !account.leaseStartDate || !account.leaseEndDate) return null;
        
        const start = parseDateAsUTC(account.leaseStartDate);
        const end = parseDateAsUTC(account.leaseEndDate);
        const now = new Date();
        
        const totalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        const elapsedDays = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        const progress = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
        
        let mileageStatus: 'Over Budget' | 'Under Budget' | 'On Track' = 'On Track';
        let mileageDiff = 0;
        let projectedMileage = 0;
        
        if (account.annualMileageAllowance) {
            const dailyAllowance = account.annualMileageAllowance / 365;
            const expectedMileage = elapsedDays * dailyAllowance;
            mileageDiff = currentMileage - expectedMileage;
            projectedMileage = (currentMileage / elapsedDays) * totalDays;
            
            // Tolerance of 1000km
            if (mileageDiff > 1000) mileageStatus = 'Over Budget';
            else if (mileageDiff < -1000) mileageStatus = 'Under Budget';
        }
        
        return { 
            start, 
            end, 
            progress, 
            mileageStatus, 
            mileageDiff, 
            daysRemaining: Math.max(0, Math.ceil(totalDays - elapsedDays)),
            projectedMileage
        };
    }, [account, currentMileage]);

    const depreciation = useMemo(() => {
        if (account.ownership === 'Owned' && account.purchasePrice) {
            return account.purchasePrice - account.balance;
        }
        return 0;
    }, [account]);

    // Only show value if NOT leased, OR if leased and value is non-zero/present
    const showCurrentValue = account.ownership !== 'Leased' || (account.balance !== 0);

    return (
    <div className="space-y-8">
        {isTransactionModalOpen && (
            <AddTransactionModal
                onClose={() => setTransactionModalOpen(false)}
                onSave={(data, toDelete) => {
                    saveTransaction(data, toDelete);
                    setTransactionModalOpen(false);
                }}
                accounts={accounts}
                incomeCategories={incomeCategories}
                expenseCategories={expenseCategories}
                transactionToEdit={editingTransaction}
                transactions={transactions}
                tags={tags}
                initialType={initialModalState.type}
                initialFromAccountId={initialModalState.from}
                initialToAccountId={initialModalState.to}
                initialDetails={initialModalState.details}
            />
        )}
        <TransactionDetailModal
            isOpen={isDetailModalOpen}
            onClose={() => setDetailModalOpen(false)}
            title={modalTitle}
            transactions={modalTransactions}
            accounts={accounts}
        />
        {isMileageModalOpen && (
            <AddMileageLogModal
                onClose={() => setIsMileageModalOpen(false)}
                onSave={handleSaveMileageLog}
                logToEdit={editingLog}
            />
        )}
        {deletingLogId && (
            <ConfirmationModal
                isOpen={!!deletingLogId}
                onClose={() => setDeletingLogId(null)}
                onConfirm={confirmDeleteLog}
                title="Delete Mileage Log"
                message="Are you sure you want to delete this log entry?"
                confirmButtonText="Delete"
            />
        )}

        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
                <button onClick={() => { setViewingAccountId(null); setCurrentPage('Accounts'); }} className="text-light-text-secondary dark:text-dark-text-secondary p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${ACCOUNT_TYPE_STYLES[account.type]?.color || 'bg-gray-200 text-gray-600'} bg-opacity-20`}>
                        <span className="material-symbols-outlined text-3xl">{account.icon || 'wallet'}</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">{account.name}</h1>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{account.type} {account.last4 ? `•••• ${account.last4}` : ''}</p>
                    </div>
                </div>
            </div>
            <div className="flex gap-3">
                {account.type === 'Vehicle' && (
                    <button onClick={() => handleOpenMileageModal()} className={BTN_SECONDARY_STYLE}>Log Mileage</button>
                )}
                <button onClick={() => handleOpenTransactionModal()} className={BTN_PRIMARY_STYLE}>Add Transaction</button>
            </div>
        </header>

        {/* --- VEHICLE DASHBOARD --- */}
        {account.type === 'Vehicle' ? (
            <div className="space-y-6">
                {/* Hero Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Image Card */}
                    <Card className="md:col-span-1 p-0 overflow-hidden flex items-center justify-center bg-white dark:bg-dark-card relative h-64 md:h-auto">
                        <div className={`w-full h-full flex items-center justify-center ${account.imageUrl ? '' : 'bg-gray-100 dark:bg-gray-800'}`}>
                            {account.imageUrl ? (
                                <img 
                                    src={account.imageUrl} 
                                    alt={account.name} 
                                    className="max-w-full max-h-full object-contain p-4" 
                                />
                            ) : (
                                <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600">directions_car</span>
                            )}
                        </div>
                        <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                            {account.ownership || 'Owned'}
                        </div>
                    </Card>

                    {/* Info & Stats Card */}
                    <Card className="md:col-span-2 flex flex-col justify-center p-6 md:p-8">
                        <div className="mb-6">
                            <h2 className="text-3xl font-bold text-light-text dark:text-dark-text">
                                {account.year} {account.make} {account.model}
                            </h2>
                            <p className="text-light-text-secondary dark:text-dark-text-secondary font-mono mt-1">
                                VIN: {account.vin || 'N/A'}
                            </p>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                            {showCurrentValue && (
                                <div>
                                    <p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Current Value</p>
                                    <p className="text-xl font-bold text-light-text dark:text-dark-text">{formatCurrency(account.balance, account.currency)}</p>
                                </div>
                            )}
                            <div>
                                <p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Odometer</p>
                                <p className="text-xl font-bold text-light-text dark:text-dark-text">{currentMileage.toLocaleString()} km</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Fuel</p>
                                <div className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm text-primary-500">local_gas_station</span>
                                    <p className="text-lg font-medium text-light-text dark:text-dark-text">{account.fuelType || 'N/A'}</p>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Plate</p>
                                <div className="flex items-stretch bg-gray-200 dark:bg-gray-700 rounded overflow-hidden inline-flex h-8">
                                    {account.registrationCountryCode && (
                                        <div className="bg-blue-600 text-white px-2 flex items-center justify-center font-bold text-xs">
                                            {account.registrationCountryCode}
                                        </div>
                                    )}
                                    <div className="px-3 flex items-center">
                                        <p className="text-base font-mono font-bold text-gray-700 dark:text-gray-200 whitespace-nowrap">
                                            {account.licensePlate || '---'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Lease Dashboard */}
                {account.ownership === 'Leased' && leaseStats && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card>
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="font-semibold text-light-text dark:text-dark-text">Lease Timeline</h3>
                                <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-2 py-1 rounded-full">{leaseStats.daysRemaining} days left</span>
                            </div>
                            <div className="relative pt-2">
                                <div className="flex justify-between text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">
                                    <span>{leaseStats.start.toLocaleDateString()}</span>
                                    <span>{leaseStats.end.toLocaleDateString()}</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                                    <div className="bg-primary-500 h-3 rounded-full" style={{ width: `${leaseStats.progress}%` }}></div>
                                </div>
                                <p className="text-center text-sm font-bold mt-2">{leaseStats.progress.toFixed(1)}% Elapsed</p>
                            </div>
                        </Card>

                        <Card>
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-semibold text-light-text dark:text-dark-text">Mileage Health</h3>
                                <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                                    leaseStats.mileageStatus === 'Over Budget' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300' :
                                    leaseStats.mileageStatus === 'Under Budget' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-300' :
                                    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                }`}>
                                    {leaseStats.mileageStatus}
                                </span>
                            </div>
                            <div className="mt-4">
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-sm text-light-text-secondary">Allowance</span>
                                    <span className="text-lg font-bold">{(account.annualMileageAllowance || 0).toLocaleString()} <span className="text-xs font-normal text-gray-500">km/yr</span></span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2 overflow-hidden">
                                    {/* Visual bar for mileage health could go here, simplified for now */}
                                    <div className={`h-full ${leaseStats.mileageDiff > 0 ? 'bg-red-500' : 'bg-green-500'}`} style={{width: '100%'}}></div>
                                </div>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-2">
                                    {leaseStats.mileageDiff > 0 
                                        ? `${leaseStats.mileageDiff.toLocaleString()} km over pro-rated budget` 
                                        : `${Math.abs(leaseStats.mileageDiff).toLocaleString()} km under pro-rated budget`}
                                </p>
                            </div>
                        </Card>

                        <Card>
                            <h3 className="font-semibold text-light-text dark:text-dark-text mb-4">Financials</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-light-text-secondary">Monthly Payment</span>
                                    <span className="font-bold text-lg">{account.leasePaymentAmount ? formatCurrency(account.leasePaymentAmount, account.currency) : 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-center border-t border-gray-100 dark:border-gray-800 pt-2">
                                    <span className="text-sm text-light-text-secondary">Due Date</span>
                                    <span className="font-medium">Day {account.leasePaymentDay || '?'}</span>
                                </div>
                                <div className="flex justify-between items-center border-t border-gray-100 dark:border-gray-800 pt-2">
                                    <span className="text-sm text-light-text-secondary">Paid From</span>
                                    <span className="font-medium truncate max-w-[120px]">{accounts.find(a => a.id === account.leasePaymentAccountId)?.name || 'External'}</span>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Ownership Section */}
                {account.ownership === 'Owned' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <h3 className="font-semibold text-light-text dark:text-dark-text mb-4">Ownership Details</h3>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary uppercase font-semibold mb-1">Purchase Price</p>
                                    <p className="text-lg font-bold">{account.purchasePrice ? formatCurrency(account.purchasePrice, account.currency) : 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary uppercase font-semibold mb-1">Purchase Date</p>
                                    <p className="text-lg font-bold">{account.purchaseDate ? parseDateAsUTC(account.purchaseDate).toLocaleDateString() : 'N/A'}</p>
                                </div>
                            </div>
                        </Card>
                        <Card>
                            <h3 className="font-semibold text-light-text dark:text-dark-text mb-4">Depreciation</h3>
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                    <span className="material-symbols-outlined">trending_down</span>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">-{formatCurrency(depreciation, account.currency)}</p>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Total loss in value</p>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Mileage History */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <VehicleMileageChart logs={account.mileageLogs || []} />
                    </div>
                    <div className="lg:col-span-1">
                        <Card className="h-full flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-semibold text-light-text dark:text-dark-text">Log History</h3>
                                <button onClick={() => handleOpenMileageModal()} className="text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 p-1 rounded transition-colors">
                                    <span className="material-symbols-outlined">add</span>
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto pr-2 space-y-2 max-h-64">
                                {(account.mileageLogs || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(log => (
                                    <div key={log.id} className="flex justify-between items-center p-3 rounded-lg bg-gray-50 dark:bg-white/5 group">
                                        <div>
                                            <p className="font-bold">{log.reading.toLocaleString()} km</p>
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{parseDateAsUTC(log.date).toLocaleDateString()}</p>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleOpenMileageModal(log)} className="p-1 text-gray-500 hover:text-primary-500"><span className="material-symbols-outlined text-sm">edit</span></button>
                                            <button onClick={() => handleDeleteMileageLog(log.id)} className="p-1 text-gray-500 hover:text-red-500"><span className="material-symbols-outlined text-sm">delete</span></button>
                                        </div>
                                    </div>
                                ))}
                                {(!account.mileageLogs || account.mileageLogs.length === 0) && (
                                    <p className="text-center text-sm text-gray-500 mt-8">No logs recorded.</p>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        ) : (
            // --- STANDARD ACCOUNT DASHBOARD (Existing Logic for other types) ---
            <div className="space-y-6">
                {/* Standard summary for non-vehicle accounts */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <CurrentBalanceCard balance={account.balance} currency={account.currency} />
                    <BalanceCard title="Income (1Y)" amount={totalIncome} sparklineData={[]} />
                    <BalanceCard title="Expenses (1Y)" amount={totalExpenses} sparklineData={[]} />
                    <Card className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-semibold text-light-text-secondary dark:text-dark-text-secondary">Transactions</h3>
                            <p className="text-2xl font-bold mt-1 text-light-text dark:text-dark-text">{accountTransactions.length}</p>
                        </div>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary-500/10">
                            <span className="material-symbols-outlined text-2xl text-primary-500">receipt_long</span>
                        </div>
                    </Card>
                </div>

                {/* Loan specific section */}
                {account.type === 'Loan' && account.principalAmount && account.duration && account.loanStartDate && (
                    <Card>
                        <h3 className="text-xl font-semibold mb-4 text-light-text dark:text-dark-text">Loan Payment Schedule</h3>
                        <PaymentPlanTable 
                            account={account} 
                            transactions={transactions} 
                            onMakePayment={handleMakePayment} 
                            overrides={loanPaymentOverrides[account.id] || {}} 
                            onOverridesChange={handleOverridesChange} 
                        />
                    </Card>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <NetWorthChart data={balanceHistory} lineColor={ACCOUNT_TYPE_STYLES[account.type]?.color ? 'currentColor' : '#6366F1'} />
                    <Card className="flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold text-light-text dark:text-dark-text">Recent Activity</h3>
                            <DurationFilter selectedDuration={duration} onDurationChange={setDuration} />
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <TransactionList transactions={displayTransactionsList} allCategories={allCategories} onTransactionClick={handleTransactionClick} />
                        </div>
                    </Card>
                </div>
            </div>
        )}
    </div>
  );
};

export default AccountDetail;
