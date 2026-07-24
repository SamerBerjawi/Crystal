import React, { useState, useMemo } from 'react';
import { SyncedBillMatchSuggestion } from '../hooks/useSyncedBillMatcher';
import { Suggestion as TransferSuggestion } from '../hooks/useTransactionMatcher';
import { Account } from '../types';
import { formatCurrency, parseLocalDate } from '../utils';
import ConfidenceScoreBar from './ConfidenceScoreBar';
import MatcherConfigPanel from './MatcherConfigPanel';
import { MatcherConfig } from '../hooks/useMatcherConfig';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';

interface PendingMatchesViewProps {
  billSuggestions: SyncedBillMatchSuggestion[];
  transferSuggestions: TransferSuggestion[];
  accounts: Account[];
  config: MatcherConfig;
  onUpdateConfig: (updates: Partial<MatcherConfig>) => void;
  onResetConfig: () => void;
  onConfirmBillMatch: (suggestion: SyncedBillMatchSuggestion) => void;
  onDismissBillMatch: (suggestion: SyncedBillMatchSuggestion) => void;
  onConfirmSelectedBillMatches: (selectedList: SyncedBillMatchSuggestion[]) => void;
  onDismissSelectedBillMatches: (selectedList: SyncedBillMatchSuggestion[]) => void;
  onConfirmTransferMatch: (suggestion: TransferSuggestion) => void;
  onDismissTransferMatch: (suggestion: TransferSuggestion) => void;
  onConfirmSelectedTransferMatches: (selectedList: TransferSuggestion[]) => void;
  onDismissSelectedTransferMatches: (selectedList: TransferSuggestion[]) => void;
}

type UnifiedMatchItem =
  | {
      id: string;
      type: 'bill';
      score: number;
      date: string;
      rawItem: SyncedBillMatchSuggestion;
    }
  | {
      id: string;
      type: 'transfer';
      score: number;
      date: string;
      rawItem: TransferSuggestion;
    };

