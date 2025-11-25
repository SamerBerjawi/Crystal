
import React, { useState, useMemo } from 'react';
// FIX: Import ScheduledItem from global types and remove local definition.
import { RecurringTransaction, Account, Category, BillPayment, Currency, AccountType, RecurringTransactionOverride, ScheduledItem, Transaction, Tag, LoanPaymentOverrides } from '../types';
import Card from '../components/Card';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, LIQUID_ACCOUNT_TYPES, ACCOUNT_TYPE_STYLES, ALL_ACCOUNT_TYPES } from '../constants';
import { formatCurrency, convertToEur, generateSyntheticLoanPayments, generateSyntheticCreditCardPayments, generateSyntheticPropertyTransactions } from '../utils';
import RecurringTransactionModal from '../components/RecurringTransactionModal';
import Modal from '../components/Modal';
import ScheduleHeatmap from '../components/ScheduleHeatmap';
import EditRecurrenceModal from '../components/EditRecurrenceModal';
import RecurringOverrideModal from '../components/RecurringOverrideModal';
import AddTransactionModal from '../components/AddTransactionModal';
import BillPaymentModal from '../components/BillPaymentModal';
import { useAccountsContext, useTransactionsContext } from '../contexts/DomainProviders';
import { useCategoryContext, useScheduleContext, useTagsContext } from '../contexts/FinancialDataContext';

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
    const isTransfer = item.type === 'transfer';
    const isOverdue = !item.isRecurring && item.date < new Date().toISOString().split('T')[0];
    
    const dueDate = parseAsUTC(item.date);
    const day = dueDate.getUTCDate();
    const month = dueDate.toLocaleString('default', { month: 'short', timeZone: 'UTC' }).toUpperCase();
    const weekday = dueDate.toLocaleString('default', { weekday: 'short', timeZone: 'UTC' });

    // Determine status/frequency text
    let subText = item.accountName;
    if (item.isRecurring) {
        const rt = item.originalItem as RecurringTransaction;
        subText += ` • ${rt.frequency.charAt(0).toUpperCase() + rt.frequency.slice(1)}`;
    } else {
        subText += ` • One-time`;
    }

    const amountColor = isIncome 
        ? 'text-emerald-600 dark:text-emerald-400' 
        : isTransfer 
            ? 'text-light-text dark:text-dark-text' 
            : 'text-rose-600 dark:text-rose-400';
    
    return (
      <div className="group relative flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-white dark:bg-dark-card rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all duration-200">
        {/* Date Block */}
        <div className={`flex-shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-xl border ${isOverdue ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700'}`}>
            <span className={`text-xs font-bold uppercase tracking-wider ${isOverdue ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>{month}</span>
            <span className={`text-2xl font-bold leading-none ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-200'}`}>{day}</span>
            <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase mt-0.5">{weekday}</span>
        </div>

        {/* Content */}
        <div className="flex-grow min-w-0">
            <div className="flex items-center gap-2 mb-1">
                <h4 className="font-bold text-gray-900 dark:text-white truncate text-base sm:text-lg">{item.description}</h4>
                {item.isOverride && (
                    <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 uppercase tracking-wide">Modified</span>
                )}
                 {isOverdue && (
                    <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 uppercase tracking-wide">Overdue</span>
                )}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1 truncate">
                    <span className="material-symbols-outlined text-[16px]">{isTransfer ? 'swap_horiz' : (item.isRecurring ? 'repeat' : 'receipt')}</span>
                    {subText}
                </span>
            </div>
        </div>

        {/* Amount & Actions */}
        <div className="flex flex-row sm:flex-col items-center sm:items-end gap-3 sm:gap-1 ml-auto pl-4 sm:pl-0 border-l sm:border-l-0 border-gray-100 dark:border-gray-800">
             <span className={`text-lg font-bold font-mono tracking-tight ${amountColor}`}>
                {formatCurrency(item.amount, 'EUR')}
             </span>
             
             <div className={`flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${isReadOnly ? 'hidden' : ''}`}>
                <button 
                    onClick={(e) => { e.stopPropagation(); onPost(item); }}
                    className="p-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors" 
                    title="Post Transaction"
                >
                    <span className="material-symbols-outlined text-[18px]">check</span>
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors" 
                    title="Edit"
                >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(item.originalItem.id, item.isRecurring); }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" 
                    title="Delete"
                >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
             </div>
        </div>
      </div>
    );
};

// --- Main Page Component ---

interface ScheduleProps {}

