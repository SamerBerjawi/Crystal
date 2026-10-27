import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import type { User } from '../../types';
import { useTransactionsData } from '../../hooks/useTransactionsData';
import { downloadCSV, formatCurrency } from '../../utils';
import {
  PERIODS, SORTS, balanceAccounts, canCombineRows, filterRows, groupByDay, isDateSort, kpiTotals, needsReview, pctChange, periodRange, periodTotals,
  placeClusters, previousRange, rowsToCsv, sortRows, spendByWeekday, topCategory, totalBalance,
  type PeriodId, type SortId, type TxKind, type TxRow,
} from '../../utils/transactionsModel';
import { HeaderControls, HeaderTools, usePageAction, usePageSearch, usePageTabs, useShellNew } from '../../components/new/shellContext';
import { Button, Card, EmptyState, IconButton, MoreButton, Money } from '../../components/new/ui';
import { FilterChip, PeriodPill } from '../../components/new/tile';
import { Drawer } from '../../components/new/Drawer';
import { NvIcon, type NvIconName } from '../../components/new/NvIcon';
import { toast } from '../../components/new/toast';
import { confirmNew } from '../../components/new/ConfirmDialog';
import { TransactionSheet } from '../../components/new/transactions/sheets';
import { BulkEditSheet, CombineSheet, RecurringSheet, SplitSheet } from '../../components/new/transactions/actions';
import { PickerField, TextField, TransactionRowItem } from '../../components/new/transactions/parts';
import { FilterList, accountFilterOptions, accountQuickFilters, categoryFilterOptions, merchantFilterOptions, tagFilterOptions, type FilterOption } from '../../components/new/transactions/filters';
import { TransactionTable, type ColumnFilters, type CellFilter, type RowMenuEntry } from '../../components/new/transactions/table';
import { useMediaQuery } from '../../components/new/Drawer';
import { TransactionsHeroCard } from '../../components/new/transactions/overview';

/*
 * TransactionsNew (UI_UX_DESIGN_REFERENCE.md §5, migration notes in §12). Tabs Activity / To review and the
 * page's search, period, filters and tools in the band; a balance card with account tiles and four KPI tiles; the hero
 * (spending by weekday beside a map of where you spent, both filtering the list, §17); the list with "Show more"
 * chunks (D11); a detail / edit sheet; multi-select. Same props as the classic page.
 */

interface TransactionsNewProps {
  user: User;
  initialAccountFilter?: string | null;
  initialTagFilter?: string | null;
  onClearInitialFilters?: () => void;
  onSyncBanks?: () => void;
  isSyncingBanks?: boolean;
}

type Tab = 'activity' | 'review';
const CHUNK = 60;
const KIND_CHIPS: { kind: TxKind; label: string; icon: NvIconName }[] = [
  { kind: 'expense', label: 'Expenses', icon: 'money' },
  { kind: 'income', label: 'Income', icon: 'wallet' },
  { kind: 'transfer', label: 'Transfers', icon: 'transactions' },
];

const readTab = (): Tab => (new URLSearchParams(window.location.search).get('tab') === 'review' ? 'review' : 'activity');

