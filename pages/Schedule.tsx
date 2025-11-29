
import React, { useState, useMemo } from 'react';
// FIX: Import ScheduledItem from global types and remove local definition.
import { RecurringTransaction, Account, Category, BillPayment, Currency, AccountType, RecurringTransactionOverride, ScheduledItem, Transaction, Tag, LoanPaymentOverrides } from '../types';
import Card from '../components/Card';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, LIQUID_ACCOUNT_TYPES, ACCOUNT_TYPE_STYLES, ALL_ACCOUNT_TYPES } from '../constants';
import { formatCurrency, convertToEur, generateSyntheticLoanPayments, generateSyntheticCreditCardPayments, generateSyntheticPropertyTransactions, parseDateAsUTC } from '../utils';
import RecurringTransactionModal from '../components/RecurringTransactionModal';
import Modal from '../components/Modal';
import ScheduleHeatmap from '../components/ScheduleHeatmap';
import EditRecurrenceModal from '../components/EditRecurrenceModal';
import RecurringOverrideModal from '../components/RecurringOverrideModal';
import AddTransactionModal from '../components/AddTransactionModal';
import BillPaymentModal from '../components/BillPaymentModal';
import { useAccountsContext, useTransactionsContext } from '../contexts/DomainProviders';
import { useCategoryContext, useScheduleContext, useTagsContext } from '../contexts/FinancialDataContext';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

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
    const weekday = dueDate.toLocaleString('default', { weekday: 'long', timeZone: 'UTC' });

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
      <div className="group relative flex items-center gap-4 p-4 bg-white dark:bg-dark-card rounded-xl border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-200">
        {/* Date Block */}
        <div className={`flex-shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-xl border ${isOverdue ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-gray-50 dark:bg-white/5 border-black/5 dark:border-white/10'}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isOverdue ? 'text-red-500' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>{month}</span>
            <span className={`text-xl font-extrabold leading-none ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-light-text dark:text-dark-text'}`}>{day}</span>
        </div>

        {/* Content */}
        <div className="flex-grow min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
                <h4 className="font-bold text-light-text dark:text-dark-text truncate text-base">{item.description}</h4>
                {item.isOverride && (
                    <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 uppercase tracking-wide">Modified</span>
                )}
                 {isOverdue && (
                    <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 uppercase tracking-wide">Overdue</span>
                )}
            </div>
            <div className="flex items-center gap-3 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                <span className="font-medium">{weekday}</span>
                <span className="w-1 h-1 rounded-full bg-current opacity-40"></span>
                <span className="flex items-center gap-1 truncate">
                    <span className="material-symbols-outlined text-[14px]">{isTransfer ? 'swap_horiz' : (item.isRecurring ? 'repeat' : 'receipt')}</span>
                    {subText}
                </span>
            </div>
        </div>

        {/* Amount & Actions */}
        <div className="flex flex-col items-end gap-1">
             <span className={`text-base font-bold font-mono tracking-tight ${amountColor}`}>
                {formatCurrency(item.amount, 'EUR')}
             </span>
             
             <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${isReadOnly ? 'invisible' : ''}`}>
                <button 
                    onClick={(e) => { e.stopPropagation(); onPost(item); }}
                    className="p-1 rounded-md bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors" 
                    title="Post Transaction"
                >
                    <span className="material-symbols-outlined text-[18px]">check</span>
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                    className="p-1 rounded-md text-light-text-secondary hover:bg-black/5 dark:hover:bg-white/10 transition-colors" 
                    title="Edit"
                >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(item.originalItem.id, item.isRecurring); }}
                    className="p-1 rounded-md text-light-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" 
                    title="Delete"
                >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
             </div>
        </div>
      </div>
    );
};

// --- Summary Card Component ---
const ScheduleSummaryCard: React.FC<{ title: string; value: number; type: 'income' | 'expense' | 'net'; count?: number }> = ({ title, value, type, count }) => {
    const isIncome = type === 'income';
    const isNet = type === 'net';
    
    let colorClass = '';
    let icon = '';
    let bgClass = '';

    if (isIncome) {
        colorClass = 'text-emerald-600 dark:text-emerald-400';
        bgClass = 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30';
        icon = 'arrow_downward';
    } else if (isNet) {
        colorClass = value >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400';
        bgClass = value >= 0 ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30' : 'bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30';
        icon = 'account_balance_wallet';
    } else {
        colorClass = 'text-rose-600 dark:text-rose-400';
        bgClass = 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30';
        icon = 'arrow_upward';
    }

    return (
        <div className={`p-5 rounded-2xl border ${bgClass} flex flex-col justify-between h-full relative overflow-hidden`}>
             <div className="flex justify-between items-start z-10">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wider opacity-70 mb-1">{title}</p>
                    <h3 className={`text-2xl font-extrabold tracking-tight ${colorClass}`}>{formatCurrency(value, 'EUR')}</h3>
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-white/50 dark:bg-black/20 ${colorClass}`}>
                    <span className="material-symbols-outlined">{icon}</span>
                </div>
            </div>
            {count !== undefined && (
                <div className="mt-3 z-10">
                    <span className="text-xs font-medium opacity-70">{count} scheduled items</span>
                </div>
            )}
            {/* Decorator */}
            <div className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-10 ${isIncome ? 'bg-emerald-500' : isNet ? 'bg-blue-500' : 'bg-rose-500'}`}></div>
        </div>
    )
}

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
    
    // --- Data Processing ---
    const { 
        upcomingRecurring, 
        upcomingBills, 
        paidItems, 
        allUpcomingForHeatmap, 
        summaryMetrics,
        categoryBreakdown,
        majorOutflow
    } = useMemo(() => {
        const today = new Date();
        const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
        const forecastEndDate = new Date(todayUTC); forecastEndDate.setUTCMonth(todayUTC.getUTCMonth() + 12);

        // Used for "Next 30 Days" metrics
        const next30DaysEnd = new Date(todayUTC);
        next30DaysEnd.setUTCDate(todayUTC.getUTCDate() + 30);

        const allUpcomingItems: ScheduledItem[] = [];

        const syntheticLoanPayments = generateSyntheticLoanPayments(accounts, transactions, loanPaymentOverrides);
        const syntheticCreditCardPayments = generateSyntheticCreditCardPayments(accounts, transactions);
        const syntheticPropertyTransactions = generateSyntheticPropertyTransactions(accounts);
        const allRecurringTransactions = [...recurringTransactions, ...syntheticLoanPayments, ...syntheticCreditCardPayments, ...syntheticPropertyTransactions];

        allRecurringTransactions.forEach(rt => {
            let nextDate = parseAsUTC(rt.nextDueDate);
            const endDateUTC = rt.endDate ? parseAsUTC(rt.endDate) : null;
            const startDateUTC = parseAsUTC(rt.startDate);

            // Fast forward past dates before "recently"
            const startRecurringScanDate = new Date(todayUTC);
            startRecurringScanDate.setUTCDate(startRecurringScanDate.getUTCDate() - 7); // Look back a week for overdue

            while (nextDate < startRecurringScanDate && (!endDateUTC || nextDate < endDateUTC)) {
                const interval = rt.frequencyInterval || 1;
                // Simplified increment logic for brevity, full logic in utils
                const d = new Date(nextDate);
                if (rt.frequency === 'monthly') d.setMonth(d.getMonth() + interval);
                else if (rt.frequency === 'weekly') d.setDate(d.getDate() + (7 * interval));
                else if (rt.frequency === 'daily') d.setDate(d.getDate() + interval);
                else if (rt.frequency === 'yearly') d.setFullYear(d.getFullYear() + interval);
                nextDate = d;
            }
            
            while (nextDate <= forecastEndDate && (!endDateUTC || nextDate <= endDateUTC)) {
                const originalDateStr = nextDate.toISOString().split('T')[0];
                const override = recurringTransactionOverrides.find(o => o.recurringTransactionId === rt.id && o.originalDate === originalDateStr);

                if (!override?.isSkipped) {
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
                
                // Advance Date
                const interval = rt.frequencyInterval || 1;
                const d = new Date(nextDate);
                if (rt.frequency === 'monthly') {
                    const targetDay = rt.dueDateOfMonth || startDateUTC.getUTCDate();
                    d.setMonth(d.getMonth() + interval);
                    // Handle month length logic basic
                    d.setDate(targetDay); // Simplified
                }
                else if (rt.frequency === 'weekly') d.setDate(d.getDate() + (7 * interval));
                else if (rt.frequency === 'daily') d.setDate(d.getDate() + interval);
                else if (rt.frequency === 'yearly') d.setFullYear(d.getFullYear() + interval);
                nextDate = d;
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

        // --- Splits & Metrics ---
        const upcomingRecurringItems: ScheduledItem[] = [];
        const upcomingBillsItems: ScheduledItem[] = [];
        
        let totalIncome30d = 0;
        let totalExpense30d = 0;
        let incomeCount30d = 0;
        let expenseCount30d = 0;

        const categorySpending: Record<string, number> = {};
        let maxOutflowItem: ScheduledItem | null = null;

        allUpcomingItems.forEach(item => {
            const itemDate = parseAsUTC(item.date);
            const isWithin30Days = itemDate >= todayUTC && itemDate <= next30DaysEnd;

            // Populate lists (filter out very old items if needed, here we keep them as overdue)
            if (item.isRecurring) {
                 // Filter logic for bills vs recurring
                 const rt = item.originalItem as RecurringTransaction;
                 if (rt.isSynthetic && rt.id.startsWith('cc-pmt-')) upcomingBillsItems.push(item);
                 else upcomingRecurringItems.push(item);
            } else {
                upcomingBillsItems.push(item);
            }

            // Metrics Calculation
            if (isWithin30Days) {
                const amountEur = convertToEur(item.amount, (item.originalItem as any).currency);
                
                if (item.type === 'income' || item.type === 'deposit') {
                    totalIncome30d += amountEur;
                    incomeCount30d++;
                } else if (item.type === 'expense' || item.type === 'payment') {
                    totalExpense30d += Math.abs(amountEur);
                    expenseCount30d++;
                    
                    // Category Breakdown
                    let catName = 'Other';
                    if (item.isRecurring) {
                        const rt = item.originalItem as RecurringTransaction;
                        if (rt.category) catName = rt.category;
                    } else {
                        const bill = item.originalItem as BillPayment;
                        if (bill.type === 'payment') catName = 'Bills';
                    }
                    categorySpending[catName] = (categorySpending[catName] || 0) + Math.abs(amountEur);

                    // Max Outflow
                    if (!maxOutflowItem || Math.abs(amountEur) > Math.abs(convertToEur(maxOutflowItem.amount, (maxOutflowItem.originalItem as any).currency))) {
                        maxOutflowItem = item;
                    }
                }
            }
        });

        const categoryBreakdownData = Object.entries(categorySpending)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5); // Top 5

        const paidItems = billsAndPayments
            .filter(b => b.status === 'paid')
            .sort((a, b) => parseAsUTC(b.dueDate).getTime() - parseAsUTC(a.dueDate).getTime())
            .slice(0, 10);

        return {
            upcomingRecurring: upcomingRecurringItems,
            upcomingBills: upcomingBillsItems,
            paidItems,
            allUpcomingForHeatmap: allUpcomingItems,
            summaryMetrics: {
                income: totalIncome30d,
                expense: totalExpense30d,
                net: totalIncome30d - totalExpense30d,
                incCount: incomeCount30d,
                expCount: expenseCount30d
            },
            categoryBreakdown: categoryBreakdownData,
            majorOutflow: maxOutflowItem
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

            // Simple advance logic
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
                    nextDueDate.setUTCFullYear(nextDueDate.getUTCFullYear() + interval);
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
    
    // Merge lists for main view
    const combinedItems = [...upcomingRecurring, ...upcomingBills];
    const groupedItems = groupItems(combinedItems);

    const PIE_COLORS = ['#6366F1', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6'];

    return (
        <div className="space-y-8 pb-8 animate-fade-in-up">
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
            
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                     <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">Schedule & Bills</h1>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Manage your recurring payments and forecast obligations.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => handleOpenBillModal()} className={BTN_SECONDARY_STYLE}>
                        <span className="material-symbols-outlined mr-2">receipt</span> Add Bill
                    </button>
                    <button onClick={() => handleOpenRecurringModal()} className={BTN_PRIMARY_STYLE}>
                        <span className="material-symbols-outlined mr-2">update</span> Add Recurring
                    </button>
                </div>
            </header>

            {/* Summary Metrics - Top Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <ScheduleSummaryCard title="Scheduled Income (30d)" value={summaryMetrics.income} type="income" count={summaryMetrics.incCount} />
                <ScheduleSummaryCard title="Scheduled Expenses (30d)" value={summaryMetrics.expense} type="expense" count={summaryMetrics.expCount} />
                <ScheduleSummaryCard title="Net Forecast (30d)" value={summaryMetrics.net} type="net" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                
                {/* Main Column: Scheduled Items */}
                <div className="xl:col-span-2 space-y-8">
                    {['Overdue', 'Today', 'Next 7 Days', 'Next 30 Days', 'Later'].map(groupKey => {
                        const items = groupedItems[groupKey];
                        if (!items || items.length === 0) return null;
                        
                        const groupTotal = items.reduce((sum, item) => sum + convertToEur(item.amount, (item.originalItem as any).currency), 0);

                        return (
                            <div key={groupKey}>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className={`text-lg font-bold flex items-center gap-2 ${groupKey === 'Overdue' ? 'text-red-600 dark:text-red-400' : 'text-light-text dark:text-dark-text'}`}>
                                        {groupKey === 'Overdue' && <span className="material-symbols-outlined">warning</span>}
                                        {groupKey} 
                                        <span className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full">{items.length}</span>
                                    </h3>
                                    <span className={`text-sm font-mono font-bold ${groupTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                        {formatCurrency(groupTotal, 'EUR', { showPlusSign: true })}
                                    </span>
                                </div>
                                <div className="space-y-3">
                                    {items.map(item => (
                                        <ScheduledItemRow 
                                            key={item.id} 
                                            item={item} 
                                            accounts={accounts} 
                                            onEdit={handleEditItem} 
                                            onDelete={handleDeleteItem} 
                                            onPost={handleOpenPostModal}
                                            isReadOnly={item.isRecurring && (item.originalItem as RecurringTransaction).isSynthetic} 
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                    
                    {combinedItems.length === 0 && (
                         <div className="text-center py-12 bg-light-card dark:bg-dark-card rounded-xl border border-dashed border-black/10 dark:border-white/10">
                            <span className="material-symbols-outlined text-4xl text-gray-400 mb-2">event_busy</span>
                            <p className="text-light-text-secondary dark:text-dark-text-secondary">No scheduled items found.</p>
                         </div>
                    )}
                </div>

                {/* Sidebar Column: Analysis */}
                <div className="space-y-8">
                    {/* Calendar Heatmap */}
                    <ScheduleHeatmap items={allUpcomingForHeatmap} />

                    {/* Category Breakdown */}
                    <Card>
                        <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-4">Expense Breakdown (30d)</h3>
                        {categoryBreakdown.length > 0 ? (
                             <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={categoryBreakdown}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {categoryBreakdown.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="none" />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip 
                                            formatter={(val: number) => formatCurrency(val, 'EUR')}
                                            contentStyle={{ backgroundColor: 'var(--light-card)', borderColor: 'rgba(0,0,0,0.1)', borderRadius: '8px', color: 'var(--light-text)' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="mt-4 space-y-2">
                                    {categoryBreakdown.map((cat, idx) => (
                                        <div key={cat.name} className="flex justify-between text-sm">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></div>
                                                <span className="text-light-text dark:text-dark-text">{cat.name}</span>
                                            </div>
                                            <span className="font-medium">{formatCurrency(cat.value, 'EUR')}</span>
                                        </div>
                                    ))}
                                </div>
                             </div>
                        ) : (
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary text-center py-8">No upcoming expenses.</p>
                        )}
                    </Card>

                    {/* Next Major Outflow */}
                    {majorOutflow && (
                        <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                                <span className="material-symbols-outlined text-8xl">payments</span>
                            </div>
                            <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">Next Major Outflow</p>
                            <h3 className="text-2xl font-extrabold mb-4">{formatCurrency(Math.abs(majorOutflow.amount), (majorOutflow.originalItem as any).currency)}</h3>
                            
                            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                                <p className="font-bold text-sm truncate">{majorOutflow.description}</p>
                                <p className="text-xs opacity-80 mt-1">Due {parseAsUTC(majorOutflow.date).toLocaleDateString()}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default React.memo(SchedulePage);
