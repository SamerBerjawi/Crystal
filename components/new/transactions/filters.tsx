import React, { useMemo, useState } from 'react';
import { cn } from '../../../lib/utils';
import type { Account } from '../../../types';
import type { CategoryOption } from '../../../hooks/useTransactionsData';
import { NvIcon } from '../NvIcon';
import { EntityGlyph, LogoTile } from '../EntityIcon';

/*
 * One filter list for every place a filter appears (the column popovers and the Filters drawer): a search box when
 * the list is long, options grouped under headers that select or clear their whole group, a count of what is
 * chosen with Clear, and a scroll area. (UI_UX_DESIGN_REFERENCE.md §18, N10.)
 */

export interface FilterOption {
  id: string;
  label: string;
  /** Secondary text on the right: a count, a country. */
  hint?: string;
  color?: string;
  /** A logo or icon shown before the label (replaces the colour dot). */
  visual?: React.ReactNode;
  /** The header it sits under; options keep the order they are given in, groups in order of first appearance. */
  group?: string;
  /** Indent level under its group, for a sub-category. */
  level?: number;
}

const MAX_SHOWN = 150;

const Check: React.FC<{ on: boolean; partial?: boolean }> = ({ on, partial }) => (
  <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2', on || partial ? 'border-nv-ink bg-nv-ink text-nv-on-ink' : 'border-nv-line')} aria-hidden>
    {on ? <NvIcon name="check" size={12} strokeWidth={2.5} /> : partial ? <span className="h-0.5 w-2.5 rounded bg-nv-on-ink" /> : null}
  </span>
);

/** A preset selection ("Liquid only"): choosing it replaces the selection with these ids. */
export interface QuickFilter { label: string; ids: string[] }

