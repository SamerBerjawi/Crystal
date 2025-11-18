
import React, { useState, useMemo } from 'react';
// FIX: Import ScheduledItem from global types and remove local definition.
import { RecurringTransaction, Account, Category, BillPayment, Currency, AccountType, RecurringTransactionOverride, ScheduledItem, Transaction, Tag, LoanPaymentOverrides } from '../types';
import Card from '../components/Card';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, LIQUID_ACCOUNT_TYPES, ACCOUNT_TYPE_STYLES } from '../constants';
import { formatCurrency, convertToEur, generateSyntheticLoanPayments, generateSyntheticCreditCardPayments } from '../utils';
import RecurringTransactionModal from '../components/RecurringTransactionModal';
import Modal from '../components/Modal';
import ScheduleHeatmap from '../components/ScheduleHeatmap';
import EditRecurrenceModal from '../components/EditRecurrenceModal';
import RecurringOverrideModal from '../components/RecurringOverrideModal';
import AddTransactionModal from '../components/AddTransactionModal';

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
    onEdit: (item: ScheduledItem) => void;
    onDelete: (id: string, isRecurring: boolean) => void;
    onPost: (item: ScheduledItem) => void;
    isReadOnly?: boolean;
}> = ({ item, accounts, onEdit, onDelete, onPost, isReadOnly = false }) => {
    
    const isIncome = item.type === 'income' || item.type === 'deposit';
    const isOverdue = !item.isRecurring && item.date < new Date().toISOString().split('T')[0];
    
    const dueDate = parseAsUTC(item.date);
    const day = dueDate.getUTCDate();
    const month = dueDate.toLocaleString('default', { month: 'short', timeZone: 'UTC' }).toUpperCase();
    
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 group">
        <div className="flex items-center gap-4 w-full">
          <div className={`flex-shrink-0 text-center rounded-lg p-2 w-16 ${isOverdue ? 'bg-red-100 dark:bg-red-900/40' : 'bg-light-bg dark:bg-dark-bg'}`}>
            <p className={`text-xs font-semibold ${isOverdue ? 'text-red-500' : 'text-primary-500'}`}>{month}</p>
            <p className={`text-2xl font-bold ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-light-text dark:text-dark-text'}`}>{day}</p>
          </div>
          <div>
            <p className="font-semibold text-base text-light-text dark:text-dark-text flex items-center gap-2">
                {item.description}
                {item.isOverride && <span className="material-symbols-outlined text-sm text-primary-500" title="This occurrence is modified">edit_calendar</span>}
            </p>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{item.accountName} &bull; {item.isRecurring ? (item.originalItem as RecurringTransaction).frequency : 'One-time'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-center mt-2 sm:mt-0 ml-auto sm:ml-0">
          <p className={`font-semibold text-base ${isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatCurrency(item.amount, 'EUR')}
          </p>
          <div className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ${isReadOnly ? '!opacity-0' : ''}`}>
            <button onClick={() => onPost(item)} className={`${BTN_PRIMARY_STYLE} !py-1 !px-2 text-xs`} title="Post Transaction"><span className="material-symbols-outlined text-sm">check</span></button>
            <button onClick={() => onEdit(item)} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10" title="Edit"><span className="material-symbols-outlined text-base">edit</span></button>
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
    recurringTransactionOverrides: RecurringTransactionOverride[];
    saveRecurringOverride: (override: RecurringTransactionOverride) => void;
    deleteRecurringOverride: (recurringTransactionId: string, originalDate: string) => void;
    saveTransaction: (transactions: (Omit<Transaction, 'id'> & { id?: string })[], idsToDelete?: string[]) => void;
    transactions: Transaction[];
    tags: Tag[];
    loanPaymentOverrides: LoanPaymentOverrides;
}

const SchedulePage: React.FC<ScheduleProps> = (props) => {
    const { recurringTransactions, saveRecurringTransaction, deleteRecurringTransaction, billsAndPayments, saveBillPayment, deleteBillPayment, markBillAsPaid, accounts, incomeCategories, expenseCategories, recurringTransactionOverrides, saveRecurringOverride, deleteRecurringOverride, saveTransaction, transactions, tags, loanPaymentOverrides } = props;

    const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
    const [isBillModalOpen, setIsBillModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<RecurringTransaction | null>(null);
    const [editingBill, setEditingBill] = useState<BillPayment | null>(null);
    const [editChoiceItem, setEditChoiceItem] = useState<ScheduledItem | null>(null);
    const [overrideModalItem, setOverrideModalItem] = useState<ScheduledItem | null>(null);
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [itemToPost, setItemToPost] = useState<ScheduledItem | null>(null);
    const [expandedScheduleGroups, setExpandedScheduleGroups] = useState<Record<string, boolean>>({});

    const toggleScheduleGroup = (id: string) => {
        setExpandedScheduleGroups(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const accountMap = React.useMemo(() => accounts.reduce((acc, current) => {
        acc[current.id] = current.name;
        return acc;
    }, {} as Record<string, string>), [accounts]);
    
    const { upcomingRecurring, upcomingBills, paidItems, allUpcomingForHeatmap, accountSummaries, globalSummary } = useMemo(() => {
        const today = new Date();
        const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
        
        const startRecurringScanDate = new Date(todayUTC);
        startRecurringScanDate.setUTCDate(startRecurringScanDate.getUTCDate() - 3);

        const dateIn30Days = new Date(todayUTC); dateIn30Days.setUTCDate(todayUTC.getUTCDate() + 30);
        const forecastEndDate = new Date(todayUTC); forecastEndDate.setFullYear(today.getFullYear() + 2);

        const allUpcomingItems: ScheduledItem[] = [];

        const syntheticLoanPayments = generateSyntheticLoanPayments(accounts, transactions, loanPaymentOverrides);
        const syntheticCreditCardPayments = generateSyntheticCreditCardPayments(accounts, transactions);
        const allRecurringTransactions = [...recurringTransactions, ...syntheticLoanPayments, ...syntheticCreditCardPayments];

        allRecurringTransactions.forEach(rt => {
            let nextDate = parseAsUTC(rt.nextDueDate);
            const endDateUTC = rt.endDate ? parseAsUTC(rt.endDate) : null;
            const startDateUTC = parseAsUTC(rt.startDate);

            while (nextDate < startRecurringScanDate && (!endDateUTC || nextDate < endDateUTC)) {
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
            
            while (nextDate <= forecastEndDate && (!endDateUTC || nextDate <= endDateUTC)) {
                const originalDateStr = nextDate.toISOString().split('T')[0];
                const override = recurringTransactionOverrides.find(o => o.recurringTransactionId === rt.id && o.originalDate === originalDateStr);

                if (override && override.isSkipped) {
                    // This occurrence is skipped, so we just advance the date and continue the loop.
                } else {
                    const itemDate = override?.date || originalDateStr;
                    const itemAmount = override?.amount !== undefined ? override.amount : (rt.type === 'expense' ? -rt.amount : rt.amount);
                    const itemDescription = override?.description || rt.description;

                    allUpcomingItems.push({
                        id: override ? `override-${rt.id}-${originalDateStr}` : `${rt.id}-${originalDateStr}`,
                        isRecurring: true, 
                        date: itemDate, 
                        description: itemDescription,
                        amount: itemAmount,
                        accountName: rt.type === 'transfer' ? `${accountMap[rt.accountId]} → ${accountMap[rt.toAccountId!]}` : accountMap[rt.accountId],
                        type: rt.type, 
                        originalItem: rt, 
                        isTransfer: rt.type === 'transfer',
                        isOverride: !!override,
                        originalDateForOverride: originalDateStr,
                    });
                }
                
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

        allUpcomingItems.sort((a, b) => parseAsUTC(a.date).getTime() - parseAsUTC(b.date).getTime());

        const upcomingRecurringItems: ScheduledItem[] = [];
        const upcomingBillsItems: ScheduledItem[] = [];

        const startFilterDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 3));

        allUpcomingItems
            .filter(item => parseAsUTC(item.date) >= startFilterDate)
            .forEach(item => {
                if (item.isRecurring) {
                    const rt = item.originalItem as RecurringTransaction;
                    if (rt.isSynthetic && rt.id.startsWith('cc-pmt-')) {
                        upcomingBillsItems.push(item);
                    } else {
                        upcomingRecurringItems.push(item);
                    }
                } else {
                    upcomingBillsItems.push(item);
                }
        });

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

        forecastItems.forEach(item => {
            const originalItem = item.originalItem;
            const amountInEur = convertToEur(Math.abs(item.amount), (originalItem as RecurringTransaction | BillPayment).currency);
        
            if (item.isRecurring) {
                const rt = originalItem as RecurringTransaction;
                if (rt.type === 'transfer' && rt.toAccountId) {
                    initializeSummary(rt.accountId);
                    accountSummaries[rt.accountId].expense += amountInEur;
                    accountSummaries[rt.accountId].net -= amountInEur;
        
                    initializeSummary(rt.toAccountId);
                    accountSummaries[rt.toAccountId].income += amountInEur;
                    accountSummaries[rt.toAccountId].net += amountInEur;
                } else {
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
            } else {
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
            .slice(0, 10);

        return {
            upcomingRecurring: upcomingRecurringItems,
            upcomingBills: upcomingBillsItems,
            paidItems,
            allUpcomingForHeatmap: allUpcomingItems,
            accountSummaries,
            globalSummary
        };
    }, [recurringTransactions, billsAndPayments, accounts, accountMap, recurringTransactionOverrides, transactions]);

    const handleOpenRecurringModal = (rt?: RecurringTransaction) => {
        setEditingTransaction(rt || null);
        setIsRecurringModalOpen(true);
    };

    const handleOpenBillModal = (bill?: BillPayment) => {
        setEditingBill(bill || null);
        setIsBillModalOpen(true);
    };

    const handleEditItem = (item: ScheduledItem) => {
        if (item.isRecurring) {
            if (item.isOverride) {
                setOverrideModalItem(item);
            } else {
                setEditChoiceItem(item);
            }
        } else {
            handleOpenBillModal(item.originalItem as BillPayment);
        }
    };
    
    const handleEditSingle = () => {
        if (!editChoiceItem) return;
        setOverrideModalItem(editChoiceItem);
        setEditChoiceItem(null);
    };
    
    const handleEditSeries = () => {
        if (!editChoiceItem) return;
        handleOpenRecurringModal(editChoiceItem.originalItem as RecurringTransaction);
        setEditChoiceItem(null);
    };

    const handleDeleteItem = (id: string, isRecurring: boolean) => {
        if (isRecurring) {
            deleteRecurringTransaction(id);
        } else {
            deleteBillPayment(id);
        }
    };

    const handleOpenPostModal = (item: ScheduledItem) => {
        setItemToPost(item);
        setIsTransactionModalOpen(true);
    };

    const handleSavePostedTransaction = (transactionsToSave: (Omit<Transaction, 'id'> & { id?: string })[], idsToDelete: string[]) => {
        if (!itemToPost) return;

        saveTransaction(transactionsToSave, idsToDelete);

        if (itemToPost.isRecurring) {
            const rt = itemToPost.originalItem as RecurringTransaction;
            const postedDate = parseAsUTC(itemToPost.date);
            let nextDueDate = new Date(postedDate);
            const interval = rt.frequencyInterval || 1;
            const startDateUTC = parseAsUTC(rt.startDate);

            switch (rt.frequency) {
                case 'daily': nextDueDate.setUTCDate(nextDueDate.getUTCDate() + interval); break;
                case 'weekly': nextDueDate.setUTCDate(nextDueDate.getUTCDate() + 7 * interval); break;
                case 'monthly': {
                    const d = rt.dueDateOfMonth || startDateUTC.getUTCDate();
                    nextDueDate.setUTCMonth(nextDueDate.getUTCMonth() + interval, 1);
                    const lastDayOfNextMonth = new Date(Date.UTC(nextDueDate.getUTCFullYear(), nextDueDate.getUTCMonth() + 1, 0)).getUTCDate();
                    nextDueDate.setUTCDate(Math.min(d, lastDayOfNextMonth));
                    break;
                }
                case 'yearly': {
                    const d = rt.dueDateOfMonth || startDateUTC.getUTCDate();
                    const m = startDateUTC.getUTCMonth();
                    nextDueDate.setUTCFullYear(nextDueDate.getUTCFullYear() + interval);
                    const lastDayOfNextMonth = new Date(Date.UTC(nextDueDate.getUTCFullYear(), m + 1, 0)).getUTCDate();
                    nextDueDate.setUTCMonth(m, Math.min(d, lastDayOfNextMonth));
                    break;
                }
            }
            saveRecurringTransaction({ ...rt, nextDueDate: nextDueDate.toISOString().split('T')[0] });
        } else {
            const bill = itemToPost.originalItem as BillPayment;
            const postedTransaction = transactionsToSave[0];
            saveBillPayment({ ...bill, status: 'paid', accountId: postedTransaction.accountId, dueDate: postedTransaction.date });
        }

        setIsTransactionModalOpen(false);
        setItemToPost(null);
    };

    const initialModalData = useMemo(() => {
        if (!itemToPost) return {};
        
        const item = itemToPost;
        const original = item.originalItem as RecurringTransaction | BillPayment;

        let type: 'income' | 'expense' | 'transfer';
        let from, to;
        let category: string | undefined;

        if (item.isRecurring) {
            const rt = original as RecurringTransaction;
            type = rt.type;
            category = rt.category;
            if (type === 'transfer') {
                from = rt.accountId;
                to = rt.toAccountId;
            } else if (type === 'income') {
                to = rt.accountId;
            } else {
                from = rt.accountId;
            }
        } else { // Bill
            const bill = original as BillPayment;
            type = bill.type === 'deposit' ? 'income' : 'expense';
            category = type === 'income' ? 'Income' : 'Bills & Utilities';
        }

        return {
            initialType: type,
            initialFromAccountId: from,
            initialToAccountId: to,
            initialDetails: {
                date: item.date,
                amount: String(Math.abs(item.amount)),
                description: item.description,
            },
            transactionToEdit: { category } as Transaction, // trick to pre-fill category
        };
    }, [itemToPost]);

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
    
    const groupedRecurringItems = groupItems(upcomingRecurring);
    const groupedBills = groupItems(upcomingBills);

    const renderGroupedItems = (groupedItems: Record<string, ScheduledItem[]>) => (
        <div className="divide-y divide-light-separator dark:divide-dark-separator -mx-6">
            {Object.entries(groupedItems).map(([groupName, items]) => {
                if (items.length === 0) return null;

                if (groupName === 'Later') {
                    // Group items by their parent (recurring transaction) ID
                    const groupedBySource: Record<string, ScheduledItem[]> = {};
                    items.forEach(item => {
                        let key = (item.originalItem as any).id;
                        // Check if it is a synthetic loan payment to group by loan account
                        const rt = item.originalItem as RecurringTransaction;
                        if (item.isRecurring && rt.isSynthetic && rt.id.startsWith('loan-pmt-')) {
                            // ID format: loan-pmt-{accountId}-{paymentNumber}
                            // We group by removing the payment number suffix
                             const lastDashIndex = rt.id.lastIndexOf('-');
                             if (lastDashIndex > 0) {
                                 key = rt.id.substring(0, lastDashIndex);
                             }
                        }
                        
                        if (!groupedBySource[key]) {
                            groupedBySource[key] = [];
                        }
                        groupedBySource[key].push(item);
                    });

                    // Sort groups by date of the first occurrence
                    const sortedGroups = Object.entries(groupedBySource).sort((a, b) => {
                         return parseAsUTC(a[1][0].date).getTime() - parseAsUTC(b[1][0].date).getTime();
                    });

                    return (
                        <div key={groupName} className="px-6 py-4">
                            <h4 className="font-semibold mb-4 text-lg text-light-text dark:text-dark-text">{groupName}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {sortedGroups.map(([sourceId, sourceItems]) => {
                                    const firstItem = sourceItems[0];
                                    let title = firstItem.description;
                                    const isRecurring = sourceItems.length > 1 || firstItem.isRecurring;
                                    const isExpanded = expandedScheduleGroups[sourceId];
                                    
                                    if (firstItem.isRecurring) {
                                        const rt = firstItem.originalItem as RecurringTransaction;
                                        if (rt.isSynthetic && rt.id.startsWith('loan-pmt-')) {
                                            title = title.replace(/ #\d+/, '');
                                        }
                                    }

                                    // If it's just a one-off bill (not recurring), show as a simple card
                                    if (!isRecurring) {
                                         return (
                                            <div key={firstItem.id} className="bg-light-bg/50 dark:bg-dark-bg/30 rounded-xl border border-black/5 dark:border-white/5 overflow-hidden">
                                                 {sourceItems.map(item => (
                                                    <ScheduledItemRow key={item.id} item={item} accounts={accounts} onEdit={handleEditItem} onDelete={handleDeleteItem} onPost={handleOpenPostModal} />
                                                 ))}
                                            </div>
                                         );
                                    }

                                    return (
                                        <div key={sourceId} className="bg-light-bg/50 dark:bg-dark-bg/30 rounded-xl border border-black/5 dark:border-white/5 overflow-hidden h-fit">
                                            <div 
                                                onClick={() => toggleScheduleGroup(sourceId)}
                                                className="px-4 py-3 bg-light-fill/50 dark:bg-dark-fill/50 border-b border-black/5 dark:border-white/5 flex justify-between items-center backdrop-blur-sm cursor-pointer hover:bg-light-fill dark:hover:bg-dark-fill transition-colors"
                                            >
                                                <div className="font-semibold text-light-text dark:text-dark-text flex items-center gap-2 truncate pr-2">
                                                    <span className={`material-symbols-outlined text-base text-light-text-secondary dark:text-dark-text-secondary transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                                                    <span className="material-symbols-outlined text-base text-primary-500 flex-shrink-0">repeat</span>
                                                    <span className="truncate">{title}</span>
                                                </div>
                                                <span className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 flex-shrink-0">
                                                    {sourceItems.length}
                                                </span>
                                            </div>
                                            {isExpanded && (
                                                <div className="divide-y divide-black/5 dark:divide-white/5">
                                                    {sourceItems.map(item => (
                                                        <ScheduledItemRow 
                                                            key={item.id} 
                                                            item={item} 
                                                            accounts={accounts} 
                                                            onEdit={handleEditItem} 
                                                            onDelete={handleDeleteItem} 
                                                            onPost={handleOpenPostModal} 
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                }

                return (
                    <div key={groupName} className="px-6 py-4">
                        <h4 className="font-semibold mb-2">{groupName}</h4>
                        <div className="space-y-2 -mx-4">
                            {items.map(item => <ScheduledItemRow key={item.id} item={item} accounts={accounts} onEdit={handleEditItem} onDelete={handleDeleteItem} onPost={handleOpenPostModal} />)}
                        </div>
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className="space-y-8">
            {isRecurringModalOpen && <RecurringTransactionModal onClose={() => setIsRecurringModalOpen(false)} onSave={(data) => { saveRecurringTransaction(data); setIsRecurringModalOpen(false); }} accounts={accounts} incomeCategories={incomeCategories} expenseCategories={expenseCategories} recurringTransactionToEdit={editingTransaction} />}
            {isBillModalOpen && <BillPaymentModal onClose={() => setIsBillModalOpen(false)} onSave={(data) => { saveBillPayment(data); setIsBillModalOpen(false); }} bill={editingBill} accounts={accounts} />}
            {editChoiceItem && <EditRecurrenceModal isOpen={!!editChoiceItem} onClose={() => setEditChoiceItem(null)} onEditSingle={handleEditSingle} onEditSeries={handleEditSeries} />}
            {overrideModalItem && <RecurringOverrideModal item={overrideModalItem} recurringTransactionOverrides={recurringTransactionOverrides} onClose={() => setOverrideModalItem(null)} onSave={saveRecurringOverride} onDelete={deleteRecurringOverride} />}
            {isTransactionModalOpen && itemToPost && (
                <AddTransactionModal
                    onClose={() => { setIsTransactionModalOpen(false); setItemToPost(null); }}
                    onSave={handleSavePostedTransaction}
                    accounts={accounts}
                    incomeCategories={incomeCategories}
                    expenseCategories={expenseCategories}
                    tags={tags}
                    initialType={initialModalData.initialType}
                    initialFromAccountId={initialModalData.initialFromAccountId}
                    initialToAccountId={initialModalData.initialToAccountId}
                    initialDetails={initialModalData.initialDetails}
                    transactionToEdit={initialModalData.transactionToEdit}
                />
            )}
            
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
                <table className="w-full">
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

            <ScheduleHeatmap items={allUpcomingForHeatmap} />
            
            <div className="space-y-8">
                <Card>
                    <h3 className="text-xl font-semibold mb-4 text-light-text dark:text-dark-text">Payment History</h3>
                    {paidItems.length > 0 ? (
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
                    ) : (
                        <p className="text-center py-8 text-light-text-secondary dark:text-dark-text-secondary">You have no paid bills in your history.</p>
                    )}
                </Card>

                <Card>
                    <h3 className="text-xl font-semibold mb-4 text-light-text dark:text-dark-text">Upcoming Bills & One-time Payments</h3>
                    {upcomingBills.length > 0 ? (
                        renderGroupedItems(groupedBills)
                    ) : (
                         <p className="text-center py-8 text-light-text-secondary dark:text-dark-text-secondary">No upcoming bills or payments scheduled.</p>
                    )}
                </Card>

                <Card>
                    <h3 className="text-xl font-semibold mb-4 text-light-text dark:text-dark-text">Recurring Transactions</h3>
                    {upcomingRecurring.length > 0 ? (
                        renderGroupedItems(groupedRecurringItems)
                    ) : (
                        <p className="text-center py-8 text-light-text-secondary dark:text-dark-text-secondary">No upcoming recurring transactions found.</p>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default SchedulePage;
