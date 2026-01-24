import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Account, Page, AccountType, Transaction, Warrant } from '../types';
import AddAccountModal from '../components/AddAccountModal';
import EditAccountModal from '../components/EditAccountModal';
import { ASSET_TYPES, DEBT_TYPES, BTN_PRIMARY_STYLE, ACCOUNT_TYPE_STYLES, BTN_SECONDARY_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, SELECT_STYLE, LIQUID_ACCOUNT_TYPES } from '../constants';
import { calculateAccountTotals, convertToEur, formatCurrency, parseLocalDate, toLocalISOString } from '../utils';
import AccountsListSection from '../components/AccountsListSection';
import BalanceAdjustmentModal from '../components/BalanceAdjustmentModal';
import FinalConfirmationModal from '../components/FinalConfirmationModal';
import Card from '../components/Card';
import useLocalStorage from '../hooks/useLocalStorage';
import { useScheduleContext } from '../contexts/FinancialDataContext';
import PageHeader from '../components/PageHeader';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

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
  
  const visibleAccounts = useMemo(() => {
      return accounts.filter(acc => {
          if (acc.type === 'Investment') {
               if (['Stock', 'ETF', 'Crypto'].includes(acc.subType || '')) {
                   return !acc.symbol; 
               }
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

  const { openAccounts, closedAccounts, totalAssets, totalDebt, netWorth, liquidCash, netChange30d, debtRatio, trendData } = useMemo(() => {
    const safeAccounts = visibleAccounts || [];
    const open = safeAccounts.filter(acc => acc.status !== 'closed');
    const closed = safeAccounts.filter(acc => acc.status === 'closed');
    const analyticsOpen = open.filter(acc => acc.includeInAnalytics ?? true);
    const analyticsOpenIds = new Set(analyticsOpen.map(acc => acc.id));

    const { totalAssets, totalDebt, netWorth } = calculateAccountTotals(analyticsOpen, analyticsTransactions, loanPaymentOverrides);
    const liquidCash = analyticsOpen.filter(acc => LIQUID_ACCOUNT_TYPES.includes(acc.type))
                           .reduce((sum, acc) => sum + convertToEur(acc.balance, acc.currency), 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const netChange30d = analyticsTransactions.reduce((sum, tx) => {
        const txDate = parseLocalDate(tx.date);
        if (txDate >= thirtyDaysAgo && analyticsOpenIds.has(tx.accountId)) {
            return sum + convertToEur(tx.amount, tx.currency);
        }
        return sum;
    }, 0);

    const debtRatio = totalAssets > 0 ? (totalDebt / totalAssets) * 100 : 0;

    // Calculate Trend Data for Hero
    const dailyTrend = [];
    let runningNetWorth = netWorth;
    const sortedTxs = [...analyticsTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const changesByDate: Record<string, number> = {};
    sortedTxs.forEach(tx => {
        const d = tx.date;
        changesByDate[d] = (changesByDate[d] || 0) + convertToEur(tx.amount, tx.currency);
    });

    for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = toLocalISOString(date);
        dailyTrend.push({ date: dateStr, value: runningNetWorth });
        runningNetWorth -= (changesByDate[dateStr] || 0);
    }
    const trendData = dailyTrend.reverse();

    return {
        openAccounts: open,
        closedAccounts: closed,
        totalAssets,
        totalDebt,
        netWorth,
        liquidCash,
        netChange30d,
        debtRatio,
        trendData
    };
  }, [analyticsTransactions, visibleAccounts, loanPaymentOverrides]);

  const transactionsByAccount = useMemo(() => transactions.reduce((acc, transaction) => {
    (acc[transaction.accountId] = acc[transaction.accountId] || []).push(transaction);
    return acc;
  }, {} as Record<string, Transaction[]>), [transactions]);

  const assetAccounts = useMemo(() => openAccounts.filter(acc => ASSET_TYPES.includes(acc.type)), [openAccounts]);
  const debtAccounts = useMemo(() => openAccounts.filter(acc => DEBT_TYPES.includes(acc.type)), [openAccounts]);

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
    setAdjustingAccount(null);
    setAdjustModalOpen(false);
  };

  const handleAddAccount = (account: Omit<Account, 'id'>) => { saveAccount(account); setAddModalOpen(false); };
  const handleUpdateAccount = (updatedAccount: Account) => { saveAccount(updatedAccount); setEditModalOpen(false); setEditingAccount(null); };
  const handleConfirmDelete = () => { if (deletingAccount) { deleteAccount(deletingAccount.id); setDeletingAccount(null); } };

  const handleContextMenu = (event: React.MouseEvent, account: Account) => {
    event.preventDefault();
    const menuWidth = 224;
    const menuHeight = 260;
    const padding = 12;
    const x = Math.max(padding, Math.min(event.clientX, window.innerWidth - menuWidth - padding));
    const y = Math.max(padding, Math.min(event.clientY, window.innerHeight - menuHeight - padding));
    setContextMenu({ x, y, account });
  };

  const netChangePercent = netWorth > 0 ? (netChange30d / (netWorth - netChange30d)) * 100 : 0;

  return (
    <div className="space-y-8 pb-12 animate-fade-in-up">
      {isAddModalOpen && <AddAccountModal onClose={() => setAddModalOpen(false)} onAdd={handleAddAccount} accounts={accounts} />}
      {isEditModalOpen && editingAccount && <EditAccountModal onClose={() => setEditModalOpen(false)} onSave={handleUpdateAccount} onDelete={(accountId) => { setEditModalOpen(false); setDeletingAccount(editingAccount);}} account={editingAccount} accounts={accounts} warrants={warrants} onToggleStatus={onToggleAccountStatus} />}
      {isAdjustModalOpen && adjustingAccount && <BalanceAdjustmentModal onClose={() => setAdjustingAccount(null)} onSave={handleSaveAdjustment} account={adjustingAccount} />}
      {deletingAccount && <FinalConfirmationModal isOpen={!!deletingAccount} onClose={() => setDeletingAccount(null)} onConfirm={handleConfirmDelete} title="Delete Account" message={<><p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">You are about to permanently delete the account <strong className="text-light-text dark:text-dark-text">{deletingAccount.name}</strong>.</p><div className="p-3 bg-red-500/10 rounded-lg text-red-700 dark:text-red-300 text-sm"><p className="font-bold">This action cannot be undone.</p><p>All associated transactions will also be permanently deleted.</p></div></>} requiredText="DELETE" confirmButtonText="Delete Account" />}
      {contextMenu && (
        <div ref={contextMenuRef} style={{ top: contextMenu.y, left: contextMenu.x }} className="fixed z-50 w-56 bg-light-card dark:bg-dark-card rounded-lg shadow-lg border border-black/10 dark:border-white/10 py-2 animate-fade-in-up">
            <ul className="text-sm">
                <li><button onClick={() => { handleAccountClick(contextMenu.account.id); setContextMenu(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10"><span className="material-symbols-outlined text-base">visibility</span><span>View Account</span></button></li>
                <li><button onClick={() => { onNavigateToTransactions({ accountName: contextMenu.account.name }); setContextMenu(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10"><span className="material-symbols-outlined text-base">filter_list</span><span>Filter Transactions</span></button></li>
                <div className="my-1 h-px bg-black/5 dark:bg-white/5"></div>
                <li><button onClick={() => { openEditModal(contextMenu.account); setContextMenu(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10"><span className="material-symbols-outlined text-base">edit</span><span>Edit Account</span></button></li>
                <li><button onClick={() => { openAdjustModal(contextMenu.account); setContextMenu(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10"><span className="material-symbols-outlined text-base">tune</span><span>Adjust Balance</span></button></li>
                <div className="my-1 h-px bg-black/5 dark:bg-white/5"></div>
                <li><button onClick={() => { setDeletingAccount(contextMenu.account); setContextMenu(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><span className="material-symbols-outlined text-base">delete</span><span>Delete Account</span></button></li>
            </ul>
        </div>
      )}

      <PageHeader markerIcon="account_balance" markerLabel="Money Map" title="Accounts" subtitle="Bank, card, and lending balances with tools to rebalance, reorder, and reconcile on the fly." actions={<button onClick={() => setAddModalOpen(true)} className={`${BTN_PRIMARY_STYLE} flex items-center gap-2`}><span className="material-symbols-outlined text-xl">add</span>Add Account</button>} />

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-dark-card p-1.5 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm">
           <div className="flex items-center gap-3 px-4 py-2">
                <span className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">Sort by:</span>
                <div className="relative group">
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="bg-transparent text-sm font-bold text-light-text dark:text-dark-text focus:outline-none cursor-pointer pr-5 appearance-none">
                        <option value="manual">Manual Order</option>
                        <option value="name">Name (A-Z)</option>
                        <option value="balance">Value (High-Low)</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pointer-events-none text-light-text dark:text-dark-text"><span className="material-symbols-outlined text-[16px]">expand_more</span></div>
                </div>
           </div>
           <div className="flex bg-light-fill dark:bg-dark-fill p-1 rounded-xl w-full md:w-auto">
                <button onClick={() => setLayoutMode('columns')} className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${layoutMode === 'columns' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}><span className="material-symbols-outlined text-[20px]">grid_view</span><span>Grid</span></button>
                <button onClick={() => setLayoutMode('stacked')} className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${layoutMode === 'stacked' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}><span className="material-symbols-outlined text-[20px]">view_list</span><span>List</span></button>
           </div>
      </div>

      <div className="space-y-8">
        
        {/* --- ENHANCED WEALTH COMMAND HERO --- */}
        <div className="relative group">
            <div className="absolute inset-0 bg-primary-500/5 dark:bg-primary-500/10 blur-3xl -z-10 rounded-full scale-95 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            <div className="bg-white/60 dark:bg-dark-card/60 backdrop-blur-3xl rounded-[2.5rem] border border-black/5 dark:border-white/10 shadow-2xl overflow-hidden relative min-h-[380px] flex flex-col">
                
                {/* 1. Background Trend Chart */}
                <div className="absolute inset-0 z-0 pointer-events-none opacity-20 dark:opacity-30">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="heroGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#fa9a1d" stopOpacity={0.4}/>
                                    <stop offset="100%" stopColor="#fa9a1d" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <Area 
                                type="monotone" 
                                dataKey="value" 
                                stroke="#fa9a1d" 
                                strokeWidth={4} 
                                fill="url(#heroGradient)" 
                                animationDuration={2000}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* 2. Top Section: Balance & Header */}
                <div className="relative z-10 p-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 flex-grow">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-[10px] font-black uppercase tracking-[0.2em] border border-primary-200 dark:border-primary-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse"></span>
                            Aggregate Net Worth
                        </div>
                        <h2 className="text-6xl md:text-7xl font-black text-light-text dark:text-dark-text tracking-tighter privacy-blur">
                            {formatCurrency(netWorth, 'EUR')}
                        </h2>
                        <div className="flex items-center gap-4">
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider backdrop-blur-md border ${netChange30d >= 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' : 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800'}`}>
                                <span className="material-symbols-outlined text-sm">{netChange30d >= 0 ? 'trending_up' : 'trending_down'}</span>
                                {formatCurrency(Math.abs(netChange30d), 'EUR', { showPlusSign: false })}
                                <span className="opacity-60 ml-1">({netChangePercent.toFixed(1)}%)</span>
                            </div>
                            <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-60">Past 30 Days</span>
                        </div>
                    </div>

                    <div className="hidden lg:flex flex-col items-end">
                         <div className="w-20 h-20 rounded-3xl bg-white dark:bg-black/20 flex items-center justify-center border border-black/5 dark:border-white/10 shadow-lg group-hover:scale-110 transition-transform duration-500">
                             <span className="material-symbols-outlined text-4xl text-primary-500">account_balance</span>
                         </div>
                    </div>
                </div>

                {/* 3. Bottom Section: Wealth Pillars */}
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x border-t border-black/5 dark:border-white/5 bg-white/40 dark:bg-black/20 backdrop-blur-md">
                    
                    {/* Pillar: Liquidity */}
                    <div className="p-8 group/pillar hover:bg-white/40 dark:hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="material-symbols-outlined text-blue-500">savings</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Liquidity Index</span>
                        </div>
                        <p className="text-2xl font-black text-light-text dark:text-dark-text privacy-blur">{formatCurrency(liquidCash, 'EUR')}</p>
                        <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary mt-1 opacity-60">AVAILABLE CASH</p>
                    </div>

                    {/* Pillar: Debt Ratio */}
                    <div className="p-8 group/pillar hover:bg-white/40 dark:hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="material-symbols-outlined text-rose-500">credit_card</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Solvency Ratio</span>
                        </div>
                        <p className="text-2xl font-black text-light-text dark:text-dark-text">{debtRatio.toFixed(1)}%</p>
                        <div className="w-full h-1 bg-black/5 dark:bg-white/10 rounded-full mt-3 overflow-hidden">
                             <div className="h-full bg-rose-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, debtRatio)}%` }}></div>
                        </div>
                    </div>

                    {/* Pillar: Velocity */}
                    <div className="p-8 group/pillar hover:bg-white/40 dark:hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="material-symbols-outlined text-emerald-500">payments</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Monthly Velocity</span>
                        </div>
                        <p className="text-2xl font-black text-light-text dark:text-dark-text privacy-blur">{formatCurrency(netChange30d, 'EUR', { showPlusSign: true })}</p>
                        <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary mt-1 opacity-60">CASH FLOW DIRECTION</p>
                    </div>

                </div>
            </div>
        </div>

        <div className={`gap-8 ${layoutMode === 'columns' ? 'grid grid-cols-1 xl:grid-cols-2 items-start' : 'flex flex-col space-y-8'}`}>
            <div className="space-y-4 min-w-0">
                    <div className="flex items-center gap-2 pb-2 border-b border-black/5 dark:border-white/5">
                        <span className="material-symbols-outlined text-emerald-500">account_balance</span>
                        <h2 className="text-xl font-bold text-light-text dark:text-dark-text">Assets</h2>
                    </div>
                    <AccountsListSection title="Cash & Properties" accounts={assetAccounts} transactionsByAccount={transactionsByAccount} warrants={warrants} linkedEnableBankingAccountIds={linkedEnableBankingAccountIds} onAccountClick={handleAccountClick} onEditClick={openEditModal} onAdjustBalanceClick={openAdjustModal} sortBy={sortBy} accountOrder={accountOrder} setAccountOrder={setAccountOrder} onContextMenu={handleContextMenu} isCollapsible={false} layoutMode={layoutMode} />
                </div>
                <div className="space-y-4 min-w-0">
                    <div className="flex items-center gap-2 pb-2 border-b border-black/5 dark:border-white/5">
                        <span className="material-symbols-outlined text-rose-500">credit_card</span>
                        <h2 className="text-xl font-bold text-light-text dark:text-dark-text">Liabilities</h2>
                    </div>
                    <AccountsListSection title="Debt & Loans" accounts={debtAccounts} transactionsByAccount={transactionsByAccount} warrants={warrants} linkedEnableBankingAccountIds={linkedEnableBankingAccountIds} onAccountClick={handleAccountClick} onEditClick={openEditModal} onAdjustBalanceClick={openAdjustModal} sortBy={sortBy} accountOrder={accountOrder} setAccountOrder={setAccountOrder} onContextMenu={handleContextMenu} isCollapsible={false} layoutMode={layoutMode} />
                </div>
        </div>

        {closedAccounts.length > 0 && (
            <div className="opacity-60 hover:opacity-100 transition-opacity duration-300 mt-12 pt-8 border-t border-black/5 dark:border-white/5">
                <AccountsListSection title="Closed Accounts" accounts={closedAccounts} transactionsByAccount={transactionsByAccount} warrants={warrants} linkedEnableBankingAccountIds={linkedEnableBankingAccountIds} onAccountClick={handleAccountClick} onEditClick={openEditModal} onAdjustBalanceClick={openAdjustModal} sortBy={sortBy} accountOrder={accountOrder} setAccountOrder={setAccountOrder} onContextMenu={handleContextMenu} isCollapsible={true} defaultExpanded={false} layoutMode={layoutMode} />
            </div>
        )}
      </div>
    </div>
  );
};

export default Accounts;