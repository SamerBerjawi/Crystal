import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { filingFor, setFiling } from '../utils/rules';
import type { Suggestion } from '../hooks/useTransactionMatcher';
import type { SyncedBillMatchSuggestion } from '../hooks/useSyncedBillMatcher';
import type { Account, Category, Transaction } from '../types';
import { useAccountsContext, usePreferencesContext, useTransactionsContext } from '../contexts/DomainProviders';
import { useCategoryContext, useTagsContext } from '../contexts/FinancialDataContext';
import { useReview } from '../contexts/ReviewContext';
import { normalizeMerchantKey } from '../utils/brandfetch';
import { parseLocalDate } from '../utils';
import { suggestCategories } from '../utils/overviewSummary';
import { setUrlTab } from '../hooks/useUrlTab';
import BulkCategorizeModal from './BulkCategorizeModal';
import CategoryPicker from './CategoryPicker';
import { MatcherConfigPanel } from './MatcherConfigPanel';
import PageHeader from './PageHeader';
import { MerchantLogo } from './EntityIcon';
import { accountIcon } from './AccountCard';
import TransactionDetailModal from './TransactionDetailModal';
import Icon from './ui/Icon';
import { Button, IconButton, SelectionBar } from './ui/Actions';
import { Badge } from './ui/Display';
import { Checkbox, controlStyles } from './ui/Fields';
import { Amount } from './ui/Money';
import { Dialog } from './ui/Overlays';
import { EmptyState } from './ui/States';
import SegmentedControl from './ui/SegmentedControl';
import { Menu } from './ui/Menu';
import { Select, type PickerOption } from './ui/Pickers';
import { useIsMobile } from '../hooks/useIsMobile';
import { cn } from '../lib/utils';

type QueueItem =
  | { kind: 'categorise'; id: string; tx: Transaction }
  | { kind: 'transfer'; id: string; match: Suggestion }
  | { kind: 'bill'; id: string; match: SyncedBillMatchSuggestion };

type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'merchant-asc';

const SORT_OPTIONS: PickerOption[] = [
  { id: 'date-desc', label: 'Newest date' },
  { id: 'date-asc', label: 'Oldest date' },
  { id: 'amount-desc', label: 'Highest amount' },
  { id: 'amount-asc', label: 'Lowest amount' },
  { id: 'merchant-asc', label: 'Name' },
];

const INITIAL_BATCH_SIZE = 40;

const day = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export const confidence = (score: number) => (
  score >= 80 ? { word: 'Likely', tone: 'positive' as const } :
  score >= 60 ? { word: 'Possible', tone: 'attention' as const } :
  { word: 'Unsure', tone: 'neutral' as const }
);

const itemTitle = (item: QueueItem) => {
  if (item.kind === 'categorise') return item.tx.merchant || item.tx.description || 'Transaction';
  if (item.kind === 'transfer') return `${item.match.expenseTx.description || item.match.expenseTx.merchant || 'Transfer out'} → ${item.match.incomeTx.description || item.match.incomeTx.merchant || 'Transfer in'}`;
  return item.match.matchedName || item.match.transaction.merchant || item.match.transaction.description;
};

const itemTx = (item: QueueItem): Transaction => (
  item.kind === 'categorise' ? item.tx :
  item.kind === 'transfer' ? item.match.expenseTx :
  item.match.transaction
);

/**
 * Memoized single row for high-performance rendering of large queues.
 * Avoids any per-row heavy computations.
 */
