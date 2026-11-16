import React, { useDeferredValue, useMemo, useState } from 'react';
import { getMainCurrency, round2 } from '../utils';
import { balanceHistory, defaultFireAccounts, monthlyCashflow, trailingSavings } from '../utils/fireModel';
import { buildCone, computeFireMilestones, normalizeFireSettings, type FireSettings, type PlanEvent } from '../utils/fireCone';
import { useAccountSelector, usePreferencesContext, useTransactionSelector } from '../contexts/DomainProviders';
import { useGoalsContext } from '../contexts/FinancialDataContext';
import { FanChart, OddsChart } from '../components/FireCharts';
import PageHeader, { type PageStat } from '../components/PageHeader';
import { Button } from '../components/ui/Actions';
import { Badge } from '../components/ui/Display';
import { DateInput, Slider, TextInput } from '../components/ui/Fields';
import { Amount } from '../components/ui/Money';
import { MultiSelect, Select, type PickerOption } from '../components/ui/Pickers';
import SegmentedControl from '../components/ui/SegmentedControl';
import { EmptyState } from '../components/ui/States';

const CARD = 'surface-card min-w-0 rounded-[var(--radius-xl)] p-5 border border-line';
const pct = (v: number) => `${Math.round(v * 100)}%`;
const whenLabel = (today: Date, years: number) =>
  years === 0 ? 'now' : new Date(today.getFullYear() + years, today.getMonth(), 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

/** A slider range that has `base` on one of its steps, so it opens on the real number instead of the nearest step. */
const aligned = (base: number, step: number, below: number, above: number) => ({
  min: Math.max(0, base - Math.floor(below / step) * step),
  max: base + Math.ceil(above / step) * step,
});

/** One-off amounts that change the plan: a deposit on a home, a gap year, an inheritance. */
const PlannedMoney: React.FC<{
  events: PlanEvent[];
  currency: string;
  onChange: (events: PlanEvent[]) => void;
  onPullGoals?: () => void;
  hasPullableGoals?: boolean;
}> = ({ events, currency, onChange, onPullGoals, hasPullableGoals }) => {
  const [label, setLabel] = useState('');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<'out' | 'in'>('out');
  const value = parseFloat(amount.replace(',', '.'));
  const valid = label.trim() !== '' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(value) && value > 0;
  const add = () => {
    if (!valid) return;
    onChange([...events, { id: `${Date.now()}`, label: label.trim(), date, amount: kind === 'out' ? -value : value }].sort((a, b) => a.date.localeCompare(b.date)));
    setLabel('');
    setDate('');
    setAmount('');
  };

  return (
    <section className={CARD}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="type-card-title text-ink">Planned costs and windfalls</h2>
          <p className="type-caption text-muted">One-off amounts that change the picture, like a home deposit, a gap year, or an inheritance.</p>
        </div>
        {hasPullableGoals && onPullGoals && (
          <Button size="sm" variant="secondary" icon="target-01" onPress={onPullGoals}>
            Pull from Goals
          </Button>
        )}
      </div>

      {events.length > 0 && (
        <ul className="mb-4 divide-y divide-line">
          {events.map(event => (
            <li key={event.id ?? event.date + event.label} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="type-body text-ink">{event.label}</span>
                <span className="type-caption ml-2 text-muted">{event.date}</span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <Amount value={event.amount} currency={currency} tone="flow" className="type-body-strong text-ink" />
                <Button variant="ghost" size="sm" onPress={() => onChange(events.filter(e => e !== event))} aria-label={`Remove ${event.label}`}>
                  Remove
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_9rem_9rem_8rem_auto]">
        <TextInput label="What" value={label} onChange={setLabel} placeholder="Home deposit" />
        <DateInput label="When" value={date} onChange={setDate} />
        <Select label="Kind" value={kind} onChange={id => setKind(id as 'out' | 'in')} options={[{ id: 'out', label: 'Costs' }, { id: 'in', label: 'Brings in' }]} />
        <TextInput label="Amount" inputMode="decimal" value={amount} onChange={setAmount} />
        <Button onPress={add} isDisabled={!valid}>Add</Button>
      </div>
    </section>
  );
};

const FirePage: React.FC = () => {
  const accounts = useAccountSelector(a => a);
  const transactions = useTransactionSelector(t => t);
  const { financialGoals } = useGoalsContext();
  const { preferences, setPreferences } = usePreferencesContext();
  const currency = getMainCurrency();
  const today = useMemo(() => new Date(), []);
  const [fanView, setFanView] = useState<'chart' | 'table'>('chart');

  const tweak = useMemo(() => normalizeFireSettings(preferences.fire), [preferences.fire]);
  const set = (patch: Partial<FireSettings>) =>
    setPreferences(prev => ({ ...prev, fire: normalizeFireSettings({ ...prev.fire, ...patch }) }));

  const defaultCounted = useMemo(() => defaultFireAccounts(accounts), [accounts]);
  const selectedIds = useMemo(() => {
    if (tweak.accountIds && tweak.accountIds.length > 0) return tweak.accountIds;
    return defaultCounted.map(a => a.id);
  }, [tweak.accountIds, defaultCounted]);

  const base = useMemo(() => {
    const idSet = new Set(selectedIds);
    const counted = accounts.filter(a => idSet.has(a.id) && a.status !== 'closed');
    const history = balanceHistory(counted, transactions, today);
    const trailing = trailingSavings(monthlyCashflow(transactions, accounts, today, 24, preferences.showBalanceAdjustments ?? true), 12);
    return {
      portfolio: Math.max(0, history[history.length - 1]?.value ?? 0),
      accountCount: counted.length,
      months: trailing.months,
      spending: trailing.months > 0 ? Math.round((trailing.spending / trailing.months) * 12) : 0,
      saving: trailing.months > 0 ? Math.max(0, Math.round(trailing.saved / trailing.months)) : 0,
    };
  }, [accounts, selectedIds, transactions, today, preferences.showBalanceAdjustments]);

  const events = tweak.events ?? [];
  const hasHistory = base.spending > 0;
  const spending = tweak.spending ?? (hasHistory ? base.spending : 30000);
  const saving = tweak.saving ?? base.saving;
  const mean = tweak.expectedReturn ?? 0.05;
  const vol = tweak.volatility ?? 0.12;
  const planYears = tweak.planYears ?? 35;
  const pensionMonthly = tweak.pensionMonthly ?? 0;
  const pensionStartYears = tweak.pensionStartYears ?? 20;

  const inputs = useDeferredValue({
    spending,
    saving,
    mean,
    vol,
    planYears,
    stopIn: tweak.stopIn,
    events,
    pensionMonthly,
    pensionStartYears,
  });

  const cone = useMemo(
    () =>
      spending > 0
        ? buildCone({
            start: base.portfolio,
            monthlySaving: inputs.saving,
            annualSpending: inputs.spending,
            expectedReturn: inputs.mean,
            volatility: inputs.vol,
            planYears: inputs.planYears,
            today,
            events: inputs.events,
            pensionMonthly: inputs.pensionMonthly,
            pensionStartYears: inputs.pensionStartYears,
            retireInYears: inputs.stopIn,
            maxWaitYears: 35,
            paths: 1500,
          })
        : null,
    [base.portfolio, inputs, today, spending],
  );

  const milestones = useMemo(
    () =>
      cone
        ? computeFireMilestones(
            {
              start: base.portfolio,
              monthlySaving: inputs.saving,
              annualSpending: inputs.spending,
              expectedReturn: inputs.mean,
              volatility: inputs.vol,
              planYears: inputs.planYears,
              today,
              events: inputs.events,
              pensionMonthly: inputs.pensionMonthly,
              pensionStartYears: inputs.pensionStartYears,
            },
            cone,
          )
        : null,
    [cone, base.portfolio, inputs, today],
  );

  const accountOptions = useMemo<PickerOption[]>(
    () =>
      accounts
        .filter(a => a.status !== 'closed' && (a.type === 'Checking' || a.type === 'Savings' || a.type === 'Investment' || (a.type === 'Other Assets' && a.otherSubType === 'Cash')))
        .map(a => ({ id: a.id, label: a.name, group: a.type })),
    [accounts],
  );

  const pullableGoals = useMemo(() => {
    const todayStr = today.toISOString().slice(0, 10);
    const existingKeys = new Set(events.map(e => `${e.label}|${e.date}`));
    return financialGoals.filter(
      g => !g.completed && !g.disabled && g.date && g.date > todayStr && g.amount > g.currentAmount && !existingKeys.has(`${g.name}|${g.date}`),
    );
  }, [financialGoals, events, today]);

  const pullFromGoals = () => {
    const added: PlanEvent[] = pullableGoals.map(g => ({
      id: `goal:${g.id}`,
      label: g.name,
      date: g.date!,
      amount: -round2(Math.max(0, g.amount - g.currentAmount)),
    }));
    set({ events: [...events, ...added].sort((a, b) => a.date.localeCompare(b.date)) });
  };

  if (defaultCounted.length === 0) {
    return (
      <div className="space-y-6 pb-8">
        <PageHeader title="Financial independence" />
        <EmptyState
          icon="chart-column"
          title="Not enough to go on yet"
          description="Add cash, savings or investment accounts, and Crystal will show the odds that your money lasts."
        />
      </div>
    );
  }

  const chosen = cone?.chosen;
  const range = (b: number, step: number) => aligned(b, step, b * 0.5, b * 0.5 + step);
  const spendRange = range(hasHistory ? base.spending : 30000, 500);
  const saveRange = aligned(base.saving, 50, base.saving, Math.max(1000, base.saving));
  const fmtMoney = { style: 'currency', currency, maximumFractionDigits: 0 } as const;

  const stats: PageStat[] = [
    { label: 'Invested today', icon: 'wallet-02', value: round2(base.portfolio), format: 'money', currency },
    ...(milestones
      ? [
          { label: 'FI target (25×)', icon: 'target-01', value: milestones.fiTarget, format: 'money' as const, currency },
          {
            label: 'FI progress',
            icon: 'chart-increase',
            value: Math.round(milestones.fiProgress * 100),
            format: 'percent' as const,
            ...(milestones.coastFireReached ? { badge: 'Coast FIRE', badgeTone: 'pine' as const } : {}),
          },
        ]
      : []),
    ...(cone
      ? [
          {
            label: 'Target year',
            icon: 'calendar-03',
            value: cone.earliest === null ? 0 : today.getFullYear() + cone.earliest,
            format: 'year' as const,
            badge: cone.earliest === null ? 'Over 35y' : cone.earliest === 0 ? 'Ready now' : `${cone.earliest}y`,
            badgeTone: cone.earliest !== null && cone.earliest <= 15 ? 'pine' as const : 'butter' as const,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Financial independence"
        subtitle="Monte Carlo simulation across 1,500 market paths in today's money."
        stats={stats}
      />

      {cone && chosen && (
        <section className={CARD} aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="type-body text-ink">
                {cone.earliest === null
                  ? <>At this pace the money does not reach {pct(cone.targetOdds)} odds of lasting {planYears} years within 35 years.</>
                  : cone.earliest === 0
                    ? <>You could stop working now: in {pct(cone.curve[0].odds)} of futures the money lasts {planYears} years.</>
                    : <>You are on course to stop working in about <span className="type-body-strong">{cone.earliest} years</span> ({whenLabel(today, cone.earliest)}), when {pct(cone.targetOdds)} of futures last {planYears} years.</>}
              </p>
              <p className="type-caption text-muted">
                Stopping in {chosen.years === 0 ? 'now' : `${chosen.years} years`}: <span className="font-semibold text-ink">{pct(chosen.odds)}</span> of futures last. Median ending balance{' '}
                <Amount value={chosen.endMedian} currency={currency} className="type-caption font-semibold text-ink" />, poor market (p10){' '}
                <Amount value={chosen.endP10} currency={currency} className="type-caption font-semibold text-ink" />.
              </p>
            </div>
            {milestones && (
              <Badge tone={milestones.coastFireReached ? 'positive' : 'neutral'}>
                {milestones.coastFireReached
                  ? `Coast FIRE reached (${pct(milestones.coastFireOdds)} odds with €0 saved)`
                  : `Coast FIRE odds: ${pct(milestones.coastFireOdds)}`}
              </Badge>
            )}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className={CARD}>
          <h2 className="type-card-title mb-1 text-ink">When can you stop?</h2>
          <p className="type-caption mb-3 text-muted">The chance your money lasts {planYears} years for each stopping year. Click a year to inspect.</p>
          {cone && chosen && <OddsChart curve={cone.curve} target={cone.targetOdds} chosen={chosen.years} onSelect={years => set({ stopIn: years })} />}
        </section>

        <section className={CARD}>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="type-card-title text-ink">What the money could do</h2>
              <p className="type-caption text-muted">Median path, middle 50% band (p25–p75), and outer 80% band (p10–p90).</p>
            </div>
            <SegmentedControl
              items={[{ id: 'chart', label: 'Chart' }, { id: 'table', label: 'Table' }]}
              activeId={fanView}
              onChange={id => setFanView(id as 'chart' | 'table')}
            />
          </div>
          {chosen && fanView === 'chart' && <FanChart fan={chosen.fan} retireAt={chosen.years} currency={currency} />}
          {chosen && fanView === 'table' && (
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-solid">
                  <tr className="border-b border-line type-label text-muted">
                    <th className="py-1.5 pr-2">Year</th>
                    <th className="py-1.5 px-2 text-right">Poor (p10)</th>
                    <th className="py-1.5 px-2 text-right">Median (p50)</th>
                    <th className="py-1.5 pl-2 text-right">Strong (p90)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {chosen.fan.filter((_, i) => i % 5 === 0 || i === chosen.fan.length - 1).map(pt => (
                    <tr key={pt.year} className="type-caption">
                      <td className="py-1.5 pr-2 font-medium text-ink">{today.getFullYear() + pt.year} (+{pt.year}y)</td>
                      <td className="py-1.5 px-2 text-right text-muted"><Amount value={pt.p10} currency={currency} /></td>
                      <td className="py-1.5 px-2 text-right font-semibold text-ink"><Amount value={pt.p50} currency={currency} /></td>
                      <td className="py-1.5 pl-2 text-right text-muted"><Amount value={pt.p90} currency={currency} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className={CARD}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="type-card-title text-ink">Try a change</h2>
          {preferences.fire && (
            <Button variant="ghost" size="sm" onPress={() => setPreferences(prev => ({ ...prev, fire: undefined }))}>
              Back to my numbers
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-3">
          <Slider label="Stop working in (years)" minValue={0} maxValue={35} step={1} value={chosen?.years ?? 0} onChange={stopIn => set({ stopIn })} />
          <Slider label="Spent each year" minValue={spendRange.min} maxValue={spendRange.max} step={500} value={spending} onChange={v => set({ spending: v })} formatOptions={fmtMoney} />
          <Slider label="Saved each month" minValue={saveRange.min} maxValue={saveRange.max} step={50} value={saving} onChange={v => set({ saving: v })} formatOptions={fmtMoney} />
        </div>

        <h3 className="type-label mt-5 mb-2 text-muted">Market &amp; retirement assumptions</h3>
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-3">
          <Slider label="Yearly return after inflation" minValue={0.01} maxValue={0.09} step={0.005} value={mean} onChange={v => set({ expectedReturn: v })} formatOptions={{ style: 'percent', maximumFractionDigits: 1 }} />
          <Slider label="Ups and downs (volatility)" minValue={0.02} maxValue={0.25} step={0.01} value={vol} onChange={v => set({ volatility: v })} formatOptions={{ style: 'percent', maximumFractionDigits: 0 }} />
          <Slider label="It must last (years)" minValue={10} maxValue={60} step={1} value={planYears} onChange={v => set({ planYears: v })} />
        </div>

        <h3 className="type-label mt-5 mb-2 text-muted">Post-retirement income &amp; portfolio scope</h3>
        <div className="grid grid-cols-1 items-end gap-x-6 gap-y-3 md:grid-cols-3">
          <Slider label="Monthly pension (today's money)" minValue={0} maxValue={5000} step={100} value={pensionMonthly} onChange={v => set({ pensionMonthly: v })} formatOptions={fmtMoney} />
          <Slider label="Pension starts in (years)" minValue={0} maxValue={45} step={1} value={pensionStartYears} onChange={v => set({ pensionStartYears: v })} />
          <MultiSelect
            label="Accounts included"
            options={accountOptions}
            value={selectedIds}
            onChange={ids => set({ accountIds: ids.length ? ids : undefined })}
            placeholder="All liquid & investment"
          />
        </div>
      </section>

      <PlannedMoney
        events={events}
        currency={currency}
        onChange={next => set({ events: next })}
        hasPullableGoals={pullableGoals.length > 0}
        onPullGoals={pullFromGoals}
      />

      <section className={CARD}>
        <h2 className="type-card-title mb-2 text-ink">Where this starts</h2>
        <dl className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <dt className="type-caption text-muted">Invested and saved today</dt>
            <dd className="type-figure-md text-ink"><Amount value={round2(base.portfolio)} currency={currency} /></dd>
            <p className="type-caption text-muted">{base.accountCount} selected cash, savings and investment accounts</p>
          </div>
          <div>
            <dt className="type-caption text-muted">Spending a year</dt>
            <dd className="type-figure-md text-ink"><Amount value={hasHistory ? base.spending : spending} currency={currency} /></dd>
            <p className="type-caption text-muted">
              {hasHistory ? `From your last ${base.months} ${base.months === 1 ? 'month' : 'months'}` : 'No recent spending found, so this is a placeholder. Set your own above.'}
            </p>
          </div>
          <div>
            <dt className="type-caption text-muted">Saved a month</dt>
            <dd className="type-figure-md text-ink"><Amount value={base.saving} currency={currency} /></dd>
            <p className="type-caption text-muted">Income less spending, same months</p>
          </div>
        </dl>
        <p className="type-caption mt-4 text-muted">
          Each of 1,500 possible futures draws a random return every month around the real return you set. Everything is in today&apos;s money. It is arithmetic on your own figures, not advice: it ignores tax and assumes steady saving and spending.
        </p>
      </section>
    </div>
  );
};

export default FirePage;
