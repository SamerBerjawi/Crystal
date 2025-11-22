


import React, { useMemo, useState, useCallback } from 'react';
// FIX: Import 'AccountDetailProps' to define props for the component.
import { Account, Transaction, Category, Duration, Page, CategorySpending, Widget, WidgetConfig, DisplayTransaction, RecurringTransaction, AccountDetailProps, Tag, ScheduledPayment, MileageLog } from '../types';
import { formatCurrency, getDateRange, convertToEur, calculateStatementPeriods, getCreditCardStatementDetails, parseDateAsUTC } from '../utils';
import AddTransactionModal from '../components/AddTransactionModal';
import { BTN_PRIMARY_STYLE, MOCK_EXPENSE_CATEGORIES, BTN_SECONDARY_STYLE } from '../constants';
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

const AccountDetail: React.FC<AccountDetailProps> = ({ account, accounts, transactions, allCategories, setCurrentPage, saveTransaction, recurringTransactions, setViewingAccountId, tags, loanPaymentOverrides, saveLoanPaymentOverrides, saveAccount }) => {
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
                description: description,
            }
        });
        setTransactionModalOpen(true);
    };

    const handleCloseTransactionModal = () => {
        setEditingTransaction(null);
        setTransactionModalOpen(false);
        setInitialModalState({});
    };

    const handleTransactionClick = useCallback((clickedTx: DisplayTransaction) => {
        if (clickedTx.isTransfer && clickedTx.transferId) {
            const pair = transactions.filter(t => t.transferId === clickedTx.transferId);
            setModalTransactions(pair);
            setModalTitle('Transfer Details');
        } else {
            const originalTx = transactions.find(t => t.id === clickedTx.id);
            if (originalTx) {
                setModalTransactions([originalTx]);
                setModalTitle('Transaction Details');
            }
        }
        setDetailModalOpen(true);
      }, [transactions]);
    
    const accountMap = useMemo(() => accounts.reduce((map, acc) => { map[acc.id] = acc.name; return map; }, {} as Record<string, string>), [accounts]);
    
    const recentTransactions = useMemo(() => {
        const accountTransactions = transactions
            .filter(tx => tx.accountId === account.id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
        const processedTransferIds = new Set<string>();
        const result: DisplayTransaction[] = [];
    
        for (const tx of accountTransactions) {
            if (result.length >= 10) break;
    
            if (tx.transferId) {
                if (processedTransferIds.has(tx.transferId)) continue;
                
                const pair = transactions.find(t => t.transferId === tx.transferId && t.id !== tx.id);
                processedTransferIds.add(tx.transferId);
    
                if (pair) {
                    const expensePart = tx.amount < 0 ? tx : pair;
                    const incomePart = tx.amount > 0 ? tx : pair;
                    result.push({
                        ...expensePart,
                        id: `transfer-${expensePart.transferId}`,
                        originalId: expensePart.id,
                        amount: Math.abs(expensePart.amount),
                        isTransfer: true,
                        type: 'expense',
                        fromAccountName: accountMap[expensePart.accountId] || 'Unknown',
                        toAccountName: accountMap[incomePart.accountId] || 'Unknown',
                        category: 'Transfer',
                    });
                } else { // Orphaned
                    result.push({ ...tx, accountName: accountMap[tx.accountId] });
                }
            } else {
                result.push({ ...tx, accountName: accountMap[tx.accountId] });
            }
        }
        return result.slice(0, 10);
    }, [transactions, account.id, accountMap]);

    const handleSaveMileageLog = (log: Omit<MileageLog, 'id'> & { id?: string }) => {
        if (log.id) { // Editing existing log
          const updatedLogs = (account.mileageLogs || []).map(l => 
            l.id === log.id ? { ...l, date: log.date, reading: log.reading } : l
          );
          saveAccount({ ...account, mileageLogs: updatedLogs as MileageLog[] });
        } else { // Adding new log
          const newLog: MileageLog = { date: log.date, reading: log.reading, id: `log-${uuidv4()}` };
          const updatedLogs = [...(account.mileageLogs || []), newLog];
          saveAccount({ ...account, mileageLogs: updatedLogs });
        }
        setIsMileageModalOpen(false);
        setEditingLog(null);
    };

    const handleEditLogClick = (log: MileageLog) => {
        setEditingLog(log);
        setIsMileageModalOpen(true);
    };
    
    const handleDeleteLogClick = (logId: string) => {
        setDeletingLogId(logId);
    };
    
    const confirmDeleteLog = () => {
        if (!deletingLogId) return;
        const updatedLogs = (account.mileageLogs || []).filter(log => log.id !== deletingLogId);
        saveAccount({ ...account, mileageLogs: updatedLogs });
        setDeletingLogId(null);
    };

    if (account.type === 'Loan' || account.type === 'Lending') {
        const isLending = account.type === 'Lending';
        const payments = transactions.filter(tx => tx.accountId === account.id && tx.type === (isLending ? 'expense' : 'income'));
        
        const principalPaid = payments.reduce((sum, tx) => sum + (tx.principalAmount || 0), 0);
        const interestPaid = payments.reduce((sum, tx) => sum + (tx.interestAmount || 0), 0);
        const totalPaid = principalPaid + interestPaid;

        const totalLoanAmount = account.totalAmount || 0;
        const totalPrincipal = account.principalAmount || 0;
        const totalInterest = account.interestAmount || 0;
        
        const loanPaymentSchedule = recurringTransactions.find(rt => 
            isLending ? rt.accountId === account.id : rt.toAccountId === account.id 
            && rt.type === 'transfer'
        );
        
        const nextPaymentDate = loanPaymentSchedule?.nextDueDate;
        
        let paymentsRemaining: number | undefined;
        if (account.duration && loanPaymentSchedule) {
            const paymentsMade = payments.length;
            paymentsRemaining = account.duration - paymentsMade;
        }

        const linkedAccount = useMemo(() => {
            if (account.linkedAccountId) {
                return accounts.find(a => a.id === account.linkedAccountId);
            }
            return null;
        }, [account.linkedAccountId, accounts]);

        const formatDate = (dateString: string) => {
            return new Date(dateString.replace(/-/g, '/')).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC'
            });
        };
        
        return (
          <div className="space-y-6">
            {isTransactionModalOpen && (
                <AddTransactionModal
                    onClose={handleCloseTransactionModal}
                    onSave={(data, toDelete) => { saveTransaction(data, toDelete); handleCloseTransactionModal(); }}
                    accounts={accounts}
                    incomeCategories={allCategories.filter(c => c.classification === 'income')}
                    expenseCategories={allCategories.filter(c => c.classification === 'expense')}
                    transactionToEdit={editingTransaction}
                    transactions={transactions}
                    initialType={initialModalState.type}
                    initialFromAccountId={initialModalState.from}
                    initialToAccountId={initialModalState.to}
                    initialDetails={initialModalState.details}
                    tags={tags}
                />
            )}
             <TransactionDetailModal
                isOpen={isDetailModalOpen}
                onClose={() => setDetailModalOpen(false)}
                title={modalTitle}
                transactions={modalTransactions}
                accounts={accounts}
            />

            <header className="flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => { setViewingAccountId(null); setCurrentPage('Accounts'); }} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">{account.type} Account &bull; Total: {formatCurrency(account.totalAmount || 0, account.currency)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => handleOpenTransactionModal()} className={`${BTN_PRIMARY_STYLE} h-10`}>
                        Add Payment
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <LoanProgressCard title={isLending ? "Total Received" : "Total Loan Paid"} paid={totalPaid} total={totalLoanAmount} currency={account.currency} />
              <LoanProgressCard title={isLending ? "Principal Received" : "Principal Paid"} paid={principalPaid} total={totalPrincipal} currency={account.currency} />
              <LoanProgressCard title={isLending ? "Interest Received" : "Interest Paid"} paid={interestPaid} total={totalInterest} currency={account.currency} />
              <Card>
                <div className="flex flex-col h-full justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-light-text-secondary dark:text-dark-text-secondary">Down Payment</h3>
                        <p className="text-2xl font-bold text-light-text dark:text-dark-text">
                            {formatCurrency(account.downPayment || 0, account.currency)}
                        </p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-black/10 dark:border-white/10">
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Next Payment Due</p>
                        <p className="font-semibold text-light-text dark:text-dark-text">
                            {nextPaymentDate ? formatDate(nextPaymentDate) : 'Not scheduled'}
                        </p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                            {paymentsRemaining !== undefined && paymentsRemaining >= 0 
                                ? `${paymentsRemaining} payments remaining` 
                                : 'Duration not set'}
                        </p>
                    </div>
                </div>
              </Card>
            </div>
    
            <Card>
                <h3 className="text-xl font-semibold mb-4 text-light-text dark:text-dark-text">Payment Plan</h3>
                <PaymentPlanTable
                    account={account}
                    transactions={transactions}
                    onMakePayment={handleMakePayment}
                    overrides={loanPaymentOverrides[account.id] || {}}
                    onOverridesChange={(updated) => saveLoanPaymentOverrides(account.id, updated)}
                />
            </Card>
          </div>
        );
    }
  
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
    
        return (
            <div className="space-y-6">
                <header className="flex flex-wrap justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => { setViewingAccountId(null); setCurrentPage('Accounts'); }} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                    </div>
                </header>
    
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <CurrentBalanceCard title="Current Value" balance={account.balance} currency={account.currency} />
                    <LoanProgressCard title="Principal Owned" paid={principalOwned} total={purchasePrice} currency={account.currency} />
                    <Card>
                        <h3 className="text-base font-semibold text-light-text-secondary dark:text-dark-text-secondary">Property Details</h3>
                        <div className="mt-2 space-y-2 text-sm">
                            <div className="flex justify-between"><span>Purchase Price</span><span className="font-semibold">{formatCurrency(purchasePrice, account.currency)}</span></div>
                            <div className="flex justify-between"><span>Address</span><span className="font-semibold truncate">{account.address || 'N/A'}</span></div>
                            <div className="flex justify-between items-center pt-2 mt-2 border-t border-black/10 dark:border-white/10">
                                <span>Linked Loan</span>
                                {linkedLoan ? (
                                    <button onClick={() => setViewingAccountId(linkedLoan.id)} className="font-semibold text-primary-500 hover:underline">{linkedLoan.name}</button>
                                ) : (
                                    <span className="font-semibold">None</span>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>
                
                <Card>
                    <h3 className="text-xl font-semibold mb-4 text-light-text dark:text-dark-text">Recent Activity</h3>
                    <TransactionList
                        transactions={recentTransactions}
                        allCategories={allCategories}
                        onTransactionClick={handleTransactionClick}
                    />
                </Card>
            </div>
        );
    }

    if (account.type === 'Vehicle') {
        const currentMileage = account.mileageLogs && account.mileageLogs.length > 0 
            ? account.mileageLogs.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].reading 
            : 0;
        
        const leaseProgress = useMemo(() => {
            if (account.ownership === 'Leased' && account.leaseStartDate && account.leaseEndDate) {
                const start = new Date(account.leaseStartDate);
                const end = new Date(account.leaseEndDate);
                const now = new Date();
                
                const totalMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
                const elapsedMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
                
                const progressPercent = totalMonths > 0 ? Math.min(Math.max((elapsedMonths / totalMonths) * 100, 0), 100) : 0;
                
                return {
                    elapsedMonths: Math.max(0, elapsedMonths),
                    totalMonths,
                    progressPercent
                };
            }
            return null;
        }, [account.ownership, account.leaseStartDate, account.leaseEndDate]);

        const distanceDrivenSinceLeaseStart = useMemo(() => {
            if (!account.leaseStartDate || !account.mileageLogs || account.mileageLogs.length < 1) {
                return 0;
            }
            const startDate = parseDateAsUTC(account.leaseStartDate);
            const sortedLogs = [...account.mileageLogs].sort((a,b) => parseDateAsUTC(a.date).getTime() - parseDateAsUTC(b.date).getTime());

            const firstLogForLease = sortedLogs.find(log => parseDateAsUTC(log.date) >= startDate);
            if (!firstLogForLease) return 0;

            const startReading = firstLogForLease.reading;
            const endReading = sortedLogs[sortedLogs.length - 1].reading;

            return endReading - startReading;
        }, [account.leaseStartDate, account.mileageLogs]);

        const mileageToDate = useMemo(() => {
            if (account.ownership !== 'Leased' || !account.annualMileageAllowance || !account.leaseStartDate || distanceDrivenSinceLeaseStart === 0) {
                return null;
            }

            const daysElapsed = (new Date().getTime() - parseDateAsUTC(account.leaseStartDate).getTime()) / (1000 * 60 * 60 * 24);
            if (daysElapsed <= 0) return null;

            const dailyAllowance = account.annualMileageAllowance / 365;
            const toDateAllowance = dailyAllowance * daysElapsed;

            if (toDateAllowance <= 0) return null;

            const usagePercent = (distanceDrivenSinceLeaseStart / toDateAllowance) * 100;
            
            let usageColor = 'bg-green-500';
            if (usagePercent > 100) usageColor = 'bg-red-500';
            else if (usagePercent > 90) usageColor = 'bg-yellow-500';

            return {
                toDateAllowance: Math.round(toDateAllowance),
                actualMileageUsed: distanceDrivenSinceLeaseStart,
                usagePercent,
                usageColor
            };
        }, [account.ownership, account.annualMileageAllowance, account.leaseStartDate, distanceDrivenSinceLeaseStart]);
        
        const mileageProjection = useMemo(() => {
            if (account.ownership !== 'Leased' || !account.annualMileageAllowance || !account.mileageLogs || account.mileageLogs.length < 2) {
                return null;
            }
            
            const sortedLogs = [...account.mileageLogs].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const firstLog = sortedLogs[0];
            const lastLog = sortedLogs[sortedLogs.length - 1];

            const distance = lastLog.reading - firstLog.reading;
            const days = (new Date(lastLog.date).getTime() - new Date(firstLog.date).getTime()) / (1000 * 60 * 60 * 24);

            if (days <= 0) return null;

            const dailyAvg = distance / days;
            const projectedAnnual = dailyAvg * 365;
            const usagePercent = (projectedAnnual / account.annualMileageAllowance) * 100;
            
            let usageColor = 'bg-green-500';
            if (usagePercent > 100) usageColor = 'bg-red-500';
            else if (usagePercent > 90) usageColor = 'bg-yellow-500';
            
            return {
                projectedAnnual: Math.round(projectedAnnual),
                usagePercent,
                usageColor
            };
        }, [account.annualMileageAllowance, account.mileageLogs, account.ownership]);
        
        return (
            <div className="space-y-6">
                {isMileageModalOpen && (
                    <AddMileageLogModal 
                        onClose={() => { setIsMileageModalOpen(false); setEditingLog(null); }}
                        onSave={handleSaveMileageLog}
                        logToEdit={editingLog}
                    />
                )}
                <ConfirmationModal 
                    isOpen={!!deletingLogId}
                    onClose={() => setDeletingLogId(null)}
                    onConfirm={confirmDeleteLog}
                    title="Delete Mileage Log"
                    message="Are you sure you want to delete this mileage log entry? This cannot be undone."
                />

                <header className="flex flex-wrap justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => { setViewingAccountId(null); setCurrentPage('Accounts'); }} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                    </div>
                </header>
                
                <Card className="p-4 sm:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                        <div className="md:col-span-1">
                            {account.imageUrl ? (
                                <img src={account.imageUrl} alt={`${account.make} ${account.model}`} className="w-full h-auto object-cover rounded-lg aspect-video shadow-md" />
                            ) : (
                                <div className="w-full aspect-video bg-light-fill dark:bg-dark-fill flex items-center justify-center rounded-lg">
                                    <span className="material-symbols-outlined text-6xl text-gray-400">directions_car</span>
                                </div>
                            )}
                        </div>
                        <div className="md:col-span-2">
                            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                                <div className="col-span-2">
                                    <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">{account.year} {account.make}</p>
                                    <h3 className="text-2xl font-bold text-light-text dark:text-dark-text -mt-1">{account.model}</h3>
                                </div>
                                <div>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Current Value</p>
                                    <p className="text-xl font-semibold">{formatCurrency(account.balance, account.currency)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Mileage</p>
                                    <p className="text-xl font-semibold">{currentMileage.toLocaleString()} km</p>
                                </div>
                                <div>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">License Plate</p>
                                    <p className="text-xl font-semibold font-mono">{account.licensePlate || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Ownership</p>
                                    <p className="text-xl font-semibold">{account.ownership || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {account.ownership === 'Leased' && (
                         <Card>
                            <h3 className="text-base font-semibold text-light-text-secondary dark:text-dark-text-secondary">Lease & Mileage</h3>
                            {/* Lease term progress */}
                            {leaseProgress && (
                                <div className="mt-4">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="font-medium">Lease Term</span>
                                        <span>{leaseProgress.elapsedMonths} of {leaseProgress.totalMonths} months</span>
                                    </div>
                                    <div className="w-full bg-light-fill dark:bg-dark-fill rounded-full h-2 shadow-inner">
                                        <div className="bg-primary-500 h-2 rounded-full" style={{ width: `${leaseProgress.progressPercent}%` }}></div>
                                    </div>
                                </div>
                            )}

                            {/* Mileage to date progress */}
                            {mileageToDate && (
                                <div className="mt-4 pt-4 border-t border-black/10 dark:border-white/10">
                                    <div className="flex justify-between items-baseline">
                                        <p className="text-xs font-medium">Mileage To Date</p>
                                        <p className="text-sm font-semibold">{mileageToDate.usagePercent.toFixed(0)}% Used</p>
                                    </div>
                                    <p className="font-semibold">{mileageToDate.actualMileageUsed.toLocaleString()} km / {mileageToDate.toDateAllowance.toLocaleString()} km allowed</p>
                                    <div className="w-full bg-light-fill dark:bg-dark-fill rounded-full h-2 shadow-inner mt-1">
                                        <div className={`${mileageToDate.usageColor} h-2 rounded-full`} style={{ width: `${Math.min(mileageToDate.usagePercent, 100)}%` }}></div>
                                    </div>
                                </div>
                            )}

                            {/* Mileage projection progress */}
                            {mileageProjection ? (
                                <div className="mt-4 pt-4 border-t border-black/10 dark:border-white/10">
                                    <p className="text-xs font-medium">Projected Annual Mileage</p>
                                    <p className="font-semibold">{mileageProjection.projectedAnnual.toLocaleString()} km / {account.annualMileageAllowance!.toLocaleString()} km</p>
                                    <div className="w-full bg-light-fill dark:bg-dark-fill rounded-full h-2 shadow-inner mt-1">
                                        <div className={`${mileageProjection.usageColor} h-2 rounded-full`} style={{ width: `${Math.min(mileageProjection.usagePercent, 100)}%` }}></div>
                                    </div>
                                </div>
                            ) : (
                                account.annualMileageAllowance && (
                                    <div className="mt-4 pt-4 border-t border-black/10 dark:border-white/10 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                        Log more mileage to see annual projection.
                                    </div>
                                )
                            )}
                        </Card>
                    )}
                    <Card>
                        <h3 className="text-base font-semibold text-light-text-secondary dark:text-dark-text-secondary">Specifications</h3>
                        <div className="mt-2 space-y-2 text-sm">
                            <div className="flex justify-between"><span>VIN</span><span className="font-semibold font-mono truncate">{account.vin || 'N/A'}</span></div>
                            <div className="flex justify-between"><span>Fuel Type</span><span className="font-semibold">{account.fuelType || 'N/A'}</span></div>
                        </div>
                    </Card>
                </div>


                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <VehicleMileageChart logs={account.mileageLogs || []} />

                    <Card>
                        <div className="flex justify-between items-center mb-4">
                             <h3 className="text-base font-semibold text-light-text-secondary dark:text-dark-text-secondary">Mileage Log</h3>
                             <button onClick={() => setIsMileageModalOpen(true)} className={`${BTN_SECONDARY_STYLE} !py-1 !px-3 !text-xs`}>Log Mileage</button>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {(account.mileageLogs || []).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(log => (
                                <div key={log.id} className="flex justify-between items-center p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 group">
                                    <div>
                                        <p className="font-semibold text-sm">{new Date(log.date).toLocaleDateString()}</p>
                                        <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm">{log.reading.toLocaleString()} km</p>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEditLogClick(log)} className="p-1"><span className="material-symbols-outlined text-sm">edit</span></button>
                                        <button onClick={() => handleDeleteLogClick(log.id)} className="p-1 text-red-500"><span className="material-symbols-outlined text-sm">delete</span></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        );
    }

    // Default Account Detail View (for Checking, Savings, etc.)
    const { filteredTransactions, income, expenses } = useMemo(() => {
        const { start, end } = getDateRange(duration, transactions);
        const txsInPeriod = transactions.filter(tx => {
            if (tx.accountId !== account.id) return false;
            const txDate = parseDateAsUTC(tx.date);
            return txDate >= start && txDate <= end;
        });

        const income = txsInPeriod.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + convertToEur(tx.amount, tx.currency), 0);
        const expenses = txsInPeriod.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + Math.abs(convertToEur(tx.amount, tx.currency)), 0);

        return { filteredTransactions: txsInPeriod, income, expenses };
    }, [transactions, duration, account.id]);

    const { incomeChange, expenseChange } = useMemo(() => {
        const { start, end } = getDateRange(duration, transactions);
        const diff = end.getTime() - start.getTime();
        if (duration === 'ALL' || diff <= 0) return { incomeChange: null, expenseChange: null };

        const prevStart = new Date(start.getTime() - diff);
        const prevEnd = new Date(start.getTime() - 1);

        const txsInPrevPeriod = transactions.filter(tx => {
            if (tx.accountId !== account.id) return false;
            const txDate = parseDateAsUTC(tx.date);
            return txDate >= prevStart && txDate <= prevEnd;
        });

        const prevIncome = txsInPrevPeriod.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + convertToEur(tx.amount, tx.currency), 0);
        const prevExpenses = txsInPrevPeriod.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + Math.abs(convertToEur(tx.amount, tx.currency)), 0);
        
        const calculateChangeString = (current: number, previous: number) => {
            if (previous === 0) return null;
            const change = ((current - previous) / previous) * 100;
            if (isNaN(change) || !isFinite(change)) return null;
            return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
        };

        return { incomeChange: calculateChangeString(income, prevIncome), expenseChange: calculateChangeString(expenses, prevExpenses) };
    }, [duration, transactions, account.id, income, expenses]);

    const outflowsByCategory: CategorySpending[] = useMemo(() => {
        const spending: { [key: string]: CategorySpending } = {};
        filteredTransactions.forEach(tx => {
            if (tx.type !== 'expense') return;
            const category = findCategoryDetails(tx.category, allCategories);
            let parentCategory = category;
            if (category?.parentId) parentCategory = findCategoryById(category.parentId, allCategories) || category;
            
            const name = parentCategory?.name || 'Uncategorized';
            if (!spending[name]) spending[name] = { name, value: 0, color: parentCategory?.color || '#A0AEC0', icon: parentCategory?.icon };
            spending[name].value += Math.abs(convertToEur(tx.amount, tx.currency));
        });
        return Object.values(spending).sort((a, b) => b.value - a.value);
    }, [filteredTransactions, allCategories]);

    const handleCategoryClick = useCallback((categoryName: string) => {
        const txs = filteredTransactions.filter(tx => {
            const category = findCategoryDetails(tx.category, allCategories);
            let parentCategory = category;
            if (category?.parentId) parentCategory = findCategoryById(category.parentId, allCategories) || category;
            return parentCategory?.name === categoryName && tx.type === 'expense';
        });
        setModalTransactions(txs);
        setModalTitle(`Transactions for ${categoryName}`);
        setDetailModalOpen(true);
    }, [filteredTransactions, allCategories]);

    const balanceHistoryData = useMemo(() => {
        const { start, end } = getDateRange(duration, transactions);
        const transactionsToReverse = transactions.filter(tx => {
            if (tx.accountId !== account.id) return false;
            const txDate = parseDateAsUTC(tx.date);
            return txDate >= start && txDate <= new Date();
        });

        const totalChangeSinceStart = transactionsToReverse.reduce((sum, tx) => sum + tx.amount, 0);
        const startingBalance = account.balance - totalChangeSinceStart;

        const dailyChanges = new Map<string, number>();
        filteredTransactions.forEach(tx => {
            dailyChanges.set(tx.date, (dailyChanges.get(tx.date) || 0) + tx.amount);
        });
        
        const data: { name: string, value: number }[] = [];
        let runningBalance = startingBalance;
        let currentDate = new Date(start);
        while (currentDate <= end) {
            // FIX: This line was causing a "not callable" error.
            // Replaced the local date manipulation with a consistent UTC-based approach to resolve the error and fix timezone bugs.
            const dateStr = currentDate.toISOString().split('T')[0];
            runningBalance += dailyChanges.get(dateStr) || 0;
            data.push({ name: dateStr, value: runningBalance });
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }
        return data;
    }, [duration, transactions, account.id, account.balance, filteredTransactions]);

    const allWidgets: Widget[] = [
        { id: 'balanceHistory', name: 'Balance History', defaultW: 4, defaultH: 2, component: NetWorthChart, props: { data: balanceHistoryData } },
        { id: 'outflowsByCategory', name: 'Outflows by Category', defaultW: 2, defaultH: 2, component: OutflowsChart, props: { data: outflowsByCategory, onCategoryClick: handleCategoryClick } },
        { id: 'recentTransactions', name: 'Recent Transactions', defaultW: 2, defaultH: 2, component: TransactionList, props: { transactions: recentTransactions, allCategories: allCategories, onTransactionClick: handleTransactionClick } },
    ];
    
    const [widgets, setWidgets] = useLocalStorage<WidgetConfig[]>(`account-detail-layout-${account.id}`, allWidgets.map(w => ({ id: w.id, title: w.name, w: w.defaultW, h: w.defaultH })));

    const removeWidget = (widgetId: string) => setWidgets(prev => prev.filter(w => w.id !== widgetId));
    const addWidget = (widgetId: string) => {
        const widgetToAdd = allWidgets.find(w => w.id === widgetId);
        if (widgetToAdd) setWidgets(prev => [...prev, { id: widgetToAdd.id, title: widgetToAdd.name, w: widgetToAdd.defaultW, h: widgetToAdd.defaultH }]);
        setIsAddWidgetModalOpen(false);
    };
    const availableWidgetsToAdd = useMemo(() => allWidgets.filter(w => !widgets.some(current => current.id === w.id)), [widgets, allWidgets]);
    const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);
    const [dragOverWidgetId, setDragOverWidgetId] = useState<string | null>(null);
    const handleDragStart = (e: React.DragEvent, widgetId: string) => { setDraggedWidgetId(widgetId); e.dataTransfer.effectAllowed = 'move'; };
    const handleDragEnter = (e: React.DragEvent, widgetId: string) => { e.preventDefault(); if (widgetId !== draggedWidgetId) setDragOverWidgetId(widgetId); };
    const handleDragLeave = () => setDragOverWidgetId(null);
    const handleDrop = (e: React.DragEvent, targetWidgetId: string) => {
        e.preventDefault();
        if (!draggedWidgetId || draggedWidgetId === targetWidgetId) return;
        setWidgets(prevWidgets => {
            const draggedIndex = prevWidgets.findIndex(w => w.id === draggedWidgetId);
            const targetIndex = prevWidgets.findIndex(w => w.id === targetWidgetId);
            if (draggedIndex === -1 || targetIndex === -1) return prevWidgets;
            const newWidgets = [...prevWidgets];
            const [draggedItem] = newWidgets.splice(draggedIndex, 1);
            newWidgets.splice(targetIndex, 0, draggedItem);
            return newWidgets;
        });
    };
    const handleDragEnd = () => { setDraggedWidgetId(null); setDragOverWidgetId(null); };

    return (
      <div className="space-y-6">
          {isTransactionModalOpen && (
              <AddTransactionModal onClose={handleCloseTransactionModal} onSave={(data, toDelete) => { saveTransaction(data, toDelete); handleCloseTransactionModal(); }} accounts={accounts} incomeCategories={allCategories.filter(c => c.classification === 'income')} expenseCategories={allCategories.filter(c => c.classification === 'expense')} transactionToEdit={editingTransaction} transactions={transactions} tags={tags} initialFromAccountId={account.id} initialToAccountId={account.id}/>
          )}
          <TransactionDetailModal isOpen={isDetailModalOpen} onClose={() => setDetailModalOpen(false)} title={modalTitle} transactions={modalTransactions} accounts={accounts}/>
          <AddWidgetModal isOpen={isAddWidgetModalOpen} onClose={() => setIsAddWidgetModalOpen(false)} availableWidgets={availableWidgetsToAdd} onAddWidget={addWidget} />
          
          <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
              <div className="flex items-center gap-4">
                  <button onClick={() => { setViewingAccountId(null); setCurrentPage('Accounts'); }} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
                      <span className="material-symbols-outlined">arrow_back</span>
                  </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                  <div className="flex-1 sm:flex-none"><DurationFilter selectedDuration={duration} onDurationChange={setDuration} /></div>
                  <div className="flex gap-3 w-full sm:w-auto">
                      {isEditMode ? (
                          <>
                              <button onClick={() => setIsAddWidgetModalOpen(true)} className={`${BTN_SECONDARY_STYLE} flex-1 sm:flex-none flex items-center gap-2 justify-center`}><span className="material-symbols-outlined text-base">add</span><span className="whitespace-nowrap">Add Widget</span></button>
                              <button onClick={() => setIsEditMode(false)} className={`${BTN_PRIMARY_STYLE} flex-1 sm:flex-none justify-center px-6`}>Done</button>
                          </>
                      ) : (
                          <button onClick={() => setIsEditMode(true)} className={`${BTN_SECONDARY_STYLE} flex-1 sm:flex-none flex items-center gap-2 justify-center`}><span className="material-symbols-outlined text-base">edit</span><span className="whitespace-nowrap">Edit Layout</span></button>
                      )}
                      <button onClick={() => handleOpenTransactionModal()} className={`${BTN_PRIMARY_STYLE} flex-1 sm:flex-none justify-center whitespace-nowrap`}>Add Transaction</button>
                  </div>
              </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <CurrentBalanceCard balance={account.balance} currency={account.currency} />
              <BalanceCard title="Income" amount={income} change={incomeChange} changeType="positive" sparklineData={useMemo(() => [], [])} />
              <BalanceCard title="Expenses" amount={expenses} change={expenseChange} changeType="negative" sparklineData={useMemo(() => [], [])} />
              <NetBalanceCard netBalance={income - expenses} totalIncome={income} duration={duration} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6" style={{ gridAutoRows: 'minmax(200px, auto)' }}>
              {widgets.map(widget => {
                  const widgetDetails = allWidgets.find(w => w.id === widget.id);
                  if (!widgetDetails) return null;
                  const WidgetComponent = widgetDetails.component;
                  return (
                      <WidgetWrapper key={widget.id} title={widget.title} w={widget.w} h={widget.h} onRemove={() => removeWidget(widget.id)} onResize={() => {}} isEditMode={isEditMode} isBeingDragged={draggedWidgetId === widget.id} isDragOver={dragOverWidgetId === widget.id} onDragStart={e => handleDragStart(e, widget.id)} onDragEnter={e => handleDragEnter(e, widget.id)} onDragLeave={handleDragLeave} onDrop={e => handleDrop(e, widget.id)} onDragEnd={handleDragEnd}>
                          <WidgetComponent {...widgetDetails.props as any} />
                      </WidgetWrapper>
                  );
              })}
          </div>
      </div>
    );
};

export default AccountDetail;
