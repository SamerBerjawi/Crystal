import React, { useRef, useState } from 'react';
import type { Category, DisplayTransaction, Tag } from '../types';
import { convertToEur } from '../utils';
import { getCategoryDetails } from '../utils/categories';
import SwipeableRow from './SwipeableRow';
import Icon from './ui/Icon';
import { IconButton } from './ui/Actions';
import { Badge, DayGroup } from './ui/Display';
import { Checkbox } from './ui/Fields';
import { Menu, type MenuAction } from './ui/Menu';
import { Amount } from './ui/Money';
import { cn } from '../lib/utils';

export type LedgerItem =
  | { isGroupHeader: true; id: string; date: string; formattedDate: string; count: number; totalEur: number; groupTxIds: string[] }
  | { isGroupHeader: false; id: string; tx: DisplayTransaction };

export type LedgerSort = { column: string; direction: 'ascending' | 'descending' };

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
  accountOf: (tx: DisplayTransaction) => { name: string; detail?: string };
  locationOf: (tx: DisplayTransaction) => string | null;
  logoOf: (tx: DisplayTransaction) => string | null;
  menuFor: (tx: DisplayTransaction) => MenuAction[];
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

const CategoryDot: React.FC<{ color: string }> = ({ color }) => <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />;

const SortHeader: React.FC<{ id: string; label: string; sort: LedgerSort; onSort: (column: string) => void; align?: 'right'; className?: string }> = ({ id, label, sort, onSort, align, className }) => (
  <th scope="col" aria-sort={sort.column === id ? sort.direction : 'none'} className={cn('h-10 px-3', align === 'right' ? 'text-right' : 'text-left', className)}>
    <button type="button" onClick={() => onSort(id)} className={cn('type-label inline-flex cursor-pointer items-center gap-1 whitespace-nowrap text-muted hover:text-ink', align === 'right' && 'flex-row-reverse')}>
      {label}
      {sort.column === id && <Icon name={sort.direction === 'ascending' ? 'arrow_upward' : 'arrow_downward'} size={16} />}
    </button>
  </th>
);

const openMenuFrom = (e: React.MouseEvent<HTMLElement>) => {
  const button = e.currentTarget.querySelector<HTMLButtonElement>('[data-row-menu]');
  if (!button) return;
  e.preventDefault();
  button.click();
};

