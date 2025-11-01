import React from 'react';
import { FinancialGoal } from '../types';
import { formatCurrency } from '../utils';
import Card from './Card';

interface FinancialGoalCardProps {
  goal: FinancialGoal;
  isActive: boolean;
  onToggle: (id: string) => void;
  onEdit: (goal: FinancialGoal) => void;
  onDelete: (id: string) => void;
}

const FinancialGoalCard: React.FC<FinancialGoalCardProps> = ({ goal, isActive, onToggle, onEdit, onDelete }) => {
  const progress = goal.amount > 0 ? (goal.currentAmount / goal.amount) * 100 : 0;
  
  const formatDate = (dateString?: string) => {
    if (!dateString || dateString === 'Beyond forecast') return 'Beyond forecast';
    const date = new Date(dateString);
    date.setDate(date.getDate() + 1); // Adjust for timezone issues in display
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  };
  
  const statusConfig = {
    'on-track': { text: 'On Track', color: 'text-green-500', icon: 'check_circle' },
    'at-risk': { text: 'At Risk', color: 'text-yellow-500', icon: 'warning' },
    'off-track': { text: 'Off Track', color: 'text-red-500', icon: 'error' },
  };

  return (
    <Card className="flex flex-col justify-between group transition-transform duration-200 hover:-translate-y-1">
      <div>
        <div className="flex justify-between items-start">
          <h4 className="font-semibold text-lg text-light-text dark:text-dark-text pr-2">{goal.name}</h4>
          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <button onClick={() => onEdit(goal)} className="p-1 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5"><span className="material-symbols-outlined text-base">edit</span></button>
            <button onClick={() => onDelete(goal.id)} className="p-1 rounded-full text-red-500/80 hover:bg-red-500/10"><span className="material-symbols-outlined text-base">delete</span></button>
          </div>
        </div>
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Target: {formatCurrency(goal.amount, 'EUR')} {goal.date ? `by ${formatDate(goal.date)}` : ''}</p>
      </div>

      <div className="my-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium text-light-text dark:text-dark-text">{formatCurrency(goal.currentAmount, 'EUR')}</span>
          <span className="text-light-text-secondary dark:text-dark-text-secondary">{progress.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-light-bg dark:bg-dark-bg rounded-full h-2.5 shadow-neu-inset-light dark:shadow-neu-inset-dark">
          <div
            className="bg-primary-500 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(progress, 100)}%` }}
          ></div>
        </div>
      </div>
      
      {goal.projection && isActive && (
        <div className="p-3 rounded-lg bg-light-bg dark:bg-dark-bg mb-4">
            <div className="flex justify-between items-center text-sm">
                <span className="font-semibold text-light-text-secondary dark:text-dark-text-secondary">PROJECTED DATE</span>
                <div className="flex items-center gap-2">
                    <span className="font-semibold">{formatDate(goal.projection.projectedDate)}</span>
                    <span className={`flex items-center gap-1 font-semibold ${statusConfig[goal.projection.status].color}`} title={statusConfig[goal.projection.status].text}>
                        <span className="material-symbols-outlined text-base">{statusConfig[goal.projection.status].icon}</span>
                    </span>
                </div>
            </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">Include in Forecast</span>
        <div 
          onClick={() => onToggle(goal.id)}
          className={`w-12 h-6 rounded-full p-1 flex items-center cursor-pointer transition-colors ${isActive ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'}`}
        >
          <div className={`w-4 h-4 rounded-full bg-white dark:bg-dark-card shadow-md transform transition-transform ${isActive ? 'translate-x-6' : 'translate-x-0'}`}></div>
        </div>
      </div>
    </Card>
  );
};

export default FinancialGoalCard;