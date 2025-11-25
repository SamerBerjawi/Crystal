
import React, { useMemo, useState } from 'react';
import { Account, Transaction, Category, Duration, DisplayTransaction, ScheduledPayment, MileageLog, RecurrenceFrequency } from '../types';
import { formatCurrency, getDateRange, convertToEur, generateAmortizationSchedule, parseDateAsUTC } from '../utils';
import AddTransactionModal from '../components/AddTransactionModal';
import { BTN_PRIMARY_STYLE, ACCOUNT_TYPE_STYLES, BTN_SECONDARY_STYLE } from '../constants';
import TransactionDetailModal from '../components/TransactionDetailModal';
import Card from '../components/Card';
import PaymentPlanTable from '../components/PaymentPlanTable';
import VehicleMileageChart from '../components/VehicleMileageChart';
import MortgageAmortizationChart from '../components/MortgageAmortizationChart';
import AddMileageLogModal from '../components/AddMileageLogModal';
import ConfirmationModal from '../components/ConfirmationModal';
import TransactionList from '../components/TransactionList';
import CurrentBalanceCard from '../components/CurrentBalanceCard';
import { v4 as uuidv4 } from 'uuid';
import { useAccountsContext, useTransactionsContext } from '../contexts/DomainProviders';
import { useCategoryContext, useScheduleContext, useTagsContext } from '../contexts/FinancialDataContext';

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
    
    // Default duration for charts
    const [duration, setDuration] = useState<Duration>('1Y');

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

    // --- Vehicle Logic ---
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
            const years = totalDays / 365;
            totalAllowance = account.annualMileageAllowance * years;

            mileageDiff = currentMileage - expectedMileage;
            projectedMileage = elapsedDays > 0 ? (currentMileage / elapsedDays) * totalDays : 0;
            
            if (mileageDiff > 1000) mileageStatus = 'Over Budget';
            else if (mileageDiff < -1000) mileageStatus = 'Under Budget';
        }
        
        return { start, end, progress, mileageStatus, mileageDiff, daysRemaining: Math.max(0, Math.ceil(totalDays - elapsedDays)), projectedMileage, totalAllowance };
    }, [account, currentMileage]);

    // --- Loan Logic ---
    const loanDetails = useMemo(() => {
        if (account.type !== 'Loan' && account.type !== 'Lending') return null;
        const schedule = generateAmortizationSchedule(account, transactions, loanPaymentOverrides[account.id] || {});
        const totalPaidPrincipal = schedule.reduce((acc, p) => p.status === 'Paid' ? acc + p.principal : acc, 0);
        const totalPaidInterest = schedule.reduce((acc, p) => p.status === 'Paid' ? acc + p.interest : acc, 0);
        const linkedProperty = accounts.find(a => a.type === 'Property' && a.linkedLoanId === account.id);
        let ltv = 0;
        let equity = 0;
        let marketEquity = 0;
        if (linkedProperty) {
            const propertyValue = linkedProperty.balance;
            const loanBalance = Math.abs(account.balance);
            if (propertyValue > 0) ltv = (loanBalance / propertyValue) * 100;
            marketEquity = propertyValue - loanBalance;
        }
        equity = totalPaidPrincipal + (account.downPayment || 0);
        const lastPayment = schedule[schedule.length - 1];
        const payoffDate = lastPayment ? parseDateAsUTC(lastPayment.date) : null;
        return { schedule, totalPaidPrincipal, totalPaidInterest, linkedProperty, ltv, equity, marketEquity, payoffDate };
    }, [account, transactions, loanPaymentOverrides, accounts]);

    // --- Property View ---
    if (account.type === 'Property') {
        const linkedLoan = accounts.find(a => a.id === account.linkedLoanId);
        const principalOwned = linkedLoan ? (transactions.filter(tx => tx.accountId === linkedLoan.id && tx.type === 'income').reduce((sum, tx) => sum + (tx.principalAmount || 0), 0) + (linkedLoan.downPayment || 0)) : (account.principalOwned || 0);
        const purchasePrice = linkedLoan ? ((linkedLoan.principalAmount || 0) + (linkedLoan.downPayment || 0)) : (account.purchasePrice || 0);
        
        const features = [
            account.hasBasement ? { label: 'Basement', icon: 'foundation' } : null,
            account.hasAttic ? { label: 'Attic', icon: 'roofing' } : null,
            account.hasGarden ? { label: `Garden ${account.gardenSize ? `(${account.gardenSize} m²)` : ''}`, icon: 'yard' } : null,
            account.hasTerrace ? { label: `Terrace ${account.terraceSize ? `(${account.terraceSize} m²)` : ''}`, icon: 'deck' } : null,
            account.indoorParkingSpaces ? { label: `Indoor Parking (${account.indoorParkingSpaces})`, icon: 'garage' } : null,
            account.outdoorParkingSpaces ? { label: `Outdoor Parking (${account.outdoorParkingSpaces})`, icon: 'local_parking' } : null,
        ].filter(Boolean) as { label: string; icon: string }[];

        const equity = principalOwned;
        const marketEquity = linkedLoan ? account.balance - Math.abs(linkedLoan.balance) : account.balance;
        const appreciation = account.balance - (purchasePrice || 0);
        const appreciationPercent = purchasePrice ? (appreciation / purchasePrice) * 100 : 0;

        return (
            <div className="space-y-6">
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
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4 w-full">
                        <button onClick={() => { setViewingAccountId(null); setCurrentPage('Accounts'); }} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0"><span className="material-symbols-outlined">arrow_back</span></button>
                        <div className="flex items-center gap-4 w-full">
                            <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${ACCOUNT_TYPE_STYLES[account.type]?.color || 'bg-gray-200 text-gray-600'} bg-opacity-10 border border-current`}>
                                <span className="material-symbols-outlined text-4xl">{account.icon || 'home'}</span>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">{account.name}</h1>
                                <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                    <span>{account.propertyType || 'Property'}</span>
                                    {account.address && <><span>•</span><span className="truncate max-w-[200px]" title={account.address}>{account.address}</span></>}
                                </div>
                            </div>
                            <div className="ml-auto"><button onClick={() => handleOpenTransactionModal()} className={BTN_PRIMARY_STYLE}>Add Transaction</button></div>
                        </div>
                    </div>
                </header>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card><p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Current Value</p><p className="text-2xl font-bold text-light-text dark:text-dark-text">{formatCurrency(account.balance, account.currency)}</p></Card>
                    <Card><p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Market Equity</p><p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(marketEquity, account.currency)}</p><p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Value - Debt</p></Card>
                    <Card><p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Invested Equity</p><p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(equity, account.currency)}</p><p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Principal + Down Payment</p></Card>
                    <Card><p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Appreciation</p><div className="flex items-baseline gap-2"><p className={`text-2xl font-bold ${appreciation >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{appreciation >= 0 ? '+' : ''}{formatCurrency(appreciation, account.currency)}</p><p className={`text-sm font-semibold ${appreciation >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>({appreciationPercent >= 0 ? '+' : ''}{appreciationPercent.toFixed(1)}%)</p></div></Card>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2">
                        <h3 className="text-base font-semibold text-light-text dark:text-dark-text mb-4">Property Details</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                            <div><p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">Size</p><p className="font-semibold text-lg">{account.propertySize ? `${account.propertySize} m²` : 'N/A'}</p></div>
                            <div><p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">Year Built</p><p className="font-semibold text-lg">{account.yearBuilt || 'N/A'}</p></div>
                            <div><p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">Floors</p><p className="font-semibold text-lg">{account.floors || 'N/A'}</p></div>
                            <div><p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">Bedrooms</p><p className="font-semibold text-lg">{account.bedrooms || 'N/A'}</p></div>
                            <div><p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">Bathrooms</p><p className="font-semibold text-lg">{account.bathrooms || 'N/A'}</p></div>
                            <div><p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">Linked Loan</p>{linkedLoan ? (<button onClick={() => setViewingAccountId(linkedLoan.id)} className="font-semibold text-lg text-primary-500 hover:underline truncate max-w-full block text-left">{linkedLoan.name}</button>) : (<p className="font-semibold text-lg text-gray-400">None</p>)}</div>
                        </div>
                    </Card>
                    <div className="space-y-6">
                        <Card>
                            <h3 className="text-base font-semibold text-light-text dark:text-dark-text mb-4">Features & Amenities</h3>
                            {features.length > 0 ? (
                                <div className="flex flex-wrap gap-3">
                                    {features.map((feature, idx) => (
                                        <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-light-fill dark:bg-dark-fill border border-black/5 dark:border-white/10">
                                            <span className="material-symbols-outlined text-primary-500">{feature.icon}</span>
                                            <span className="text-sm font-medium text-light-text dark:text-dark-text">{feature.label}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm">No features listed.</p>
                            )}
                        </Card>
                        <Card>
                            <h3 className="text-base font-semibold text-light-text dark:text-dark-text mb-4">Recurring Costs & Income</h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">Property Tax</span><span className="font-medium">{account.propertyTaxAmount ? formatCurrency(account.propertyTaxAmount, account.currency) : 'N/A'}</span></div>
                                <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">Insurance</span><span className="font-medium">{account.insuranceAmount ? formatCurrency(account.insuranceAmount, account.currency) : 'N/A'}</span></div>
                                <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">HOA Fees</span><span className="font-medium">{account.hoaFeeAmount ? formatCurrency(account.hoaFeeAmount, account.currency) : 'N/A'}</span></div>
                                {account.isRental && (
                                    <div className="flex justify-between border-t border-black/5 dark:border-white/5 pt-2 mt-1">
                                        <span className="text-light-text-secondary dark:text-dark-text-secondary">Rental Income</span>
                                        <span className="font-medium text-green-500">+{account.rentalIncomeAmount ? formatCurrency(account.rentalIncomeAmount, account.currency) : '0'}</span>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        );
    }

    // --- Loan / Lending View ---
    if ((account.type === 'Loan' || account.type === 'Lending') && loanDetails) {
        const isLending = account.type === 'Lending';
        return (
            <div className="space-y-6">
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
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                     <div className="flex items-center gap-4 w-full">
                        <button onClick={() => { setViewingAccountId(null); setCurrentPage('Accounts'); }} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0"><span className="material-symbols-outlined">arrow_back</span></button>
                        <div className="flex items-center gap-4 w-full">
                             <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${isLending ? 'text-teal-500 bg-teal-500/10 border-teal-500/20' : 'text-red-500 bg-red-500/10 border-red-500/20'} border`}>
                                <span className="material-symbols-outlined text-4xl">{isLending ? 'real_estate_agent' : 'request_quote'}</span>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">{account.name}</h1>
                                <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                    <span>{isLending ? 'Lending' : 'Loan'}</span>
                                    {account.interestRate && <><span>•</span><span>{account.interestRate}% Interest</span></>}
                                </div>
                            </div>
                            <div className="ml-auto"><button onClick={() => handleOpenTransactionModal()} className={BTN_PRIMARY_STYLE}>Add Transaction</button></div>
                        </div>
                     </div>
                </header>
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                         <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                             <Card>
                                <p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">{isLending ? 'Outstanding Principal' : 'Outstanding Balance'}</p>
                                <p className={`text-2xl font-bold ${isLending ? 'text-teal-600 dark:text-teal-400' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(Math.abs(account.balance), account.currency)}</p>
                            </Card>
                             <Card>
                                <p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">{isLending ? 'Principal Received' : 'Principal Paid'}</p>
                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(loanDetails.totalPaidPrincipal, account.currency)}</p>
                            </Card>
                             <Card>
                                <p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">{isLending ? 'Interest Earned' : 'Interest Paid'}</p>
                                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(loanDetails.totalPaidInterest, account.currency)}</p>
                            </Card>
                         </div>
                         <MortgageAmortizationChart schedule={loanDetails.schedule} currency={account.currency} accountType={account.type} />
                         <PaymentPlanTable account={account} transactions={transactions} onMakePayment={handleMakePayment} overrides={loanPaymentOverrides[account.id] || {}} onOverridesChange={handleOverridesChange} />
                    </div>
                    <div className="space-y-6">
                         <Card>
                             <h3 className="text-base font-semibold text-light-text dark:text-dark-text mb-4">Loan Details</h3>
                             <div className="space-y-3 text-sm">
                                 <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">Total Amount</span><span className="font-medium">{formatCurrency(account.totalAmount || 0, account.currency)}</span></div>
                                 <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">Start Date</span><span className="font-medium">{account.loanStartDate ? parseDateAsUTC(account.loanStartDate).toLocaleDateString() : 'N/A'}</span></div>
                                 <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">Term</span><span className="font-medium">{account.duration} months</span></div>
                                 <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">Payoff Date</span><span className="font-medium">{loanDetails.payoffDate ? loanDetails.payoffDate.toLocaleDateString() : 'N/A'}</span></div>
                                 {account.linkedAccountId && <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">Linked Account</span><span className="font-medium text-right truncate max-w-[150px]">{accounts.find(a=>a.id===account.linkedAccountId)?.name}</span></div>}
                             </div>
                         </Card>
                         {!isLending && (
                             <Card>
                                <h3 className="text-base font-semibold text-light-text dark:text-dark-text mb-4">Equity & LTV</h3>
                                <div className="space-y-3 text-sm">
                                    {loanDetails.linkedProperty && (
                                        <div className="flex justify-between items-center pb-2 border-b border-black/5 dark:border-white/5">
                                            <span className="text-light-text-secondary dark:text-dark-text-secondary">Property</span>
                                            <button onClick={() => setViewingAccountId(loanDetails.linkedProperty!.id)} className="text-primary-500 hover:underline font-medium truncate max-w-[150px]">{loanDetails.linkedProperty.name}</button>
                                        </div>
                                    )}
                                    <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">LTV Ratio</span><span className={`font-bold ${loanDetails.ltv > 80 ? 'text-red-500' : 'text-green-500'}`}>{loanDetails.ltv.toFixed(1)}%</span></div>
                                    <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">Down Payment</span><span className="font-medium">{formatCurrency(account.downPayment || 0, account.currency)}</span></div>
                                    <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">Principal Paid</span><span className="font-medium">{formatCurrency(loanDetails.totalPaidPrincipal, account.currency)}</span></div>
                                    <div className="flex justify-between border-t border-black/5 dark:border-white/5 pt-2"><span className="text-light-text-secondary dark:text-dark-text-secondary font-semibold">Invested Equity</span><span className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(loanDetails.equity, account.currency)}</span></div>
                                    <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary font-semibold">Market Equity</span><span className="font-bold text-green-600 dark:text-green-400">{formatCurrency(loanDetails.marketEquity, account.currency)}</span></div>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary italic mt-2">
                                        Invested Equity = Down Payment + Principal Paid. <br/>
                                        Market Equity = Current Property Value - Outstanding Loan.
                                    </p>
                                </div>
                             </Card>
                         )}
                    </div>
                 </div>
            </div>
        );
    }

    // --- Vehicle View ---
    if (account.type === 'Vehicle') {
        const isLeased = account.ownership === 'Leased';
        return (
            <div className="space-y-6">
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

                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4 w-full">
                        <button onClick={() => { setViewingAccountId(null); setCurrentPage('Accounts'); }} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0"><span className="material-symbols-outlined">arrow_back</span></button>
                        <div className="flex items-center gap-4 w-full">
                            {account.imageUrl ? (
                                <img src={account.imageUrl} alt="Vehicle" className="w-16 h-16 rounded-xl object-cover border border-black/10 dark:border-white/10" />
                            ) : (
                                <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${ACCOUNT_TYPE_STYLES['Vehicle'].color} bg-opacity-10 border border-current`}>
                                    <span className="material-symbols-outlined text-4xl">directions_car</span>
                                </div>
                            )}
                            <div>
                                <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">{account.name}</h1>
                                <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                    <span>{account.year} {account.make} {account.model}</span>
                                    {account.licensePlate && <><span>•</span><span className="font-mono bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs">{account.licensePlate}</span></>}
                                </div>
                            </div>
                            <div className="ml-auto"><button onClick={() => handleOpenTransactionModal()} className={BTN_PRIMARY_STYLE}>Add Transaction</button></div>
                        </div>
                    </div>
                </header>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                     <div className="lg:col-span-2 space-y-6">
                         {isLeased && leaseStats ? (
                             <Card>
                                 <h3 className="text-base font-semibold text-light-text dark:text-dark-text mb-4">Lease Status</h3>
                                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
                                     <div><p className="text-xs uppercase text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Days Remaining</p><p className="text-2xl font-bold">{leaseStats.daysRemaining}</p></div>
                                     <div><p className="text-xs uppercase text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Mileage Balance</p><p className={`text-2xl font-bold ${leaseStats.mileageDiff > 0 ? 'text-red-500' : 'text-green-500'}`}>{leaseStats.mileageDiff > 0 ? '+' : ''}{Math.round(leaseStats.mileageDiff).toLocaleString()} km</p></div>
                                     <div><p className="text-xs uppercase text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Projected End</p><p className="text-2xl font-bold">{Math.round(leaseStats.projectedMileage).toLocaleString()} km</p></div>
                                 </div>
                                 
                                 <div className="space-y-4">
                                     <div>
                                         <div className="flex justify-between text-sm mb-1"><span>Time Elapsed</span><span>{Math.round(leaseStats.progress)}%</span></div>
                                         <div className="w-full bg-light-fill dark:bg-dark-fill rounded-full h-2"><div className="bg-primary-500 h-2 rounded-full" style={{ width: `${leaseStats.progress}%` }}></div></div>
                                     </div>
                                     {account.annualMileageAllowance && (
                                         <div>
                                             <div className="flex justify-between text-sm mb-1">
                                                <span>Mileage Usage ({currentMileage.toLocaleString()} / {leaseStats.totalAllowance.toLocaleString()})</span>
                                                <span className={leaseStats.mileageStatus === 'Over Budget' ? 'text-red-500 font-bold' : 'text-green-500'}>{leaseStats.mileageStatus}</span>
                                             </div>
                                              <div className="w-full bg-light-fill dark:bg-dark-fill rounded-full h-2 relative">
                                                 {/* Expected mileage marker */}
                                                 <div className="absolute top-0 bottom-0 w-0.5 bg-black dark:bg-white z-10" style={{ left: `${Math.min((leaseStats.progress), 100)}%` }} title="Expected Usage"></div>
                                                 <div className={`h-2 rounded-full ${leaseStats.mileageStatus === 'Over Budget' ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min((currentMileage / leaseStats.totalAllowance) * 100, 100)}%` }}></div>
                                              </div>
                                         </div>
                                     )}
                                 </div>
                             </Card>
                         ) : (
                             <Card>
                                 <h3 className="text-base font-semibold text-light-text dark:text-dark-text mb-4">Overview</h3>
                                 <div className="grid grid-cols-2 gap-6">
                                     <div><p className="text-xs uppercase text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Current Value</p><p className="text-2xl font-bold">{formatCurrency(account.balance, account.currency)}</p></div>
                                     <div><p className="text-xs uppercase text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Odometer</p><p className="text-2xl font-bold">{currentMileage.toLocaleString()} km</p></div>
                                 </div>
                             </Card>
                         )}
                         <VehicleMileageChart logs={account.mileageLogs || []} />
                     </div>
                     <div className="space-y-6">
                        <Card className="h-full flex flex-col">
                             <div className="flex justify-between items-center mb-4">
                                 <h3 className="text-base font-semibold text-light-text dark:text-dark-text">Log History</h3>
                                 <button onClick={() => handleOpenMileageModal()} className={`${BTN_SECONDARY_STYLE} !py-1 !px-2 text-xs`}>Add Log</button>
                             </div>
                             <div className="flex-grow overflow-y-auto max-h-[400px]">
                                 {account.mileageLogs && account.mileageLogs.length > 0 ? (
                                     <table className="w-full text-sm">
                                         <thead>
                                             <tr className="border-b border-black/5 dark:border-white/5 text-light-text-secondary dark:text-dark-text-secondary">
                                                 <th className="text-left py-2 font-medium">Date</th>
                                                 <th className="text-right py-2 font-medium">Mileage</th>
                                                 <th className="text-right py-2 font-medium w-16"></th>
                                             </tr>
                                         </thead>
                                         <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                             {[...account.mileageLogs].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(log => (
                                                 <tr key={log.id} className="group hover:bg-black/5 dark:hover:bg-white/5">
                                                     <td className="py-2">{parseDateAsUTC(log.date).toLocaleDateString()}</td>
                                                     <td className="py-2 text-right font-mono">{log.reading.toLocaleString()}</td>
                                                     <td className="py-2 text-right">
                                                         <div className="opacity-0 group-hover:opacity-100 flex justify-end gap-1">
                                                             <button onClick={() => handleOpenMileageModal(log)} className="p-1 text-light-text-secondary hover:text-primary-500"><span className="material-symbols-outlined text-sm">edit</span></button>
                                                             <button onClick={() => handleDeleteMileageLog(log.id)} className="p-1 text-light-text-secondary hover:text-red-500"><span className="material-symbols-outlined text-sm">delete</span></button>
                                                         </div>
                                                     </td>
                                                 </tr>
                                             ))}
                                         </tbody>
                                     </table>
                                 ) : (
                                     <p className="text-center text-light-text-secondary text-sm py-8">No mileage logs recorded.</p>
                                 )}
                             </div>
                        </Card>
                     </div>
                </div>
            </div>
        );
    }

    // --- Default View for other accounts ---
    return (
        <div className="space-y-6">
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
            <TransactionDetailModal isOpen={isDetailModalOpen} onClose={() => setDetailModalOpen(false)} title={modalTitle} transactions={modalTransactions} accounts={accounts} />
            
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4 w-full">
                    <button onClick={() => { setViewingAccountId(null); setCurrentPage('Accounts'); }} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0"><span className="material-symbols-outlined">arrow_back</span></button>
                    <div className="flex items-center gap-4 w-full">
                        <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${ACCOUNT_TYPE_STYLES[account.type]?.color || 'bg-gray-200 text-gray-600'} bg-opacity-10 border border-current`}>
                            <span className="material-symbols-outlined text-4xl">{account.icon || 'wallet'}</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">{account.name}</h1>
                            <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                <span>{account.type}</span>
                                {account.last4 && <><span>•</span><span className="font-mono">**** {account.last4}</span></>}
                            </div>
                        </div>
                        <div className="ml-auto"><button onClick={() => handleOpenTransactionModal()} className={BTN_PRIMARY_STYLE}>Add Transaction</button></div>
                    </div>
                </div>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <CurrentBalanceCard balance={account.balance} currency={account.currency} />
                 <Card className="flex flex-col justify-between">
                    <div><p className="text-sm text-light-text-secondary dark:text-dark-text-secondary font-medium">Total Income</p><p className="text-2xl font-bold text-green-500 mt-1">{formatCurrency(convertToEur(12345, account.currency), 'EUR')}</p></div>
                    <p className="text-xs text-right mt-2 text-light-text-secondary">Last 12 months</p>
                 </Card>
                 <Card className="flex flex-col justify-between">
                    <div><p className="text-sm text-light-text-secondary dark:text-dark-text-secondary font-medium">Total Expenses</p><p className="text-2xl font-bold text-red-500 mt-1">{formatCurrency(convertToEur(5432, account.currency), 'EUR')}</p></div>
                    <p className="text-xs text-right mt-2 text-light-text-secondary">Last 12 months</p>
                 </Card>
            </div>

            <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-light-text dark:text-dark-text">Transaction History</h3>
                </div>
                 <Card className="p-0 overflow-hidden">
                    <TransactionList transactions={displayTransactionsList} allCategories={allCategories} onTransactionClick={handleTransactionClick} />
                </Card>
            </div>
        </div>
    );
};

export default AccountDetail;
