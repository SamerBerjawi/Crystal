import React, { useState, useMemo, useEffect } from 'react';
import { Account, Page, AccountType, Transaction } from '../types';
import AddAccountModal from '../components/AddAccountModal';
import EditAccountModal from '../components/EditAccountModal';
import { ASSET_TYPES, DEBT_TYPES, BTN_PRIMARY_STYLE, ACCOUNT_TYPE_STYLES, BTN_SECONDARY_STYLE } from '../constants';
import { calculateAccountTotals, convertToEur, formatCurrency } from '../utils';
import Card from '../components/Card';
import AccountBreakdownCard from '../components/AccountBreakdownCard';
import AccountRow from '../components/AccountRow';
import BalanceAdjustmentModal from '../components/BalanceAdjustmentModal';

interface AccountsProps {
    accounts: Account[];
    transactions: Transaction[];
    setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
    setCurrentPage: (page: Page) => void;
    setAccountFilter: (accountName: string | null) => void;
    onStartConnection: () => void;
    setViewingAccountId: (id: string) => void;
    saveTransaction: (transactions: (Omit<Transaction, 'id'> & { id?: string })[], idsToDelete?: string[]) => void;
}

// A new component for the list section
const AccountsListSection: React.FC<{
    title: string;
    accounts: Account[];
    transactions: Transaction[];
    onAccountClick: (id: string) => void;
    onEditClick: (account: Account) => void;
    onAdjustBalanceClick: (account: Account) => void;
}> = ({ title, accounts, transactions, onAccountClick, onEditClick, onAdjustBalanceClick }) => {
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    const groupedAccounts = useMemo(() => accounts.reduce((acc, account) => {
        (acc[account.type] = acc[account.type] || []).push(account);
        return acc;
    }, {} as Record<AccountType, Account[]>), [accounts]);

    const groupOrder = useMemo(() => Object.keys(groupedAccounts).sort(), [groupedAccounts]);

    useEffect(() => {
        // Default all groups to open
        const initialExpanded: Record<string, boolean> = {};
        groupOrder.forEach(key => initialExpanded[key] = true);
        setExpandedGroups(initialExpanded);
    }, [groupOrder]);

    const toggleGroup = (groupName: string) => setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));

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

const Accounts: React.FC<AccountsProps> = ({ accounts, transactions, setAccounts, setCurrentPage, setAccountFilter, onStartConnection, setViewingAccountId, saveTransaction }) => {
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isAdjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustingAccount, setAdjustingAccount] = useState<Account | null>(null);


  // --- Data Processing ---
  const { assetAccounts, debtAccounts, totalAssets, totalDebt, assetBreakdown, debtBreakdown } = useMemo(() => {
    const assets = accounts.filter(acc => ASSET_TYPES.includes(acc.type));
    const debts = accounts.filter(acc => DEBT_TYPES.includes(acc.type));

    const { totalAssets, totalDebt } = calculateAccountTotals(accounts);

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


  const handleAddAccount = (account: Omit<Account, 'id'>) => { setAccounts(prev => [...prev, { ...account, id: new Date().toISOString() }]); setAddModalOpen(false); };
  const handleUpdateAccount = (updatedAccount: Account) => { setAccounts(prev => prev.map(acc => acc.id === updatedAccount.id ? updatedAccount : acc)); setEditModalOpen(false); setEditingAccount(null); };
  const handleDeleteAccount = (accountId: string) => { setAccounts(prev => prev.filter(acc => acc.id !== accountId)); setEditModalOpen(false); setEditingAccount(null); }

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
          <button onClick={onStartConnection} className={BTN_SECONDARY_STYLE}>Link Bank Account</button>
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
        />
        <AccountsListSection 
            title="Liability Accounts" 
            accounts={debtAccounts}
            transactions={transactions}
            onAccountClick={handleAccountClick}
            onEditClick={openEditModal}
            onAdjustBalanceClick={openAdjustModal}
        />
      </div>
    </div>
  );
};

export default Accounts;