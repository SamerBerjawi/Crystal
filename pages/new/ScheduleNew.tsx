import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { BillPayment, RecurringTransaction } from '../../types';
import { formatShortDate } from '../../utils/dateFormat';
import { parseLocalDate } from '../../utils';
import {
  billsFor, dailyCommitted, emptyFilters, filterCount, filterOccurrences, groupUpcoming, iso, oldUnpaidBills, owningAccountId,
  summarize, type BillTab, type Flow, type Occurrence, type OccurrenceSource, type ScheduleFilters, type SeriesRow,
} from '../../utils/scheduleModel';
import { useScheduleData } from '../../hooks/useScheduleData';
import { usePageAction, usePageSearch, useShellNew } from '../../components/new/shellContext';
import {
  ActiveFilters, ChoiceChips, FilterButton, FilterSection, FilterSheet, FilterToggle, PageToolbar, ToolButton, ToolbarSpacer,
  type ActiveFilter,
} from '../../components/new/PageToolbar';
import { Button, Card, EmptyState, MoreButton, SegmentedTabs } from '../../components/new/ui';
import { confirmNew } from '../../components/new/ConfirmDialog';
import { toast } from '../../components/new/toast';
import type { NvIconName } from '../../components/new/NvIcon';
import { ScheduleHero } from '../../components/new/schedule/overview';
import { GroupHeader, OccurrenceRow, type MenuEntry } from '../../components/new/schedule/parts';
import { MonthCalendar, MonthNav } from '../../components/new/schedule/calendar';
import { BillsView, SeriesView } from '../../components/new/schedule/lists';
import { OccurrenceSheet, PaySheet, ScheduleFormSheet, type FormTarget } from '../../components/new/schedule/sheets';

/*
 * ScheduleNew (docs/SCHEDULE_NEW_PLAN.md): what money is due when, and the place to change it. The header holds the
 * search and "Add schedule"; the tabs and one Filters button sit in the page (§21, N20 to N24). Logic lives in
 * utils/scheduleModel.ts and hooks/useScheduleData.ts.
 */

type Tab = 'upcoming' | 'calendar' | 'series' | 'bills';
const TABS: Tab[] = ['upcoming', 'calendar', 'series', 'bills'];
const TAB_KEY = 'crystal-new.schedule-tab';
const CAP = 8;

const readTab = (): Tab => {
  const fromHash = window.location.hash.replace('#', '') as Tab;
  if (TABS.includes(fromHash)) return fromHash;
  try { const stored = window.localStorage.getItem(TAB_KEY) as Tab | null; if (stored && TABS.includes(stored)) return stored; } catch { /* per-device convenience */ }
  return 'upcoming';
};

const FLOW_CHOICES: { id: Flow; label: string; icon: NvIconName }[] = [
  { id: 'out', label: 'Spending', icon: 'shoppingBag' },
  { id: 'in', label: 'Income', icon: 'money' },
  { id: 'move', label: 'Between accounts', icon: 'transfer' },
];
const SOURCE_CHOICES: { id: OccurrenceSource; label: string; icon: NvIconName }[] = [
  { id: 'recurring', label: 'Recurring', icon: 'repeat' },
  { id: 'bill', label: 'Bills', icon: 'invoice' },
  { id: 'loan', label: 'Loans', icon: 'bank' },
  { id: 'card', label: 'Cards', icon: 'card' },
  { id: 'property', label: 'Property', icon: 'home' },
];

