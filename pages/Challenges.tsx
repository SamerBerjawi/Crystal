
import React, { useMemo, useState } from 'react';
import Card from '../components/Card';
import { UserStats, Account, Transaction } from '../types';
import { calculateAccountTotals, convertToEur, parseDateAsUTC, formatCurrency, getDateRange } from '../utils';
import { LIQUID_ACCOUNT_TYPES, ASSET_TYPES, DEBT_TYPES, ALL_ACCOUNT_TYPES } from '../constants';
import { useBudgetsContext, useGoalsContext, useScheduleContext } from '../contexts/FinancialDataContext';

interface ChallengesProps {
    userStats: UserStats;
    accounts: Account[];
    transactions: Transaction[];
}

interface ProgressBarProps {
  label: string;
  value: number;
  colorClass?: string;
  helper?: string;
  showPercent?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ label, value, colorClass = 'bg-primary-500', helper, showPercent = true }) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center text-sm font-semibold text-light-text dark:text-dark-text">
      <span>{label}</span>
      {showPercent && <span className="text-light-text-secondary dark:text-dark-text-secondary">{value.toFixed(0)}%</span>}
    </div>
    <div className="h-2 rounded-full bg-light-fill dark:bg-dark-fill overflow-hidden">
      <div
        className={`h-full ${colorClass}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      />
    </div>
    {helper && <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{helper}</p>}
  </div>
);

const CircularGauge: React.FC<{ value: number; label: string; helper?: string; details?: { label: string, score: number, max: number, status: string }[] }> = ({ value, label, helper, details }) => {
  const [showDetails, setShowDetails] = useState(false);
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  const angle = (clamped / 100) * 360;
  
  let colorStart = '#ef4444'; // Red
  let colorEnd = '#f87171';
  let tone = 'text-red-500';
  
  if (clamped >= 75) {
      colorStart = '#10b981'; // Emerald
      colorEnd = '#34d399';
      tone = 'text-emerald-500';
  } else if (clamped >= 50) {
      colorStart = '#f59e0b'; // Amber
      colorEnd = '#fbbf24';
      tone = 'text-amber-500';
  }

  const gaugeGradient = `conic-gradient(${colorStart} ${angle}deg, rgba(148,163,184,0.15) 0deg)`;

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div
        className="relative w-40 h-40 rounded-full flex items-center justify-center shadow-inner cursor-pointer transition-transform hover:scale-105"
        style={{ background: gaugeGradient }}
        role="img"
        aria-label={`${label} is ${clamped}`}
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className="w-32 h-32 rounded-full bg-white dark:bg-dark-card flex flex-col items-center justify-center shadow-sm">
          <p className={`text-4xl font-black ${tone}`}>{clamped}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary opacity-60">Score</p>
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-bold uppercase tracking-wider text-light-text dark:text-dark-text">{label}</p>
        {helper && (
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-snug max-w-xs mx-auto">{helper}</p>
        )}
        <button 
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs font-semibold text-primary-500 hover:underline mt-2"
        >
            {showDetails ? 'Hide Breakdown' : 'See Breakdown'}
        </button>
      </div>
      
      {showDetails && details && (
          <div className="w-full mt-4 bg-gray-50 dark:bg-white/5 rounded-xl p-4 text-xs animate-fade-in-up border border-black/5 dark:border-white/5">
              <div className="space-y-3">
                  {details.map((d, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                          <span className="font-medium text-light-text dark:text-dark-text">{d.label}</span>
                          <div className="text-right">
                              <span className={`font-bold ${d.status === 'Good' ? 'text-green-600 dark:text-green-400' : d.status === 'Fair' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {d.score.toFixed(0)}/{d.max}
                              </span>
                          </div>
                      </div>
                  ))}
                  <div className="pt-2 mt-2 border-t border-black/10 dark:border-white/10 text-center opacity-60">
                      Improve metrics to boost your score.
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

// --- Badge Component ---
const BadgeItem: React.FC<{ badge: any }> = ({ badge }) => {
    return (
        <div className={`
            relative p-4 rounded-xl border flex flex-col items-center text-center transition-all duration-300 h-full
            ${badge.unlocked 
                ? 'bg-gradient-to-br from-white to-gray-50 dark:from-dark-card dark:to-white/5 border-primary-500/30 shadow-md transform hover:-translate-y-1' 
                : 'bg-gray-100 dark:bg-white/5 border-transparent opacity-60 grayscale'
            }
        `}>
            <div className={`
                w-12 h-12 rounded-full flex items-center justify-center mb-3 text-2xl relative shadow-sm
                ${badge.unlocked ? `bg-${badge.color}-100 dark:bg-${badge.color}-900/30 text-${badge.color}-600 dark:text-${badge.color}-400` : 'bg-gray-200 dark:bg-white/10 text-gray-400'}
            `}>
                <span className="material-symbols-outlined">{badge.icon}</span>
                {!badge.unlocked && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-gray-500 rounded-full flex items-center justify-center text-white border-2 border-white dark:border-dark-card">
                        <span className="material-symbols-outlined text-[10px]">lock</span>
                    </div>
                )}
            </div>
            
            <h4 className="font-bold text-sm text-light-text dark:text-dark-text mb-1">{badge.title}</h4>
            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary leading-tight mb-2 min-h-[2.5em] flex items-center justify-center">
                {badge.description}
            </p>
            
            {!badge.unlocked && badge.progress !== undefined && (
                 <div className="w-full mt-auto">
                     <div className="flex justify-between text-[9px] font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">
                         <span>Progress</span>
                         <span>{Math.min(100, badge.progress).toFixed(0)}%</span>
                     </div>
                     <div className="w-full h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden">
                         <div className="h-full bg-gray-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, badge.progress)}%` }}></div>
                     </div>
                 </div>
            )}

            {badge.unlocked && (
                <div className="mt-auto pt-2">
                     <span className="text-[9px] font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-2 py-0.5 rounded-full">
                        Unlocked
                    </span>
                </div>
            )}
        </div>
    );
};


