import React, { useState, useMemo, useCallback } from 'react';
import { Account, Transaction, Warrant, Currency, ScheduledPayment } from '../types';
import { formatCurrency, convertCurrency, generateAmortizationSchedule } from '../utils';
import { DEBT_TYPES, ASSET_TYPES, ACCOUNT_TYPE_STYLES } from '../constants';
import { getMerchantLogoUrl } from '../utils/brandfetch';
import Icon from './ui/Icon';
import SwipeableRow from './SwipeableRow';
import BottomSheet from './BottomSheet';

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
  accountOrder?: string[];
  setAccountOrder?: React.Dispatch<React.SetStateAction<string[]>>;
  splitAssetsLiabilities: boolean;
  setSplitAssetsLiabilities: (val: boolean) => void;
  loanPaymentOverrides?: Record<string, Record<number, Partial<ScheduledPayment>>>;
  brandfetchClientId?: string;
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
  accountOrder,
  setAccountOrder,
  splitAssetsLiabilities,
  setSplitAssetsLiabilities,
  linkedEnableBankingAccountIds = new Set(),
  loanPaymentOverrides = {},
  brandfetchClientId,
}) => {
  const [showClosed, setShowClosed] = useState(false);
  const [showControlsSheet, setShowControlsSheet] = useState(false);
  const [groupMode, setGroupMode] = useState<'position' | 'type' | 'flat'>(splitAssetsLiabilities ? 'position' : 'type');
  const [logoErrors, setLogoErrors] = useState<Record<string, boolean>>({});

  const curr = preferredCurrency as Currency;

  // Helper to calculate actual effective balance for mortgages/loans vs standard accounts
  const getEffectiveAccountBalance = useCallback(
    (account: Account): number => {
      if (account.type === 'Loan' || account.type === 'Lending') {
        if (account.principalAmount && account.duration && account.loanStartDate && account.interestRate !== undefined) {
          const overrides = loanPaymentOverrides[account.id] || {};
          const accountTxs = transactionsByAccount[account.id] || [];
          const schedule = generateAmortizationSchedule(account, accountTxs, overrides);

          const totalScheduledPrincipal = schedule.reduce((s, p) => s + p.principal, 0);
          const totalScheduledInterest = schedule.reduce((s, p) => s + p.interest, 0);

          const totalPaidPrincipal = schedule.reduce((a, p) => (p.status === 'Paid' ? a + p.principal : a), 0);
          const totalPaidInterest = schedule.reduce((a, p) => (p.status === 'Paid' ? a + p.interest : a), 0);

          const outstandingPrincipal = Math.max(0, totalScheduledPrincipal - totalPaidPrincipal);
          const outstandingInterest = Math.max(0, totalScheduledInterest - totalPaidInterest);

          return outstandingPrincipal + outstandingInterest;
        } else if (account.totalAmount) {
          const accountTxs = transactionsByAccount[account.id] || [];
          const loanPayments = accountTxs.filter((tx) =>
            account.type === 'Loan' ? tx.type === 'income' : tx.type === 'expense'
          );
          const totalPaid = loanPayments.reduce((s, tx) => {
            const totalPayment = (tx.principalAmount || 0) + (tx.interestAmount || 0);
            return s + (totalPayment > 0 ? totalPayment : tx.amount);
          }, 0);
          return Math.max(0, account.totalAmount - totalPaid);
        }
      }
      return account.balance;
    },
    [transactionsByAccount, loanPaymentOverrides]
  );

  // Overall metrics using effective balances
  const effectiveTotalAssets = useMemo(() => {
    return filteredAccounts
      .filter((a) => ASSET_TYPES.includes(a.type))
      .reduce((sum, a) => sum + convertCurrency(getEffectiveAccountBalance(a), a.currency, curr, conversionRates), 0);
  }, [filteredAccounts, getEffectiveAccountBalance, curr, conversionRates]);

  const effectiveTotalDebt = useMemo(() => {
    return filteredAccounts
      .filter((a) => DEBT_TYPES.includes(a.type))
      .reduce((sum, a) => sum + convertCurrency(Math.abs(getEffectiveAccountBalance(a)), a.currency, curr, conversionRates), 0);
  }, [filteredAccounts, getEffectiveAccountBalance, curr, conversionRates]);

  const effectiveNetWorth = effectiveTotalAssets - effectiveTotalDebt;

  const netWorthFormatted = formatCurrency(effectiveNetWorth, curr);
  const assetsFormatted = formatCurrency(effectiveTotalAssets, curr);
  const debtFormatted = formatCurrency(effectiveTotalDebt, curr);

  // Sorting helper
  const sortedFilteredAccounts = useMemo(() => {
    const list = [...filteredAccounts];
    if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'balance') {
      list.sort((a, b) => getEffectiveAccountBalance(b) - getEffectiveAccountBalance(a));
    } else if (sortBy === 'manual' && accountOrder && accountOrder.length > 0) {
      const orderMap = new Map(accountOrder.map((id, idx) => [id, idx]));
      list.sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));
    }
    return list;
  }, [filteredAccounts, sortBy, accountOrder, getEffectiveAccountBalance]);

  // Grouped Accounts depending on groupMode
  const groupedSections = useMemo(() => {
    if (groupMode === 'position') {
      const assets = sortedFilteredAccounts.filter((a) => ASSET_TYPES.includes(a.type));
      const liabilities = sortedFilteredAccounts.filter((a) => DEBT_TYPES.includes(a.type));

      const res = [];
      if (assets.length > 0) {
        res.push({
          title: `Assets (${assets.length})`,
          totalFormatted: assetsFormatted,
          totalClass: 'text-emerald-600 dark:text-emerald-400',
          accounts: assets,
        });
      }
      if (liabilities.length > 0) {
        res.push({
          title: `Liabilities (${liabilities.length})`,
          totalFormatted: debtFormatted,
          totalClass: 'text-rose-600 dark:text-rose-400',
          accounts: liabilities,
        });
      }
      return res;
    } else if (groupMode === 'type') {
      const map: Record<string, Account[]> = {};
      sortedFilteredAccounts.forEach((acc) => {
        const typeKey = acc.type || 'Other';
        if (!map[typeKey]) map[typeKey] = [];
        map[typeKey].push(acc);
      });

      return Object.entries(map).map(([typeKey, accs]) => {
        const total = accs.reduce(
          (sum, a) => sum + convertCurrency(getEffectiveAccountBalance(a), a.currency, curr, conversionRates),
          0
        );
        const isDebt = DEBT_TYPES.includes(typeKey as any);
        return {
          title: `${typeKey} (${accs.length})`,
          totalFormatted: formatCurrency(Math.abs(total), curr),
          totalClass: isDebt ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400',
          accounts: accs,
        };
      });
    } else {
      return [
        {
          title: `All Accounts (${sortedFilteredAccounts.length})`,
          totalFormatted: netWorthFormatted,
          totalClass: 'text-primary-600 dark:text-primary-400',
          accounts: sortedFilteredAccounts,
        },
      ];
    }
  }, [groupMode, sortedFilteredAccounts, assetsFormatted, debtFormatted, netWorthFormatted, getEffectiveAccountBalance, curr, conversionRates]);

  const handleLogoError = useCallback((url: string) => {
    setLogoErrors((prev) => ({ ...prev, [url]: true }));
  }, []);

  // Manual reorder action
  const handleMoveAccount = (accountId: string, direction: 'up' | 'down') => {
    if (!setAccountOrder) return;
    const currentOrder = accountOrder && accountOrder.length > 0
      ? [...accountOrder]
      : accounts.map((a) => a.id);

    const index = currentOrder.indexOf(accountId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentOrder.length) return;

    const temp = currentOrder[index];
    currentOrder[index] = currentOrder[targetIndex];
    currentOrder[targetIndex] = temp;

    setAccountOrder(currentOrder);
  };

  const segments = [
    { id: 'all', label: 'All' },
    { id: 'cash', label: 'Cash' },
    { id: 'invested', label: 'Invested' },
    { id: 'property', label: 'Assets' },
    { id: 'debt', label: 'Liabilities' },
  ] as const;

  const renderInstitutionAvatar = (account: Account) => {
    const institutionQuery =
      (account as any).institutionLogo ||
      (account as any).logoUrl ||
      (account as any).bankLogo ||
      (account as any).institutionName ||
      (account as any).institutionId ||
      account.name;

    const logoUrl =
      (account as any).institutionLogo ||
      (account as any).logoUrl ||
      (account as any).bankLogo ||
      getMerchantLogoUrl(institutionQuery, brandfetchClientId, {}, { type: 'icon', fallback: 'lettermark', width: 96, height: 96 });

    const isValidLogo = logoUrl && !logoErrors[logoUrl];
    const typeConfig = ACCOUNT_TYPE_STYLES[account.type] || {
      icon: 'account_balance_wallet',
      color: 'bg-indigo-500/10 text-indigo-500',
    };

    return (
      <div
        className={`w-11 h-11 rounded-[16px] flex items-center justify-center shrink-0 border border-black/5 dark:border-white/10 shadow-xs overflow-hidden ${
          isValidLogo ? 'bg-white' : typeConfig.color
        }`}
      >
        {isValidLogo ? (
          <img
            src={logoUrl}
            alt={account.name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => handleLogoError(logoUrl)}
          />
        ) : (
          <Icon name={typeConfig.icon} className="text-xl" />
        )}
      </div>
    );
  };

  const renderAccountRow = (account: Account) => {
    const isDebt = DEBT_TYPES.includes(account.type);
    const effectiveBal = getEffectiveAccountBalance(account);
    const formattedBal = formatCurrency(
      convertCurrency(effectiveBal, account.currency, curr, conversionRates),
      curr
    );

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
          className="p-3.5 flex items-center justify-between gap-3 min-h-[64px] bg-white dark:bg-[#18181b] touch-feedback cursor-pointer active:bg-gray-100 dark:active:bg-gray-800/80 transition-colors"
        >
          {/* Left Avatar & Name */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {renderInstitutionAvatar(account)}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-[14.5px] font-extrabold text-light-text dark:text-white truncate tracking-tight">
                  {account.name}
                </p>
                {account.isPrimary && (
                  <span className="bg-primary-500/10 text-primary-600 dark:text-primary-400 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0 border border-primary-500/20">
                    Main
                  </span>
                )}
                {linkedEnableBankingAccountIds.has(account.id) && (
                  <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0 border border-emerald-500/20 inline-flex items-center gap-0.5">
                    <Icon name="sync" className="text-[10px]" /> Linked
                  </span>
                )}
              </div>

              <p className="text-[11px] font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-75 truncate mt-0.5">
                {account.type} {account.subType ? `• ${account.subType}` : ''}
                {lastTx ? ` • Last active ${lastTx.date}` : ''}
              </p>
            </div>
          </div>

          {/* Right Balance & Optional Reorder Buttons */}
          <div className="text-right shrink-0 flex items-center gap-2">
            <div>
              {/* Single Balance Line */}
              <p
                className={`text-[14.5px] font-black privacy-blur tracking-tight ${
                  isDebt ? 'text-rose-600 dark:text-rose-400' : 'text-light-text dark:text-white'
                }`}
              >
                {formattedBal}
              </p>
            </div>

            {sortBy === 'manual' && setAccountOrder ? (
              <div className="flex flex-col gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handleMoveAccount(account.id, 'up')}
                  className="p-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white touch-feedback"
                  aria-label="Move Up"
                >
                  <Icon name="arrow_upward" className="text-[10px]" />
                </button>
                <button
                  onClick={() => handleMoveAccount(account.id, 'down')}
                  className="p-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white touch-feedback"
                  aria-label="Move Down"
                >
                  <Icon name="arrow_downward" className="text-[10px]" />
                </button>
              </div>
            ) : (
              <Icon name="chevron_right" className="text-light-text-secondary dark:text-dark-text-secondary text-base opacity-40" />
            )}
          </div>
        </div>
      </SwipeableRow>
    );
  };

  return (
    <div className="space-y-4 pb-20 animate-fade-in md:hidden relative font-sans">
      {/* 1. iOS Large Navigation Title Bar */}
      <div className="sticky top-0 z-20 pt-2 pb-3 bg-light-bg/85 dark:bg-dark-bg/85 backdrop-blur-xl -mx-4 px-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between transition-all">
        <div>
          <h1 className="text-2xl font-black text-light-text dark:text-white tracking-tight">
            Accounts
          </h1>
          <p className="text-[11px] font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-70">
            {filteredAccounts.length} active account{filteredAccounts.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowControlsSheet(true)}
            className="w-10 h-10 rounded-2xl bg-white/80 dark:bg-dark-card/80 border border-black/5 dark:border-white/10 shadow-xs flex items-center justify-center text-light-text dark:text-white active:scale-95 touch-feedback transition-transform"
            aria-label="View Options"
          >
            <Icon name="tune" className="text-lg" />
          </button>

          <button
            onClick={onAddAccountClick}
            className="w-10 h-10 rounded-2xl bg-primary-500 hover:bg-primary-600 active:scale-95 text-white shadow-md shadow-primary-500/25 flex items-center justify-center touch-feedback transition-transform"
            aria-label="Add Account"
          >
            <Icon name="add" className="text-xl font-bold" />
          </button>
        </div>
      </div>

      {/* 2. Apple HIG Net Portfolio Hero Card */}
      <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-xl rounded-[24px] p-4 border border-black/5 dark:border-white/10 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-60">
            Net Portfolio Value
          </span>
          <span className="px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400 text-[10px] font-black border border-primary-500/20">
            {curr}
          </span>
        </div>

        <p className="text-3xl font-black text-light-text dark:text-white tracking-tight privacy-blur leading-none">
          {netWorthFormatted}
        </p>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-black/5 dark:border-white/10 text-xs font-semibold">
          <div className="bg-emerald-500/10 rounded-xl p-2.5 border border-emerald-500/15">
            <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300 opacity-80 block">
              Assets
            </span>
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 privacy-blur mt-0.5 block">
              {assetsFormatted}
            </span>
          </div>

          <div className="bg-rose-500/10 rounded-xl p-2.5 border border-rose-500/15">
            <span className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-300 opacity-80 block">
              Liabilities
            </span>
            <span className="text-sm font-black text-rose-600 dark:text-rose-400 privacy-blur mt-0.5 block">
              {debtFormatted}
            </span>
          </div>
        </div>
      </div>

      {/* 3. iOS Segmented Control Pills */}
      <div className="p-1 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center gap-1">
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
              className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold transition-all text-center touch-feedback flex items-center justify-center gap-1 ${
                isActive
                  ? 'bg-white dark:bg-gray-700 text-light-text dark:text-white shadow-xs font-black'
                  : 'text-light-text-secondary dark:text-dark-text-secondary opacity-70 hover:opacity-100'
              }`}
            >
              <span>{seg.label}</span>
              <span className={`text-[9px] px-1 py-0.2 rounded-md ${isActive ? 'bg-black/10 dark:bg-white/20' : 'opacity-60'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4. Inset Grouped Accounts List */}
      <div className="space-y-4 pt-1">
        {groupedSections.map((section) => (
          <div key={section.title} className="space-y-1.5">
            <div className="flex items-center justify-between px-2 pt-1 pb-0.5">
              <p className="text-[12px] font-bold tracking-tight text-gray-500 dark:text-gray-400">
                {section.title}
              </p>
              <p className={`text-[11px] font-extrabold privacy-blur ${section.totalClass}`}>
                {section.totalFormatted}
              </p>
            </div>

            <div className="bg-white dark:bg-dark-card rounded-[22px] border border-black/5 dark:border-white/10 shadow-xs divide-y divide-black/5 dark:divide-white/5 overflow-hidden">
              {section.accounts.map(renderAccountRow)}
            </div>
          </div>
        ))}

        {/* Closed Accounts Group */}
        {showClosed && closedAccounts.length > 0 && (
          <div className="space-y-1.5 pt-2">
            <p className="text-[12px] font-bold tracking-tight text-gray-400 px-2">
              Closed Accounts ({closedAccounts.length})
            </p>
            <div className="bg-white/60 dark:bg-dark-card/60 rounded-[22px] border border-black/5 dark:border-white/10 shadow-xs divide-y divide-black/5 dark:divide-white/5 overflow-hidden opacity-60">
              {closedAccounts.map(renderAccountRow)}
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredAccounts.length === 0 && (
          <div className="text-center py-14 bg-white/70 dark:bg-dark-card/70 backdrop-blur-md rounded-[28px] border border-black/5 dark:border-white/5 p-6 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto text-gray-400">
              <Icon name="wallet" className="text-2xl" />
            </div>
            <p className="text-sm font-extrabold text-light-text dark:text-white">
              No accounts found
            </p>
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary max-w-xs mx-auto opacity-70">
              Add checking, savings, investment, or debt accounts to track your finances.
            </p>
            <button
              onClick={onAddAccountClick}
              className="mt-3 px-4 py-2 rounded-xl bg-primary-500 text-white text-xs font-bold touch-feedback active:scale-95 transition-transform"
            >
              Add Account
            </button>
          </div>
        )}
      </div>

      {/* 5. View Options Apple HIG Bottom Sheet */}
      <BottomSheet
        isOpen={showControlsSheet}
        onClose={() => setShowControlsSheet(false)}
        title="Account Options"
      >
        <div className="p-5 space-y-5">
          <div className="space-y-4">
            {/* Grouping Mode */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-light-text-secondary/60 dark:text-dark-text-secondary/50 block mb-2">
                Group Accounts By
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'position', label: 'Position (Assets/Debt)' },
                  { id: 'type', label: 'Account Type' },
                  { id: 'flat', label: 'Flat List' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setGroupMode(opt.id as any);
                      if (opt.id === 'position') setSplitAssetsLiabilities(true);
                      else setSplitAssetsLiabilities(false);
                    }}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border text-center touch-feedback ${
                      groupMode === opt.id
                        ? 'bg-primary-500/15 border-primary-500/30 text-primary-600 dark:text-primary-400'
                        : 'bg-gray-50 dark:bg-gray-800/50 border-black/5 dark:border-white/10 text-light-text dark:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sorting */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-light-text-secondary/60 dark:text-dark-text-secondary/50 block mb-2">
                Sort Accounts By
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'name', label: 'Name (A-Z)' },
                  { id: 'balance', label: 'Highest Balance' },
                  { id: 'manual', label: 'Manual Order' },
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setSortBy(option.id as any)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border text-center touch-feedback ${
                      sortBy === option.id
                        ? 'bg-primary-500/15 border-primary-500/30 text-primary-600 dark:text-primary-400'
                        : 'bg-gray-50 dark:bg-gray-800/50 border-black/5 dark:border-white/10 text-light-text dark:text-white'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Show Closed Accounts */}
            {closedAccounts.length > 0 && (
              <div className="flex items-center justify-between py-2 border-t border-black/5 dark:border-white/5">
                <div>
                  <span className="text-xs font-bold text-light-text dark:text-white block">
                    Show Closed Accounts ({closedAccounts.length})
                  </span>
                  <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary opacity-60 block">
                    Display archived accounts at bottom
                  </span>
                </div>

                <button
                  onClick={() => setShowClosed(!showClosed)}
                  className={`w-12 h-7 rounded-full transition-colors relative p-0.5 touch-feedback ${
                    showClosed ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
                      showClosed ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowControlsSheet(false)}
            className="w-full py-3 rounded-2xl bg-primary-500 text-white text-xs font-bold shadow-lg shadow-primary-500/25 touch-feedback active:scale-95 transition-all"
          >
            Done
          </button>
        </div>
      </BottomSheet>
    </div>
  );
};