export const PendingMatchesView: React.FC<PendingMatchesViewProps> = ({
  billSuggestions,
  transferSuggestions,
  accounts,
  config,
  onUpdateConfig,
  onResetConfig,
  onConfirmBillMatch,
  onDismissBillMatch,
  onConfirmSelectedBillMatches,
  onDismissSelectedBillMatches,
  onConfirmTransferMatch,
  onDismissTransferMatch,
  onConfirmSelectedTransferMatches,
  onDismissSelectedTransferMatches,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'bill' | 'transfer'>('all');
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | 'high' | 'review'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Combine all match items into a single list
  const allMatchItems = useMemo<UnifiedMatchItem[]>(() => {
    const items: UnifiedMatchItem[] = [];

    billSuggestions.forEach(s => {
      items.push({
        id: `bill-${s.id}`,
        type: 'bill',
        score: s.matchScore,
        date: s.transaction.date,
        rawItem: s,
      });
    });

    transferSuggestions.forEach(s => {
      items.push({
        id: `transfer-${s.id}`,
        type: 'transfer',
        score: s.matchScore || 85,
        date: s.expenseTx.date,
        rawItem: s,
      });
    });

    return items.sort((a, b) => b.score - a.score);
  }, [billSuggestions, transferSuggestions]);

  // Filter items
  const filteredItems = useMemo(() => {
    return allMatchItems.filter(item => {
      // Type filter
      if (filterType === 'bill' && item.type !== 'bill') return false;
      if (filterType === 'transfer' && item.type !== 'transfer') return false;

      // Confidence filter
      if (confidenceFilter === 'high' && item.score < 80) return false;
      if (confidenceFilter === 'review' && item.score >= 80) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (item.type === 'bill') {
          const raw = item.rawItem as SyncedBillMatchSuggestion;
          const matchName = (raw.transaction.merchant || raw.transaction.description || '').toLowerCase();
          const plannedName = (raw.matchedName || '').toLowerCase();
          const amountStr = String(raw.transaction.amount);
          if (!matchName.includes(q) && !plannedName.includes(q) && !amountStr.includes(q)) {
            return false;
          }
        } else {
          const raw = item.rawItem as TransferSuggestion;
          const expDesc = (raw.expenseTx.description || '').toLowerCase();
          const incDesc = (raw.incomeTx.description || '').toLowerCase();
          if (!expDesc.includes(q) && !incDesc.includes(q)) {
            return false;
          }
        }
      }

      return true;
    });
  }, [allMatchItems, filterType, confidenceFilter, searchQuery]);

  // High confidence items count
  const highConfidenceCount = useMemo(() => {
    return allMatchItems.filter(i => i.score >= 80).length;
  }, [allMatchItems]);

  const isAllFilteredSelected =
    filteredItems.length > 0 && filteredItems.every(i => selectedIds.has(i.id));

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(i => i.id)));
    }
  };

  const handleSelectHighConfidence = () => {
    const highIds = filteredItems.filter(i => i.score >= 80).map(i => i.id);
    setSelectedIds(new Set(highIds));
  };

  const handleToggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleApproveSelected = () => {
    const selectedItems = filteredItems.filter(i => selectedIds.has(i.id));
    if (selectedItems.length === 0) return;

    const billsToApprove = selectedItems
      .filter(i => i.type === 'bill')
      .map(i => i.rawItem as SyncedBillMatchSuggestion);

    const transfersToApprove = selectedItems
      .filter(i => i.type === 'transfer')
      .map(i => i.rawItem as TransferSuggestion);

    if (billsToApprove.length > 0) {
      onConfirmSelectedBillMatches(billsToApprove);
    }
    if (transfersToApprove.length > 0) {
      onConfirmSelectedTransferMatches(transfersToApprove);
    }

    setSelectedIds(new Set());
  };

  const handleDismissSelected = () => {
    const selectedItems = filteredItems.filter(i => selectedIds.has(i.id));
    if (selectedItems.length === 0) return;

    const billsToDismiss = selectedItems
      .filter(i => i.type === 'bill')
      .map(i => i.rawItem as SyncedBillMatchSuggestion);

    const transfersToDismiss = selectedItems
      .filter(i => i.type === 'transfer')
      .map(i => i.rawItem as TransferSuggestion);

    if (billsToDismiss.length > 0) {
      onDismissSelectedBillMatches(billsToDismiss);
    }
    if (transfersToDismiss.length > 0) {
      onDismissSelectedTransferMatches(transfersToDismiss);
    }

    setSelectedIds(new Set());
  };

  const formatDate = (dateString: string) => {
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Top Banner & Config Trigger */}
      <div className="bg-gradient-to-br from-emerald-900/20 via-light-card dark:via-dark-card to-emerald-900/10 p-5 sm:p-6 rounded-3xl border border-emerald-500/20 shadow-sm relative overflow-hidden space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-2xl text-emerald-600 dark:text-emerald-400">
                checklist_rtl
              </span>
              <h2 className="text-xl font-black text-light-text dark:text-dark-text tracking-tight">
                Pending Transaction Matches
              </h2>
            </div>
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary max-w-2xl">
              Review automatically matched bank transactions against scheduled bills, recurring subscriptions, and internal account transfers.
            </p>
          </div>

          <button
            onClick={() => setShowConfigPanel(prev => !prev)}
            className={`${BTN_SECONDARY_STYLE} !py-2 !px-3.5 !text-xs flex items-center gap-1.5 shrink-0`}
          >
            <span className="material-symbols-outlined text-base text-emerald-600 dark:text-emerald-400">tune</span>
            <span>Configure Matching Thresholds</span>
            <span className="material-symbols-outlined text-sm opacity-60">
              {showConfigPanel ? 'expand_less' : 'expand_more'}
            </span>
          </button>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 relative z-10">
          <div className="bg-white/80 dark:bg-dark-bg/80 p-3.5 rounded-2xl border border-black/5 dark:border-white/5 space-y-1">
            <span className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
              Total Pending
            </span>
            <p className="text-xl font-black text-light-text dark:text-dark-text">
              {allMatchItems.length} <span className="text-xs font-semibold text-light-text-secondary">Matches</span>
            </p>
          </div>

          <div className="bg-white/80 dark:bg-dark-bg/80 p-3.5 rounded-2xl border border-black/5 dark:border-white/5 space-y-1">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              High Confidence (≥80%)
            </span>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {highConfidenceCount} <span className="text-xs font-semibold text-light-text-secondary">Items</span>
            </p>
          </div>

          <div className="bg-white/80 dark:bg-dark-bg/80 p-3.5 rounded-2xl border border-black/5 dark:border-white/5 space-y-1">
            <span className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
              Amount Tolerance
            </span>
            <p className="text-lg font-black text-light-text dark:text-dark-text">
              ±{config.amountVariancePercent}%
            </p>
          </div>

          <div className="bg-white/80 dark:bg-dark-bg/80 p-3.5 rounded-2xl border border-black/5 dark:border-white/5 space-y-1">
            <span className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
              Date Flexibility
            </span>
            <p className="text-lg font-black text-light-text dark:text-dark-text">
              ±{config.dateVarianceDays} Days
            </p>
          </div>
        </div>
      </div>

      {/* Slide-down Config Panel */}
      {showConfigPanel && (
        <MatcherConfigPanel
          config={config}
          onChange={onUpdateConfig}
          onReset={onResetConfig}
          isOpen={showConfigPanel}
          onClose={() => setShowConfigPanel(false)}
        />
      )}

      {/* Filter Toolbar & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white/70 dark:bg-dark-card/70 backdrop-blur-md p-3 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm">
        {/* Type Tabs */}
        <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl overflow-x-auto no-scrollbar">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              filterType === 'all'
                ? 'bg-white dark:bg-dark-card text-light-text dark:text-dark-text shadow-sm'
                : 'text-light-text-secondary hover:text-light-text dark:hover:text-dark-text'
            }`}
          >
            All Matches ({allMatchItems.length})
          </button>
          <button
            onClick={() => setFilterType('bill')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              filterType === 'bill'
                ? 'bg-white dark:bg-dark-card text-light-text dark:text-dark-text shadow-sm'
                : 'text-light-text-secondary hover:text-light-text dark:hover:text-dark-text'
            }`}
          >
            Synced Bills ({billSuggestions.length})
          </button>
          <button
            onClick={() => setFilterType('transfer')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              filterType === 'transfer'
                ? 'bg-white dark:bg-dark-card text-light-text dark:text-dark-text shadow-sm'
                : 'text-light-text-secondary hover:text-light-text dark:hover:text-dark-text'
            }`}
          >
            Potential Transfers ({transferSuggestions.length})
          </button>
        </div>

        {/* Confidence Filter & Search */}
        <div className="flex items-center gap-2">
          <select
            value={confidenceFilter}
            onChange={e => setConfidenceFilter(e.target.value as any)}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-dark-bg border border-black/10 dark:border-white/10 text-xs font-bold text-light-text dark:text-dark-text cursor-pointer focus:outline-none"
          >
            <option value="all">All Confidence</option>
            <option value="high">High Match (≥80%)</option>
            <option value="review">Review Needed (&lt;80%)</option>
          </select>

          <div className="relative flex-1 md:w-56">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-light-text-secondary">
              search
            </span>
            <input
              type="text"
              placeholder="Search matches..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-dark-bg border border-black/10 dark:border-white/10 text-xs font-medium text-light-text dark:text-dark-text focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Batch Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleSelectAll}
            className="flex items-center gap-1.5 text-xs font-bold text-light-text dark:text-dark-text"
          >
            <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-lg">
              {isAllFilteredSelected ? 'check_box' : selectedIds.size > 0 ? 'indeterminate_check_box' : 'check_box_outline_blank'}
            </span>
            <span>
              {selectedIds.size === 0
                ? 'Select All Filtered'
                : `Selected ${selectedIds.size} of ${filteredItems.length}`}
            </span>
          </button>

          {highConfidenceCount > 0 && selectedIds.size === 0 && (
            <button
              onClick={handleSelectHighConfidence}
              className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Select High Confidence ({highConfidenceCount})
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={handleDismissSelected}
            disabled={selectedIds.size === 0}
            className={`${BTN_SECONDARY_STYLE} !py-1.5 !px-3 !text-xs disabled:opacity-40`}
          >
            Dismiss Selected ({selectedIds.size})
          </button>

          <button
            onClick={handleApproveSelected}
            disabled={selectedIds.size === 0}
            className={`${BTN_PRIMARY_STYLE} !py-1.5 !px-3.5 !text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40`}
          >
            <span className="material-symbols-outlined text-sm">done_all</span>
            Approve Selected ({selectedIds.size})
          </button>
        </div>
      </div>

      {/* Match Cards List */}
      {filteredItems.length > 0 ? (
        <div className="space-y-4">
          {filteredItems.map(item => {
            const isSelected = selectedIds.has(item.id);

            if (item.type === 'bill') {
              const raw = item.rawItem as SyncedBillMatchSuggestion;
              const account = accounts.find(a => a.id === raw.transaction.accountId);
              const isExpense = raw.transaction.type === 'expense';

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl bg-white/80 dark:bg-dark-card/80 backdrop-blur-md border transition-all ${
                    isSelected ? 'border-emerald-500/60 bg-emerald-500/5 dark:bg-emerald-500/10' : 'border-black/5 dark:border-white/5'
                  } space-y-3 relative shadow-sm hover:shadow-md`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => handleToggleSelectOne(item.id)}
                      className="pt-1 text-light-text-secondary hover:text-emerald-600 transition-colors"
                    >
                      <span className="material-symbols-outlined text-xl">
                        {isSelected ? 'check_box' : 'check_box_outline_blank'}
                      </span>
                    </button>

                    <div className="flex-1 space-y-3">
                      <ConfidenceScoreBar
                        score={raw.matchScore}
                        varianceText={
                          raw.daysDiff === 0
                            ? 'Exact date match'
                            : `±${raw.daysDiff}d date variance`
                        }
                      />

                      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3">
                        {/* Synced Bank Transaction */}
                        <div className="space-y-1 bg-light-bg/70 dark:bg-dark-bg/70 p-3 rounded-xl border border-black/5 dark:border-white/5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                              Synced Bank Transaction
                            </span>
                            <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary truncate">
                              {account?.name || 'Bank Account'}
                            </span>
                          </div>
                          <p className="font-bold text-sm text-light-text dark:text-dark-text break-words line-clamp-2">
                            {raw.transaction.merchant || raw.transaction.description}
                          </p>
                          <div className="flex items-center justify-between text-xs font-semibold pt-1">
                            <span className="text-light-text-secondary dark:text-dark-text-secondary">
                              {formatDate(raw.transaction.date)}
                            </span>
                            <span className={`font-black tabular-nums ${isExpense ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              {formatCurrency(raw.transaction.amount, raw.transaction.currency)}
                            </span>
                          </div>
                        </div>

                        {/* Vs Arrow */}
                        <div className="flex justify-center items-center py-1">
                          <span className="material-symbols-outlined text-light-text-secondary dark:text-dark-text-secondary text-lg">
                            swap_horiz
                          </span>
                        </div>

                        {/* Planned Item */}
                        <div className="space-y-1 bg-light-bg/70 dark:bg-dark-bg/70 p-3 rounded-xl border border-black/5 dark:border-white/5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md">
                              {raw.itemType === 'recurring' ? 'Planned Recurring' : 'Planned One-Time Bill'}
                            </span>
                            <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary">
                              Due Date
                            </span>
                          </div>
                          <p className="font-bold text-sm text-light-text dark:text-dark-text break-words line-clamp-2">
                            {raw.matchedName}
                          </p>
                          <div className="flex items-center justify-between text-xs font-semibold pt-1">
                            <span className="text-light-text-secondary dark:text-dark-text-secondary">
                              {formatDate(raw.matchedDate)}
                            </span>
                            <span className="font-black tabular-nums text-light-text dark:text-dark-text">
                              {formatCurrency(raw.matchedAmount, raw.transaction.currency)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-black/5 dark:border-white/5">
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary italic">
                          Confirming will mark this item as <strong className="text-emerald-600 dark:text-emerald-400">Posted / Paid</strong> in Schedule & Bills.
                        </p>
                        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                          <button
                            onClick={() => onDismissBillMatch(raw)}
                            className={`${BTN_SECONDARY_STYLE} !py-1.5 !px-3 !text-xs`}
                          >
                            Ignore
                          </button>
                          <button
                            onClick={() => onConfirmBillMatch(raw)}
                            className={`${BTN_PRIMARY_STYLE} !py-1.5 !px-3.5 !text-xs bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20`}
                          >
                            <span className="material-symbols-outlined text-sm">check_circle</span>
                            <span>Confirm & Post</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            } else {
              // Transfer suggestion
              const raw = item.rawItem as TransferSuggestion;
              const expenseAccount = accounts.find(a => a.id === raw.expenseTx.accountId);
              const incomeAccount = accounts.find(a => a.id === raw.incomeTx.accountId);

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl bg-white/80 dark:bg-dark-card/80 backdrop-blur-md border transition-all ${
                    isSelected ? 'border-emerald-500/60 bg-emerald-500/5 dark:bg-emerald-500/10' : 'border-black/5 dark:border-white/5'
                  } space-y-3 relative shadow-sm hover:shadow-md`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => handleToggleSelectOne(item.id)}
                      className="pt-1 text-light-text-secondary hover:text-emerald-600 transition-colors"
                    >
                      <span className="material-symbols-outlined text-xl">
                        {isSelected ? 'check_box' : 'check_box_outline_blank'}
                      </span>
                    </button>

                    <div className="flex-1 space-y-3">
                      <ConfidenceScoreBar
                        score={raw.matchScore || 85}
                        varianceText={
                          raw.daysDiff === 0
                            ? 'Exact date match'
                            : `±${raw.daysDiff}d date offset`
                        }
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        {/* Expense TX */}
                        <div className="p-3 rounded-xl bg-light-bg/70 dark:bg-dark-bg/70 border border-black/5 dark:border-white/5 flex justify-between items-center">
                          <div className="flex items-center gap-2.5">
                            <span className="material-symbols-outlined text-rose-500 text-xl">arrow_circle_up</span>
                            <div>
                              <p className="font-bold text-xs text-light-text dark:text-dark-text">{expenseAccount?.name || 'Account'}</p>
                              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary line-clamp-1">{raw.expenseTx.description}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-xs text-rose-500 tabular-nums">{formatCurrency(raw.expenseTx.amount, raw.expenseTx.currency)}</p>
                            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{formatDate(raw.expenseTx.date)}</p>
                          </div>
                        </div>

                        {/* Income TX */}
                        <div className="p-3 rounded-xl bg-light-bg/70 dark:bg-dark-bg/70 border border-black/5 dark:border-white/5 flex justify-between items-center">
                          <div className="flex items-center gap-2.5">
                            <span className="material-symbols-outlined text-emerald-500 text-xl">arrow_circle_down</span>
                            <div>
                              <p className="font-bold text-xs text-light-text dark:text-dark-text">{incomeAccount?.name || 'Account'}</p>
                              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary line-clamp-1">{raw.incomeTx.description}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-xs text-emerald-500 tabular-nums">{formatCurrency(raw.incomeTx.amount, raw.incomeTx.currency)}</p>
                            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{formatDate(raw.incomeTx.date)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-black/5 dark:border-white/5">
                        <button
                          onClick={() => onDismissTransferMatch(raw)}
                          className={`${BTN_SECONDARY_STYLE} !py-1.5 !px-3 !text-xs`}
                        >
                          Ignore
                        </button>
                        <button
                          onClick={() => onConfirmTransferMatch(raw)}
                          className={`${BTN_PRIMARY_STYLE} !py-1.5 !px-3.5 !text-xs bg-emerald-600 hover:bg-emerald-700`}
                        >
                          Match as Transfer
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-white/60 dark:bg-dark-card/60 rounded-3xl border border-black/5 dark:border-white/5 space-y-3">
          <span className="material-symbols-outlined text-5xl text-emerald-600 dark:text-emerald-400">
            verified
          </span>
          <div className="space-y-1">
            <h3 className="font-bold text-base text-light-text dark:text-dark-text">No Pending Matches Found</h3>
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary max-w-md mx-auto">
              All synced bank transactions are fully matched and reconciled according to your current threshold settings.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingMatchesView;
