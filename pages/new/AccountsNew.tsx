import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import type { Account, AccountType, Currency } from '../../types';
import { useAccountsData } from '../../hooks/useAccountsData';
import {
  filterAccountsBySegment,
  filterAndSortAccounts,
  groupAccountsByType,
  splitAssetsAndLiabilities,
  type AccountsPageSegment,
} from '../../utils/accountsModel';
import { newPathFor } from '../../utils/newRoutes';
import { debtFromBalance, safeAdd } from '../../utils';
import {
  HeaderControls,
  HeaderTools,
  usePageAction,
  usePageSearch,
  usePageTabs,
  useShellNew,
} from '../../components/new/shellContext';
import { FilterChip, PeriodPill } from '../../components/new/tile';
import { Button, Card, EmptyState, Money, SegmentedTabs } from '../../components/new/ui';
import { confirmNew } from '../../components/new/ConfirmDialog';
import { AccountLogo } from '../../components/new/EntityIcon';
import { NvIcon } from '../../components/new/NvIcon';
import { toast } from '../../components/new/toast';
import { AccountFormSheet } from '../../components/new/accounts/AccountFormSheet';
import { AccountsHeroCard, CardWalletRail } from '../../components/new/accounts/overview';
import {
  AccountCardNew,
  AccountRowNew,
  BalanceSheetSplitView,
} from '../../components/new/accounts/parts';
import {
  AccountOverviewSheet,
  BalanceAdjustmentSheet,
} from '../../components/new/accounts/sheets';

/*
 * AccountsNew (`/accounts-new`): Balance-Sheet Cockpit (UI_UX_DESIGN_REFERENCE.md §5.2).
 * Built from first principles using pure domain models (`utils/accountsModel.ts`) and `nv-*` tokens.
 */

type ViewMode = 'split' | 'list' | 'bento';
type SortMode = 'manual' | 'balance' | 'name' | 'change30d' | 'apy_apr';

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'manual', label: 'Custom Order' },
  { value: 'balance', label: 'Highest Balance' },
  { value: 'change30d', label: '90d Momentum' },
  { value: 'apy_apr', label: 'Highest APY / APR' },
  { value: 'name', label: 'Alphabetical (A–Z)' },
];

