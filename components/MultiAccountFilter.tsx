import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Account } from '../types';
import { LIQUID_ACCOUNT_TYPES, ASSET_TYPES, DEBT_TYPES, CHECKBOX_STYLE, ALL_ACCOUNT_TYPES, BTN_SECONDARY_STYLE } from '../constants';
import Icon from './ui/Icon';

interface MultiAccountFilterProps {
  accounts: Account[];
  selectedAccountIds: string[];
  setSelectedAccountIds: (ids: string[]) => void;
}

const QuickFilterButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button
    onClick={onClick}
    className="w-full text-center text-xs font-semibold tracking-tight py-1.5 px-2 rounded-xl transition-all bg-black/[0.04] dark:bg-white/[0.06] hover:bg-primary-500/15 hover:text-primary-600 dark:hover:text-primary-400 text-light-text dark:text-gray-200 border border-black/5 dark:border-white/5 active:scale-95 whitespace-nowrap"
  >
    {children}
  </button>
);

const MultiAccountFilter: React.FC<MultiAccountFilterProps> = ({ accounts, selectedAccountIds, setSelectedAccountIds }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const INVESTMENT_ACCOUNT_TYPES = ['Investment', 'Crypto'];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);

  const { openAccounts, closedAccounts } = useMemo(() => {
    const open: Account[] = [];
    const closed: Account[] = [];
    accounts.forEach(acc => {
      if (acc.status === 'closed') {
        closed.push(acc);
      } else {
        open.push(acc);
      }
    });
    return { openAccounts: open, closedAccounts: closed };
  }, [accounts]);
  
  const groupedOpenAccounts = useMemo(() => {
    const groups: Record<string, Account[]> = {};
    openAccounts.forEach(acc => {
      if (!groups[acc.type]) groups[acc.type] = [];
      groups[acc.type].push(acc);
    });
    return groups;
  }, [openAccounts]);

  const handleToggle = (accountId: string) => {
    setSelectedAccountIds(
      selectedAccountIds.includes(accountId)
        ? selectedAccountIds.filter(id => id !== accountId)
        : [...selectedAccountIds, accountId]
    );
  };

  // Quick Filter handlers
  const handleSelectAll = () => setSelectedAccountIds(accounts.map(a => a.id));
  const handleSelectLiquid = () => setSelectedAccountIds(accounts.filter(a => LIQUID_ACCOUNT_TYPES.includes(a.type)).map(a => a.id));
  const handleSelectAssets = () => setSelectedAccountIds(accounts.filter(a => ASSET_TYPES.includes(a.type)).map(a => a.id));
  const handleSelectLiabilities = () => setSelectedAccountIds(accounts.filter(a => DEBT_TYPES.includes(a.type)).map(a => a.id));
  const handleSelectInvestments = () => setSelectedAccountIds(accounts.filter(a => INVESTMENT_ACCOUNT_TYPES.includes(a.type)).map(a => a.id));
  const handleClearAll = () => setSelectedAccountIds([]);

  const buttonText = () => {
    if (selectedAccountIds.length === accounts.length) return "All Accounts";
    if (selectedAccountIds.length === 1) {
        const selectedAccount = accounts.find(a => a.id === selectedAccountIds[0]);
        return selectedAccount ? selectedAccount.name : "1 Account";
    }
    if (selectedAccountIds.length === 0) return "No Accounts Selected";
    return `${selectedAccountIds.length} Accounts`;
  };

  const isAllSelected = selectedAccountIds.length === accounts.length;

  const AccountCheckbox: React.FC<{ account: Account }> = ({ account }) => {
    const isChecked = selectedAccountIds.includes(account.id);
    return (
      <button
        type="button"
        key={account.id}
        onClick={() => handleToggle(account.id)}
        className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all active:scale-[0.99] ${
          isChecked
            ? 'bg-primary-500/10 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 font-semibold'
            : 'hover:bg-black/5 dark:hover:bg-white/5 text-light-text dark:text-gray-200'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          <div
            className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all ${
              isChecked
                ? 'bg-primary-500 border-primary-500 text-white'
                : 'border-black/20 dark:border-white/20 bg-transparent'
            }`}
          >
            {isChecked && <Icon name="check" className="text-xs text-white" />}
          </div>
          <span className="text-xs truncate">
            {account.name}
            {account.status === 'closed' && (
              <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary"> (Closed)</span>
            )}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="relative w-auto" ref={wrapperRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="touch-feedback inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/90 dark:bg-dark-card/90 border border-black/10 dark:border-white/10 shadow-xs text-xs font-semibold text-light-text dark:text-white min-h-[38px] transition-all hover:bg-white dark:hover:bg-dark-card active:scale-95"
      >
        <Icon name="account_balance_wallet" className="text-sm text-primary-500" />
        <span className="truncate max-w-[140px]">{buttonText()}</span>
        <Icon name="expand_more" className={`text-sm transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 max-w-[90vw] bg-white/95 dark:bg-[#1e1f23]/95 backdrop-blur-2xl rounded-2xl border border-black/10 dark:border-white/10 shadow-2xl z-[100] overflow-hidden animate-fade-in-up">
          {/* Quick Filters Section */}
          <div className="p-3.5 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5">
            <div className="flex items-center justify-between px-1 pb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary/70 dark:text-dark-text-secondary/70">
                Quick Filters
              </h4>
              <button
                onClick={isAllSelected ? handleClearAll : handleSelectAll}
                className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
              >
                {isAllSelected ? 'Clear All' : 'Select All'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <QuickFilterButton onClick={handleSelectAll}>All Accounts</QuickFilterButton>
              <QuickFilterButton onClick={handleSelectLiquid}>Liquid Only</QuickFilterButton>
              <QuickFilterButton onClick={handleSelectAssets}>All Assets</QuickFilterButton>
              <QuickFilterButton onClick={handleSelectLiabilities}>All Liabilities</QuickFilterButton>
              <QuickFilterButton onClick={handleSelectInvestments}>Investments</QuickFilterButton>
              <QuickFilterButton onClick={handleClearAll}>Clear All</QuickFilterButton>
            </div>
          </div>

          {/* Individual Selection Section */}
          <div className="max-h-72 overflow-y-auto space-y-3 p-3 scroll-touch">
            {/* Grouped Open Accounts */}
            {ALL_ACCOUNT_TYPES.map(type => {
              const groupAccounts = groupedOpenAccounts[type];
              if (!groupAccounts || groupAccounts.length === 0) return null;
              return (
                <div key={type} className="space-y-1">
                  <h4 className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-light-text-secondary/60 dark:text-dark-text-secondary/60 opacity-80">
                    {type}
                  </h4>
                  <div className="space-y-0.5">
                    {groupAccounts.map(account => <AccountCheckbox key={account.id} account={account} />)}
                  </div>
                </div>
              );
            })}
            
            {closedAccounts.length > 0 && (
              <div className="pt-2 border-t border-black/5 dark:border-white/5 space-y-1">
                <h4 className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-light-text-secondary/60 dark:text-dark-text-secondary/60 opacity-80">
                  Closed Accounts
                </h4>
                <div className="space-y-0.5">
                  {closedAccounts.map(account => <AccountCheckbox key={account.id} account={account} />)}
                </div>
              </div>
            )}
            
            {accounts.length === 0 && (
              <p className="text-center p-3 text-xs text-light-text-secondary dark:text-dark-text-secondary">No accounts found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiAccountFilter;