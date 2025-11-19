
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Account } from '../types';
import { LIQUID_ACCOUNT_TYPES, ASSET_TYPES, DEBT_TYPES, CHECKBOX_STYLE, ALL_ACCOUNT_TYPES } from '../constants';

interface MultiAccountFilterProps {
  accounts: Account[];
  selectedAccountIds: string[];
  setSelectedAccountIds: (ids: string[]) => void;
}

const QuickFilterButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button
    onClick={onClick}
    className="w-full text-center text-sm font-semibold py-1.5 px-2 rounded-md transition-colors bg-light-fill dark:bg-dark-fill border border-black/5 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 whitespace-nowrap"
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

  const AccountCheckbox: React.FC<{ account: Account }> = ({ account }) => (
      <label key={account.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
          <input
              type="checkbox"
              checked={selectedAccountIds.includes(account.id)}
              onChange={() => handleToggle(account.id)}
              className={CHECKBOX_STYLE}
          />
          <span className="text-sm">{account.name}{account.status === 'closed' && <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary"> (Closed)</span>}</span>
      </label>
  );

  return (
    <div className="relative w-auto" ref={wrapperRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-10 w-auto flex items-center justify-between bg-light-fill dark:bg-dark-fill text-light-text dark:text-dark-text font-semibold pl-4 pr-2 rounded-lg border border-black/5 dark:border-white/10 hover:bg-gray-500/20 dark:hover:bg-gray-400/20 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 whitespace-nowrap"
      >
        <span className="mr-2">{buttonText()}</span>
        <span className="material-symbols-outlined text-base">expand_more</span>
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 max-w-[90vw] bg-light-card dark:bg-dark-card rounded-lg shadow-lg border border-black/5 dark:border-white/10 z-50">
          {/* Quick Filters */}
          <div className="p-3">
            <h4 className="px-1 pb-2 text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase">Quick Filters</h4>
            <div className="grid grid-cols-2 gap-2">
              <QuickFilterButton onClick={handleSelectAll}>All Accounts</QuickFilterButton>
              <QuickFilterButton onClick={handleSelectLiquid}>Liquid Only</QuickFilterButton>
              <QuickFilterButton onClick={handleSelectAssets}>All Assets</QuickFilterButton>
              <QuickFilterButton onClick={handleSelectLiabilities}>All Liabilities</QuickFilterButton>
              <QuickFilterButton onClick={handleSelectInvestments}>Investments</QuickFilterButton>
              <QuickFilterButton onClick={handleClearAll}>Clear All</QuickFilterButton>
            </div>
          </div>
          
          <hr className="border-black/10 dark:border-white/10" />

          {/* Individual Selection */}
          <div className="max-h-64 overflow-y-auto space-y-1 p-2">
            {/* Grouped Open Accounts */}
            {ALL_ACCOUNT_TYPES.map(type => {
                const groupAccounts = groupedOpenAccounts[type];
                if (!groupAccounts || groupAccounts.length === 0) return null;
                return (
                    <div key={type} className="mb-2">
                        <h4 className="px-2 py-1 text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase">{type}</h4>
                        {groupAccounts.map(account => <AccountCheckbox key={account.id} account={account} />)}
                    </div>
                );
            })}
            
            {closedAccounts.length > 0 && (
              <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/5">
                <h4 className="px-2 py-1 text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase">Closed Accounts</h4>
                {closedAccounts.map(account => <AccountCheckbox key={account.id} account={account} />)}
              </div>
            )}
            
            {accounts.length === 0 && (
                 <p className="text-center p-2 text-sm text-light-text-secondary">No accounts found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiAccountFilter;