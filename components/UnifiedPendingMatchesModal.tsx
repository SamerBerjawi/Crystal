import React, { useMemo, useState } from 'react';
import Modal from './Modal';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { Suggestion as TransferSuggestion } from '../hooks/useTransactionMatcher';
import { SyncedBillMatchSuggestion } from '../hooks/useSyncedBillMatcher';
import { Account } from '../types';
import { formatCurrency, parseLocalDate } from '../utils';
import ConfidenceScoreBar from './ConfidenceScoreBar';
import Icon from './ui/Icon';

interface UnifiedPendingMatchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  transferSuggestions: TransferSuggestion[];
  billSuggestions: SyncedBillMatchSuggestion[];
  accounts: Account[];
  onConfirmTransferMatch: (suggestion: TransferSuggestion) => void;
  onDismissTransferMatch: (suggestion: TransferSuggestion) => void;
  onConfirmSelectedTransferMatches?: (selectedList: TransferSuggestion[]) => void;
  onDismissSelectedTransferMatches?: (selectedList: TransferSuggestion[]) => void;
  onConfirmBillMatch: (suggestion: SyncedBillMatchSuggestion) => void;
  onDismissBillMatch: (suggestion: SyncedBillMatchSuggestion) => void;
  onConfirmSelectedBillMatches?: (selectedList: SyncedBillMatchSuggestion[]) => void;
  onDismissSelectedBillMatches?: (selectedList: SyncedBillMatchSuggestion[]) => void;
  onConfirmAll?: () => void;
  onDismissAll?: () => void;
  initialFilter?: 'all' | 'transfer' | 'bill';
  onOpenFullPageTab?: () => void;
}

type UnifiedItem =
  | {
      id: string;
      type: 'transfer';
      score: number;
      date: string;
      raw: TransferSuggestion;
    }
  | {
      id: string;
      type: 'bill';
      score: number;
      date: string;
      raw: SyncedBillMatchSuggestion;
    };

