import React from 'react';
import { Menu } from '@base-ui/react/menu';
import { ContextMenu } from '@base-ui/react/context-menu';
import { Popover } from '@base-ui/react/popover';
import { cn } from '../../../lib/utils';
import type { DayGroup, SortId, TxRow } from '../../../utils/transactionsModel';
import { getCountryCodeAndFlag } from '../../../utils/locationFormat';
import type { TransactionsData } from '../../../hooks/useTransactionsData';
import { NvIcon, type NvIconName } from '../NvIcon';
import { EntityGlyph, LogoTile } from '../EntityIcon';
import { Money } from '../ui';
import { SpareChip, TxAmount, TxAvatar, TxBadges } from './parts';

/*
 * The desktop Transactions table (UI_UX_DESIGN_REFERENCE.md §18): the classic page's structure (Details, Account,
 * Category, Location, Tags, Value, row menu; day headers with a record count and the day's net) in the New style:
 * grey tile, no cell borders, hairline row dividers, pill chips. Below the `lg` breakpoint the page keeps the card rows.
 */

/** One grid for the header, day rows and transaction rows, so the columns line up. */
const GRID = 'grid grid-cols-[24px_minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_40px] items-center gap-x-3 xl:grid-cols-[24px_minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)_40px] xl:gap-x-4';
/** Location and Tags only fit from the xl breakpoint; below it the table keeps the other four columns. */
const XL_ONLY = 'hidden xl:block';

export type ColumnId = 'details' | 'account' | 'category' | 'location' | 'tags' | 'value';
/** A column's header filter: how many values are active, and the popover's content (the page owns the state). */
export type ColumnFilters = Partial<Record<ColumnId, { count: number; title: string; content: React.ReactNode }>>;

/** A value in a cell the list can be filtered to, as in Excel's "Filter by selected cell's value". */
export type CellFilterKind = 'account' | 'category' | 'location' | 'tag' | 'merchant';
export interface CellFilter { kind: CellFilterKind; value: string; label: string }
/** One action in a row's menu (the ⋯ button and right-click share it). */
export interface RowMenuEntry { icon: NvIconName; label: string; onClick: () => void; danger?: boolean; separatorBefore?: boolean }

const FILTER_ICON: Record<CellFilterKind, NvIconName> = { account: 'bank', category: 'budget', location: 'pin', tag: 'tag', merchant: 'wallet' };

/** Every value of a row that the list can be filtered to. */
const cellFiltersOf = (row: TxRow, data: TransactionsData): CellFilter[] => {
  const out: CellFilter[] = [];
  const account = data.accountsById.get(row.accountId);
  if (account) out.push({ kind: 'account', value: account.id, label: account.name });
  const toAccount = row.toAccountId ? data.accountsById.get(row.toAccountId) : undefined;
  if (toAccount) out.push({ kind: 'account', value: toAccount.id, label: toAccount.name });
  if (row.kind !== 'transfer' && !row.uncategorized && row.category) out.push({ kind: 'category', value: row.category, label: row.category });
  if (row.merchant) out.push({ kind: 'merchant', value: row.merchant, label: row.merchant });
  if (row.placeKey) out.push({ kind: 'location', value: row.placeKey, label: row.city || row.place || 'This place' });
  row.tagIds.forEach(id => { const tag = data.tagsById.get(id); if (tag) out.push({ kind: 'tag', value: id, label: tag.name }); });
  return out;
};

const ITEM = 'flex min-h-10 cursor-default items-center gap-3 rounded-xl px-3 text-[14px] text-nv-ink outline-none data-[highlighted]:bg-nv-inset';
const POPUP = 'crystal-new min-w-56 max-w-80 rounded-nv-tile bg-nv-surface p-1.5 shadow-nv-float origin-[var(--transform-origin)] transition-[transform,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0';

/** Filter entries: "Filter to X", or "Clear filter" when the list is already filtered to exactly X. Works in a Menu and a ContextMenu. */
const FilterItems: React.FC<{ filters: CellFilter[]; isActive: (f: CellFilter) => boolean; onFilter: (f: CellFilter) => void }> = ({ filters, isActive, onFilter }) => (
  <>
    {filters.map(f => (
      <Menu.Item key={`${f.kind}:${f.value}`} onClick={() => onFilter(f)} className={ITEM}>
        <NvIcon name={isActive(f) ? 'close' : FILTER_ICON[f.kind]} size={16} className="shrink-0 text-nv-muted" />
        <span className="min-w-0 truncate">{isActive(f) ? <>Clear filter <span className="text-nv-muted">“{f.label}”</span></> : <>Filter to <span className="font-medium">“{f.label}”</span></>}</span>
      </Menu.Item>
    ))}
  </>
);

