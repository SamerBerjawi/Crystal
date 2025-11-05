import React, { useState, useMemo } from 'react';
import { RecurringTransaction, Account, Category, BillPayment, Currency, AccountType } from '../types';
import Card from '../components/Card';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, LIQUID_ACCOUNT_TYPES, ACCOUNT_TYPE_STYLES } from '../constants';
import { formatCurrency, convertToEur, generateSyntheticLoanPayments } from '../utils';
import RecurringTransactionModal from '../components/RecurringTransactionModal';
import Modal from '../components/Modal';
import ScheduleHeatmap from '../components/ScheduleHeatmap';

// --- Types for this merged page ---
export type ScheduledItem = {
    id: string;
    isRecurring: boolean;
    date: string;
    description: string;
    amount: number;
    accountName: string;
    isTransfer?: boolean;
    type: 'income' | 'expense' | 'transfer' | 'payment' | 'deposit';
    originalItem: RecurringTransaction | BillPayment;
};

// --- Modals (moved from PaymentPlan) ---
const BillPaymentModal: React.FC<{
    bill: Omit<BillPayment, 'id'> & { id?: string } | null;
    onSave: (data: Omit<BillPayment, 'id'> & { id?: string }) => void;
    onClose: () => void;
    accounts: Account[];
}> = ({ bill, onSave, onClose, accounts }) => {
    const isEditing = !!bill?.id;
    const [description, setDescription] = useState(bill?.description || '');
    const [amount, setAmount] = useState(bill ? String(Math.abs(bill.amount)) : '');
    const [type, setType] = useState<'payment' | 'deposit'>(bill?.type || 'payment');
    const [dueDate, setDueDate] = useState(bill?.dueDate || new Date().toISOString().split('T')[0]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            id: bill?.id,
            description,
            amount: type === 'payment' ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount)),
            type,
            currency: 'EUR',
            dueDate,
            status: bill?.status || 'unpaid',
        });
        onClose();
    };

    const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";
    return (
        <Modal onClose={onClose} title={isEditing ? 'Edit Bill/Payment' : 'Add Bill/Payment'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex bg-light-bg dark:bg-dark-bg p-1 rounded-lg">
                    <button type="button" onClick={() => setType('payment')} className={`w-full py-2 rounded text-sm font-semibold ${type === 'payment' ? 'bg-red-500 text-white' : ''}`}>Payment (Out)</button>
                    <button type="button" onClick={() => setType('deposit')} className={`w-full py-2 rounded text-sm font-semibold ${type === 'deposit' ? 'bg-green-500 text-white' : ''}`}>Deposit (In)</button>
                </div>
                <div><label htmlFor="desc" className={labelStyle}>Description</label><input id="desc" type="text" value={description} onChange={e => setDescription(e.target.value)} className={INPUT_BASE_STYLE} required /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label htmlFor="amount" className={labelStyle}>Amount (€)</label><input id="amount" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className={INPUT_BASE_STYLE} required /></div>
                    <div><label htmlFor="dueDate" className={labelStyle}>Due Date</label><input id="dueDate" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={INPUT_BASE_STYLE} required /></div>
                </div>
                <div className="flex justify-end gap-4 pt-4"><button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button><button type="submit" className={BTN_PRIMARY_STYLE}>{isEditing ? 'Save Changes' : 'Add Item'}</button></div>
            </form>
        </Modal>
    );
};

// --- Helper to parse date string as UTC midnight to avoid timezone issues
const parseAsUTC = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
};

