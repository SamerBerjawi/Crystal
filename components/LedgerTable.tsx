import React, { useRef, useState } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import type { Account, Category, DisplayTransaction, Tag } from '../types';
import { convertToMain, getMainCurrency } from '../utils';
import { getCategoryDetails } from '../utils/categories';
import { adaptColorForTheme } from './EntityIcon';
import { accountIcon } from './AccountCard';
import { useIsDark } from '../hooks/useIsDark';
import SwipeableRow from './SwipeableRow';
import Icon from './ui/Icon';
import { IconButton } from './ui/Actions';
import { Badge, DayGroup } from './ui/Display';
import { Checkbox } from './ui/Fields';
import { Menu, PointerMenu, type MenuAction } from './ui/Menu';
import { Amount } from './ui/Money';
import { Popover, popoverStyles } from './ui/Overlays';
import { cn } from '../lib/utils';

export type LedgerItem =
  | { isGroupHeader: true; id: string; date: string; formattedDate: string; count: number; totalEur: number; groupTxIds: string[] }
  | { isGroupHeader: false; id: string; tx: DisplayTransaction };

export type LedgerSort = { column: string; direction: 'ascending' | 'descending' };

export interface TableCellFilter {
  kind: 'account' | 'category' | 'merchant' | 'location';
  value: string;
  label: string;
  icon: string;
  isActive: boolean;
}

interface LedgerTableProps {
  items: LedgerItem[];
  isPhone: boolean;
  isCompact: boolean;
  selectedIds: Set<string>;
  isSelecting: boolean;
  sort: LedgerSort;
  onSort: (column: string) => void;
  onToggle: (id: string) => void;
  onToggleGroup: (ids: string[]) => void;
  onOpen: (tx: DisplayTransaction) => void;
  onCategorise: (tx: DisplayTransaction) => void;
  onExpand: (id: string) => void;
  onStartSelecting: (id: string) => void;
  amountOf: (tx: DisplayTransaction) => { amount: number; currency: DisplayTransaction['currency'] };
  accountOf: (tx: DisplayTransaction) => { name: string; detail?: string; logoUrl?: string | null; isTransfer?: boolean; account?: Account };
  locationOf: (tx: DisplayTransaction) => string | null;
  logoOf: (tx: DisplayTransaction) => string | null;
  menuFor: (tx: DisplayTransaction) => MenuAction[];
  filtersFor?: (tx: DisplayTransaction) => TableCellFilter[];
  onFilterTo?: (filter: TableCellFilter) => void;
  columnFilters?: Partial<Record<string, { count: number; title: string; content: React.ReactNode }>>;
  categories: Category[];
  tags: Tag[];
}

const LONG_PRESS_MS = 450;

const Logo: React.FC<{ tx: DisplayTransaction; url: string | null; icon: string; account?: Account }> = ({ tx, url, icon, account }) => {
  const [hasFailed, setFailed] = useState(false);
  const hasImage = Boolean(url && !hasFailed);

  if (hasImage) {
    return (
      <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-white shadow-xs">
        <img src={url!} alt="" onError={() => setFailed(true)} className="size-full object-cover" />
      </span>
    );
  }

  if (tx.isTransfer) {
    return (
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-soft text-teal border border-teal/20"
        aria-hidden="true"
      >
        <Icon name="arrow-data-transfer-horizontal" size={18} />
      </span>
    );
  }

  const fallbackIcon = account ? accountIcon(account) : icon;

  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px]',
        'bg-inset text-ink font-bold border border-line/40'
      )}
    >
      <Icon name={fallbackIcon} size={18} className="text-muted" />
    </span>
  );
};

const AccountLogoTile: React.FC<{ url?: string | null; isTransfer?: boolean; label: string }> = ({ url, isTransfer, label }) => {
  const [hasFailed, setFailed] = useState(false);
  const initial = label?.trim().charAt(0).toUpperCase();

  if (isTransfer) {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-teal-soft text-teal border border-teal/20" aria-hidden="true">
        <Icon name="arrow-data-transfer-horizontal" size={16} />
      </span>
    );
  }

  if (url && !hasFailed) {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-white shadow-xs" aria-hidden="true">
        <img src={url} alt="" onError={() => setFailed(true)} className="size-full object-cover" />
      </span>
    );
  }

  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-inset text-muted border border-line" aria-hidden="true">
      {initial ? <span className="text-xs font-bold text-ink">{initial}</span> : <Icon name="bank" size={16} />}
    </span>
  );
};

