import React, { useDeferredValue, useMemo, useState } from 'react';
import { getMainCurrency } from '../utils';
import { buildFire, dateInMonths, describeMonths, normalizeFireSettings, type FireSettings, type FireSummary, type MonthCashflow } from '../utils/fireModel';
import { useAccountSelector, usePreferencesContext, useTransactionSelector } from '../contexts/DomainProviders';
import FireChart from '../components/FireChart';
import FireSettingsPanel from '../components/FireSettingsPanel';
import PageHeader, { type PageStat } from '../components/PageHeader';
import { Button } from '../components/ui/Actions';
import { Badge } from '../components/ui/Display';
import { Slider } from '../components/ui/Fields';
import Icon from '../components/ui/Icon';
import { Amount } from '../components/ui/Money';
import { EmptyState } from '../components/ui/States';
import { cn } from '../lib/utils';

const CARD = 'surface-card min-w-0 rounded-[var(--radius-xl)] p-5';
const percent = (fraction: number) => `${Math.round(fraction * 100)}%`;
const monthLabel = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};
const dateLabel = (today: Date, months: number) => dateInMonths(today, months).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

/** A slider range that has `base` on one of its steps, so it opens on your real number instead of the nearest step. */
const alignedRange = (base: number, step: number, below: number, above: number) => ({
  min: base - Math.floor(below / step) * step,
  max: base + Math.ceil(above / step) * step,
});

const Heading: React.FC<{ children: React.ReactNode; aside?: React.ReactNode }> = ({ children, aside }) => (
  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
    <h2 className="type-card-title text-ink">{children}</h2>
    {aside && <span className="type-caption text-muted">{aside}</span>}
  </div>
);

