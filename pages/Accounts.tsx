
import React, { useState, useMemo, useEffect } from 'react';
import { Account, Page, AccountType, Transaction, Warrant } from '../types';
import AddAccountModal from '../components/AddAccountModal';
import EditAccountModal from '../components/EditAccountModal';
import { ASSET_TYPES, DEBT_TYPES, BTN_PRIMARY_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, SELECT_STYLE } from '../constants';
import { calculateAccountTotals, convertToEur, formatCurrency } from '../utils';
import AccountCard from '../components/AccountCard';
import BalanceAdjustmentModal from '../components/BalanceAdjustmentModal';
import FinalConfirmationModal from '../components/FinalConfirmationModal';

interface AccountsProps {
    accounts: Account[];
    transactions: Transaction[];
    saveAccount: (account: Omit<Account, 'id'> & { id?: string }) => void;
    deleteAccount: (accountId: string) => void;
    setCurrentPage: (page: Page) => void;
    setAccountFilter: (accountName: string | null) => void;
    setViewingAccountId: (id: string) => void;
    saveTransaction: (transactions: (Omit<Transaction, 'id'> & { id?: string })[], idsToDelete?: string[]) => void;
    accountOrder: string[];
    setAccountOrder: React.Dispatch<React.SetStateAction<string[]>>;
    sortBy: 'name' | 'balance' | 'manual';
    setSortBy: React.Dispatch<React.SetStateAction<'name' | 'balance' | 'manual'>>;
    warrants: Warrant[];
    onToggleAccountStatus: (accountId: string) => void;
}

// A new component for the list section
const AccountsGridSection: React.FC<{
    title: string;
    accounts: Account[];
    transactionsByAccount: Record<string, Transaction[]>;
    onAccountClick: (id: string) => void;
    onEditClick: (account: Account) => void;
    onAdjustBalanceClick: (account: Account) => void;
    onToggleStatus: (accountId: string) => void;
    onDelete: (account: Account) => void;
    sortBy: 'name' | 'balance' | 'manual';
    accountOrder: string[];
    setAccountOrder: React.Dispatch<React.SetStateAction<string[]>>;
    isCollapsible?: boolean;
}> = ({ title, accounts, transactionsByAccount, onAccountClick, onEditClick, onAdjustBalanceClick, onToggleStatus, onDelete, sortBy, accountOrder, setAccountOrder, isCollapsible = true }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);

    const sortedAccounts = useMemo(() => {
        const accountsToSort = [...accounts];
        if (sortBy === 'manual') {
            return accountsToSort.sort((a,b) => {
                const aIndex = accountOrder.indexOf(a.id);
                const bIndex = accountOrder.indexOf(b.id);
                if (aIndex === -1 && bIndex === -1) return 0;
                if (aIndex === -1) return 1;
                if (bIndex === -1) return -1;
                return aIndex - bIndex;
            });
        }
        if (sortBy === 'name') {
            return accountsToSort.sort((a,b) => a.name.localeCompare(b.name));
        }
        if (sortBy === 'balance') {
            return accountsToSort.sort((a,b) => convertToEur(b.balance, b.currency) - convertToEur(a.balance, a.currency));
        }
        return accountsToSort;
    }, [accounts, sortBy, accountOrder]);

    const handleDragStart = (e: React.DragEvent, accountId: string) => { if (sortBy === 'manual') setDraggedId(accountId); };
    const handleDragOver = (e: React.DragEvent, accountId: string) => { if (sortBy === 'manual') { e.preventDefault(); if (draggedId && draggedId !== accountId) setDragOverId(accountId); }};
    const handleDragLeave = () => setDragOverId(null);
    const handleDragEnd = () => { setDraggedId(null); setDragOverId(null); };
    const handleDrop = (e: React.DragEvent, targetAccountId: string) => {
        e.preventDefault();
        if (sortBy !== 'manual' || !draggedId || draggedId === targetAccountId) return;

        const newOrder = [...accountOrder];
        const draggedIndex = newOrder.indexOf(draggedId);
        const targetIndex = newOrder.indexOf(targetAccountId);

        if (draggedIndex > -1 && targetIndex > -1) {
            const [draggedItem] = newOrder.splice(draggedIndex, 1);
            newOrder.splice(targetIndex, 0, draggedItem);
            setAccountOrder(newOrder);
        }
        handleDragEnd();
    };

    if (accounts.length === 0) {
        return null;
    }
    
    const totalValue = accounts.reduce((sum, acc) => sum + convertToEur(acc.balance, acc.currency), 0);

    return (
        <section className="animate-fade-in-up mb-8">
            <div 
                onClick={() => isCollapsible && setIsExpanded(prev => !prev)} 
                className={`flex justify-between items-center mb-6 group ${isCollapsible ? 'cursor-pointer' : ''}`}
            >
                <div className="flex items-center gap-3">
                     {isCollapsible && (
                        <span className={`material-symbols-outlined transition-transform duration-300 text-light-text-secondary dark:text-dark-text-secondary group-hover:text-primary-500 ${isExpanded ? 'rotate-180' : ''}`}>
                            expand_more
                        </span>
                    )}
                    <h3 className="text-xl font-bold text-light-text dark:text-dark-text tracking-tight flex items-center gap-2">
                        {title}
                        <span className="bg-gray-100 dark:bg-white/10 text-xs font-bold px-2.5 py-0.5 rounded-full text-gray-500 dark:text-gray-400">{accounts.length}</span>
                    </h3>
                </div>
                
                <div className="flex items-center gap-4">
                     <span className="font-mono font-bold text-lg text-light-text dark:text-dark-text">
                         {formatCurrency(totalValue, 'EUR')}
                     </span>
                </div>
            </div>
            
            {isExpanded && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {sortedAccounts.map(acc => (
                        <AccountCard
                            key={acc.id}
                            account={acc}
                            transactions={transactionsByAccount[acc.id]}
                            onClick={() => onAccountClick(acc.id)}
                            onEdit={() => onEditClick(acc)}
                            onAdjustBalance={() => onAdjustBalanceClick(acc)}
                            onToggleStatus={() => onToggleStatus(acc.id)}
                            onDelete={() => onDelete(acc)}
                            isDraggable={sortBy === 'manual'}
                            isBeingDragged={draggedId === acc.id}
                            isDragOver={dragOverId === acc.id}
                            onDragStart={(e) => handleDragStart(e, acc.id)}
                            onDragOver={(e) => handleDragOver(e, acc.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, acc.id)}
                            onDragEnd={handleDragEnd}
                        />
                    ))}
                </div>
            )}
        </section>
    );
};

