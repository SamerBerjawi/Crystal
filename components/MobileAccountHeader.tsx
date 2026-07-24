import React from 'react';
import { Account } from '../types';
import { ACCOUNT_TYPE_STYLES } from '../constants';

interface MobileAccountHeaderProps {
  account: Account;
  onBack: () => void;
  formattedBalance: string;
  badgeText?: string;
  subText?: string;
  primaryAction?: { label: string; icon: string; onClick: () => void };
  secondaryAction?: { label: string; icon: string; onClick: () => void };
  syncAction?: { label: string; icon: string; onClick: () => void };
  valuationAction?: { label: string; icon: string; onClick: () => void };
}

export const MobileAccountHeader: React.FC<MobileAccountHeaderProps> = ({
  account,
  onBack,
  formattedBalance,
  badgeText,
  subText,
  primaryAction,
  secondaryAction,
  syncAction,
  valuationAction,
}) => {
  const typeConfig = ACCOUNT_TYPE_STYLES[account.type] || {
    icon: 'account_balance_wallet',
    color: 'bg-primary-500/10 text-primary-500',
  };

  return (
    <div className="space-y-4 pb-2 md:hidden">
      {/* 1. iOS Top Navigation Bar */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white/80 dark:bg-dark-card/80 border border-black/5 dark:border-white/10 text-light-text dark:text-white text-xs font-extrabold active:scale-95 transition-all min-h-[44px]"
          aria-label="Back to Accounts"
        >
          <span className="material-symbols-outlined text-base">chevron_left</span>
          <span>Accounts</span>
        </button>

        <div className="flex items-center gap-2">
          {syncAction && (
            <button
              onClick={syncAction.onClick}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl bg-white/80 dark:bg-dark-card/80 border border-black/5 dark:border-white/10 text-light-text dark:text-white flex items-center justify-center active:scale-95 transition-all shadow-sm"
              aria-label={syncAction.label}
              title={syncAction.label}
            >
              <span className="material-symbols-outlined text-lg">{syncAction.icon}</span>
            </button>
          )}

          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl bg-white/80 dark:bg-dark-card/80 border border-black/5 dark:border-white/10 text-light-text dark:text-white flex items-center justify-center active:scale-95 transition-all shadow-sm"
              aria-label={secondaryAction.label}
              title={secondaryAction.label}
            >
              <span className="material-symbols-outlined text-lg">{secondaryAction.icon}</span>
            </button>
          )}

          {valuationAction && (
            <button
              onClick={valuationAction.onClick}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl bg-white/80 dark:bg-dark-card/80 border border-black/5 dark:border-white/10 text-light-text dark:text-white flex items-center justify-center active:scale-95 transition-all shadow-sm"
              aria-label={valuationAction.label}
              title={valuationAction.label}
            >
              <span className="material-symbols-outlined text-lg">{valuationAction.icon}</span>
            </button>
          )}

          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl bg-primary-500 text-white shadow-lg shadow-primary-500/30 flex items-center justify-center active:scale-95 transition-all"
              aria-label={primaryAction.label}
              title={primaryAction.label}
            >
              <span className="material-symbols-outlined text-xl">{primaryAction.icon}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. SwiftUI Account Hero Balance Card */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 dark:from-slate-950 dark:via-indigo-950 dark:to-slate-950 p-6 text-white shadow-xl border border-white/10">
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-primary-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${typeConfig.color}`}>
                <span className="material-symbols-outlined text-lg">{typeConfig.icon}</span>
              </div>
              <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider">
                {badgeText || account.type}
              </span>
            </div>

            <span className="bg-white/10 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[10px] font-extrabold text-white border border-white/10">
              {account.currency}
            </span>
          </div>

          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight leading-tight">
              {account.name}
            </h1>
            <p className="text-[11px] font-semibold text-white/60 mt-0.5">
              {subText || `${account.type}${account.subType ? ` • ${account.subType}` : ''}`}
            </p>
          </div>

          <div className="pt-2 border-t border-white/10 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                Current Balance
              </p>
              <p className="text-2xl font-black text-white tracking-tight privacy-blur mt-0.5">
                {formattedBalance}
              </p>
            </div>

            {primaryAction && (
              <button
                onClick={primaryAction.onClick}
                className="px-3 py-2 rounded-xl bg-primary-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all min-h-[44px]"
              >
                <span className="material-symbols-outlined text-base">{primaryAction.icon}</span>
                <span>{primaryAction.label}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
