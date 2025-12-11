
import React, { useMemo, useState, useEffect } from 'react';
import Card from '../components/Card';
import { UserStats, Account, Transaction, FinancialGoal, Currency, Category, Prediction, PredictionType, InvestmentTransaction, Warrant } from '../types';
import { calculateAccountTotals, convertToEur, parseDateAsUTC, formatCurrency, generateAmortizationSchedule, toLocalISOString } from '../utils';
import { LIQUID_ACCOUNT_TYPES, ASSET_TYPES, DEBT_TYPES, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { useBudgetsContext, useGoalsContext, useScheduleContext, useCategoryContext } from '../contexts/FinancialDataContext';
import useLocalStorage from '../hooks/useLocalStorage';
import PredictionCard from '../components/PredictionCard';
import PredictionModal from '../components/PredictionModal';
import PageHeader from '../components/PageHeader';

interface ChallengesProps {
    userStats: UserStats;
    accounts: Account[];
    transactions: Transaction[];
    predictions: Prediction[];
    savePrediction: (prediction: Omit<Prediction, 'id'> & { id?: string }) => void;
    deletePrediction: (id: string) => void;
    saveUserStats: (stats: UserStats) => void;
    investmentTransactions: InvestmentTransaction[];
    warrants: Warrant[];
    assetPrices: Record<string, number | null>;
}

// --- Visual Components ---

const CircularGauge: React.FC<{ value: number; size?: 'sm' | 'md' | 'lg' }> = ({ value, size = 'md' }) => {
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

  const gaugeGradient = `conic-gradient(${colorStart} ${angle}deg, rgba(255,255,255,0.1) 0deg)`;
  
  const dimClasses = {
      sm: 'w-20 h-20',
      md: 'w-32 h-32',
      lg: 'w-40 h-40'
  };
  const innerDimClasses = {
      sm: 'w-16 h-16',
      md: 'w-24 h-24',
      lg: 'w-32 h-32'
  };
  const textSizeClasses = {
      sm: 'text-xl',
      md: 'text-4xl',
      lg: 'text-5xl'
  };

  return (
      <div
        className={`relative ${dimClasses[size]} rounded-full flex items-center justify-center shadow-lg bg-gray-200 dark:bg-gray-800`}
        style={{ background: gaugeGradient }}
      >
        <div className={`${innerDimClasses[size]} rounded-full bg-white dark:bg-dark-card flex flex-col items-center justify-center shadow-inner`}>
          <p className={`${textSizeClasses[size]} font-black ${tone} tracking-tighter`}>{clamped}</p>
        </div>
      </div>
  );
};

// --- Badge Component ---
const BadgeItem: React.FC<{ badge: any }> = ({ badge }) => {
    const theme = badge.unlocked 
        ? 'bg-gradient-to-br from-white to-indigo-50 dark:from-dark-card dark:to-indigo-900/10 border-indigo-200 dark:border-indigo-800' 
        : 'bg-gray-50 dark:bg-white/5 border-transparent opacity-60 grayscale';

    const iconTheme = badge.unlocked
        ? `bg-${badge.color}-100 dark:bg-${badge.color}-900/30 text-${badge.color}-600 dark:text-${badge.color}-400 ring-4 ring-${badge.color}-50 dark:ring-${badge.color}-900/10`
        : 'bg-gray-200 dark:bg-gray-700 text-gray-400';

    return (
        <div className={`group relative flex flex-col items-center text-center p-5 rounded-2xl border transition-all duration-300 ${theme} hover:shadow-lg hover:-translate-y-1`}>
            {/* Icon Container */}
            <div className={`relative w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-all duration-300 ${iconTheme}`}>
                <span className="material-symbols-outlined text-2xl">{badge.icon}</span>
                
                {badge.unlocked && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-white dark:border-dark-card flex items-center justify-center text-white shadow-sm">
                        <span className="material-symbols-outlined text-[10px] font-bold">check</span>
                    </div>
                )}
                {!badge.unlocked && (
                     <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gray-400 border-2 border-gray-50 dark:border-gray-800 flex items-center justify-center text-white shadow-sm">
                        <span className="material-symbols-outlined text-[10px]">lock</span>
                    </div>
                )}
            </div>
            
            <h4 className="font-bold text-sm text-light-text dark:text-dark-text mb-1 line-clamp-1" title={badge.title}>
                {badge.title}
            </h4>
            
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-snug mb-3 min-h-[2.5em] line-clamp-2" title={badge.description}>
                {badge.description}
            </p>
            
            {/* Progress Bar */}
            <div className="w-full mt-auto">
                <div className="flex justify-between text-[9px] font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1 uppercase tracking-wide">
                    <span>Progress</span>
                    <span>{Math.min(100, badge.progress).toFixed(0)}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-200 dark:bg-black/20 rounded-full overflow-hidden">
                    <div 
                        className={`h-full rounded-full transition-all duration-500 ${badge.unlocked ? 'bg-green-500' : 'bg-gray-400'}`} 
                        style={{ width: `${Math.min(100, badge.progress)}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
};

// --- Personal Best Leaderboard Component ---
const PersonalBestLeaderboard: React.FC<{
    currentNetWorth: number;
    history: { date: string; value: number }[];
}> = ({ currentNetWorth, history }) => {
    
    const leaderboardData = useMemo(() => {
        const currentEntry = { label: 'Current Status', value: currentNetWorth, date: 'Now', isCurrent: true, isNewRecord: false };
        let allTimeHighEntry = { label: 'All-Time Best', value: currentNetWorth, date: 'Now', isCurrent: false, isNewRecord: false };

        if (history.length > 0) {
            const max = history.reduce((prev, current) => (prev.value > current.value) ? prev : current);
            if (max.value > currentNetWorth) {
                allTimeHighEntry = { label: 'All-Time Best', value: max.value, date: max.date, isCurrent: false, isNewRecord: false };
            }
        }

        let lastYearEntry = { label: '1 Year Ago', value: 0, date: '12 Months Ago', isCurrent: false, isNewRecord: false };
        if (history.length >= 13) {
             const ly = history[12]; 
             lastYearEntry = { label: '1 Year Ago', value: ly.value, date: ly.date, isCurrent: false, isNewRecord: false };
        } else if (history.length > 0) {
             const oldest = history[history.length - 1];
             lastYearEntry = { label: 'Start', value: oldest.value, date: oldest.date, isCurrent: false, isNewRecord: false };
        }
        
        const entries: any[] = [];
        entries.push(currentEntry);
        
        if (Math.abs(allTimeHighEntry.value - currentEntry.value) > 1) {
             entries.push(allTimeHighEntry);
        } else {
             entries[0].label = "Current (All-Time Best)";
             entries[0].isNewRecord = true;
        }

        if (Math.abs(lastYearEntry.value - currentEntry.value) > 1 && Math.abs(lastYearEntry.value - allTimeHighEntry.value) > 1) {
             entries.push(lastYearEntry);
        }

        return entries.sort((a, b) => b.value - a.value).map((entry, index) => ({
            ...entry,
            rank: index + 1
        }));

    }, [currentNetWorth, history]);

    return (
        <Card className="overflow-hidden p-0 border border-black/5 dark:border-white/5 shadow-sm">
             <div className="p-6 bg-gradient-to-r from-slate-800 to-slate-900 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                        <span className="material-symbols-outlined text-8xl">podium</span>
                  </div>
                  <div className="flex items-center gap-2 relative z-10">
                      <div className="p-2 bg-white/10 rounded-lg">
                        <span className="material-symbols-outlined text-yellow-400">emoji_events</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">Personal Best</h3>
                        <p className="text-slate-400 text-xs">Compete against your past self.</p>
                      </div>
                  </div>
             </div>
             
             <div className="divide-y divide-black/5 dark:divide-white/5 bg-white dark:bg-dark-card">
                 {leaderboardData.map((entry) => (
                     <div key={entry.label} className={`flex items-center justify-between p-4 ${entry.isCurrent ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}>
                         <div className="flex items-center gap-4">
                             <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${entry.rank === 1 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'}`}>
                                 {entry.rank}
                             </div>
                             <div>
                                 <div className="flex items-center gap-2">
                                     <p className="font-bold text-sm text-light-text dark:text-dark-text">{entry.label}</p>
                                     {entry.isNewRecord && <span className="text-[10px] font-bold bg-yellow-400 text-black px-1.5 py-0.5 rounded shadow-sm">NEW!</span>}
                                 </div>
                                 <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{entry.date}</p>
                             </div>
                         </div>
                         <p className="font-mono font-bold text-light-text dark:text-dark-text">{formatCurrency(entry.value, 'EUR')}</p>
                     </div>
                 ))}
             </div>
        </Card>
    );
};

