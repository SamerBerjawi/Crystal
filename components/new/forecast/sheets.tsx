import React, { useEffect, useMemo, useState } from 'react';
import type { FinancialGoal, RecurrenceFrequency } from '../../../types';
import { parseLocalDate } from '../../../utils';
import { formatShortDate } from '../../../utils/dateFormat';
import { parseAmountInput } from '../../../utils/scheduleModel';
import { NO_ASSUMPTIONS, projectBalances, type Assumptions, type ForecastEvent } from '../../../utils/forecastModel';
import { draftFromGoal, emptyGoalDraft, goalAccounts, planGoal, projectGoal, type GoalDraft } from '../../../utils/goalsModel';
import type { ForecastData } from '../../../hooks/useForecastData';
import { Drawer } from '../Drawer';
import { NvIcon } from '../NvIcon';
import { toast } from '../toast';
import { Badge, Button, Money, SegmentedTabs } from '../ui';
import { PickerField, TextField } from '../transactions/parts';
import { EventRow } from './timeline';
import { KIND } from './goals';

/* Sheets of ForecastingNew (docs/FORECASTING_NEW_PLAN.md §6): the scenario, one day, and the goal form. */

const Stepper: React.FC<{ label: string; value: number; onChange: (v: number) => void; min: number; max: number; unit: string }> = ({ label, value, onChange, min, max, unit }) => (
  <div className="rounded-nv-sub bg-nv-inset p-4">
    <div className="mb-2 flex items-center justify-between gap-3">
      <span className="text-[15px] font-medium text-nv-ink">{label}</span>
      <span className="flex items-center gap-1">
        <button type="button" aria-label={`Less ${label.toLowerCase()}`} onClick={() => onChange(Math.max(min, value - 1))} className="flex h-11 w-11 items-center justify-center rounded-full bg-nv-surface text-lg text-nv-ink">−</button>
        <span className="nv-tabular w-16 text-center text-[15px] font-semibold text-nv-ink">{value > 0 && unit === '%' && label === 'Income change' ? '+' : ''}{value}{unit}</span>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} onClick={() => onChange(Math.min(max, value + 1))} className="flex h-11 w-11 items-center justify-center rounded-full bg-nv-surface text-lg text-nv-ink">+</button>
      </span>
    </div>
    <input type="range" min={min} max={max} step={1} value={value} onChange={e => onChange(Number(e.target.value))} aria-label={label} className="w-full accent-[var(--nv-ink)]" />
  </div>
);

