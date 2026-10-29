import React, { useEffect, useMemo, useState } from 'react';
import { formatShortDate } from '../../../utils/dateFormat';
import { cn } from '../../../lib/utils';
import type { Account, Category, Currency, Transaction } from '../../../types';
import { currencySign, formatCurrency, normalizeCurrency, toLocalISOString } from '../../../utils';
import { getMerchantLogoUrl } from '../../../utils/brandfetch';
import { usePreferencesContextOptional } from '../../../contexts/DomainProviders';
import { AmountPad } from '../../kokonutui/amount-pad';
import { Drawer, useMediaQuery } from '../Drawer';
import { EntityGlyph } from '../EntityIcon';
import { NvIcon } from '../NvIcon';
import { FilterChip } from '../tile';
import { toast } from '../toast';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Money,
  MoreButton,
  SegmentedTabs,
  Switch,
} from '../ui';

/*
 * Shared Detail Components for `/accounts-new/:id`:
 * - `AccountActivitySection`: Searchable, filterable ledger activity card with Balance Adjustment toggle.
 * - `RecordAccountTxSheet`: Drawer to record an Expense, Income, Interest Payout, or Statement Payment.
 */

export const TxLedgerAvatar: React.FC<{
  tx: Transaction;
  category?: Category;
  logoUrl: string | null;
  size?: number;
}> = ({ tx, category, logoUrl, size = 40 }) => {
  const [failed, setFailed] = useState(false);
  const isTransfer = Boolean(tx.transferId || tx.category === 'Transfer');

  if (logoUrl && !failed) {
    return (
      <span
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <img
          src={logoUrl}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  if (isTransfer) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full bg-nv-sky-soft text-nv-sky-text"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <NvIcon name="transactions" size={Math.round(size * 0.45)} />
      </span>
    );
  }

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-nv-inset text-nv-ink"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <EntityGlyph
        icon={category?.icon}
        label={category?.name || tx.category || 'T'}
        color={category?.color}
        size={Math.round(size * 0.45)}
      />
    </span>
  );
};

type TxFilterKind = 'all' | 'income' | 'expense' | 'transfer';