// --- Boss Battle Components ---
interface Boss {
    id: string;
    name: string;
    type: 'debt' | 'savings';
    maxHp: number;
    currentHp: number;
    level: number;
    icon: string;
    hits: { date: string; amount: number }[];
    paidPrincipal?: number;
    paidInterest?: number;
}

const BossBattleCard: React.FC<{ boss: Boss; currency: Currency }> = ({ boss, currency }) => {
    const healthPercent = (boss.currentHp / boss.maxHp) * 100;
    const isDefeated = boss.currentHp <= 0;
    
    const config = boss.type === 'debt' 
        ? { color: 'red', icon: 'gavel', label: 'Debt Nemesis' }
        : { color: 'amber', icon: 'shield', label: 'Savings Guardian' };

    return (
        <div className={`relative overflow-hidden rounded-2xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md group`}>
            {isDefeated && (
                <div className="absolute inset-0 z-20 bg-white/80 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fade-in-up">
                    <div className="transform -rotate-6 bg-yellow-400 text-black px-4 py-2 shadow-xl border-2 border-black font-black text-xl uppercase tracking-widest">
                        Defeated!
                    </div>
                </div>
            )}
            
            {/* Header / Info */}
            <div className="p-5 relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg bg-gradient-to-br from-${config.color}-500 to-${config.color}-600`}>
                            <span className="material-symbols-outlined text-2xl">{boss.icon}</span>
                        </div>
                        <div>
                            <h3 className="font-bold text-base text-light-text dark:text-dark-text leading-tight line-clamp-1">{boss.name}</h3>
                            <span className={`text-[10px] font-bold uppercase tracking-wider text-${config.color}-600 dark:text-${config.color}-400 mt-1 block`}>
                                Lvl {boss.level} {config.label}
                            </span>
                        </div>
                    </div>
                    <div className="text-right">
                         <span className="block text-2xl font-black text-light-text dark:text-dark-text leading-none">{healthPercent.toFixed(0)}%</span>
                         <span className="text-[10px] font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary">HP Left</span>
                    </div>
                </div>

                {/* HP Bar */}
                <div className="w-full h-3 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden mb-2">
                    <div 
                        className={`h-full bg-gradient-to-r from-${config.color}-500 to-${config.color}-400 transition-all duration-1000 ease-out`} 
                        style={{ width: `${Math.min(100, healthPercent)}%` }}
                    ></div>
                </div>
                <div className="flex justify-between text-[10px] font-mono font-medium text-light-text-secondary dark:text-dark-text-secondary">
                    <span>{formatCurrency(boss.currentHp, currency)}</span>
                    <span>{formatCurrency(boss.maxHp, currency)}</span>
                </div>
            </div>

            {/* Stats Footer */}
            <div className="bg-gray-50 dark:bg-white/5 p-3 flex justify-between items-center text-xs border-t border-black/5 dark:border-white/5">
                <span className="font-medium text-light-text-secondary dark:text-dark-text-secondary">Recent Hits</span>
                <div className="flex gap-1">
                     {boss.hits.slice(0, 3).map((hit, idx) => (
                        <span key={idx} className="bg-white dark:bg-black/20 border border-black/5 dark:border-white/10 px-1.5 py-0.5 rounded text-[10px] font-mono">
                            -{formatCurrency(hit.amount, currency)}
                        </span>
                    ))}
                    {boss.hits.length === 0 && <span className="text-light-text-secondary dark:text-dark-text-secondary italic">None yet</span>}
                </div>
            </div>
        </div>
    );
};

