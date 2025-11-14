import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Account } from '../types';
import { LIQUID_ACCOUNT_TYPES, ASSET_TYPES, DEBT_TYPES, CHECKBOX_STYLE } from '../constants';

interface MultiAccountFilterProps {
  accounts: Account[];
  selectedAccountIds: string[];
  setSelectedAccountIds: (ids: string[]) => void;
}

const QuickFilterButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button
    onClick={onClick}
    className="w-full text-center text-sm font-semibold py-1.5 px-2 rounded-md transition-colors bg-light-fill dark:bg-dark-fill hover:bg-black/10 dark:hover:bg-white/10"
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

  const { liquidAccounts, otherAccounts } = useMemo(() => {
    const liquid: Account[] = [];
    const other: Account[] = [];
    accounts.forEach(acc => {
      if (LIQUID_ACCOUNT_TYPES.includes(acc.type)) {
        liquid.push(acc);
      } else {
        other.push(acc);
      }
    });
    return { liquidAccounts: liquid, otherAccounts: other };
  }, [accounts]);

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
          <span className="text-sm">{account.name}</span>
      </label>
  );

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-10 w-48 flex items-center justify-between bg-light-fill dark:bg-dark-fill text-light-text dark:text-dark-text font-semibold pl-4 pr-2 rounded-lg hover:bg-gray-500/20 dark:hover:bg-gray-400/20 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <span className="truncate">{buttonText()}</span>
        <span className="material-symbols-outlined text-base">expand_more</span>
      </button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-light-card dark:bg-dark-card rounded-lg shadow-lg border border-black/5 dark:border-white/10 z-10">
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
            {liquidAccounts.length > 0 && (
              <div>
                <h4 className="px-2 py-1 text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase">Liquid Accounts</h4>
                {liquidAccounts.map(account => <AccountCheckbox key={account.id} account={account} />)}
              </div>
            )}
            
            {otherAccounts.length > 0 && (
              <div className="mt-2">
                <h4 className="px-2 py-1 text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase">Other Assets & Liabilities</h4>
                {otherAccounts.map(account => <AccountCheckbox key={account.id} account={account} />)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiAccountFilter;