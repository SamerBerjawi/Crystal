import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '../../../lib/utils';
import { formatCurrency } from '../../../utils';
import { hasLocation, loanOf, loanSplit, roundUpAmount, spareAccountFor, topCategories, type TxDraft, type TxKind } from '../../../utils/transactionsModel';
import type { TransactionsData } from '../../../hooks/useTransactionsData';
import { AmountPad } from '../../kokonutui/amount-pad';
import { useMediaQuery } from '../Drawer';
import { EntityGlyph, LogoTile } from '../EntityIcon';
import { NvIcon } from '../NvIcon';
import { Switch, SegmentedTabs } from '../ui';
import { LocationField } from './LocationField';
import { PickList, PopChip, type PickOption } from './composer';
import { PickerField, TextField, currencySign } from './parts';

/*
 * The add / edit form (UI_UX_DESIGN_REFERENCE.md §3.1, Q6, R7): kind tabs in their accent, the amount as the
 * hero (Amount Pad keys on phones, typing on desktop), a grid of the most used categories, then account(s),
 * date, merchant, description, note and tags. Saving is the sheet's footer button.
 */

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const FormSection: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <section>
    <div className="mb-2.5 flex items-baseline justify-between gap-3">
      <h3 className="text-[15px] font-semibold text-nv-ink">{title}</h3>
      {hint && <p className="truncate text-[13px] text-nv-muted">{hint}</p>}
    </div>
    {children}
  </section>
);

export const kindLabel = (kind: TxKind) => (kind === 'expense' ? 'expense' : kind === 'income' ? 'income' : 'transfer');

