import React, { useEffect, useMemo, useState } from 'react';
import type { Suggestion } from '../hooks/useTransactionMatcher';
import type { SyncedBillMatchSuggestion } from '../hooks/useSyncedBillMatcher';
import type { Account, Transaction } from '../types';
import { useAccountsContext, usePreferencesContext, useTransactionsContext } from '../contexts/DomainProviders';
import { useCategoryContext } from '../contexts/FinancialDataContext';
import { useReview } from '../contexts/ReviewContext';
import { normalizeMerchantKey } from '../utils/brandfetch';
import { parseLocalDate } from '../utils';
import { suggestCategories } from '../utils/overviewSummary';
import BulkCategorizeModal from './BulkCategorizeModal';
import CategoryPicker from './CategoryPicker';
import { MatcherConfigPanel } from './MatcherConfigPanel';
import Icon from './ui/Icon';
import { Button, IconButton, SelectionBar } from './ui/Actions';
import { Badge } from './ui/Display';
import { Checkbox, controlStyles } from './ui/Fields';
import { Amount } from './ui/Money';
import { Dialog } from './ui/Overlays';
import { EmptyState } from './ui/States';
import SegmentedControl from './ui/SegmentedControl';
import { useIsMobile } from '../hooks/useIsMobile';
import { cn } from '../lib/utils';

type QueueItem =
  | { kind: 'categorise'; id: string; tx: Transaction }
  | { kind: 'transfer'; id: string; match: Suggestion }
  | { kind: 'bill'; id: string; match: SyncedBillMatchSuggestion };

const day = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export const confidence = (score: number) => (score >= 80 ? { word: 'Likely', tone: 'positive' as const } : score >= 60 ? { word: 'Possible', tone: 'attention' as const } : { word: 'Unsure', tone: 'neutral' as const });

const itemTitle = (item: QueueItem) => {
  if (item.kind === 'categorise') return item.tx.merchant || item.tx.description;
  if (item.kind === 'transfer') return `${item.match.expenseTx.description || 'Payment'} and ${item.match.incomeTx.description || 'deposit'}`;
  return item.match.transaction.merchant || item.match.transaction.description;
};

const itemContext = (item: QueueItem) => {
  if (item.kind === 'categorise') return 'To categorise';
  if (item.kind === 'transfer') return 'Possible transfer';
  return `Possible bill: ${item.match.matchedName}`;
};

const itemTx = (item: QueueItem) => (item.kind === 'categorise' ? item.tx : item.kind === 'transfer' ? item.match.expenseTx : item.match.transaction);

const TxLine: React.FC<{ tx: Transaction; account?: Account; label?: string }> = ({ tx, account, label }) => (
  <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-inset p-3">
    <div className="min-w-0">
      {label && <p className="type-caption text-muted">{label}</p>}
      <p className="type-body-strong truncate text-ink">{tx.merchant || tx.description}</p>
      <p className="type-caption truncate text-muted">{day(tx.date)}{account ? `, ${account.name}` : ''}</p>
    </div>
    <p className="type-figure-row shrink-0 text-ink"><Amount value={tx.amount} currency={tx.currency} tone="flow" /></p>
  </div>
);