/** Day-grouped ledger: a table from tablets up, day rows on phones. */
const LedgerTable: React.FC<LedgerTableProps> = props => {
  const { items, isPhone, isCompact, selectedIds, isSelecting, sort, onSort, onToggle, onToggleGroup, onOpen, onCategorise, onExpand, onStartSelecting, amountOf, accountOf, locationOf, logoOf, menuFor, categories, tags } = props;
  const pressTimer = useRef<number>(0);
  const didLongPress = useRef(false);

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
    return <Amount value={convertToEur(amount, currency)} currency="EUR" tone={tx.isTransfer ? 'plain' : 'flow'} />;
  };

  const marks = (tx: DisplayTransaction) => (
    <>
      {tx.isSplitParent && <Badge tone="attention">Split, {tx.subItemCount || 0}</Badge>}
      {tx.isCombinedParent && <Badge tone="indigo">Combined, {tx.subItemCount || 0}</Badge>}
      {tx.recurringSourceId && <Icon name="repeat" size={16} className="shrink-0 text-muted" aria-label="Recurring" />}
      {tx.notes && <Icon name="notes" size={16} className="shrink-0 text-muted" aria-label="Has notes" />}
    </>
  );

  if (isPhone) {
    const days: { header: Extract<LedgerItem, { isGroupHeader: true }>; rows: DisplayTransaction[] }[] = [];
    items.forEach(item => {
      if ('tx' in item) days[days.length - 1]?.rows.push(item.tx);
      else days.push({ header: item, rows: [] });
    });

    return (
      <div className="space-y-3">
        {days.map(({ header, rows }) => (
          <DayGroup key={header.id} label={header.formattedDate} total={<Amount value={header.totalEur} currency="EUR" tone="flow" />}>
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
                        className={cn('flex min-h-16 w-full cursor-pointer items-center gap-3 bg-canvas py-2 text-left', isSelected && 'bg-primary-soft')}
                      >
                        {isSelecting
                          ? <span className={cn('ml-1 flex size-5 shrink-0 items-center justify-center rounded-[6px] border border-line-strong text-on-primary', isSelected && 'border-primary bg-primary')}>{isSelected && <Icon name="check" size={16} weight="bold" />}</span>
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

  return (
    <div className="overflow-x-auto rounded-[var(--radius-xl)] border border-line bg-surface">
      <table className="w-full border-separate border-spacing-0">
        <caption className="sr-only">Transactions</caption>
        <thead className="sticky top-0 z-[var(--z-sticky)] bg-inset">
          <tr>
            <th scope="col" className="w-11 pl-3"><span className="sr-only">Select</span></th>
            <SortHeader id="description" label="Transaction" sort={sort} onSort={onSort} />
            <SortHeader id="account" label="Account" sort={sort} onSort={onSort} className="max-lg:hidden" />
            <SortHeader id="category" label="Category" sort={sort} onSort={onSort} />
            <SortHeader id="location" label="Location" sort={sort} onSort={onSort} className="max-xl:hidden" />
            <th scope="col" className="type-label h-10 px-3 text-left text-muted max-xl:hidden">Tags</th>
            <SortHeader id="amount" label="Amount" sort={sort} onSort={onSort} align="right" />
            <th scope="col" className="w-12"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            if (!('tx' in item)) {
              const isAll = item.groupTxIds.every(id => selectedIds.has(id));
              const isSome = !isAll && item.groupTxIds.some(id => selectedIds.has(id));
              return (
                <tr key={item.id} className="bg-canvas">
                  <td className="h-9 border-t border-line pl-3"><Checkbox aria-label={`Select all from ${item.formattedDate}`} isSelected={isAll} isIndeterminate={isSome} onChange={() => onToggleGroup(item.groupTxIds)}>{null}</Checkbox></td>
                  <th scope="rowgroup" colSpan={5} className="type-label border-t border-line px-3 text-left text-muted">{item.formattedDate}, {item.count}</th>
                  <td className="type-figure-row border-t border-line px-3 text-right text-ink"><Amount value={item.totalEur} currency="EUR" tone="flow" /></td>
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

            return (
              <tr key={tx.id} onContextMenu={openMenuFrom} className={cn('group hover:bg-inset', isSelected && 'bg-primary-soft hover:bg-primary-soft')}>
                <td className={cn('border-t border-line pl-3', rowHeight)}><Checkbox aria-label={`Select ${tx.description}`} isSelected={isSelected} onChange={() => onToggle(tx.id)}>{null}</Checkbox></td>
                <td className="max-w-0 border-t border-line px-3">
                  <div className={cn('flex min-w-0 items-center gap-2.5', tx.parentTransactionId && 'pl-6')}>
                    {(tx.isSplitParent || tx.isCombinedParent) && <IconButton icon={tx.isExpanded ? 'expand_more' : 'chevron_right'} label={tx.isExpanded ? 'Hide parts' : 'Show parts'} onPress={() => onExpand(tx.id)} className="size-8" iconSize={16} />}
                    {!isCompact && <Logo tx={tx} url={logoOf(tx)} icon={look.icon} />}
                    <button type="button" onClick={() => onOpen(tx)} className="min-w-0 flex-1 cursor-pointer text-left">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="type-body-strong truncate text-ink">{tx.description}</span>
                        {marks(tx)}
                      </span>
                      {!isCompact && <span className="type-caption block truncate text-muted">{tx.merchant || (tx.isTransfer ? `${tx.fromAccountName} to ${tx.toAccountName}` : '')}</span>}
                    </button>
                  </div>
                </td>
                <td className="max-w-[180px] border-t border-line px-3 max-lg:hidden">
                  <span className="type-body block truncate text-ink">{account.name}</span>
                  {!isCompact && account.detail && <span className="type-caption block truncate text-muted">{account.detail}</span>}
                </td>
                <td className="max-w-[170px] border-t border-line px-3">
                  <button type="button" onClick={() => onCategorise(tx)} className="type-body flex max-w-full cursor-pointer items-center gap-2 rounded-full text-ink hover:underline">
                    <CategoryDot color={look.color} />
                    <span className="truncate">{tx.category || 'Uncategorised'}</span>
                  </button>
                </td>
                <td className="type-body max-w-[130px] truncate border-t border-line px-3 text-muted max-xl:hidden">{location ?? '—'}</td>
                <td className="border-t border-line px-3 max-xl:hidden">
                  {firstTag ? <span className="type-caption inline-flex max-w-[120px] items-center gap-1.5 text-ink"><CategoryDot color={firstTag.color} /><span className="truncate">{firstTag.name}</span>{(tx.tagIds?.length ?? 0) > 1 && <span className="text-muted">+{tx.tagIds!.length - 1}</span>}</span> : <span className="text-muted">—</span>}
                </td>
                <td className="type-figure-row whitespace-nowrap border-t border-line px-3 text-right text-ink">
                  {money(tx)}
                  {!!tx.spareChangeAmount && !isCompact && <span className="type-caption block text-muted">Round-up <Amount value={convertToEur(Math.abs(tx.spareChangeAmount), tx.currency)} currency="EUR" /></span>}
                </td>
                <td className="border-t border-line pr-1 text-right">
                  <Menu title={tx.description} trigger={<IconButton icon="more_horiz" label={`Actions for ${tx.description}`} data-row-menu tooltipPlacement="left" className={isCompact ? 'size-8' : undefined} />} items={menuFor(tx)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default LedgerTable;
