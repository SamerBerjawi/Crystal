import React, { useMemo, useState } from 'react';
import { cn } from '../lib/utils';
import Icon from './ui/Icon';

export interface FilterOption {
  id: string;
  label: string;
  /** Secondary text on the right: a count, last4, etc. */
  hint?: string;
  color?: string;
  /** A logo or icon shown before the label */
  visual?: React.ReactNode;
  /** The group header it sits under */
  group?: string;
  /** Indent level under its group, for a sub-category */
  level?: number;
}

export interface QuickFilter {
  label: string;
  ids: string[];
}

interface FilterListProps {
  label: string;
  quick?: QuickFilter[];
  options: FilterOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  searchFrom?: number;
  emptyText?: string;
  maxHeightClass?: string;
}

const CheckIndicator: React.FC<{ on: boolean; partial?: boolean }> = ({ on, partial }) => (
  <span
    className={cn(
      'flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
      on || partial ? 'border-primary bg-primary text-on-primary' : 'border-line-strong bg-transparent',
    )}
    aria-hidden
  >
    {on ? (
      <Icon name="check" size={12} className="stroke-[2.5]" />
    ) : partial ? (
      <span className="h-0.5 w-2 rounded bg-on-primary" />
    ) : null}
  </span>
);

export const FilterList: React.FC<FilterListProps> = ({
  label,
  quick,
  options,
  selected,
  onChange,
  searchFrom = 6,
  emptyText = 'Nothing to filter by yet.',
  maxHeightClass = 'max-h-72',
}) => {
  const [search, setSearch] = useState('');
  const chosen = useMemo(() => new Set(selected), [selected]);
  const needle = search.trim().toLowerCase();

  const visible = useMemo(() => {
    if (!needle) return options;
    return options.filter(o => `${o.label} ${o.group ?? ''} ${o.hint ?? ''}`.toLowerCase().includes(needle));
  }, [options, needle]);

  const groups = useMemo(() => {
    const map = new Map<string, FilterOption[]>();
    for (const o of visible) {
      const key = o.group ?? '';
      const list = map.get(key);
      if (list) list.push(o);
      else map.set(key, [o]);
    }
    return [...map.entries()];
  }, [visible]);

  const toggle = (id: string) => {
    onChange(chosen.has(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };

  const toggleGroup = (ids: string[]) => {
    const all = ids.every(id => chosen.has(id));
    onChange(all ? selected.filter(id => !ids.includes(id)) : [...selected, ...ids.filter(id => !chosen.has(id))]);
  };

  const clearAll = () => onChange([]);
  const selectAll = () => onChange(options.map(o => o.id));

  return (
    <div className="w-72 max-w-[85vw] space-y-2.5">
      {quick && quick.length > 0 && (
        <div className="space-y-1.5 border-b border-line pb-2.5">
          <div className="flex items-center justify-between px-0.5">
            <span className="type-label text-[.6875rem] uppercase tracking-wider text-muted">Quick filters</span>
            <button
              type="button"
              onClick={selected.length === options.length ? clearAll : selectAll}
              className="type-caption font-semibold text-primary hover:underline"
            >
              {selected.length === options.length ? 'Clear all' : 'Select all'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Quick filters">
            {quick.map(q => {
              const on = q.ids.length > 0 && q.ids.length === selected.length && q.ids.every(id => chosen.has(id));
              return (
                <button
                  key={q.label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange(on ? [] : q.ids)}
                  className={cn(
                    'h-7.5 truncate rounded-lg border px-2 text-center text-xs font-semibold transition-colors',
                    on
                      ? 'border-primary bg-primary-soft text-ink'
                      : 'border-line bg-inset/50 text-ink hover:bg-inset',
                  )}
                >
                  {q.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {options.length >= searchFrom && (
        <div className="relative">
          <Icon name="search" size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}`}
            className="h-8.5 w-full rounded-lg border border-line bg-inset pl-8 pr-2.5 text-xs text-ink outline-none placeholder:text-muted focus:border-primary"
          />
        </div>
      )}

      <div className="flex items-center justify-between px-0.5 text-xs">
        <span className="type-caption text-muted">
          {selected.length ? `${selected.length} of ${options.length} selected` : `${options.length} options`}
        </span>
        {selected.length > 0 && (
          <button type="button" onClick={clearAll} className="type-caption font-semibold text-primary hover:underline">
            Clear
          </button>
        )}
      </div>

      <div className={cn('overflow-y-auto space-y-2 pr-0.5', maxHeightClass)}>
        {visible.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">{emptyText}</p>
        ) : (
          groups.map(([group, items]) => {
            const ids = items.map(o => o.id);
            const count = ids.filter(id => chosen.has(id)).length;
            return (
              <div key={group || 'all'} className="space-y-0.5">
                {group && (
                  <button
                    type="button"
                    aria-checked={count === ids.length ? true : count ? 'mixed' : false}
                    onClick={() => toggleGroup(ids)}
                    className="flex min-h-7 w-full items-center gap-2 rounded-md px-1.5 text-left text-[.6875rem] font-bold uppercase tracking-wider text-muted hover:bg-inset"
                  >
                    <CheckIndicator on={count === ids.length} partial={count > 0 && count < ids.length} />
                    <span className="flex-1 truncate">{group}</span>
                    <span className="font-medium normal-case tracking-normal">
                      {count ? `${count}/` : ''}{ids.length}
                    </span>
                  </button>
                )}
                {items.map(o => (
                  <button
                    key={o.id}
                    type="button"
                    role="checkbox"
                    aria-checked={chosen.has(o.id)}
                    onClick={() => toggle(o.id)}
                    style={{ paddingLeft: 6 + (o.level ?? 0) * 16 }}
                    className={cn(
                      'flex min-h-8.5 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 text-left text-xs text-ink transition-colors',
                      chosen.has(o.id) ? 'bg-primary-soft/50 font-medium' : 'hover:bg-inset',
                    )}
                  >
                    <CheckIndicator on={chosen.has(o.id)} />
                    {o.visual ?? (o.color && (
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: o.color }} aria-hidden />
                    ))}
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {o.hint && <span className="shrink-0 text-[.6875rem] text-muted">{o.hint}</span>}
                  </button>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