export const AccountActivitySection: React.FC<{
  account: Account;
  normalizedTransactions: Array<{
    tx: Transaction;
    parsedDate: Date;
    amountInAccountCurrency: number;
    dateStr: string;
  }>;
  allCategories: Category[];
  showBalanceAdjustments: boolean;
  onToggleBalanceAdjustments: (show: boolean) => void;
  onOpenRecordTx: () => void;
  onNavigateToFullTransactions?: () => void;
  brandfetchClientId?: string;
  merchantLogoOverrides?: Record<string, string>;
  accounts?: Account[];
  /** Opens a transaction to view, edit or delete it. */
  onOpenTransaction?: (txId: string) => void;
}> = ({
  account,
  normalizedTransactions,
  allCategories,
  showBalanceAdjustments,
  onToggleBalanceAdjustments,
  onOpenRecordTx,
  onNavigateToFullTransactions,
  brandfetchClientId,
  merchantLogoOverrides,
  accounts,
  onOpenTransaction,
}) => {
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<TxFilterKind>('all');
  const [expanded, setExpanded] = useState(false);

  const prefContext = usePreferencesContextOptional();
  const effectiveClientId =
    brandfetchClientId ?? (prefContext?.preferences?.brandfetchClientId || '').trim();

  const effectiveOverrides = useMemo(() => {
    const fromProps = merchantLogoOverrides ?? {};
    const fromPrefs = prefContext?.preferences?.merchantLogoOverrides ?? {};
    const fromRules = Object.entries(prefContext?.preferences?.merchantRules ?? {}).reduce<
      Record<string, string>
    >((acc, [key, rule]) => {
      if (rule?.logo) acc[key] = rule.logo;
      return acc;
    }, {});
    return { ...fromPrefs, ...fromRules, ...fromProps };
  }, [
    merchantLogoOverrides,
    prefContext?.preferences?.merchantLogoOverrides,
    prefContext?.preferences?.merchantRules,
  ]);

  const accountsById = useMemo(() => {
    const map = new Map<string, Account>();
    for (const a of accounts || []) {
      map.set(a.id, a);
    }
    return map;
  }, [accounts]);

  const getLogoForTx = (tx: Transaction): string | null => {
    // 1. Merchant name
    if (tx.merchant && tx.merchant.trim()) {
      const url = getMerchantLogoUrl(tx.merchant.trim(), effectiveClientId, effectiveOverrides, {
        fallback: '404',
        type: 'icon',
        width: 80,
        height: 80,
      });
      if (url) return url;
    }

    // 2. Transfer counterpart account's image or institution
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

    // 3. Fallback: check transaction description
    if (tx.description && tx.description.trim()) {
      const url = getMerchantLogoUrl(tx.description.trim(), effectiveClientId, effectiveOverrides, {
        fallback: '404',
        type: 'icon',
        width: 80,
        height: 80,
      });
      if (url) return url;
    }

    // 4. Financial institution for account-level entries (fees, interest, adjustments, card payments)
    const isBankEntry =
      tx.isBalanceAdjustment ||
      tx.category === 'Interest' ||
      tx.category === 'Bank Fee' ||
      tx.category === 'Loan & Debt Payment' ||
      !tx.merchant;

    if (isBankEntry) {
      if (account.imageUrl?.trim()) return account.imageUrl.trim();
      if (account.financialInstitution?.trim()) {
        const url = getMerchantLogoUrl(
          account.financialInstitution.trim(),
          effectiveClientId,
          effectiveOverrides,
          { fallback: '404', type: 'icon', width: 80, height: 80 }
        );
        if (url) return url;
      }
    }

    return null;
  };

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    const walk = (cats: Category[]) => {
      for (const c of cats) {
        map.set(c.name.toLowerCase(), c);
        map.set(c.id, c);
        if (c.subCategories?.length) walk(c.subCategories);
      }
    };
    walk(allCategories);
    return map;
  }, [allCategories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return normalizedTransactions.filter(({ tx, amountInAccountCurrency }) => {
      if (kindFilter === 'transfer' && !tx.transferId && tx.category !== 'Transfer') return false;
      if (kindFilter === 'income' && (amountInAccountCurrency < 0 || tx.transferId)) return false;
      if (kindFilter === 'expense' && (amountInAccountCurrency >= 0 || tx.transferId)) return false;
      if (q) {
        const hay = `${tx.merchant || ''} ${tx.description || ''} ${tx.category || ''} ${tx.notes || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [normalizedTransactions, kindFilter, query]);

  const visibleItems = expanded ? filtered : filtered.slice(0, 15);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-nv-ink">
            Account Ledger ({filtered.length})
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNavigateToFullTransactions && (
            <Button
              variant="secondary"
              size="sm"
              icon="external"
              onClick={onNavigateToFullTransactions}
            >
              Open in transactions
            </Button>
          )}
          <Button variant="primary" size="sm" icon="add" onClick={onOpenRecordTx}>
            Add entry
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            label="All"
            active={kindFilter === 'all'}
            onClick={() => setKindFilter('all')}
          />
          <FilterChip
            label="Inflows"
            active={kindFilter === 'income'}
            onClick={() => setKindFilter('income')}
          />
          <FilterChip
            label="Outflows"
            active={kindFilter === 'expense'}
            onClick={() => setKindFilter('expense')}
          />
          <FilterChip
            label="Transfers"
            active={kindFilter === 'transfer'}
            onClick={() => setKindFilter('transfer')}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <NvIcon
              name="search"
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-nv-muted"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ledger…"
              className="h-11 rounded-full border border-nv-line bg-nv-surface pl-9 pr-4 text-sm text-nv-ink placeholder:text-nv-faint outline-none focus:border-nv-violet"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-nv-muted">
            <span>Adjustments</span>
            <Switch
              checked={showBalanceAdjustments}
              onChange={onToggleBalanceAdjustments}
              label="Show balance adjustments"
            />
          </div>
        </div>
      </div>

      {/* Transaction Rows */}
      {visibleItems.length === 0 ? (
        <EmptyState
          icon="transactions"
          title="No ledger entries match"
          body="Record a new transaction or adjust your filters to inspect historical entries."
        />
      ) : (
        <div className="space-y-1.5">
          {visibleItems.map(({ tx, amountInAccountCurrency, dateStr }) => {
            const cat =
              categoryMap.get((tx.category || '').toLowerCase()) ||
              categoryMap.get(tx.category || '');
            const isIncome = amountInAccountCurrency >= 0;

            const Row = onOpenTransaction ? 'button' : 'div';
            return (
              <Row
                key={tx.id}
                {...(onOpenTransaction
                  ? { type: 'button' as const, onClick: () => onOpenTransaction(tx.id), 'aria-label': `Open ${tx.merchant || tx.description}` }
                  : {})}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-nv-sub bg-nv-surface px-4 py-3 text-left',
                  onOpenTransaction && 'transition-colors hover:bg-nv-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nv-violet'
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <TxLedgerAvatar
                    tx={tx}
                    category={cat}
                    logoUrl={getLogoForTx(tx)}
                    size={40}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-nv-ink">
                        {tx.merchant || tx.description}
                      </span>
                      {tx.isBalanceAdjustment && (
                        <Badge tone="neutral">Reconciliation</Badge>
                      )}
                      {tx.transferId && <Badge tone="sky">Transfer</Badge>}
                    </div>
                    <p className="truncate text-xs text-nv-muted">
                      {formatShortDate(dateStr)} · {cat?.name || tx.category || 'Uncategorized'}
                      {tx.description && tx.merchant && tx.description !== tx.merchant
                        ? ` · ${tx.description}`
                        : ''}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <Money
                    amount={amountInAccountCurrency}
                    currency={account.currency}
                    signed
                    tone={isIncome ? 'income' : 'ink'}
                  />
                  {tx.currency && normalizeCurrency(tx.currency) !== normalizeCurrency(account.currency) && (
                    <p className="text-xs text-nv-muted">
                      Orig: <Money amount={tx.amount} currency={tx.currency} />
                    </p>
                  )}
                </div>
              </Row>
            );
          })}
        </div>
      )}

      {filtered.length > 15 && (
        <div className="flex justify-center pt-1">
          <MoreButton
            expanded={expanded}
            total={filtered.length}
            onToggle={() => setExpanded((v) => !v)}
          />
        </div>
      )}
    </Card>
  );
};

/* ── RecordAccountTxSheet (Quick Entry Drawer for Active Account) ───────── */

type EntryKind = 'expense' | 'income' | 'interest' | 'card_payment';

export const RecordAccountTxSheet: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
  accounts: Account[];
  allCategories: Category[];
  defaultKind?: EntryKind;
  defaultAmount?: number;
  defaultDescription?: string;
  onRecordTx: (draft: {
    date: string;
    description: string;
    merchant?: string;
    amount: number;
    category: string;
    type: 'income' | 'expense';
    principalAmount?: number;
    interestAmount?: number;
  }) => { undo: () => void } | null;
  onRecordInterest: (
    amount: number,
    dateStr?: string,
    description?: string
  ) => { undo: () => void } | null;
  onRecordCardPayment: (
    amount: number,
    fromAccountId?: string,
    dateStr?: string
  ) => { undo: () => void } | null;
}> = ({
  open,
  onOpenChange,
  account,
  accounts,
  allCategories,
  defaultKind = 'expense',
  defaultAmount,
  defaultDescription,
  onRecordTx,
  onRecordInterest,
  onRecordCardPayment,
}) => {
  const phone = !useMediaQuery('(min-width: 768px)');
  const [kind, setKind] = useState<EntryKind>(defaultKind);
  const [amountStr, setAmountStr] = useState('');
  const [dateStr, setDateStr] = useState(() => toLocalISOString(new Date()));
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [fromAccountId, setFromAccountId] = useState('');

  const bankAccounts = useMemo(
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
    if (!open || !account) return;
    setKind(defaultKind);
    setAmountStr(defaultAmount && defaultAmount > 0 ? String(defaultAmount) : '');
    setDateStr(toLocalISOString(new Date()));
    setDescription(defaultDescription || '');
    setFromAccountId(account.settlementAccountId || bankAccounts[0]?.id || '');
    const defaultCat =
      allCategories.find(
        (c) => c.classification === (defaultKind === 'income' ? 'income' : 'expense')
      )?.name || 'General';
    setCategory(defaultCat);
  }, [open, account, defaultKind, defaultAmount, defaultDescription, allCategories, bankAccounts]);

  if (!account) return null;

  const numAmount = parseFloat(amountStr || '0') || 0;

  const availableModes: { id: EntryKind; label: string }[] = [
    { id: 'expense', label: 'Expense' },
    { id: 'income', label: 'Income' },
    ...(account.type === 'Savings' ||
    (account.type === 'Investment' && account.subType === 'Pension Fund')
      ? [{ id: 'interest' as const, label: 'Interest payout' }]
      : []),
    ...(account.type === 'Credit Card'
      ? [{ id: 'card_payment' as const, label: 'Pay statement' }]
      : []),
  ];

  const handleSave = () => {
    if (numAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (kind === 'interest') {
      const res = onRecordInterest(numAmount, dateStr, description || 'Interest Payout');
      if (res?.undo) {
        toast.undo(
          `Logged ${formatCurrency(numAmount, account.currency)} interest on ${account.name}`,
          res.undo
        );
      }
      onOpenChange(false);
      return;
    }

    if (kind === 'card_payment') {
      const res = onRecordCardPayment(
        numAmount,
        fromAccountId || undefined,
        dateStr
      );
      if (!res) {
        toast.error(fromAccountId ? 'The paying account no longer exists' : 'Enter an amount above zero');
        return;
      }
      toast.undo(
        `Recorded ${formatCurrency(numAmount, account.currency)} card payment`,
        res.undo
      );
      onOpenChange(false);
      return;
    }

    const res = onRecordTx({
      date: dateStr,
      description: description.trim() || category,
      merchant: description.trim() || category,
      amount: numAmount,
      category,
      type: kind === 'income' ? 'income' : 'expense',
    });

    if (res?.undo) {
      toast.undo(
        `Recorded ${formatCurrency(numAmount, account.currency)} on ${account.name}`,
        res.undo
      );
    }
    onOpenChange(false);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={`Record Activity · ${account.name}`}
      width={460}
      footer={
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="cta"
            onClick={handleSave}
            disabled={numAmount <= 0}
            className="flex-1"
          >
            Save entry
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <SegmentedTabs<EntryKind>
          label="Entry type"
          size="sm"
          className="w-full"
          value={kind}
          onChange={setKind}
          items={availableModes}
        />

        <div className="rounded-nv-tile bg-nv-inset p-4">
          <AmountPad
            value={amountStr}
            onChange={setAmountStr}
            currency={currencySign(account.currency)}
            keypad={phone}
            label="Transaction amount"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-nv-muted">Date</label>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="h-11 w-full rounded-nv-control border border-nv-line bg-nv-surface px-3.5 text-sm text-nv-ink outline-none focus:border-nv-violet"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-nv-muted">
              Description / merchant
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                kind === 'interest'
                  ? 'Monthly APY Interest'
                  : kind === 'card_payment'
                    ? 'Statement settlement'
                    : 'e.g. Delhaize / Fuel / Rent'
              }
              className="h-11 w-full rounded-nv-control border border-nv-line bg-nv-surface px-3.5 text-sm text-nv-ink outline-none focus:border-nv-violet"
            />
          </div>
        </div>

        {kind === 'card_payment' && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-nv-muted">
              Pay from checking / bank account
            </label>
            <select
              value={fromAccountId}
              onChange={(e) => setFromAccountId(e.target.value)}
              className="h-11 w-full rounded-nv-control border border-nv-line bg-nv-surface px-3.5 text-sm text-nv-ink outline-none focus:border-nv-violet"
            >
              <option value="">External source (do not debit another account)</option>
              {bankAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.currency})
                </option>
              ))}
            </select>
          </div>
        )}

        {(kind === 'expense' || kind === 'income') && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-nv-muted">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-11 w-full rounded-nv-control border border-nv-line bg-nv-surface px-3.5 text-sm text-nv-ink outline-none focus:border-nv-violet"
            >
              {allCategories
                .filter((c) => c.classification === kind)
                .map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              <option value="General">General</option>
            </select>
          </div>
        )}
      </div>
    </Drawer>
  );
};
