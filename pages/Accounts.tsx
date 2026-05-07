
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Account, Page, AccountType, Transaction, Warrant } from '../types';
import AddAccountModal from '../components/AddAccountModal';
import EditAccountModal from '../components/EditAccountModal';
import { ASSET_TYPES, DEBT_TYPES, BTN_PRIMARY_STYLE, ACCOUNT_TYPE_STYLES, BTN_SECONDARY_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, SELECT_STYLE, LIQUID_ACCOUNT_TYPES } from '../constants';
import { calculateAccountTotals, convertCurrency, convertToEur, formatCurrency, parseLocalDate, toLocalISOString } from '../utils';
import AccountsListSection from '../components/AccountsListSection';
import BalanceAdjustmentModal from '../components/BalanceAdjustmentModal';
import FinalConfirmationModal from '../components/FinalConfirmationModal';
import Card from '../components/Card';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useScheduleContext } from '../contexts/FinancialDataContext';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import PageHeader from '../components/PageHeader';
import { LineChart, Line, ResponsiveContainer, YAxis, AreaChart, Area } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

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
  const preferredCurrency = usePreferencesSelector(p => (p.currency || 'EUR') as any);
  const conversionRates = usePreferencesSelector(p => p.conversionRates);
  
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
              { label: 'Total Assets', value: formatCurrency(convertCurrency(globalMetrics.totalAssets, 'EUR', preferredCurrency, conversionRates), preferredCurrency), icon: 'account_balance' },
              { label: 'Total Liabilities', value: formatCurrency(convertCurrency(globalMetrics.totalDebt, 'EUR', preferredCurrency, conversionRates), preferredCurrency), icon: 'money_off' },
              { label: 'Liquid Cash', value: formatCurrency(convertCurrency(globalMetrics.liquidCash, 'EUR', preferredCurrency, conversionRates), preferredCurrency), icon: 'savings' },
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
              { label: 'Checking', value: formatCurrency(convertCurrency(checking, 'EUR', preferredCurrency, conversionRates), preferredCurrency), icon: 'payments' },
              { label: 'Savings', value: formatCurrency(convertCurrency(savings, 'EUR', preferredCurrency, conversionRates), preferredCurrency), icon: 'savings' },
              { label: '30d Net Flow', value: (netFlow >= 0 ? '+' : '') + formatCurrency(convertCurrency(netFlow, 'EUR', preferredCurrency, conversionRates), preferredCurrency), icon: 'show_chart' },
          ];
      } else if (activeSegment === 'invested') {
          totalValue = accountsToSum.reduce((sum, acc) => sum + convertToEur(acc.balance, acc.currency), 0);
          label = 'Investment Value';
          subLabel = 'Market Value';
          
          const crypto = accountsToSum.filter(a => a.subType === 'Crypto').reduce((s, a) => s + convertToEur(a.balance, a.currency), 0);
          const stocks = accountsToSum.filter(a => ['Stock', 'ETF'].includes(a.subType || '')).reduce((s, a) => s + convertToEur(a.balance, a.currency), 0);

          details = [
               { label: 'Stocks & ETFs', value: formatCurrency(convertCurrency(stocks, 'EUR', preferredCurrency, conversionRates), preferredCurrency), icon: 'candlestick_chart' },
               { label: 'Crypto', value: formatCurrency(convertCurrency(crypto, 'EUR', preferredCurrency, conversionRates), preferredCurrency), icon: 'currency_bitcoin' },
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
              { label: 'Total Equity', value: formatCurrency(convertCurrency(equity, 'EUR', preferredCurrency, conversionRates), preferredCurrency), icon: 'pie_chart' },
              { label: 'Linked Debt', value: formatCurrency(convertCurrency(totalDebt, 'EUR', preferredCurrency, conversionRates), preferredCurrency), icon: 'link' },
              { label: 'Assets', value: accountsToSum.length.toString(), icon: 'home' },
          ];
      } else if (activeSegment === 'debt') {
           const { totalDebt } = calculateAccountTotals(accountsToSum, analyticsTransactions, loanPaymentOverrides);
           totalValue = totalDebt; 
           label = 'Total Liabilities';
           subLabel = 'Outstanding Balance';

           const ccDebt = accountsToSum.filter(a => a.type === 'Credit Card').reduce((sum, a) => sum - convertToEur(a.balance, a.currency), 0);
           const loanDebt = totalDebt - ccDebt;

           details = [
               { label: 'Credit Cards', value: formatCurrency(convertCurrency(ccDebt, 'EUR', preferredCurrency, conversionRates), preferredCurrency), icon: 'credit_card' },
               { label: 'Loans', value: formatCurrency(convertCurrency(loanDebt, 'EUR', preferredCurrency, conversionRates), preferredCurrency), icon: 'real_estate_agent' },
               { label: 'Count', value: accountsToSum.length.toString(), icon: 'format_list_numbered' },
           ];
      }
      
      const finalValue = convertCurrency(totalValue, 'EUR', preferredCurrency, conversionRates);
      return { totalValue: finalValue, label, subLabel, details };
  }, [filteredAccounts, activeSegment, globalMetrics, analyticsTransactions, loanPaymentOverrides, accounts, preferredCurrency, conversionRates]);

  const segmentValues = useMemo(() => {
    const open = visibleAccounts.filter(acc => acc.status !== 'closed');
    const cash = open.filter(acc => LIQUID_ACCOUNT_TYPES.includes(acc.type)).reduce((sum, acc) => sum + convertToEur(acc.balance, acc.currency), 0);
    const invested = open.filter(acc => acc.type === 'Investment').reduce((sum, acc) => sum + convertToEur(acc.balance, acc.currency), 0);
    const property = open.filter(acc => acc.type === 'Property' || acc.type === 'Vehicle' || acc.type === 'Other Assets').reduce((sum, acc) => sum + convertToEur(acc.balance, acc.currency), 0);
    
    const debtAccounts = open.filter(acc => DEBT_TYPES.includes(acc.type));
    const { totalDebt } = calculateAccountTotals(debtAccounts, analyticsTransactions, loanPaymentOverrides);
    
    return {
      all: convertCurrency(globalMetrics.netWorth, 'EUR', preferredCurrency, conversionRates),
      cash: convertCurrency(cash, 'EUR', preferredCurrency, conversionRates),
      invested: convertCurrency(invested, 'EUR', preferredCurrency, conversionRates),
      property: convertCurrency(property, 'EUR', preferredCurrency, conversionRates),
      debt: convertCurrency(totalDebt, 'EUR', preferredCurrency, conversionRates)
    };
  }, [visibleAccounts, analyticsTransactions, loanPaymentOverrides, globalMetrics.netWorth, preferredCurrency, conversionRates]);

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
    ? 'from-rose-500 via-rose-600 to-pink-700' 
    : activeSegment === 'cash' 
        ? 'from-sky-500 via-blue-600 to-indigo-700'
        : activeSegment === 'invested'
            ? 'from-emerald-500 via-teal-600 to-cyan-700'
            : activeSegment === 'property'
                ? 'from-amber-500 via-orange-600 to-yellow-700'
                : 'from-indigo-600 via-violet-700 to-purple-800'; // Default/All

  return (
    <div className="relative">
      {/* Decorative Layered Background - Fixed and behind content */}
      <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-0 inset-x-0 h-[600px] bg-gradient-to-b from-blue-100/50 via-indigo-50/30 to-transparent dark:from-blue-900/20 dark:via-indigo-900/10 dark:to-transparent" />
      </div>

      <div className="relative z-10 space-y-6 pb-12 animate-fade-in-up">
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

        {/* --- Redesigned High-End Portfolio Header --- */}
        <div className="bg-white dark:bg-dark-card rounded-[2.5rem] p-8 border border-black/5 dark:border-white/5 shadow-sm overflow-hidden relative group">
            {/* Ambient Background Bloom */}
            <div className={`absolute -top-32 -left-32 w-80 h-80 blur-[100px] opacity-20 transition-colors duration-1000 bg-gradient-to-br ${heroGradient}`} />
            <div className="absolute -bottom-32 -right-32 w-80 h-80 blur-[100px] opacity-10 transition-colors duration-1000 bg-gradient-to-br from-primary-500 to-indigo-600" />

            <div className="relative z-10 flex flex-col xl:flex-row xl:items-center gap-10">
                {/* Main Net Worth Visual */}
                <div className="flex-1 space-y-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-60">Consolidated Net Worth</span>
                        </div>
                        <h2 className="text-5xl font-black tracking-tightest privacy-blur text-light-text dark:text-dark-text">
                            {formatCurrency(segmentValues.all, 'EUR')}
                        </h2>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
                            <p className="text-[9px] font-black uppercase tracking-widest text-light-text-secondary mb-1 opacity-60">Global Assets</p>
                            <p className="text-lg font-black tracking-tighter text-emerald-500 privacy-blur">{formatCurrency(segmentValues.cash + segmentValues.invested + segmentValues.property, 'EUR', { compact: true })}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
                            <p className="text-[9px] font-black uppercase tracking-widest text-light-text-secondary mb-1 opacity-60">Total Liabilities</p>
                            <p className="text-lg font-black tracking-tighter text-rose-500 privacy-blur">{formatCurrency(Math.abs(segmentValues.debt), 'EUR', { compact: true })}</p>
                        </div>
                    </div>
                </div>

                <div className="hidden xl:block w-px h-32 bg-black/5 dark:bg-white/10" />

                {/* Segment Selection - High Fidelity Tiles */}
                <div className="flex-[1.5] grid grid-cols-2 md:grid-cols-4 gap-4">
                    {segments.filter(s => s.id !== 'all').map(seg => {
                        const isActive = activeSegment === seg.id;
                        const val = segmentValues[seg.id as keyof typeof segmentValues];
                        return (
                            <div 
                                key={seg.id}
                                onClick={() => setActiveSegment(seg.id)}
                                className={`group cursor-pointer p-4 rounded-3xl transition-all duration-300 border ${isActive ? 'bg-black dark:bg-white text-white dark:text-black shadow-2xl shadow-black/20 dark:shadow-white/5 border-transparent scale-[1.02]' : 'bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/5 dark:hover:bg-white/5 border-black/5 dark:border-white/5 opacity-60 hover:opacity-100'}`}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isActive ? 'bg-white/20 text-white dark:text-black' : 'bg-black/5 dark:bg-white/5 text-light-text-secondary'}`}>
                                        <span className="material-symbols-outlined text-lg leading-none">{seg.icon}</span>
                                    </div>
                                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />}
                                </div>
                                <div className="space-y-0.5">
                                    <span className="text-[9px] font-black uppercase tracking-widest block truncate opacity-60">{seg.label}</span>
                                    <span className="text-md font-black tracking-tighter privacy-blur block truncate">
                                        {formatCurrency(val, 'EUR', { compact: true })}
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Integrated Details Tray */}
            <div className="mt-8 pt-8 border-t border-black/5 dark:border-white/5">
                <AnimatePresence mode="wait">
                    <motion.div 
                        key={activeSegment}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex flex-wrap items-center gap-x-12 gap-y-4"
                    >
                        {segmentMetrics.details.map((detail, i) => (
                             <div key={i} className="flex items-center gap-4 group/detail">
                                <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center group-hover/detail:bg-primary-500/10 transition-colors">
                                    <span className="material-symbols-outlined text-xl text-primary-500/60 group-hover/detail:text-primary-500 transition-colors">{detail.icon}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-light-text-secondary/60 mb-0.5 leading-none">{detail.label}</span>
                                    <span className="text-md font-black text-light-text dark:text-dark-text tracking-tight privacy-blur leading-none">{detail.value}</span>
                                </div>
                             </div>
                        ))}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>


        {/* --- Controls Bar --- */}
        <div className="flex flex-col xl:flex-row justify-between items-center gap-4 bg-white dark:bg-dark-card p-2 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm sticky top-4 z-20 backdrop-blur-md bg-opacity-90 dark:bg-opacity-90">
            <div className="flex items-center gap-2 px-3">
                <span className="material-symbols-outlined text-primary-500">filter_list</span>
                <span className="text-xs font-bold uppercase tracking-widest text-light-text-secondary">
                    Viewing: {segments.find(s => s.id === activeSegment)?.label}
                </span>
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
    </div>
  );
};

export default Accounts;