// --- Mastery Card ---
const MasteryCard: React.FC<{ 
    categoryName: string; 
    spent: number; 
    budget: number; 
    level: number; 
    title: string; 
    icon: string;
    categoryColor: string;
}> = ({ categoryName, spent, budget, level, title, icon, categoryColor }) => {
    
    const ratio = Math.min(100, (spent / budget) * 100);
    const isMaster = level === 4;

    return (
        <div className={`relative overflow-hidden rounded-2xl p-5 border transition-all duration-200 hover:shadow-md group ${isMaster ? 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border-amber-200 dark:border-amber-800' : 'bg-white dark:bg-dark-card border-black/5 dark:border-white/5'}`}>
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm" style={{ backgroundColor: `${categoryColor}20`, color: categoryColor }}>
                         <span className="material-symbols-outlined text-xl">{icon}</span>
                    </div>
                    <div>
                        <h4 className="font-bold text-sm text-light-text dark:text-dark-text truncate max-w-[120px]">{categoryName}</h4>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary block">
                            Lvl {level}: {title}
                        </span>
                    </div>
                </div>
                {isMaster && <span className="material-symbols-outlined text-amber-500 text-2xl">workspace_premium</span>}
            </div>
            
            <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-light-text dark:text-dark-text">
                    <span>{formatCurrency(spent, 'EUR')}</span>
                    <span>{ratio.toFixed(0)}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                    <div 
                        className="h-full rounded-full transition-all duration-500" 
                        style={{ width: `${ratio}%`, backgroundColor: categoryColor }}
                    ></div>
                </div>
            </div>
        </div>
    );
};

// --- Savings Sprints Configuration ---
type SprintDefinition = {
    id: string; title: string; description: string; durationDays: number;
    targetType: 'category' | 'global' | 'transaction_limit';
    targetCategory?: string; limitAmount: number; icon: string; color: string;
};

const SAVINGS_SPRINTS: SprintDefinition[] = [
    { id: 'zero_day', title: 'The Zero Day', description: 'Spend absolutely nothing for 24 hours.', durationDays: 1, targetType: 'global', limitAmount: 0, icon: 'block', color: 'slate' },
    { id: 'weekend_warrior', title: 'Weekend Warrior', description: 'No spending for 2 days.', durationDays: 2, targetType: 'global', limitAmount: 0, icon: 'weekend', color: 'indigo' },
    { id: 'coffee_break', title: 'The Coffee Break', description: 'Spend < €15 on coffee for a week.', durationDays: 7, targetType: 'category', targetCategory: 'coffee', limitAmount: 15, icon: 'coffee', color: 'amber' },
    { id: 'dining_detox', title: 'Dining Detox', description: 'Zero spending on Restaurants for 7 days.', durationDays: 7, targetType: 'category', targetCategory: 'restaurant', limitAmount: 0, icon: 'restaurant_menu', color: 'orange' },
    { id: 'low_cost_living', title: 'Low Cost Living', description: 'Total expenses < €200 for a week.', durationDays: 7, targetType: 'global', limitAmount: 200, icon: 'account_balance_wallet', color: 'teal' },
    { id: 'impulse_control', title: 'Impulse Control', description: 'No single transaction over €50 for a week.', durationDays: 7, targetType: 'transaction_limit', limitAmount: 50, icon: 'price_check', color: 'rose' },
];

interface ActiveSprint { id: string; startDate: string; }

type ChallengeSection = 'score' | 'battles' | 'badges' | 'mastery' | 'sprints' | 'prediction' | 'personal-best';