const SchedulePage: React.FC<ScheduleProps> = () => {
    const { accounts } = useAccountsContext();
    const { transactions, saveTransaction } = useTransactionsContext();
    const { incomeCategories, expenseCategories } = useCategoryContext();
    const { tags } = useTagsContext();
    const {
        recurringTransactions,
        saveRecurringTransaction,
        deleteRecurringTransaction,
        billsAndPayments,
        saveBillPayment,
        deleteBillPayment,
        markBillAsPaid,
        recurringTransactionOverrides,
        saveRecurringOverride,
        deleteRecurringOverride,
        loanPaymentOverrides,
    } = useScheduleContext();

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
        const forecastEndDate = new Date(todayUTC); forecastEndDate.setUTCMonth(todayUTC.getUTCMonth() + 12);

        const allUpcomingItems: ScheduledItem[] = [];

        const syntheticLoanPayments = generateSyntheticLoanPayments(accounts, transactions, loanPaymentOverrides);
        const syntheticCreditCardPayments = generateSyntheticCreditCardPayments(accounts, transactions);
        const syntheticPropertyTransactions = generateSyntheticPropertyTransactions(accounts);
        const allRecurringTransactions = [...recurringTransactions, ...syntheticLoanPayments, ...syntheticCreditCardPayments, ...syntheticPropertyTransactions];

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
                    const accountName = rt.accountId === 'external' ? 'External' : (rt.type === 'transfer' ? `${accountMap[rt.accountId]} → ${accountMap[rt.toAccountId!]}` : accountMap[rt.accountId]);

                    allUpcomingItems.push({
                        id: override ? `override-${rt.id}-${originalDateStr}` : `${rt.id}-${originalDateStr}`,
                        isRecurring: true, 
                        date: itemDate, 
                        description: itemDescription,
                        amount: itemAmount,
                        accountName,
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
                accountName: b.accountId ? accountMap[b.accountId] : 'External',
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
            if (!accountSummaries[accountId] && accountId !== 'external') {
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
                    if(accountSummaries[rt.accountId]) {
                         accountSummaries[rt.accountId].expense += amountInEur;
                         accountSummaries[rt.accountId].net -= amountInEur;
                    }
        
                    initializeSummary(rt.toAccountId);
                    if(accountSummaries[rt.toAccountId]) {
                        accountSummaries[rt.toAccountId].income += amountInEur;
                        accountSummaries[rt.toAccountId].net += amountInEur;
                    }
                } else {
                    initializeSummary(rt.accountId);
                    if (item.amount > 0) {
                        if(accountSummaries[rt.accountId]) {
                            accountSummaries[rt.accountId].income += amountInEur;
                            accountSummaries[rt.accountId].net += amountInEur;
                        }
                        globalIncome += amountInEur;
                    } else {
                        if(accountSummaries[rt.accountId]) {
                             accountSummaries[rt.accountId].expense += amountInEur;
                             accountSummaries[rt.accountId].net -= amountInEur;
                        }
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
            // Pre-fill the account ID from the bill if available, otherwise let user select or default
            if (bill.accountId) {
                 if (type === 'income') to = bill.accountId;
                 else from = bill.accountId;
            }
        }

        return {
            initialType: type,
            initialFromAccountId: from,
            initialToAccountId: to,
            initialCategory: category,
            initialDetails: {
                date: item.date,
                amount: String(Math.abs(item.amount)),
                description: item.description,
            },
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
        <div className="space-y-6">
            {Object.entries(groupedItems).map(([groupName, items]) => {
                if (items.length === 0) return null;

                // Sort items by date
                const sortedItems = items.sort((a, b) => parseAsUTC(a.date).getTime() - parseAsUTC(b.date).getTime());

                if (groupName === 'Later') {
                     const groupedBySource: Record<string, { title: string; items: ScheduledItem[]; type: 'recurring' | 'bill' }> = {};

                     sortedItems.forEach(item => {
                        if (item.isRecurring) {
                            const rt = item.originalItem as RecurringTransaction;
                            let groupKey = rt.id;
                            let groupTitle = item.description;
            
                            if (rt.isSynthetic && rt.id.startsWith('loan-pmt-')) {
                                 const lastDashIndex = rt.id.lastIndexOf('-');
                                 if (lastDashIndex > 0) {
                                     groupKey = rt.id.substring(0, lastDashIndex);
                                     groupTitle = item.description.replace(/ #\d+:/, ':');
                                 }
                            } else if (rt.isSynthetic && rt.id.startsWith('cc-pmt-')) {
                                 if (rt.toAccountId) {
                                    groupKey = `cc-pmt-${rt.toAccountId}`;
                                    groupTitle = `Credit Card Payment: ${accountMap[rt.toAccountId]}`;
                                 }
                            } else if (rt.isSynthetic && rt.id.startsWith('prop-')) {
                                const firstDash = rt.id.indexOf('-');
                                const secondDash = rt.id.indexOf('-', firstDash + 1);
                                if (secondDash > 0) {
                                    groupKey = rt.id;
                                    groupTitle = item.description;
                                }
                            }
                            
                            if (!groupedBySource[groupKey]) {
                                groupedBySource[groupKey] = { title: groupTitle, items: [], type: 'recurring' };
                            }
                            groupedBySource[groupKey].items.push(item);
            
                        } else {
                            groupedBySource[item.id] = { title: item.description, items: [item], type: 'bill' };
                        }
                    });

                    const sortedGroups = Object.entries(groupedBySource).sort((a, b) => {
                         return parseAsUTC(a[1].items[0].date).getTime() - parseAsUTC(b[1].items[0].date).getTime();
                    });

                    return (
                        <div key={groupName} className="space-y-3">
                            <h4 className="font-bold text-lg text-light-text dark:text-dark-text flex items-center gap-2">
                                {groupName}
                                <span className="text-xs font-medium bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-300">{items.length}</span>
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {sortedGroups.map(([key, group]) => {
                                    const isExpanded = expandedScheduleGroups[key];
                                    const isRecurringGroup = group.type === 'recurring';

                                    if (!isRecurringGroup) {
                                         return (
                                             group.items.map(item => (
                                                <ScheduledItemRow key={item.id} item={item} accounts={accounts} onEdit={handleEditItem} onDelete={handleDeleteItem} onPost={handleOpenPostModal} />
                                             ))
                                         );
                                    }

                                    return (
                                        <div key={key} className="bg-white dark:bg-dark-card border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden h-fit transition-shadow hover:shadow-md">
                                            <div 
                                                onClick={() => toggleScheduleGroup(key)}
                                                className="px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                                            >
                                                <div className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2 truncate pr-2">
                                                    <span className="material-symbols-outlined text-lg text-primary-500 flex-shrink-0">repeat</span>
                                                    <span className="truncate">{group.title}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                     <span className="text-xs font-bold bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full flex-shrink-0">
                                                        {group.items.length}
                                                    </span>
                                                    <span className={`material-symbols-outlined text-gray-400 dark:text-gray-500 transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                                                </div>
                                            </div>
                                            {isExpanded && (
                                                <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-black/20 p-2 space-y-2 max-h-80 overflow-y-auto">
                                                    {group.items.map(item => (
                                                        <ScheduledItemRow 
                                                            key={item.id} 
                                                            item={item} 
                                                            accounts={accounts} 
                                                            onEdit={handleEditItem} 
                                                            onDelete={handleDeleteItem} 
                                                            onPost={handleOpenPostModal} 
                                                            isReadOnly={(item.originalItem as RecurringTransaction).isSynthetic}
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
                    <div key={groupName} className="space-y-3">
                        <h4 className={`font-bold text-lg flex items-center gap-2 ${groupName === 'Overdue' ? 'text-red-600 dark:text-red-400' : 'text-light-text dark:text-dark-text'}`}>
                            {groupName}
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${groupName === 'Overdue' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>{items.length}</span>
                        </h4>
                        <div className="space-y-3">
                            {sortedItems.map(item => <ScheduledItemRow key={item.id} item={item} accounts={accounts} onEdit={handleEditItem} onDelete={handleDeleteItem} onPost={handleOpenPostModal} isReadOnly={item.isRecurring && (item.originalItem as RecurringTransaction).isSynthetic} />)}
                        </div>
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className="space-y-8 pb-8">
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
                    initialCategory={initialModalData.initialCategory}
                    initialDetails={initialModalData.initialDetails}
                />
            )}
            
            <header className="flex justify-between items-center">
                <div>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Manage your future income, expenses, and bills.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => handleOpenBillModal()} className={BTN_SECONDARY_STYLE}>Add Bill</button>
                    <button onClick={() => handleOpenRecurringModal()} className={BTN_PRIMARY_STYLE}>Add Recurring</button>
                </div>
            </header>

            <Card>
                <h3 className="text-xl font-semibold mb-4 text-light-text dark:text-dark-text">Next 30 Days Forecast</h3>
                <div className="overflow-x-auto">
                    <table className="w-full whitespace-nowrap">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                <th className="py-3 px-4">Account</th>
                                <th className="py-3 px-4 text-right">Income</th>
                                <th className="py-3 px-4 text-right">Expenses</th>
                                <th className="py-3 px-4 text-right">Net Cash Flow</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                            {Object.entries(accountSummaries).map(([accountId, summary]: [string, { income: number; expense: number; net: number; currency: Currency }]) => {
                                const account = accounts.find(a => a.id === accountId);
                                if (!account) return null;
                                return (
                                    <tr key={accountId} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="py-3 px-4 flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-opacity-10 ${ACCOUNT_TYPE_STYLES[account.type]?.color ? ACCOUNT_TYPE_STYLES[account.type].color.replace('text-', 'bg-').replace('500', '500/10') : 'bg-gray-100'}`}>
                                                 <span className={`material-symbols-outlined text-lg ${ACCOUNT_TYPE_STYLES[account.type]?.color || 'text-gray-500'}`}>{account.icon || 'wallet'}</span>
                                            </div>
                                            <span className="font-medium text-gray-900 dark:text-white">{account.name}</span>
                                        </td>
                                        <td className="py-3 px-4 text-right font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(summary.income, 'EUR')}</td>
                                        <td className="py-3 px-4 text-right font-medium text-rose-600 dark:text-rose-400">{formatCurrency(summary.expense, 'EUR')}</td>
                                        <td className={`py-3 px-4 text-right font-bold ${summary.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{formatCurrency(summary.net, 'EUR', { showPlusSign: true })}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gray-50 dark:bg-white/5 font-bold text-sm border-t border-gray-200 dark:border-gray-700">
                                <td className="py-3 px-4 text-gray-900 dark:text-white">Total (All Accounts)</td>
                                <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(globalSummary.income, 'EUR')}</td>
                                <td className="py-3 px-4 text-right text-rose-600 dark:text-rose-400">{formatCurrency(globalSummary.expense, 'EUR')}</td>
                                <td className={`py-3 px-4 text-right ${globalSummary.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{formatCurrency(globalSummary.net, 'EUR', { showPlusSign: true })}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </Card>

            <ScheduleHeatmap items={allUpcomingForHeatmap} />
            
            {/* Lists */}
            <div className="grid grid-cols-1 gap-8">
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-semibold text-light-text dark:text-dark-text">Upcoming Bills & One-time Payments</h3>
                        <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                             {upcomingBills.length} Items
                        </span>
                    </div>
                    
                    {upcomingBills.length > 0 ? (
                        renderGroupedItems(groupedBills)
                    ) : (
                         <div className="p-8 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl flex flex-col items-center justify-center text-center text-gray-500">
                            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">event_busy</span>
                            <p>No upcoming bills or one-time payments scheduled.</p>
                         </div>
                    )}
                </div>

                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-semibold text-light-text dark:text-dark-text">Recurring Transactions</h3>
                         <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                             {upcomingRecurring.length} Items
                        </span>
                    </div>
                    {upcomingRecurring.length > 0 ? (
                        renderGroupedItems(groupedRecurringItems)
                    ) : (
                        <div className="p-8 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl flex flex-col items-center justify-center text-center text-gray-500">
                            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">update_disabled</span>
                            <p>No upcoming recurring transactions found.</p>
                        </div>
                    )}
                </div>
                
                {paidItems.length > 0 && (
                    <div>
                        <h3 className="text-xl font-semibold mb-4 text-light-text dark:text-dark-text opacity-80">Recently Paid History</h3>
                         <div className="space-y-2 opacity-60 hover:opacity-100 transition-opacity">
                            {paidItems.map(item => (
                                <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="flex-shrink-0 text-center rounded-lg p-2 w-12 bg-white dark:bg-black/20 text-xs text-gray-400 border border-gray-100 dark:border-gray-800">
                                            <p className="font-bold">{parseAsUTC(item.dueDate).getUTCDate()}</p>
                                            <p className="uppercase text-[10px]">{parseAsUTC(item.dueDate).toLocaleString('default', { month: 'short', timeZone: 'UTC' })}</p>
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-600 dark:text-gray-300 line-through decoration-gray-400">{item.description}</p>
                                            <p className="text-xs text-gray-400">{accountMap[item.accountId!] || 'External'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                         <p className="font-medium text-gray-500 line-through decoration-gray-400">{formatCurrency(item.amount, item.currency)}</p>
                                         <span className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded ml-auto inline-block mt-1">Paid</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(SchedulePage);
