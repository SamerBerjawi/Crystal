import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '../../../lib/utils';
import type {
  Account,
  AssetClosureDetails,
  Category,
  Currency,
  EnableBankingSyncOptions,
  Transaction,
} from '../../../types';
import type { EnableBankingLinkInfo } from '../../../contexts/DomainProviders';
import { usePreferencesContextOptional } from '../../../contexts/DomainProviders';
import { useCategoryContextOptional } from '../../../contexts/FinancialDataContext';
import {
  formatCurrency,
  normalizeCurrency,
  parseLocalDate,
  safeRound,
  toLocalISOString,
} from '../../../utils';
import { getMerchantLogoUrl } from '../../../utils/brandfetch';
import { AmountPad } from '../../kokonutui/amount-pad';
import { confirmNew } from '../ConfirmDialog';
import { Drawer, useMediaQuery } from '../Drawer';
import { AccountLogo, accountTypeIcon } from '../EntityIcon';
import { NvIcon } from '../NvIcon';
import { toast } from '../toast';
import { Badge, Button, IconButton, Money, SegmentedTabs, Switch } from '../ui';
import { currencySign } from './AccountFormSheet';
import { TxLedgerAvatar } from './detailShared';
import { LicensePlateNew } from './parts';

/*
 * Shared Drawers for `/accounts-new` and `/accounts-new/:id`:
 * 1. AccountOverviewSheet — Quick-peek account summary from the balance sheet list
 * 2. BalanceAdjustmentSheet — Reconcile account balance via a Balance Adjustment transaction
 * 3. ValuationSheet — Record/manage market valuations (`priceHistory`) for Property & Vehicle
 * 4. CloseAssetSheet — Dispose of a Property/Vehicle/Other Asset (Sold, Written Off, Gifted, etc.)
 * 5. EnableBankingSyncSheet — Configure & trigger Open Banking sync for a linked bank account
 */

/* ── 1. AccountOverviewSheet (Quick Peek Drawer) ────────────────────────── */

