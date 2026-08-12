import React, { useState } from 'react';
import { Account, Transaction, Warrant, Currency } from '../types';
import { formatCurrency, convertCurrency, convertToEur } from '../utils';
import { DEBT_TYPES, ASSET_TYPES, ACCOUNT_TYPE_STYLES } from '../constants';
import Icon from './ui/Icon';
import SwipeableRow from './SwipeableRow';
import FloatingActionButton from './FloatingActionButton';

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
    { id: 'all', label: 'All', icon: 'layout_alt' },
    { id: 'cash', label: 'Cash', icon: 'wallet' },
    { id: 'invested', label: 'Invested', icon: 'candlestick_chart' },
    { id: 'property', label: 'Assets', icon: 'home' },
    { id: 'debt', label: 'Liabilities', icon: 'credit_card' },
  ] as const;

  const renderAccountItem = (account: Account) => {
    const isDebt = DEBT_TYPES.includes(account.type);
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
      <SwipeableRow
        key={account.id}
        leftActions={[
          {
            icon: 'tune',
            bgClass: 'bg-indigo-500',
            label: 'Adjust',
            onAction: () => onAdjustBalanceClick(account),
          },
        ]}
        rightActions={[
          {
            icon: 'edit',
            bgClass: 'bg-amber-500',
            label: 'Edit',
            onAction: () => onEditClick(account),
          },
        ]}
      >
        <div
          onClick={() => onAccountClick(account.id)}
          className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-md rounded-2xl p-3.5 border border-black/5 dark:border-white/10 shadow-sm hover:shadow-md transition-all active:scale-[0.99] flex items-center justify-between gap-3 min-h-[64px] touch-feedback cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-black/5 dark:border-white/10 ${typeConfig.color}`}
            >
              <Icon name={typeConfig.icon} className="text-xl" />
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
            <Icon name="chevron_right" className="text-light-text-secondary dark:text-dark-text-secondary text-sm opacity-40 mt-0.5" />
          </div>
        </div>
      </SwipeableRow>
    );
  };

  return (
    <div className="space-y-5 pb-24 animate-fade-in md:hidden relative">
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
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl bg-white/80 dark:bg-dark-card/80 border border-black/5 dark:border-white/10 shadow-sm flex items-center justify-center text-light-text dark:text-white active:scale-95 touch-feedback transition-all"
            aria-label="View Controls"
          >
            <Icon name="sliders" className="text-xl" />
          </button>

          <button
            onClick={onAddAccountClick}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/25 flex items-center justify-center active:scale-95 touch-feedback transition-all"
            aria-label="Add Account"
          >
            <Icon name="add" className="text-2xl" />
          </button>
        </div>
      </div>

      {/* 2. Hero Net Worth Banner */}
      <div className="p-5 rounded-[2rem] bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900 text-white shadow-xl border border-white/10 relative overflow-hidden">
        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between text-[11px] font-bold tracking-wider uppercase opacity-75">
            <span>Net Portfolio Value</span>
            <span>{preferredCurrency}</span>
          </div>

          <p className="text-3xl font-black tracking-tight privacy-blur leading-none">
            {netWorthFormatted}
          </p>

          <div className="flex items-center gap-2 pt-1 border-t border-white/10">
            <div className="flex-1 flex justify-between items-center text-xs">
              <span className="opacity-70 text-[10px]">Assets:</span>
              <span className="font-bold text-emerald-400 privacy-blur">{assetsFormatted}</span>
            </div>
            <div className="h-3 w-px bg-white/20" />
            <div className="flex-1 flex justify-between items-center text-xs">
              <span className="opacity-70 text-[10px]">Liabilities:</span>
              <span className="font-bold text-rose-400 privacy-blur">{debtFormatted}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Segment Filter Tabs (Horizontal Scroll Pill Strip) */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-touch py-1 px-0.5">
        {segments.map((seg) => {
          const isActive = activeSegment === seg.id;
          const count =
            seg.id === 'all'
              ? filteredAccounts.length
              : seg.id === 'cash'
              ? filteredAccounts.filter((a) => a.type === 'Checking' || a.type === 'Savings').length
              : seg.id === 'invested'
              ? filteredAccounts.filter((a) => a.type === 'Investment').length
              : seg.id === 'property'
              ? filteredAccounts.filter((a) => a.type === 'Property' || a.type === 'Vehicle' || a.type === 'Other Assets').length
              : filteredAccounts.filter((a) => DEBT_TYPES.includes(a.type)).length;

          return (
            <button
              key={seg.id}
              onClick={() => setActiveSegment(seg.id)}
              className={`touch-feedback flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap min-h-[38px] border ${
                isActive
                  ? 'bg-primary-500 text-white border-primary-500 shadow-md shadow-primary-500/20'
                  : 'bg-white/80 dark:bg-dark-card/80 border-black/5 dark:border-white/10 text-light-text-secondary dark:text-dark-text-secondary'
              }`}
            >
              <Icon name={seg.icon} className="text-sm" />
              <span>{seg.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${isActive ? 'bg-white/20 text-white' : 'bg-black/5 dark:bg-white/10'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4. Controls Drawer / Modal */}
      {showControlsModal && (
        <div className="bg-white/95 dark:bg-dark-card/95 backdrop-blur-xl p-4 rounded-2xl border border-black/5 dark:border-white/10 shadow-xl space-y-3 animate-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/10">
            <span className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
              View Options
            </span>
            <button onClick={() => setShowControlsModal(false)} className="text-gray-400 p-1">
              <Icon name="close" className="text-base" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-light-text dark:text-white">Sort By</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-gray-100 dark:bg-gray-800 text-xs font-semibold px-3 py-1.5 rounded-xl border-none text-light-text dark:text-white"
              >
                <option value="name">Name (A-Z)</option>
                <option value="balance">Highest Balance</option>
                <option value="manual">Custom Order</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-light-text dark:text-white">Separate Liabilities</span>
              <button
                onClick={() => setSplitAssetsLiabilities(!splitAssetsLiabilities)}
                className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                  splitAssetsLiabilities ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    splitAssetsLiabilities ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {closedAccounts.length > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/10">
                <span className="text-xs font-semibold text-light-text dark:text-white">
                  Show Closed ({closedAccounts.length})
                </span>
                <button
                  onClick={() => setShowClosed(!showClosed)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                    showClosed ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      showClosed ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Account Cards Stack (Single column) */}
      <div className="space-y-4">
        {splitAssetsLiabilities ? (
          <>
            {assetAccounts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                    Assets ({assetAccounts.length})
                  </h3>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 privacy-blur">
                    {assetsFormatted}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {assetAccounts.map(renderAccountItem)}
                </div>
              </div>
            )}

            {debtAccounts.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                    Liabilities ({debtAccounts.length})
                  </h3>
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400 privacy-blur">
                    {debtFormatted}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {debtAccounts.map(renderAccountItem)}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-2.5">
            {filteredAccounts.map(renderAccountItem)}
          </div>
        )}

        {filteredAccounts.length === 0 && (
          <div className="text-center py-12 bg-white/60 dark:bg-dark-card/60 rounded-3xl border border-black/5 dark:border-white/5 p-6">
            <Icon name="wallet" className="text-4xl text-gray-400 mb-2" />
            <p className="text-sm font-bold text-light-text dark:text-white">No accounts found</p>
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
              Add an account to begin tracking your finances.
            </p>
            <button
              onClick={onAddAccountClick}
              className="mt-4 px-4 py-2 rounded-xl bg-primary-500 text-white text-xs font-bold shadow-md touch-feedback"
            >
              Add Account
            </button>
          </div>
        )}

        {/* Closed Accounts Section */}
        {showClosed && closedAccounts.length > 0 && (
          <div className="space-y-2 pt-4 border-t border-black/5 dark:border-white/10">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 px-1">
              Closed Accounts ({closedAccounts.length})
            </h3>
            <div className="space-y-2 opacity-60">
              {closedAccounts.map(renderAccountItem)}
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <FloatingActionButton
        onClick={onAddAccountClick}
        label="Add Account"
        icon="add"
      />
    </div>
  );
};