export const TransactionForm: React.FC<{
  draft: TxDraft;
  /** Takes an updater, so several quick changes never overwrite each other. */
  onChange: React.Dispatch<React.SetStateAction<TxDraft>>;
  data: TransactionsData;
  error?: string | null;
  autoFocusAmount?: boolean;
  /** A new transaction (round-up defaults on when the account has a spare-change account). */
  isNew?: boolean;
}> = ({ draft, onChange, data, error, autoFocusAmount, isNew }) => {
  const phone = !useMediaQuery('(min-width: 768px)');
  const set = <K extends keyof TxDraft>(key: K, value: TxDraft[K]) => onChange(prev => ({ ...prev, [key]: value }));
  const accountOptions = data.openAccounts.map(a => ({ value: a.id, label: a.name, hint: a.currency }));
  const account = data.accountsById.get(draft.accountId);
  const currency = account?.currency ?? data.displayCurrency;

  // Loan payments: principal and interest follow the amount until the user types one of them.
  const loan = loanOf(draft, data.accounts);
  const amountNumber = parseFloat(draft.amount) || 0;
  const autoSplit = loan && draft.autoLoanSplit ? loanSplit(amountNumber, loan) : null;
  useEffect(() => {
    if (!loan) { if (draft.principal || draft.interest) onChange(prev => ({ ...prev, principal: '', interest: '' })); return; }
    if (!draft.autoLoanSplit) return;
    const next = { principal: autoSplit ? autoSplit.principal.toFixed(2) : '', interest: autoSplit ? autoSplit.interest.toFixed(2) : '' };
    if (next.principal !== draft.principal || next.interest !== draft.interest) onChange(prev => ({ ...prev, ...next }));
    // Recompute when the amount, the loan or the auto flag changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loan?.id, draft.amount, draft.autoLoanSplit]);

  // Round-up into the spare-change account of the paying account.
  const spare = draft.kind === 'income' ? undefined : spareAccountFor(data.accounts, draft.accountId);
  const setAside = spare ? roundUpAmount(amountNumber, draft.roundUpBehavior, parseFloat(draft.roundUpMultiplier) || 1) : 0;
  useEffect(() => {
    if (isNew) onChange(prev => (prev.roundUp === !!spare ? prev : { ...prev, roundUp: !!spare }));
    // Only when the paying account (and so its spare account) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spare?.id, isNew]);

  const kindForCategories = draft.kind === 'income' ? 'income' : 'expense';
  const options = draft.kind === 'transfer' ? [] : data.categories[kindForCategories];
  const quick = useMemo(() => {
    const used = topCategories(data.transactions, kindForCategories, 6);
    const fill = options.filter(c => !c.parent).map(c => c.name).filter(n => !used.includes(n));
    const list = [...used, ...fill].slice(0, 6);
    // Editing a transaction in a less used category: show it, so the choice is visible and not only in the text.
    return draft.category && !list.includes(draft.category) ? [draft.category, ...list.slice(0, 5)] : list;
  }, [data.transactions, kindForCategories, options, draft.category]);

  const today = isoOf(new Date());
  const yesterday = isoOf(new Date(Date.now() - 86_400_000));
  // The merchant's logo appears once typing pauses, so each keystroke does not request one.
  const [logoName, setLogoName] = useState(draft.merchant);
  useEffect(() => { const t = window.setTimeout(() => setLogoName(draft.merchant), 500); return () => window.clearTimeout(t); }, [draft.merchant]);
  const merchantLogo = logoName.trim() ? data.logoFor(logoName.trim()) : null;
  const amountTone = draft.kind === 'income' ? 'text-nv-green-text' : draft.kind === 'transfer' ? 'text-nv-sky-text' : 'text-nv-ink';

  // Note, location and tags open on demand (and start open when the transaction already has them).
  const [show, setShow] = useState({ note: !!draft.notes, location: hasLocation(draft.location), tags: draft.tagIds.length > 0 });
  const toggleShow = (key: 'note' | 'location' | 'tags') => setShow(prev => ({ ...prev, [key]: !prev[key] }));

  const logoOf = (a: { financialInstitution?: string; name: string }) => <LogoTile url={a.financialInstitution ? data.logoFor(a.financialInstitution) : null} label={a.name} size={22} fallbackIcon="bank" />;
  const accountPick: PickOption[] = data.openAccounts.map(a => ({ id: a.id, label: a.name, hint: a.currency, visual: logoOf(a), group: a.type }));
  const toAccount = data.accountsById.get(draft.toAccountId);
  const categoryPick: PickOption[] = options.map(c => ({ id: c.name, label: c.name, level: c.parent ? 1 : 0, visual: <EntityGlyph icon={c.icon} label={c.name} color={c.color} size={18} /> }));
  const chosenCategory = data.categoryByName.get(draft.category);
  const dateText = draft.date === today ? 'Today' : draft.date === yesterday ? 'Yesterday' : new Date(`${draft.date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-5 pt-1">
      <SegmentedTabs<TxKind>
        label="Type"
        className="w-full [&>button]:flex-1"
        value={draft.kind}
        onChange={kind => onChange(prev => ({ ...prev, kind, category: kind === prev.kind ? prev.category : '' }))}
        items={[
          { id: 'expense', label: 'Expense', accent: 'orange', icon: 'money' },
          { id: 'income', label: 'Income', accent: 'green', icon: 'wallet' },
          { id: 'transfer', label: 'Transfer', accent: 'sky', icon: 'transactions' },
        ]}
      />

      <AmountPad
        value={draft.amount}
        onChange={amount => set('amount', amount)}
        currency={currencySign(currency)}
        keypad={phone}
        label={`Amount in ${currency}`}
        autoFocus={autoFocusAmount}
        toneClassName={amountTone}
      />

      {draft.kind !== 'transfer' && (
        <label className="flex items-center gap-3 rounded-full bg-nv-inset py-2 pl-2 pr-5 focus-within:ring-2 focus-within:ring-nv-violet">
          <LogoTile url={merchantLogo} label={draft.merchant || '?'} size={40} rounded="full" fallbackIcon={draft.merchant.trim() ? undefined : 'bank'} />
          <span className="sr-only">{draft.kind === 'income' ? 'From' : 'Merchant'}</span>
          <input value={draft.merchant} onChange={e => set('merchant', e.target.value)} placeholder={draft.kind === 'income' ? 'Who paid you?' : 'Who was it with?'} className="h-8 min-w-0 flex-1 bg-transparent text-[17px] font-medium text-nv-ink outline-none placeholder:font-normal placeholder:text-nv-muted" />
        </label>
      )}
      <input value={draft.description} onChange={e => set('description', e.target.value)} aria-label="Description" placeholder={draft.kind === 'transfer' ? 'What is it for? (optional)' : 'Add a description (optional)'} className="-mt-2 h-11 w-full border-b border-nv-line bg-transparent px-1 text-[15px] text-nv-ink outline-none placeholder:text-nv-muted focus:border-nv-ink" />

      <div className="flex flex-wrap gap-2">
        {draft.kind !== 'transfer' && (
          <PopChip label="Category" value={draft.category} placeholder="Category" visual={draft.category ? <EntityGlyph icon={chosenCategory?.icon} label={draft.category} color={chosenCategory?.color} size={18} /> : <NvIcon name="budget" size={16} />}>
            {close => <PickList label="Categories" options={categoryPick} value={draft.category} onPick={id => { set('category', id); close(); }} />}
          </PopChip>
        )}
        <PopChip label={draft.kind === 'transfer' ? 'From account' : 'Account'} value={account?.name} placeholder="Account" visual={account ? logoOf(account) : <NvIcon name="wallet" size={16} />}>
          {close => <PickList label="Accounts" options={accountPick} value={draft.accountId} onPick={id => { if (id) { set('accountId', id); close(); } }} />}
        </PopChip>
        {draft.kind === 'transfer' && (
          <PopChip label="To account" value={toAccount?.name} placeholder="To account" visual={toAccount ? logoOf(toAccount) : <NvIcon name="wallet" size={16} />}>
            {close => <PickList label="Accounts" options={accountPick.filter(o => o.id !== draft.accountId)} value={draft.toAccountId} onPick={id => { if (id) { set('toAccountId', id); close(); } }} />}
          </PopChip>
        )}
        <PopChip label="Date" value={dateText} placeholder="Date" visual={<NvIcon name="calendar" size={16} />} width="w-72">
          {close => (
            <div className="space-y-3">
              <div className="flex gap-2">
                {([['Today', today], ['Yesterday', yesterday]] as const).map(([label, iso]) => (
                  <button key={label} type="button" aria-pressed={draft.date === iso} onClick={() => { set('date', iso); close(); }} className={cn('h-11 flex-1 rounded-full text-[14px] font-medium', draft.date === iso ? 'bg-nv-ink text-nv-on-ink' : 'bg-nv-inset text-nv-ink hover:bg-nv-line')}>{label}</button>
                ))}
              </div>
              <TextField label="Another day" type="date" icon="calendar" value={draft.date} onChange={v => set('date', v)} />
            </div>
          )}
        </PopChip>
      </div>

      {draft.kind !== 'transfer' && quick.length > 0 && (
        <div>
          <p className="mb-2 text-[13px] text-nv-muted">Often used</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {quick.map(name => {
              const active = draft.category === name;
              const cat = data.categoryByName.get(name);
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={active}
                  onClick={() => set('category', name)}
                  className={cn('flex h-[72px] w-24 shrink-0 flex-col items-center justify-center gap-1.5 rounded-nv-tile px-2 text-center text-[12px] font-medium transition-colors', active ? 'ring-[1.5px] ring-nv-ink' : 'hover:bg-nv-inset')}
                  style={{ background: `color-mix(in srgb, ${cat?.color || 'var(--nv-violet)'} ${active ? 22 : 12}%, transparent)` }}
                >
                  <EntityGlyph icon={cat?.icon} label={name} color={cat?.color} size={22} />
                  <span className="line-clamp-1 w-full">{name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Add more">
        {([['note', 'Note', 'note'], ['location', 'Location', 'pin'], ['tags', 'Tags', 'tag']] as const).map(([key, label, icon]) => (
          (key !== 'tags' || data.tags.length > 0) && (
            <button key={key} type="button" aria-pressed={show[key]} onClick={() => toggleShow(key)} className={cn('inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-medium', show[key] ? 'border-nv-ink text-nv-ink' : 'border-dashed border-nv-line text-nv-muted hover:text-nv-ink')}>
              <NvIcon name={show[key] ? icon : 'add'} size={15} />{label}
            </button>
          )
        ))}
      </div>
      {show.note && <TextField label="Note" multiline value={draft.notes} onChange={v => set('notes', v)} placeholder="Lunch with the team" />}
      {show.location && <LocationField value={draft.location} onChange={location => set('location', location)} />}
      {show.tags && data.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.tags.map(tag => {
            const on = draft.tagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(prev => ({ ...prev, tagIds: prev.tagIds.includes(tag.id) ? prev.tagIds.filter(t => t !== tag.id) : [...prev.tagIds, tag.id] }))}
                className={cn('inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-medium', on ? 'border-nv-ink bg-nv-ink text-nv-on-ink' : 'border-nv-line bg-nv-surface text-nv-ink')}
              >
                <EntityGlyph icon={tag.icon} label={tag.name} color={on ? undefined : tag.color} size={16} />
                {tag.name}
              </button>
            );
          })}
        </div>
      )}

      {loan && (
        <div className="rounded-nv-tile bg-nv-inset p-4">
          <p className="text-sm font-medium text-nv-ink">Loan payment</p>
          <p className="mt-0.5 text-[13px] text-nv-muted">
            {!draft.autoLoanSplit
              ? 'Principal and interest must add up to the amount.'
              : loan.interestRate
                ? `Split from ${loan.name}'s rate and balance. Edit a figure to set it yourself.`
                : `${loan.name} has no interest rate, so enter principal and interest yourself, or leave them empty.`}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <TextField label="Principal" type="number" value={draft.principal} onChange={v => onChange(prev => {
              const total = parseFloat(prev.amount) || 0;
              const principal = Math.min(Math.max(parseFloat(v) || 0, 0), total);
              return { ...prev, autoLoanSplit: false, principal: v === '' ? '' : v, interest: v === '' ? '' : (Math.round((total - principal) * 100) / 100).toFixed(2) };
            })} />
            <TextField label="Interest" type="number" value={draft.interest} onChange={v => onChange(prev => {
              const total = parseFloat(prev.amount) || 0;
              const interest = Math.min(Math.max(parseFloat(v) || 0, 0), total);
              return { ...prev, autoLoanSplit: false, interest: v === '' ? '' : v, principal: v === '' ? '' : (Math.round((total - interest) * 100) / 100).toFixed(2) };
            })} />
          </div>
          {!draft.autoLoanSplit && (
            <button type="button" onClick={() => onChange(prev => ({ ...prev, autoLoanSplit: true }))} className="mt-3 inline-flex h-11 items-center text-sm font-medium text-nv-violet-text">Calculate automatically</button>
          )}
        </div>
      )}

      {spare && (
        <section aria-label="Round-up" className="rounded-nv-card bg-nv-inset p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-nv-green-soft text-nv-green-text"><NvIcon name="piggy" size={22} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-nv-ink">Round up to {spare.name}</p>
              <p className={cn('text-[13px]', draft.roundUp && setAside > 0 ? 'font-medium text-nv-green-text' : 'text-nv-muted')}>
                {draft.roundUp ? (setAside > 0 ? `Sets aside ${formatCurrency(setAside, spare.currency)}` : 'Nothing to set aside for this amount') : 'Off for this transaction'}
              </p>
            </div>
            <Switch checked={draft.roundUp} onChange={roundUp => set('roundUp', roundUp)} label="Round up" />
          </div>
          {draft.roundUp && (
            <div className="mt-4 space-y-4 border-t border-nv-line pt-4">
              <fieldset>
                <legend className="mb-2 text-[13px] font-medium text-nv-muted">When the amount is already whole</legend>
                <div className="grid grid-cols-2 gap-2">
                  {([['skip', 'Set aside nothing', 'Only amounts with cents round up'], ['unit', 'Set aside 1', 'Whole amounts push up a full unit']] as const).map(([id, title, hint]) => {
                    const on = draft.roundUpBehavior === id;
                    return (
                      <button key={id} type="button" aria-pressed={on} onClick={() => set('roundUpBehavior', id)} className={cn('rounded-nv-tile border p-3 text-left transition-colors', on ? 'border-nv-ink bg-nv-surface' : 'border-nv-line hover:bg-nv-surface')}>
                        <span className="flex items-center gap-2 text-[14px] font-medium text-nv-ink">
                          <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-nv-ink' : 'border-nv-faint')} aria-hidden>{on && <span className="h-2 w-2 rounded-full bg-nv-ink" />}</span>
                          {title}
                        </span>
                        <span className="mt-1 block pl-6 text-[12px] leading-snug text-nv-muted">{hint}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[14px] font-medium text-nv-ink">Multiplier</p>
                  <p className="text-[12px] text-nv-muted">Set aside this many times the round-up</p>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-nv-surface p-1">
                  <button type="button" aria-label="Decrease multiplier" disabled={(parseFloat(draft.roundUpMultiplier) || 1) <= 1} onClick={() => set('roundUpMultiplier', String(Math.max(1, (parseFloat(draft.roundUpMultiplier) || 1) - 1)))} className="flex h-10 w-10 items-center justify-center rounded-full text-nv-ink hover:bg-nv-inset disabled:opacity-40"><span className="text-xl leading-none" aria-hidden>−</span></button>
                  <span className="nv-tabular w-10 text-center text-[16px] font-semibold text-nv-ink" aria-live="polite">×{parseFloat(draft.roundUpMultiplier) || 1}</span>
                  <button type="button" aria-label="Increase multiplier" onClick={() => set('roundUpMultiplier', String((parseFloat(draft.roundUpMultiplier) || 1) + 1))} className="flex h-10 w-10 items-center justify-center rounded-full text-nv-ink hover:bg-nv-inset"><span className="text-xl leading-none" aria-hidden>+</span></button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-nv-tile bg-nv-red-soft px-4 py-3 text-sm text-nv-red-text">
          <NvIcon name="alert" size={18} />{error}
        </p>
      )}
    </div>
  );
};