const QueueRowItem = React.memo<{
  item: QueueItem;
  isActive: boolean;
  isSelected: boolean;
  isSkipped: boolean;
  accountName?: string;
  onSelect: (id: string) => void;
  onToggle: (id: string, isOn: boolean) => void;
}>(({ item, isActive, isSelected, isSkipped, accountName, onSelect, onToggle }) => {
  const tx = itemTx(item);

  return (
    <li
      className={cn(
        'group flex min-h-16 items-center gap-2.5 px-3.5 py-2.5 transition-colors duration-150',
        isActive
          ? 'bg-primary-soft'
          : 'hover:bg-inset/60'
      )}
    >
      <Checkbox
        isSelected={isSelected}
        onChange={isOn => onToggle(item.id, isOn)}
        aria-label={`Select ${itemTitle(item)}`}
      >
        {null}
      </Checkbox>

      <button
        type="button"
        aria-current={isActive ? 'true' : undefined}
        onClick={() => onSelect(item.id)}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
      >
        {/* Visual Icon / Logo */}
        {item.kind === 'categorise' ? (
          <MerchantLogo
            merchant={tx.merchant}
            description={tx.description}
            size={36}
            className="shrink-0"
          />
        ) : item.kind === 'transfer' ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-teal-soft text-teal">
            <Icon name="arrow-data-transfer-horizontal" size={18} />
          </span>
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-blue-soft text-blue">
            <Icon name="calendar-03" size={18} />
          </span>
        )}

        {/* Details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="type-body-strong truncate text-ink">{itemTitle(item)}</span>
            {isSkipped && <Badge tone="neutral">Skipped</Badge>}
          </div>
          <div className="mt-0.5 flex items-center gap-2 truncate text-muted type-caption">
            <span>{day(tx.date)}</span>
            {accountName && (
              <>
                <span>·</span>
                <span className="truncate">{accountName}</span>
              </>
            )}
            {item.kind === 'transfer' && (
              <>
                <span>·</span>
                <span className="truncate text-teal font-medium">{Math.round(item.match.matchScore)}% match</span>
              </>
            )}
            {item.kind === 'bill' && (
              <>
                <span>·</span>
                <span className="truncate text-blue font-medium">{Math.round(item.match.matchScore)}% match</span>
              </>
            )}
          </div>
        </div>

        {/* Amount */}
        <span className="type-figure-row shrink-0 text-ink">
          <Amount value={tx.amount} currency={tx.currency} tone="flow" />
        </span>
      </button>
    </li>
  );
});

QueueRowItem.displayName = 'QueueRowItem';

/**
 * Transaction Queue Review page with 5fr/7fr master-detail layout aligning with Rules and Merchants.
 * High-performance, clean UI without visual clutter.
 */
