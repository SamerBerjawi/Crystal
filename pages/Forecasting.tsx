import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { BillPayment, FinancialGoal, RecurringTransaction, ScheduledItem } from '../types';
import { LIQUID_ACCOUNT_TYPES } from '../constants';
import { convertToMain, formatCurrency, parseLocalDate, round2, getMainCurrency } from '../utils';
import { sortAccountsByType } from '../utils/accountsModel';
import EditRecurrenceModal from '../components/EditRecurrenceModal';
import ForecastDayPanel from '../components/ForecastDayPanel';
import ForecastHorizonChart, { type ChartLine } from '../components/ForecastHorizonChart';
import ForecastList from '../components/ForecastList';
import GoalScenarioModal from '../components/GoalScenarioModal';
import PageHeader, { type PageStat } from '../components/PageHeader';
import RecurringOverrideModal from '../components/RecurringOverrideModal';
import RecurringTransactionModal from '../components/RecurringTransactionModal';
import { Button, IconButton } from '../components/ui/Actions';
import { AmountInput, Switch } from '../components/ui/Fields';
import Icon from '../components/ui/Icon';
import { Badge } from '../components/ui/Display';
import { Amount } from '../components/ui/Money';
import { ConfirmDialog } from '../components/ui/Overlays';
import { MultiSelect } from '../components/ui/Pickers';
import SegmentedControl from '../components/ui/SegmentedControl';
import { EmptyState } from '../components/ui/States';
import { useInsightsView } from '../contexts/InsightsViewContext';
import { useAccountsContext, usePreferencesContext, useTransactionsContext, useWarrantsContext } from '../contexts/DomainProviders';
import { useCategoryContext, useGoalsContext, useScheduleContext } from '../contexts/FinancialDataContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { cn } from '../lib/utils';
import {
  FORECAST_RANGES, NO_ASSUMPTIONS, warrantTaxBills, WEEKLY_AFTER_DAYS, biggestAhead, bufferSuggestions, drivers, isDerivedBill, forecastBubbles, forecastFromData, hasAssumptions, horizonSummary, lowestPoints, rangeEnd, rangeFromDuration,
  type Assumptions, type BufferSuggestion, type Bubble, type ForecastEvent, type ForecastRange,
} from '../utils/forecastModel';
import { iso, moveFuture, moveSeries, parseAmountInput, scheduledItemOf } from '../utils/scheduleModel';

const VIEWS = [{ id: 'chart', label: 'Chart' }, { id: 'list', label: 'List' }];
const LEGEND = [
  { label: 'Money in', shape: 'rounded-full', colour: 'var(--money-in)' },
  { label: 'Money out', shape: 'rounded-full', colour: 'var(--ink)' },
  { label: 'Fixed: loans, cards, goals', shape: 'rounded-[3px]', colour: 'var(--chart-1)' },
];
const LINE_COLOURS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
const BUFFER_STEP = 100;

const shortDay = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

type Pending = { event: ForecastEvent; toDate: string };

