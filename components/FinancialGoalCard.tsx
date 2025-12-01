
import React, { useState, useMemo } from 'react';
import { FinancialGoal, Account } from '../types';
import { formatCurrency, getPreferredTimeZone, parseDateAsUTC } from '../utils';
import Card from './Card';

interface FinancialGoalCardProps {
  goal: FinancialGoal;
  subGoals: FinancialGoal[];
  isActive: boolean;
  onToggle: (id: string) => void;
  onEdit: (goal: FinancialGoal) => void;
  onDelete: (id: string) => void;
  onAddSubGoal: (parentId: string) => void;
  accounts: Account[];
}

const FinancialGoalCard: React.FC<FinancialGoalCardProps> = ({ goal, subGoals, isActive, onToggle, onEdit, onDelete, onAddSubGoal, accounts }) => {
  const isBucket = !!goal.isBucket;
  const [isExpanded, setIsExpanded] = useState(true);
  const timeZone = getPreferredTimeZone();

  const totalAmount = isBucket ? subGoals.reduce((sum, sg) => sum + sg.amount, 0) : goal.amount;
  const currentAmount = isBucket ? subGoals.reduce((sum, sg) => sum + sg.currentAmount, 0) : goal.currentAmount;
  
  const bucketProjectedDate = isBucket ? subGoals.reduce((latest, sg) => {
    if (!sg.projection?.projectedDate || sg.projection.projectedDate === 'Beyond forecast') return latest;
    if (!latest || parseDateAsUTC(sg.projection.projectedDate) > parseDateAsUTC(latest)) return sg.projection.projectedDate;
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
    date: subGoals.length > 0 ? subGoals.sort((a,b) => parseDateAsUTC(b.date!).getTime() - parseDateAsUTC(a.date!).getTime())[0].date : undefined,
    projection: {
        projectedDate: bucketProjectedDate!,
        status: bucketStatus!,
    },
  } : goal;

  const progress = goalToDisplay.amount > 0 ? (goalToDisplay.currentAmount / goalToDisplay.amount) * 100 : 0;

  const formatDate = (dateString?: string) => {
    if (!dateString || dateString === 'Beyond forecast') return 'Beyond forecast';
    const date = parseDateAsUTC(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone });
  };
  
  const statusConfig = {
    'on-track': { text: 'On Track', bg: 'bg-emerald-100 dark:bg-emerald-900/30', textCol: 'text-emerald-700 dark:text-emerald-400', icon: 'check_circle' },
    'at-risk': { text: 'At Risk', bg: 'bg-amber-100 dark:bg-amber-900/30', textCol: 'text-amber-700 dark:text-amber-400', icon: 'warning' },
    'off-track': { text: 'Off Track', bg: 'bg-rose-100 dark:bg-rose-900/30', textCol: 'text-rose-700 dark:text-rose-400', icon: 'error' },
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

  return (
    <div className={`relative group bg-white dark:bg-dark-card rounded-2xl p-5 border shadow-sm hover:shadow-md transition-all duration-300 flex flex-col ${isActive ? 'border-primary-500/30 ring-1 ring-primary-500/10' : 'border-black/5 dark:border-white/5'}`}>
      {/* Header Section */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-1">
                <h4 className="font-bold text-lg text-light-text dark:text-dark-text truncate">{goal.name}</h4>
                {statusStyle && isActive && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${statusStyle.bg} ${statusStyle.textCol}`}>
                        <span className="material-symbols-outlined text-[12px]">{statusStyle.icon}</span>
                        {statusStyle.text}
                    </span>
                )}
            </div>
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
                {goalToDisplay.date && !isBucket && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">event</span> {formatDate(goalToDisplay.date)}</span>}
                {paymentAccountName && !isBucket && <span className="flex items-center gap-1 before:content-['•'] before:mx-1"><span className="material-symbols-outlined text-[14px]">credit_card</span> {paymentAccountName}</span>}
            </p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1">
             <button 
                onClick={handleToggle}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${isActive ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                title={isActive ? 'Exclude from forecast' : 'Include in forecast'}
            >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${isActive ? 'translate-x-4.5' : 'translate-x-1'}`} />
            </button>
            
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-2 border-l border-gray-200 dark:border-gray-700 pl-2">
                {isBucket && <button onClick={() => onAddSubGoal(goal.id)} className="p-1.5 rounded-lg text-light-text-secondary hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors" title="Add Item"><span className="material-symbols-outlined text-lg">add</span></button>}
                <button onClick={() => onEdit(goal)} className="p-1.5 rounded-lg text-light-text-secondary hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"><span className="material-symbols-outlined text-lg">edit</span></button>
                <button onClick={() => onDelete(goal.id)} className="p-1.5 rounded-lg text-light-text-secondary hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><span className="material-symbols-outlined text-lg">delete</span></button>
            </div>
        </div>
      </div>

      {/* Progress Section */}
      <div className="mb-6">
        <div className="flex justify-between items-end mb-2">
            <div>
                 <span className="text-2xl font-bold text-light-text dark:text-dark-text tracking-tight">{formatCurrency(goalToDisplay.currentAmount, 'EUR')}</span>
                 <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary ml-1">saved</span>
            </div>
            <div className="text-right">
                <span className="text-sm font-semibold text-light-text dark:text-dark-text">{progress.toFixed(0)}%</span>
                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary block">of {formatCurrency(goalToDisplay.amount, 'EUR')}</span>
            </div>
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-primary-500 to-purple-500"
            style={{ width: `${Math.min(progress, 100)}%` }}
          ></div>
        </div>
      </div>
      
      {/* Forecast Info Box */}
      {goalToDisplay.projection && isActive && (
         <div className="mt-auto bg-gray-50 dark:bg-white/5 rounded-xl p-3 border border-black/5 dark:border-white/5 flex justify-between items-center text-sm">
             <span className="text-light-text-secondary dark:text-dark-text-secondary font-medium">Estimated Completion</span>
             <span className="font-bold text-light-text dark:text-dark-text">{formatDate(goalToDisplay.projection.projectedDate)}</span>
         </div>
      )}

      {/* Bucket Items Accordion */}
      {isBucket && subGoals.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button 
                onClick={() => setIsExpanded(!isExpanded)} 
                className="w-full flex justify-between items-center text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider hover:text-primary-500 transition-colors"
            >
                <span>Bucket Items ({subGoals.length})</span>
                <span className={`material-symbols-outlined text-base transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
            </button>
            
            {isExpanded && (
                <ul className="mt-3 space-y-2">
                    {subGoals.map(sg => {
                        const subGoalPaymentAccountName = accounts.find(a => a.id === sg.paymentAccountId)?.name;
                        return (
                        <li key={sg.id} className="group/item flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-sm">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-light-text dark:text-dark-text truncate">{sg.name}</span>
                                    {sg.projection?.status && (
                                        <div className={`w-1.5 h-1.5 rounded-full ${sg.projection.status === 'on-track' ? 'bg-green-500' : sg.projection.status === 'at-risk' ? 'bg-amber-500' : 'bg-red-500'}`} title={sg.projection.status.replace('-', ' ')}></div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                    <span>{formatDate(sg.date)}</span>
                                    {subGoalPaymentAccountName && <span className="truncate max-w-[100px]">• {subGoalPaymentAccountName}</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="font-semibold text-light-text dark:text-dark-text">{formatCurrency(sg.amount, 'EUR')}</span>
                                <div className="opacity-0 group-hover/item:opacity-100 flex items-center gap-1 transition-opacity">
                                    <button onClick={(e) => { e.stopPropagation(); onEdit(sg); }} className="text-gray-400 hover:text-blue-500 transition-colors"><span className="material-symbols-outlined text-base">edit</span></button>
                                    <button onClick={(e) => { e.stopPropagation(); onDelete(sg.id); }} className="text-gray-400 hover:text-red-500 transition-colors"><span className="material-symbols-outlined text-base">delete</span></button>
                                </div>
                            </div>
                        </li>
                    )})}
                </ul>
            )}
          </div>
      )}
    </div>
  );
};

export default FinancialGoalCard;