const RowItems: React.FC<{ entries: RowMenuEntry[] }> = ({ entries }) => (
  <>
    {entries.map(e => (
      <React.Fragment key={e.label}>
        {e.separatorBefore && <div role="separator" className="mx-2 my-1 h-px bg-nv-line" />}
        <Menu.Item onClick={e.onClick} className={cn(ITEM, e.danger && 'text-nv-red-text')}>
          <NvIcon name={e.icon} size={16} className={cn('shrink-0', e.danger ? 'text-nv-red-text' : 'text-nv-muted')} />{e.label}
        </Menu.Item>
      </React.Fragment>
    ))}
  </>
);

/** A clickable value in a cell: opens a small menu to filter the list to it. Never opens the row. */
const CellValue: React.FC<{ filters: CellFilter[]; isActive: (f: CellFilter) => boolean; onFilter: (f: CellFilter) => void; label: string; className?: string; children: React.ReactNode }> = ({ filters, isActive, onFilter, label, className, children }) => (
  <span className={cn('inline-flex min-w-0 max-w-full', className)} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
    <Menu.Root>
      <Menu.Trigger aria-label={label} className="inline-flex min-w-0 max-w-full rounded-full text-left outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-nv-violet data-[popup-open]:ring-[1.5px] data-[popup-open]:ring-nv-ink">
        {children}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="start" className="pointer-events-auto z-popover">
          <Menu.Popup className={POPUP}><FilterItems filters={filters} isActive={isActive} onFilter={onFilter} /></Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  </span>
);

const Checkbox: React.FC<{ checked: boolean | 'mixed'; label: string; onToggle: () => void }> = ({ checked, label, onToggle }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    aria-label={label}
    onClick={e => { e.stopPropagation(); onToggle(); }}
    onKeyDown={e => e.stopPropagation()}
    className={cn('flex h-5 w-5 items-center justify-center rounded-md border-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-nv-violet', checked ? 'border-nv-ink bg-nv-ink text-nv-on-ink' : 'border-nv-line hover:border-nv-muted')}
  >
    {checked === true && <NvIcon name="check" size={12} strokeWidth={2.5} />}
    {checked === 'mixed' && <span className="h-0.5 w-2.5 rounded-full bg-current" />}
  </button>
);

type Column = { id: ColumnId; label: string; sorts?: [SortId, SortId?]; align?: 'right'; xlOnly?: boolean };
const COLUMNS: Column[] = [
  { id: 'details', label: 'Transaction details', sorts: ['merchant-asc'] },
  { id: 'account', label: 'Account' },
  { id: 'category', label: 'Category', sorts: ['category-asc'] },
  { id: 'location', label: 'Location', xlOnly: true },
  { id: 'tags', label: 'Tags', xlOnly: true },
  { id: 'value', label: 'Value', sorts: ['amount-desc', 'amount-asc'], align: 'right' },
];

const DEFAULT_SORT: SortId = 'date-desc';

/** Clicking a sortable header goes to its first sort, then its second (when it has one), then back to newest first. */
const nextSort = (column: Column, current: SortId): SortId => {
  if (!column.sorts) return current;
  const [first, second] = column.sorts;
  if (current === first) return second ?? DEFAULT_SORT;
  if (second && current === second) return DEFAULT_SORT;
  return first;
};

const ColumnFilter: React.FC<{ label: string; filter: NonNullable<ColumnFilters[ColumnId]>; align: 'start' | 'end' }> = ({ label, filter, align }) => (
  <Popover.Root>
    <Popover.Trigger aria-label={`Filter by ${label.toLowerCase()}${filter.count ? `, ${filter.count} active` : ''}`} className={cn('relative flex h-7 w-7 items-center justify-center rounded-full outline-none hover:bg-nv-inset hover:text-nv-ink focus-visible:ring-2 focus-visible:ring-nv-violet', filter.count ? 'text-nv-ink' : 'text-nv-faint')}>
      <NvIcon name="filter" size={14} />
      {filter.count > 0 && <span className="nv-tabular absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-nv-ink px-1 text-[10px] font-semibold text-nv-on-ink">{filter.count}</span>}
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner sideOffset={8} align={align} className="pointer-events-auto z-popover">
        <Popover.Popup className="crystal-new max-h-[min(24rem,70vh)] w-80 overflow-y-auto rounded-nv-tile bg-nv-surface p-4 text-nv-ink shadow-nv-float">
          <p className="mb-3 text-[15px] font-semibold">{filter.title}</p>
          {filter.content}
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
);

