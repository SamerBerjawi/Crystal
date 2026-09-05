import React from 'react';
import { Account } from '../types';
import { INPUT_BASE_STYLE, CHECKBOX_STYLE } from '../constants';

export interface TransactionDateAndAccountFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (val: string) => void;
  onEndDateChange: (val: string) => void;
  accounts: Account[];
  selectedAccountIds: string[];
  onToggleAccount: (id: string) => void;
  onSelectAllAccounts: () => void;
  className?: string;
}

/**
 * Self-contained, theme-aware filter card for date ranges and account scopes.
 * Guarantees high-contrast typography in both light and dark modes per DESIGN.md.
 */
export const TransactionDateAndAccountFilter: React.FC<TransactionDateAndAccountFilterProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  accounts,
  selectedAccountIds,
  onToggleAccount,
  onSelectAllAccounts,
  className = '',
}) => {
  return (
    <div className={`p-5 rounded-3xl bg-light-fill dark:bg-white/[0.04] border border-black/5 dark:border-white/10 space-y-4 ${className}`}>
      <span className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary block">
        Transaction Date & Account Filter
      </span>
      
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label 
            htmlFor="filter-start-date" 
            className="block text-2xs font-bold uppercase tracking-wider mb-1 text-light-text-secondary dark:text-dark-text-secondary"
          >
            Start Date
          </label>
          <input 
            id="filter-start-date"
            type="date" 
            value={startDate} 
            onChange={e => onStartDateChange(e.target.value)} 
            className={`${INPUT_BASE_STYLE} h-11 text-xs font-medium`} 
          />
        </div>
        <div>
          <label 
            htmlFor="filter-end-date" 
            className="block text-2xs font-bold uppercase tracking-wider mb-1 text-light-text-secondary dark:text-dark-text-secondary"
          >
            End Date
          </label>
          <input 
            id="filter-end-date"
            type="date" 
            value={endDate} 
            onChange={e => onEndDateChange(e.target.value)} 
            className={`${INPUT_BASE_STYLE} h-11 text-xs font-medium`} 
          />
        </div>
      </div>

      <div>
        <label className="block text-2xs font-bold uppercase tracking-wider mb-2 text-light-text-secondary dark:text-dark-text-secondary">
          Scope to Specific Accounts
        </label>
        <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar pr-1">
          <label className="flex items-center gap-2.5 text-xs font-bold cursor-pointer p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors text-light-text dark:text-dark-text">
            <input 
              type="checkbox" 
              checked={selectedAccountIds.length === 0} 
              onChange={onSelectAllAccounts} 
              className={CHECKBOX_STYLE} 
            />
            <span className="text-light-text dark:text-dark-text font-bold">All Accounts</span>
          </label>
          {accounts.map(acc => (
            <label 
              key={acc.id} 
              className="flex items-center gap-2.5 text-xs font-medium cursor-pointer p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors text-light-text dark:text-dark-text"
            >
              <input 
                type="checkbox" 
                checked={selectedAccountIds.includes(acc.id)} 
                onChange={() => onToggleAccount(acc.id)} 
                className={CHECKBOX_STYLE} 
              />
              <span className="truncate text-light-text dark:text-dark-text font-medium">{acc.name}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TransactionDateAndAccountFilter;
