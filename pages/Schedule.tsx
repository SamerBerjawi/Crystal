import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { BillPayment, RecurringTransaction, Transaction } from '../types';
import { convertToMain, parseLocalDate, getMainCurrency } from '../utils';
import AddTransactionModal from '../components/AddTransactionModal';
import { CalendarMonth, CalendarWeek, FlowTotal, weekOf } from '../components/CalendarMonth';
import DayBars from '../components/DayBars';
import EditRecurrenceModal from '../components/EditRecurrenceModal';
import OccurrenceRow, { SOURCE_LABEL, type OccurrenceActions } from '../components/OccurrenceRow';
import PageHeader, { type PageStat } from '../components/PageHeader';
import RecurringOverrideModal from '../components/RecurringOverrideModal';
import RecurringTransactionModal from '../components/RecurringTransactionModal';
import { Button, IconButton } from '../components/ui/Actions';
import { Badge, DayGroup } from '../components/ui/Display';
import { TextInput } from '../components/ui/Fields';
import { Menu } from '../components/ui/Menu';
import { Amount } from '../components/ui/Money';
import { ConfirmDialog } from '../components/ui/Overlays';
import SegmentedControl from '../components/ui/SegmentedControl';
import { EmptyState } from '../components/ui/States';
import { useInsightsView } from '../contexts/InsightsViewContext';
import { useAccountsContext, useTransactionsContext } from '../contexts/DomainProviders';
import { useCategoryContext, useGoalsContext, useScheduleContext, useTagsContext } from '../contexts/FinancialDataContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { goalMovements } from '../utils/forecastModel';
import {
  addDays, buildOccurrences, cadenceLabel, dailyCommitted, emptyFilters, filterOccurrences, groupUpcoming, iso, moveFuture, monthGrid, nextDueAfterPosting, oldUnpaidBills,
  postDetails, scheduledItemOf, seriesGroups, summarize, syntheticSeries, type Flow, type Occurrence, type SeriesRow,
} from '../utils/scheduleModel';

type Tab = 'calendar' | 'upcoming' | 'scheduled' | 'archive';
type OverdueFilter = 'all' | 'recurring' | 'one-time';

const TABS = [{ id: 'calendar', label: 'Calendar' }, { id: 'upcoming', label: 'Upcoming' }, { id: 'scheduled', label: 'Scheduled' }, { id: 'archive', label: 'Archive' }];
const FLOWS = [{ id: 'all', label: 'All' }, { id: 'in', label: 'In' }, { id: 'out', label: 'Out' }, { id: 'move', label: 'Transfers' }];
const OVERDUE_FILTERS = [{ id: 'all', label: 'All' }, { id: 'recurring', label: 'Recurring' }, { id: 'one-time', label: 'One-time' }];
const HORIZON_DAYS = 365;
const OVERDUE_DAYS = 7;

const convert = (amount: number, currency: Parameters<typeof convertToMain>[1]) => convertToMain(amount, currency);
const longDay = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const shortDay = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

type Confirm = { title: string; message: string; label: string; isDestructive?: boolean; onConfirm: () => void };

