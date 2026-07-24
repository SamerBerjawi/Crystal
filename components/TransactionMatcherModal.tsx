import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { Suggestion } from '../hooks/useTransactionMatcher';
import { Account } from '../types';
import { formatCurrency, parseLocalDate } from '../utils';
import ConfidenceScoreBar from './ConfidenceScoreBar';

interface TransactionMatcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: Suggestion[];
  accounts: Account[];
  onConfirmMatch: (suggestion: Suggestion) => void;
  onDismissSuggestion: (suggestion: Suggestion) => void;
  onConfirmAll: () => void;
  onDismissAll: () => void;
  onConfirmSelected?: (selectedList: Suggestion[]) => void;
  onDismissSelected?: (selectedList: Suggestion[]) => void;
}

const SuggestionItem: React.FC<{
  suggestion: Suggestion;
  accounts: Account[];
  isSelected: boolean;
  onToggleSelect: () => void;
  onConfirm: () => void;
  onDismiss: () => void;
}> = ({ suggestion, accounts, isSelected, onToggleSelect, onConfirm, onDismiss }) => {
  const expenseAccount = accounts.find(a => a.id === suggestion.expenseTx.accountId);
  const incomeAccount = accounts.find(a => a.id === suggestion.incomeTx.accountId);

  const formatDate = (dateString: string) => {
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className={`p-4 rounded-xl bg-light-bg dark:bg-dark-bg border transition-all ${
      isSelected ? 'border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-500/10' : 'border-black/5 dark:border-white/5'
    } space-y-3`}>
      <div className="flex items-start gap-3">
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
          <ConfidenceScoreBar
            score={suggestion.matchScore || 85}
            varianceText={
              suggestion.daysDiff === 0
                ? 'Same date match'
                : `±${suggestion.daysDiff}d date offset`
            }
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {/* Expense TX */}
            <div className="p-3 rounded-lg bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/5 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-rose-500 text-xl">arrow_circle_up</span>
                <div>
                  <p className="font-bold text-xs text-light-text dark:text-dark-text">{expenseAccount?.name || 'Account'}</p>
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary line-clamp-1">{suggestion.expenseTx.description}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-xs text-rose-500 tabular-nums">{formatCurrency(suggestion.expenseTx.amount, suggestion.expenseTx.currency)}</p>
                <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{formatDate(suggestion.expenseTx.date)}</p>
              </div>
            </div>

            {/* Income TX */}
            <div className="p-3 rounded-lg bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/5 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-emerald-500 text-xl">arrow_circle_down</span>
                <div>
                  <p className="font-bold text-xs text-light-text dark:text-dark-text">{incomeAccount?.name || 'Account'}</p>
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary line-clamp-1">{suggestion.incomeTx.description}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-xs text-emerald-500 tabular-nums">{formatCurrency(suggestion.incomeTx.amount, suggestion.incomeTx.currency)}</p>
                <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{formatDate(suggestion.incomeTx.date)}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1 border-t border-black/5 dark:border-white/5">
            <button onClick={onDismiss} className={`${BTN_SECONDARY_STYLE} !py-1 !px-3 !text-xs`}>
              Ignore
            </button>
            <button onClick={onConfirm} className={`${BTN_PRIMARY_STYLE} !py-1 !px-3 !text-xs bg-emerald-600 hover:bg-emerald-700`}>
              Match as Transfer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const TransactionMatcherModal: React.FC<TransactionMatcherModalProps> = ({
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
    <Modal onClose={onClose} title="Review Potential Transfers" size="3xl">
      <div className="space-y-4">
        <div className="p-4 bg-light-bg dark:bg-dark-bg rounded-2xl border border-black/5 dark:border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
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
              Approve Selected ({selectedIds.size})
            </button>
          </div>
        </div>

        {suggestions.length > 0 ? (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {paginatedSuggestions.map(s => (
              <SuggestionItem
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
          <p className="text-center text-light-text-secondary dark:text-dark-text-secondary py-8">
            No more potential transfer suggestions to review.
          </p>
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

export default TransactionMatcherModal;
