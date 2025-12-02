
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Account, Page, AccountType, Transaction, Warrant } from '../types';
import AddAccountModal from '../components/AddAccountModal';
import EditAccountModal from '../components/EditAccountModal';
import { ASSET_TYPES, DEBT_TYPES, BTN_PRIMARY_STYLE, ACCOUNT_TYPE_STYLES, BTN_SECONDARY_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, SELECT_STYLE, LIQUID_ACCOUNT_TYPES } from '../constants';
import { calculateAccountTotals, convertToEur, formatCurrency, parseDateAsUTC } from '../utils';
import AccountRow from '../components/AccountRow';
import BalanceAdjustmentModal from '../components/BalanceAdjustmentModal';
import FinalConfirmationModal from '../components/FinalConfirmationModal';
import Card from '../components/Card';
import useLocalStorage from '../hooks/useLocalStorage';
import { useScheduleContext } from '../contexts/FinancialDataContext';

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
const AccountsListSection: React.FC<{
    title: string;
    accounts: Account[];
    transactionsByAccount: Record<string, Transaction[]>;
    warrants: Warrant[];
    onAccountClick: (id: string) => void;
    onEditClick: (account: Account) => void;
    onAdjustBalanceClick: (account: Account) => void;
    sortBy: 'name' | 'balance' | 'manual';
    accountOrder: string[];
    setAccountOrder: React.Dispatch<React.SetStateAction<string[]>>;
    onContextMenu: (event: React.MouseEvent, account: Account) => void;
    isCollapsible?: boolean;
    defaultExpanded?: boolean;
    layoutMode: 'stacked' | 'columns';
}> = ({ title, accounts, transactionsByAccount, warrants, onAccountClick, onEditClick, onAdjustBalanceClick, sortBy, accountOrder, setAccountOrder, onContextMenu, isCollapsible = true, defaultExpanded = true, layoutMode }) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
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


    const groupedAccounts = useMemo(() => sortedAccounts.reduce((acc, account) => {
        (acc[account.type] = acc[account.type] || []).push(account);
        return acc;
    }, {} as Record<AccountType, Account[]>), [sortedAccounts]);

    const groupOrder = useMemo(() => Object.keys(groupedAccounts).sort(), [groupedAccounts]);

    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const initialExpanded: Record<string, boolean> = {};
        groupOrder.forEach(key => initialExpanded[key] = true);
        setExpandedGroups(initialExpanded);
    }, [groupOrder]);

    const toggleGroup = (groupName: string) => setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));

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
    
    // Determine grid columns based on layout mode
    // If columns mode (side-by-side), we need fewer columns per row on XL screens because the section width is halved
    const gridClasses = layoutMode === 'columns' 
        ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2' 
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

    return (
        <section className="animate-fade-in-up h-full flex flex-col">
            {isCollapsible && (
                <div 
                    onClick={() => setIsExpanded(prev => !prev)} 
                    className="flex justify-between items-center mb-4 group cursor-pointer py-2 select-none"
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg bg-light-fill dark:bg-dark-fill flex items-center justify-center transition-colors group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30`}>
                             <span className={`material-symbols-outlined transition-transform duration-300 text-light-text-secondary dark:text-dark-text-secondary group-hover:text-primary-500 ${isExpanded ? 'rotate-180' : ''}`}>
                                expand_more
                            </span>
                        </div>
                        <h3 className="text-base font-bold text-light-text dark:text-dark-text uppercase tracking-wider">{title}</h3>
                        <span className="bg-light-fill dark:bg-dark-fill text-[10px] font-bold px-2 py-0.5 rounded-full text-light-text-secondary dark:text-dark-text-secondary">{accounts.length}</span>
                    </div>
                    <div className="h-px flex-grow bg-black/5 dark:bg-white/5 ml-4"></div>
                </div>
            )}
            
            {isExpanded && (
                <div className="space-y-6 flex-1">
                    {groupOrder.length > 0 ? groupOrder.map(groupName => {
                        const accountsInGroup = groupedAccounts[groupName as AccountType];
                        const groupTotal = accountsInGroup.reduce((sum, acc) => sum + convertToEur(acc.balance, acc.currency), 0);
                        return (
                            <div key={groupName} className="space-y-2">
                                <div onClick={() => toggleGroup(groupName)} className="flex justify-between items-center cursor-pointer group select-none px-1 py-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1 h-4 rounded-full bg-primary-500 transition-all duration-300 ${expandedGroups[groupName] ? 'h-4' : 'h-2 opacity-50'}`}></div>
                                        <h4 className="font-semibold text-light-text dark:text-dark-text text-sm">{groupName}</h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary group-hover:text-light-text dark:group-hover:text-dark-text transition-colors">
                                            {formatCurrency(groupTotal, 'EUR')}
                                        </span>
                                         <span className={`material-symbols-outlined text-sm text-light-text-secondary dark:text-dark-text-secondary transition-transform duration-200 ${expandedGroups[groupName] ? 'rotate-0' : '-rotate-90'}`}>expand_more</span>
                                    </div>
                                </div>
                                
                                {expandedGroups[groupName] && (
                                    <div className={`grid gap-3 ${gridClasses}`}>
                                        {accountsInGroup.map(acc => (
                                            <AccountRow
                                                key={acc.id}
                                                account={acc}
                                                transactions={transactionsByAccount[acc.id] || []}
                                                warrants={warrants}
                                                onClick={() => onAccountClick(acc.id)}
                                                onEdit={() => onEditClick(acc)}
                                                onAdjustBalance={() => onAdjustBalanceClick(acc)}
                                                isDraggable={sortBy === 'manual'}
                                                isBeingDragged={draggedId === acc.id}
                                                isDragOver={dragOverId === acc.id}
                                                onDragStart={(e) => handleDragStart(e, acc.id)}
                                                onDragOver={(e) => handleDragOver(e, acc.id)}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => handleDrop(e, acc.id)}
                                                onDragEnd={handleDragEnd}
                                                onContextMenu={(e) => onContextMenu(e, acc)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    }) : (
                        <div className="text-center py-8 bg-light-card/50 dark:bg-dark-card/30 rounded-xl border border-dashed border-black/10 dark:border-white/10 text-light-text-secondary dark:text-dark-text-secondary text-sm">
                            <p>No {title.toLowerCase()} found.</p>
                        </div>
                    )}
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
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, account: Account } | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [layoutMode, setLayoutMode] = useLocalStorage<'stacked' | 'columns'>('crystal_accounts_section_layout', 'stacked');
  const { loanPaymentOverrides } = useScheduleContext();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
            setContextMenu(null);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Filter accounts: Exclude active Stock/ETF/Crypto types from the main Accounts list
  // They are now managed in the Investments page.
  const visibleAccounts = useMemo(() => {
      return accounts.filter(acc => {
          if (acc.type === 'Investment') {
               // Keep Pension, Spare Change, Other. Hide Stock, ETF, Crypto.
               return ['Pension Fund', 'Spare Change', 'Other', undefined].includes(acc.subType);
          }
          return true;
      });
  }, [accounts]);

  // --- Data Processing ---
  const { openAccounts, closedAccounts, totalAssets, totalDebt, netWorth, liquidCash, netChange30d, debtRatio } = useMemo(() => {
    const safeAccounts = visibleAccounts || [];
    const open = safeAccounts.filter(acc => acc.status !== 'closed');
    const closed = safeAccounts.filter(acc => acc.status === 'closed');
    
    const { totalAssets, totalDebt, netWorth } = calculateAccountTotals(open, transactions, loanPaymentOverrides);
    const liquidCash = open.filter(acc => LIQUID_ACCOUNT_TYPES.includes(acc.type))
                           .reduce((sum, acc) => sum + convertToEur(acc.balance, acc.currency), 0);

    // Calculate 30 day net change from transactions
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const netChange30d = transactions.reduce((sum, tx) => {
        const txDate = parseDateAsUTC(tx.date);
        if (txDate >= thirtyDaysAgo && open.some(a => a.id === tx.accountId)) {
            return sum + convertToEur(tx.amount, tx.currency);
        }
        return sum;
    }, 0);

    const debtRatio = totalAssets > 0 ? (totalDebt / totalAssets) * 100 : 0;

    return {
        openAccounts: open,
        closedAccounts: closed,
        totalAssets,
        totalDebt,
        netWorth,
        liquidCash,
        netChange30d,
        debtRatio
    };
  }, [visibleAccounts, transactions, loanPaymentOverrides]);

  const transactionsByAccount = useMemo(() => transactions.reduce((acc, transaction) => {
    (acc[transaction.accountId] = acc[transaction.accountId] || []).push(transaction);
    return acc;
  }, {} as Record<string, Transaction[]>), [transactions]);

  const assetAccounts = useMemo(() => openAccounts.filter(acc => ASSET_TYPES.includes(acc.type)), [openAccounts]);
  const debtAccounts = useMemo(() => openAccounts.filter(acc => DEBT_TYPES.includes(acc.type)), [openAccounts]);

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

  const handleContextMenu = (event: React.MouseEvent, account: Account) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, account });
  };

  return (
    <div className="flex flex-col h-full">
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
      {contextMenu && (
        <div
            ref={contextMenuRef}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="absolute z-30 w-56 bg-light-card dark:bg-dark-card rounded-lg shadow-lg border border-black/10 dark:border-white/10 py-2 animate-fade-in-up"
        >
            <ul className="text-sm">
                <li>
                    <button onClick={() => { handleAccountClick(contextMenu.account.id); setContextMenu(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10">
                        <span className="material-symbols-outlined text-base">visibility</span>
                        <span>View Transactions</span>
                    </button>
                </li>
                <li>
                    <button onClick={() => { setAccountFilter(contextMenu.account.name); setCurrentPage('Transactions'); setContextMenu(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10">
                        <span className="material-symbols-outlined text-base">filter_list</span>
                        <span>Filter Transactions</span>
                    </button>
                </li>
                <div className="my-1 h-px bg-black/5 dark:bg-white/5"></div>
                <li>
                    <button onClick={() => { openEditModal(contextMenu.account); setContextMenu(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10">
                        <span className="material-symbols-outlined text-base">edit</span>
                        <span>Edit Account</span>
                    </button>
                </li>
                <li>
                    <button onClick={() => { openAdjustModal(contextMenu.account); setContextMenu(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10">
                        <span className="material-symbols-outlined text-base">tune</span>
                        <span>Adjust Balance</span>
                    </button>
                </li>
                <div className="my-1 h-px bg-black/5 dark:bg-white/5"></div>
                <li>
                    <button onClick={() => { setDeletingAccount(contextMenu.account); setContextMenu(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                        <span className="material-symbols-outlined text-base">delete</span>
                        <span>Delete Account</span>
                    </button>
                </li>
            </ul>
        </div>
      )}

      {/* Controls Bar */}
      <div className="flex-shrink-0 z-30 flex flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-4 border-b shadow-sm bg-light-bg/90 dark:bg-dark-bg/90 backdrop-blur-xl md:px-8 md:pt-6 md:-mx-8 -mx-4 -mt-4 md:-mt-8 border-black/5 dark:border-white/5 transition-all">
           
           <div className="flex items-center gap-3">
               {/* Layout Toggle */}
               <div className="flex p-1 space-x-1 rounded-lg bg-black/5 dark:bg-white/5">
                    <button 
                        onClick={() => setLayoutMode('columns')} 
                        className={`p-1.5 rounded-md transition-all duration-200 flex items-center ${layoutMode === 'columns' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}
                        title="Grid View"
                    >
                        <span className="material-symbols-outlined text-[20px]">grid_view</span>
                    </button>
                    <button 
                        onClick={() => setLayoutMode('stacked')} 
                        className={`p-1.5 rounded-md transition-all duration-200 flex items-center ${layoutMode === 'stacked' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}
                        title="List View"
                    >
                        <span className="material-symbols-outlined text-[20px]">view_list</span>
                    </button>
               </div>
               
               {/* Divider */}
               <div className="w-px h-6 bg-black/10 dark:bg-white/10"></div>

               {/* Sort Dropdown */}
                <div className="relative">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="h-9 pl-3 pr-8 text-sm font-medium transition-colors bg-transparent border rounded-lg appearance-none cursor-pointer border-black/10 dark:border-white/10 text-light-text dark:text-dark-text hover:bg-black/5 dark:hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                    >
                        <option value="manual">Manual Sort</option>
                        <option value="name">Name (A-Z)</option>
                        <option value="balance">Value (High-Low)</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-light-text-secondary dark:text-dark-text-secondary">
                        <span className="material-symbols-outlined text-[18px]">expand_more</span>
                    </div>
                </div>
           </div>

           {/* Add Button */}
           <button 
                onClick={() => setAddModalOpen(true)} 
                className="flex items-center justify-center h-9 gap-2 px-4 text-sm font-semibold text-white transition-all duration-200 rounded-lg shadow-sm bg-primary-600 hover:bg-primary-700 hover:shadow-md active:scale-95"
            >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>Add Account</span>
            </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto min-h-0 -mx-4 md:-mx-8 px-4 md:px-8 pt-6 space-y-8 pb-10">
        {/* --- NEW PORTFOLIO DASHBOARD SECTION --- */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Hero Card: Net Worth */}
            <div className="bg-gradient-to-br from-primary-600 to-primary-900 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[240px] xl:min-h-auto">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                        <span className="material-symbols-outlined text-[10rem]">account_balance</span>
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-2 opacity-80">
                            <span className="material-symbols-outlined text-xl">verified</span>
                            <span className="font-bold uppercase tracking-wider text-sm">Net Worth (Visible Accounts)</span>
                        </div>
                        <h2 className="text-5xl font-extrabold tracking-tight mb-4">{formatCurrency(netWorth, 'EUR')}</h2>
                    </div>
                    <div className="mt-auto">
                        <div className="flex items-center gap-3">
                            <span className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold backdrop-blur-md bg-white/20 ${netChange30d >= 0 ? 'text-green-100' : 'text-red-100'}`}>
                                <span className="material-symbols-outlined text-base">{netChange30d >= 0 ? 'trending_up' : 'trending_down'}</span>
                                {formatCurrency(Math.abs(netChange30d), 'EUR')}
                            </span>
                            <span className="text-sm opacity-70">30 Day Change</span>
                        </div>
                    </div>
            </div>

            {/* Metrics Grid */}
            <div className="xl:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    
                    {/* Assets */}
                    <div className="bg-white dark:bg-dark-card rounded-2xl p-6 border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                <span className="material-symbols-outlined text-2xl">account_balance</span>
                            </div>
                            <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Assets</span>
                        </div>
                        <p className="text-2xl font-bold text-light-text dark:text-dark-text">{formatCurrency(totalAssets, 'EUR')}</p>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">{assetAccounts.length} accounts</p>
                    </div>

                    {/* Liabilities */}
                    <div className="bg-white dark:bg-dark-card rounded-2xl p-6 border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                                <span className="material-symbols-outlined text-2xl">credit_card</span>
                            </div>
                            <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Liabilities</span>
                        </div>
                        <p className="text-2xl font-bold text-light-text dark:text-dark-text">{formatCurrency(totalDebt, 'EUR')}</p>
                        <p className={`text-sm font-medium mt-1 flex items-center gap-1 ${debtRatio > 50 ? 'text-orange-500' : 'text-green-500'}`}>
                            {debtRatio.toFixed(1)}% Debt Ratio
                        </p>
                    </div>

                    {/* Liquid Cash */}
                    <div className="bg-white dark:bg-dark-card rounded-2xl p-6 border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                <span className="material-symbols-outlined text-2xl">savings</span>
                            </div>
                            <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Liquidity</span>
                        </div>
                        <p className="text-2xl font-bold text-light-text dark:text-dark-text">{formatCurrency(liquidCash, 'EUR')}</p>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">Available Cash</p>
                    </div>

                    {/* Monthly Flow */}
                    <div className="bg-white dark:bg-dark-card rounded-2xl p-6 border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                                <span className="material-symbols-outlined text-2xl">payments</span>
                            </div>
                            <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">30d Net Flow</span>
                        </div>
                        <p className={`text-2xl font-bold ${netChange30d >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {netChange30d >= 0 ? '+' : ''}{formatCurrency(netChange30d, 'EUR')}
                        </p>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">Income - Expenses</p>
                    </div>

            </div>
        </div>

        {/* Main Accounts Grid/List */}
        <div className={`gap-8 ${layoutMode === 'columns' ? 'grid grid-cols-1 xl:grid-cols-2 items-start' : 'flex flex-col space-y-8'}`}>
            <div className="space-y-4 min-w-0">
                    <div className="flex items-center gap-2 pb-2 border-b border-black/5 dark:border-white/5">
                        <span className="material-symbols-outlined text-emerald-500">account_balance</span>
                        <h2 className="text-xl font-bold text-light-text dark:text-dark-text">Assets</h2>
                    </div>
                    <AccountsListSection 
                        title="Cash & Properties"
                        accounts={assetAccounts} 
                        transactionsByAccount={transactionsByAccount} 
                        warrants={warrants}
                        onAccountClick={handleAccountClick} 
                        onEditClick={openEditModal} 
                        onAdjustBalanceClick={openAdjustModal}
                        sortBy={sortBy}
                        accountOrder={accountOrder}
                        setAccountOrder={setAccountOrder}
                        onContextMenu={handleContextMenu}
                        isCollapsible={false}
                        layoutMode={layoutMode}
                    />
                </div>

                <div className="space-y-4 min-w-0">
                    <div className="flex items-center gap-2 pb-2 border-b border-black/5 dark:border-white/5">
                        <span className="material-symbols-outlined text-rose-500">credit_card</span>
                        <h2 className="text-xl font-bold text-light-text dark:text-dark-text">Liabilities</h2>
                    </div>
                    <AccountsListSection 
                        title="Debt & Loans"
                        accounts={debtAccounts} 
                        transactionsByAccount={transactionsByAccount} 
                        warrants={warrants}
                        onAccountClick={handleAccountClick} 
                        onEditClick={openEditModal} 
                        onAdjustBalanceClick={openAdjustModal}
                        sortBy={sortBy}
                        accountOrder={accountOrder}
                        setAccountOrder={setAccountOrder}
                        onContextMenu={handleContextMenu}
                        isCollapsible={false}
                        layoutMode={layoutMode}
                    />
                </div>
        </div>

        {/* Closed Accounts Section */}
        {closedAccounts.length > 0 && (
            <div className="opacity-60 hover:opacity-100 transition-opacity duration-300 mt-12 pt-8 border-t border-black/5 dark:border-white/5">
                <AccountsListSection 
                    title="Closed Accounts"
                    accounts={closedAccounts} 
                    transactionsByAccount={transactionsByAccount} 
                    warrants={warrants}
                    onAccountClick={handleAccountClick} 
                    onEditClick={openEditModal} 
                    onAdjustBalanceClick={openAdjustModal}
                    sortBy={sortBy}
                    accountOrder={accountOrder}
                    setAccountOrder={setAccountOrder}
                    onContextMenu={handleContextMenu}
                    isCollapsible={true}
                    defaultExpanded={false}
                    layoutMode={layoutMode}
                />
            </div>
        )}
      </div>
    </div>
  );
};

export default Accounts;
