import React, { useState } from 'react';
import { Account, Transaction, Warrant, Currency } from '../types';
import { formatCurrency, convertCurrency, convertToEur } from '../utils';
import { DEBT_TYPES, ASSET_TYPES, ACCOUNT_TYPE_STYLES } from '../constants';

interface MobileAccountsViewProps {
  accounts: Account[];
  transactions: Transaction[];
  globalMetrics: {
    totalAssets: number;
    totalDebt: number;
    netWorth: number;
    liquidCash: number;
  };
  segmentValues: {
    all: number;
    cash: number;
    invested: number;
    property: number;
    debt: number;
  };
  activeSegment: 'all' | 'cash' | 'invested' | 'property' | 'debt';
  setActiveSegment: (seg: 'all' | 'cash' | 'invested' | 'property' | 'debt') => void;
  filteredAccounts: Account[];
  closedAccounts: Account[];
  transactionsByAccount: Record<string, Transaction[]>;
  warrants: Warrant[];
  linkedEnableBankingAccountIds: Set<string>;
  onAccountClick: (id: string) => void;
  onEditClick: (account: Account) => void;
  onAdjustBalanceClick: (account: Account) => void;
  onAddAccountClick: () => void;
  preferredCurrency: string;
  conversionRates?: any;
  sortBy: 'name' | 'balance' | 'manual';
  setSortBy: (s: 'name' | 'balance' | 'manual') => void;
  splitAssetsLiabilities: boolean;
  setSplitAssetsLiabilities: (val: boolean) => void;
}