const CategoryDot: React.FC<{ color: string }> = ({ color }) => <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />;

const SortHeader: React.FC<{
  id: string;
  label: string;
  sort: LedgerSort;
  onSort: (column: string) => void;
  filter?: { count: number; title: string; content: React.ReactNode };
  align?: 'right';
  className?: string;
}> = ({ id, label, sort, onSort, filter, align, className }) => {
  const isSorted = sort.column === id;
  return (
    <th scope="col" aria-sort={isSorted ? sort.direction : 'none'} className={cn('h-10 px-3', align === 'right' ? 'text-right' : 'text-left', className)}>
      <div className={cn('flex items-center gap-1', align === 'right' ? 'justify-end' : 'justify-between')}>
        <button type="button" onClick={() => onSort(id)} className={cn('type-label inline-flex min-h-6 cursor-pointer items-center gap-1 whitespace-nowrap text-muted hover:text-ink pointer-coarse:min-h-11', align === 'right' && 'flex-row-reverse')}>
          {label}
          {isSorted && <Icon name={sort.direction === 'ascending' ? 'arrow_upward' : 'arrow_downward'} size={16} />}
        </button>
        {filter && (
          <Popover
            title={filter.title}
            placement={align === 'right' ? 'bottom end' : 'bottom start'}
            trigger={
              <button
                type="button"
                aria-label={`Filter by ${label.toLowerCase()}${filter.count ? `, ${filter.count} active` : ''}`}
                className={cn(
                  'relative flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none transition-colors hover:bg-inset hover:text-ink',
                  filter.count > 0 ? 'text-ink font-semibold' : 'text-muted hover:text-ink'
                )}
              >
                <Icon name="tune" size={14} />
                {filter.count > 0 && (
                  <span className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-pill text-[9px] font-bold text-on-pill tabular-nums">
                    {filter.count}
                  </span>
                )}
              </button>
            }
          >
            {filter.content}
          </Popover>
        )}
      </div>
    </th>
  );
};

