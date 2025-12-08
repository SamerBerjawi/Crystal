import React, { useState, useMemo } from 'react';
// FIX: Import ScheduledItem from global types and remove local definition.
import { RecurringTransaction, Account, Category, BillPayment, Currency, AccountType, RecurringTransactionOverride, ScheduledItem, Transaction, Tag, LoanPaymentOverrides } from '../types';
import Card from '../components/Card';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, LIQUID_ACCOUNT_TYPES, ACCOUNT_TYPE_STYLES, ALL_ACCOUNT_TYPES, BTN_DANGER_STYLE } from '../constants';
import { formatCurrency, convertToEur, generateSyntheticLoanPayments, generateSyntheticCreditCardPayments, generateSyntheticPropertyTransactions, parseDateAsUTC, fuzzySearch, toLocalISOString } from '../utils';
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
    
    // Check overdue based on local ISO string comparison
    const todayStr = toLocalISOString(new Date());
    const isOverdue = !item.isRecurring && item.date < todayStr;
    
    const dueDate = parseDateAsUTC(item.date);
    const day = dueDate.getDate();
    const month = dueDate.toLocaleString('default', { month: 'short' }).toUpperCase();
    const weekday = dueDate.toLocaleString('default', { weekday: 'long' });

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
             <span className={`${compact ? 'text-sm' : 'text-base'} font-bold font-mono tracking-tight privacy-blur ${amountColor}`}>
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
    let accentBg = '';

    if (isIncome) {
        colorClass = 'text-emerald-600 dark:text-emerald-400';
        bgClass = 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30';
        accentBg = 'bg-emerald-500';
        icon = 'arrow_downward';
    } else if (isNet) {
        colorClass = value >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400';
        bgClass = value >= 0 ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30' : 'bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30';
        accentBg = value >= 0 ? 'bg-blue-500' : 'bg-orange-500';
        icon = 'account_balance_wallet';
    } else {
        colorClass = 'text-rose-600 dark:text-rose-400';
        bgClass = 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30';
        accentBg = 'bg-rose-500';
        icon = 'arrow_upward';
    }

    return (
        <div className={`p-5 rounded-2xl border ${bgClass} flex flex-col justify-between h-full relative overflow-hidden shadow-sm`}>
            <div className="flex justify-between items-start z-10">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wider opacity-70 mb-1">{title}</p>
                    <h3 className={`text-2xl font-extrabold tracking-tight privacy-blur ${colorClass}`}>{formatCurrency(value, 'EUR')}</h3>
                </div>
                <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
                    <div className={`absolute inset-0 rounded-full opacity-20 ${accentBg}`}></div>
                    <div className={`relative w-10 h-10 rounded-full flex items-center justify-center bg-white/50 dark:bg-black/20 ${colorClass}`}>
                        <span className="material-symbols-outlined text-2xl leading-none">{icon}</span>
                    </div>
                </div>
            </div>
            {count !== undefined && (
                <div className="mt-3 z-10">
                    <span className="text-xs font-medium opacity-70">{count} scheduled items</span>
                </div>
            )}
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
                     <span className={`text-sm font-mono font-bold privacy-blur ${totalAmount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
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
        majorInflow,
        recurringList
    } = useMemo(() => {
        const today = new Date();
        const todayStr = toLocalISOString(today);
        const todayMidnight = parseDateAsUTC(todayStr);
        
        const forecastEndDate = new Date(todayMidnight); 
        forecastEndDate.setMonth(todayMidnight.getMonth() + 12);

        // Used for "Next 30 Days" metrics
        const next30DaysEnd = new Date(todayMidnight);
        next30DaysEnd.setDate(todayMidnight.getDate() + 30);
        
        const next7DaysEnd = new Date(todayMidnight);
        next7DaysEnd.setDate(todayMidnight.getDate() + 7);

        const allUpcomingItems: ScheduledItem[] = [];

        const syntheticLoanPayments = generateSyntheticLoanPayments(accounts, transactions, loanPaymentOverrides);
        const syntheticCreditCardPayments = generateSyntheticCreditCardPayments(accounts, transactions);
        const syntheticPropertyTransactions = generateSyntheticPropertyTransactions(accounts);
        const allRecurringTransactions = [...recurringTransactions, ...syntheticLoanPayments, ...syntheticCreditCardPayments, ...syntheticPropertyTransactions];

        // Prepare list for "List View" (Management)
        // Group synthetic loan payments by account to avoid listing every month separately
        const processedRecurringList: RecurringTransaction[] = [];
        const processedLoanAccountIds = new Set<string>();

        allRecurringTransactions.forEach(rt => {
            if (rt.isSynthetic) {
                 // Check if it is a loan or lending synthetic payment
                 // We identify them by ID prefix or check if they correspond to a loan account
                 const isLoan = rt.id.startsWith('loan-pmt-');
                 if (isLoan) {
                     // Group by account
                     if (!processedLoanAccountIds.has(rt.accountId)) {
                        processedLoanAccountIds.add(rt.accountId);
                        // Create a representative item
                        processedRecurringList.push({
                            ...rt,
                            id: `synthetic-group-${rt.accountId}`, // Unique group ID
                            description: `${rt.type === 'transfer' ? 'Loan Repayment' : 'Payment'}: ${accountMap[rt.accountId] || 'Loan Account'}`,
                            // Show grouped info, maybe sum or just one instance details
                            // We use the current rt details as representative
                        });
                     }
                     return; // Skip individual addition
                 }
            }
            // Add standard recurring and other synthetic types normally
            processedRecurringList.push(rt);
        });

        const recurringListItems = processedRecurringList.map(rt => ({
            ...rt,
            isSynthetic: rt.isSynthetic || false,
            accountName: rt.accountId === 'external' ? 'External' : (rt.type === 'transfer' ? `${accountMap[rt.accountId]} → ${accountMap[rt.toAccountId!]}` : accountMap[rt.accountId])
        }));


        // Generate occurrences for timeline
        allRecurringTransactions.forEach(rt => {
            let nextDate = parseDateAsUTC(rt.nextDueDate);
            const endDateUTC = rt.endDate ? parseDateAsUTC(rt.endDate) : null;
            const startDateUTC = parseDateAsUTC(rt.startDate);

            // Fast forward past dates before "recently"
            const startRecurringScanDate = new Date(todayMidnight);
            startRecurringScanDate.setDate(startRecurringScanDate.getDate() - 7); // Look back a week for overdue

            while (nextDate < startRecurringScanDate && (!endDateUTC || nextDate < endDateUTC)) {
                const interval = rt.frequencyInterval || 1;
                const d = new Date(nextDate);
                if (rt.frequency === 'monthly') {
                    // Use UTC methods to avoid timezone shifting when advancing
                    d.setUTCMonth(d.getUTCMonth() + interval);
                    // Keep original day or adjust
                }
                else if (rt.frequency === 'weekly') d.setUTCDate(d.getUTCDate() + (7 * interval));
                else if (rt.frequency === 'daily') d.setUTCDate(d.getUTCDate() + interval);
                else if (rt.frequency === 'yearly') d.setUTCFullYear(d.getUTCFullYear() + interval);
                nextDate = d;
            }
            
            while (nextDate <= forecastEndDate && (!endDateUTC || nextDate <= endDateUTC)) {
                // Use ISO String splitting to get date string without local timezone offset
                const originalDateStr = toLocalISOString(nextDate);
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
                
                // Advance Date using UTC methods to ensure consistent date string generation
                const interval = rt.frequencyInterval || 1;
                const d = new Date(nextDate);
                if (rt.frequency === 'monthly') {
                    const targetDay = rt.dueDateOfMonth || startDateUTC.getUTCDate();
                    d.setUTCMonth(d.getUTCMonth() + interval);
                    // Handle month length logic using UTC date
                    const year = d.getUTCFullYear();
                    const month = d.getUTCMonth();
                    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
                    d.setUTCDate(Math.min(targetDay, lastDayOfMonth));
                }
                else if (rt.frequency === 'weekly') d.setUTCDate(d.getUTCDate() + (7 * interval));
                else if (rt.frequency === 'daily') d.setUTCDate(d.getUTCDate() + interval);
                else if (rt.frequency === 'yearly') d.setUTCFullYear(d.getUTCFullYear() + interval);
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

        allUpcomingItems.sort((a, b) => parseDateAsUTC(a.date).getTime() - parseDateAsUTC(b.date).getTime());

        // --- Metrics & Grouping ---
        let totalIncome30d = 0;
        let totalExpense30d = 0;
        let incomeCount30d = 0;
        let expenseCount30d = 0;

        const categorySpending: Record<string, number> = {};
        let maxOutflowItem: ScheduledItem | null = null;
        let maxInflowItem: ScheduledItem | null = null;
        
        // Grouping for Timeline View
        const groups: Record<string, ScheduledItem[]> = {};
        
        // Filter by search query
        const filteredItems = allUpcomingItems.filter(item => 
            !searchQuery || 
            fuzzySearch(searchQuery, item.description) || 
            fuzzySearch(searchQuery, item.accountName || '')
        );

        filteredItems.forEach(item => {
            const itemDate = parseDateAsUTC(item.date);
            const isWithin30Days = itemDate >= todayMidnight && itemDate <= next30DaysEnd;

            // Metrics Calculation (only if within 30 days)
            if (isWithin30Days) {
                const amountEur = convertToEur(item.amount, (item.originalItem as any).currency);
                
                if (item.type === 'income' || item.type === 'deposit') {
                    totalIncome30d += amountEur;
                    incomeCount30d++;
                    
                    if (!maxInflowItem || amountEur > convertToEur(maxInflowItem.amount, (maxInflowItem.originalItem as any).currency)) {
                        maxInflowItem = item;
                    }
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
            // Use string comparison for consistency with TodayWidget
            if (item.date < todayStr) {
                if (!groups['Overdue']) groups['Overdue'] = [];
                groups['Overdue'].push(item);
            } else if (item.date === todayStr) {
                if (!groups['Today']) groups['Today'] = [];
                groups['Today'].push(item);
            } else if (itemDate <= next7DaysEnd) {
                if (!groups['Next 7 Days']) groups['Next 7 Days'] = [];
                groups['Next 7 Days'].push(item);
            } else {
                const monthYear = itemDate.toLocaleString('default', { month: 'long', year: 'numeric' });
                if (!groups[monthYear]) groups[monthYear] = [];
                groups[monthYear].push(item);
            }
        });

        // Define custom sort order for group keys
        const monthKeys = Object.keys(groups).filter(k => k !== 'Overdue' && k !== 'Today' && k !== 'Next 7 Days');
        // Sort month keys chronologically based on the date of the first item in each group
        monthKeys.sort((a, b) => {
             const dateA = parseDateAsUTC(groups[a][0].date);
             const dateB = parseDateAsUTC(groups[b][0].date);
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
            majorInflow: maxInflowItem,
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
            const postedDate = parseDateAsUTC(itemToPost.date);
            let nextDueDate = new Date(postedDate);
            const interval = rt.frequencyInterval || 1;
            const startDateUTC = parseDateAsUTC(rt.startDate);

            // Simple advance logic
            switch (rt.frequency) {
                case 'daily': nextDueDate.setDate(nextDueDate.getDate() + interval); break;
                case 'weekly': nextDueDate.setDate(nextDueDate.getDate() + 7 * interval); break;
                case 'monthly': {
                    const d = rt.dueDateOfMonth || startDateUTC.getDate();
                    nextDueDate.setMonth(nextDueDate.getMonth() + interval, 1);
                    const lastDayOfNextMonth = new Date(nextDueDate.getFullYear(), nextDueDate.getMonth() + 1, 0).getDate();
                    nextDueDate.setDate(Math.min(d, lastDayOfNextMonth));
                    break;
                }
                case 'yearly': {
                    nextDueDate.setFullYear(nextDueDate.getFullYear() + interval);
                    break;
                }
            }
            saveRecurringTransaction({ ...rt, nextDueDate: toLocalISOString(nextDueDate) });
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

            {/* TOP SECTION: Visual Activity & Highlights */}
            <div className="space