import React, { useMemo, useState } from 'react';
import type { Suggestion } from '../hooks/useTransactionMatcher';
import type { SyncedBillMatchSuggestion } from '../hooks/useSyncedBillMatcher';
import type { Account, Transaction } from '../types';
import { parseLocalDate } from '../utils';
import { useAccountsContext } from '../contexts/DomainProviders';
import { useReview } from '../contexts/ReviewContext';
import { Button, SelectionBar } from './ui/Actions';
import { Badge } from './ui/Display';
import { Checkbox, controlStyles } from './ui/Fields';
import Icon from './ui/Icon';
import { Amount } from './ui/Money';
import { Dialog } from './ui/Overlays';
import SegmentedControl from './ui/SegmentedControl';
import { EmptyState } from './ui/States';
import { cn } from '../lib/utils';

export interface PendingMatchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFilter?: 'all' | 'transfer' | 'bill';
  onOpenFullQueue?: () => void;
}

type MatchItem =
  | { kind: 'transfer'; id: string; score: number; match: Suggestion }
  | { kind: 'bill'; id: string; score: number; match: SyncedBillMatchSuggestion };

const day = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const confidence = (score: number) => (
  score >= 80
    ? { word: 'Likely', tone: 'positive' as const }
    : score >= 60
    ? { word: 'Possible', tone: 'attention' as const }
    : { word: 'Unsure', tone: 'neutral' as const }
);

const TxCard: React.FC<{ tx: Transaction; account?: Account; label: string; tone?: 'flow' | 'plain' }> = ({ tx, account, label, tone }) => (
  <div className="flex-1 min-w-0 rounded-[var(--radius-lg)] bg-inset p-3">
    <div className="flex items-center justify-between gap-2">
      <span className="type-caption text-muted truncate">{label}</span>
      {account && <span className="type-caption text-muted truncate">{account.name}</span>}
    </div>
    <p className="type-body-strong truncate text-ink mt-0.5">{tx.merchant || tx.description}</p>
    <div className="flex items-center justify-between gap-2 mt-1">
      <span className="type-caption text-muted">{day(tx.date)}</span>
      <span className="type-figure-row shrink-0 text-ink">
        <Amount value={tx.amount} currency={tx.currency} tone={tone ?? 'flow'} />
      </span>
    </div>
  </div>
);