/** Savings rate, month by month. Up is saved, down is spent more than earned, and a dashed box is a month with no income. */
const SavingsRateBars: React.FC<{ series: MonthCashflow[] }> = ({ series }) => {
  const HEIGHT = 64;
  // Room below the line only when some month spent more than it earned.
  const hasNegative = series.some(month => month.rate !== null && month.rate < 0);
  const above = hasNegative ? HEIGHT : HEIGHT * 2;
  return (
    <>
      <div className="relative" role="img" aria-label={`Savings rate for each of the last ${series.length} months`}>
        <div className="absolute inset-x-0 border-t border-line" style={{ top: above }} aria-hidden />
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))`, height: above + (hasNegative ? HEIGHT : 0) }}>
          {series.map(month => {
            const rate = month.rate;
            const size = rate === null ? 0 : Math.min(1, Math.abs(rate)) * above;
            return (
              <div key={month.month} className="relative h-full" title={`${monthLabel(month.month)}: ${rate === null ? 'no income' : percent(rate)}${month.partial ? ' so far' : ''}`}>
                {rate === null
                  ? <div className="absolute inset-x-0 mx-auto w-3/4 rounded-sm border border-dashed border-line-strong" style={{ top: above - 12, height: 12 }} />
                  : <div className={cn('absolute inset-x-0 rounded-sm', rate >= 0 ? 'bg-money-in' : 'bg-money-out', month.partial && 'opacity-50')} style={rate >= 0 ? { bottom: (hasNegative ? HEIGHT : 0), height: Math.max(2, size) } : { top: above, height: Math.max(2, size) }} />}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1 flex justify-between type-caption text-muted"><span>{monthLabel(series[0].month)}</span><span>{monthLabel(series[series.length - 1].month)}</span></div>
      <table className="sr-only">
        <caption>Savings rate by month</caption>
        <thead><tr><th>Month</th><th>Income</th><th>Spending</th><th>Savings rate</th></tr></thead>
        <tbody>{series.map(m => <tr key={m.month}><td>{monthLabel(m.month)}</td><td>{m.income}</td><td>{m.spending}</td><td>{m.rate === null ? 'No income' : percent(m.rate)}</td></tr>)}</tbody>
      </table>
    </>
  );
};

const Fire: React.FC = () => {
  const accounts = useAccountSelector(list => list);
  const transactions = useTransactionSelector(list => list);
  const { preferences, setPreferences } = usePreferencesContext();
  const currency = getMainCurrency();
  const today = useMemo(() => new Date(), []);
  const settings = useMemo(() => normalizeFireSettings(preferences.fire), [preferences.fire]);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [tweak, setTweak] = useState<{ saving?: number; spending?: number; growth?: number }>({});
  const deferredTweak = useDeferredValue(tweak);

  const fire: FireSummary = useMemo(() => buildFire({ accounts, transactions, today }, settings), [accounts, transactions, today, settings]);

  // The same picture with the sliders applied. Nothing is saved until you choose to.
  const scenario = useMemo(() => {
    if (deferredTweak.saving === undefined && deferredTweak.spending === undefined && deferredTweak.growth === undefined) return null;
    const changed: FireSettings = {
      ...settings,
      ...(deferredTweak.saving !== undefined ? { contribution: { mode: 'manual' as const, manualMonthly: deferredTweak.saving } } : {}),
      ...(deferredTweak.spending !== undefined ? { expenses: { mode: 'manual' as const, manualAnnual: deferredTweak.spending } } : {}),
      ...(deferredTweak.growth !== undefined ? { expectedReturn: deferredTweak.growth } : {}),
    };
    return buildFire({ accounts, transactions, today }, changed);
  }, [accounts, transactions, today, settings, deferredTweak]);

  const saveSettings = (next: FireSettings) => setPreferences(previous => ({ ...previous, fire: next }));
  const view = scenario ?? fire;
  const reached = fire.ready && fire.fi.progress >= 1;
  const eligible = useMemo(() => accounts.filter(account => account.status !== 'closed' && (account.includeInAnalytics ?? true)), [accounts]);

  const trailing = fire.savings.trailing;
  const stats: PageStat[] = [
    { label: 'Progress to FI', icon: 'flag-01', value: fire.ready ? Math.min(fire.fi.progress, 9.99) * 100 : 0, format: 'percent', iconTone: 'primary' },
    { label: 'Portfolio', icon: 'wallet-02', value: fire.portfolio, format: 'money', iconTone: 'teal' },
    { label: 'FI number', icon: 'target-01', value: fire.fi.number, format: 'money', iconTone: 'amber' },
    { label: 'Savings rate', icon: 'piggy-bank', value: trailing.rate !== null ? trailing.rate * 100 : 0, format: 'percent', iconTone: 'positive', ...(trailing.rate === null ? { badge: 'no income' } : { badge: `${trailing.months} mo`, badgeTitle: `Average of the last ${trailing.months} finished months` }) },
  ];

  const settingsButton = <Button variant="secondary" icon="settings-05" onPress={() => setSettingsOpen(true)}>Settings</Button>;

  // Slider ranges follow what you actually do.
  const baseSaving = Math.max(0, Math.round(fire.savings.monthlyContribution));
  const baseSpending = Math.max(1000, Math.round(fire.expenses.annual));
  const savingRange = alignedRange(baseSaving, 50, baseSaving, Math.max(1000, baseSaving));
  const spendingRange = alignedRange(baseSpending, 500, baseSpending * 0.5, baseSpending * 0.5);
  const returnRange = alignedRange(settings.expectedReturn, 0.005, settings.expectedReturn, Math.max(0.005, 0.1 - settings.expectedReturn));

  return (
    <div className="space-y-5 pb-8">
      <PageHeader title="Financial independence" stats={stats} actions={settingsButton} />

      {!fire.ready ? (
        <section className={CARD}>
          <EmptyState icon="flag-01" title="Not enough to work out your number yet" description={fire.warnings[0] ?? 'Add some income and spending first.'} actionLabel="Set my yearly spending" onAction={() => setSettingsOpen(true)} />
        </section>
      ) : (
        <>
          <section className={cn(CARD, 'bg-primary-soft')} aria-label="Where you stand">
            {reached ? (
              <>
                <p className="type-label text-muted">You are there</p>
                <p className="type-figure-lg mt-1 text-ink">Your portfolio could cover what you spend.</p>
                <p className="type-body mt-2 text-muted">At {percent(settings.withdrawalRate)} a year it could pay <Amount value={fire.fi.monthlyIncome} currency={currency} className="text-ink" /> a month, {percent(fire.fi.coverage)} of the <Amount value={fire.expenses.monthly} currency={currency} className="text-ink" /> you spend.</p>
              </>
            ) : (
              <>
                <p className="type-label text-muted">{percent(fire.fi.progress)} of the way to <Amount value={fire.fi.number} currency={currency} className="text-ink" /></p>
                <p className="type-figure-lg mt-1 text-ink">
                  {fire.fi.months === null ? 'Not at the current pace.' : `About ${describeMonths(fire.fi.months)}, around ${dateLabel(today, fire.fi.months)}.`}
                </p>
                {fire.fi.months !== null && fire.fi.scenarios.optimistic !== null && fire.fi.scenarios.cautious !== null && (
                  <p className="type-body mt-2 text-muted">
                    That is at {percent(settings.expectedReturn)} a year after inflation. At {percent(settings.expectedReturn + 0.02)} it is {dateLabel(today, fire.fi.scenarios.optimistic)}; at {percent(Math.max(0, settings.expectedReturn - 0.02))}, {fire.fi.scenarios.cautious === null ? 'it does not arrive' : dateLabel(today, fire.fi.scenarios.cautious)}.
                  </p>
                )}
                {fire.fi.months === null && <p className="type-body mt-2 text-muted">At your current saving and return the portfolio does not reach the number. Saving more, spending less or both changes that: try the sliders below.</p>}
                <p className="type-body mt-2 text-muted">Today the portfolio could pay <Amount value={fire.fi.monthlyIncome} currency={currency} className="text-ink" /> a month, {percent(fire.fi.coverage)} of what you spend.</p>
              </>
            )}
            {fire.warnings.length > 0 && (
              <ul className="mt-3 space-y-1">
                {fire.warnings.map(text => <li key={text} className="type-caption flex items-start gap-1.5 text-muted"><Icon name="warning" size={16} className="mt-0.5 shrink-0" />{text}</li>)}
              </ul>
            )}
          </section>

          <section className={CARD} aria-label="The road to FI">
            <Heading aside="In today's money, after inflation">The road</Heading>
            <div className="h-72 md:h-80">
              <FireChart history={fire.history} projection={view.projection} today={today} target={view.fi.number} coast={view.coast} expectedReturn={scenario ? (deferredTweak.growth ?? settings.expectedReturn) : settings.expectedReturn} />
            </div>
          </section>

          <section className={CARD} aria-label="What moves your date">
            <Heading aside={scenario ? 'Not saved' : undefined}>What moves your date</Heading>
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-3">
              <Slider label="Saved each month" minValue={savingRange.min} maxValue={savingRange.max} step={50} value={tweak.saving ?? baseSaving} onChange={value => setTweak(previous => ({ ...previous, saving: value }))} formatOptions={{ style: 'currency', currency, maximumFractionDigits: 0 }} />
              <Slider label="Spent each year" minValue={spendingRange.min} maxValue={spendingRange.max} step={500} value={tweak.spending ?? baseSpending} onChange={value => setTweak(previous => ({ ...previous, spending: value }))} formatOptions={{ style: 'currency', currency, maximumFractionDigits: 0 }} />
              <Slider label="Yearly return" minValue={returnRange.min} maxValue={returnRange.max} step={0.005} value={tweak.growth ?? settings.expectedReturn} onChange={value => setTweak(previous => ({ ...previous, growth: value }))} formatOptions={{ style: 'percent', maximumFractionDigits: 1 }} />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <p className="type-body text-ink" aria-live="polite">
                {scenario
                  ? (scenario.fi.months === null
                    ? 'With these numbers the portfolio does not reach FI.'
                    : <>With these numbers: FI in {describeMonths(scenario.fi.months)} ({dateLabel(today, scenario.fi.months)}){fire.fi.months !== null && fire.fi.months !== scenario.fi.months ? `, ${describeMonths(Math.abs(fire.fi.months - scenario.fi.months))} ${scenario.fi.months < fire.fi.months ? 'sooner' : 'later'}` : ''}.</>)
                  : <span className="text-muted">Move a slider to see how saving, spending or returns change your date.</span>}
              </p>
              {scenario && (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onPress={() => setTweak({})}>Reset</Button>
                  <Button variant="secondary" size="sm" onPress={() => {
                    saveSettings(normalizeFireSettings({
                      ...settings,
                      ...(tweak.saving !== undefined ? { contribution: { mode: 'manual', manualMonthly: tweak.saving } } : {}),
                      ...(tweak.spending !== undefined ? { expenses: { mode: 'manual', manualAnnual: tweak.spending } } : {}),
                      ...(tweak.growth !== undefined ? { expectedReturn: tweak.growth } : {}),
                    }));
                    setTweak({});
                  }}>Use these numbers</Button>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <section className={CARD} aria-label="Savings rate">
        <Heading aside={trailing.rate !== null ? <>Average <strong className="text-ink">{percent(trailing.rate)}</strong> over {trailing.months} {trailing.months === 1 ? 'month' : 'months'}</> : undefined}>Savings rate over time</Heading>
        {fire.savings.series.length > 1 ? (
          <>
            <SavingsRateBars series={fire.savings.series} />
            <p className="type-caption mt-2 text-muted">Income less spending, as a share of income. Money moved into savings or investments counts as saved, not spent. The last bar is this month so far.</p>
          </>
        ) : <EmptyState icon="piggy-bank" title="Not enough history" description="Once you have a couple of months of income and spending, your savings rate appears here." className="py-8" />}
      </section>

      <div className="grid grid-cols-1 gap-4 min-[1100px]:grid-cols-2">
        {fire.ready && (
          <section className={CARD} aria-label="Stages of independence">
            <Heading aside="Of your portfolio">Stages</Heading>
            <ol className="space-y-3">
              {fire.stages.map(stage => (
                <li key={stage.id} className="flex items-start gap-3">
                  <Icon name={stage.reached ? 'checkmark-circle-02' : 'circle'} size={20} className={cn('mt-0.5 shrink-0', stage.reached ? 'text-primary' : 'text-muted')} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2"><span className="type-body-strong text-ink">{stage.label}</span>{stage.id === 'coast' && <Badge tone="blue">Coast</Badge>}</p>
                    <p className="type-caption text-muted">
                      <Amount value={stage.amount} currency={currency} />
                      {stage.reached && stage.since && ` · ${stage.since.beforeHistory ? 'already there when your records begin' : `since ${monthLabel(stage.since.month)}`}`}
                      {!stage.reached && (stage.monthsAway === null ? ' · not at this pace' : stage.monthsAway !== undefined ? ` · about ${describeMonths(stage.monthsAway)}, ${dateLabel(today, stage.monthsAway)}` : '')}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            {fire.coast && <p className="type-caption mt-3 text-muted">Coast FI: with <Amount value={fire.coast.number} currency={currency} /> invested today and no more saving, growth alone reaches your FI number by {settings.retirementAge}. {fire.coast.reached ? 'You are past it.' : fire.coast.monthsAway === null ? 'At this pace you do not get there before then.' : `At this pace you are there in ${describeMonths(fire.coast.monthsAway)}.`}</p>}
            {!fire.coast && <p className="type-caption mt-3 text-muted">Add your age and the age you want to retire in the settings to see Coast FI.</p>}
          </section>
        )}

        <section className={CARD} aria-label="Net worth milestones">
          <Heading aside={<>Net worth <Amount value={fire.netWorth.current} currency={currency} className="text-ink" /></>}>Net worth milestones</Heading>
          <ol className="space-y-3">
            {fire.netWorth.milestones.map(milestone => (
              <li key={milestone.amount} className="flex items-start gap-3">
                <Icon name={milestone.reached ? 'award-01' : 'circle'} size={20} className={cn('mt-0.5 shrink-0', milestone.reached ? 'text-primary' : 'text-muted')} />
                <div className="min-w-0 flex-1">
                  <p className="type-body-strong text-ink"><Amount value={milestone.amount} currency={currency} /></p>
                  <p className="type-caption text-muted">
                    {milestone.reached
                      ? milestone.since ? (milestone.since.beforeHistory ? 'Already passed when your records begin' : `Passed in ${monthLabel(milestone.since.month)}`) : 'Passed'
                      : milestone.monthsAway === null || milestone.monthsAway === undefined ? 'Not at the current pace' : `About ${describeMonths(milestone.monthsAway)}, ${dateLabel(today, milestone.monthsAway)}`}
                  </p>
                  {!milestone.reached && milestone.progress !== undefined && (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-inset" role="progressbar" aria-label="Progress to the next milestone" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(milestone.progress * 100)}>
                      <div className="h-full rounded-full bg-primary" style={{ width: `${milestone.progress * 100}%` }} />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <p className="type-caption mt-3 text-muted">Dates for what is ahead hold things that are not in your counted accounts, such as a home, steady, and let the portfolio grow.</p>
        </section>
      </div>

      <section className="px-1">
        <p className="type-caption text-muted">
          These are projections from your own figures, not advice. They assume steady saving and a steady return after inflation, which real life does not give you, and they ignore tax and changes in what you spend. The past follows what was paid in and out of the counted accounts, so market gains and losses are not in it. {fire.accounts.length} {fire.accounts.length === 1 ? 'account counts' : 'accounts count'} toward your portfolio.
        </p>
      </section>

      <FireSettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        accounts={eligible}
        actualAnnualExpenses={trailing.months > 0 ? Math.round((trailing.spending / trailing.months) * 12) : 0}
        actualMonthlySaving={trailing.months > 0 ? Math.round(trailing.saved / trailing.months) : 0}
        onSave={saveSettings}
      />
    </div>
  );
};

export default Fire;
