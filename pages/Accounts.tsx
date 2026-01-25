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
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

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
    <div className="space-y-6 pb-12 animate-fade-in-up">
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

      {/* --- REFINED WEALTH CONSOLE --- */}
      <div className="relative group">
          <div className="bg-white/40 dark:bg-dark-card/40 backdrop-blur-2xl rounded-2xl border border-black/5 dark:border-white/5 shadow-lg overflow-hidden">
              <div className="flex flex-col xl:flex-row items-stretch">
                  
                  {/* Left: Main Balance & Sparkline */}
                  <div className="flex-1 flex flex-col sm:flex-row items-center gap-8 p-6 border-b xl:border-b-0 xl:border-r border-black/5 dark:border-white/5">
                      <div className="space-y-1 text-center sm:text-left">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary">Aggregate Net Worth</p>
                          <div className="flex items-baseline gap-3">
                              <h2 className="text-4xl md:text-5xl font-black text-light-text dark:text-dark-text tracking-tighter privacy-blur leading-none">
                                  {formatCurrency(netWorth, 'EUR')}
                              </h2>
                              <div className={`flex items-center gap-1 text-[10px] font-black uppercase ${netChange30d >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                  {netChange30d >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(netChange30d), 'EUR', { showPlusSign: false })}
                              </div>
                          </div>
                      </div>
                      
                      {/* Compact Trend Line (Doesn't span full width) */}
                      <div className="w-full sm:w-32 h-12 opacity-50 hover:opacity-100 transition-opacity">
                          <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={trendData}>
                                  <YAxis hide domain={['auto', 'auto']} />
                                  <Line 
                                      type="monotone" 
                                      dataKey="value" 
                                      stroke="#fa9a1d" 
                                      strokeWidth={3} 
                                      dot={false} 
                                      animationDuration={1500}
                                  />
                              </LineChart>
                          </ResponsiveContainer>
                      </div>
                  </div>

                  {/* Right: Wealth Vitals Grid (High density) */}
                  <div className="flex-[1.5] grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x border-black/5 dark:border-white/5">
                      
                      {/* Vital: Liquidity */}
                      <div className="p-5 flex items-center gap-4 group/vital hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-inner">
                              <span className="material-symbols-outlined text-xl">savings</span>
                          </div>
                          <div className="min-w-0">
                              <span className="text-[9px] font-black uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary block mb-0.5">Liquidity</span>
                              <p className="text-lg font-black text-light-text dark:text-dark-text privacy-blur leading-tight truncate">{formatCurrency(liquidCash, 'EUR')}</p>
                          </div>
                      </div>

                      {/* Vital: Solvency */}
                      <div className="p-5 flex flex-col justify-center group/vital hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                          <div className="flex justify-between items-baseline mb-2">
                              <span className="text-[9px] font-black uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Solvency</span>
                              <span className="text-[11px] font-black text-rose-500">{debtRatio.toFixed(1)}%</span>
                          </div>
                          <div className="w-full h-1 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                               <div className="h-full bg-rose-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, debtRatio)}%` }}></div>
                          </div>
                      </div>

                      {/* Vital: Velocity */}
                      <div className="p-5 flex items-center gap-4 group/vital hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
                              <span className="material-symbols-outlined text-xl">payments</span>
                          </div>
                          <div className="min-w-0">
                              <span className="text-[9px] font-black uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary block mb-0.5">Velocity</span>
                              <p className="text-lg font-black text-light-text dark:text-dark-text privacy-blur leading-tight truncate">{formatCurrency(netChange30d, 'EUR', { showPlusSign: true })}</p>
                          </div>
                      </div>

                  </div>
              </div>
          </div>
      </div>

      {/* Controls Bar */}
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
                {/* FIX: Changed 'openAdjustBalanceClick' to 'openAdjustModal' which is the correct function defined in the component. */}
                <AccountsListSection title="Closed Accounts" accounts={closedAccounts} transactionsByAccount={transactionsByAccount} warrants={warrants} linkedEnableBankingAccountIds={linkedEnableBankingAccountIds} onAccountClick={handleAccountClick} onEditClick={openEditModal} onAdjustBalanceClick={openAdjustModal} sortBy={sortBy} accountOrder={accountOrder} setAccountOrder={setAccountOrder} onContextMenu={handleContextMenu} isCollapsible={true} defaultExpanded={false} layoutMode={layoutMode} />
            </div>
        )}
      </div>
    </div>
  );
};

export default Accounts;