/** What's planned, day by day (D-007, D-033, D-043). */
const SchedulePage: React.FC = () => {
  const { accounts } = useAccountsContext();
  const { transactions, saveTransaction } = useTransactionsContext();
  const { incomeCategories, expenseCategories } = useCategoryContext();
  const { tags } = useTagsContext();
  const { financialGoals } = useGoalsContext();
  const { activeGoalIds } = useInsightsView();
  const {
    recurringTransactions, saveRecurringTransaction, deleteRecurringTransaction, billsAndPayments, saveBillPayment, deleteBillPayment,
    recurringTransactionOverrides, saveRecurringOverride, deleteRecurringOverride, loanPaymentOverrides,
  } = useScheduleContext();
  const isPhone = useIsMobile();

  const today = useMemo(() => new Date(), []);
  const todayStr = iso(today);
  const [tab, setTab] = useState<Tab>('calendar');
  const [month, setMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selected, setSelected] = useState(todayStr);
  const [search, setSearch] = useState('');
  const [flow, setFlow] = useState('all');
  const [overdueFilter, setOverdueFilter] = useState<OverdueFilter>('all');
  const [formMode, setFormMode] = useState<'recurring' | 'one-time' | null>(null);
  const [formDate, setFormDate] = useState<string | undefined>();
  const [editingSeries, setEditingSeries] = useState<RecurringTransaction | null>(null);
  const [editingBill, setEditingBill] = useState<BillPayment | null>(null);
  const [editChoice, setEditChoice] = useState<Occurrence | null>(null);
  const [overrideItem, setOverrideItem] = useState<Occurrence | null>(null);
  const [posting, setPosting] = useState<Occurrence | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const accountName = (id?: string) => accounts.find(account => account.id === id)?.name;

  const rangeEnd = useMemo(() => {
    const monthEnd = new Date(month.year, month.month + 2, 7);
    const horizon = addDays(today, HORIZON_DAYS);
    return monthEnd > horizon ? monthEnd : horizon;
  }, [month, today]);
  const rangeStart = useMemo(() => {
    const monthStart = new Date(month.year, month.month - 1, 20);
    return monthStart < today ? monthStart : today;
  }, [month, today]);

  const occurrences = useMemo(() => buildOccurrences({
    recurring: recurringTransactions, overrides: recurringTransactionOverrides, bills: billsAndPayments, accounts, transactions, loanPaymentOverrides,
    from: rangeStart, to: rangeEnd, today, overdueDays: OVERDUE_DAYS,
  }), [recurringTransactions, recurringTransactionOverrides, billsAndPayments, accounts, transactions, loanPaymentOverrides, rangeStart, rangeEnd, today]);

  const summary = useMemo(() => summarize(occurrences, today, convert), [occurrences, today]);
  const days = useMemo(() => dailyCommitted(occurrences, today, convert), [occurrences, today]);
  const yearDays = useMemo(() => dailyCommitted(occurrences, today, convert, HORIZON_DAYS), [occurrences, today]);
  const grid = useMemo(() => monthGrid(month.year, month.month, occurrences, convert), [month, occurrences]);
  const series = useMemo(() => seriesGroups(recurringTransactions, syntheticSeries(accounts, transactions, loanPaymentOverrides), accounts, today, convert), [recurringTransactions, accounts, transactions, loanPaymentOverrides, today]);

  const goalDays = useMemo(() => {
    const map = new Map<string, string[]>();
    financialGoals.filter(goal => !goal.isBucket && !goal.disabled && !goal.completed && activeGoalIds.includes(goal.id)).forEach(goal => {
      goalMovements(goal, today, rangeEnd).forEach(movement => map.set(movement.date, [...(map.get(movement.date) ?? []), goal.name]));
    });
    return map;
  }, [financialGoals, activeGoalIds, today, rangeEnd]);

  const groups = useMemo(() => {
    const filters = { ...emptyFilters(), flows: flow === 'all' ? [] : [flow as Flow] };
    const shown = filterOccurrences(occurrences, filters, search, accountName);
    return groupUpcoming(shown, today, convert).map(group => {
      if (group.id !== 'overdue' || overdueFilter === 'all') return group;
      return { ...group, items: group.items.filter(item => (overdueFilter === 'recurring' ? item.source === 'recurring' : item.source === 'bill')) };
    });
  }, [occurrences, flow, search, overdueFilter, today]);

  const selectedDay = useMemo(() => {
    const inGrid = grid.find(day => day.date === selected);
    if (inGrid) return inGrid;
    return monthGrid(parseLocalDate(selected).getFullYear(), parseLocalDate(selected).getMonth(), occurrences, convert).find(day => day.date === selected)!;
  }, [grid, selected, occurrences]);
  const week = useMemo(() => {
    const date = parseLocalDate(selected);
    const pool = monthGrid(date.getFullYear(), date.getMonth(), occurrences, convert);
    return weekOf(selected, pool);
  }, [selected, occurrences]);
  const overdue = useMemo(() => occurrences.filter(item => item.status === 'overdue'), [occurrences]);

  const expiredBills = useMemo(() => billsAndPayments.filter(bill => bill.status === 'expired').sort((a, b) => (a.dueDate > b.dueDate ? -1 : 1)), [billsAndPayments]);
  const oldBills = useMemo(() => oldUnpaidBills(billsAndPayments, today), [billsAndPayments, today]);

  const openForm = (mode: 'recurring' | 'one-time', date?: string) => {
    setEditingSeries(null);
    setEditingBill(null);
    setFormDate(date);
    setFormMode(mode);
  };

  const skip = (o: Occurrence, isSkipped: boolean) => {
    const existing = recurringTransactionOverrides.find(item => item.recurringTransactionId === o.sourceId && item.originalDate === o.originalDate);
    saveRecurringOverride({ ...existing, recurringTransactionId: o.sourceId, originalDate: o.originalDate, isSkipped });
    toast.success(isSkipped ? 'Skipped this one' : 'Back in the plan', { action: { label: 'Undo', onClick: () => saveRecurringOverride({ ...existing, recurringTransactionId: o.sourceId, originalDate: o.originalDate, isSkipped: !isSkipped }) } });
  };

  const actions: OccurrenceActions = {
    onPost: setPosting,
    onSkip: skip,
    onEdit: o => {
      if (o.bill) {
        setEditingBill(o.bill);
        setFormMode('one-time');
      } else if (o.isOverride) {
        setOverrideItem(o);
      } else {
        setEditChoice(o);
      }
    },
    onEndSeries: o => {
      const rt = recurringTransactions.find(item => item.id === o.sourceId);
      if (!rt) return;
      const endDate = iso(addDays(parseLocalDate(o.originalDate), -1));
      setConfirm({ title: 'End this series?', message: `It stops repeating after ${shortDay(endDate)}.`, label: 'End series', onConfirm: () => saveRecurringTransaction({ ...rt, endDate }) });
    },
    onExpire: o => {
      if (!o.bill) return;
      saveBillPayment({ ...o.bill, status: 'expired' });
      toast.success(`${o.description} moved to the archive`);
    },
    onDelete: o => setConfirm({
      title: o.source === 'recurring' ? 'Delete this series?' : 'Delete this item?',
      message: o.source === 'recurring' ? 'This removes every future date.' : "You can't undo this.",
      label: 'Delete',
      isDestructive: true,
      onConfirm: () => (o.source === 'recurring' ? deleteRecurringTransaction(o.sourceId) : deleteBillPayment(o.sourceId)),
    }),
  };

  const handleSavePosted = (toSave: (Omit<Transaction, 'id'> & { id?: string })[], toDelete: string[]) => {
    if (!posting) return;
    saveTransaction(posting.series ? toSave.map(tx => ({ ...tx, recurringSourceId: posting.sourceId })) : toSave, toDelete);
    if (posting.series) {
      saveRecurringTransaction({ ...posting.series, nextDueDate: nextDueAfterPosting(posting, occurrences) });
    } else if (posting.bill) {
      saveBillPayment({ ...posting.bill, status: 'paid', accountId: toSave[0].accountId, dueDate: toSave[0].date });
    }
    setPosting(null);
  };

  const editFuture = () => {
    if (!editChoice?.series) return;
    const { ended, started } = moveFuture(editChoice.series, editChoice.originalDate, editChoice.originalDate);
    saveRecurringTransaction(ended);
    setEditingSeries({ ...started, id: '' } as RecurringTransaction);
    setFormMode('recurring');
    setEditChoice(null);
  };

  const pageStats: PageStat[] = [
    { label: 'Going out, next 30 days', icon: 'arrow-up-right-01', value: summary.out, format: 'money', ...(summary.overdueCount ? { badge: `${summary.overdueCount} overdue`, badgeTone: 'butter' as const } : {}) },
    { label: 'Coming in, next 30 days', icon: 'arrow-down-left-01', value: summary.in, format: 'money' },
    { label: 'Net', icon: 'balance-scale', value: summary.net, format: 'money' },
  ];

  const seriesMenu = (row: SeriesRow) => [
    { id: 'edit', label: 'Edit', icon: 'pencil-edit-02', onAction: () => { setEditingSeries(row.series); setFormMode('recurring'); } },
    { id: 'delete', label: 'Delete', icon: 'delete-02', isDestructive: true, startsGroup: true, onAction: () => setConfirm({ title: `Delete ${row.series.description}?`, message: 'This removes every future date.', label: 'Delete', isDestructive: true, onConfirm: () => deleteRecurringTransaction(row.series.id) }) },
  ];

  const postAs = (bill: BillPayment): Occurrence => ({
    key: bill.id, source: 'bill', sourceId: bill.id, originalDate: bill.dueDate, date: bill.dueDate, amount: Math.abs(bill.amount), currency: bill.currency,
    flow: bill.type === 'deposit' ? 'in' : 'out', type: bill.type, description: bill.description, accountId: bill.accountId, status: 'overdue', isOverride: false, isReadOnly: false, bill,
  });

  const dayPanel = (
    <section aria-label={longDay(selected)} className="surface-card min-w-0 rounded-[var(--radius-xl)] p-5">
      {selected === todayStr && <p className="type-label text-primary">Today</p>}
      <h2 className="type-card-title text-ink">{longDay(selected)}</h2>
      {selectedDay && <FlowTotal day={selectedDay} />}
      {selectedDay?.items.length ? (
        <ul className="mt-2 divide-y divide-line">
          {selectedDay.items.map(item => <OccurrenceRow key={item.key} occurrence={item} accountName={accountName} isCompact {...actions} />)}
        </ul>
      ) : (
        <p className="type-body mt-2 text-muted">Nothing planned.</p>
      )}
      {(goalDays.get(selected) ?? []).map(name => <p key={name} className="type-body mt-2 flex items-center gap-2 text-ink"><Badge tone="neutral">Goal</Badge>{name}</p>)}
      {selected === todayStr && overdue.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <h3 className="type-label flex items-center gap-2 text-ink">Overdue <Badge tone="attention">{overdue.length}</Badge></h3>
          <ul className="divide-y divide-line">{overdue.map(item => <OccurrenceRow key={item.key} occurrence={item} accountName={accountName} showDate isCompact {...actions} />)}</ul>
        </div>
      )}
      <Button className="mt-3 w-full" variant="secondary" icon="add-01" onPress={() => openForm('recurring', selected)}>Add to this day</Button>
    </section>
  );

  return (
    <div className="space-y-6 pb-8 max-md:space-y-4">
      <PageHeader
        title="Calendar"
        stats={pageStats}
        actions={
          <Menu
            title="Add"
            trigger={<Button icon="add-01">Add</Button>}
            items={[
              { id: 'recurring', label: 'Recurring item', icon: 'repeat-one-01', onAction: () => openForm('recurring') },
              { id: 'one-time', label: 'One-time bill', icon: 'receipt', onAction: () => openForm('one-time') },
            ]}
          />
        }
      />

      <SegmentedControl items={TABS} activeId={tab} onChange={id => setTab(id as Tab)} scrollable />

      {tab === 'calendar' && (
        <>
          <DayBars days={days} yearDays={yearDays} onSelect={date => { setSelected(date); const d = parseLocalDate(date); setMonth({ year: d.getFullYear(), month: d.getMonth() }); }} />
          {isPhone ? (
            <>
              <CalendarWeek
                days={week}
                today={todayStr}
                selected={selected}
                onSelect={setSelected}
                onWeek={offset => setSelected(iso(addDays(parseLocalDate(selected), offset)))}
              />
              {dayPanel}
            </>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
              <CalendarMonth
                label={new Date(month.year, month.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                days={grid}
                today={todayStr}
                selected={selected}
                goals={goalDays}
                onSelect={setSelected}
                onMonth={offset => setMonth(current => {
                  const next = new Date(current.year, current.month + offset, 1);
                  return { year: next.getFullYear(), month: next.getMonth() };
                })}
                onToday={() => { setMonth({ year: today.getFullYear(), month: today.getMonth() }); setSelected(todayStr); }}
              />
              <div className="self-start">{dayPanel}</div>
            </div>
          )}
        </>
      )}

      {tab === 'upcoming' && (
        <section aria-label="Upcoming" className="surface-card rounded-[var(--radius-xl)] p-5 max-md:p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <TextInput className="w-72 max-sm:w-full" label="Search" value={search} onChange={setSearch} />
            <SegmentedControl items={FLOWS} activeId={flow} onChange={setFlow} />
          </div>
          {groups.length === 0 ? <p className="type-body text-muted">Nothing matches.</p> : (
            <div className="space-y-3">
              {groups.map(group => (
                <DayGroup key={group.id} label={group.label} total={<Amount value={group.net} currency={getMainCurrency()} tone="flow" />}>
                  {group.id === 'overdue' && <SegmentedControl className="my-2" items={OVERDUE_FILTERS} activeId={overdueFilter} onChange={id => setOverdueFilter(id as OverdueFilter)} />}
                  <ul className="divide-y divide-line">{group.items.map(item => <OccurrenceRow key={item.key} occurrence={item} accountName={accountName} showDate {...actions} />)}</ul>
                </DayGroup>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'scheduled' && (
        <div className="space-y-4">
          {series.map(group => (
            <section key={group.id} aria-label={group.label} className="surface-card rounded-[var(--radius-xl)] p-5 max-md:p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="type-card-title text-ink">{group.label}</h2>
                <p className="type-caption text-muted">
                  {group.monthlyIn > 0 && <><Amount value={group.monthlyIn} currency={getMainCurrency()} /> a month in </>}
                  {group.monthlyOut > 0 && <><Amount value={group.monthlyOut} currency={getMainCurrency()} /> a month out</>}
                </p>
              </div>
              <ul className="mt-2 divide-y divide-line">
                {group.rows.map(row => (
                  <li key={row.series.id} className="flex min-h-14 items-center gap-2 py-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="type-body-strong truncate text-ink">{row.series.merchant || row.series.description}</p>
                      <p className="type-caption truncate text-muted">{[row.source === 'recurring' ? cadenceLabel(row.series) : SOURCE_LABEL[row.source], row.next ? `Next ${shortDay(row.next)}` : row.ended ? 'Ended' : '', accountName(row.series.accountId)].filter(Boolean).join(', ')}</p>
                    </div>
                    <span className="type-figure-row shrink-0 text-ink"><Amount value={row.monthly} currency={row.series.currency} /><span className="type-caption text-muted"> /mo</span></span>
                    {row.source === 'recurring'
                      ? <Menu title={row.series.description} trigger={<IconButton icon="more-horizontal" label={`Actions for ${row.series.description}`} tooltipPlacement="left" />} items={seriesMenu(row)} />
                      : <Badge tone="neutral">From account</Badge>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {series.length === 0 && <EmptyState icon="repeat-one-01" title="Nothing scheduled" description="Add a recurring payment, and it shows on every date." actionLabel="Add a recurring item" onAction={() => openForm('recurring')} />}
        </div>
      )}

      {tab === 'archive' && (
        <section aria-label="Archive" className="surface-card rounded-[var(--radius-xl)] p-5 max-md:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="type-card-title text-ink">Expired bills</h2>
              <p className="type-caption text-muted">One-time bills you've archived.</p>
            </div>
            {oldBills.length > 0 && (
              <Button variant="secondary" onPress={() => {
                oldBills.forEach(bill => saveBillPayment({ ...bill, status: 'expired' }));
                toast.success(`${oldBills.length} old ${oldBills.length === 1 ? 'bill' : 'bills'} archived`);
              }}>Archive {oldBills.length} old {oldBills.length === 1 ? 'bill' : 'bills'}</Button>
            )}
          </div>
          {expiredBills.length === 0 ? <p className="type-body mt-3 text-muted">Nothing here.</p> : (
            <ul className="mt-2 divide-y divide-line">
              {expiredBills.map(bill => (
                <li key={bill.id} className="flex min-h-14 flex-wrap items-center gap-2 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="type-body-strong truncate text-ink">{bill.description}</p>
                    <p className="type-caption truncate text-muted">{[`Due ${shortDay(bill.dueDate)}`, accountName(bill.accountId)].filter(Boolean).join(', ')}</p>
                  </div>
                  <span className="type-figure-row shrink-0 text-ink"><Amount value={bill.amount} currency={bill.currency} /></span>
                  <Button variant="secondary" size="sm" onPress={() => { saveBillPayment({ ...bill, status: 'unpaid' }); toast.success(`${bill.description} restored`); }}>Restore</Button>
                  <Menu
                    title={bill.description}
                    trigger={<IconButton icon="more-horizontal" label={`Actions for ${bill.description}`} tooltipPlacement="left" />}
                    items={[
                      { id: 'paid', label: 'Mark as paid', icon: 'tick-02', onAction: () => setPosting(postAs(bill)) },
                      { id: 'delete', label: 'Delete', icon: 'delete-02', isDestructive: true, startsGroup: true, onAction: () => { deleteBillPayment(bill.id); toast.success(`${bill.description} deleted`); } },
                    ]}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {formMode && (
        <RecurringTransactionModal
          onClose={() => { setFormMode(null); setEditingSeries(null); setEditingBill(null); }}
          onSave={saveRecurringTransaction}
          onSaveBill={saveBillPayment}
          accounts={accounts}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          recurringTransactionToEdit={editingSeries}
          billToEdit={editingBill}
          initialMode={formMode}
          initialDate={formDate}
        />
      )}

      {editChoice && (
        <EditRecurrenceModal
          isOpen
          onClose={() => setEditChoice(null)}
          onEditSingle={() => { setOverrideItem(editChoice); setEditChoice(null); }}
          onEditFuture={editFuture}
          onEditSeries={() => { setEditingSeries(editChoice.series ?? null); setFormMode('recurring'); setEditChoice(null); }}
        />
      )}

      {overrideItem && (
        <RecurringOverrideModal
          item={scheduledItemOf(overrideItem, accountName(overrideItem.accountId) ?? '')}
          recurringTransactionOverrides={recurringTransactionOverrides}
          onClose={() => setOverrideItem(null)}
          onSave={saveRecurringOverride}
          onDelete={deleteRecurringOverride}
        />
      )}

      {posting && (
        <AddTransactionModal
          onClose={() => setPosting(null)}
          onSave={handleSavePosted}
          accounts={accounts}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          tags={tags}
          transactions={transactions}
          {...postDetails(posting)}
        />
      )}

      <ConfirmDialog
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => { confirm?.onConfirm(); setConfirm(null); }}
        title={confirm?.title ?? ''}
        message={confirm?.message}
        confirmLabel={confirm?.label ?? 'Confirm'}
        isDestructive={confirm?.isDestructive}
      />
    </div>
  );
};

export default React.memo(SchedulePage);