const dayLabel = (iso: string, todayIso: string, yesterdayIso: string) => {
  if (iso === todayIso) return 'Today';
  if (iso === yesterdayIso) return 'Yesterday';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
};

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const TransactionsNew: React.FC<TransactionsNewProps> = ({ initialAccountFilter, initialTagFilter, onClearInitialFilters, onSyncBanks, isSyncingBanks }) => {
  const data = useTransactionsData();
  const wide = useMediaQuery('(min-width: 1024px)');
  const { openQuickAdd } = useShellNew();
  const [tab, setTab] = useState<Tab>(readTab);
  const [period, setPeriod] = useState<PeriodId>('MTD');
  const [query, setQuery] = useState('');
  const [description, setDescription] = useState('');
  const [merchants, setMerchants] = useState<string[]>([]);
  const [kinds, setKinds] = useState<TxKind[]>([]);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visible, setVisible] = useState(CHUNK);
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState(false);
  const [sort, setSort] = useState<SortId>('date-desc');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [places, setPlaces] = useState<string[]>([]);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [splitRow, setSplitRow] = useState<TxRow | null>(null);
  const [recurringRow, setRecurringRow] = useState<TxRow | null>(null);
  const [combineRows, setCombineRows] = useState<TxRow[] | null>(null);
  const [bulkRows, setBulkRows] = useState<TxRow[] | null>(null);
  const [autoAll, setAutoAll] = useState(false);
  // The open sheet follows the live row, so tags and other edits show at once.
  const openRow = useMemo(() => (openRowId ? data.rows.find(r => r.id === openRowId) ?? null : null), [openRowId, data.rows]);
  const setOpenRow = (row: TxRow | null) => setOpenRowId(row?.id ?? null);

  // Filters handed over from elsewhere in the app (an account or tag link).
  useEffect(() => {
    if (!initialAccountFilter && !initialTagFilter) return;
    const account = data.accounts.find(a => a.name === initialAccountFilter || a.id === initialAccountFilter);
    if (account) setAccountIds([account.id]);
    if (initialTagFilter) setTagIds([initialTagFilter]);
    setPeriod('ALL');
    onClearInitialFilters?.();
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // With nothing in the current month (demo data, a quiet month), start on all time and say so.
  useEffect(() => {
    if (period !== 'MTD' || !data.rows.length) return;
    const { from, to } = periodRange('MTD', new Date());
    if (!data.rows.some(r => r.date >= from! && r.date <= to!)) { setPeriod('ALL'); setAutoAll(true); }
    // Decide once when data first arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.rows.length > 0]);

  const changeTab = (next: Tab) => {
    setTab(next);
    setVisible(CHUNK);
    const url = new URL(window.location.href);
    if (next === 'review') url.searchParams.set('tab', 'review'); else url.searchParams.delete('tab');
    window.history.replaceState(null, '', url.pathname + url.search);
  };

  // Scope: the accounts picked on the balance card. Period: the header pill. Everything else narrows the list (§17).
  const range = useMemo(() => periodRange(period, new Date()), [period]);
  const prevRange = useMemo(() => previousRange(range), [range]);
  const scope = useMemo(() => filterRows(data.rows, { accountIds }), [data.rows, accountIds]);
  const inPeriod = useMemo(() => filterRows(scope, range), [scope, range]);
  const prevPeriod = useMemo(() => (prevRange ? filterRows(scope, prevRange) : []), [scope, prevRange]);
  const totals = useMemo(() => periodTotals(inPeriod, data.convert), [inPeriod, data.convert]);
  const prevTotals = useMemo(() => periodTotals(prevPeriod, data.convert), [prevPeriod, data.convert]);
  const reviewCount = useMemo(() => inPeriod.filter(needsReview).length, [inPeriod]);
  const periodLabel = PERIODS.find(p => p.value === period)?.label ?? '';

  usePageTabs<Tab>({
    label: 'Transactions view',
    value: tab,
    onChange: changeTab,
    items: [{ id: 'activity', label: 'Activity' }, { id: 'review', label: reviewCount ? `To review · ${reviewCount}` : 'To review' }],
  });

  // The header search filters this page (§13 N2); the header's violet button adds a transaction (§14 N4).
  usePageSearch({ value: query, onChange: setQuery, placeholder: 'Search transactions' });
  usePageAction({ label: 'Add transaction', icon: 'add', onClick: openQuickAdd });

  const filterSpec = useMemo(() => ({
    query, description, merchants, kinds, categories, tagIds, review: tab === 'review',
    minAmount: minAmount.trim() === '' ? undefined : parseFloat(minAmount), maxAmount: maxAmount.trim() === '' ? undefined : parseFloat(maxAmount),
  }), [query, description, merchants, kinds, categories, tagIds, tab, minAmount, maxAmount]);
  const base = useMemo(() => filterRows(inPeriod, filterSpec), [inPeriod, filterSpec]);
  const shown = useMemo(() => sortRows(filterRows(base, { places, weekdays }), sort), [base, places, weekdays, sort]);
  // The chart ignores the day filter and the map ignores the place filter, so each can be switched while the other is set.
  const clusters = useMemo(() => placeClusters(filterRows(base, { weekdays }), data.convert), [base, weekdays, data.convert]);
  const unplaced = useMemo(() => base.filter(r => r.city && r.lat === undefined).length, [base]);
  // The four KPIs follow the list (classic parity): every filter applies, and the change compares with the same filters one period back.
  const kpi = useMemo(() => kpiTotals(shown, data.convert), [shown, data.convert]);
  const prevKpi = useMemo(() => kpiTotals(filterRows(filterRows(prevPeriod, filterSpec), { places, weekdays }), data.convert), [prevPeriod, filterSpec, places, weekdays, data.convert]);

  const pctOf = (cur: number, prev: number) => (prev === 0 ? null : Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10);
  const top = useMemo(() => topCategory(inPeriod, data.convert), [inPeriod, data.convert]);
  const balanceAccts = useMemo(() => balanceAccounts(data.accounts), [data.accounts]);
  const balance = useMemo(
    () => (accountIds.length ? totalBalance(data.accounts, accountIds, data.convert) : totalBalance(balanceAccts, [], data.convert)),
    [accountIds, data.accounts, balanceAccts, data.convert],
  );
  const toggleIn = <T,>(set: React.Dispatch<React.SetStateAction<T[]>>) => (v: T) => set(list => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]));
  useEffect(() => setVisible(CHUNK), [query, description, merchants, kinds, accountIds, categories, tagIds, places, weekdays, minAmount, maxAmount, sort, period]);
  const dated = isDateSort(sort);
  const groups = useMemo(() => (dated ? groupByDay(shown.slice(0, visible)) : [{ date: '', rows: shown.slice(0, visible) }]), [dated, shown, visible]);
  const today = isoOf(new Date());
  const yesterday = isoOf(new Date(Date.now() - 86_400_000));

  const activeFilterCount = (description.trim() ? 1 : 0) + merchants.length + accountIds.length + categories.length + tagIds.length + places.length + weekdays.length + (minAmount.trim() !== '' ? 1 : 0) + (maxAmount.trim() !== '' ? 1 : 0);
  const clearFilters = () => { setAccountIds([]); setCategories([]); setTagIds([]); setDescription(''); setMerchants([]); setPlaces([]); setWeekdays([]); setMinAmount(''); setMaxAmount(''); };
  const clearAll = () => { setQuery(''); setKinds([]); clearFilters(); };

  const subtitleFor = (row: TxRow) => {
    const account = data.accountsById.get(row.accountId)?.name ?? 'Unknown account';
    const when = dated ? '' : `${new Date(`${row.date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · `;
    if (row.kind === 'transfer') return `${when}${account} → ${row.toAccountId ? data.accountsById.get(row.toAccountId)?.name ?? 'Unknown' : '?'}`;
    return `${when}${account}`;
  };

  const selectedRows = shown.filter(r => selected.has(r.id));
  const toggleMany = (ids: string[], on: boolean) =>
    setSelected(s => {
      const next = new Set(s);
      ids.forEach(id => (on ? next.add(id) : next.delete(id)));
      setSelecting(next.size > 0);
      return next;
    });
  const toggle = (id: string) =>
    setSelected(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelecting(next.size > 0);
      return next;
    });
  const endSelect = () => { setSelecting(false); setSelected(new Set()); };

  const exportCsv = () => {
    if (!shown.length) { toast.info('Nothing to export'); return; }
    const csv = rowsToCsv(shown, id => (id ? data.accountsById.get(id)?.name ?? '' : ''), id => data.tagsById.get(id)?.name ?? id);
    downloadCSV(csv, `crystal-transactions-${today}.csv`);
    toast.success(`Exported ${shown.length} transaction${shown.length === 1 ? '' : 's'}`);
  };

  const bulkDelete = async () => {
    if (!selectedRows.length) return;
    const ok = selectedRows.length === 1 || await confirmNew({
      title: `Delete ${selectedRows.length} transactions?`,
      message: 'You can undo this for a few seconds afterwards.',
      danger: true,
      confirmLabel: 'Hold to delete',
    });
    if (!ok) return;
    const result = data.remove(selectedRows);
    if (result.ok) toast.undo(`Deleted ${selectedRows.length} transaction${selectedRows.length === 1 ? '' : 's'}`, result.undo);
    endSelect();
  };

  const applyCategory = (category: string) => {
    const result = data.recategorize(selectedRows, category);
    setBulkCategory(false);
    if ('error' in result) { toast.info(result.error); return; }
    toast.undo(`Set ${category} on ${selectedRows.length} transaction${selectedRows.length === 1 ? '' : 's'}`, result.undo);
    endSelect();
  };

  const isFilteredTo = useCallback(
    (f: CellFilter): boolean => {
      switch (f.kind) {
        case 'account':
          return accountIds.length === 1 && accountIds[0] === f.value;
        case 'category':
          return categories.length === 1 && categories[0] === f.value;
        case 'merchant':
          return merchants.length === 1 && merchants[0] === f.value;
        case 'location':
          return places.length === 1 && places[0] === f.value;
        case 'tag':
          return tagIds.length === 1 && tagIds[0] === f.value;
        default:
          return false;
      }
    },
    [accountIds, categories, merchants, places, tagIds]
  );

  const onFilterTo = useCallback(
    (f: CellFilter) => {
      const active = isFilteredTo(f);
      switch (f.kind) {
        case 'account':
          setAccountIds(active ? [] : [f.value]);
          break;
        case 'category':
          setCategories(active ? [] : [f.value]);
          break;
        case 'merchant':
          setMerchants(active ? [] : [f.value]);
          break;
        case 'location':
          setPlaces(active ? [] : [f.value]);
          break;
        case 'tag':
          setTagIds(active ? [] : [f.value]);
          break;
      }
      if (!active) {
        toast.info(`Filtered to ${f.kind}: "${f.label}"`);
      }
    },
    [isFilteredTo]
  );

  const rowMenu = useCallback(
    (row: TxRow): RowMenuEntry[] => {
      const entries: RowMenuEntry[] = [
        {
          icon: 'edit',
          label: 'Edit transaction',
          onClick: () => setOpenRow(row),
        },
      ];

      if (row.split) {
        entries.push({
          icon: 'combine',
          label: 'Unsplit transaction',
          onClick: () => {
            const res = data.unsplit(row);
            if ('undo' in res) toast.undo('Unsplit transaction', res.undo);
            else if ('error' in res) toast.info(res.error);
          },
        });
      } else if (row.combined) {
        entries.push({
          icon: 'split',
          label: 'Uncombine transaction',
          onClick: () => {
            const res = data.uncombine(row);
            if ('undo' in res) toast.undo('Uncombined transaction', res.undo);
            else if ('error' in res) toast.info(res.error);
          },
        });
      } else if (row.kind !== 'transfer' && !row.adjustment) {
        entries.push({
          icon: 'split',
          label: 'Split transaction',
          onClick: () => setSplitRow(row),
        });
      }

      entries.push({
        icon: 'copy',
        label: 'Duplicate',
        onClick: () => {
          const res = data.duplicate(row, today);
          if ('undo' in res) toast.undo(`Duplicated "${row.title}"`, res.undo);
        },
      });

      if (row.kind !== 'transfer') {
        entries.push({
          icon: 'repeat',
          label: 'Make recurring',
          onClick: () => setRecurringRow(row),
        });
      }

      if (row.located && (row.city || row.placeKey || row.country)) {
        entries.push({
          icon: 'pin',
          label: 'Remove location',
          onClick: () => {
            const res = data.clearLocation([row]);
            if ('undo' in res) toast.undo('Removed location', res.undo);
            else if ('error' in res) toast.info(res.error);
          },
        });
      }

      entries.push({
        icon: 'delete',
        label: 'Delete',
        danger: true,
        separatorBefore: true,
        onClick: async () => {
          const ok = await confirmNew({
            title: `Delete "${row.title}"?`,
            message: 'You can undo this for a few seconds afterwards.',
            danger: true,
            confirmLabel: 'Hold to delete',
          });
          if (!ok) return;
          const res = data.remove([row]);
          if ('undo' in res) toast.undo(`Deleted "${row.title}"`, res.undo);
        },
      });

      return entries;
    },
    [data, today]
  );

  const allCategoryOptions = useMemo(() => {
    const seen = new Set<string>();
    return [...data.categories.expense, ...data.categories.income]
      .filter(c => (seen.has(c.name) ? false : (seen.add(c.name), true)))
      .map(c => ({ value: c.name, label: c.parent ? `${c.parent} › ${c.name}` : c.name, color: c.color, icon: c.icon }));
  }, [data.categories]);

  const accountOptions = useMemo(() => accountFilterOptions(data.accounts, data.logoFor), [data.accounts, data.logoFor]);
  const categoryOptions = useMemo(() => categoryFilterOptions(data.categories), [data.categories]);
  const placeFilterOptions = useMemo<FilterOption[]>(() => data.places.map(p => ({ id: p.key, label: p.label, hint: String(p.count) })), [data.places]);
  const tagOptions = useMemo(() => tagFilterOptions(data.tags), [data.tags]);
  const merchantOptionList = useMemo(() => merchantFilterOptions(data.merchants, data.logoFor), [data.merchants, data.logoFor]);

  const detailFields = (
    <div className="space-y-4">
      <TextField label="Description" value={description} onChange={setDescription} placeholder="Search description" icon="search" />
      <div>
        <p className="mb-1.5 text-[13px] text-nv-muted">Merchant</p>
        <FilterList label="Merchants" options={merchantOptionList} selected={merchants} onChange={setMerchants} searchFrom={1} emptyText="No merchants yet." />
      </div>
    </div>
  );
  const accountQuick = useMemo(() => accountQuickFilters(data.accounts), [data.accounts]);

  const columnFilters: ColumnFilters = {
    details: { count: (description.trim() ? 1 : 0) + merchants.length, title: 'Details and merchant', content: detailFields },
    account: { count: accountIds.length, title: 'Accounts', content: <FilterList label="Accounts" quick={accountQuick} options={accountOptions} selected={accountIds} onChange={setAccountIds} /> },
    category: { count: categories.length, title: 'Categories', content: <FilterList label="Categories" options={categoryOptions} selected={categories} onChange={setCategories} /> },
    location: { count: places.length, title: 'Locations', content: <FilterList label="Locations" options={placeFilterOptions} selected={places} onChange={setPlaces} emptyText="No transaction has a location yet." /> },
    tags: { count: tagIds.length, title: 'Tags', content: <FilterList label="Tags" options={tagOptions} selected={tagIds} onChange={setTagIds} emptyText="No tags yet." /> },
    value: {
      count: kinds.length + (minAmount.trim() !== '' ? 1 : 0) + (maxAmount.trim() !== '' ? 1 : 0),
      title: 'Value and type',
      content: (
        <>
          <FilterGroup compact title="Type" options={KIND_CHIPS.map(k => ({ id: k.kind, label: k.label }))} selected={kinds} onChange={ids => setKinds(ids as TxKind[])} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="From" type="number" value={minAmount} onChange={setMinAmount} placeholder="0" />
            <TextField label="Up to" type="number" value={maxAmount} onChange={setMaxAmount} placeholder="No limit" />
          </div>
        </>
      ),
    },
  };


  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      {/* Unified hero card: total balance, account count, cash flow summary, and interactive map */}
      <TransactionsHeroCard
        total={balance.total}
        accountCount={balance.count}
        currency={data.displayCurrency}
        stats={kpi}
        deltas={{
          count: pctOf(kpi.count, prevKpi.count),
          income: pctOf(kpi.income, prevKpi.income),
          expense: pctOf(kpi.expense, prevKpi.expense),
          net: pctOf(kpi.net, prevKpi.net),
        }}
        activeKinds={kinds}
        onToggleKind={toggleIn(setKinds)}
        clusters={clusters}
        selectedPlaces={places}
        onTogglePlace={toggleIn(setPlaces)}
        unplaced={unplaced}
      />

      {/* Controls live in the header band (§14 N5): period, filters, type chips and active filters; the tools are on the tabs row (§15 N6). */}
      <HeaderTools>
        <IconButton icon="select" label={selecting ? 'Stop selecting' : 'Select transactions'} tone={selecting ? 'ink' : 'chip'} onClick={() => (selecting ? endSelect() : setSelecting(true))} />
        <IconButton icon="download" label="Export CSV" tone="chip" onClick={exportCsv} />
        {onSyncBanks && <Button variant="success" icon="refresh" onClick={onSyncBanks} disabled={isSyncingBanks} aria-label={isSyncingBanks ? 'Syncing banks' : 'Sync banks'}>{isSyncingBanks ? 'Syncing' : 'Sync'}</Button>}
      </HeaderTools>
      <HeaderControls>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPill<PeriodId> label="Period" value={period} onChange={p => { setPeriod(p); setAutoAll(false); }} options={PERIODS} />
          <Button size="md" icon="filter" onClick={() => setFiltersOpen(true)}>Filters{activeFilterCount ? ` · ${activeFilterCount}` : ''}</Button>
          <PeriodPill<SortId> label="Sort" value={sort} onChange={setSort} options={SORTS} />
          {KIND_CHIPS.map(({ kind, label, icon }) => (
            <FilterChip key={kind} label={label} icon={icon} active={kinds.includes(kind)} onClick={() => setKinds(k => (k.includes(kind) ? k.filter(x => x !== kind) : [...k, kind]))} />
          ))}
          {description.trim() !== '' && <FilterChip label={`Description: ${description}`} onRemove={() => setDescription('')} />}
          {merchants.map(m => <FilterChip key={m} label={m} onRemove={() => setMerchants(ms => ms.filter(x => x !== m))} />)}
          {minAmount.trim() !== '' && <FilterChip label={`From ${minAmount}`} onRemove={() => setMinAmount('')} />}
          {maxAmount.trim() !== '' && <FilterChip label={`Up to ${maxAmount}`} onRemove={() => setMaxAmount('')} />}
          {places.map(k => <FilterChip key={k} label={data.places.find(p => p.key === k)?.label ?? k} icon="pin" onRemove={() => setPlaces(ps => ps.filter(x => x !== k))} />)}
          {weekdays.map(d => <FilterChip key={d} label={DAY_NAMES[d]} icon="calendar" onRemove={() => setWeekdays(ds => ds.filter(x => x !== d))} />)}
          {accountIds.map(id => <FilterChip key={id} label={data.accountsById.get(id)?.name ?? 'Account'} onRemove={() => setAccountIds(a => a.filter(x => x !== id))} />)}
          {categories.map(c => <FilterChip key={c} label={c} onRemove={() => setCategories(cs => cs.filter(x => x !== c))} />)}
          {tagIds.map(id => <FilterChip key={id} label={data.tagsById.get(id)?.name ?? 'Tag'} onRemove={() => setTagIds(t => t.filter(x => x !== id))} />)}
          {(query || kinds.length > 0 || activeFilterCount > 0) && <Button size="sm" variant="ghost" onClick={clearAll}>Clear all</Button>}
        </div>
        {autoAll && <p className="mt-3 text-[13px] text-nv-muted">Nothing this month yet, so this shows all time.</p>}
      </HeaderControls>

      {/* List */}
      <Card className="px-2 py-3 sm:px-3 sm:py-4">
        {shown.length === 0 ? (
          tab === 'review' && !query && !kinds.length && !activeFilterCount
            ? <EmptyState icon="checkCircle" title="Nothing to review" body="Every transaction in this period has a category." />
            : data.rows.length === 0
              ? <EmptyState icon="transactions" title="Add your first transaction" body="Track spending, income and transfers between your accounts." action={<Button variant="primary" icon="add" onClick={openQuickAdd}>Add transaction</Button>} />
              : query || kinds.length || activeFilterCount
                ? <EmptyState icon="search" title="No matching transactions" body="Try another search, period or filter." action={<Button onClick={clearAll}>Clear filters</Button>} />
                : <EmptyState icon="calendar" title={`Nothing in ${PERIODS.find(p => p.value === period)?.label.toLowerCase()}`} body="Choose a longer period to see earlier transactions." action={<Button onClick={() => setPeriod('ALL')}>Show all time</Button>} />
        ) : (
          <>
            <p className="sr-only" aria-live="polite">{shown.length} transactions</p>
            {wide ? (
              <TransactionTable
                groups={groups}
                dated={dated}
                dayLabel={iso => dayLabel(iso, today, yesterday)}
                data={data}
                sort={sort}
                onSort={setSort}
                selecting={selecting}
                selected={selected}
                onToggle={toggle}
                onToggleMany={toggleMany}
                onOpen={setOpenRow}
                filters={columnFilters}
                rowMenu={rowMenu}
                onFilterTo={onFilterTo}
                isFilteredTo={isFilteredTo}
                onSelectRow={row => { setSelecting(true); setSelected(new Set([row.id])); }}
              />
            ) : (
              <>
            {groups.map(group => (
              <section key={group.date || 'all'} aria-label={dated ? dayLabel(group.date, today, yesterday) : 'Transactions'} className="mb-2 last:mb-0">
                {dated && (
                  <h3 data-nv-index className="sticky top-0 z-dropdown flex items-baseline justify-between bg-nv-tile px-2 py-2 text-[13px] font-medium text-nv-muted sm:px-3">
                    <span>{dayLabel(group.date, today, yesterday)}</span>
                    <span className="nv-tabular">{group.rows.length}</span>
                  </h3>
                )}
                <ul>
                  {group.rows.map(row => (
                    <TransactionRowItem
                      key={row.id}
                      row={row}
                      logoUrl={data.logoFor(row.merchant)}
                      color={data.categoryByName.get(row.category)?.color}
                      icon={data.categoryByName.get(row.category)?.icon}
                      subtitle={subtitleFor(row)}
                      selecting={selecting}
                      selected={selected.has(row.id)}
                      onOpen={() => setOpenRow(row)}
                      onToggle={() => toggle(row.id)}
                    />
                  ))}
                </ul>
              </section>
            ))}
              </>
            )}
            {shown.length > visible && (
              <div className="flex justify-center pt-2">
                <button type="button" onClick={() => setVisible(v => v + CHUNK)} className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-nv-violet-text hover:bg-nv-violet-soft">
                  Show {Math.min(CHUNK, shown.length - visible)} more of {shown.length - visible}
                  <NvIcon name="arrowDown" size={16} />
                </button>
              </div>
            )}
            {shown.length > CHUNK && visible > CHUNK && visible >= shown.length && (
              <div className="flex justify-center pt-2"><MoreButton expanded total={shown.length} onToggle={() => setVisible(CHUNK)} /></div>
            )}
          </>
        )}
      </Card>

      {/* Selection bar */}
      {(selecting || selected.size > 0) && (
        <div className="fixed inset-x-0 bottom-28 z-sticky flex justify-center px-4 lg:bottom-6 lg:pl-72">
          <div className="flex max-w-full flex-wrap items-center justify-center gap-1 rounded-[28px] bg-nv-ink py-2 pl-5 pr-2 text-nv-on-ink shadow-nv-float">
            <span className="mr-2 text-sm font-medium nv-tabular">{selected.size} selected</span>
            <button type="button" onClick={() => setSelected(new Set(shown.map(r => r.id)))} className="h-10 rounded-full px-3 text-sm hover:bg-nv-on-ink/10">Select all {shown.length}</button>
            <button type="button" disabled={!selected.size} onClick={() => setBulkCategory(true)} className="h-10 rounded-full px-3 text-sm hover:bg-nv-on-ink/10 disabled:opacity-40">Categorize</button>
            <button type="button" disabled={!selected.size} onClick={() => setBulkRows(selectedRows)} className="h-10 rounded-full px-3 text-sm hover:bg-nv-on-ink/10 disabled:opacity-40">Edit</button>
            <button type="button" disabled={!canCombineRows(selectedRows)} onClick={() => setCombineRows(selectedRows)} className="h-10 rounded-full px-3 text-sm hover:bg-nv-on-ink/10 disabled:opacity-40">Combine</button>
            <button type="button" disabled={!(selectedRows.length === 1 && selectedRows[0].kind !== 'transfer' && !selectedRows[0].combined && !selectedRows[0].adjustment)} onClick={() => setSplitRow(selectedRows[0])} className="h-10 rounded-full px-3 text-sm hover:bg-nv-on-ink/10 disabled:opacity-40">Split</button>
            <button type="button" disabled={!selected.size} onClick={bulkDelete} className="h-10 rounded-full px-3 text-sm hover:bg-nv-on-ink/10 disabled:opacity-40">Delete</button>
            <button type="button" onClick={endSelect} aria-label="Stop selecting" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-nv-on-ink/10"><NvIcon name="close" size={18} /></button>
          </div>
        </div>
      )}

      {/* Filters */}
      <Drawer open={filtersOpen} onOpenChange={setFiltersOpen} title="Filters" footer={<div className="flex gap-3"><Button size="lg" onClick={clearFilters}>Reset</Button><Button variant="primary" size="lg" className="flex-1" onClick={() => setFiltersOpen(false)}>Show {shown.length} transactions</Button></div>}>
 <fieldset className="mb-6">
          <legend className="mb-2 text-[13px] font-medium text-nv-muted">Amount</legend>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="From" type="number" value={minAmount} onChange={setMinAmount} placeholder="0" />
            <TextField label="Up to" type="number" value={maxAmount} onChange={setMaxAmount} placeholder="No limit" />
          </div>
        </fieldset>
        <DrawerSection title="Details"><TextField label="Description" value={description} onChange={setDescription} placeholder="Search description" /></DrawerSection>
        {merchantOptionList.length > 0 && <DrawerSection title="Merchants" count={merchants.length}><FilterList label="Merchants" options={merchantOptionList} selected={merchants} onChange={setMerchants} /></DrawerSection>}
        <DrawerSection title="Type"><FilterGroup compact title="" options={KIND_CHIPS.map(k => ({ id: k.kind, label: k.label }))} selected={kinds} onChange={ids => setKinds(ids as TxKind[])} /></DrawerSection>
        <DrawerSection title="Accounts" count={accountIds.length}><FilterList label="Accounts" quick={accountQuick} options={accountOptions} selected={accountIds} onChange={setAccountIds} /></DrawerSection>
        <DrawerSection title="Categories" count={categories.length}><FilterList label="Categories" options={categoryOptions} selected={categories} onChange={setCategories} /></DrawerSection>
        {placeFilterOptions.length > 0 && <DrawerSection title="Locations" count={places.length}><FilterList label="Locations" options={placeFilterOptions} selected={places} onChange={setPlaces} /></DrawerSection>}
        {tagOptions.length > 0 && <DrawerSection title="Tags" count={tagIds.length}><FilterList label="Tags" options={tagOptions} selected={tagIds} onChange={setTagIds} /></DrawerSection>}
      </Drawer>

      {/* Bulk categorize */}
      <Drawer open={bulkCategory} onOpenChange={setBulkCategory} title="Categorize" description={`${selectedRows.length} transaction${selectedRows.length === 1 ? '' : 's'}. A category of the other kind changes the type, and a transfer becomes an ordinary transaction.`}>
        <PickerField label="Category" placeholder="Choose a category" value="" onChange={applyCategory} options={allCategoryOptions} />
      </Drawer>

      <TransactionSheet
        row={openRow}
        onClose={() => setOpenRow(null)}
        data={data}
        actions={{ split: row => { setOpenRow(null); setSplitRow(row); }, recurring: row => { setOpenRow(null); setRecurringRow(row); } }}
      />
      {splitRow && <SplitSheet row={splitRow} data={data} onClose={() => { setSplitRow(null); endSelect(); }} />}
      {recurringRow && <RecurringSheet row={recurringRow} data={data} onClose={() => setRecurringRow(null)} />}
      {combineRows && <CombineSheet rows={combineRows} data={data} onClose={() => setCombineRows(null)} onDone={() => { setCombineRows(null); endSelect(); }} />}
      {bulkRows && <BulkEditSheet rows={bulkRows} data={data} onClose={() => setBulkRows(null)} onDone={() => { setBulkRows(null); endSelect(); }} />}
    </div>
  );
};

const DrawerSection: React.FC<{ title: string; count?: number; children: React.ReactNode }> = ({ title, count, children }) => (
  <section className="mb-6">
    <h3 className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-nv-ink">{title}{!!count && <span className="nv-tabular rounded-full bg-nv-ink px-2 text-[12px] font-semibold text-nv-on-ink">{count}</span>}</h3>
    {children}
  </section>
);

const FilterGroup: React.FC<{ compact?: boolean; title: string; options: { id: string; label: string; color?: string }[]; selected: string[]; onChange: (ids: string[]) => void }> = ({ compact, title, options, selected, onChange }) => (
  <fieldset className="mb-6 last:mb-0">
    {title && <legend className="mb-2 text-[13px] font-medium text-nv-muted">{title}</legend>}
    <div className="flex flex-wrap gap-2">
      {options.map(o => {
        const on = selected.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? selected.filter(x => x !== o.id) : [...selected, o.id])}
            className={cn('inline-flex items-center gap-2 rounded-full border font-medium', compact ? 'h-9 px-3 text-[13px]' : 'h-11 px-4 text-sm', on ? 'border-nv-ink bg-nv-ink text-nv-on-ink' : 'border-nv-line bg-nv-inset text-nv-ink')}
          >
            {o.color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: o.color }} aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  </fieldset>
);
