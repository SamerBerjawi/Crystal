import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Account, Transaction, Tag, Category, Warrant, Currency, InvestmentTransaction } from '../types';
import {
  formatCurrency,
  convertToEur,
  convertCurrency,
  parseLocalDate,
  generateAmortizationSchedule,
  toLocalISOString,
} from '../utils';
import { getMerchantLogoUrl, getCardNetworkLogoUrl } from '../utils/brandfetch';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { useScheduleContext } from '../contexts/FinancialDataContext';
import Icon from './ui/Icon';
import TransactionDetailModal from './TransactionDetailModal';

export interface AccountOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  transactions?: Transaction[];
  investmentTransactions?: InvestmentTransaction[];
  prices?: Record<string, number>;
  accounts?: Account[];
  tags?: Tag[];
  allCategories?: Category[];
  warrants?: Warrant[];
  onViewAccount?: (accountId: string) => void;
  onEditAccount?: (account: Account) => void;
  onAdjustBalance?: (account: Account) => void;
  onOpenHoldingDetail?: (symbol: string) => void;
  onNavigateToTransactions?: (filters?: { accountName?: string | null }) => void;
}

const AccountOverviewModal: React.FC<AccountOverviewModalProps> = ({
  isOpen,
  onClose,
  account,
  transactions = [],
  investmentTransactions = [],
  prices = {},
  accounts = [],
  tags = [],
  allCategories = [],
  warrants = [],
  onViewAccount,
  onEditAccount,
  onAdjustBalance,
  onOpenHoldingDetail,
  onNavigateToTransactions,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [logoLoadError, setLogoLoadError] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);

  useEffect(() => {
    const checkDarkMode = () => document.documentElement.classList.contains('dark');
    setIsDarkMode(checkDarkMode());

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  const preferredCurrency = usePreferencesSelector(p => (p.currency || 'EUR') as Currency);
  const conversionRates = usePreferencesSelector(p => p.conversionRates);
  const merchantLogoOverrides = usePreferencesSelector(p => {
    const rules = p.merchantRules || {};
    const legacy = p.merchantLogoOverrides || {};
    const ruleLogoOverrides = Object.entries(rules).reduce((acc, [key, r]) => {
      if (r.logo) acc[key] = r.logo;
      return acc;
    }, {} as Record<string, string>);
    return { ...legacy, ...ruleLogoOverrides };
  });

  const { loanPaymentOverrides } = useScheduleContext();

  // Entrance & Exit animation handling
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const frame = requestAnimationFrame(() => setIsVisible(true));
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (isTxModalOpen) {
            setIsTxModalOpen(false);
          } else {
            handleClose();
          }
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        cancelAnimationFrame(frame);
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, isTxModalOpen]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 280);
  };

  // Filter transactions for this account
  const accountTransactions = useMemo(() => {
    if (!account) return [];
    return transactions
      .filter(t => t.accountId === account.id)
      .sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());
  }, [transactions, account]);

  // Display Balance Calculation (handling Loans, Lending, Property, etc.)
  const displayBalance = useMemo(() => {
    if (!account) return 0;
    if (account.type === 'Loan' || account.type === 'Lending') {
      if (
        account.principalAmount &&
        account.duration &&
        account.loanStartDate &&
        account.interestRate !== undefined
      ) {
        const overrides = loanPaymentOverrides[account.id] || {};
        const schedule = generateAmortizationSchedule(account, accountTransactions, overrides);

        const totalScheduledPrincipal = schedule.reduce((sum, p) => sum + p.principal, 0);
        const totalPaidPrincipal = schedule.reduce(
          (acc, p) => (p.status === 'Paid' ? acc + p.principal : acc),
          0
        );
        const totalScheduledInterest = schedule.reduce((sum, p) => sum + p.interest, 0);
        const totalPaidInterest = schedule.reduce(
          (acc, p) => (p.status === 'Paid' ? acc + p.interest : acc),
          0
        );

        const outstandingPrincipal = Math.max(0, totalScheduledPrincipal - totalPaidPrincipal);
        const outstandingInterest = Math.max(0, totalScheduledInterest - totalPaidInterest);

        const totalOutstanding = outstandingPrincipal + outstandingInterest;
        return account.type === 'Loan' ? -totalOutstanding : totalOutstanding;
      }

      if (account.totalAmount) {
        const isLending = account.type === 'Lending';
        const loanPayments = accountTransactions.filter(
          tx => tx.type === (isLending ? 'expense' : 'income')
        );
        const totalPaid = loanPayments.reduce((sum, tx) => {
          const totalPayment = (tx.principalAmount || 0) + (tx.interestAmount || 0);
          return sum + (totalPayment > 0 ? totalPayment : tx.amount);
        }, 0);
        const outstanding = account.totalAmount - totalPaid;
        return isLending ? outstanding : -outstanding;
      }
    }
    return account.balance;
  }, [account, accountTransactions, loanPaymentOverrides]);

  const eurBalance = useMemo(() => {
    if (!account) return 0;
    return convertToEur(displayBalance, account.currency);
  }, [account, displayBalance]);

  // Loan Payoff Metrics (Amortization & Payment-accurate)
  const loanPayoffMetrics = useMemo(() => {
    if (!account || (account.type !== 'Loan' && account.type !== 'Lending')) return null;

    // 1. If full amortization schedule configuration exists
    if (
      account.principalAmount &&
      account.duration &&
      account.loanStartDate &&
      account.interestRate !== undefined
    ) {
      const overrides = loanPaymentOverrides[account.id] || {};
      const schedule = generateAmortizationSchedule(account, accountTransactions, overrides);
      const totalScheduledPrincipal = schedule.reduce((sum, p) => sum + p.principal, 0);
      const totalPaidPrincipal = schedule.reduce(
        (acc, p) => (p.status === 'Paid' ? acc + p.principal : acc),
        0
      );
      const outstandingPrincipal = Math.max(0, totalScheduledPrincipal - totalPaidPrincipal);
      const originalPrincipal = account.principalAmount || totalScheduledPrincipal || 1;
      const percentage = Math.min(100, Math.max(0, (totalPaidPrincipal / originalPrincipal) * 100));

      return {
        total: originalPrincipal,
        paid: totalPaidPrincipal,
        remaining: outstandingPrincipal,
        percentage: Number(percentage.toFixed(1)),
      };
    }

    // 2. If simple totalAmount exists
    if (account.totalAmount && account.totalAmount > 0) {
      const isLending = account.type === 'Lending';
      const loanPayments = accountTransactions.filter(
        tx => tx.type === (isLending ? 'expense' : 'income')
      );
      const totalPaid = loanPayments.reduce((sum, tx) => {
        const totalPayment = (tx.principalAmount || 0) + (tx.interestAmount || 0);
        return sum + (totalPayment > 0 ? totalPayment : Math.abs(tx.amount));
      }, 0);
      const remaining = Math.max(0, account.totalAmount - totalPaid);
      const percentage = Math.min(100, Math.max(0, (totalPaid / account.totalAmount) * 100));

      return {
        total: account.totalAmount,
        paid: totalPaid,
        remaining,
        percentage: Number(percentage.toFixed(1)),
      };
    }

    // 3. Fallback using balance vs original principal / balance
    const original = account.principalAmount || account.totalAmount || Math.abs(account.balance) || 0;
    if (original > 0) {
      const remaining = Math.abs(displayBalance);
      const paid = Math.max(0, original - remaining);
      const percentage = Math.min(100, Math.max(0, (paid / original) * 100));
      return {
        total: original,
        paid,
        remaining,
        percentage: Number(percentage.toFixed(1)),
      };
    }

    return null;
  }, [account, accountTransactions, loanPaymentOverrides, displayBalance]);

  // Institution Logo URL
  const institutionLogoUrl = useMemo(() => {
    if (!account) return null;
    const institutionQuery =
      account.financialInstitution ||
      (account as any).institutionName ||
      (account as any).bankName ||
      account.name;

    if (institutionQuery) {
      const url = getMerchantLogoUrl(
        institutionQuery,
        brandfetchClientId,
        merchantLogoOverrides,
        { type: 'icon', fallback: 'lettermark', width: 96, height: 96 }
      );
      if (url) return url;
    }

    if (account.type === 'Credit Card' && account.cardNetwork) {
      return getCardNetworkLogoUrl(account.cardNetwork, brandfetchClientId);
    }
    return null;
  }, [account, brandfetchClientId, merchantLogoOverrides]);

  // Card Network Logo URL
  const cardNetworkLogoUrl = useMemo(() => {
    if (!account || account.type !== 'Credit Card' || !account.cardNetwork) return null;
    return getCardNetworkLogoUrl(account.cardNetwork, brandfetchClientId);
  }, [account, brandfetchClientId]);

  // 30-Day Activity & Metrics
  const metrics = useMemo(() => {
    if (!account) {
      return {
        txCount30d: 0,
        volume30d: 0,
        inflows30d: 0,
        outflows30d: 0,
        netFlow30d: 0,
        avgTicket: 0,
        lastActive: null as string | null,
        recentTxs: [] as Transaction[],
      };
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let inflows = 0;
    let outflows = 0;
    let count30d = 0;
    let volume30d = 0;

    accountTransactions.forEach(t => {
      const tDate = parseLocalDate(t.date);
      if (tDate >= thirtyDaysAgo && tDate <= now) {
        count30d += 1;
        volume30d += Math.abs(t.amount);
        if (t.type === 'income') {
          inflows += t.amount;
        } else if (t.type === 'expense') {
          outflows += Math.abs(t.amount);
        }
      }
    });

    const netFlow = inflows - outflows;
    const avgTicket = count30d > 0 ? volume30d / count30d : 0;
    const lastActive = accountTransactions[0]?.date || null;
    const recentTxs = accountTransactions.slice(0, 4);

    return {
      txCount30d: count30d,
      volume30d,
      inflows30d: inflows,
      outflows30d: outflows,
      netFlow30d: netFlow,
      avgTicket,
      lastActive,
      recentTxs,
    };
  }, [account, accountTransactions]);

  // Investment Specific Holdings & Trade Metrics
  const investmentHoldingMetrics = useMemo(() => {
    if (!account || account.type !== 'Investment') return null;
    const sym = account.symbol?.toUpperCase();
    const matchingTrades = (investmentTransactions || []).filter(
      tx => (sym && tx.symbol?.toUpperCase() === sym) || tx.name?.toLowerCase() === account.name?.toLowerCase()
    );
    const matchingGrants = (warrants || []).filter(
      w => (sym && w.isin?.toUpperCase() === sym) || w.name?.toLowerCase() === account.name?.toLowerCase()
    );

    const buyShares = matchingTrades
      .filter(t => t.type?.toLowerCase() === 'buy')
      .reduce((sum, t) => sum + (t.quantity || 0), 0);
    const sellShares = matchingTrades
      .filter(t => t.type?.toLowerCase() === 'sell')
      .reduce((sum, t) => sum + (t.quantity || 0), 0);
    const grantShares = matchingGrants.reduce((sum, g) => sum + (g.quantity || 0), 0);
    const netShares = buyShares + grantShares - sellShares;

    const currentPrice = (sym && prices?.[sym]) ? prices[sym] : 0;
    const investedCapital = matchingTrades.reduce((acc, t) => {
      return t.type?.toLowerCase() === 'buy' ? acc + (t.quantity || 0) * (t.price || 0) : acc - (t.quantity || 0) * (t.price || 0);
    }, 0);

    const marketVal = account.balance > 0 ? account.balance : (netShares * currentPrice);
    const totalCost = Math.max(0, investedCapital);
    const unrealizedGain = marketVal - totalCost;
    const gainPercent = totalCost > 0 ? (unrealizedGain / totalCost) * 100 : 0;

    return {
      symbol: sym,
      netShares,
      currentPrice,
      investedCapital,
      marketVal,
      unrealizedGain,
      gainPercent,
      tradesCount: matchingTrades.length + matchingGrants.length,
      matchingTrades,
      matchingGrants,
    };
  }, [account, investmentTransactions, warrants, prices]);

  // Copy to clipboard helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!isOpen || !account) return null;

  const isDebt = ['Credit Card', 'Loan', 'Other Liabilities'].includes(account.type);
  const isBankCard = ['Checking', 'Savings', 'Credit Card'].includes(account.type);

  // Aesthetic color schemes per account type
  const themeStyles = {
    Checking: {
      gradient: 'from-[#0a1b38] via-[#09152b] to-[#0c0d12]',
      lightGradient: 'from-sky-100 via-blue-50/60 to-white',
      aura: 'rgba(56, 189, 248, 0.35)',
      cardBg: 'bg-gradient-to-br from-sky-500/25 via-blue-600/20 to-indigo-900/30',
      accentNeon: '#38bdf8',
      textAccent: 'text-sky-600 dark:text-sky-400',
      icon: 'payments',
    },
    Savings: {
      gradient: 'from-[#062419] via-[#081b14] to-[#0c0d12]',
      lightGradient: 'from-emerald-100 via-teal-50/60 to-white',
      aura: 'rgba(52, 211, 153, 0.35)',
      cardBg: 'bg-gradient-to-br from-emerald-500/25 via-teal-600/20 to-emerald-950/30',
      accentNeon: '#34d399',
      textAccent: 'text-emerald-600 dark:text-emerald-400',
      icon: 'savings',
    },
    'Credit Card': {
      gradient: 'from-[#2b0d18] via-[#1b0a12] to-[#0c0d12]',
      lightGradient: 'from-rose-100 via-pink-50/60 to-white',
      aura: 'rgba(255, 55, 95, 0.35)',
      cardBg: 'bg-gradient-to-br from-rose-500/25 via-pink-600/20 to-rose-950/40',
      accentNeon: '#ff375f',
      textAccent: 'text-rose-600 dark:text-rose-400',
      icon: 'credit_card',
    },
    Investment: {
      gradient: 'from-[#1e0e36] via-[#140a24] to-[#0c0d12]',
      lightGradient: 'from-purple-100 via-violet-50/60 to-white',
      aura: 'rgba(168, 85, 247, 0.35)',
      cardBg: 'bg-gradient-to-br from-purple-500/25 via-violet-600/20 to-indigo-950/30',
      accentNeon: '#a855f7',
      textAccent: 'text-purple-600 dark:text-purple-400',
      icon: 'trending_up',
    },
    Loan: {
      gradient: 'from-[#241010] via-[#170a0a] to-[#0c0d12]',
      lightGradient: 'from-red-100 via-rose-50/60 to-white',
      aura: 'rgba(244, 63, 94, 0.35)',
      cardBg: 'bg-gradient-to-br from-red-500/25 via-rose-700/20 to-zinc-950/40',
      accentNeon: '#f43f5e',
      textAccent: 'text-red-600 dark:text-red-400',
      icon: 'account_balance',
    },
    Lending: {
      gradient: 'from-[#062420] via-[#091a18] to-[#0c0d12]',
      lightGradient: 'from-teal-100 via-emerald-50/60 to-white',
      aura: 'rgba(20, 184, 166, 0.35)',
      cardBg: 'bg-gradient-to-br from-teal-500/25 via-emerald-600/20 to-teal-950/30',
      accentNeon: '#14b8a6',
      textAccent: 'text-teal-600 dark:text-teal-400',
      icon: 'account_balance',
    },
    Property: {
      gradient: 'from-[#26180a] via-[#1a1107] to-[#0c0d12]',
      lightGradient: 'from-amber-100 via-orange-50/60 to-white',
      aura: 'rgba(245, 158, 11, 0.35)',
      cardBg: 'bg-gradient-to-br from-amber-500/25 via-orange-600/20 to-amber-950/30',
      accentNeon: '#f59e0b',
      textAccent: 'text-amber-600 dark:text-amber-400',
      icon: 'location_on',
    },
    Vehicle: {
      gradient: 'from-[#141b26] via-[#0e131c] to-[#0c0d12]',
      lightGradient: 'from-slate-200 via-slate-100 to-white',
      aura: 'rgba(100, 116, 139, 0.35)',
      cardBg: 'bg-gradient-to-br from-slate-500/25 via-slate-700/20 to-slate-950/30',
      accentNeon: '#94a3b8',
      textAccent: 'text-slate-600 dark:text-slate-300',
      icon: 'directions_car',
    },
    'Other Assets': {
      gradient: 'from-[#1b2408] via-[#131a06] to-[#0c0d12]',
      lightGradient: 'from-lime-100 via-emerald-50/60 to-white',
      aura: 'rgba(163, 230, 53, 0.35)',
      cardBg: 'bg-gradient-to-br from-lime-500/25 via-emerald-600/20 to-lime-950/30',
      accentNeon: '#a3e635',
      textAccent: 'text-lime-600 dark:text-lime-400',
      icon: 'category',
    },
    'Other Liabilities': {
      gradient: 'from-[#2a0b22] via-[#1a0815] to-[#0c0d12]',
      lightGradient: 'from-pink-100 via-rose-50/60 to-white',
      aura: 'rgba(236, 72, 153, 0.35)',
      cardBg: 'bg-gradient-to-br from-pink-500/25 via-rose-600/20 to-pink-950/40',
      accentNeon: '#ec4899',
      textAccent: 'text-pink-600 dark:text-pink-400',
      icon: 'warning',
    },
  }[account.type] || {
    gradient: 'from-[#12141a] via-[#0c0d12] to-[#0c0d12]',
    lightGradient: 'from-slate-100 via-slate-50 to-white',
    aura: 'rgba(56, 189, 248, 0.35)',
    cardBg: 'bg-white/10',
    accentNeon: '#38bdf8',
    textAccent: 'text-sky-600 dark:text-sky-400',
    icon: 'wallet',
  };

  const isLinked = account.balanceSource === 'enable_banking' || Boolean(account.balanceLastSyncedAt);

  // --- RENDER HERO BANNER CONTENT PER ACCOUNT TYPE ---
  const renderHeroBannerCenter = () => {
    // 1. BANK / CARD ACCOUNTS: 3D Frosted Glass Payment / Banking Card
    if (isBankCard) {
      return (
        <div
          className={`relative w-full max-w-[340px] h-[155px] sm:h-[165px] rounded-2xl ${themeStyles.cardBg} backdrop-blur-2xl border border-white/20 p-4 sm:p-5 shadow-[0_20px_45px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.25)] flex flex-col justify-between overflow-hidden group hover:scale-[1.02] transition-transform duration-300`}
        >
          {/* Holographic Sheen Reflection */}
          <div className="absolute -inset-full bg-gradient-to-tr from-transparent via-white/10 to-transparent rotate-12 pointer-events-none" />

          {/* Card Top Row: Chip, Contactless Waves & Logo */}
          <div className="flex items-start justify-between relative z-10">
            <div className="flex items-center gap-3">
              {/* Golden EMV Smart Chip */}
              <div className="w-10 h-7 rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 p-0.5 shadow-xs border border-amber-300/60 flex flex-col justify-around">
                <div className="w-full h-px bg-amber-800/40" />
                <div className="flex justify-between px-1">
                  <div className="w-2 h-2 rounded-full border border-amber-800/40" />
                  <div className="w-2 h-2 rounded-full border border-amber-800/40" />
                </div>
                <div className="w-full h-px bg-amber-800/40" />
              </div>

              {/* Contactless Waves Icon */}
              <svg
                className="w-5 h-5 text-white/70"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M8.5 16.5a5 5 0 0 1 0-9" />
                <path d="M12 19a8.5 8.5 0 0 0 0-14" />
                <path d="M15.5 21.5a12 12 0 0 0 0-19" />
              </svg>
            </div>

            {/* Institution Monogram or Logo without padding */}
            {institutionLogoUrl && !logoLoadError ? (
              <div className="w-9 h-9 rounded-xl bg-white/90 shadow-sm flex items-center justify-center overflow-hidden">
                <img
                  src={institutionLogoUrl}
                  alt={account.financialInstitution || account.name}
                  className="w-full h-full object-cover p-0 border-0"
                  onError={() => setLogoLoadError(true)}
                />
              </div>
            ) : (
              <div className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/15 text-2xs font-bold uppercase tracking-wider text-white">
                {account.financialInstitution || account.type}
              </div>
            )}
          </div>

          {/* Card Bottom Row: Masked Number, Cardholder / Account Name & Network Logo */}
          <div className="relative z-10 space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-sm sm:text-base font-mono font-bold tracking-[0.22em] text-white/90 drop-shadow-sm">
                {account.last4
                  ? `•••• •••• •••• ${account.last4}`
                  : account.accountNumber
                  ? `•••• ${account.accountNumber.slice(-4)}`
                  : `${account.type.toUpperCase()}`}
              </p>

              {cardNetworkLogoUrl ? (
                <img
                  src={cardNetworkLogoUrl}
                  alt={account.cardNetwork || 'Network'}
                  className="h-4 sm:h-5 object-contain p-0 border-0"
                />
              ) : account.currency ? (
                <span className="text-2xs font-mono font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/80 border border-white/10">
                  {account.currency}
                </span>
              ) : null}
            </div>

            <div className="flex items-center justify-between text-2xs font-medium text-white/70">
              <span className="truncate max-w-[180px] uppercase tracking-wider font-semibold">
                {account.cardholderName || account.name}
              </span>
              {account.expirationDate && (
                <span className="font-mono text-white/80">EXP {account.expirationDate}</span>
              )}
            </div>
          </div>
        </div>
      );
    }

    // 2. VEHICLE ACCOUNTS: Digital Cockpit & European License Plate HUD
    if (account.type === 'Vehicle') {
      const latestMileage = account.mileageLogs?.length
        ? account.mileageLogs[account.mileageLogs.length - 1].reading
        : null;

      return (
        <div className="relative w-full max-w-[340px] h-[155px] sm:h-[165px] rounded-2xl bg-gradient-to-br from-slate-600/30 via-slate-800/25 to-zinc-950/40 backdrop-blur-2xl border border-white/20 p-3.5 sm:p-4 shadow-[0_20px_45px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.25)] flex flex-col justify-between overflow-hidden">
          {/* Header Row: Vehicle Make & Model Title + Ownership */}
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-slate-500/20 border border-white/15 flex items-center justify-center shrink-0 text-slate-200">
                <Icon name="directions_car" className="text-base" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-white truncate leading-tight">
                  {account.year ? `${account.year} ` : ''}
                  {account.make ? `${account.make} ` : ''}
                  {account.model || account.name}
                </p>
                <p className="text-2xs text-gray-400 font-medium capitalize">
                  {account.ownership || 'Vehicle'} {account.fuelType ? `• ${account.fuelType}` : ''}
                </p>
              </div>
            </div>

            <span className="px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300 border border-white/10 text-2xs font-bold uppercase tracking-wider shrink-0">
              {account.ownership === 'Leased' ? 'Lease' : 'Owned'}
            </span>
          </div>

          {/* Centerpiece: Authentic European Stamped License Plate Badge */}
          <div className="relative z-10 flex justify-center my-0.5">
            <div className="inline-flex items-center bg-[#fdfdfd] text-[#111] rounded-md px-1.5 py-0.5 border-2 border-[#2b2b2b] shadow-md">
              {/* Blue EU Flag Band */}
              <div className="w-5 h-7 rounded-xs bg-[#003399] flex flex-col items-center justify-around py-0.5 px-0.5 mr-2">
                <div className="text-[7px] text-amber-300 leading-none">★★</div>
                <span className="text-[9px] font-black text-white font-mono leading-none">
                  {account.registrationCountryCode || 'EU'}
                </span>
              </div>
              {/* Embossed Bold Plate Digits */}
              <span className="text-sm sm:text-base font-black font-mono tracking-widest text-[#111] px-1">
                {account.licensePlate || '1-CRY-911'}
              </span>
            </div>
          </div>

          {/* Bottom Telematics Grid */}
          <div className="relative z-10 flex items-center justify-between text-2xs font-semibold text-gray-300 pt-1 border-t border-white/10">
            <div className="flex items-center gap-1 font-mono text-slate-200">
              <Icon name="speed" className="text-2xs text-sky-400" />
              <span>{latestMileage ? `${latestMileage.toLocaleString()} km` : 'Active Odo'}</span>
            </div>

            {account.vin && (
              <span className="font-mono text-gray-400 text-2xs">
                VIN •••• {account.vin.slice(-5)}
              </span>
            )}
          </div>
        </div>
      );
    }

    // 3. PROPERTY ACCOUNTS: Architectural Blueprint & Estate Specs HUD
    if (account.type === 'Property') {
      return (
        <div className="relative w-full max-w-[340px] h-[155px] sm:h-[165px] rounded-2xl bg-gradient-to-br from-amber-500/20 via-orange-600/15 to-amber-950/40 backdrop-blur-2xl border border-amber-500/25 p-3.5 sm:p-4 shadow-[0_20px_45px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.2)] flex flex-col justify-between overflow-hidden">
          {/* Blueprint Grid Lines Overlay */}
          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />

          {/* Header Row: Estate Type & Location */}
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/20 flex items-center justify-center shrink-0 text-amber-300">
                <Icon name="home" className="text-base" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-white truncate leading-tight">
                  {account.propertyType || 'Real Estate Asset'}
                </p>
                <p className="text-2xs text-amber-200/70 truncate">
                  {account.address || 'Property Valuation'}
                </p>
              </div>
            </div>

            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-2xs font-bold uppercase tracking-wider shrink-0">
              Estate
            </span>
          </div>

          {/* Center 4-Spec Blueprint Grid */}
          <div className="relative z-10 grid grid-cols-4 gap-1.5 py-1">
            <div className="bg-black/30 rounded-xl p-1.5 text-center border border-white/5">
              <span className="text-2xs text-gray-400 block font-bold">Area</span>
              <span className="text-xs font-black font-mono text-amber-300">
                {account.propertySize ? `${account.propertySize}m²` : '—'}
              </span>
            </div>
            <div className="bg-black/30 rounded-xl p-1.5 text-center border border-white/5">
              <span className="text-2xs text-gray-400 block font-bold">Beds</span>
              <span className="text-xs font-black font-mono text-white">
                {account.bedrooms ?? '—'}
              </span>
            </div>
            <div className="bg-black/30 rounded-xl p-1.5 text-center border border-white/5">
              <span className="text-2xs text-gray-400 block font-bold">Baths</span>
              <span className="text-xs font-black font-mono text-white">
                {account.bathrooms ?? '—'}
              </span>
            </div>
            <div className="bg-black/30 rounded-xl p-1.5 text-center border border-white/5">
              <span className="text-2xs text-gray-400 block font-bold">Built</span>
              <span className="text-xs font-black font-mono text-white">
                {account.yearBuilt ?? '—'}
              </span>
            </div>
          </div>

          {/* Bottom Row: Purchase vs Valuation Info */}
          <div className="relative z-10 flex items-center justify-between text-2xs text-gray-300 pt-1 border-t border-white/10 font-mono">
            <span>
              {account.purchasePrice
                ? `Acquired: ${formatCurrency(account.purchasePrice, account.currency)}`
                : 'Primary Residence'}
            </span>
            {account.linkedLoanId && (
              <span className="text-amber-400 font-bold">Mortgaged</span>
            )}
          </div>
        </div>
      );
    }

    // 4. LOAN & MORTGAGE & LENDING ACCOUNTS: Amortization Payoff & Agreement Shield HUD
    if (account.type === 'Loan' || account.type === 'Lending') {
      const isLending = account.type === 'Lending';
      const payoff = loanPayoffMetrics;

      return (
        <div
          className={`relative w-full max-w-[340px] h-[155px] sm:h-[165px] rounded-2xl backdrop-blur-2xl p-3.5 sm:p-4 shadow-[0_20px_45px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.2)] flex flex-col justify-between overflow-hidden ${
            isLending
              ? 'bg-gradient-to-br from-teal-500/25 via-emerald-600/20 to-teal-950/40 border border-teal-500/30'
              : 'bg-gradient-to-br from-rose-500/20 via-red-700/15 to-zinc-950/40 border border-rose-500/25'
          }`}
        >
          {/* Header Row: Loan Agreement Type & Lender */}
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                  isLending
                    ? 'bg-teal-500/20 border-teal-400/20 text-teal-300'
                    : 'bg-rose-500/20 border-rose-400/20 text-rose-300'
                }`}
              >
                <Icon name={isLending ? 'coins_stacked' : 'account_balance'} className="text-base" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-white truncate leading-tight">
                  {account.name}
                </p>
                <p
                  className={`text-2xs truncate ${
                    isLending ? 'text-teal-200/70' : 'text-rose-200/70'
                  }`}
                >
                  {account.financialInstitution || (isLending ? 'Private Lending' : 'Credit Agreement')}
                </p>
              </div>
            </div>

            <span
              className={`px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider shrink-0 border ${
                isLending
                  ? 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              }`}
            >
              {isLending ? 'Receivable' : 'Liability'}
            </span>
          </div>

          {/* Centerpiece: Debt Payoff / Collection Progress Bar */}
          <div className="relative z-10 bg-black/40 p-2.5 rounded-xl border border-white/10 space-y-1.5">
            <div className="flex items-center justify-between text-2xs font-bold">
              <span className="text-gray-300">
                {isLending ? 'Collection Progress' : 'Payoff Progress'}
              </span>
              <span
                className={`font-mono font-black ${
                  isLending ? 'text-teal-400' : 'text-emerald-400'
                }`}
              >
                {payoff
                  ? `${payoff.percentage}% ${isLending ? 'Collected' : 'Repaid'}`
                  : `${account.interestRate || 0}% APR`}
              </span>
            </div>
            {/* Visual Progress Bar */}
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isLending
                    ? 'bg-gradient-to-r from-teal-400 to-emerald-400'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                }`}
                style={{ width: `${payoff !== null ? payoff.percentage : 0}%` }}
              />
            </div>
            {payoff && (
              <div className="flex items-center justify-between text-2xs font-mono text-gray-400 pt-0.5">
                <span>
                  {isLending ? 'Received:' : 'Paid:'} {formatCurrency(payoff.paid, account.currency)}
                </span>
                <span>
                  {isLending ? 'Remaining:' : 'Left:'} {formatCurrency(payoff.remaining, account.currency)}
                </span>
              </div>
            )}
          </div>

          {/* Bottom Agreement Terms */}
          <div className="relative z-10 flex items-center justify-between text-2xs text-gray-300 pt-1 border-t border-white/10 font-mono">
            <span>
              {account.monthlyPayment
                ? `€${account.monthlyPayment.toLocaleString()} / mo`
                : `${account.duration || 0} Mos Term`}
            </span>
            {account.interestRate !== undefined && (
              <span className={isLending ? 'text-teal-400 font-bold' : 'text-rose-400 font-bold'}>
                {account.interestRate}% {isLending ? 'Interest Yield' : 'Fixed APR'}
              </span>
            )}
          </div>
        </div>
      );
    }

    // 5. INVESTMENT ACCOUNTS: Trading Terminal & Market Candlestick Wave HUD
    if (account.type === 'Investment') {
      return (
        <div className="relative w-full max-w-[340px] h-[155px] sm:h-[165px] rounded-2xl bg-gradient-to-br from-purple-500/25 via-violet-600/20 to-indigo-950/40 backdrop-blur-2xl border border-purple-500/30 p-3.5 sm:p-4 shadow-[0_20px_45px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.25)] flex flex-col justify-between overflow-hidden">
          {/* Header Row: SubType & Symbol Header */}
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/20 flex items-center justify-center shrink-0 text-purple-300">
                <Icon name="trending_up" className="text-base" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-white truncate leading-tight">
                  {account.symbol ? `${account.symbol} • ` : ''}
                  {account.name}
                </p>
                <p className="text-2xs text-purple-200/70 truncate font-semibold">
                  {account.subType || 'Investment Portfolio'}
                </p>
              </div>
            </div>

            <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-2xs font-bold uppercase tracking-wider shrink-0 font-mono">
              {account.symbol || 'ASSET'}
            </span>
          </div>

          {/* Centerpiece: Glowing Neon Candlestick & Market Waves */}
          <div className="relative z-10 flex items-center justify-between bg-black/40 px-3 py-2 rounded-xl border border-white/10">
            <div className="flex items-center gap-2">
              <svg className="w-16 h-7 text-emerald-400 shrink-0" viewBox="0 0 64 28" fill="none">
                <path
                  d="M2 22L14 16L24 20L38 8L48 12L62 2"
                  stroke="#34d399"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="62" cy="2" r="3" fill="#34d399" />
              </svg>
              <div className="text-2xs font-bold text-white leading-tight">
                <span className="text-emerald-400 block font-mono">Market Asset</span>
                <span className="text-gray-400 font-medium">Active Position</span>
              </div>
            </div>

            {account.expectedRetirementYear ? (
              <span className="px-2 py-1 rounded-lg bg-purple-500/20 text-purple-200 text-2xs font-bold font-mono">
                Retires {account.expectedRetirementYear}
              </span>
            ) : (
              <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-2xs font-bold font-mono">
                Allocated
              </span>
            )}
          </div>

          {/* Bottom Terminal Row */}
          <div className="relative z-10 flex items-center justify-between text-2xs text-gray-300 pt-1 border-t border-white/10 font-mono">
            <span>{account.financialInstitution || 'Brokerage Asset'}</span>
            <span className="text-purple-300 font-bold">{account.currency} Base</span>
          </div>
        </div>
      );
    }

    // 6. OTHER ASSETS & OTHER LIABILITIES: Vault Certificate / Security Seal HUD
    return (
      <div className="relative w-full max-w-[340px] h-[155px] sm:h-[165px] rounded-2xl bg-gradient-to-br from-lime-500/20 via-emerald-600/15 to-zinc-950/40 backdrop-blur-2xl border border-lime-500/25 p-3.5 sm:p-4 shadow-[0_20px_45px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.2)] flex flex-col justify-between overflow-hidden">
        {/* Header Row */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-lime-500/20 border border-lime-400/20 flex items-center justify-center shrink-0 text-lime-300">
              <Icon name="category" className="text-base" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-white truncate leading-tight">
                {account.name}
              </p>
              <p className="text-2xs text-lime-200/70 truncate">
                {account.otherSubType || account.type}
              </p>
            </div>
          </div>

          <span className="px-2 py-0.5 rounded-full bg-lime-500/20 text-lime-300 border border-lime-500/30 text-2xs font-bold uppercase tracking-wider shrink-0">
            {account.type}
          </span>
        </div>

        {/* Centerpiece: Vault Custody Seal */}
        <div className="relative z-10 flex items-center justify-between bg-black/40 px-3 py-2 rounded-xl border border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-lime-400/20 border border-lime-400/40 flex items-center justify-center text-lime-300 text-xs">
              💎
            </div>
            <div className="text-2xs font-bold text-white">
              <span className="block font-mono text-lime-300">
                {account.assetCondition || 'Verified Valuation'}
              </span>
              <span className="text-gray-400 font-medium">Physical Asset</span>
            </div>
          </div>

          {account.location && (
            <span className="text-2xs text-gray-300 font-mono truncate max-w-[110px]">
              📍 {account.location}
            </span>
          )}
        </div>

        {/* Bottom Row */}
        <div className="relative z-10 flex items-center justify-between text-2xs text-gray-300 pt-1 border-t border-white/10 font-mono">
          <span>{account.counterparty ? `Party: ${account.counterparty}` : 'Self-Custody'}</span>
          <span className="text-lime-400 font-bold">{account.currency}</span>
        </div>
      </div>
    );
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto no-scrollbar">
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Portrait Apple Workout Overview Card */}
      <div
        className={`relative w-full max-w-[430px] max-h-[94vh] sm:max-h-[90vh] bg-white dark:bg-[#0c0d12] text-slate-900 dark:text-white rounded-[2.5rem] sm:rounded-[2.75rem] shadow-2xl dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.95)] border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden transform transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isVisible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* Top Floating Glass Controls */}
        <div className="absolute top-4 left-4 right-4 z-40 flex items-center justify-between pointer-events-none">
          {/* Account Status / Sync Badge */}
          <div className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 dark:bg-black/60 backdrop-blur-md border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white text-xs font-semibold shadow-md">
            <Icon
              name={isLinked ? 'sync' : themeStyles.icon}
              className={`text-xs ${themeStyles.textAccent} ${isLinked ? 'animate-pulse' : ''}`}
            />
            <span className="truncate max-w-[190px]">
              {account.status === 'closed'
                ? 'Archived Account'
                : isLinked
                ? 'Live Banking Sync'
                : `${account.type} Account`}
            </span>
          </div>

          {/* Close Button Only */}
          <div className="pointer-events-auto flex items-center">
            <button
              type="button"
              onClick={handleClose}
              className="w-9 h-9 rounded-full bg-white/90 dark:bg-black/60 backdrop-blur-md border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/20 text-slate-800 dark:text-white flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95"
              title="Close (Esc)"
            >
              <Icon name="close" className="text-base" />
            </button>
          </div>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto pb-8 safe-bottom no-scrollbar">
          {/* 1. TOP HERO DYNAMIC BANNER (RELEVANT PER ACCOUNT TYPE) */}
          <div
            className={`relative w-full h-[320px] sm:h-[345px] bg-gradient-to-b ${isDarkMode ? themeStyles.gradient : themeStyles.lightGradient} overflow-hidden shrink-0 flex flex-col justify-between`}
          >
            {/* Ambient Background Aura Glows & Geometry */}
            <div
              className="absolute -top-16 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full blur-3xl opacity-40 pointer-events-none"
              style={{ backgroundColor: themeStyles.aura }}
            />
            <div className="absolute inset-0 opacity-25 dark:opacity-15 bg-[radial-gradient(#0284c7_1px,transparent_1px)] dark:bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />

            {/* Subtle Circuit / Concentric Rings */}
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full border border-slate-300/40 dark:border-white/5 pointer-events-none" />
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full border border-slate-300/40 dark:border-white/5 pointer-events-none" />

            {/* CENTER: DYNAMIC 3D SHOWCASE HUD PER ACCOUNT TYPE */}
            <div className="relative z-10 pt-14 sm:pt-16 px-6 sm:px-8 flex justify-center">
              {renderHeroBannerCenter()}
            </div>

            {/* Bottom Gradient Shade Overlay (blends banner effortlessly into body) */}
            <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-white via-white/90 to-transparent dark:from-[#0c0d12] dark:via-[#0c0d12]/90 dark:to-transparent pointer-events-none z-[15]" />

            {/* Float Overlay Content: Title & Highlight Metric over bottom of hero */}
            <div className="relative inset-x-0 bottom-0 p-5 sm:p-6 z-[20] space-y-1 pointer-events-auto">
              <div className="flex items-center gap-2 text-2xs font-semibold text-slate-600 dark:text-gray-400">
                <span className="text-slate-800 dark:text-gray-300 font-bold">
                  {account.financialInstitution || account.type}
                </span>
                <span>•</span>
                <span>{account.currency}</span>
                {account.last4 && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-slate-600 dark:text-gray-400">•••• {account.last4}</span>
                  </>
                )}
              </div>

              {/* Big Bold Apple Title */}
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight truncate leading-tight drop-shadow-xs dark:drop-shadow-sm">
                {account.name}
              </h2>

              {/* Fluorescent Apple Highlight Metric */}
              <div className="flex items-baseline gap-2 pt-0.5">
                <span
                  className={`text-3xl sm:text-4xl font-black font-mono tracking-tight ${
                    isDebt
                      ? 'text-rose-600 dark:text-[#ff375f] dark:drop-shadow-[0_0_15px_rgba(255,55,95,0.55)]'
                      : 'text-emerald-600 dark:text-[#34d399] dark:drop-shadow-[0_0_15px_rgba(52,211,153,0.55)]'
                  }`}
                >
                  {formatCurrency(displayBalance, account.currency)}
                </span>

                {account.currency !== 'EUR' && (
                  <span className="text-xs font-bold text-slate-600 dark:text-gray-400 font-mono">
                    ≈ {formatCurrency(eurBalance, 'EUR')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 2. APPLE CONTEXT WEATHER / METADATA PILLS */}
          <div className="px-5 sm:px-6 py-2.5 flex items-center gap-5 text-xs text-slate-700 dark:text-gray-300 border-b border-slate-200/80 dark:border-white/5 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 shrink-0">
              <Icon name={themeStyles.icon} className={`text-sm shrink-0 ${themeStyles.textAccent}`} />
              <div className="flex flex-col">
                <span className="text-2xs uppercase text-slate-600 dark:text-gray-400 font-bold tracking-wider">Classification</span>
                <span className="font-bold text-slate-900 dark:text-white text-xs">{account.type}</span>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-200 dark:bg-white/10 shrink-0" />

            <div className="flex items-center gap-1.5 shrink-0">
              <Icon name="account_balance" className="text-sky-600 dark:text-sky-400 text-sm shrink-0" />
              <div className="flex flex-col">
                <span className="text-2xs uppercase text-slate-600 dark:text-gray-400 font-bold tracking-wider">Institution</span>
                <span className="font-bold text-slate-900 dark:text-white text-xs truncate max-w-[110px]">
                  {account.financialInstitution || 'Direct'}
                </span>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-200 dark:bg-white/10 shrink-0" />

            <div className="flex items-center gap-1.5 shrink-0">
              <Icon
                name={isLinked ? 'sync' : 'tune'}
                className={`text-sm shrink-0 ${isLinked ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500 dark:text-amber-400'}`}
              />
              <div className="flex flex-col">
                <span className="text-2xs uppercase text-slate-600 dark:text-gray-400 font-bold tracking-wider">Feed Sync</span>
                <span className="font-bold text-slate-900 dark:text-white text-xs">
                  {isLinked ? 'Live Banking' : 'Manual'}
                </span>
              </div>
            </div>

            {account.apy !== undefined && (
              <>
                <div className="h-6 w-px bg-slate-200 dark:bg-white/10 shrink-0" />
                <div className="flex items-center gap-1.5 shrink-0">
                  <Icon name="trending_up" className="text-emerald-600 dark:text-emerald-400 text-sm shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-2xs uppercase text-slate-600 dark:text-gray-400 font-bold tracking-wider">APY Yield</span>
                    <span className="font-bold text-slate-900 dark:text-white text-xs font-mono">{account.apy}%</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 3. "ACCOUNT INTELLIGENCE >" INTERACTIVE STRIP */}
          <div className="px-5 sm:px-6 py-4 flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
              <span>Account Intelligence</span>
            </h3>

            {onViewAccount ? (
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  setTimeout(() => onViewAccount(account.id), 100);
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-lime-700 dark:text-[#a3e635] hover:text-slate-950 dark:hover:text-white transition-colors cursor-pointer group py-1 px-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 active:scale-95"
              >
                <span>Full View</span>
                <Icon
                  name="chevron_right"
                  className="text-sm transition-transform group-hover:translate-x-0.5"
                />
              </button>
            ) : onEditAccount ? (
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  setTimeout(() => onEditAccount(account), 100);
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-lime-700 dark:text-[#a3e635] hover:text-slate-950 dark:hover:text-white transition-colors cursor-pointer group py-1 px-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 active:scale-95"
              >
                <span>Edit Account</span>
                <Icon
                  name="chevron_right"
                  className="text-sm transition-transform group-hover:translate-x-0.5"
                />
              </button>
            ) : null}
          </div>

          {/* 4. APPLE WORKOUT 2x2 METRIC GRID CARD */}
          <div className="px-5 sm:px-6 pb-6 space-y-4">
            <div className="p-5 sm:p-6 rounded-3xl bg-slate-50 dark:bg-[#181920] border border-slate-200/80 dark:border-white/5 space-y-5 shadow-xs dark:shadow-inner">
              <div className="grid grid-cols-2 gap-5">
                {/* Metric 1: Position / 30-Day Activity */}
                <div className="space-y-1.5">
                  <p className="text-2xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider">
                    {account.type === 'Investment' && investmentHoldingMetrics
                      ? 'Held Position'
                      : '30-Day Activity'}
                  </p>
                  <p className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400 truncate leading-tight font-mono">
                    {account.type === 'Investment' && investmentHoldingMetrics
                      ? investmentHoldingMetrics.netShares > 0
                        ? `${investmentHoldingMetrics.netShares.toLocaleString()} Units`
                        : `${investmentHoldingMetrics.tradesCount} Events`
                      : `${metrics.txCount30d} ${metrics.txCount30d === 1 ? 'Event' : 'Events'}`}
                  </p>
                  <p className="text-2xs text-slate-500 dark:text-gray-500 font-mono">
                    {account.type === 'Investment' && investmentHoldingMetrics
                      ? `Invested: ${formatCurrency(investmentHoldingMetrics.investedCapital, account.currency)}`
                      : `${formatCurrency(metrics.volume30d, account.currency)} Vol`}
                  </p>
                </div>

                {/* Metric 2: Net Cash Flow or Unrealized Gain */}
                <div className="space-y-1.5 text-right">
                  <p className="text-2xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider">
                    {account.type === 'Investment' && investmentHoldingMetrics
                      ? 'Unrealized P&L'
                      : '30D Net Flow'}
                  </p>
                  <p
                    className={`text-sm sm:text-base font-black truncate leading-tight font-mono ${
                      account.type === 'Investment' && investmentHoldingMetrics
                        ? investmentHoldingMetrics.unrealizedGain >= 0
                          ? 'text-emerald-600 dark:text-[#34d399]'
                          : 'text-rose-600 dark:text-[#ff375f]'
                        : metrics.netFlow30d >= 0
                        ? 'text-emerald-600 dark:text-[#34d399]'
                        : 'text-rose-600 dark:text-[#ff375f]'
                    }`}
                  >
                    {account.type === 'Investment' && investmentHoldingMetrics ? (
                      <>
                        {investmentHoldingMetrics.unrealizedGain >= 0 ? '+' : ''}
                        {formatCurrency(investmentHoldingMetrics.unrealizedGain, account.currency)}
                      </>
                    ) : (
                      <>
                        {metrics.netFlow30d >= 0 ? '+' : ''}
                        {formatCurrency(metrics.netFlow30d, account.currency)}
                      </>
                    )}
                  </p>
                  <p className="text-2xs text-slate-500 dark:text-gray-500 font-mono">
                    {account.type === 'Investment' && investmentHoldingMetrics ? (
                      <>
                        {investmentHoldingMetrics.gainPercent >= 0 ? '+' : ''}
                        {investmentHoldingMetrics.gainPercent.toFixed(1)}% Return
                      </>
                    ) : (
                      <>
                        +{formatCurrency(metrics.inflows30d, account.currency)} in / -
                        {formatCurrency(metrics.outflows30d, account.currency)} out
                      </>
                    )}
                  </p>
                </div>

                {/* Metric 3: Average Ticket or Market Price */}
                <div className="space-y-1.5">
                  <p className="text-2xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider">
                    {account.type === 'Investment' && investmentHoldingMetrics
                      ? 'Market Quote'
                      : 'Average Ticket'}
                  </p>
                  <p className="text-sm sm:text-base font-black text-sky-600 dark:text-[#38bdf8] truncate leading-tight font-mono">
                    {account.type === 'Investment' && investmentHoldingMetrics
                      ? investmentHoldingMetrics.currentPrice > 0
                        ? formatCurrency(investmentHoldingMetrics.currentPrice, account.currency)
                        : formatCurrency(account.balance, account.currency)
                      : formatCurrency(metrics.avgTicket, account.currency)}
                  </p>
                  <p className="text-2xs text-slate-500 dark:text-gray-500 font-mono">
                    {account.type === 'Investment' ? 'Live Unit Price' : 'Per Event (30d)'}
                  </p>
                </div>

                {/* Metric 4: Account Specific Highlights */}
                <div className="space-y-1.5 text-right">
                  <p className="text-2xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider">
                    {account.type === 'Investment'
                      ? 'Portfolio Class'
                      : account.type === 'Credit Card' && account.creditLimit
                      ? 'Available Limit'
                      : account.type === 'Loan' && account.interestRate !== undefined
                      ? 'Interest Rate'
                      : account.type === 'Vehicle' && account.mileageLogs?.length
                      ? 'Odometer'
                      : account.type === 'Property' && account.propertySize
                      ? 'Floor Area'
                      : 'Last Activity'}
                  </p>
                  <p className="text-sm sm:text-base font-black text-purple-600 dark:text-[#c084fc] truncate leading-tight font-mono">
                    {account.type === 'Investment'
                      ? account.subType || 'Brokerage Asset'
                      : account.type === 'Credit Card' && account.creditLimit
                      ? formatCurrency(
                          Math.max(0, account.creditLimit - Math.abs(displayBalance)),
                          account.currency
                        )
                      : account.type === 'Loan' && account.interestRate !== undefined
                      ? `${account.interestRate}% APR`
                      : account.type === 'Vehicle' && account.mileageLogs?.length
                      ? `${account.mileageLogs[account.mileageLogs.length - 1].reading.toLocaleString()} km`
                      : account.type === 'Property' && account.propertySize
                      ? `${account.propertySize} m²`
                      : metrics.lastActive
                      ? parseLocalDate(metrics.lastActive).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'No Events'}
                  </p>
                  <p className="text-2xs text-slate-500 dark:text-gray-500 font-mono">
                    {account.type === 'Investment' && investmentHoldingMetrics
                      ? `${investmentHoldingMetrics.tradesCount} Trade Orders`
                      : account.type === 'Credit Card' && account.creditLimit
                      ? `Limit: ${formatCurrency(account.creditLimit, account.currency)}`
                      : account.type === 'Loan' && account.duration
                      ? `${account.duration} Mos Term`
                      : 'Observed State'}
                  </p>
                </div>
              </div>

              {/* RECENT TRANSACTIONS PREVIEW SECTION */}
              {metrics.recentTxs.length > 0 && (
                <div className="pt-4 border-t border-slate-200 dark:border-white/5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-2xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider">
                      Recent Activity
                    </p>
                    {onNavigateToTransactions && (
                      <button
                        type="button"
                        onClick={() => {
                          handleClose();
                          setTimeout(
                            () => onNavigateToTransactions({ accountName: account.name }),
                            100
                          );
                        }}
                        className="text-2xs font-bold text-lime-700 dark:text-[#a3e635] hover:underline cursor-pointer inline-flex items-center gap-0.5"
                      >
                        <span>View All ({accountTransactions.length})</span>
                        <Icon name="arrow_forward" className="text-2xs" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {metrics.recentTxs.map(tx => {
                      const isIncome = tx.type === 'income';
                      const txDate = parseLocalDate(tx.date);
                      return (
                        <div
                          key={tx.id}
                          onClick={() => {
                            setSelectedTx(tx);
                            setIsTxModalOpen(true);
                          }}
                          className="flex items-center justify-between p-2.5 rounded-2xl bg-white dark:bg-black/30 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200/80 dark:border-white/5 cursor-pointer transition-colors group/tx shadow-xs dark:shadow-none"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center shrink-0 border border-slate-200 dark:border-white/5 group-hover/tx:border-slate-300 dark:group-hover/tx:border-white/20 transition-colors">
                              <Icon
                                name={isIncome ? 'arrow_downward' : 'shopping_bag'}
                                className={`text-xs ${
                                  isIncome ? 'text-emerald-600 dark:text-[#34d399]' : 'text-slate-500 dark:text-gray-400'
                                }`}
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover/tx:text-lime-700 dark:group-hover/tx:text-[#a3e635] transition-colors">
                                {tx.merchant || tx.description}
                              </p>
                              <p className="text-2xs text-slate-500 dark:text-gray-500 font-mono">
                                {txDate.toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                                {tx.category ? ` • ${tx.category}` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span
                              className={`text-xs font-bold font-mono ${
                                isIncome ? 'text-emerald-600 dark:text-[#34d399]' : 'text-slate-900 dark:text-white'
                              }`}
                            >
                              {isIncome ? '+' : ''}
                              {formatCurrency(tx.amount, tx.currency)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SPECIFIC ACCOUNT IDENTIFIERS & METADATA */}
              {(account.accountNumber || account.routingNumber || (account as any).iban) && (
                <div className="pt-4 border-t border-slate-200 dark:border-white/5 space-y-2">
                  <p className="text-2xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider">
                    Banking Identifiers
                  </p>
                  <div className="space-y-1.5">
                    {(account.accountNumber || (account as any).iban) && (
                      <div className="flex items-center justify-between bg-white dark:bg-black/30 p-2.5 rounded-2xl border border-slate-200/80 dark:border-white/5 text-xs shadow-xs dark:shadow-none">
                        <div>
                          <span className="text-2xs text-slate-600 dark:text-gray-500 uppercase font-bold tracking-wider block">
                            IBAN / Account Number
                          </span>
                          <span className="font-mono text-slate-900 dark:text-white font-semibold">
                            {account.accountNumber || (account as any).iban}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(
                              account.accountNumber || (account as any).iban || '',
                              'accountNumber'
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-2xs font-bold text-slate-800 dark:text-white transition-colors cursor-pointer"
                        >
                          {copiedField === 'accountNumber' ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    )}

                    {account.routingNumber && (
                      <div className="flex items-center justify-between bg-white dark:bg-black/30 p-2.5 rounded-2xl border border-slate-200/80 dark:border-white/5 text-xs shadow-xs dark:shadow-none">
                        <div>
                          <span className="text-2xs text-slate-600 dark:text-gray-500 uppercase font-bold tracking-wider block">
                            BIC / Routing Code
                          </span>
                          <span className="font-mono text-slate-900 dark:text-white font-semibold">
                            {account.routingNumber}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(account.routingNumber || '', 'routing')}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-2xs font-bold text-slate-800 dark:text-white transition-colors cursor-pointer"
                        >
                          {copiedField === 'routing' ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ACTION BUTTONS FOOTER */}
              <div className="pt-4 border-t border-slate-200 dark:border-white/5 flex flex-col gap-2">
                {account.type === 'Investment' && account.symbol && onOpenHoldingDetail ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      setTimeout(() => onOpenHoldingDetail(account.symbol!), 100);
                    }}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-98"
                  >
                    <Icon name="candlestick_chart" className="text-base text-white" />
                    <span>View Holding Analytics & Quotes</span>
                  </button>
                ) : onViewAccount ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      setTimeout(() => onViewAccount(account.id), 100);
                    }}
                    className="w-full py-3 rounded-2xl bg-lime-500 hover:bg-lime-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-98"
                  >
                    <Icon name="visibility" className="text-base text-slate-950" />
                    <span>Open Full Account View</span>
                  </button>
                ) : null}

                <div className="grid grid-cols-2 gap-2">
                  {onAdjustBalance && (
                    <button
                      type="button"
                      onClick={() => {
                        handleClose();
                        setTimeout(() => onAdjustBalance(account), 100);
                      }}
                      className="py-2.5 px-3 rounded-2xl bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-300 dark:border-white/10 text-slate-800 dark:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 shadow-xs dark:shadow-none"
                    >
                      <Icon name="tune" className="text-sm text-slate-500 dark:text-gray-400" />
                      <span>Adjust Balance</span>
                    </button>
                  )}

                  {onEditAccount && (
                    <button
                      type="button"
                      onClick={() => {
                        handleClose();
                        setTimeout(() => onEditAccount(account), 100);
                      }}
                      className="py-2.5 px-3 rounded-2xl bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-300 dark:border-white/10 text-slate-800 dark:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 shadow-xs dark:shadow-none"
                    >
                      <Icon name="edit" className="text-sm text-slate-500 dark:text-gray-400" />
                      <span>Edit Details</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Transaction Detail Modal for when a transaction is clicked */}
      {isTxModalOpen && selectedTx && (
        <TransactionDetailModal
          isOpen={isTxModalOpen}
          onClose={() => {
            setIsTxModalOpen(false);
            setSelectedTx(null);
          }}
          transactions={[selectedTx]}
          accounts={accounts.length > 0 ? accounts : [account]}
          tags={tags}
          allCategories={allCategories}
        />
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default AccountOverviewModal;
