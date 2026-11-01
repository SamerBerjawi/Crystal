import React, { useRef, useState } from 'react';
import { ContextMenu } from '@base-ui/react/context-menu';
import type { Category, DisplayTransaction, Tag } from '../types';
import { convertToMain, getMainCurrency } from '../utils';
import { getCategoryDetails } from '../utils/categories';
import SwipeableRow from './SwipeableRow';
import Icon from './ui/Icon';
import { IconButton } from './ui/Actions';
import { Badge, DayGroup } from './ui/Display';
import { Checkbox } from './ui/Fields';
import { Menu, type MenuAction } from './ui/Menu';
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
  accountOf: (tx: DisplayTransaction) => { name: string; detail?: string; logoUrl?: string | null; isTransfer?: boolean };
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

const Logo: React.FC<{ tx: DisplayTransaction; url: string | null; icon: string }> = ({ tx, url, icon }) => {
  const [hasFailed, setFailed] = useState(false);
  const initial = tx.merchant?.trim().charAt(0).toUpperCase();
  return (
    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-inset text-muted">
      {url && !hasFailed
        ? <img src={url} alt="" onError={() => setFailed(true)} className="size-full object-cover" />
        : initial ? <span className="type-label">{initial}</span> : <Icon name={icon} size={16} />}
    </span>
  );
};

const AccountLogoTile: React.FC<{ url?: string | null; isTransfer?: boolean; label: string }> = ({ url, isTransfer, label }) => {
  const [hasFailed, setFailed] = useState(false);
  const initial = label?.trim().charAt(0).toUpperCase();

  if (isTransfer) {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-blue-soft text-blue" aria-hidden="true">
        <Icon name="swap_horiz" size={16} />
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
    <span className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-inset text-muted" aria-hidden="true">
      {initial ? <Icon name="account_balance" size={15} /> : <Icon name="account_balance" size={15} />}
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
        <button type="button" onClick={() => onSort(id)} className={cn('type-label inline-flex cursor-pointer items-center gap-1 whitespace-nowrap text-muted hover:text-ink', align === 'right' && 'flex-row-reverse')}>
          {label}
          {isSorted && <Icon name={sort.direction === 'ascending' ? 'arrow_upward' : 'arrow_downward'} size={15} />}
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
                  'relative flex size-6 cursor-pointer items-center justify-center rounded-full outline-none transition-colors hover:bg-surface-elevated hover:text-ink',
                  filter.count > 0 ? 'text-ink font-semibold' : 'text-muted/60 hover:text-muted'
                )}
              >
                <Icon name="filter" size={13} />
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

const CONTEXT_ITEM = 'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 text-[14px] text-ink outline-none hover:bg-inset focus:bg-inset data-[highlighted]:bg-inset transition-colors select-none';
const CONTEXT_ITEM_DANGER = 'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 text-[14px] text-money-out outline-none hover:bg-money-out-soft/40 focus:bg-money-out-soft/40 data-[highlighted]:bg-money-out-soft/40 transition-colors select-none';

