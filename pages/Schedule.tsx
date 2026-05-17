
import React, { useState, useMemo } from 'react';
import { RecurringTransaction, Account, Category, BillPayment, Currency, AccountType, RecurringTransactionOverride, ScheduledItem, Transaction, Tag, LoanPaymentOverrides } from '../types';
import Card from '../components/Card';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, LIQUID_ACCOUNT_TYPES, ACCOUNT_TYPE_STYLES, ALL_ACCOUNT_TYPES, BTN_DANGER_STYLE } from '../constants';
import { formatCurrency, convertToEur, generateSyntheticLoanPayments, generateSyntheticCreditCardPayments, generateSyntheticPropertyTransactions, parseLocalDate, fuzzySearch, toLocalISOString, adjustDateForWeekend } from '../utils';
import RecurringTransactionModal from '../components/RecurringTransactionModal';
import Modal from '../components/Modal';
import ScheduleHeatmap from '../components/ScheduleHeatmap';
import EditRecurrenceModal from '../components/EditRecurrenceModal';
import RecurringOverrideModal from '../components/RecurringOverrideModal';
import AddTransactionModal from '../components/AddTransactionModal';
import BillPaymentModal from '../components/BillPaymentModal';
import { useAccountsContext, useTransactionsContext } from '../contexts/DomainProviders';
import { useCategoryContext, useScheduleContext, useTagsContext, useGoalsContext } from '../contexts/FinancialDataContext';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import PageHeader from '../components/PageHeader';
import ScheduledItemRow from '../components/ScheduledItemRow';
import ConfirmationModal from '../components/ConfirmationModal';
import CalendarView from '../components/CalendarView';
import { v4 as uuidv4 } from 'uuid';

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
        bgClass = value >= 0 ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800/30' : 'bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30';
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
                    <h3 className={`text-2xl font-extrabold tracking-tight ${colorClass}`}>{formatCurrency(value, 'EUR')}</h3>
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
const ScheduleGroup = ({ title, items, accounts, onEdit, onDelete, onPost, onEndSeries, defaultOpen = true, totalAmount }: any) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    
    return (
        <div className="mb-10 last:mb-0">
            <div 
                className="flex justify-between items-center px-4 py-3 mb-4 cursor-pointer rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-all group/hdr"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-4">
                     <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${isOpen ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'bg-gray-100 dark:bg-white/5 text-light-text-secondary'}`}>
                         <span className={`material-symbols-outlined text-xl transition-transform duration-300 ${isOpen ? '' : '-rotate-90'}`}>expand_more</span>
                     </div>
                     <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <h3 className={`text-base font-black uppercase tracking-widest ${title === 'Overdue' ? 'text-rose-600' : 'text-light-text dark:text-dark-text'}`}>
                                {title}
                            </h3>
                            <span className="text-[10px] font-black text-light-text-secondary/90 dark:text-dark-text-secondary/90 bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-full tabular-nums">
                                {items.length}
                            </span>
                        </div>
                     </div>
                </div>
                <div className="flex items-center gap-4">
                     <div className="text-right">
                        <div className="text-[10px] font-black uppercase tracking-widest text-light-text-secondary/90 dark:text-dark-text-secondary/90">Projected Delta</div>
                        <span className={`text-lg font-black tabular-nums tracking-tighter ${totalAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {formatCurrency(totalAmount, 'EUR', { showPlusSign: true })}
                        </span>
                     </div>
                </div>
            </div>
            
            {isOpen && (
                <div className="space-y-2 pl-4 border-l-2 border-black/5 dark:border-white/5 ml-8">
                     {items.map((item: any) => (
                        <ScheduledItemRow 
                            key={item.id} 
                            item={item} 
                            accounts={accounts} 
                            onEdit={onEdit} 
                            onDelete={onDelete} 
                            onPost={onPost}
                            onEndSeries={onEndSeries} 
                            isReadOnly={item.isRecurring && item.originalItem.isSynthetic} 
                        />
                     ))}
                </div>
            )}
        </div>
    );
}

// --- Main Page Component ---

import { motion, AnimatePresence } from 'motion/react';

type ScheduleSegment = 'all' | 'timeline' | 'calendar' | 'rules';

