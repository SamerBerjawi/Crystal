import React, { useState, useMemo } from 'react';
import { FinancialGoal, Account } from '../types';
import { formatCurrency } from '../utils';
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

  const totalAmount = isBucket ? subGoals.reduce((sum, sg) => sum + sg.amount, 0) : goal.amount;
  const currentAmount = isBucket ? subGoals.reduce((sum, sg) => sum + sg.currentAmount, 0) : goal.currentAmount;
  
  const bucketProjectedDate = isBucket ? subGoals.reduce((latest, sg) => {
    if (!sg.projection?.projectedDate || sg.projection.projectedDate === 'Beyond forecast') return latest;
    if (!latest || new Date(sg.projection.projectedDate) > new Date(latest)) return sg.projection.projectedDate;
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
    date: subGoals.length > 0 ? subGoals.sort((a,b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())[0].date : undefined,
    projection: {
        projectedDate: bucketProjectedDate!,
        status: bucketStatus!,
    },
  } : goal;

  const progress = goalToDisplay.amount > 0 ? (goalToDisplay.currentAmount / goalToDisplay.amount) * 100 : 0;
  
  const formatDate = (dateString?: string) => {
    if (!dateString || dateString === 'Beyond forecast') return 'Beyond forecast';
    const date = new Date(dateString.replace(/-/g, '/'));
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
  };
  
  const statusConfig = {
    'on-track': { text: 'On Track', color: 'text-green-500', icon: 'check_circle' },
    'at-risk': { text: 'At Risk', color: 'text-yellow-500', icon: 'warning' },
    'off-track': { text: 'Off Track', color: 'text-red-500', icon: 'error' },
  };

  const paymentAccountName = useMemo(() => {
    if (!goalToDisplay.paymentAccountId) return null;
    return accounts.find(a => a.id === goalToDisplay.paymentAccountId)?.name;
  }, [goalToDisplay.paymentAccountId, accounts]);

  const handleToggle = () => {
    onToggle(goal.id);
  };
  
  return (
    <Card className="flex flex-col justify-between group transition-transform duration-200 hover:-translate-y-1">
      <div>
        <div className="flex justify-between items-start">
          <h4 className="font-semibold text-lg text-light-text dark:text-dark-text pr-2">{goal.name}</h4>
          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            {isBucket && <button onClick={() => onAddSubGoal(goal.id)} className="p-1 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5" title="Add Item"><span className="material-symbols-outlined text-base">add</span></button>}
            <button onClick={() => onEdit(goal)} className="p-1 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5"><span className="material-symbols-outlined text-base">edit</span></button>
            <button onClick={() => onDelete(goal.id)} className="p-1 rounded-full text-red-500/80 hover:bg-red-500/10"><span className="material-symbols-outlined text-base">delete</span></button>
          </div>
        </div>
        <p className="text-light-text-secondary dark:text-dark-text-secondary">Target: {formatCurrency(goalToDisplay.amount, 'EUR')} {goalToDisplay.date && !isBucket ? `by ${formatDate(goalToDisplay.date)}` : ''}</p>
        {paymentAccountName && !isBucket && (
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">credit_card</span>
            <span>From: {paymentAccountName}</span>
          </p>
        )}
      </div>

      <div className="my-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium text-light-text dark:text-dark-text">{formatCurrency(goalToDisplay.currentAmount, 'EUR')}</span>
          <span className="text-light-text-secondary dark:text-dark-text-secondary">{progress.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-light-bg dark:bg-dark-bg rounded-full h-2.5 shadow-neu-inset-light dark:shadow-neu-inset-dark">
          <div
            className="bg-primary-500 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(progress, 100)}%` }}
          ></div>
        </div>
      </div>
      
      {isBucket && subGoals.length > 0 && (
          <div className="mb-4 text-sm">
            <button onClick={() => setIsExpanded(!isExpanded)} className="w-full flex justify-between items-center font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                <span>Items ({subGoals.length})</span>
                <span className={`material-symbols-outlined transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
            </button>
            {isExpanded && (
                <ul className="mt-2 space-y-3">
                    {subGoals.map(sg => {
                        const subGoalPaymentAccountName = accounts.find(a => a.id === sg.paymentAccountId)?.name;
                        return (
                        <li key={sg.id} className="text-sm">
                            <div className="flex justify-between items-center group/item">
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-light-text dark:text-dark-text truncate">{sg.name}</p>
                                    <p className="text-light-text-secondary dark:text-dark-text-secondary">{formatDate(sg.date)}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                    <span className="font-semibold">{formatCurrency(sg.amount, 'EUR')}</span>
                                    <div className="opacity-0 group-hover/item:opacity-100 flex items-center">
                                        <button onClick={() => onEdit(sg)} className="p-1 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5"><span className="material-symbols-outlined text-sm">edit</span></button>
                                        <button onClick={() => onDelete(sg.id)} className="p-1 rounded-full text-red-500/80 hover:bg-red-500/10"><span className="material-symbols-outlined text-sm">delete</span></button>
                                    </div>
                                </div>
                            </div>
                            {subGoalPaymentAccountName && (
                                <p className="text-light-text-secondary dark:text-dark-text-secondary truncate pl-1 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-xs">subdirectory_arrow_right</span>
                                    <span>from {subGoalPaymentAccountName}</span>
                                </p>
                            )}
                        </li>
                    )})}
                </ul>
            )}
          </div>
      )}

      {goalToDisplay.projection && isActive && (
        <div className="p-3 rounded-lg bg-light-bg dark:bg-dark-bg mb-4">
            <div className="flex justify-between items-center text-sm">
                <span className="font-semibold text-light-text-secondary dark:text-dark-text-secondary">PROJECTED DATE</span>
                <div className="flex items-center gap-2">
                    <span className="font-semibold">{formatDate(goalToDisplay.projection.projectedDate)}</span>
                    <span className={`flex items-center gap-1 font-semibold ${statusConfig[goalToDisplay.projection.status].color}`} title={statusConfig[goalToDisplay.projection.status].text}>
                        <span className="material-symbols-outlined text-base">{statusConfig[goalToDisplay.projection.status].icon}</span>
                    </span>
                </div>
            </div>
        </div>
      )}

      <div className="flex justify-between items-center mt-auto">
        <span className="text-sm font-medium">Include in Forecast</span>
        <div 
          onClick={handleToggle}
          className={`w-12 h-6 rounded-full p-1 flex items-center cursor-pointer transition-colors ${isActive ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'}`}
        >
          <div className={`w-4 h-4 rounded-full bg-white dark:bg-dark-card shadow-md transform transition-transform ${isActive ? 'translate-x-6' : 'translate-x-0'}`}></div>
        </div>
      </div>
    </Card>
  );
};

export default FinancialGoalCard;
