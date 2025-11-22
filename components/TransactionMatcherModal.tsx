import React, { useState } from 'react';
import Modal from './Modal';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { Suggestion } from '../hooks/useTransactionMatcher';
import { Account } from '../types';
import { formatCurrency } from '../utils';

interface TransactionMatcherModalProps {
    isOpen: boolean;
    onClose: () => void;
    suggestions: Suggestion[];
    accounts: Account[];
    onConfirmMatch: (suggestion: Suggestion) => void;
    onDismissSuggestion: (suggestion: Suggestion) => void;
    onConfirmAll: () => void;
    onDismissAll: () => void;
}

const SuggestionItem: React.FC<{
    suggestion: Suggestion;
    accounts: Account[];
    onConfirm: () => void;
    onDismiss: () => void;
}> = ({ suggestion, accounts, onConfirm, onDismiss }) => {
    const expenseAccount = accounts.find(a => a.id === suggestion.expenseTx.accountId);
    const incomeAccount = accounts.find(a => a.id === suggestion.incomeTx.accountId);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString.replace(/-/g, '/'));
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="p-4 rounded-lg bg-light-bg dark:bg-dark-bg space-y-3">
            {/* Expense TX */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-red-500">arrow_circle_up</span>
                    <div>
                        <p className="font-medium">{expenseAccount?.name}</p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{suggestion.expenseTx.description}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="font-semibold text-red-500">{formatCurrency(suggestion.expenseTx.amount, suggestion.expenseTx.currency)}</p>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{formatDate(suggestion.expenseTx.date)}</p>
                </div>
            </div>
            {/* Income TX */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-green-500">arrow_circle_down</span>
                    <div>
                        <p className="font-medium">{incomeAccount?.name}</p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{suggestion.incomeTx.description}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="font-semibold text-green-500">{formatCurrency(suggestion.incomeTx.amount, suggestion.incomeTx.currency)}</p>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{formatDate(suggestion.incomeTx.date)}</p>
                </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
                <button onClick={onDismiss} className={`${BTN_SECONDARY_STYLE} !py-1 !px-3 !text-xs`}>Ignore</button>
                <button onClick={onConfirm} className={`${BTN_PRIMARY_STYLE} !py-1 !px-3 !text-xs`}>Match as Transfer</button>
            </div>
        </div>
    );
};


const TransactionMatcherModal: React.FC<TransactionMatcherModalProps> = ({ isOpen, onClose, suggestions, accounts, onConfirmMatch, onDismissSuggestion, onConfirmAll, onDismissAll }) => {
    
    const [currentPage, setCurrentPage] = useState(1);
    const SUGGESTIONS_PER_PAGE = 5;

    const paginatedSuggestions = suggestions.slice(
        (currentPage - 1) * SUGGESTIONS_PER_PAGE,
        currentPage * SUGGESTIONS_PER_PAGE
    );
    const totalPages = Math.ceil(suggestions.length / SUGGESTIONS_PER_PAGE);

    const handleConfirmAll = () => {
        onConfirmAll();
        onClose();
    };

    const handleDismissAll = () => {
        onDismissAll();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <Modal onClose={onClose} title="Review Potential Transfers">
            <div className="space-y-4">
                <div className="p-4 bg-light-bg dark:bg-dark-bg rounded-lg flex justify-between items-center">
                    <div>
                        <p className="font-semibold">Bulk Actions</p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Applies to all {suggestions.length} suggestions.</p>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={handleDismissAll} className={BTN_SECONDARY_STYLE}>Reject All</button>
                        <button onClick={handleConfirmAll} className={BTN_PRIMARY_STYLE}>Accept All</button>
                    </div>
                </div>
                {suggestions.length > 0 ? (
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 -mr-2">
                        {paginatedSuggestions.map(s => (
                            <SuggestionItem
                                key={s.id}
                                suggestion={s}
                                accounts={accounts}
                                onConfirm={() => onConfirmMatch(s)}
                                onDismiss={() => onDismissSuggestion(s)}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-light-text-secondary dark:text-dark-text-secondary py-8">
                        No more suggestions to review.
                    </p>
                )}

                {totalPages > 1 && (
                    <div className="flex justify-between items-center pt-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className={`${BTN_SECONDARY_STYLE} disabled:opacity-50`}
                        >
                            Previous
                        </button>
                        <span className="text-sm font-medium">Page {currentPage} of {totalPages}</span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className={`${BTN_SECONDARY_STYLE} disabled:opacity-50`}
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        </Modal>
    );
}

export default TransactionMatcherModal;