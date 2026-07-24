import React, { useEffect, useState, useMemo } from 'react';
import Modal from './Modal';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { SyncedBillMatchSuggestion } from '../hooks/useSyncedBillMatcher';
import { Account } from '../types';
import { formatCurrency, parseLocalDate } from '../utils';
import ConfidenceScoreBar from './ConfidenceScoreBar';

interface SyncedBillMatcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: SyncedBillMatchSuggestion[];
  accounts: Account[];
  onConfirmMatch: (suggestion: SyncedBillMatchSuggestion) => void;
  onDismissSuggestion: (suggestion: SyncedBillMatchSuggestion) => void;
  onConfirmAll: () => void;
  onDismissAll: () => void;
  onConfirmSelected?: (selectedList: SyncedBillMatchSuggestion[]) => void;
  onDismissSelected?: (selectedList: SyncedBillMatchSuggestion[]) => void;
}

const SuggestionItemRow: React.FC<{
  suggestion: SyncedBillMatchSuggestion;
  accounts: Account[];
  isSelected: boolean;
  onToggleSelect: () => void;
  onConfirm: () => void;
  onDismiss: () => void;
}> = ({ suggestion, accounts, isSelected, onToggleSelect, onConfirm, onDismiss }) => {
  const account = accounts.find(a => a.id === suggestion.transaction.accountId);

  const formatDate = (dateString: string) => {
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isExpense = suggestion.transaction.type === 'expense';

  return (
    <div className={`p-4 rounded-2xl bg-light-bg dark:bg-dark-bg border transition-all ${
      isSelected ? 'border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-500/10' : 'border-black/5 dark:border-white/5'
    } space-y-3 relative overflow-hidden`}>
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={onToggleSelect}
          className="pt-1 text-light-text-secondary hover:text-emerald-600 transition-colors"
          title="Select for batch approval"
        >
          <span className="material-symbols-outlined text-xl">
            {isSelected ? 'check_box' : 'check_box_outline_blank'}
          </span>
        </button>

        <div className="flex-1 space-y-3">
          {/* Progress bar confidence score */}
          <ConfidenceScoreBar
            score={suggestion.matchScore}
            varianceText={
              suggestion.daysDiff === 0
                ? 'Exact date match'
                : `±${suggestion.daysDiff}d date variance`
            }
          />

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3">
            {/* Synced Bank Transaction */}
            <div className="space-y-1 bg-white/70 dark:bg-white/5 p-3 rounded-xl border border-black/5 dark:border-white/5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  Synced Bank Transaction
                </span>
                <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary truncate">
                  {account?.name || 'Bank Account'}
                </span>
              </div>
              <p className="font-bold text-sm text-light-text dark:text-dark-text break-words line-clamp-2">
                {suggestion.transaction.merchant || suggestion.transaction.description}
              </p>
              <div className="flex items-center justify-between text-xs font-semibold pt-1">
                <span className="text-light-text-secondary dark:text-dark-text-secondary">
                  {formatDate(suggestion.transaction.date)}
                </span>
                <span className={`font-black tabular-nums ${isExpense ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {formatCurrency(suggestion.transaction.amount, suggestion.transaction.currency)}
                </span>
              </div>
            </div>

            {/* Vs Arrow */}
            <div className="flex justify-center items-center py-1">
              <span className="material-symbols-outlined text-light-text-secondary dark:text-dark-text-secondary text-lg">
                swap_horiz
              </span>
            </div>

            {/* Planned Scheduled Item */}
            <div className="space-y-1 bg-white/70 dark:bg-white/5 p-3 rounded-xl border border-black/5 dark:border-white/5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md">
                  {suggestion.itemType === 'recurring' ? 'Planned Recurring' : 'Planned One-Time Bill'}
                </span>
                <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary">
                  Due Date
                </span>
              </div>
              <p className="font-bold text-sm text-light-text dark:text-dark-text break-words line-clamp-2">
                {suggestion.matchedName}
              </p>
              <div className="flex items-center justify-between text-xs font-semibold pt-1">
                <span className="text-light-text-secondary dark:text-dark-text-secondary">
                  {formatDate(suggestion.matchedDate)}
                </span>
                <span className="font-black tabular-nums text-light-text dark:text-dark-text">
                  {formatCurrency(suggestion.matchedAmount, suggestion.transaction.currency)}
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
                onClick={onDismiss}
                className={`${BTN_SECONDARY_STYLE} !py-1.5 !px-3 !text-xs`}
              >
                Ignore
              </button>
              <button
                onClick={onConfirm}
                className={`${BTN_PRIMARY_STYLE} !py-1.5 !px-3 !text-xs bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20`}
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
};

const SyncedBillMatcherModal: React.FC<SyncedBillMatcherModalProps> = ({
  isOpen,
  onClose,
  suggestions,
  accounts,
  onConfirmMatch,
  onDismissSuggestion,
  onConfirmAll,
  onDismissAll,
  onConfirmSelected,
  onDismissSelected,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const SUGGESTIONS_PER_PAGE = 5;

  const paginatedSuggestions = suggestions.slice(
    (currentPage - 1) * SUGGESTIONS_PER_PAGE,
    currentPage * SUGGESTIONS_PER_PAGE
  );
  const totalPages = Math.ceil(suggestions.length / SUGGESTIONS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set(suggestions.map(s => s.id)));
  }, [isOpen, suggestions.length]);

  useEffect(() => {
    setCurrentPage(page => Math.min(Math.max(1, page), Math.max(1, totalPages)));
  }, [totalPages]);

  const isAllSelected = suggestions.length > 0 && selectedIds.size === suggestions.length;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(suggestions.map(s => s.id)));
    }
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
    const selectedList = suggestions.filter(s => selectedIds.has(s.id));
    if (selectedList.length === 0) return;

    if (onConfirmSelected) {
      onConfirmSelected(selectedList);
    } else {
      selectedList.forEach(s => onConfirmMatch(s));
    }
  };

  const handleDismissSelected = () => {
    const selectedList = suggestions.filter(s => selectedIds.has(s.id));
    if (selectedList.length === 0) return;

    if (onDismissSelected) {
      onDismissSelected(selectedList);
    } else {
      selectedList.forEach(s => onDismissSuggestion(s));
    }
  };

  if (!isOpen) return null;

  return (
    <Modal onClose={onClose} title="Review Synced Bill & Recurring Matches" size="4xl">
      <div className="space-y-4">
        {/* Bulk Action Controls */}
        <div className="p-4 bg-light-bg dark:bg-dark-bg rounded-2xl border border-black/5 dark:border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleSelectAll}
              className="flex items-center gap-1.5 text-xs font-bold text-light-text dark:text-dark-text"
            >
              <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">
                {isAllSelected ? 'check_box' : selectedIds.size > 0 ? 'indeterminate_check_box' : 'check_box_outline_blank'}
              </span>
              <span>
                {selectedIds.size === 0
                  ? 'Select All'
                  : `Selected ${selectedIds.size} of ${suggestions.length}`}
              </span>
            </button>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={handleDismissSelected}
              disabled={selectedIds.size === 0}
              className={`${BTN_SECONDARY_STYLE} flex-1 sm:flex-initial !py-2 !px-3 text-xs disabled:opacity-40`}
            >
              Dismiss Selected ({selectedIds.size})
            </button>
            <button
              onClick={handleApproveSelected}
              disabled={selectedIds.size === 0}
              className={`${BTN_PRIMARY_STYLE} flex-1 sm:flex-initial !py-2 !px-3 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40`}
            >
              <span className="material-symbols-outlined text-sm">done_all</span>
              Approve Selected ({selectedIds.size})
            </button>
          </div>
        </div>

        {suggestions.length > 0 ? (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {paginatedSuggestions.map(s => (
              <SuggestionItemRow
                key={s.id}
                suggestion={s}
                accounts={accounts}
                isSelected={selectedIds.has(s.id)}
                onToggleSelect={() => handleToggleSelectOne(s.id)}
                onConfirm={() => onConfirmMatch(s)}
                onDismiss={() => onDismissSuggestion(s)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 space-y-2">
            <span className="material-symbols-outlined text-4xl text-light-text-secondary">check_circle</span>
            <p className="text-sm font-semibold text-light-text dark:text-dark-text">No pending bill match suggestions to review.</p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`${BTN_SECONDARY_STYLE} disabled:opacity-50 !py-1.5 !px-3 text-xs`}
            >
              Previous
            </button>
            <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`${BTN_SECONDARY_STYLE} disabled:opacity-50 !py-1.5 !px-3 text-xs`}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default SyncedBillMatcherModal;