const ReviewQueue: React.FC = () => {
  const isPhone = useIsMobile();
  const review = useReview();
  const { accounts } = useAccountsContext();
  const { tags } = useTagsContext();
  const { transactions, saveTransaction } = useTransactionsContext();
  const { incomeCategories, expenseCategories } = useCategoryContext();
  const { preferences, setPreferences } = usePreferencesContext();

  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [skipped, setSkipped] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [alwaysFile, setAlwaysFile] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isBulkOpen, setBulkOpen] = useState(false);
  const [detailModalTx, setDetailModalTx] = useState<Transaction | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH_SIZE);

  // O(1) Account Lookup Map for instant rendering
  const accountMap = useMemo(() => new Map(accounts.map(acc => [acc.id, acc])), [accounts]);
  const accountOf = useCallback((tx: Transaction): Account | undefined => accountMap.get(tx.accountId), [accountMap]);

  const allCategories = useMemo(() => [...expenseCategories, ...incomeCategories], [expenseCategories, incomeCategories]);

  const allItems = useMemo<QueueItem[]>(() => [
    ...review.toCategorise.map(tx => ({ kind: 'categorise' as const, id: tx.id, tx })),
    ...review.transfers.map(match => ({ kind: 'transfer' as const, id: match.id, match })),
    ...review.billMatches.map(match => ({ kind: 'bill' as const, id: match.id, match })),
  ], [review.toCategorise, review.transfers, review.billMatches]);

  const counts = {
    total: allItems.length,
    categorise: review.toCategorise.length,
    transfer: review.transfers.length,
    bill: review.billMatches.length,
    skipped: skipped.filter(id => allItems.some(i => i.id === id)).length,
  };

  const items = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = allItems
      .filter(item => filter === 'all' || item.kind === filter)
      .filter(item => {
        if (!query) return true;
        const title = itemTitle(item).toLowerCase();
        const tx = itemTx(item);
        const acc = accountMap.get(tx.accountId)?.name.toLowerCase() || '';
        const desc = (tx.description || '').toLowerCase();
        return title.includes(query) || acc.includes(query) || desc.includes(query);
      });

    return filtered.sort((a, b) => {
      const aSkipped = skipped.includes(a.id);
      const bSkipped = skipped.includes(b.id);
      if (aSkipped !== bSkipped) return aSkipped ? 1 : -1;

      const aTx = itemTx(a);
      const bTx = itemTx(b);

      switch (sortBy) {
        case 'date-desc':
          return bTx.date.localeCompare(aTx.date);
        case 'date-asc':
          return aTx.date.localeCompare(bTx.date);
        case 'amount-desc':
          return Math.abs(bTx.amount) - Math.abs(aTx.amount);
        case 'amount-asc':
          return Math.abs(aTx.amount) - Math.abs(bTx.amount);
        case 'merchant-asc':
          return itemTitle(a).localeCompare(itemTitle(b));
        default:
          return 0;
      }
    });
  }, [allItems, filter, search, skipped, sortBy, accountMap]);

  // Resolve active item
  const active = items.find(item => item.id === activeId) ?? items[0] ?? null;
  const activeIndex = active ? items.findIndex(item => item.id === active.id) : -1;

  // Compute suggestions ONLY for the single active transaction (super fast!)
  const activeSuggestions = useMemo(() => {
    if (active?.kind !== 'categorise') return [];
    const filing = filingFor(active.tx.merchant, preferences.transactionRules);
    return suggestCategories(active.tx, transactions, filing?.actions.find(action => action.field === 'category')?.value);
  }, [active, preferences.transactionRules, transactions]);

  // Default picked to top suggestion for fast 1-click filing
  useEffect(() => {
    if (active?.kind === 'categorise') {
      const filing = filingFor(active.tx.merchant, preferences.transactionRules);
      const suggestions = suggestCategories(active.tx, transactions, filing?.actions.find(action => action.field === 'category')?.value);
      setPicked(suggestions[0] ?? null);
    } else {
      setPicked(null);
    }
    setAlwaysFile(false);
  }, [active?.id, preferences.transactionRules, transactions]);

  const categories = useMemo(() => {
    if (active?.kind === 'categorise' && active.tx.type === 'income') {
      return [...incomeCategories, ...expenseCategories];
    }
    return [...expenseCategories, ...incomeCategories];
  }, [active, expenseCategories, incomeCategories]);

  const applyCategoryToTx = (tx: Transaction, categoryName: string): Transaction => {
    const findCat = (cats: Category[]): Category | undefined => {
      for (const c of cats) {
        if (c.name === categoryName) return c;
        const sub = c.subCategories ? findCat(c.subCategories) : undefined;
        if (sub) return sub;
      }
      return undefined;
    };
    const matched = findCat(allCategories);
    const nextType = matched?.classification || tx.type;
    const nextAmount = nextType === 'income' ? Math.abs(tx.amount) : -Math.abs(tx.amount);
    return { ...tx, category: categoryName, type: nextType, amount: nextAmount };
  };

  /** Smooth next selection without skipping items when one is removed from the queue */
  const selectNextAfterRemoval = (removedId: string) => {
    const currentIndex = items.findIndex(item => item.id === removedId);
    const remaining = items.filter(item => item.id !== removedId);
    if (remaining.length === 0) {
      setActiveId(null);
    } else if (currentIndex < remaining.length) {
      setActiveId(remaining[currentIndex].id);
    } else {
      setActiveId(remaining[remaining.length - 1].id);
    }
  };

  const goPrevious = () => {
    if (activeIndex > 0) setActiveId(items[activeIndex - 1].id);
  };

  const goNext = () => {
    if (activeIndex >= 0 && activeIndex < items.length - 1) {
      setActiveId(items[activeIndex + 1].id);
    }
  };

  const skipCurrent = () => {
    if (!active) return;
    const nextSkipped = skipped.includes(active.id) ? skipped : [...skipped, active.id];
    setSkipped(nextSkipped);
    const unreviewed = items.filter(i => !nextSkipped.includes(i.id) && i.id !== active.id);
    if (unreviewed.length > 0) {
      setActiveId(unreviewed[0].id);
    } else if (activeIndex < items.length - 1) {
      setActiveId(items[activeIndex + 1].id);
    } else if (items.length > 1) {
      setActiveId(items[0].id);
    }
  };

  const unskip = (id: string) => {
    setSkipped(prev => prev.filter(item => item !== id));
  };

  const fileCategory = (categoryToApply?: string) => {
    const chosen = categoryToApply ?? picked ?? activeSuggestions[0];
    if (active?.kind !== 'categorise' || !chosen) return;

    const originalTx = { ...active.tx };
    const originalRules = preferences.transactionRules ?? [];
    const updatedTx = applyCategoryToTx(active.tx, chosen);

    saveTransaction([updatedTx], [], { skipRules: true });

    let ruleKeyAdded: string | undefined = undefined;
    const key = normalizeMerchantKey(active.tx.merchant);
    if (alwaysFile && key) {
      ruleKeyAdded = key;
      const description = filingFor(active.tx.merchant, preferences.transactionRules)?.actions.find(action => action.field === 'description')?.value;
      setPreferences(prev => ({
        ...prev,
        transactionRules: setFiling(prev.transactionRules ?? [], key, active.tx.merchant ?? key, { category: chosen, description }),
      }));
    }

    selectNextAfterRemoval(active.id);

    toast.success(`Filed as ${chosen}`, {
      action: {
        label: 'Undo',
        onClick: () => {
          saveTransaction([originalTx], [], { skipRules: true });
          if (ruleKeyAdded) {
            setPreferences(prev => ({
              ...prev,
              transactionRules: originalRules,
            }));
          }
          setActiveId(originalTx.id);
          toast.info('Filing undone');
        },
      },
    });
  };

  const handleConfirmTransfer = (match: Suggestion) => {
    selectNextAfterRemoval(match.id);
    review.confirmTransfer(match);
    toast.success('Transfer matched and reconciled');
  };

  const handleDismissTransfer = (match: Suggestion) => {
    selectNextAfterRemoval(match.id);
    review.dismissTransfer(match);
    toast.info('Transfer match dismissed');
  };

  const handleConfirmBill = (match: SyncedBillMatchSuggestion) => {
    selectNextAfterRemoval(match.id);
    review.confirmBill(match);
    toast.success(`Marked bill "${match.matchedName}" as paid`);
  };

  const handleDismissBill = (match: SyncedBillMatchSuggestion) => {
    selectNextAfterRemoval(match.id);
    review.dismissBill(match);
    toast.info('Bill match dismissed');
  };

  // Multi-select management
  const selectedItems = allItems.filter(item => selected.has(item.id));
  const selectedTransfers = selectedItems.flatMap(item => (item.kind === 'transfer' ? [item.match] : []));
  const selectedBills = selectedItems.flatMap(item => (item.kind === 'bill' ? [item.match] : []));
  const selectedTxs = selectedItems.flatMap(item => (item.kind === 'categorise' ? [item.tx] : []));

  const toggleSelect = useCallback((id: string, isOn: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (isOn) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const isAllSelected = items.length > 0 && items.every(item => selected.has(item.id));
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map(item => item.id)));
    }
  };

  const isCurrentSkipped = active ? skipped.includes(active.id) : false;

  // The Detail / Action Card (Right Column 7fr on desktop)
  const card = active && (
    <section aria-label="Current queue item" className="min-w-0 space-y-5 rounded-[var(--radius-xl)] surface-card p-6 shadow-sm max-md:p-4">
      {/* Card Header & Controls */}
      <header className="flex items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-center gap-2">
          {isPhone && (
            <IconButton
              icon="arrow-left-01"
              label="Back to queue list"
              onPress={() => setActiveId(null)}
              className="mr-1 shrink-0"
            />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="type-caption font-semibold text-muted">
                {activeIndex >= 0 ? `Item ${activeIndex + 1} of ${items.length}` : 'Review'}
              </span>
              {isCurrentSkipped && <Badge tone="neutral">Skipped</Badge>}
            </div>
            {items.length > 1 && (
              <div className="mt-1 h-1 w-28 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.round(((activeIndex + 1) / items.length) * 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <IconButton
            icon="arrow-left-01"
            label="Previous item"
            isDisabled={activeIndex <= 0}
            onPress={goPrevious}
          />
          <IconButton
            icon="arrow-right-01"
            label="Next item"
            isDisabled={activeIndex < 0 || activeIndex >= items.length - 1}
            onPress={goNext}
          />
          <Menu
            title="Item options"
            trigger={<IconButton icon="more-horizontal" label="More actions" tooltipPlacement="left" />}
            items={[
              ...(active.kind === 'categorise' ? [{
                id: 'details',
                label: 'Inspect full transaction',
                icon: 'view',
                onAction: () => setDetailModalTx(active.tx),
              }] : []),
              {
                id: 'skip',
                label: isCurrentSkipped ? 'Remove skipped status' : 'Skip for now',
                icon: 'forward',
                onAction: isCurrentSkipped ? () => unskip(active.id) : skipCurrent,
              },
            ]}
          />
        </div>
      </header>

      {/* Categorise Card View */}
      {active.kind === 'categorise' && (
        <div className="space-y-5">
          {/* Hero Header */}
          <div className="flex items-start gap-4">
            <MerchantLogo
              merchant={active.tx.merchant}
              description={active.tx.description}
              account={accountOf(active.tx)}
              size={48}
              className="shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="type-section-title truncate text-ink">
                  {active.tx.merchant || active.tx.description || 'Transaction'}
                </h2>
                <Badge tone="attention">Needs category</Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-muted type-caption">
                <span>{day(active.tx.date)}</span>
                {accountOf(active.tx) && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 font-medium text-ink">
                      <Icon name={accountIcon(accountOf(active.tx)!)} size={14} className="text-muted" />
                      {accountOf(active.tx)!.name}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <Amount value={active.tx.amount} currency={active.tx.currency} tone="flow" className="type-figure-hero" />
            </div>
          </div>

          {/* Original memo if different from merchant */}
          {active.tx.description && active.tx.merchant && active.tx.description !== active.tx.merchant && (
            <div className="flex items-center gap-2 rounded-[var(--radius-md)] bg-inset px-3 py-2 text-xs text-muted">
              <Icon name="file-doc" size={14} className="shrink-0" />
              <span className="truncate">Bank memo: “{active.tx.description}”</span>
            </div>
          )}

          {/* Category Picker */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <span className="type-label text-ink">Choose category</span>
            </div>

            <CategoryPicker
              categories={categories}
              suggestions={activeSuggestions}
              value={picked}
              onChange={setPicked}
              alwaysFile={active.tx.merchant ? { merchant: active.tx.merchant, isSelected: alwaysFile, onChange: setAlwaysFile } : undefined}
            />
          </div>

          {/* Clean Actions Footer */}
          <div className="flex flex-col-reverse gap-2 pt-2 md:flex-row md:items-center md:justify-between">
            <Button variant="ghost" onPress={skipCurrent}>
              Skip for now
            </Button>
            <Button
              isDisabled={!picked && activeSuggestions.length === 0}
              onPress={() => fileCategory(picked || activeSuggestions[0])}
              icon="tick-02"
            >
              {picked
                ? `File as ${picked}`
                : activeSuggestions[0]
                ? `File as ${activeSuggestions[0]}`
                : 'File it'}
            </Button>
          </div>
        </div>
      )}

      {/* Transfer Match View */}
      {active.kind === 'transfer' && (
        <div className="space-y-4">
          <div className="rounded-[var(--radius-lg)] border border-primary/20 bg-primary-soft/20 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <Icon name="arrow-data-transfer-horizontal" size={18} />
                <span>Detected Transfer Match</span>
              </div>
              <Badge tone={confidence(active.match.matchScore).tone}>
                {confidence(active.match.matchScore).word}, {Math.round(active.match.matchScore)}%
              </Badge>
            </div>
            <p className="type-caption mt-1.5 text-muted">
              These two transactions match by amount and occurred {active.match.daysDiff === 0 ? 'on the same day' : `${active.match.daysDiff} ${active.match.daysDiff === 1 ? 'day' : 'days'} apart`}. Reconciling will link them as an internal account transfer so your spending reports remain accurate.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {/* Outflow Leg */}
            <div className="space-y-2 rounded-[var(--radius-lg)] bg-inset p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="type-caption flex items-center gap-1.5 font-semibold text-money-out">
                  <Icon name="arrow-up-02" size={14} /> Money out (From)
                </span>
                <span className="type-caption truncate text-muted">{accountOf(active.match.expenseTx)?.name ?? 'Account'}</span>
              </div>
              <p className="type-body-strong truncate text-ink">{active.match.expenseTx.merchant || active.match.expenseTx.description}</p>
              <div className="flex items-center justify-between pt-1">
                <span className="type-caption text-muted">{day(active.match.expenseTx.date)}</span>
                <Amount value={active.match.expenseTx.amount} currency={active.match.expenseTx.currency} tone="flow" className="type-figure-row" />
              </div>
            </div>

            {/* Inflow Leg */}
            <div className="space-y-2 rounded-[var(--radius-lg)] bg-inset p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="type-caption flex items-center gap-1.5 font-semibold text-money-in">
                  <Icon name="arrow-down-02" size={14} /> Money in (To)
                </span>
                <span className="type-caption truncate text-muted">{accountOf(active.match.incomeTx)?.name ?? 'Account'}</span>
              </div>
              <p className="type-body-strong truncate text-ink">{active.match.incomeTx.merchant || active.match.incomeTx.description}</p>
              <div className="flex items-center justify-between pt-1">
                <span className="type-caption text-muted">{day(active.match.incomeTx.date)}</span>
                <Amount value={active.match.incomeTx.amount} currency={active.match.incomeTx.currency} tone="flow" className="type-figure-row" />
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 md:flex-row md:justify-end">
            <Button variant="ghost" onPress={() => handleDismissTransfer(active.match)}>
              Not a transfer
            </Button>
            <Button onPress={() => handleConfirmTransfer(active.match)} icon="tick-02">
              Match as transfer
            </Button>
          </div>
        </div>
      )}

      {/* Bill Match View */}
      {active.kind === 'bill' && (
        <div className="space-y-4">
          <div className="rounded-[var(--radius-lg)] border border-blue/20 bg-blue-soft/20 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold text-blue">
                <Icon name="calendar-03" size={18} />
                <span>Planned {active.match.itemType === 'bill' ? 'Bill' : 'Recurring Item'} Match</span>
              </div>
              <Badge tone={confidence(active.match.matchScore).tone}>
                {confidence(active.match.matchScore).word}, {Math.round(active.match.matchScore)}%
              </Badge>
            </div>
            <p className="type-caption mt-1.5 text-muted">
              This bank transaction matches your scheduled payment “{active.match.matchedName}”. Confirming will mark it as paid for this cycle and update your cashflow forecast.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {/* Bank Transaction */}
            <div className="space-y-2 rounded-[var(--radius-lg)] bg-inset p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="type-caption flex items-center gap-1.5 font-semibold text-ink">
                  <Icon name="bank" size={14} /> Bank transaction
                </span>
                <span className="type-caption truncate text-muted">{accountOf(active.match.transaction)?.name ?? 'Account'}</span>
              </div>
              <p className="type-body-strong truncate text-ink">{active.match.transaction.merchant || active.match.transaction.description}</p>
              <div className="flex items-center justify-between pt-1">
                <span className="type-caption text-muted">{day(active.match.transaction.date)}</span>
                <Amount value={active.match.transaction.amount} currency={active.match.transaction.currency} tone="flow" className="type-figure-row" />
              </div>
            </div>

            {/* Scheduled Bill */}
            <div className="space-y-2 rounded-[var(--radius-lg)] bg-inset p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="type-caption flex items-center gap-1.5 font-semibold text-ink">
                  <Icon name="calendar-check" size={14} /> Scheduled item
                </span>
                <span className="type-caption text-muted">Planned</span>
              </div>
              <p className="type-body-strong truncate text-ink">{active.match.matchedName}</p>
              <div className="flex items-center justify-between pt-1">
                <span className="type-caption text-muted">{day(active.match.matchedDate)}</span>
                <Amount value={active.match.matchedAmount} currency={active.match.matchedCurrency ?? active.match.transaction.currency} tone="plain" className="type-figure-row" />
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 md:flex-row md:justify-end">
            <Button variant="ghost" onPress={() => handleDismissBill(active.match)}>
              Not this bill
            </Button>
            <Button onPress={() => handleConfirmBill(active.match)} icon="tick-02">
              Mark as paid
            </Button>
          </div>
        </div>
      )}
    </section>
  );

  // Visible items slice for fast DOM rendering
  const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);

  // The Queue List (Left Column 5fr on desktop)
  const list = (
    <div className="min-w-0 overflow-hidden rounded-[var(--radius-xl)] surface-card shadow-sm">
      {/* List Header Bar */}
      <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
        <Checkbox
          isSelected={isAllSelected}
          isIndeterminate={selected.size > 0 && !isAllSelected}
          onChange={toggleSelectAll}
          aria-label="Select all items in queue"
        >
          <span className="type-label text-ink">Select all ({items.length})</span>
        </Checkbox>
        <div className="flex items-center gap-2">
          {counts.skipped > 0 && (
            <button
              type="button"
              onClick={() => setSkipped([])}
              className="cursor-pointer text-xs font-semibold text-primary hover:underline"
            >
              Reset {counts.skipped} skipped
            </button>
          )}
          <span className="type-caption text-muted">{items.length} waiting</span>
        </div>
      </div>

      {/* List Rows */}
      <ul className="min-w-0 divide-y divide-line">
        {visibleItems.map(item => {
          const tx = itemTx(item);
          const accName = accountMap.get(tx.accountId)?.name;

          return (
            <QueueRowItem
              key={item.id}
              item={item}
              isActive={item.id === active?.id}
              isSelected={selected.has(item.id)}
              isSkipped={skipped.includes(item.id)}
              accountName={accName}
              onSelect={setActiveId}
              onToggle={toggleSelect}
            />
          );
        })}
      </ul>

      {/* Load More Slice for large queues */}
      {items.length > visibleCount && (
        <div className="border-t border-line p-3 text-center">
          <Button variant="ghost" size="sm" onPress={() => setVisibleCount(c => c + INITIAL_BATCH_SIZE)}>
            Show more ({items.length - visibleCount} remaining)
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Page Header aligning with Merchants and Rules */}
      <PageHeader
        title="Review Queue"
        subtitle={allItems.length === 0 ? 'All transactions reviewed.' : `${allItems.length} items waiting for your review`}
        stats={[
          { label: 'To review', icon: 'tick-02', value: allItems.length, iconTone: allItems.length > 0 ? 'attention' : 'positive' },
          { label: 'Uncategorised', icon: 'tag', value: counts.categorise, iconTone: counts.categorise > 0 ? 'tomato' : 'neutral' },
          { label: 'Transfers', icon: 'arrow-data-transfer-horizontal', value: counts.transfer, iconTone: 'teal' },
          { label: 'Bills', icon: 'calendar-03', value: counts.bill, iconTone: 'blue' },
        ]}
        actions={
          <>
            {review.likelyCount > 0 && (
              <Button variant="primary" icon="magic-wand-01" onPress={review.confirmLikely}>
                Approve {review.likelyCount} likely
              </Button>
            )}
            {counts.transfer + counts.bill > 0 && (
              <Button variant="ghost" onPress={review.dismissAll}>
                Dismiss matches
              </Button>
            )}
            <IconButton
              icon="sliders-horizontal"
              label="Matching settings"
              tooltipPlacement="bottom"
              onPress={() => setSettingsOpen(true)}
            />
          </>
        }
      />

      {allItems.length === 0 ? (
        <EmptyState
          icon="tick-02"
          title="All clear! Nice work."
          description="Every new transaction has been categorised and reconciliations are settled."
          actionLabel="View in Ledger"
          onAction={() => setUrlTab(null)}
        />
      ) : (
        <>
          {/* Controls Bar: Tabs, Search, Sort */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <SegmentedControl
              scrollable
              items={[
                { id: 'all', label: 'All', badge: allItems.length },
                { id: 'categorise', label: 'To categorise', badge: counts.categorise },
                { id: 'transfer', label: 'Transfers', badge: counts.transfer },
                { id: 'bill', label: 'Bills', badge: counts.bill },
              ]}
              activeId={filter}
              onChange={setFilter}
            />

            <div className="flex flex-1 items-center justify-end gap-2 max-md:w-full">
              <div className="relative min-w-0 flex-1 md:max-w-xs">
                <Icon name="search-01" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  aria-label="Search the queue"
                  placeholder="Search merchant, account, amount..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className={cn(controlStyles, 'h-10 pl-9 pr-3 text-[.9375rem] max-md:h-12 max-md:text-base')}
                />
              </div>
              <Select
                variant="chip"
                label="Sort order"
                value={sortBy}
                onChange={val => setSortBy(val as SortOption)}
                options={SORT_OPTIONS}
              />
            </div>
          </div>

          {/* Master-Detail Content */}
          {items.length === 0 ? (
            <EmptyState
              icon="search-01"
              title="No matching queue items"
              description={`Nothing in the review queue matches “${search}”.`}
              actionLabel="Clear search"
              onAction={() => { setSearch(''); setFilter('all'); }}
            />
          ) : isPhone ? (
            activeId && active ? (
              <div className="space-y-3">{card}</div>
            ) : (
              list
            )
          ) : (
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <div className="min-w-0">{list}</div>
              <div className="min-w-0 lg:sticky lg:top-4">{card}</div>
            </div>
          )}
        </>
      )}

      {/* Bulk Selection Bar */}
      {selected.size > 0 && (
        <SelectionBar count={selected.size} onClear={() => setSelected(new Set())}>
          {selectedTxs.length > 0 && (
            <Button size="sm" variant="ghost" onPress={() => setBulkOpen(true)}>
              Categorise {selectedTxs.length}
            </Button>
          )}
          {selectedTransfers.length + selectedBills.length > 0 && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onPress={() => {
                  review.confirmMatches(selectedTransfers, selectedBills);
                  setSelected(new Set());
                  toast.success(`Confirmed ${selectedTransfers.length + selectedBills.length} matches`);
                }}
              >
                Confirm matches
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onPress={() => {
                  review.dismissMatches(selectedTransfers, selectedBills);
                  setSelected(new Set());
                  toast.info(`Dismissed ${selectedTransfers.length + selectedBills.length} matches`);
                }}
              >
                Dismiss
              </Button>
            </>
          )}
        </SelectionBar>
      )}

      {/* Bulk Categorize Modal */}
      {isBulkOpen && (
        <BulkCategorizeModal
          onClose={() => setBulkOpen(false)}
          onSave={name => {
            saveTransaction(selectedTxs.map(tx => applyCategoryToTx(tx, name)), [], { skipRules: true });
            setBulkOpen(false);
            setSelected(new Set());
            toast.success(`Categorised ${selectedTxs.length} transactions as ${name}`);
          }}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
        />
      )}

      {/* Matcher Configuration Dialog */}
      <Dialog isOpen={isSettingsOpen} onClose={() => setSettingsOpen(false)} title="Matching settings">
        <MatcherConfigPanel config={review.config} onChange={review.updateConfig} onReset={review.resetConfig} />
      </Dialog>

      {/* Full Transaction Inspection Modal */}
      {detailModalTx && (
        <TransactionDetailModal
          isOpen={Boolean(detailModalTx)}
          onClose={() => setDetailModalTx(null)}
          transactions={[detailModalTx]}
          accounts={accounts}
          tags={tags}
          onEdit={updated => {
            saveTransaction([updated]);
            setDetailModalTx(null);
            toast.success('Transaction updated');
          }}
          onRecategorize={(tx, cat) => {
            saveTransaction([applyCategoryToTx(tx, cat)], [], { skipRules: true });
            selectNextAfterRemoval(tx.id);
            setDetailModalTx(null);
            toast.success(`Filed as ${cat}`);
          }}
        />
      )}
    </div>
  );
};

export default ReviewQueue;