/** Day-grouped ledger: a table from tablets up, day rows on phones. */
const LedgerTable: React.FC<LedgerTableProps> = props => {
  const { items, isPhone, isCompact, selectedIds, isSelecting, sort, onSort, onToggle, onToggleGroup, onOpen, onCategorise, onExpand, onStartSelecting, amountOf, accountOf, locationOf, logoOf, menuFor, filtersFor, onFilterTo, columnFilters, categories, tags } = props;
  const pressTimer = useRef<number>(0);
  const didLongPress = useRef(false);
  const [contextTx, setContextTx] = useState<DisplayTransaction | null>(null);

  const details = (tx: DisplayTransaction) => {
    const category = getCategoryDetails(tx.category, categories);
    const isPlainTransfer = tx.isTransfer && (!tx.category || tx.category === 'Transfer');
    return {
      color: isPlainTransfer ? 'var(--muted)' : category.color || 'var(--muted)',
      icon: isPlainTransfer ? 'swap_horiz' : category.icon || 'category',
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
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400"
          >
            <Icon name="warning" size={12} />
          </span>
        )}
        {tx.recurringSourceId && (
          <span
            title="Recurring"
            aria-label="Recurring"
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          >
            <Icon name="repeat" size={12} />
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
                          ? <span className={cn('ml-1 flex size-5 shrink-0 items-center justify-center rounded-[6px] border border-line-strong text-on-pill', isSelected && 'border-pill bg-pill')}>{isSelected && <Icon name="check" size={16} weight="bold" />}</span>
                          : <Logo tx={tx} url={logoOf(tx)} icon={details(tx).icon} />}
                        <span className="min-w-0 flex-1">
                          <span className="type-body-strong block truncate text-ink">{tx.merchant || tx.description}</span>
                          <span className="type-caption flex items-center gap-1.5 truncate text-muted">
                            <CategoryDot color={details(tx).color} />
                            <span className="truncate">{tx.category || 'Uncategorised'}</span>
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
  const activeFilters = contextTx && filtersFor ? filtersFor(contextTx) : [];
  const contextActions = contextTx ? menuFor(contextTx) : [];
  const normalActions = contextActions.filter(a => !a.isDestructive);
  const dangerActions = contextActions.filter(a => a.isDestructive);

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger render={<div className="overflow-x-auto rounded-[var(--radius-xl)] surface-card" />}>
        <table className="w-full border-separate border-spacing-0 table-fixed">
          <caption className="sr-only">Transactions</caption>
          <colgroup>
            <col className="w-10" />
            <col className="w-[300px]" />
            <col className="w-[250px] max-lg:hidden" />
            <col className="w-[200px]" />
            <col className="w-[200px] max-xl:hidden" />
            <col className="w-[90px] max-xl:hidden" />
            <col />
            <col className="w-12" />
          </colgroup>
          <thead className="sticky top-0 z-[var(--z-sticky)] bg-inset">
            <tr>
              <th scope="col" className="w-10 pl-3"><span className="sr-only">Select</span></th>
              <SortHeader id="description" label="Transaction" sort={sort} onSort={onSort} filter={columnFilters?.description} className="w-[300px] max-w-[300px]" />
              <SortHeader id="account" label="Account" sort={sort} onSort={onSort} filter={columnFilters?.account} className="w-[250px] max-w-[250px] max-lg:hidden" />
              <SortHeader id="category" label="Category" sort={sort} onSort={onSort} filter={columnFilters?.category} className="w-[200px] max-w-[200px]" />
              <SortHeader id="location" label="Location" sort={sort} onSort={onSort} filter={columnFilters?.location} className="w-[200px] max-w-[200px] max-xl:hidden" />
              <th scope="col" className="type-label h-10 px-3 text-left text-muted w-[90px] max-w-[90px] max-xl:hidden">
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
                            'relative flex size-6 cursor-pointer items-center justify-center rounded-full outline-none transition-colors hover:bg-surface-elevated hover:text-ink',
                            columnFilters.tags.count > 0 ? 'text-ink font-semibold' : 'text-muted/60 hover:text-muted'
                          )}
                        >
                          <Icon name="filter" size={13} />
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
                    <td className="h-9 border-t border-line pl-3"><Checkbox aria-label={`Select all from ${item.formattedDate}`} isSelected={isAll} isIndeterminate={isSome} onChange={() => onToggleGroup(item.groupTxIds)}>{null}</Checkbox></td>
                    <th scope="rowgroup" colSpan={5} className="type-label border-t border-line px-3 text-left text-muted">{item.formattedDate}, {item.count}</th>
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
                  onContextMenu={() => setContextTx(tx)}
                  className={cn('group hover:bg-inset', isSelected && 'bg-primary-soft hover:bg-primary-soft')}
                >
                  <td className={cn('w-10 border-t border-line pl-3', rowHeight)}>
                    <Checkbox aria-label={`Select ${tx.description}`} isSelected={isSelected} onChange={() => onToggle(tx.id)}>{null}</Checkbox>
                  </td>
                  <td className="w-[300px] max-w-[300px] border-t border-line px-3 overflow-hidden">
                    <div className={cn('flex min-w-0 max-w-[300px] items-center gap-2.5', tx.parentTransactionId && 'pl-6')}>
                      {(tx.isSplitParent || tx.isCombinedParent) && <IconButton icon={tx.isExpanded ? 'expand_more' : 'chevron_right'} label={tx.isExpanded ? 'Hide parts' : 'Show parts'} onPress={() => onExpand(tx.id)} className="size-8 shrink-0" iconSize={16} />}
                      {!isCompact && <Logo tx={tx} url={logoOf(tx)} icon={look.icon} />}
                      <button type="button" onClick={() => onOpen(tx)} className="min-w-0 flex-1 cursor-pointer text-left overflow-hidden">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="type-body-strong truncate text-ink">{tx.description}</span>
                          {marks(tx)}
                        </span>
                        {!isCompact && (
                          <span className="type-caption block truncate text-muted">
                            {tx.isTransfer
                              ? `${tx.fromAccountName || 'Unknown'} → ${tx.toAccountName || '?'}`
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
                      <span className="type-caption inline-flex items-center rounded-full bg-inset px-2.5 py-0.5 text-ink">
                        Transfer
                      </span>
                    ) : isUncategorized ? (
                      <button
                        type="button"
                        onClick={() => onCategorise(tx)}
                        title="Uncategorised"
                        aria-label="Uncategorised"
                        className="inline-flex size-6 cursor-pointer items-center justify-center rounded-full bg-amber-500/15 text-amber-600 transition-opacity hover:opacity-80 dark:text-amber-400"
                      >
                        <Icon name="warning" size={14} />
                      </button>
                    ) : (
                      <button type="button" onClick={() => onCategorise(tx)} className="type-body flex max-w-full min-w-0 cursor-pointer items-center gap-2 rounded-full text-ink hover:underline">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: `${look.color}22`, color: look.color }}>
                          <Icon name={look.icon} size={14} />
                        </span>
                        <span className="truncate">{tx.category}</span>
                      </button>
                    )}
                  </td>
                  <td className="type-body truncate w-[200px] max-w-[200px] border-t border-line px-3 text-muted max-xl:hidden">{location ?? '—'}</td>
                  <td className="w-[90px] max-w-[90px] border-t border-line px-3 max-xl:hidden overflow-hidden">
                    {firstTag ? (
                      <span className="type-caption inline-flex max-w-full min-w-0 items-center gap-1.5 text-ink">
                        <Icon name={firstTag.icon || 'tag'} size={13} style={{ color: firstTag.color }} className="shrink-0" />
                        <span className="truncate">{firstTag.name}</span>
                        {(tx.tagIds?.length ?? 0) > 1 && <span className="text-muted shrink-0">+{tx.tagIds!.length - 1}</span>}
                      </span>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td className="type-figure-row whitespace-nowrap border-t border-line px-3 text-right text-ink">
                    {money(tx)}
                    {!!tx.spareChangeAmount && !isCompact && (
                      <span title="Round-up set aside" className="type-caption flex items-center justify-end gap-1 text-emerald-600 dark:text-emerald-400">
                        <Icon name="savings" size={13} className="shrink-0" aria-hidden="true" />
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
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner className="pointer-events-auto z-[var(--z-popover)]">
          <ContextMenu.Popup className={cn(popoverStyles, 'z-[var(--z-popover)] min-w-56 max-w-80 p-1.5 shadow-float')}>
            {contextTx && (
              <>
                <p className="truncate px-2.5 pb-1 pt-1.5 text-[12px] font-medium text-muted">
                  {contextTx.merchant || contextTx.description}
                </p>
                {normalActions.map(action => (
                  <ContextMenu.Item
                    key={action.id}
                    onClick={action.onAction}
                    disabled={action.isDisabled}
                    className={CONTEXT_ITEM}
                  >
                    {action.icon && <Icon name={action.icon} size={18} className="shrink-0 text-muted" />}
                    <span className="min-w-0 flex-1 truncate">{action.label}</span>
                  </ContextMenu.Item>
                ))}
                {dangerActions.length > 0 && <div role="separator" className="mx-2 my-1 h-px bg-line" />}
                {dangerActions.map(action => (
                  <ContextMenu.Item
                    key={action.id}
                    onClick={action.onAction}
                    disabled={action.isDisabled}
                    className={CONTEXT_ITEM_DANGER}
                  >
                    {action.icon && <Icon name={action.icon} size={18} className="shrink-0 text-money-out" />}
                    <span className="min-w-0 flex-1 truncate">{action.label}</span>
                  </ContextMenu.Item>
                ))}
                {activeFilters.length > 0 && (
                  <>
                    <div role="separator" className="mx-2 my-1 h-px bg-line" />
                    {activeFilters.map(filter => (
                      <ContextMenu.Item
                        key={`${filter.kind}-${filter.value}`}
                        onClick={() => onFilterTo?.(filter)}
                        className={CONTEXT_ITEM}
                      >
                        <Icon name={filter.isActive ? 'close' : filter.icon} size={18} className="shrink-0 text-muted" />
                        <span className="min-w-0 flex-1 truncate">
                          {filter.isActive ? (
                            <>Clear filter <span className="text-muted">“{filter.label}”</span></>
                          ) : (
                            <>Filter to <span className="font-semibold text-ink">“{filter.label}”</span></>
                          )}
                        </span>
                      </ContextMenu.Item>
                    ))}
                  </>
                )}
              </>
            )}
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
};

export default LedgerTable;
