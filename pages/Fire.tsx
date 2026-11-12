import React, { useDeferredValue, useMemo, useState } from 'react';
import { getMainCurrency, round2 } from '../utils';
import { balanceHistory, defaultFireAccounts, monthlyCashflow, trailingSavings } from '../utils/fireModel';
import { buildCone, normalizeFireSettings, type FireSettings, type PlanEvent } from '../utils/fireCone';
import { useAccountSelector, usePreferencesContext, useTransactionSelector } from '../contexts/DomainProviders';
import { FanChart, OddsChart } from '../components/FireCharts';
import PageHeader from '../components/PageHeader';
import { Button } from '../components/ui/Actions';
import { DateInput, Slider, TextInput } from '../components/ui/Fields';
import { Select } from '../components/ui/Pickers';
import { Amount } from '../components/ui/Money';
import { EmptyState } from '../components/ui/States';

const CARD = 'surface-card min-w-0 rounded-[var(--radius-xl)] p-5 border border-line';
const pct = (v: number) => `${Math.round(v * 100)}%`;
const whenLabel = (today: Date, years: number) => years === 0 ? 'now' : new Date(today.getFullYear() + years, today.getMonth(), 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

/** A slider range that has `base` on one of its steps, so it opens on the real number instead of the nearest step. */
const aligned = (base: number, step: number, below: number, above: number) => ({ min: Math.max(0, base - Math.floor(below / step) * step), max: base + Math.ceil(above / step) * step });

/** One-off amounts that change the plan: a deposit on a home, a gap year, an inheritance. */
const PlannedMoney: React.FC<{ events: PlanEvent[]; currency: string; onChange: (events: PlanEvent[]) => void }> = ({ events, currency, onChange }) => {
  const [label, setLabel] = useState('');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<'out' | 'in'>('out');
  const value = parseFloat(amount.replace(',', '.'));
  const valid = label.trim() !== '' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(value) && value > 0;
  const add = () => {
    if (!valid) return;
    onChange([...events, { id: `${Date.now()}`, label: label.trim(), date, amount: kind === 'out' ? -value : value }].sort((a, b) => a.date.localeCompare(b.date)));
    setLabel(''); setDate(''); setAmount('');
  };
  return (
    <section className={CARD}>
      <h2 className="type-card-title mb-1 text-ink">Planned costs and windfalls</h2>
      <p className="type-caption mb-3 text-muted">One-off amounts that change the picture, like a home deposit, a gap year or an inheritance. Dates in the past are ignored.</p>
      {events.length > 0 && (
        <ul className="mb-4 divide-y divide-line">
          {events.map(event => (
            <li key={event.id ?? event.date + event.label} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0"><span className="type-body text-ink">{event.label}</span><span className="type-caption ml-2 text-muted">{event.date}</span></span>
              <span className="flex shrink-0 items-center gap-3">
                <Amount value={event.amount} currency={currency} tone="flow" className="type-body-strong text-ink" />
                <Button variant="ghost" size="sm" onPress={() => onChange(events.filter(e => e !== event))} aria-label={`Remove ${event.label}`}>Remove</Button>
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
  const { preferences, setPreferences } = usePreferencesContext();
  const currency = getMainCurrency();
  const today = useMemo(() => new Date(), []);

  const base = useMemo(() => {
    const counted = defaultFireAccounts(accounts);
    const history = balanceHistory(counted, transactions, today);
    const trailing = trailingSavings(monthlyCashflow(transactions, accounts, today, 24, preferences.showBalanceAdjustments ?? true), 12);
    return {
      portfolio: Math.max(0, history[history.length - 1]?.value ?? 0),
      accountCount: counted.length,
      months: trailing.months,
      spending: trailing.months > 0 ? Math.round((trailing.spending / trailing.months) * 12) : 0,
      saving: trailing.months > 0 ? Math.max(0, Math.round(trailing.saved / trailing.months)) : 0,
    };
  }, [accounts, transactions, today, preferences.showBalanceAdjustments]);

  // Kept in your preferences, so the plan follows you across devices.
  const tweak = useMemo(() => normalizeFireSettings(preferences.fire), [preferences.fire]);
  const set = (patch: Partial<FireSettings>) => setPreferences(prev => ({ ...prev, fire: normalizeFireSettings({ ...prev.fire, ...patch }) }));
  const events = tweak.events ?? [];
  // Without history there is nothing real to start from, so a round placeholder is shown and said to be one.
  const hasHistory = base.spending > 0;
  const spending = tweak.spending ?? (hasHistory ? base.spending : 30000);
  const saving = tweak.saving ?? base.saving;
  const mean = tweak.expectedReturn ?? 0.05;
  const vol = tweak.volatility ?? 0.12;
  const planYears = tweak.planYears ?? 35;

  const inputs = useDeferredValue({ spending, saving, mean, vol, planYears, stopIn: tweak.stopIn, events });
  const cone = useMemo(() => spending > 0 ? buildCone({
    start: base.portfolio, monthlySaving: inputs.saving, annualSpending: inputs.spending, expectedReturn: inputs.mean, volatility: inputs.vol,
    planYears: inputs.planYears, today, events: inputs.events, retireInYears: inputs.stopIn, maxWaitYears: 35, paths: 1500,
  }) : null, [base.portfolio, inputs, today, spending]);

  if (base.accountCount === 0) {
    return (
      <div className="space-y-6 pb-8">
        <PageHeader title="Financial independence" />
        <EmptyState icon="chart-column" title="Not enough to go on yet" description="Add cash, savings or investment accounts, and Crystal will show the odds that your money lasts." />
      </div>
    );
  }

  const chosen = cone?.chosen;
  const range = (b: number, step: number) => aligned(b, step, b * 0.5, b * 0.5 + step);
  const spendRange = range(hasHistory ? base.spending : 30000, 500);
  const saveRange = aligned(base.saving, 50, base.saving, Math.max(1000, base.saving));
  const fmtMoney = { style: 'currency', currency, maximumFractionDigits: 0 } as const;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader title="Financial independence" />

      {cone && chosen && (
        <section className={CARD} aria-live="polite">
          <p className="type-body text-ink">
            {cone.earliest === null
              ? <>At this pace the money does not reach {pct(cone.targetOdds)} odds of lasting {planYears} years within 35 years.</>
              : cone.earliest === 0
                ? <>You could stop working now: in {pct(cone.curve[0].odds)} of futures the money lasts {planYears} years.</>
                : <>You are on course to stop working in about <span className="type-body-strong">{cone.earliest} years</span> ({whenLabel(today, cone.earliest)}), when {pct(cone.targetOdds)} of futures last {planYears} years.</>}
          </p>
          <p className="type-caption mt-1 text-muted">
            Stopping in {chosen.years === 0 ? 'now' : `${chosen.years} years`}: <span className="text-ink">{pct(chosen.odds)}</span> of futures last. The middle one ends with{' '}
            <Amount value={chosen.endMedian} currency={currency} className="type-caption" />, and a poor one with <Amount value={chosen.endP10} currency={currency} className="type-caption" />.
          </p>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className={CARD}>
          <h2 className="type-card-title mb-1 text-ink">When can you stop?</h2>
          <p className="type-caption mb-3 text-muted">The chance your money lasts {planYears} years, for each year you could stop working. Press a year to look at it.</p>
          {cone && chosen && <OddsChart curve={cone.curve} target={cone.targetOdds} chosen={chosen.years} onSelect={years => set({ stopIn: years })} />}
        </section>
        <section className={CARD}>
          <h2 className="type-card-title mb-1 text-ink">What the money could do</h2>
          <p className="type-caption mb-3 text-muted">The middle outcome, with the darker band holding half of futures and the lighter band four in five.</p>
          {chosen && <FanChart fan={chosen.fan} retireAt={chosen.years} currency={currency} />}
        </section>
      </div>

      <section className={CARD}>
        <h2 className="type-card-title mb-3 text-ink">Try a change</h2>
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-3">
          <Slider label="Stop working in (years)" minValue={0} maxValue={35} step={1} value={chosen?.years ?? 0} onChange={stopIn => set({ stopIn })} />
          <Slider label="Spent each year" minValue={spendRange.min} maxValue={spendRange.max} step={500} value={spending} onChange={v => set({ spending: v })} formatOptions={fmtMoney} />
          <Slider label="Saved each month" minValue={saveRange.min} maxValue={saveRange.max} step={50} value={saving} onChange={v => set({ saving: v })} formatOptions={fmtMoney} />
        </div>
        <h3 className="type-label mt-4 mb-1 text-muted">Assumptions</h3>
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-3">
          <Slider label="Yearly return after inflation" minValue={0.01} maxValue={0.09} step={0.005} value={mean} onChange={v => set({ expectedReturn: v })} formatOptions={{ style: 'percent', maximumFractionDigits: 1 }} />
          <Slider label="Ups and downs" minValue={0.02} maxValue={0.25} step={0.01} value={vol} onChange={v => set({ volatility: v })} formatOptions={{ style: 'percent', maximumFractionDigits: 0 }} />
          <Slider label="It must last (years)" minValue={10} maxValue={60} step={1} value={planYears} onChange={v => set({ planYears: v })} />
        </div>
        {preferences.fire && (
          <button type="button" className="type-caption mt-2 text-primary underline underline-offset-2" onClick={() => setPreferences(prev => ({ ...prev, fire: undefined }))}>Back to my numbers</button>
        )}
      </section>

      <PlannedMoney events={events} currency={currency} onChange={next => set({ events: next })} />

      <section className={CARD}>
        <h2 className="type-card-title mb-2 text-ink">Where this starts</h2>
        <dl className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div><dt className="type-caption text-muted">Invested and saved today</dt><dd className="type-figure-md text-ink"><Amount value={round2(base.portfolio)} currency={currency} /></dd><p className="type-caption text-muted">{base.accountCount} cash, savings and investment accounts</p></div>
          <div><dt className="type-caption text-muted">Spending a year</dt><dd className="type-figure-md text-ink"><Amount value={hasHistory ? base.spending : spending} currency={currency} /></dd><p className="type-caption text-muted">{hasHistory ? `From your last ${base.months} ${base.months === 1 ? 'month' : 'months'}` : 'No recent spending found, so this is a placeholder. Set your own above.'}</p></div>
          <div><dt className="type-caption text-muted">Saved a month</dt><dd className="type-figure-md text-ink"><Amount value={base.saving} currency={currency} /></dd><p className="type-caption text-muted">Income less spending, same months</p></div>
        </dl>
        <p className="type-caption mt-4 text-muted">
          Each of 1,500 possible futures draws a random return every month, around the average you set. Everything is in today's money, so spending and saving do not need inflation added. It is arithmetic on your own figures, not advice: it ignores tax and assumes steady saving and spending.
        </p>
      </section>
    </div>
  );
};

export default FirePage;