/** One queue for uncategorised transactions and transfer and bill matches (D-008), one card at a time. */
const ReviewQueue: React.FC = () => {
  const isPhone = useIsMobile();
  const review = useReview();
  const { accounts } = useAccountsContext();
  const { transactions, saveTransaction } = useTransactionsContext();
  const { incomeCategories, expenseCategories } = useCategoryContext();
  const { preferences, setPreferences } = usePreferencesContext();

  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [skipped, setSkipped] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [alwaysFile, setAlwaysFile] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isBulkOpen, setBulkOpen] = useState(false);

  const allItems = useMemo<QueueItem[]>(() => [
    ...review.toCategorise.map(tx => ({ kind: 'categorise' as const, id: tx.id, tx })),
    ...review.transfers.map(match => ({ kind: 'transfer' as const, id: match.id, match })),
    ...review.billMatches.map(match => ({ kind: 'bill' as const, id: match.id, match })),
  ], [review.toCategorise, review.transfers, review.billMatches]);

  const counts = {
    categorise: review.toCategorise.length,
    transfer: review.transfers.length,
    bill: review.billMatches.length,
  };

  const items = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allItems
      .filter(item => filter === 'all' || item.kind === filter)
      .filter(item => !query || `${itemTitle(item)} ${itemContext(item)}`.toLowerCase().includes(query))
      .sort((a, b) => Number(skipped.includes(a.id)) - Number(skipped.includes(b.id)));
  }, [allItems, filter, search, skipped]);

  const active = items.find(item => item.id === activeId) ?? items[0];

  useEffect(() => {
    setPicked(null);
    setAlwaysFile(false);
  }, [active?.id]);

  const suggestions = useMemo(() => {
    if (active?.kind !== 'categorise') return [];
    const rule = preferences.merchantRules?.[normalizeMerchantKey(active.tx.merchant) ?? ''];
    return suggestCategories(active.tx, transactions, rule?.category);
  }, [active, transactions, preferences.merchantRules]);

  const accountOf = (tx: Transaction) => accounts.find(account => account.id === tx.accountId);
  const categories = active?.kind === 'categorise' && active.tx.type === 'income' ? incomeCategories : expenseCategories;

  const advance = () => {
    const index = items.findIndex(item => item.id === active?.id);
    setActiveId(items[index + 1]?.id ?? null);
  };

  const fileCategory = () => {
    if (active?.kind !== 'categorise' || !picked) return;
    advance();
    saveTransaction([{ ...active.tx, category: picked }], [], { skipRules: true });
    const key = normalizeMerchantKey(active.tx.merchant);
    if (alwaysFile && key) {
      setPreferences(prev => ({ ...prev, merchantRules: { ...(prev.merchantRules || {}), [key]: { ...(prev.merchantRules?.[key] || {}), category: picked } } }));
    }
  };

  const selectedItems = allItems.filter(item => selected.has(item.id));
  const selectedTransfers = selectedItems.flatMap(item => (item.kind === 'transfer' ? [item.match] : []));
  const selectedBills = selectedItems.flatMap(item => (item.kind === 'bill' ? [item.match] : []));
  const selectedTxs = selectedItems.flatMap(item => (item.kind === 'categorise' ? [item.tx] : []));
  const toggle = (id: string, isOn: boolean) => setSelected(prev => {
    const next = new Set(prev);
    if (isOn) next.add(id);
    else next.delete(id);
    return next;
  });

  const card = active && (
    <section aria-label="Current item" className="min-w-0 space-y-4 rounded-[var(--radius-xl)] border border-line bg-surface p-6 max-md:p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="type-caption text-muted">{itemContext(active)}</p>
          <h2 className="type-section-title truncate text-ink">{itemTitle(active)}</h2>
        </div>
        {active.kind !== 'categorise' && <Badge tone={confidence(active.match.matchScore).tone}>{confidence(active.match.matchScore).word}, {Math.round(active.match.matchScore)}%</Badge>}
      </header>

      {active.kind === 'categorise' && (
        <>
          <TxLine tx={active.tx} account={accountOf(active.tx)} />
          {active.tx.description && active.tx.description !== active.tx.merchant && <p className="type-body text-muted">{active.tx.description}</p>}
          <CategoryPicker
            categories={categories}
            suggestions={suggestions}
            value={picked}
            onChange={setPicked}
            alwaysFile={active.tx.merchant ? { merchant: active.tx.merchant, isSelected: alwaysFile, onChange: setAlwaysFile } : undefined}
          />
          <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <Button variant="ghost" onPress={() => { setSkipped(prev => [...prev, active.id]); advance(); }}>Skip for now</Button>
            <Button isDisabled={!picked} onPress={fileCategory}>File it</Button>
          </div>
        </>
      )}

      {active.kind === 'transfer' && (
        <>
          <TxLine tx={active.match.expenseTx} account={accountOf(active.match.expenseTx)} label="Money out" />
          <TxLine tx={active.match.incomeTx} account={accountOf(active.match.incomeTx)} label="Money in" />
          <p className="type-body text-muted">{active.match.daysDiff === 0 ? 'Same day.' : `${active.match.daysDiff} ${active.match.daysDiff === 1 ? 'day' : 'days'} apart.`}</p>
          <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <Button variant="ghost" onPress={() => { advance(); review.dismissTransfer(active.match); }}>Not a transfer</Button>
            <Button onPress={() => { advance(); review.confirmTransfer(active.match); }}>Match as transfer</Button>
          </div>
        </>
      )}

      {active.kind === 'bill' && (
        <>
          <TxLine tx={active.match.transaction} account={accountOf(active.match.transaction)} label="Transaction" />
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-inset p-3">
            <div className="min-w-0">
              <p className="type-caption text-muted">Planned {active.match.itemType === 'bill' ? 'bill' : 'recurring item'}</p>
              <p className="type-body-strong truncate text-ink">{active.match.matchedName}</p>
              <p className="type-caption text-muted">{day(active.match.matchedDate)}</p>
            </div>
            <p className="type-figure-row shrink-0 text-ink"><Amount value={active.match.matchedAmount} currency={active.match.transaction.currency} /></p>
          </div>
          <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <Button variant="ghost" onPress={() => { advance(); review.dismissBill(active.match); }}>Not this bill</Button>
            <Button onPress={() => { advance(); review.confirmBill(active.match); }}>Mark as paid</Button>
          </div>
        </>
      )}
    </section>
  );

  const list = (
    <ul className="min-w-0 divide-y divide-line overflow-hidden rounded-[var(--radius-xl)] border border-line bg-surface">
      {items.map(item => {
        const tx = itemTx(item);
        return (
          <li key={item.id} className={cn('flex min-h-16 items-center gap-1 pl-3', item.id === active?.id && 'bg-primary-soft')}>
            <Checkbox isSelected={selected.has(item.id)} onChange={isOn => toggle(item.id, isOn)} aria-label={`Select ${itemTitle(item)}`}>{null}</Checkbox>
            <button type="button" aria-current={item.id === active?.id ? 'true' : undefined} onClick={() => setActiveId(item.id)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-2 pr-3 text-left">
              <span className="min-w-0 flex-1">
                <span className="type-body-strong block truncate text-ink">{itemTitle(item)}</span>
                <span className="type-caption block truncate text-muted">{itemContext(item)}</span>
              </span>
              <span className="type-figure-row shrink-0 text-ink"><Amount value={tx.amount} currency={tx.currency} tone="flow" /></span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="type-page-title text-ink">Review queue</h1>
          <p className="type-body text-muted">{allItems.length === 0 ? 'All clear.' : `${allItems.length} waiting. Work through them one at a time.`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {review.likelyCount > 0 && <Button variant="soft" onPress={review.confirmLikely}>Confirm {review.likelyCount} likely</Button>}
          {counts.transfer + counts.bill > 0 && <Button variant="ghost" onPress={review.dismissAll}>Dismiss matches</Button>}
          <IconButton icon="tune" label="Matching settings" tooltipPlacement="bottom" onPress={() => setSettingsOpen(true)} />
        </div>
      </header>

      {allItems.length === 0 ? (
        <EmptyState icon="check" title="Nothing to review. Nice." description="New transactions that need a look appear here." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
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
            <div className="relative min-w-0 flex-1 md:max-w-xs">
              <Icon name="search" size={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input type="search" aria-label="Search the queue" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} className={cn(controlStyles, 'h-10 pl-10 pr-3 text-[.9375rem] max-md:h-12 max-md:text-base')} />
            </div>
          </div>

          {items.length === 0 ? (
            <EmptyState icon="search" title="No matches" description={`Nothing here matches “${search}”.`} actionLabel="Clear search" onAction={() => { setSearch(''); setFilter('all'); }} />
          ) : isPhone ? (
            <>
              <p className="type-caption text-muted">{Math.max(1, items.findIndex(item => item.id === active?.id) + 1)} of {items.length}</p>
              {card}
            </>
          ) : (
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <div className="lg:order-2 lg:sticky lg:top-0">{card}</div>
              <div className="lg:order-1">{list}</div>
            </div>
          )}
        </>
      )}

      {selected.size > 0 && (
        <SelectionBar count={selected.size} onClear={() => setSelected(new Set())}>
          {selectedTxs.length > 0 && <Button size="sm" variant="ghost" onPress={() => setBulkOpen(true)}>Categorise {selectedTxs.length}</Button>}
          {selectedTransfers.length + selectedBills.length > 0 && (
            <>
              <Button size="sm" variant="ghost" onPress={() => { review.confirmMatches(selectedTransfers, selectedBills); setSelected(new Set()); }}>Confirm matches</Button>
              <Button size="sm" variant="ghost" onPress={() => { review.dismissMatches(selectedTransfers, selectedBills); setSelected(new Set()); }}>Dismiss</Button>
            </>
          )}
        </SelectionBar>
      )}

      {isBulkOpen && (
        <BulkCategorizeModal
          onClose={() => setBulkOpen(false)}
          onSave={name => {
            saveTransaction(selectedTxs.map(tx => ({ ...tx, category: name })), [], { skipRules: true });
            setBulkOpen(false);
            setSelected(new Set());
          }}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
        />
      )}
      <Dialog isOpen={isSettingsOpen} onClose={() => setSettingsOpen(false)} title="Matching settings">
        <MatcherConfigPanel config={review.config} onChange={review.updateConfig} onReset={review.resetConfig} />
      </Dialog>
    </div>
  );
};

export default ReviewQueue;