/** Scenario (§6.1): income change, market return, inflation, with the result live. */
export const ScenarioSheet: React.FC<{ open: boolean; onClose: () => void; data: ForecastData }> = ({ open, onClose, data }) => {
  const [draft, setDraft] = useState<Assumptions>(data.assumptions);
  useEffect(() => { if (open) setDraft(data.assumptions); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const preview = useMemo(() => {
    if (!open) return null;
    const p = projectBalances({ accounts: data.selectedAccounts, startBalances: data.startBalances, occurrences: data.occurrences, goals: data.goals, activeGoalIds: data.activeGoalIds, today: data.today, end: data.end, convert: data.convert, assumptions: draft });
    return p.days[p.days.length - 1]?.total ?? 0;
  }, [open, draft, data]);
  const base = data.projection.days[data.projection.days.length - 1]?.total ?? 0;
  const hasInvestments = data.selectedAccounts.some(a => a.type === 'Investment' && a.subType !== 'Pension Fund');
  const apply = () => {
    const before = data.assumptions;
    data.setAssumptions(draft);
    toast.undo('Scenario applied', () => data.setAssumptions(before));
    onClose();
  };
  return (
    <Drawer
      open={open}
      onOpenChange={o => { if (!o) onClose(); }}
      title="Scenario"
      footer={
        <div className="flex gap-3">
          <Button size="lg" onClick={() => setDraft(NO_ASSUMPTIONS)}>Reset</Button>
          <Button variant="primary" size="lg" className="flex-1" onClick={apply}>Apply</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Stepper label="Income change" value={draft.incomeChange} onChange={v => setDraft(d => ({ ...d, incomeChange: v }))} min={-50} max={50} unit="%" />
        <Stepper label="Market return" value={draft.marketReturn} onChange={v => setDraft(d => ({ ...d, marketReturn: v }))} min={-20} max={20} unit="% a year" />
        {!hasInvestments && <p className="px-1 text-[13px] text-nv-muted">None of the selected accounts is an investment, so market return changes nothing.</p>}
        <Stepper label="Inflation" value={draft.inflation} onChange={v => setDraft(d => ({ ...d, inflation: v }))} min={0} max={15} unit="% a year" />
        {preview !== null && (
          <div className="rounded-nv-sub bg-nv-inset p-4">
            <p className="text-sm text-nv-muted">On {formatShortDate(data.projection.days[data.projection.days.length - 1]?.date ?? '', data.today)}</p>
            <p className="mt-1 text-[15px] text-nv-ink">
              <Money amount={base} currency={data.displayCurrency} /> → <Money amount={preview} currency={data.displayCurrency} />{' '}
              <Money amount={preview - base} currency={data.displayCurrency} signed tone={preview - base >= 0 ? 'income' : 'ink'} />
            </p>
          </div>
        )}
      </div>
    </Drawer>
  );
};

/** One day (§6.2): balance at the start and end, the events with the balance after each. */
export const DaySheet: React.FC<{ date: string | null; data: ForecastData; onClose: () => void; onOpenEvent: (e: ForecastEvent) => void; onPlan: (date: string) => void }> = ({ date, data, onClose, onOpenEvent, onPlan }) => {
  const index = date ? data.projection.days.findIndex(d => d.date === date) : -1;
  const day = index >= 0 ? data.projection.days[index] : null;
  const startOfDay = index > 0 ? data.projection.days[index - 1].total : data.projection.start;
  return (
    <Drawer
      open={!!day}
      onOpenChange={o => { if (!o) onClose(); }}
      title={day ? parseLocalDate(day.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Day'}
      footer={day ? <Button variant="primary" size="lg" icon="add" className="w-full" onClick={() => onPlan(day.date)}>Plan a payment on this day</Button> : undefined}
    >
      {day && (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3 rounded-nv-sub bg-nv-inset p-4">
            <div><p className="text-xs text-nv-muted">Start</p><Money amount={startOfDay} currency={data.displayCurrency} /></div>
            <div><p className="text-xs text-nv-muted">Change</p><Money amount={day.total - startOfDay} currency={data.displayCurrency} signed /></div>
            <div><p className="text-xs text-nv-muted">End</p><Money amount={day.total} currency={data.displayCurrency} className={day.total < 0 ? 'text-nv-red-text' : undefined} /></div>
          </div>
          {day.events.length === 0 ? <p className="text-sm text-nv-muted">Nothing planned this day.</p> : (
            <ul>{day.events.filter(e => Math.abs(e.amount) >= 0.005).map(e => <EventRow key={e.key} e={e} data={data} onOpen={onOpenEvent} />)}</ul>
          )}
        </>
      )}
    </Drawer>
  );
};

const FREQUENCIES: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'weekly', label: 'Every week' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Every month' },
  { value: 'yearly', label: 'Every year' },
];
const STEPS = ['Kind', 'Amount', 'When', 'Where'] as const;

export type GoalTarget = { mode: 'new'; parentId?: string } | { mode: 'edit'; goal: FinancialGoal };

/** The goal form (§6.3) in four steps, with the projection live on the last one. */
export const GoalSheet: React.FC<{ target: GoalTarget | null; data: ForecastData; onClose: () => void; onDelete: (goal: FinancialGoal) => void }> = ({ target, data, onClose, onDelete }) => {
  const [draft, setDraft] = useState<GoalDraft | null>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setError(null); setStep(0);
    if (!target) { setDraft(null); return; }
    setDraft(target.mode === 'edit' ? draftFromGoal(target.goal) : emptyGoalDraft(data.displayCurrency, data.today, target.parentId));
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!target || !draft) return null;
  const set = <K extends keyof GoalDraft>(key: K, value: GoalDraft[K]) => { setDraft(d => (d ? { ...d, [key]: value } : d)); setError(null); };
  const existing = target.mode === 'edit' ? target.goal : undefined;
  const bucket = draft.category === 'bucket';
  const steps = bucket ? STEPS.slice(0, 1) : STEPS;
  const last = step === steps.length - 1;
  const plan = planGoal(draft, existing);
  const preview = 'goal' in plan && !bucket ? projectGoal({ ...plan.goal, id: existing?.id ?? 'new' } as FinancialGoal, data.today) : null;
  const accountOptions = [{ value: '', label: 'No account' }, ...goalAccounts(data.accounts).map(a => ({ value: a.id, label: a.name, hint: a.currency }))];
  const buckets = data.goals.filter(g => g.isBucket && g.id !== existing?.id);

  const save = () => {
    const result = planGoal(draft, existing);
    if ('error' in result) { setError(result.error); return; }
    const write = data.saveGoal(result.goal);
    if ('error' in write) { setError(write.error); return; }
    toast.undo(existing ? 'Goal saved' : bucket ? 'Group added' : 'Goal added', write.undo);
    onClose();
  };

  return (
    <Drawer
      open
      onOpenChange={o => { if (!o) onClose(); }}
      title={existing ? (existing.isBucket ? 'Edit group' : 'Edit goal') : draft.parentId ? 'Add to group' : 'Add goal'}
      width={520}
      footer={
        <div className="flex items-center gap-3">
          {step > 0 && <Button size="lg" onClick={() => setStep(s => s - 1)}>Back</Button>}
          {existing && step === 0 && <Button size="lg" icon="delete" onClick={() => onDelete(existing)} aria-label="Delete goal">Delete</Button>}
          {!last && <Button variant="primary" size="lg" className="flex-1" onClick={() => setStep(s => s + 1)}>Next</Button>}
          {(last || existing) && <Button variant="cta" size="lg" className="flex-1" onClick={save}>{existing ? 'Save changes' : 'Save goal'}</Button>}
        </div>
      }
    >
      <ol className="mb-5 flex gap-2" aria-label="Steps">
        {steps.map((s, i) => (
          <li key={s} className="flex-1">
            <button type="button" onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined} className="w-full text-left">
              <span className={`block h-1.5 rounded-full ${i <= step ? 'bg-nv-ink' : 'bg-nv-inset'}`} aria-hidden />
              <span className={`mt-1 block text-xs ${i === step ? 'font-semibold text-nv-ink' : 'text-nv-muted'}`}>{s}</span>
            </button>
          </li>
        ))}
      </ol>

      <form className="space-y-5" onSubmit={e => { e.preventDefault(); if (last) save(); else setStep(s => s + 1); }}>
        {step === 0 && (
          <>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Kind of goal">
              {(['savings', 'expense', 'income', 'bucket'] as const).map(k => {
                const on = draft.category === k;
                const meta = k === 'bucket' ? { label: 'Group of goals', icon: 'layers' as const, text: 'text-nv-muted' } : KIND[k];
                return (
                  <button key={k} type="button" role="radio" aria-checked={on} onClick={() => set('category', k)} disabled={!!existing && (k === 'bucket') !== !!existing.isBucket}
                    className={`flex min-h-14 items-center gap-3 rounded-nv-sub border px-4 text-left text-[15px] disabled:opacity-40 ${on ? 'border-nv-ink bg-nv-surface' : 'border-transparent bg-nv-inset'}`}>
                    <NvIcon name={meta.icon} size={20} className={meta.text} />{meta.label}
                  </button>
                );
              })}
            </div>
            <TextField label="Name" value={draft.name} onChange={v => set('name', v)} placeholder={bucket ? 'Holidays, house…' : 'New car, emergency fund…'} />
            {!bucket && buckets.length > 0 && (
              <PickerField label="Group (optional)" value={draft.parentId} options={[{ value: '', label: 'No group' }, ...buckets.map(b => ({ value: b.id, label: b.name }))]} onChange={v => set('parentId', v)} icon="layers" />
            )}
          </>
        )}
        {step === 1 && (
          <>
            <div className="grid grid-cols-[1fr_auto] items-end gap-3">
              <TextField label={draft.category === 'income' ? 'Target income' : 'Target'} value={draft.amount} onChange={v => set('amount', v)} placeholder="0.00" />
              <span className="pb-3 text-[15px] font-medium text-nv-muted">{draft.currency}</span>
            </div>
            <TextField label={draft.category === 'income' ? 'Earned so far' : draft.category === 'expense' ? 'Set aside so far' : 'Saved so far'} value={draft.saved} onChange={v => set('saved', v)} placeholder="0.00" />
          </>
        )}
        {step === 2 && (
          <>
            <SegmentedTabs<GoalDraft['timing']> label="Timing" className="w-full" value={draft.timing} onChange={v => set('timing', v)} items={[{ id: 'by-date', label: 'By a date', icon: 'calendar' }, { id: 'ongoing', label: 'Ongoing', icon: 'repeat' }]} />
            {draft.timing === 'by-date' ? (
              <TextField label="By" type="date" value={draft.date} onChange={v => set('date', v)} />
            ) : (
              <>
                <PickerField label="Contributes" value={draft.frequency} options={FREQUENCIES} onChange={v => set('frequency', v as RecurrenceFrequency)} icon="repeat" />
                <TextField label="Starting" type="date" value={draft.startDate} onChange={v => set('startDate', v)} />
              </>
            )}
            <TextField label={draft.timing === 'ongoing' ? 'Each contribution' : 'Monthly contribution (optional)'} value={draft.contribution} onChange={v => set('contribution', v)} placeholder="0.00" />
            {(draft.timing === 'by-date' ? !!draft.contribution : draft.frequency === 'monthly' || draft.frequency === 'yearly') && (
              <TextField label="Day of the month (optional)" value={draft.dayOfMonth} onChange={v => set('dayOfMonth', v.replace(/[^\d]/g, ''))} placeholder="1" />
            )}
          </>
        )}
        {step === 3 && (
          <>
            <PickerField label={draft.category === 'income' ? 'Paid into' : 'Paid from'} value={draft.paymentAccountId} options={accountOptions} onChange={v => set('paymentAccountId', v)} icon="bank" />
            {draft.category === 'savings' && (
              <PickerField label="Saved into (optional)" value={draft.destinationAccountId} options={accountOptions} onChange={v => set('destinationAccountId', v)} icon="piggy" />
            )}
            {preview && (
              <div className="space-y-2 rounded-nv-sub bg-nv-inset p-4 text-[15px] text-nv-ink">
                {preview.projectedDate ? (
                  <p>Reaches <Money amount={parseAmountInput(draft.amount) || 0} currency={draft.currency} /> on {formatShortDate(preview.projectedDate, data.today)}</p>
                ) : preview.status === 'done' ? <p>Already reached.</p> : <p>Add a contribution to see when it is reached.</p>}
                {preview.neededMonthly !== undefined && preview.status !== 'done' && (
                  <p className="text-sm text-nv-muted"><Money amount={preview.neededMonthly} currency={draft.currency} className="text-sm" /> a month reaches it by {formatShortDate(draft.date, data.today)}</p>
                )}
                {preview.status !== 'no-plan' && preview.status !== 'done' && <Badge tone={preview.status === 'on-track' ? 'green' : preview.status === 'at-risk' ? 'orange' : 'red'} icon={preview.status === 'on-track' ? 'checkCircle' : 'warning'}>{preview.status === 'on-track' ? 'On track' : preview.status === 'at-risk' ? 'At risk' : 'Off track'}</Badge>}
              </div>
            )}
          </>
        )}
        {error && <p role="alert" className="text-sm text-nv-red-text">{error}</p>}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Drawer>
  );
};
