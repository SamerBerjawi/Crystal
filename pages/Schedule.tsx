
import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
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
import { useAccountsContext, useTransactionsContext, usePreferencesSelector } from '../contexts/DomainProviders';
import { useCategoryContext, useScheduleContext, useTagsContext, useGoalsContext } from '../contexts/FinancialDataContext';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import PageHeader from '../components/PageHeader';
import HeaderButton from '../components/HeaderButton';
import ScheduledItemRow from '../components/ScheduledItemRow';
import ConfirmationModal from '../components/ConfirmationModal';
import CalendarView from '../components/CalendarView';
import { MobileScheduleView } from '../components/MobileScheduleView';
import { useIsMobile } from '../hooks/useIsMobile';
import { RingChart, Ring, RingCenter, RingData } from '../src/components/charts';

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
        icon = 'ArrowDownLeft';
    } else if (isNet) {
        colorClass = value >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400';
        bgClass = value >= 0 ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800/30' : 'bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30';
        accentBg = value >= 0 ? 'bg-blue-500' : 'bg-orange-500';
        icon = 'wallet';
    } else {
        colorClass = 'text-rose-600 dark:text-rose-400';
        bgClass = 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30';
        accentBg = 'bg-rose-500';
        icon = 'ArrowUpRight';
    }

    return (
        <div className={`p-5 rounded-2xl border ${bgClass} flex flex-col justify-between h-full relative overflow-hidden shadow-sm`}>
            <div className="flex justify-between items-start z-10">
                <div>
                    <p className="text-xs font-bold  tracking-wider opacity-70 mb-1">{title}</p>
                    <h3 className={`text-2xl font-bold tracking-tight ${colorClass}`}>{formatCurrency(value, 'EUR')}</h3>
                </div>
                <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
                    <div className={`absolute inset-0 rounded-full opacity-20 ${accentBg}`}></div>
                    <div className={`relative w-10 h-10 rounded-full flex items-center justify-center bg-white/50 dark:bg-black/20 ${colorClass}`}>
                        <Icon name={icon} className="text-2xl leading-none" />
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

// --- Recurring vs Income Comparison Widget ---
const RecurringComparisonWidget: React.FC<{ income: number; outflow: number; incomeCount: number; outflowCount: number }> = ({ income, outflow, incomeCount, outflowCount }) => {
    const ratio = income > 0 ? (outflow / income) * 100 : (outflow > 0 ? 100 : 0);
    const remaining = Math.max(0, income - outflow);
    
    // Status color and advice based on standard recommendation for fixed/recurring costs
    let statusColor = 'text-emerald-600 dark:text-emerald-400';
    let progressColor = 'bg-emerald-500';
    let statusBg = 'bg-emerald-500/10 dark:bg-emerald-500/20';
    let statusText = 'Optimal Commitment';
    let advice = 'Recurring obligations consume less than 50% of monthly dynamic income. Solid safety margins are in place for savings and portfolio growth.';
    
    if (ratio >= 70) {
        statusColor = 'text-rose-600 dark:text-rose-400';
        progressColor = 'bg-rose-500';
        statusBg = 'bg-rose-500/10 dark:bg-rose-500/20';
        statusText = 'High Commitment';
        advice = 'Recurring obligation overhead exceeds 70%. Consider renegotiating subscriptions, interest schemes, or core servicing parameters.';
    } else if (ratio >= 50) {
        statusColor = 'text-amber-600 dark:text-amber-400';
        progressColor = 'bg-amber-500';
        statusBg = 'bg-amber-500/10 dark:bg-amber-500/20';
        statusText = 'Moderate Commitment';
        advice = 'Bilateral obligations occupy over half of incoming flow. Maintain vigilance on discretionary increments to avoid cashflow compression.';
    }

    return (
        <div className="bg-white/60 dark:bg-dark-card/60 rounded-[2.5rem] p-6 border border-black/5 dark:border-white/5 shadow-sm overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-8 opacity-5">
                <Icon name="analytics" className="text-8xl text-primary-500" />
            </div>
            
            <div className="relative z-10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6 flex-1 min-w-0">
                    <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                        {/* Circular progress bar */}
                        <svg className="w-20 h-20 transform -rotate-90">
                            <circle
                                cx="40"
                                cy="40"
                                r="34"
                                className="stroke-black/5 dark:stroke-white/10"
                                strokeWidth="6"
                                fill="transparent"
                            />
                            <circle
                                cx="40"
                                cy="40"
                                r="34"
                                className={`transition-all duration-1000`}
                                strokeWidth="6"
                                fill="transparent"
                                strokeDasharray={213.6}
                                strokeDashoffset={213.6 - (213.6 * Math.min(ratio, 100)) / 100}
                                strokeLinecap="round"
                                style={{ stroke: 'var(--color-primary-500, #6366f1)' }}
                            />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                            <span className="text-sm font-black text-light-text dark:text-dark-text tracking-tighter tabular-nums">
                                {Math.round(ratio)}%
                            </span>
                            <span className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary/60">ratio</span>
                        </div>
                    </div>

                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <div className="flex items-center gap-1.5 bg-primary-500/10 text-primary-600 dark:text-primary-400 px-2.5 py-0.5 rounded-full">
                                <Icon name="donut_large" className="text-sm" />
                                <span className="text-xs font-semibold tracking-wider">Commitment Index</span>
                            </div>
                            <div className={`px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wider ${statusBg} ${statusColor}`}>
                                {statusText}
                            </div>
                        </div>
                        <h4 className="font-bold text-base text-gray-900 dark:text-white">
                            Scheduled payments consume <span className={statusColor}>{Math.round(ratio)}%</span> of anticipated income
                        </h4>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1 max-w-xl leading-relaxed">
                            {advice}
                        </p>
                    </div>
                </div>

                <div className="w-full md:w-80 shrink-0 bg-black/5 dark:bg-black/20 p-5 rounded-[1.5rem] border border-black/5 dark:border-white/5 flex flex-col justify-between">
                    <div className="flex justify-between items-baseline mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider opacity-60">Distribution (30d)</span>
                        <div className="text-right">
                            <span className="text-xs font-black tabular-nums text-light-text dark:text-dark-text">
                                {formatCurrency(outflow, 'EUR')}
                            </span>
                            <span className="text-xs opacity-40 italic"> of {formatCurrency(income, 'EUR')}</span>
                        </div>
                    </div>
                    
                    <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-2 overflow-hidden flex mb-3">
                        <motion.div 
                            initial={{ width: 0 }} 
                            animate={{ width: `${Math.min(ratio, 100)}%` }} 
                            className={`h-full rounded-l-full ${progressColor}`} 
                        />
                        {ratio < 100 && (
                            <motion.div 
                                initial={{ width: 0 }} 
                                animate={{ width: `${100 - Math.min(ratio, 100)}%` }} 
                                className="h-full bg-emerald-500/20 dark:bg-emerald-500/10 rounded-r-full" 
                            />
                        )}
                    </div>

                    <div className="flex justify-between text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-60">
                        <span>{outflowCount} expected obligations</span>
                        <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">+{formatCurrency(remaining, 'EUR')} reserve</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Collapsible Group Component ---
const ScheduleGroup = ({ title, items, accounts, allCategories, onEdit, onDelete, onPost, onEndSeries, onExpireBill, defaultOpen = true, totalAmount }: any) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [overdueFilter, setOverdueFilter] = useState<'all' | 'recurring' | 'one-time'>('all');
    
    let displayItems = items;
    if (title === 'Overdue') {
        if (overdueFilter === 'recurring') {
            displayItems = items.filter((i: any) => i.isRecurring);
        } else if (overdueFilter === 'one-time') {
            displayItems = items.filter((i: any) => !i.isRecurring);
        }
    }

    const recurringCount = items.filter((i: any) => i.isRecurring).length;
    const oneTimeCount = items.filter((i: any) => !i.isRecurring).length;
    
    return (
        <div className="mb-10 last:mb-0">
            <div 
                className="flex justify-between items-center px-4 py-3 mb-4 cursor-pointer rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-all group/hdr"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-4">
                     <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${isOpen ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'bg-gray-100 dark:bg-white/5 text-light-text-secondary'}`}>
                         <Icon name="expand_more" className={`text-xl transition-transform duration-300 ${isOpen ? '' : '-rotate-90'}`} />
                     </div>
                     <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <h3 className={`text-base font-bold tracking-tight ${title === 'Overdue' ? 'text-rose-600 dark:text-rose-400' : 'text-light-text dark:text-dark-text'}`}>
                                {title}
                            </h3>
                            <span className="text-xs font-semibold text-light-text-secondary/90 dark:text-dark-text-secondary/90 bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-full tabular-nums">
                                {title === 'Overdue' ? displayItems.length : items.length}
                            </span>
                        </div>
                     </div>
                </div>
                <div className="flex items-center gap-4">
                     <div className="text-right">
                        <div className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary/90 dark:text-dark-text-secondary/90">Projected Delta</div>
                        <span className={`text-lg font-black tabular-nums tracking-tighter ${totalAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {formatCurrency(totalAmount, 'EUR', { showPlusSign: true })}
                        </span>
                     </div>
                </div>
            </div>

            {/* Overdue Toggle Filter Bar */}
            {title === 'Overdue' && isOpen && (
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4 px-3 py-2 bg-rose-500/5 dark:bg-rose-500/10 rounded-2xl border border-rose-500/10 dark:border-rose-500/20 ml-8">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                            <Icon name="filter_alt" className="text-sm" />
                            <span>Filter Overdue:</span>
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto">
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setOverdueFilter('all'); }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                overdueFilter === 'all' 
                                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20' 
                                    : 'bg-white/60 dark:bg-white/5 text-light-text-secondary dark:text-dark-text-secondary hover:bg-rose-500/10'
                            }`}
                        >
                            <span>All Both</span>
                            <span className={`text-xs px-1.5 py-0.2 rounded-full font-bold ${overdueFilter === 'all' ? 'bg-white/25 text-white' : 'bg-black/5 dark:bg-white/10'}`}>{items.length}</span>
                        </button>

                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setOverdueFilter('recurring'); }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                overdueFilter === 'recurring' 
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                                    : 'bg-white/60 dark:bg-white/5 text-light-text-secondary dark:text-dark-text-secondary hover:bg-indigo-500/10'
                            }`}
                        >
                            <Icon name="repeat" className="text-sm" />
                            <span>Recurring Only</span>
                            <span className={`text-xs px-1.5 py-0.2 rounded-full font-bold ${overdueFilter === 'recurring' ? 'bg-white/25 text-white' : 'bg-black/5 dark:bg-white/10'}`}>{recurringCount}</span>
                        </button>

                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setOverdueFilter('one-time'); }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                overdueFilter === 'one-time' 
                                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20' 
                                    : 'bg-white/60 dark:bg-white/5 text-light-text-secondary dark:text-dark-text-secondary hover:bg-rose-500/10'
                            }`}
                        >
                            <Icon name="receipt_long" className="text-sm" />
                            <span>One-Time Bills Only</span>
                            <span className={`text-xs px-1.5 py-0.2 rounded-full font-bold ${overdueFilter === 'one-time' ? 'bg-white/25 text-white' : 'bg-black/5 dark:bg-white/10'}`}>{oneTimeCount}</span>
                        </button>
                    </div>
                </div>
            )}
            
            {isOpen && (
                <div className="space-y-2 pl-4 border-l-2 border-black/5 dark:border-white/5 ml-8">
                     {displayItems.map((item: any) => (
                        <ScheduledItemRow 
                            key={item.id} 
                            item={item} 
                            accounts={accounts} 
                            allCategories={allCategories}
                            onEdit={onEdit} 
                            onDelete={onDelete} 
                            onPost={onPost}
                            onEndSeries={onEndSeries} 
                            onExpireBill={onExpireBill}
                            isReadOnly={item.isRecurring && item.originalItem.isSynthetic} 
                        />
                     ))}
                     {displayItems.length === 0 && (
                         <div className="p-4 text-center text-xs text-light-text-secondary dark:text-dark-text-secondary italic bg-gray-50 dark:bg-white/5 rounded-xl">
                             No items found matching the selected overdue filter.
                         </div>
                     )}
                </div>
            )}
        </div>
    );
}

// --- Main Page Component ---

import { motion, AnimatePresence } from 'motion/react';
import Icon from '../components/ui/Icon';

type ScheduleSegment = 'all' | 'timeline' | 'calendar' | 'rules' | 'expired';

const SchedulePage: React.FC = () => {
    const isMobile = useIsMobile();
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

    const preferredCurrency = usePreferencesSelector(p => p.currency || 'EUR');
    const brandfetchClientId = usePreferencesSelector(p => p.brandfetchClientId || '');
    const merchantLogoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});

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


        // Scan cutoff for overdue items (look back 7 days)
        const overdueCutoffDate = new Date(todayMidnight);
        overdueCutoffDate.setDate(overdueCutoffDate.getDate() - 7);
        const overdueCutoffStr = toLocalISOString(overdueCutoffDate);

        // Generate occurrences for timeline
        allRecurringTransactions.forEach(rt => {
            let nextDate = parseLocalDate(rt.nextDueDate);
            const endDateLocal = rt.endDate ? parseLocalDate(rt.endDate) : null;
            const startDateLocal = parseLocalDate(rt.startDate);

            // Fast forward past dates before overdue cutoff (last 7 days)
            while (nextDate < overdueCutoffDate && (!endDateLocal || nextDate < endDateLocal)) {
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
                    category: rt.category,
                    merchant: rt.merchant,
                    accountId: rt.accountId,
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
        
        // Limit unpaid one-time bills to the last 7 days as well
        billsAndPayments
            .filter(b => b.status === 'unpaid' && b.dueDate >= overdueCutoffStr)
            .forEach(b => {
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
                    category: (b as any).category,
                    merchant: (b as any).merchant,
                    accountId: b.accountId,
                });
            });

        allUpcomingItems.sort((a, b) => {
            const dateDiff = parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            const aIsIncome = a.amount >= 0;
            const bIsIncome = b.amount >= 0;
            if (aIsIncome && !bIsIncome) return -1;
            if (!aIsIncome && bIsIncome) return 1;
            if (aIsIncome && bIsIncome) return b.amount - a.amount;
            return Math.abs(b.amount) - Math.abs(a.amount);
        });

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
        let merchant: string | undefined;

        if (item.isRecurring) {
            const rt = original as RecurringTransaction;
            type = rt.type;
            category = rt.category;
            merchant = rt.merchant || item.merchant;
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
            merchant = (bill as any).merchant || (bill as any).biller || item.merchant;
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
                merchant: merchant || item.merchant || (original as any)?.merchant || '',
            },
        };
    }, [itemToPost]);

    const handleExpireBill = (bill: BillPayment) => {
        saveBillPayment({ ...bill, status: 'expired' });
        toast.success(`Marked bill "${bill.description}" as expired.`);
    };

    const handleRestoreBill = (bill: BillPayment) => {
        saveBillPayment({ ...bill, status: 'unpaid' });
        toast.success(`Restored bill "${bill.description}" to active bills.`);
    };

    const oldUnpaidBills = useMemo(() => {
        const today = new Date();
        const cutoffDate = new Date(today);
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        const cutoffStr = toLocalISOString(cutoffDate);
        return billsAndPayments.filter(b => b.status === 'unpaid' && b.dueDate < cutoffStr);
    }, [billsAndPayments]);

    const expiredBills = useMemo(() => {
        return billsAndPayments.filter(b => b.status === 'expired');
    }, [billsAndPayments]);

    const handleExpireAllOldBills = () => {
        if (oldUnpaidBills.length === 0) return;
        oldUnpaidBills.forEach(b => saveBillPayment({ ...b, status: 'expired' }));
        toast.success(`Marked ${oldUnpaidBills.length} old bill(s) as expired and moved to archive.`);
    };

    const PIE_COLORS = ['#38BDF8', '#C084FC', '#F59E0B', '#10B981', '#EF4444', '#6366F1'];
    const segments: { id: ScheduleSegment; label: string; icon: string; color: string }[] = [
        { id: 'calendar', label: 'Calendar', icon: 'calendar', color: 'primary' },
        { id: 'timeline', label: 'Timeline', icon: 'sliders', color: 'rose' },
        { id: 'rules', label: 'Rules', icon: 'refresh', color: 'amber' },
        { id: 'expired', label: 'Expired Archive', icon: 'archive', color: 'slate' },
    ];

    const heroGradient = activeSegment === 'timeline'
        ? 'from-rose-500 via-rose-600 to-pink-700'
        : activeSegment === 'rules'
            ? 'from-amber-500 via-orange-600 to-yellow-600'
            : activeSegment === 'expired'
                ? 'from-slate-600 via-zinc-700 to-gray-800'
                : 'from-primary-600 via-violet-700 to-purple-800';

    return (
        <div className="relative">
            {/* Shared Modals for both Mobile and Desktop */}
            {(isRecurringModalOpen || isBillModalOpen) && (
                <RecurringTransactionModal 
                    isOpen={isRecurringModalOpen || isBillModalOpen}
                    onClose={() => {
                        setIsRecurringModalOpen(false);
                        setIsBillModalOpen(false);
                        setEditingTransaction(null);
                        setEditingBill(null);
                    }}
                    onSave={(data) => { 
                        saveRecurringTransaction(data); 
                        setIsRecurringModalOpen(false); 
                        setEditingTransaction(null);
                    }}
                    onSaveBill={(data) => {
                        saveBillPayment(data);
                        setIsBillModalOpen(false);
                        setEditingBill(null);
                    }}
                    accounts={accounts} 
                    incomeCategories={incomeCategories} 
                    expenseCategories={expenseCategories} 
                    recurringTransactionToEdit={editingTransaction} 
                    billToEdit={editingBill}
                    initialMode={isBillModalOpen ? 'one-time' : 'recurring'}
                />
            )}
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

            {/* Responsive View Switch */}
            {isMobile ? (
                <MobileScheduleView
                    scheduledItems={allUpcomingForHeatmap}
                    groupedItems={groupedItems}
                    sortedGroupKeys={sortedGroupKeys}
                    recurringList={recurringList}
                    summaryMetrics={summaryMetrics}
                    categoryBreakdown={categoryBreakdown}
                    majorInflow={majorInflow}
                    majorOutflow={majorOutflow}
                    accounts={accounts}
                    incomeCategories={incomeCategories}
                    expenseCategories={expenseCategories}
                    brandfetchClientId={brandfetchClientId}
                    merchantLogoOverrides={merchantLogoOverrides}
                    onProcessItem={handleOpenPostModal}
                    onEditItem={handleEditItem}
                    onDeleteItem={(id, isRecurring) => handleDeleteItem(id, isRecurring)}
                    onAddRecurring={() => handleOpenRecurringModal()}
                    onAddBill={() => handleOpenBillModal()}
                    onEndSeries={(recurringId) => {
                        const rt = recurringTransactions.find(t => t.id === recurringId);
                        if (rt) {
                            const today = toLocalISOString(new Date());
                            saveRecurringTransaction({ ...rt, endDate: today });
                        }
                    }}
                    onExpireBill={(billId) => {
                        const bill = billsAndPayments.find(b => b.id === billId);
                        if (bill) handleExpireBill(bill);
                    }}
                    preferredCurrency={preferredCurrency}
                />
            ) : (
                <div className="space-y-6 pb-12 animate-fade-in-up">
                <PageHeader 
                    markerIcon="clock"
                    markerLabel="Future Outflows"
                    title="Recurring & Bilateral Obligations"
                    subtitle="Track and forecast subscriptions, insurance schedules, salary contracts, loan payments, and billing cycles."
                    actions={
                        <div className="flex items-center gap-2">
                            <HeaderButton
                                variant="secondary"
                                icon="receipt"
                                onClick={() => handleOpenBillModal()}
                            >
                                Add One-time
                            </HeaderButton>
                            <HeaderButton
                                variant="primary"
                                icon="refresh"
                                onClick={() => handleOpenRecurringModal()}
                            >
                                New Recurring
                            </HeaderButton>
                        </div>
                    }
                />

                <RecurringComparisonWidget
                    income={summaryMetrics.income}
                    outflow={summaryMetrics.expense}
                    incomeCount={summaryMetrics.incCount}
                    outflowCount={summaryMetrics.expCount}
                />

                {/* --- Hero Card: Row #1 (Category Breakdown + 2x2 KPIs) & Row #2 (Heatmap with Title Left, Legend Right) --- */}
                <div className="bg-white dark:bg-dark-card rounded-[2.5rem] p-6 lg:p-7 border border-black/5 dark:border-white/5 shadow-sm overflow-hidden relative group space-y-6">
                    <div className={`absolute -top-28 -right-28 w-96 h-96 blur-3xl opacity-25 transition-colors duration-1000 bg-gradient-to-br ${heroGradient}`} />

                    {/* ROW #1: Category Expenditure Breakdown (Left Half) & 2x2 Grid (Right Half) */}
                    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                        
                        {/* LEFT HALF (lg:col-span-6): CATEGORY EXPENDITURE BREAKDOWN */}
                        <div className="lg:col-span-6 flex flex-col justify-between p-5 sm:p-6 rounded-[2rem] bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-3xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1.5">
                                    <Icon name="donut_large" className="text-xs text-primary-500" />
                                    Category Expenditure Breakdown
                                </h3>
                                <span className="text-3xs font-semibold text-primary-500 bg-primary-500/10 px-2 py-0.5 rounded-full">
                                    30-Day Commitment View
                                </span>
                            </div>

                            {categoryBreakdown.length > 0 ? (
                                <div className="flex flex-col sm:flex-row items-center gap-6 lg:gap-8 py-2 flex-1 justify-center">
                                    <div className="w-56 h-56 shrink-0 flex items-center justify-center relative">
                                        <RingChart
                                            data={categoryBreakdown.map((cat, idx) => ({
                                                label: cat.name,
                                                value: cat.value,
                                                maxValue: summaryMetrics.expense > 0 ? summaryMetrics.expense : cat.value,
                                                color: PIE_COLORS[idx % PIE_COLORS.length],
                                            }))}
                                            size={224}
                                            strokeWidth={10}
                                            ringGap={5}
                                            baseInnerRadius={44}
                                        >
                                            {categoryBreakdown.map((cat, idx) => (
                                                <Ring
                                                    key={cat.name}
                                                    index={idx}
                                                    color={PIE_COLORS[idx % PIE_COLORS.length]}
                                                />
                                            ))}
                                            <RingCenter
                                                defaultLabel="Total Outflow"
                                                prefix="€"
                                                valueClassName="text-sm sm:text-base font-extrabold tabular-nums tracking-tight leading-none"
                                                labelClassName="text-[9px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary/60 mt-1"
                                            />
                                        </RingChart>
                                    </div>

                                    <div className="flex-1 w-full flex flex-col justify-center space-y-2.5 min-w-0">
                                        {categoryBreakdown.slice(0, 5).map((cat, idx) => {
                                            const color = PIE_COLORS[idx % PIE_COLORS.length];
                                            const pct = summaryMetrics.expense > 0 ? Math.round((cat.value / summaryMetrics.expense) * 100) : 0;
                                            return (
                                                <div key={cat.name} className="space-y-1">
                                                    <div className="flex items-center justify-between text-xs gap-2">
                                                        <div className="flex items-center gap-2 min-w-0 truncate">
                                                            <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: color }} />
                                                            <span className="truncate font-bold text-light-text dark:text-dark-text">{cat.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0 tabular-nums text-xs">
                                                            <span className="font-bold text-light-text dark:text-dark-text">{formatCurrency(cat.value, 'EUR')}</span>
                                                            <span className="text-light-text-secondary dark:text-dark-text-secondary/70 font-semibold">{pct}%</span>
                                                        </div>
                                                    </div>
                                                    {/* Mini progress bar under each item matching the screenshot */}
                                                    <div className="w-full bg-black/5 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${Math.min(pct, 100)}%` }}
                                                            className="h-full rounded-full"
                                                            style={{ backgroundColor: color }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="py-8 text-center text-xs text-light-text-secondary/40 italic flex-1 flex items-center justify-center">
                                    No scheduled expenditure
                                </div>
                            )}

                            {/* Recurring / Income Mini Progress Bar */}
                            <div className="pt-3 border-t border-black/5 dark:border-white/5 space-y-1.5">
                                <div className="flex items-center justify-between text-3xs font-semibold">
                                    <span className="text-light-text-secondary dark:text-dark-text-secondary opacity-70">Recurring vs Income Overhead</span>
                                    <span className="text-primary-500 font-bold tabular-nums">
                                        {summaryMetrics.income > 0 ? Math.round((summaryMetrics.expense / summaryMetrics.income) * 100) : 0}%
                                    </span>
                                </div>
                                <div className="w-full bg-black/5 dark:bg-white/5 rounded-full h-1.5 overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(summaryMetrics.income > 0 ? (summaryMetrics.expense / summaryMetrics.income) * 100 : 0, 100)}%` }}
                                        className="h-full rounded-full bg-primary-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* RIGHT HALF (lg:col-span-6): 2x2 GRID FOR 4 KPI CARDS */}
                        <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
                            {/* KPI 1: 30-Day Outflow */}
                            <div className="p-4 sm:p-5 rounded-[1.75rem] bg-gradient-to-b from-rose-500/[0.04] to-black/[0.02] dark:to-white/[0.02] border border-rose-500/10 dark:border-rose-500/20 flex flex-col justify-between space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Icon name="credit_card" className="text-base text-rose-600 dark:text-rose-400" />
                                        <span className="text-3xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">30-Day Outflow</span>
                                    </div>
                                    <span className="text-4xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">
                                        {summaryMetrics.expCount} Ops
                                    </span>
                                </div>
                                <div>
                                    <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-light-text dark:text-dark-text">
                                        {formatCurrency(summaryMetrics.expense, 'EUR')}
                                    </h2>
                                </div>
                                <div className="pt-2 border-t border-rose-500/10 dark:border-rose-500/15 flex items-center justify-between text-2xs min-w-0">
                                    {majorOutflow ? (
                                        <div className="flex items-center gap-1.5 min-w-0 truncate text-rose-600 dark:text-rose-400">
                                            <Icon name="upload" className="text-xs shrink-0" />
                                            <span className="truncate font-semibold text-3xs">{majorOutflow.description}</span>
                                            <span className="text-3xs font-black shrink-0">(-{formatCurrency(Math.abs(majorOutflow.amount), (majorOutflow.originalItem as any).currency)})</span>
                                        </div>
                                    ) : (
                                        <span className="text-3xs text-light-text-secondary dark:text-dark-text-secondary/60">No major outflow scheduled</span>
                                    )}
                                </div>
                            </div>

                            {/* KPI 2: Expected Income */}
                            <div className="p-4 sm:p-5 rounded-[1.75rem] bg-gradient-to-b from-emerald-500/[0.04] to-black/[0.02] dark:to-white/[0.02] border border-emerald-500/10 dark:border-emerald-500/20 flex flex-col justify-between space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Icon name="download" className="text-base text-emerald-600 dark:text-emerald-400" />
                                        <span className="text-3xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">Expected Income</span>
                                    </div>
                                    <span className="text-4xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                        {summaryMetrics.incCount} Ops
                                    </span>
                                </div>
                                <div>
                                    <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-light-text dark:text-dark-text">
                                        {formatCurrency(summaryMetrics.income, 'EUR')}
                                    </h2>
                                </div>
                                <div className="pt-2 border-t border-emerald-500/10 dark:border-emerald-500/15 flex items-center justify-between text-2xs min-w-0">
                                    {majorInflow ? (
                                        <div className="flex items-center gap-1.5 min-w-0 truncate text-emerald-600 dark:text-emerald-400">
                                            <Icon name="download" className="text-xs shrink-0" />
                                            <span className="truncate font-semibold text-3xs">{majorInflow.description}</span>
                                            <span className="text-3xs font-black shrink-0">(+{formatCurrency(majorInflow.amount, (majorInflow.originalItem as any).currency)})</span>
                                        </div>
                                    ) : (
                                        <span className="text-3xs text-light-text-secondary dark:text-dark-text-secondary/60">No major inflow scheduled</span>
                                    )}
                                </div>
                            </div>

                            {/* KPI 3: Overdue Obligations */}
                            <div className="p-4 sm:p-5 rounded-[1.75rem] bg-gradient-to-b from-amber-500/[0.04] to-black/[0.02] dark:to-white/[0.02] border border-amber-500/10 dark:border-amber-500/20 flex flex-col justify-between space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Icon name="warning" className="text-base text-amber-600 dark:text-amber-400" />
                                        <span className="text-3xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">Overdue Items</span>
                                    </div>
                                    <span className={`text-4xs font-bold px-2 py-0.5 rounded-full ${
                                        (groupedItems['Overdue']?.length || 0) > 0 
                                            ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10' 
                                            : 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                                    }`}>
                                        {(groupedItems['Overdue']?.length || 0) > 0 ? `${groupedItems['Overdue']?.length} Pending` : 'All Clear'}
                                    </span>
                                </div>
                                <div>
                                    <h2 className={`text-2xl sm:text-3xl font-black tracking-tighter ${(groupedItems['Overdue']?.length || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-light-text dark:text-dark-text'}`}>
                                        {groupedItems['Overdue']?.length || 0} <span className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">Items</span>
                                    </h2>
                                </div>
                                <div className="pt-2 border-t border-amber-500/10 dark:border-amber-500/15 flex items-center justify-between text-2xs min-w-0">
                                    {(groupedItems['Overdue']?.length || 0) > 0 ? (
                                        <span className="text-3xs font-bold text-rose-600 dark:text-rose-400 truncate">
                                            {formatCurrency(groupedItems['Overdue'].reduce((acc: number, i: any) => acc + Math.abs(i.amount), 0), 'EUR')} unpaid total
                                        </span>
                                    ) : (
                                        <span className="text-3xs text-emerald-600 dark:text-emerald-400 font-semibold">
                                            All obligations on track
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* KPI 4: Active Rules */}
                            <div className="p-4 sm:p-5 rounded-[1.75rem] bg-gradient-to-b from-primary-500/[0.04] to-black/[0.02] dark:to-white/[0.02] border border-primary-500/10 dark:border-primary-500/20 flex flex-col justify-between space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Icon name="event_repeat" className="text-base text-primary-500" />
                                        <span className="text-3xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">Active Rules</span>
                                    </div>
                                    <span className="text-4xs font-bold text-primary-500 bg-primary-500/10 px-2 py-0.5 rounded-full">
                                        {summaryMetrics.income > 0 ? Math.round((summaryMetrics.expense / summaryMetrics.income) * 100) : 0}% Burden
                                    </span>
                                </div>
                                <div>
                                    <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-light-text dark:text-dark-text">
                                        {recurringTransactions.length} <span className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">Rules</span>
                                    </h2>
                                </div>
                                <div className="pt-2 border-t border-primary-500/10 dark:border-primary-500/15 flex items-center justify-between text-2xs min-w-0">
                                    {(() => {
                                        const net = summaryMetrics.income - summaryMetrics.expense;
                                        return (
                                            <span className={`text-3xs font-bold truncate ${net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                Net Projected: {net >= 0 ? '+' : ''}{formatCurrency(net, 'EUR')}
                                            </span>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ROW #2: 3 Columns (0.2 Title Left, 0.6 Heatmap Center, 0.2 Legend Right) */}
                    <div className="relative z-10 p-5 sm:p-6 rounded-[2rem] bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-center">
                            {/* Column 1 (20% -> lg:col-span-1): Title & Subtitle */}
                            <div className="lg:col-span-1 flex flex-col justify-center space-y-1.5 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-primary-500 animate-pulse shrink-0" />
                                    <h3 className="text-3xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary leading-tight">
                                        12-Month Schedule Horizon Density
                                    </h3>
                                </div>
                                <p className="text-4xs text-light-text-secondary/70 dark:text-dark-text-secondary/70 leading-relaxed pl-4.5">
                                    Rolled weekly commitments & cashflow activity
                                </p>
                            </div>

                            {/* Column 2 (60% -> lg:col-span-3): Centered Heatmap */}
                            <div className="lg:col-span-3 overflow-x-auto w-full flex justify-center items-center py-1">
                                <ScheduleHeatmap items={allUpcomingForHeatmap} hideLegend={true} />
                            </div>

                            {/* Column 3 (20% -> lg:col-span-1): Legend */}
                            <div className="lg:col-span-1 flex flex-col justify-center space-y-2 min-w-0 lg:pl-4 lg:border-l border-black/5 dark:border-white/5">
                                <span className="text-4xs font-bold uppercase tracking-wider text-light-text-secondary/60 dark:text-dark-text-secondary/60">
                                    Activity Key
                                </span>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1.5 text-3xs text-light-text-secondary dark:text-dark-text-secondary font-medium">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-xs bg-gray-200 dark:bg-gray-700 shrink-0" />
                                        <span className="truncate">No Activity</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-xs bg-slate-400 shrink-0" />
                                        <span className="truncate">Transfer</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-xs bg-green-500 shrink-0" />
                                        <span className="truncate">Income</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-xs bg-red-500 shrink-0" />
                                        <span className="truncate">Expense</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-xs bg-purple-500 shrink-0" />
                                        <span className="truncate">Mixed</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- Navigation View Switcher with Search --- */}
                <div className="bg-white dark:bg-dark-card rounded-[2rem] p-3 border border-black/5 dark:border-white/5 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1">
                        {segments.map(seg => {
                            const isActive = activeSegment === seg.id;
                            return (
                                <button
                                    key={seg.id}
                                    type="button"
                                    onClick={() => setActiveSegment(seg.id)}
                                    className={`group relative flex items-center gap-3 p-3.5 rounded-2xl transition-all duration-300 border text-left ${
                                        isActive
                                            ? 'bg-primary-500/10 border-primary-500/20 shadow-xs'
                                            : 'hover:bg-black/5 dark:hover:bg-white/5 border-transparent'
                                    }`}
                                >
                                    <div
                                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                                            isActive
                                                ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30'
                                                : 'bg-black/5 dark:bg-white/5 text-light-text-secondary dark:text-dark-text-secondary'
                                        }`}
                                    >
                                        <Icon name={seg.icon} className="text-lg" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className={`text-xs font-bold uppercase tracking-wider truncate ${isActive ? 'text-primary-500' : 'text-light-text dark:text-dark-text'}`}>
                                            {seg.label}
                                        </span>
                                    </div>
                                    {isActive && (
                                        <motion.div
                                            layoutId="active-nav-dot"
                                            className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]"
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Quick Search */}
                    <div className="relative w-full md:w-72 shrink-0">
                        <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary text-xs" />
                        <input 
                            type="text" 
                            placeholder="Search obligations..." 
                            value={searchQuery} 
                            onChange={(e) => setSearchQuery(e.target.value)} 
                            className="w-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-2xl py-2.5 pl-9 pr-8 text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-primary-500 transition-all placeholder:text-light-text-secondary/50 dark:text-dark-text"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-secondary hover:text-light-text dark:hover:text-dark-text transition-colors p-1"
                                title="Clear search"
                            >
                                <Icon name="close" className="text-xs" />
                            </button>
                        )}
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
                             {oldUnpaidBills.length > 0 && (
                                <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <Icon name="event_busy" className="text-2xl text-amber-600 dark:text-amber-400 flex-shrink-0" />
                                        <div>
                                            <h4 className="font-bold text-sm text-light-text dark:text-dark-text">
                                                {oldUnpaidBills.length} One-Time Bill(s) Older Than 7 Days
                                            </h4>
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                                These bills are beyond the active 7-day lookahead window. Archive them to keep your active schedule clean.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleExpireAllOldBills}
                                        className="px-4 py-2.5 rounded-2xl bg-amber-500 text-white font-bold text-xs hover:bg-amber-600 transition-all flex items-center gap-2 flex-shrink-0 shadow-md shadow-amber-500/20"
                                    >
                                        <Icon name="archive" className="text-sm" />
                                        <span>Mark as Expired & Archive</span>
                                    </button>
                                </div>
                             )}

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
                                        allCategories={[...incomeCategories, ...expenseCategories]}
                                        onEdit={handleEditItem} 
                                        onDelete={handleDeleteItem} 
                                        onPost={handleOpenPostModal}
                                        onEndSeries={handleEndSeries}
                                        onExpireBill={handleExpireBill}
                                        totalAmount={groupTotal}
                                        defaultOpen={['Today', 'Next 7 Days'].includes(groupKey)}
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
                                                <Icon
                                                  name={rt.type === 'transfer' ? 'sync_alt' : rt.type === 'income' ? 'download' : 'upload'}
                                                  className={`text-xl ${rt.type === 'income' ? 'text-emerald-500' : 'text-light-text-secondary'}`}
                                                />
                                                <div className="min-w-0">
                                                    <h4 className="font-bold text-base truncate pr-8">{rt.description}</h4>
                                                    <span className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary/60">{rt.frequency} cycle</span>
                                                </div>
                                            </div>
                                            {rt.isSynthetic && (
                                                <span className="absolute top-6 right-6 text-xs font-semibold bg-primary-500/10 text-primary-500 px-2 py-0.5 rounded-full uppercase tracking-wider">Synthetic</span>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between pt-6 border-t border-black/5 dark:border-white/5">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary/40">Expected Value</span>
                                                <span className={`text-lg font-black tabular-nums ${rt.type === 'income' ? 'text-emerald-600' : 'text-light-text dark:text-dark-text'}`}>{formatCurrency(rt.amount, rt.currency)}</span>
                                            </div>
                                            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleOpenRecurringModal(rt as RecurringTransaction)} disabled={rt.isSynthetic} className="p-2 hover:bg-primary-500/10 text-primary-500 rounded-xl disabled:opacity-20 transition-all"><Icon name="settings" className="text-lg" /></button>
                                                <button onClick={() => handleDeleteItem(rt.id, true)} disabled={rt.isSynthetic} className="p-2 hover:bg-rose-500/10 text-rose-500 rounded-xl disabled:opacity-20 transition-all"><Icon name="delete" className="text-lg" /></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    )}

                    {activeSegment === 'expired' && (
                        <motion.div key="expired" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                            <div className="bg-white dark:bg-dark-card rounded-[2.5rem] p-8 border border-black/5 dark:border-white/5 shadow-sm">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-black/5 dark:border-white/5">
                                    <div>
                                        <div className="flex items-center gap-3">
                                        <Icon name="inventory_2" className="text-2xl text-amber-500" />
                                            <div>
                                                <h3 className="text-xl font-bold text-light-text dark:text-dark-text">Expired & Archived Bills</h3>
                                                <p className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                                    One-time bills that passed their 7-day lookahead window or were manually archived.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {oldUnpaidBills.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={handleExpireAllOldBills}
                                            className="px-4 py-2.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500 text-amber-600 dark:text-amber-400 hover:text-white text-xs font-bold transition-all flex items-center gap-2 self-start sm:self-auto"
                                        >
                                            <Icon name="event_busy" className="text-base" />
                                            <span>Archive {oldUnpaidBills.length} Old Unpaid Bill(s)</span>
                                        </button>
                                    )}
                                </div>

                                {expiredBills.length === 0 ? (
                                    <div className="py-16 text-center space-y-3">
                                        <Icon name="inbox" className="text-4xl text-light-text-secondary block mx-auto mb-3" />
                                        <h4 className="font-bold text-base text-light-text dark:text-dark-text">No Expired Bills Archived</h4>
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary max-w-md mx-auto">
                                            One-time bills marked as expired or older than 7 days will be safely moved here so they no longer clutter active schedules.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-6">
                                        {expiredBills.map((bill) => (
                                            <div key={bill.id} className="bg-gray-50/50 dark:bg-white/5 rounded-2xl p-5 border border-black/5 dark:border-white/10 flex flex-col justify-between gap-4">
                                                <div className="flex justify-between items-start gap-2">
                                                    <div>
                                                        <h4 className="font-bold text-base text-light-text dark:text-dark-text">{bill.description}</h4>
                                                        <div className="flex items-center gap-1.5 text-xs font-medium text-light-text-secondary/80 dark:text-dark-text-secondary/80 mt-1">
                                                            <Icon name="calendar_today" className="text-sm" />
                                                            <span>Due {parseLocalDate(bill.dueDate).toLocaleDateString()}</span>
                                                        </div>
                                                        <div className="text-xs font-medium text-light-text-secondary/70 dark:text-dark-text-secondary/70 mt-1">
                                                            Account: {bill.accountId ? accountMap[bill.accountId] : 'External'}
                                                        </div>
                                                    </div>
                                                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                        EXPIRED
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between pt-4 border-t border-black/5 dark:border-white/5">
                                                    <span className="text-xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
                                                        {formatCurrency(bill.amount, bill.currency)}
                                                    </span>

                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRestoreBill(bill)}
                                                            className="px-3 py-1.5 rounded-xl bg-primary-500/10 text-primary-500 hover:bg-primary-500 hover:text-white text-xs font-bold transition-all flex items-center gap-1"
                                                            title="Restore to Active Bills"
                                                        >
                                                            <Icon name="restore" className="text-sm" />
                                                            <span>Restore</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenPostModal({
                                                                id: bill.id,
                                                                isRecurring: false,
                                                                date: bill.dueDate,
                                                                description: bill.description,
                                                                amount: bill.amount,
                                                                accountName: bill.accountId ? accountMap[bill.accountId] : 'External',
                                                                type: bill.type,
                                                                originalItem: bill,
                                                            })}
                                                            className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all"
                                                            title="Mark as Paid"
                                                        >
                                                            <Icon name="check" className="text-sm" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                deleteBillPayment(bill.id);
                                                                toast.success(`Deleted bill "${bill.description}".`);
                                                            }}
                                                            className="p-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all"
                                                            title="Delete Bill"
                                                        >
                                                            <Icon name="delete" className="text-sm" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            )}
        </div>
    );
};

export default React.memo(SchedulePage);
