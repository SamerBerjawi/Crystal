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
import { TextInput, Switch } from '../components/ui/Fields';
import Icon from '../components/ui/Icon';
import { Menu } from '../components/ui/Menu';
import { Amount } from '../components/ui/Money';
import { ConfirmDialog } from '../components/ui/Overlays';
import SegmentedControl from '../components/ui/SegmentedControl';
import { EmptyState } from '../components/ui/States';
import { MerchantLogo } from '../components/EntityIcon';
import { AccountLogo } from '../components/AccountCard';
import { cn } from '../lib/utils';
import { useInsightsView } from '../contexts/InsightsViewContext';
import { useAccountsContext, useTransactionsContext, useWarrantsContext } from '../contexts/DomainProviders';
import { useCategoryContext, useGoalsContext, useScheduleContext, useTagsContext } from '../contexts/FinancialDataContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { goalMovements } from '../utils/forecastModel';
import {
  addDays, buildOccurrences, cadenceLabel, dailyCommitted, emptyFilters, filterOccurrences, groupUpcoming, iso, moveFuture, monthGrid, nextDueAfterPosting, oldUnpaidBills, OVERDUE_DAYS,
  postDetails, scheduledItemOf, seriesGroups, summarize, syntheticSeries, type Flow, type Occurrence, type OccurrenceSource, type SeriesRow,
} from '../utils/scheduleModel';
import { pauseService, resumeService } from '../utils/subscriptionsModel';
import { Select } from '../components/ui/Pickers';

type Tab = 'calendar' | 'upcoming' | 'scheduled' | 'archive';
type OverdueFilter = 'all' | 'recurring' | 'one-time';

const TABS = [{ id: 'calendar', label: 'Calendar' }, { id: 'upcoming', label: 'Upcoming' }, { id: 'scheduled', label: 'Scheduled' }, { id: 'archive', label: 'Archive' }];
const FLOWS = [{ id: 'all', label: 'All' }, { id: 'in', label: 'In' }, { id: 'out', label: 'Out' }, { id: 'move', label: 'Transfers' }];
const SOURCE_OPTIONS = [
  { id: 'all', label: 'All sources' },
  { id: 'recurring', label: 'Recurring' },
  { id: 'bill', label: 'One-time & Tax' },
  { id: 'loan', label: 'Loans' },
  { id: 'card', label: 'Cards' },
  { id: 'property', label: 'Property' },
];
const OVERDUE_FILTERS = [{ id: 'all', label: 'All' }, { id: 'recurring', label: 'Recurring' }, { id: 'one-time', label: 'One-time' }];
const SCHEDULED_STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'paused', label: 'Paused' },
  { id: 'ended', label: 'Ended' },
];
const HORIZON_DAYS = 365;

const convert = (amount: number, currency: Parameters<typeof convertToMain>[1]) => convertToMain(amount, currency);
const longDay = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const shortDay = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

type Confirm = { title: string; message: string; label: string; isDestructive?: boolean; onConfirm: () => void };

/** What's planned, day by day (D-007, D-033, D-043). */
const SchedulePage: React.FC = () => {
  const { accounts } = useAccountsContext();
  const { transactions, saveTransaction } = useTransactionsContext();
  const { warrants } = useWarrantsContext();
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
  const [sourceFilter, setSourceFilter] = useState('all');
  const [showSkipped, setShowSkipped] = useState(false);
  const [overdueFilter, setOverdueFilter] = useState<OverdueFilter>('all');
  const [scheduledFilter, setScheduledFilter] = useState<'all' | 'active' | 'paused' | 'ended'>('all');
  const [formMode, setFormMode] = useState<'recurring' | 'one-time' | null>(null);
  const [formDate, setFormDate] = useState<string | undefined>();
  const [editingSeries, setEditingSeries] = useState<RecurringTransaction | null>(null);
  const [pendingEndedSeries, setPendingEndedSeries] = useState<RecurringTransaction | null>(null);
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

  const allBills = useMemo<BillPayment[]>(() => {
    const primaryAccountId = accounts.find(a => a.isPrimary)?.id || accounts[0]?.id || '';
    const warrantTaxBills: BillPayment[] = warrants.flatMap(w =>
      (w.taxPayments || [])
        .filter(tp => tp.status === 'pending' && tp.amount > 0 && tp.dueDate)
        .map(tp => ({
          id: `warrant-tax-${w.id}-${tp.id}`,
          description: `${w.name || w.isin} tax instalment`,
          amount: -Math.abs(tp.amount),
          type: 'payment' as const,
          dueDate: tp.dueDate,
          status: 'unpaid' as const,
          accountId: primaryAccountId,
          currency: getMainCurrency() as BillPayment['currency'],
        }))
    ).filter(wtb => !billsAndPayments.some(b => b.id === wtb.id));
    return [...billsAndPayments, ...warrantTaxBills];
  }, [billsAndPayments, warrants, accounts]);

  const occurrences = useMemo(() => buildOccurrences({
    recurring: recurringTransactions, overrides: recurringTransactionOverrides, bills: allBills, accounts, transactions, loanPaymentOverrides,
    from: rangeStart, to: rangeEnd, today, overdueDays: OVERDUE_DAYS,
  }), [recurringTransactions, recurringTransactionOverrides, allBills, accounts, transactions, loanPaymentOverrides, rangeStart, rangeEnd, today]);

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
    const filters = {
      ...emptyFilters(),
      flows: flow === 'all' ? [] : [flow as Flow],
      sources: sourceFilter === 'all' ? [] : [sourceFilter as OccurrenceSource],
      showSkipped,
    };
    const shown = filterOccurrences(occurrences, filters, search, accountName);
    return groupUpcoming(shown, today, convert).map(group => {
      if (group.id !== 'overdue' || overdueFilter === 'all') return group;
      return { ...group, items: group.items.filter(item => (overdueFilter === 'recurring' ? item.source === 'recurring' : item.source === 'bill')) };
    });
  }, [occurrences, flow, sourceFilter, showSkipped, search, overdueFilter, today]);

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
  const overdueCutoff = useMemo(() => iso(addDays(today, -OVERDUE_DAYS)), [today]);
  const overdue = useMemo(() => occurrences.filter(item => item.status === 'overdue' && item.date >= overdueCutoff), [occurrences, overdueCutoff]);
  const overdueTotal = useMemo(() => overdue.reduce((sum, item) => sum + item.amount, 0), [overdue]);

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
      if (o.bill) {
        saveBillPayment({ ...o.bill, status: 'expired' });
        toast.success(`${o.description} moved to the archive`);
      } else if (o.source === 'recurring') {
        const existing = recurringTransactionOverrides.find(
          item => item.recurringTransactionId === o.sourceId && item.originalDate === o.originalDate
        );
        saveRecurringOverride({ ...existing, recurringTransactionId: o.sourceId, originalDate: o.originalDate, isSkipped: true });
        toast.success(`${o.description} marked as expired`, {
          action: {
            label: 'Undo',
            onClick: () => {
              if (existing) {
                saveRecurringOverride({ ...existing, isSkipped: false });
              } else {
                deleteRecurringOverride(o.sourceId, o.originalDate);
              }
            },
          },
        });
      }
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
    setPendingEndedSeries(ended);
    setEditingSeries({ ...started, id: '' } as RecurringTransaction);
    setFormMode('recurring');
    setEditChoice(null);
  };

  const pageStats: PageStat[] = [
    { label: 'Going out, next 30 days', icon: 'arrow-up-right-01', value: summary.out, format: 'money', ...(summary.overdueCount ? { badge: `${summary.overdueCount} overdue`, badgeTone: 'butter' as const } : {}) },
    { label: 'Coming in, next 30 days', icon: 'arrow-down-left-01', value: summary.in, format: 'money' },
    { label: 'Net', icon: 'balance-scale', value: summary.net, format: 'money' },
  ];

  const pauseSeries = (rt: RecurringTransaction) => {
    saveRecurringTransaction(pauseService(rt, today));
    toast.success(`${rt.merchant || rt.description} paused`, {
      action: { label: 'Undo', onClick: () => saveRecurringTransaction({ ...rt, pausedAt: undefined }) },
    });
  };

  const resumeSeries = (rt: RecurringTransaction) => {
    saveRecurringTransaction(resumeService(rt, today));
    toast.success(`${rt.merchant || rt.description} is back on`);
  };

  const seriesMenu = (row: SeriesRow) => [
    { id: 'edit', label: 'Edit', icon: 'pencil-edit-02', onAction: () => { setEditingSeries(row.series); setFormMode('recurring'); } },
    row.series.pausedAt
      ? { id: 'resume', label: 'Resume', icon: 'play', onAction: () => resumeSeries(row.series) }
      : { id: 'pause', label: 'Pause', icon: 'pause', onAction: () => pauseSeries(row.series) },
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

      {overdue.length > 0 && (
        <section
          aria-label="Overdue bills"
          className="surface-card rounded-[var(--radius-xl)] border border-amber/40 bg-amber-soft p-4 transition-all"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber/25 text-attention-text">
                <Icon name="alert-02" size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="type-body-strong text-ink">
                    {overdue.length} {overdue.length === 1 ? 'bill is' : 'bills are'} overdue
                  </h3>
                  <Badge tone="attention">Action needed</Badge>
                </div>
                <p className="type-caption text-muted">
                  Totaling <span className="font-semibold text-ink"><Amount value={overdueTotal} currency={getMainCurrency()} /></span> requiring settlement or rescheduling.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onPress={() => {
                  setTab('upcoming');
                  setOverdueFilter('all');
                }}
              >
                Review in Upcoming
              </Button>
              <Button
                variant="primary"
                size="sm"
                onPress={() => {
                  if (overdue[0]) setPosting(overdue[0]);
                }}
              >
                Pay next bill
              </Button>
            </div>
          </div>
        </section>
      )}

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
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3 max-sm:w-full">
              <TextInput className="w-64 max-sm:w-full" label="Search" value={search} onChange={setSearch} placeholder="Search payee or memo..." />
              <Select className="w-44 max-sm:w-full" label="Source" options={SOURCE_OPTIONS} value={sourceFilter} onChange={setSourceFilter} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Switch isSelected={showSkipped} onChange={setShowSkipped}>Show skipped</Switch>
              <SegmentedControl items={FLOWS} activeId={flow} onChange={setFlow} />
            </div>
          </div>
          {groups.length === 0 ? (
            <EmptyState
              icon="calendar-03"
              title="Nothing matches your filters"
              description="Try adjusting your search query, source, or flow filters."
            />
          ) : (
            <div className="space-y-4">
              {groups.map(group => (
                <DayGroup
                  key={group.id}
                  label={
                    <span className="flex items-center gap-2">
                      <span className={group.id === 'overdue' ? 'text-attention-text font-bold' : ''}>{group.label}</span>
                      <span
                        className={cn(
                          'type-caption rounded-full px-2 py-0.5',
                          group.id === 'overdue'
                            ? 'bg-amber/25 text-attention-text font-bold border border-amber/40'
                            : 'bg-inset text-muted'
                        )}
                      >
                        {group.items.length}
                      </span>
                    </span>
                  }
                  total={<Amount value={group.net} currency={getMainCurrency()} tone="flow" />}
                >
                  {group.id === 'overdue' && (
                    <div className="my-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
                      <div className="flex items-center gap-2">
                        <Badge tone="attention" icon="alert-02" className="bg-amber/25 text-attention-text border border-amber/40 font-bold">
                          Overdue payments
                        </Badge>
                        <span className="type-caption text-muted">Items past their scheduled date</span>
                      </div>
                      <SegmentedControl items={OVERDUE_FILTERS} activeId={overdueFilter} onChange={id => setOverdueFilter(id as OverdueFilter)} />
                    </div>
                  )}
                  <ul className="divide-y divide-line">
                    {group.items.map(item => (
                      <OccurrenceRow
                        key={item.key}
                        occurrence={item}
                        accountName={accountName}
                        showDate
                        {...actions}
                      />
                    ))}
                  </ul>
                </DayGroup>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'scheduled' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl
              items={SCHEDULED_STATUS_FILTERS}
              activeId={scheduledFilter}
              onChange={id => setScheduledFilter(id as typeof scheduledFilter)}
            />
            <Button icon="add-01" size="sm" onPress={() => openForm('recurring')}>Add recurring</Button>
          </div>
          {series.map(group => {
            const filteredRows = group.rows.filter(row => {
              if (scheduledFilter === 'all') return true;
              const isPaused = !!row.series.pausedAt;
              const isEnded = !!row.ended;
              if (scheduledFilter === 'paused') return isPaused;
              if (scheduledFilter === 'ended') return isEnded;
              if (scheduledFilter === 'active') return !isPaused && !isEnded;
              return true;
            });
            if (filteredRows.length === 0) return null;

            return (
              <section key={group.id} aria-label={group.label} className="surface-card rounded-[var(--radius-xl)] p-5 max-md:p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="type-card-title text-ink">{group.label}</h2>
                    <Badge tone="neutral">{filteredRows.length}</Badge>
                  </div>
                  <p className="type-caption text-muted">
                    {group.monthlyIn > 0 && <><Amount value={group.monthlyIn} currency={getMainCurrency()} /> a month in </>}
                    {group.monthlyOut > 0 && <><Amount value={group.monthlyOut} currency={getMainCurrency()} /> a month out</>}
                  </p>
                </div>
                <ul className="mt-2 divide-y divide-line">
                  {filteredRows.map(row => {
                    const isPaused = !!row.series.pausedAt;
                    const isEnded = !!row.ended;
                    const name = row.series.merchant || row.series.description;
                    const linkedAccount = accounts.find(a => a.id === row.series.accountId);

                    return (
                      <li key={row.series.id} className="group -mx-2 flex min-h-16 flex-wrap items-center gap-3 rounded-[var(--radius-md)] px-2 py-2.5 transition-colors hover:bg-inset/30">
                        <MerchantLogo name={name} size={40} className="shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="type-body-strong truncate text-ink">{name}</span>
                            <Badge tone="neutral">{row.source === 'recurring' ? cadenceLabel(row.series) : SOURCE_LABEL[row.source]}</Badge>
                            {row.series.autopay && <Badge tone="positive">Autopay</Badge>}
                            {isPaused && <Badge tone="attention">Paused</Badge>}
                            {isEnded && <Badge tone="neutral">Ended</Badge>}
                          </div>
                          <p className="type-caption mt-0.5 flex flex-wrap items-center gap-1.5 text-muted">
                            {row.next && <span>Next due {shortDay(row.next)}</span>}
                            {row.next && linkedAccount && <span>·</span>}
                            {linkedAccount && (
                              <span className="inline-flex items-center gap-1">
                                <AccountLogo account={linkedAccount} size={14} />
                                <span>{linkedAccount.name}</span>
                              </span>
                            )}
                            {row.series.paymentUrl && (
                              <>
                                <span>·</span>
                                <a
                                  href={row.series.paymentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
                                >
                                  <span>Pay online</span>
                                  <Icon name="link-01" size={12} />
                                </a>
                              </>
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="type-figure-row block text-ink">
                            <Amount value={row.monthly} currency={row.series.currency} />
                            <span className="type-caption text-muted"> /mo</span>
                          </span>
                          <span className="type-caption block text-muted">
                            ~<Amount value={row.monthly * 12} currency={row.series.currency} /> /yr
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {row.source === 'recurring' ? (
                            <>
                              {isPaused ? (
                                <Button variant="ghost" size="sm" icon="play" onPress={() => resumeSeries(row.series)}>
                                  Resume
                                </Button>
                              ) : (
                                <Button variant="ghost" size="sm" icon="pause" onPress={() => pauseSeries(row.series)}>
                                  Pause
                                </Button>
                              )}
                              <Menu
                                title={row.series.description}
                                trigger={<IconButton icon="more-horizontal" label={`Actions for ${row.series.description}`} tooltipPlacement="left" />}
                                items={seriesMenu(row)}
                              />
                            </>
                          ) : (
                            <Badge tone="neutral">From account</Badge>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          {series.length === 0 && (
            <EmptyState
              icon="repeat-one-01"
              title="Nothing scheduled"
              description="Add a recurring payment, and it shows on every date."
              actionLabel="Add a recurring item"
              onAction={() => openForm('recurring')}
            />
          )}
        </div>
      )}

      {tab === 'archive' && (
        <section aria-label="Archive" className="surface-card rounded-[var(--radius-xl)] p-5 max-md:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="type-card-title text-ink">Expired & Archived Bills</h2>
                <Badge tone="neutral">{expiredBills.length}</Badge>
              </div>
              <p className="type-caption text-muted">Past one-time bills and completed schedules preserved for your history.</p>
            </div>
            {oldBills.length > 0 && (
              <Button
                variant="secondary"
                icon="archive-01"
                onPress={() => {
                  oldBills.forEach(bill => saveBillPayment({ ...bill, status: 'expired' }));
                  toast.success(`${oldBills.length} old ${oldBills.length === 1 ? 'bill' : 'bills'} archived`);
                }}
              >
                Archive {oldBills.length} unpaid past {oldBills.length === 1 ? 'bill' : 'bills'}
              </Button>
            )}
          </div>
          {expiredBills.length === 0 ? (
            <EmptyState
              icon="archive-01"
              title="Archive is clear"
              description="One-time bills that expire or get archived will be kept here for reference."
            />
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {expiredBills.map(bill => (
                <li key={bill.id} className="group -mx-2 flex min-h-14 flex-wrap items-center gap-3 rounded-[var(--radius-md)] px-2 py-2.5 transition-colors hover:bg-inset/30">
                  <MerchantLogo name={bill.description} size={36} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="type-body-strong truncate text-ink">{bill.description}</p>
                      <Badge tone="neutral">Archived</Badge>
                    </div>
                    {(() => {
                      const billAccount = accounts.find(a => a.id === bill.accountId);
                      return (
                        <p className="type-caption mt-0.5 flex flex-wrap items-center gap-1.5 text-muted">
                          <span>Due {shortDay(bill.dueDate)}</span>
                          {billAccount && (
                            <>
                              <span>·</span>
                              <span className="inline-flex items-center gap-1">
                                <AccountLogo account={billAccount} size={14} />
                                <span>{billAccount.name}</span>
                              </span>
                            </>
                          )}
                        </p>
                      );
                    })()}
                  </div>
                  <span className="type-figure-row shrink-0 text-ink">
                    <Amount value={bill.amount} currency={bill.currency} />
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="refresh"
                      onPress={() => {
                        saveBillPayment({ ...bill, status: 'unpaid' });
                        toast.success(`${bill.description} restored to active plan`);
                      }}
                    >
                      Restore
                    </Button>
                    <Menu
                      title={bill.description}
                      trigger={<IconButton icon="more-horizontal" label={`Actions for ${bill.description}`} tooltipPlacement="left" />}
                      items={[
                        { id: 'paid', label: 'Mark as paid', icon: 'checkmark-circle-02', onAction: () => setPosting(postAs(bill)) },
                        { id: 'delete', label: 'Delete', icon: 'delete-02', isDestructive: true, startsGroup: true, onAction: () => { deleteBillPayment(bill.id); toast.success(`${bill.description} deleted`); } },
                      ]}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {formMode && (
        <RecurringTransactionModal
          onClose={() => { setFormMode(null); setEditingSeries(null); setPendingEndedSeries(null); setEditingBill(null); }}
          onSave={data => {
            if (pendingEndedSeries) saveRecurringTransaction(pendingEndedSeries);
            saveRecurringTransaction(data);
            setPendingEndedSeries(null);
          }}
          onSaveBill={data => {
            saveBillPayment(data);
            setPendingEndedSeries(null);
          }}
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
