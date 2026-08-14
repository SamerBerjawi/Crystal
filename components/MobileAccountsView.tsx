import React, { useState, useMemo, useCallback } from 'react';
import { Account, Transaction, Warrant, Currency, ScheduledPayment } from '../types';
import { formatCurrency, convertCurrency, generateAmortizationSchedule, convertToEur, toLocalISOString } from '../utils';
import { DEBT_TYPES, ASSET_TYPES, ACCOUNT_TYPE_STYLES } from '../constants';
import { getMerchantLogoUrl, getCardNetworkLogoUrl } from '../utils/brandfetch';
import { LineChart, Line } from '../src/components/charts';
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
  merchantLogoOverrides?: Record<string, string>;
}

const MobileAccountItem: React.FC<{
  account: Account;
  transactionsByAccount: Record<string, Transaction[]>;
  linkedEnableBankingAccountIds: Set<string>;
  getEffectiveAccountBalance: (a: Account) => number;
  onAccountClick: (id: string) => void;
  onEditClick: (a: Account) => void;
  onAdjustBalanceClick: (a: Account) => void;
  renderInstitutionAvatar: (a: Account) => React.ReactNode;
  curr: Currency;
  conversionRates?: any;
  sortBy: 'name' | 'balance' | 'manual';
  isReordering: boolean;
  setAccountOrder?: React.Dispatch<React.SetStateAction<string[]>>;
  handleMoveAccount: (id: string, dir: 'up' | 'down') => void;
}> = ({
  account,
  transactionsByAccount,
  linkedEnableBankingAccountIds,
  getEffectiveAccountBalance,
  onAccountClick,
  onEditClick,
  onAdjustBalanceClick,
  renderInstitutionAvatar,
  curr,
  conversionRates,
  sortBy,
  isReordering,
  setAccountOrder,
  handleMoveAccount,
}) => {
  const isDebt = DEBT_TYPES.includes(account.type);
  const effectiveBal = getEffectiveAccountBalance(account);
  const formattedBal = formatCurrency(
    convertCurrency(effectiveBal, account.currency, curr, conversionRates),
    curr
  );

  // Financial Institution & Card Number subtext
  const detailsText = account.financialInstitution || (account as any).institutionName || account.type;
  const subtext = `${detailsText}${account.last4 ? ` • ${account.last4}` : ''}`;

  // 90-Day Sparkline & Trend Calculation
  const { sparklineData, trend, isPositiveTrend } = useMemo(() => {
    const NUM_POINTS = 90;
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const accTxs = transactionsByAccount[account.id] || [];
    const sortedTxs = [...accTxs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let currentBal = convertToEur(effectiveBal, account.currency);

    const txsByDate: Record<string, number> = {};
    sortedTxs.forEach((tx) => {
      const dateStr = tx.date;
      const amount = convertToEur(tx.amount, tx.currency);
      txsByDate[dateStr] = (txsByDate[dateStr] || 0) + amount;
    });

    const runningDate = new Date(endDate);
    const history: { date: Date; value: number }[] = [];
    let runningBal = currentBal;

    for (let i = 0; i < NUM_POINTS; i++) {
      history.push({
        date: new Date(runningDate),
        value: runningBal,
      });
      const dateStr = toLocalISOString(runningDate);
      const change = txsByDate[dateStr] || 0;
      runningBal -= change;
      runningDate.setDate(runningDate.getDate() - 1);
    }

    const data = history.reverse().map((item) => ({ date: item.date, value: Math.max(0, item.value) }));
    const trendVal = data[data.length - 1].value - data[0].value;
    const isPositive = trendVal >= 0;

    return { sparklineData: data, trend: trendVal, isPositiveTrend: isPositive };
  }, [account, transactionsByAccount, effectiveBal]);

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
        className="p-3.5 flex items-center justify-between gap-2.5 min-h-[64px] bg-white dark:bg-[#18181b] touch-feedback cursor-pointer active:bg-gray-100 dark:active:bg-gray-800/80 transition-colors"
      >
        {/* Left Avatar & Name */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {renderInstitutionAvatar(account)}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-[14px] font-extrabold text-light-text dark:text-white truncate tracking-tight">
                {account.name}
              </p>
            </div>

            <p className="text-[11px] font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-75 truncate mt-0.5">
              {subtext}
            </p>
          </div>
        </div>

        {/* Middle Mini Sparkline */}
        {sparklineData && sparklineData.length > 0 && (
          <div className="w-20 h-7 sm:w-24 sm:h-8 opacity-85 shrink-0 select-none">
            <LineChart
              data={sparklineData}
              xDataKey="date"
              margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
              className="w-20 h-7 sm:w-24 sm:h-8"
            >
              <Line
                dataKey="value"
                stroke={isPositiveTrend ? '#10B981' : '#F43F5E'}
                strokeWidth={1.75}
                fadeEdges={true}
                animate={false}
                showHighlight={true}
              />
            </LineChart>
          </div>
        )}

        {/* Right Balance & Trend */}
        <div className="text-right shrink-0 flex items-center gap-1.5">
          <div>
            <p
              className={`text-[14px] font-black privacy-blur tracking-tight leading-tight ${
                isDebt ? 'text-rose-600 dark:text-rose-400' : 'text-light-text dark:text-white'
              }`}
            >
              {formattedBal}
            </p>

            {Math.abs(trend) > 0 && (
              <div className="flex items-center justify-end gap-0.5 text-[10px] font-bold mt-0.5">
                <span className={isPositiveTrend ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                  {isPositiveTrend ? '▲' : '▼'}
                </span>
                <span className="text-light-text-secondary dark:text-dark-text-secondary font-mono opacity-65 privacy-blur">
                  {formatCurrency(convertCurrency(Math.abs(trend), 'EUR', curr, conversionRates), curr, { showPlusSign: false })}
                </span>
              </div>
            )}
          </div>

          {/* Up & Down Arrows appear ONLY when in Edit Mode (isReordering) */}
          {sortBy === 'manual' && isReordering && setAccountOrder ? (
            <div className="flex flex-col gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => handleMoveAccount(account.id, 'up')}
                className="p-1.5 rounded-lg bg-primary-500/15 text-primary-600 dark:text-primary-400 hover:bg-primary-500/25 active:scale-95 touch-feedback border border-primary-500/30"
                aria-label="Move Up"
              >
                <Icon name="arrow_upward" className="text-xs font-bold" />
              </button>
              <button
                onClick={() => handleMoveAccount(account.id, 'down')}
                className="p-1.5 rounded-lg bg-primary-500/15 text-primary-600 dark:text-primary-400 hover:bg-primary-500/25 active:scale-95 touch-feedback border border-primary-500/30"
                aria-label="Move Down"
              >
                <Icon name="arrow_downward" className="text-xs font-bold" />
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
  merchantLogoOverrides = {},
}) => {
  const [showClosed, setShowClosed] = useState(false);
  const [showControlsSheet, setShowControlsSheet] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [groupMode, setGroupMode] = useState<'position' | 'type' | 'flat'>(splitAssetsLiabilities ? 'position' : 'type');
  const [logoErrors, setLogoErrors] = useState<Record<string, boolean>>({});

  const curr = preferredCurrency as Currency;

  // Helper to calculate actual effective balance for mortgages/loans vs standard accounts
  const getEffectiveAccountBalance = useCallback(
    (account: Account): number => {
      if (account.type === 'Loan' || account.type === 'Lending') {
        if (
          account.principalAmount &&
          account.duration &&
          account.loanStartDate &&
          account.interestRate !== undefined
        ) {
          const overrides = loanPaymentOverrides[account.id] || {};
          const schedule = generateAmortizationSchedule(
            account,
            transactionsByAccount[account.id] || [],
            overrides
          );

          const totalScheduledPrincipal = schedule.reduce((sum, p) => sum + p.principal, 0);
          const totalPaidPrincipal = schedule.reduce((acc, p) => (p.status === 'Paid' ? acc + p.principal : acc), 0);
          const totalScheduledInterest = schedule.reduce((sum, p) => sum + p.interest, 0);
          const totalPaidInterest = schedule.reduce((acc, p) => (p.status === 'Paid' ? acc + p.interest : acc), 0);

          const outstandingPrincipal = Math.max(0, totalScheduledPrincipal - totalPaidPrincipal);
          const outstandingInterest = Math.max(0, totalScheduledInterest - totalPaidInterest);
          const totalOutstanding = outstandingPrincipal + outstandingInterest;
          return account.type === 'Loan' ? -totalOutstanding : totalOutstanding;
        }
      }
      return account.balance;
    },
    [loanPaymentOverrides, transactionsByAccount]
  );

  const netWorthEur = globalMetrics.netWorth;
  const netWorthFormatted = formatCurrency(
    convertCurrency(netWorthEur, 'EUR', curr, conversionRates),
    curr
  );

  const assetsFormatted = formatCurrency(
    convertCurrency(globalMetrics.totalAssets, 'EUR', curr, conversionRates),
    curr
  );

  const debtFormatted = formatCurrency(
    convertCurrency(Math.abs(globalMetrics.totalDebt), 'EUR', curr, conversionRates),
    curr
  );

  // Sorting
  const sortedFilteredAccounts = useMemo(() => {
    const list = [...filteredAccounts];
    if (sortBy === 'manual' && accountOrder && accountOrder.length > 0) {
      return list.sort((a, b) => {
        const aIdx = accountOrder.indexOf(a.id);
        const bIdx = accountOrder.indexOf(b.id);
        if (aIdx === -1 && bIdx === -1) return 0;
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
      });
    }
    if (sortBy === 'name') {
      return list.sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sortBy === 'balance') {
      return list.sort((a, b) => {
        const balA = convertCurrency(getEffectiveAccountBalance(a), a.currency, 'EUR', conversionRates);
        const balB = convertCurrency(getEffectiveAccountBalance(b), b.currency, 'EUR', conversionRates);
        return balB - balA;
      });
    }
    return list;
  }, [filteredAccounts, sortBy, accountOrder, getEffectiveAccountBalance, conversionRates]);

  // Grouping
  const groupedSections = useMemo(() => {
    if (groupMode === 'position') {
      const assets = sortedFilteredAccounts.filter((a) => !DEBT_TYPES.includes(a.type));
      const debt = sortedFilteredAccounts.filter((a) => DEBT_TYPES.includes(a.type));
      const sections = [];
      if (assets.length > 0) {
        sections.push({
          title: `Assets (${assets.length})`,
          totalFormatted: assetsFormatted,
          totalClass: 'text-emerald-600 dark:text-emerald-400',
          accounts: assets,
        });
      }
      if (debt.length > 0) {
        sections.push({
          title: `Liabilities (${debt.length})`,
          totalFormatted: debtFormatted,
          totalClass: 'text-rose-600 dark:text-rose-400',
          accounts: debt,
        });
      }
      return sections;
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
      account.financialInstitution ||
      (account as any).institutionName ||
      (account as any).institutionId ||
      (account as any).bankName ||
      account.name;

    let logoUrl =
      (account as any).institutionLogo ||
      (account as any).logoUrl ||
      (account as any).bankLogo;

    if (!logoUrl && institutionQuery) {
      logoUrl = getMerchantLogoUrl(
        institutionQuery,
        brandfetchClientId,
        merchantLogoOverrides,
        { type: 'icon', fallback: 'lettermark', width: 96, height: 96 }
      );
    }

    if (!logoUrl && account.type === 'Credit Card' && (account as any).cardNetwork) {
      logoUrl = getCardNetworkLogoUrl((account as any).cardNetwork, brandfetchClientId);
    }

    const isValidLogo = logoUrl && !logoErrors[logoUrl];
    const typeConfig = ACCOUNT_TYPE_STYLES[account.type] || {
      icon: 'account_balance_wallet',
      color: 'bg-indigo-500/10 text-indigo-500',
    };

    const isMain = Boolean(account.isPrimary);
    const isLinked = linkedEnableBankingAccountIds.has(account.id);

    return (
      <div className="relative shrink-0">
        <div
          className={`w-11 h-11 rounded-[16px] flex items-center justify-center shrink-0 border border-black/5 dark:border-white/10 shadow-xs overflow-hidden ${
            isValidLogo ? 'bg-white dark:bg-white/90' : typeConfig.color
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

        {/* Top-Right: Cryptocurrency01 Icon for Main Account */}
        {isMain && (
          <div
            className="absolute -top-1 -right-1 size-4.5 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs ring-2 ring-white dark:ring-[#18181b] z-10"
            title="Main Account"
          >
            <Icon name="cryptocurrency-01" className="text-[11px]" strokeWidth={2.5} />
          </div>
        )}

        {/* Bottom-Right: Link04 Icon for Linked Accounts */}
        {isLinked && (
          <div
            className="absolute -bottom-1 -right-1 size-4.5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs ring-2 ring-white dark:ring-[#18181b] z-10"
            title="Connected / Linked Account"
          >
            <Icon name="link-04" className="text-[11px]" strokeWidth={2.5} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-20 animate-fade-in md:hidden font-sans">
      {/* 1. Top Header */}
      <div className="sticky top-0 z-20 pt-2 pb-2 bg-light-bg/85 dark:bg-dark-bg/85 backdrop-blur-xl -mx-4 px-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70">
            Portfolio
          </p>
          <h1 className="text-2xl font-black text-light-text dark:text-white tracking-tight">
            Accounts
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Edit Mode Toggle for Manual Sort */}
          {sortBy === 'manual' && (
            <button
              onClick={() => setIsReordering(!isReordering)}
              className={`px-3 py-1.5 rounded-2xl text-xs font-black transition-all active:scale-95 touch-feedback border ${
                isReordering
                  ? 'bg-primary-500 text-white border-primary-500 shadow-md shadow-primary-500/20'
                  : 'bg-white/80 dark:bg-dark-card/80 text-light-text dark:text-white border-black/5 dark:border-white/10'
              }`}
            >
              {isReordering ? 'Done' : 'Edit Order'}
            </button>
          )}

          <button
            onClick={() => setShowControlsSheet(true)}
            className="w-9 h-9 rounded-2xl bg-white/80 dark:bg-dark-card/80 border border-black/5 dark:border-white/10 shadow-xs flex items-center justify-center text-light-text dark:text-white active:scale-95 touch-feedback"
            aria-label="View Controls"
          >
            <Icon name="tune" className="text-lg" />
          </button>

          <button
            onClick={onAddAccountClick}
            className="w-9 h-9 rounded-2xl bg-primary-500 hover:bg-primary-600 text-white shadow-md shadow-primary-500/25 flex items-center justify-center active:scale-95 touch-feedback"
            aria-label="Add Account"
          >
            <Icon name="add" className="text-xl font-bold" />
          </button>
        </div>
      </div>

      {/* 2. Hero Segment Summary Card */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 text-white rounded-[24px] p-4 shadow-lg border border-white/15 relative overflow-hidden space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/70">
            Net Portfolio Value
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md text-[10px] font-extrabold text-white border border-white/20">
            {curr}
          </span>
        </div>

        <div>
          <p className="text-3xl font-black text-white tracking-tight privacy-blur leading-none">
            {netWorthFormatted}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-semibold pt-1">
          <div className="bg-emerald-500/15 rounded-xl p-2 border border-emerald-500/25 flex items-center justify-between">
            <div>
              <span className="text-[9px] font-extrabold uppercase text-emerald-300 block">Total Assets</span>
              <span className="text-xs font-black text-emerald-400 privacy-blur truncate block mt-0.5">{assetsFormatted}</span>
            </div>
            <Icon name="arrow_upward" className="text-emerald-400 text-sm" />
          </div>

          <div className="bg-rose-500/15 rounded-xl p-2 border border-rose-500/25 flex items-center justify-between">
            <div>
              <span className="text-[9px] font-extrabold uppercase text-rose-300 block">Liabilities</span>
              <span className="text-xs font-black text-rose-400 privacy-blur truncate block mt-0.5">{debtFormatted}</span>
            </div>
            <Icon name="arrow_downward" className="text-rose-400 text-sm" />
          </div>
        </div>
      </div>

      {/* 3. Segment Filter Tabs */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {segments.map((seg) => (
          <button
            key={seg.id}
            onClick={() => setActiveSegment(seg.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 active:scale-95 touch-feedback ${
              activeSegment === seg.id
                ? 'bg-primary-500 text-white shadow-md shadow-primary-500/20'
                : 'bg-white/80 dark:bg-dark-card/80 text-light-text-secondary dark:text-dark-text-secondary border border-black/5 dark:border-white/10'
            }`}
          >
            {seg.label}
          </button>
        ))}
      </div>

      {/* 4. Account Sections */}
      {groupedSections.map((sec) => (
        <div key={sec.title} className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70">
              {sec.title}
            </span>
            <span className={`text-xs font-black privacy-blur ${sec.totalClass}`}>
              {sec.totalFormatted}
            </span>
          </div>

          <div className="bg-white dark:bg-dark-card rounded-[22px] border border-black/5 dark:border-white/10 shadow-xs divide-y divide-black/5 dark:divide-white/5 overflow-hidden">
            {sec.accounts.map((acc) => (
              <MobileAccountItem
                key={acc.id}
                account={acc}
                transactionsByAccount={transactionsByAccount}
                linkedEnableBankingAccountIds={linkedEnableBankingAccountIds}
                getEffectiveAccountBalance={getEffectiveAccountBalance}
                onAccountClick={onAccountClick}
                onEditClick={onEditClick}
                onAdjustBalanceClick={onAdjustBalanceClick}
                renderInstitutionAvatar={renderInstitutionAvatar}
                curr={curr}
                conversionRates={conversionRates}
                sortBy={sortBy}
                isReordering={isReordering}
                setAccountOrder={setAccountOrder}
                handleMoveAccount={handleMoveAccount}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Closed Accounts Collapsible Toggle */}
      {closedAccounts.length > 0 && (
        <div className="pt-2">
          <button
            onClick={() => setShowClosed(!showClosed)}
            className="w-full py-2 px-3 rounded-2xl bg-white/50 dark:bg-dark-card/50 border border-black/5 dark:border-white/5 flex items-center justify-between text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary"
          >
            <span>Closed Accounts ({closedAccounts.length})</span>
            <Icon name={showClosed ? 'expand_less' : 'expand_more'} className="text-base" />
          </button>

          {showClosed && (
            <div className="mt-2 bg-white dark:bg-dark-card rounded-[22px] border border-black/5 dark:border-white/10 shadow-xs divide-y divide-black/5 dark:divide-white/5 overflow-hidden opacity-60">
              {closedAccounts.map((acc) => (
                <MobileAccountItem
                  key={acc.id}
                  account={acc}
                  transactionsByAccount={transactionsByAccount}
                  linkedEnableBankingAccountIds={linkedEnableBankingAccountIds}
                  getEffectiveAccountBalance={getEffectiveAccountBalance}
                  onAccountClick={onAccountClick}
                  onEditClick={onEditClick}
                  onAdjustBalanceClick={onAdjustBalanceClick}
                  renderInstitutionAvatar={renderInstitutionAvatar}
                  curr={curr}
                  conversionRates={conversionRates}
                  sortBy={sortBy}
                  isReordering={isReordering}
                  setAccountOrder={setAccountOrder}
                  handleMoveAccount={handleMoveAccount}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* View Options Control Sheet */}
      <BottomSheet
        isOpen={showControlsSheet}
        onClose={() => setShowControlsSheet(false)}
        title="View & Sorting Options"
      >
        <div className="space-y-4 pt-1">
          <div>
            <label className="text-xs font-extrabold uppercase text-light-text-secondary dark:text-dark-text-secondary block mb-2">
              Group Accounts By
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['position', 'type', 'flat'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setGroupMode(m);
                    setSplitAssetsLiabilities(m === 'position');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-extrabold capitalize border transition-all ${
                    groupMode === m
                      ? 'bg-primary-500 text-white border-primary-500 shadow-md shadow-primary-500/20'
                      : 'bg-black/5 dark:bg-white/5 border-transparent text-light-text dark:text-white'
                  }`}
                >
                  {m === 'position' ? 'Position' : m === 'type' ? 'Type' : 'Flat'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-extrabold uppercase text-light-text-secondary dark:text-dark-text-secondary block mb-2">
              Sort Accounts By
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['name', 'balance', 'manual'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSortBy(s);
                    if (s === 'manual') setIsReordering(true);
                    else setIsReordering(false);
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-extrabold capitalize border transition-all ${
                    sortBy === s
                      ? 'bg-primary-500 text-white border-primary-500 shadow-md shadow-primary-500/20'
                      : 'bg-black/5 dark:bg-white/5 border-transparent text-light-text dark:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};