export const MobileAccountsView: React.FC<MobileAccountsViewProps> = ({
  accounts,
  transactions,
  globalMetrics,
  segmentValues,
  activeSegment,
  setActiveSegment,
  filteredAccounts,
  closedAccounts,
  transactionsByAccount,
  onAccountClick,
  onEditClick,
  onAdjustBalanceClick,
  onAddAccountClick,
  preferredCurrency,
  conversionRates,
  sortBy,
  setSortBy,
  splitAssetsLiabilities,
  setSplitAssetsLiabilities,
}) => {
  const [showClosed, setShowClosed] = useState(false);
  const [showControlsModal, setShowControlsModal] = useState(false);

  const netWorthFormatted = formatCurrency(
    convertCurrency(globalMetrics.netWorth, 'EUR', preferredCurrency as Currency, conversionRates),
    preferredCurrency as Currency
  );

  const assetsFormatted = formatCurrency(
    convertCurrency(globalMetrics.totalAssets, 'EUR', preferredCurrency as Currency, conversionRates),
    preferredCurrency as Currency
  );

  const debtFormatted = formatCurrency(
    convertCurrency(Math.abs(globalMetrics.totalDebt), 'EUR', preferredCurrency as Currency, conversionRates),
    preferredCurrency as Currency
  );

  // Group filtered accounts by type
  const assetAccounts = filteredAccounts.filter((a) => ASSET_TYPES.includes(a.type));
  const debtAccounts = filteredAccounts.filter((a) => DEBT_TYPES.includes(a.type));

  const segments = [
    { id: 'all', label: 'All', icon: 'dashboard' },
    { id: 'cash', label: 'Cash', icon: 'payments' },
    { id: 'invested', label: 'Invested', icon: 'trending_up' },
    { id: 'property', label: 'Assets', icon: 'home' },
    { id: 'debt', label: 'Liabilities', icon: 'credit_card' },
  ] as const;

  const renderAccountItem = (account: Account) => {
    const isDebt = DEBT_TYPES.includes(account.type);
    const balanceEur = convertToEur(account.balance, account.currency);
    const formattedBal = formatCurrency(
      convertCurrency(account.balance, account.currency, preferredCurrency as Currency, conversionRates),
      preferredCurrency as Currency
    );

    const typeConfig = ACCOUNT_TYPE_STYLES[account.type] || {
      icon: 'account_balance_wallet',
      color: 'bg-primary-500/10 text-primary-500',
    };

    const recentTxs = transactionsByAccount[account.id] || [];
    const lastTx = recentTxs[0];

    return (
      <div
        key={account.id}
        onClick={() => onAccountClick(account.id)}
        className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-md rounded-2xl p-3.5 border border-black/5 dark:border-white/10 shadow-sm hover:shadow-md transition-all active:scale-[0.99] flex items-center justify-between gap-3 min-h-[64px]"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-black/5 dark:border-white/10 ${typeConfig.color}`}
          >
            <span className="material-symbols-outlined text-xl">{typeConfig.icon}</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold text-light-text dark:text-white truncate">
                {account.name}
              </p>
              {account.isPrimary && (
                <span className="bg-primary-500/10 text-primary-600 dark:text-primary-400 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0">
                  Main
                </span>
              )}
            </div>

            <p className="text-[10px] font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-70 truncate mt-0.5">
              {account.type} {account.subType ? `• ${account.subType}` : ''}
              {lastTx ? ` • ${lastTx.date}` : ''}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p
            className={`text-xs font-extrabold privacy-blur ${
              isDebt
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-light-text dark:text-white'
            }`}
          >
            {formattedBal}
          </p>
          <span className="material-symbols-outlined text-light-text-secondary dark:text-dark-text-secondary text-sm opacity-40 mt-0.5">
            chevron_right
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 pb-20 animate-fade-in md:hidden">
      {/* 1. Header & Title */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70">
            Portfolio Overview
          </p>
          <h1 className="text-2xl font-extrabold text-light-text dark:text-white tracking-tight">
            Accounts
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowControlsModal(!showControlsModal)}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl bg-white/80 dark:bg-dark-card/80 border border-black/5 dark:border-white/10 shadow-sm flex items-center justify-center text-light-text dark:text-white active:scale-95 transition-all"
            aria-label="View Controls"
          >
            <span className="material-symbols-outlined text-xl">tune</span>
          </button>

          <button
            onClick={onAddAccountClick}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl bg-primary-500 text-white shadow-lg shadow-primary-500/30 flex items-center justify-center active:scale-95 transition-all"
            aria-label="Add Account"
          >
            <span className="material-symbols-outlined text-xl">add</span>
          </button>
        </div>
      </div>

      {/* 2. Hero Net Worth Card */}
      <div className="relative overflow-hidden rounded-[2.2rem] bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 dark:from-indigo-950 dark:via-purple-950 dark:to-slate-950 p-6 text-white shadow-xl border border-white/10">
        <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-primary-500/30 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between text-xs text-white/70 font-semibold uppercase tracking-wider">
            <span>Portfolio Net Worth</span>
            <span className="bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-bold text-white border border-white/10">
              {preferredCurrency}
            </span>
          </div>

          <div>
            <h2 className="text-3xl font-black tracking-tight text-white privacy-blur leading-none">
              {netWorthFormatted}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="bg-emerald-500/15 border border-emerald-500/20 px-3 py-2 rounded-xl text-emerald-400 text-xs font-bold truncate">
              <span className="text-[10px] opacity-75 block uppercase tracking-wider">
                Total Assets
              </span>
              <span className="privacy-blur text-sm">{assetsFormatted}</span>
            </div>

            <div className="bg-rose-500/15 border border-rose-500/20 px-3 py-2 rounded-xl text-rose-400 text-xs font-bold truncate">
              <span className="text-[10px] opacity-75 block uppercase tracking-wider">
                Total Liabilities
              </span>
              <span className="privacy-blur text-sm">{debtFormatted}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls Drawer / Modal if active */}
      {showControlsModal && (
        <div className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-xl p-4 rounded-2xl border border-black/5 dark:border-white/10 shadow-lg space-y-3 animate-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/10">
            <span className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
              View Settings
            </span>
            <button
              onClick={() => setShowControlsModal(false)}
              className="text-light-text-secondary dark:text-dark-text-secondary p-1 rounded-lg"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs font-semibold text-light-text dark:text-white">
              Split Assets & Liabilities
            </span>
            <button
              onClick={() => setSplitAssetsLiabilities(!splitAssetsLiabilities)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                splitAssetsLiabilities
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'bg-black/5 dark:bg-white/10 text-light-text dark:text-white'
              }`}
            >
              {splitAssetsLiabilities ? 'Split' : 'Combined'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs font-semibold text-light-text dark:text-white">Sort By</span>
            <div className="flex items-center gap-1 bg-black/5 dark:bg-white/10 p-1 rounded-xl">
              {(['manual', 'name', 'balance'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize transition-all ${
                    sortBy === s
                      ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'text-light-text-secondary dark:text-dark-text-secondary'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. SwiftUI Segmented Control (Picker) */}
      <div className="bg-black/5 dark:bg-white/10 p-1 rounded-2xl flex items-center overflow-x-auto no-scrollbar min-h-[48px]">
        {segments.map((seg) => {
          const isActive = activeSegment === seg.id;
          const val = segmentValues[seg.id as keyof typeof segmentValues];

          return (
            <button
              key={seg.id}
              onClick={() => setActiveSegment(seg.id as any)}
              className={`flex-1 min-w-[70px] min-h-[40px] rounded-xl text-[11px] font-bold flex flex-col items-center justify-center transition-all duration-200 active:scale-98 ${
                isActive
                  ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-light-text-secondary dark:text-dark-text-secondary'
              }`}
            >
              <span className="capitalize">{seg.label}</span>
              <span className="text-[9px] font-medium opacity-70 privacy-blur">
                {formatCurrency(val, preferredCurrency as Currency)}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4. Accounts Grouped Inset Sections */}
      {splitAssetsLiabilities ? (
        <div className="space-y-5">
          {/* Assets Section */}
          {assetAccounts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary-500 text-lg">
                    account_balance
                  </span>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-light-text dark:text-white">
                    Assets ({assetAccounts.length})
                  </h3>
                </div>
              </div>

              <div className="space-y-2">{assetAccounts.map(renderAccountItem)}</div>
            </div>
          )}

          {/* Debt Section */}
          {debtAccounts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-rose-500 text-lg">
                    money_off
                  </span>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-light-text dark:text-white">
                    Liabilities ({debtAccounts.length})
                  </h3>
                </div>
              </div>

              <div className="space-y-2">{debtAccounts.map(renderAccountItem)}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-light-text dark:text-white">
              Accounts ({filteredAccounts.length})
            </h3>
          </div>
          <div className="space-y-2">{filteredAccounts.map(renderAccountItem)}</div>
        </div>
      )}

      {/* 5. Closed Accounts Disclosure Group */}
      {closedAccounts.length > 0 && (
        <div className="pt-2 border-t border-black/5 dark:border-white/10">
          <button
            onClick={() => setShowClosed(!showClosed)}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-black/5 dark:bg-white/5 text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary"
          >
            <span>Closed Accounts ({closedAccounts.length})</span>
            <span className="material-symbols-outlined text-sm">
              {showClosed ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {showClosed && (
            <div className="space-y-2 mt-2 pl-1 opacity-75">
              {closedAccounts.map(renderAccountItem)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