const Challenges: React.FC<ChallengesProps> = ({ userStats, accounts, transactions, predictions, savePrediction, deletePrediction, saveUserStats, investmentTransactions, warrants, assetPrices }) => {
  const { currentStreak, longestStreak } = userStats;
  const { budgets } = useBudgetsContext();
  const { financialGoals } = useGoalsContext();
  const { recurringTransactions, loanPaymentOverrides, memberships, billsAndPayments } = useScheduleContext();
  const { expenseCategories } = useCategoryContext();
  
  const [activeSection, setActiveSection] = useState<ChallengeSection>('score');
  const [activeSprints, setActiveSprints] = useLocalStorage<ActiveSprint[]>('crystal_active_sprints', []);
  const [isPredictionModalOpen, setPredictionModalOpen] = useState(false);

  // --- Historical Net Worth ---
  const netWorthHistory = useMemo(() => {
        const { netWorth: currentNetWorth } = calculateAccountTotals(accounts.filter(a => a.status !== 'closed'));
        const monthlyChanges = new Map<string, number>();
        const today = new Date();

        transactions.forEach(tx => {
            const date = parseDateAsUTC(tx.date);
            if (date > today) return;
            const monthKey = date.toISOString().slice(0, 7);
            const val = convertToEur(tx.amount, tx.currency);
            monthlyChanges.set(monthKey, (monthlyChanges.get(monthKey) || 0) + val);
        });

        const history: { date: string; value: number }[] = [];
        let runningBalance = currentNetWorth;
        
        for (let i = 0; i < 60; i++) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            if (i > 0) {
                const prevD = new Date(today.getFullYear(), today.getMonth() - (i - 1), 1);
                const prevMonthKey = prevD.toISOString().slice(0, 7);
                const changeInPrevMonth = monthlyChanges.get(prevMonthKey) || 0;
                runningBalance -= changeInPrevMonth;
            }
            history.push({ 
                date: d.toLocaleDateString('default', { month: 'long', year: 'numeric' }), 
                value: runningBalance 
            });
        }
        return { currentNetWorth, history };
  }, [accounts, transactions]);

  // --- Prediction Resolver (Effect) ---
  useEffect(() => {
    const todayDate = parseDateAsUTC(new Date().toISOString().split('T')[0]);
    
    predictions.forEach(prediction => {
        if (prediction.status === 'active') {
            const endDate = parseDateAsUTC(prediction.endDate);
            if (endDate < todayDate) {
                let actualAmount = 0;
                let won = false;

                if (prediction.type === 'spending_cap') {
                    const start = parseDateAsUTC(prediction.startDate);
                    const end = parseDateAsUTC(prediction.endDate);
                    end.setHours(23, 59, 59);

                    actualAmount = transactions
                        .filter(tx => {
                            const d = parseDateAsUTC(tx.date);
                            return d >= start && d <= end && tx.type === 'expense' && !tx.transferId && tx.category === prediction.targetName;
                        })
                        .reduce((sum, tx) => sum + Math.abs(convertToEur(tx.amount, tx.currency)), 0);
                        
                    won = actualAmount <= prediction.targetAmount;
                } else if (prediction.type === 'net_worth_goal') {
                    if (prediction.targetId) {
                         const account = accounts.find(a => a.id === prediction.targetId);
                         actualAmount = account ? convertToEur(account.balance, account.currency) : 0;
                    } else {
                         const { netWorth } = calculateAccountTotals(accounts.filter(a => a.status !== 'closed'));
                         actualAmount = netWorth;
                    }
                    won = actualAmount >= prediction.targetAmount;
                } else if (prediction.type === 'price_target') {
                    const symbol = prediction.targetId;
                    const currentPrice = symbol ? assetPrices[symbol] : null;
                    if (currentPrice !== null && currentPrice !== undefined) {
                        actualAmount = currentPrice;
                        won = actualAmount >= prediction.targetAmount;
                    } else {
                        return; // Skip resolution
                    }
                }
                
                savePrediction({ ...prediction, status: won ? 'won' : 'lost', finalAmount: actualAmount });
                
                if (won) {
                    saveUserStats({ ...userStats, predictionWins: (userStats.predictionWins || 0) + 1, predictionTotal: (userStats.predictionTotal || 0) + 1 });
                } else {
                    saveUserStats({ ...userStats, predictionTotal: (userStats.predictionTotal || 0) + 1 });
                }
            }
        }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [predictions, transactions, accounts, assetPrices]);

  // --- Metrics ---
  const { totalDebt, netWorth, savingsRate, totalInvestments, uniqueAccountTypes, liquidityRatio, budgetAccuracy, spendingByCat, creditUtilization } = useMemo(() => {
     const { totalDebt, netWorth, creditCardDebt } = calculateAccountTotals(accounts.filter(a => a.status !== 'closed'));
     
     // Calculate Credit Utilization
     const creditCards = accounts.filter(a => a.type === 'Credit Card' && a.status !== 'closed');
     const totalLimit = creditCards.reduce((sum, cc) => sum + convertToEur(cc.creditLimit || 0, cc.currency), 0);
     const creditUtilization = totalLimit > 0 ? (creditCardDebt / totalLimit) * 100 : 0;

     const now = new Date();
     const startOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
     let income = 0; let expense = 0;
     const spendingByCat: Record<string, number> = {};

     transactions.forEach(tx => {
        const d = parseDateAsUTC(tx.date);
        if (d >= startOfMonth && !tx.transferId) {
            const val = convertToEur(tx.amount, tx.currency);
            if (tx.type === 'income') income += val;
            else {
                expense += Math.abs(val);
                spendingByCat[tx.category] = (spendingByCat[tx.category] || 0) + Math.abs(val);
            }
        }
     });
     
     const savingsRate = income > 0 ? ((income - expense) / income) : 0;
     let totalBudgetVariance = 0; let validBudgets = 0;
     budgets.forEach(b => {
         const spent = spendingByCat[b.categoryName] || 0;
         const variance = Math.abs(b.amount - spent) / b.amount;
         totalBudgetVariance += variance;
         validBudgets++;
     });
     // Accuracy is 1 minus average variance. Closer to 1 (100%) is better.
     // However, user prompt says "Spend within 5%", which means variance <= 0.05.
     const budgetAccuracy = validBudgets > 0 ? (totalBudgetVariance / validBudgets) : 1;
     
     const totalInvestments = accounts.filter(a => a.type === 'Investment').reduce((sum, a) => sum + convertToEur(a.balance, a.currency), 0);
     const uniqueAccountTypes = new Set(accounts.map(a => a.type)).size;
     
     const threeMonthsAgo = new Date(); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
     const totalSpend3m = transactions.filter(t => parseDateAsUTC(t.date) >= threeMonthsAgo && t.type === 'expense' && !t.transferId).reduce((sum, t) => sum + Math.abs(convertToEur(t.amount, t.currency)), 0);
     const avgMonthlySpend = totalSpend3m / 3;
     const liquidAssets = accounts.filter(a => LIQUID_ACCOUNT_TYPES.includes(a.type)).reduce((sum, a) => sum + convertToEur(a.balance, a.currency), 0);
     const liquidityRatio = avgMonthlySpend > 0 ? liquidAssets / avgMonthlySpend : 0;

     return { totalDebt, netWorth, savingsRate, totalInvestments, uniqueAccountTypes, liquidityRatio, budgetAccuracy, spendingByCat, creditUtilization };
  }, [accounts, transactions, budgets]);

  // --- Bosses ---
  const bosses = useMemo(() => {
      const activeBosses: Boss[] = [];
      accounts.filter(a => DEBT_TYPES.includes(a.type) && a.status !== 'closed').forEach(acc => {
          let outstanding = Math.abs(acc.balance); 
          let maxHp = acc.creditLimit || (acc.totalAmount || outstanding * 1.2);
          let paidPrincipal = 0; let paidInterest = 0;

          if (acc.type === 'Loan' && acc.principalAmount && acc.duration) {
             const schedule = generateAmortizationSchedule(acc, transactions, loanPaymentOverrides[acc.id] || {});
             const totalCost = schedule.reduce((sum, p) => sum + p.principal + p.interest, 0);
             paidPrincipal = schedule.reduce((sum, p) => p.status === 'Paid' ? sum + p.principal : sum, 0);
             paidInterest = schedule.reduce((sum, p) => p.status === 'Paid' ? sum + p.interest : sum, 0);
             outstanding = Math.max(0, totalCost - (paidPrincipal + paidInterest));
             maxHp = totalCost;
          } else if (outstanding < 1) return;

          const recentPayments = transactions.filter(t => t.accountId === acc.id && t.type === 'income').sort((a,b) => parseDateAsUTC(b.date).getTime() - parseDateAsUTC(a.date).getTime()).slice(0, 5).map(t => ({ date: t.date, amount: t.amount }));

          activeBosses.push({ id: acc.id, name: acc.name, type: 'debt', maxHp: Math.max(maxHp, outstanding), currentHp: outstanding, level: Math.floor(maxHp / 1000) + 1, icon: acc.type === 'Loan' ? 'gavel' : 'sentiment_very_dissatisfied', hits: recentPayments, paidPrincipal, paidInterest });
      });

      financialGoals.forEach(goal => {
          if (goal.currentAmount >= goal.amount) return; 
          activeBosses.push({ id: goal.id, name: goal.name, type: 'savings', maxHp: goal.amount, currentHp: goal.amount - goal.currentAmount, level: Math.floor(goal.amount / 500) + 1, icon: 'shield', hits: [] });
      });
      return activeBosses;
  }, [accounts, financialGoals, transactions, loanPaymentOverrides]);

  // --- Category Mastery ---
  const categoryMastery = useMemo(() => {
      return budgets.map(budget => {
          const spent = spendingByCat[budget.categoryName] || 0;
          const ratio = budget.amount > 0 ? spent / budget.amount : 1;
          let level = 0, title = 'Unranked';
          if (ratio > 1) { level = 0; title = 'Overloaded'; }
          else if (ratio > 0.9) { level = 1; title = 'Novice'; }
          else if (ratio > 0.75) { level = 2; title = 'Adept'; }
          else if (ratio > 0.5) { level = 3; title = 'Expert'; }
          else { level = 4; title = 'Master'; }
          const catObj = expenseCategories.find(c => c.name === budget.categoryName);
          return { ...budget, spent, ratio, level, title, icon: catObj?.icon || 'category', categoryColor: catObj?.color || '#9ca3af' };
      }).sort((a, b) => b.level - a.level);
  }, [budgets, spendingByCat, expenseCategories]);
  
  // --- Badges ---
  const badges = useMemo(() => {
      const today = new Date();
      const hasOverdueBills = billsAndPayments.some(b => b.status === 'unpaid' && parseDateAsUTC(b.dueDate) < today);
      const holdingsCount = new Set(investmentTransactions.map(t => t.symbol)).size;
      const cryptoHoldings = accounts.filter(a => (a.type === 'Investment' && a.subType === 'Crypto') || ((a.type as string) === 'Crypto')).reduce((sum, a) => sum + convertToEur(a.balance, a.currency), 0);

      return [
        // Account & Setup
        { id: 'novice', title: 'Novice Explorer', description: 'Create your first account.', icon: 'explore', color: 'blue', unlocked: accounts.length > 0, progress: (accounts.length / 1) * 100 },
        { id: 'diversified', title: 'Diversified', description: 'Hold 4+ different types of accounts.', icon: 'category', color: 'purple', unlocked: uniqueAccountTypes >= 4, progress: (uniqueAccountTypes / 4) * 100 },
        { id: 'real_estate', title: 'Real Estate Mogul', description: 'Add a Property asset to your portfolio.', icon: 'home_work', color: 'amber', unlocked: accounts.some(a => a.type === 'Property'), progress: accounts.some(a => a.type === 'Property') ? 100 : 0 },
        { id: 'penny_pincher', title: 'Penny Pincher', description: 'Activate a "Spare Change" account.', icon: 'savings', color: 'teal', unlocked: accounts.some(a => a.subType === 'Spare Change'), progress: accounts.some(a => a.subType === 'Spare Change') ? 100 : 0 },
        { id: 'loyalist', title: 'Loyalist', description: 'Add 3+ membership cards to your wallet.', icon: 'loyalty', color: 'pink', unlocked: memberships.length >= 3, progress: (memberships.length / 3) * 100 },
        
        // Wealth
        { id: 'high_roller', title: 'High Roller', description: 'Net Worth > €100,000.', icon: 'paid', color: 'emerald', unlocked: netWorth >= 100000, progress: (netWorth / 100000) * 100 },
        { id: '1percent', title: 'The 1%', description: 'Net Worth > €1M.', icon: 'diamond', color: 'cyan', unlocked: netWorth >= 1000000, progress: (netWorth / 1000000) * 100 },
        { id: 'investor', title: 'Investor', description: 'Investment portfolio > €5k.', icon: 'trending_up', color: 'green', unlocked: totalInvestments >= 5000, progress: (totalInvestments / 5000) * 100 },
        { id: 'crypto_whale', title: 'Crypto Whale', description: 'Hold > €10k in Crypto.', icon: 'currency_bitcoin', color: 'orange', unlocked: cryptoHoldings >= 10000, progress: (cryptoHoldings / 10000) * 100 },
        { id: 'collector', title: 'Collector', description: 'Hold 5+ distinct investment assets.', icon: 'collections', color: 'indigo', unlocked: holdingsCount >= 5, progress: (holdingsCount / 5) * 100 },
        
        // Habits & Health
        { id: 'crystal', title: 'Crystal Clear', description: 'Savings rate > 20%.', icon: 'water_drop', color: 'blue', unlocked: savingsRate >= 0.20, progress: (savingsRate / 0.20) * 100 },
        { id: 'safety', title: 'Safety Net', description: '3-mo liquidity runway.', icon: 'health_and_safety', color: 'emerald', unlocked: liquidityRatio >= 3, progress: (liquidityRatio / 3) * 100 },
        { id: 'streak', title: 'Streak Master', description: '7-day login streak.', icon: 'local_fire_department', color: 'orange', unlocked: currentStreak >= 7, progress: (currentStreak / 7) * 100 },
        { id: 'debtfree', title: 'Debt Destroyer', description: '€0 total debt.', icon: 'no_crash', color: 'green', unlocked: totalDebt === 0, progress: totalDebt === 0 ? 100 : (1 - (Math.min(totalDebt, 10000)/10000)) * 50 }, // Approximation
        { id: 'credit_ace', title: 'Credit Ace', description: 'Credit utilization < 30%.', icon: 'credit_score', color: 'blue', unlocked: accounts.some(a => a.type === 'Credit Card') && creditUtilization < 30, progress: accounts.some(a => a.type === 'Credit Card') ? (creditUtilization < 30 ? 100 : (30 / creditUtilization) * 100) : 0 },
        { id: 'bill_crusher', title: 'Bill Crusher', description: 'No overdue unpaid bills.', icon: 'receipt_long', color: 'purple', unlocked: billsAndPayments.length > 0 && !hasOverdueBills, progress: billsAndPayments.length > 0 ? (hasOverdueBills ? 0 : 100) : 0 },
        
        // Planning
        { id: 'architect', title: 'Budget Architect', description: 'Create 3 budgets.', icon: 'architecture', color: 'purple', unlocked: budgets.length >= 3, progress: (budgets.length / 3) * 100 },
        { id: 'oracle', title: 'Oracle', description: 'Budget variance < 5%.', icon: 'visibility', color: 'indigo', unlocked: budgets.length > 0 && budgetAccuracy <= 0.05, progress: budgets.length > 0 ? (budgetAccuracy <= 0.05 ? 100 : (0.05 / budgetAccuracy) * 100) : 0 },
        { id: 'automator', title: 'Automator', description: '5+ recurring transactions.', icon: 'settings_suggest', color: 'slate', unlocked: recurringTransactions.length >= 5, progress: (recurringTransactions.length / 5) * 100 },
        { id: 'goal_setter', title: 'Goal Setter', description: 'Create your first financial goal.', icon: 'flag', color: 'red', unlocked: financialGoals.length > 0, progress: (financialGoals.length / 1) * 100 },
        { id: 'goal_getter', title: 'Goal Getter', description: 'Fully fund a goal (100%).', icon: 'emoji_events', color: 'yellow', unlocked: financialGoals.some(g => g.currentAmount >= g.amount), progress: financialGoals.some(g => g.currentAmount >= g.amount) ? 100 : 50 },
        
        // Predictions
        { id: 'forecaster', title: 'Forecaster', description: 'Create a prediction.', icon: 'psychology', color: 'pink', unlocked: (userStats.predictionTotal || 0) > 0, progress: ((userStats.predictionTotal || 0) > 0) ? 100 : 0 },
        { id: 'prophet', title: 'Prophet', description: 'Win 5 predictions.', icon: 'auto_awesome', color: 'violet', unlocked: (userStats.predictionWins || 0) >= 5, progress: ((userStats.predictionWins || 0) / 5) * 100 },
      ];
  }, [accounts, budgets, netWorth, savingsRate, currentStreak, recurringTransactions, totalDebt, liquidityRatio, totalInvestments, uniqueAccountTypes, budgetAccuracy, creditUtilization, memberships, billsAndPayments, investmentTransactions, userStats]);

  // --- Sprints ---
  const handleStartSprint = (sprintId: string) => { if (activeSprints.some(s => s.id === sprintId)) return; setActiveSprints([...activeSprints, { id: sprintId, startDate: new Date().toISOString().split('T')[0] }]); };
  const handleAbandonSprint = (sprintId: string) => setActiveSprints(activeSprints.filter(s => s.id !== sprintId));
  
  const processedSprints = useMemo(() => {
      const now = new Date();
      return activeSprints.map(active => {
          const def = SAVINGS_SPRINTS.find(s => s.id === active.id);
          if (!def) return null;
          const start = parseDateAsUTC(active.startDate);
          const end = new Date(start); end.setDate(end.getDate() + def.durationDays);
          const elapsed = now.getTime() - start.getTime();
          const daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          const timeProgress = Math.min(100, Math.max(0, (elapsed / (def.durationDays * 86400000)) * 100));
          
          let currentSpend = 0;
          transactions.forEach(tx => {
              const d = parseDateAsUTC(tx.date);
              if (d >= start && d <= now && tx.type === 'expense' && !tx.transferId) {
                  let include = def.targetType === 'global';
                  if (def.targetType === 'transaction_limit' && Math.abs(convertToEur(tx.amount, tx.currency)) > def.limitAmount) currentSpend++;
                  else if (def.targetType === 'category' && def.targetCategory && tx.category.toLowerCase().includes(def.targetCategory)) include = true;
                  if (include && def.targetType !== 'transaction_limit') currentSpend += Math.abs(convertToEur(tx.amount, tx.currency));
              }
          });
          
          let status: 'active' | 'failed' | 'completed' = 'active';
          if (def.targetType === 'transaction_limit') { if (currentSpend > 0) status = 'failed'; else if (daysRemaining === 0) status = 'completed'; }
          else { if (currentSpend > def.limitAmount) status = 'failed'; else if (daysRemaining === 0) status = 'completed'; }
          
          return { ...def, active, currentSpend, daysRemaining, timeProgress, status };
      }).filter(Boolean) as any[];
  }, [activeSprints, transactions]);

  // --- Render Sections ---
  const renderScoreSection = () => {
       const healthScoreDetails = [
          { label: 'Savings', score: Math.min(30, savingsRate * 100 * 1.5), max: 30, status: savingsRate > 0.2 ? 'Good' : 'Fair' },
          { label: 'Liquidity', score: Math.min(30, liquidityRatio * 10), max: 30, status: liquidityRatio > 3 ? 'Good' : 'Fair' },
          { label: 'Debt', score: totalDebt === 0 ? 20 : Math.max(0, 20 - (Math.abs(totalDebt) / 1000)), max: 20, status: totalDebt === 0 ? 'Good' : 'Fair' },
          { label: 'Diversity', score: Math.min(20, uniqueAccountTypes * 5), max: 20, status: uniqueAccountTypes >= 3 ? 'Good' : 'Fair' }
      ];
      const healthScore = healthScoreDetails.reduce((sum, d) => sum + d.score, 0);

      return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up">
              <Card className="flex items-center justify-center p-8 bg-gradient-to-br from-white to-gray-50 dark:from-dark-card dark:to-white/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                       <span className="material-symbols-outlined text-9xl">health_and_safety</span>
                  </div>
                  <div className="relative z-10 text-center">
                      <CircularGauge value={healthScore} size="lg" />
                      <h3 className="text-2xl font-bold mt-6 text-light-text dark:text-dark-text">Financial Health Score</h3>
                      <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1 max-w-xs mx-auto">Based on your savings rate, liquidity, debt levels, and asset diversity.</p>
                  </div>
              </Card>
              <div className="space-y-6">
                  <Card className="flex items-center justify-between p-6 bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-800/30">
                      <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-orange-700 dark:text-orange-400 mb-1">Current Streak</p>
                          <h3 className="text-4xl font-black text-orange-600 dark:text-orange-400">{currentStreak} Days</h3>
                          <p className="text-xs text-orange-700/70 dark:text-orange-300/70 mt-1">Best: {longestStreak} days</p>
                      </div>
                      <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-500 animate-pulse">
                          <span className="material-symbols-outlined text-4xl">local_fire_department</span>
                      </div>
                  </Card>
                  <Card className="p-0 overflow-hidden">
                      <div className="p-4 border-b border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
                          <h4 className="font-bold text-sm text-light-text dark:text-dark-text">Score Factors</h4>
                      </div>
                      <div className="divide-y divide-black/5 dark:divide-white/5">
                          {healthScoreDetails.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center p-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                  <div>
                                      <p className="font-semibold text-sm text-light-text dark:text-dark-text">{item.label}</p>
                                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Max {item.max} pts</p>
                                  </div>
                                  <div className="text-right">
                                      <p className="font-bold text-light-text dark:text-dark-text">{item.score.toFixed(0)}</p>
                                      <span className={`text-[10px] font-bold uppercase ${item.status === 'Good' ? 'text-green-500' : 'text-amber-500'}`}>{item.status}</span>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </Card>
              </div>
          </div>
      );
  };

  const navItems = [
      { id: 'score', label: 'Score', icon: 'health_and_safety' },
      { id: 'battles', label: 'Battles', icon: 'swords' },
      { id: 'badges', label: 'Badges', icon: 'stars' },
      { id: 'mastery', label: 'Mastery', icon: 'workspace_premium' },
      { id: 'sprints', label: 'Sprints', icon: 'timer' },
      { id: 'prediction', label: 'Predictions', icon: 'psychology' },
      { id: 'personal-best', label: 'Records', icon: 'podium' },
  ];

  return (
    <div className="space-y-8 pb-12 animate-fade-in-up">
      {isPredictionModalOpen && <PredictionModal onClose={() => setPredictionModalOpen(false)} onSave={savePrediction} accounts={accounts} expenseCategories={expenseCategories} investmentTransactions={investmentTransactions} warrants={warrants} />}
      
      <PageHeader
        markerIcon="stadia_controller"
        markerLabel="Gamification"
        title="Financial Health"
        subtitle="Level up your finances by completing challenges, unlocking badges, and beating your personal bests."
      />

      {/* Navigation Tabs */}
      <div className="sticky top-0 z-20 bg-light-bg dark:bg-dark-bg py-2 -mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto no-scrollbar">
          <div className="inline-flex bg-light-card dark:bg-dark-card p-1.5 rounded-2xl shadow-sm border border-black/5 dark:border-white/5 min-w-full md:min-w-0">
              {navItems.map(item => (
                  <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id as ChallengeSection)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap flex-1 justify-center
                          ${activeSection === item.id 
                              ? 'bg-primary-500 text-white shadow-md' 
                              : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 hover:text-light-text dark:hover:text-dark-text'
                          }`}
                  >
                      <span className="material-symbols-outlined text-lg">{item.icon}</span>
                      {item.label}
                  </button>
              ))}
          </div>
      </div>

      {/* Dynamic Content */}
      <div className="min-h-[500px]">
          {activeSection === 'score' && renderScoreSection()}
          
          {activeSection === 'battles' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
                   {bosses.length > 0 ? bosses.map(boss => (
                       <BossBattleCard key={boss.id} boss={boss} currency="EUR" />
                   )) : (
                       <div className="col-span-full text-center py-20 text-light-text-secondary dark:text-dark-text-secondary">
                           <span className="material-symbols-outlined text-6xl mb-4 opacity-50">check_circle</span>
                           <p className="text-lg font-medium">All quiet on the front.</p>
                           <p>No active debts or goals to battle right now.</p>
                       </div>
                   )}
              </div>
          )}

          {activeSection === 'badges' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 animate-fade-in-up">
                  {badges.map(badge => <BadgeItem key={badge.id} badge={badge} />)}
              </div>
          )}
          
          {activeSection === 'mastery' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in-up">
                  {categoryMastery.map((cat, idx) => (
                      <MasteryCard key={idx} categoryName={cat.categoryName} spent={cat.spent} budget={cat.amount} level={cat.level} title={cat.title} icon={cat.icon} categoryColor={cat.categoryColor} />
                  ))}
                  {categoryMastery.length === 0 && (
                      <div className="col-span-full text-center py-20 text-light-text-secondary dark:text-dark-text-secondary">
                          <p>Create budgets to start earning mastery levels.</p>
                      </div>
                  )}
              </div>
          )}

          {activeSection === 'personal-best' && (
               <div className="max-w-3xl mx-auto animate-fade-in-up">
                   <PersonalBestLeaderboard currentNetWorth={netWorthHistory.currentNetWorth} history={netWorthHistory.history} />
               </div>
          )}

          {activeSection === 'sprints' && (
               <div className="space-y-8 animate-fade-in-up">
                   {processedSprints.length > 0 && (
                       <div>
                           <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 mb-4 border-b border-cyan-200 dark:border-cyan-900/30 pb-2">Active Sprints</h3>
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                               {processedSprints.map(s => (
                                   <Card key={s.id} className="relative overflow-hidden border border-cyan-200 dark:border-cyan-800">
                                       <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white bg-${s.color}-500 shadow-sm`}>
                                                    <span className="material-symbols-outlined text-xl">{s.icon}</span>
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-light-text dark:text-dark-text">{s.title}</h4>
                                                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${s.status === 'failed' ? 'bg-red-100 text-red-600' : s.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>{s.status}</span>
                                                </div>
                                            </div>
                                       </div>
                                       <div className="space-y-2 mb-4">
                                           <div className="flex justify-between text-xs font-semibold">
                                               <span>Time</span>
                                               <span>{s.daysRemaining} days left</span>
                                           </div>
                                           <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                               <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${s.timeProgress}%` }}></div>
                                           </div>
                                           {s.targetType !== 'transaction_limit' && (
                                               <p className="text-xs text-right mt-1 font-medium">{formatCurrency(s.currentSpend, 'EUR')} / {formatCurrency(s.limitAmount, 'EUR')}</p>
                                           )}
                                       </div>
                                       <button onClick={() => handleAbandonSprint(s.id)} className="text-xs text-red-500 hover:underline w-full text-right">Abandon</button>
                                   </Card>
                               ))}
                           </div>
                       </div>
                   )}
                   
                   <div>
                       <h3 className="text-sm font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-4 border-b border-black/5 dark:border-white/5 pb-2">Available Challenges</h3>
                       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                           {SAVINGS_SPRINTS.filter(s => !activeSprints.some(a => a.id === s.id)).map(sprint => (
                               <Card key={sprint.id} className="hover:shadow-md transition-shadow group cursor-pointer" onClick={() => handleStartSprint(sprint.id)}>
                                   <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white mb-4 shadow-md bg-${sprint.color}-500 group-hover:scale-110 transition-transform`}>
                                       <span className="material-symbols-outlined text-2xl">{sprint.icon}</span>
                                   </div>
                                   <h4 className="font-bold text-light-text dark:text-dark-text mb-1">{sprint.title}</h4>
                                   <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-4 line-clamp-2">{sprint.description}</p>
                                   <div className="flex justify-between items-center mt-auto pt-3 border-t border-black/5 dark:border-white/5">
                                       <span className="text-[10px] font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary">{sprint.durationDays} Days</span>
                                       <span className="text-xs font-bold text-primary-500">Start</span>
                                   </div>
                               </Card>
                           ))}
                       </div>
                   </div>
               </div>
          )}
          
          {activeSection === 'prediction' && (
               <div className="space-y-8 animate-fade-in-up">
                   <div className="flex justify-between items-center">
                       <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Prediction Markets</h3>
                       <button onClick={() => setPredictionModalOpen(true)} className={BTN_PRIMARY_STYLE}>Create Prediction</button>
                   </div>
                   
                   {predictions.length > 0 ? (
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                           {predictions.map(pred => (
                               <PredictionCard 
                                    key={pred.id} 
                                    prediction={pred} 
                                    transactions={transactions} 
                                    accounts={accounts} 
                                    onDelete={deletePrediction} 
                                    manualPrice={pred.type === 'price_target' ? assetPrices[pred.targetId || ''] : undefined} 
                                />
                           ))}
                       </div>
                   ) : (
                       <div className="text-center py-20 bg-light-card/50 dark:bg-dark-card/50 rounded-2xl border-2 border-dashed border-black/5 dark:border-white/5">
                            <span className="material-symbols-outlined text-5xl opacity-30 mb-4">psychology_alt</span>
                           <p className="text-light-text-secondary dark:text-dark-text-secondary">Make a bet on your future finances to stay motivated.</p>
                       </div>
                   )}
               </div>
          )}
      </div>
    </div>
  );
};

export default Challenges;
