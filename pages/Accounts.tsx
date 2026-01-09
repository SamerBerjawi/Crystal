
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Account, Page, AccountType, Transaction, Warrant } from '../types';
import AddAccountModal from '../components/AddAccountModal';
import EditAccountModal from '../components/EditAccountModal';
import { ASSET_TYPES, DEBT_TYPES, BTN_PRIMARY_STYLE, ACCOUNT_TYPE_STYLES, BTN_SECONDARY_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, SELECT_STYLE, LIQUID_ACCOUNT_TYPES } from '../constants';
import { calculateAccountTotals, convertToEur, formatCurrency, parseLocalDate } from '../utils';
import AccountsListSection from '../components/AccountsListSection';
import BalanceAdjustmentModal from '../components/BalanceAdjustmentModal';
import FinalConfirmationModal from '../components/FinalConfirmationModal';
import Card from '../components/Card';
import useLocalStorage from '../hooks/useLocalStorage';
import { useScheduleContext } from '../contexts/FinancialDataContext';
import PageHeader from '../components/PageHeader';

interface AccountsProps {
    accounts: Account[];
    transactions: Transaction[];
    saveAccount: (account: Omit<Account, 'id'> & { id?: string }) => void;
    deleteAccount: (accountId: string) => void;
    setCurrentPage: (page: Page) => void;
    setViewingAccountId: (id: string | null) => void;
    onViewAccount?: (id: string) => void;
    saveTransaction: (transactions: (Omit<Transaction, 'id'> & { id?: string })[], idsToDelete?: string[]) => void;
    accountOrder: string[];
    setAccountOrder: React.Dispatch<React.SetStateAction<string[]>>;
    initialSortBy: 'name' | 'balance' | 'manual';
    warrants: Warrant[];
    onToggleAccountStatus: (accountId: string) => void;
    onNavigateToTransactions: (filters?: { accountName?: string | null }) => void;
    linkedEnableBankingAccountIds: Set<string>;
}

