import React, { useMemo, useState } from 'react';
import { cn } from '../../../lib/utils';
import type { RecurrenceFrequency, WeekendAdjustment } from '../../../types';
import { formatCurrency } from '../../../utils';
import type { TransactionsData } from '../../../hooks/useTransactionsData';
import {
  FREQUENCIES, combineDefaults, defaultSplitParts, emptyLocation, recurringDraftFromRow, splitRemaining,
  type BulkFields, type CombineFields, type LocationDraft, type RecurringDraft, type SplitPart, type TxRow,
} from '../../../utils/transactionsModel';
import { Drawer } from '../Drawer';
import { NvIcon } from '../NvIcon';
import { Button, Switch, SegmentedTabs } from '../ui';
import { toast } from '../toast';
import { LocationField } from './LocationField';
import { PickerField, TextField, currencySign } from './parts';

/* The sheets behind the selection bar and the detail sheet's menu (UI_UX_DESIGN_REFERENCE.md §16). */

const ErrorLine: React.FC<{ error?: string | null }> = ({ error }) => error
  ? <p role="alert" className="flex items-center gap-2 rounded-nv-tile bg-nv-red-soft px-4 py-3 text-sm text-nv-red-text"><NvIcon name="alert" size={18} />{error}</p>
  : null;

const categoryOptions = (data: TransactionsData, kind: 'income' | 'expense' | 'both') => {
  const list = kind === 'both' ? [...data.categories.expense, ...data.categories.income] : data.categories[kind];
  const seen = new Set<string>();
  return list.filter(c => (seen.has(c.name) ? false : (seen.add(c.name), true))).map(c => ({ value: c.name, label: c.parent ? `${c.parent} › ${c.name}` : c.name, color: c.color, icon: c.icon }));
};

/* ------------------------------------------------------------------- split */

