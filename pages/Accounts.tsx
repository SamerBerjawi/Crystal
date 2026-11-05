
import React, { useState, useMemo } from 'react';
import { Account, Page, AccountType, Transaction, Warrant } from '../types';
import AccountForm from '../components/AccountForm';
import { calculateAccountTotals, convertCurrency, convertToMain, getMainCurrency } from '../utils';
import {
  accountHasCard,
  accountsInTab,
  computeAccountDisplayBalance,
  computeAccountsHeroModel,
  computeCashSegmentNetFlow,
  getVisibleAccountsForAccountsPage,
  type AccountsTab,
} from '../utils/accountsModel';
import AccountsListSection from '../components/AccountsListSection';
import AccountPot from '../components/AccountPot';
import CardsWallet from '../components/CardsWallet';
import BalanceAdjustmentModal from '../components/BalanceAdjustmentModal';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useScheduleContext } from '../contexts/FinancialDataContext';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import PageHeader, { type PageStat, type StatTone } from '../components/PageHeader';
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
    setCurrentPage: (page: Page, tab?: string | null) => void;
    setViewingAccountId: (id: string | null) => void;
    onViewAccount?: (id: string, tab?: string) => void;
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

  const toDisplay = (eur: number) => convertCurrency(eur, getMainCurrency(), preferredCurrency, conversionRates);

  const stats = useMemo<PageStat[]>(() => {
    const countable = tabAccounts.filter(acc => acc.includeInAnalytics ?? true);
    const totals = calculateAccountTotals(countable, analyticsTransactions, loanPaymentOverrides);
    const money = (label: string, icon: string, eur: number, iconTone?: StatTone): PageStat => ({ label, icon, value: toDisplay(eur), format: 'money', currency: preferredCurrency, iconTone });
    const count = (label: string, icon: string, value: number, iconTone?: StatTone): PageStat => ({ label, icon, value, iconTone });

    switch (activeTab) {
      case 'accounts':
        return [money('Total balance', 'wallet-02', totals.netWorth), money('Net this month', 'chart-line-data-01', computeCashSegmentNetFlow(countable, transactions, 30, { conversionRates })), count('Accounts', 'bank', tabAccounts.length)];
      case 'loans':
        return [money('Still to pay', 'coins-01', Math.abs(totals.totalDebt)), count('Loans', 'bank', tabAccounts.length)];
      case 'assets':
        return [money('Total value', 'home-01', totals.totalAssets), count('Assets', 'layers-01', tabAccounts.length)];
      default: {
        const credit = countable.filter(acc => acc.type === 'Credit Card');
        const owed = calculateAccountTotals(credit, analyticsTransactions, loanPaymentOverrides).totalDebt;
        return [count('Cards', 'credit-card', tabAccounts.length, 'teal'), money('Owed on credit', 'coins-01', Math.abs(owed), 'rose')];
      }
    }
  }, [tabAccounts, activeTab, analyticsTransactions, loanPaymentOverrides, transactions, conversionRates, preferredCurrency]);

  const transactionsByAccount = useMemo(() => transactions.reduce((acc, transaction) => {
    (acc[transaction.accountId] = acc[transaction.accountId] || []).push(transaction);
    return acc;
  }, {} as Record<string, Transaction[]>), [transactions]);

  const handleAccountClick = (accountId: string) => {
    const tab = activeTab !== 'cards' ? activeTab : undefined;
    if (onViewAccount) {
      onViewAccount(accountId, tab);
    } else {
      setViewingAccountId(accountId);
      setCurrentPage('AccountDetail', tab);
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

  const handleConfirmDelete = () => { if (deletingAccount) { deleteAccount(deletingAccount.id); setDeletingAccount(null); } };


  const menuFor = (account: Account) => {
    const isComputed = account.type === 'Investment' && !!account.symbol && warrants.some(w => w.isin === account.symbol);
    return [
      { id: 'open', label: 'Open account', icon: 'link-square-02', onAction: () => handleAccountClick(account.id) },
      { id: 'transactions', label: 'See transactions', icon: 'arrow-data-transfer-horizontal', onAction: () => onNavigateToTransactions({ accountName: account.name }) },
      { id: 'edit', label: 'Edit', icon: 'pencil-edit-02', startsGroup: true, onAction: () => openEditModal(account) },
      { id: 'adjust', label: 'Adjust balance', icon: 'sliders-horizontal', isDisabled: isComputed, onAction: () => openAdjustModal(account) },
      { id: 'delete', label: 'Delete', icon: 'delete-02', isDestructive: true, startsGroup: true, onAction: () => setDeletingAccount(account) },
    ];
  };

  const section = (title: string, list: Account[], options: { isCollapsible?: boolean; defaultExpanded?: boolean } = {}) => (
    <AccountsListSection
      title={title}
      accounts={list}
      transactionsByAccount={transactionsByAccount}
      linkedEnableBankingAccountIds={linkedEnableBankingAccountIds}
      onAccountClick={handleAccountClick}
      menuFor={menuFor}
      onEditClick={openEditModal}
      onAdjustBalanceClick={openAdjustModal}
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
    if (sortBy === 'balance') {
      const balOf = (acc: Account) => computeAccountDisplayBalance(acc, transactionsByAccount[acc.id] || [], loanPaymentOverrides, { conversionRates });
      return list.sort((a, b) => convertToMain(balOf(b), b.currency) - convertToMain(balOf(a), a.currency));
    }
    return list.sort((a, b) => (accountOrder || []).indexOf(a.id) - (accountOrder || []).indexOf(b.id));
  }, [tabAccounts, sortBy, accountOrder, transactionsByAccount, loanPaymentOverrides, conversionRates]);

  const attentionItems = useMemo(() => {
    const tabIds = new Set(tabAccounts.map(a => a.id));
    return computeAccountsHeroModel(accounts, transactions, loanPaymentOverrides, preferredCurrency, { conversionRates })
      .attentionItems.filter(item => tabIds.has(item.accountId))
      .slice(0, 3);
  }, [accounts, transactions, loanPaymentOverrides, preferredCurrency, conversionRates, tabAccounts]);

  const sortedCards = useMemo(() => {
    const list = [...tabAccounts];
    if (!accountOrder || accountOrder.length === 0) return list;
    return list.sort((a, b) => {
      const aIndex = accountOrder.indexOf(a.id);
      const bIndex = accountOrder.indexOf(b.id);
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [tabAccounts, accountOrder]);

  const handleReorderCards = (activeId: string, overId: string) => {
    if (!setAccountOrder || activeId === overId) return;
    const base = accountOrder && accountOrder.length > 0 ? [...accountOrder] : accounts.map(a => a.id);
    accounts.forEach(a => {
      if (!base.includes(a.id)) base.push(a.id);
    });
    const fromIndex = base.indexOf(activeId);
    const targetIndex = base.indexOf(overId);
    if (fromIndex === -1 || targetIndex === -1) return;
    base.splice(fromIndex, 1);
    const newTargetIndex = base.indexOf(overId);
    const insertIndex = fromIndex > targetIndex ? newTargetIndex : newTargetIndex + 1;
    base.splice(insertIndex, 0, activeId);
    setAccountOrder(base);
  };

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
        stats={stats}
        actions={
          <>
            {activeTab !== 'cards' && (
              <Popover title="View options" placement="bottom end" trigger={<IconButton icon="sliders-horizontal" label="View options" tooltipPlacement="bottom" />}>
                {viewOptions}
              </Popover>
            )}
            <Button icon="add-01" onPress={() => setAddModalOpen(true)}>Add account</Button>
          </>
        }
      />

      {attentionItems.length > 0 && (
        <section aria-label="Attention" className="surface-card rounded-[var(--radius-xl)] border border-amber/40 bg-amber-soft p-4">
          <p className="type-label text-attention-text">Needs attention</p>
          <ul className="mt-1.5 divide-y divide-line">
            {attentionItems.map(item => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <button type="button" onClick={() => handleAccountClick(item.accountId)} className="min-w-0 flex-1 cursor-pointer text-left">
                  <span className="type-body-strong block truncate text-ink">{item.title}</span>
                  <span className="type-caption block truncate text-muted">{item.subtitle}</span>
                </button>
                <span className="type-figure-row shrink-0 text-ink">{item.metricLabel}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeTab === 'cards' ? (
        <CardsWallet
          cards={sortedCards}
          accounts={accounts}
          transactionsByAccount={transactionsByAccount}
          selectedId={selectedCardId}
          onSelect={setSelectedCardId}
          menuFor={menuFor}
          onOpen={handleAccountClick}
          onSeeTransactions={account => onNavigateToTransactions({ accountName: account.name })}
          onAddCard={() => setAddModalOpen(true)}
          onReorder={handleReorderCards}
        />
      ) : tabAccounts.length === 0 ? (
        <EmptyState icon="wallet-02" title="Nothing here yet" description="Accounts of this kind appear here." actionLabel="Add account" onAction={() => setAddModalOpen(true)} />
      ) : showPots ? (
        <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <Button variant="ghost" icon="chart-line-data-01" onPress={() => setCurrentPage('Investments')}>Investments are in their own hub</Button>
      )}

      {accountsInTab(closedAccounts, activeTab).length > 0 && section('Closed', accountsInTab(closedAccounts, activeTab), { isCollapsible: true, defaultExpanded: false })}
    </div>
  );
};

export default Accounts;