// --- Item Row Component ---
const ScheduledItemRow: React.FC<{
    item: ScheduledItem;
    accounts: Account[];
    onEdit: (item: RecurringTransaction | BillPayment) => void;
    onDelete: (id: string, isRecurring: boolean) => void;
    onMarkAsPaid: (billId: string, paymentAccountId: string, paymentDate: string) => void;
    isReadOnly?: boolean;
}> = ({ item, accounts, onEdit, onDelete, onMarkAsPaid, isReadOnly = false }) => {
    
    const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
    const originalBill = !item.isRecurring ? item.originalItem as BillPayment : null;
    const [paymentAccountId, setPaymentAccountId] = useState(originalBill?.accountId || accounts.find(a => LIQUID_ACCOUNT_TYPES.includes(a.type))?.id || '');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

    const isIncome = item.type === 'income' || item.type === 'deposit';
    const isOverdue = !item.isRecurring && item.date < new Date().toISOString().split('T')[0];

    const handleConfirmPayment = () => {
        if (!paymentAccountId) { alert('Please select an account.'); return; }
        if (originalBill) onMarkAsPaid(originalBill.id, paymentAccountId, paymentDate);
        setIsConfirmingPayment(false);
    };

    const dueDate = parseAsUTC(item.date);
    const day = dueDate.getUTCDate();
    const month = dueDate.toLocaleString('default', { month: 'short', timeZone: 'UTC' }).toUpperCase();
    
    return (
      <div className="flex items-center justify-between p-4 group">
        {isConfirmingPayment && originalBill && (
          <Modal onClose={() => setIsConfirmingPayment(false)} title={`Confirm ${isIncome ? 'Deposit' : 'Payment'}`}>
            <div className="space-y-4">
              <p>Mark "<strong>{originalBill.description}</strong>" for <strong>{formatCurrency(originalBill.amount, originalBill.currency)}</strong> as paid.</p>
              <div><label className="block text-sm font-medium mb-1">Account</label><div className={SELECT_WRAPPER_STYLE}><select value={paymentAccountId} onChange={e => setPaymentAccountId(e.target.value)} className={INPUT_BASE_STYLE} required><option value="" disabled>Select an account</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select><div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div></div></div>
              <div><label className="block text-sm font-medium mb-1">Payment Date</label><input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className={INPUT_BASE_STYLE} /></div>
              <div className="flex justify-end gap-4 pt-4"><button type="button" onClick={() => setIsConfirmingPayment(false)} className={BTN_SECONDARY_STYLE}>Cancel</button><button type="button" onClick={handleConfirmPayment} className={BTN_PRIMARY_STYLE}>Confirm</button></div>
            </div>
          </Modal>
        )}
        <div className="flex items-center gap-4">
          <div className={`flex-shrink-0 text-center rounded-lg p-2 w-16 ${isOverdue ? 'bg-red-100 dark:bg-red-900/40' : 'bg-light-bg dark:bg-dark-bg'}`}>
            <p className={`text-xs font-semibold ${isOverdue ? 'text-red-500' : 'text-primary-500'}`}>{month}</p>
            <p className={`text-2xl font-bold ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-light-text dark:text-dark-text'}`}>{day}</p>
          </div>
          <div>
            <p className="font-semibold text-lg text-light-text dark:text-dark-text">{item.description}</p>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{item.accountName} &bull; {item.isRecurring ? (item.originalItem as RecurringTransaction).frequency : 'One-time'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <p className={`font-semibold text-base ${isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatCurrency(item.amount, 'EUR')}
          </p>
          <div className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ${isReadOnly ? '!opacity-0' : ''}`}>
            {!item.isRecurring && <button onClick={() => setIsConfirmingPayment(true)} className={`${BTN_PRIMARY_STYLE} !py-1 !px-2 text-xs`} title="Mark as Paid"><span className="material-symbols-outlined text-sm">check</span></button>}
            <button onClick={() => onEdit(item.originalItem)} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5" title="Edit"><span className="material-symbols-outlined text-base">edit</span></button>
            <button onClick={() => onDelete(item.originalItem.id, item.isRecurring)} className="text-red-500/80 p-2 rounded-full hover:bg-red-500/10" title="Delete"><span className="material-symbols-outlined text-base">delete</span></button>
          </div>
        </div>
      </div>
    );
};

// --- Main Page Component ---

interface ScheduleProps {
    recurringTransactions: RecurringTransaction[];
    saveRecurringTransaction: (recurringData: Omit<RecurringTransaction, 'id'> & { id?: string }) => void;
    deleteRecurringTransaction: (id: string) => void;
    billsAndPayments: BillPayment[];
    saveBillPayment: (data: Omit<BillPayment, 'id'> & { id?: string }) => void;
    deleteBillPayment: (id: string) => void;
    markBillAsPaid: (billId: string, paymentAccountId: string, paymentDate: string) => void;
    accounts: Account[];
    incomeCategories: Category[];
    expenseCategories: Category[];
}

const Schedule: React.FC<ScheduleProps> = (props) => {
    const { recurringTransactions, saveRecurringTransaction, deleteRecurringTransaction, billsAndPayments, saveBillPayment, deleteBillPayment, markBillAsPaid, accounts, incomeCategories, expenseCategories } = props;

    const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
    const [isBillModalOpen, setIsBillModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<RecurringTransaction | null>(null);
    const [editingBill, setEditingBill] = useState<BillPayment | null>(null);

    const accountMap = React.useMemo(() => accounts.reduce((acc, current) => {
        acc[current.id] = current.name;
        return acc;
    }, {} as Record<string, string>), [accounts]);
    
    const { upcomingItems, paidItems, accountSummaries, globalSummary } = useMemo(() => {
        const today = new Date();
        const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
        const dateIn30Days = new Date(todayUTC); dateIn30Days.setUTCDate(todayUTC.getUTCDate() + 30);
        const forecastEndDate = new Date(todayUTC); forecastEndDate.setFullYear(today.getFullYear() + 2);

        const allUpcomingItems: ScheduledItem[] = [];

        const syntheticLoanPayments = generateSyntheticLoanPayments(accounts);
        const allRecurringTransactions = [...recurringTransactions, ...syntheticLoanPayments];

        allRecurringTransactions.forEach(rt => {
            let nextDate = parseAsUTC(rt.nextDueDate);
            const endDateUTC = rt.endDate ? parseAsUTC(rt.endDate) : null;
            const startDateUTC = parseAsUTC(rt.startDate);

            // Fast-forward to today if nextDueDate is in the past
            while (nextDate < todayUTC && (!endDateUTC || nextDate < endDateUTC)) {
                const interval = rt.frequencyInterval || 1;
                switch (rt.frequency) {
                    case 'daily': nextDate.setUTCDate(nextDate.getUTCDate() + interval); break;
                    case 'weekly': nextDate.setUTCDate(nextDate.getUTCDate() + 7 * interval); break;
                    case 'monthly': {
                        const d = rt.dueDateOfMonth || startDateUTC.getUTCDate();
                        nextDate.setUTCMonth(nextDate.getUTCMonth() + interval, 1);
                        const lastDayOfNextMonth = new Date(Date.UTC(nextDate.getUTCFullYear(), nextDate.getUTCMonth() + 1, 0)).getUTCDate();
                        nextDate.setUTCDate(Math.min(d, lastDayOfNextMonth));
                        break;
                    }
                    case 'yearly': {
                        const d = rt.dueDateOfMonth || startDateUTC.getUTCDate();
                        const m = startDateUTC.getUTCMonth();
                        nextDate.setUTCFullYear(nextDate.getUTCFullYear() + interval);
                        const lastDayOfNextMonth = new Date(Date.UTC(nextDate.getUTCFullYear(), m + 1, 0)).getUTCDate();
                        nextDate.setUTCMonth(m, Math.min(d, lastDayOfNextMonth));
                        break;
                    }
                }
            }
            
            // Generate all future occurrences up to the forecast end date
            while (nextDate <= forecastEndDate && (!endDateUTC || nextDate <= endDateUTC)) {
                allUpcomingItems.push({
                    id: `${rt.id}-${nextDate.toISOString()}`,
                    isRecurring: true, 
                    date: nextDate.toISOString().split('T')[0], 
                    description: rt.description,
                    amount: rt.type === 'expense' ? -rt.amount : rt.amount,
                    accountName: rt.type === 'transfer' ? `${accountMap[rt.accountId]} → ${accountMap[rt.toAccountId!]}` : accountMap[rt.accountId],
                    type: rt.type, 
                    originalItem: rt, 
                    isTransfer: rt.type === 'transfer'
                });
                
                const interval = rt.frequencyInterval || 1;
                 switch (rt.frequency) {
                    case 'daily': nextDate.setUTCDate(nextDate.getUTCDate() + interval); break;
                    case 'weekly': nextDate.setUTCDate(nextDate.getUTCDate() + 7 * interval); break;
                    case 'monthly': {
                        const d = rt.dueDateOfMonth || startDateUTC.getUTCDate();
                        nextDate.setUTCMonth(nextDate.getUTCMonth() + interval, 1);
                        const lastDayOfNextMonth = new Date(Date.UTC(nextDate.getUTCFullYear(), nextDate.getUTCMonth() + 1, 0)).getUTCDate();
                        nextDate.setUTCDate(Math.min(d, lastDayOfNextMonth));
                        break;
                    }
                    case 'yearly': {
                        const d = rt.dueDateOfMonth || startDateUTC.getUTCDate();
                        const m = startDateUTC.getUTCMonth();
                        nextDate.setUTCFullYear(nextDate.getUTCFullYear() + interval);
                        const lastDayOfNextMonth = new Date(Date.UTC(nextDate.getUTCFullYear(), m + 1, 0)).getUTCDate();
                        nextDate.setUTCMonth(m, Math.min(d, lastDayOfNextMonth));
                        break;
                    }
                }
            }
        });
        
        billsAndPayments.filter(b => b.status === 'unpaid').forEach(b => {
             allUpcomingItems.push({
                id: b.id,
                isRecurring: false,
                date: b.dueDate,
                description: b.description,
                amount: b.amount,
                accountName: 'External', // Bills are to/from external entities
                type: b.type,
                originalItem: b
            });
        });

        // Sort all upcoming items by date
        allUpcomingItems.sort((a, b) => parseAsUTC(a.date).getTime() - parseAsUTC(b.date).getTime());

        // Now, calculate the 30-day forecast
        const forecastItems = allUpcomingItems.filter(item => {
            const itemDate = parseAsUTC(item.date);
            return itemDate >= todayUTC && itemDate <= dateIn30Days;
        });

        const accountSummaries: Record<string, { income: number; expense: number; net: number; currency: Currency }> = {};
        let globalIncome = 0;
        let globalExpense = 0;

        const initializeSummary = (accountId: string) => {
            if (!accountSummaries[accountId]) {
                const account = accounts.find(a => a.id === accountId);
                accountSummaries[accountId] = { income: 0, expense: 0, net: 0, currency: account?.currency || 'EUR' };
            }
        };

        // FIX: Replaced the faulty `forEach` loop with one that uses `item.isRecurring` as a type guard to correctly handle the union type of `originalItem`.
        forecastItems.forEach(item => {
            const originalItem = item.originalItem;
            const amountInEur = convertToEur(Math.abs(item.amount), (originalItem as RecurringTransaction | BillPayment).currency);
        
            if (item.isRecurring) { // It's a RecurringTransaction
                const rt = originalItem as RecurringTransaction;
                if (rt.type === 'transfer' && rt.toAccountId) {
                    // Expense from the 'from' account
                    initializeSummary(rt.accountId);
                    accountSummaries[rt.accountId].expense += amountInEur;
                    accountSummaries[rt.accountId].net -= amountInEur;
        
                    // Income to the 'to' account
                    initializeSummary(rt.toAccountId);
                    accountSummaries[rt.toAccountId].income += amountInEur;
                    accountSummaries[rt.toAccountId].net += amountInEur;
                } else { // non-transfer recurring transaction
                    initializeSummary(rt.accountId);
                    if (item.amount > 0) {
                        accountSummaries[rt.accountId].income += amountInEur;
                        accountSummaries[rt.accountId].net += amountInEur;
                        globalIncome += amountInEur;
                    } else {
                        accountSummaries[rt.accountId].expense += amountInEur;
                        accountSummaries[rt.accountId].net -= amountInEur;
                        globalExpense += amountInEur;
                    }
                }
            } else { // It's a BillPayment
                // One-time bills are external, they only affect global totals
                if (item.amount > 0) {
                    globalIncome += amountInEur;
                } else {
                    globalExpense += amountInEur;
                }
            }
        });
        
        const globalNet = globalIncome - globalExpense;
        const globalSummary = { income: globalIncome, expense: globalExpense, net: globalNet };

        const paidItems = billsAndPayments
            .filter(b => b.status === 'paid')
            .sort((a, b) => parseAsUTC(b.dueDate).getTime() - parseAsUTC(a.dueDate).getTime())
            .slice(0, 10); // Show last 10 paid

        return {
            upcomingItems: allUpcomingItems,
            paidItems,
            accountSummaries,
            globalSummary
        };
    }, [recurringTransactions, billsAndPayments, accounts, accountMap]);

    const handleOpenRecurringModal = (rt?: RecurringTransaction) => {
        setEditingTransaction(rt || null);
        setIsRecurringModalOpen(true);
    };

    const handleOpenBillModal = (bill?: BillPayment) => {
        setEditingBill(bill || null);
        setIsBillModalOpen(true);
    };

    const handleEditItem = (item: RecurringTransaction | BillPayment) => {
        if ('frequency' in item) {
            handleOpenRecurringModal(item);
        } else {
            handleOpenBillModal(item);
        }
    };

    const handleDeleteItem = (id: string, isRecurring: boolean) => {
        if (isRecurring) {
            deleteRecurringTransaction(id);
        } else {
            deleteBillPayment(id);
        }
    };

    const groupItems = (items: ScheduledItem[]) => {
        const groups: Record<string, ScheduledItem[]> = { 'Overdue': [], 'Today': [], 'Next 7 Days': [], 'Next 30 Days': [], 'Later': [] };
        const today = new Date();
        const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
        const next7Days = new Date(todayUTC); next7Days.setUTCDate(todayUTC.getUTCDate() + 7);
        const next30Days = new Date(todayUTC); next30Days.setUTCDate(todayUTC.getUTCDate() + 30);
        
        items.forEach(item => {
            const itemDate = parseAsUTC(item.date);
            if (itemDate < todayUTC) { groups['Overdue'].push(item); } 
            else if (itemDate.getTime() === todayUTC.getTime()) { groups['Today'].push(item); } 
            else if (itemDate <= next7Days) { groups['Next 7 Days'].push(item); } 
            else if (itemDate <= next30Days) { groups['Next 30 Days'].push(item); } 
            else { groups['Later'].push(item); }
        });
        return groups;
    };
    
    const groupedUpcomingItems = groupItems(upcomingItems.filter(item => {
        return parseAsUTC(item.date) >= new Date(new Date().toISOString().split('T')[0]);
    }));

    return (
        <div className="space-y-8">
            {isRecurringModalOpen && <RecurringTransactionModal onClose={() => setIsRecurringModalOpen(false)} onSave={(data) => { saveRecurringTransaction(data); setIsRecurringModalOpen(false); }} accounts={accounts} incomeCategories={incomeCategories} expenseCategories={expenseCategories} recurringTransactionToEdit={editingTransaction} />}
            {isBillModalOpen && <BillPaymentModal onClose={() => setIsBillModalOpen(false)} onSave={(data) => { saveBillPayment(data); setIsBillModalOpen(false); }} bill={editingBill} accounts={accounts} />}
            
            <header className="flex justify-between items-center">
                <div>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Manage your future income, expenses, and bills.</p>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => handleOpenBillModal()} className={BTN_SECONDARY_STYLE}>Add Bill/Payment</button>
                    <button onClick={() => handleOpenRecurringModal()} className={BTN_PRIMARY_STYLE}>Add Recurring</button>
                </div>
            </header>

            <Card>
                <h3 className="text-xl font-semibold mb-4 text-light-text dark:text-dark-text">Next 30 Days Forecast</h3>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-black/10 dark:border-white/10 text-left text-light-text-secondary dark:text-dark-text-secondary">
                            <th className="py-2 px-4 font-semibold">Account</th>
                            <th className="py-2 px-4 font-semibold text-right">Income</th>
                            <th className="py-2 px-4 font-semibold text-right">Expenses</th>
                            <th className="py-2 px-4 font-semibold text-right">Net Cash Flow</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(accountSummaries).map(([accountId, summary]: [string, { income: number; expense: number; net: number; currency: Currency }]) => {
                            const account = accounts.find(a => a.id === accountId);
                            if (!account) return null;
                            return (
                                <tr key={accountId} className="border-b border-black/5 dark:border-white/5 last:border-0">
                                    <td className="py-3 px-4 flex items-center gap-2"><span className={`material-symbols-outlined text-base ${ACCOUNT_TYPE_STYLES[account.type]?.color || 'text-gray-500'}`}>{account.icon || 'wallet'}</span><span className="font-medium">{account.name}</span></td>
                                    <td className="py-3 px-4 text-right text-green-600 dark:text-green-400">{formatCurrency(summary.income, 'EUR')}</td>
                                    <td className="py-3 px-4 text-right text-red-600 dark:text-red-400">{formatCurrency(summary.expense, 'EUR')}</td>
                                    <td className={`py-3 px-4 text-right font-semibold ${summary.net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(summary.net, 'EUR', { showPlusSign: true })}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-black/10 dark:border-white/10 font-bold">
                            <td className="py-3 px-4">Total (External)</td>
                            <td className="py-3 px-4 text-right text-green-600 dark:text-green-400">{formatCurrency(globalSummary.income, 'EUR')}</td>
                            <td className="py-3 px-4 text-right text-red-600 dark:text-red-400">{formatCurrency(globalSummary.expense, 'EUR')}</td>
                            <td className={`py-3 px-4 text-right ${globalSummary.net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(globalSummary.net, 'EUR', { showPlusSign: true })}</td>
                        </tr>
                    </tfoot>
                </table>
            </Card>

            <ScheduleHeatmap items={upcomingItems} />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card>
                    <h3 className="text-xl font-semibold mb-4 text-light-text dark:text-dark-text">Upcoming</h3>
                    <div className="divide-y divide-light-separator dark:divide-dark-separator -mx-6">
                        {Object.entries(groupedUpcomingItems).map(([groupName, items]) => items.length > 0 && (
                            <div key={groupName} className="px-6 py-4">
                                <h4 className="font-semibold mb-2">{groupName}</h4>
                                <div className="space-y-2 -mx-4">
                                    {items.map(item => <ScheduledItemRow key={item.id} item={item} accounts={accounts} onEdit={handleEditItem} onDelete={handleDeleteItem} onMarkAsPaid={markBillAsPaid} />)}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
                <Card>
                    <h3 className="text-xl font-semibold mb-4 text-light-text dark:text-dark-text">Recently Paid</h3>
                    <div className="space-y-2 -mx-4">
                        {paidItems.map(item => (
                            <div key={item.id} className="flex items-center justify-between p-4 opacity-60">
                                <div className="flex items-center gap-4">
                                    <div className="flex-shrink-0 text-center rounded-lg p-2 w-16 bg-light-bg dark:bg-dark-bg">
                                        <p className="text-xs font-semibold text-gray-400">{parseAsUTC(item.dueDate).toLocaleString('default', { month: 'short', timeZone: 'UTC' }).toUpperCase()}</p>
                                        <p className="text-2xl font-bold text-gray-500">{parseAsUTC(item.dueDate).getUTCDate()}</p>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-lg text-light-text dark:text-dark-text line-through">{item.description}</p>
                                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{accountMap[item.accountId!] || 'External'}</p>
                                    </div>
                                </div>
                                <p className="font-semibold text-base text-gray-500 line-through">{formatCurrency(item.amount, item.currency)}</p>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default Schedule;