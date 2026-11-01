
import React, { useState, useMemo } from 'react';
import { Account, Page, AccountType, Transaction, Warrant } from '../types';
import AccountForm from '../components/AccountForm';
import { calculateAccountTotals, convertCurrency, convertToEur, formatCurrency } from '../utils';
import {
  accountHasCard,
  accountsInTab,
  computeCashSegmentNetFlow,
  getVisibleAccountsForAccountsPage,
  type AccountsTab,
} from '../utils/accountsModel';
import AccountsListSection from '../components/AccountsListSection';
import AccountPot from '../components/AccountPot';
import CardsWallet from '../components/CardsWallet';
import BalanceAdjustmentModal from '../components/BalanceAdjustmentModal';
import AccountOverviewModal from '../components/AccountOverviewModal';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useScheduleContext } from '../contexts/FinancialDataContext';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import PageHeader from '../components/PageHeader';
import { Button, IconButton } from '../components/ui/Actions';
import { Radio, RadioGroup } from '../components/ui/Fields';
import { ConfirmDialog, Popover } from '../components/ui/Overlays';
import { Select } from '../components/ui/Pickers';
import { EmptyState } from '../components/ui/States';
import { useUrlTab } from '../hooks/useUrlTab';
import { useIsMobile } from '../hooks/useIsMobile';

interface AccountsProps {
    accounts: Account[];
    transactions: Transaction[];
    saveAccount: (account: Omit<Account, 'id'> & { id?: string }) => void;
    deleteAccount: (accountId: string) => void;
    setCurrentPage: (page: Page) => void;
    setViewingAccountId: (id: string | null) => void;
    onViewAccount?: (id: string) => void;
    saveTransaction: (transactions: (Omit<Transaction, 'id'> & { id?: string })[], idsToDelete?: string[]) => void;
    accountOrder?: string[];
    setAccountOrder?: React.Dispatch<React.SetStateAction<string[]>>;
    initialSortBy: 'name' | 'balance' | 'manual';
    warrants: Warrant[];
    onToggleAccountStatus: (accountId: string) => void;
    onNavigateToTransactions: (filters?: { accountName?: string | null }) => void;
    linkedEnableBankingAccountIds: Set<string>;
    onSyncBanks?: () => void;
    isSyncingBanks?: boolean;
}

