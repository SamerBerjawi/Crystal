import React, { useEffect, useMemo, useState } from 'react';
import type { Account, AccountType, Currency } from '../../types';
import { useAccountsData } from '../../hooks/useAccountsData';
import {
  filterAccountsBySegment,
  filterAndSortAccounts,
  splitAssetsAndLiabilities,
  type AccountsPageSegment,
} from '../../utils/accountsModel';
import { newPathFor } from '../../utils/newRoutes';
import { debtFromBalance, safeAdd } from '../../utils';
import { usePageAction, usePageSearch, useShellNew } from '../../components/new/shellContext';
import {
  ActiveFilters,
  ChoiceChips,
  FilterButton,
  FilterSection,
  FilterSheet,
  FilterToggle,
  PageToolbar,
  ToolButton,
  ToolbarSpacer,
  type ActiveFilter,
} from '../../components/new/PageToolbar';
import { FilterList, type FilterOption } from '../../components/new/transactions/filters';
import { Button, Card, EmptyState, SegmentedTabs, type TabItem } from '../../components/new/ui';
import { confirmNew } from '../../components/new/ConfirmDialog';
import { AccountLogo } from '../../components/new/EntityIcon';
import { NvIcon } from '../../components/new/NvIcon';
import { toast } from '../../components/new/toast';
import { AccountFormSheet } from '../../components/new/accounts/AccountFormSheet';
import { AccountsHeroCard } from '../../components/new/accounts/overview';
import { AccountRowNew, BalanceSheetSplitView } from '../../components/new/accounts/parts';
import {
  AccountOverviewSheet,
  BalanceAdjustmentSheet,
} from '../../components/new/accounts/sheets';

/*
 * AccountsNew (`/accounts-new`): Balance-Sheet Cockpit (UI_UX_DESIGN_REFERENCE.md §5.2).
 * Built from first principles using pure domain models (`utils/accountsModel.ts`) and `nv-*` tokens.
 * One layout (the split sheet, assets beside liabilities). The segment tabs, the Filters button and the tools sit
 * under the hero, above the list they control (§21, N20 to N24); the header keeps only search and New account.
 */

type SortMode = 'manual' | 'balance' | 'name' | 'change30d' | 'apy_apr';

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'manual', label: 'Custom order' },
  { value: 'balance', label: 'Highest balance' },
  { value: 'change30d', label: '90d momentum' },
  { value: 'apy_apr', label: 'Highest APY / APR' },
  { value: 'name', label: 'Alphabetical (A–Z)' },
];