export const PendingMatchesModal: React.FC<PendingMatchesModalProps> = ({
  isOpen,
  onClose,
  initialFilter = 'all',
  onOpenFullQueue,
}) => {
  const review = useReview();
  const { accounts } = useAccountsContext();
  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);

  const [filter, setFilter] = useState<'all' | 'transfer' | 'bill'>(initialFilter);
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | 'likely' | 'possible'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allItems = useMemo<MatchItem[]>(() => [
    ...review.transfers.map(match => ({ kind: 'transfer' as const, id: `transfer-${match.id}`, score: match.matchScore, match })),
    ...review.billMatches.map(match => ({ kind: 'bill' as const, id: `bill-${match.id}`, score: match.matchScore, match })),
  ].sort((a, b) => b.score - a.score), [review.transfers, review.billMatches]);

  const counts = {
    all: allItems.length,
    transfer: review.transfers.length,
    bill: review.billMatches.length,
  };

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allItems.filter(item => {
      if (filter !== 'all' && item.kind !== filter) return false;
      if (confidenceFilter === 'likely' && item.score < 80) return false;
      if (confidenceFilter === 'possible' && item.score >= 80) return false;

      if (q) {
        if (item.kind === 'transfer') {
          const t = item.match;
          const expAcc = accountMap.get(t.expenseTx.accountId)?.name || '';
          const incAcc = accountMap.get(t.incomeTx.accountId)?.name || '';
          const text = `${t.expenseTx.merchant || ''} ${t.expenseTx.description} ${t.incomeTx.merchant || ''} ${t.incomeTx.description} ${expAcc} ${incAcc}`.toLowerCase();
          if (!text.includes(q)) return false;
        } else {
          const b = item.match;
          const acc = accountMap.get(b.transaction.accountId)?.name || '';
          const text = `${b.transaction.merchant || ''} ${b.transaction.description} ${b.matchedName} ${acc}`.toLowerCase();
          if (!text.includes(q)) return false;
        }
      }
      return true;
    });
  }, [allItems, filter, confidenceFilter, search, accountMap]);

  const toggle = (id: string, isOn: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (isOn) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectedItems = allItems.filter(item => selected.has(item.id));
  const selectedTransfers = selectedItems.flatMap(item => (item.kind === 'transfer' ? [item.match] : []));
  const selectedBills = selectedItems.flatMap(item => (item.kind === 'bill' ? [item.match] : []));

  const handleConfirmSelected = () => {
    review.confirmMatches(selectedTransfers, selectedBills);
    setSelected(new Set());
  };

  const handleDismissSelected = () => {
    review.dismissMatches(selectedTransfers, selectedBills);
    setSelected(new Set());
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      width={720}
      title="Pending matches"
      description="Reconcile internal transfers and match bank transactions against planned bills."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {onOpenFullQueue && (
              <Button size="sm" variant="ghost" onPress={() => { onClose(); onOpenFullQueue(); }}>
                Open full queue
              </Button>
            )}
            {allItems.length > 0 && (
              <Button size="sm" variant="ghost" onPress={() => { review.dismissAll(); onClose(); }}>
                Dismiss all ({allItems.length})
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {review.likelyCount > 0 && (
              <Button size="sm" variant="soft" onPress={() => { review.confirmLikely(); }}>
                Approve likely ({review.likelyCount})
              </Button>
            )}
            <Button size="sm" variant="secondary" onPress={onClose}>
              Close
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            scrollable
            items={[
              { id: 'all', label: 'All', badge: counts.all },
              { id: 'transfer', label: 'Transfers', badge: counts.transfer },
              { id: 'bill', label: 'Bills', badge: counts.bill },
            ]}
            activeId={filter}
            onChange={id => setFilter(id as 'all' | 'transfer' | 'bill')}
          />
          <SegmentedControl
            scrollable
            items={[
              { id: 'all', label: 'All confidence' },
              { id: 'likely', label: 'Likely (≥80%)' },
              { id: 'possible', label: 'Needs review' },
            ]}
            activeId={confidenceFilter}
            onChange={id => setConfidenceFilter(id as 'all' | 'likely' | 'possible')}
          />
          <div className="relative min-w-0 flex-1 md:max-w-xs">
            <Icon name="search-01" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search"
              aria-label="Search matches"
              placeholder="Search matches"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={cn(controlStyles, 'h-9 pl-9 pr-3 text-sm')}
            />
          </div>
        </div>

        {/* Matches List */}
        {filteredItems.length === 0 ? (
          <EmptyState
            icon="tick-02"
            title={search ? 'No matches found' : 'All caught up'}
            description={search ? `Nothing matches "${search}".` : 'No pending matches waiting for review.'}
            actionLabel={search ? 'Clear search' : undefined}
            onAction={search ? () => setSearch('') : undefined}
          />
        ) : (
          <div className="space-y-3">
            {filteredItems.map(item => {
              const conf = confidence(item.score);
              const isSelected = selected.has(item.id);

              return (
                <div
                  key={item.id}
                  className={cn(
                    'rounded-[var(--radius-xl)] surface-card border border-line p-4 transition-all',
                    isSelected && 'border-primary ring-1 ring-primary/20'
                  )}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 pb-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        isSelected={isSelected}
                        onChange={isOn => toggle(item.id, isOn)}
                        aria-label={`Select ${item.id}`}
                      >
                        {null}
                      </Checkbox>
                      <Badge tone="neutral">
                        {item.kind === 'transfer' ? 'Transfer match' : 'Bill match'}
                      </Badge>
                      <span className="type-caption text-muted">
                        {item.kind === 'transfer'
                          ? item.match.daysDiff === 0 ? 'Same day' : `${item.match.daysDiff}d variance`
                          : item.match.daysDiff === 0 ? 'Exact date' : `±${item.match.daysDiff}d variance`}
                      </span>
                    </div>
                    <Badge tone={conf.tone}>{conf.word}, {Math.round(item.score)}%</Badge>
                  </div>

                  {/* Card Body Comparison */}
                  {item.kind === 'transfer' ? (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <TxCard
                        tx={item.match.expenseTx}
                        account={accountMap.get(item.match.expenseTx.accountId)}
                        label="Money out"
                        tone="flow"
                      />
                      <div className="flex items-center justify-center shrink-0 p-1 text-muted">
                        <Icon name="arrow_forward" size={18} className="rotate-90 sm:rotate-0" />
                      </div>
                      <TxCard
                        tx={item.match.incomeTx}
                        account={accountMap.get(item.match.incomeTx.accountId)}
                        label="Money in"
                        tone="flow"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <TxCard
                        tx={item.match.transaction}
                        account={accountMap.get(item.match.transaction.accountId)}
                        label="Synced bank transaction"
                      />
                      <div className="flex items-center justify-center shrink-0 p-1 text-muted">
                        <Icon name="arrow_forward" size={18} className="rotate-90 sm:rotate-0" />
                      </div>
                      <div className="flex-1 min-w-0 rounded-[var(--radius-lg)] bg-inset p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="type-caption text-muted truncate">
                            Planned {item.match.itemType === 'bill' ? 'bill' : 'recurring item'}
                          </span>
                          <span className="type-caption text-muted">Target date</span>
                        </div>
                        <p className="type-body-strong truncate text-ink mt-0.5">{item.match.matchedName}</p>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span className="type-caption text-muted">{day(item.match.matchedDate)}</span>
                          <span className="type-figure-row shrink-0 text-ink">
                            <Amount
                              value={item.match.matchedAmount}
                              currency={item.match.matchedCurrency ?? item.match.transaction.currency}
                            />
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Card Actions */}
                  <div className="flex items-center justify-end gap-2 pt-3 mt-3 border-t border-line">
                    {item.kind === 'transfer' ? (
                      <>
                        <Button size="sm" variant="ghost" onPress={() => review.dismissTransfer(item.match)}>
                          Not a transfer
                        </Button>
                        <Button size="sm" variant="primary" onPress={() => review.confirmTransfer(item.match)}>
                          Match as transfer
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" onPress={() => review.dismissBill(item.match)}>
                          Not this bill
                        </Button>
                        <Button size="sm" variant="primary" onPress={() => review.confirmBill(item.match)}>
                          Match as paid
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Selection Bar for multi-select */}
        {selected.size > 0 && (
          <SelectionBar count={selected.size} onClear={() => setSelected(new Set())}>
            <Button size="sm" variant="ghost" onPress={handleConfirmSelected}>
              Approve {selected.size} selected
            </Button>
            <Button size="sm" variant="ghost" onPress={handleDismissSelected}>
              Dismiss selected
            </Button>
          </SelectionBar>
        )}
      </div>
    </Dialog>
  );
};

export default PendingMatchesModal;