/** Day-grouped ledger: a table from tablets up, day rows on phones. */
const LedgerTable: React.FC<LedgerTableProps> = props => {
  const { items, isPhone, isCompact, selectedIds, isSelecting, sort, onSort, onToggle, onToggleGroup, onOpen, onCategorise, onExpand, onStartSelecting, amountOf, accountOf, locationOf, logoOf, menuFor, filtersFor, onFilterTo, columnFilters, categories, tags } = props;
  const isDark = useIsDark();
  const pressTimer = useRef<number>(0);
  const didLongPress = useRef(false);
  const [contextMenu, setContextMenu] = useState<{ tx: DisplayTransaction; x: number; y: number } | null>(null);

  const details = (tx: DisplayTransaction) => {
    if (tx.isTransfer) {
      if (tx.transferKind === 'credit_card_settlement') {
        return { color: 'var(--blue)', icon: 'credit_card' };
      }
      if (tx.transferKind === 'mortgage_payment') {
        return { color: 'var(--rose)', icon: 'home' };
      }
      if (tx.transferKind === 'loan_payment') {
        return { color: 'var(--chart-4)', icon: 'request_quote' };
      }
      if (tx.transferKind === 'spare_change') {
        return { color: 'var(--teal)', icon: 'piggy' };
      }
    }
    const category = getCategoryDetails(tx.category, categories);
    const isPlainTransfer = tx.isTransfer && (!tx.category || tx.category === 'Transfer');
    return {
      color: isPlainTransfer ? 'var(--muted)' : category.color || 'var(--muted)',
      icon: isPlainTransfer ? 'arrow-data-transfer-horizontal' : category.icon || 'folder-01',
    };
  };

  const money = (tx: DisplayTransaction) => {
    const { amount, currency } = amountOf(tx);
    return <Amount value={convertToMain(amount, currency)} currency={getMainCurrency()} tone={tx.isTransfer ? 'plain' : 'flow'} />;
  };

  const marks = (tx: DisplayTransaction) => {
    const isUncategorized = !tx.isTransfer && (!tx.category || tx.category === 'Uncategorised');
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5">
        {tx.isSplitParent && <Badge tone="attention">Split, {tx.subItemCount || 0}</Badge>}
        {tx.isCombinedParent && <Badge tone="teal">Combined, {tx.subItemCount || 0}</Badge>}
        {isUncategorized && (
          <span
            title="Uncategorised"
            aria-label="Uncategorised"
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-soft text-attention-text"
          >
            <Icon name="warning" size={14} />
          </span>
        )}
        {tx.recurringSourceId && (
          <span
            title="Recurring"
            aria-label="Recurring"
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-money-in-soft text-money-in"
          >
            <Icon name="repeat-one-01" size={14} />
          </span>
        )}
        {tx.notes && <Icon name="notes" size={16} className="shrink-0 text-muted" aria-label="Has notes" />}
      </span>
    );
  };

  if (isPhone) {
    const days: { header: Extract<LedgerItem, { isGroupHeader: true }>; rows: DisplayTransaction[] }[] = [];
    items.forEach(item => {
      if ('tx' in item) days[days.length - 1]?.rows.push(item.tx);
      else days.push({ header: item, rows: [] });
    });

    return (
      <div className="space-y-3">
        {days.map(({ header, rows }) => (
          <DayGroup key={header.id} label={header.formattedDate} total={<Amount value={header.totalEur} currency={getMainCurrency()} tone="flow" />}>
            <ul className="divide-y divide-line">
              {rows.map(tx => {
                const isSelected = selectedIds.has(tx.id);
                return (
                  <li key={tx.id}>
                    <SwipeableRow
                      disabled={isSelecting}
                      leftActions={[{ icon: 'category', label: 'Categorise', bgClass: 'bg-primary-soft', colorClass: 'text-ink', onAction: () => onCategorise(tx) }]}
                      rightActions={[{ icon: 'check', label: 'Select', bgClass: 'bg-inset', colorClass: 'text-ink', onAction: () => onStartSelecting(tx.id) }]}
                    >
                      <button
                        type="button"
                        aria-pressed={isSelecting ? isSelected : undefined}
                        onPointerDown={() => {
                          didLongPress.current = false;
                          pressTimer.current = window.setTimeout(() => { didLongPress.current = true; onStartSelecting(tx.id); }, LONG_PRESS_MS);
                        }}
                        onPointerUp={() => clearTimeout(pressTimer.current)}
                        onPointerLeave={() => clearTimeout(pressTimer.current)}
                        onClick={() => {
                          if (didLongPress.current) return;
                          if (isSelecting) onToggle(tx.id);
                          else onOpen(tx);
                        }}
                        className={cn('flex min-h-16 w-full cursor-pointer items-center gap-3 py-2 text-left', isSelected && 'bg-primary-soft')}
                      >
                        {isSelecting
                          ? (
                            <span
                              className={cn(
                                'ml-1 flex size-5 shrink-0 items-center justify-center rounded-[6px] border transition-colors duration-[var(--duration-fast)]',
                                isSelected
                                  ? 'border-pill bg-pill text-on-pill'
                                  : 'border-line-strong bg-inset'
                              )}
                            >
                              {isSelected && <Icon name="check" size={13} className="stroke-[2.5]" />}
                            </span>
                          )
                          : <Logo tx={tx} url={logoOf(tx)} icon={details(tx).icon} account={accountOf(tx).account} />}
                        <span className="min-w-0 flex-1">
                          <span className="type-body-strong block truncate text-ink">{tx.merchant || tx.description}</span>
                          <span className="type-caption flex items-center gap-1.5 truncate text-muted">
                            <CategoryDot color={details(tx).color} />
                            <span className="truncate">{tx.isTransfer && tx.transferLabel ? tx.transferLabel : tx.category || 'Uncategorised'}</span>
                          </span>
                        </span>
                        <span className="type-figure-row shrink-0 text-ink">{money(tx)}</span>
                      </button>
                    </SwipeableRow>
                  </li>
                );
              })}
            </ul>
          </DayGroup>
        ))}
      </div>
    );
  }

  const rowHeight = isCompact ? 'h-10' : 'h-14';
  const contextItems: MenuAction[] = (() => {
    if (!contextMenu) return [];
    const actions = menuFor(contextMenu.tx);
    const filters = (filtersFor ? filtersFor(contextMenu.tx) : []).map((filter, index): MenuAction => ({
      id: `filter-${filter.kind}-${filter.value}`,
      label: filter.isActive ? `Clear filter “${filter.label}”` : `Filter to “${filter.label}”`,
      icon: filter.isActive ? 'close' : filter.icon,
      startsGroup: index === 0,
      onAction: () => onFilterTo?.(filter),
    }));
    return [...actions.filter(a => !a.isDestructive), ...filters, ...actions.filter(a => a.isDestructive).map((a, index) => ({ ...a, startsGroup: index === 0 }))];
  })();

  const allTxIds = items
    .filter((item): item is Extract<LedgerItem, { isGroupHeader: false }> => !item.isGroupHeader)
    .map(i => i.tx.id);
  const allCount = allTxIds.filter(id => selectedIds.has(id)).length;
  const isAllSelected = allTxIds.length > 0 && allCount === allTxIds.length;
  const isSomeSelected = allCount > 0 && allCount < allTxIds.length;

  return (
    <div className="overflow-x-auto rounded-[var(--radius-xl)] surface-card">
        <table className="w-full border-separate border-spacing-0 table-fixed">
          <caption className="sr-only">Transactions</caption>
          <colgroup>
            <col className="w-10" />
            <col className="w-[300px]" />
            <col className="w-[250px] max-lg:hidden" />
            <col className="w-[200px]" />
            <col className="w-[200px] max-xl:hidden" />
            <col className="w-[180px] max-xl:hidden" />
            <col />
            <col className="w-12" />
          </colgroup>
          <thead className="sticky top-0 z-[var(--z-sticky)] bg-inset">
            <tr>
              <th scope="col" className="w-10 pl-3">
                <Checkbox
                  aria-label="Select all shown"
                  isSelected={isAllSelected}
                  isIndeterminate={isSomeSelected}
                  onChange={() => onToggleGroup(allTxIds)}
                >
                  {null}
                </Checkbox>
              </th>
              <SortHeader id="description" label="Transaction details" sort={sort} onSort={onSort} filter={columnFilters?.description} className="w-[300px] max-w-[300px]" />
              <SortHeader id="account" label="Account" sort={sort} onSort={onSort} filter={columnFilters?.account} className="w-[250px] max-w-[250px] max-lg:hidden" />
              <SortHeader id="category" label="Category" sort={sort} onSort={onSort} filter={columnFilters?.category} className="w-[200px] max-w-[200px]" />
              <SortHeader id="location" label="Location" sort={sort} onSort={onSort} filter={columnFilters?.location} className="w-[200px] max-w-[200px] max-xl:hidden" />
              <th scope="col" className="type-label h-10 px-3 text-left text-muted w-[180px] max-w-[180px] max-xl:hidden">
                <div className="flex items-center justify-between gap-1">
                  <span>Tags</span>
                  {columnFilters?.tags && (
                    <Popover
                      title={columnFilters.tags.title}
                      placement="bottom start"
                      trigger={
                        <button
                          type="button"
                          aria-label={`Filter by tags${columnFilters.tags.count ? `, ${columnFilters.tags.count} active` : ''}`}
                          className={cn(
                            'relative flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none transition-colors hover:bg-inset hover:text-ink',
                            columnFilters.tags.count > 0 ? 'text-ink font-semibold' : 'text-muted hover:text-ink'
                          )}
                        >
                          <Icon name="tune" size={14} />
                          {columnFilters.tags.count > 0 && (
                            <span className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-pill text-[9px] font-bold text-on-pill tabular-nums">
                              {columnFilters.tags.count}
                            </span>
                          )}
                        </button>
                      }
                    >
                      {columnFilters.tags.content}
                    </Popover>
                  )}
                </div>
              </th>
              <SortHeader id="amount" label="Amount" sort={sort} onSort={onSort} filter={columnFilters?.amount} align="right" />
              <th scope="col" className="w-12 pr-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              if (!('tx' in item)) {
                const isAll = item.groupTxIds.every(id => selectedIds.has(id));
                const isSome = !isAll && item.groupTxIds.some(id => selectedIds.has(id));
                return (
                  <tr key={item.id} onContextMenu={e => e.stopPropagation()} className="bg-inset">
                    <td className="h-9 border-t border-line pl-3">
                      <Checkbox
                        aria-label={`Select all from ${item.formattedDate}`}
                        isSelected={isAll}
                        isIndeterminate={isSome}
                        onChange={() => onToggleGroup(item.groupTxIds)}
                      >
                        {null}
                      </Checkbox>
                    </td>
                    <th scope="rowgroup" colSpan={5} className="border-t border-line px-3 text-left">
                      <span className="inline-flex items-center gap-2">
                        <span className="text-[13px] font-medium text-ink">{item.formattedDate}</span>
                        <span className="text-[13px] text-muted tabular-nums">{item.count} {item.count === 1 ? 'record' : 'records'}</span>
                      </span>
                    </th>
                    <td className="type-figure-row border-t border-line px-3 text-right text-ink"><Amount value={item.totalEur} currency={getMainCurrency()} tone="flow" /></td>
                    <td className="border-t border-line" />
                  </tr>
                );
              }

              const { tx } = item;
              const account = accountOf(tx);
              const look = details(tx);
              const location = locationOf(tx);
              const firstTag = tags.find(tag => tag.id === tx.tagIds?.[0]);
              const isSelected = selectedIds.has(tx.id);
              const isUncategorized = !tx.isTransfer && (!tx.category || tx.category === 'Uncategorised');

              return (
                <tr
                  key={tx.id}
                  onContextMenu={e => { e.preventDefault(); setContextMenu({ tx, x: e.clientX, y: e.clientY }); }}
                  className={cn('group hover:bg-inset', isSelected && 'bg-primary-soft hover:bg-primary-soft')}
                >
                  <td className={cn('w-10 border-t border-line pl-3', rowHeight)}>
                    <Checkbox aria-label={`Select ${tx.description}`} isSelected={isSelected} onChange={() => onToggle(tx.id)}>{null}</Checkbox>
                  </td>
                  <td className="w-[300px] max-w-[300px] border-t border-line px-3 overflow-hidden">
                    <div className={cn('flex min-w-0 max-w-[300px] items-center gap-2.5', tx.parentTransactionId && 'pl-6')}>
                      {(tx.isSplitParent || tx.isCombinedParent) && <IconButton icon={tx.isExpanded ? 'expand_more' : 'chevron_right'} label={tx.isExpanded ? 'Hide parts' : 'Show parts'} onPress={() => onExpand(tx.id)} className="size-8 shrink-0" iconSize={16} />}
                      {!isCompact && <Logo tx={tx} url={logoOf(tx)} icon={look.icon} account={account.account} />}
                      <button type="button" onClick={() => onOpen(tx)} className="min-w-0 flex-1 cursor-pointer text-left overflow-hidden">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="type-body-strong truncate text-ink">{tx.description}</span>
                          {marks(tx)}
                        </span>
                        {!isCompact && (
                          <span className="type-caption block truncate text-muted">
                            {tx.isTransfer
                              ? (tx.merchant || (tx.transferLabel && tx.description.trim().toLowerCase() !== tx.transferLabel.trim().toLowerCase()
                                ? tx.transferLabel
                                : ''))
                              : (tx.merchant || '')}
                          </span>
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="w-[250px] max-w-[250px] border-t border-line px-3 max-lg:hidden overflow-hidden">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <AccountLogoTile url={account.logoUrl} isTransfer={tx.isTransfer} label={account.name} />
                      <div className="min-w-0 flex-1">
                        <span className="type-body block truncate text-ink">{account.name}</span>
                        {!isCompact && account.detail && <span className="type-caption block truncate text-muted">{account.detail}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="w-[200px] max-w-[200px] border-t border-line px-3 overflow-hidden">
                    {tx.isTransfer ? (
                      tx.transferLabel ? (
                        <div className="flex max-w-full min-w-0 items-center gap-2 rounded-full text-ink">
                          <span
                            className="flex size-6 shrink-0 items-center justify-center rounded-md"
                            style={{
                              backgroundColor: `color-mix(in srgb, ${adaptColorForTheme(look.color, isDark)} 13%, transparent)`,
                              color: adaptColorForTheme(look.color, isDark),
                            }}
                          >
                            <Icon name={look.icon} size={14} />
                          </span>
                          <span className="truncate text-xs font-semibold">{tx.transferLabel}</span>
                        </div>
                      ) : (
                        <span className="type-caption inline-flex items-center rounded-full bg-inset px-2.5 py-0.5 text-ink">
                          Transfer
                        </span>
                      )
                    ) : isUncategorized ? (
                      <button
                        type="button"
                        onClick={() => onCategorise(tx)}
                        title="Uncategorised"
                        aria-label="Uncategorised"
                        className="inline-flex size-6 cursor-pointer items-center justify-center rounded-full bg-amber-soft text-attention-text transition-opacity hover:opacity-80"
                      >
                        <Icon name="warning" size={14} />
                      </button>
                    ) : (
                      <button type="button" onClick={() => onCategorise(tx)} className="type-body flex max-w-full min-w-0 cursor-pointer items-center gap-2 rounded-full text-ink hover:underline">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: `color-mix(in srgb, ${adaptColorForTheme(look.color, isDark)} 13%, transparent)`, color: adaptColorForTheme(look.color, isDark) }}>
                          <Icon name={look.icon} size={14} />
                        </span>
                        <span className="truncate">{tx.category}</span>
                      </button>
                    )}
                  </td>
                  <td className="type-body truncate w-[200px] max-w-[200px] border-t border-line px-3 text-muted max-xl:hidden">{location ?? '—'}</td>
                  <td className="w-[180px] max-w-[180px] border-t border-line px-3 max-xl:hidden overflow-hidden">
                    {firstTag ? (
                      <span className="type-caption inline-flex max-w-full min-w-0 items-center gap-1.5 text-ink">
                        <Icon name={firstTag.icon || 'tag'} size={14} style={{ color: adaptColorForTheme(firstTag.color, isDark) }} className="shrink-0" />
                        <span className="truncate">{firstTag.name}</span>
                        {(tx.tagIds?.length ?? 0) > 1 && <span className="text-muted shrink-0">+{tx.tagIds!.length - 1}</span>}
                      </span>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td className="type-figure-row whitespace-nowrap border-t border-line px-3 text-right text-ink">
                    {money(tx)}
                    {!!tx.spareChangeAmount && !isCompact && (
                      <span title="Round-up set aside" className="type-caption flex items-center justify-end gap-1 text-money-in">
                        <Icon name="piggy-bank" size={14} className="shrink-0" aria-hidden="true" />
                        <Amount value={convertToMain(Math.abs(tx.spareChangeAmount), tx.currency)} currency={getMainCurrency()} tone="plain" />
                      </span>
                    )}
                  </td>
                  <td className="w-10 border-t border-line pr-2 text-right" onClick={e => e.stopPropagation()} onContextMenu={e => e.stopPropagation()}>
                    <Menu
                      title={tx.description}
                      trigger={<IconButton icon="more_horiz" label={`Actions for ${tx.description}`} data-row-menu tooltipPlacement="left" className={isCompact ? 'size-8' : undefined} />}
                      items={menuFor(tx)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      {contextMenu && (
        <PointerMenu
          point={contextMenu}
          title={contextMenu.tx.merchant || contextMenu.tx.description}
          items={contextItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};

export default LedgerTable;
