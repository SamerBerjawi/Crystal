import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Transaction, Account, Tag, Category } from '../types';
import { formatCurrency, parseLocalDate, convertToMain, getMainCurrency } from '../utils';
import { buildEffectiveMerchantLogoOverrides, getAccountBrandfetchUrl, getMerchantLogoUrl, isCashAccount } from '../utils/brandfetch';
import { getCategoryDetails } from '../utils/categories';
import { formatTransactionLocation } from '../utils/locationFormat';
import { resolveTransferInfo } from '../utils/transferDetails';
import { useCategoryContext, useBudgetsContext } from '../contexts/FinancialDataContext';
import { usePreferencesSelector, useTransactionSelector } from '../contexts/DomainProviders';
import { useIsMobile } from '../hooks/useIsMobile';
import { accountIcon } from './AccountCard';
import PlaceMap from './PlaceMap';
import { HoldButton } from './ui/Actions';
import { Badge, Row, ShowMore } from './ui/Display';
import Icon from './ui/Icon';
import { Amount, FormattedAmount, splitAmount } from './ui/Money';
import { SidePanel } from './ui/Overlays';
import { cn } from '../lib/utils';

const LIST_STEP = 50;

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Heading when several unrelated transactions are listed. */
  title?: string;
  /** One transaction, a transfer's two sides, or a list to pick from. */
  transactions: Transaction[];
  accounts: Account[];
  tags: Tag[];
  onEdit?: (transaction: Transaction) => void;
  /** Gets both sides of a transfer, so one is never left behind. */
  onDelete?: (transactionIds: string[]) => void;
  onDuplicate?: (transaction: Transaction) => void;
  onMakeRecurring?: (transaction: Transaction) => void;
  onSplit?: (transaction: Transaction) => void;
  onRecategorize?: (transaction: Transaction, category: string) => void;
  onRemoveLocation?: (transaction: Transaction) => void;
}

