import React, { useEffect, useMemo, useState } from 'react';
import type { BillPayment, RecurrenceFrequency, RecurringTransaction, WeekendAdjustment } from '../../../types';
import { formatCurrency, parseLocalDate } from '../../../utils';
import { formatShortDate } from '../../../utils/dateFormat';
import {
  cadenceLabel, draftFromBill, draftFromSeries, emptySeriesDraft, firstDueOnOrAfter, nextDates, parseAmountInput, paymentHistory, planSeries,
  type Occurrence, type SeriesDraft,
} from '../../../utils/scheduleModel';
import type { TxDraft } from '../../../utils/transactionsModel';
import { currencyOf, type ScheduleData } from '../../../hooks/useScheduleData';
import { useTransactionsData } from '../../../hooks/useTransactionsData';
import { Drawer } from '../Drawer';
import { NvIcon } from '../NvIcon';
import { toast } from '../toast';
import { Badge, Button, IconButton, Money, SegmentedTabs } from '../ui';
import { Fact } from '../transactions/detail';
import { PickerField, TextField } from '../transactions/parts';
import { TransactionForm } from '../transactions/TransactionForm';
import { OccurrenceAmount, OccurrenceAvatar, OccurrenceBadges, RowMenu, accountLine, relativeDay, type MenuEntry } from './parts';

/* Sheets of ScheduleNew (docs/SCHEDULE_NEW_PLAN.md §6): one payment, paying it, and the add / edit form. */

const Line: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex min-h-11 items-center justify-between gap-4 border-b border-nv-line py-2 last:border-0">
    <span className="text-sm text-nv-muted">{label}</span>
    <span className="min-w-0 truncate text-right text-[15px] text-nv-ink">{children}</span>
  </div>
);

