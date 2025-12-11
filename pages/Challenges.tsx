
import React, { useMemo, useState, useEffect } from 'react';
import Card from '../components/Card';
import { UserStats, Account, Transaction, FinancialGoal, Currency, Category } from '../types';
import { calculateAccountTotals, convertToEur, parseDateAsUTC, formatCurrency, getDateRange, generateAmortizationSchedule, toLocalISOString } from '../utils';
import { LIQUID_ACCOUNT_TYPES, ASSET_TYPES, DEBT_TYPES, ALL_ACCOUNT_TYPES, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE } from '../constants';
import { useBudgetsContext, useGoalsContext, useScheduleContext, useCategoryContext } from '../contexts/FinancialDataContext';
import useLocalStorage from '../hooks/useLocalStorage';
import { v4 as uuidv4 } from 'uuid';

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

const CircularGauge: React.FC<{ value: number; size?: 'sm' | 'md' }> = ({ value, size = 'md' }) => {
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
  
  const dim = size === 'sm' ? 'w-24 h-24' : 'w-32 h-32';
  const innerDim = size === 'sm' ? 'w-20 h-20' : 'w-24 h-24';
  const textSize = size === 'sm' ? 'text-2xl' : 'text-4xl';

  return (
      <div
        className={`relative ${dim} rounded-full flex items-center justify-center shadow-inner`}
        style={{ background: gaugeGradient }}
      >
        <div className={`${innerDim} rounded-full bg-white dark:bg-dark-card flex flex-col items-center justify-center shadow-sm`}>
          <p className={`${textSize} font-black ${tone}`}>{clamped}</p>
        </div>
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
                : 'bg-gray-100 dark:bg-white/10 border-transparent opacity-60 grayscale'
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

// --- Boss Battle Components ---
interface Boss {
    id: string;
    name: string;
    type: 'debt' | 'savings';
    maxHp: number;
    currentHp: number;
    level: number;
    icon: string;
    colorClass: string;
    hits: { date: string; amount: number }[];
    // Loan Specific Stats
    paidPrincipal?: number;
    paidInterest?: number;
}

const BossBattleCard: React.FC<{ boss: Boss; currency: Currency }> = ({ boss, currency }) => {
    const healthPercent = (boss.currentHp / boss.maxHp) * 100;
    const isDefeated = boss.currentHp <= 0;
    
    // Aesthetic configs based on type
    const theme = boss.type === 'debt' 
        ? { 
            bg: 'bg-red-50 dark:bg-red-900/10', 
            border: 'border-red-100 dark:border-red-900/30',
            iconBg: 'bg-gradient-to-br from-red-500 to-rose-600',
            barTrack: 'bg-red-200 dark:bg-red-900/30',
            barGradient: 'bg-gradient-to-r from-red-500 to-rose-600',
            text: 'text-red-700 dark:text-red-400',
            subText: 'text-red-600/70 dark:text-red-400/70'
          }
        : { 
            bg: 'bg-amber-50 dark:bg-amber-900/10', 
            border: 'border-amber-100 dark:border-amber-900/30',
            iconBg: 'bg-gradient-to-br from-amber-400 to-orange-500',
            barTrack: 'bg-amber-200 dark:bg-amber-900/30',
            barGradient: 'bg-gradient-to-r from-amber-400 to-orange-500',
            text: 'text-amber-700 dark:text-amber-400',
            subText: 'text-amber-600/70 dark:text-amber-400/70'
          };

    return (
        <Card className={`relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg border ${theme.border} ${theme.bg} p-5`}>
             {/* Defeated Overlay */}
             {isDefeated && (
                <div className="absolute inset-0 z-20 bg-white/80 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fade-in-up">
                    <div className="transform rotate-[-6deg] bg-yellow-400 text-black px-4 py-2 shadow-xl border-2 border-black font-black text-xl uppercase tracking-widest">
                        Defeated!
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md ${theme.iconBg}`}>
                        <span className="material-symbols-outlined text-xl">{boss.icon}</span>
                    </div>
                    <div>
                        <h3 className="font-bold text-base text-light-text dark:text-dark-text leading-none">{boss.name}</h3>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${theme.subText} mt-1 block`}>
                            Lvl {boss.level} {boss.type === 'debt' ? 'Nemesis' : 'Guardian'}
                        </span>
                    </div>
                </div>
                
                <div className="text-right">
                    <span className="block text-2xl font-black text-light-text dark:text-dark-text leading-none">{healthPercent.toFixed(0)}%</span>
                    <span className="text-[9px] font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary">HP Remaining</span>
                </div>
            </div>

            {/* Health Bar */}
            <div className="relative z-10 mb-4">
                <div className={`w-full h-2.5 rounded-full overflow-hidden ${theme.barTrack}`}>
                    <div 
                        className={`h-full ${theme.barGradient} transition-all duration-1000 ease-out relative`} 
                        style={{ width: `${Math.min(100, healthPercent)}%` }}
                    >
                         <div className="absolute inset-0 bg-white/30 w-full h-full animate-[shimmer_2s_infinite]"></div>
                    </div>
                </div>
                <div className="flex justify-between mt-1.5 text-[10px] font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                    <span>{formatCurrency(boss.currentHp, currency)}</span>
                    <span>{formatCurrency(boss.maxHp, currency)}</span>
                </div>
            </div>
            
            {/* Loan Specific Breakdown */}
            {(boss.paidPrincipal !== undefined || boss.paidInterest !== undefined) && (
                <div className="grid grid-cols-2 gap-2 mb-3 bg-white/50 dark:bg-black/20 p-2 rounded-lg border border-black/5 dark:border-white/5 relative z-10">
                    <div>
                         <p className="text-[9px] uppercase font-bold text-light-text-secondary dark:text-dark-text-secondary">Principal Paid</p>
                         <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(boss.paidPrincipal || 0, currency)}</p>
                    </div>
                     <div>
                         <p className="text-[9px] uppercase font-bold text-light-text-secondary dark:text-dark-text-secondary">Interest Paid</p>
                         <p className="text-xs font-bold text-orange-600 dark:text-orange-400">{formatCurrency(boss.paidInterest || 0, currency)}</p>
                    </div>
                </div>
            )}

            {/* Recent Hits */}
            {boss.hits.length > 0 && (
                <div className="pt-3 border-t border-black/5 dark:border-white/5 relative z-10">
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary flex-shrink-0">
                            Combo
                        </span>
                        <div className="flex gap-1 overflow-hidden">
                            {boss.hits.slice(0, 3).map((hit, idx) => (
                                <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-white dark:bg-black/20 border border-black/5 dark:border-white/5 text-[9px] font-mono font-medium text-light-text dark:text-dark-text whitespace-nowrap">
                                    -{formatCurrency(hit.amount, currency)}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
};

// --- Mastery Card Component ---
const MasteryCard: React.FC<{ 
    categoryName: string; 
    spent: number; 
    budget: number; 
    level: number; 
    title: string; 
    masteryTheme: string;
    icon: string;
    categoryColor: string;
}> = ({ categoryName, spent, budget, level, title, masteryTheme, icon, categoryColor }) => {
    
    // Theme mapping for border and text emphasis based on Mastery Level
    const themeStyles: Record<string, { border: string, bg: string, text: string }> = {
        'amber': { border: 'border-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/10', text: 'text-amber-700 dark:text-amber-400' },
        'purple': { border: 'border-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/10', text: 'text-purple-700 dark:text-purple-400' },
        'blue': { border: 'border-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/10', text: 'text-blue-700 dark:text-blue-400' },
        'slate': { border: 'border-slate-300', bg: 'bg-slate-50 dark:bg-slate-800/30', text: 'text-slate-600 dark:text-slate-400' },
        'red': { border: 'border-red-400', bg: 'bg-red-50 dark:bg-red-900/10', text: 'text-red-700 dark:text-red-400' },
    };
    
    const theme = themeStyles[masteryTheme] || themeStyles['slate'];
    const ratio = Math.min(100, (spent / budget) * 100);
    const isMaster = level === 4;

    return (
        <Card className={`relative overflow-hidden border ${theme.border} ${theme.bg} transition-all hover:shadow-md group`}>
            {isMaster && (
                <div className="absolute top-0 right-0 p-2 opacity-10">
                    <span className="material-symbols-outlined text-6xl">military_tech</span>
                </div>
            )}
            
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm relative overflow-hidden flex-shrink-0">
                         {/* Icon Background using Category Color with opacity */}
                         <div className="absolute inset-0 opacity-20" style={{ backgroundColor: categoryColor }}></div>
                         <span className="material-symbols-outlined text-2xl relative z-10" style={{ color: categoryColor }}>{icon}</span>
                    </div>
                    <div className="min-w-0">
                        <h4 className="font-bold text-sm text-light-text dark:text-dark-text leading-tight truncate">{categoryName}</h4>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${theme.text} block mt-0.5`}>
                            {title} (Lvl {level})
                        </span>
                    </div>
                </div>
            </div>
            
            <div className="relative z-10">
                <div className="flex justify-between text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1">
                    <span>{formatCurrency(spent, 'EUR')} spent</span>
                    <span>{ratio.toFixed(0)}%</span>
                </div>
                <div className="w-full h-2 bg-white dark:bg-black/20 rounded-full overflow-hidden border border-black/5 dark:border-white/5">
                    <div 
                        className="h-full rounded-full transition-all duration-500" 
                        style={{ width: `${ratio}%`, backgroundColor: categoryColor }}
                    ></div>
                </div>
                <div className="flex justify-between text-[9px] text-light-text-secondary dark:text-dark-text-secondary mt-1 opacity-70">
                    <span>Budget: {formatCurrency(budget, 'EUR')}</span>
                    <span>{level < 4 ? 'Next Lvl: Spend Less' : 'Max Level'}</span>
                </div>
            </div>
        </Card>
    );
};

// --- Prediction Market Types & Components ---
interface Prediction {
    id: string;
    type: 'spending' | 'net_worth';
    targetName: string; // Category Name or "Portfolio"
    targetValue: number; // The wager amount
    startDate: string; // ISO date
    endDate: string; // ISO date
    result?: 'won' | 'lost';
    status: 'open' | 'closed'; // Status of the prediction
}

const PredictionMarketCard: React.FC<{ 
    prediction: Prediction; 
    currentValue: number; 
    onClose: (id: string) => void 
}> = ({ prediction, currentValue, onClose }) => {
    const isSpending = prediction.type === 'spending';
    const isFinished = new Date() > parseDateAsUTC(prediction.endDate);
    
    // Win logic: 
    // Spending: Current < Target = Win
    // Net Worth: Current > Target = Win
    const isWinning = isSpending 
        ? currentValue <= prediction.targetValue 
        : currentValue >= prediction.targetValue;
        
    const progress = Math.min(100, Math.max(0, (currentValue / prediction.targetValue) * 100));
    const result = isFinished ? (isWinning ? 'won' : 'lost') : undefined;

    const theme = isSpending 
        ? { 
            border: 'border-red-200 dark:border-red-900', 
            bg: 'bg-red-50 dark:bg-red-900/10', 
            text: 'text-red-700 dark:text-red-300', 
            icon: 'trending_down',
            label: 'Bear Market (Short)'
          }
        : { 
            border: 'border-emerald-200 dark:border-emerald-900', 
            bg: 'bg-emerald-50 dark:bg-emerald-900/10', 
            text: 'text-emerald-700 dark:text-emerald-300',
            icon: 'trending_up',
            label: 'Bull Market (Long)'
          };

    return (
        <div className={`relative overflow-hidden rounded-xl border ${theme.border} ${theme.bg} p-4 shadow-sm group`}>
            {/* Ticket Cutout Effect */}
            <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-light-bg dark:bg-dark-bg rounded-full border-r border-inherit"></div>
            <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-light-bg dark:bg-dark-bg rounded-full border-l border-inherit"></div>

            <div className="flex justify-between items-start mb-2 pl-2">
                <div className="flex items-center gap-2">
                     <span className={`material-symbols-outlined text-lg ${theme.text}`}>{theme.icon}</span>
                     <div>
                         <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">{theme.label}</p>
                         <p className="font-bold text-sm text-light-text dark:text-dark-text">{prediction.targetName}</p>
                     </div>
                </div>
                {result ? (
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${result === 'won' ? 'bg-yellow-400 text-black' : 'bg-gray-200 text-gray-600'}`}>
                        {result === 'won' ? 'Payout' : 'Expired'}
                    </span>
                ) : (
                    <span className="text-xs font-mono font-medium opacity-70">
                        {Math.ceil((parseDateAsUTC(prediction.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}d left
                    </span>
                )}
            </div>
            
            <div className="pl-2 mt-3">
                <div className="flex justify-between items-end mb-1">
                    <p className={`text-2xl font-black ${theme.text}`}>
                        {formatCurrency(currentValue, 'EUR')}
                    </p>
                    <p className="text-xs font-medium opacity-60 mb-1">
                        Target: {formatCurrency(prediction.targetValue, 'EUR')}
                    </p>
                </div>
                
                {/* Progress Visual */}
                <div className="h-1.5 w-full bg-black/10 dark:bg-white/10 rounded-full overflow-hidden flex">
                    <div className={`h-full ${theme.text.replace('text-', 'bg-')}`} style={{ width: `${progress}%` }}></div>
                </div>
                
                <p className="text-[10px] mt-2 text-center opacity-60 font-medium italic">
                    {isWinning 
                        ? (isSpending ? "Currently under budget (Winning)" : "Currently above target (Winning)") 
                        : (isSpending ? "Over budget limit (Losing)" : "Below target value (Losing)")}
                </p>
            </div>
            
            {!result && (
                <button 
                    onClick={() => onClose(prediction.id)}
                    className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"
                >
                    <span className="material-symbols-outlined text-sm">close</span>
                </button>
            )}
        </div>
    );
}


// --- Savings Sprints Configuration & Components ---

type SprintDefinition = {
    id: string;
    title: string;
    description: string;
    durationDays: number;
    targetType: 'category' | 'global' | 'transaction_limit';
    targetCategory?: string; // string match for category name
    limitAmount: number; // The max allowed spend
    icon: string;
    color: string;
};

const SAVINGS_SPRINTS: SprintDefinition[] = [
    { id: 'zero_day', title: 'The Zero Day', description: 'Spend absolutely nothing for 24 hours.', durationDays: 1, targetType: 'global', limitAmount: 0, icon: 'block', color: 'slate' },
    { id: 'weekend_warrior', title: 'Weekend Warrior', description: 'No spending for 2 days. Perfect for a quiet weekend in.', durationDays: 2, targetType: 'global', limitAmount: 0, icon: 'weekend', color: 'indigo' },
    { id: 'coffee_break', title: 'The Coffee Break', description: 'Spend less than €15 on coffee or cafes for a week.', durationDays: 7, targetType: 'category', targetCategory: 'coffee', limitAmount: 15, icon: 'coffee', color: 'amber' },
    { id: 'dining_detox', title: 'Dining Detox', description: 'Zero spending on Restaurants or Takeaway for 7 days.', durationDays: 7, targetType: 'category', targetCategory: 'restaurant', limitAmount: 0, icon: 'restaurant_menu', color: 'orange' },
    { id: 'grocery_gauntlet', title: 'Grocery Gauntlet', description: 'Keep grocery spending under €50 for a week. Eat the pantry!', durationDays: 7, targetType: 'category', targetCategory: 'groceries', limitAmount: 50, icon: 'shopping_basket', color: 'green' },
    { id: 'transport_trim', title: 'Transport Trim', description: 'Spend less than €20 on Fuel, Uber, or Public Transit for a week.', durationDays: 7, targetType: 'category', targetCategory: 'transport', limitAmount: 20, icon: 'commute', color: 'blue' },
    { id: 'entertainment_fast', title: 'Entertainment Fast', description: 'No spending on movies, games, or events for 2 weeks.', durationDays: 14, targetType: 'category', targetCategory: 'entertainment', limitAmount: 0, icon: 'theaters', color: 'purple' },
    { id: 'shopping_ban', title: 'Shopping Ban', description: 'A full month without buying clothes, gadgets, or home goods.', durationDays: 30, targetType: 'category', targetCategory: 'shopping', limitAmount: 0, icon: 'shopping_bag', color: 'pink' },
    { id: 'low_cost_living', title: 'Low Cost Living', description: 'Keep your total expenses under €200 for a week (excluding bills/rent).', durationDays: 7, targetType: 'global', limitAmount: 200, icon: 'account_balance_wallet', color: 'teal' },
    { id: 'ten_euro_challenge', title: 'The €10 Challenge', description: 'Survive 3 days spending less than €10 total.', durationDays: 3, targetType: 'global', limitAmount: 10, icon: 'euro', color: 'cyan' },
    { id: 'impulse_control', title: 'Impulse Control', description: 'No single transaction over €50 for a week.', durationDays: 7, targetType: 'transaction_limit', limitAmount: 50, icon: 'price_check', color: 'rose' },
];

interface ActiveSprint {
    id: string; // matches SprintDefinition.id
    startDate: string; // ISO date
}

// --- Main Page Component ---
type ChallengeSection = 'score' | 'battles' | 'badges' | 'mastery' | 'sprints' | 'market';

const Challenges: React.FC<ChallengesProps> = ({ userStats, accounts, transactions }) => {
  const { currentStreak, longestStreak } = userStats;
  const { budgets } = useBudgetsContext();
  const { financialGoals } = useGoalsContext();
  const { recurringTransactions, memberships, billsAndPayments, loanPaymentOverrides } = useScheduleContext();
  const { expenseCategories } = useCategoryContext();
  
  const [activeSection, setActiveSection] = useState<ChallengeSection>('score');
  const [activeSprints, setActiveSprints] = useLocalStorage<ActiveSprint[]>('crystal_active_sprints', []);
  const [predictions, setPredictions] = useLocalStorage<Prediction[]>('crystal_predictions', []);
  
  // Market Logic - Create Prediction State
  const [predCategory, setPredCategory] = useState('');
  const [predAmount, setPredAmount] = useState('');
  const [predNetWorth, setPredNetWorth] = useState('');
  
  // Helper to map sub-categories to their parent budget bucket
  const findParentCategory = (categoryName: string, categories: Category[]): Category | undefined => {
      for (const parent of categories) {
        if (parent.name === categoryName) return parent;
        if (parent.subCategories.some(sub => sub.name === categoryName)) return parent;
      }
      return undefined;
  };

  // --- Derived Metrics for Badges ---
  const { totalDebt, netWorth, savingsRate, totalInvestments, uniqueAccountTypes, liquidityRatio, budgetAccuracy, spendingByCat } = useMemo(() => {
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
                
                // Aggregate spending by Parent Category to match budgets
                const parentCat = findParentCategory(tx.category, expenseCategories);
                const catName = parentCat ? parentCat.name : tx.category;
                spendingByCat[catName] = (spendingByCat[catName] || 0) + Math.abs(val);
            }
        }
     });
     
     const savingsRate = income > 0 ? ((income - expense) / income) : 0;
     
     // Budget Accuracy (Oracle)
     let totalBudgetVariance = 0;
     let validBudgets = 0;
     budgets.forEach(b => {
         const spent = spendingByCat[b.categoryName] || 0;
         const variance = Math.abs(b.amount - spent) / b.amount;
         totalBudgetVariance += variance;
         validBudgets++;
     });
     const budgetAccuracy = validBudgets > 0 ? (totalBudgetVariance / validBudgets) : 1;
     
     // 3. Investments
     const totalInvestments = accounts
        .filter(a => a.type === 'Investment')
        .reduce((sum, a) => sum + convertToEur(a.balance, a.currency), 0);
        
     // 4. Unique Types
     const uniqueAccountTypes = new Set(accounts.map(a => a.type)).size;
     
     // 5. Liquidity Ratio
     const threeMonthsAgo = new Date(); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
     const totalSpend3m = transactions
        .filter(t => parseDateAsUTC(t.date) >= threeMonthsAgo && t.type === 'expense' && !t.transferId)
        .reduce((sum, t) => sum + Math.abs(convertToEur(t.amount, t.currency)), 0);
     
     const avgMonthlySpend = totalSpend3m / 3;
     const liquidAssets = accounts
        .filter(a => LIQUID_ACCOUNT_TYPES.includes(a.type))
        .reduce((sum, a) => sum + convertToEur(a.balance, a.currency), 0);
    
     const liquidityRatio = avgMonthlySpend > 0 ? liquidAssets / avgMonthlySpend : 0;

     return { totalDebt, netWorth, savingsRate, totalInvestments, uniqueAccountTypes, liquidityRatio, budgetAccuracy, spendingByCat };
  }, [accounts, transactions, budgets, expenseCategories]);
  
  // --- Prediction Handlers ---
  const handlePlaceBet = (type: 'spending' | 'net_worth') => {
      const today = new Date();
      // Deadline is end of current month
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
      
      const newPrediction: Prediction = {
          id: uuidv4(),
          type,
          targetName: type === 'spending' ? predCategory : 'Portfolio Net Worth',
          targetValue: type === 'spending' ? parseFloat(predAmount) : parseFloat(predNetWorth),
          startDate: toLocalISOString(today),
          endDate: endOfMonth,
          status: 'open'
      };
      
      setPredictions(prev => [...prev, newPrediction]);
      setPredAmount('');
      setPredCategory('');
      setPredNetWorth('');
  };
  
  const handleClosePrediction = (id: string) => {
      setPredictions(prev => prev.filter(p => p.id !== id));
  };
  
  // Calculate current value for active predictions
  const getPredictionCurrentValue = (pred: Prediction) => {
      if (pred.type === 'net_worth') return netWorth;
      
      // For spending, sum transactions in that category since start date
      const start = parseDateAsUTC(pred.startDate);
      // If end date is past, clamp to end date
      const end = new Date() > parseDateAsUTC(pred.endDate) ? parseDateAsUTC(pred.endDate) : new Date(); 
      
      return transactions.reduce((sum, tx) => {
          const d = parseDateAsUTC(tx.date);
          if (d >= start && d <= end && tx.type === 'expense' && !tx.transferId) {
             // Simple category match
             if (tx.category === pred.targetName) return sum + Math.abs(convertToEur(tx.amount, tx.currency));
             // Parent match
             const parent = findParentCategory(tx.category, expenseCategories);
             if (parent && parent.name === pred.targetName) return sum + Math.abs(convertToEur(tx.amount, tx.currency));
          }
          return sum;
      }, 0);
  };

  // --- Boss Battle Generation ---
  const bosses = useMemo(() => {
      const activeBosses: Boss[] = [];

      // 1. Debt Bosses
      accounts.filter(a => DEBT_TYPES.includes(a.type) && a.status !== 'closed').forEach(acc => {
          let outstanding = Math.abs(acc.balance); 
          let maxHp = acc.creditLimit || (acc.totalAmount || outstanding * 1.2);
          
          let paidPrincipal = 0;
          let paidInterest = 0;

          // For Loans, perform deeper calculation if possible
          if (acc.type === 'Loan' && acc.principalAmount && acc.duration && acc.loanStartDate && acc.interestRate !== undefined) {
             const schedule = generateAmortizationSchedule(acc, transactions, loanPaymentOverrides[acc.id] || {});
             const totalScheduledPrincipal = schedule.reduce((sum, p) => sum + p.principal, 0);
             const totalScheduledInterest = schedule.reduce((sum, p) => sum + p.interest, 0);
             const totalLoanCost = totalScheduledPrincipal + totalScheduledInterest;
             
             paidPrincipal = schedule.reduce((sum, p) => p.status === 'Paid' ? sum + p.principal : sum, 0);
             paidInterest = schedule.reduce((sum, p) => p.status === 'Paid' ? sum + p.interest : sum, 0);
             
             outstanding = Math.max(0, totalLoanCost - (paidPrincipal + paidInterest));
             maxHp = totalLoanCost;
          } else if (outstanding < 1) {
              return; 
          }

          const recentPayments = transactions
            .filter(t => t.accountId === acc.id && t.type === 'income')
            .sort((a,b) => parseDateAsUTC(b.date).getTime() - parseDateAsUTC(a.date).getTime())
            .slice(0, 5)
            .map(t => ({ date: t.date, amount: t.amount }));

          activeBosses.push({
              id: acc.id,
              name: acc.name,
              type: 'debt',
              maxHp: Math.max(maxHp, outstanding),
              currentHp: outstanding,
              level: Math.floor(maxHp / 1000) + 1,
              icon: acc.type === 'Loan' ? 'gavel' : 'sentiment_very_dissatisfied',
              colorClass: 'bg-red-500 text-white',
              hits: recentPayments,
              paidPrincipal: acc.type === 'Loan' ? paidPrincipal : undefined,
              paidInterest: acc.type === 'Loan' ? paidInterest : undefined,
          });
      });

      // 2. Savings Bosses (Goals)
      financialGoals.forEach(goal => {
          if (goal.currentAmount >= goal.amount) return; 

          activeBosses.push({
              id: goal.id,
              name: goal.name,
              type: 'savings',
              maxHp: goal.amount,
              currentHp: goal.amount - goal.currentAmount, 
              level: Math.floor(goal.amount / 500) + 1,
              icon: 'shield',
              colorClass: 'bg-yellow-500 text-white',
              hits: [] 
          });
      });

      return activeBosses;
  }, [accounts, financialGoals, transactions, loanPaymentOverrides]);

  const debtBosses = useMemo(() => bosses.filter(b => b.type === 'debt'), [bosses]);
  const savingsBosses = useMemo(() => bosses.filter(b => b.type === 'savings'), [bosses]);
  
  // --- Mastery Levels Calculation ---
  const categoryMastery = useMemo(() => {
      return budgets.map(budget => {
          const spent = spendingByCat[budget.categoryName] || 0;
          const ratio = budget.amount > 0 ? spent / budget.amount : 1;
          let level = 0;
          let title = 'Unranked';
          let masteryTheme = 'slate';
          
          if (ratio > 1) {
              level = 0; title = 'Overloaded'; masteryTheme = 'red';
          } else if (ratio > 0.9) {
              level = 1; title = 'Novice'; masteryTheme = 'slate';
          } else if (ratio > 0.75) {
              level = 2; title = 'Adept'; masteryTheme = 'blue';
          } else if (ratio > 0.5) {
              level = 3; title = 'Expert'; masteryTheme = 'purple';
          } else {
              level = 4; title = 'Master'; masteryTheme = 'amber';
          }
          
          // Enrich with actual category visual data
          const catObj = expenseCategories.find(c => c.name === budget.categoryName);
          const icon = catObj?.icon || 'category';
          const categoryColor = catObj?.color || '#9ca3af';

          return { 
              ...budget, 
              spent, 
              ratio, 
              level, 
              title, 
              masteryTheme, // For rank styling (borders, text class)
              icon,         // Actual Category Icon
              categoryColor // Actual Category Color
          };
      }).sort((a, b) => b.level - a.level);
  }, [budgets, spendingByCat, expenseCategories]);
  
  const masterCount = categoryMastery.filter(c => c.level === 4).length;
  
  // --- Sprints Logic ---
  const handleStartSprint = (sprintId: string) => {
      if (activeSprints.some(s => s.id === sprintId)) return;
      const today = new Date().toISOString().split('T')[0];
      setActiveSprints([...activeSprints, { id: sprintId, startDate: today }]);
  };
  
  const handleAbandonSprint = (sprintId: string) => {
      setActiveSprints(activeSprints.filter(s => s.id !== sprintId));
  };

  const processedSprints = useMemo(() => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      return activeSprints.map(active => {
          const def = SAVINGS_SPRINTS.find(s => s.id === active.id);
          if (!def) return null;

          const start = parseDateAsUTC(active.startDate);
          const end = new Date(start);
          end.setDate(end.getDate() + def.durationDays);
          
          // Time Progress
          const totalDurationMs = def.durationDays * 24 * 60 * 60 * 1000;
          const elapsedMs = now.getTime() - start.getTime();
          const daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          const timeProgress = Math.min(100, Math.max(0, (elapsedMs / totalDurationMs) * 100));
          
          // Spending Progress
          let currentSpend = 0;
          
          transactions.forEach(tx => {
              const txDate = parseDateAsUTC(tx.date);
              // Transaction must be ON or AFTER start date
              if (txDate >= start && txDate <= now && tx.type === 'expense' && !tx.transferId) {
                  let include = false;
                  
                  if (def.targetType === 'global') {
                      include = true;
                  } else if (def.targetType === 'transaction_limit') {
                      if (Math.abs(convertToEur(tx.amount, tx.currency)) > def.limitAmount) {
                          // This challenge tracks COUNT of violations usually, but here we track spend over limit?
                          // For "Impulse Control" (No tx > 50), let's say currentSpend is the number of violations
                           currentSpend += 1;
                           return; // Handle special accumulation
                      }
                  } else if (def.targetType === 'category' && def.targetCategory) {
                       const catName = tx.category.toLowerCase();
                       // Naive keyword match
                       if (catName.includes(def.targetCategory.toLowerCase())) include = true;
                       else {
                           // Check parent categories
                           const parent = findParentCategory(tx.category, expenseCategories);
                           if (parent && parent.name.toLowerCase().includes(def.targetCategory.toLowerCase())) include = true;
                       }
                  }
                  
                  if (include) {
                      currentSpend += Math.abs(convertToEur(tx.amount, tx.currency));
                  }
              }
          });
          
          // Status Logic
          let status: 'active' | 'failed' | 'completed' = 'active';
          
          if (def.targetType === 'transaction_limit') {
               // Limit amount here is the max per transaction, currentSpend is violation count
               // If violations > 0, failed
               if (currentSpend > 0) status = 'failed';
               else if (daysRemaining === 0) status = 'completed';
          } else {
              if (currentSpend > def.limitAmount) {
                  status = 'failed';
              } else if (daysRemaining === 0) {
                  status = 'completed';
              }
          }
          
          return {
              ...def,
              active,
              currentSpend,
              daysRemaining,
              timeProgress,
              status
          };
      }).filter(Boolean) as (SprintDefinition & { active: ActiveSprint, currentSpend: number, daysRemaining: number, timeProgress: number, status: 'active' | 'failed' | 'completed' })[];
  }, [activeSprints, transactions, expenseCategories]);
  
  const availableSprints = useMemo(() => {
      const activeIds = activeSprints.map(s => s.id);
      return SAVINGS_SPRINTS.filter(s => !activeIds.includes(s.id));
  }, [activeSprints]);

  // --- Badge Definitions ---
  const badges = useMemo(() => [
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
      {
          id: 'debt_destroyer',
          title: 'Debt Destroyer',
          description: 'Have €0 in total debt (Loans & Credit Cards).',
          icon: 'no_crash',
          color: 'green',
          unlocked: totalDebt === 0 && accounts.some(a => DEBT_TYPES.includes(a.type)),
          progress: totalDebt === 0 ? 100 : 50 
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
  ], [accounts, budgets, netWorth, savingsRate, currentStreak, recurringTransactions, budgetAccuracy, totalDebt, liquidityRatio, uniqueAccountTypes, totalInvestments, financialGoals, memberships, billsAndPayments]);

  const unlockedCount = badges.filter(b => b.unlocked).length;

  // --- Health Score Logic ---
  const healthScoreDetails = [
      { label: 'Savings Rate', score: Math.min(30, savingsRate * 100 * 1.5), max: 30, status: savingsRate > 0.2 ? 'Good' : 'Fair' },
      { label: 'Liquidity', score: Math.min(30, liquidityRatio * 10), max: 30, status: liquidityRatio > 3 ? 'Good' : 'Fair' },
      { label: 'Debt Level', score: totalDebt === 0 ? 20 : Math.max(0, 20 - (Math.abs(totalDebt) / 1000)), max: 20, status: totalDebt === 0 ? 'Good' : 'Fair' },
      { label: 'Diversification', score: Math.min(20, uniqueAccountTypes * 5), max: 20, status: uniqueAccountTypes >= 3 ? 'Good' : 'Fair' }
  ];
  const healthScore = healthScoreDetails.reduce((sum, d) => sum + d.score, 0);

  return (
    <div className="space-y-8 animate-fade-in-up pb-12">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-extrabold text-light-text dark:text-dark-text tracking-tight">Financial Health</h1>
        <p className="text-light-text-secondary dark:text-dark-text-secondary max-w-xl mx-auto">
            Track your progress, unlock achievements, and visualize your financial fitness.
        </p>
      </div>

      {/* Navigation Cards (Master View) */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {/* Card 1: Crystal Score */}
          <div 
             onClick={() => setActiveSection('score')}
             className={`cursor-pointer rounded-2xl p-6 flex flex-col items-center justify-center transition-all duration-300 relative overflow-hidden group
                 ${activeSection === 'score' 
                    ? 'bg-gradient-to-br from-white to-gray-50 dark:from-dark-card dark:to-white/5 shadow-lg ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-dark-bg' 
                    : 'bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 opacity-80 hover:opacity-100 hover:shadow-md'
                 }
             `}
          >
              <div className="mb-2 transition-transform duration-300 group-hover:scale-105">
                 <CircularGauge value={healthScore} size="sm" />
              </div>
              <h3 className="font-bold text-lg text-light-text dark:text-dark-text">Crystal Score</h3>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                  Health & Habits
              </p>
          </div>
          
           {/* Card 2: Prediction Markets (New) */}
          <div 
             onClick={() => setActiveSection('market')}
             className={`cursor-pointer rounded-2xl p-6 flex flex-col items-center justify-center transition-all duration-300 group
                 ${activeSection === 'market' 
                    ? 'bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-900/10 dark:to-indigo-900/10 shadow-lg ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-dark-bg' 
                    : 'bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 opacity-80 hover:opacity-100 hover:shadow-md'
                 }
             `}
          >
              <div className="w-16 h-16 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-500 mb-3 transition-transform duration-300 group-hover:scale-110">
                  <span className="material-symbols-outlined text-4xl">auto_fix_high</span>
              </div>
              <h3 className="font-bold text-lg text-light-text dark:text-dark-text">Prediction Market</h3>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                  Test Your Foresight
              </p>
          </div>

          {/* Card 3: Boss Battles */}
          <div 
             onClick={() => setActiveSection('battles')}
             className={`cursor-pointer rounded-2xl p-6 flex flex-col items-center justify-center transition-all duration-300 group
                 ${activeSection === 'battles' 
                    ? 'bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/10 dark:to-orange-900/10 shadow-lg ring-2 ring-red-500 ring-offset-2 dark:ring-offset-dark-bg' 
                    : 'bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 opacity-80 hover:opacity-100 hover:shadow-md'
                 }
             `}
          >
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500 mb-3 transition-transform duration-300 group-hover:rotate-6">
                  <span className="material-symbols-outlined text-4xl">swords</span>
              </div>
              <h3 className="font-bold text-lg text-light-text dark:text-dark-text">Boss Battles</h3>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                  {bosses.length} Active Challenges
              </p>
          </div>
          
           {/* Card 4: Savings Sprints (New) */}
           <div 
             onClick={() => setActiveSection('sprints')}
             className={`cursor-pointer rounded-2xl p-6 flex flex-col items-center justify-center transition-all duration-300 group
                 ${activeSection === 'sprints' 
                    ? 'bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-900/10 dark:to-teal-900/10 shadow-lg ring-2 ring-cyan-500 ring-offset-2 dark:ring-offset-dark-bg' 
                    : 'bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 opacity-80 hover:opacity-100 hover:shadow-md'
                 }
             `}
          >
              <div className="w-16 h-16 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center text-cyan-500 mb-3 transition-transform duration-300 group-hover:-translate-y-1">
                  <span className="material-symbols-outlined text-4xl">timer</span>
              </div>
              <h3 className="font-bold text-lg text-light-text dark:text-dark-text">Savings Sprints</h3>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                  {processedSprints.filter(s => s.status === 'active').length} Active
              </p>
          </div>

          {/* Card 5: Badges */}
          <div 
             onClick={() => setActiveSection('badges')}
             className={`cursor-pointer rounded-2xl p-6 flex flex-col items-center justify-center transition-all duration-300 group
                 ${activeSection === 'badges' 
                    ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 shadow-lg ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-dark-bg' 
                    : 'bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 opacity-80 hover:opacity-100 hover:shadow-md'
                 }
             `}
          >
              <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-500 mb-3 transition-transform duration-300 group-hover:-translate-y-1">
                  <span className="material-symbols-outlined text-4xl">military_tech</span>
              </div>
              <h3 className="font-bold text-lg text-light-text dark:text-dark-text">Trophy Case</h3>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                  {unlockedCount} / {badges.length} Unlocked
              </p>
          </div>
      </div>

      {/* Main Content Area */}
      <div className="min-h-[400px]">
          {activeSection === 'score' && (
              <div className="space-y-6 animate-fade-in-up">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="flex flex-col justify-center">
                          <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-4">Score Breakdown</h3>
                          <div className="space-y-4">
                              {healthScoreDetails.map((d, idx) => (
                                  <div key={idx} className="flex justify-between items-center p-3 rounded-lg bg-gray-50 dark:bg-white/5 border border-black/5 dark:border-white/5">
                                      <div>
                                          <p className="font-medium text-light-text dark:text-dark-text">{d.label}</p>
                                          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Max: {d.max} pts</p>
                                      </div>
                                      <div className="text-right">
                                          <p className={`font-bold ${d.status === 'Good' ? 'text-green-600 dark:text-green-400' : d.status === 'Fair' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                                              {d.score.toFixed(0)}
                                          </p>
                                          <p className="text-[10px] uppercase font-bold tracking-wide opacity-70">{d.status}</p>
                                      </div>
                                  </div>
                              ))}
                          </div>
                          <div className="mt-6 pt-4 border-t border-black/10 dark:border-white/10 text-center text-sm text-light-text-secondary dark:text-dark-text-secondary">
                              Improve your financial habits to boost your Crystal Score.
                          </div>
                      </Card>

                      <Card className="flex flex-col justify-center items-center text-center p-6 border-l-4 border-l-orange-500">
                          <div className="w-20 h-20 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-500 mb-4 animate-pulse">
                              <span className="material-symbols-outlined text-5xl">local_fire_department</span>
                          </div>
                          <h3 className="text-4xl font-black text-light-text dark:text-dark-text">{currentStreak} Days</h3>
                          <p className="text-sm font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mt-1">Current Streak</p>
                          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-4 bg-black/5 dark:bg-white/5 px-3 py-1 rounded-full">
                              Best Record: {longestStreak} days
                          </p>
                      </Card>
                  </div>
              </div>
          )}

          {activeSection === 'market' && (
               <div className="space-y-8 animate-fade-in-up">
                   <div className="flex flex-col md:flex-row gap-6">
                       {/* Bear Market (Spending) */}
                       <Card className="flex-1 bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-900/10 dark:to-red-900/10 border border-red-100 dark:border-red-900/30">
                           <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-400">
                               <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                   <span className="material-symbols-outlined">trending_down</span>
                               </div>
                               <div>
                                   <h3 className="font-bold text-lg">Bear Market (Short)</h3>
                                   <p className="text-xs opacity-70 uppercase tracking-wide font-bold">Bet on Low Spending</p>
                               </div>
                           </div>
                           
                           <div className="space-y-4">
                               <div>
                                   <label className="text-xs font-bold uppercase text-red-700 dark:text-red-300 block mb-1">Target Category</label>
                                   <div className={SELECT_WRAPPER_STYLE}>
                                       <select 
                                            value={predCategory} 
                                            onChange={(e) => setPredCategory(e.target.value)} 
                                            className={`${INPUT_BASE_STYLE} bg-white dark:bg-black/20 border-red-200 dark:border-red-800 focus:ring-red-500`}
                                        >
                                            <option value="">Select Category...</option>
                                            {expenseCategories.filter(c => !c.parentId).map(c => (
                                                <option key={c.id} value={c.name}>{c.name}</option>
                                            ))}
                                       </select>
                                       <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                   </div>
                               </div>
                               <div>
                                   <label className="text-xs font-bold uppercase text-red-700 dark:text-red-300 block mb-1">Spending Limit</label>
                                   <input 
                                        type="number" 
                                        value={predAmount} 
                                        onChange={(e) => setPredAmount(e.target.value)} 
                                        placeholder="e.g. 500" 
                                        className={`${INPUT_BASE_STYLE} bg-white dark:bg-black/20 border-red-200 dark:border-red-800 focus:ring-red-500`} 
                                    />
                               </div>
                               <button 
                                    onClick={() => handlePlaceBet('spending')} 
                                    disabled={!predCategory || !predAmount}
                                    className="w-full py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold shadow-md shadow-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                   Short Category
                               </button>
                           </div>
                       </Card>

                       {/* Bull Market (Growth) */}
                       <Card className="flex-1 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 border border-emerald-100 dark:border-emerald-900/30">
                           <div className="flex items-center gap-3 mb-4 text-emerald-600 dark:text-emerald-400">
                               <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                   <span className="material-symbols-outlined">trending_up</span>
                               </div>
                               <div>
                                   <h3 className="font-bold text-lg">Bull Market (Long)</h3>
                                   <p className="text-xs opacity-70 uppercase tracking-wide font-bold">Bet on Growth</p>
                               </div>
                           </div>
                           
                           <div className="space-y-4">
                               <div>
                                   <label className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-300 block mb-1">Target Asset</label>
                                   <div className="w-full p-2 bg-white/50 dark:bg-black/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-sm font-medium text-emerald-800 dark:text-emerald-200">
                                       Total Portfolio (Net Worth)
                                   </div>
                               </div>
                               <div>
                                   <label className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-300 block mb-1">Target Value</label>
                                   <input 
                                        type="number" 
                                        value={predNetWorth} 
                                        onChange={(e) => setPredNetWorth(e.target.value)} 
                                        placeholder="e.g. 50000" 
                                        className={`${INPUT_BASE_STYLE} bg-white dark:bg-black/20 border-emerald-200 dark:border-emerald-800 focus:ring-emerald-500`} 
                                    />
                               </div>
                               <button 
                                    onClick={() => handlePlaceBet('net_worth')} 
                                    disabled={!predNetWorth}
                                    className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                   Long Position
                               </button>
                           </div>
                       </Card>
                   </div>
                   
                   {/* Active Bets List */}
                   <div>
                       <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-4 border-b border-black/5 dark:border-white/5 pb-2">Open Positions</h3>
                       {predictions.length > 0 ? (
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                               {predictions.map(pred => (
                                   <PredictionMarketCard 
                                       key={pred.id} 
                                       prediction={pred} 
                                       currentValue={getPredictionCurrentValue(pred)} 
                                       onClose={handleClosePrediction} 
                                   />
                               ))}
                           </div>
                       ) : (
                           <p className="text-center py-8 text-light-text-secondary dark:text-dark-text-secondary">No active market positions.</p>
                       )}
                   </div>
               </div>
          )}
          
          {activeSection === 'sprints' && (
              <div className="space-y-8 animate-fade-in-up">
                  {/* Active Sprints */}
                  {processedSprints.length > 0 && (
                      <div className="space-y-4">
                          <h3 className="text-sm font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider border-b border-cyan-200 dark:border-cyan-900/50 pb-2">Active Sprints</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {processedSprints.map(sprint => (
                                  <Card key={sprint.id} className={`flex flex-col h-full border ${sprint.status === 'failed' ? 'border-red-500/50 bg-red-50 dark:bg-red-900/10' : sprint.status === 'completed' ? 'border-green-500/50 bg-green-50 dark:bg-green-900/10' : 'border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-900/10'}`}>
                                      <div className="flex justify-between items-start mb-4">
                                          <div className="flex items-center gap-3">
                                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white bg-${sprint.color}-500 shadow-sm`}>
                                                  <span className="material-symbols-outlined text-xl">{sprint.icon}</span>
                                              </div>
                                              <div>
                                                  <h4 className="font-bold text-light-text dark:text-dark-text">{sprint.title}</h4>
                                                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{sprint.targetType === 'transaction_limit' ? 'Limit violations:' : 'Spent so far:'} {sprint.targetType === 'transaction_limit' ? sprint.currentSpend : formatCurrency(sprint.currentSpend, 'EUR')}</p>
                                              </div>
                                          </div>
                                          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${sprint.status === 'active' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : sprint.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                                              {sprint.status}
                                          </span>
                                      </div>
                                      
                                      <div className="space-y-4 mb-4">
                                          <div>
                                              <div className="flex justify-between text-[10px] uppercase font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">
                                                  <span>Time Remaining</span>
                                                  <span>{sprint.daysRemaining} days</span>
                                              </div>
                                              <div className="w-full bg-white dark:bg-black/20 h-2 rounded-full overflow-hidden">
                                                  <div className="bg-cyan-500 h-full transition-all duration-500" style={{ width: `${sprint.timeProgress}%` }}></div>
                                              </div>
                                          </div>
                                          
                                          {sprint.targetType !== 'transaction_limit' && (
                                              <div>
                                                <div className="flex justify-between text-[10px] uppercase font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">
                                                    <span>Budget Used</span>
                                                    <span>{((sprint.currentSpend / (sprint.limitAmount || 1)) * 100).toFixed(0)}%</span>
                                                </div>
                                                <div className="w-full bg-white dark:bg-black/20 h-2 rounded-full overflow-hidden">
                                                    <div className={`h-full transition-all duration-500 ${sprint.currentSpend > sprint.limitAmount ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, (sprint.currentSpend / (sprint.limitAmount || 1)) * 100)}%` }}></div>
                                                </div>
                                              </div>
                                          )}
                                      </div>
                                      
                                      <div className="mt-auto pt-3 border-t border-black/5 dark:border-white/5 flex justify-end">
                                          <button onClick={() => handleAbandonSprint(sprint.id)} className="text-xs text-red-500 hover:underline">
                                              {sprint.status === 'active' ? 'Give Up' : 'Close'}
                                          </button>
                                      </div>
                                  </Card>
                              ))}
                          </div>
                      </div>
                  )}
                  
                  {/* Available Sprints */}
                  <div className="space-y-4">
                       <h3 className="text-sm font-bold text-light-text dark:text-dark-text uppercase tracking-wider border-b border-black/5 dark:border-white/5 pb-2">Available Sprints</h3>
                       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                           {availableSprints.map(sprint => (
                               <Card key={sprint.id} className="flex flex-col h-full hover:shadow-md transition-shadow">
                                   <div className="flex items-center gap-3 mb-3">
                                       <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white bg-${sprint.color}-500 shadow-sm shrink-0`}>
                                           <span className="material-symbols-outlined text-lg">{sprint.icon}</span>
                                       </div>
                                       <h4 className="font-bold text-sm text-light-text dark:text-dark-text leading-tight">{sprint.title}</h4>
                                   </div>
                                   <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary flex-grow mb-4">
                                       {sprint.description}
                                   </p>
                                   <div className="flex items-center justify-between mt-auto">
                                       <span className="text-[10px] font-bold uppercase bg-black/5 dark:bg-white/5 px-2 py-1 rounded text-light-text-secondary dark:text-dark-text-secondary">
                                           {sprint.durationDays} Days
                                       </span>
                                       <button onClick={() => handleStartSprint(sprint.id)} className={`${BTN_PRIMARY_STYLE} !py-1 !px-3 !text-xs`}>
                                           Start
                                       </button>
                                   </div>
                               </Card>
                           ))}
                       </div>
                  </div>
              </div>
          )}

           {activeSection === 'mastery' && (
              <div className="space-y-6 animate-fade-in-up">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                          <h2 className="text-xl font-bold text-light-text dark:text-dark-text flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-500">workspace_premium</span>
                            Category Mastery
                          </h2>
                          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                              Level up by staying under budget this month.
                          </p>
                      </div>
                      <div className="text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800">
                          Based on current month efficiency
                      </div>
                  </div>
                  
                  {categoryMastery.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                          {categoryMastery.map((cat, idx) => (
                              <MasteryCard 
                                  key={idx}
                                  categoryName={cat.categoryName}
                                  spent={cat.spent}
                                  budget={cat.amount}
                                  level={cat.level}
                                  title={cat.title}
                                  masteryTheme={cat.masteryTheme}
                                  icon={cat.icon}
                                  categoryColor={cat.categoryColor}
                              />
                          ))}
                      </div>
                  ) : (
                      <div className="text-center py-12 bg-gray-50 dark:bg-white/5 rounded-xl border border-dashed border-black/10 dark:border-white/10">
                          <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-gray-600 mb-2">savings</span>
                          <p className="text-light-text-secondary dark:text-dark-text-secondary">No active budgets found. Set up budgets to start earning mastery!</p>
                      </div>
                  )}
              </div>
          )}

          {activeSection === 'battles' && (
               <div className="space-y-8 animate-fade-in-up">
                   {(debtBosses.length === 0 && savingsBosses.length === 0) && (
                       <div className="text-center py-12">
                           <div className="w-20 h-20 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                               <span className="material-symbols-outlined text-4xl">check_circle</span>
                           </div>
                           <h3 className="text-xl font-bold text-light-text dark:text-dark-text">No Active Battles</h3>
                           <p className="text-light-text-secondary dark:text-dark-text-secondary">You are free of debts and active goals. Enjoy the peace!</p>
                       </div>
                   )}

                   {/* Debt Bosses (Liabilities) */}
                   {debtBosses.length > 0 && (
                       <div className="space-y-4">
                            <h3 className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wider border-b border-red-200 dark:border-red-900/50 pb-2">Liabilities</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                               {debtBosses.map(boss => (
                                   <BossBattleCard key={boss.id} boss={boss} currency="EUR" />
                               ))}
                            </div>
                       </div>
                   )}
    
                   {/* Savings Bosses (Goals) */}
                   {savingsBosses.length > 0 && (
                       <div className="space-y-4">
                            <h3 className="text-sm font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider border-b border-yellow-200 dark:border-yellow-900/50 pb-2">Financial Goals</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                               {savingsBosses.map(boss => (
                                   <BossBattleCard key={boss.id} boss={boss} currency="EUR" />
                               ))}
                            </div>
                       </div>
                   )}
              </div>
          )}

          {activeSection === 'badges' && (
              <div className="animate-fade-in-up">
                   <div className="flex items-center justify-between mb-6">
                       <h2 className="text-xl font-bold text-light-text dark:text-dark-text flex items-center gap-2">
                           <span className="material-symbols-outlined text-yellow-500">emoji_events</span>
                           Achievement Gallery
                       </h2>
                   </div>
                   
                   <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                       {badges.map(badge => (
                           <BadgeItem key={badge.id} badge={badge} />
                       ))}
                   </div>
                   
                    {unlockedCount < badges.length && (
                       <Card className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-none mt-8">
                           <div className="flex items-start gap-4">
                               <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                                   <span className="material-symbols-outlined text-3xl">lightbulb</span>
                               </div>
                               <div>
                                   <h3 className="text-lg font-bold">Level Up Your Finances</h3>
                                   <p className="text-white/80 text-sm mt-1 mb-3">
                                       Check the locked badges above to see what financial milestones you can target next!
                                   </p>
                               </div>
                           </div>
                       </Card>
                    )}
              </div>
          )}
      </div>
    </div>
  );
};

export default Challenges;
