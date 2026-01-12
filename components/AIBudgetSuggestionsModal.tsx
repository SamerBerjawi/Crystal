
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { BudgetSuggestion, Budget } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, CHECKBOX_STYLE } from '../constants';
import { formatCurrency } from '../utils';

interface AIBudgetSuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: BudgetSuggestion[];
  onApply: (selected: BudgetSuggestion[]) => void;
  isLoading: boolean;
  error: string | null;
  existingBudgets: Budget[];
}

const AIBudgetSuggestionsModal: React.FC<AIBudgetSuggestionsModalProps> = ({ isOpen, onClose, suggestions, onApply, isLoading, error, existingBudgets }) => {
  const [customSuggestions, setCustomSuggestions] = useState<Record<string, { suggestedBudget: number; selected: boolean }>>({});

  useEffect(() => {
    if (suggestions.length > 0) {
      const initialCustomState = suggestions.reduce((acc, s) => {
        const existing = existingBudgets.find(b => b.categoryName === s.categoryName);
        acc[s.categoryName] = {
          suggestedBudget: existing ? existing.amount : s.suggestedBudget, // Prefer existing budget amount if it exists
          selected: !existing, // Pre-select only new budget suggestions
        };
        return acc;
      }, {} as Record<string, { suggestedBudget: number; selected: boolean }>);
      setCustomSuggestions(initialCustomState);
    }
  }, [suggestions, existingBudgets]);

  const handleBudgetChange = (categoryName: string, value: string) => {
    const amount = parseFloat(value) || 0;
    setCustomSuggestions(prev => ({
      ...prev,
      [categoryName]: { ...prev[categoryName], suggestedBudget: amount },
    }));
  };

  const handleSelectionChange = (categoryName: string) => {
    setCustomSuggestions(prev => ({
      ...prev,
      [categoryName]: { ...prev[categoryName], selected: !prev[categoryName].selected },
    }));
  };

  const handleSelectAll = (select: boolean) => {
      setCustomSuggestions(prev => {
          const newState = {...prev};
          for(const key in newState) {
              newState[key].selected = select;
          }
          return newState;
      })
  };

  const handleApply = () => {
    const selected = Object.entries(customSuggestions)
      // FIX: Explicitly cast `value` to resolve 'unknown' type error.
      .filter(([, value]) => (value as { selected: boolean }).selected)
      .map(([categoryName, value]) => {
          const original = suggestions.find(s => s.categoryName === categoryName);
          const typedValue = value as { suggestedBudget: number; selected: boolean };
          return {
            categoryName,
            averageSpending: original?.averageSpending || 0,
            suggestedBudget: typedValue.suggestedBudget
          };
      });
    onApply(selected);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-64">
          <svg className="animate-spin h-10 w-10 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-4 text-light-text-secondary dark:text-dark-text-secondary">Analyzing your spending...</p>
        </div>
      );
    }
    if (error) {
      return <p className="text-center text-red-500 py-8">{error}</p>;
    }
    if (suggestions.length === 0) {
      return <p className="text-center text-light-text-secondary dark:text-dark-text-secondary py-8">No suggestions available.</p>;
    }

    return (
        <>
            <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Based on your spending over the last 3 months.</p>
                <div className="flex gap-4">
                    <button onClick={() => handleSelectAll(true)} className="text-sm font-semibold text-primary-500 hover:underline">Select All</button>
                    <button onClick={() => handleSelectAll(false)} className="text-sm font-semibold text-primary-500 hover:underline">Deselect All</button>
                </div>
            </div>
            <div className="max-h-80 overflow-y-auto -mx-2 px-2 space-y-2">
                {suggestions.map(suggestion => (
                <div key={suggestion.categoryName} className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-4 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
                    <input
                        type="checkbox"
                        // FIX: Explicitly cast the object to resolve 'unknown' type error.
                        checked={(customSuggestions[suggestion.categoryName] as { selected: boolean })?.selected || false}
                        onChange={() => handleSelectionChange(suggestion.categoryName)}
                        className={CHECKBOX_STYLE}
                    />
                    <label className="font-medium">{suggestion.categoryName}</label>
                    <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary text-right">
                        Avg: {formatCurrency(suggestion.averageSpending, 'EUR')}
                    </div>
                    <div>
                        <input
                            type="number"
                            step="1"
                            value={Math.round(customSuggestions[suggestion.categoryName]?.suggestedBudget || 0)}
                            onChange={(e) => handleBudgetChange(suggestion.categoryName, e.target.value)}
                            className={`${INPUT_BASE_STYLE} !h-9 text-right`}
                        />
                    </div>
                </div>
                ))}
            </div>
        </>
    );
  };
  
  const numSelected = Object.values(customSuggestions).filter(s => (s as { selected: boolean }).selected).length;

  return (
    <Modal onClose={onClose} title="AI Budget Suggestions">
        {renderContent()}
        {!isLoading && (
             <div className="flex justify-end gap-4 pt-4 mt-4 border-t border-black/10 dark:border-white/10">
                <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                {/* FIX: Coerce `error` to a boolean to prevent passing a string to the `disabled` prop, which expects a boolean. */}
                <button type="button" onClick={handleApply} className={BTN_PRIMARY_STYLE} disabled={!!error || numSelected === 0}>
                    Apply {numSelected > 0 ? `${numSelected} Selected` : ''}
                </button>
            </div>
        )}
    </Modal>
  );
};

export default AIBudgetSuggestionsModal;