const longFormattedDate = (dateStr: string) => {
  try {
    const d = parseLocalDate(dateStr);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const fullDate = (date: string) => parseLocalDate(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const nameOf = (tx: Transaction) => tx.merchant || tx.description || 'Transaction';

const hasPlace = (tx: Transaction) => Number.isFinite(tx.latitude) && Number.isFinite(tx.longitude);

const mapsUrl = (tx: Transaction) =>
  `https://www.google.com/maps/search/?api=1&query=${hasPlace(tx) ? `${tx.latitude},${tx.longitude}` : encodeURIComponent(tx.address || tx.placeName || tx.city || '')}`;

const placeName = (tx: Transaction) => tx.locationLabel || tx.placeName || tx.city || tx.address?.split(',')[0] || (hasPlace(tx) ? 'Pinned location' : '');

const AccountLogoTile: React.FC<{
  account?: Account;
  brandfetchClientId?: string;
  overrides?: Record<string, string>;
}> = ({ account, brandfetchClientId, overrides }) => {
  const [failed, setFailed] = useState(false);
  const logoUrl = useMemo(() => {
    if (!account || isCashAccount(account)) return null;
    return (
      account.imageUrl ||
      getAccountBrandfetchUrl(account, brandfetchClientId, overrides) ||
      (account.financialInstitution ? getMerchantLogoUrl(account.financialInstitution, brandfetchClientId, overrides) : null)
    );
  }, [account, brandfetchClientId, overrides]);

  const initial = account?.name?.trim().charAt(0).toUpperCase();

  return (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-xs border border-line/40">
      {logoUrl && !failed ? (
        <img src={logoUrl} alt="" onError={() => setFailed(true)} className="size-full object-cover" />
      ) : initial ? (
        <span className="text-sm font-bold text-ink">{initial}</span>
      ) : (
        <Icon name="bank" size={18} className="text-muted" />
      )}
    </span>
  );
};

const FactSection: React.FC<{
  label: string;
  icon?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ label, icon, action, children, className }) => (
  <section className={cn('min-w-0', className)}>
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-muted">
            {icon && <Icon name={icon} size={16} className="text-muted/80" aria-hidden />}
            <span>{label}</span>
          </h4>
          {action}
        </div>
        {children}
      </section>
      );

      const TransactionDetail: React.FC<{
  tx: Transaction;
      legs: Transaction[];
      accounts: Account[];
      tags: Tag[];
  onClose: () => void;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transactionIds: string[]) => void;
  onDuplicate?: (transaction: Transaction) => void;
  onMakeRecurring?: (transaction: Transaction) => void;
  onSplit?: (transaction: Transaction) => void;
  onRecategorize?: (transaction: Transaction, category: string) => void;
  onRemoveLocation?: (transaction: Transaction) => void;
}> = ({
        tx,
        legs,
        accounts,
        tags,
        onClose,
        onEdit,
        onDelete,
        onDuplicate,
        onMakeRecurring,
        onSplit,
        onRecategorize,
        onRemoveLocation,
}) => {
  const {incomeCategories, expenseCategories} = useCategoryContext();
      const {budgets} = useBudgetsContext();
  const allCategories = useMemo(() => [...incomeCategories, ...expenseCategories], [incomeCategories, expenseCategories]);
  const allTransactions = useTransactionSelector(all => all);
  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  const merchantLogoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
  const merchantRules = usePreferencesSelector(p => p.merchantRules || {}) as Record<string, { logo?: string }>;
  const logoOverrides = useMemo(() => {
    return buildEffectiveMerchantLogoOverrides(merchantLogoOverrides, merchantRules);
  }, [merchantLogoOverrides, merchantRules]);
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [catSearch, setCatSearch] = useState('');
  const catPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (catPickerRef.current && !catPickerRef.current.contains(e.target as Node)) {
        setCatPickerOpen(false);
        setCatSearch('');
      }
    };
    if (catPickerOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [catPickerOpen]);

  const groupedCategories = useMemo(() => {
    const isTxIncome = tx.type === 'income';
    const primaryCats = isTxIncome ? incomeCategories : expenseCategories;
    const secondaryCats = isTxIncome ? expenseCategories : incomeCategories;
    const primaryLabel = isTxIncome ? 'Income' : 'Expenses';
    const secondaryLabel = isTxIncome ? 'Expenses' : 'Income';

    const build = (cats: Category[], defaultKindLabel: string) => {
      const groups: Array<{
        name: string;
        icon?: string;
        color?: string;
        items: Array<{
          id: string;
          label: string;
          icon?: string;
          color?: string;
          level: number;
          parent?: string;
        }>;
      }> = [];
      const standalone: Array<{
        id: string;
        label: string;
        icon?: string;
        color?: string;
        level: number;
        parent?: string;
      }> = [];

      cats.forEach(cat => {
        if (cat.subCategories && cat.subCategories.length > 0) {
          const items = [
            {
              id: cat.name,
              label: cat.name,
              icon: cat.icon,
              color: cat.color,
              level: 0,
            },
            ...cat.subCategories.map(sub => ({
              id: sub.name,
              label: sub.name,
              icon: sub.icon || cat.icon,
              color: sub.color || cat.color,
              level: 1,
              parent: cat.name,
            })),
          ];
          groups.push({
            name: cat.name,
            icon: cat.icon,
            color: cat.color,
            items,
          });
        } else {
          standalone.push({
            id: cat.name,
            label: cat.name,
            icon: cat.icon,
            color: cat.color,
            level: 0,
          });
        }
      });

      if (standalone.length > 0) {
        groups.push({
          name: defaultKindLabel,
          items: standalone,
        });
      }

      return groups;
    };

    return [...build(primaryCats, primaryLabel), ...build(secondaryCats, secondaryLabel)];
  }, [tx.type, incomeCategories, expenseCategories]);

  const filteredCatGroups = useMemo(() => {
    const q = catSearch.trim().toLowerCase();
    if (!q) return groupedCategories;
    return groupedCategories
      .map(group => {
        const matchesGroup = group.name.toLowerCase().includes(q);
        const filteredItems = group.items.filter(
          item =>
            matchesGroup ||
            item.label.toLowerCase().includes(q) ||
            (item.parent && item.parent.toLowerCase().includes(q))
        );
        return {
          ...group,
          items: filteredItems,
        };
      })
      .filter(group => group.items.length > 0);
  }, [groupedCategories, catSearch]);

  const accountOf = (id?: string) => accounts.find(account => account.id === id);
  const from = legs.find(leg => leg.type === 'expense');
  const to = legs.find(leg => leg.type === 'income');
  const isTransfer = Boolean(tx.transferId);
  const hasBothSides = Boolean(from && to);
  const headline = isTransfer ? from || tx : tx;
  const mainAccount = accountOf(headline.accountId);

  const rawQuery = (tx.merchant && tx.merchant.toLowerCase() !== 'internal transfer' ? tx.merchant : '')
    || (to ? accountOf(to.accountId)?.name : undefined)
    || (from ? accountOf(from.accountId)?.name : undefined)
    || tx.merchant
    || tx.description
    || '';
  const logoQuery = rawQuery.replace(/^Transfer\s+(to|from)\s+/i, '').trim() || nameOf(tx);
  const logoUrl = useMemo(() => {
    if (!logoQuery.trim()) return null;
    return getMerchantLogoUrl(logoQuery, brandfetchClientId, logoOverrides, { fallback: 'lettermark', type: 'icon', width: 128, height: 128 });
  }, [logoQuery, brandfetchClientId, logoOverrides]);
  const logo = logoUrl !== failedLogo ? logoUrl : null;

        const place = placeName(tx);
  const locMeta = useMemo(() => formatTransactionLocation(tx), [tx]);
  const txTags = (tx.tagIds || []).flatMap(id => tags.find(tag => tag.id === id) || []);
  const categoryDetails = useMemo(() => getCategoryDetails(tx.category, allCategories), [tx.category, allCategories]);

  const transferInfo = useMemo(() => {
    if (!isTransfer) return null;
        return resolveTransferInfo(headline, accounts, to && to.id !== headline.id ? to : from);
  }, [isTransfer, headline, accounts, to, from]);

  const navigateToAccount = (accountId?: string) => {
    if (!accountId) return;
        onClose?.();
        window.history.pushState(null, '', `/accounts/${encodeURIComponent(accountId)}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // Round-up spare change detection
  const spareTx = useMemo(() => {
    return allTransactions.find(
      t =>
        t.transferId === `spare-${tx.id}` ||
        (tx.transferId && t.transferId === `spare-${tx.transferId}`)
        );
  }, [tx, allTransactions]);
        const spareAmount = spareTx
        ? Math.abs(spareTx.amount)
        : ('spareChangeAmount' in tx && typeof (tx as Record<string, unknown>).spareChangeAmount === 'number')
        ? Math.abs((tx as Record<string, unknown>).spareChangeAmount as number)
        : 0;

  // Split parts detection
  const parts = useMemo(() => {
    if (!tx.isSplitParent && !tx.isCombinedParent) return [];
    return allTransactions.filter(t => t.parentTransactionId === tx.id);
  }, [tx, allTransactions]);

  // Category Monthly Budget Insight
  const catBudgetInsight = useMemo(() => {
    if (tx.type !== 'expense' || isTransfer || !tx.category || tx.category === 'Uncategorized') return null;
        const monthPrefix = tx.date.slice(0, 7);
        const catTxs = allTransactions.filter(
      t =>
        t.category === tx.category &&
        t.type === 'expense' &&
        t.date.startsWith(monthPrefix) &&
        !t.parentTransactionId &&
        !t.transferId
        );
    const spent = catTxs.reduce((sum, t) => sum + Math.abs(convertToMain(t.amount, t.currency)), 0);
    const budget = budgets.find(b => b.categoryName === tx.category);
    const limit = budget && budget.amount > 0 ? budget.amount : Math.max(spent * 1.35, 100);
        const pct = Math.min(100, Math.round((spent / limit) * 100));
        return {spent, limit, pct};
  }, [tx, isTransfer, allTransactions, budgets]);

        const amountNumber = Math.abs(headline.amount);
        const isIncome = tx.type === 'income' && !isTransfer;
        const isExpense = tx.type === 'expense' && !isTransfer;

        const initial = (tx.merchant?.trim() || tx.description?.trim() || '?').charAt(0).toUpperCase();

        return (
        <div className="flex flex-col">
          {/* 1. Map Hero Banner */}
          <div className="relative h-52 w-full overflow-hidden bg-inset sm:h-60">
            {hasPlace(tx) ? (
              <PlaceMap
                places={[{ latitude: tx.latitude!, longitude: tx.longitude! }]}
                label={place}
                logoUrl={logo}
                className="h-full w-full !rounded-none"
              />
            ) : (
              <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-black/85 via-surface/70 to-black/60">
                <Icon name={isTransfer ? 'arrow-data-transfer-horizontal' : 'receipt'} size={48} className="text-muted/20" />
              </div>
            )}

            {/* Top-left location pill */}
            {place && (
              <span className="absolute left-4 top-4 z-10 inline-flex h-8 max-w-[65%] items-center gap-1.5 rounded-full bg-black/60 px-3 text-xs font-semibold text-white shadow-sm backdrop-blur-md">
                <Icon name="location-01" size={16} className="shrink-0 text-primary" />
                <span className="truncate">{place}</span>
              </span>
            )}

            {/* Top-right close button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-full bg-black/60 text-white shadow-sm backdrop-blur-md transition-colors hover:bg-black/80"
            >
              <Icon name="cancel-01" size={16} />
            </button>

            {/* Fade gradient overlay at bottom of map banner */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-solid to-transparent" aria-hidden />
          </div>

          {/* 2. Hero Header Content */}
          <div className="relative -mt-10 px-6">
            {/* Merchant Avatar / Logo row */}
            <div className="flex items-start justify-between gap-3">
              <span className="relative z-10 flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line/40 bg-white shadow-md">
                {logo ? (
                  <img src={logo} alt="" onError={() => setFailedLogo(logoUrl)} className="size-full object-cover" />
                ) : isTransfer ? (
                  <span className="flex size-full items-center justify-center bg-sky-500/15 text-sky-600 dark:text-sky-400">
                    <Icon name="arrow-data-transfer-horizontal" size={28} />
                  </span>
                ) : mainAccount ? (
                  <span className="flex size-full items-center justify-center bg-black/5 dark:bg-white/10 text-muted">
                    <Icon name={accountIcon(mainAccount)} size={28} />
                  </span>
                ) : (
                  <span className="text-xl font-bold text-ink">{initial}</span>
                )}
              </span>

              <button
                type="button"
                aria-label="Merchant details"
                className="mt-1 flex size-8 items-center justify-center rounded-full text-muted/60 transition-colors hover:text-ink"
              >
                <Icon name="info" size={20} />
              </button>
            </div>

            {/* Title & Subtitle */}
            <div className="mt-3">
              <h3 className="break-words text-2xl font-extrabold tracking-tight text-ink md:text-3xl">
                {tx.merchant || (isTransfer && transferInfo && (!tx.description || tx.description.toLowerCase() === 'account transfer') ? transferInfo.label : tx.description) || 'Transaction'}
              </h3>
              <p className="mt-1 text-sm font-medium text-muted">
                {longFormattedDate(tx.date)}
                {mainAccount && (
                  <>
                    {' · '}
                    <button
                      type="button"
                      onClick={() => navigateToAccount(mainAccount.id)}
                      className="cursor-pointer font-semibold text-ink underline-offset-2 transition-colors hover:text-primary hover:underline"
                    >
                      {mainAccount.name}
                    </button>
                  </>
                )}
              </p>
            </div>

            {/* Hero Amount */}
            {(() => {
              const rawText = formatCurrency(amountNumber, headline.currency);
              const parts = splitAmount(rawText);
              const sign = isIncome ? '+' : isExpense ? '−' : parts.sign;
              const symbolTone = isTransfer ? 'text-sky-400' : 'text-primary';
              return (
                <div className="mt-3 flex items-baseline text-4xl font-extrabold tracking-tight md:text-5xl tabular-nums">
                  {sign && (
                    <span className={cn('amount-symbol font-semibold', symbolTone)}>
                      {sign}
                    </span>
                  )}
                  {parts.symbol && (
                      <span className={cn('amount-symbol font-semibold', symbolTone)}>
                        {parts.symbol}
                      </span>
              )}
                      <span className="text-ink">{parts.integer}</span>
                      {parts.fraction && (
                          <span className="amount-fraction text-3xl md:text-4xl text-muted font-normal">
                            {parts.fraction}
                          </span>
              )}
                          {parts.suffix && (
                              <span className={cn('amount-suffix text-3xl md:text-4xl', parts.suffix.trim() === 'BTC' ? cn('amount-symbol font-semibold', symbolTone) : 'text-muted')}>
                                {parts.suffix}
                              </span>
              )}
                            </div>
                          );
        })()}

                          {/* Multi-currency Transfer arrival text */}
                          {isTransfer && to && from && to.currency !== from.currency && (
                            <p className="mt-1.5 text-sm text-muted">
                              Arrives as <FormattedAmount text={formatCurrency(to.amount, to.currency)} />
                            </p>
                          )}

                          {/* Status Chips Row */}
                          <div className="mt-3.5 flex flex-wrap items-center gap-2">
                            {/* Type Pill */}
                            <span
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
                                isExpense && 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
                                isIncome && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                                isTransfer && 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                              )}
                            >
                              <span
                                className={cn(
                                  'size-2 rounded-full',
                                  isExpense && 'bg-orange-500',
                                  isIncome && 'bg-emerald-500',
                                  isTransfer && 'bg-sky-500'
                                )}
                                aria-hidden
                              />
                              {isExpense ? 'Expense' : isIncome ? 'Income' : 'Transfer'}
                            </span>

                            {/* Transfer Info Pill */}
                            {isTransfer && transferInfo && (
                              <span
                                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                                style={{
                                  backgroundColor: `${transferInfo.color}22`,
                                  color: transferInfo.color,
                                }}
                              >
                                <Icon name={transferInfo.icon} size={16} />
                                <span>{transferInfo.label}</span>
                              </span>
                            )}

                            {/* Interactive Category Pill */}
                            {!isTransfer && (
                              <div className="relative inline-block" ref={catPickerRef}>
                                <button
                                  type="button"
                                  onClick={() => setCatPickerOpen(o => !o)}
                                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all hover:ring-1 hover:ring-line-strong"
                                  style={{
                                    backgroundColor: `${categoryDetails.color || 'var(--muted)'}22`,
                                    color: categoryDetails.color || 'var(--muted)',
                                  }}
                                >
                                  <Icon name={categoryDetails.icon || 'category'} size={16} />
                                  <span>{tx.category || 'Uncategorized'}</span>
                                  {categoryDetails.parent && <span className="opacity-70">· {categoryDetails.parent}</span>}
                                  <Icon name="expand_more" size={16} className={cn('transition-transform', catPickerOpen && 'rotate-180')} />
                                </button>

                                {/* Category Quick Picker Dropdown */}
                                {catPickerOpen && onRecategorize && (
                                  <div
                                    className="absolute left-0 top-full z-[var(--z-popover)] mt-1.5 flex max-h-80 w-72 flex-col overflow-hidden rounded-2xl border border-line bg-solid shadow-2xl"
                                    style={{ backgroundColor: 'var(--solid)' }}
                                  >
                                    {/* Search bar */}
                                    <div className="border-b border-line p-2" style={{ backgroundColor: 'var(--solid)' }}>
                                      <div className="flex items-center gap-2 rounded-xl bg-inset px-2.5 py-1.5 text-xs text-ink">
                                        <Icon name="search" size={14} className="shrink-0 text-muted" />
                                        <input
                                          type="text"
                                          value={catSearch}
                                          onChange={e => setCatSearch(e.target.value)}
                                          placeholder="Search categories..."
                                          className="w-full bg-transparent text-xs text-ink outline-none placeholder:text-muted"
                                          autoFocus
                                        />
                                        {catSearch && (
                                          <button
                                            type="button"
                                            onClick={() => setCatSearch('')}
                                            className="cursor-pointer text-muted hover:text-ink"
                                          >
                                            <Icon name="close" size={12} />
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {/* Grouped Category Options */}
                                    <div className="max-h-64 overflow-y-auto p-1.5 space-y-1" style={{ backgroundColor: 'var(--solid)' }}>
                                      {filteredCatGroups.length === 0 ? (
                                        <div className="px-3 py-6 text-center text-xs text-muted">
                                          No categories found
                                        </div>
                                      ) : (
                                        filteredCatGroups.map(group => (
                                          <div key={group.name} className="space-y-0.5">
                                            <div
                                              className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-line/40 px-2.5 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted select-none"
                                              style={{ backgroundColor: 'var(--solid)' }}
                                            >
                                              {group.icon && (
                                                <Icon name={group.icon} size={13} style={{ color: group.color }} className="shrink-0" />
                                              )}
                                              <span>{group.name}</span>
                                            </div>
                                            {group.items.map(item => (
                                              <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => {
                                                  onRecategorize(tx, item.id);
                                                  setCatPickerOpen(false);
                                                  setCatSearch('');
                                                }}
                                                className={cn(
                                                  'flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition-colors',
                                                  item.level === 1 ? 'pl-6' : 'pl-2.5',
                                                  tx.category === item.id
                                                    ? 'bg-primary-soft font-semibold text-primary'
                                                    : 'text-ink hover:bg-inset'
                                                )}
                                              >
                                                <div className="flex min-w-0 items-center gap-2">
                                                  <Icon
                                                    name={item.icon || 'category'}
                                                    size={16}
                                                    style={{ color: item.color }}
                                                    className="shrink-0"
                                                  />
                                                  <span className="truncate">{item.label}</span>
                                                </div>
                                                {tx.category === item.id && (
                                                  <Icon name="check" size={14} className="shrink-0 text-primary" />
                                                )}
                                              </button>
                                            ))}
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Badges */}
                            {tx.isSplitParent && <Badge tone="attention">Split, {parts.length}</Badge>}
                            {tx.isCombinedParent && <Badge tone="teal">Combined, {parts.length}</Badge>}
                            {tx.recurringSourceId && <Badge tone="positive" icon="repeat-one-01">Recurring</Badge>}
                            {tx.isBalanceAdjustment && <Badge tone="neutral">Adjustment</Badge>}
                          </div>

                          {/* 3. Category Monthly Budget Micro-Gauge */}
                          {catBudgetInsight && (
                            <div className="mt-4 rounded-2xl border border-line/60 bg-inset p-3.5 space-y-2">
                              <div className="flex items-center justify-between text-xs font-medium text-muted">
                                <span>{tx.category} monthly budget</span>
                                <span className="font-bold text-ink">
                                  <FormattedAmount text={formatCurrency(catBudgetInsight.spent, headline.currency, { compact: true })} /> ({catBudgetInsight.pct}%)
                                </span>
                              </div>
                              {/* Notch dashes */}
                              <div className="flex items-center gap-[3px] w-full h-2">
                                {Array.from({ length: 40 }).map((_, i) => {
                                  const activeCount = Math.round((catBudgetInsight.pct / 100) * 40);
                                  const isActive = i < activeCount;
                                  return (
                                    <span
                                      key={i}
                                      className={cn(
                                        'h-full flex-1 rounded-full transition-colors',
                      isActive ? 'bg-orange-500 dark:bg-orange-400' : 'bg-primary/30 dark:bg-primary/30'
                                      )}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

      {/* 4. Fact Sections */}
                      <div className="mt-6 space-y-6 px-6 pb-6">
                        {/* Payment & Account Section */}
                        {isTransfer ? (
                          <div className="space-y-2">
                            {transferInfo && (
                              <div className="flex items-center gap-1.5 px-1 text-xs font-semibold" style={{ color: transferInfo.color }}>
                                <Icon name={transferInfo.icon} size={16} />
                                <span>{transferInfo.label}</span>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                              <FactSection label="From" icon="bank">
                                {from?.accountId ? (
                                  <button
                                    type="button"
                                    onClick={() => navigateToAccount(from.accountId)}
                                    className="group flex w-full cursor-pointer items-center gap-2.5 rounded-2xl bg-inset p-3 text-left transition-colors hover:bg-surface"
                                  >
                                    <AccountLogoTile account={accountOf(from.accountId)} brandfetchClientId={brandfetchClientId} overrides={logoOverrides} />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-semibold text-ink transition-colors group-hover:text-primary">{accountOf(from.accountId)?.name || 'Unknown'}</p>
                                      {accountOf(from.accountId)?.type && <p className="truncate text-xs text-muted capitalize">{accountOf(from.accountId)?.type}</p>}
                                    </div>
                                    <Icon name="chevron_right" size={16} className="shrink-0 text-muted/60 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-2.5 rounded-2xl bg-inset p-3">
                                    <AccountLogoTile account={accountOf(from?.accountId)} brandfetchClientId={brandfetchClientId} overrides={logoOverrides} />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-semibold text-ink">{accountOf(from?.accountId)?.name || 'Unknown'}</p>
                                      {accountOf(from?.accountId)?.type && <p className="truncate text-xs text-muted capitalize">{accountOf(from?.accountId)?.type}</p>}
                                    </div>
                                  </div>
                                )}
                              </FactSection>
                              <FactSection label="To" icon="bank">
                                {to?.accountId ? (
                                  <button
                                    type="button"
                                    onClick={() => navigateToAccount(to.accountId)}
                                    className="group flex w-full cursor-pointer items-center gap-2.5 rounded-2xl bg-inset p-3 text-left transition-colors hover:bg-surface"
                                  >
                                    <AccountLogoTile account={accountOf(to.accountId)} brandfetchClientId={brandfetchClientId} overrides={logoOverrides} />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-semibold text-ink transition-colors group-hover:text-primary">{accountOf(to.accountId)?.name || 'Unknown'}</p>
                                      {accountOf(to.accountId)?.type && <p className="truncate text-xs text-muted capitalize">{accountOf(to.accountId)?.type}</p>}
                                    </div>
                                    <Icon name="chevron_right" size={16} className="shrink-0 text-muted/60 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-2.5 rounded-2xl bg-inset p-3">
                                    <AccountLogoTile account={accountOf(to?.accountId)} brandfetchClientId={brandfetchClientId} overrides={logoOverrides} />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-semibold text-ink">{accountOf(to?.accountId)?.name || 'Unknown'}</p>
                                      {accountOf(to?.accountId)?.type && <p className="truncate text-xs text-muted capitalize">{accountOf(to?.accountId)?.type}</p>}
                                    </div>
                                  </div>
                                )}
                              </FactSection>
                            </div>
                          </div>
                        ) : (
                          <FactSection label="Payment & Account" icon="bank">
                              <div className="space-y-2.5">
                                {mainAccount ? (
                                  <button
                                    type="button"
                                    onClick={() => navigateToAccount(mainAccount.id)}
                                    className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl bg-inset p-3 text-left transition-colors hover:bg-surface"
                                  >
                                    <div className="flex min-w-0 items-center gap-3">
                                      <AccountLogoTile account={mainAccount} brandfetchClientId={brandfetchClientId} overrides={logoOverrides} />
                                      <p className="truncate text-sm font-semibold text-ink transition-colors group-hover:text-primary md:text-base">
                                        {mainAccount.name}
                                        {mainAccount.last4 && (
                                          <span className="ml-1.5 font-normal text-muted">
                                            (•••• {mainAccount.last4})
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                    {mainAccount.type && (
                                      <span className="shrink-0 text-sm font-normal capitalize text-muted">
                                        {mainAccount.type}
                                      </span>
                                    )}
                                  </button>
                                ) : (
                                    <div className="flex items-center justify-between gap-3 rounded-2xl bg-inset p-3">
                                      <div className="flex min-w-0 items-center gap-3">
                                        <AccountLogoTile account={mainAccount} brandfetchClientId={brandfetchClientId} overrides={logoOverrides} />
                                        <p className="truncate text-sm font-semibold text-ink md:text-base">
                                          {mainAccount?.name || 'Unknown account'}
                                        </p>
                                      </div>
                                    </div>
              )}

                                    {/* Spare Change Round-up Row */}
                                    {spareAmount > 0 && (
                                        <div className="flex items-center justify-between gap-3 rounded-2xl bg-inset p-3">
                                          <div className="flex min-w-0 items-center gap-3">
                                            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                              <Icon name="piggy-bank" size={20} />
                                            </span>
                                            <p className="truncate text-sm font-semibold text-ink">
                                              Spare Change Round-up
                                            </p>
                                          </div>
                                          <span className="shrink-0 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                            +<FormattedAmount text={formatCurrency(spareAmount, headline.currency)} />
                                          </span>
                                        </div>
              )}
                                      </div>
          </FactSection>
                                )}

                                {/* Description Section */}
                                    {tx.description && (
                                      <FactSection label="Description" icon="calendar-03">
                                        <p className="break-words text-base font-semibold text-ink">{tx.description}</p>
                                      </FactSection>
                                    )}

                                    {/* Memo / Notes Section */}
                                    {tx.notes && (
                                      <FactSection label="Notes" icon="doc-01">
                                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{tx.notes}</p>
                                      </FactSection>
                                    )}

                                    {/* Location Section */}
                                    {(place || tx.address || hasPlace(tx)) && (
                                      <FactSection
                                        label="Location"
                                        icon="location-01"
                                        action={
                                          <a
                                            href={mapsUrl(tx)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                                          >
                                            Open in Maps
                                            <Icon name="link-square-02" size={14} />
                                          </a>
                                        }
                                      >
                                          <address className="not-italic space-y-1 text-sm leading-relaxed text-ink/90">
                                            {place && <p className="font-bold text-base text-ink">{place}</p>}
                                            {tx.street && <p>{tx.street}</p>}
                                            {tx.address && !tx.street && tx.address !== place && <p>{tx.address}</p>}
                                            {[tx.postalCode, tx.city].filter(Boolean).length > 0 && (
                                              <p>{[tx.postalCode, tx.city].filter(Boolean).join(' ')}</p>
                                            )}
                                            {tx.state && <p>{tx.state}</p>}
                                            {tx.country && <p>{tx.country}</p>}
                                          </address>
                                      </FactSection>
                                    )}

                                    {/* Loan Split Pills */}
                                    {(tx.principalAmount || tx.interestAmount) ? (
                                      <div className="flex flex-wrap gap-2">
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-inset px-3.5 py-1.5 text-xs font-semibold text-ink">
                                          Principal <FormattedAmount text={formatCurrency(tx.principalAmount || 0, tx.currency)} />
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-inset px-3.5 py-1.5 text-xs font-semibold text-ink">
                                          Interest <FormattedAmount text={formatCurrency(tx.interestAmount || 0, tx.currency)} />
                                        </span>
                                      </div>
                                    ) : null}

                                    {/* Tags Section */}
                                    <FactSection label="Tags" icon="tag-01">
                                      <div className="flex flex-wrap items-center gap-2">
                                        {txTags.map(tag => (
                                          <span
                                            key={tag.id}
                                            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-inset px-3 text-xs font-semibold text-ink"
                                          >
                                            <Icon name={tag.icon || 'tag'} size={14} style={{ color: tag.color }} className="shrink-0" />
                                            {tag.name}
                                          </span>
                                        ))}
                                        {onEdit && (
                                          <button
                                            type="button"
                                            onClick={() => onEdit(tx)}
                                            className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full border border-dashed border-line px-3 text-xs font-semibold text-muted hover:border-line-strong hover:text-ink transition-colors"
                                          >
                                            <Icon name="add" size={16} />
                                            Add tag
                                          </button>
                                        )}
                                      </div>
                                    </FactSection>

                                    {/* Split Parts List */}
                                    {parts.length > 0 && (
                                      <FactSection label={tx.isSplitParent ? `Split into ${parts.length} parts` : `Combines ${parts.length} transactions`}>
                                        <ul className="space-y-2 rounded-2xl bg-inset p-3">
                                          {parts.map(p => (
                                            <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                                              <span className="min-w-0 flex-1 truncate font-medium text-ink">
                                                {p.description || p.merchant || p.category}
                                              </span>
                                              <span className="text-xs text-muted">{p.category}</span>
                                              <span className="font-semibold text-ink">
                                                <FormattedAmount text={formatCurrency(Math.abs(p.amount), p.currency)} />
                                              </span>
                                            </li>
                                          ))}
                                        </ul>
                                      </FactSection>
                                    )}
                                  </div>

      {/* 5. Sticky Bottom Action Bar */}
                                <div className="sticky bottom-0 z-20 shrink-0 border-t border-line bg-solid/95 px-6 py-4 backdrop-blur-md">
                                  <div className="flex items-center gap-2.5">
                                    {onEdit && (
                                      <button
                                        type="button"
                                        onClick={() => onEdit(tx)}
                                        className="flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-ink text-sm font-bold text-canvas shadow-xs transition-opacity hover:opacity-90 md:text-base"
                                      >
                                        <Icon name="edit" size={20} />
                                        <span>Edit</span>
                                      </button>
                                    )}

                                    {onDelete && (
                                      <HoldButton
                                        label="Delete"
                                        staticLabel
                                        block={false}
                                        className="!h-12 !min-w-[120px] rounded-full !border-rose-500/25 !bg-rose-500/15 !text-rose-600 dark:!text-rose-400 font-bold"
                                        onConfirm={() => onDelete(legs.map(l => l.id))}
                                      />
                                    )}
                                  </div>
                                </div>
                              </div>
                              );
};

                              /** One transaction or transfer in a 640 side panel, or a list that opens into one. */
                              const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
                                isOpen,
                                onClose,
                                title,
                                transactions,
                                accounts,
                                tags,
                                onEdit,
                                onDelete,
                                onDuplicate,
                                onMakeRecurring,
                                onSplit,
                                onRecategorize,
                                onRemoveLocation,
}) => {
  const isPhone = useIsMobile();
  const allTransactions = useTransactionSelector(all => all);
                                const [picked, setPicked] = useState<Transaction | null>(null);
                                const [shown, setShown] = useState(LIST_STEP);

  useEffect(() => {
                                  setPicked(null);
                                setShown(LIST_STEP);
  }, [transactions]);

                                const isTransferPair =
                                transactions.length === 2 &&
                                !!transactions[0].transferId &&
                                transactions[0].transferId === transactions[1].transferId;
  const isList = transactions.length > 1 && !isTransferPair;
                                const tx = picked || (isList ? null : transactions[0] || null);

  const legs = useMemo(() => {
    if (!tx) return [];
                                if (!tx.transferId) return [tx];
    const found = allTransactions.filter(other => other.transferId === tx.transferId);
    return found.length > 0 ? found : [tx];
  }, [tx, allTransactions]);

                                if (!tx && !isList) return null;

                                return (
                                <SidePanel
                                  isOpen={isOpen}
                                  onClose={onClose}
                                  width={640}
                                  title={tx ? nameOf(tx) : title || 'Transactions'}
                                  description={tx ? fullDate(tx.date) : `${transactions.length} transactions`}
                                  hideHeader={Boolean(tx)}
                                  contentPadding={!tx}
                                >
                                  {tx ? (
                                    <>
                                      {picked && (
                                        <div className="p-4">
                                          <button
                                            type="button"
                                            onClick={() => setPicked(null)}
                                            className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                                          >
                                            <Icon name="arrow_back" size={14} />
                                            All transactions
                                          </button>
                                        </div>
                                      )}
                                      <TransactionDetail
                                        key={tx.id}
                                        tx={tx}
                                        legs={legs}
                                        accounts={accounts}
                                        tags={tags}
                                        onClose={onClose}
                                        onEdit={onEdit}
                                        onDelete={onDelete}
                                        onDuplicate={onDuplicate}
                                        onMakeRecurring={onMakeRecurring}
                                        onSplit={onSplit}
                                        onRecategorize={onRecategorize}
                                        onRemoveLocation={onRemoveLocation}
                                      />
                                    </>
                                  ) : (
                                    <div className="p-6">
                                      <div className="divide-y divide-line">
                                        {transactions.slice(0, shown).map(item => (
                                          <Row
                                            key={item.id}
                                            title={nameOf(item)}
                                            context={fullDate(item.date)}
                                            trailing={<Amount value={item.amount} currency={item.currency} tone="flow" />}
                                            onPress={() => setPicked(item)}
                                          />
                                        ))}
                                      </div>
                                      <ShowMore remaining={transactions.length - shown} onPress={() => setShown(count => count + LIST_STEP)} />
                                    </div>
                                  )}
                                </SidePanel>
                                );
};

                                export default TransactionDetailModal;