const TableHead: React.FC<{ filters?: ColumnFilters; sort: SortId; onSort: (sort: SortId) => void; allSelected: boolean | 'mixed'; onToggleAll: () => void }> = ({ filters, sort, onSort, allSelected, onToggleAll }) => (
  <div role="row" className={cn(GRID, 'border-b border-nv-line px-3 py-2.5 text-[13px] font-medium text-nv-muted')}>
    <span role="columnheader" className="flex justify-center"><Checkbox checked={allSelected} label="Select all shown" onToggle={onToggleAll} /></span>
    {COLUMNS.map(column => {
      const active = column.sorts?.includes(sort);
      const ariaSort = active ? (sort.endsWith('desc') ? 'descending' : 'ascending') : column.sorts ? 'none' : undefined;
      return (
        <span key={column.id} role="columnheader" aria-sort={ariaSort} className={cn('flex min-w-0 items-center gap-0.5', column.align === 'right' && 'flex-row-reverse', column.xlOnly && 'hidden xl:flex')}>
          {column.sorts ? (
            <button type="button" onClick={() => onSort(nextSort(column, sort))} className={cn('inline-flex items-center gap-1 rounded-md py-1 hover:text-nv-ink', active && 'text-nv-ink', column.align === 'right' && 'flex-row-reverse')}>
              {column.label}
              <NvIcon name="arrowDown" size={14} className={cn('transition-transform', active ? (sort.endsWith('asc') ? 'rotate-180' : '') : 'opacity-0')} />
            </button>
          ) : <span className="py-1">{column.label}</span>}
          {filters?.[column.id] && <ColumnFilter label={column.label} filter={filters[column.id]!} align={column.align === 'right' ? 'end' : 'start'} />}
        </span>
      );
    })}
    <span role="columnheader"><span className="sr-only">Actions</span></span>
  </div>
);

const Chip: React.FC<{ color?: string; icon?: React.ReactNode; children: React.ReactNode; title?: string }> = ({ color, icon, children, title }) => (
  <span title={title} className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full bg-nv-surface px-2.5 text-[13px] font-medium text-nv-ink">
    {color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />}
    {icon}
    <span className="truncate">{children}</span>
  </span>
);

