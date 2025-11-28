
import React, { useState, useMemo } from 'react';
import { Challenge, Transaction, Category } from '../types';
import { PREDEFINED_CHALLENGES, BTN_PRIMARY_STYLE } from '../constants';
import ChallengeCard from '../components/ChallengeCard';
import AddChallengeModal from '../components/AddChallengeModal';
import { convertToEur, parseDateAsUTC, formatCurrency } from '../utils';
import Card from '../components/Card';

interface SavingsChallengesProps {
  challenges: Challenge[];
  transactions: Transaction[];
  incomeCategories: Category[];
  expenseCategories: Category[];
  saveChallenge: (challenge: Omit<Challenge, 'id'> & { id?: string }) => void;
  deleteChallenge: (id: string) => void;
}

const SavingsChallenges: React.FC<SavingsChallengesProps> = ({ challenges, transactions, incomeCategories, expenseCategories, saveChallenge, deleteChallenge }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const allCategories = useMemo(() => [...incomeCategories, ...expenseCategories], [incomeCategories, expenseCategories]);

  const calculateChallengeProgress = (challenge: Challenge) => {
      const start = parseDateAsUTC(challenge.startDate);
      const end = parseDateAsUTC(challenge.endDate);
      const today = new Date();
      
      const relevantTransactions = transactions.filter(tx => {
          const txDate = parseDateAsUTC(tx.date);
          return txDate >= start && txDate <= end && tx.type === 'expense' && !tx.transferId && challenge.categoryNames.includes(tx.category);
      });
      
      const spent = relevantTransactions.reduce((sum, tx) => sum + Math.abs(convertToEur(tx.amount, tx.currency)), 0);
      
      // Calculate Streak (Days since start with 0 spend in categories)
      // This is a simplified calculation: Check if ANY transaction exists today, yesterday, etc.
      let currentStreak = 0;
      if (challenge.type === 'streak') {
           const oneDay = 24 * 60 * 60 * 1000;
           let checkDate = new Date();
           // Reset to midnight
           checkDate.setHours(0,0,0,0);
           
           // Look back day by day from today until start date
           while (checkDate >= start) {
               const dateStr = checkDate.toISOString().split('T')[0];
               const hasSpend = relevantTransactions.some(tx => tx.date === dateStr);
               if (!hasSpend) {
                   currentStreak++;
               } else {
                   // Streak broken
                   break; 
               }
               checkDate = new Date(checkDate.getTime() - oneDay);
           }
      }
      
      const daysRemaining = Math.ceil(Math.max(0, end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      return { spent, currentStreak, daysRemaining };
  };

  const activeChallenges = useMemo(() => {
      return challenges.map(c => {
          const stats = calculateChallengeProgress(c);
          return { ...c, ...stats };
      });
  }, [challenges, transactions]);

  const handleJoinPredefined = (predefined: Omit<Challenge, 'id'>) => {
      saveChallenge(predefined);
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
        {isModalOpen && (
            <AddChallengeModal 
                onClose={() => setIsModalOpen(false)} 
                onSave={saveChallenge} 
                categories={allCategories} 
            />
        )}

        <header className="flex justify-between items-center">
            <div>
                {/* <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">Savings Challenges</h1> */}
                <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Gamify your savings and build better habits.</p>
            </div>
            <button onClick={() => setIsModalOpen(true)} className={BTN_PRIMARY_STYLE}>Create Custom Challenge</button>
        </header>

        {/* Active Challenges Grid */}
        <div className="space-y-4">
            <h2 className="text-xl font-semibold text-light-text dark:text-dark-text">Active Challenges</h2>
            {activeChallenges.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeChallenges.map(c => (
                        <ChallengeCard 
                            key={c.id} 
                            challenge={c} 
                            progress={0} // Calculated inside component logic for visual
                            spent={c.spent}
                            daysRemaining={c.daysRemaining}
                            streak={c.currentStreak}
                            onDelete={() => deleteChallenge(c.id)}
                        />
                    ))}
                </div>
            ) : (
                <Card>
                    <div className="text-center py-8 text-light-text-secondary dark:text-dark-text-secondary">
                        <span className="material-symbols-outlined text-5xl mb-2">emoji_events</span>
                        <p>You haven't joined any challenges yet.</p>
                    </div>
                </Card>
            )}
        </div>

        {/* Available Challenges Section */}
        <div className="space-y-4 pt-8 border-t border-black/10 dark:border-white/10">
            <h2 className="text-xl font-semibold text-light-text dark:text-dark-text">Available Challenges</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {PREDEFINED_CHALLENGES.map((c, idx) => (
                    <div key={idx} className="bg-white dark:bg-dark-card rounded-2xl p-6 border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-full group">
                        <div>
                             <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-opacity-20 mb-4`} style={{ backgroundColor: `${c.color}20`, color: c.color }}>
                                <span className="material-symbols-outlined text-2xl">{c.icon}</span>
                            </div>
                            <h3 className="font-bold text-lg mb-1">{c.name}</h3>
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">{c.description}</p>
                            {c.type === 'spend-limit' && <p className="text-xs font-medium bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded inline-block">Limit: {formatCurrency(c.targetAmount, 'EUR')}</p>}
                        </div>
                        <button 
                            onClick={() => handleJoinPredefined(c)} 
                            className="mt-6 w-full py-2 rounded-lg border border-primary-500 text-primary-500 font-semibold hover:bg-primary-500 hover:text-white transition-colors"
                        >
                            Join Challenge
                        </button>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};

export default SavingsChallenges;