const Accounts: React.FC<AccountsProps> = ({ accounts, transactions, saveAccount, deleteAccount, setCurrentPage, setViewingAccountId, onViewAccount, saveTransaction, accountOrder, setAccountOrder, initialSortBy, warrants, onToggleAccountStatus, onNavigateToTransactions, linkedEnableBankingAccountIds }) => {
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isAdjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustingAccount, setAdjustingAccount] = useState<Account | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, account: Account } | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [layoutMode, setLayoutMode] = useLocalStorage<'stacked' | 'columns'>('crystal_accounts_section_layout', 'stacked');
  const [sortBy, setSortBy] = useState<'name' | 'balance' | 'manual'>(initialSortBy);
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
  
  // Filter accounts: Ensure Investment accounts are visible here if they lack a symbol
  // (Standard Investments with a Symbol are shown in the Investments page)
  const visibleAccounts = useMemo(() => {
      return accounts.filter(acc => {
          if (acc.type === 'Investment') {
               // Stock, ETF, Crypto are usually in Investments page, but ONLY if they have a symbol.
               // If they don't have a symbol, they are "incomplete" or manual accounts that should be visible here for editing.
               if (['Stock', 'ETF', 'Crypto'].includes(acc.subType || '')) {
                   return !acc.symbol; 
               }
               // Pension, Spare Change, Other are always visible here
               return true;
          }
          return true;
      });
  }, [accounts]);

  const analyticsAccounts = useMemo(() => visibleAccounts.filter(acc => acc.includeInAnalytics ?? true), [visibleAccounts]);
  const analyticsAccountIds = useMemo(() => new Set(analyticsAccounts.map(acc => acc.id)), [analyticsAccounts]);
  const analyticsTransactions = useMemo(
    () => transactions.filter(tx => analyticsAccountIds.has(tx.accountId)),
    [transactions, analyticsAccountIds]
  );

  // --- Data Processing ---
  const { openAccounts, closedAccounts, totalAssets, totalDebt, netWorth, liquidCash, netChange30d, debtRatio } = useMemo(() => {
    const safeAccounts = visibleAccounts || [];
    const open = safeAccounts.filter(acc => acc.status !== 'closed');
    const closed = safeAccounts.filter(acc => acc.status === 'closed');
    const analyticsOpen = open.filter(acc => acc.includeInAnalytics ?? true);
    const analyticsOpenIds = new Set(analyticsOpen.map(acc => acc.id));

    const { totalAssets, totalDebt, netWorth } = calculateAccountTotals(analyticsOpen, analyticsTransactions, loanPaymentOverrides);
    const liquidCash = analyticsOpen.filter(acc => LIQUID_ACCOUNT_TYPES.includes(acc.type))
                           .reduce((sum, acc) => sum + convertToEur(acc.balance, acc.currency), 0);

    // Calculate 30 day net change from transactions
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const netChange30d = analyticsTransactions.reduce((sum, tx) => {
        const txDate = parseLocalDate(tx.date);
        // FIX: Removed 'tx.type !== 'transfer'' as Transaction type is 'income' | 'expense'
        if (txDate >= thirtyDaysAgo && analyticsOpenIds.has(tx.accountId)) {
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
  }, [analyticsTransactions, visibleAccounts, loanPaymentOverrides]);

  const transactionsByAccount = useMemo(() => transactions.reduce((acc, transaction) => {
    (acc[transaction.accountId] = acc[transaction.accountId] || []).push(transaction);
    return acc;
  }, {} as Record<string, Transaction[]>), [transactions]);

  const assetAccounts = useMemo(() => openAccounts.filter(acc => ASSET_TYPES.includes(acc.type)), [openAccounts]);
  const debtAccounts = useMemo(() => openAccounts.filter(acc => DEBT_TYPES.includes(acc.type)), [openAccounts]);

  // --- Handlers ---
  const handleAccountClick = (accountId: string) => {
    if (onViewAccount) {
      onViewAccount(accountId);
    } else {
      setViewingAccountId(accountId);
      setCurrentPage('AccountDetail');
    }
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
    const menuWidth = 224;
    const menuHeight = 260;
    const padding = 12;
    const maxX = window.innerWidth - menuWidth - padding;
    const maxY = window.innerHeight - menuHeight - padding;
    const x = Math.max(padding, Math.min(event.clientX, maxX));
    const y = Math.max(padding, Math.min(event.clientY, maxY));

    setContextMenu({ x, y, account });
  };

  useEffect(() => {
    const visibleIds = visibleAccounts.map(acc => acc.id);
    setAccountOrder(prev => {
        const filtered = prev.filter(id => visibleIds.includes(id));
        const missing = visibleIds.filter(id => !filtered.includes(id));
        const next = [...filtered, ...missing];
        return next;
    });
  }, [setAccountOrder, visibleAccounts]);

  return (
    <div className="space-y-8 pb-12 animate-fade-in-up">
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
            className="fixed z-50 w-56 bg-light-card dark:bg-dark-card rounded-lg shadow-lg border border-black/10 dark:border-white/10 py-2 animate-fade-in-up"
        >
            <ul className="text-sm">
                <li>
                    <button onClick={() => { handleAccountClick(contextMenu.account.id); setContextMenu(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10">
                        <span className="material-symbols-outlined text-base">visibility</span>
                        <span>View Account</span>
                    </button>
                </li>
                <li>
                    <button onClick={() => { onNavigateToTransactions({ accountName: contextMenu.account.name }); setContextMenu(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10">
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

      {/* Header */}
      <PageHeader
        markerIcon="account_balance"
        markerLabel="Money Map"
        title="Accounts"
        subtitle="Bank, card, and lending balances with tools to rebalance, reorder, and reconcile on the fly."
        actions={
          <button onClick={() => setAddModalOpen(true)} className={`${BTN_PRIMARY_STYLE} flex items-center gap-2`}>
            <span className="material-symbols-outlined text-xl">add</span>
            Add Account
          </button>
        }
      />

      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-dark-card p-1.5 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm">
           
           {/* Sort Dropdown - Left aligned */}
           <div className="flex items-center gap-3 px-4 py-2">
                <span className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">Sort by:</span>
                <div className="relative group">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="bg-transparent text-sm font-bold text-light-text dark:text-dark-text focus:outline-none cursor-pointer pr-5 appearance-none"
                    >
                        <option value="manual">Manual Order</option>
                        <option value="name">Name (A-Z)</option>
                        <option value="balance">Value (High-Low)</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pointer-events-none text-light-text dark:text-dark-text">
                        <span className="material-symbols-outlined text-[16px]">expand_more</span>
                    </div>
                </div>
           </div>

           {/* Layout Toggle - Right aligned */}
           <div className="flex bg-light-fill dark:bg-dark-fill p-1 rounded-xl w-full md:w-auto">
                <button 
                    onClick={() => setLayoutMode('columns')} 
                    className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${layoutMode === 'columns' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}
                >
                    <span className="material-symbols-outlined text-[20px]">grid_view</span>
                    <span>Grid</span>
                </button>
                <button 
                    onClick={() => setLayoutMode('stacked')} 
                    className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${layoutMode === 'stacked' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}
                >
                    <span className="material-symbols-outlined text-[20px]">view_list</span>
                    <span>List</span>
                </button>
           </div>
      </div>

      {/* Content */}
      <div className="space-y-8">
        
        {/* --- PORTFOLIO DASHBOARD SECTION --- */}
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
                        linkedEnableBankingAccountIds={linkedEnableBankingAccountIds}
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
                        linkedEnableBankingAccountIds={linkedEnableBankingAccountIds}
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
                    linkedEnableBankingAccountIds={linkedEnableBankingAccountIds}
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
