
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FinancialGoal, Account } from '../types';
import { formatCurrency, getPreferredTimeZone, parseLocalDate } from '../utils';

interface FinancialGoalCardProps {
  goal: FinancialGoal;
  subGoals: FinancialGoal[];
  isActive: boolean;
  onToggle: (id: string) => void;
  onEdit: (goal: FinancialGoal) => void;
  onDuplicate: (goal: FinancialGoal) => void;
  onDelete: (id: string) => void;
  onAddSubGoal: (parentId: string) => void;
  accounts: Account[];
}

const FinancialGoalCard: React.FC<FinancialGoalCardProps> = ({ goal, subGoals, isActive, onToggle, onEdit, onDuplicate, onDelete, onAddSubGoal, accounts }) => {
  const isBucket = !!goal.isBucket;
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const timeZone = getPreferredTimeZone();

  const totalAmount = isBucket ? subGoals.reduce((sum, sg) => sum + sg.amount, 0) : goal.amount;
  const currentAmount = isBucket ? subGoals.reduce((sum, sg) => sum + sg.currentAmount, 0) : goal.currentAmount;
  
  const bucketProjectedDate = isBucket ? subGoals.reduce((latest, sg) => {
    if (!sg.projection?.projectedDate || sg.projection.projectedDate === 'Beyond forecast') return latest;
    if (!latest || parseLocalDate(sg.projection.projectedDate) > parseLocalDate(latest)) return sg.projection.projectedDate;
    return latest;
  }, '' as string | null) || 'Beyond forecast' : null;

  const bucketStatus = useMemo(() => {
      if (!isBucket) return null;
      if (subGoals.some(sg => sg.projection?.status === 'off-track')) return 'off-track';
      if (subGoals.some(sg => sg.projection?.status === 'at-risk')) return 'at-risk';
      if (subGoals.length > 0 && subGoals.every(sg => sg.projection?.status === 'on-track')) return 'on-track';
      return 'off-track'; // Default
  }, [isBucket, subGoals]);

  const goalToDisplay: FinancialGoal = isBucket ? {
    ...goal,
    amount: totalAmount,
    currentAmount: currentAmount,
    date: subGoals.length > 0 ? subGoals.sort((a,b) => parseLocalDate(b.date!).getTime() - parseLocalDate(a.date!).getTime())[0].date : undefined,
    projection: {
        projectedDate: bucketProjectedDate!,
        status: bucketStatus!,
    },
  } : goal;

  const progress = goalToDisplay.amount > 0 ? (goalToDisplay.currentAmount / goalToDisplay.amount) * 100 : 0;
  const isCompleted = progress >= 100;

  const isIncomeGoal = goalToDisplay.transactionType === 'income';

  // Determine bucket label
  const bucketTypeLabel = useMemo(() => {
      if (!isBucket) return isIncomeGoal ? 'Earned' : 'Saved';
      
      const hasIncome = subGoals.some(sg => sg.transactionType === 'income');
      const hasExpense = subGoals.some(sg => sg.transactionType === 'expense');

      if (hasIncome && hasExpense) return 'Mixed';
      if (hasIncome) return 'Earned';
      return 'Saved';
  }, [isBucket, isIncomeGoal, subGoals]);

  const formatDate = (dateString?: string) => {
    if (!dateString || dateString === 'Beyond forecast') return 'Beyond forecast';
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone });
  };
  
  const statusConfig = {
    'on-track': { text: 'On Track', bg: 'bg-emerald-100 dark:bg-emerald-900/30', textCol: 'text-emerald-700 dark:text-emerald-400', icon: 'check_circle', border: 'border-emerald-200 dark:border-emerald-800' },
    'at-risk': { text: 'At Risk', bg: 'bg-amber-100 dark:bg-amber-900/30', textCol: 'text-amber-700 dark:text-amber-400', icon: 'warning', border: 'border-amber-200 dark:border-amber-800' },
    'off-track': { text: 'Off Track', bg: 'bg-rose-100 dark:bg-rose-900/30', textCol: 'text-rose-700 dark:text-rose-400', icon: 'error', border: 'border-rose-200 dark:border-rose-800' },
  };

  const statusStyle = goalToDisplay.projection ? statusConfig[goalToDisplay.projection.status] : null;

  const paymentAccountName = useMemo(() => {
    if (!goalToDisplay.paymentAccountId) return null;
    return accounts.find(a => a.id === goalToDisplay.paymentAccountId)?.name;
  }, [goalToDisplay.paymentAccountId, accounts]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(goal.id);
  };

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
        document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  // Dynamic Styles
  const cardBorder = isCompleted 
    ? 'border-green-500/50 bg-green-50/50 dark:bg-green-900/10' 
    : isActive 
        ? 'border-primary-500/50 dark:border-primary-500/50 shadow-md' 
        : 'border-black/5 dark:border-white/5 opacity-80 hover:opacity-100';

  const iconColorClass = isCompleted 
    ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' 
    : isBucket 
        ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' 
        : isIncomeGoal
            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
            : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
            
  const iconName = isCompleted 
    ? 'check_circle' 
    : isBucket 
        ? 'folder_open' 
        : isIncomeGoal 
            ? 'monetization_on' 
            : 'flag';

  const progressBarClass = isCompleted 
    ? 'bg-green-500' 
    : isActive 
        ? isIncomeGoal 
            ? 'bg-gradient-to-r from-emerald-500 to-teal-500' 
            : 'bg-gradient-to-r from-primary-500 to-indigo-500'
        : 'bg-gray-400';

  return (
    <div className={`relative group flex flex-col bg-white dark:bg-dark-card rounded-2xl shadow-sm border transition-all duration-300 self-start w-full ${cardBorder}`}>
        {isCompleted && (
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <span className="material-symbols-outlined text-8xl text-green-500">emoji_events</span>
            </div>
        )}

        <div className="p-5 flex flex-col h-full relative z-0">
            {/* Header - Aligned Row */}
            <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3 min-w-0 pr-2">
                     <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${iconColorClass}`}>
                        <span className="material-symbols-outlined text-xl">{iconName}</span>
                    </div>
                    <h4 className="font-bold text-lg text-light-text dark:text-dark-text truncate" title={goal.name}>{goal.name}</h4>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                     {!isCompleted && (
                         <button 
                            onClick={handleToggle}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isActive ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                            title={isActive ? 'Active in forecast' : 'Ignored in forecast'}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    )}
                    
                    <div className="relative" ref={menuRef}>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary transition-colors"
                        >
                            <span className="material-symbols-outlined text-xl">more_vert</span>
                        </button>
                        {isMenuOpen && (
                            <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-dark-card rounded-xl shadow-xl border border-black/5 dark:border-white/10 py-1.5 z-50 animate-fade-in-up origin-top-right">
                                {isBucket && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onAddSubGoal(goal.id); setIsMenuOpen(false); }} 
                                        className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-3 text-light-text dark:text-dark-text transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-lg text-primary-500">add</span> 
                                        Add Item
                                    </button>
                                )}
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onEdit(goal); setIsMenuOpen(false); }} 
                                    className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-3 text-light-text dark:text-dark-text transition-colors"
                                >
                                    <span className="material-symbols-outlined text-lg text-blue-500">edit</span> 
                                    Edit
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDuplicate(goal); setIsMenuOpen(false); }} 
                                    className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-3 text-light-text dark:text-dark-text transition-colors"
                                >
                                    <span className="material-symbols-outlined text-lg text-teal-500">content_copy</span> 
                                    Duplicate
                                </button>
                                <div className="h-px bg-black/5 dark:bg-white/5 my-1"></div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDelete(goal.id); setIsMenuOpen(false); }} 
                                    className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 text-red-600 dark:text-red-400 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-lg">delete</span> 
                                    Delete
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Badges / Status */}
            <div className="flex flex-wrap gap-2 mb-4">
                 {/* Type Badge - Only if NOT bucket */}
                 {!isBucket && (
                     <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${isIncomeGoal ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800'}`}>
                        {isIncomeGoal ? 'Earning' : 'Saving'}
                    </span>
                 )}

                {statusStyle && isActive && !isCompleted && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${statusStyle.bg} ${statusStyle.textCol} ${statusStyle.border}`}>
                        <span className="material-symbols-outlined text-[12px]">{statusStyle.icon}</span>
                        {statusStyle.text}
                    </span>
                )}
                {isCompleted && (
                     <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                        <span className="material-symbols-outlined text-[12px]">emoji_events</span>
                        Completed
                    </span>
                )}
                {(goalToDisplay.date && !isBucket) && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                        <span className="material-symbols-outlined text-[12px]">event</span>
                        {formatDate(goalToDisplay.date)}
                        {paymentAccountName && (
                            <>
                                <span className="mx-1 opacity-50">|</span>
                                <span className="truncate max-w-[100px] text-primary-600 dark:text-primary-400 font-semibold">{paymentAccountName}</span>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Amounts */}
            <div className="mt-auto">
                <div className="flex justify-between items-end mb-2">
                    <div>
                        <span className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase mb-0.5 block">{bucketTypeLabel}</span>
                        <span className="text-2xl font-bold text-light-text dark:text-dark-text tracking-tight">{formatCurrency(goalToDisplay.currentAmount, 'EUR')}</span>
                    </div>
                    <div className="text-right">
                        <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase">Target</span>
                        <span className="block font-medium text-light-text dark:text-dark-text">{formatCurrency(goalToDisplay.amount, 'EUR')}</span>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="relative w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                     <div 
                        className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-out ${progressBarClass}`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                     ></div>
                </div>
                <div className="flex justify-between mt-1.5 text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide">
                    <span>{progress.toFixed(0)}% Complete</span>
                </div>
            </div>
            
            {/* Forecast Date */}
            {goalToDisplay.projection && isActive && !isCompleted && (
                 <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5 flex items-center gap-2 text-xs">
                     <span className="material-symbols-outlined text-sm text-primary-500">timeline</span>
                     <span className="text-light-text-secondary dark:text-dark-text-secondary">Expected:</span>
                     <span className="font-bold text-light-text dark:text-dark-text">{formatDate(goalToDisplay.projection.projectedDate)}</span>
                 </div>
            )}
        </div>

        {/* Bucket Items */}
        {isBucket && subGoals.length > 0 && (
             <div className="bg-gray-50/50 dark:bg-black/20 border-t border-black/5 dark:border-white/5 px-5 py-3 rounded-b-2xl">
                <button 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center justify-between w-full text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider hover:text-primary-500 transition-colors"
                >
                    <span>{subGoals.length} Items</span>
                    <span className={`material-symbols-outlined text-base transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                
                {isExpanded && (
                    <div className="mt-3 space-y-2 animate-fade-in-up">
                         {subGoals.map(sg => {
                             const subProgress = sg.amount > 0 ? (sg.currentAmount / sg.amount) * 100 : 0;
                             const isSubComplete = subProgress >= 100;
                             const sgIsIncome = sg.transactionType === 'income';
                             const sgAccountName = accounts.find(a => a.id === sg.paymentAccountId)?.name;
                             
                             return (
                             <div key={sg.id} className={`flex justify-between items-center text-sm p-2 rounded-lg border shadow-sm group/subgoal ${isSubComplete ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-white dark:bg-white/5 border-black/5 dark:border-white/5'}`}>
                                 <div className="flex flex-col">
                                     <div className="flex items-center gap-2">
                                         <span className="font-medium text-light-text dark:text-dark-text">{sg.name}</span>
                                         {/* Type Badge for Subgoal */}
                                         <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${sgIsIncome ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                            {sgIsIncome ? 'Earn' : 'Save'}
                                         </span>
                                         {isSubComplete && <span className="material-symbols-outlined text-[14px] text-green-600 dark:text-green-400">check_circle</span>}
                                     </div>
                                     <div className="flex items-center gap-1 text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
                                         <span>{formatDate(sg.date)}</span>
                                         {sgAccountName && (
                                            <>
                                                <span className="opacity-50">•</span>
                                                <span className="truncate max-w-[80px] text-primary-600 dark:text-primary-400">{sgAccountName}</span>
                                            </>
                                        )}
                                     </div>
                                 </div>
                                 <div className="flex items-center gap-3">
                                     <span className={`font-mono font-semibold ${isSubComplete ? 'text-green-700 dark:text-green-400' : 'text-light-text dark:text-dark-text'}`}>{formatCurrency(sg.amount, 'EUR')}</span>
                                     <div className="flex opacity-0 group-hover/subgoal:opacity-100 transition-opacity gap-1">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onEdit(sg); }}
                                            className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded text-blue-500"
                                            title="Edit Item"
                                        >
                                            <span className="material-symbols-outlined text-base">edit</span>
                                        </button>
                                         <button 
                                            onClick={(e) => { e.stopPropagation(); onDuplicate(sg); }}
                                            className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded text-teal-500"
                                            title="Duplicate Item"
                                        >
                                            <span className="material-symbols-outlined text-base">content_copy</span>
                                        </button>
                                     </div>
                                 </div>
                             </div>
                         )})}
                    </div>
                )}
             </div>
        )}
    </div>
  );
};

export default FinancialGoalCard;
