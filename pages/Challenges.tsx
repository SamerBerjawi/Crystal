
import React, { useMemo, useState, useEffect } from 'react';
import Card from '../components/Card';
import { UserStats, Account, Transaction, FinancialGoal, Currency, Category, Prediction, PredictionType, InvestmentTransaction, Warrant } from '../types';
import { calculateAccountTotals, convertToEur, parseLocalDate, formatCurrency, generateAmortizationSchedule, toLocalISOString } from '../utils';
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
    // Map abstract colors to concrete Tailwind classes for gradients and shadows
    const colorStyles: Record<string, { bg: string; text: string; border: string; shadow: string; iconBg: string }> = {
        blue: { bg: 'from-blue-500/10 to-blue-500/5', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800', shadow: 'shadow-blue-500/20', iconBg: 'bg-gradient-to-br from-blue-400 to-blue-600' },
        purple: { bg: 'from-purple-500/10 to-purple-500/5', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800', shadow: 'shadow-purple-500/20', iconBg: 'bg-gradient-to-br from-purple-400 to-purple-600' },
        amber: { bg: 'from-amber-500/10 to-amber-500/5', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800', shadow: 'shadow-amber-500/20', iconBg: 'bg-gradient-to-br from-amber-400 to-amber-600' },
        teal: { bg: 'from-teal-500/10 to-teal-500/5', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-800', shadow: 'shadow-teal-500/20', iconBg: 'bg-gradient-to-br from-teal-400 to-teal-600' },
        pink: { bg: 'from-pink-500/10 to-pink-500/5', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-800', shadow: 'shadow-pink-500/20', iconBg: 'bg-gradient-to-br from-pink-400 to-pink-600' },
        emerald: { bg: 'from-emerald-500/10 to-emerald-500/5', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800', shadow: 'shadow-emerald-500/20', iconBg: 'bg-gradient-to-br from-emerald-400 to-emerald-600' },
        cyan: { bg: 'from-cyan-500/10 to-cyan-500/5', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-800', shadow: 'shadow-cyan-500/20', iconBg: 'bg-gradient-to-br from-cyan-400 to-cyan-600' },
        green: { bg: 'from-green-500/10 to-green-500/5', text: 'text-green-600 dark:text-green-400', border: 'border-green-200 dark:border-green-800', shadow: 'shadow-green-500/20', iconBg: 'bg-gradient-to-br from-green-400 to-green-600' },
        orange: { bg: 'from-orange-500/10 to-orange-500/5', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800', shadow: 'shadow-orange-500/20', iconBg: 'bg-gradient-to-br from-orange-400 to-orange-600' },
        indigo: { bg: 'from-indigo-500/10 to-indigo-500/5', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800', shadow: 'shadow-indigo-500/20', iconBg: 'bg-gradient-to-br from-indigo-400 to-indigo-600' },
        slate: { bg: 'from-slate-500/10 to-slate-500/5', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-800', shadow: 'shadow-slate-500/20', iconBg: 'bg-gradient-to-br from-slate-400 to-slate-600' },
        red: { bg: 'from-red-500/10 to-red-500/5', text: 'text-red-600 dark:text-red-400', border: 'border-red-200 dark:border-red-800', shadow: 'shadow-red-500/20', iconBg: 'bg-gradient-to-br from-red-400 to-red-600' },
        yellow: { bg: 'from-yellow-500/10 to-yellow-500/5', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-200 dark:border-yellow-800', shadow: 'shadow-yellow-500/20', iconBg: 'bg-gradient-to-br from-yellow-400 to-yellow-600' },
        violet: { bg: 'from-violet-500/10 to-violet-500/5', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-800', shadow: 'shadow-violet-500/20', iconBg: 'bg-gradient-to-br from-violet-400 to-violet-600' },
    };

    const styles = colorStyles[badge.color] || colorStyles.blue; // Fallback

    if (badge.unlocked) {
        return (
            <div className={`group relative flex flex-col items-center p-5 rounded-3xl border ${styles.border} bg-white dark:bg-dark-card shadow-lg ${styles.shadow} transition-all duration-300 hover:-translate-y-1 overflow-hidden`}>
                {/* Background Glow */}
                <div className={`absolute inset-0 bg-gradient-to-b ${styles.bg} opacity-50`}></div>
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-white/20 dark:bg-white/5 rounded-full blur-2xl"></div>

                {/* Icon Medal */}
                <div className={`relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${styles.iconBg} text-white shadow-md transform transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                    <span className="material-symbols-outlined text-3xl drop-shadow-md">{badge.icon}</span>
                    <div className="absolute -bottom-2 -right-2 bg-white dark:bg-dark-card rounded-full p-1 shadow-sm">
                         <div className="bg-green-500 rounded-full w-5 h-5 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[12px] font-bold text-white">check</span>
                         </div>
                    </div>
                </div>

                {/* Text */}
                <div className="relative z-10 text-center flex-grow">
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-1 leading-tight">{badge.title}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug line-clamp-2">{badge.description}</p>
                </div>
                
                {/* Completed Bar */}
                <div className="relative z-10 w-full mt-4">
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-black/20 rounded-full overflow-hidden">
                        <div className={`h-full ${styles.iconBg} w-full`}></div>
                    </div>
                     <p className={`text-[9px] font-bold uppercase tracking-wider text-center mt-1.5 ${styles.text}`}>Completed</p>
                </div>
            </div>
        );
    }

    // Locked State
    return (
        <div className="group relative flex flex-col items-center p-5 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-white/[0.02] transition-all duration-300 hover:bg-gray-100 dark:hover:bg-white/[0.05]">
             {/* Locked Icon */}
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 shadow-inner">
                <span className="material-symbols-outlined text-3xl">{badge.icon}</span>
                 <div className="absolute inset-0 flex items-center justify-center bg-black/5 dark:bg-black/20 rounded-2xl backdrop-blur-[1px]">
                     <span className="material-symbols-outlined text-2xl text-gray-500 dark:text-gray-400 drop-shadow-sm">lock</span>
                 </div>
            </div>

            <div className="text-center flex-grow opacity-60 group-hover:opacity-100 transition-opacity">
                <h4 className="font-bold text-sm text-gray-600 dark:text-gray-400 mb-1">{badge.title}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-500 leading-snug line-clamp-2">{badge.description}</p>
            </div>

            {/* Progress Bar */}
             <div className="w-full mt-4 opacity-50 group-hover:opacity-80 transition-opacity">
                 <div className="flex justify-between text-[9px] font-bold text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wide">
                    <span>Locked</span>
                    <span>{Math.round(badge.progress)}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div 
                        className="h-full rounded-full bg-gray-400 dark:bg-gray-600 transition-all duration-500" 
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
    
    const { ath, isNewRecord, data } = useMemo(() => {
        let max = 0;
        if (history.length > 0) {
            max = history.reduce((prev, current) => (prev.value > current.value) ? prev : current).value;
        }
        
        // If current is higher (or equal and significant), it's the ATH
        const allTimeHigh = Math.max(max, currentNetWorth);
        const isNewRecord = currentNetWorth >= allTimeHigh && currentNetWorth > 0;
        
        // Benchmarks
        let lastYearValue = 0;
        let lastYearDate = '12 Months Ago';
        
        if (history.length >= 13) {
             const ly = history[12]; 
             lastYearValue = ly.value;
             lastYearDate = ly.date;
        } else if (history.length > 0) {
             const oldest = history[history.length - 1];
             lastYearValue = oldest.value;
             lastYearDate = oldest.date;
        }

        const entries = [
            { label: 'All-Time High', value: allTimeHigh, date: isNewRecord ? 'Right Now!' : 'Previous Best', isAth: true },
            { label: 'Current Status', value: currentNetWorth, date: 'Today', isCurrent: true },
            { label: '1 Year Ago', value: lastYearValue, date: lastYearDate, isBenchmark: true }
        ];

        // Filter duplicates if ATH is Current
        const uniqueEntries = isNewRecord 
            ? [entries[0], entries[2]] 
            : entries;

        return { ath: allTimeHigh, isNewRecord, data: uniqueEntries };
    }, [currentNetWorth, history]);

    return (
        <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-xl">
             {/* Header Background */}
             <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-blue-900 to-blue-950 dark:from-black dark:to-gray-900 z-0">
                 <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
             </div>

             <div className="relative z-10 p-6 sm:p-8">
                 <div className="flex justify-between items-start mb-8 text-white">
                     <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                            <span className="material-symbols-outlined text-yellow-400 text-3xl">emoji_events</span>
                            Hall of Fame
                        </h2>
                        <p className="text-blue-200 dark:text-gray-400 text-sm font-medium mt-1">Your personal wealth records</p>
                     </div>
                     {isNewRecord && (
                         <div className="animate-bounce bg-yellow-400 text-black px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg transform rotate-3">
                             New Record!
                         </div>
                     )}
                 </div>

                 {/* Main ATH Display */}
                 <div className="bg-white dark:bg-[#1E1E20] rounded-2xl p-6 shadow-lg border border-black/5 dark:border-white/10 mb-2 relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                         <span className="material-symbols-outlined text-8xl">military_tech</span>
                     </div>
                     
                     <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">All-Time High Net Worth</p>
                     <h3 className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white tracking-tight">
                         {formatCurrency(ath, 'EUR')}
                     </h3>
                     
                     {/* Progress to ATH (if not there) */}
                     {!isNewRecord && (
                         <div className="mt-4">
                             <div className="flex justify-between text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                                 <span>Current Progress</span>
                                 <span>{((currentNetWorth / ath) * 100).toFixed(1)}%</span>
                             </div>
                             <div className="w-full h-3 bg-gray-100 dark:bg-black/40 rounded-full overflow-hidden">
                                 <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(currentNetWorth / ath) * 100}%` }}></div>
                             </div>
                             <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium text-right">
                                 {formatCurrency(ath - currentNetWorth, 'EUR')} to go
                             </p>
                         </div>
                     )}
                 </div>

                 {/* Leaderboard List */}
                 <div className="divide-y divide-gray-100 dark:divide-white/5">
                     {data.map((entry, idx) => (
                         <div key={idx} className="flex items-center justify-between py-4 px-2">
                             <div className="flex items-center gap-4">
                                 <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 ${
                                     entry.isAth 
                                        ? 'bg-yellow-100 border-yellow-400 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' 
                                        : entry.isCurrent 
                                            ? 'bg-gray-100 border-gray-300 text-gray-600 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300'
                                            : 'bg-orange-100 border-orange-300 text-orange-700 dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-400'
                                 }`}>
                                     {idx + 1}
                                 </div>
                                 <div>
                                     <p className={`font-bold text-sm ${entry.isAth ? 'text-yellow-700 dark:text-yellow-400' : 'text-light-text dark:text-dark-text'}`}>{entry.label}</p>
                                     <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{entry.date}</p>
                                 </div>
                             </div>
                             <p className="font-mono font-bold text-light-text dark:text-dark-text">{formatCurrency(entry.value, 'EUR')}</p>
                         </div>
                     ))}
                 </div>
             </div>
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
    const isOverBudget = spent > budget;

    // Define styles based on level
    const levelStyles = [
        { bg: 'bg-gray-100 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700', text: 'text-gray-500', shadow: '' }, // Lvl 0
        { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-600', shadow: 'shadow-blue-500/10' }, // Lvl 1
        { bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-200 dark:border-indigo-800', text: 'text-indigo-600', shadow: 'shadow-indigo-500/20' }, // Lvl 2
        { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-600', shadow: 'shadow-amber-500/20' }, // Lvl 3
        { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-600', shadow: 'shadow-purple-500/20' }, // Lvl 4
    ];

    const style = levelStyles[level] || levelStyles[0];
    const ringColor = isOverBudget ? '#ef4444' : categoryColor;

    return (
        <div className={`relative overflow-hidden rounded-3xl p-6 border ${style.border} ${style.bg} ${style.shadow} transition-all duration-500 hover:scale-[1.02] hover:shadow-lg group flex flex-col items-center`}>
            {/* Background Glow */}
            <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-white/40 to-transparent dark:from-white/5 pointer-events-none"></div>
            
            {/* Level Badge */}
            <div className={`absolute top-4 right-4 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-white/50 dark:bg-black/20 border border-black/5 dark:border-white/10 backdrop-blur-md ${style.text}`}>
                Lvl {level}
            </div>

            {/* Icon Circle with Progress Ring */}
            <div className="relative w-24 h-24 mb-4 flex items-center justify-center">
                 {/* SVG Progress Ring */}
                 <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                    {/* Background Circle */}
                    <path
                        className="text-gray-200 dark:text-gray-700"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                    />
                    {/* Foreground Circle */}
                    <path
                        stroke={ringColor}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        strokeDasharray={`${ratio}, 100`}
                        strokeWidth="3"
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                    />
                </svg>
                
                {/* Icon */}
                <div className="w-16 h-16 rounded-full bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center relative z-10">
                    <span className="material-symbols-outlined text-3xl" style={{ color: categoryColor }}>{icon}</span>
                </div>

                {isMaster && (
                    <div className="absolute -bottom-2 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm z-20 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[10px]">stars</span> MAX
                    </div>
                )}
            </div>

            {/* Title & Stats */}
            <h3 className="font-bold text-lg text-light-text dark:text-dark-text mb-1 text-center">{categoryName}</h3>
            <p className={`text-xs font-bold uppercase tracking-wider mb-4 ${style.text}`}>{title}</p>
            
            <div className="w-full bg-white/50 dark:bg-black/20 rounded-xl p-3 flex justify-between items-center text-sm">
                <div className="text-left">
                    <span className="block text-[10px] text-light-text-secondary dark:text-dark-text-secondary uppercase">Spent</span>
                    <span className={`font-mono font-bold ${isOverBudget ? 'text-red-500' : 'text-light-text dark:text-dark-text'}`}>{formatCurrency(spent, 'EUR')}</span>
                </div>
                <div className="h-8 w-px bg-black/5 dark:bg-white/10 mx-2"></div>
                <div className="text-right">
                     <span className="block text-[10px] text-light-text-secondary dark:text-dark-text-secondary uppercase">Limit</span>
                    <span className="font-mono font-medium text-light-text-secondary dark:text-dark-text-secondary">{formatCurrency(budget, 'EUR')}</span>
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
    { id: 'coffee_break', title: 'The Coffee Break', description: 'Spend < €15 on coffee for a week.', durationDays: 7, targetType: 'category', targetCategory: 'cafe', limitAmount: 15, icon: 'coffee', color: 'amber' },
    { id: 'dining_detox', title: 'Dining Detox', description: 'Zero spending on Restaurants for 7 days.', durationDays: 7, targetType: 'category', targetCategory: 'dining', limitAmount: 0, icon: 'restaurant_menu', color: 'orange' },
    { id: 'grocery_gauntlet', title: 'Grocery Gauntlet', description: 'Keep grocery spending under €50 for a week.', durationDays: 7, targetType: 'category', targetCategory: 'supermarket', limitAmount: 50, icon: 'shopping_cart', color: 'green' },
    { id: 'transport_trim', title: 'Transport Trim', description: 'Spend < €20 on Fuel/Transit for a week.', durationDays: 7, targetType: 'category', targetCategory: 'transport', limitAmount: 20, icon: 'directions_bus', color: 'blue' },
    { id: 'entertainment_fast', title: 'Entertainment Fast', description: 'No spending on movies/games for 2 weeks.', durationDays: 14, targetType: 'category', targetCategory: 'entertainment', limitAmount: 0, icon: 'theaters', color: 'purple' },
    { id: 'shopping_ban', title: 'Shopping Ban', description: '30 days without buying clothes/gadgets.', durationDays: 30, targetType: 'category', targetCategory: 'shopping', limitAmount: 0, icon: 'shopping_bag', color: 'pink' },
    { id: 'low_cost_living', title: 'Low Cost Living', description: 'Total expenses < €200 for a week.', durationDays: 7, targetType: 'global', limitAmount: 200, icon: 'account_balance_wallet', color: 'teal' },
    { id: 'ten_euro_challenge', title: 'The €10 Challenge', description: 'Survive 3 days spending less than €10 total.', durationDays: 3, targetType: 'global', limitAmount: 10, icon: 'euro', color: 'red' },
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

  const analyticsAccounts = useMemo(() => accounts.filter(acc => acc.includeInAnalytics ?? true), [accounts]);
  const analyticsAccountIds = useMemo(() => new Set(analyticsAccounts.map(acc => acc.id)), [analyticsAccounts]);
  const analyticsTransactions = useMemo(
    () => transactions.filter(tx => analyticsAccountIds.has(tx.accountId)),
    [transactions, analyticsAccountIds]
  );

  // --- Historical Net Worth ---
  const netWorthHistory = useMemo(() => {
        const { netWorth: currentNetWorth } = calculateAccountTotals(analyticsAccounts.filter(a => a.status !== 'closed'), analyticsTransactions);
        const monthlyChanges = new Map<string, number>();
        const today = new Date();

        analyticsTransactions.forEach(tx => {
            const date = parseLocalDate(tx.date);
            if (date > today) return;
            if (tx.transferId) return;
            const monthKey = toLocalISOString(date).slice(0, 7);
            const val = convertToEur(tx.amount, tx.currency);
            monthlyChanges.set(monthKey, (monthlyChanges.get(monthKey) || 0) + val);
        });

        const history: { date: string; value: number }[] = [];
        let runningBalance = currentNetWorth;
        
        for (let i = 0; i < 60; i++) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            if (i > 0) {
                const prevD = new Date(today.getFullYear(), today.getMonth() - (i - 1), 1);
                const prevMonthKey = toLocalISOString(prevD).slice(0, 7);
                const changeInPrevMonth = monthlyChanges.get(prevMonthKey) || 0;
                runningBalance -= changeInPrevMonth;
            }
            history.push({ 
                date: d.toLocaleDateString('default', { month: 'long', year: 'numeric' }), 
                value: runningBalance 
            });
        }
        return { currentNetWorth, history };
  }, [analyticsAccounts, analyticsTransactions]);

  // --- Prediction Resolver (Effect) ---
  useEffect(() => {
    const todayDate = parseLocalDate(toLocalISOString(new Date()));
    
    predictions.forEach(prediction => {
        if (prediction.status === 'active') {
            const endDate = parseLocalDate(prediction.endDate);
            if (endDate < todayDate) {
                let actualAmount = 0;
                let won = false;

                if (prediction.type === 'spending_cap') {
                    const start = parseLocalDate(prediction.startDate);
                    const end = parseLocalDate(prediction.endDate);
                    end.setHours(23, 59, 59);

                    actualAmount = transactions
                        .filter(tx => {
                            const d = parseLocalDate(tx.date);
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
     const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
     let income = 0; let expense = 0;
     const spendingByCat: Record<string, number> = {};

    analyticsTransactions.forEach(tx => {
        const d = parseLocalDate(tx.date);
        if (d >= startOfMonth && !tx.transferId) {
            const val = convertToEur(tx.amount, tx.currency);
            if (tx.type === 'income') income += val;
            else {
                expense += Math.abs(val);
                
                let catName = tx.category;
                const parentMatch = expenseCategories.find(p => p.subCategories.some(s => s.name === tx.category));
                if (parentMatch) {
                    catName = parentMatch.name;
                }
                spendingByCat[catName] = (spendingByCat[catName] || 0) + Math.abs(val);
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
     
     const totalInvestments = analyticsAccounts.filter(a => a.type === 'Investment').reduce((sum, a) => sum + convertToEur(a.balance, a.currency), 0);
     const uniqueAccountTypes = new Set(analyticsAccounts.map(a => a.type)).size;

     const threeMonthsAgo = new Date(); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
     const totalSpend3m = analyticsTransactions.filter(t => parseLocalDate(t.date) >= threeMonthsAgo && t.type === 'expense' && !t.transferId).reduce((sum, t) => sum + Math.abs(convertToEur(t.amount, t.currency)), 0);
     const avgMonthlySpend = totalSpend3m / 3;
     const liquidAssets = analyticsAccounts.filter(a => LIQUID_ACCOUNT_TYPES.includes(a.type)).reduce((sum, a) => sum + convertToEur(a.balance, a.currency), 0);
     const liquidityRatio = avgMonthlySpend > 0 ? liquidAssets / avgMonthlySpend : 0;

     return { totalDebt, netWorth, savingsRate, totalInvestments, uniqueAccountTypes, liquidityRatio, budgetAccuracy, spendingByCat, creditUtilization };
  }, [analyticsAccounts, analyticsTransactions, budgets, expenseCategories]);

  // --- Bosses ---
  const bosses = useMemo(() => {
      const activeBosses: Boss[] = [];
      analyticsAccounts.filter(a => DEBT_TYPES.includes(a.type) && a.status !== 'closed').forEach(acc => {
          let outstanding = Math.abs(acc.balance);
          let maxHp = acc.creditLimit || (acc.totalAmount || outstanding * 1.2);
          let paidPrincipal = 0; let paidInterest = 0;

          if (acc.type === 'Loan' && acc.principalAmount && acc.duration) {
             const schedule = generateAmortizationSchedule(acc, analyticsTransactions, loanPaymentOverrides[acc.id] || {});
             const totalCost = schedule.reduce((sum, p) => sum + p.principal + p.interest, 0);
             paidPrincipal = schedule.reduce((sum, p) => p.status === 'Paid' ? sum + p.principal : sum, 0);
             paidInterest = schedule.reduce((sum, p) => p.status === 'Paid' ? sum + p.interest : sum, 0);
             outstanding = Math.max(0, totalCost - (paidPrincipal + paidInterest));
             maxHp = totalCost;
          } else if (outstanding < 1) return;

          const recentPayments = analyticsTransactions.filter(t => t.accountId === acc.id && t.type === 'income').sort((a,b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime()).slice(0, 5).map(t => ({ date: t.date, amount: t.amount }));

          activeBosses.push({ id: acc.id, name: acc.name, type: 'debt', maxHp: Math.max(maxHp, outstanding), currentHp: outstanding, level: Math.floor(maxHp / 1000) + 1, icon: acc.type === 'Loan' ? 'gavel' : 'sentiment_very_dissatisfied', hits: recentPayments, paidPrincipal, paidInterest });
      });

      financialGoals.forEach(goal => {
          if (goal.currentAmount >= goal.amount) return; 
          activeBosses.push({ id: goal.id, name: goal.name, type: 'savings', maxHp: goal.amount, currentHp: goal.amount - goal.currentAmount, level: Math.floor(goal.amount / 500) + 1, icon: 'shield', hits: [] });
      });
      return activeBosses;
  }, [analyticsAccounts, financialGoals, analyticsTransactions, loanPaymentOverrides]);

  const debtBosses = useMemo(() => bosses.filter(b => b.type === 'debt'), [bosses]);
  const savingsBosses = useMemo(() => bosses.filter(b => b.type === 'savings'), [bosses]);

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
      const hasOverdueBills = billsAndPayments.some(b => b.status === 'unpaid' && parseLocalDate(b.dueDate) < today);
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
  const handleStartSprint = (sprintId: string) => { if (activeSprints.some(s => s.id === sprintId)) return; setActiveSprints([...activeSprints, { id: sprintId, startDate: toLocalISOString(new Date()) }]); };
  const handleAbandonSprint = (sprintId: string) => setActiveSprints(activeSprints.filter(s => s.id !== sprintId));
  
  const processedSprints = useMemo(() => {
      const now = new Date();
      return activeSprints.map(active => {
          const def = SAVINGS_SPRINTS.find(s => s.id === active.id);
          if (!def) return null;
          const start = parseLocalDate(active.startDate);
          const end = new Date(start); end.setDate(end.getDate() + def.durationDays);
          const elapsed = now.getTime() - start.getTime();
          const daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          const timeProgress = Math.min(100, Math.max(0, (elapsed / (def.durationDays * 86400000)) * 100));
          
          let currentSpend = 0;
          transactions.forEach(tx => {
              const d = parseLocalDate(tx.date);
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
      const clampScore = (score: number, max: number) => Math.min(max, Math.max(0, score));
      const healthScoreDetails = [
          { id: 'savings', label: 'Savings Rate', score: clampScore(savingsRate * 100 * 1.5, 30), max: 30, value: `${(savingsRate * 100).toFixed(1)}%`, icon: 'savings', color: 'emerald' },
          { id: 'liquidity', label: 'Liquidity', score: clampScore(liquidityRatio * 10, 30), max: 30, value: `${liquidityRatio.toFixed(1)}mo`, icon: 'water_drop', color: 'blue' },
          { id: 'debt', label: 'Debt Mgmt', score: clampScore(totalDebt === 0 ? 20 : 20 - (Math.abs(totalDebt) / 1000), 20), max: 20, value: formatCurrency(totalDebt, 'EUR'), icon: 'credit_card', color: 'rose' },
          { id: 'diversity', label: 'Asset Mix', score: clampScore(uniqueAccountTypes * 5, 20), max: 20, value: `${uniqueAccountTypes} Types`, icon: 'category', color: 'purple' }
      ];
      const healthScore = clampScore(healthScoreDetails.reduce((sum, d) => sum + d.score, 0), 100);
      
      let rank = "Financial Novice";
      let rankColor = "text-gray-500";
      if (healthScore >= 90) { rank = "Wealth Tycoon"; rankColor = "text-purple-500"; }
      else if (healthScore >= 75) { rank = "Money Master"; rankColor = "text-emerald-500"; }
      else if (healthScore >= 50) { rank = "Wealth Builder"; rankColor = "text-blue-500"; }
      else if (healthScore >= 30) { rank = "Budget Conscious"; rankColor = "text-amber-500"; }

      return (
          <div className="space-y-6 animate-fade-in-up">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Main Score Card */}
                  <Card className="md:col-span-2 relative overflow-hidden bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-md flex flex-col sm:flex-row items-center sm:items-start gap-8 p-8">
                      <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                           <span className="material-symbols-outlined text-9xl">health_and_safety</span>
                      </div>
                      
                      <div className="relative z-10 flex-shrink-0">
                          <CircularGauge value={healthScore} size="lg" />
                      </div>
                      
                      <div className="relative z-10 flex-grow text-center sm:text-left">
                          <h3 className="text-lg font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1">Financial Health Score</h3>
                          <h2 className={`text-4xl font-black ${rankColor} mb-2`}>{rank}</h2>
                          <p className="text-light-text dark:text-dark-text leading-relaxed max-w-md">
                              Your score is based on key financial pillars including savings rate, liquidity runway, debt management, and portfolio diversity.
                          </p>
                      </div>
                  </Card>

                  {/* Streak Card */}
                  <Card className="bg-gradient-to-br from-orange-500 to-amber-600 text-white border-none shadow-lg relative overflow-hidden flex flex-col justify-between p-6">
                      <div className="absolute -right-4 -top-4 opacity-20">
                          <span className="material-symbols-outlined text-9xl">local_fire_department</span>
                      </div>
                      <div className="relative z-10">
                          <p className="font-bold text-orange-100 uppercase tracking-wider text-xs mb-1">Login Streak</p>
                          <div className="flex items-baseline gap-2">
                             <h3 className="text-5xl font-black">{currentStreak}</h3>
                             <span className="text-xl font-bold opacity-80">Days</span>
                          </div>
                      </div>
                      <div className="relative z-10 mt-4 pt-4 border-t border-white/20">
                          <div className="flex justify-between items-center text-sm font-medium">
                              <span>Best Streak</span>
                              <span>{longestStreak} Days</span>
                          </div>
                      </div>
                  </Card>
              </div>

              {/* Factors Grid */}
              <div>
                  <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-4 px-1">Score Factors</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {healthScoreDetails.map(factor => (
                          <div key={factor.id} className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex justify-between items-start mb-3">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${factor.color}-100 dark:bg-${factor.color}-900/30 text-${factor.color}-600 dark:text-${factor.color}-400`}>
                                      <span className="material-symbols-outlined text-xl">{factor.icon}</span>
                                  </div>
                                  <span className="text-lg font-bold text-light-text dark:text-dark-text">{factor.score.toFixed(0)}<span className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-normal">/{factor.max}</span></span>
                              </div>
                              
                              <h4 className="font-bold text-light-text dark:text-dark-text mb-1">{factor.label}</h4>
                              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-3">Current: <span className="font-mono">{factor.value}</span></p>
                              
                              <div className="w-full h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                                  <div 
                                      className={`h-full rounded-full bg-${factor.color}-500 transition-all duration-1000`} 
                                      style={{ width: `${(factor.score / factor.max) * 100}%` }}
                                  ></div>
                              </div>
                          </div>
                      ))}
                  </div>
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
              <div className="space-y-12 animate-fade-in-up">
                  {debtBosses.length > 0 && (
                      <div>
                          <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
                              <span className="material-symbols-outlined">swords</span>
                              Debt Nemeses
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {debtBosses.map(boss => (
                                  <BossBattleCard key={boss.id} boss={boss} currency="EUR" />
                              ))}
                          </div>
                      </div>
                  )}

                  {savingsBosses.length > 0 && (
                      <div>
                           <h3 className="text-lg font-bold text-amber-600 dark:text-amber-400 mb-4 flex items-center gap-2">
                              <span className="material-symbols-outlined">shield</span>
                              Savings Guardians
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {savingsBosses.map(boss => (
                                  <BossBattleCard key={boss.id} boss={boss} currency="EUR" />
                              ))}
                          </div>
                      </div>
                  )}

                  {debtBosses.length === 0 && savingsBosses.length === 0 && (
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