export const AccountsNew: React.FC = () => {
  const data = useAccountsData();
  const { navigate } = useShellNew();

  // State
  const [segment, setSegment] = useState<AccountsPageSegment>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortMode>(data.defaultSortBy || 'manual');
  const [currencyFilter, setCurrencyFilter] = useState<Currency | 'ALL'>('ALL');
  const [institutionFilter, setInstitutionFilter] = useState<string>('ALL');
  const [linkedOnly, setLinkedOnly] = useState(false);
  const [analyticsOnly, setAnalyticsOnly] = useState(false);

  // Sheet State
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
        institutionFilter,
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
      institutionFilter,
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

  const accountGroups = useMemo(
    () =>
      groupAccountsByType(
        filteredAccounts,
        data.displayBalancesById,
        data.convert,
        'all'
      ),
    [filteredAccounts, data.displayBalancesById, data.convert]
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

  // Header Registration
  usePageTabs<AccountsPageSegment>({
    label: 'Account segments',
    value: segment,
    onChange: (next) => {
      setSegment(next);
      if (next !== 'all' && viewMode === 'split') {
        setViewMode('list');
      } else if (next === 'all' && viewMode === 'list') {
        setViewMode('split');
      }
    },
    items: [
      { id: 'all', label: `All (${segmentCounts.all})`, icon: 'wallet' },
      { id: 'cash_cards', label: `Cash & Cards (${segmentCounts.cash_cards})`, icon: 'card', accent: 'violet' },
      { id: 'savings_yield', label: `Savings & Yield (${segmentCounts.savings_yield})`, icon: 'piggy', accent: 'green' },
      { id: 'loans_debt', label: `Loans & Debt (${segmentCounts.loans_debt})`, icon: 'invoice', accent: 'orange' },
      { id: 'property_vehicles', label: `Property & Vehicles (${segmentCounts.property_vehicles})`, icon: 'home', accent: 'sky' },
      ...(segmentCounts.archived > 0
        ? [{ id: 'archived' as const, label: `Archived (${segmentCounts.archived})`, icon: 'archive' as const }]
        : []),
    ],
  });

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

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    currencyFilter !== 'ALL' ||
    institutionFilter !== 'ALL' ||
    linkedOnly ||
    analyticsOnly;

  const clearFilters = () => {
    setSearchQuery('');
    setCurrencyFilter('ALL');
    setInstitutionFilter('ALL');
    setLinkedOnly(false);
    setAnalyticsOnly(false);
  };

  const renderAccountItem = (account: Account, idx: number, list: Account[], asCard = false) => {
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

    return asCard ? (
      <AccountCardNew key={account.id} {...itemProps} />
    ) : (
      <AccountRowNew key={account.id} {...itemProps} />
    );
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      {/* ── Top Header Tools (Sync, Export, View Switcher) ──────────────── */}
      <HeaderTools>
        <div className="flex items-center gap-2">
          {data.linkedEnableBankingAccountIds.size > 0 && data.syncAllBanks && (
            <Button
              variant="secondary"
              size="sm"
              icon="refresh"
              disabled={data.isSyncingBanks}
              onClick={() => void data.syncAllBanks?.()}
            >
              {data.isSyncingBanks ? 'Syncing…' : 'Sync Banks'}
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon="download"
            onClick={() => data.exportCsv(filteredAccounts)}
          >
            Export CSV
          </Button>
        </div>
      </HeaderTools>

      {/* ── Top Header Filter & Sort Controls ────────────────────────────── */}
      <HeaderControls>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <PeriodPill<SortMode>
              label="Sort"
              value={sortBy}
              onChange={setSortBy}
              options={SORT_OPTIONS}
            />

            {data.currencies.length > 1 && (
              <PeriodPill<Currency | 'ALL'>
                label="Currency"
                value={currencyFilter}
                onChange={setCurrencyFilter}
                options={[
                  { value: 'ALL', label: 'All Currencies' },
                  ...data.currencies.map((c) => ({ value: c, label: c })),
                ]}
              />
            )}

            {data.institutions.length > 1 && (
              <PeriodPill<string>
                label="Institution"
                value={institutionFilter}
                onChange={setInstitutionFilter}
                options={[
                  { value: 'ALL', label: 'All Institutions' },
                  ...data.institutions.map((inst) => ({ value: inst, label: inst })),
                ]}
              />
            )}

            {data.linkedEnableBankingAccountIds.size > 0 && (
              <FilterChip
                label="Bank Synced"
                icon="refresh"
                active={linkedOnly}
                onClick={() => setLinkedOnly((v) => !v)}
              />
            )}

            <FilterChip
              label="Analytics Included"
              active={analyticsOnly}
              onClick={() => setAnalyticsOnly((v) => !v)}
            />

            {hasActiveFilters && (
              <FilterChip label="Reset filters" onRemove={clearFilters} onClick={clearFilters} />
            )}
          </div>

          <SegmentedTabs<ViewMode>
            label="Layout view"
            size="sm"
            value={viewMode}
            onChange={setViewMode}
            items={[
              { id: 'split', label: 'Split Sheet', icon: 'columns' },
              { id: 'list', label: 'List', icon: 'list' },
              { id: 'bento', label: 'Bento Grid', icon: 'grid' },
            ]}
          />
        </div>
      </HeaderControls>

      {/* ── 1. Balance Sheet Hero Card ──────────────────────────────────── */}
      {segment !== 'archived' && (
        <AccountsHeroCard
          hero={data.heroModel}
          displayCurrency={data.displayCurrency}
          activeSegment={segment}
          onSelectSegment={(targetSeg) => setSegment(targetSeg)}
          onSelectAttentionAccount={(accId) => {
            const acc = data.visibleAccounts.find((a) => a.id === accId);
            if (acc) openAccountDetail(acc);
          }}
        />
      )}

      {/* ── 2. Card Wallet Rail (Checking, Savings, Credit Cards) ───────── */}
      {(segment === 'all' || segment === 'cash_cards') && data.cardWalletAccounts.length > 0 && (
        <CardWalletRail
          accounts={data.cardWalletAccounts}
          displayBalancesById={data.displayBalancesById}
          realTodayBalancesById={data.realTodayBalancesById}
          linkedEnableBankingIds={data.linkedEnableBankingAccountIds}
          onOpenAccount={openAccountDetail}
        />
      )}

      {/* ── 3. Main Balance Sheet Accounts View ─────────────────────────── */}
      {filteredAccounts.length === 0 ? (
        <Card>
          <EmptyState
            icon="wallet"
            title={hasActiveFilters ? 'No matching accounts' : 'No accounts in this segment'}
            body={
              hasActiveFilters
                ? 'Try clearing your active search or filter pills.'
                : 'Create your first account to start tracking balances, net worth, and cashflow.'
            }
            action={
              hasActiveFilters ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Reset Filters
                </Button>
              ) : (
                <Button variant="cta" icon="add" onClick={() => openCreateSheet('Checking')}>
                  Add Account
                </Button>
              )
            }
          />
        </Card>
      ) : viewMode === 'split' ? (
        <BalanceSheetSplitView
          assets={assets}
          liabilities={liabilities}
          renderRow={(acc, idx, list) => renderAccountItem(acc, idx, list, false)}
          totalAssetsConverted={totalAssetsConverted}
          totalLiabilitiesConverted={totalLiabilitiesConverted}
          displayCurrency={data.displayCurrency}
          onAddAccount={(defaultType) => openCreateSheet(defaultType || 'Checking')}
          displayBalancesById={data.displayBalancesById}
          convert={data.convert}
        />
      ) : viewMode === 'bento' ? (
        <div className="space-y-6">
          {accountGroups.map((group, gIdx) => (
            <section
              key={group.key}
              className={cn('space-y-3', gIdx > 0 && 'border-t border-nv-line/50 pt-5')}
            >
              {/* Group Header */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-nv-surface text-nv-ink shadow-sm">
                    <NvIcon name={group.icon} size={15} />
                  </span>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-nv-ink">{group.label}</h3>
                    <span className="rounded-full bg-nv-surface px-2.5 py-0.5 text-xs font-medium text-nv-muted shadow-sm">
                      {group.accounts.length}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wider text-nv-muted">Subtotal</p>
                  <Money amount={group.subtotal} currency={data.displayCurrency} size="md" />
                </div>
              </div>

              {/* Bento Grid under this group */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.accounts.map((acc, idx) =>
                  renderAccountItem(acc, idx, group.accounts, true)
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {accountGroups.map((group) => (
            <Card key={group.key} className="space-y-3">
              {/* Group Header */}
              <div className="flex items-center justify-between border-b border-nv-line/50 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-nv-inset text-nv-ink">
                    <NvIcon name={group.icon} size={15} />
                  </span>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-nv-ink">{group.label}</h3>
                    <span className="rounded-full bg-nv-inset px-2 py-0.5 text-[11px] font-medium text-nv-muted">
                      {group.accounts.length}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wider text-nv-muted">Subtotal</p>
                  <Money amount={group.subtotal} currency={data.displayCurrency} className="text-sm font-semibold" />
                </div>
              </div>

              {/* Rows in this group */}
              <div className="space-y-2">
                {group.accounts.map((acc, idx) =>
                  renderAccountItem(acc, idx, group.accounts, false)
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

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
          className="crystal-new fixed z-popover min-w-56 rounded-nv-tile border border-nv-line/60 bg-nv-surface p-1.5 shadow-nv-float animate-in fade-in zoom-in-95 duration-100 select-none"
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
              <span>Quick Overview</span>
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
              <span>Open Full Cockpit</span>
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
              <span>Filter Transactions</span>
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
              <span>Reconcile Balance</span>
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
              <span>Edit Account</span>
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
                  <span>Move Up in Order</span>
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
                  <span>Move Down in Order</span>
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
              <span>Delete Account</span>
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