const Accounts: React.FC<AccountsProps> = ({ accounts, transactions, saveAccount, deleteAccount, setCurrentPage, setViewingAccountId, onViewAccount, saveTransaction, accountOrder, setAccountOrder, initialSortBy, warrants, onToggleAccountStatus, onNavigateToTransactions, linkedEnableBankingAccountIds, onSyncBanks, isSyncingBanks }) => {
  const isMobile = useIsMobile();
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isAdjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustingAccount, setAdjustingAccount] = useState<Account | null>(null);
  const [overviewAccount, setOverviewAccount] = useState<Account | null>(null);
  const [isOverviewModalOpen, setIsOverviewModalOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [viewStyle, setViewStyle] = useLocalStorage<'detailed' | 'minimal'>('crystal_accounts_view_style', 'detailed');
  const [sortBy, setSortBy] = useState<'name' | 'balance' | 'manual'>(initialSortBy);
  const { loanPaymentOverrides } = useScheduleContext();
  const preferredCurrency = usePreferencesSelector(p => (p.currency || 'EUR') as any);
  const conversionRates = usePreferencesSelector(p => p.conversionRates);
  const brandfetchClientId = usePreferencesSelector(p => p.brandfetchClientId);
  const merchantLogoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides);
  
  const urlTab = useUrlTab();
  const activeTab = (['accounts', 'loans', 'assets'].includes(urlTab ?? '') ? urlTab : 'cards') as AccountsTab;
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const visibleAccounts = useMemo(
    () => getVisibleAccountsForAccountsPage(accounts),
    [accounts]
  );

  // --- Metrics Calculation ---
  const analyticsAccounts = useMemo(() => visibleAccounts.filter(acc => acc.includeInAnalytics ?? true), [visibleAccounts]);
  const analyticsAccountIds = useMemo(() => new Set(analyticsAccounts.map(acc => acc.id)), [analyticsAccounts]);
  const analyticsTransactions = useMemo(
    () => transactions.filter(tx => analyticsAccountIds.has(tx.accountId)),
    [transactions, analyticsAccountIds]
  );

  const openAccounts = useMemo(() => visibleAccounts.filter(acc => acc.status !== 'closed'), [visibleAccounts]);
  const tabAccounts = useMemo(() => accountsInTab(openAccounts, activeTab), [openAccounts, activeTab]);
  const closedAccounts = useMemo(() => visibleAccounts.filter(acc => acc.status === 'closed'), [visibleAccounts]);

  const toDisplay = (eur: number) => convertCurrency(eur, 'EUR', preferredCurrency, conversionRates);

  const summary = useMemo(() => {
    const countable = tabAccounts.filter(acc => acc.includeInAnalytics ?? true);
    const totals = calculateAccountTotals(countable, analyticsTransactions, loanPaymentOverrides);
    const money = (eur: number) => formatCurrency(toDisplay(eur), preferredCurrency);
    const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

    switch (activeTab) {
      case 'accounts':
        return `${money(totals.netWorth)} across ${plural(countable.length, 'account')}, with ${money(computeCashSegmentNetFlow(countable, transactions, 30, { conversionRates }))} net flow over 30 days.`;
      case 'loans':
        return `${money(Math.abs(totals.totalDebt))} still to pay across ${plural(countable.length, 'loan')}.`;
      case 'assets':
        return `${money(totals.totalAssets)} across ${plural(countable.length, 'asset')}.`;
      default: {
        const credit = countable.filter(acc => acc.type === 'Credit Card');
        const owed = calculateAccountTotals(credit, analyticsTransactions, loanPaymentOverrides).totalDebt;
        return `${plural(countable.length, 'card')}${credit.length ? `, with ${money(Math.abs(owed))} owed on credit` : ''}.`;
      }
    }
  }, [tabAccounts, activeTab, analyticsTransactions, loanPaymentOverrides, transactions, conversionRates, preferredCurrency]);

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

  const openOverviewModal = (account: Account) => {
    setOverviewAccount(account);
    setIsOverviewModalOpen(true);
  };

  const handleAccountRowCardClick = (accountId: string) => {
    const acc = accounts.find(a => a.id === accountId);
    if (acc) {
      openOverviewModal(acc);
    } else {
      handleAccountClick(accountId);
    }
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

  const handleConfirmDelete = () => { if (deletingAccount) { deleteAccount(deletingAccount.id); setDeletingAccount(null); } };


  const menuFor = (account: Account) => {
    const isComputed = account.type === 'Investment' && !!account.symbol && warrants.some(w => w.isin === account.symbol);
    return [
      { id: 'overview', label: 'Quick overview', icon: 'visibility', onAction: () => openOverviewModal(account) },
      { id: 'open', label: 'Open account', icon: 'open_in_new', onAction: () => handleAccountClick(account.id) },
      { id: 'transactions', label: 'See transactions', icon: 'receipt', onAction: () => onNavigateToTransactions({ accountName: account.name }) },
      { id: 'edit', label: 'Edit', icon: 'edit', startsGroup: true, onAction: () => openEditModal(account) },
      { id: 'adjust', label: 'Adjust balance', icon: 'tune', isDisabled: isComputed, onAction: () => openAdjustModal(account) },
      { id: 'delete', label: 'Delete', icon: 'delete', isDestructive: true, startsGroup: true, onAction: () => setDeletingAccount(account) },
    ];
  };

  const section = (title: string, list: Account[], options: { isCollapsible?: boolean; defaultExpanded?: boolean } = {}) => (
    <AccountsListSection
      title={title}
      accounts={list}
      transactionsByAccount={transactionsByAccount}
      linkedEnableBankingAccountIds={linkedEnableBankingAccountIds}
      onAccountClick={handleAccountRowCardClick}
      menuFor={menuFor}
      onEditClick={openEditModal}
      onAdjustBalanceClick={openAdjustModal}
      onOverviewClick={openOverviewModal}
      sortBy={sortBy}
      accountOrder={accountOrder}
      setAccountOrder={setAccountOrder}
      layoutMode="stacked"
      viewStyle="minimal"
      {...options}
    />
  );

  const potNote = (account: Account) => {
    const linked = accounts.filter(acc => acc.settlementAccountId === account.id && acc.status !== 'closed').map(acc => acc.name);
    if (accountHasCard(account)) linked.unshift(account.name);
    if (linked.length) return `${linked.length} ${linked.length === 1 ? 'card spends' : 'cards spend'} from here: ${linked.join(', ')}.`;
    return account.notes;
  };

  const sortedPots = useMemo(() => {
    const list = [...tabAccounts];
    if (sortBy === 'name') return list.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'balance') return list.sort((a, b) => convertToEur(b.balance, b.currency) - convertToEur(a.balance, a.currency));
    return list.sort((a, b) => accountOrder.indexOf(a.id) - accountOrder.indexOf(b.id));
  }, [tabAccounts, sortBy, accountOrder]);

  const viewOptions = (
    <div className="flex w-64 flex-col gap-4 max-md:w-full">
      <Select label="Sort by" options={[{ id: 'manual', label: 'Your order' }, { id: 'name', label: 'Name' }, { id: 'balance', label: 'Balance' }]} value={sortBy} onChange={id => setSortBy(id as typeof sortBy)} />
      {!isMobile && (
        <RadioGroup label="Show as" value={viewStyle} onChange={value => setViewStyle(value as typeof viewStyle)}>
          <Radio value="detailed">Pots</Radio>
          <Radio value="minimal">Rows, to reorder</Radio>
        </RadioGroup>
      )}
    </div>
  );

  const showPots = !isMobile && viewStyle === 'detailed';

  return (
    <div className="space-y-6">
      {isAddModalOpen && <AccountForm accounts={accounts} onClose={() => setAddModalOpen(false)} onSave={saveAccount} />}
      {isEditModalOpen && editingAccount && <AccountForm account={editingAccount} accounts={accounts} warrants={warrants} onClose={() => { setEditModalOpen(false); setEditingAccount(null); }} onSave={saveAccount} onDelete={() => setDeletingAccount(editingAccount)} onToggleStatus={onToggleAccountStatus} />}
      {isAdjustModalOpen && adjustingAccount && <BalanceAdjustmentModal onClose={() => setAdjustingAccount(null)} onSave={handleSaveAdjustment} account={adjustingAccount} />}
      {isOverviewModalOpen && overviewAccount && (
        <AccountOverviewModal
          isOpen={isOverviewModalOpen}
          onClose={() => setIsOverviewModalOpen(false)}
          account={overviewAccount}
          transactions={transactionsByAccount[overviewAccount.id] || []}
          accounts={accounts}
          warrants={warrants}
          onViewAccount={handleAccountClick}
          onEditAccount={openEditModal}
          onAdjustBalance={openAdjustModal}
          onNavigateToTransactions={onNavigateToTransactions}
        />
      )}
      <ConfirmDialog
        isOpen={!!deletingAccount}
        onClose={() => setDeletingAccount(null)}
        onConfirm={handleConfirmDelete}
        title={`Delete ${deletingAccount?.name ?? 'account'}?`}
        message="This permanently removes the account and all its transactions. You can't undo it."
        confirmLabel="Delete account"
        requireText={deletingAccount?.name ?? ''}
        isDestructive
      />

      <PageHeader
        title="Accounts"
        subtitle={summary}
        actions={
          <>
            {activeTab !== 'cards' && (
              <Popover title="View options" placement="bottom end" trigger={<IconButton icon="tune" label="View options" tooltipPlacement="bottom" />}>
                {viewOptions}
              </Popover>
            )}
            <Button icon="add" onPress={() => setAddModalOpen(true)}>Add account</Button>
          </>
        }
      />

      {activeTab === 'cards' ? (
        <CardsWallet
          cards={tabAccounts}
          accounts={accounts}
          transactionsByAccount={transactionsByAccount}
          selectedId={selectedCardId}
          onSelect={setSelectedCardId}
          menuFor={menuFor}
          onOpen={handleAccountClick}
          onSeeTransactions={account => onNavigateToTransactions({ accountName: account.name })}
          onAddCard={() => setAddModalOpen(true)}
        />
      ) : tabAccounts.length === 0 ? (
        <EmptyState icon="wallet" title="Nothing here yet" description="Accounts of this kind appear here." actionLabel="Add account" onAction={() => setAddModalOpen(true)} />
      ) : showPots ? (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {sortedPots.map(account => (
            <AccountPot
              key={account.id}
              account={account}
              transactions={transactionsByAccount[account.id] || []}
              context={`${account.type}${account.financialInstitution ? `, ${account.financialInstitution}` : ''}`}
              note={potNote(account)}
              menuItems={menuFor(account)}
              onOpen={() => handleAccountClick(account.id)}
            />
          ))}
        </div>
      ) : section('', tabAccounts)}

      {activeTab === 'assets' && openAccounts.some(acc => acc.type === 'Investment') && (
        <Button variant="ghost" icon="nav_investments" onPress={() => setCurrentPage('Investments')}>Investments are in their own hub</Button>
      )}

      {accountsInTab(closedAccounts, activeTab).length > 0 && section('Closed', accountsInTab(closedAccounts, activeTab), { isCollapsible: true, defaultExpanded: false })}
    </div>
  );
};

export default Accounts;
