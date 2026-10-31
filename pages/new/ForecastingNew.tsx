import React, { useCallback, useMemo, useState } from 'react';
import type { FinancialGoal } from '../../types';
import { parseAmountInput, type Occurrence } from '../../utils/scheduleModel';
import { HORIZONS, hasAssumptions, NO_ASSUMPTIONS, type Driver, type ForecastEvent, type Horizon } from '../../utils/forecastModel';
import { presetAccounts, useForecastData, type AccountPreset } from '../../hooks/useForecastData';
import { useScheduleData } from '../../hooks/useScheduleData';
import { usePageAction, usePageSearch, useShellNew } from '../../components/new/shellContext';
import {
  ActiveFilters, ChoiceChips, FilterButton, FilterSection, FilterSheet, PageToolbar, ToolButton, ToolbarSpacer, type ActiveFilter,
} from '../../components/new/PageToolbar';
import { PeriodPill } from '../../components/new/tile';
import { SegmentedTabs } from '../../components/new/ui';
import { confirmNew } from '../../components/new/ConfirmDialog';
import { toast } from '../../components/new/toast';
import type { MenuEntry } from '../../components/new/schedule/parts';
import { TextField } from '../../components/new/transactions/parts';
import { OccurrenceSheet, PaySheet, ScheduleFormSheet, type FormTarget } from '../../components/new/schedule/sheets';
import { ComingUpCard, DriversCard, ForecastHero } from '../../components/new/forecast/overview';
import { TimelineView } from '../../components/new/forecast/timeline';
import { GoalsView } from '../../components/new/forecast/goals';
import { DaySheet, GoalSheet, ScenarioSheet, type GoalTarget } from '../../components/new/forecast/sheets';

/*
 * ForecastingNew (docs/FORECASTING_NEW_PLAN.md): where your cash is heading, the lowest point on the way, and whether
 * your goals get there. Tabs at the top (they swap the whole page, N21); the horizon pill, one Filters button and the
 * Scenario tool under them (N22, N23). Payments open the Schedule page's sheets. Logic in utils/forecastModel.ts,
 * utils/goalsModel.ts and hooks/useForecastData.ts.
 */

type Tab = 'overview' | 'timeline' | 'goals';
const TABS: Tab[] = ['overview', 'timeline', 'goals'];
const TAB_KEY = 'crystal-new.forecast-tab';
const readTab = (): Tab => {
  const fromHash = window.location.hash.replace('#', '') as Tab;
  if (TABS.includes(fromHash)) return fromHash;
  try { const stored = window.localStorage.getItem(TAB_KEY) as Tab | null; if (stored && TABS.includes(stored)) return stored; } catch { /* per-device */ }
  return 'overview';
};

const PRESETS: { id: AccountPreset; label: string }[] = [
  { id: 'liquid', label: 'Liquid cash' },
  { id: 'primary', label: 'Primary account' },
  { id: 'cash-cards', label: 'Cash and cards' },
  { id: 'everything', label: 'Everything' },
];

