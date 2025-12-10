
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
    // ... (logic remains same)
    
    // ...

    return (
      <div className={`group relative flex items-center gap-4 ${compact ? 'p-3' : 'p-4'} bg-white dark:bg-dark-card rounded-xl border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-200`}>
        {/* ... (Date and Description) ... */}
        
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
             
             {/* ... (Actions) ... */}
        </div>
      </div>
    );
};

// --- Summary Card Component ---
const ScheduleSummaryCard: React.FC<{ title: string; value: number; type: 'income' | 'expense' | 'net'; count?: number }> = ({ title, value, type, count }) => {
    // ... (logic remains same)

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
            
            {/* ... */}
        </div>
    );
}

// ... (Rest of file)

const SchedulePage: React.FC<ScheduleProps> = () => {
    // ...

    return (
        // ...
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
                                    defaultOpen={['Today', 'Next 7 Days'].includes(groupKey)}
                                />
                            );
                        })}
        // ...
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
                                    <p className={`font-bold font-mono privacy-blur ${rt.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-light-text dark:text-dark-text'}`}>
                                        {formatCurrency(rt.amount, rt.currency)}
                                    </p>
                                    <div className="flex justify-end gap-2 mt-2">
                                        {/* ... (Buttons) */}
                                    </div>
                                </div>
                            </div>
                            ))}
                            {/* ... */}
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(SchedulePage);