export const AccountOverviewSheet: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
  displayBalance: number;
  realTodayBalance: number;
  displayCurrency: Currency;
  convertedBalance: number;
  transactions: Transaction[];
  isLinkedBank?: boolean;
  allAccounts?: Account[];
  onOpenDetail: (account: Account) => void;
  onEdit: (account: Account) => void;
  onAdjustBalance: (account: Account) => void;
  onToggleStatus: (account: Account) => void;
  onDelete: (account: Account) => void;
  onNavigateToTransactions?: (accountName: string) => void;
}> = ({
  open,
  onOpenChange,
  account,
  displayBalance,
  realTodayBalance,
  displayCurrency,
  convertedBalance,
  transactions,
  isLinkedBank,
  allAccounts = [],
  onOpenDetail,
  onEdit,
  onAdjustBalance,
  onToggleStatus,
  onDelete,
  onNavigateToTransactions,
}) => {
  const lastAccountRef = React.useRef<Account | null>(account);
  if (account) {
    lastAccountRef.current = account;
  }
  const targetAccount = account ?? lastAccountRef.current;

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const prefContext = usePreferencesContextOptional();
  const catContext = useCategoryContextOptional();
  const effectiveClientId = (prefContext?.preferences?.brandfetchClientId || '').trim();
  const effectiveOverrides = useMemo(() => {
    const fromPrefs = prefContext?.preferences?.merchantLogoOverrides ?? {};
    const fromRules = Object.entries(prefContext?.preferences?.merchantRules ?? {}).reduce<
      Record<string, string>
    >((acc, [key, rule]) => {
      if (rule?.logo) acc[key] = rule.logo;
      return acc;
    }, {});
    return { ...fromPrefs, ...fromRules };
  }, [prefContext?.preferences?.merchantLogoOverrides, prefContext?.preferences?.merchantRules]);

  const accountsById = useMemo(
    () => new Map(allAccounts.map((a) => [a.id, a])),
    [allAccounts]
  );

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    const walk = (cats: Category[]) => {
      for (const c of cats) {
        map.set(c.name.toLowerCase(), c);
        map.set(c.id, c);
        if (c.subCategories?.length) walk(c.subCategories);
      }
    };
    if (catContext) {
      walk(catContext.incomeCategories || []);
      walk(catContext.expenseCategories || []);
    }
    return map;
  }, [catContext?.incomeCategories, catContext?.expenseCategories]);

  const getLogoForTx = (tx: Transaction): string | null => {
    if (tx.merchant && tx.merchant.trim()) {
      const url = getMerchantLogoUrl(tx.merchant.trim(), effectiveClientId, effectiveOverrides, {
        fallback: '404',
        type: 'icon',
        width: 80,
        height: 80,
      });
      if (url) return url;
    }

    if (tx.transferId && accountsById.size > 0) {
      const counterpartId = (tx as any).toAccountId || (tx as any).destinationAccountId;
      const otherAcc = counterpartId ? accountsById.get(counterpartId) : undefined;
      if (otherAcc) {
        if (otherAcc.imageUrl?.trim()) return otherAcc.imageUrl.trim();
        const inst = otherAcc.financialInstitution || otherAcc.name;
        if (inst) {
          const url = getMerchantLogoUrl(inst, effectiveClientId, effectiveOverrides, {
            fallback: '404',
            type: 'icon',
            width: 80,
            height: 80,
          });
          if (url) return url;
        }
      }
    }

    if (tx.description && tx.description.trim()) {
      const url = getMerchantLogoUrl(tx.description.trim(), effectiveClientId, effectiveOverrides, {
        fallback: '404',
        type: 'icon',
        width: 80,
        height: 80,
      });
      if (url) return url;
    }

    const isBankEntry =
      tx.isBalanceAdjustment ||
      tx.category === 'Interest' ||
      tx.category === 'Bank Fee' ||
      tx.category === 'Loan & Debt Payment' ||
      !tx.merchant;

    if (isBankEntry && targetAccount) {
      if (targetAccount.imageUrl?.trim()) return targetAccount.imageUrl.trim();
      if (targetAccount.financialInstitution?.trim()) {
        const url = getMerchantLogoUrl(
          targetAccount.financialInstitution.trim(),
          effectiveClientId,
          effectiveOverrides,
          { fallback: '404', type: 'icon', width: 80, height: 80 }
        );
        if (url) return url;
      }
    }

    return null;
  };

  const accountTxs = useMemo(() => {
    if (!targetAccount) return [];
    return [...transactions]
      .filter((t) => t.accountId === targetAccount.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [targetAccount, transactions]);

  // 30-Day Activity & Intelligence Metrics
  const metrics = useMemo(() => {
    if (!targetAccount) {
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

    accountTxs.forEach((t) => {
      const tDate = parseLocalDate(t.date);
      if (tDate >= thirtyDaysAgo && tDate <= now) {
        count30d += 1;
        volume30d += Math.abs(t.amount);
        if (t.type === 'income' || t.amount > 0) {
          inflows += Math.abs(t.amount);
        } else if (t.type === 'expense' || t.amount < 0) {
          outflows += Math.abs(t.amount);
        }
      }
    });

    const netFlow = inflows - outflows;
    const avgTicket = count30d > 0 ? volume30d / count30d : 0;
    const lastActive = accountTxs[0]?.date || null;
    const recentTxs = accountTxs.slice(0, 4);

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
  }, [targetAccount, accountTxs]);

  if (!targetAccount) return null;

  const isClosed = targetAccount.status === 'closed';
  const typeLabel = targetAccount.subType || targetAccount.otherSubType || targetAccount.type;
  const isDebt = ['Credit Card', 'Loan', 'Other Liabilities'].includes(targetAccount.type);
  const isBankCard = ['Checking', 'Savings', 'Credit Card'].includes(targetAccount.type);

  const handleCopy = (text: string, fieldId: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    toast.success(`Copied ${label} to clipboard`);
    setTimeout(() => {
      setCopiedField((prev) => (prev === fieldId ? null : prev));
    }, 2000);
  };

  const handleConfirmDelete = async () => {
    const ok = await confirmNew({
      title: `Delete "${targetAccount.name}" permanently?`,
      message:
        'This will permanently remove the account and all of its associated transactions and schedules. To keep historical records, archive/close the account instead.',
      confirmLabel: 'Hold to delete',
      danger: true,
    });
    if (ok) {
      onDelete(targetAccount);
      onOpenChange(false);
    }
  };

  // Linked Account Lookups
  const settlementAccount = targetAccount.settlementAccountId
    ? allAccounts.find((a) => a.id === targetAccount.settlementAccountId)
    : undefined;
  const linkedLoan = targetAccount.linkedLoanId
    ? allAccounts.find((a) => a.id === targetAccount.linkedLoanId)
    : undefined;
  const linkedAsset = targetAccount.linkedAssetId
    ? allAccounts.find((a) => a.id === targetAccount.linkedAssetId)
    : undefined;

  // Type-specific calculations
  const isCredit = targetAccount.type === 'Credit Card';
  const isLoanOrLending = targetAccount.type === 'Loan' || targetAccount.type === 'Lending';
  const isVehicle = targetAccount.type === 'Vehicle';
  const isProperty = targetAccount.type === 'Property';

  // Credit Card Metrics
  const creditLimit = targetAccount.creditLimit || 0;
  const creditBalanceOwed = Math.max(0, -displayBalance);
  const availableCredit = creditLimit > 0 ? Math.max(0, creditLimit - creditBalanceOwed) : 0;
  const creditUtilPct = creditLimit > 0 ? Math.min(100, Math.round((creditBalanceOwed / creditLimit) * 100)) : 0;

  // Loan Metrics
  const totalLoanPrincipal = targetAccount.principalAmount || targetAccount.totalAmount || 0;
  const outstandingLoanBalance = Math.abs(displayBalance);
  const paidLoanPrincipal = Math.max(0, totalLoanPrincipal - outstandingLoanBalance);
  const loanPaidPct =
    totalLoanPrincipal > 0 ? Math.min(100, Math.round((paidLoanPrincipal / totalLoanPrincipal) * 100)) : 0;

  // Vehicle Metrics
  const latestMileageLog =
    targetAccount.mileageLogs && targetAccount.mileageLogs.length > 0
      ? targetAccount.mileageLogs[targetAccount.mileageLogs.length - 1]
      : null;

  // Property Metrics
  const propertyEquity = linkedLoan
    ? Math.max(0, displayBalance - Math.abs(linkedLoan.balance))
    : displayBalance;

  const hasBankingIdentifiers =
    Boolean(targetAccount.accountNumber) ||
    Boolean(targetAccount.routingNumber) ||
    Boolean(targetAccount.last4) ||
    Boolean(targetAccount.vin);

  // Aura ambient accent color
  const auraColor = (() => {
    switch (targetAccount.type) {
      case 'Checking':
        return 'var(--nv-sky)';
      case 'Savings':
        return 'var(--nv-green)';
      case 'Credit Card':
        return 'var(--nv-red)';
      case 'Investment':
        return 'var(--nv-violet)';
      case 'Loan':
        return 'var(--nv-orange)';
      case 'Lending':
        return 'var(--nv-sky)';
      case 'Property':
        return 'var(--nv-orange)';
      case 'Vehicle':
        return 'var(--nv-sky)';
      default:
        return 'var(--nv-violet)';
    }
  })();

  // Render 3D Card HUD Centerpiece
  const renderHeroCenter = () => {
    // 1. BANK / CARD ACCOUNTS: 3D Frosted Glass Payment / Banking Card
    if (isBankCard) {
      return (
        <div className="relative w-full max-w-[340px] h-[160px] rounded-2xl bg-gradient-to-br from-nv-surface/90 via-nv-tile/80 to-nv-surface/70 backdrop-blur-2xl border border-nv-line/80 p-4 sm:p-5 shadow-nv-float flex flex-col justify-between overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
          {/* Holographic Sheen Reflection */}
          <div className="absolute -inset-full bg-gradient-to-tr from-transparent via-white/10 to-transparent rotate-12 pointer-events-none" />

          {/* Card Top Row: Chip, Contactless Waves & Logo */}
          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-3">
              {/* Golden EMV Smart Chip */}
              <div className="flex h-7 w-10 flex-col justify-around rounded-md border border-nv-orange/80 bg-nv-orange p-0.5 shadow-xs">
                <div className="h-px w-full bg-nv-ink/30" />
                <div className="flex justify-between px-1">
                  <div className="h-2 w-2 rounded-full border border-nv-ink/30" />
                  <div className="h-2 w-2 rounded-full border border-nv-ink/30" />
                </div>
                <div className="h-px w-full bg-nv-ink/30" />
              </div>

              {/* Contactless Waves Icon */}
              <svg
                className="w-5 h-5 text-nv-ink/60 dark:text-white/70"
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

            {/* Institution Monogram or Logo Tile */}
            <div className="w-9 h-9 rounded-xl bg-white shadow-xs border border-nv-line/50 flex items-center justify-center overflow-hidden">
              <AccountLogo account={targetAccount} size={36} rounded="xl" />
            </div>
          </div>

          {/* Card Bottom Row: Masked Number, Cardholder / Account Name & Network / Currency */}
          <div className="relative space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-sm sm:text-base font-bold tracking-[0.2em] text-nv-ink drop-shadow-xs">
                {targetAccount.last4
                  ? `•••• •••• •••• ${targetAccount.last4}`
                  : targetAccount.accountNumber
                  ? `•••• ${targetAccount.accountNumber.slice(-4)}`
                  : `${targetAccount.type.toUpperCase()}`}
              </p>

              {targetAccount.cardNetwork ? (
                <span className="rounded bg-nv-inset px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-nv-ink">
                  {targetAccount.cardNetwork.toUpperCase()}
                </span>
              ) : targetAccount.currency ? (
                <span className="rounded bg-nv-inset px-1.5 py-0.5 font-mono text-[10px] font-bold text-nv-muted">
                  {targetAccount.currency}
                </span>
              ) : null}
            </div>

            <div className="flex items-center justify-between text-[11px] font-medium text-nv-muted">
              <span className="truncate max-w-[190px] uppercase tracking-wider font-semibold text-nv-ink">
                {targetAccount.cardholderName || targetAccount.name}
              </span>
              {targetAccount.expirationDate && (
                <span className="font-mono text-nv-ink font-semibold">EXP {targetAccount.expirationDate}</span>
              )}
            </div>
          </div>
        </div>
      );
    }

    // 2. VEHICLE ACCOUNTS: Digital Cockpit & European License Plate HUD
    if (isVehicle) {
      return (
        <div className="relative w-full max-w-[340px] h-[160px] rounded-2xl bg-gradient-to-br from-nv-surface/90 via-nv-tile/80 to-nv-surface/70 backdrop-blur-2xl border border-nv-line/80 p-4 shadow-nv-float flex flex-col justify-between overflow-hidden">
          {/* Header Row: Vehicle Make & Model Title + Ownership */}
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-nv-inset flex items-center justify-center shrink-0 text-nv-ink">
                <NvIcon name="car" size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-nv-ink truncate leading-tight">
                  {[targetAccount.year, targetAccount.make, targetAccount.model].filter(Boolean).join(' ') ||
                    targetAccount.name}
                </p>
                <p className="text-[11px] text-nv-muted capitalize">
                  {targetAccount.ownership || 'Vehicle'} {targetAccount.fuelType ? `• ${targetAccount.fuelType}` : ''}
                </p>
              </div>
            </div>

            <span className="rounded-full bg-nv-inset px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-nv-muted shrink-0">
              {targetAccount.ownership === 'Leased' ? 'Lease' : 'Owned'}
            </span>
          </div>

          {/* Centerpiece: Authentic European Stamped License Plate Badge */}
          <div className="relative flex justify-center my-0.5">
            <LicensePlateNew
              plate={targetAccount.licensePlate || '1-CRY-911'}
              countryCode={targetAccount.registrationCountryCode || 'EU'}
              className="h-8 text-sm shadow-xs"
            />
          </div>

          {/* Bottom Telematics Grid */}
          <div className="relative flex items-center justify-between text-[11px] font-semibold text-nv-muted pt-1 border-t border-nv-line font-mono">
            <div className="flex items-center gap-1 text-nv-ink">
              <NvIcon name="sparkles" size={13} className="text-nv-sky-text" />
              <span>{latestMileageLog ? `${latestMileageLog.reading.toLocaleString()} km` : 'Active Odo'}</span>
            </div>

            {targetAccount.vin && (
              <span className="text-nv-muted text-[11px]">
                VIN •••• {targetAccount.vin.slice(-5)}
              </span>
            )}
          </div>
        </div>
      );
    }

    // 3. PROPERTY ACCOUNTS: Architectural Blueprint & Estate Specs HUD
    if (isProperty) {
      return (
        <div className="relative w-full max-w-[340px] h-[160px] rounded-2xl bg-gradient-to-br from-nv-surface/90 via-nv-tile/80 to-nv-surface/70 backdrop-blur-2xl border border-nv-line/80 p-4 shadow-nv-float flex flex-col justify-between overflow-hidden">
          {/* Blueprint Grid Lines Overlay */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(currentColor_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none text-nv-ink" />

          {/* Header Row: Estate Type & Location */}
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-nv-inset flex items-center justify-center shrink-0 text-nv-ink">
                <NvIcon name="home" size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-nv-ink truncate leading-tight">
                  {targetAccount.propertyType || 'Real Estate Asset'}
                </p>
                <p className="text-[11px] text-nv-muted truncate">
                  {targetAccount.address || 'Property Valuation'}
                </p>
              </div>
            </div>

            <span className="rounded-full bg-nv-orange-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-nv-orange-text shrink-0">
              Estate
            </span>
          </div>

          {/* Center 4-Spec Blueprint Grid */}
          <div className="relative grid grid-cols-4 gap-1.5 py-1">
            <div className="rounded-xl bg-nv-inset/70 p-1.5 text-center">
              <span className="text-[10px] font-bold text-nv-muted block">Area</span>
              <span className="font-mono text-xs font-bold text-nv-orange-text">
                {targetAccount.propertySize ? `${targetAccount.propertySize}m²` : '—'}
              </span>
            </div>
            <div className="rounded-xl bg-nv-inset/70 p-1.5 text-center">
              <span className="text-[10px] font-bold text-nv-muted block">Beds</span>
              <span className="font-mono text-xs font-bold text-nv-ink">
                {targetAccount.bedrooms ?? '—'}
              </span>
            </div>
            <div className="rounded-xl bg-nv-inset/70 p-1.5 text-center">
              <span className="text-[10px] font-bold text-nv-muted block">Baths</span>
              <span className="font-mono text-xs font-bold text-nv-ink">
                {targetAccount.bathrooms ?? '—'}
              </span>
            </div>
            <div className="rounded-xl bg-nv-inset/70 p-1.5 text-center">
              <span className="text-[10px] font-bold text-nv-muted block">Built</span>
              <span className="font-mono text-xs font-bold text-nv-ink">
                {targetAccount.yearBuilt ?? '—'}
              </span>
            </div>
          </div>

          {/* Bottom Row: Purchase vs Valuation Info */}
          <div className="relative flex items-center justify-between text-[11px] text-nv-muted pt-1 border-t border-nv-line font-mono">
            <span>
              {targetAccount.purchasePrice
                ? `Acquired: ${formatCurrency(targetAccount.purchasePrice, targetAccount.currency)}`
                : 'Primary Residence'}
            </span>
            {targetAccount.linkedLoanId && (
              <span className="font-bold text-nv-orange-text">Mortgaged</span>
            )}
          </div>
        </div>
      );
    }

    // 4. LOAN & MORTGAGE & LENDING ACCOUNTS: Amortization Payoff Shield HUD
    if (isLoanOrLending) {
      const isLending = targetAccount.type === 'Lending';

      return (
        <div className="relative w-full max-w-[340px] h-[160px] rounded-2xl bg-gradient-to-br from-nv-surface/90 via-nv-tile/80 to-nv-surface/70 backdrop-blur-2xl border border-nv-line/80 p-4 shadow-nv-float flex flex-col justify-between overflow-hidden">
          {/* Header Row */}
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-nv-inset flex items-center justify-center shrink-0 text-nv-ink">
                <NvIcon name={isLending ? 'sparkles' : 'bank'} size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-nv-ink truncate leading-tight">
                  {targetAccount.name}
                </p>
                <p className="text-[11px] text-nv-muted truncate">
                  {targetAccount.financialInstitution || (isLending ? 'Private Lending' : 'Credit Agreement')}
                </p>
              </div>
            </div>

            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0',
                isLending ? 'bg-nv-sky-soft text-nv-sky-text' : 'bg-nv-red-soft text-nv-red-text'
              )}
            >
              {isLending ? 'Receivable' : 'Liability'}
            </span>
          </div>

          {/* Centerpiece: Debt Payoff Progress */}
          <div className="relative rounded-xl bg-nv-inset/70 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-nv-muted">
                {isLending ? 'Collection Progress' : 'Payoff Progress'}
              </span>
              <span className="font-mono font-bold text-nv-green-text">
                {totalLoanPrincipal > 0 ? `${loanPaidPct}% Repaid` : `${targetAccount.interestRate || 0}% APR`}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-nv-line/40">
              <div
                className="h-full rounded-full bg-nv-green transition-all duration-500"
                style={{ width: `${loanPaidPct}%` }}
              />
            </div>
            {totalLoanPrincipal > 0 && (
              <div className="flex items-center justify-between text-[10px] font-mono text-nv-muted">
                <span>Paid: {formatCurrency(paidLoanPrincipal, targetAccount.currency)}</span>
                <span>Left: {formatCurrency(outstandingLoanBalance, targetAccount.currency)}</span>
              </div>
            )}
          </div>

          {/* Bottom Agreement Terms */}
          <div className="relative flex items-center justify-between text-[11px] text-nv-muted pt-1 border-t border-nv-line font-mono">
            <span>
              {targetAccount.monthlyPayment
                ? `${formatCurrency(targetAccount.monthlyPayment, targetAccount.currency)} / mo`
                : `${targetAccount.duration || 0} Mos Term`}
            </span>
            {targetAccount.interestRate !== undefined && (
              <span className="font-bold text-nv-orange-text">
                {targetAccount.interestRate}% APR
              </span>
            )}
          </div>
        </div>
      );
    }

    // 5. INVESTMENT ACCOUNTS: Trading Terminal HUD
    if (targetAccount.type === 'Investment') {
      return (
        <div className="relative w-full max-w-[340px] h-[160px] rounded-2xl bg-gradient-to-br from-nv-surface/90 via-nv-tile/80 to-nv-surface/70 backdrop-blur-2xl border border-nv-line/80 p-4 shadow-nv-float flex flex-col justify-between overflow-hidden">
          {/* Header Row */}
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-nv-inset flex items-center justify-center shrink-0 text-nv-ink">
                <NvIcon name="chartLine" size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-nv-ink truncate leading-tight">
                  {targetAccount.symbol ? `${targetAccount.symbol} · ` : ''}{targetAccount.name}
                </p>
                <p className="text-[11px] text-nv-muted truncate">
                  {targetAccount.subType || 'Investment Portfolio'}
                </p>
              </div>
            </div>

            <span className="rounded-full bg-nv-violet-soft px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-nv-violet-text shrink-0">
              {targetAccount.symbol || 'ASSET'}
            </span>
          </div>

          {/* Centerpiece: Glowing Candlestick Wave SVG */}
          <div className="relative flex items-center justify-between rounded-xl bg-nv-inset/70 px-3 py-2">
            <div className="flex items-center gap-2.5">
              <svg className="w-16 h-7 text-nv-green-text shrink-0" viewBox="0 0 64 28" fill="none">
                <path
                  d="M2 22L14 16L24 20L38 8L48 12L62 2"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="62" cy="2" r="3" fill="currentColor" />
              </svg>
              <div className="text-[11px] font-bold text-nv-ink leading-tight">
                <span className="block font-mono text-nv-green-text">Market Position</span>
                <span className="text-[10px] text-nv-muted font-normal">Active Portfolio</span>
              </div>
            </div>

            {targetAccount.expectedRetirementYear ? (
              <span className="rounded-lg bg-nv-violet-soft px-2 py-1 font-mono text-[11px] font-bold text-nv-violet-text">
                Retires {targetAccount.expectedRetirementYear}
              </span>
            ) : (
              <span className="rounded-lg bg-nv-green-soft px-2 py-1 font-mono text-[11px] font-bold text-nv-green-text">
                Allocated
              </span>
            )}
          </div>

          {/* Bottom Terminal Row */}
          <div className="relative flex items-center justify-between text-[11px] text-nv-muted pt-1 border-t border-nv-line font-mono">
            <span>{targetAccount.financialInstitution || 'Brokerage Asset'}</span>
            <span className="font-bold text-nv-violet-text">{targetAccount.currency} Base</span>
          </div>
        </div>
      );
    }

    // 6. OTHER ASSETS & OTHER LIABILITIES: Vault Certificate Seal HUD
    return (
      <div className="relative w-full max-w-[340px] h-[160px] rounded-2xl bg-gradient-to-br from-nv-surface/90 via-nv-tile/80 to-nv-surface/70 backdrop-blur-2xl border border-nv-line/80 p-4 shadow-nv-float flex flex-col justify-between overflow-hidden">
        {/* Header Row */}
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-nv-inset flex items-center justify-center shrink-0 text-nv-ink">
              <NvIcon name="layers" size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-nv-ink truncate leading-tight">
                {targetAccount.name}
              </p>
              <p className="text-[11px] text-nv-muted truncate">
                {targetAccount.otherSubType || targetAccount.type}
              </p>
            </div>
          </div>

          <span className="rounded-full bg-nv-inset px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-nv-muted shrink-0">
            {targetAccount.type}
          </span>
        </div>

        {/* Centerpiece: Vault Custody Seal */}
        <div className="relative flex items-center justify-between rounded-xl bg-nv-inset/70 px-3 py-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-nv-violet-soft flex items-center justify-center text-xs">
              💎
            </div>
            <div className="text-[11px] font-bold text-nv-ink leading-tight">
              <span className="block font-mono text-nv-violet-text">
                {targetAccount.assetCondition || 'Verified Valuation'}
              </span>
              <span className="text-[10px] text-nv-muted font-normal">Physical Asset</span>
            </div>
          </div>

          {targetAccount.location && (
            <span className="font-mono text-[11px] text-nv-muted truncate max-w-[120px]">
              📍 {targetAccount.location}
            </span>
          )}
        </div>

        {/* Bottom Row */}
        <div className="relative flex items-center justify-between text-[11px] text-nv-muted pt-1 border-t border-nv-line font-mono">
          <span>{targetAccount.counterparty ? `Party: ${targetAccount.counterparty}` : 'Self-Custody'}</span>
          <span className="font-bold text-nv-ink">{targetAccount.currency}</span>
        </div>
      </div>
    );
  };

  // Build the complete Hero Banner for Drawer
  const heroBanner = (
    <div className="relative w-full overflow-hidden bg-gradient-to-b from-nv-tile via-nv-surface/60 to-nv-surface border-b border-nv-line">
      {/* Ambient background aura glow */}
      <div
        className="absolute -top-16 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full blur-3xl opacity-25 pointer-events-none transition-colors duration-500"
        style={{ backgroundColor: auraColor }}
      />

      {/* Dot matrix grid */}
      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(currentColor_1px,transparent_1px)] [background-size:18px_18px] pointer-events-none text-nv-muted" />

      {/* Decorative concentric rings */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full border border-nv-line/40 pointer-events-none" />
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full border border-nv-line/30 pointer-events-none" />

      {/* Top Status Strip (Clear of the floating close button) */}
      <div className="relative flex items-center justify-between px-6 pt-5 sm:pt-6 pr-16 mb-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-nv-surface/80 backdrop-blur-md border border-nv-line text-xs font-semibold shadow-xs">
          <NvIcon
            name={isClosed ? 'archive' : isLinkedBank ? 'refresh' : 'wallet'}
            size={13}
            className={cn(
              isClosed ? 'text-nv-muted' : isLinkedBank ? 'text-nv-sky-text animate-spin-slow' : 'text-nv-violet-text'
            )}
          />
          <span className="truncate max-w-[200px] text-nv-ink">
            {isClosed
              ? 'Archived Account'
              : isLinkedBank
              ? 'Live Banking Sync'
              : `${targetAccount.type} Account`}
          </span>
        </div>
      </div>

      {/* Center 3D Showcase Card HUD */}
      <div className="relative flex justify-center px-6 py-2">
        {renderHeroCenter()}
      </div>

      {/* Bottom Hero Banner Content: Breadcrumb, Large Title & Fluorescent Balance */}
      <div className="relative px-6 pt-3 pb-5 space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-medium text-nv-muted">
          <span className="font-semibold text-nv-ink">
            {targetAccount.financialInstitution || targetAccount.type}
          </span>
          <span>•</span>
          <span>{targetAccount.currency}</span>
          {targetAccount.last4 && (
            <>
              <span>•</span>
              <span className="font-mono">•••• {targetAccount.last4}</span>
            </>
          )}
        </div>

        {/* Big Bold Title */}
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-nv-ink truncate leading-tight drop-shadow-xs">
          {targetAccount.name}
        </h2>

        {/* Fluorescent Highlight Balance */}
        <div className="flex items-baseline gap-2 pt-1 font-mono">
          <span
            className={cn(
              'text-3xl sm:text-4xl font-black tracking-tight nv-tabular privacy-blur drop-shadow-sm',
              isDebt ? 'text-nv-red-text' : 'text-nv-green-text'
            )}
          >
            {formatCurrency(displayBalance, targetAccount.currency)}
          </span>

          {normalizeCurrency(targetAccount.currency) !== normalizeCurrency(displayCurrency) && (
            <span className="text-xs font-semibold text-nv-muted">
              ≈ {formatCurrency(convertedBalance, displayCurrency)}
            </span>
          )}
        </div>

        {Math.abs(displayBalance - realTodayBalance) > 0.01 && (
          <div className="flex items-center gap-2 pt-1 text-xs text-nv-muted">
            <span>Settled today (excl. future):</span>
            <span className="font-semibold text-nv-ink">
              {formatCurrency(realTodayBalance, targetAccount.currency)}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={targetAccount.name}
      description={
        [
          targetAccount.financialInstitution,
          typeLabel,
          targetAccount.accountNumber || (targetAccount.last4 ? `•••• ${targetAccount.last4}` : undefined),
        ]
          .filter(Boolean)
          .join(' · ')
      }
      width={520}
      hero={heroBanner}
      footer={
        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            onClick={() => {
              onOpenChange(false);
              onEdit(targetAccount);
            }}
            icon="edit"
          >
            Edit
          </Button>
          <Button
            variant="cta"
            onClick={() => {
              onOpenChange(false);
              onOpenDetail(targetAccount);
            }}
            icon="arrowUpRight"
            className="flex-1"
          >
            Open Full Cockpit
          </Button>
        </div>
      }
    >
      <div className="space-y-5 pt-3">
        {/* 1. Context Weather / Metadata Strip */}
        <div className="flex items-center gap-5 border-b border-nv-line pb-4 text-xs text-nv-muted overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 shrink-0">
            <NvIcon name={accountTypeIcon(targetAccount)} size={16} className="text-nv-violet-text shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-nv-muted">Classification</span>
              <span className="font-semibold text-nv-ink text-xs">{typeLabel}</span>
            </div>
          </div>

          <div className="h-6 w-px bg-nv-line shrink-0" />

          <div className="flex items-center gap-1.5 shrink-0">
            <NvIcon name="bank" size={16} className="text-nv-sky-text shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-nv-muted">Institution</span>
              <span className="font-semibold text-nv-ink text-xs truncate max-w-[120px]">
                {targetAccount.financialInstitution || 'Direct'}
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-nv-line shrink-0" />

          <div className="flex items-center gap-1.5 shrink-0">
            <NvIcon
              name={isLinkedBank ? 'refresh' : 'wallet'}
              size={16}
              className={cn('shrink-0', isLinkedBank ? 'text-nv-green-text' : 'text-nv-orange-text')}
            />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-nv-muted">Feed Sync</span>
              <span className="font-semibold text-nv-ink text-xs">
                {isLinkedBank ? 'Live Banking' : 'Manual Ledger'}
              </span>
            </div>
          </div>

          {targetAccount.apy !== undefined && targetAccount.apy > 0 && (
            <>
              <div className="h-6 w-px bg-nv-line shrink-0" />
              <div className="flex items-center gap-1.5 shrink-0">
                <NvIcon name="sparkles" size={16} className="text-nv-green-text shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-nv-muted">Yield</span>
                  <span className="font-semibold text-nv-ink text-xs font-mono">{targetAccount.apy}% APY</span>
                </div>
              </div>
            </>
          )}

          {targetAccount.interestRate !== undefined && targetAccount.interestRate > 0 && (
            <>
              <div className="h-6 w-px bg-nv-line shrink-0" />
              <div className="flex items-center gap-1.5 shrink-0">
                <NvIcon name="info" size={16} className="text-nv-orange-text shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-nv-muted">Rate</span>
                  <span className="font-semibold text-nv-ink text-xs font-mono">{targetAccount.interestRate}% APR</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 2. "Account Intelligence" Section & Apple Workout 2x2 Metric Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-tight text-nv-ink">
              Account Intelligence
            </h3>
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onOpenDetail(targetAccount);
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-nv-violet-text transition-colors hover:bg-nv-inset"
            >
              <span>Full View</span>
              <NvIcon name="arrowRight" size={13} />
            </button>
          </div>

          <div className="rounded-nv-card bg-nv-inset p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Metric 1: 30-Day Activity */}
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-nv-muted">
                  30-Day Activity
                </p>
                <p className="font-mono text-base font-bold text-nv-orange-text leading-tight">
                  {metrics.txCount30d} {metrics.txCount30d === 1 ? 'Event' : 'Events'}
                </p>
                <p className="font-mono text-xs text-nv-muted">
                  {formatCurrency(metrics.volume30d, targetAccount.currency)} Vol
                </p>
              </div>

              {/* Metric 2: 30D Net Flow */}
              <div className="space-y-1 text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-nv-muted">
                  30D Net Flow
                </p>
                <p
                  className={cn(
                    'font-mono text-base font-bold leading-tight',
                    metrics.netFlow30d >= 0 ? 'text-nv-green-text' : 'text-nv-red-text'
                  )}
                >
                  {metrics.netFlow30d >= 0 ? '+' : ''}
                  {formatCurrency(metrics.netFlow30d, targetAccount.currency)}
                </p>
                <p className="font-mono text-[11px] text-nv-muted">
                  +{formatCurrency(metrics.inflows30d, targetAccount.currency, { compact: true })} in / -
                  {formatCurrency(metrics.outflows30d, targetAccount.currency, { compact: true })} out
                </p>
              </div>

              {/* Metric 3: Average Ticket */}
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-nv-muted">
                  Average Ticket
                </p>
                <p className="font-mono text-base font-bold text-nv-sky-text leading-tight">
                  {formatCurrency(metrics.avgTicket, targetAccount.currency)}
                </p>
                <p className="font-mono text-xs text-nv-muted">
                  Per Event (30d)
                </p>
              </div>

              {/* Metric 4: Highlights */}
              <div className="space-y-1 text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-nv-muted">
                  {isCredit
                    ? 'Available Limit'
                    : targetAccount.type === 'Loan' && targetAccount.interestRate !== undefined
                    ? 'Interest Rate'
                    : isVehicle && latestMileageLog
                    ? 'Odometer'
                    : isProperty && targetAccount.propertySize
                    ? 'Floor Area'
                    : 'Last Activity'}
                </p>
                <p className="font-mono text-base font-bold text-nv-violet-text leading-tight">
                  {isCredit
                    ? formatCurrency(availableCredit, targetAccount.currency)
                    : targetAccount.type === 'Loan' && targetAccount.interestRate !== undefined
                    ? `${targetAccount.interestRate}% APR`
                    : isVehicle && latestMileageLog
                    ? `${latestMileageLog.reading.toLocaleString()} km`
                    : isProperty && targetAccount.propertySize
                    ? `${targetAccount.propertySize} m²`
                    : metrics.lastActive
                    ? parseLocalDate(metrics.lastActive).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'No Events'}
                </p>
                <p className="font-mono text-[11px] text-nv-muted">
                  {isCredit && creditLimit > 0
                    ? `Limit: ${formatCurrency(creditLimit, targetAccount.currency, { compact: true })}`
                    : targetAccount.type === 'Loan' && targetAccount.duration
                    ? `${targetAccount.duration} Mos Term`
                    : isVehicle
                    ? `Ownership: ${targetAccount.ownership || 'Owned'}`
                    : isProperty
                    ? `Equity: ${formatCurrency(propertyEquity, targetAccount.currency, { compact: true })}`
                    : 'Observed State'}
                </p>
              </div>
            </div>

            {/* Credit Utilization Bar */}
            {isCredit && creditLimit > 0 && (
              <div className="border-t border-nv-line/50 pt-3 space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-nv-muted">Credit Utilization</span>
                  <span
                    className={cn(
                      creditUtilPct > 80
                        ? 'text-nv-red-text'
                        : creditUtilPct > 30
                        ? 'text-nv-orange-text'
                        : 'text-nv-green-text'
                    )}
                  >
                    {creditUtilPct}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-nv-line/50">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      creditUtilPct > 80
                        ? 'bg-nv-red'
                        : creditUtilPct > 30
                        ? 'bg-nv-orange'
                        : 'bg-nv-green'
                    )}
                    style={{ width: `${creditUtilPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. Recent Activity Section */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-tight text-nv-ink">
              Recent Activity
            </h3>
            {onNavigateToTransactions && accountTxs.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onNavigateToTransactions(targetAccount.name);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-nv-violet-text hover:underline"
              >
                <span>View All ({accountTxs.length})</span>
                <NvIcon name="arrowRight" size={13} />
              </button>
            )}
          </div>

          {metrics.recentTxs.length === 0 ? (
            <div className="rounded-nv-tile bg-nv-inset p-5 text-center text-xs text-nv-muted">
              No transactions recorded for this account yet.
            </div>
          ) : (
            <div className="divide-y divide-nv-line rounded-nv-card bg-nv-inset px-3.5">
              {metrics.recentTxs.map((tx) => {
                const isIncome = tx.type === 'income' || tx.amount > 0;
                const isTransfer = Boolean(tx.transferId);
                const txDate = parseLocalDate(tx.date);

                return (
                  <div
                    key={tx.id}
                    onClick={() => {
                      if (onNavigateToTransactions) {
                        onOpenChange(false);
                        onNavigateToTransactions(targetAccount.name);
                      }
                    }}
                    className="flex cursor-pointer items-center justify-between gap-3 py-3 transition-colors hover:opacity-80"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <TxLedgerAvatar
                        tx={tx}
                        category={
                          categoryMap.get((tx.category || '').toLowerCase()) ||
                          categoryMap.get(tx.category || '')
                        }
                        logoUrl={getLogoForTx(tx)}
                        size={32}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-nv-ink">
                          {tx.merchant || tx.description}
                        </p>
                        <p className="truncate text-[11px] text-nv-muted">
                          {txDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          {tx.category ? ` · ${tx.category}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <Money
                        amount={tx.amount}
                        currency={tx.currency || targetAccount.currency}
                        signed
                        tone={isIncome ? 'income' : 'ink'}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. Copyable Identifiers & Details */}
        {hasBankingIdentifiers && (
          <div className="space-y-2.5 rounded-nv-tile border border-nv-line/50 bg-nv-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-nv-muted">
              Account Identifiers & Details
            </p>

            <div className="space-y-2">
              {targetAccount.accountNumber && (
                <div className="flex items-center justify-between rounded-xl bg-nv-inset p-2.5">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-[10px] uppercase tracking-wider text-nv-muted">
                      Account / IBAN
                    </p>
                    <p className="truncate font-mono text-xs font-semibold text-nv-ink">
                      {targetAccount.accountNumber}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleCopy(targetAccount.accountNumber!, 'accountNumber', 'Account Number')
                    }
                    icon={copiedField === 'accountNumber' ? 'check' : 'copy'}
                  >
                    {copiedField === 'accountNumber' ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              )}

              {targetAccount.routingNumber && (
                <div className="flex items-center justify-between rounded-xl bg-nv-inset p-2.5">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-[10px] uppercase tracking-wider text-nv-muted">
                      BIC / SWIFT / Routing Code
                    </p>
                    <p className="truncate font-mono text-xs font-semibold text-nv-ink">
                      {targetAccount.routingNumber}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleCopy(targetAccount.routingNumber!, 'routingNumber', 'Routing Code')
                    }
                    icon={copiedField === 'routingNumber' ? 'check' : 'copy'}
                  >
                    {copiedField === 'routingNumber' ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              )}

              {(targetAccount.last4 || targetAccount.cardholderName || targetAccount.expirationDate) && (
                <div className="flex items-center justify-between rounded-xl bg-nv-inset p-2.5">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-[10px] uppercase tracking-wider text-nv-muted">
                      Card Details {targetAccount.cardNetwork ? `(${targetAccount.cardNetwork})` : ''}
                    </p>
                    <p className="font-mono text-xs font-semibold text-nv-ink">
                      {targetAccount.last4 ? `•••• •••• •••• ${targetAccount.last4}` : 'Card active'}
                    </p>
                    {(targetAccount.cardholderName || targetAccount.expirationDate) && (
                      <p className="mt-0.5 text-[11px] text-nv-muted">
                        {[
                          targetAccount.cardholderName,
                          targetAccount.expirationDate ? `Exp: ${targetAccount.expirationDate}` : undefined,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                  {targetAccount.last4 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(targetAccount.last4!, 'last4', 'Card Number')}
                      icon={copiedField === 'last4' ? 'check' : 'copy'}
                    >
                      {copiedField === 'last4' ? 'Copied' : 'Copy'}
                    </Button>
                  )}
                </div>
              )}

              {targetAccount.vin && (
                <div className="flex items-center justify-between rounded-xl bg-nv-inset p-2.5">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-[10px] uppercase tracking-wider text-nv-muted">
                      Vehicle VIN
                    </p>
                    <p className="truncate font-mono text-xs font-semibold text-nv-ink">
                      {targetAccount.vin}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(targetAccount.vin!, 'vin', 'VIN')}
                    icon={copiedField === 'vin' ? 'check' : 'copy'}
                  >
                    {copiedField === 'vin' ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. Quick Actions Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onAdjustBalance(targetAccount);
            }}
            className="flex items-center gap-2.5 rounded-nv-control border border-nv-line bg-nv-surface p-3 text-left text-sm font-medium text-nv-ink transition-colors hover:bg-nv-inset"
          >
            <NvIcon name="refresh" size={18} className="text-nv-violet-text" />
            <span>Reconcile Balance</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onToggleStatus(targetAccount);
              onOpenChange(false);
            }}
            className="flex items-center gap-2.5 rounded-nv-control border border-nv-line bg-nv-surface p-3 text-left text-sm font-medium text-nv-ink transition-colors hover:bg-nv-inset"
          >
            <NvIcon name="archive" size={18} className="text-nv-muted" />
            <span>{isClosed ? 'Reopen Account' : 'Archive Account'}</span>
          </button>
        </div>

        {/* 6. Danger Zone */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleConfirmDelete}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full text-xs font-medium text-nv-red-text transition-colors hover:bg-nv-red-soft"
          >
            <NvIcon name="delete" size={15} />
            <span>Permanently Delete Account</span>
          </button>
        </div>
      </div>
    </Drawer>
  );
};

/* ── 2. BalanceAdjustmentSheet (Reconciliation Drawer) ──────────────────── */

export const BalanceAdjustmentSheet: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
  onAdjust: (
    account: Account,
    targetBalance: number,
    dateStr?: string,
    note?: string
  ) => { delta: number; undo?: () => void };
}> = ({ open, onOpenChange, account, onAdjust }) => {
  const phone = !useMediaQuery('(min-width: 768px)');
  const [amountStr, setAmountStr] = useState('');
  const [isNegative, setIsNegative] = useState(false);
  const [dateStr, setDateStr] = useState(() => toLocalISOString(new Date()));
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open && account) {
      setAmountStr(String(Math.abs(account.balance || 0)));
      setIsNegative(
        account.balance < 0 ||
          account.type === 'Credit Card' ||
          account.type === 'Loan' ||
          account.type === 'Other Liabilities'
      );
      setDateStr(toLocalISOString(new Date()));
      setNote('');
    }
  }, [open, account]);

  if (!account) return null;

  const rawMagnitude = parseFloat(amountStr || '0') || 0;
  const targetBalance = isNegative ? -Math.abs(rawMagnitude) : Math.abs(rawMagnitude);
  const delta = safeRound(
    targetBalance - account.balance,
    account.currency === 'BTC' ? 8 : 2
  );

  const handleConfirm = () => {
    if (Math.abs(delta) < 0.000001) {
      toast.info('Balance is already equal to the entered amount');
      onOpenChange(false);
      return;
    }
    const res = onAdjust(account, targetBalance, dateStr, note);
    if (res.undo) {
      toast.undo(
        `Reconciled ${account.name} (${delta >= 0 ? '+' : ''}${currencySign(account.currency)}${delta})`,
        res.undo
      );
    } else {
      toast.success(`Reconciled ${account.name}`);
    }
    onOpenChange(false);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={`Reconcile ${account.name}`}
      description="Enter the actual statement or bank balance. Crystal will post a reconciliation entry for the difference."
      width={460}
      footer={
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="cta"
            onClick={handleConfirm}
            disabled={Math.abs(delta) < 0.000001}
            className="flex-1"
          >
            Post Adjustment
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-nv-tile bg-nv-inset p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-nv-muted">New Verified Balance</span>
            <button
              type="button"
              onClick={() => setIsNegative((v) => !v)}
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                isNegative
                  ? 'bg-nv-red-soft text-nv-red-text'
                  : 'bg-nv-surface text-nv-muted hover:text-nv-ink'
              )}
            >
              {isNegative ? 'Negative / Owed (−)' : 'Positive (+)'}
            </button>
          </div>
          <AmountPad
            value={amountStr}
            onChange={setAmountStr}
            currency={currencySign(account.currency)}
            keypad={phone}
            label="Target balance"
          />
        </div>

        {/* Delta Comparison Card */}
        <div className="grid grid-cols-3 gap-2 rounded-nv-tile bg-nv-inset p-4 text-center">
          <div>
            <p className="text-[11px] text-nv-muted">Current Book</p>
            <div className="mt-1">
              <Money amount={account.balance} currency={account.currency} />
            </div>
          </div>
          <div>
            <p className="text-[11px] text-nv-muted">Adjustment</p>
            <div className="mt-1">
              <Money
                amount={delta}
                currency={account.currency}
                signed
                tone={delta >= 0 ? 'income' : 'ink'}
              />
            </div>
          </div>
          <div>
            <p className="text-[11px] text-nv-muted">New Balance</p>
            <div className="mt-1">
              <Money amount={targetBalance} currency={account.currency} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-nv-muted">
              Effective Date
            </label>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="h-11 w-full rounded-nv-control border border-nv-line bg-nv-surface px-3.5 text-sm text-nv-ink outline-none focus:border-nv-violet"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-nv-muted">
              Reason / Note
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Monthly statement check"
              className="h-11 w-full rounded-nv-control border border-nv-line bg-nv-surface px-3.5 text-sm text-nv-ink outline-none focus:border-nv-violet"
            />
          </div>
        </div>
      </div>
    </Drawer>
  );
};

/* ── 3. ValuationSheet (Property & Vehicle Market Appraisal Drawer) ──────── */

export const ValuationSheet: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
  onRecordValuation: (price: number, dateStr?: string) => { undo: () => void } | null;
  onDeleteValuation?: (dateStr: string) => { undo: () => void } | null;
}> = ({ open, onOpenChange, account, onRecordValuation, onDeleteValuation }) => {
  const phone = !useMediaQuery('(min-width: 768px)');
  const [priceStr, setPriceStr] = useState('');
  const [dateStr, setDateStr] = useState(() => toLocalISOString(new Date()));

  useEffect(() => {
    if (open && account) {
      setPriceStr(String(Math.max(0, account.balance || 0)));
      setDateStr(toLocalISOString(new Date()));
    }
  }, [open, account]);

  if (!account) return null;

  const numPrice = parseFloat(priceStr || '0') || 0;
  const purchasePrice = account.purchasePrice || 0;
  const deltaVsPurchase = purchasePrice > 0 ? safeRound(numPrice - purchasePrice, 2) : null;
  const sortedHistory = [...(account.priceHistory || [])].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  const handleSave = () => {
    if (numPrice <= 0) {
      toast.error('Please enter a valid market valuation');
      return;
    }
    const res = onRecordValuation(numPrice, dateStr);
    if (res?.undo) {
      toast.undo(
        `Updated ${account.name} valuation to ${currencySign(account.currency)}${numPrice.toLocaleString()}`,
        res.undo
      );
    } else {
      toast.success(`Recorded valuation for ${account.name}`);
    }
    onOpenChange(false);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={`Appraise ${account.name}`}
      description="Log a market valuation point to update net worth, equity, LTV, and historical appreciation."
      width={480}
      footer={
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="cta"
            onClick={handleSave}
            disabled={numPrice <= 0}
            className="flex-1"
          >
            Save Valuation
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-nv-tile bg-nv-inset p-4">
          <p className="mb-1 text-xs font-medium text-nv-muted">Estimated Market Value</p>
          <AmountPad
            value={priceStr}
            onChange={setPriceStr}
            currency={currencySign(account.currency)}
            keypad={phone}
            label="Market valuation"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-nv-muted">
              Valuation Date
            </label>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="h-11 w-full rounded-nv-control border border-nv-line bg-nv-surface px-3.5 text-sm text-nv-ink outline-none focus:border-nv-violet"
            />
          </div>
          {deltaVsPurchase !== null && (
            <div className="flex flex-col justify-center rounded-nv-control bg-nv-inset px-3.5 py-2">
              <span className="text-[11px] text-nv-muted">vs. Purchase Price</span>
              <Money
                amount={deltaVsPurchase}
                currency={account.currency}
                signed
                tone={deltaVsPurchase >= 0 ? 'income' : 'ink'}
              />
            </div>
          )}
        </div>

        {sortedHistory.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold text-nv-muted">
              Valuation History ({sortedHistory.length})
            </p>
            <div className="divide-y divide-nv-line rounded-nv-tile bg-nv-inset px-4">
              {sortedHistory.slice(0, 8).map((entry) => (
                <div
                  key={entry.date}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <span className="nv-tabular text-sm text-nv-ink">{entry.date}</span>
                  <div className="flex items-center gap-2">
                    <Money amount={entry.price} currency={account.currency} />
                    {onDeleteValuation && (
                      <IconButton
                        icon="delete"
                        label={`Delete valuation from ${entry.date}`}
                        size={32}
                        tone="plain"
                        onClick={() => {
                          const res = onDeleteValuation(entry.date);
                          if (res?.undo) {
                            toast.undo(`Removed valuation on ${entry.date}`, res.undo);
                          }
                        }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
};

/* ── 4. CloseAssetSheet (Sell / Retire Physical Asset Drawer) ────────────── */

export const CloseAssetSheet: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
  accounts: Account[];
  onCloseAsset: (accountId: string, details: AssetClosureDetails) => void;
}> = ({ open, onOpenChange, account, accounts, onCloseAsset }) => {
  const phone = !useMediaQuery('(min-width: 768px)');
  const [closureType, setClosureType] =
    useState<AssetClosureDetails['closureType']>('Sold');
  const [valueStr, setValueStr] = useState('');
  const [dateStr, setDateStr] = useState(() => toLocalISOString(new Date()));
  const [incomeAccountId, setIncomeAccountId] = useState('');
  const [notes, setNotes] = useState('');

  const depositAccounts = useMemo(
    () =>
      accounts.filter(
        (a) =>
          a.id !== account?.id &&
          a.status !== 'closed' &&
          (a.type === 'Checking' || a.type === 'Savings')
      ),
    [accounts, account?.id]
  );

  useEffect(() => {
    if (open && account) {
      setClosureType(account.ownership === 'Leased' ? 'Returned' : 'Sold');
      setValueStr(String(Math.max(0, account.balance || 0)));
      setDateStr(toLocalISOString(new Date()));
      setIncomeAccountId(depositAccounts[0]?.id || '');
      setNotes('');
    }
  }, [open, account, depositAccounts]);

  if (!account) return null;

  const numValue = parseFloat(valueStr || '0') || 0;

  const handleConfirm = () => {
    onCloseAsset(account.id, {
      closureType,
      date: dateStr,
      value: closureType === 'Sold' ? numValue : 0,
      incomeAccountId: closureType === 'Sold' && incomeAccountId ? incomeAccountId : undefined,
      notes: notes.trim() || undefined,
    });
    toast.success(`Closed "${account.name}" as ${closureType}`);
    onOpenChange(false);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={`Close or Sell ${account.name}`}
      description="Mark this asset as sold, returned, or retired. If sold, proceeds can be deposited directly into a bank account."
      width={480}
      footer={
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button variant="cta" onClick={handleConfirm} className="flex-1">
            Confirm Disposition
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-nv-muted">
            Disposition Reason
          </label>
          <SegmentedTabs<AssetClosureDetails['closureType']>
            label="Disposition Type"
            size="sm"
            className="w-full"
            value={closureType}
            onChange={setClosureType}
            items={[
              { id: 'Sold', label: 'Sold' },
              { id: 'Returned', label: 'Returned' },
              { id: 'Written Off', label: 'Written Off' },
              { id: 'Retired', label: 'Retired' },
            ]}
          />
        </div>

        {closureType === 'Sold' && (
          <>
            <div className="rounded-nv-tile bg-nv-inset p-4">
              <p className="mb-1 text-xs font-medium text-nv-muted">Net Sale Proceeds</p>
              <AmountPad
                value={valueStr}
                onChange={setValueStr}
                currency={currencySign(account.currency)}
                keypad={phone}
                label="Sale proceeds"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-nv-muted">
                Deposit Proceeds Into
              </label>
              <select
                value={incomeAccountId}
                onChange={(e) => setIncomeAccountId(e.target.value)}
                className="h-11 w-full rounded-nv-control border border-nv-line bg-nv-surface px-3.5 text-sm text-nv-ink outline-none focus:border-nv-violet"
              >
                <option value="">Do not create a deposit transaction</option>
                {depositAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.currency})
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-nv-muted">
              Disposition Date
            </label>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="h-11 w-full rounded-nv-control border border-nv-line bg-nv-surface px-3.5 text-sm text-nv-ink outline-none focus:border-nv-violet"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-nv-muted">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Buyer or contract reference"
              className="h-11 w-full rounded-nv-control border border-nv-line bg-nv-surface px-3.5 text-sm text-nv-ink outline-none focus:border-nv-violet"
            />
          </div>
        </div>
      </div>
    </Drawer>
  );
};

/* ── 5. EnableBankingSyncSheet (Open Banking Sync Drawer) ────────────────── */

export const EnableBankingSyncSheet: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
  linkInfo?: EnableBankingLinkInfo;
  onTriggerSync: (options: EnableBankingSyncOptions) => Promise<void>;
}> = ({ open, onOpenChange, account, linkInfo, onTriggerSync }) => {
  const [mode, setMode] =
    useState<NonNullable<EnableBankingSyncOptions['transactionMode']>>('incremental');
  const [updateBalance, setUpdateBalance] = useState(true);
  const [syncStartDate, setSyncStartDate] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (open && linkInfo) {
      setMode('incremental');
      setUpdateBalance(true);
      setSyncStartDate(linkInfo.account.syncStartDate || '');
    }
  }, [open, linkInfo]);

  if (!account || !linkInfo) return null;

  const handleRunSync = async () => {
    setIsSyncing(true);
    try {
      await onTriggerSync({
        transactionMode: mode,
        updateBalance,
        syncStartDate: mode === 'full' && syncStartDate ? syncStartDate : undefined,
      });
      onOpenChange(false);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={`Bank Sync · ${account.name}`}
      description={`Connected to ${linkInfo.connection.selectedBank || linkInfo.account.bankName}`}
      width={460}
      footer={
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="cta"
            icon="refresh"
            disabled={isSyncing}
            onClick={handleRunSync}
            className="flex-1"
          >
            {isSyncing ? 'Syncing…' : 'Sync Now'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-nv-tile bg-nv-inset p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-nv-ink">
                {linkInfo.connection.selectedBank || linkInfo.account.bankName}
              </p>
              <p className="text-xs text-nv-muted">
                Last synced: {linkInfo.account.lastSyncedAt || linkInfo.connection.lastSyncedAt || 'Never'}
              </p>
            </div>
            <Badge
              tone={linkInfo.connection.status === 'ready' ? 'green' : 'orange'}
              icon={linkInfo.connection.status === 'ready' ? 'checkCircle' : 'warning'}
            >
              {linkInfo.connection.status === 'ready' ? 'Connected' : 'Needs Review'}
            </Badge>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-nv-muted">
            Transaction Fetch Scope
          </label>
          <SegmentedTabs<NonNullable<EnableBankingSyncOptions['transactionMode']>>
            label="Transaction Sync Mode"
            size="sm"
            className="w-full"
            value={mode}
            onChange={setMode}
            items={[
              { id: 'incremental', label: 'New Since Last Sync' },
              { id: 'full', label: 'Full History' },
              { id: 'none', label: 'Balance Only' },
            ]}
          />
        </div>

        {mode === 'full' && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-nv-muted">
              Fetch History From Date
            </label>
            <input
              type="date"
              value={syncStartDate}
              onChange={(e) => setSyncStartDate(e.target.value)}
              className="h-11 w-full rounded-nv-control border border-nv-line bg-nv-surface px-3.5 text-sm text-nv-ink outline-none focus:border-nv-violet"
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-4 rounded-nv-tile bg-nv-inset p-4">
          <div>
            <p className="text-sm font-medium text-nv-ink">Update Account Balance</p>
            <p className="text-xs text-nv-muted">
              Overwrite local book balance with the bank’s closing booked balance
            </p>
          </div>
          <Switch
            checked={updateBalance}
            onChange={setUpdateBalance}
            label="Update account balance from bank"
          />
        </div>
      </div>
    </Drawer>
  );
};
