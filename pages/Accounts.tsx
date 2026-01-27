
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
import { LineChart, Line, ResponsiveContainer, YAxis, AreaChart, Area } from 'recharts';

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

type AccountSegment = 'all' | 'cash' | 'invested' | 'property' | 'debt';

const Accounts: React.FC<AccountsProps> = ({ accounts, transactions, saveAccount, deleteAccount, setCurrentPage, setViewingAccountId, onViewAccount, saveTransaction, accountOrder, setAccountOrder, initialSortBy, warrants, onToggleAccountStatus, onNavigateToTransactions, linkedEnableBankingAccountIds }) => {
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isAdjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustingAccount, setAdjustingAccount] = useState<Account | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, account: Account } | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [layoutMode, setLayoutMode] = useLocalStorage<'stacked' | 'columns'>('crystal_accounts_section_layout', 'columns');
  const [sortBy, setSortBy] = useState<'name' | 'balance' | 'manual'>(initialSortBy);
  const { loanPaymentOverrides } = useScheduleContext();
  
  // New State for Segmentation
  const [activeSegment, setActiveSegment] = useState<AccountSegment>('all');

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
          // Hide underlying warrant accounts from main view as they are managed via Warrants page
          if (acc.type === 'Investment') {
               if (['Stock', 'ETF', 'Crypto'].includes(acc.subType || '')) {
                   return !acc.symbol; 
               }
               return true;
          }
          return true;
      });
  }, [accounts]);

  // --- Metrics Calculation ---
  const analyticsAccounts = useMemo(() => visibleAccounts.filter(acc => acc.includeInAnalytics ?? true), [visibleAccounts]);
  const analyticsAccountIds = useMemo(() => new Set(analyticsAccounts.map(acc => acc.id)), [analyticsAccounts]);
  const analyticsTransactions = useMemo(
    () => transactions.filter(tx => analyticsAccountIds.has(tx.accountId)),
    [transactions, analyticsAccountIds]
  );

  const globalMetrics = useMemo(() => {
      const open = visibleAccounts.filter(acc => acc.status !== 'closed');
      const { totalAssets, totalDebt, netWorth } = calculateAccountTotals(open, analyticsTransactions, loanPaymentOverrides);
      const liquidCash = open.filter(acc => LIQUID_ACCOUNT_TYPES.includes(acc.type))
                            .reduce((sum, acc) => sum + convertToEur(acc.balance, acc.currency), 0);
                            
      // Calculate daily trend for sparkline
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
      
      return { totalAssets, totalDebt, netWorth, liquidCash, trendData: dailyTrend.reverse() };
  }, [visibleAccounts, analyticsTransactions, loanPaymentOverrides]);

  // --- Filter Logic ---
  const filteredAccounts = useMemo(() => {
      const open = visibleAccounts.filter(acc => acc.status !== 'closed');
      switch (activeSegment) {
          case 'cash':
              return open.filter(acc => LIQUID_ACCOUNT_TYPES.includes(acc.type));
          case 'invested':
              return open.filter(acc => acc.type === 'Investment');
          case 'property':
              return open.filter(acc => acc.type === 'Property' || acc.type === 'Vehicle' || acc.type === 'Other Assets');
          case 'debt':
              return open.filter(acc => DEBT_TYPES.includes(acc.type));
          default:
              return open;
      }
  }, [visibleAccounts, activeSegment]);
  
  const closedAccounts = useMemo(() => visibleAccounts.filter(acc => acc.status === 'closed'), [visibleAccounts]);

  // --- Segment Metrics ---
  const segmentMetrics = useMemo(() => {
      const accountsToSum = filteredAccounts.filter(acc => acc.includeInAnalytics ?? true);
      let totalValue = 0;
      let label = 'Total Net Worth';
      let subLabel = 'All Accounts';
      let details: { label: string; value: string; icon?: string }[] = [];
      
      if (activeSegment === 'all') {
          totalValue = globalMetrics.netWorth;
          details = [
              { label: 'Total Assets', value: formatCurrency(globalMetrics.totalAssets, 'EUR'), icon: 'account_balance' },
              { label: 'Total Liabilities', value: formatCurrency(globalMetrics.totalDebt, 'EUR'), icon: 'money_off' },
              { label: 'Liquid Cash', value: formatCurrency(globalMetrics.liquidCash, 'EUR'), icon: 'savings' },
          ];
      } else if (activeSegment === 'cash') {
          totalValue = accountsToSum.reduce((sum, acc) => sum + convertToEur(acc.balance, acc.currency), 0);
          label = 'Total Liquidity';
          subLabel = 'Cash & Equivalents';

          const checking = accountsToSum.filter(a => a.type === 'Checking').reduce((s, a) => s + convertToEur(a.balance, a.currency), 0);
          const savings = accountsToSum.filter(a => a.type === 'Savings').reduce((s, a) => s + convertToEur(a.balance, a.currency), 0);
          
          // Calculate 30-day net flow for cash accounts
          const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const cashIds = new Set(accountsToSum.map(a => a.id));
          const netFlow = transactions
            .filter(t => cashIds.has(t.accountId) && new Date(t.date) >= thirtyDaysAgo && !t.transferId)
            .reduce((sum, t) => sum + convertToEur(t.amount, t.currency), 0);

          details = [
              { label: 'Checking', value: formatCurrency(checking, 'EUR'), icon: 'payments' },
              { label: 'Savings', value: formatCurrency(savings, 'EUR'), icon: 'savings' },
              { label: '30d Net Flow', value: (netFlow >= 0 ? '+' : '') + formatCurrency(netFlow, 'EUR'), icon: 'show_chart' },
          ];
      } else if (activeSegment === 'invested') {
          totalValue = accountsToSum.reduce((sum, acc) => sum + convertToEur(acc.balance, acc.currency), 0);
          label = 'Investment Value';
          subLabel = 'Market Value';
          
          const crypto = accountsToSum.filter(a => a.subType === 'Crypto').reduce((s, a) => s + convertToEur(a.balance, a.currency), 0);
          const stocks = accountsToSum.filter(a => ['Stock', 'ETF'].includes(a.subType || '')).reduce((s, a) => s + convertToEur(a.balance, a.currency), 0);

          details = [
               { label: 'Stocks & ETFs', value: formatCurrency(stocks, 'EUR'), icon: 'candlestick_chart' },
               { label: 'Crypto', value: formatCurrency(crypto, 'EUR'), icon: 'currency_bitcoin' },
               { label: 'Count', value: accountsToSum.length.toString(), icon: 'format_list_numbered' },
          ];
      } else if (activeSegment === 'property') {
          totalValue = accountsToSum.reduce((sum, acc) => sum + convertToEur(acc.balance, acc.currency), 0);
          label = 'Asset Value';
          subLabel = 'Current Market Value';

          // Calculate Debt linked to these properties
          const linkedLoanIds = new Set(accountsToSum.map(a => a.linkedLoanId).filter(Boolean));
          const linkedLoans = accounts.filter(a => linkedLoanIds.has(a.id));
          const { totalDebt } = calculateAccountTotals(linkedLoans, analyticsTransactions, loanPaymentOverrides);
          const equity = totalValue - totalDebt;

          details = [
              { label: 'Total Equity', value: formatCurrency(equity, 'EUR'), icon: 'pie_chart' },
              { label: 'Linked Debt', value: formatCurrency(totalDebt, 'EUR'), icon: 'link' },
              { label: 'Assets', value: accountsToSum.length.toString(), icon: 'home' },
          ];
      } else if (activeSegment === 'debt') {
           const { totalDebt } = calculateAccountTotals(accountsToSum, analyticsTransactions, loanPaymentOverrides);
           totalValue = totalDebt; 
           label = 'Total Liabilities';
           subLabel = 'Outstanding Balance';

           const ccDebt = accountsToSum.filter(a => a.type === 'Credit Card').reduce((sum, a) => sum + Math.abs(convertToEur(a.balance, a.currency)), 0);
           const loanDebt = totalDebt - ccDebt;

           details = [
               { label: 'Credit Cards', value: formatCurrency(ccDebt, 'EUR'), icon: 'credit_card' },
               { label: 'Loans', value: formatCurrency(loanDebt, 'EUR'), icon: 'real_estate_agent' },
               { label: 'Count', value: accountsToSum.length.toString(), icon: 'format_list_numbered' },
           ];
      }
      return { totalValue, label, subLabel, details };
  }, [filteredAccounts, activeSegment, globalMetrics, analyticsTransactions, loanPaymentOverrides, accounts]);

  const transactionsByAccount = useMemo(() => transactions.reduce((acc, transaction) => {
    (acc[transaction.accountId] = acc[transaction.accountId] || []).push(transaction);
    return acc;
  }, {} as Record<string, Transaction[]>), [transactions]);

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
  
  // Segment Pills config
  const segments: { id: AccountSegment; label: string; icon: string }[] = [
      { id: 'all', label: 'Overview', icon: 'dashboard' },
      { id: 'cash', label: 'Cash', icon: 'payments' },
      { id: 'invested', label: 'Invested', icon: 'trending_up' },
      { id: 'property', label: 'Assets', icon: 'home' },
      { id: 'debt', label: 'Liabilities', icon: 'credit_card' },
  ];

  const heroGradient = activeSegment === 'debt' 
    ? 'from-red-500 to-rose-600' 
    : activeSegment === 'cash' 
        ? 'from-blue-500 to-cyan-600'
        : activeSegment === 'invested'
            ? 'from-purple-500 to-indigo-600'
            : activeSegment === 'property'
                ? 'from-emerald-500 to-teal-600'
                : 'from-primary-600 to-primary-800'; // Default/All

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

      <PageHeader 
        markerIcon="account_balance" 
        markerLabel="Money Map" 
        title="Accounts" 
        subtitle="Manage your assets and liabilities with a unified, real-time portfolio view." 
        actions={<button onClick={() => setAddModalOpen(true)} className={`${BTN_PRIMARY_STYLE} flex items-center gap-2`}><span className="material-symbols-outlined text-xl">add</span>Add Account</button>} 
      />

      {/* --- Dynamic Wealth Console --- */}
      <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${heroGradient} text-white shadow-xl`}>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col xl:flex-row">
              {/* Main Total */}
              <div className="p-8 flex flex-col justify-between flex-1">
                  <div className="space-y-2">
                      <div className="flex items-center gap-2 text-white/80 text-xs font-bold uppercase tracking-widest">
                           <span className="material-symbols-outlined text-sm">
                               {activeSegment === 'debt' ? 'trending_down' : 'trending_up'}
                           </span>
                           {segmentMetrics.subLabel}
                      </div>
                      <div className="flex items-baseline gap-4">
                          <h2 className="text-5xl font-black tracking-tighter privacy-blur">{formatCurrency(segmentMetrics.totalValue, 'EUR')}</h2>
                      </div>
                      <p className="text-white/60 text-sm font-medium">{segmentMetrics.label}</p>
                  </div>
                  
                  {/* Sparkline */}
                   <div className="w-full h-24 mt-6 opacity-60">
                       <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={globalMetrics.trendData}>
                              <defs>
                                <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#ffffff" stopOpacity={0.4}/>
                                  <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <Area type="monotone" dataKey="value" stroke="#ffffff" strokeWidth={2} fillOpacity={1} fill="url(#colorTrend)" />
                          </AreaChart>
                       </ResponsiveContainer>
                   </div>
              </div>

              {/* Detail Metrics */}
              <div className="xl:w-1/3 p-6 bg-white/10 backdrop-blur-md border-t xl:border-t-0 xl:border-l border-white/10 flex flex-col justify-center gap-4">
                  {segmentMetrics.details.map((detail, index) => (
                      <div key={index} className="flex items-center gap-4 p-3 rounded-xl bg-black/10 hover:bg-black/20 transition-colors border border-white/5">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/10 text-white">
                              <span className="material-symbols-outlined text-lg">{detail.icon}</span>
                          </div>
                          <div>
                              <p className="text-xs text-white/60 uppercase tracking-wider font-bold mb-0.5">{detail.label}</p>
                              <p className="text-lg font-bold text-white privacy-blur">{detail.value}</p>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </div>

      {/* --- Segment Navigation & Controls --- */}
      <div className="flex flex-col xl:flex-row justify-between items-center gap-4 bg-white dark:bg-dark-card p-2 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm sticky top-4 z-10 backdrop-blur-md bg-opacity-90 dark:bg-opacity-90">
           {/* Segment Pills */}
           <div className="flex bg-light-fill dark:bg-dark-fill p-1 rounded-xl w-full xl:w-auto overflow-x-auto no-scrollbar">
                {segments.map(seg => (
                    <button
                        key={seg.id}
                        onClick={() => setActiveSegment(seg.id)}
                        className={`
                            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 whitespace-nowrap
                            ${activeSegment === seg.id 
                                ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400 scale-105' 
                                : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}
                        `}
                    >
                        <span className="material-symbols-outlined text-lg">{seg.icon}</span>
                        {seg.label}
                    </button>
                ))}
           </div>

           {/* View & Sort Controls */}
           <div className="flex items-center gap-3 w-full xl:w-auto justify-end px-1">
                <div className={`${SELECT_WRAPPER_STYLE} !w-auto`}>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className={`${SELECT_STYLE} !py-2 !text-sm pr-8`}>
                        <option value="manual">Sort: Manual</option>
                        <option value="name">Sort: Name</option>
                        <option value="balance">Sort: Balance</option>
                    </select>
                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined text-sm">expand_more</span></div>
                </div>
                
                <div className="flex bg-light-fill dark:bg-dark-fill p-1 rounded-lg">
                    <button onClick={() => setLayoutMode('columns')} className={`p-1.5 rounded-md transition-all ${layoutMode === 'columns' ? 'bg-white dark:bg-dark-card shadow text-primary-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}>
                        <span className="material-symbols-outlined text-xl">grid_view</span>
                    </button>
                    <button onClick={() => setLayoutMode('stacked')} className={`p-1.5 rounded-md transition-all ${layoutMode === 'stacked' ? 'bg-white dark:bg-dark-card shadow text-primary-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}>
                        <span className="material-symbols-outlined text-xl">view_list</span>
                    </button>
                </div>
           </div>
      </div>

      {/* --- Filtered Content --- */}
      <div className="space-y-8">
            {/* 
                We use AccountsListSection to render the filtered accounts. 
                We group accounts by type logic inside the section, but here we just pass the pre-filtered list.
                We disable "collapsible" for the segmented view to make it cleaner, unless 'All' is selected.
            */}
            <AccountsListSection 
                title={activeSegment === 'all' ? 'Your Portfolio' : `${segments.find(s => s.id === activeSegment)?.label} Accounts`}
                accounts={filteredAccounts} 
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
                isCollapsible={activeSegment === 'all'} 
                defaultExpanded={true}
                layoutMode={layoutMode} 
            />

            {/* Closed Accounts - Only show if relevant to filter or in All view */}
            {closedAccounts.length > 0 && activeSegment === 'all' && (
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