const Challenges: React.FC<ChallengesProps> = ({ userStats, accounts, transactions }) => {
  const { currentStreak, longestStreak } = userStats;
  const { budgets } = useBudgetsContext();
  const { financialGoals } = useGoalsContext();
  const { recurringTransactions, memberships, billsAndPayments } = useScheduleContext();
  
  // --- Derived Metrics for Badges ---
  const { totalDebt, netWorth, savingsRate, totalInvestments, uniqueAccountTypes, liquidityRatio, budgetAccuracy } = useMemo(() => {
     // 1. Totals
     const { totalDebt, netWorth } = calculateAccountTotals(accounts.filter(a => a.status !== 'closed'));
     
     // 2. Savings Rate & Budget Accuracy (Current Month)
     const now = new Date();
     const startOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
     let income = 0;
     let expense = 0;
     const spendingByCat: Record<string, number> = {};

     transactions.forEach(tx => {
        const d = parseDateAsUTC(tx.date);
        if (d >= startOfMonth && !tx.transferId) {
            const val = convertToEur(tx.amount, tx.currency);
            if (tx.type === 'income') {
                income += val;
            } else {
                expense += Math.abs(val);
                // Simple category sum for Oracle badge
                spendingByCat[tx.category] = (spendingByCat[tx.category] || 0) + Math.abs(val);
            }
        }
     });
     
     const savingsRate = income > 0 ? ((income - expense) / income) : 0;
     
     // Budget Accuracy (Oracle)
     // Calculate average variance between budget and actual spending
     let totalBudgetVariance = 0;
     let validBudgets = 0;
     budgets.forEach(b => {
         const spent = spendingByCat[b.categoryName] || 0;
         const variance = Math.abs(b.amount - spent) / b.amount;
         totalBudgetVariance += variance;
         validBudgets++;
     });
     // Average variance across all budgets. If < 0.05 (5%), it's accurate.
     const budgetAccuracy = validBudgets > 0 ? (totalBudgetVariance / validBudgets) : 1; // Default to 100% variance if no budgets
     
     // 3. Investments
     const totalInvestments = accounts
        .filter(a => a.type === 'Investment')
        .reduce((sum, a) => sum + convertToEur(a.balance, a.currency), 0);
        
     // 4. Unique Types
     const uniqueAccountTypes = new Set(accounts.map(a => a.type)).size;
     
     // 5. Liquidity Ratio (Liquid Assets / Avg Monthly Spend)
     const threeMonthsAgo = new Date(); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
     const totalSpend3m = transactions
        .filter(t => parseDateAsUTC(t.date) >= threeMonthsAgo && t.type === 'expense' && !t.transferId)
        .reduce((sum, t) => sum + Math.abs(convertToEur(t.amount, t.currency)), 0);
     
     const avgMonthlySpend = totalSpend3m / 3;
     const liquidAssets = accounts
        .filter(a => LIQUID_ACCOUNT_TYPES.includes(a.type))
        .reduce((sum, a) => sum + convertToEur(a.balance, a.currency), 0);
    
     const liquidityRatio = avgMonthlySpend > 0 ? liquidAssets / avgMonthlySpend : 0;

     return { totalDebt, netWorth, savingsRate, totalInvestments, uniqueAccountTypes, liquidityRatio, budgetAccuracy };
  }, [accounts, transactions, budgets]);

  // --- Badge Definitions ---
  const badges = useMemo(() => [
      // 1. Milestones
      {
          id: 'novice_explorer',
          title: 'Novice Explorer',
          description: 'Create your first account to start your journey.',
          icon: 'explore',
          color: 'blue',
          unlocked: accounts.length > 0,
          progress: (accounts.length / 1) * 100
      },
      {
          id: 'budget_architect',
          title: 'Budget Architect',
          description: 'Create at least 3 budgets to manage spending.',
          icon: 'architecture',
          color: 'purple',
          unlocked: budgets.length >= 3,
          progress: (budgets.length / 3) * 100
      },
      {
          id: 'the_1_percent',
          title: 'The 1%',
          description: 'Achieve a Net Worth of over €1,000,000.',
          icon: 'diamond',
          color: 'cyan',
          unlocked: netWorth >= 1000000,
          progress: (netWorth / 1000000) * 100
      },
      {
          id: 'high_roller',
          title: 'High Roller',
          description: 'Achieve a Net Worth of over €100,000.',
          icon: 'flight_class',
          color: 'indigo',
          unlocked: netWorth >= 100000,
          progress: (netWorth / 100000) * 100
      },
      
      // 2. Behavior
      {
          id: 'crystal_clear',
          title: 'Crystal Clear',
          description: 'Achieve a monthly savings rate of > 20%.',
          icon: 'water_drop',
          color: 'blue',
          unlocked: savingsRate >= 0.20,
          progress: (savingsRate / 0.20) * 100
      },
      {
          id: 'streak_master',
          title: 'Streak Master',
          description: 'Maintain a 7-day login streak.',
          icon: 'local_fire_department',
          color: 'orange',
          unlocked: currentStreak >= 7,
          progress: (currentStreak / 7) * 100
      },
       {
          id: 'automator',
          title: 'Automator',
          description: 'Set up 5+ recurring transactions.',
          icon: 'settings_suggest',
          color: 'slate',
          unlocked: recurringTransactions.length >= 5,
          progress: (recurringTransactions.length / 5) * 100
      },
      {
          id: 'oracle',
          title: 'Oracle',
          description: 'Spend within 5% of your total budget limits.',
          icon: 'psychology',
          color: 'violet',
          unlocked: budgets.length > 0 && budgetAccuracy <= 0.05,
          progress: budgets.length > 0 ? (1 - budgetAccuracy) * 100 : 0
      },
      
      // 3. Assets & Debts
      {
          id: 'debt_destroyer',
          title: 'Debt Destroyer',
          description: 'Have €0 in total debt (Loans & Credit Cards).',
          icon: 'no_crash',
          color: 'green',
          unlocked: totalDebt === 0 && accounts.some(a => DEBT_TYPES.includes(a.type)), // Must have/had debt capability
          progress: totalDebt === 0 ? 100 : 50 // Rough progress
      },
      {
          id: 'safety_net',
          title: 'Safety Net',
          description: 'Build a 3-month liquidity runway.',
          icon: 'health_and_safety',
          color: 'emerald',
          unlocked: liquidityRatio >= 3,
          progress: (liquidityRatio / 3) * 100
      },
      {
          id: 'diversified',
          title: 'Diversified',
          description: 'Hold 4+ different types of accounts.',
          icon: 'category',
          color: 'teal',
          unlocked: uniqueAccountTypes >= 4,
          progress: (uniqueAccountTypes / 4) * 100
      },
      {
          id: 'investor',
          title: 'Investor',
          description: 'Build an investment portfolio > €5,000.',
          icon: 'trending_up',
          color: 'green',
          unlocked: totalInvestments >= 5000,
          progress: (totalInvestments / 5000) * 100
      },
      {
          id: 'real_estate_mogul',
          title: 'Real Estate Mogul',
          description: 'Add a Property asset to your portfolio.',
          icon: 'apartment',
          color: 'amber',
          unlocked: accounts.some(a => a.type === 'Property'),
          progress: accounts.some(a => a.type === 'Property') ? 100 : 0
      },
      
      // 4. Features
      {
          id: 'goal_setter',
          title: 'Goal Setter',
          description: 'Create your first financial goal.',
          icon: 'flag',
          color: 'pink',
          unlocked: financialGoals.length > 0,
          progress: financialGoals.length > 0 ? 100 : 0
      },
      {
          id: 'goal_getter',
          title: 'Goal Getter',
          description: 'Fully fund a financial goal (100%).',
          icon: 'emoji_events',
          color: 'yellow',
          unlocked: financialGoals.some(g => g.currentAmount >= g.amount),
          progress: financialGoals.length > 0 ? (Math.max(...financialGoals.map(g => g.currentAmount / g.amount)) * 100) : 0
      },
      {
          id: 'penny_pincher',
          title: 'Penny Pincher',
          description: 'Activate a "Spare Change" investment account.',
          icon: 'savings',
          color: 'lime',
          unlocked: accounts.some(a => a.subType === 'Spare Change'),
          progress: accounts.some(a => a.subType === 'Spare Change') ? 100 : 0
      },
      {
          id: 'loyalist',
          title: 'Loyalist',
          description: 'Add 3+ membership cards to your wallet.',
          icon: 'loyalty',
          color: 'rose',
          unlocked: memberships.length >= 3,
          progress: (memberships.length / 3) * 100
      },
      {
          id: 'bill_crusher',
          title: 'Bill Crusher',
          description: 'Have zero unpaid bills that are overdue.',
          icon: 'task_alt',
          color: 'indigo',
          unlocked: billsAndPayments.length > 0 && billsAndPayments.every(b => b.status === 'paid' || b.dueDate >= new Date().toISOString().split('T')[0]),
          progress: billsAndPayments.length > 0 ? 100 : 0
      }
  ], [accounts,