const TableRow: React.FC<{
  row: TxRow; data: TransactionsData; selecting: boolean; selected: boolean; onOpen: () => void; onToggle: () => void;
  menu: RowMenuEntry[]; isActive: (f: CellFilter) => boolean; onFilter: (f: CellFilter) => void; onContextRow: () => void;
}> = ({ row, data, selecting, selected, onOpen, onToggle, menu, isActive, onFilter, onContextRow }) => {
  const account = data.accountsById.get(row.accountId);
  const toAccount = row.toAccountId ? data.accountsById.get(row.toAccountId) : undefined;
  const category = data.categoryByName.get(row.category);
  const tags = row.tagIds.map(id => data.tagsById.get(id)).filter((t): t is NonNullable<typeof t> => Boolean(t));
  const flag = row.located && row.country ? getCountryCodeAndFlag(row.country).flag : '';
  const accountLabel = row.kind === 'transfer' ? `${account?.name ?? 'Unknown'} → ${toAccount?.name ?? '?'}` : account?.name ?? 'Unknown account';
  const filters = cellFiltersOf(row, data);
  const of = (kind: CellFilterKind) => filters.filter(f => f.kind === kind);
  const cell = { isActive, onFilter };
  const detail = row.kind === 'transfer' ? 'Transfer' : row.detail && row.detail !== row.merchant ? row.detail : '';
  const activate = () => (selecting ? onToggle() : onOpen());
  return (
    <div
      role="row"
      tabIndex={0}
      aria-selected={selected}
      onClick={activate}
      onContextMenu={onContextRow}
      onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); activate(); } }}
      className={cn(GRID, 'group min-h-[68px] cursor-pointer rounded-nv-sub border-b border-nv-line/60 px-3 py-2.5 text-left outline-none transition-colors last:border-b-0 hover:bg-nv-surface focus-visible:ring-2 focus-visible:ring-nv-violet', selected && 'bg-nv-surface ring-[1.5px] ring-nv-ink')}
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 68px' }}
    >
      <span role="cell" className="flex justify-center"><Checkbox checked={selected} label={`Select ${row.title}`} onToggle={onToggle} /></span>
      <span role="cell" className="flex min-w-0 items-center gap-3">
        <TxAvatar row={row} logoUrl={data.logoFor(row.merchant)} color={category?.color} icon={category?.icon} size={40} rounded="xl" />
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold text-nv-ink">{row.title}</span>
            {row.notes && <NvIcon name="note" size={14} className="shrink-0 text-nv-faint" aria-label="Has notes" />}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-nv-muted">
            {row.merchant && row.kind !== 'transfer' && (
              <CellValue {...cell} filters={of('merchant')} label={`Merchant ${row.merchant}: filter`} className="shrink">
                <span className="truncate underline decoration-nv-line decoration-dotted underline-offset-4 hover:text-nv-ink">{row.merchant}</span>
              </CellValue>
            )}
            {row.merchant && row.kind !== 'transfer' && detail && <span aria-hidden>·</span>}
            {(detail || !row.merchant) && <span className="truncate">{detail || 'Activity'}</span>}
            <TxBadges row={row} className="ml-0.5 shrink-0 flex-nowrap" />
          </span>
        </span>
      </span>
      <span role="cell" className="min-w-0">
        <CellValue {...cell} filters={of('account')} label={`Account ${accountLabel}: filter`}>
          <span className="flex min-w-0 items-center gap-2.5 rounded-full pr-2">
            <LogoTile url={account?.financialInstitution ? data.logoFor(account.financialInstitution) : null} label={accountLabel} size={32} fallbackIcon="bank" />
            <span className="truncate text-[14px] text-nv-ink">{accountLabel}</span>
          </span>
        </CellValue>
      </span>
      <span role="cell" className="min-w-0">
        {row.kind === 'transfer' ? <Chip>Transfer</Chip> : row.uncategorized ? <Chip title="Category: Uncategorized">Uncategorized</Chip> : (
          <CellValue {...cell} filters={of('category')} label={`Category ${row.category}: filter`}>
            <Chip icon={<EntityGlyph icon={category?.icon} label={row.category} color={category?.color} size={15} />} title={`Category: ${row.category}`}>{row.category}</Chip>
          </CellValue>
        )}
      </span>
      <span role="cell" className={cn('min-w-0 text-[14px] text-nv-ink', XL_ONLY)}>
        {row.located && row.city && row.placeKey ? (
          <CellValue {...cell} filters={of('location')} label={`Location ${row.city}: filter`}>
            <span className="truncate rounded-full pr-1" title={[row.city, row.country].filter(Boolean).join(', ')}>{flag && <span aria-hidden className="mr-1.5">{flag}</span>}{row.city}</span>
          </CellValue>
        ) : row.located && row.city ? <span className="truncate">{flag && <span aria-hidden className="mr-1.5">{flag}</span>}{row.city}</span> : <span className="text-nv-faint" aria-label="No location">—</span>}
      </span>
      <span role="cell" className={cn('min-w-0 items-center gap-1', 'hidden xl:flex')}>
        {tags.length ? (
          <CellValue {...cell} filters={of('tag')} label={`Tags ${tags.map(t => t.name).join(', ')}: filter`}>
            <span className="flex min-w-0 items-center gap-1">
              <Chip icon={<EntityGlyph icon={tags[0].icon} label={tags[0].name} color={tags[0].color} size={14} />}>{tags[0].name}</Chip>
              {tags.length > 1 && <span className="shrink-0 pr-1 text-[13px] text-nv-muted">+{tags.length - 1}</span>}
            </span>
          </CellValue>
        ) : <span className="text-nv-faint" aria-label="No tags">—</span>}
      </span>
      <span role="cell" className="flex flex-col items-end"><TxAmount row={row} size="md" /><SpareChip row={row} /></span>
      <span role="cell" className="flex justify-end" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} onContextMenu={e => e.stopPropagation()}>
        <Menu.Root>
          <Menu.Trigger aria-label={`Options for ${row.title}`} className="flex h-9 w-9 items-center justify-center rounded-full text-nv-muted outline-none hover:bg-nv-inset hover:text-nv-ink focus-visible:ring-2 focus-visible:ring-nv-violet data-[popup-open]:bg-nv-inset">
            <NvIcon name="more" size={18} />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner sideOffset={6} align="end" className="pointer-events-auto z-popover">
              <Menu.Popup className={POPUP}><RowItems entries={menu} /></Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </span>
    </div>
  );
};