const Accounts: React.FC<AccountsProps> = ({ accounts, transactions, saveAccount, deleteAccount, setCurrentPage, setAccountFilter, setViewingAccountId, saveTransaction, accountOrder, setAccountOrder, sortBy, setSortBy, warrants, onToggleAccountStatus }) => {
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isAdjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustingAccount, setAdjustingAccount] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);

  // --- Data Processing ---
  const { openAccounts, closedAccounts, totalAssets, totalDebt, netWorth } = useMemo(() => {
    const safeAccounts = accounts || [];
    const open = safeAccounts.filter(acc => acc.status !== 'closed');
    const closed = safeAccounts.filter(acc => acc.status === 'closed');
    
    const { totalAssets, totalDebt, netWorth } = calculateAccountTotals(open, transactions);

    return {
        openAccounts: open,
        closedAccounts: closed,
        totalAssets,
        totalDebt,
        netWorth,
    };
  }, [accounts, transactions]);

  // Define groups for display
  const accountGroups = useMemo(() => {
      const groups = [
          { id: 'cash', title: 'Cash & Banking', types: ['Checking', 'Savings'], accounts: [] as Account[] },
          { id: 'investments', title: 'Investments', types: ['Investment'], accounts: [] as Account[] },
          { id: 'properties', title: 'Properties & Assets', types: ['Property', 'Vehicle', 'Other Assets', 'Lending'], accounts: [] as Account[] },
          { id: 'credit', title: 'Credit Cards', types: ['Credit Card'], accounts: [] as Account[] },
          { id: 'loans', title: 'Loans & Liabilities', types: ['Loan', 'Other Liabilities'], accounts: [] as Account[] },
      ];

      openAccounts.forEach(acc => {
          const group = groups.find(g => g.types.includes(acc.type));
          if (group) {
              group.accounts.push(acc);
          }
      });

      return groups.filter(g => g.accounts.length > 0);
  }, [openAccounts]);

  const transactionsByAccount = useMemo(() => transactions.reduce((acc, transaction) => {
    (acc[transaction.accountId] = acc[transaction.accountId] || []).push(transaction);
    return acc;
  }, {} as Record<string, Transaction[]>), [transactions]);

  // --- Handlers ---
  const handleAccountClick = (accountId: string) => {
    setViewingAccountId(accountId);
    setCurrentPage('AccountDetail');
  };

  const openEditModal = (account: Account) => {
    setEditingAccount(account);
    setEditModalOpen(true);
  };
  
  const openAdjustModal = (account: Account) => {
    setAdjustingAccount(account);
    setAdjustModalOpen(true);
  };

  const closeAdjustModal = () => {
    setAdjustingAccount(null);
    setAdjustModalOpen(false);
  };

  const handleSaveAdjustment = (adjustmentAmount: number, date: string, notes: string) => {
    if (!adjustingAccount) return;

    const txData: Omit<Transaction, 'id'> = {
        accountId: adjustingAccount.id,
        date,
        description: 'Balance Adjustment',
        merchant: notes || 'Manual balance correction',
        amount: adjustmentAmount,
        category: adjustmentAmount >= 0 ? 'Income' : 'Miscellaneous',
        type: adjustmentAmount >= 0 ? 'income' : 'expense',
        currency: adjustingAccount.currency,
    };
    
    saveTransaction([txData], []);
    closeAdjustModal();
  };


  const handleAddAccount = (account: Omit<Account, 'id'>) => { saveAccount(account); setAddModalOpen(false); };
  const handleUpdateAccount = (updatedAccount: Account) => { saveAccount(updatedAccount); setEditModalOpen(false); setEditingAccount(null); };
  
  const handleConfirmDelete = () => {
    if (deletingAccount) {
      deleteAccount(deletingAccount.id);
      setDeletingAccount(null);
    }
  };

  const handleDeleteRequest = (account: Account) => {
      setDeletingAccount(account);
  }

  return (
    <div className="space-y-8 pb-10">
      {isAddModalOpen && <AddAccountModal onClose={() => setAddModalOpen(false)} onAdd={handleAddAccount} accounts={accounts} />}
      {isEditModalOpen && editingAccount && <EditAccountModal onClose={() => setEditModalOpen(false)} onSave={handleUpdateAccount} onDelete={(accountId) => { setEditModalOpen(false); setDeletingAccount(editingAccount);}} account={editingAccount} accounts={accounts} warrants={warrants} onToggleStatus={onToggleAccountStatus} />}
      {isAdjustModalOpen && adjustingAccount && (
        <BalanceAdjustmentModal
            onClose={closeAdjustModal}
            onSave={handleSaveAdjustment}
            account={adjustingAccount}
        />
      )}
      {deletingAccount && (
        <FinalConfirmationModal
            isOpen={!!deletingAccount}
            onClose={() => setDeletingAccount(null)}
            onConfirm={handleConfirmDelete}
            title="Delete Account"
            message={
                <>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
                        You are about to permanently delete the account <strong className="text-light-text dark:text-dark-text">{deletingAccount.name}</strong>.
                    </p>
                    <div className="p-3 bg-red-500/10 rounded-lg text-red-700 dark:text-red-300 text-sm">
                        <p className="font-bold">This action cannot be undone.</p>
                        <p>All associated transactions will also be permanently deleted.</p>
                    </div>
                </>
            }
            requiredText="DELETE"
            confirmButtonText="Delete Account"
        />
      )}

      {/* Hero Header */}
      <header className="relative overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800 dark:from-black dark:to-gray-900 rounded-3xl p-8 text-white shadow-2xl border border-white/10">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-6">
            <div className="w-full md:w-auto">
                <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Total Net Worth
                </p>
                <h1 className="text-5xl sm:text-6xl font-bold tracking-tighter text-white mb-4 drop-shadow-sm">
                    {formatCurrency(netWorth, 'EUR')}
                </h1>
                
                {/* Mini Breakdown */}
                <div className="flex items-center gap-6 text-sm font-medium">
                    <div className="flex flex-col">
                        <span className="text-gray-400 text-xs uppercase tracking-wide">Assets</span>
                        <span className="text-emerald-400 text-lg">{formatCurrency(totalAssets, 'EUR')}</span>
                    </div>
                    <div className="w-px h-8 bg-white/10"></div>
                    <div className="flex flex-col">
                         <span className="text-gray-400 text-xs uppercase tracking-wide">Liabilities</span>
                         <span className="text-rose-400 text-lg">{formatCurrency(Math.abs(totalDebt), 'EUR')}</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className={`${SELECT_WRAPPER_STYLE} w-full md:w-auto`}>
                    <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className={`${SELECT_STYLE} !w-full md:!w-auto min-w-[10rem] cursor-pointer bg-white/10 border-white/10 text-white hover:bg-white/20 focus:ring-white/30`}>
                        <option value="manual" className="text-black">Sort: Manual</option>
                        <option value="name" className="text-black">Sort: Name (A-Z)</option>
                        <option value="balance" className="text-black">Sort: Balance (High-Low)</option>
                    </select>
                    <div className={`${SELECT_ARROW_STYLE} text-white`}><span className="material-symbols-outlined">expand_more</span></div>
                </div>
                <button onClick={() => setAddModalOpen(true)} className={`${BTN_PRIMARY_STYLE} whitespace-nowrap shadow-lg shadow-primary-500/30 w-full md:w-auto px-6 bg-white text-primary-600 hover:bg-gray-100 border-none`}>
                    <span className="material-symbols-outlined text-lg mr-2">add_circle</span>
                    Add Account
                </button>
            </div>
        </div>
        
        {/* Assets vs Liabilities Bar */}
        <div className="relative z-10 mt-8 pt-6 border-t border-white/10">
            <div className="flex h-3 rounded-full overflow-hidden bg-gray-800 w-full">
                {totalAssets > 0 && (
                     <div className="h-full bg-emerald-500 transition-all duration-1000 relative group" style={{ width: `${(totalAssets / (totalAssets + Math.abs(totalDebt))) * 100}%` }}>
                         <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap transition-opacity">
                             Assets: {( (totalAssets / (totalAssets + Math.abs(totalDebt))) * 100 ).toFixed(1)}%
                         </div>
                     </div>
                )}
                 {Math.abs(totalDebt) > 0 && (
                     <div className="h-full bg-rose-500 transition-all duration-1000 relative group" style={{ width: `${(Math.abs(totalDebt) / (totalAssets + Math.abs(totalDebt))) * 100}%` }}>
                        <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap transition-opacity">
                             Liabilities: {( (Math.abs(totalDebt) / (totalAssets + Math.abs(totalDebt))) * 100 ).toFixed(1)}%
                         </div>
                     </div>
                )}
            </div>
        </div>
      </header>

      {/* Grids */}
      <div className="space-y-12">
        {accountGroups.map(group => (
             <AccountsGridSection
                key={group.id}
                title={group.title}
                accounts={group.accounts}
                transactionsByAccount={transactionsByAccount}
                onAccountClick={handleAccountClick}
                onEditClick={openEditModal}
                onAdjustBalanceClick={openAdjustModal}
                onToggleStatus={onToggleAccountStatus}
                onDelete={handleDeleteRequest}
                sortBy={sortBy}
                accountOrder={accountOrder}
                setAccountOrder={setAccountOrder}
                isCollapsible={true}
            />
        ))}

        <AccountsGridSection
            title="Closed Accounts"
            accounts={closedAccounts}
            transactionsByAccount={transactionsByAccount}
            onAccountClick={handleAccountClick}
            onEditClick={openEditModal}
            onAdjustBalanceClick={openAdjustModal}
            onToggleStatus={onToggleAccountStatus}
            onDelete={handleDeleteRequest}
            sortBy={sortBy}
            accountOrder={accountOrder}
            setAccountOrder={setAccountOrder}
            isCollapsible={true}
        />
      </div>
    </div>
  );
};

export default Accounts;
