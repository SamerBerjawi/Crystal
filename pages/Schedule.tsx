
import React, { useState, useMemo } from 'react';
// FIX: Import ScheduledItem from global types and remove local definition.
import { RecurringTransaction, Account, Category, BillPayment, Currency, AccountType, RecurringTransactionOverride, ScheduledItem, Transaction, Tag, LoanPaymentOverrides } from '../types';
import Card from '../components/Card';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, LIQUID_ACCOUNT_TYPES, ACCOUNT_TYPE_STYLES, ALL_ACCOUNT_TYPES, BTN_DANGER_STYLE } from '../constants';
import { formatCurrency, convertToEur, generateSyntheticLoanPayments, generateSyntheticCreditCardPayments, generateSyntheticPropertyTransactions, parseDateAsUTC, fuzzySearch } from '../utils';
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
    compact?: boolean;
}> = ({ item, accounts, onEdit, onDelete, onPost, isReadOnly = false, compact = false }) => {
    
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
      <div className={`group relative flex items-center gap-4 ${compact ? 'p-3' : 'p-4'} bg-white dark:bg-dark-card rounded-xl border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-200`}>
        {/* Date Block */}
        <div className={`flex-shrink-0 flex flex-col items-center justify-center ${compact ? 'w-10 h-10 rounded-lg' : 'w-14 h-14 rounded-xl'} border ${isOverdue ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-gray-50 dark:bg-white/5 border-black/5 dark:border-white/10'}`}>
            <span className={`${compact ? 'text-[8px]' : 'text-[10px]'} font-bold uppercase tracking-wider ${isOverdue ? 'text-red-500' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>{month}</span>
            <span className={`${compact ? 'text-sm' : 'text-xl'} font-extrabold leading-none ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-light-text dark:text-dark-text'}`}>{day}</span>
        </div>

        {/* Content */}
        <div className="flex-grow min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
                <h4 className={`font-bold text-light-text dark:text-dark-text truncate ${compact ? 'text-sm' : 'text-base'}`}>{item.description}</h4>
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
             <span className={`${compact ? 'text-sm' : 'text-base'} font-bold font-mono tracking-tight ${amountColor}`}>
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

// --- Collapsible Group Component ---
const ScheduleGroup = ({ title, items, accounts, onEdit, onDelete, onPost, defaultOpen = true, totalAmount }: any) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    
    return (
        <div className="mb-6 last:mb-0">
            <div 
                className="flex justify-between items-center p-2 mb-2 cursor-pointer rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors select-none"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-3">
                     <div className={`p-1 rounded-md transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}>
                         <span className="material-symbols-outlined text-light-text-secondary dark:text-dark-text-secondary">expand_more</span>
                     </div>
                     <h3 className={`text-base font-bold ${title === 'Overdue' ? 'text-red-600 dark:text-red-400' : 'text-light-text dark:text-dark-text'}`}>
                        {title}
                     </h3>
                     <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-full">
                        {items.length}
                     </span>
                </div>
                <div className="flex items-center gap-4">
                     <span className={`text-sm font-mono font-bold ${totalAmount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {formatCurrency(totalAmount, 'EUR', { showPlusSign: true })}
                    </span>
                </div>
            </div>
            
            {isOpen && (
                <div className="space-y-3 pl-2">
                     {items.map((item: any) => (
                        <ScheduledItemRow 
                            key={item.id} 
                            item={item} 
                            accounts={accounts} 
                            onEdit={onEdit} 
                            onDelete={onDelete} 
                            onPost={onPost} 
                            isReadOnly={item.isRecurring && item.originalItem.isSynthetic} 
                        />
                     ))}
                </div>
            )}
        </div>
    );
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

    const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline');
    const [searchQuery, setSearchQuery] = useState('');
    const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
    const [isBillModalOpen, setIsBillModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<RecurringTransaction | null>(null);
    const [editingBill, setEditingBill] = useState<BillPayment | null>(null);
    const [editChoiceItem, setEditChoiceItem] = useState<ScheduledItem | null>(null);
    const [overrideModalItem, setOverrideModalItem] = useState<ScheduledItem | null>(null);
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [itemToPost, setItemToPost] = useState<ScheduledItem | null>(null);

    const accountMap = React.useMemo(() => accounts.reduce((acc, current) => {
        acc[current.id] = current.name;
        return acc;
    }, {} as Record<string, string>), [accounts]);
    
    // --- Data Processing ---
    const { 
        groupedItems,
        sortedGroupKeys,
        allUpcomingForHeatmap, 
        summaryMetrics,
        categoryBreakdown,
        majorOutflow,
        recurringList
    } = useMemo(() => {
        const today = new Date();
        const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
        const forecastEndDate = new Date(todayUTC); forecastEndDate.setUTCMonth(todayUTC.getUTCMonth() + 12);

        // Used for "Next 30 Days" metrics
        const next30DaysEnd = new Date(todayUTC);
        next30DaysEnd.setUTCDate(todayUTC.getUTCDate() + 30);
        
        const next7DaysEnd = new Date(todayUTC);
        next7DaysEnd.setUTCDate(todayUTC.getUTCDate() + 7);

        const allUpcomingItems: ScheduledItem[] = [];

        const syntheticLoanPayments = generateSyntheticLoanPayments(accounts, transactions, loanPaymentOverrides);
        const syntheticCreditCardPayments = generateSyntheticCreditCardPayments(accounts, transactions);
        const syntheticPropertyTransactions = generateSyntheticPropertyTransactions(accounts);
        const allRecurringTransactions = [...recurringTransactions, ...syntheticLoanPayments, ...syntheticCreditCardPayments, ...syntheticPropertyTransactions];

        // Prepare list for "List View" (Management)
        const recurringListItems = allRecurringTransactions.map(rt => ({
            ...rt,
            isSynthetic: rt.isSynthetic || false,
            accountName: rt.accountId === 'external' ? 'External' : (rt.type === 'transfer' ? `${accountMap[rt.accountId]} → ${accountMap[rt.toAccountId!]}` : accountMap[rt.accountId])
        }));


        // Generate occurrences for timeline
        allRecurringTransactions.forEach(rt => {
            let nextDate = parseAsUTC(rt.nextDueDate);
            const endDateUTC = rt.endDate ? parseAsUTC(rt.endDate) : null;
            const startDateUTC = parseAsUTC(rt.startDate);

            // Fast forward past dates before "recently"
            const startRecurringScanDate = new Date(todayUTC);
            startRecurringScanDate.setUTCDate(startRecurringScanDate.getUTCDate() - 30); // Look back a month for overdue

            while (nextDate < startRecurringScanDate && (!endDateUTC || nextDate < endDateUTC)) {
                const interval = rt.frequencyInterval || 1;
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
                    const lastDayOfMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
                    d.setUTCDate(Math.min(targetDay, lastDayOfMonth));
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

        // --- Metrics & Grouping ---
        let totalIncome30d = 0;
        let totalExpense30d = 0;
        let incomeCount30d = 0;
        let expenseCount30d = 0;

        const categorySpending: Record<string, number> = {};
        let maxOutflowItem: ScheduledItem | null = null;
        
        // Grouping for Timeline View
        const groups: Record<string, ScheduledItem[]> = {};
        
        // Filter by search query
        const filteredItems = allUpcomingItems.filter(item => 
            !searchQuery || 
            fuzzySearch(searchQuery, item.description) || 
            fuzzySearch(searchQuery, item.accountName || '')
        );

        filteredItems.forEach(item => {
            const itemDate = parseAsUTC(item.date);
            const isWithin30Days = itemDate >= todayUTC && itemDate <= next30DaysEnd;

            // Metrics Calculation (only if within 30 days)
            if (isWithin30Days) {
                const amountEur = convertToEur(item.amount, (item.originalItem as any).currency);
                
                if (item.type === 'income' || item.type === 'deposit') {
                    totalIncome30d += amountEur;
                    incomeCount30d++;
                } else if (item.type === 'expense' || item.type === 'payment') {
                    totalExpense30d += Math.abs(amountEur);
                    expenseCount30d++;
                    
                    let catName = 'Other';
                    if (item.isRecurring) {
                        const rt = item.originalItem as RecurringTransaction;
                        if (rt.category) catName = rt.category;
                    } else {
                        const bill = item.originalItem as BillPayment;
                        if (bill.type === 'payment') catName = 'Bills';
                    }
                    categorySpending[catName] = (categorySpending[catName] || 0) + Math.abs(amountEur);

                    if (!maxOutflowItem || Math.abs(amountEur) > Math.abs(convertToEur(maxOutflowItem.amount, (maxOutflowItem.originalItem as any).currency))) {
                        maxOutflowItem = item;
                    }
                }
            }

            // Grouping Logic
            if (itemDate < todayUTC) {
                if (!groups['Overdue']) groups['Overdue'] = [];
                groups['Overdue'].push(item);
            } else if (itemDate.getTime() === todayUTC.getTime()) {
                if (!groups['Today']) groups['Today'] = [];
                groups['Today'].push(item);
            } else if (itemDate <= next7DaysEnd) {
                if (!groups['Next 7 Days']) groups['Next 7 Days'] = [];
                groups['Next 7 Days'].push(item);
            } else {
                const monthYear = itemDate.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
                if (!groups[monthYear]) groups[monthYear] = [];
                groups[monthYear].push(item);
            }
        });

        // Define custom sort order for group keys
        const monthKeys = Object.keys(groups).filter(k => k !== 'Overdue' && k !== 'Today' && k !== 'Next 7 Days');
        // Sort month keys chronologically based on the date of the first item in each group
        monthKeys.sort((a, b) => {
             const dateA = parseAsUTC(groups[a][0].date);
             const dateB = parseAsUTC(groups[b][0].date);
             return dateA.getTime() - dateB.getTime();
        });
        
        const sortedGroupKeys = [
            groups['Overdue'] ? 'Overdue' : null,
            groups['Today'] ? 'Today' : null,
            groups['Next 7 Days'] ? 'Next 7 Days' : null,
            ...monthKeys
        ].filter(Boolean) as string[];


        const categoryBreakdownData = Object.entries(categorySpending)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5); // Top 5

        return {
            groupedItems: groups,
            sortedGroupKeys,
            allUpcomingForHeatmap: allUpcomingItems, // Use unfiltered for heatmap to show full picture
            summaryMetrics: {
                income: totalIncome30d,
                expense: totalExpense30d,
                net: totalIncome30d - totalExpense30d,
                incCount: incomeCount30d,
                expCount: expenseCount30d
            },
            categoryBreakdown: categoryBreakdownData,
            majorOutflow: maxOutflowItem,
            recurringList: recurringListItems.filter(item => !searchQuery || fuzzySearch(searchQuery, item.description) || fuzzySearch(searchQuery, item.accountName || ''))
        };
    }, [recurringTransactions, billsAndPayments, accounts, accountMap, recurringTransactionOverrides, transactions, searchQuery, loanPaymentOverrides]);

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
            if (window.confirm('Delete this recurring series?')) {
                deleteRecurringTransaction(id);
            }
        } else {
            if (window.confirm('Delete this bill?')) {
                deleteBillPayment(id);
            }
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
                <div className="xl:col-span-2 space-y-6">
                    
                    {/* Controls & Tabs */}
                    <div className="flex flex-col sm:flex-row justify-between gap-4 bg-light-card dark:bg-dark-card p-2 rounded-xl shadow-sm border border-black/5 dark:border-white/5">
                         <div className="flex bg-light-fill dark:bg-dark-fill p-1 rounded-lg w-full sm:w-auto">
                            <button 
                                onClick={() => setViewMode('timeline')} 
                                className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${viewMode === 'timeline' ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-sm' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}
                            >
                                <span className="material-symbols-outlined text-base">calendar_view_day</span>
                                Timeline
                            </button>
                            <button 
                                onClick={() => setViewMode('list')} 
                                className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${viewMode === 'list' ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-sm' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}
                            >
                                <span className="material-symbols-outlined text-base">list</span>
                                Recurring Rules
                            </button>
                        </div>
                        <div className="relative flex-grow max-w-md">
                             <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none">search</span>
                             <input 
                                type="text" 
                                placeholder={viewMode === 'timeline' ? "Search upcoming..." : "Search rules..."} 
                                value={searchQuery} 
                                onChange={(e) => setSearchQuery(e.target.value)} 
                                className={`${INPUT_BASE_STYLE} pl-10 w-full !h-10 !bg-transparent border-none focus:ring-0`}
                             />
                        </div>
                    </div>

                    {viewMode === 'timeline' ? (
                         <div className="space-y-8">
                            {sortedGroupKeys.map(groupKey => {
                                const items = groupedItems[groupKey];
                                if (!items || items.length === 0) return null;
                                const groupTotal = items.reduce((sum, item) => sum + convertToEur(item.amount, (item.originalItem as any).currency), 0);

                                return (
                                    <ScheduleGroup 
                                        key={groupKey} 
                                        title={groupKey} 
                                        items={items} 
                                        accounts={accounts} 
                                        onEdit={handleEditItem} 
                                        onDelete={handleDeleteItem} 
                                        onPost={handleOpenPostModal}
                                        totalAmount={groupTotal}
                                        defaultOpen={['Overdue', 'Today', 'Next 7 Days'].includes(groupKey)}
                                    />
                                );
                            })}
                            
                            {sortedGroupKeys.length === 0 && (
                                 <div className="text-center py-12 bg-light-card dark:bg-dark-card rounded-xl border border-dashed border-black/10 dark:border-white/10">
                                    <span className="material-symbols-outlined text-4xl text-gray-400 mb-2">event_busy</span>
                                    <p className="text-light-text-secondary dark:text-dark-text-secondary">No upcoming items found.</p>
                                 </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                             {recurringList.map((rt) => (
                                <div key={rt.id} className="flex items-center justify-between p-4 bg-white dark:bg-dark-card rounded-xl border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md transition-all">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-light-text dark:text-dark-text">{rt.description}</h4>
                                            {rt.isSynthetic && (
                                                <span className="text-[10px] font-bold bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded uppercase">Auto</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                            <span className="capitalize bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded">{rt.frequency}</span>
                                            <span>Next: {rt.nextDueDate}</span>
                                            <span className="truncate max-w-[150px]">{rt.accountName}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-bold font-mono ${rt.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-light-text dark:text-dark-text'}`}>
                                            {formatCurrency(rt.amount, rt.currency)}
                                        </p>
                                        <div className="flex justify-end gap-2 mt-2">
                                            <button 
                                                onClick={() => handleOpenRecurringModal(rt as RecurringTransaction)} 
                                                className="text-light-text-secondary hover:text-primary-500 transition-colors disabled:opacity-30"
                                                disabled={rt.isSynthetic}
                                                title="Edit"
                                            >
                                                <span className="material-symbols-outlined text-lg">edit</span>
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteItem(rt.id, true)} 
                                                className="text-light-text-secondary hover:text-red-500 transition-colors disabled:opacity-30"
                                                disabled={rt.isSynthetic}
                                                title="Delete"
                                            >
                                                <span className="material-symbols-outlined text-lg">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                             ))}
                             {recurringList.length === 0 && (
                                 <div className="text-center py-12 bg-light-card dark:bg-dark-card rounded-xl border border-dashed border-black/10 dark:border-white/10">
                                    <p className="text-light-text-secondary dark:text-dark-text-secondary">No recurring transactions found.</p>
                                 </div>
                             )}
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
