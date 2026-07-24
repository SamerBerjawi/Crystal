
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
import { MobileAccountsView } from '../components/MobileAccountsView';
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
  const [splitAssetsLiabilities, setSplitAssetsLiabilities] = useLocalStorage<boolean>('crystal_split_assets_liabilities', true);
  const [viewStyle, setViewStyle] = useLocalStorage<'detailed' | 'minimal'>('crystal_accounts_view_style', 'detailed');
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
          // Hide all investment accounts from accounts page to show on investments page instead
          if (acc.type === 'Investment') {
              return false;
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

      for (let i = 0; i < 90; i++) {
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
          
          // Calculate 90-day net flow for cash accounts
          const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 90);
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
        isBalanceAdjustment: true,
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
      <div className="relative z-10 space-y-6 pb-12 animate-fade-in-up">
        {isAddModalOpen && <AddAccountModal onClose={() => setAddModalOpen(false)} onAdd={handleAddAccount} accounts={accounts} />}
        {isEditModalOpen && editingAccount && <EditAccountModal onClose={() => setEditModalOpen(false)} onSave={handleUpdateAccount} onDelete={(accountId) => { setEditModalOpen(false); setDeletingAccount(editingAccount);}} account={editingAccount} accounts={accounts} warrants={warrants} onToggleStatus={onToggleAccountStatus} />}
        {isAdjustModalOpen && adjustingAccount && <BalanceAdjustmentModal onClose={() => setAdjustingAccount(null)} onSave={handleSaveAdjustment} account={adjustingAccount} />}
        {deletingAccount && <FinalConfirmationModal isOpen={!!deletingAccount} onClose={() => setDeletingAccount(null)} onConfirm={handleConfirmDelete} title="Delete Account" message={<><p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">You are about to permanently delete the account <strong className="text-light-text dark:text-dark-text">{deletingAccount.name}</strong>.</p><div className="p-3 bg-red-500/10 rounded-lg text-red-700 dark:text-red-300 text-sm"><p className="font-bold">This action cannot be undone.</p><p>All associated transactions will also be permanently deleted.</p></div></>} requiredText="DELETE" confirmButtonText="Delete Account" />}
        
        {contextMenu && (
            <div ref={contextMenuRef} style={{ top: contextMenu.y, left: contextMenu.x }} className="fixed z-50 w-56 ios-regular rounded-lg shadow-lg border border-black/10 dark:border-white/10 py-2 animate-fade-in-up">
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

        {/* Mobile View */}
        <MobileAccountsView
          accounts={accounts}
          transactions={transactions}
          globalMetrics={globalMetrics}
          segmentValues={segmentValues}
          activeSegment={activeSegment}
          setActiveSegment={setActiveSegment}
          filteredAccounts={filteredAccounts}
          closedAccounts={closedAccounts}
          transactionsByAccount={transactionsByAccount}
          warrants={warrants}
          linkedEnableBankingAccountIds={linkedEnableBankingAccountIds}
          onAccountClick={handleAccountClick}
          onEditClick={openEditModal}
          onAdjustBalanceClick={openAdjustModal}
          onAddAccountClick={() => setAddModalOpen(true)}
          preferredCurrency={preferredCurrency}
          conversionRates={conversionRates}
          sortBy={sortBy}
          setSortBy={setSortBy}
          splitAssetsLiabilities={splitAssetsLiabilities}
          setSplitAssetsLiabilities={setSplitAssetsLiabilities}
        />

        {/* Desktop View */}
        <div className="hidden md:block space-y-6">
          <PageHeader 
              markerIcon="account_balance_wallet"
              markerLabel="Portfolio Overview"
              title="Accounts & Portfolio"
              subtitle="Track your liquid capital, property valuations, debt obligations and investments in a single place to calculate real-time net worth."
          />

        {/* --- Consolidated Header & Portfolio --- */}
        <div className="bg-white dark:bg-dark-card rounded-3xl p-4 sm:p-6 border border-black/5 dark:border-white/5 shadow-sm overflow-hidden relative group">
            {/* Subtle background glow based on active segment */}
            <div className={`absolute -top-24 -right-24 w-64 h-64 blur-3xl opacity-20 transition-colors duration-1000 bg-gradient-to-br ${heroGradient}`} />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-start justify-between gap-4 lg:gap-8">
                {/* Left Side: Portfolio Display */}
                <div className="flex flex-col xl:flex-row xl:items-center gap-4 lg:gap-8 flex-1 min-w-0">
                    <div className="flex items-center justify-between sm:block w-full sm:w-auto">
                        <div 
                            onClick={() => setActiveSegment('all')}
                            className="cursor-pointer group/nw min-w-0"
                        >
                            <div className="flex items-center gap-2 mb-1 sm:mb-2">
                                <span className="material-symbols-outlined text-primary-500 text-sm">account_balance_wallet</span>
                                <span className="text-[10px] font-semibold tracking-wider text-light-text-secondary dark:text-dark-text-secondary">Portfolio Value</span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <h2 className="text-xl sm:text-3xl lg:text-4xl font-bold tracking-tight privacy-blur text-light-text dark:text-dark-text group-hover/nw:text-primary-500 transition-colors">
                                    {formatCurrency(segmentValues.all, 'EUR')}
                                </h2>
                                {activeSegment === 'all' && (
                                    <motion.div layoutId="active-indicator" className="w-1.5 h-1.5 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                                )}
                            </div>
                        </div>

                        {/* Mobile Add Account Button right next to Portfolio Value */}
                        <div className="sm:hidden shrink-0">
                            <button 
                                onClick={() => setAddModalOpen(true)} 
                                className={`${BTN_PRIMARY_STYLE} !py-1.5 !px-3 !text-xs !rounded-xl flex items-center gap-1`}
                            >
                                <span className="material-symbols-outlined text-sm">add</span>
                                <span>Add Account</span>
                            </button>
                        </div>
                    </div>

                    {/* Compact Sparkline - hidden on mobile */}
                    <div className="hidden sm:block h-6 mt-2 sm:mt-3 opacity-40 group-hover/nw:opacity-80 transition-opacity max-w-[150px] sm:max-w-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={globalMetrics.trendData}>
                                <Area 
                                    type="monotone" 
                                    dataKey="value" 
                                    stroke={activeSegment === 'all' ? "#6366f1" : "#94a3b8"} 
                                    strokeWidth={2} 
                                    fill="transparent" 
                                    animationDuration={2000}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="hidden xl:block w-px h-16 bg-black/5 dark:bg-white/10" />

                    {/* Segment Grid - High Density Tiles - scrollable on mobile */}
                    <div className="flex-1 lg:flex-[2] flex overflow-x-auto lg:grid lg:grid-cols-4 gap-2 sm:gap-4 pb-1 lg:pb-0 no-scrollbar snap-x snap-mandatory max-w-full">
                        {segments.filter(s => s.id !== 'all').map(seg => {
                            const isActive = activeSegment === seg.id;
                            const val = segmentValues[seg.id as keyof typeof segmentValues];
                            return (
                                <div 
                                    key={seg.id}
                                    onClick={() => setActiveSegment(seg.id)}
                                    className={`group cursor-pointer p-2.5 sm:p-4 rounded-xl sm:rounded-2xl transition-all border shrink-0 sm:shrink lg:shrink-0 w-[120px] sm:w-auto snap-start ${isActive ? 'bg-primary-500/5 border-primary-500/20' : 'hover:bg-black/5 dark:hover:bg-white/5 border-transparent bg-black/[0.01] dark:bg-white/[0.01]'}`}
                                >
                                    <div className="flex items-center justify-between mb-1 sm:mb-1.5">
                                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-primary-500/10 text-primary-500' : 'bg-gray-100 dark:bg-white/5 text-light-text-secondary'}`}>
                                            <span className="material-symbols-outlined text-base sm:text-lg">{seg.icon}</span>
                                        </div>
                                        {isActive && <motion.div layoutId="active-indicator" className="w-1.5 h-1.5 rounded-full bg-primary-500 shadow-[0_0_6px_rgba(99,102,241,0.8)]" />}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className={`text-[9px] sm:text-[10px] font-semibold tracking-wider ${isActive ? 'text-primary-500' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>{seg.label}</span>
                                        <span className={`text-sm sm:text-lg font-bold tracking-tight privacy-blur ${isActive ? 'text-light-text dark:text-dark-text' : 'text-light-text-secondary group-hover:text-light-text dark:group-hover:text-dark-text'}`}>
                                            {formatCurrency(val, 'EUR')}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Main Action - Add Account - hidden on mobile */}
                <div className="hidden sm:block shrink-0">
                    <button 
                        onClick={() => setAddModalOpen(true)} 
                        className={`${BTN_PRIMARY_STYLE} flex items-center gap-2 group/add`}
                    >
                        <span className="material-symbols-outlined text-xl transition-transform group-hover/add:rotate-90">add</span>
                        <span className="hidden sm:inline">Add Account</span>
                    </button>
                </div>
            </div>

            {/* Integrated Details Tray & Controls */}
            <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-black/5 dark:border-white/5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <AnimatePresence mode="wait">
                    <motion.div 
                        key={activeSegment}
                        initial={{ opacity: 0, x: -1 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 1 }}
                        className="hidden sm:flex flex-wrap items-center gap-x-8 gap-y-3"
                    >
                        {segmentMetrics.details.map((detail, i) => (
                             <div key={i} className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary-500/5 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-base text-primary-500/70">{detail.icon}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black tracking-widest text-light-text-secondary/70">{detail.label}</span>
                                    <span className="text-sm font-black text-light-text dark:text-dark-text privacy-blur">{detail.value}</span>
                                </div>
                             </div>
                        ))}
                    </motion.div>
                </AnimatePresence>

                {/* Consolidated Controls */}
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex bg-light-fill dark:bg-dark-fill p-1 rounded-xl items-center text-[10px] font-semibold tracking-widest text-light-text-secondary dark:text-dark-text-secondary gap-0.5 overflow-x-auto no-scrollbar max-w-full">
                        <button onClick={() => setSplitAssetsLiabilities(true)} className={`flex items-center gap-1.5 p-1.5 px-3 rounded-lg transition-all shrink-0 ${splitAssetsLiabilities ? 'bg-white dark:bg-dark-card shadow-sm text-primary-500' : 'hover:text-primary-500'}`} title="Split Assets & Liabilities">
                            <span className="material-symbols-outlined text-[16px]">vertical_split</span>
                            <span className="hidden md:inline">Split</span>
                        </button>
                        <button onClick={() => setSplitAssetsLiabilities(false)} className={`flex items-center gap-1.5 p-1.5 px-3 rounded-lg transition-all shrink-0 ${!splitAssetsLiabilities ? 'bg-white dark:bg-dark-card shadow-sm text-primary-500' : 'hover:text-primary-500'}`} title="Combined View">
                            <span className="material-symbols-outlined text-[16px]">view_agenda</span>
                            <span className="hidden md:inline">Combined</span>
                        </button>
                    </div>

                    <div className={`${SELECT_WRAPPER_STYLE} !w-auto h-9`}>
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className={`${SELECT_STYLE} !py-1 !text-[10px] !font-semibold pr-8 h-full bg-light-fill dark:bg-dark-fill border-none rounded-xl`}>
                            <option value="manual">Sort: Manual</option>
                            <option value="name">Sort: Name</option>
                            <option value="balance">Sort: Balance</option>
                        </select>
                        <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined text-sm">expand_more</span></div>
                    </div>
                    
                    <div className="flex bg-light-fill dark:bg-dark-fill p-1 rounded-xl gap-0.5">
                        <button onClick={() => setViewStyle('detailed')} className={`p-1.5 rounded-lg transition-all ${viewStyle === 'detailed' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`} title="Standard Cards">
                            <span className="material-symbols-outlined text-[18px]">style</span>
                        </button>
                        <button onClick={() => setViewStyle('minimal')} className={`p-1.5 rounded-lg transition-all ${viewStyle === 'minimal' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`} title="Minimalist Rows">
                            <span className="material-symbols-outlined text-[18px]">density_medium</span>
                        </button>
                    </div>

                    <div className="flex bg-light-fill dark:bg-dark-fill p-1 rounded-xl gap-0.5">
                        <button onClick={() => setLayoutMode('columns')} className={`p-1.5 rounded-lg transition-all ${layoutMode === 'columns' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`} title="Grid Layout">
                            <span className="material-symbols-outlined text-[18px]">grid_view</span>
                        </button>
                        <button onClick={() => setLayoutMode('stacked')} className={`p-1.5 rounded-lg transition-all ${layoutMode === 'stacked' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`} title="List Layout">
                            <span className="material-symbols-outlined text-[18px]">view_list</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>


        {/* --- Multi-Column Accounts View --- */}
        {splitAssetsLiabilities ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {/* Assets Column */}
                <div className="space-y-8">
                    <AccountsListSection 
                        title="Assets"
                        headerIcon={<div className="w-10 h-10 rounded-2xl bg-primary-500/10 flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-primary-500">account_balance</span></div>}
                        headerSubtitle="Wealth & Resources"
                        accounts={filteredAccounts.filter(acc => ASSET_TYPES.includes(acc.type))} 
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
                        defaultExpanded={true}
                        layoutMode={layoutMode} 
                        showCollapseAll={true}
                        viewStyle={viewStyle}
                    />
                </div>

                {/* Liabilities Column */}
                <div className="space-y-8">
                    <AccountsListSection 
                        title="Liabilities"
                        headerIcon={<div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-rose-500">money_off</span></div>}
                        headerSubtitle="Debts & Obligations"
                        accounts={filteredAccounts.filter(acc => DEBT_TYPES.includes(acc.type))} 
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
                        defaultExpanded={true}
                        layoutMode={layoutMode} 
                        showCollapseAll={true}
                        viewStyle={viewStyle}
                    />
                </div>
            </div>
        ) : (
            <div className="space-y-8">
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
                    isCollapsible={false} 
                    defaultExpanded={true}
                    layoutMode={layoutMode} 
                    showCollapseAll={true}
                    viewStyle={viewStyle}
                />
            </div>
        )}

        {/* --- Closed Accounts - Only show if relevant to filter or in All view --- */}
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
                    viewStyle={viewStyle}
                />
            </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default Accounts;