export const ScheduleNew: React.FC = () => {
  const data = useScheduleData();
  const { navigate } = useShellNew();

  const [tab, setTabState] = useState<Tab>(readTab);
  const setTab = useCallback((next: Tab) => {
    setTabState(next);
    try { window.localStorage.setItem(TAB_KEY, next); } catch { /* per-device convenience */ }
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${next}`);
  }, []);

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<ScheduleFilters>(emptyFilters);
  const [day, setDay] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [billTab, setBillTab] = useState<BillTab>('unpaid');
  const [calendar, setCalendar] = useState(() => ({ year: data.today.getFullYear(), month: data.today.getMonth(), selected: iso(data.today) }));

  const [selected, setSelected] = useState<Occurrence | null>(null);
  const [paying, setPaying] = useState<Occurrence | null>(null);
  const [form, setForm] = useState<FormTarget | null>(null);

  usePageSearch({ value: query, onChange: setQuery, placeholder: 'Search payments' });
  usePageAction({ label: 'Add schedule', icon: 'add', onClick: () => setForm({ mode: 'new' }) });

  // Filters scope the hero and every tab; the search only narrows the lists.
  const scoped = useMemo(() => filterOccurrences(data.occurrences, filters, '', data.accountName), [data.occurrences, filters, data.accountName]);
  const listed = useMemo(() => {
    const searched = filterOccurrences(scoped, emptyFilters(), query, data.accountName);
    return day ? searched.filter(o => o.date === day || (o.status === 'overdue' && day === iso(data.today))) : searched;
  }, [scoped, query, day, data.accountName, data.today]);
  const summary = useMemo(() => summarize(scoped, data.today, data.convert), [scoped, data.today, data.convert]);
  const days = useMemo(() => dailyCommitted(scoped, data.today, data.convert), [scoped, data.today, data.convert]);
  const groups = useMemo(() => groupUpcoming(listed, data.today, data.convert), [listed, data.today, data.convert]);

  const billCounts = useMemo(() => ({
    unpaid: data.bills.filter(b => b.status === 'unpaid').length,
    paid: data.bills.filter(b => b.status === 'paid').length,
    expired: data.bills.filter(b => b.status === 'expired').length,
  }), [data.bills]);
  const billList = useMemo(() => {
    const q = query.trim().toLowerCase();
    return billsFor(data.bills, billTab).filter(b => !q || b.description.toLowerCase().includes(q) || data.accountName(b.accountId).toLowerCase().includes(q));
  }, [data.bills, billTab, query, data.accountName]);
  const oldBills = useMemo(() => oldUnpaidBills(data.bills, data.today), [data.bills, data.today]);

  // ---- actions -------------------------------------------------------------------------------------------

  const toastResult = (r: { ok: true; undo: () => void } | { ok: false; error: string }, message: string) => {
    if ('error' in r) toast.error(r.error); else toast.undo(message, r.undo);
  };

  const openAccount = (rt?: RecurringTransaction) => {
    const id = rt ? owningAccountId(rt) : undefined;
    if (!rt || !id) return;
    navigate(`/accounts-new/${id}${rt.id.startsWith('loan-pmt-') ? '#plan' : ''}`);
  };

  const deleteSeries = async (rt: RecurringTransaction) => {
    const ok = await confirmNew({ title: `Delete "${rt.merchant || rt.description}"?`, message: 'Every future payment of this series goes too. Payments already made stay.', confirmLabel: 'Hold to delete', danger: true });
    if (ok) { data.deleteSeries(rt); setSelected(null); }
  };

  const deleteBill = async (bill: BillPayment) => {
    const ok = await confirmNew({ title: `Delete "${bill.description}"?`, confirmLabel: 'Hold to delete', danger: true });
    if (ok) { toastResult(data.deleteBill(bill), 'Bill deleted'); setSelected(null); }
  };

  const occurrenceMenu = (o: Occurrence): MenuEntry[] => {
    const entries: MenuEntry[] = [];
    const open = o.status !== 'paid' && o.status !== 'skipped';
    if (o.isReadOnly) {
      entries.push({ label: o.source === 'card' ? 'Open card' : o.source === 'loan' ? 'Open payment plan' : 'Open property', icon: 'external', onClick: () => openAccount(o.series) });
      return entries;
    }
    if (open) entries.push({ label: 'Mark paid', icon: 'checkCircle', onClick: () => setPaying(o) });
    if (o.source === 'recurring' && o.series) {
      const rt = data.seriesById.get(o.sourceId);
      if (o.status === 'skipped') entries.push({ label: 'Bring back', icon: 'undo', onClick: () => toastResult(data.setSkipped(o, false), 'Payment brought back') });
      else if (open) entries.push({ label: 'Skip this payment', icon: 'close', onClick: () => toastResult(data.setSkipped(o, true), 'Payment skipped') });
      entries.push({ label: 'Change this payment', icon: 'edit', onClick: () => setSelected(o) });
      if (o.isOverride) entries.push({ label: 'Undo changes to this payment', icon: 'undo', onClick: () => toastResult(data.clearChanges(o), 'Changes undone') });
      if (rt) {
        entries.push({ label: 'Edit this and future', icon: 'repeat', onClick: () => setForm({ mode: 'future', series: rt, originalDate: o.originalDate }) });
        entries.push({ label: 'Edit every payment', icon: 'settings', onClick: () => setForm({ mode: 'series', series: rt }) });
        entries.push({ label: 'End series here', icon: 'archive', onClick: () => toastResult(data.endSeries(rt, o.originalDate), `Ends after ${formatShortDate(o.originalDate, data.today)}`) });
        entries.push({ label: 'Delete series', icon: 'delete', danger: true, onClick: () => deleteSeries(rt) });
      }
    }
    if (o.source === 'bill' && o.bill) {
      const bill = o.bill;
      entries.push({ label: 'Edit bill', icon: 'edit', onClick: () => setForm({ mode: 'bill', bill }) });
      entries.push({ label: 'Expire', icon: 'archive', onClick: () => toastResult(data.setBillStatus([bill], 'expired'), 'Bill expired') });
      entries.push({ label: 'Delete bill', icon: 'delete', danger: true, onClick: () => deleteBill(bill) });
    }
    return entries;
  };

  const billOccurrence = (bill: BillPayment): Occurrence | undefined =>
    data.occurrences.find(o => o.source === 'bill' && o.sourceId === bill.id);

  const billMenu = (bill: BillPayment): MenuEntry[] => {
    const entries: MenuEntry[] = [];
    if (bill.status === 'unpaid') {
      const o = billOccurrence(bill);
      if (o) entries.push({ label: 'Mark paid', icon: 'checkCircle', onClick: () => setPaying(o) });
      entries.push({ label: 'Expire', icon: 'archive', onClick: () => toastResult(data.setBillStatus([bill], 'expired'), 'Bill expired') });
    }
    if (bill.status === 'expired') entries.push({ label: 'Restore', icon: 'undo', onClick: () => toastResult(data.setBillStatus([bill], 'unpaid'), 'Bill restored') });
    if (bill.status === 'paid') entries.push({ label: 'Mark unpaid', icon: 'undo', onClick: () => toastResult(data.setBillStatus([bill], 'unpaid'), 'Bill marked unpaid') });
    entries.push({ label: 'Edit bill', icon: 'edit', onClick: () => setForm({ mode: 'bill', bill }) });
    entries.push({ label: 'Delete bill', icon: 'delete', danger: true, onClick: () => deleteBill(bill) });
    return entries;
  };

  const seriesMenu = (row: SeriesRow): MenuEntry[] => {
    if (row.source !== 'recurring') return [{ label: row.source === 'card' ? 'Open card' : row.source === 'loan' ? 'Open payment plan' : 'Open property', icon: 'external', onClick: () => openAccount(row.series) }];
    const rt = row.series;
    const entries: MenuEntry[] = [{ label: 'Edit', icon: 'edit', onClick: () => setForm({ mode: 'series', series: rt }) }];
    if (!row.ended && row.next) entries.push({ label: 'End after next payment', icon: 'archive', onClick: () => toastResult(data.endSeries(rt, nextAfter(rt, row.next!)), 'Series ends after its next payment') });
    if (row.ended) entries.push({ label: 'Start again', icon: 'refresh', onClick: () => toastResult(data.saveSeries({ ...rt, endDate: undefined }), 'Series running again') });
    entries.push({ label: 'Delete series', icon: 'delete', danger: true, onClick: () => deleteSeries(rt) });
    return entries;
  };

  /** The original date after `next`, so ending there keeps `next` as the last payment. */
  const nextAfter = (rt: RecurringTransaction, next: string) => {
    const following = data.occurrences.filter(o => o.sourceId === rt.id && o.date > next).map(o => o.originalDate)[0];
    return following ?? iso(new Date(parseLocalDate(next).getTime() + 86400000));
  };

  // ---- filters --------------------------------------------------------------------------------------------

  const active: ActiveFilter[] = [
    ...filters.flows.map(f => ({ key: `flow-${f}`, label: FLOW_CHOICES.find(c => c.id === f)!.label, icon: FLOW_CHOICES.find(c => c.id === f)!.icon, onRemove: () => setFilters(p => ({ ...p, flows: p.flows.filter(x => x !== f) })) })),
    ...filters.sources.map(s => ({ key: `src-${s}`, label: SOURCE_CHOICES.find(c => c.id === s)!.label, icon: SOURCE_CHOICES.find(c => c.id === s)!.icon, onRemove: () => setFilters(p => ({ ...p, sources: p.sources.filter(x => x !== s) })) })),
    ...filters.accountIds.map(id => ({ key: `acc-${id}`, label: data.accountName(id), icon: 'bank' as NvIconName, onRemove: () => setFilters(p => ({ ...p, accountIds: p.accountIds.filter(x => x !== id) })) })),
    ...filters.categories.map(c => ({ key: `cat-${c}`, label: c, icon: 'tag' as NvIconName, onRemove: () => setFilters(p => ({ ...p, categories: p.categories.filter(x => x !== c) })) })),
    ...(!filters.showSkipped ? [{ key: 'skip', label: 'Skipped hidden', icon: 'viewOff' as NvIconName, onRemove: () => setFilters(p => ({ ...p, showSkipped: true })) }] : []),
    ...(day ? [{ key: 'day', label: formatShortDate(day, data.today), icon: 'calendar' as NvIconName, onRemove: () => setDay(null) }] : []),
  ];

  const usedCategories = useMemo(() => [...new Set(data.occurrences.map(o => o.category).filter((c): c is string => !!c))].sort(), [data.occurrences]);
  const usedAccounts = useMemo(() => {
    const ids = new Set(data.occurrences.flatMap(o => [o.accountId, o.toAccountId]).filter((x): x is string => !!x));
    return data.accounts.filter(a => ids.has(a.id));
  }, [data.occurrences, data.accounts]);

  // ---- render ---------------------------------------------------------------------------------------------

  const calendarDay = calendar.selected;
  const calendarItems = listed.filter(o => o.date === calendarDay && o.status !== 'paid');

  const renderGroup = (g: ReturnType<typeof groupUpcoming>[number]) => {
    const capped = g.id !== 'overdue' && g.id !== 'today' && !query && !expanded.has(g.id);
    const shown = capped ? g.items.slice(0, CAP) : g.items;
    return (
      <section key={g.id} id={`schedule-group-${g.id}`} data-nv-index={g.label}>
        <GroupHeader label={g.label} count={g.items.length} net={g.net} currency={data.displayCurrency} tone={g.id === 'overdue' ? 'red' : undefined} />
        <ul id={`schedule-list-${g.id}`}>
          {shown.map(o => <OccurrenceRow key={o.key} o={o} data={data} onOpen={setSelected} menu={occurrenceMenu(o)} />)}
        </ul>
        {g.items.length > CAP && g.id !== 'overdue' && g.id !== 'today' && !query && (
          <MoreButton
            expanded={expanded.has(g.id)}
            total={g.items.length}
            controls={`schedule-list-${g.id}`}
            onToggle={() => setExpanded(prev => { const next = new Set(prev); if (next.has(g.id)) next.delete(g.id); else next.add(g.id); return next; })}
          />
        )}
      </section>
    );
  };

  const nothingAtAll = data.recurring.length === 0 && data.bills.length === 0 && data.synthetic.length === 0;

  return (
    <div className="space-y-4 pb-10">
      <ScheduleHero
        data={data}
        summary={summary}
        days={days}
        onShowOverdue={() => { setTab('upcoming'); setDay(null); requestAnimationFrame(() => document.getElementById('schedule-group-overdue')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }}
        onPickDay={date => { setTab('upcoming'); setDay(date); }}
      />

      <SegmentedTabs<Tab>
        label="Schedule views"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'upcoming', label: 'Upcoming', icon: 'list' },
          { id: 'calendar', label: 'Calendar', icon: 'calendar' },
          { id: 'series', label: 'Series', icon: 'repeat' },
          { id: 'bills', label: 'Bills', icon: 'invoice' },
        ]}
      />

      <PageToolbar>
        <FilterButton count={filterCount(filters)} onClick={() => setFiltersOpen(true)} />
        {tab === 'calendar' && <MonthNav year={calendar.year} month={calendar.month} onChange={(year, month) => setCalendar(c => ({ ...c, year, month }))} />}
        <ToolbarSpacer />
        {tab === 'bills' && oldBills.length > 0 && (
          <ToolButton icon="archive" label={`Expire old (${oldBills.length})`} onClick={() => toastResult(data.setBillStatus(oldBills, 'expired'), `${oldBills.length} old ${oldBills.length === 1 ? 'bill' : 'bills'} expired`)} />
        )}
      </PageToolbar>
      <ActiveFilters filters={active} onClearAll={() => { setFilters(emptyFilters()); setDay(null); }} />

      {tab === 'upcoming' && (
        nothingAtAll ? (
          <Card><EmptyState icon="calendar" title="Nothing scheduled" body="Add rent, salary or a subscription to see what's coming." action={<Button variant="primary" onClick={() => setForm({ mode: 'new' })}>Add schedule</Button>} /></Card>
        ) : groups.length === 0 ? (
          <Card><EmptyState icon="search" title="No payments match" action={<Button onClick={() => { setFilters(emptyFilters()); setDay(null); setQuery(''); }}>Clear filters</Button>} /></Card>
        ) : (
          <Card className="px-3 sm:px-4">{groups.map(renderGroup)}</Card>
        )
      )}

      {tab === 'calendar' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Card className="px-3 sm:px-4">
            <MonthCalendar
              data={data}
              occurrences={listed}
              year={calendar.year}
              month={calendar.month}
              selected={calendar.selected}
              onSelect={date => setCalendar(c => ({ ...c, selected: date }))}
              onMonthChange={(year, month) => setCalendar(c => ({ ...c, year, month }))}
            />
          </Card>
          <Card className="px-3 sm:px-4 xl:self-start">
            <h2 className="px-2 pb-2 text-lg font-medium text-nv-ink">{parseLocalDate(calendarDay).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
            {calendarItems.length === 0 ? (
              <p className="px-2 pb-4 text-sm text-nv-muted">Nothing due this day.</p>
            ) : (
              <ul>{calendarItems.map(o => <OccurrenceRow key={o.key} o={o} data={data} onOpen={setSelected} menu={occurrenceMenu(o)} showDate={false} />)}</ul>
            )}
          </Card>
        </div>
      )}

      {tab === 'series' && (
        <SeriesView
          data={data}
          query={query}
          onAdd={() => setForm({ mode: 'new' })}
          onOpen={row => (row.source === 'recurring' ? setForm({ mode: 'series', series: row.series }) : openAccount(row.series))}
          menuFor={seriesMenu}
        />
      )}

      {tab === 'bills' && (
        <BillsView
          data={data}
          tab={billTab}
          onTab={setBillTab}
          bills={billList}
          counts={billCounts}
          onOpen={bill => { const o = billOccurrence(bill); if (o) setSelected(o); else setForm({ mode: 'bill', bill }); }}
          menuFor={billMenu}
        />
      )}

      <FilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        resultLabel={`Show ${listed.filter(o => o.status !== 'paid').length} payments`}
        onReset={() => setFilters(emptyFilters())}
      >
        <FilterSection title="Kind" count={filters.flows.length}>
          <ChoiceChips label="Kind" multiple options={FLOW_CHOICES} selected={filters.flows} onChange={ids => setFilters(p => ({ ...p, flows: ids as Flow[] }))} />
        </FilterSection>
        <FilterSection title="Comes from" count={filters.sources.length}>
          <ChoiceChips label="Comes from" multiple options={SOURCE_CHOICES} selected={filters.sources} onChange={ids => setFilters(p => ({ ...p, sources: ids as OccurrenceSource[] }))} />
        </FilterSection>
        {usedAccounts.length > 1 && (
          <FilterSection title="Accounts" count={filters.accountIds.length}>
            <ChoiceChips label="Accounts" multiple options={usedAccounts.map(a => ({ id: a.id, label: a.name }))} selected={filters.accountIds} onChange={ids => setFilters(p => ({ ...p, accountIds: ids }))} />
          </FilterSection>
        )}
        {usedCategories.length > 0 && (
          <FilterSection title="Categories" count={filters.categories.length}>
            <ChoiceChips
              label="Categories"
              multiple
              options={usedCategories.map(c => ({ id: c, label: c, color: data.categoryByName.get(c)?.color }))}
              selected={filters.categories}
              onChange={ids => setFilters(p => ({ ...p, categories: ids }))}
            />
          </FilterSection>
        )}
        <FilterSection title="Show">
          <FilterToggle icon="undo" label="Skipped payments" checked={filters.showSkipped} onChange={v => setFilters(p => ({ ...p, showSkipped: v }))} />
        </FilterSection>
      </FilterSheet>

      <OccurrenceSheet o={paying ? null : selected} data={data} onClose={() => setSelected(null)} onPay={o => setPaying(o)} menu={occurrenceMenu} />
      <PaySheet o={paying} data={data} onClose={() => setPaying(null)} onPaid={() => { setPaying(null); setSelected(null); }} />
      <ScheduleFormSheet target={form} data={data} onClose={() => setForm(null)} />
    </div>
  );
};

export default ScheduleNew;
