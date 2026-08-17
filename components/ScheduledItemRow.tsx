import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ScheduledItem, RecurringTransaction, BillPayment, Account, Category } from '../types';
import { formatCurrency, parseLocalDate, toLocalISOString } from '../utils';
import { getMerchantLogoUrl } from '../utils/brandfetch';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import Icon from './ui/Icon';

interface ScheduledItemRowProps {
    item: ScheduledItem;
    accounts: Account[];
    allCategories?: Category[];
    onEdit: (item: ScheduledItem) => void;
    onDelete: (id: string, isRecurring: boolean) => void;
    onPost: (item: ScheduledItem) => void;
    isReadOnly?: boolean;
    compact?: boolean;
    onEndSeries?: (item: ScheduledItem) => void;
    onExpireBill?: (bill: BillPayment) => void;
}

const ScheduledItemRow: React.FC<ScheduledItemRowProps> = ({
    item,
    accounts,
    allCategories = [],
    onEdit,
    onDelete,
    onPost,
    isReadOnly = false,
    compact = false,
    onEndSeries,
    onExpireBill,
}) => {
    const brandfetchClientId = usePreferencesSelector(p => p.brandfetchClientId || '');
    const merchantLogoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
    const [logoLoadError, setLogoLoadError] = useState(false);

    const isIncome = item.type === 'income' || item.type === 'deposit';
    const isTransfer = item.type === 'transfer' || item.isTransfer;
    const isSkipped = item.isSkipped;
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    
    // Check overdue based on local ISO string comparison
    const todayStr = toLocalISOString(new Date());
    const isOverdue = item.date < todayStr && !isSkipped;
    
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
        subText += ` • One-time Bill`;
    }

    // Resolve Category from configured category field
    const categoryInfo = useMemo(() => {
        const configuredCat = item.category || (item.originalItem as any)?.category || '';
        let name = configuredCat || (isIncome ? 'Income' : isTransfer ? 'Transfer' : '');
        let icon = isIncome ? 'arrow_downward' : isTransfer ? 'sync' : 'schedule';
        let color = isIncome ? '#10b981' : isTransfer ? '#64748b' : '#6366f1';

        if (configuredCat && allCategories.length > 0) {
            const matchCategory = (nodes: Category[], parentColor?: string): boolean => {
                for (const node of nodes) {
                    if (node.name.toLowerCase() === configuredCat.toLowerCase()) {
                        name = node.name;
                        icon = node.icon || icon;
                        color = node.color || parentColor || color;
                        return true;
                    }
                    if (node.subCategories && node.subCategories.length > 0) {
                        if (matchCategory(node.subCategories, node.color || parentColor)) return true;
                    }
                }
                return false;
            };
            matchCategory(allCategories);
        }

        return { name, icon, color };
    }, [item, allCategories, isIncome, isTransfer]);

    // Resolve Merchant from configured merchant field or description
    const configuredMerchant = item.merchant || (item.originalItem as any)?.merchant || (item.originalItem as any)?.biller || item.description;

    const logoUrl = useMemo(() => {
        return getMerchantLogoUrl(
            configuredMerchant,
            brandfetchClientId,
            merchantLogoOverrides,
            { fallback: 'lettermark', type: 'icon', width: 80, height: 80 }
        );
    }, [configuredMerchant, brandfetchClientId, merchantLogoOverrides]);

    const showLogo = Boolean(logoUrl && !logoLoadError);

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
      <div className={`group relative flex items-center gap-4 sm:gap-6 ${compact ? 'p-2' : 'p-3'} bg-white dark:bg-dark-card rounded-[1.5rem] border border-black/5 dark:border-white/5 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 ${opacityClass} ${isMenuOpen ? 'z-40' : 'z-0'}`}>
        <div className="absolute inset-0 pointer-events-none rounded-[1.5rem] overflow-hidden">
             <div className="absolute -top-12 -right-12 w-32 h-32 blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 bg-gradient-to-br from-primary-500 to-indigo-600" />
        </div>

        {/* Date Block */}
        <div className={`relative z-10 flex-shrink-0 flex flex-col items-center justify-center ${compact ? 'w-12 h-12 rounded-2xl' : 'w-16 h-16 rounded-[1.25rem]'} border shadow-inner transition-colors duration-300 ${
            isOverdue 
                ? (item.isRecurring 
                    ? 'bg-indigo-500/10 border-indigo-500/20 shadow-indigo-500/5' 
                    : 'bg-rose-500/10 border-rose-500/20 shadow-rose-500/5') 
                : 'bg-gray-50 dark:bg-white/5 border-black/5 dark:border-white/10 shadow-black/5'
        }`}>
            <span className={`${compact ? 'text-2xs' : 'text-xs'} font-black tracking-[0.2em] transition-colors ${
                isOverdue 
                    ? (item.isRecurring ? 'text-indigo-500 dark:text-indigo-400' : 'text-rose-500 dark:text-rose-400') 
                    : 'text-light-text-secondary/60 dark:text-dark-text-secondary/60'
            }`}>{month}</span>
            <span className={`${compact ? 'text-lg' : 'text-2xl'} font-black leading-none tabular-nums tracking-tighter ${
                isOverdue 
                    ? (item.isRecurring ? 'text-indigo-600 dark:text-indigo-300' : 'text-rose-600 dark:text-rose-300') 
                    : 'text-light-text dark:text-dark-text'
            }`}>{day}</span>
        </div>

        {/* Merchant / Category Logo Squircle */}
        <div className="relative z-10 shrink-0">
            <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center overflow-hidden border shadow-xs ${
                    showLogo
                        ? 'bg-white dark:bg-white/10 border-black/10 dark:border-white/10'
                        : 'text-white border-transparent'
                }`}
                style={showLogo ? undefined : { backgroundColor: categoryInfo.color }}
            >
                {showLogo && logoUrl ? (
                    <img
                        src={logoUrl}
                        alt={item.description}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={() => setLogoLoadError(true)}
                    />
                ) : (
                    <Icon name={categoryInfo.icon} className="text-xl" />
                )}
            </div>
            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-2xs shadow-xs text-white ${isIncome ? 'bg-emerald-500' : 'bg-orange-500'}`}>
                <Icon name={item.isRecurring ? 'refresh' : 'receipt'} className="text-xs" />
            </div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex-grow min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h4 className={`font-bold text-light-text dark:text-dark-text truncate tracking-tight transition-colors group-hover:text-primary-500 ${compact ? 'text-base' : 'text-lg'} ${strikethroughClass}`}>{item.description}</h4>
                <div className="flex gap-1.5 items-center">
                    {categoryInfo.name && (
                        <span
                            className="px-2 py-0.5 rounded text-2xs font-black text-white"
                            style={{ backgroundColor: categoryInfo.color }}
                        >
                            {categoryInfo.name}
                        </span>
                    )}
                    {item.isOverride && !isSkipped && (
                        <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-2xs font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 tracking-widest border border-amber-500/10">MOD</span>
                    )}
                    {isOverdue && item.isRecurring && (
                        <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-2xs font-black bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 tracking-wider border border-indigo-500/30 flex items-center gap-1 animate-pulse">
                            <Icon name="refresh" className="text-xs" />
                            RECURRING OVERDUE
                        </span>
                    )}
                    {isOverdue && !item.isRecurring && (
                        <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-2xs font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 tracking-wider border border-rose-500/30 flex items-center gap-1 animate-pulse">
                            <Icon name="receipt" className="text-xs" />
                            ONE-TIME OVERDUE
                        </span>
                    )}
                    {isSkipped && (
                        <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-2xs font-black bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400 tracking-widest">SKIP</span>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold text-light-text-secondary/60 dark:text-dark-text-secondary/60 tracking-wider">
                <span>{weekday}</span>
                <span className="w-1 h-1 rounded-full bg-current opacity-40"></span>
                <span className="flex items-center gap-1.5 truncate">
                    <Icon name={isTransfer ? 'SwitchHorizontal01' : (item.isRecurring ? 'refresh' : 'FileText01')} className="text-sm" />
                    {subText}
                </span>
            </div>
        </div>

        {/* Amount & Actions */}
        <div className={`relative flex flex-col items-end gap-1.5 ${isMenuOpen ? 'z-50' : 'z-10'}`}>
             <span className={`${compact ? 'text-lg' : 'text-xl'} font-black tabular-nums tracking-tighter ${amountColor} ${strikethroughClass}`}>
                {formatCurrency(item.amount, 'EUR')}
             </span>
             
             {/* Action Buttons */}
             <div className={`flex items-center gap-1.5 transition-all duration-300 ${isMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0'} ${isReadOnly ? 'invisible' : ''}`}>
                {!isSkipped && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onPost(item); }}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-emerald-500 text-white hover:shadow-lg hover:shadow-emerald-500/30 active:scale-95 transition-all" 
                        title="Post Transaction"
                    >
                        <Icon name="check" className="text-lg" />
                    </button>
                )}

                {!item.isRecurring && onExpireBill && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onExpireBill(item.originalItem as BillPayment); }}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white active:scale-95 transition-all" 
                        title="Mark as Expired"
                    >
                        <Icon name="archive" className="text-lg" />
                    </button>
                )}

                <button 
                    onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5 text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-500 hover:bg-primary-500/10 active:scale-95 transition-all" 
                    title="Edit Recurrence"
                >
                    <Icon name="edit" className="text-lg" />
                </button>
                
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(item.id, item.isRecurring); }}
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5 text-light-text-secondary dark:text-dark-text-secondary hover:text-rose-500 hover:bg-rose-500/10 active:scale-95 transition-all" 
                    title="Delete"
                >
                    <Icon name="delete" className="text-lg" />
                </button>
             </div>
        </div>
      </div>
    );
};

export default ScheduledItemRow;