export const TransactionTable: React.FC<{
  groups: DayGroup[];
  dated: boolean;
  dayLabel: (iso: string) => string;
  data: TransactionsData;
  sort: SortId;
  onSort: (sort: SortId) => void;
  selecting: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleMany: (ids: string[], on: boolean) => void;
  onOpen: (row: TxRow) => void;
  filters?: ColumnFilters;
  /** The row's actions, for its ⋯ menu and its right-click menu. */
  rowMenu?: (row: TxRow) => RowMenuEntry[];
  /** Filter the list to a cell's value; `isFilteredTo` says whether it already is. */
  onFilterTo?: (filter: CellFilter) => void;
  isFilteredTo?: (filter: CellFilter) => boolean;
  onSelectRow?: (row: TxRow) => void;
}> = ({ filters, groups, dated, dayLabel, data, sort, onSort, selecting, selected, onToggle, onToggleMany, onOpen, rowMenu, onFilterTo, isFilteredTo, onSelectRow }) => {
  const all = groups.flatMap(g => g.rows);
  const count = all.filter(r => selected.has(r.id)).length;
  const allSelected = count > 0 && count === all.length ? true : count > 0 ? 'mixed' as const : false;
  // One right-click menu for the whole table: a row records itself as the target before it opens.
  const [contextRow, setContextRow] = React.useState<TxRow | null>(null);
  const activeChecker = isFilteredTo ?? (() => false);
  const filterHandler = onFilterTo ?? (() => {});
  return (
    <div role="table" aria-label="Transactions" className="w-full">
      <TableHead filters={filters} sort={sort} onSort={onSort} allSelected={allSelected} onToggleAll={() => onToggleMany(all.map(r => r.id), allSelected !== true)} />
      <ContextMenu.Root>
      <ContextMenu.Trigger render={<div role="presentation" />}>
      {groups.map(group => {
        const ids = group.rows.map(r => r.id);
        const picked = ids.filter(id => selected.has(id)).length;
        const groupSelected = picked > 0 && picked === ids.length ? true : picked > 0 ? 'mixed' as const : false;
        const net = group.rows.reduce((sum, r) => (r.kind === 'transfer' || r.adjustment ? sum : sum + data.convert(r.amount, r.currency)), 0);
        return (
          <div role="rowgroup" key={group.date || 'all'}>
            {dated && (
              <div role="row" onContextMenu={e => e.stopPropagation()} className={cn(GRID, 'mt-2 rounded-nv-sub bg-nv-inset px-3 py-2 text-[13px]')}>
                <span role="cell" className="flex justify-center"><Checkbox checked={groupSelected} label={`Select all on ${dayLabel(group.date)}`} onToggle={() => onToggleMany(ids, groupSelected !== true)} /></span>
                <span role="cell" className="col-span-3 flex items-center gap-2 xl:col-span-5">
                  <span data-nv-index className="font-medium text-nv-ink">{dayLabel(group.date)}</span>
                  <span className="nv-tabular text-nv-muted">{group.rows.length} {group.rows.length === 1 ? 'record' : 'records'}</span>
                </span>
                <span role="cell" className="flex items-center justify-end gap-2 whitespace-nowrap text-right">
                  <span className="text-nv-muted">Daily net</span>
                  <Money amount={net} currency={data.displayCurrency} signed={net > 0} size="md" tone={net > 0 ? 'income' : 'ink'} className="!text-[13px]" />
                </span>
                <span role="cell" />
              </div>
            )}
            {group.rows.map(row => (
              <TableRow
                key={row.id}
                row={row}
                data={data}
                selecting={selecting}
                selected={selected.has(row.id)}
                onOpen={() => onOpen(row)}
                onToggle={() => onToggle(row.id)}
                menu={rowMenu ? rowMenu(row) : []}
                isActive={activeChecker}
                onFilter={filterHandler}
                onContextRow={() => setContextRow(row)}
              />
            ))}
          </div>
        );
      })}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner className="pointer-events-auto z-popover">
          <ContextMenu.Popup className={POPUP}>
            {contextRow && (
              <>
                <p className="truncate px-3 pb-1 pt-1.5 text-[12px] font-medium text-nv-muted">{contextRow.title}</p>
                <RowItems entries={rowMenu(contextRow)} />
                {cellFiltersOf(contextRow, data).length > 0 && <div role="separator" className="mx-2 my-1 h-px bg-nv-line" />}
                <FilterItems filters={cellFiltersOf(contextRow, data)} isActive={isFilteredTo} onFilter={onFilterTo} />
              </>
            )}
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
      </ContextMenu.Root>
    </div>
  );
};
