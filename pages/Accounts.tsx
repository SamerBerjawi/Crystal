import React, { useState, useMemo, useEffect } from 'react';
import { Account, Page, AccountType, Transaction } from '../types';
import AddAccountModal from '../components/AddAccountModal';
import EditAccountModal from '../components/EditAccountModal';
import { ASSET_TYPES, DEBT_TYPES, BTN_PRIMARY_STYLE, ACCOUNT_TYPE_STYLES, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE } from '../constants';
import { calculateAccountTotals, convertToEur, formatCurrency } from '../utils';
import Card from '../components/Card';
import AccountBreakdownCard from '../components/AccountBreakdownCard';
import AccountRow from '../components/AccountRow';
import BalanceAdjustmentModal from '../components/BalanceAdjustmentModal';
import useLocalStorage from '../hooks/useLocalStorage';

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
}

// A new component for the list section
const AccountsListSection: React.FC<{
    title: string;
    accounts: Account[];
    transactions: Transaction[];
    onAccountClick: (id: string) => void;
    onEditClick: (account: Account) => void;
    onAdjustBalanceClick: (account: Account) => void;
    sortBy: 'name' | 'balance' | 'manual';
    accountOrder: string[];
    setAccountOrder: React.Dispatch<React.SetStateAction<string[]>>;
}> = ({ title, accounts, transactions, onAccountClick, onEditClick, onAdjustBalanceClick, sortBy, accountOrder, setAccountOrder }) => {
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
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

    return (
        <section>
            <h3 className="text-2xl font-bold text-light-text dark:text-dark-text mb-4">{title}</h3>
            <Card className="p-0">
                <div className="divide-y divide-light-separator dark:divide-dark-separator">
                    {groupOrder.length > 0 ? groupOrder.map(groupName => {
                        const accountsInGroup = groupedAccounts[groupName as AccountType];
                        const groupTotal = accountsInGroup.reduce((sum, acc) => sum + convertToEur(acc.balance, acc.currency), 0);
                        return (
                            <div key={groupName} className="py-2 px-4">
                                <div onClick={() => toggleGroup(groupName)} className="flex justify-between items-center py-2 cursor-pointer">
                                    <div className="flex items-center gap-2">
                                        <span className={`material-symbols-outlined transition-transform duration-200 ${expandedGroups[groupName] ? 'rotate-90' : ''}`}>chevron_right</span>
                                        <h4 className="font-semibold text-light-text dark:text-dark-text">{groupName} ({accountsInGroup.length})</h4>
                                    </div>
                                    <span className="font-mono text-sm">{formatCurrency(groupTotal, 'EUR')}</span>
                                </div>
                                {expandedGroups[groupName] && (
                                    <div className="mt-2 space-y-1">
                                        {accountsInGroup.map(acc => (
                                        <AccountRow
                                            key={acc.id}
                                            account={acc}
                                            transactions={transactions.filter(t => t.accountId === acc.id)}
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
                                        />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    }) : (
                        <div className="text-center py-8 text-light-text-secondary dark:text-dark-text-secondary">
                            <p>No {title.toLowerCase()} found.</p>
                        </div>
                    )}
                </div>
            </Card>
        </section>
    );
};

const Accounts: React.FC<AccountsProps> = ({ accounts, transactions, saveAccount, deleteAccount, setCurrentPage, setAccountFilter, setViewingAccountId, saveTransaction, accountOrder, setAccountOrder }) => {
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isAdjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustingAccount, setAdjustingAccount] = useState<Account | null>(null);
  const [sortBy, setSortBy] = useLocalStorage<'name' | 'balance' | 'manual'>('finaura-accounts-sortby', 'manual');


  // --- Data Processing ---
  const { assetAccounts, debtAccounts, totalAssets, totalDebt, assetBreakdown, debtBreakdown } = useMemo(() => {
    const safeAccounts = accounts || [];
    const assets = safeAccounts.filter(acc => ASSET_TYPES.includes(acc.type));
    const debts = safeAccounts.filter(acc => DEBT_TYPES.includes(acc.type));

    const { totalAssets, totalDebt } = calculateAccountTotals(safeAccounts);

    const colorClassToHex: { [key: string]: string } = {
        'text-blue-500': '#3b82f6', 'text-green-500': '#22c55e', 'text-orange-500': '#f97316',
        'text-purple-500': '#8b5cf6', 'text-red-500': '#ef4444', 'text-yellow-500': '#eab308',
        'text-amber-500': '#f59e0b', 'text-cyan-500': '#06b6d4', 'text-lime-500': '#84cc16', 'text-pink-500': '#ec4899',
    };

    const createBreakdown = (accs: Account[]) => {
        const grouped = accs.reduce((acc, account) => {
            const group = acc[account.type] || { value: 0, color: colorClassToHex[ACCOUNT_TYPE_STYLES[account.type]?.color] || '#A0AEC0' };
            group.value += convertToEur(account.balance, account.currency);
            acc[account.type] = group;
            return acc;
        }, {} as Record<AccountType, { value: number, color: string }>);
        
        return Object.entries(grouped).map(([name, data]) => ({ name, value: Math.abs(data.value), color: data.color })).filter(item => item.value > 0);
    };

    return {
        assetAccounts: assets,
        debtAccounts: debts,
        totalAssets,
        totalDebt,
        assetBreakdown: createBreakdown(assets),
        debtBreakdown: createBreakdown(debts),
    };
  }, [accounts]);
  

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

    const txData = {
        accountId: adjustingAccount.id,
        date,
        description: 'Balance Adjustment',
        merchant: notes || 'Manual balance correction',
        amount: adjustmentAmount,
        category: adjustmentAmount >= 0 ? 'Income' : 'Miscellaneous',
        type: adjustmentAmount >= 0 ? 'income' as 'income' : 'expense' as 'expense',
        currency: adjustingAccount.currency,
    };
    
    saveTransaction([txData]);
    closeAdjustModal();
  };


  const handleAddAccount = (account: Omit<Account, 'id'>) => { saveAccount(account); setAddModalOpen(false); };
  const handleUpdateAccount = (updatedAccount: Account) => { saveAccount(updatedAccount); setEditModalOpen(false); setEditingAccount(null); };
  const handleDeleteAccount = (accountId: string) => { deleteAccount(accountId); setEditModalOpen(false); setEditingAccount(null); }

  return (
    <div className="space-y-8">
      {isAddModalOpen && <AddAccountModal onClose={() => setAddModalOpen(false)} onAdd={handleAddAccount} accounts={accounts} />}
      {isEditModalOpen && editingAccount && <EditAccountModal onClose={() => setEditModalOpen(false)} onSave={handleUpdateAccount} onDelete={handleDeleteAccount} account={editingAccount} accounts={accounts} />}
      {isAdjustModalOpen && adjustingAccount && (
        <BalanceAdjustmentModal
            onClose={closeAdjustModal}
            onSave={handleSaveAdjustment}
            account={adjustingAccount}
        />
      )}

      <header className="flex flex-wrap justify-between items-center gap-4">
        <div>
          
          <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Manage your financial accounts and connections.</p>
        </div>
        <div className="flex items-center gap-4">
            <div className={`${SELECT_WRAPPER_STYLE} w-48`}>
                <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className={INPUT_BASE_STYLE}>
                    <option value="manual">Sort: Manual</option>
                    <option value="name">Sort: Name (A-Z)</option>
                    <option value="balance">Sort: Balance (High-Low)</option>
                </select>
                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
            </div>
          <button onClick={() => setAddModalOpen(true)} className={BTN_PRIMARY_STYLE}>Add Manual Account</button>
        </div>
      </header>

      {/* Summary Cards */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AccountBreakdownCard title="Assets" totalValue={totalAssets} breakdownData={assetBreakdown} />
        <AccountBreakdownCard title="Liabilities" totalValue={Math.abs(totalDebt)} breakdownData={debtBreakdown} />
      </section>

      {/* Account Lists */}
      <div className="space-y-8">
        <AccountsListSection 
            title="Asset Accounts" 
            accounts={assetAccounts}
            transactions={transactions}
            onAccountClick={handleAccountClick}
            onEditClick={openEditModal}
            onAdjustBalanceClick={openAdjustModal}
            sortBy={sortBy}
            accountOrder={accountOrder}
            setAccountOrder={setAccountOrder}
        />
        <AccountsListSection 
            title="Liability Accounts" 
            accounts={debtAccounts}
            transactions={transactions}
            onAccountClick={handleAccountClick}
            onEditClick={openEditModal}
            onAdjustBalanceClick={openAdjustModal}
            sortBy={sortBy}
            accountOrder={accountOrder}
            setAccountOrder={setAccountOrder}
        />
      </div>
    </div>
  );
};

export default Accounts;