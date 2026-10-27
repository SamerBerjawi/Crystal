import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useTransactionsData, type TransactionsData, type WriteResult } from '../../../hooks/useTransactionsData';
import { addressBlock, draftFromRow, emptyDraft, locationLine, roundUpPairOf, type TxDraft, type TxKind, type TxRow } from '../../../utils/transactionsModel';
import { formatCurrency } from '../../../utils';
import { Drawer } from '../Drawer';
import { EntityGlyph, LogoTile } from '../EntityIcon';
import { NvIcon, type NvIconName } from '../NvIcon';
import { Button, IconButton } from '../ui';
import { HoldButton } from '../../kokonutui/hold-button';
import { toast } from '../toast';
import { useShellNew } from '../shellContext';
import { Bone } from '../Skeleton';
import { DetailBody, DetailHero, Fact } from './detail';
import { TransactionForm, kindLabel } from './TransactionForm';

/* Quick add (the shell's +) and the transaction detail / edit sheet (UI_UX_DESIGN_REFERENCE.md §3.1, D6, D7). */

const LAST_ACCOUNT_KEY = 'crystal_new_last_account';
const readLastAccount = () => { try { return localStorage.getItem(LAST_ACCOUNT_KEY) || ''; } catch { return ''; } };
const writeLastAccount = (id: string) => { try { localStorage.setItem(LAST_ACCOUNT_KEY, id); } catch { /* per-device convenience only */ } };

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const defaultAccount = (data: TransactionsData) => {
  const last = readLastAccount();
  if (data.openAccounts.some(a => a.id === last)) return last;
  return (data.openAccounts.find(a => a.type === 'Checking') ?? data.openAccounts[0])?.id ?? '';
};

const saveLabel = (draft: TxDraft, data: TransactionsData, editing: boolean) => {
  const amount = parseFloat(draft.amount);
  const currency = data.accountsById.get(draft.accountId)?.currency ?? data.displayCurrency;
  const verb = editing ? 'Save changes' : `Save ${kindLabel(draft.kind)}`;
  return amount > 0 ? `${verb} · ${formatCurrency(amount, currency)}` : verb;
};

/** The + sheet: a new expense, income or transfer from anywhere in the New UI. */
export const QuickAddSheet: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void; initialKind?: TxKind }> = ({ open, onOpenChange, initialKind = 'expense' }) => {
  const data = useTransactionsData();
  const [draft, setDraft] = useState<TxDraft>(() => emptyDraft(initialKind, defaultAccount(data), new Date()));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setDraft(emptyDraft(initialKind, defaultAccount(data), new Date())); setError(null); }
    // Reset only when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialKind]);

  const submit = () => {
    const result = data.save(draft);
    if ('error' in result) { setError(result.error); return; }
    writeLastAccount(draft.accountId);
    const currency = data.accountsById.get(draft.accountId)?.currency ?? data.displayCurrency;
    const what = draft.kind === 'expense' ? 'Expense' : draft.kind === 'income' ? 'Income' : 'Transfer';
    toast.undo(`${what} added · ${formatCurrency(parseFloat(draft.amount), currency)}`, result.undo);
    onOpenChange(false);
  };

  if (!data.openAccounts.length) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} title="Add a transaction" description="Add an account first: every transaction belongs to one.">
        <p className="py-4 text-sm text-nv-muted">Accounts are not rebuilt yet; add one in the classic UI.</p>
      </Drawer>
    );
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Add a transaction"
      width={520}
      footer={<Button variant="cta" size="lg" className="w-full" onClick={submit}>{saveLabel(draft, data, false)}</Button>}
    >
      <form onSubmit={e => { e.preventDefault(); submit(); }}>
        <TransactionForm draft={draft} onChange={update => { setDraft(update); setError(null); }} data={data} error={error} autoFocusAmount isNew />
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Drawer>
  );
};

/** What the detail sheet's menu can start. The page owns the sheets those open. */
export interface RowActions { split: (row: TxRow) => void; recurring: (row: TxRow) => void }

