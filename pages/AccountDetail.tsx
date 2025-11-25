
import React, { useMemo, useState, useCallback } from 'react';
import { Account, Transaction, Category, Duration, Page, CategorySpending, Widget, WidgetConfig, DisplayTransaction, RecurringTransaction, AccountDetailProps, Tag, ScheduledPayment, MileageLog } from '../types';
import { formatCurrency, getDateRange, convertToEur, calculateStatementPeriods, getCreditCardStatementDetails, parseDateAsUTC, formatDateKey, generateAmortizationSchedule } from '../utils';
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
import MortgageAmortizationChart from '../components/MortgageAmortizationChart';
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
         // Performance optimization: cap 'ALL' time range to a few years to prevent massive loops
        if (duration === 'ALL') {
            const fiveYearsAgo = new Date(end);
            fiveYearsAgo.setUTCFullYear(end.getUTCFullYear() - 5);
            if (start < fiveYearsAgo) {
                start.setTime(fiveYearsAgo.getTime());
            }
        }
        
        const currentBalance = convertToEur(account.balance, account.currency);
        
        const transactionsToReverse = transactions.filter(tx => {
            if (tx.accountId !== account.id) return false;
            const txDate = parseDateAsUTC(tx.date);
            return txDate >= start; // Reverse all transactions from the start of the period
        });

        const totalChangeSinceStart = transactionsToReverse.reduce((sum, tx) => {
            return sum + convertToEur(tx.amount, tx.currency);
        }, 0);

        const startingBalance = currentBalance - totalChangeSinceStart;
        
        const transactionsInPeriod = transactions.filter(tx => {
            if (tx.accountId !== account.id) return false;
            const txDate = parseDateAsUTC(tx.date);
            return txDate >= start && txDate <= end;
        });

        const dailyChanges = new Map<string, number>();
        let incomeInPeriod = 0;
        let expensesInPeriod = 0;
        
        for (const tx of transactionsInPeriod) {
            const dateStr = tx.date;
            const change = convertToEur(tx.amount, tx.currency);
            dailyChanges.set(dateStr, (dailyChanges.get(dateStr) || 0) + change);
            if (change > 0) incomeInPeriod += change;
            else expensesInPeriod += Math.abs(change);
        }
        
        const history: { name: string, value: number }[] = [];
        let runningBalance = startingBalance;
        
        let currentDate = new Date(start);
    
        while (currentDate <= end) {
            const dateStr = toYYYYMMDD(currentDate);
            runningBalance += dailyChanges.get(dateStr) || 0;
            history.push({
                name: dateStr,
                value: parseFloat(runningBalance.toFixed(2))
            });
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }
        
        return { balanceHistory: history, totalIncome: incomeInPeriod, totalExpenses: expensesInPeriod };
    }, [accountTransactions, duration, account.balance, account.currency, transactions]);


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
        let totalAllowance = 0;
        
        if (account.annualMileageAllowance) {
            const dailyAllowance = account.annualMileageAllowance / 365;
            const expectedMileage = elapsedDays * dailyAllowance;
            
            totalAllowance = dailyAllowance * totalDays;
            mileageDiff = currentMileage - expectedMileage;
            projectedMileage = (currentMileage / elapsedDays) * 365;
            
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
            projectedMileage,
            totalAllowance
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

    // --- Loan/Mortgage/Lending Specific Helpers ---
    const loanDetails = useMemo(() => {
        if (account.type !== 'Loan' && account.type !== 'Lending') return null;
        
        const schedule = generateAmortizationSchedule(account, transactions, loanPaymentOverrides[account.id] || {});
        const totalPaidPrincipal = schedule.reduce((acc, p) => p.status === 'Paid' ? acc + p.principal : acc, 0);
        const totalPaidInterest = schedule.reduce((acc, p) => p.status === 'Paid' ? acc + p.interest : acc, 0);
        
        // Find if linked to a property for LTV
        const linkedProperty = accounts.find(a => a.type === 'Property' && a.linkedLoanId === account.id);
        let ltv = 0;
        let equity = 0; // Invested Equity
        let marketEquity = 0;
        
        if (linkedProperty) {
            const propertyValue = linkedProperty.balance; // Current value
            const loanBalance = Math.abs(account.balance);
            if (propertyValue > 0) {
                ltv = (loanBalance / propertyValue) * 100;
            }
            // Market Equity = Market Value - Loan Balance
            marketEquity = propertyValue - loanBalance;
        }
        
        // Invested Equity = Down Payment + Principal Paid
        equity = totalPaidPrincipal + (account.downPayment || 0);

        // Calculate payoff date
        const lastPayment = schedule[schedule.length - 1];
        const payoffDate = lastPayment ? parseDateAsUTC(lastPayment.date) : null;
        
        return {
            schedule,
            totalPaidPrincipal,
            totalPaidInterest,
            linkedProperty,
            ltv,
            equity,
            marketEquity,
            payoffDate
        };
    }, [account, transactions, loanPaymentOverrides, accounts]);


    // --- Property Specific Helpers ---
    if (account.type === 'Property') {
        const linkedLoan = useMemo(() => {
            if (account.linkedLoanId) {
                return accounts.find(a => a.id === account.linkedLoanId);
            }
            return null;
        }, [account.linkedLoanId, accounts]);
    
        const principalOwned = useMemo(() => {
            if (linkedLoan) {
                const loanPayments = transactions.filter(tx => tx.accountId === linkedLoan.id && tx.type === 'income');
                const principalPaidOnLoan = loanPayments.reduce((sum, tx) => sum + (tx.principalAmount || 0), 0);
                return principalPaidOnLoan + (linkedLoan.downPayment || 0);
            }
            return account.principalOwned || 0;
        }, [linkedLoan, transactions, account.principalOwned]);
    
        const purchasePrice = useMemo(() => {
            if (linkedLoan) {
                return (linkedLoan.principalAmount || 0) + (linkedLoan.downPayment || 0);
            }
            return account.purchasePrice || 0;
        }, [linkedLoan, account.purchasePrice]);

        const features = [
            account.hasBasement ? { label: 'Basement', icon: 'foundation' } : null,
            account.hasAttic ? { label: 'Attic', icon: 'roofing' } : null,
            account.hasGarden ? { label: `Garden ${account.gardenSize ? `(${account.gardenSize} m²)` : ''}`, icon: 'yard' } : null,
            account.indoorParkingSpaces ? { label: `Indoor Parking (${account.indoorParkingSpaces})`, icon: 'garage' } : null,
            account.outdoorParkingSpaces ? { label: `Outdoor Parking (${account.outdoorParkingSpaces})`, icon: 'local_parking' } : null,
        ].filter(Boolean);

        // Equity = Invested Equity (Down Payment + Principal Paid)
        const equity = principalOwned;
        
        // Market Equity = Market Value (Current Balance) - Outstanding Loan Balance
        const marketEquity = linkedLoan
            ? account.balance - Math.abs(linkedLoan.balance)
            : account.balance;

        const appreciation = account.balance - (purchasePrice || 0);
        const appreciationPercent = purchasePrice ? (appreciation / purchasePrice) * 100 : 0;

        return (
            <div className="space-y-6">
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

                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4 w-full">
                        <button onClick={() => { setViewingAccountId(null); setCurrentPage('Accounts'); }} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0">
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                         <div className="flex items-center gap-4 w-full">
                            <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${ACCOUNT_TYPE_STYLES[account.type]?.color || 'bg-gray-200 text-gray-600'} bg-opacity-10 border border-current`}>
                                <span className="material-symbols-outlined text-4xl">{account.icon || 'home'}</span>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">{account.name}</h1>
                                <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                    <span>{account.propertyType || 'Property'}</span>
                                    {account.address && (
                                        <>
                                            <span>•</span>
                                            <span className="truncate max-w-[200px]" title={account.address}>{account.address}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="ml-auto">
                                <button onClick={() => handleOpenTransactionModal()} className={BTN_PRIMARY_STYLE}>Add Transaction</button>
                            </div>
                        </div>
                    </div>
                </header>
    
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card>
                        <p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Current Value</p>
                        <p className="text-2xl font-bold text-light-text dark:text-dark-text">{formatCurrency(account.balance, account.currency)}</p>
                    </Card>
                     <Card>
                         <p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Market Equity</p>
                         <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(marketEquity, account.currency)}</p>
                         <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Value - Debt</p>
                    </Card>
                    <Card>
                         <p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Invested Equity</p>
                         <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(equity, account.currency)}</p>
                         <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Principal + Down Payment</p>
                    </Card>
                    <Card>
                        <p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Appreciation</p>
                        <div className="flex items-baseline gap-2">
                            <p className={`text-2xl font-bold ${appreciation >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {appreciation >= 0 ? '+' : ''}{formatCurrency(appreciation, account.currency)}
                            </p>
                            <p className={`text-sm font-semibold ${appreciation >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                ({appreciationPercent >= 0 ? '+' : ''}{appreciationPercent.toFixed(1)}%)
                            </p>
                        </div>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2">
                        <h3 className="text-base font-semibold text-light-text dark:text-dark-text mb-4">Property Details</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                             <div>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">Size</p>
                                <p className="font-semibold text-lg">{account.propertySize ? `${account.propertySize} m²` : 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">Year Built</p>
                                <p className="font-semibold text-lg">{account.yearBuilt || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">Floors</p>
                                <p className="font-semibold text-lg">{account.floors || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">Bedrooms</p>
                                <p className="font-semibold text-lg">{account.bedrooms || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">Bathrooms</p>
                                <p className="font-semibold text-lg">{account.bathrooms || 'N/A'}</p>
                            </div>
                             <div>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">Linked Loan</p>
                                {linkedLoan ? (
                                    <button onClick={() => setViewingAccountId(linkedLoan.id)} className="font-semibold text-lg text-primary-500 hover:underline truncate max-w-full block text-left">
                                        {linkedLoan.name}
                                    </button>
                                ) : (
                                    <p className="font-semibold text-lg text-gray-400">None</p>
                                )}
                            </div>
                        </div>
                    </Card>

                    <div className="space-y-6">
                        <Card>
                            <h3 className="text-base font-semibold text-light-text dark:text-dark-text mb-4">Features & Amenities</h3>
                            {features.length > 0 ? (
                                <div className="flex flex-wrap gap-3">
                                    {features.map((feature, idx) => (
                                        <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-light-fill dark:bg-dark-fill border border-black/5 dark:border-white/5">
                                            <span className="material-symbols-outlined text-primary-500 text-xl">{feature?.icon}</span>
                                            <span className="font-medium text-sm text-light-text dark:text-dark-text">{feature?.label}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary italic">No features listed.</p>
                            )}
                        </Card>
                         {linkedLoan && (
                            <LoanProgressCard title="Mortgage Progress" paid={principalOwned} total={purchasePrice || linkedLoan.totalAmount || 0} currency={account.currency} />
                         )}
                    </div>
                </div>
            </div>
        );
    }
    
    // Determine styles based on account type for Loan/Lending dashboard
    const isLending = account.type === 'Lending';
    const headerIconStyle = isLending 
        ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400'
        : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400';
    
    const balanceLabel = isLending ? 'Outstanding Principal' : 'Outstanding Balance';
    const balanceColor = isLending ? 'text-teal-600 dark:text-teal-400' : 'text-red-600 dark:text-red-400';
    
    const principalLabel = isLending ? 'Principal Received' : 'Principal Paid';
    const interestLabel = isLending ? 'Interest Earned' : 'Total Interest Paid';
    const paymentLabel = isLending ? 'Monthly Receipt' : 'Monthly Payment';

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
                {/* Header for non-Loan/Property/Vehicle/Lending accounts, specific headers are inside blocks */}
                {account.type !== 'Vehicle' && account.type !== 'Loan' && account.type !== 'Lending' && (
                    <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">{account.name}</h1>
                )}
            </div>
            <div className="flex gap-3">
                {(account.type !== 'Vehicle' && account.type !== 'Loan' && account.type !== 'Lending') && <DurationFilter selectedDuration={duration} onDurationChange={setDuration} />}
                <button onClick={() => handleOpenTransactionModal()} className={BTN_PRIMARY_STYLE}>Add Transaction</button>
            </div>
        </header>

        {/* --- LOAN / LENDING DASHBOARD --- */}
        {(account.type === 'Loan' || account.type === 'Lending') && loanDetails ? (
            <div className="space-y-6">
                <div className="flex items-center gap-4 mb-4">
                    <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${headerIconStyle} border border-current`}>
                        <span className="material-symbols-outlined text-4xl">{account.icon || (isLending ? 'real_estate_agent' : 'real_estate_agent')}</span>
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">{account.name}</h1>
                        <div className="flex items-center gap-3 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            {loanDetails.linkedProperty && <span>Linked to: <strong>{loanDetails.linkedProperty.name}</strong></span>}
                            {loanDetails.payoffDate && (
                                <span className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-0.5 rounded text-xs font-semibold">
                                    {isLending ? 'Maturity' : 'Payoff'}: {loanDetails.payoffDate.toLocaleDateString(undefined, {month:'short', year: 'numeric'})}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Top Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                    <Card>
                        <p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">{balanceLabel}</p>
                        <p className={`text-2xl font-bold ${balanceColor}`}>{formatCurrency(Math.abs(account.balance), account.currency)}</p>
                    </Card>
                    <Card>
                        <p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">{principalLabel}</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(loanDetails.totalPaidPrincipal, account.currency)}</p>
                    </Card>
                    <Card>
                        <p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">{interestLabel}</p>
                        <p className="text-2xl font-bold text-orange-500">{formatCurrency(loanDetails.totalPaidInterest, account.currency)}</p>
                    </Card>
                     <Card>
                        <p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">{paymentLabel}</p>
                        <p className="text-2xl font-bold text-light-text dark:text-dark-text">
                            {formatCurrency(loanDetails.schedule[0]?.totalPayment || 0, account.currency)}
                        </p>
                    </Card>
                    <Card>
                        <p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Interest Rate</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-2xl font-bold text-light-text dark:text-dark-text">{account.interestRate}%</p>
                            <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Fixed</span>
                        </div>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Chart */}
                    <div className="lg:col-span-2">
                        <MortgageAmortizationChart schedule={loanDetails.schedule} currency={account.currency} accountType={account.type} />
                    </div>
                    
                    {/* Side Stats */}
                    <div className="flex flex-col gap-6">
                        {loanDetails.linkedProperty && (
                            <Card>
                                <h3 className="text-base font-semibold text-light-text dark:text-dark-text mb-4">Equity & LTV</h3>
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-light-text-secondary dark:text-dark-text-secondary">Loan-to-Value (LTV)</span>
                                            <span className="font-bold">{loanDetails.ltv.toFixed(1)}%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                            <div className={`h-2.5 rounded-full ${loanDetails.ltv > 80 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(loanDetails.ltv, 100)}%` }}></div>
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-black/5 dark:border-white/10 space-y-2">
                                         <div className="flex justify-between items-center">
                                            <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Market Equity</span>
                                            <span className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(loanDetails.marketEquity, account.currency)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Invested Equity</span>
                                            <span className="text-base font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(loanDetails.equity, account.currency)}</span>
                                        </div>
                                         <div className="flex justify-between items-center text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                            <span>Down Payment</span>
                                            <span>{formatCurrency(account.downPayment || 0, account.currency)}</span>
                                        </div>
                                         <div className="flex justify-between items-center text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                            <span>Principal Paid</span>
                                            <span>{formatCurrency(loanDetails.totalPaidPrincipal, account.currency)}</span>
                                        </div>
                                         <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-2 italic">
                                            * Invested Equity = Down Payment + Principal Paid.
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        )}
                        <Card>
                            <h3 className="text-base font-semibold text-light-text dark:text-dark-text mb-4">{isLending ? 'Lending Details' : 'Loan Details'}</h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-light-text-secondary dark:text-dark-text-secondary">Start Date</span>
                                    <span className="font-medium">{parseDateAsUTC(account.loanStartDate!).toLocaleDateString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-light-text-secondary dark:text-dark-text-secondary">Original Principal</span>
                                    <span className="font-medium">{formatCurrency(account.principalAmount || 0, account.currency)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-light-text-secondary dark:text-dark-text-secondary">Term Length</span>
                                    <span className="font-medium">{Math.floor((account.duration || 0) / 12)} Years ({(account.duration || 0) % 12}mo)</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-light-text-secondary dark:text-dark-text-secondary">{isLending ? 'Payments Received' : 'Payments Made'}</span>
                                    <span className="font-medium">{loanDetails.schedule.filter(p => p.status === 'Paid').length} / {account.duration}</span>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>

                <Card className="overflow-hidden">
                    <h3 className="text-xl font-semibold mb-4 text-light-text dark:text-dark-text">Amortization Schedule</h3>
                    <PaymentPlanTable 
                        account={account} 
                        transactions={transactions} 
                        onMakePayment={handleMakePayment} 
                        overrides={loanPaymentOverrides[account.id] || {}} 
                        onOverridesChange={handleOverridesChange} 
                    />
                </Card>
            </div>
        ) : account.type === 'Vehicle' ? (
        /* --- VEHICLE DASHBOARD --- */
            <div className="space-y-6">
                <Card className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                    <div className="md:col-span-1 relative aspect-video rounded-lg overflow-hidden flex items-center justify-center">
                        {account.imageUrl ? (
                            <img 
                                src={account.imageUrl} 
                                alt={account.name} 
                                className="max-w-full max-h-full object-contain" 
                            />
                        ) : (
                            <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600">directions_car</span>
                            </div>
                        )}
                        <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                            {account.ownership || 'Owned'}
                        </div>
                    </div>

                    <div className="md:col-span-2 p-2">
                        <h2 className="text-3xl font-bold text-light-text dark:text-dark-text">
                            {account.year} {account.make} {account.model}
                        </h2>
                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center md:text-left">
                           {showCurrentValue && (
                                <div>
                                    <p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Value</p>
                                    <p className="text-xl font-bold text-light-text dark:text-dark-text">{formatCurrency(account.balance, account.currency)}</p>
                                </div>
                            )}
                            <div>
                                <p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Odometer</p>
                                <p className="text-xl font-bold text-light-text dark:text-dark-text">{currentMileage.toLocaleString()} km</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Fuel</p>
                                <p className="text-lg font-medium text-light-text dark:text-dark-text">{account.fuelType || 'N/A'}</p>
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
                         <div className="mt-4 flex flex-wrap gap-3 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            {account.vin && <span className="bg-black/5 dark:bg-white/5 px-2 py-1 rounded font-mono text-xs">VIN: {account.vin}</span>}
                        </div>
                    </div>
                </Card>

                {/* Lease Dashboard */}
                {account.ownership === 'Leased' && leaseStats && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card>
                            <h3 className="font-semibold text-light-text dark:text-dark-text mb-4">Lease Timeline</h3>
                             <div className="relative pt-2">
                                <div className="flex justify-between text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">
                                    <span>{leaseStats.start.toLocaleDateString()}</span>
                                    <span>{leaseStats.end.toLocaleDateString()}</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                                    <div className="bg-primary-500 h-3 rounded-full" style={{ width: `${leaseStats.progress}%` }}></div>
                                </div>
                                <p className="text-center text-sm font-bold mt-2">{leaseStats.progress.toFixed(1)}% Elapsed ({leaseStats.daysRemaining} days left)</p>
                            </div>
                        </Card>
                        <Card>
                            <h3 className="font-semibold text-light-text dark:text-dark-text mb-4">Mileage Health</h3>
                             <div className="space-y-4">
                                 <div>
                                     <div className="flex justify-between items-baseline mb-1">
                                         <span className="text-sm text-light-text-secondary">Current</span>
                                         <span className="text-sm font-bold">{currentMileage.toLocaleString()} <span className="text-xs font-normal text-gray-500">km</span></span>
                                     </div>
                                     
                                     <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                         {/* Actual Progress */}
                                         <div 
                                            className={`h-full rounded-full transition-all duration-500 ${leaseStats.mileageStatus === 'Over Budget' ? 'bg-red-500' : 'bg-green-500'}`} 
                                            style={{ width: `${Math.min((currentMileage / leaseStats.totalAllowance) * 100, 100)}%` }}
                                         ></div>
                                         
                                         {/* Expected Marker */}
                                         <div 
                                            className="absolute top-0 bottom-0 w-0.5 bg-black dark:bg-white z-10" 
                                            style={{ left: `${leaseStats.progress}%` }}
                                            title={`Expected: ${(leaseStats.totalAllowance * (leaseStats.progress / 100)).toLocaleString(undefined, {maximumFractionDigits:0})} km`}
                                         ></div>
                                     </div>
                                      <div className="flex justify-between text-xs text-light-text-secondary mt-1">
                                        <span>0</span>
                                        <span>Total: {leaseStats.totalAllowance.toLocaleString(undefined, {maximumFractionDigits:0})} km</span>
                                     </div>
                                 </div>

                                <div className="flex justify-between items-center pt-2 border-t border-black/5 dark:border-white/5">
                                    <span className="text-sm text-light-text-secondary">Projected</span>
                                    <span className="text-base font-bold">{leaseStats.projectedMileage.toLocaleString(undefined, {maximumFractionDigits: 0})} <span className="text-xs font-normal text-gray-500">km/yr</span></span>
                                </div>
                            </div>
                        </Card>

                        <Card>
                            <h3 className="font-semibold text-light-text dark:text-dark-text mb-4">Financials</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-light-text-secondary">Monthly Payment</span>
                                    <span className="font-bold text-lg">{account.leasePaymentAmount ? formatCurrency(account.leasePaymentAmount, account.currency) : 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-800">
                                    <span className="text-sm text-light-text-secondary">Paid From</span>
                                    <span className="font-medium truncate max-w-[120px]">{accounts.find(a => a.id === account.leasePaymentAccountId)?.name || 'External'}</span>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}
                {account.ownership === 'Owned' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <h3 className="font-semibold text-light-text dark:text-dark-text mb-4">Vehicle Details</h3>
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
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <VehicleMileageChart logs={account.mileageLogs || []} />
                    </div>
                    <div className="lg:col-span-1">
                        <Card className="h-full flex flex-col">
                            <h3 className="font-semibold text-light-text dark:text-dark-text mb-4">Log History</h3>
                            
                             <div className="grid grid-cols-3 gap-2 font-semibold text-xs text-light-text-secondary dark:text-dark-text-secondary border-b border-black/5 dark:border-white/5 pb-2 mb-2 uppercase tracking-wider">
                                <span>Mileage</span>
                                <span className="text-center">Date</span>
                                <span className="text-right">Actions</span>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-2 max-h-64">
                                {(account.mileageLogs || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(log => (
                                    <div key={log.id} className="grid grid-cols-3 gap-2 items-center p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 group transition-colors text-sm">
                                        <div className="font-bold">{log.reading.toLocaleString()} km</div>
                                        <div className="text-center text-light-text-secondary dark:text-dark-text-secondary">{parseDateAsUTC(log.date).toLocaleDateString()}</div>
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleOpenMileageModal(log)} className="p-1.5 rounded text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/10 dark:hover:bg-white/10 hover:text-primary-500"><span className="material-symbols-outlined text-base">edit</span></button>
                                            <button onClick={() => handleDeleteMileageLog(log.id)} className="p-1.5 rounded text-light-text-secondary dark:text-dark-text-secondary hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500"><span className="material-symbols-outlined text-base">delete</span></button>
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
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <CurrentBalanceCard balance={account.balance} currency={account.currency} />
                    <BalanceCard title={`Income (${duration})`} amount={totalIncome} sparklineData={[]} />
                    <BalanceCard title={`Expenses (${duration})`} amount={totalExpenses} sparklineData={[]} />
                    <NetBalanceCard netBalance={totalIncome - totalExpenses} totalIncome={totalIncome} duration={duration} />
                 </div>
                {account.type === 'Loan' && !loanDetails && account.principalAmount && account.duration && account.loanStartDate && (
                    // Fallback if loanDetails calculation failed but basic props exist (shouldn't happen often)
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
                        <h3 className="text-xl font-semibold mb-4 text-light-text dark:text-dark-text">Recent Activity</h3>
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