export const FilterList: React.FC<{
  label: string;
  quick?: QuickFilter[];
  options: FilterOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Show the search box from this many options (default 8). */
  searchFrom?: number;
  emptyText?: string;
  maxHeightClass?: string;
}> = ({ label, quick, options, selected, onChange, searchFrom = 8, emptyText = 'Nothing to filter by yet.', maxHeightClass = 'max-h-64' }) => {
  const [search, setSearch] = useState('');
  const chosen = useMemo(() => new Set(selected), [selected]);
  const needle = search.trim().toLowerCase();
  // A long list (hundreds of merchants) shows its first entries until the reader searches.
  const capped = !needle && options.length > MAX_SHOWN;
  const visible = useMemo(() => (needle ? options.filter(o => `${o.label} ${o.group ?? ''}`.toLowerCase().includes(needle)) : options.slice(0, MAX_SHOWN)), [options, needle]);
  const groups = useMemo(() => {
    const map = new Map<string, FilterOption[]>();
    for (const o of visible) {
      const key = o.group ?? '';
      const list = map.get(key);
      if (list) list.push(o); else map.set(key, [o]);
    }
    return [...map.entries()];
  }, [visible]);

  const toggle = (id: string) => onChange(chosen.has(id) ? selected.filter(x => x !== id) : [...selected, id]);
  const toggleGroup = (ids: string[]) => {
    const all = ids.every(id => chosen.has(id));
    onChange(all ? selected.filter(id => !ids.includes(id)) : [...selected, ...ids.filter(id => !chosen.has(id))]);
  };

  if (!options.length) return <p className="py-2 text-[13px] text-nv-muted">{emptyText}</p>;
  return (
    <div>
      {options.length >= searchFrom && (
        <label className="relative mb-2 block">
          <span className="sr-only">Search {label.toLowerCase()}</span>
          <NvIcon name="search" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-nv-muted" />
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${label.toLowerCase()}`} className="h-10 w-full rounded-full bg-nv-inset pl-10 pr-4 text-[14px] text-nv-ink outline-none placeholder:text-nv-muted focus-visible:ring-2 focus-visible:ring-nv-violet" />
        </label>
      )}
      {quick && quick.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Quick filters">
          {quick.map(q => {
            const on = q.ids.length === selected.length && q.ids.every(id => chosen.has(id));
            return (
              <button key={q.label} type="button" aria-pressed={on} onClick={() => onChange(on ? [] : q.ids)} className={cn('h-8 rounded-full border px-3 text-[13px] font-medium', on ? 'border-nv-ink bg-nv-ink text-nv-on-ink' : 'border-nv-line bg-nv-inset text-nv-ink hover:border-nv-muted')}>{q.label}</button>
            );
          })}
        </div>
      )}
      <div className="mb-1 flex min-h-7 items-center justify-between text-[13px]">
        <span className="text-nv-muted nv-tabular" aria-live="polite">{selected.length ? `${selected.length} selected` : `${options.length} ${options.length === 1 ? 'option' : 'options'}`}</span>
        <span className="flex items-center gap-1">
          {selected.length < options.length && <button type="button" onClick={() => onChange(options.map(o => o.id))} className="rounded-md px-1.5 py-0.5 font-medium text-nv-violet-text hover:bg-nv-violet-soft">Select all</button>}
          {selected.length > 0 && <button type="button" onClick={() => onChange([])} className="rounded-md px-1.5 py-0.5 font-medium text-nv-violet-text hover:bg-nv-violet-soft">Clear</button>}
        </span>
      </div>
      <div role="group" aria-label={label} className={cn('-mx-1 overflow-y-auto px-1', maxHeightClass)}>
        {capped && <p className="px-1.5 pb-1 text-[12px] text-nv-muted">Showing the first {MAX_SHOWN} of {options.length}. Search to find the rest.</p>}
        {groups.length === 0 && <p className="py-3 text-center text-[13px] text-nv-muted">No match for “{search}”.</p>}
        {groups.map(([group, items]) => {
          const ids = items.map(o => o.id);
          const count = ids.filter(id => chosen.has(id)).length;
          return (
            <div key={group || 'all'} className="mb-1 last:mb-0">
              {group && (
                <button type="button" role="checkbox" aria-checked={count === ids.length ? true : count ? 'mixed' : false} onClick={() => toggleGroup(ids)} className="flex min-h-9 w-full items-center gap-2.5 rounded-lg px-1.5 text-left text-[12px] font-semibold uppercase tracking-wide text-nv-muted hover:bg-nv-inset">
                  <Check on={count === ids.length} partial={count > 0 && count < ids.length} />
                  <span className="flex-1 truncate">{group}</span>
                  <span className="nv-tabular font-medium normal-case tracking-normal">{count ? `${count}/` : ''}{ids.length}</span>
                </button>
              )}
              {items.map(o => (
                <button key={o.id} type="button" role="checkbox" aria-checked={chosen.has(o.id)} onClick={() => toggle(o.id)} style={{ paddingLeft: 6 + (o.level ?? 0) * 18 }} className="flex min-h-10 w-full items-center gap-2.5 rounded-lg pr-1.5 text-left text-[14px] text-nv-ink hover:bg-nv-inset">
                  <Check on={chosen.has(o.id)} />
                  {o.visual ?? (o.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: o.color }} aria-hidden />)}
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.hint && <span className="nv-tabular shrink-0 text-[13px] text-nv-muted">{o.hint}</span>}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------ option builders */

/** Order of the account-type groups: what you have, then what you owe. */
const ACCOUNT_TYPE_ORDER = ['Checking', 'Savings', 'Investment', 'Property', 'Vehicle', 'Other Assets', 'Lending', 'Credit Card', 'Loan', 'Other Liabilities'];

/** Accounts grouped by type, closed ones last under their own header. */
export const accountFilterOptions = (accounts: Account[], logoFor: (name?: string) => string | null): FilterOption[] => {
  const rank = (type: string) => { const i = ACCOUNT_TYPE_ORDER.indexOf(type); return i === -1 ? ACCOUNT_TYPE_ORDER.length : i; };
  const open = accounts.filter(a => a.status !== 'closed').sort((a, b) => rank(a.type) - rank(b.type));
  const closed = accounts.filter(a => a.status === 'closed');
  return [
    ...open.map(a => ({ id: a.id, label: a.name, group: a.type, visual: <LogoTile url={a.financialInstitution ? logoFor(a.financialInstitution) : null} label={a.name} size={24} fallbackIcon="bank" /> })),
    ...closed.map(a => ({ id: a.id, label: a.name, group: 'Closed', visual: <LogoTile url={a.financialInstitution ? logoFor(a.financialInstitution) : null} label={a.name} size={24} fallbackIcon="bank" /> })),
  ];
};

/** Categories under Expenses and Income, sub-categories indented below their parent. */
export const categoryFilterOptions = (categories: { expense: CategoryOption[]; income: CategoryOption[] }): FilterOption[] => {
  const seen = new Set<string>();
  const build = (list: CategoryOption[], group: string): FilterOption[] =>
    list.filter(c => (seen.has(c.name) ? false : (seen.add(c.name), true))).map(c => ({ id: c.name, label: c.name, color: c.color, group, level: c.parent ? 1 : 0, visual: <EntityGlyph icon={c.icon} label={c.name} color={c.color} size={18} /> }));
  return [...build(categories.expense, 'Expenses'), ...build(categories.income, 'Income')];
};

/** The account presets: everything, liquid only (checking, savings, cards), assets, liabilities, investments. Empty ones are left out. */
export const accountQuickFilters = (accounts: Account[]): QuickFilter[] => {
  const open = accounts.filter(a => a.status !== 'closed');
  const ids = (test: (a: Account) => boolean) => open.filter(test).map(a => a.id);
  const debt = ['Credit Card', 'Loan', 'Other Liabilities'];
  const liquid = ['Checking', 'Savings', 'Credit Card'];
  const presets: QuickFilter[] = [
    { label: 'All accounts', ids: ids(() => true) },
    { label: 'Liquid only', ids: ids(a => liquid.includes(a.type)) },
    { label: 'All assets', ids: ids(a => !debt.includes(a.type)) },
    { label: 'All liabilities', ids: ids(a => debt.includes(a.type)) },
    { label: 'Investments', ids: ids(a => a.type === 'Investment') },
  ];
  return presets.filter(p => p.ids.length > 0);
};

/** Tags with their icon in their colour. */
export const tagFilterOptions = (tags: { id: string; name: string; color: string; icon?: string }[]): FilterOption[] =>
  tags.map(t => ({ id: t.id, label: t.name, visual: <EntityGlyph icon={t.icon} label={t.name} color={t.color} size={18} /> }));

/** Merchants with their logo and how many transactions they have. */
export const merchantFilterOptions = (merchants: { name: string; count: number }[], logoFor: (name?: string) => string | null): FilterOption[] =>
  merchants.map(m => ({ id: m.name, label: m.name, hint: String(m.count), visual: <LogoTile url={logoFor(m.name)} label={m.name} size={24} /> }));