/** Details of one transaction, with Edit (the same form), Duplicate, Delete (undo, D6) and a menu for the rest. */
export const TransactionSheet: React.FC<{ row: TxRow | null; onClose: () => void; data: TransactionsData; actions: RowActions }> = ({ row, onClose, data, actions }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TxDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Reset only when a different transaction opens, not when data changes underneath (a tag added, a background sync).
  const latest = useRef(data.transactions);
  latest.current = data.transactions;
  const rowId = row?.id;
  const { isDark } = useShellNew();
  const [tagText, setTagText] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => { setEditing(false); setMoreOpen(false); setError(null); setDraft(row ? draftFromRow(row, latest.current) : null); }, [rowId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!row) return <Drawer open={false} onOpenChange={() => onClose()} title=""><span /></Drawer>;

  const account = data.accountsById.get(row.accountId);
  const toAccount = row.toAccountId ? data.accountsById.get(row.toAccountId) : undefined;
  const category = data.categoryByName.get(row.category);
  const tagNames = row.tagIds.map(id => data.tagsById.get(id)?.name).filter(Boolean);
  const parts = row.split || row.combined ? data.partsOf(row.id) : [];
  const legs = data.storedOf(row);
  const stored = legs[0];
  const loanLeg = legs.find(t => t.principalAmount !== undefined && t.interestAmount !== undefined);
  const roundUp = row.kind === 'expense' ? roundUpPairOf(row.id, data.transactions) : null;
  const lockedParent = row.split || row.combined;
  const setTags = (ids: string[]) => {
    const result = data.bulkEdit([row], { tagIds: ids, tagMode: 'replace' });
    if ('error' in result) { toast.error(result.error); return; }
    toast.undo('Tags updated', result.undo);
  };
  const addTag = () => {
    const id = data.tagIdFor(tagText);
    setTagText('');
    if (id && !row.tagIds.includes(id)) setTags([...row.tagIds, id]);
  };

  const submit = () => {
    if (!draft) return;
    const result = data.save(draft, row);
    if ('error' in result) { setError(result.error); return; }
    toast.undo('Transaction updated', result.undo);
    onClose();
  };
  const run = (result: WriteResult, message: string) => {
    if ('error' in result) { toast.error(result.error); return; }
    toast.undo(message, result.undo);
    onClose();
  };
  const doDelete = () => run(data.remove([row]), `Deleted "${row.title}"`);
  const doDuplicate = () => run(data.duplicate(row, todayIso()), `Duplicated "${row.title}" to today`);

  const menu: { icon: NvIconName; label: string; onClick: () => void }[] = [];
  if (!lockedParent) menu.push({ icon: 'copy', label: 'Duplicate to today', onClick: doDuplicate });
  if (row.kind !== 'transfer' && !row.adjustment && !row.combined) menu.push({ icon: 'split', label: row.split ? 'Edit split' : 'Split transaction', onClick: () => actions.split(row) });
  if (row.split) menu.push({ icon: 'close', label: 'Unsplit', onClick: () => run(data.unsplit(row), `Unsplit "${row.title}"`) });
  if (row.combined) menu.push({ icon: 'close', label: 'Uncombine', onClick: () => run(data.uncombine(row), `Uncombined "${row.title}"`) });
  if (!lockedParent && !row.adjustment && !row.roundUp) menu.push({ icon: 'repeat', label: 'Make recurring', onClick: () => actions.recurring(row) });
  if (row.located && !lockedParent) menu.push({ icon: 'pin', label: 'Remove location', onClick: () => run(data.clearLocation([row]), 'Location removed') });

  return (
    <Drawer
      open
      onOpenChange={o => { if (!o) onClose(); }}
      title={editing ? 'Edit transaction' : row.title}
      description={editing ? undefined : new Date(`${row.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      width={520}
      hero={editing ? undefined : <DetailHero row={row} data={data} isDark={isDark} />}
      footer={editing && draft ? (
        <div className="flex gap-3">
          <Button variant="secondary" size="lg" onClick={() => { setEditing(false); setDraft(draftFromRow(row, data.transactions)); setError(null); }}>Cancel</Button>
          <Button variant="cta" size="lg" className="flex-1" onClick={submit}>{saveLabel(draft, data, true)}</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {moreOpen && menu.length > 0 && (
            <div id="tx-more-actions" className="rounded-nv-tile bg-nv-tile p-1.5">
              {menu.map(item => (
                <button key={item.label} type="button" onClick={() => { setMoreOpen(false); item.onClick(); }} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] text-nv-ink hover:bg-nv-inset">
                  <NvIcon name={item.icon} size={18} className="text-nv-muted" />{item.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button variant="primary" size="lg" icon="edit" className="min-w-28 flex-1" onClick={() => setEditing(true)} disabled={lockedParent || row.adjustment}>Edit</Button>
            <HoldButton tone="danger" icon="delete" className="!h-14 !min-w-0 shrink-0" onHoldComplete={doDelete} holdingLabel="Hold…" completeLabel="Deleted" resetAfter={0} aria-label="Delete (press and hold)">Delete</HoldButton>
            {menu.length > 0 && (
              <IconButton icon="more" label="More actions" size={56} tone="outline" aria-expanded={moreOpen} aria-controls="tx-more-actions" onClick={() => setMoreOpen(o => !o)} />
            )}
          </div>
        </div>
      )}
    >
      {editing && draft ? (
        <form onSubmit={e => { e.preventDefault(); submit(); }}>
          <TransactionForm draft={draft} onChange={update => { setDraft(prev => (prev ? (typeof update === 'function' ? update(prev) : update) : prev)); setError(null); }} data={data} error={error} />
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
      ) : (
        <DetailBody
          row={row}
          data={data}
          place={addressBlock(stored, row.merchant, data.merchantInfo(row.merchant))}
          roundUp={roundUp?.out ? Math.abs(roundUp.out.amount) : undefined}
          loan={loanLeg && loanLeg.principalAmount !== undefined && loanLeg.interestAmount !== undefined ? { principal: loanLeg.principalAmount, interest: loanLeg.interestAmount, currency: loanLeg.currency } : undefined}
          parts={parts}
          tags={!lockedParent && !row.adjustment ? (
            <Fact label="Tags" icon="tag">
              <div className="flex flex-wrap items-center gap-2">
                {row.tagIds.map(id => {
                  const tag = data.tagsById.get(id);
                  return tag ? (
                    <span key={id} className="inline-flex h-9 items-center gap-1.5 rounded-full pl-3 pr-1 text-[14px] font-medium" style={{ background: `color-mix(in srgb, ${tag.color || 'var(--nv-violet)'} 16%, transparent)`, color: tag.color || 'var(--nv-violet-text)' }}>
                      <EntityGlyph icon={tag.icon} label={tag.name} color={tag.color} size={15} />{tag.name}
                      <button type="button" aria-label={`Remove tag ${tag.name}`} onClick={() => setTags(row.tagIds.filter(t => t !== id))} className="flex h-7 w-7 items-center justify-center rounded-full opacity-70 hover:opacity-100"><NvIcon name="close" size={13} /></button>
                    </span>
                  ) : null;
                })}
                <input
                  value={tagText}
                  onChange={e => setTagText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  placeholder="+ Add tag"
                  aria-label="Add a tag"
                  list="nv-tag-options"
                  className="h-9 w-32 rounded-full border border-dashed border-nv-line bg-transparent px-3.5 text-[14px] font-medium text-nv-ink outline-none transition-[width] placeholder:text-nv-muted focus:w-48 focus:border-solid focus:border-nv-violet"
                />
                <datalist id="nv-tag-options">{data.tags.filter(t => !row.tagIds.includes(t.id)).map(t => <option key={t.id} value={t.name} />)}</datalist>
              </div>
            </Fact>
          ) : null}
        />
      )}
    </Drawer>
  );
};