const SchedulePage: React.FC = () => {
    const { accounts } = useAccountsContext();
    const { transactions, saveTransaction } = useTransactionsContext();
    const { incomeCategories, expenseCategories } = useCategoryContext();
    const { tags } = useTagsContext();
    const { financialGoals } = useGoalsContext();
    const {
        recurringTransactions,
        saveRecurringTransaction,
        deleteRecurringTransaction,
        billsAndPayments,
        saveBillPayment,
        deleteBillPayment,
        recurringTransactionOverrides,
        saveRecurringOverride,
        deleteRecurringOverride,
        loanPaymentOverrides,
    } = useScheduleContext();

    const [activeSegment, setActiveSegment] = useState<ScheduleSegment>('calendar');
    const [searchQuery, setSearchQuery] = useState('');
    const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
    const [isBillModalOpen, setIsBillModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<RecurringTransaction | null>(null);
    const [editingBill, setEditingBill] = useState<BillPayment | null>(null);
    const [editChoiceItem, setEditChoiceItem] = useState<ScheduledItem | null>(null);
    const [overrideModalItem, setOverrideModalItem] = useState<ScheduledItem | null>(null);
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [itemToPost, setItemToPost] = useState<ScheduledItem | null>(null);

    // Confirmation Modal State
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {},
    });

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
        const todayMidnight = parseLocalDate(todayStr);
        
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
        const recurringOverrideMap = new Map<string, RecurringTransactionOverride>(
            recurringTransactionOverrides.map(override => [`${override.recurringTransactionId}-${override.originalDate}`, override])
        );

        // Prepare list for "List View" (Management)
        const processedRecurringList: RecurringTransaction[] = [];
        const processedLoanAccountIds = new Set<string>();

        allRecurringTransactions.forEach(rt => {
            if (rt.isSynthetic) {
                 const isLoan = rt.id.startsWith('loan-pmt-');
                 if (isLoan) {
                     if (!processedLoanAccountIds.has(rt.accountId)) {
                        processedLoanAccountIds.add(rt.accountId);
                        processedRecurringList.push({
                            ...rt,
                            id: `synthetic-group-${rt.accountId}`, 
                            description: `${rt.type === 'transfer' ? 'Loan Repayment' : 'Payment'}: ${accountMap[rt.accountId] || 'Loan Account'}`,
                        });
                     }
                     return; 
                 }
            }
            processedRecurringList.push(rt);
        });

        const recurringListItems = processedRecurringList.map(rt => ({
            ...rt,
            isSynthetic: rt.isSynthetic || false,
            accountName: rt.accountId === 'external'
                ? 'External'
                : (rt.type === 'transfer'
                    ? `${accountMap[rt.accountId] || 'Unknown'} → ${accountMap[rt.toAccountId ?? ''] || 'External'}`
                    : accountMap[rt.accountId] || 'Unknown')
        }));


        // Generate occurrences for timeline
        allRecurringTransactions.forEach(rt => {
            let nextDate = parseLocalDate(rt.nextDueDate);
            const endDateLocal = rt.endDate ? parseLocalDate(rt.endDate) : null;
            const startDateLocal = parseLocalDate(rt.startDate);

            // Fast forward past dates before "recently"
            const startRecurringScanDate = new Date(todayMidnight);
            startRecurringScanDate.setDate(startRecurringScanDate.getDate() - 7); // Look back a week for overdue

            while (nextDate < startRecurringScanDate && (!endDateLocal || nextDate < endDateLocal)) {
                const interval = rt.frequencyInterval || 1;
                const d = new Date(nextDate);
                if (rt.frequency === 'monthly') {
                    d.setMonth(d.getMonth() + interval);
                }
                else if (rt.frequency === 'weekly') d.setDate(d.getDate() + (7 * interval));
                else if (rt.frequency === 'daily') d.setDate(d.getDate() + interval);
                else if (rt.frequency === 'yearly') d.setFullYear(d.getFullYear() + interval);
                nextDate = d;
            }
            
            while (nextDate <= forecastEndDate && (!endDateLocal || nextDate <= endDateLocal)) {
                const originalDateStr = toLocalISOString(nextDate);
                const adjustedDateStr = adjustDateForWeekend(originalDateStr, rt.weekendAdjustment);

                const override = recurringOverrideMap.get(`${rt.id}-${originalDateStr}`);

                const itemDate = override?.date || adjustedDateStr;
                const itemAmount = override?.amount !== undefined ? override.amount : (rt.type === 'expense' ? -rt.amount : rt.amount);
                const itemDescription = override?.description || rt.description;
                const accountName = rt.accountId === 'external'
                    ? 'External'
                    : (rt.type === 'transfer'
                        ? `${accountMap[rt.accountId] || 'Unknown'} → ${accountMap[rt.toAccountId ?? ''] || 'External'}`
                        : accountMap[rt.accountId] || 'Unknown');
                
                const isSkipped = !!override?.isSkipped;

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
                    isSkipped: isSkipped,
                });
                
                const interval = rt.frequencyInterval || 1;
                const d = new Date(nextDate);
                if (rt.frequency === 'monthly') {
                    const targetDay = rt.dueDateOfMonth || startDateLocal.getDate();
                    d.setMonth(d.getMonth() + interval);
                    const year = d.getFullYear();
                    const month = d.getMonth();
                    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
                    d.setDate(Math.min(targetDay, lastDayOfMonth));
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
                originalItem: b,
                isSkipped: false,
            });
        });

        allUpcomingItems.sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());

        // --- Metrics & Grouping ---
        let totalIncome30d = 0;
        let totalExpense30d = 0;
        let incomeCount30d = 0;
        let expenseCount30d = 0;

        const categorySpending: Record<string, number> = {};
        let maxOutflowItem: ScheduledItem | null = null;
        let maxInflowItem: ScheduledItem | null = null;
        
        const groups: Record<string, ScheduledItem[]> = {};
        const filteredItems = allUpcomingItems.filter(item => 
            !searchQuery || 
            fuzzySearch(searchQuery, item.description) || 
            fuzzySearch(searchQuery, item.accountName || '')
        );

        filteredItems.forEach(item => {
            const itemDate = parseLocalDate(item.date);
            const isWithin30Days = itemDate >= todayMidnight && itemDate <= next30DaysEnd;

            if (isWithin30Days && !item.isSkipped) {
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

            if (item.date < todayStr && !item.isSkipped) {
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

        const monthKeys = Object.keys(groups).filter(k => k !== 'Overdue' && k !== 'Today' && k !== 'Next 7 Days');
        monthKeys.sort((a, b) => {
             const dateA = parseLocalDate(groups[a][0].date);
             const dateB = parseLocalDate(groups[b][0].date);
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
            .slice(0, 5);

        return {
            groupedItems: groups,
            sortedGroupKeys,
            allUpcomingForHeatmap: allUpcomingItems.filter(i => !i.isSkipped), 
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
    
    const handleEditFuture = () => {
        if (!editChoiceItem) return;
        const item = editChoiceItem;
        const original = item.originalItem as RecurringTransaction;
        
        const occurrenceDate = parseLocalDate(item.originalDateForOverride || item.date);
        const dayBefore = new Date(occurrenceDate);
        dayBefore.setDate(dayBefore.getDate() - 1);
        const endDateForOld = toLocalISOString(dayBefore);

        const newSeriesStart = item.originalDateForOverride || item.date;
        const newSeriesData: Omit<RecurringTransaction, 'id'> = {
            ...original,
            startDate: newSeriesStart,
            nextDueDate: newSeriesStart,
        };
        
        saveRecurringTransaction({ ...original, endDate: endDateForOld });

        setEditingTransaction({ ...newSeriesData, id: '' } as RecurringTransaction); 
        setEditChoiceItem(null);
        setIsRecurringModalOpen(true);
    };

    const handleDeleteItem = (id: string, isRecurring: boolean) => {
        setConfirmConfig({
            isOpen: true,
            title: isRecurring ? 'Delete Recurring Series' : 'Delete Bill',
            message: isRecurring 
                ? 'Are you sure you want to delete this recurring series? This will remove all future occurrences from your schedule.'
                : 'Are you sure you want to delete this bill?',
            onConfirm: () => {
                if (isRecurring) {
                    deleteRecurringTransaction(id);
                } else {
                    deleteBillPayment(id);
                }
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            }
        });
    };
    
    const handleEndSeries = (item: ScheduledItem) => {
        if (!item.isRecurring) return;
        const originalId = (item.originalItem as RecurringTransaction).id;
        const rt = recurringTransactions.find(t => t.id === originalId);
        if (!rt) return;
        
        const occurrenceDate = parseLocalDate(item.originalDateForOverride || item.date);
        const dayBefore = new Date(occurrenceDate);
        dayBefore.setDate(dayBefore.getDate() - 1);
        const endDate = toLocalISOString(dayBefore);
        
        setConfirmConfig({
            isOpen: true,
            title: 'End Recurring Series',
            message: `Are you sure you want to end this series? It will stop repeating after ${endDate}.`,
            onConfirm: () => {
                saveRecurringTransaction({ ...rt, endDate });
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            }
        });
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
            const postedDate = parseLocalDate(itemToPost.date);
            let nextDueDate = new Date(postedDate);
            const interval = rt.frequencyInterval || 1;
            const startDateLocal = parseLocalDate(rt.startDate);

            switch (rt.frequency) {
                case 'daily': nextDueDate.setDate(nextDueDate.getDate() + interval); break;
                case 'weekly': nextDueDate.setDate(nextDueDate.getDate() + 7 * interval); break;
                case 'monthly': {
                    const d = rt.dueDateOfMonth || startDateLocal.getDate();
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
        } else { 
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
    const segments: { id: ScheduleSegment; label: string; icon: string; color: string }[] = [
        { id: 'calendar', label: 'Calendar', icon: 'calendar_month', color: 'primary' },
        { id: 'timeline', label: 'Timeline', icon: 'view_timeline', color: 'rose' },
        { id: 'rules', label: 'Rules', icon: 'repeat', color: 'amber' },
    ];

    const heroGradient = activeSegment === 'timeline'
        ? 'from-rose-500 via-rose-600 to-pink-700'
        : activeSegment === 'rules'
            ? 'from-amber-500 via-orange-600 to-yellow-600'
            : 'from-primary-600 via-violet-700 to-purple-800';

    return (
        <div className="relative">
            <div className="relative z-10 space-y-6 pb-12 animate-fade-in-up">
                {isRecurringModalOpen && <RecurringTransactionModal onClose={() => setIsRecurringModalOpen(false)} onSave={(data) => { saveRecurringTransaction(data); setIsRecurringModalOpen(false); }} accounts={accounts} incomeCategories={incomeCategories} expenseCategories={expenseCategories} recurringTransactionToEdit={editingTransaction} />}
                {isBillModalOpen && <BillPaymentModal onClose={() => setIsBillModalOpen(false)} onSave={(data) => { saveBillPayment(data); setIsBillModalOpen(false); }} bill={editingBill} accounts={accounts} />}
                {editChoiceItem && <EditRecurrenceModal isOpen={!!editChoiceItem} onClose={() => setEditChoiceItem(null)} onEditSingle={handleEditSingle} onEditSeries={handleEditSeries} onEditFuture={handleEditFuture} />}
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
                
                <ConfirmationModal
                    isOpen={confirmConfig.isOpen}
                    onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                    onConfirm={confirmConfig.onConfirm}
                    title={confirmConfig.title}
                    message={confirmConfig.message}
                    confirmButtonText="Confirm"
                />

                {/* --- Consolidated Header & Portfolio --- */}
                <div className="bg-white dark:bg-dark-card rounded-[2.5rem] p-8 border border-black/5 dark:border-white/5 shadow-sm overflow-hidden relative group">
                    <div className={`absolute -top-24 -right-24 w-80 h-80 blur-3xl opacity-20 transition-colors duration-1000 bg-gradient-to-br ${heroGradient}`} />
                    
                    <div className="relative z-10 flex flex-col lg:flex-row lg:items-start justify-between gap-10">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-10 flex-1">
                            <div className="group/val cursor-pointer">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-primary-500 text-sm">payments</span>
                                    <span className="text-[10px] font-black tracking-[0.2em] uppercase text-light-text-secondary dark:text-dark-text-secondary">Next 30 Days Outflow</span>
                                </div>
                                <div className="flex items-baseline gap-3">
                                    <h2 className="text-5xl font-black tracking-tighter text-light-text dark:text-dark-text transition-colors group-hover/val:text-primary-500">
                                        {formatCurrency(summaryMetrics.expense, 'EUR')}
                                    </h2>
                                    <motion.div layoutId="active-indicator-main" className="w-2 h-2 rounded-full bg-primary-500 shadow-[0_0_12px_rgba(99,102,241,1)]" />
                                </div>
                                <div className="flex items-center gap-3 mt-3 opacity-60">
                                     <span className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-[0.1em]">{summaryMetrics.expCount} Operations Pending</span>
                                </div>
                            </div>

                            <div className="hidden lg:block w-px h-20 bg-black/5 dark:bg-white/10" />

                            {/* View Switcher Grid */}
                            <div className="flex-[2] grid grid-cols-3 gap-4">
                                {segments.map(seg => {
                                    const isActive = activeSegment === seg.id;
                                    return (
                                        <div 
                                            key={seg.id} 
                                            onClick={() => setActiveSegment(seg.id)} 
                                            className={`group cursor-pointer p-5 rounded-3xl transition-all duration-300 border ${isActive ? 'bg-primary-500/5 border-primary-500/20 shadow-inner' : 'hover:bg-black/5 dark:hover:bg-white/5 border-transparent'}`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${isActive ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30' : 'bg-gray-100 dark:bg-white/5 text-light-text-secondary'}`}>
                                                    <span className="material-symbols-outlined text-xl">{seg.icon}</span>
                                                </div>
                                                {isActive && <motion.div layoutId="active-dot" className="w-1.5 h-1.5 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-primary-500' : 'text-light-text-secondary dark:text-dark-text-secondary opacity-60'}`}>{seg.label}</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="shrink-0 flex flex-col gap-3">
                             <button onClick={() => handleOpenRecurringModal()} className={`${BTN_PRIMARY_STYLE} px-8 py-4 !rounded-2xl flex items-center justify-center gap-3 group/btn animate-glow`}>
                                <span className="material-symbols-outlined text-2xl transition-transform group-hover/btn:rotate-90">update</span>
                                <span className="font-black uppercase tracking-widest text-[11px]">New Recurring</span>
                            </button>
                            <button onClick={() => handleOpenBillModal()} className={`${BTN_SECONDARY_STYLE} px-8 py-4 !rounded-2xl flex items-center justify-center gap-3 group/btn`}>
                                <span className="material-symbols-outlined text-2xl transition-transform group-hover/btn:scale-110">receipt_long</span>
                                <span className="font-black uppercase tracking-widest text-[11px]">Add One-time</span>
                            </button>
                        </div>
                    </div>

                    {/* Integrated Detail Tray */}
                    <div className="mt-8 pt-8 border-t border-black/5 dark:border-white/5 flex flex-wrap items-center justify-between gap-8">
                         <div className="flex flex-wrap items-center gap-x-12 gap-y-4">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-2xl bg-emerald-500/5 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-emerald-500/70">arrow_downward</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black tracking-widest text-light-text-secondary/60 dark:text-dark-text-secondary/60 uppercase">Expected Income</span>
                                    <span className="text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(summaryMetrics.income, 'EUR')}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-2xl bg-rose-500/5 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-rose-500/70">warning</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black tracking-widest text-light-text-secondary/60 dark:text-dark-text-secondary/60 uppercase">Overdue</span>
                                    <span className="text-base font-black text-rose-600 dark:text-rose-400 tabular-nums">{groupedItems['Overdue']?.length || 0}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-2xl bg-primary-500/5 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-primary-500/70">event_repeat</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black tracking-widest text-light-text-secondary/60 dark:text-dark-text-secondary/60 uppercase">Active Rules</span>
                                    <span className="text-base font-black text-light-text dark:text-dark-text tabular-nums">{recurringTransactions.length}</span>
                                </div>
                            </div>
                         </div>

                         {/* Search Integrated */}
                         <div className="relative flex-grow max-w-[280px]">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary">search</span>
                            <input 
                                type="text" 
                                placeholder="Global Search..." 
                                value={searchQuery} 
                                onChange={(e) => setSearchQuery(e.target.value)} 
                                className="w-full bg-black/5 dark:bg-white/5 border-none rounded-2xl py-3 pl-10 pr-4 text-xs font-bold focus:ring-1 focus:ring-primary-500 transition-all placeholder:text-light-text-secondary/60 dark:text-dark-text-secondary/60"
                            />
                         </div>
                    </div>
                </div>

                {/* --- Analytics Bento Grid --- */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-12">
                        <ScheduleHeatmap items={allUpcomingForHeatmap} />
                    </div>

                    <div className="md:col-span-4 bg-white dark:bg-dark-card rounded-[2rem] p-6 border border-black/5 dark:border-white/5 shadow-sm">
                         <div className="flex items-center justify-between mb-6">
                            <h3 className="text-s font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary">Exp. Breakdown</h3>
                            <span className="text-[11px] font-bold text-primary-500">30d Horizon</span>
                        </div>
                        <div className="space-y-4">
                             {categoryBreakdown.length > 0 ? (
                                categoryBreakdown.map((cat, index) => {
                                    const percent = summaryMetrics.expense > 0 ? (cat.value / summaryMetrics.expense) * 100 : 0;
                                    const color = PIE_COLORS[index % PIE_COLORS.length];
                                    return (
                                        <div key={cat.name} className="group cursor-default">
                                            <div className="flex justify-between text-[11px] font-black uppercase tracking-tight mb-2">
                                                <span className="text-light-text dark:text-dark-text opacity-70 truncate max-w-[140px]">{cat.name}</span>
                                                <span className="tabular-nums">{formatCurrency(cat.value, 'EUR')}</span>
                                            </div>
                                            <div className="w-full bg-black/5 dark:bg-white/5 rounded-full h-1.5 overflow-hidden">
                                                 <motion.div initial={{ width: 0 }} animate={{ width: `${percent}%` }} className="h-full rounded-full" style={{ backgroundColor: color }} />
                                            </div>
                                        </div>
                                    )
                                })
                            ) : (
                                <div className="py-8 text-center text-s text-light-text-secondary/40 italic">No scheduled data</div>
                            )}
                        </div>
                    </div>

                    <div className="md:col-span-4 group bg-gradient-to-br from-emerald-500/5 to-teal-500/5 dark:bg-emerald-900/10 rounded-[2rem] p-6 border border-emerald-500/10 dark:border-emerald-500/20 relative overflow-hidden">
                         <div className="absolute top-0 right-0 p-8 opacity-5">
                            <span className="material-symbols-outlined text-8xl text-emerald-500">savings</span>
                        </div>
                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div className="space-y-2">
                                <span className="text-s  font-black uppercase tracking-widest text-emerald-600">Dominant Inflow</span>
                                {majorInflow ? (
                                    <>
                                        <h3 className="text-4xl font-black text-light-text dark:text-dark-text tracking-tighter tabular-nums">{formatCurrency(majorInflow.amount, (majorInflow.originalItem as any).currency)}</h3>
                                        <div className="flex items-center gap-2 pt-2">
                                            <div className="w-5 h-5 rounded-md bg-emerald-500/10 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-sm text-emerald-500">download</span>
                                            </div>
                                            <p className="font-bold text-xs truncate opacity-70">{majorInflow.description}</p>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-[11px] font-bold opacity-40 italic">No major inflow detected</p>
                                )}
                            </div>
                            <div className="pt-6">
                                <div className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest">
                                    {majorInflow ? `Expected ${parseLocalDate(majorInflow.date).toLocaleDateString()}` : 'Forecast Clean'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-4 group bg-gradient-to-br from-rose-500/5 to-pink-500/5 dark:bg-rose-900/10 rounded-[2rem] p-6 border border-rose-500/10 dark:border-rose-500/20 relative overflow-hidden">
                         <div className="absolute top-0 right-0 p-8 opacity-5">
                            <span className="material-symbols-outlined text-8xl text-rose-500">payments</span>
                        </div>
                        <div className="relative z-10 flex flex-col h-full justify-between">
                             <div className="space-y-2">
                                <span className="text-s font-black uppercase tracking-widest text-rose-600">Critical Outflow</span>
                                {majorOutflow ? (
                                    <>
                                        <h3 className="text-4xl font-black text-light-text dark:text-dark-text tracking-tighter tabular-nums">{formatCurrency(Math.abs(majorOutflow.amount), (majorOutflow.originalItem as any).currency)}</h3>
                                        <div className="flex items-center gap-2 pt-2">
                                            <div className="w-5 h-5 rounded-md bg-rose-500/10 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-sm text-rose-500">upload</span>
                                            </div>
                                            <p className="font-bold text-xs truncate opacity-70">{majorOutflow.description}</p>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-[11px] font-bold opacity-40 italic">No major outflow detected</p>
                                )}
                            </div>
                            <div className="pt-6">
                                <div className="text-[10px] font-black text-rose-600/60 uppercase tracking-widest">
                                    {majorOutflow ? `Due ${parseLocalDate(majorOutflow.date).toLocaleDateString()}` : 'Safe Horizon'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- Dynamic Segment Content --- */}
                <AnimatePresence mode="wait">
                    {activeSegment === 'calendar' && (
                        <motion.div key="calendar" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                            <CalendarView 
                                items={allUpcomingForHeatmap} 
                                goals={financialGoals} 
                                accounts={accounts} 
                                onEditItem={handleEditItem} 
                                onPostItem={handleOpenPostModal} 
                            />
                        </motion.div>
                    )}

                    {activeSegment === 'timeline' && (
                        <motion.div key="timeline" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                             {sortedGroupKeys.map(groupKey => {
                                const items = groupedItems[groupKey];
                                if (!items || items.length === 0) return null;
                                const groupTotal = items.filter(i => !i.isSkipped).reduce((sum, item) => {
                                    if (item.type === 'transfer') return sum;
                                    return sum + convertToEur(item.amount, (item.originalItem as any).currency);
                                }, 0);

                                return (
                                    <ScheduleGroup 
                                        key={groupKey} 
                                        title={groupKey} 
                                        items={items} 
                                        accounts={accounts} 
                                        onEdit={handleEditItem} 
                                        onDelete={handleDeleteItem} 
                                        onPost={handleOpenPostModal}
                                        onEndSeries={handleEndSeries}
                                        totalAmount={groupTotal}
                                        defaultOpen={['Today', 'Next 7 Days', 'Overdue'].includes(groupKey)}
                                    />
                                );
                            })}
                        </motion.div>
                    )}

                    {activeSegment === 'rules' && (
                        <motion.div key="rules" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {recurringList.map((rt) => (
                                <div key={rt.id} className="group relative bg-white dark:bg-dark-card p-6 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm hover:shadow-xl transition-all duration-300">
                                    <div className="absolute inset-0 pointer-events-none rounded-[2rem] overflow-hidden" style={{ background: `radial-gradient(circle at 100% 0%, ${rt.type === 'income' ? 'rgba(16, 185, 129, 0.05)' : rt.type === 'expense' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(59, 130, 246, 0.05)'} 0%, transparent 60%)` }} />
                                    
                                    <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${rt.type === 'income' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-gray-100 dark:bg-white/5 text-light-text-secondary'}`}>
                                                    <span className="material-symbols-outlined text-xl">{rt.type === 'transfer' ? 'sync_alt' : rt.type === 'income' ? 'download' : 'upload'}</span>
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="font-bold text-base truncate pr-8">{rt.description}</h4>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-light-text-secondary/60">{rt.frequency} cycle</span>
                                                </div>
                                            </div>
                                            {rt.isSynthetic && (
                                                <span className="absolute top-6 right-6 text-[9px] font-black bg-primary-500/10 text-primary-500 px-2 py-0.5 rounded-full uppercase tracking-widest">Synthetic</span>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between pt-6 border-t border-black/5 dark:border-white/5">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-light-text-secondary/40">Expected Value</span>
                                                <span className={`text-lg font-black tabular-nums ${rt.type === 'income' ? 'text-emerald-600' : 'text-light-text dark:text-dark-text'}`}>{formatCurrency(rt.amount, rt.currency)}</span>
                                            </div>
                                            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleOpenRecurringModal(rt as RecurringTransaction)} disabled={rt.isSynthetic} className="p-2 hover:bg-primary-500/10 text-primary-500 rounded-xl disabled:opacity-20 transition-all"><span className="material-symbols-outlined text-lg">settings</span></button>
                                                <button onClick={() => handleDeleteItem(rt.id, true)} disabled={rt.isSynthetic} className="p-2 hover:bg-rose-500/10 text-rose-500 rounded-xl disabled:opacity-20 transition-all"><span className="material-symbols-outlined text-lg">delete</span></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default React.memo(SchedulePage);