/** One payment (§6.2): what it is, its series, its history, and what you can do with it. */
export const OccurrenceSheet: React.FC<{
  o: Occurrence | null;
  data: ScheduleData;
  onClose: () => void;
  onPay: (o: Occurrence) => void;
  menu: (o: Occurrence) => MenuEntry[];
}> = ({ o, data, onClose, onPay, menu }) => {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!o) return;
    setEditing(false); setError(null);
    setDate(o.date); setAmount(String(o.amount)); setDescription(o.description);
  }, [o?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Read the live occurrence so changes show at once.
  const live = o ? data.occurrences.find(x => x.key === o.key) ?? o : null;
  const rt = live?.series && live.source === 'recurring' ? data.seriesById.get(live.sourceId) : undefined;
  const history = useMemo(() => (rt ? paymentHistory(rt, data.transactions) : []), [rt, data.transactions]);
  const upcoming = useMemo(() => (rt ? nextDates(rt, data.today, 3) : []), [rt, data.today]);
  const category = live?.category ? data.categoryByName.get(live.category) : undefined;

  if (!live) return <Drawer open={false} onOpenChange={() => onClose()} title="Payment"><span /></Drawer>;

  const saveChange = () => {
    const result = data.changeOccurrence(live, { date, amount: parseAmountInput(amount), description });
    if ('error' in result) { setError(result.error); return; }
    toast.undo('Payment changed', result.undo);
    setEditing(false);
  };

  const canPay = live.status !== 'paid' && live.status !== 'skipped' && !live.isReadOnly;
  const title = live.merchant || live.description;

  return (
    <Drawer
      open
      onOpenChange={open => { if (!open) onClose(); }}
      title={title}
      width={500}
      footer={
        <div className="flex items-center gap-3">
          {canPay && <Button variant="primary" size="lg" icon="checkCircle" className="flex-1" onClick={() => onPay(live)}>Mark paid</Button>}
          {live.source === 'recurring' && live.status !== 'paid' && (
            live.status === 'skipped'
              ? <IconButton icon="undo" label="Bring back this payment" size={56} onClick={() => { const r = data.setSkipped(live, false); if (r.ok) toast.undo('Payment brought back', r.undo); }} />
              : <IconButton icon="close" label="Skip this payment" size={56} onClick={() => { const r = data.setSkipped(live, true); if (r.ok) { toast.undo('Payment skipped', r.undo); onClose(); } }} />
          )}
          {menu(live).length > 0 && <span className="ml-auto"><RowMenu entries={menu(live)} label="More actions" /></span>}
        </div>
      }
    >
      <div className="flex items-center gap-4 pb-5">
        <OccurrenceAvatar o={live} data={data} size={56} />
        <div className="min-w-0 flex-1">
          <OccurrenceAmount o={live} size="xl" />
          <p className="mt-1 text-sm text-nv-muted">
            {formatShortDate(live.date, data.today)} · <span className={live.status === 'overdue' ? 'font-medium text-nv-red-text' : undefined}>{relativeDay(live.date, data.today)}</span>
          </p>
        </div>
      </div>
      <OccurrenceBadges o={live} className="mb-4" />

      {live.isReadOnly && (
        <p className="mb-4 rounded-nv-sub bg-nv-inset p-4 text-sm text-nv-muted">
          {live.source === 'card' ? 'Comes from your card statement. Pay it from the card’s page.' : live.source === 'loan' ? 'Comes from your loan’s payment plan. Change it there.' : 'Comes from your property’s costs. Change them on its page.'}
        </p>
      )}

      <div className="rounded-nv-sub bg-nv-inset px-4">
        <Line label="Account">{accountLine(live, data) || '—'}</Line>
        {category && <Line label="Category">{category.name}</Line>}
        {live.description !== title && <Line label="Description">{live.description}</Line>}
        {rt && <Line label="Repeats">{cadenceLabel(rt)}</Line>}
        {rt?.endDate && <Line label="Ends">{formatShortDate(rt.endDate, data.today)}</Line>}
        {live.isOverride && live.originalDate !== live.date && <Line label="Moved from">{formatShortDate(live.originalDate, data.today)}</Line>}
        {live.currency !== data.displayCurrency && <Line label={`In ${data.displayCurrency}`}><Money amount={data.convert(live.amount, live.currency)} currency={data.displayCurrency} /></Line>}
        {live.bill?.paidDate && <Line label="Paid on">{formatShortDate(live.bill.paidDate, data.today)}</Line>}
      </div>

      {rt && upcoming.length > 0 && (
        <Fact label="Next payments" icon="calendar" className="mt-6">
          <p className="text-[15px] text-nv-ink">{upcoming.map(d => formatShortDate(d, data.today)).join(' · ')}</p>
        </Fact>
      )}

      {rt && (
        <Fact label="Paid before" icon="checkCircle" className="mt-6">
          {history.length === 0 ? (
            <p className="text-sm text-nv-muted">No payments linked to this series yet.</p>
          ) : (
            <>
              <p className="mb-2 text-sm text-nv-muted">On time {history.filter(h => h.daysLate <= 0).length} of the last {history.length}</p>
              <ul className="rounded-nv-sub bg-nv-inset px-4">
                {history.map(h => (
                  <li key={h.transaction.id} className="flex min-h-11 items-center justify-between gap-3 border-b border-nv-line py-2 last:border-0">
                    <span className="text-[15px] text-nv-ink">{formatShortDate(h.transaction.date, data.today)}</span>
                    <span className="flex items-center gap-2">
                      {h.daysLate > 0 && <Badge tone="orange" icon="warning">{h.daysLate} d late</Badge>}
                      <Money amount={Math.abs(h.transaction.amount)} currency={h.transaction.currency} />
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Fact>
      )}

      {live.source === 'recurring' && live.status !== 'paid' && (
        <Fact
          label="This payment only"
          icon="edit"
          className="mt-6"
          action={!editing ? <Button size="sm" onClick={() => setEditing(true)}>Change</Button> : undefined}
        >
          {editing ? (
            <div className="space-y-3 rounded-nv-sub bg-nv-inset p-4">
              <TextField label="Date" type="date" value={date} onChange={setDate} />
              <TextField label={`Amount (${live.currency})`} value={amount} onChange={setAmount} />
              <TextField label="Name" value={description} onChange={setDescription} />
              {error && <p role="alert" className="text-sm text-nv-red-text">{error}</p>}
              <div className="flex gap-2 pt-1">
                <Button variant="primary" onClick={saveChange}>Save</Button>
                <Button onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-nv-muted">{live.isOverride ? 'This payment differs from the series.' : 'Move it, change the amount or rename it without touching the series.'}</p>
          )}
        </Fact>
      )}
    </Drawer>
  );
};

/** Mark paid (F15): the transaction composer, pre-filled from the payment; saving links it to the series. */
export const PaySheet: React.FC<{ o: Occurrence | null; data: ScheduleData; onClose: () => void; onPaid: () => void }> = ({ o, data, onClose, onPaid }) => {
  const txData = useTransactionsData();
  const [draft, setDraft] = useState<TxDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (o) { setDraft(data.draftFor(o)); setError(null); } }, [o?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!o || !draft) return null;
  const submit = () => {
    const result = data.pay(o, draft);
    if ('error' in result) { setError(result.error); return; }
    toast.undo(`Paid · ${o.merchant || o.description}`, result.undo);
    onPaid();
  };
  const currency = data.accountsById.get(draft.accountId)?.currency ?? data.displayCurrency;
  const amount = parseFloat(draft.amount);
  return (
    <Drawer
      open
      onOpenChange={open => { if (!open) onClose(); }}
      title="Mark paid"
      description={`${o.merchant || o.description}, due ${formatShortDate(o.date, data.today)}`}
      width={520}
      footer={<Button variant="cta" size="lg" className="w-full" onClick={submit}>{amount > 0 ? `Save payment · ${formatCurrency(amount, currency)}` : 'Save payment'}</Button>}
    >
      <form onSubmit={e => { e.preventDefault(); submit(); }}>
        <TransactionForm draft={draft} onChange={update => { setDraft(prev => (typeof update === 'function' ? update(prev as TxDraft) : update)); setError(null); }} data={txData} error={error} />
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Drawer>
  );
};

const FREQUENCIES: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Every month' },
  { value: 'yearly', label: 'Every year' },
];
const WEEKEND: { value: WeekendAdjustment; label: string }[] = [
  { value: 'on', label: 'Keep the date' },
  { value: 'before', label: 'Move to the Friday before' },
  { value: 'after', label: 'Move to the Monday after' },
];

export type FormTarget =
  | { mode: 'new'; startDate?: string }
  | { mode: 'series'; series: RecurringTransaction }
  | { mode: 'future'; series: RecurringTransaction; originalDate: string }
  | { mode: 'bill'; bill: BillPayment };

/** Add or edit a series or a one-time bill (§6.1). "This and future" splits the series at the payment. */
export const ScheduleFormSheet: React.FC<{ target: FormTarget | null; data: ScheduleData; onClose: () => void }> = ({ target, data, onClose }) => {
  const [draft, setDraft] = useState<SeriesDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!target) { setDraft(null); return; }
    setError(null);
    if (target.mode === 'new') {
      const account = (data.openAccounts.find(a => a.type === 'Checking') ?? data.openAccounts[0])?.id ?? '';
      const draft = emptySeriesDraft(account, currencyOf(data, account), data.today);
      setDraft(target.startDate ? { ...draft, startDate: target.startDate } : draft);
    } else if (target.mode === 'bill') setDraft(draftFromBill(target.bill));
    else setDraft({ ...draftFromSeries(target.series), ...(target.mode === 'future' ? { startDate: target.originalDate } : {}) });
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!target || !draft) return null;
  const set = <K extends keyof SeriesDraft>(key: K, value: SeriesDraft[K]) => { setDraft(prev => (prev ? { ...prev, [key]: value } : prev)); setError(null); };
  const isBill = draft.kind === 'bill';
  const editingExisting = target.mode !== 'new';
  const accountOptions = data.openAccounts.map(a => ({ value: a.id, label: a.name, hint: a.currency }));
  const categoryOptions = (draft.type === 'income' ? data.categories.income : data.categories.expense)
    .map(c => ({ value: c.name, label: c.parent ? `${c.parent} · ${c.name}` : c.name, color: c.color, icon: c.icon }));
  const preview = !isBill && draft.startDate
    ? nextDates({ frequency: draft.frequency, frequencyInterval: Number(draft.frequencyInterval) || 1, dueDateOfMonth: Number(draft.dueDateOfMonth) || undefined, startDate: draft.startDate, nextDueDate: firstDueOnOrAfter(draft.startDate, Number(draft.dueDateOfMonth) || undefined, draft.frequency), endDate: draft.endDate || undefined, weekendAdjustment: draft.weekendAdjustment }, parseLocalDate(draft.startDate), 3)
    : [];

  const save = () => {
    const existingBill = target.mode === 'bill' ? target.bill : undefined;
    const plan = planSeries(draft, target.mode === 'series' ? target.series.id : existingBill?.id, existingBill);
    if ('error' in plan) { setError(plan.error); return; }
    let result;
    if (plan.kind === 'bill') result = data.saveBill(plan.bill);
    else if (target.mode === 'future') {
      const { id: _id, ...changes } = plan.series;
      result = data.splitSeries(target.series, target.originalDate, changes);
    } else if (target.mode === 'series') {
      // Keep where the series is in its cycle unless the start date changed.
      const keepNext = draft.startDate === (target.series.nextDueDate || target.series.startDate);
      result = data.saveSeries({ ...plan.series, startDate: target.series.startDate, nextDueDate: keepNext ? target.series.nextDueDate : plan.series.nextDueDate });
    } else result = data.saveSeries(plan.series);
    if ('error' in result) { setError(result.error); return; }
    toast.undo(editingExisting ? 'Schedule saved' : isBill ? 'Bill added' : 'Schedule added', result.undo);
    onClose();
  };

  const title = target.mode === 'new' ? 'Add schedule' : target.mode === 'future' ? 'Change this and future payments' : isBill ? 'Edit bill' : 'Edit schedule';

  return (
    <Drawer
      open
      onOpenChange={open => { if (!open) onClose(); }}
      title={title}
      width={520}
      footer={<Button variant="cta" size="lg" className="w-full" onClick={save}>{editingExisting ? 'Save changes' : 'Save schedule'}</Button>}
    >
      <form className="space-y-5" onSubmit={e => { e.preventDefault(); save(); }}>
        {target.mode === 'new' && (
          <SegmentedTabs<'recurring' | 'bill'>
            label="How often"
            className="w-full"
            value={draft.kind}
            onChange={kind => set('kind', kind)}
            items={[{ id: 'recurring', label: 'Repeats', icon: 'repeat' }, { id: 'bill', label: 'Once', icon: 'invoice' }]}
          />
        )}
        <SegmentedTabs<SeriesDraft['type']>
          label="Kind"
          className="w-full"
          value={isBill && draft.type === 'transfer' ? 'expense' : draft.type}
          onChange={type => set('type', type)}
          items={[
            { id: 'expense', label: 'Spending', icon: 'shoppingBag' },
            { id: 'income', label: 'Income', icon: 'money' },
            ...(isBill ? [] : [{ id: 'transfer' as const, label: 'Transfer', icon: 'transfer' as const }]),
          ]}
        />
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <TextField label="Amount" value={draft.amount} onChange={v => set('amount', v)} placeholder="0.00" />
          <span className="pb-3 text-[15px] font-medium text-nv-muted">{draft.currency}</span>
        </div>
        <TextField label="Name" value={draft.description} onChange={v => set('description', v)} placeholder="Rent, salary, gym…" />
        {!isBill && <TextField label="Merchant (optional)" value={draft.merchant} onChange={v => set('merchant', v)} />}
        <PickerField
          label={draft.type === 'transfer' ? 'From account' : 'Account'}
          value={draft.accountId}
          options={accountOptions}
          onChange={v => { set('accountId', v); set('currency', currencyOf(data, v)); }}
          icon="bank"
        />
        {draft.type === 'transfer' && !isBill && (
          <PickerField label="To account" value={draft.toAccountId} options={accountOptions.filter(a => a.value !== draft.accountId)} onChange={v => set('toAccountId', v)} icon="bank" />
        )}
        {draft.type !== 'transfer' && !isBill && (
          <PickerField label="Category" value={draft.category} options={categoryOptions} onChange={v => set('category', v)} placeholder="No category" />
        )}
        <TextField label={isBill ? 'Due' : target.mode === 'future' ? 'From' : 'Starts'} type="date" value={draft.startDate} onChange={v => set('startDate', v)} />
        {!isBill && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <PickerField label="Repeats" value={draft.frequency} options={FREQUENCIES} onChange={v => set('frequency', v as RecurrenceFrequency)} icon="repeat" />
              <TextField label="Every" value={draft.frequencyInterval} onChange={v => set('frequencyInterval', v.replace(/[^\d]/g, ''))} placeholder="1" />
            </div>
            {(draft.frequency === 'monthly' || draft.frequency === 'yearly') && (
              <TextField label="Day of the month (optional)" value={draft.dueDateOfMonth} onChange={v => set('dueDateOfMonth', v.replace(/[^\d]/g, ''))} placeholder={String(parseLocalDate(draft.startDate).getDate())} />
            )}
            <PickerField label="On a weekend" value={draft.weekendAdjustment} options={WEEKEND} onChange={v => set('weekendAdjustment', v as WeekendAdjustment)} icon="calendar" />
            <TextField label="Ends (optional)" type="date" value={draft.endDate} onChange={v => set('endDate', v)} />
            {preview.length > 0 && (
              <p className="flex items-center gap-2 rounded-nv-sub bg-nv-inset p-4 text-sm text-nv-ink">
                <NvIcon name="calendar" size={16} className="text-nv-muted" />
                Next: {preview.map(d => formatShortDate(d, data.today)).join(', ')}
              </p>
            )}
          </>
        )}
        {error && <p role="alert" className="text-sm text-nv-red-text">{error}</p>}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Drawer>
  );
};