/** Talvo's cash horizon (D-010): when money comes and goes, and what to move to stay above your buffer. */
const Forecasting: React.FC = () => {
  const { accounts } = useAccountsContext();
  const { transactions } = useTransactionsContext();
  const { warrants } = useWarrantsContext();
  const { financialGoals, saveFinancialGoal } = useGoalsContext();
  const { incomeCategories, expenseCategories } = useCategoryContext();
  const { activeGoalIds, setActiveGoalIds } = useInsightsView();
  const { preferences, setPreferences } = usePreferencesContext();
  const {
    recurringTransactions, recurringTransactionOverrides, billsAndPayments, loanPaymentOverrides,
    saveRecurringTransaction, saveRecurringOverride, deleteRecurringOverride, saveBillPayment,
  } = useScheduleContext();
  const isPhone = useIsMobile();

  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(() => {
    const primary = accounts.find(account => account.isPrimary);
    return primary ? [primary.id] : accounts.filter(account => LIQUID_ACCOUNT_TYPES.includes(account.type)).map(account => account.id);
  });
  const [range, setRange] = useState<ForecastRange>(rangeFromDuration(preferences.defaultForecastPeriod));
  const [view, setView] = useState('chart');
  const [showGoals, setShowGoals] = useState(true);
  const [splitAccounts, setSplitAccounts] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [panel, setPanel] = useState<{ date: string; events: ForecastEvent[]; title?: string } | null>(null);
  const [pendingMove, setPendingMove] = useState<Pending | null>(null);
  const [confirming, setConfirming] = useState<BufferSuggestion | null>(null);
  const [dismissed, setDismissed] = useLocalStorage<string[]>('crystal-forecast-dismissed', []);
  const [editChoice, setEditChoice] = useState<ForecastEvent | null>(null);
  const [overrideItem, setOverrideItem] = useState<ScheduledItem | null>(null);
  const [editingRecurring, setEditingRecurring] = useState<RecurringTransaction | null>(null);
  const [pendingEndedRecurring, setPendingEndedRecurring] = useState<RecurringTransaction | null>(null);
  const [editingBill, setEditingBill] = useState<BillPayment | null>(null);
  const [formMode, setFormMode] = useState<'recurring' | 'one-time' | null>(null);
  const [formDate, setFormDate] = useState<string | undefined>();
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);
  const [assumptions, setAssumptions] = useState<Assumptions>(NO_ASSUMPTIONS);

  useEffect(() => setRange(rangeFromDuration(preferences.defaultForecastPeriod)), [preferences.defaultForecastPeriod]);

  const today = useMemo(() => new Date(), []);
  const cushion = preferences.safeToSpendCushion ?? 0;
  const setCushion = (amount: number) => setPreferences(prev => ({ ...prev, safeToSpendCushion: Math.max(0, round2(amount)) }));

  const selectedAccounts = useMemo(() => accounts.filter(account => selectedAccountIds.includes(account.id)), [accounts, selectedAccountIds]);
  const end = useMemo(() => rangeEnd(range, today), [range, today]);

  const allBills = useMemo<BillPayment[]>(
    () => [...billsAndPayments, ...warrantTaxBills(warrants, selectedAccounts, accounts)],
    [billsAndPayments, warrants, selectedAccounts, accounts]
  );

  const projection = useMemo(() => {
    return forecastFromData(
      { recurring: recurringTransactions, overrides: recurringTransactionOverrides, bills: allBills, accounts, transactions, loanPaymentOverrides },
      selectedAccounts, financialGoals, activeGoalIds, today, end, convertToMain, assumptions,
    );
  }, [recurringTransactions, recurringTransactionOverrides, allBills, accounts, transactions, loanPaymentOverrides, today, end, selectedAccounts, financialGoals, activeGoalIds, assumptions]);

  const summary = useMemo(() => horizonSummary(projection, cushion), [projection, cushion]);
  const isWeekly = projection.days.length > WEEKLY_AFTER_DAYS;
  const bubbles = useMemo(() => forecastBubbles(projection.events, isWeekly, today), [projection.events, isWeekly, today]);
  const movers = useMemo(() => drivers(projection.events, 5), [projection.events]);
  const biggest = useMemo(() => biggestAhead(projection.events, 6), [projection.events]);
  const lows = useMemo(() => lowestPoints(projection.days, today), [projection.days, today]);
  const allSuggestions = useMemo(() => bufferSuggestions(projection, cushion, 12), [projection, cushion]);
  const suggestions = useMemo(() => allSuggestions.filter(item => !dismissed.includes(item.id)).slice(0, 4), [allSuggestions, dismissed]);
  const dismissedCount = allSuggestions.length - allSuggestions.filter(item => !dismissed.includes(item.id)).length;

  const markers = useMemo(() => (showGoals ? financialGoals
    .filter(goal => !goal.isBucket && goal.date && !goal.completed && !goal.disabled && activeGoalIds.includes(goal.id))
    .map(goal => ({ date: goal.date!, label: goal.name })) : []), [showGoals, financialGoals, activeGoalIds]);

  const chartDays = useMemo(() => {
    if (!showHistory || projection.days.length === 0) return projection.days;
    const todayDay = projection.days[0];
    const selectedSet = new Set(selectedAccounts.map(a => a.id));
    const txByDateAndAccount = new Map<string, Map<string, number>>();
    for (const tx of transactions) {
      if (tx.isSplitParent || tx.isCombinedParent) continue;
      if (!selectedSet.has(tx.accountId)) continue;
      const d = tx.date.slice(0, 10);
      if (d > todayDay.date) continue;
      const acctMap = txByDateAndAccount.get(d) || new Map<string, number>();
      acctMap.set(tx.accountId, (acctMap.get(tx.accountId) || 0) + convertToMain(tx.amount, tx.currency));
      txByDateAndAccount.set(d, acctMap);
    }

    const runningByAccount: Record<string, number> = { ...projection.startByAccount };
    const historyDays: typeof projection.days = [];
    const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    for (let step = 1; step <= 30; step += 1) {
      const dateAtCursor = iso(cursor);
      const deltasOnCursor = txByDateAndAccount.get(dateAtCursor);
      if (deltasOnCursor) {
        for (const [acctId, delta] of deltasOnCursor.entries()) {
          runningByAccount[acctId] = round2((runningByAccount[acctId] ?? 0) - delta);
        }
      }
      cursor.setDate(cursor.getDate() - 1);
      const prevIso = iso(cursor);
      const byAccountSnap = { ...runningByAccount };
      const total = round2(Object.values(byAccountSnap).reduce((s, v) => s + v, 0));
      historyDays.unshift({
        date: prevIso,
        total,
        byAccount: byAccountSnap,
        net: 0,
        events: [],
      });
    }
    return [...historyDays, ...projection.days];
  }, [showHistory, projection.days, projection.startByAccount, selectedAccounts, transactions, today]);

  const accountLines = useMemo<ChartLine[] | undefined>(() => {
    if (!splitAccounts || selectedAccounts.length < 2) return undefined;
    return selectedAccounts.map((account, index) => ({
      id: account.id,
      name: account.name,
      colour: LINE_COLOURS[index % LINE_COLOURS.length],
      values: chartDays.map(day => day.byAccount[account.id] ?? 0),
    }));
  }, [splitAccounts, selectedAccounts, chartDays]);

  const accountName = (id?: string) => accounts.find(account => account.id === id)?.name;
  const dayOf = (date: string) => projection.days.find(day => day.date === date);

  const openDay = (date: string) => setPanel({ date, events: dayOf(date)?.events ?? [] });
  const openBubble = (bubble: Bubble) => {
    const dates = new Set(bubble.events.map(event => event.date));
    setPanel({ date: bubble.date, events: bubble.events, title: dates.size > 1 ? `Week of ${shortDay(bubble.date)}` : undefined });
  };

  const requestMove = (event: ForecastEvent, toDate: string) => {
    setPanel(null);
    if (isDerivedBill(event)) {
      toast.error('Change this instalment from its warrant');
      return;
    }
    if (event.kind === 'bill' && event.occurrence?.bill) {
      const previous = event.occurrence.bill;
      saveBillPayment({ ...previous, dueDate: toDate });
      toast.success(`${event.description} moved to ${shortDay(toDate)}`, { action: { label: 'Undo', onClick: () => saveBillPayment(previous) } });
      return;
    }
    setPendingMove({ event, toDate });
  };

  const seriesOf = (event: ForecastEvent) => event.occurrence?.series;

  const goalName = (item: BufferSuggestion) => financialGoals.find(goal => goal.id === item.goalId)?.name ?? item.event.description;
  const suggestionTitle = (item: BufferSuggestion) => (item.action === 'pause-goal' ? `Pause ${goalName(item)}` : `Move ${item.event.description} to ${shortDay(item.toDate!)}`);

  const dismissSuggestion = (item: BufferSuggestion) => {
    setDismissed(prev => [...prev, item.id]);
    toast('Suggestion dismissed', { action: { label: 'Undo', onClick: () => setDismissed(prev => prev.filter(id => id !== item.id)) } });
  };

  const applySuggestion = (item: BufferSuggestion) => {
    if (item.action === 'move') {
      requestMove(item.event, item.toDate!);
      return;
    }
    const goalId = item.goalId!;
    setActiveGoalIds(prev => prev.filter(id => id !== goalId));
    toast.success(`${goalName(item)} is out of the forecast`, { action: { label: 'Undo', onClick: () => setActiveGoalIds(prev => (prev.includes(goalId) ? prev : [...prev, goalId])) } });
  };

  /** Recurring payments already ask which payments to move, so that is their confirmation. */
  const startSuggestion = (item: BufferSuggestion) => {
    if (item.action === 'move' && item.event.kind === 'recurring') applySuggestion(item);
    else setConfirming(item);
  };

  const moveJustThis = () => {
    if (!pendingMove) return;
    const { event, toDate } = pendingMove;
    const occurrence = event.occurrence!;
    const existing = recurringTransactionOverrides.find(item => item.recurringTransactionId === occurrence.sourceId && item.originalDate === occurrence.originalDate);
    saveRecurringOverride({ ...existing, recurringTransactionId: occurrence.sourceId, originalDate: occurrence.originalDate, date: toDate });
    toast.success(`${event.description} moved to ${shortDay(toDate)}`, {
      action: { label: 'Undo', onClick: () => (existing ? saveRecurringOverride(existing) : deleteRecurringOverride(occurrence.sourceId, occurrence.originalDate)) },
    });
    setPendingMove(null);
  };

  const moveThisAndLater = () => {
    if (!pendingMove) return;
    const { event, toDate } = pendingMove;
    const series = seriesOf(event);
    if (series) {
      const { ended, started } = moveFuture(series, event.occurrence!.originalDate, toDate);
      saveRecurringTransaction(ended);
      saveRecurringTransaction(started);
      toast.success(`${event.description} moved from ${shortDay(toDate)} on`);
    }
    setPendingMove(null);
  };

  const moveWholeSeries = () => {
    if (!pendingMove) return;
    const { event, toDate } = pendingMove;
    const series = seriesOf(event);
    if (series) {
      saveRecurringTransaction(moveSeries(series, event.occurrence!.originalDate, toDate));
      toast.success(`${event.description} series moved`, { action: { label: 'Undo', onClick: () => saveRecurringTransaction(series) } });
    }
    setPendingMove(null);
  };

  const editEvent = (event: ForecastEvent) => {
    setPanel(null);
    if (event.kind === 'goal') {
      setEditingGoal(financialGoals.find(goal => goal.id === event.goalId) ?? null);
    } else if (event.kind === 'bill' && event.occurrence?.bill) {
      setEditingBill(event.occurrence.bill);
      setFormMode('one-time');
    } else if (event.occurrence?.isOverride) {
      setOverrideItem(scheduledItem(event));
    } else if (seriesOf(event)) {
      setEditChoice(event);
    }
  };

  const scheduledItem = (event: ForecastEvent) => scheduledItemOf(event.occurrence!, accountName(event.occurrence!.accountId) ?? '');

  const editThisOne = () => {
    if (editChoice) setOverrideItem(scheduledItem(editChoice));
    setEditChoice(null);
  };

  const editSeries = () => {
    if (editChoice) {
      setEditingRecurring(seriesOf(editChoice) ?? null);
      setFormMode('recurring');
    }
    setEditChoice(null);
  };

  const editFuture = () => {
    const series = editChoice && seriesOf(editChoice);
    if (editChoice && series) {
      const start = editChoice.occurrence!.originalDate;
      const { ended, started } = moveFuture(series, start, start);
      setPendingEndedRecurring(ended);
      setEditingRecurring({ ...started, id: '' } as RecurringTransaction);
      setFormMode('recurring');
    }
    setEditChoice(null);
  };

  const pageStats: PageStat[] = [
    { label: 'Balance today', icon: 'wallet-02', value: summary.today, format: 'money' },
    { label: 'Lowest point', icon: 'chart-evaluation', value: summary.lowest?.value ?? 0, format: 'money' },
    { label: 'End of forecast', icon: 'target-01', value: summary.end, format: 'money' },
  ];

  const hasAccounts = selectedAccounts.length > 0;
  const showChart = isPhone || view === 'chart';
  const showList = isPhone || view === 'list';
  const dipsBelow = summary.below.count > 0;

  const biggestCard = biggest.length > 0 && (
  <section aria-label="Biggest ahead" className="surface-card rounded-[var(--radius-xl)] p-5">
    <h2 className="type-card-title text-ink">Biggest ahead</h2>
    <p className="type-caption text-muted">Open one to change its date.</p>
    <ul className="mt-2 grid gap-x-8 md:grid-cols-2 [&>li]:border-b [&>li]:border-line">
      {biggest.map(event => (
        <li key={event.key}>
          <button type="button" onClick={() => setPanel({ date: event.date, events: [event] })} className="flex min-h-12 w-full cursor-pointer items-center gap-3 py-1 text-left">
            <span className="type-caption w-12 shrink-0 text-muted">{shortDay(event.date)}</span>
            <span className="type-body min-w-0 flex-1 truncate text-ink">{event.description}</span>
            <span className="type-figure-row shrink-0"><Amount value={event.amount} currency={getMainCurrency()} tone="flow" /></span>
          </button>
        </li>
      ))}
    </ul>
  </section>
);
  const lowCard = lows.length > 0 && (
  <section aria-label="Low points" className="surface-card rounded-[var(--radius-xl)] p-5">
    <h2 className="type-card-title text-ink">Low points</h2>
    <ul className="mt-2 space-y-1.5">
      {lows.map(low => (
        <li key={low.label} className="flex justify-between gap-3">
          <span className="type-body text-muted">{low.label}<span className="type-caption block">{shortDay(low.date)}</span></span>
          <span className="type-figure-row shrink-0 text-ink"><Amount value={low.value} currency={getMainCurrency()} /></span>
        </li>
      ))}
    </ul>
  </section>
);
  const assumptionCard = (
    <section aria-label="What-if assumptions" className="surface-card rounded-[var(--radius-xl)] p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="type-card-title text-ink">Assumptions</h2>
        {hasAssumptions(assumptions) && (
          <Button variant="ghost" size="sm" onPress={() => setAssumptions(NO_ASSUMPTIONS)}>Reset</Button>
        )}
      </div>
      <p className="type-caption text-muted">Test how income changes, inflation, or market returns affect your horizon.</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <label className="block">
          <span className="type-caption text-muted">Income %</span>
          <input
            type="number"
            step="1"
            value={assumptions.incomeChange}
            onChange={e => setAssumptions(prev => ({ ...prev, incomeChange: Number(e.target.value) || 0 }))}
            className="mt-1 h-9 w-full rounded-[var(--radius-md)] border border-line bg-inset px-2.5 text-sm text-ink"
          />
        </label>
        <label className="block">
          <span className="type-caption text-muted">Inflation %</span>
          <input
            type="number"
            step="0.5"
            value={assumptions.inflation}
            onChange={e => setAssumptions(prev => ({ ...prev, inflation: Number(e.target.value) || 0 }))}
            className="mt-1 h-9 w-full rounded-[var(--radius-md)] border border-line bg-inset px-2.5 text-sm text-ink"
          />
        </label>
        <label className="block">
          <span className="type-caption text-muted">Market %</span>
          <input
            type="number"
            step="0.5"
            value={assumptions.marketReturn}
            onChange={e => setAssumptions(prev => ({ ...prev, marketReturn: Number(e.target.value) || 0 }))}
            className="mt-1 h-9 w-full rounded-[var(--radius-md)] border border-line bg-inset px-2.5 text-sm text-ink"
          />
        </label>
      </div>
    </section>
  );

  return (
    <div className="space-y-6 pb-8 max-md:space-y-4">
      <PageHeader
        title="Forecast"
        stats={pageStats}
        actions={<Button icon="add-01" onPress={() => { setFormDate(undefined); setFormMode('one-time'); }}>Add bill</Button>}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <MultiSelect
          className="w-64 max-sm:w-full"
          label="Accounts"
          options={sortAccountsByType(accounts.filter(account => account.status !== 'closed')).map(account => ({
            id: account.id,
            label: account.name,
            description: account.type,
            group: account.type,
          }))}
          value={selectedAccountIds}
          onChange={setSelectedAccountIds}
          placeholder="Choose accounts"
        />
        <div className="flex max-w-full flex-wrap items-center gap-2">
          {!isPhone && <SegmentedControl items={VIEWS} activeId={view} onChange={setView} />}
          <SegmentedControl items={FORECAST_RANGES} activeId={range} onChange={id => setRange(id as ForecastRange)} scrollable />
        </div>
      </div>

      {!hasAccounts ? (
        <EmptyState icon="bank" title="Choose an account" description="The forecast follows the accounts you pick." />
      ) : (
        <div className="grid gap-6 max-md:gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-6 max-md:space-y-4">
            {showChart && (
              <section aria-label="Cash horizon" className="surface-card rounded-[var(--radius-xl)] p-5 max-md:p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <h2 className="type-card-title text-ink">Cash horizon</h2>
                    <p className="type-caption text-muted">
                      {isPhone ? 'Select a row below to change a date.' : isWeekly ? 'Bubbles are grouped by week on this range. Choose 90 days or fewer to drag them.' : 'Drag a bill to another day. Loans, cards and goals are fixed.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-x-4">
                    <Switch isSelected={showHistory} onChange={setShowHistory}>Past 30d</Switch>
                    <Switch isSelected={showGoals} onChange={setShowGoals}>Goals</Switch>
                    {selectedAccounts.length > 1 && <Switch isSelected={splitAccounts} onChange={setSplitAccounts}>By account</Switch>}
                  </div>
                </div>
                <ForecastHorizonChart
                  days={chartDays}
                  today={projection.days[0]?.date}
                  bubbles={bubbles}
                  cushion={cushion}
                  lowest={summary.lowest}
                  plotHeight={isPhone ? undefined : 300}
                  revealKey={`${range}-${selectedAccountIds.join()}-${splitAccounts}-${showHistory}`}
                  showBubbles={!isPhone}
                  markers={markers}
                  lines={accountLines}
                  onOpen={openBubble}
                  onOpenDay={openDay}
                  onMove={(bubble, toDate) => requestMove(bubble.events[0], toDate)}
                />
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {!isPhone && LEGEND.map(item => (
                    <li key={item.label} className="type-caption flex items-center gap-1.5 text-muted">
                      <span aria-hidden="true" className={cn('size-2.5', item.shape)} style={{ backgroundColor: item.colour }} />{item.label}
                    </li>
                  ))}
                  <li className="type-caption flex items-center gap-1.5 text-muted"><span aria-hidden="true" className="h-3 w-0 border-l-2 border-solid border-ink" />Today</li>
                  {markers.length > 0 && <li className="type-caption flex items-center gap-1.5 text-muted"><span aria-hidden="true" className="h-3 w-0 border-l-2 border-dashed border-[var(--chart-4)]" />Goal</li>}
                  {!isPhone && <li className="type-caption flex items-center gap-1.5 text-muted"><span aria-hidden="true" className="h-3 w-0 border-l-2 border-dotted border-muted" />Dotted line: expected transaction</li>}
                  {accountLines?.map(line => (
                    <li key={line.id} className="type-caption flex items-center gap-1.5 text-muted">
                      <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ backgroundColor: line.colour }} />{line.name}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {showChart && biggestCard}
            {showList && <ForecastList days={projection.days} accountName={accountName} onOpen={event => setPanel({ date: event.date, events: [event] })} />}
          </div>

          <aside className="min-w-0 space-y-4">
            <section aria-label="What moves the line" className="surface-card rounded-[var(--radius-xl)] p-5">
              <h2 className="type-card-title text-ink">What moves the line</h2>
              <p className="type-caption text-muted">Today to {shortDay(iso(end))}</p>
              <dl className="mt-3 space-y-1.5">
                <div className="flex justify-between gap-3"><dt className="type-body text-muted">Today</dt><dd className="type-figure-row text-ink"><Amount value={summary.today} currency={getMainCurrency()} /></dd></div>
                <div className="flex justify-between gap-3"><dt className="type-body text-muted">Expected in</dt><dd className="type-figure-row"><Amount value={summary.expectedIn} currency={getMainCurrency()} tone="flow" /></dd></div>
                <div className="flex justify-between gap-3"><dt className="type-body text-muted">Going out</dt><dd className="type-figure-row text-ink"><Amount value={summary.goingOut} currency={getMainCurrency()} /></dd></div>
                <div className="flex justify-between gap-3 border-t border-line pt-1.5"><dt className="type-body-strong text-ink">On {shortDay(iso(end))}</dt><dd className="type-figure-row text-ink"><Amount value={summary.end} currency={getMainCurrency()} /></dd></div>
                {summary.lowest && <div className="flex justify-between gap-3"><dt className="type-body text-muted">Lowest, {shortDay(summary.lowest.date)}</dt><dd className="type-figure-row text-ink"><Amount value={summary.lowest.value} currency={getMainCurrency()} /></dd></div>}
                <div className="flex justify-between gap-3"><dt className="type-body text-muted">Days under buffer</dt><dd className="type-figure-row text-ink">{summary.below.count}</dd></div>
              </dl>
              {movers.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-line pt-3">
                  {movers.map(mover => (
                    <li key={mover.key} className="flex justify-between gap-3">
                      <span className="type-body min-w-0 truncate text-ink">{mover.label}{mover.count > 1 ? ` × ${mover.count}` : ''}</span>
                      <span className="type-figure-row shrink-0"><Amount value={mover.total} currency={getMainCurrency()} tone="flow" /></span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-label="Buffer status" className="surface-card flex items-start gap-3 rounded-[var(--radius-xl)] p-5">
              <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)]', dipsBelow ? 'bg-amber-soft' : 'bg-primary-soft')}>
                <Icon name={dipsBelow ? 'warning' : 'check'} size={20} className="text-ink" />
              </span>
              <div className="min-w-0">
                {dipsBelow ? (
                  <>
                    <h2 className="type-body-strong text-ink">Under your buffer for {summary.below.count} {summary.below.count === 1 ? 'day' : 'days'}</h2>
                    <p className="type-body text-muted">From {shortDay(summary.below.first!)}. The lowest point is {summary.lowest && <span className="whitespace-nowrap text-ink"><Amount value={summary.lowest.value} currency={getMainCurrency()} /></span>}.</p>
                    {suggestions.length > 0 && (
                      <ul aria-label="Ways to stay above your buffer" className="mt-3 space-y-2">
                        {suggestions.map(item => (
                          <li key={item.id} className="rounded-[var(--radius-md)] bg-inset p-3">
                            <div className="flex items-start justify-between gap-2">
                              <p className="type-body-strong min-w-0 break-words text-ink">{suggestionTitle(item)}</p>
                              <Badge className="shrink-0">{item.action === 'pause-goal' ? 'Goal' : item.event.kind === 'bill' ? 'One-time' : 'Recurring'}</Badge>
                            </div>
                            <p className="type-caption text-muted">
                              {item.action === 'pause-goal'
                                ? <>Keeps <span className="whitespace-nowrap"><Amount value={item.frees} currency={getMainCurrency()} /></span> from going to it before {shortDay(summary.below.first!)}.</>
                                : <><span className="whitespace-nowrap"><Amount value={item.frees} currency={getMainCurrency()} /></span> now due {shortDay(item.event.date)}, after your next income instead.</>}
                            </p>
                            <div className="mt-2 flex gap-2">
                              <Button size="sm" onPress={() => startSuggestion(item)}>Apply</Button>
                              <Button size="sm" variant="ghost" onPress={() => dismissSuggestion(item)}>Dismiss</Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    {dismissedCount > 0 && <Button className="mt-2" size="sm" variant="ghost" onPress={() => setDismissed([])}>Show {dismissedCount} dismissed</Button>}
                  </>
                ) : (
                  <>
                    <h2 className="type-body-strong text-ink">Above your buffer the whole way</h2>
                    {summary.lowest && <p className="type-body text-muted">Lowest point <span className="whitespace-nowrap text-ink"><Amount value={summary.lowest.value} currency={getMainCurrency()} /></span> on {shortDay(summary.lowest.date)}. Nothing to move.</p>}
                  </>
                )}
              </div>
            </section>

            <section aria-label="Cash buffer" className="surface-card rounded-[var(--radius-xl)] p-5">
              <h2 className="type-card-title text-ink">Cash buffer</h2>
              <p className="type-caption text-muted">The least you want to keep. Safe to spend uses the same number.</p>
              <div className="mt-3 flex items-end gap-1">
                <IconButton icon="minus-sign" label="Lower the buffer" isDisabled={cushion <= 0} onPress={() => setCushion(cushion - BUFFER_STEP)} />
                <AmountInput key={cushion} className="min-w-0 flex-1" label="Buffer" currency={getMainCurrency()} defaultValue={cushion ? String(cushion) : ''} onBlur={e => { const v = parseAmountInput((e.target as HTMLInputElement).value); setCushion(Number.isFinite(v) ? v : 0); }} />
                <IconButton icon="add-01" label="Raise the buffer" onPress={() => setCushion(cushion + BUFFER_STEP)} />
              </div>
            </section>
            {!showChart && biggestCard}
            {lowCard}
            {assumptionCard}
          </aside>
        </div>
      )}

      {panel && (
        <ForecastDayPanel
          date={panel.date}
          events={panel.events}
          title={panel.title}
          balance={dayOf(panel.date)?.total}
          onClose={() => setPanel(null)}
          onEdit={editEvent}
          onMove={requestMove}
          onAdd={() => {
            setFormDate(panel.date);
            setPanel(null);
            setEditingRecurring(null);
            setFormMode('recurring');
          }}
        />
      )}

      {confirming && (
        <ConfirmDialog
          isOpen
          onClose={() => setConfirming(null)}
          onConfirm={() => applySuggestion(confirming)}
          title={`${suggestionTitle(confirming)}?`}
          message={confirming.action === 'pause-goal'
            ? `Its saving stops counting in the forecast until you put it back. Your goal itself isn't changed. You can undo this.`
            : `It moves from ${shortDay(confirming.event.date)} to ${shortDay(confirming.toDate!)}. You can undo this.`}
          confirmLabel={confirming.action === 'pause-goal' ? 'Pause it' : 'Move it'}
        />
      )}

      {pendingMove && (
        <EditRecurrenceModal
          isOpen
          title={`Move ${pendingMove.event.description}?`}
          message={`To ${shortDay(pendingMove.toDate)}. Which payments should move?`}
          onClose={() => setPendingMove(null)}
          onEditSingle={moveJustThis}
          onEditFuture={moveThisAndLater}
          onEditSeries={moveWholeSeries}
        />
      )}

      {editChoice && <EditRecurrenceModal isOpen onClose={() => setEditChoice(null)} onEditSingle={editThisOne} onEditFuture={editFuture} onEditSeries={editSeries} />}

      {overrideItem && (
        <RecurringOverrideModal
          item={overrideItem}
          recurringTransactionOverrides={recurringTransactionOverrides}
          onClose={() => setOverrideItem(null)}
          onSave={saveRecurringOverride}
          onDelete={deleteRecurringOverride}
        />
      )}

      {formMode && (
        <RecurringTransactionModal
          isOpen
          onClose={() => { setFormMode(null); setEditingRecurring(null); setPendingEndedRecurring(null); setEditingBill(null); }}
          onSave={data => {
            if (pendingEndedRecurring) saveRecurringTransaction(pendingEndedRecurring);
            saveRecurringTransaction(data);
            setFormMode(null);
            setEditingRecurring(null);
            setPendingEndedRecurring(null);
          }}
          onSaveBill={data => { saveBillPayment(data); setFormMode(null); setEditingBill(null); setPendingEndedRecurring(null); }}
          accounts={accounts}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          recurringTransactionToEdit={editingRecurring}
          billToEdit={editingBill}
          initialMode={formMode}
          initialDate={formDate}
        />
      )}

      {editingGoal && (
        <GoalScenarioModal
          onClose={() => setEditingGoal(null)}
          onSave={saveFinancialGoal}
          goalToEdit={editingGoal}
          financialGoals={financialGoals}
          accounts={accounts}
        />
      )}
    </div>
  );
};

export default Forecasting;
