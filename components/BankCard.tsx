import React from 'react';
import { formatCurrency } from '../utils';
import { Currency } from '../types';

interface BankCardProps {
  name: string;
  balance: number;
  currency: Currency;
  last4?: string;
  type?: string;
  institution?: string;
  color?: 'primary' | 'neutral' | 'indigo' | 'rose' | 'emerald' | 'amber' | 'slate' | string;
  className?: string;
}

const BankCard: React.FC<BankCardProps> = ({
  name,
  balance,
  currency,
  last4,
  type = 'Debit',
  institution,
  color = 'neutral',
  className = ''
}) => {
  const colorSchemes = {
    primary: 'from-primary-500 to-primary-700',
    neutral: 'from-neutral-800 to-neutral-950',
    indigo: 'from-indigo-500 to-indigo-700',
    violet: 'from-violet-600 to-violet-800',
    rose: 'from-rose-500 to-rose-700',
    emerald: 'from-emerald-500 to-emerald-700',
    amber: 'from-amber-500 to-amber-700',
    slate: 'from-slate-700 to-slate-900',
    sky: 'from-sky-500 to-sky-700',
    cyan: 'from-cyan-500 to-cyan-700',
  };

  const bgGradient = colorSchemes[color] || colorSchemes.neutral;

  return (
    <div className={`relative group w-full max-w-[340px] ${className}`}>
      {/* Shadow layer */}
      <div className={`absolute -inset-1 bg-gradient-to-r ${bgGradient} rounded-[2rem] blur opacity-20 group-hover:opacity-30 transition duration-500`}></div>
      
      {/* The Card Body - Fixed Aspect Ratio 1.586:1 */}
      <div className={`relative aspect-[1.586/1] w-full rounded-[1.8rem] bg-gradient-to-br ${bgGradient} overflow-hidden shadow-2xl p-6 sm:p-7 flex flex-col justify-between border border-white/10 ring-1 ring-white/5`}>
        {/* Abstract Background Design */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/20 rounded-full -ml-16 -mb-16 blur-3xl"></div>
        
        {/* Glassmorphism Refraction Effect */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-transparent opacity-30 pointer-events-none"></div>

        {/* Top Section */}
        <div className="flex justify-between items-start relative z-10">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-white/50 uppercase tracking-[0.2em] mb-1">{institution || 'Crystal Premium'}</span>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tighter leading-tight truncate max-w-[180px]">
              {name}
            </h2>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center backdrop-blur-md">
            <span className="material-symbols-outlined text-white/60 text-xl font-light">contactless</span>
          </div>
        </div>

        {/* Balance Section */}
        <div className="relative z-10 flex flex-col gap-0.5">
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-none mb-1">Available Funds</p>
          <p className="text-2xl sm:text-3xl font-black text-white tracking-tighter tabular-nums drop-shadow-sm">
            {formatCurrency(balance, currency)}
          </p>
        </div>

        {/* Bottom Section */}
        <div className="flex justify-between items-end relative z-10">
          <div className="flex items-center gap-3">
             <div className="w-10 h-7 bg-white/15 rounded-md border border-white/20 relative overflow-hidden backdrop-blur-md flex items-center justify-center shadow-inner">
                 <div className="w-4 h-3 bg-white/20 rounded-[1px] shadow-sm"></div>
             </div>
             <div className="flex flex-col">
                <p className="font-mono text-xs tracking-[0.2em] text-white/90 drop-shadow-sm">•••• {last4 || '4242'}</p>
                <p className="text-[8px] font-black text-white/40 uppercase tracking-[0.1em] mt-0.5">{type}</p>
             </div>
          </div>
          
          <div className="flex items-center gap-1 opacity-80 scale-90">
             <div className="flex -space-x-1.5">
               <div className="w-6 h-6 rounded-full bg-rose-500/90 mix-blend-screen"></div>
               <div className="w-6 h-6 rounded-full bg-amber-500/90 mix-blend-screen"></div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BankCard;
