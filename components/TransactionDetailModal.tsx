import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Transaction, Account, Tag, Category } from '../types';
import { formatCurrency, parseLocalDate, convertToMain, getMainCurrency } from '../utils';
import { getAccountBrandfetchUrl, getMerchantLogoUrl } from '../utils/brandfetch';
import { getCategoryDetails } from '../utils/categories';
import { formatTransactionLocation } from '../utils/locationFormat';
import { resolveTransferInfo } from '../utils/transferDetails';
import { useCategoryContext, useBudgetsContext } from '../contexts/FinancialDataContext';
import { usePreferencesSelector, useTransactionSelector } from '../contexts/DomainProviders';
import { useIsMobile } from '../hooks/useIsMobile';
import PlaceMap from './PlaceMap';
import { HoldButton } from './ui/Actions';
import { Badge, Row, ShowMore } from './ui/Display';
import Icon from './ui/Icon';
import { Amount, FormattedAmount, splitAmount } from './ui/Money';
import { SidePanel } from './ui/Overlays';
import { Menu, type MenuAction } from './ui/Menu';
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
    if (!account) return null;
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
        <Icon name="account_balance" size={18} className="text-muted" />
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
    <div className="mb-2 flex items-center justify-between gap-2">
      <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
        {icon && <Icon name={icon} size={15} aria-hidden />}
        {label}
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
  const { incomeCategories, expenseCategories } = useCategoryContext();
  const { budgets } = useBudgetsContext();
  const allCategories = useMemo(() => [...incomeCategories, ...expenseCategories], [incomeCategories, expenseCategories]);
  const allTransactions = useTransactionSelector(all => all);
  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  const logoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const catPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (catPickerRef.current && !catPickerRef.current.contains(e.target as Node)) {
        setCatPickerOpen(false);
      }
    };
    if (catPickerOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [catPickerOpen]);

  const logoQuery = nameOf(tx);
  const logoUrl = useMemo(() => {
    if (!logoQuery.trim()) return null;
    return getMerchantLogoUrl(logoQuery, brandfetchClientId, logoOverrides, { fallback: 'lettermark', type: 'icon', width: 128, height: 128 });
  }, [logoQuery, brandfetchClientId, logoOverrides]);
  const logo = logoUrl !== failedLogo ? logoUrl : null;

  const accountOf = (id?: string) => accounts.find(account => account.id === id);
  const from = legs.find(leg => leg.type === 'expense');
  const to = legs.find(leg => leg.type === 'income');
  const isTransfer = Boolean(tx.transferId);
  const hasBothSides = Boolean(from && to);
  const headline = isTransfer ? from || tx : tx;
  const mainAccount = accountOf(headline.accountId);

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
    return { spent, limit, pct };
  }, [tx, isTransfer, allTransactions, budgets]);

  const moreActions: MenuAction[] = useMemo(() => {
    const list: MenuAction[] = [];
    if (!isTransfer && onSplit) {
      list.push({ id: 'split', label: 'Split transaction', icon: 'call_split', onAction: () => onSplit(tx) });
    }
    if (onDuplicate) {
      list.push({ id: 'duplicate', label: 'Duplicate', icon: 'content_copy', onAction: () => onDuplicate(tx) });
    }
    if (onMakeRecurring) {
      list.push({ id: 'recurring', label: 'Make recurring', icon: 'repeat', onAction: () => onMakeRecurring(tx) });
    }
    if (hasPlace(tx) || tx.address || tx.city) {
      list.push({
        id: 'remove_location',
        label: 'Remove location',
        icon: 'location_off',
        onAction: () => onRemoveLocation?.(tx),
      });
    }
    return list;
  }, [tx, isTransfer, onSplit, onDuplicate, onMakeRecurring, onRemoveLocation]);

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
          <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-black/85 via-surface-elevated/70 to-black/60">
            <Icon name={isTransfer ? 'swap_horiz' : 'receipt'} size={48} className="text-muted/20" />
          </div>
        )}

        {/* Top-left location pill */}
        {place && (
          <span className="absolute left-4 top-4 z-10 inline-flex h-8 max-w-[65%] items-center gap-1.5 rounded-full bg-black/60 px-3 text-xs font-semibold text-white shadow-sm backdrop-blur-md">
            {locMeta.flag ? (
              <span className="shrink-0 text-sm leading-none" aria-hidden>{locMeta.flag}</span>
            ) : (
              <Icon name="location_on" size={14} className="shrink-0 text-emerald-400" />
            )}
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
          <Icon name="close" size={16} />
        </button>

        {/* Fade gradient overlay at bottom of map banner */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-solid to-transparent" aria-hidden />
      </div>

      {/* 2. Hero Header Content */}
      <div className="relative -mt-10 px-6">
        {/* Merchant Avatar / Logo */}
        <span className="relative z-10 flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line/40 bg-white shadow-md">
          {logo ? (
            <img src={logo} alt="" onError={() => setFailedLogo(logoUrl)} className="size-full object-cover" />
          ) : isTransfer ? (
            <span className="flex size-full items-center justify-center bg-sky-500/15 text-sky-600 dark:text-sky-400">
              <Icon name="swap_horiz" size={28} />
            </span>
          ) : (
            <span className="text-xl font-bold text-ink">{initial}</span>
          )}
        </span>

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
          return (
            <div className="mt-3 flex items-baseline text-4xl font-extrabold tracking-tight md:text-5xl tabular-nums">
              {sign && <span className={isIncome ? 'text-money-in' : 'text-ink'}>{sign}</span>}
              {parts.symbol && (
                <span className={cn('amount-symbol font-semibold', isIncome ? 'text-money-in' : isTransfer ? 'text-sky-400' : 'text-primary')}>
                  {parts.symbol}
                </span>
              )}
              <span className={isIncome ? 'text-money-in' : 'text-ink'}>{parts.integer}</span>
              {parts.fraction && (
                <span className={cn('amount-fraction text-3xl md:text-4xl text-muted', isIncome && 'text-money-in/70')}>
                  {parts.fraction}
                </span>
              )}
              {parts.suffix && (
                <span className={cn('amount-suffix text-3xl md:text-4xl', parts.suffix.trim() === 'BTC' ? 'amount-symbol text-primary font-semibold' : 'text-muted')}>
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
              isExpense && 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
              isIncome && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
              isTransfer && 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
            )}
          >
            <span
              className={cn(
                'size-2 rounded-full',
                isExpense && 'bg-rose-500',
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
              <Icon name={transferInfo.icon} size={14} />
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
                <Icon name={categoryDetails.icon || 'category'} size={14} />
                <span>{tx.category || 'Uncategorized'}</span>
                {categoryDetails.parent && <span className="opacity-70">· {categoryDetails.parent}</span>}
                <Icon name="expand_more" size={12} className={cn('transition-transform', catPickerOpen && 'rotate-180')} />
              </button>

              {/* Category Quick Picker Dropdown */}
              {catPickerOpen && onRecategorize && (
                <div className="absolute left-0 top-full z-[var(--z-dropdown)] mt-1.5 max-h-60 w-64 overflow-y-auto rounded-2xl border border-line bg-surface-elevated p-1.5 shadow-2xl">
                  {allCategories.map(c => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => {
                        onRecategorize(tx, c.name);
                        setCatPickerOpen(false);
                      }}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition-colors',
                        tx.category === c.name
                          ? 'bg-primary-soft font-semibold text-primary'
                          : 'text-ink hover:bg-inset'
                      )}
                    >
                      <Icon name={c.icon || 'category'} size={15} style={{ color: c.color }} />
                      <span className="truncate">{c.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Badges */}
          {tx.isSplitParent && <Badge tone="attention">Split, {parts.length}</Badge>}
          {tx.isCombinedParent && <Badge tone="teal">Combined, {parts.length}</Badge>}
          {tx.recurringSourceId && <Badge tone="positive" icon="repeat">Recurring</Badge>}
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
                      isActive ? 'bg-amber-500 dark:bg-amber-400' : 'bg-black/10 dark:bg-white/10'
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
                <Icon name={transferInfo.icon} size={15} />
                <span>{transferInfo.label}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
            <FactSection label="From" icon="account_balance">
              {from?.accountId ? (
                <button
                  type="button"
                  onClick={() => navigateToAccount(from.accountId)}
                  className="group flex w-full cursor-pointer items-center gap-2.5 rounded-2xl bg-inset p-3 text-left transition-colors hover:bg-surface-elevated/80"
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
            <FactSection label="To" icon="account_balance">
              {to?.accountId ? (
                <button
                  type="button"
                  onClick={() => navigateToAccount(to.accountId)}
                  className="group flex w-full cursor-pointer items-center gap-2.5 rounded-2xl bg-inset p-3 text-left transition-colors hover:bg-surface-elevated/80"
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
          <FactSection label="Payment & Account" icon="account_balance">
            <div className="space-y-1.5 rounded-2xl border border-line/40 bg-inset p-2.5">
              {mainAccount ? (
                <button
                  type="button"
                  onClick={() => navigateToAccount(mainAccount.id)}
                  className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl p-1 text-left transition-colors hover:bg-surface-elevated/80"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <AccountLogoTile account={mainAccount} brandfetchClientId={brandfetchClientId} overrides={logoOverrides} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink transition-colors group-hover:text-primary md:text-base">
                        {mainAccount.name}
                        {mainAccount.last4 && (
                          <span className="ml-1.5 font-normal text-muted">
                            (•••• {mainAccount.last4})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {mainAccount.type && (
                      <span className="text-xs font-medium capitalize text-muted">
                        {mainAccount.type}
                      </span>
                    )}
                    <Icon name="chevron_right" size={18} className="text-muted/60 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                  </div>
                </button>
              ) : (
                <div className="flex items-center justify-between gap-3 p-1">
                  <div className="flex min-w-0 items-center gap-3">
                    <AccountLogoTile account={mainAccount} brandfetchClientId={brandfetchClientId} overrides={logoOverrides} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink md:text-base">
                        {mainAccount?.name || 'Unknown account'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Spare Change Round-up Row */}
              {spareAmount > 0 && (
                <div className="flex items-center justify-between gap-3 border-t border-line/40 pt-2 px-1">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <Icon name="piggy" size={20} />
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
        {tx.description && tx.merchant && tx.description.trim().toLowerCase() !== tx.merchant.trim().toLowerCase() && (
          <FactSection label="Description" icon="receipt">
            <p className="break-words text-base font-semibold text-ink">{tx.description}</p>
          </FactSection>
        )}

        {/* Memo / Notes Section */}
        {tx.notes && (
          <FactSection label="Notes" icon="notes">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{tx.notes}</p>
          </FactSection>
        )}

        {/* Location Section */}
        {(place || tx.address || hasPlace(tx)) && (
          <FactSection
            label="Location"
            icon="location_on"
            action={
              <a
                href={mapsUrl(tx)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                Open in Maps
                <Icon name="open_in_new" size={13} />
              </a>
            }
          >
            <address className="not-italic space-y-0.5 text-sm leading-relaxed text-ink">
              {place && <p className="font-bold text-base">{place}</p>}
              {tx.street && <p>{tx.street}</p>}
              {tx.address && !tx.street && tx.address !== place && <p>{tx.address}</p>}
              {[tx.postalCode, tx.city].filter(Boolean).length > 0 && (
                <p>{[tx.postalCode, tx.city].filter(Boolean).join(' ')}</p>
              )}
              {tx.state && <p>{tx.state}</p>}
              {tx.country && (
                <p className="flex items-center gap-1.5">
                  {locMeta.flag && <span className="text-sm leading-none" aria-hidden>{locMeta.flag}</span>}
                  <span>{tx.country}</span>
                </p>
              )}
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
        <FactSection label="Tags" icon="tag">
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
                <Icon name="add" size={14} />
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
              <Icon name="edit" size={18} />
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

          {moreActions.length > 0 && (
            <Menu
              trigger={
                <button
                  type="button"
                  aria-label="More actions"
                  className="flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-inset text-ink transition-colors hover:bg-surface-elevated"
                >
                  <Icon name="more_horiz" size={20} />
                </button>
              }
              title="Actions"
              items={moreActions}
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
