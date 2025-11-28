
import React from 'react';
import { Challenge } from '../types';
import Card from './Card';
import { formatCurrency } from '../utils';

interface ChallengeCardProps {
  challenge: Challenge;
  progress: number;
  spent: number;
  daysRemaining: number;
  streak: number;
  onDelete: () => void;
}

const ChallengeCard: React.FC<ChallengeCardProps> = ({ challenge, progress, spent, daysRemaining, streak, onDelete }) => {
  const isSuccess = challenge.type === 'spend-limit' ? spent <= challenge.targetAmount : streak > 0;
  const statusColor = isSuccess ? 'text-green-500' : 'text-red-500';
  const progressBarColor = isSuccess ? 'bg-green-500' : 'bg-red-500';
  
  // Calculate percentage for visual bar. For spend limit: spent / target. For streak: days passed / total days? 
  // Let's stick to spend limit visualization mainly.
  
  let percentage = 0;
  if (challenge.type === 'spend-limit' && challenge.targetAmount > 0) {
      percentage = Math.min((spent / challenge.targetAmount) * 100, 100);
  } else {
      // For streak/no-spend (target 0), any spend is 100% bad, 0 spend is 0% used.
      percentage = spent > 0 ? 100 : 0;
  }

  return (
    <Card className="relative overflow-hidden group">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-opacity-20`} style={{ backgroundColor: `${challenge.color}20`, color: challenge.color }}>
            <span className="material-symbols-outlined text-2xl">{challenge.icon}</span>
          </div>
          <div>
            <h3 className="font-bold text-lg text-light-text dark:text-dark-text">{challenge.name}</h3>
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{challenge.type === 'streak' ? 'Streak Challenge' : 'Spending Limit'}</p>
          </div>
        </div>
        <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-red-100 text-red-500 transition-all">
             <span className="material-symbols-outlined text-sm">delete</span>
        </button>
      </div>
      
      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4 min-h-[2.5em]">
        {challenge.description}
      </p>

      {challenge.type === 'spend-limit' ? (
          <div className="space-y-2">
              <div className="flex justify-between text-sm font-medium">
                  <span className={statusColor}>{formatCurrency(spent, 'EUR')} spent</span>
                  <span className="text-light-text-secondary dark:text-dark-text-secondary">Limit: {formatCurrency(challenge.targetAmount, 'EUR')}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div className={`h-2.5 rounded-full transition-all duration-500 ${spent > challenge.targetAmount ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${percentage}%` }}></div>
              </div>
          </div>
      ) : (
          <div className="flex items-center gap-2 mb-2">
               <span className="text-2xl">🔥</span>
               <div>
                   <p className="text-xl font-bold text-light-text dark:text-dark-text">{streak} Days</p>
                   <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Current Streak</p>
               </div>
               {spent > 0 && (
                   <div className="ml-auto text-right">
                       <p className="text-red-500 font-bold text-sm">Streak Broken</p>
                       <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Spent {formatCurrency(spent, 'EUR')}</p>
                   </div>
               )}
          </div>
      )}
      
      <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5 flex justify-between items-center text-xs text-light-text-secondary dark:text-dark-text-secondary">
          <span>Ends: {new Date(challenge.endDate).toLocaleDateString()}</span>
          <span>{daysRemaining} days left</span>
      </div>
    </Card>
  );
};

export default ChallengeCard;