export const ForecastingNew: React.FC = () => {
  const data = useForecastData();
  const schedule = useScheduleData();
  const { navigate } = useShellNew();

  const [tab, setTabState] = useState<Tab>(readTab);
  const setTab = useCallback((next: Tab) => {
    setTabState(next);
    try { window.localStorage.setItem(TAB_KEY, next); } catch { /* per-device */ }
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${next}`);
  }, []);
  const [query, setQuery] = useState('');
  const [series, setSeries] = useState<Driver | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const [goalTarget, setGoalTarget] = useState<GoalTarget | null>(null);
  const [occurrence, setOccurrence] = useState<Occurrence | null>(null);
  const [paying, setPaying] = useState<Occurrence | null>(null);
  const [form, setForm] = useState<FormTarget | null>(null);
  const [cushionText, setCushionText] = useState(data.cushion !== undefined ? String(data.cushion) : '');

  usePageSearch({ value: query, onChange: setQuery, placeholder: 'Search forecast' });
  usePageAction(tab === 'goals'
    ? { label: 'Add goal', icon: 'add', onClick: () => setGoalTarget({ mode: 'new' }) }
    : { label: 'Plan a payment', icon: 'add', onClick: () => setForm({ mode: 'new' }) });

  // ---- opening things -------------------------------------------------------------------------------------

  const openEvent = (e: ForecastEvent) => {
    if (e.goalId) { const g = data.goals.find(x => x.id === e.goalId); if (g) setGoalTarget({ mode: 'edit', goal: g }); return; }
    if (e.occurrence) setOccurrence(schedule.occurrences.find(o => o.key === e.occurrence!.key) ?? e.occurrence);
  };

  const occurrenceMenu = (o: Occurrence): MenuEntry[] => {
    if (o.isReadOnly) {
      const owner = o.series?.id.startsWith('loan-pmt-') ? o.series.id.replace(/^loan-pmt-/, '').replace(/-\d+$/, '') : o.toAccountId;
      return owner ? [{ label: 'Open account', icon: 'external', onClick: () => navigate(`/accounts-new/${owner}${o.source === 'loan' ? '#plan' : ''}`) }] : [];
    }
    const entries: MenuEntry[] = [];
    const open = o.status !== 'paid' && o.status !== 'skipped';
    if (open) entries.push({ label: 'Mark paid', icon: 'checkCircle', onClick: () => setPaying(o) });
    if (o.source === 'recurring') {
      const rt = schedule.seriesById.get(o.sourceId);
      if (open) entries.push({ label: 'Skip this payment', icon: 'close', onClick: () => { const r = schedule.setSkipped(o, true); if ('undo' in r) toast.undo('Payment skipped', r.undo); setOccurrence(null); } });
      if (rt) {
        entries.push({ label: 'Edit this and future', icon: 'repeat', onClick: () => setForm({ mode: 'future', series: rt, originalDate: o.originalDate }) });
        entries.push({ label: 'Edit every payment', icon: 'settings', onClick: () => setForm({ mode: 'series', series: rt }) });
      }
    }
    if (o.source === 'bill' && o.bill) { const bill = o.bill; entries.push({ label: 'Edit bill', icon: 'edit', onClick: () => setForm({ mode: 'bill', bill }) }); }
    entries.push({ label: 'Open in Schedule', icon: 'calendar', onClick: () => navigate('/schedule-new#upcoming') });
    return entries;
  };

  const deleteGoal = async (goal: FinancialGoal) => {
    const items = data.goals.filter(g => g.parentId === goal.id);
    const ok = await confirmNew({
      title: `Delete "${goal.name}"?`,
      message: goal.isBucket && items.length ? `Its ${items.length} ${items.length === 1 ? 'goal goes' : 'goals go'} too.` : undefined,
      confirmLabel: 'Hold to delete',
      danger: true,
    });
    if (!ok) return;
    const r = data.deleteGoal(goal);
    if ('undo' in r) toast.undo('Goal deleted', r.undo);
    setGoalTarget(null);
  };

  const goalMenu = (goal: FinancialGoal, index: number, count: number): MenuEntry[] => {
    const say = (r: ReturnType<typeof data.toggleDone>, message: string) => { if ('undo' in r) toast.undo(message, r.undo); };
    const entries: MenuEntry[] = [{ label: 'Edit', icon: 'edit', onClick: () => setGoalTarget({ mode: 'edit', goal }) }];
    if (goal.isBucket) entries.push({ label: 'Add a goal to it', icon: 'add', onClick: () => setGoalTarget({ mode: 'new', parentId: goal.id }) });
    else {
      entries.push({ label: goal.completed ? 'Mark not done' : 'Mark done', icon: goal.completed ? 'undo' : 'checkCircle', onClick: () => say(data.toggleDone(goal), goal.completed ? 'Goal reopened' : 'Goal done') });
      entries.push({ label: 'Duplicate', icon: 'copy', onClick: () => say(data.duplicateGoal(goal), 'Goal duplicated') });
    }
    if (index > 0) entries.push({ label: 'Move up', icon: 'arrowUpRight', onClick: () => say(data.move(goal.id, -1), 'Goal moved') });
    if (index >= 0 && index < count - 1) entries.push({ label: 'Move down', icon: 'arrowDown', onClick: () => say(data.move(goal.id, 1), 'Goal moved') });
    entries.push({ label: 'Delete', icon: 'delete', danger: true, onClick: () => deleteGoal(goal) });
    return entries;
  };

  // ---- filters --------------------------------------------------------------------------------------------

  const presetOf = useMemo(() => PRESETS.find(p => {
    const ids = presetAccounts(data.accounts, p.id);
    return ids.length > 0 && ids.length === data.selection.length && ids.every(id => data.selection.includes(id));
  })?.id, [data.accounts, data.selection]);

  const active: ActiveFilter[] = [
    { key: 'accounts', label: presetOf ? PRESETS.find(p => p.id === presetOf)!.label : `${data.selection.length} ${data.selection.length === 1 ? 'account' : 'accounts'}`, icon: 'bank' as const, onRemove: () => data.setSelection([]) },
    ...(hasAssumptions(data.assumptions) ? [{ key: 'scenario', label: 'Scenario on', icon: 'sparkles' as const, onRemove: () => data.setAssumptions(NO_ASSUMPTIONS) }] : []),
    ...(series ? [{ key: 'series', label: series.label, icon: 'repeat' as const, onRemove: () => setSeries(null) }] : []),
  ].filter(f => f.key !== 'accounts' || presetOf !== 'liquid');

  const saveCushion = (text: string) => {
    setCushionText(text);
    const value = parseAmountInput(text);
    data.setCushion(text.trim() && Number.isFinite(value) ? value : undefined);
  };

  return (
    <div className="space-y-4 pb-10">
      <SegmentedTabs<Tab>
        label="Forecast views"
        value={tab}
        onChange={setTab}
        items={[{ id: 'overview', label: 'Overview', icon: 'chartLine' }, { id: 'timeline', label: 'Timeline', icon: 'list' }, { id: 'goals', label: 'Goals', icon: 'award' }]}
      />

      <PageToolbar>
        <PeriodPill<Horizon> label="Horizon" value={data.horizon} options={HORIZONS} onChange={data.setHorizon} />
        <FilterButton count={(presetOf === 'liquid' ? 0 : 1)} onClick={() => setFiltersOpen(true)} />
        <ToolbarSpacer />
        <ToolButton icon="sparkles" label={hasAssumptions(data.assumptions) ? 'Scenario on' : 'Scenario'} onClick={() => setScenarioOpen(true)} variant={hasAssumptions(data.assumptions) ? 'primary' : 'secondary'} />
      </PageToolbar>
      <ActiveFilters filters={active} onClearAll={() => { data.setSelection([]); data.setAssumptions(NO_ASSUMPTIONS); setSeries(null); }} />

      {tab === 'overview' && (
        <>
          <ForecastHero data={data} onPickDay={setDay} />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <DriversCard data={data} onPick={d => { setSeries(d); setTab('timeline'); }} />
            <ComingUpCard data={data} onOpen={openEvent} onShowAll={() => setTab('timeline')} />
          </div>
        </>
      )}
      {tab === 'timeline' && <TimelineView data={data} query={query} seriesKey={series?.key ?? null} onOpenEvent={openEvent} onOpenDay={setDay} />}
      {tab === 'goals' && <GoalsView data={data} query={query} onOpen={goal => setGoalTarget({ mode: 'edit', goal })} onAdd={parentId => setGoalTarget({ mode: 'new', parentId })} menuFor={goalMenu} />}

      <FilterSheet open={filtersOpen} onOpenChange={setFiltersOpen} resultLabel={`Forecast ${data.selection.length} ${data.selection.length === 1 ? 'account' : 'accounts'}`} onReset={() => data.setSelection([])}>
        <FilterSection title="Quick choice">
          <ChoiceChips label="Accounts preset" options={PRESETS.filter(p => presetAccounts(data.accounts, p.id).length > 0)} selected={presetOf ? [presetOf] : []} onChange={ids => data.setSelection(presetAccounts(data.accounts, ids[0] as AccountPreset))} />
        </FilterSection>
        <FilterSection title="Accounts" count={data.selection.length}>
          <ChoiceChips
            label="Accounts"
            multiple
            options={data.candidates.map(a => ({ id: a.id, label: a.name }))}
            selected={data.selection}
            onChange={ids => data.setSelection(ids)}
          />
        </FilterSection>
        <FilterSection title="Safety cushion">
          <TextField label={`Stay above (${data.displayCurrency})`} value={cushionText} onChange={saveCushion} placeholder="None" />
        </FilterSection>
      </FilterSheet>

      <ScenarioSheet open={scenarioOpen} onClose={() => setScenarioOpen(false)} data={data} />
      <DaySheet date={day} data={data} onClose={() => setDay(null)} onOpenEvent={e => { setDay(null); openEvent(e); }} onPlan={date => { setDay(null); setForm({ mode: 'new', startDate: date }); }} />
      <GoalSheet target={goalTarget} data={data} onClose={() => setGoalTarget(null)} onDelete={deleteGoal} />
      <OccurrenceSheet o={paying ? null : occurrence} data={schedule} onClose={() => setOccurrence(null)} onPay={o => setPaying(o)} menu={occurrenceMenu} />
      <PaySheet o={paying} data={schedule} onClose={() => setPaying(null)} onPaid={() => { setPaying(null); setOccurrence(null); }} />
      <ScheduleFormSheet target={form} data={schedule} onClose={() => setForm(null)} />
    </div>
  );
};

export default ForecastingNew;
