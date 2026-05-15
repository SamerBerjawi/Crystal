
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
    const month = (dueDate.toLocaleString('default', { month: 'short' }) || '').toUpperCase();
    const weekday = dueDate.toLocaleString('default', { weekday: 'long' });

    // Determine status/frequency text
    let subText = item.accountName;
    if (item.isRecurring) {
        const rt = item.originalItem as RecurringTransaction;
        const freq = rt.frequency || 'recurring';
        subText += ` • ${freq.charAt(0).toUpperCase() + freq.slice(1)}`;
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
      <div className={`group relative flex items-center gap-6 ${compact ? 'p-2' : 'p-3'} bg-white dark:bg-dark-card rounded-[1.5rem] border border-black/5 dark:border-white/5 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 ${opacityClass}`}>
        <div className="absolute inset-0 pointer-events-none rounded-[1.5rem] overflow-hidden">
             <div className="absolute -top-12 -right-12 w-32 h-32 blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 bg-gradient-to-br from-primary-500 to-indigo-600" />
        </div>

        {/* Date Block */}
        <div className={`relative z-10 flex-shrink-0 flex flex-col items-center justify-center ${compact ? 'w-12 h-12 rounded-2xl' : 'w-16 h-16 rounded-[1.25rem]'} border shadow-inner transition-colors duration-300 ${isOverdue ? 'bg-rose-500/10 border-rose-500/20 shadow-rose-500/5' : 'bg-gray-50 dark:bg-white/5 border-black/5 dark:border-white/10 shadow-black/5'}`}>
            <span className={`${compact ? 'text-[9px]' : 'text-[11px]'} font-black uppercase tracking-[0.2em] transition-colors ${isOverdue ? 'text-rose-500' : 'text-light-text-secondary/60 dark:text-dark-text-secondary/60'}`}>{month}</span>
            <span className={`${compact ? 'text-lg' : 'text-2xl'} font-black leading-none tabular-nums tracking-tighter ${isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-light-text dark:text-dark-text'}`}>{day}</span>
        </div>

        {/* Content */}
        <div className="relative z-10 flex-grow min-w-0">
            <div className="flex items-center gap-2 mb-1">
                <h4 className={`font-black text-light-text dark:text-dark-text truncate tracking-tight transition-colors group-hover:text-primary-500 ${compact ? 'text-base' : 'text-lg'} ${strikethroughClass}`}>{item.description}</h4>
                <div className="flex gap-1">
                    {item.isOverride && !isSkipped && (
                        <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 uppercase tracking-widest border border-amber-500/10">MOD</span>
                    )}
                    {isOverdue && (
                        <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 uppercase tracking-widest border border-rose-500/10 animate-pulse">LATE</span>
                    )}
                    {isSkipped && (
                        <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400 uppercase tracking-widest">SKIP</span>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-bold text-light-text-secondary/60 dark:text-dark-text-secondary/60 uppercase tracking-widest">
                <span>{weekday}</span>
                <span className="w-1 h-1 rounded-full bg-current opacity-40"></span>
                <span className="flex items-center gap-2 truncate">
                    <span className="material-symbols-outlined text-sm">{isTransfer ? 'sync_alt' : (item.isRecurring ? 'repeat' : 'description')}</span>
                    {subText}
                </span>
            </div>
        </div>

        {/* Amount & Actions */}
        <div className="relative z-10 flex flex-col items-end gap-1.5">
             <span className={`${compact ? 'text-lg' : 'text-xl'} font-black tabular-nums tracking-tighter ${amountColor} ${strikethroughClass}`}>
                {formatCurrency(item.amount, 'EUR')}
             </span>
             
             {/* Action Buttons */}
             <div className={`flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 ${isReadOnly ? 'invisible' : ''}`}>
                {!isSkipped && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onPost(item); }}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-emerald-500 text-white hover:shadow-lg hover:shadow-emerald-500/30 active:scale-95 transition-all" 
                        title="Post Transaction"
                    >
                        <span className="material-symbols-outlined text-[18px]">check</span>
                    </button>
                )}
                <button 
                    onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5 text-light-text-secondary hover:bg-primary-500 hover:text-white active:scale-95 transition-all" 
                    title={isSkipped ? "Unskip / Edit" : "Edit"}
                >
                    <span className="material-symbols-outlined text-[18px]">settings</span>
                </button>
                
                {/* Delete Menu Trigger */}
                 <div className="relative" ref={menuRef}>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5 text-light-text-secondary hover:bg-rose-500 hover:text-white active:scale-95 transition-all"
                        title="Delete Options"
                    >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                    {isMenuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-44 bg-white dark:bg-dark-card rounded-2xl shadow-2xl border border-black/5 dark:border-white/10 py-1.5 z-50 animate-fade-in-up origin-top-right overflow-hidden">
                             {item.isRecurring && onEndSeries && (
                                <button
                                    type="button"
                                    onClick={(e) => { 
                                        e.preventDefault(); 
                                        e.stopPropagation(); 
                                        setIsMenuOpen(false);
                                        onEndSeries(item); 
                                    }}
                                    className="w-full text-left px-4 py-3 text-[11px] font-black uppercase tracking-widest hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-3 text-amber-600 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-base">stop_circle</span>
                                    Stop Series
                                </button>
                            )}
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(item.originalItem.id, item.isRecurring); setIsMenuOpen(false); }}
                                className="w-full text-left px-4 py-3 text-[11px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white flex items-center gap-3 text-rose-600 transition-colors"
                            >
                                <span className="material-symbols-outlined text-base">delete_forever</span>
                                Purge All
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