export const AccountsNew: React.FC = () => {
  const data = useAccountsData();
  const { navigate } = useShellNew();

  // State
  const [segment, setSegment] = useState<AccountsPageSegment>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortMode>(data.defaultSortBy || 'manual');
  const [currencyFilter, setCurrencyFilter] = useState<Currency | 'ALL'>('ALL');
  const [institutions, setInstitutions] = useState<string[]>([]);
  const [linkedOnly, setLinkedOnly] = useState(false);
  const [analyticsOnly, setAnalyticsOnly] = useState(false);

  // Sheet State
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [defaultFormType, setDefaultFormType] = useState<AccountType>('Checking');
  const [peekAccountId, setPeekAccountId] = useState<string | null>(null);
  const [reconcileAccount, setReconcileAccount] = useState<Account | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; account: Account } | null>(
    null
  );
  const contextMenuRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    const handleScroll = () => setContextMenu(null);

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [contextMenu]);

  const peekAccount = useMemo(
    () =>
      peekAccountId
        ? data.accounts.find((a) => a.id === peekAccountId) ??
          data.visibleAccounts.find((a) => a.id === peekAccountId) ??
          null
        : null,
    [peekAccountId, data.accounts, data.visibleAccounts]
  );

  // Segment Counts
  const segmentCounts = useMemo(() => {
    const segments: AccountsPageSegment[] = [
      'all',
      'cash_cards',
      'savings_yield',
      'loans_debt',
      'property_vehicles',
      'archived',
    ];
    const counts: Record<AccountsPageSegment, number> = {
      all: 0,
      cash_cards: 0,
      savings_yield: 0,
      loans_debt: 0,
      property_vehicles: 0,
      archived: 0,
    };
    for (const seg of segments) {
      counts[seg] = filterAccountsBySegment(data.visibleAccounts, seg).length;
    }
    return counts;
  }, [data.visibleAccounts]);

  // Filtered & Sorted Accounts
  const segmentedAccounts = useMemo(
    () => filterAccountsBySegment(data.visibleAccounts, segment),
    [data.visibleAccounts, segment]
  );

  const filteredAccounts = useMemo(
    () =>
      filterAndSortAccounts(segmentedAccounts, data.displayBalancesById, {
        search: searchQuery,
        currencyFilter,
        institutionFilter: institutions,
        linkedOnly,
        linkedAccountIds: data.linkedEnableBankingAccountIds,
        analyticsOnly,
        sortBy,
        accountOrder: data.accountOrder,
        sparklinesById: data.sparklinesById,
        conversionRates: data.conversionRates,
      }),
    [
      segmentedAccounts,
      data.displayBalancesById,
      searchQuery,
      currencyFilter,
      institutions,
      linkedOnly,
      data.linkedEnableBankingAccountIds,
      analyticsOnly,
      sortBy,
      data.accountOrder,
      data.sparklinesById,
      data.conversionRates,
    ]
  );

  const { assets, liabilities } = useMemo(
    () => splitAssetsAndLiabilities(filteredAccounts),
    [filteredAccounts]
  );

  const totalAssetsConverted = useMemo(
    () =>
      assets.reduce(
        (sum, a) => safeAdd(sum, data.convert(data.displayBalancesById[a.id] ?? a.balance, a.currency)),
        0
      ),
    [assets, data]
  );

  const totalLiabilitiesConverted = useMemo(
    () =>
      liabilities.reduce(
        (sum, a) =>
          safeAdd(sum, debtFromBalance(a, data.convert(data.displayBalancesById[a.id] ?? a.balance, a.currency))),
        0
      ),
    [liabilities, data]
  );

  // Header: the page's search and its one action.
  usePageSearch({
    value: searchQuery,
    onChange: setSearchQuery,
    placeholder: 'Search accounts, institutions, IBAN or plates…',
  });

  const openCreateSheet = (defaultType: AccountType = 'Checking') => {
    setEditingAccount(null);
    setDefaultFormType(defaultType);
    setFormOpen(true);
  };

  usePageAction({
    label: 'New account',
    icon: 'add',
    onClick: () => openCreateSheet('Checking'),
  });

  const openAccountDetail = (account: Account) => {
    navigate(newPathFor('AccountDetail', account.id));
  };

  const handleToggleStatus = (account: Account) => {
    const res = data.toggleAccountStatus(account.id);
    if (res) {
      toast.undo(
        res.nextStatus === 'closed'
          ? `Archived "${account.name}"`
          : `Reopened "${account.name}"`,
        res.undo
      );
    }
  };

  const handleDeleteWithConfirm = async (account: Account) => {
    const ok = await confirmNew({
      title: `Delete "${account.name}" permanently?`,
      message:
        'This will permanently remove the account and all of its associated transactions and schedules. To keep historical records, archive/close the account instead.',
      confirmLabel: 'Hold to delete',
      danger: true,
    });
    if (ok) {
      data.deleteAccount(account.id);
      toast.success(`Deleted "${account.name}"`);
    }
  };

  const handleMoveOrder = (account: Account, direction: -1 | 1, currentList: Account[]) => {
    const currentIds = currentList.map((a) => a.id);
    const idx = currentIds.indexOf(account.id);
    const targetIdx = idx + direction;
    if (idx < 0 || targetIdx < 0 || targetIdx >= currentIds.length) return;
    const baseOrder =
      data.accountOrder.length > 0
        ? [...data.accountOrder]
        : data.visibleAccounts.map((a) => a.id);
    for (const id of currentIds) {
      if (!baseOrder.includes(id)) baseOrder.push(id);
    }
    const aPos = baseOrder.indexOf(account.id);
    const bPos = baseOrder.indexOf(currentIds[targetIdx]);
    if (aPos < 0 || bPos < 0) return;
    const nextOrder = [...baseOrder];
    [nextOrder[aPos], nextOrder[bPos]] = [nextOrder[bPos], nextOrder[aPos]];
    const res = data.reorderAccounts(nextOrder);
    toast.undo(`Updated account order`, res.undo);
  };

  // Filters: what the Filters sheet holds. Search (the header) and sort are not counted.
  const activeFilterCount =
    (currencyFilter !== 'ALL' ? 1 : 0) + institutions.length + (linkedOnly ? 1 : 0) + (analyticsOnly ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0 || searchQuery.trim() !== '';

  const clearFilters = () => {
    setSearchQuery('');
    setCurrencyFilter('ALL');
    setInstitutions([]);
    setLinkedOnly(false);
    setAnalyticsOnly(false);
  };

  const activeFilters: ActiveFilter[] = [
    ...(searchQuery.trim() !== ''
      ? [{ key: 'search', label: `“${searchQuery.trim()}”`, icon: 'search' as const, onRemove: () => setSearchQuery('') }]
      : []),
    ...(currencyFilter !== 'ALL'
      ? [{ key: 'currency', label: currencyFilter, icon: 'money' as const, onRemove: () => setCurrencyFilter('ALL') }]
      : []),
    ...institutions.map((name) => ({
      key: `institution-${name}`,
      label: name,
      icon: 'bank' as const,
      onRemove: () => setInstitutions((list) => list.filter((x) => x !== name)),
    })),
    ...(linkedOnly
      ? [{ key: 'linked', label: 'Bank synced', icon: 'refresh' as const, onRemove: () => setLinkedOnly(false) }]
      : []),
    ...(analyticsOnly
      ? [{ key: 'analytics', label: 'Analytics included', icon: 'analytics' as const, onRemove: () => setAnalyticsOnly(false) }]
      : []),
  ];

  const institutionOptions = useMemo<FilterOption[]>(
    () =>
      data.institutions.map((name) => ({
        id: name,
        label: name,
        hint: String(
          data.visibleAccounts.filter((a) => (a.financialInstitution || '').trim() === name).length
        ),
      })),
    [data.institutions, data.visibleAccounts]
  );

  const segmentItems: TabItem<AccountsPageSegment>[] = [
    { id: 'all', label: `All (${segmentCounts.all})`, icon: 'wallet' },
    { id: 'cash_cards', label: `Cash & cards (${segmentCounts.cash_cards})`, icon: 'card' },
    { id: 'savings_yield', label: `Savings & yield (${segmentCounts.savings_yield})`, icon: 'piggy' },
    { id: 'loans_debt', label: `Loans & debt (${segmentCounts.loans_debt})`, icon: 'invoice' },
    { id: 'property_vehicles', label: `Property & vehicles (${segmentCounts.property_vehicles})`, icon: 'home' },
    ...(segmentCounts.archived > 0
      ? [{ id: 'archived' as const, label: `Archived (${segmentCounts.archived})`, icon: 'archive' as const }]
      : []),
  ];

  const renderAccountItem = (account: Account, idx: number, list: Account[]) => {
    const dispBal = data.displayBalancesById[account.id] ?? account.balance;
    const convBal = data.convert(dispBal, account.currency);
    const sparkline = data.sparklinesById[account.id];
    const canReorder = sortBy === 'manual';

    const itemProps = {
      account,
      displayBalance: dispBal,
      convertedBalance: convBal,
      displayCurrency: data.displayCurrency,
      sparkline,
      linkedLoan: data.linkedLoanByAssetId[account.id],
      linkedAsset: data.linkedAssetByLoanId[account.id],
      isLinkedBank: data.linkedEnableBankingAccountIds.has(account.id),
      onOpenDetail: openAccountDetail,
      onQuickPeek: (acc: Account) => setPeekAccountId(acc.id),
      onAdjustBalance: (acc: Account) => setReconcileAccount(acc),
      onEdit: (acc: Account) => {
        setEditingAccount(acc);
        setFormOpen(true);
      },
      onToggleStatus: handleToggleStatus,
      onMoveUp: canReorder && idx > 0 ? () => handleMoveOrder(account, -1, list) : undefined,
      onMoveDown:
        canReorder && idx < list.length - 1 ? () => handleMoveOrder(account, 1, list) : undefined,
      onContextMenu: (e: React.MouseEvent, acc: Account) => {
        setContextMenu({ x: e.clientX, y: e.clientY, account: acc });
      },
    };

    return <AccountRowNew key={account.id} {...itemProps} />;
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      {/* ── 1. Balance sheet hero ───────────────────────────────────────── */}
      {segment !== 'archived' && (
        <AccountsHeroCard
          hero={data.heroModel}
          displayCurrency={data.displayCurrency}
          activeSegment={segment}
          onSelectSegment={(targetSeg) => setSegment(targetSeg)}
          onSelectAttentionAccount={(accId) => {
            const acc = data.visibleAccounts.find((a) => a.id === accId);
            if (acc) setPeekAccountId(acc.id);
          }}
        />
      )}

      {/* ── 2. Segment tabs, the one Filters button and the tools, above the list they control (N21, N22) ── */}
      <div className="space-y-3">
        <SegmentedTabs<AccountsPageSegment>
          label="Account segments"
          value={segment}
          onChange={setSegment}
          items={segmentItems}
        />
        <PageToolbar>
          <FilterButton count={activeFilterCount} onClick={() => setFiltersOpen(true)} />
          <ToolbarSpacer />
          {data.linkedEnableBankingAccountIds.size > 0 && data.syncAllBanks && (
            <ToolButton
              variant="success"
              icon="refresh"
              label={data.isSyncingBanks ? 'Syncing…' : 'Sync banks'}
              disabled={data.isSyncingBanks}
              onClick={() => void data.syncAllBanks?.()}
            />
          )}
          <ToolButton icon="download" label="Export CSV" onClick={() => data.exportCsv(filteredAccounts)} />
        </PageToolbar>
        <ActiveFilters filters={activeFilters} onClearAll={clearFilters} />
      </div>

      {/* ── 3. Balance sheet: assets beside liabilities ─────────────────── */}
      {filteredAccounts.length === 0 ? (
        <Card>
          <EmptyState
            icon="wallet"
            title={hasActiveFilters ? 'No matching accounts' : 'No accounts in this segment'}
            body={
              hasActiveFilters
                ? 'Try clearing your search or filters.'
                : 'Create your first account to start tracking balances, net worth, and cashflow.'
            }
            action={
              hasActiveFilters ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Reset filters
                </Button>
              ) : (
                <Button variant="primary" icon="add" onClick={() => openCreateSheet('Checking')}>
                  Add account
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <BalanceSheetSplitView
          assets={assets}
          liabilities={liabilities}
          renderRow={(acc, idx, list) => renderAccountItem(acc, idx, list)}
          totalAssetsConverted={totalAssetsConverted}
          totalLiabilitiesConverted={totalLiabilitiesConverted}
          displayCurrency={data.displayCurrency}
          onAddAccount={(defaultType) => openCreateSheet(defaultType || 'Checking')}
          displayBalancesById={data.displayBalancesById}
          convert={data.convert}
          hideEmptySides={segment !== 'all' || hasActiveFilters}
        />
      )}

      <FilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        resultLabel={`Show ${filteredAccounts.length} ${filteredAccounts.length === 1 ? 'account' : 'accounts'}`}
        onReset={() => {
          clearFilters();
          setSortBy(data.defaultSortBy || 'manual');
        }}
      >
        <FilterSection title="Sort by">
          <ChoiceChips
            label="Sort by"
            options={SORT_OPTIONS.map((o) => ({ id: o.value, label: o.label }))}
            selected={[sortBy]}
            onChange={([id]) => setSortBy(id as SortMode)}
          />
        </FilterSection>
        {data.currencies.length > 1 && (
          <FilterSection title="Currency" count={currencyFilter !== 'ALL' ? 1 : 0}>
            <ChoiceChips
              label="Currency"
              options={[{ id: 'ALL', label: 'All' }, ...data.currencies.map((c) => ({ id: c, label: c }))]}
              selected={[currencyFilter]}
              onChange={([id]) => setCurrencyFilter(id as Currency | 'ALL')}
            />
          </FilterSection>
        )}
        {data.institutions.length > 1 && (
          <FilterSection title="Institutions" count={institutions.length}>
            <FilterList
              label="Institutions"
              options={institutionOptions}
              selected={institutions}
              onChange={setInstitutions}
              emptyText="No institutions yet."
            />
          </FilterSection>
        )}
        <FilterSection title="Show only">
          <div className="space-y-2">
            {data.linkedEnableBankingAccountIds.size > 0 && (
              <FilterToggle icon="refresh" label="Bank synced" checked={linkedOnly} onChange={setLinkedOnly} />
            )}
            <FilterToggle icon="analytics" label="Analytics included" checked={analyticsOnly} onChange={setAnalyticsOnly} />
          </div>
        </FilterSection>
      </FilterSheet>

      {/* ── Desktop Context Menu ─────────────────────────────────────── */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{
            left:
              typeof window !== 'undefined'
                ? Math.max(12, Math.min(contextMenu.x, window.innerWidth - 240))
                : contextMenu.x,
            top:
              typeof window !== 'undefined'
                ? Math.max(12, Math.min(contextMenu.y, window.innerHeight - 380))
                : contextMenu.y,
          }}
          className="crystal-new fixed z-popover min-w-56 rounded-nv-sub bg-nv-surface p-1.5 shadow-nv-float animate-in fade-in zoom-in-95 duration-100 select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2.5 px-3 py-2 border-b border-nv-line/50">
            <AccountLogo account={contextMenu.account} size={28} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-nv-ink">
                {contextMenu.account.name}
              </p>
              <p className="truncate text-xs text-nv-muted">
                {contextMenu.account.financialInstitution || contextMenu.account.type}
              </p>
            </div>
          </div>

          <div className="py-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const accId = contextMenu.account.id;
                setContextMenu(null);
                setTimeout(() => setPeekAccountId(accId), 50);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-nv-ink transition-colors hover:bg-nv-inset cursor-pointer"
            >
              <NvIcon name="view" size={15} className="text-nv-muted" />
              <span>Quick overview</span>
            </button>

            <button
              type="button"
              onClick={() => {
                openAccountDetail(contextMenu.account);
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-nv-ink transition-colors hover:bg-nv-inset cursor-pointer"
            >
              <NvIcon name="arrowUpRight" size={15} className="text-nv-muted" />
              <span>Open full cockpit</span>
            </button>

            <button
              type="button"
              onClick={() => {
                data.navigateToTransactions({ accountName: contextMenu.account.name });
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-nv-ink transition-colors hover:bg-nv-inset cursor-pointer"
            >
              <NvIcon name="invoice" size={15} className="text-nv-muted" />
              <span>Filter transactions</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setReconcileAccount(contextMenu.account);
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-nv-ink transition-colors hover:bg-nv-inset cursor-pointer"
            >
              <NvIcon name="refresh" size={15} className="text-nv-muted" />
              <span>Reconcile balance</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingAccount(contextMenu.account);
                setFormOpen(true);
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-nv-ink transition-colors hover:bg-nv-inset cursor-pointer"
            >
              <NvIcon name="edit" size={15} className="text-nv-muted" />
              <span>Edit account</span>
            </button>

            {sortBy === 'manual' && (
              <>
                <div className="my-1 h-px bg-nv-line/50" />
                <button
                  type="button"
                  onClick={() => {
                    handleMoveOrder(contextMenu.account, -1, filteredAccounts);
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-nv-ink transition-colors hover:bg-nv-inset cursor-pointer"
                >
                  <NvIcon name="sort" size={15} className="text-nv-muted" />
                  <span>Move up in order</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleMoveOrder(contextMenu.account, 1, filteredAccounts);
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-nv-ink transition-colors hover:bg-nv-inset cursor-pointer"
                >
                  <NvIcon name="arrowDown" size={15} className="text-nv-muted" />
                  <span>Move down in order</span>
                </button>
              </>
            )}

            <div className="my-1 h-px bg-nv-line/50" />

            <button
              type="button"
              onClick={() => {
                handleToggleStatus(contextMenu.account);
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-nv-ink transition-colors hover:bg-nv-inset cursor-pointer"
            >
              <NvIcon name="archive" size={15} className="text-nv-muted" />
              <span>
                {contextMenu.account.status === 'closed' ? 'Reopen Account' : 'Archive Account'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                const acc = contextMenu.account;
                setContextMenu(null);
                void handleDeleteWithConfirm(acc);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-nv-red-text transition-colors hover:bg-nv-red-soft cursor-pointer"
            >
              <NvIcon name="delete" size={15} />
              <span>Delete account</span>
            </button>
          </div>
        </div>
      )}

      {/* ── 4. Drawers & Sheets ─────────────────────────────────────────── */}
      <AccountFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        editingAccount={editingAccount}
        defaultType={defaultFormType}
        accounts={data.accounts}
        defaultCurrency={data.displayCurrency}
        onSave={data.saveAccount}
        onDelete={data.deleteAccount}
      />

      <AccountOverviewSheet
        open={!!peekAccount}
        onOpenChange={(open) => {
          if (!open) setPeekAccountId(null);
        }}
        account={peekAccount}
        displayBalance={
          peekAccount ? data.displayBalancesById[peekAccount.id] ?? peekAccount.balance : 0
        }
        realTodayBalance={
          peekAccount ? data.realTodayBalancesById[peekAccount.id] ?? peekAccount.balance : 0
        }
        displayCurrency={data.displayCurrency}
        convertedBalance={
          peekAccount
            ? data.convert(
                data.displayBalancesById[peekAccount.id] ?? peekAccount.balance,
                peekAccount.currency
              )
            : 0
        }
        transactions={data.transactions}
        isLinkedBank={
          peekAccount ? data.linkedEnableBankingAccountIds.has(peekAccount.id) : false
        }
        allAccounts={data.accounts}
        onOpenDetail={openAccountDetail}
        onEdit={(acc) => {
          setEditingAccount(acc);
          setFormOpen(true);
        }}
        onAdjustBalance={(acc) => setReconcileAccount(acc)}
        onToggleStatus={handleToggleStatus}
        onDelete={(acc) => {
          data.deleteAccount(acc.id);
          toast.success(`Deleted "${acc.name}"`);
        }}
        onNavigateToTransactions={(accountName) =>
          data.navigateToTransactions({ accountName })
        }
      />

      <BalanceAdjustmentSheet
        open={!!reconcileAccount}
        onOpenChange={(open) => {
          if (!open) setReconcileAccount(null);
        }}
        account={reconcileAccount}
        onAdjust={data.adjustBalance}
        getBalanceOnDate={data.getBalanceOnDate}
      />
    </div>
  );
};

export default AccountsNew;