export const UnifiedPendingMatchesModal: React.FC<UnifiedPendingMatchesModalProps> = ({
  isOpen,
  onClose,
  transferSuggestions,
  billSuggestions,
  accounts,
  onConfirmTransferMatch,
  onDismissTransferMatch,
  onConfirmSelectedTransferMatches,
  onDismissSelectedTransferMatches,
  onConfirmBillMatch,
  onDismissBillMatch,
  onConfirmSelectedBillMatches,
  onDismissSelectedBillMatches,
  onConfirmAll,
  onDismissAll,
  initialFilter = 'all',
  onOpenFullPageTab,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'transfer' | 'bill'>(initialFilter);
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | 'high' | 'review'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Account lookup helper
  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);

  // Combine into unified items sorted by confidence score desc
  const allItems = useMemo<UnifiedItem[]>(() => {
    const items: UnifiedItem[] = [];

    transferSuggestions.forEach(s => {
      items.push({
        id: `transfer-${s.id}`,
        type: 'transfer',
        score: s.matchScore,
        date: s.expenseTx.date,
        raw: s,
      });
    });

    billSuggestions.forEach(s => {
      items.push({
        id: `bill-${s.id}`,
        type: 'bill',
        score: s.matchScore,
        date: s.transaction.date,
        raw: s,
      });
    });

    return items.sort((a, b) => b.score - a.score);
  }, [transferSuggestions, billSuggestions]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      if (filterType === 'transfer' && item.type !== 'transfer') return false;
      if (filterType === 'bill' && item.type !== 'bill') return false;

      if (confidenceFilter === 'high' && item.score < 80) return false;
      if (confidenceFilter === 'review' && item.score >= 80) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (item.type === 'transfer') {
          const t = item.raw as TransferSuggestion;
          const expAcc = accountMap.get(t.expenseTx.accountId)?.name || '';
          const incAcc = accountMap.get(t.incomeTx.accountId)?.name || '';
          const desc = `${t.expenseTx.description} ${t.incomeTx.description} ${expAcc} ${incAcc}`.toLowerCase();
          if (!desc.includes(q)) return false;
        } else {
          const b = item.raw as SyncedBillMatchSuggestion;
          const acc = accountMap.get(b.transaction.accountId)?.name || '';
          const desc = `${b.transaction.merchant} ${b.transaction.description} ${b.matchedName} ${acc}`.toLowerCase();
          if (!desc.includes(q)) return false;
        }
      }

      return true;
    });
  }, [allItems, filterType, confidenceFilter, searchQuery, accountMap]);

  const highConfidenceCount = useMemo(() => {
    return allItems.filter(i => i.score >= 80).length;
  }, [allItems]);

  const isAllFilteredSelected =
    filteredItems.length > 0 && filteredItems.every(i => selectedIds.has(i.id));

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(i => i.id)));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleApproveSelected = () => {
    const selected = filteredItems.filter(i => selectedIds.has(i.id));
    if (selected.length === 0) return;

    const transfers = selected
      .filter(i => i.type === 'transfer')
      .map(i => i.raw as TransferSuggestion);
    const bills = selected
      .filter(i => i.type === 'bill')
      .map(i => i.raw as SyncedBillMatchSuggestion);

    if (transfers.length > 0 && onConfirmSelectedTransferMatches) {
      onConfirmSelectedTransferMatches(transfers);
    }
    if (bills.length > 0 && onConfirmSelectedBillMatches) {
      onConfirmSelectedBillMatches(bills);
    }

    setSelectedIds(new Set());
  };

  const handleDismissSelected = () => {
    const selected = filteredItems.filter(i => selectedIds.has(i.id));
    if (selected.length === 0) return;

    const transfers = selected
      .filter(i => i.type === 'transfer')
      .map(i => i.raw as TransferSuggestion);
    const bills = selected
      .filter(i => i.type === 'bill')
      .map(i => i.raw as SyncedBillMatchSuggestion);

    if (transfers.length > 0 && onDismissSelectedTransferMatches) {
      onDismissSelectedTransferMatches(transfers);
    }
    if (bills.length > 0 && onDismissSelectedBillMatches) {
      onDismissSelectedBillMatches(bills);
    }

    setSelectedIds(new Set());
  };

  const handleApproveAllHighConfidence = () => {
    const highItems = allItems.filter(i => i.score >= 80);
    const transfers = highItems
      .filter(i => i.type === 'transfer')
      .map(i => i.raw as TransferSuggestion);
    const bills = highItems
      .filter(i => i.type === 'bill')
      .map(i => i.raw as SyncedBillMatchSuggestion);

    if (transfers.length > 0 && onConfirmSelectedTransferMatches) {
      onConfirmSelectedTransferMatches(transfers);
    }
    if (bills.length > 0 && onConfirmSelectedBillMatches) {
      onConfirmSelectedBillMatches(bills);
    }
  };

  const formatDate = (dateString: string) => {
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reconcile Pending Matches" maxWidth="max-w-4xl">
      <div className="space-y-4 max-h-[75vh] flex flex-col">
        {/* Header summary & switch to full tab */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-black/5 dark:border-white/10 shrink-0">
          <div>
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
              Review and confirm matched bank transactions. Reconciled transfers keep net worth precise, while matched bills update your schedule.
            </p>
          </div>

          {onOpenFullPageTab && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFullPageTab();
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline shrink-0 cursor-pointer"
            >
              <span>Open in Full Tab</span>
              <Icon name="open_in_new" className="text-sm" />
            </button>
          )}
        </div>

        {/* Filter controls toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-black/5 dark:bg-white/5 p-2 rounded-2xl shrink-0">
          {/* Type segmented control */}
          <div className="flex items-center gap-1 bg-white/70 dark:bg-dark-card/70 p-1 rounded-xl shadow-xs">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-primary-500 text-white shadow-xs'
                  : 'text-light-text-secondary hover:text-light-text dark:hover:text-dark-text'
              }`}
            >
              All ({allItems.length})
            </button>

            <button
              type="button"
              onClick={() => setFilterType('transfer')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterType === 'transfer'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-light-text-secondary hover:text-light-text dark:hover:text-dark-text'
              }`}
            >
              Transfers ({transferSuggestions.length})
            </button>

            <button
              type="button"
              onClick={() => setFilterType('bill')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterType === 'bill'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-light-text-secondary hover:text-light-text dark:hover:text-dark-text'
              }`}
            >
              Bills ({billSuggestions.length})
            </button>
          </div>

          {/* Search bar */}
          <div className="relative flex-1 max-w-xs">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search matches..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white/70 dark:bg-dark-card/70 rounded-xl border border-black/5 dark:border-white/5 focus:outline-none focus:ring-1 focus:ring-primary-500 text-light-text dark:text-dark-text"
            />
          </div>

          {/* Confidence toggle */}
          <div className="flex items-center gap-1 text-2xs font-semibold">
            <button
              type="button"
              onClick={() => setConfidenceFilter('all')}
              className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                confidenceFilter === 'all' ? 'bg-black/10 dark:bg-white/10 font-bold' : 'text-gray-400'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setConfidenceFilter('high')}
              className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                confidenceFilter === 'high' ? 'bg-emerald-500/20 text-emerald-600 font-bold' : 'text-gray-400'
              }`}
            >
              High (≥80%)
            </button>
          </div>
        </div>

        {/* Batch actions bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs shrink-0">
          <label className="flex items-center gap-2 cursor-pointer font-semibold select-none text-light-text-secondary">
            <input
              type="checkbox"
              checked={isAllFilteredSelected}
              onChange={handleToggleSelectAll}
              className="rounded text-primary-500 focus:ring-0 cursor-pointer"
            />
            <span>Select All Filtered ({filteredItems.length})</span>
          </label>

          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleDismissSelected}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  Dismiss Selected ({selectedIds.size})
                </button>
                <button
                  type="button"
                  onClick={handleApproveSelected}
                  className="px-3 py-1 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
                >
                  Approve Selected ({selectedIds.size})
                </button>
              </>
            )}

            {highConfidenceCount > 0 && selectedIds.size === 0 && (
              <button
                type="button"
                onClick={handleApproveAllHighConfidence}
                className="px-3 py-1 text-xs font-bold rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors cursor-pointer"
              >
                Approve All High-Confidence ({highConfidenceCount})
              </button>
            )}
          </div>
        </div>

        {/* Scrollable list of match items */}
        <div className="overflow-y-auto space-y-3 pr-1 flex-1 min-h-[220px]">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-light-text-secondary dark:text-dark-text-secondary space-y-2">
              <Icon name="check_circle" className="text-3xl text-emerald-500" />
              <p className="font-bold text-sm">No matches found</p>
              <p className="text-xs opacity-70">
                {searchQuery || confidenceFilter !== 'all' || filterType !== 'all'
                  ? 'Try clearing active filters.'
                  : 'All detected matches have been reviewed.'}
              </p>
            </div>
          ) : (
            filteredItems.map(item => {
              const isSelected = selectedIds.has(item.id);

              if (item.type === 'transfer') {
                const s = item.raw as TransferSuggestion;
                const expenseAccount = accountMap.get(s.expenseTx.accountId);
                const incomeAccount = accountMap.get(s.incomeTx.accountId);

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isSelected
                        ? 'border-indigo-500/50 bg-indigo-500/5 dark:bg-indigo-500/10 shadow-xs'
                        : 'border-black/5 dark:border-white/5 bg-light-fill/60 dark:bg-dark-fill/40'
                    } space-y-3`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectOne(item.id)}
                        className="mt-1 rounded text-indigo-600 focus:ring-0 cursor-pointer"
                      />

                      <div className="flex-1 space-y-2.5 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                            <Icon name="sync_alt" className="text-xs" />
                            Internal Transfer Match
                          </span>

                          <ConfidenceScoreBar
                            score={s.matchScore}
                            varianceText={s.daysDiff === 0 ? 'Same date' : `±${s.daysDiff}d offset`}
                          />
                        </div>

                        {/* Side by side comparison */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                          {/* Expense leg */}
                          <div className="p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/5 flex justify-between items-center">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Icon name="arrow_circle_up" className="text-rose-500 text-xl shrink-0" />
                              <div className="min-w-0">
                                <p className="font-bold text-xs text-light-text dark:text-dark-text truncate">
                                  {expenseAccount?.name || 'Account'}
                                </p>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate">
                                  {s.expenseTx.description}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <p className="font-bold text-xs text-rose-500 tabular-nums">
                                {formatCurrency(s.expenseTx.amount, s.expenseTx.currency)}
                              </p>
                              <p className="text-2xs text-light-text-secondary">
                                {formatDate(s.expenseTx.date)}
                              </p>
                            </div>
                          </div>

                          {/* Income leg */}
                          <div className="p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/5 flex justify-between items-center">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Icon name="arrow_circle_down" className="text-emerald-500 text-xl shrink-0" />
                              <div className="min-w-0">
                                <p className="font-bold text-xs text-light-text dark:text-dark-text truncate">
                                  {incomeAccount?.name || 'Account'}
                                </p>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate">
                                  {s.incomeTx.description}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <p className="font-bold text-xs text-emerald-500 tabular-nums">
                                {formatCurrency(s.incomeTx.amount, s.incomeTx.currency)}
                              </p>
                              <p className="text-2xs text-light-text-secondary">
                                {formatDate(s.incomeTx.date)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-1 border-t border-black/5 dark:border-white/5">
                          <button
                            type="button"
                            onClick={() => onDismissTransferMatch(s)}
                            className={`${BTN_SECONDARY_STYLE} !py-1 !px-3 !text-xs cursor-pointer`}
                          >
                            Ignore
                          </button>
                          <button
                            type="button"
                            onClick={() => onConfirmTransferMatch(s)}
                            className={`${BTN_PRIMARY_STYLE} !py-1 !px-3 !text-xs bg-indigo-600 hover:bg-indigo-700 cursor-pointer`}
                          >
                            Match as Transfer
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // Bill Item
              const s = item.raw as SyncedBillMatchSuggestion;
              const account = accountMap.get(s.transaction.accountId);
              const isExpense = s.transaction.type === 'expense';

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isSelected
                      ? 'border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-500/10 shadow-xs'
                      : 'border-black/5 dark:border-white/5 bg-light-fill/60 dark:bg-dark-fill/40'
                  } space-y-3`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelectOne(item.id)}
                      className="mt-1 rounded text-emerald-600 focus:ring-0 cursor-pointer"
                    />

                    <div className="flex-1 space-y-2.5 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <Icon name="receipt_long" className="text-xs" />
                          {s.itemType === 'recurring' ? 'Recurring Bill Match' : 'One-Time Bill Match'}
                        </span>

                        <ConfidenceScoreBar
                          score={s.matchScore}
                          varianceText={s.daysDiff === 0 ? 'Exact date' : `±${s.daysDiff}d variance`}
                        />
                      </div>

                      {/* Side by side comparison */}
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3 pt-1">
                        {/* Synced Bank Transaction */}
                        <div className="p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/5 space-y-1">
                          <div className="flex items-center justify-between gap-2 text-2xs font-semibold text-light-text-secondary">
                            <span>Synced Bank TX</span>
                            <span className="truncate">{account?.name || 'Account'}</span>
                          </div>
                          <p className="font-bold text-xs text-light-text dark:text-dark-text truncate">
                            {s.transaction.merchant || s.transaction.description}
                          </p>
                          <div className="flex items-center justify-between text-2xs font-bold pt-0.5">
                            <span className="text-light-text-secondary">{formatDate(s.transaction.date)}</span>
                            <span className={isExpense ? 'text-rose-500' : 'text-emerald-500'}>
                              {formatCurrency(s.transaction.amount, s.transaction.currency)}
                            </span>
                          </div>
                        </div>

                        {/* Arrow */}
                        <div className="flex justify-center items-center py-0.5">
                          <Icon name="sync_alt" className="text-gray-400 text-base" />
                        </div>

                        {/* Planned Bill Item */}
                        <div className="p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/5 space-y-1">
                          <div className="flex items-center justify-between gap-2 text-2xs font-semibold text-light-text-secondary">
                            <span>Planned Item</span>
                            <span>Target Date</span>
                          </div>
                          <p className="font-bold text-xs text-light-text dark:text-dark-text truncate">
                            {s.matchedName}
                          </p>
                          <div className="flex items-center justify-between text-2xs font-bold pt-0.5">
                            <span className="text-light-text-secondary">{formatDate(s.matchedDate)}</span>
                            <span className="text-indigo-600 dark:text-indigo-400">
                              {formatCurrency(s.matchedAmount, s.transaction.currency)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1 border-t border-black/5 dark:border-white/5">
                        <button
                          type="button"
                          onClick={() => onDismissBillMatch(s)}
                          className={`${BTN_SECONDARY_STYLE} !py-1 !px-3 !text-xs cursor-pointer`}
                        >
                          Ignore
                        </button>
                        <button
                          type="button"
                          onClick={() => onConfirmBillMatch(s)}
                          className={`${BTN_PRIMARY_STYLE} !py-1 !px-3 !text-xs bg-emerald-600 hover:bg-emerald-700 cursor-pointer`}
                        >
                          Match as Paid
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal footer */}
        <div className="flex justify-between items-center pt-3 border-t border-black/5 dark:border-white/10 shrink-0">
          {onDismissAll && allItems.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                onDismissAll();
                onClose();
              }}
              className="text-xs font-semibold text-rose-500 hover:underline cursor-pointer"
            >
              Dismiss All ({allItems.length})
            </button>
          ) : <div />}

          <button
            type="button"
            onClick={onClose}
            className={`${BTN_SECONDARY_STYLE} !py-1.5 !px-4 text-xs cursor-pointer`}
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default UnifiedPendingMatchesModal;
