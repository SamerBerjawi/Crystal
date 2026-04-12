
import React, { useState, useRef, useEffect } from 'react';
import { ScheduledItem, RecurringTransaction } from '../types';
import { Account } from '../types';
import { formatCurrency, parseLocalDate, toLocalISOString } from '../utils';

interface ScheduledItemRowProps {
    item: ScheduledItem;
    accounts: Account[];
    onEdit: (item: ScheduledItem) => void;
    onDelete: (id: string, isRecurring: boolean) => void;
    onPost: (item: ScheduledItem) => void;
    isReadOnly?: boolean;
    compact?: boolean;
    onEndSeries?: (item: ScheduledItem) => void;
}

const ScheduledItemRow: React.FC<ScheduledItemRowProps> = ({ item, accounts, onEdit, onDelete, onPost, isReadOnly = false, compact = false, onEndSeries }) => {
    
    const isIncome = item.type === 'income' || item.type === 'deposit';
    const isTransfer = item.type === 'transfer';
    const isSkipped = item.isSkipped;
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    
    // Check overdue based on local ISO string comparison
    const todayStr = toLocalISOString(new Date());
    const isOverdue = !item.isRecurring && item.date < todayStr && !isSkipped;
    
    const dueDate = parseLocalDate(item.date);
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
    
    const opacityClass = isSkipped ? 'opacity-50' : 'opacity-100';
    const strikethroughClass = isSkipped ? 'line-through decoration-gray-500' : '';

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        if(isMenuOpen) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isMenuOpen]);

    return (
      <div className={`group relative flex items-center gap-4 ${compact ? 'p-3' : 'p-4'} bg-white dark:bg-dark-card rounded-xl border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-200 ${opacityClass}`}>
        {/* Date Block */}
        <div className={`flex-shrink-0 flex flex-col items-center justify-center ${compact ? 'w-10 h-10 rounded-lg' : 'w-14 h-14 rounded-xl'} border ${isOverdue ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-gray-50 dark:bg-white/5 border-black/5 dark:border-white/10'}`}>
            <span className={`${compact ? 'text-[8px]' : 'text-[10px]'} font-bold uppercase tracking-wider ${isOverdue ? 'text-red-500' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>{month}</span>
            <span className={`${compact ? 'text-sm' : 'text-xl'} font-extrabold leading-none ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-light-text dark:text-dark-text'}`}>{day}</span>
        </div>

        {/* Content */}
        <div className="flex-grow min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
                <h4 className={`font-bold text-light-text dark:text-dark-text truncate ${compact ? 'text-sm' : 'text-base'} ${strikethroughClass}`}>{item.description}</h4>
                {item.isOverride && !isSkipped && (
                    <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 uppercase tracking-wide">Modified</span>
                )}
                 {isOverdue && (
                    <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 uppercase tracking-wide">Overdue</span>
                )}
                {isSkipped && (
                    <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 uppercase tracking-wide">Skipped</span>
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
        <div className="flex flex-col items-end gap-1 relative">
             <span className={`${compact ? 'text-sm' : 'text-base'} font-bold font-mono tracking-tight ${amountColor} ${strikethroughClass}`}>
                {formatCurrency(item.amount, 'EUR')}
             </span>
             
             {/* Action Buttons */}
             <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${isReadOnly ? 'invisible' : ''}`}>
                {!isSkipped && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onPost(item); }}
                        className="p-1 rounded-md bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors" 
                        title="Post Transaction"
                    >
                        <span className="material-symbols-outlined text-[18px]">check</span>
                    </button>
                )}
                <button 
                    onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                    className="p-1 rounded-md text-light-text-secondary hover:bg-black/5 dark:hover:bg-white/10 transition-colors" 
                    title={isSkipped ? "Unskip / Edit" : "Edit"}
                >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
                
                {/* Delete Menu Trigger */}
                 <div className="relative" ref={menuRef}>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
                        className="p-1 rounded-md text-light-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Delete Options"
                    >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                    {isMenuOpen && (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-dark-card rounded-lg shadow-xl border border-black/5 dark:border-white/10 py-1 z-50 animate-fade-in-up origin-top-right overflow-hidden">
                             {item.isRecurring && onEndSeries && (
                                <button
                                    type="button"
                                    onClick={(e) => { 
                                        e.preventDefault(); 
                                        e.stopPropagation(); 
                                        setIsMenuOpen(false);
                                        onEndSeries(item); 
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2 text-orange-600 dark:text-orange-400 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-sm">stop_circle</span>
                                    End Series
                                </button>
                            )}
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(item.originalItem.id, item.isRecurring); setIsMenuOpen(false); }}
                                className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 text-red-600 dark:text-red-400 transition-colors"
                            >
                                <span className="material-symbols-outlined text-sm">delete_forever</span>
                                Delete All
                            </button>
                        </div>
                    )}
                </div>
             </div>
        </div>
      </div>
    );
};

export default ScheduledItemRow;