export const SplitSheet: React.FC<{ row: TxRow | null; data: TransactionsData; onClose: () => void }> = ({ row, data, onClose }) => {
  const parent = row ? data.transactions.find(t => t.id === row.id) : undefined;
  const initial = useMemo<SplitPart[]>(() => {
    if (!parent) return [];
    const existing = data.partsOf(parent.id);
    return existing.length
      ? existing.map(p => ({ amount: Math.abs(p.amount).toFixed(2), category: p.category, description: p.description }))
      : defaultSplitParts(parent);
  }, [parent, data]);
  const [parts, setParts] = useState<SplitPart[]>(initial);
  const [error, setError] = useState<string | null>(null);
  React.useEffect(() => { setParts(initial); setError(null); }, [initial]);
  if (!row || !parent) return <Drawer open={false} onOpenChange={() => onClose()} title=""><span /></Drawer>;

  const remaining = splitRemaining(parent, parts);
  const done = Math.abs(remaining) < 0.01;
  const options = categoryOptions(data, parent.amount >= 0 ? 'income' : 'expense');
  const update = (i: number, patch: Partial<SplitPart>) => setParts(ps => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const submit = () => {
    const result = data.split(row, parts);
    if ('error' in result) { setError(result.error); return; }
    toast.undo(`Split "${row.title}" into ${parts.length} parts`, result.undo);
    onClose();
  };

  return (
    <Drawer
      open
      onOpenChange={o => { if (!o) onClose(); }}
      title={row.split ? 'Edit split' : 'Split transaction'}
      description={`${row.title} · ${formatCurrency(Math.abs(parent.amount), parent.currency)}`}
      width={520}
      footer={<Button variant="cta" size="lg" className="w-full" onClick={submit}>{done ? `Save ${parts.length} parts` : `Remaining ${formatCurrency(remaining, parent.currency)}`}</Button>}
    >
      <div className="space-y-4 pt-1">
        {parts.map((p, i) => (
          <div key={i} className="rounded-nv-tile bg-nv-inset p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-nv-ink">Part {i + 1}</p>
              {parts.length > 2 && <button type="button" aria-label={`Remove part ${i + 1}`} onClick={() => setParts(ps => ps.filter((_, j) => j !== i))} className="flex h-9 w-9 items-center justify-center rounded-full text-nv-muted hover:bg-nv-line hover:text-nv-ink"><NvIcon name="close" size={16} /></button>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label={`Amount (${currencySign(parent.currency).trim()})`} type="number" value={p.amount} onChange={v => { update(i, { amount: v }); setError(null); }} />
              <PickerField label="Category" value={p.category} onChange={v => update(i, { category: v })} options={options} />
            </div>
            <TextField className="mt-3" label="Description" value={p.description} onChange={v => update(i, { description: v })} />
          </div>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button size="sm" icon="add" onClick={() => setParts(ps => [...ps, { amount: remaining > 0 ? remaining.toFixed(2) : '0', category: parent.category, description: '' }])}>Add part</Button>
          <p className={cn('text-sm', done ? 'text-nv-green-text' : 'text-nv-muted')}>{done ? 'Fully allocated' : `Remaining ${formatCurrency(remaining, parent.currency)}`}</p>
        </div>
        <ErrorLine error={error} />
      </div>
    </Drawer>
  );
};

/* ----------------------------------------------------------------- combine */

export const CombineSheet: React.FC<{ rows: TxRow[]; data: TransactionsData; onClose: () => void; onDone: () => void }> = ({ rows, data, onClose, onDone }) => {
  const txs = useMemo(() => rows.flatMap(r => data.storedOf(r)), [rows, data]);
  const [fields, setFields] = useState<CombineFields>(() => combineDefaults(txs));
  const [error, setError] = useState<string | null>(null);
  const total = Math.round(txs.reduce((s, t) => s + t.amount, 0) * 100) / 100;
  const currency = txs[0]?.currency ?? data.displayCurrency;
  const set = <K extends keyof CombineFields>(k: K, v: CombineFields[K]) => { setFields(f => ({ ...f, [k]: v })); setError(null); };

  const submit = () => {
    const result = data.combine(rows, fields);
    if ('error' in result) { setError(result.error); return; }
    toast.undo(`Combined ${rows.length} transactions`, result.undo);
    onDone();
  };

  return (
    <Drawer
      open
      onOpenChange={o => { if (!o) onClose(); }}
      title="Combine transactions"
      description={`${rows.length} transactions become one, with the originals kept inside.`}
      width={520}
      footer={<Button variant="cta" size="lg" className="w-full" onClick={submit}>Combine · {formatCurrency(Math.abs(total), currency)}</Button>}
    >
      <div className="space-y-4 pt-1">
        <div className="flex items-center justify-between rounded-nv-tile bg-nv-inset px-4 py-3">
          <span className="text-sm text-nv-muted">{total >= 0 ? 'Net income' : 'Net expense'}</span>
          <span className="nv-tabular text-xl font-semibold">{formatCurrency(Math.abs(total), currency)}</span>
        </div>
        <TextField label="Description" value={fields.description} onChange={v => set('description', v)} />
        <PickerField label="Category" value={fields.category} onChange={v => set('category', v)} options={categoryOptions(data, total >= 0 ? 'income' : 'expense')} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Date" type="date" icon="calendar" value={fields.date} onChange={v => set('date', v)} />
          <PickerField label="Account" icon="wallet" value={fields.accountId} onChange={v => set('accountId', v)} options={data.openAccounts.map(a => ({ value: a.id, label: a.name, hint: a.currency }))} />
        </div>
        <ul className="divide-y divide-nv-line rounded-nv-tile bg-nv-inset px-4">
          {txs.map(t => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0 truncate text-nv-ink">{t.merchant || t.description || t.category}</span>
              <span className="nv-tabular shrink-0 text-nv-muted">{formatCurrency(t.amount, t.currency)}</span>
            </li>
          ))}
        </ul>
        <ErrorLine error={error} />
      </div>
    </Drawer>
  );
};

/* ---------------------------------------------------------------- bulk edit */

type BulkKey = 'date' | 'accountId' | 'description' | 'merchant' | 'category' | 'tags' | 'location';

const BulkSection: React.FC<{ label: string; on: boolean; onToggle: (on: boolean) => void; children: React.ReactNode }> = ({ label, on, onToggle, children }) => (
  <div className="rounded-nv-tile bg-nv-inset px-4 py-2">
    <div className="flex items-center justify-between">
      <p className="text-[15px] font-medium text-nv-ink">{label}</p>
      <Switch checked={on} onChange={onToggle} label={`Change ${label.toLowerCase()}`} />
    </div>
    {on && <div className="pb-3 pt-1">{children}</div>}
  </div>
);

export const BulkEditSheet: React.FC<{ rows: TxRow[]; data: TransactionsData; onClose: () => void; onDone: () => void }> = ({ rows, data, onClose, onDone }) => {
  const [on, setOn] = useState<Record<BulkKey, boolean>>({ date: false, accountId: false, description: false, merchant: false, category: false, tags: false, location: false });
  const [date, setDate] = useState(rows[0]?.date ?? '');
  const [accountId, setAccountId] = useState(data.openAccounts[0]?.id ?? '');
  const [description, setDescription] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [tagMode, setTagMode] = useState<'add' | 'replace'>('add');
  const [location, setLocation] = useState<LocationDraft>(emptyLocation());
  const [error, setError] = useState<string | null>(null);
  const toggle = (k: BulkKey) => (v: boolean) => { setOn(o => ({ ...o, [k]: v })); setError(null); };
  const transfers = rows.filter(r => r.kind === 'transfer').length;

  const submit = () => {
    const fields: BulkFields = {};
    if (on.date) fields.date = date;
    if (on.accountId) fields.accountId = accountId;
    if (on.description) fields.description = description;
    if (on.merchant) fields.merchant = merchant;
    if (on.category) {
      const option = data.categoryByName.get(category);
      if (!option) { setError('Choose a category'); return; }
      fields.category = { name: option.name, classification: option.classification };
    }
    if (on.tags) { fields.tagIds = tagIds; fields.tagMode = tagMode; }
    if (on.location) fields.location = location.address || location.city || location.country ? location : null;
    const result = data.bulkEdit(rows, fields);
    if ('error' in result) { setError(result.error === 'Nothing to change' ? 'Switch on at least one field to change' : result.error); return; }
    toast.undo(`Updated ${rows.length} transaction${rows.length === 1 ? '' : 's'}`, result.undo);
    onDone();
  };

  return (
    <Drawer
      open
      onOpenChange={o => { if (!o) onClose(); }}
      title="Edit transactions"
      description={`${rows.length} selected. Only the fields you switch on change.`}
      width={520}
      footer={<Button variant="cta" size="lg" className="w-full" onClick={submit}>Update {rows.length} transaction{rows.length === 1 ? '' : 's'}</Button>}
    >
      <div className="space-y-3 pt-1">
        <BulkSection label="Date" on={on.date} onToggle={toggle('date')}><TextField label="New date" type="date" icon="calendar" value={date} onChange={setDate} /></BulkSection>
        <BulkSection label="Account" on={on.accountId} onToggle={toggle('accountId')}>
          <PickerField label="Move to account" icon="wallet" value={accountId} onChange={setAccountId} options={data.openAccounts.map(a => ({ value: a.id, label: a.name, hint: a.currency }))} />
          {transfers > 0 && <p className="mt-2 text-[13px] text-nv-muted">{transfers} transfer{transfers === 1 ? '' : 's'} keep their accounts.</p>}
        </BulkSection>
        <BulkSection label="Description" on={on.description} onToggle={toggle('description')}><TextField label="New description" value={description} onChange={setDescription} /></BulkSection>
        <BulkSection label="Merchant" on={on.merchant} onToggle={toggle('merchant')}><TextField label="New merchant" value={merchant} onChange={setMerchant} /></BulkSection>
        <BulkSection label="Category" on={on.category} onToggle={toggle('category')}>
          <PickerField label="New category" placeholder="Choose a category" value={category} onChange={setCategory} options={categoryOptions(data, 'both')} />
          <p className="mt-2 text-[13px] text-nv-muted">A category of the other kind changes the type, and a transfer becomes an ordinary transaction.</p>
        </BulkSection>
        <BulkSection label="Tags" on={on.tags} onToggle={toggle('tags')}>
          <SegmentedTabs<'add' | 'replace'> label="Tag change" size="sm" className="mb-3 w-full [&>button]:flex-1" value={tagMode} onChange={setTagMode} items={[{ id: 'add', label: 'Add to existing' }, { id: 'replace', label: 'Replace' }]} />
          <div className="flex flex-wrap gap-2">
            {data.tags.length === 0 && <p className="text-sm text-nv-muted">No tags yet.</p>}
            {data.tags.map(tag => {
              const picked = tagIds.includes(tag.id);
              return (
                <button key={tag.id} type="button" aria-pressed={picked} onClick={() => setTagIds(ids => (picked ? ids.filter(x => x !== tag.id) : [...ids, tag.id]))} className={cn('inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium', picked ? 'border-nv-ink bg-nv-ink text-nv-on-ink' : 'border-nv-line bg-nv-surface text-nv-ink')}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: tag.color }} aria-hidden />{tag.name}
                </button>
              );
            })}
          </div>
        </BulkSection>
        <BulkSection label="Location" on={on.location} onToggle={toggle('location')}>
          <LocationField value={location} onChange={setLocation} />
          <p className="mt-2 text-[13px] text-nv-muted">Leave it empty to remove the location.</p>
        </BulkSection>
        <ErrorLine error={error} />
      </div>
    </Drawer>
  );
};

/* --------------------------------------------------------------- recurring */

const WEEKEND: { value: WeekendAdjustment; label: string }[] = [
  { value: 'on', label: 'On the due date' },
  { value: 'before', label: 'Friday before' },
  { value: 'after', label: 'Monday after' },
];

export const RecurringSheet: React.FC<{ row: TxRow | null; data: TransactionsData; onClose: () => void }> = ({ row, data, onClose }) => {
  const [draft, setDraft] = useState<RecurringDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  React.useEffect(() => { setDraft(row ? recurringDraftFromRow(row, new Date()) : null); setError(null); }, [row]);
  if (!row || !draft) return <Drawer open={false} onOpenChange={() => onClose()} title=""><span /></Drawer>;

  const set = <K extends keyof RecurringDraft>(k: K, v: RecurringDraft[K]) => { setDraft(d => (d ? { ...d, [k]: v } : d)); setError(null); };
  const accounts = data.openAccounts.map(a => ({ value: a.id, label: a.name, hint: a.currency }));
  const unit = FREQUENCIES.find(f => f.value === draft.frequency)?.unit ?? 'period';
  const monthly = draft.frequency === 'monthly' || draft.frequency === 'yearly';

  const submit = () => {
    const result = data.makeRecurring(draft);
    if ('error' in result) { setError(result.error); return; }
    toast.undo('Recurring transaction created', result.undo);
    onClose();
  };

  return (
    <Drawer
      open
      onOpenChange={o => { if (!o) onClose(); }}
      title="Make recurring"
      description={`Repeat "${row.title}" on a schedule. The original stays as it is.`}
      width={520}
      footer={<Button variant="cta" size="lg" className="w-full" onClick={submit}>Create recurring</Button>}
    >
      <div className="space-y-4 pt-1">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Amount" type="number" value={draft.amount} onChange={v => set('amount', v)} />
          <PickerField label={draft.kind === 'transfer' ? 'From' : 'Account'} icon="wallet" value={draft.accountId} onChange={v => set('accountId', v)} options={accounts} />
        </div>
        {draft.kind === 'transfer'
          ? <PickerField label="To" icon="wallet" value={draft.toAccountId} onChange={v => set('toAccountId', v)} options={accounts.filter(a => a.value !== draft.accountId)} placeholder="Choose an account" />
          : <PickerField label="Category" value={draft.category} onChange={v => set('category', v)} options={categoryOptions(data, draft.kind === 'income' ? 'income' : 'expense')} placeholder="Choose a category" />}
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Merchant" value={draft.merchant} onChange={v => set('merchant', v)} />
          <TextField label="Description" value={draft.description} onChange={v => set('description', v)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <PickerField label="Repeats" icon="repeat" value={draft.frequency} onChange={v => set('frequency', v as RecurrenceFrequency)} options={FREQUENCIES.map(f => ({ value: f.value, label: f.label }))} />
          {draft.frequency !== 'daily' && <TextField label={`Every N ${unit}s`} type="number" value={draft.interval} onChange={v => set('interval', v)} />}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Starts" type="date" icon="calendar" value={draft.startDate} onChange={v => set('startDate', v)} />
          <TextField label="Ends (optional)" type="date" icon="calendar" value={draft.endDate} onChange={v => set('endDate', v)} />
        </div>
        {monthly && <TextField label="Day of the month (optional)" type="number" value={draft.dueDay} onChange={v => set('dueDay', v)} placeholder="Follows the start date" />}
        <PickerField label="If it falls on a weekend" value={draft.weekend} onChange={v => set('weekend', v as WeekendAdjustment)} options={WEEKEND} />
        <ErrorLine error={error} />
      </div>
    </Drawer>
  );
};
