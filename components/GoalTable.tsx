
import React, { useMemo, useState } from 'react';
import { FinancialGoal, Account } from '../types';
import { formatCurrency, parseLocalDate } from '../utils';

interface GoalTableProps {
  goals: FinancialGoal[];
  accounts: Account[];
  onGoalClick: (goal: FinancialGoal) => void;
  onEdit: (goal: FinancialGoal) => void;
  onDelete: (id: string) => void;
}

type SortField = 'name' | 'amount' | 'currentAmount' | 'date' | 'progress' | 'status';
type SortOrder = 'asc' | 'desc';

const GoalTable: React.FC<GoalTableProps> = ({ goals, accounts, onGoalClick, onEdit, onDelete }) => {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [groupByBucket, setGroupByBucket] = useState(false);

  const getAccountName = (id?: string) => {
    if (!id) return '-';
    return accounts.find(a => a.id === id)?.name || 'Unknown';
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'on-track': return { text: 'On Track', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' };
      case 'at-risk': return { text: 'At Risk', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' };
      case 'off-track': return { text: 'Off Track', color: 'text-rose-600 bg-rose-50 dark:bg-rose-900/20' };
      default: return { text: 'Unknown', color: 'text-gray-600 bg-gray-50' };
    }
  };

  const sortedGoals = useMemo(() => {
    const list = [...goals].filter(g => !g.isBucket);
    
    list.sort((a, b) => {
      let valA: any = a[sortField as keyof FinancialGoal] || 0;
      let valB: any = b[sortField as keyof FinancialGoal] || 0;

      if (sortField === 'progress') {
        valA = a.amount > 0 ? a.currentAmount / a.amount : 0;
        valB = b.amount > 0 ? b.currentAmount / b.amount : 0;
      } else if (sortField === 'status') {
        valA = a.projection?.status || '';
        valB = b.projection?.status || '';
      } else if (sortField === 'date') {
        valA = a.date ? parseLocalDate(a.date).getTime() : Infinity;
        valB = b.date ? parseLocalDate(b.date).getTime() : Infinity;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [goals, sortField, sortOrder]);

  const buckets = useMemo(() => {
    return goals.filter(g => g.isBucket);
  }, [goals]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <span className="material-symbols-outlined text-xs opacity-50">swap_vert</span>;
    return <span className="material-symbols-outlined text-xs">{sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>;
  };

  const renderGoalRow = (goal: FinancialGoal) => {
    const progress = goal.amount > 0 ? (goal.currentAmount / goal.amount) * 100 : 0;
    const status = getStatusLabel(goal.projection?.status || '');
    const isCompleted = progress >= 100;
    const category = goal.goalCategory || (goal.transactionType === 'income' ? 'income' : 'savings');

    const getGoalIcon = () => {
      switch (category) {
        case 'expense': return 'shopping_cart';
        case 'income': return 'monetization_on';
        default: return 'savings';
      }
    };

    const getGoalColor = () => {
      switch (category) {
        case 'expense': return 'bg-rose-500/10 text-rose-500';
        case 'income': return 'bg-emerald-500/10 text-emerald-500';
        default: return 'bg-primary-500/10 text-primary-500';
      }
    };

    return (
      <tr key={goal.id} className="border-b border-black/5 dark:border-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors group">
        <td className="py-4 px-4">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getGoalColor()}`}>
              <span className="material-symbols-outlined text-base">{getGoalIcon()}</span>
            </div>
            <div>
              <p className="font-bold text-sm text-light-text dark:text-dark-text group-hover:text-primary-500 transition-colors cursor-pointer" onClick={() => onGoalClick(goal)}>{goal.name}</p>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-light-text-secondary/60 dark:text-dark-text-secondary/80 font-bold tracking-wider">{getAccountName(goal.paymentAccountId)}</p>
                <span className="w-1 h-1 rounded-full bg-black/10 dark:bg-white/10" />
                <p className="text-[10px] text-light-text-secondary/60 dark:text-dark-text-secondary/80 font-bold tracking-wider">{category === 'savings' ? 'Saving' : category === 'expense' ? 'Expense' : 'Income'}</p>
              </div>
            </div>
          </div>
        </td>
        <td className="py-4 px-4 text-right font-mono text-xs font-bold text-light-text dark:text-dark-text">
          {formatCurrency(goal.amount, goal.currency)}
        </td>
        <td className="py-4 px-4 text-right font-mono text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary">
          {formatCurrency(goal.currentAmount, goal.currency)}
        </td>
        <td className="py-4 px-4">
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[9px] font-bold text-light-text-secondary/60 dark:text-dark-text-secondary/80 tracking-wider">
              <span>{progress.toFixed(0)}%</span>
            </div>
            <div className="w-full h-1.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-primary-500'}`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>
        </td>
        <td className="py-4 px-4">
          <p className="text-sm text-light-text dark:text-dark-text font-medium text-center">
            {goal.date ? parseLocalDate(goal.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
          </p>
        </td>
        <td className="py-4 px-4">
          <p className="text-sm text-center font-bold text-primary-500">
            {goal.projection?.projectedDate && goal.projection.projectedDate !== 'Beyond forecast' && goal.projection.projectedDate !== 'Goal reached'
              ? parseLocalDate(goal.projection.projectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : goal.projection?.projectedDate || '-'}
          </p>
        </td>
        <td className="py-4 px-4">
           {!isCompleted ? (
              <div className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wider text-center ${status.color}`}>
                {status.text}
              </div>
           ) : (
             <div className="px-2 py-1 rounded-md text-[10px] font-bold tracking-wider text-center bg-emerald-500 text-white shadow-sm">
                Completed
             </div>
           )}
        </td>
        <td className="py-4 px-4">
          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onEdit(goal)} className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-500 rounded-lg">
              <span className="material-symbols-outlined text-base">edit</span>
            </button>
            <button onClick={() => onDelete(goal.id)} className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-rose-500 rounded-lg">
              <span className="material-symbols-outlined text-base">delete</span>
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 bg-light-fill dark:bg-dark-fill p-2 rounded-xl border border-black/5 dark:border-white/5 self-start inline-flex">
          <button 
            onClick={() => setGroupByBucket(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${!groupByBucket ? 'bg-white dark:bg-white/10 shadow-sm text-primary-500' : 'text-light-text-secondary dark:text-neutral-300'}`}
          >
            List All
          </button>
          <button 
            onClick={() => setGroupByBucket(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${groupByBucket ? 'bg-white dark:bg-white/10 shadow-sm text-primary-500' : 'text-light-text-secondary dark:text-neutral-300'}`}
          >
            Group by Bucket
          </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-dark-card shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5">
              <th className="py-4 px-4 text-[10px] font-bold tracking-wider text-light-text-secondary dark:text-neutral-400 cursor-pointer hover:text-primary-500" onClick={() => handleSort('name')}>
                 <div className="flex items-center gap-1">Goal {renderSortIcon('name')}</div>
              </th>
              <th className="py-4 px-4 text-right text-[10px] font-bold tracking-wider text-light-text-secondary dark:text-neutral-400 cursor-pointer hover:text-primary-500" onClick={() => handleSort('amount')}>
                 <div className="flex items-center justify-end gap-1">Target {renderSortIcon('amount')}</div>
              </th>
              <th className="py-4 px-4 text-right text-[10px] font-bold tracking-wider text-light-text-secondary dark:text-neutral-400 cursor-pointer hover:text-primary-500" onClick={() => handleSort('currentAmount')}>
                 <div className="flex items-center justify-end gap-1">Saved {renderSortIcon('currentAmount')}</div>
              </th>
              <th className="py-4 px-4 text-[10px] font-bold tracking-wider text-light-text-secondary dark:text-neutral-400 cursor-pointer hover:text-primary-500" onClick={() => handleSort('progress')}>
                 <div className="flex items-center gap-1">Progress {renderSortIcon('progress')}</div>
              </th>
              <th className="py-4 px-4 text-[10px] font-bold tracking-wider text-light-text-secondary text-center dark:text-neutral-400 cursor-pointer hover:text-primary-500" onClick={() => handleSort('date')}>
                 <div className="flex items-center justify-center gap-1">Due Date {renderSortIcon('date')}</div>
              </th>
              <th className="py-4 px-4 text-[10px] font-bold tracking-wider text-light-text-secondary text-center dark:text-neutral-400 cursor-pointer hover:text-primary-500">
                 <div className="flex items-center justify-center gap-1">Projected</div>
              </th>
              <th className="py-4 px-4 text-[10px] font-bold tracking-wider text-light-text-secondary text-center dark:text-neutral-400 cursor-pointer hover:text-primary-500" onClick={() => handleSort('status')}>
                 <div className="flex items-center justify-center gap-1">Status {renderSortIcon('status')}</div>
              </th>
              <th className="py-4 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {groupByBucket ? (
              buckets.map(bucket => {
                const subGoals = sortedGoals.filter(g => g.parentId === bucket.id);
                if (subGoals.length === 0) return null;
                return (
                  <React.Fragment key={bucket.id}>
                    <tr className="bg-black/[0.01] dark:bg-white/[0.01]">
                      <td colSpan={8} className="py-2 px-4 border-b border-black/5 dark:border-white/5">
                        <div className="flex items-center gap-2">
                           <span className="material-symbols-outlined text-sm text-indigo-500">folder</span>
                           <span className="text-[10px] font-bold tracking-wider text-indigo-500">{bucket.name}</span>
                        </div>
                      </td>
                    </tr>
                    {subGoals.map(renderGoalRow)}
                  </React.Fragment>
                );
              }).concat(
                <React.Fragment key="unassigned">
                  <tr className="bg-black/[0.01] dark:bg-white/[0.01]">
                    <td colSpan={8} className="py-2 px-4 border-b border-black/5 dark:border-white/5">
                      <div className="flex items-center gap-2">
                         <span className="material-symbols-outlined text-sm text-gray-400">label_off</span>
                         <span className="text-[10px] font-bold tracking-wider text-gray-400">Unassigned</span>
                      </div>
                    </td>
                  </tr>
                  {sortedGoals.filter(g => !g.parentId).map(renderGoalRow)}
                </React.Fragment>
              )
            ) : (
              sortedGoals.map(renderGoalRow)
            )}
          </tbody>
        </table>
        {sortedGoals.length === 0 && (
          <div className="py-20 text-center">
            <span className="material-symbols-outlined text-4xl text-light-text-secondary opacity-20">flag</span>
            <p className="mt-2 text-sm font-medium text-light-text-secondary">No goals found for this view.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoalTable;
