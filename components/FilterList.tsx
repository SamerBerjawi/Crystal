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
  title?: string;
  label: string;
  quick?: QuickFilter[];
  options: FilterOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  searchFrom?: number;
  emptyText?: string;
  maxHeightClass?: string;
  searchPlaceholder?: string;
  headerContent?: React.ReactNode;
  maxInitialShown?: number;
}

const CheckIndicator: React.FC<{ on: boolean; partial?: boolean }> = ({ on, partial }) => (
  <span
    className={cn(
      'flex size-5 shrink-0 items-center justify-center rounded-[6px] border transition-colors',
      on || partial
        ? 'border-primary bg-primary text-on-primary'
        : 'border-black/10 bg-black/[0.03] dark:border-white/12 dark:bg-white/[0.04]',
    )}
    aria-hidden
  >
    {on ? (
      <Icon name="check" size={13} className="stroke-[2.5]" />
    ) : partial ? (
      <span className="h-0.5 w-2.5 rounded bg-on-primary" />
    ) : null}
  </span>
);

export const FilterList: React.FC<FilterListProps> = ({
  title,
  label,
  quick,
  options,
  selected,
  onChange,
  searchFrom = 0,
  emptyText = 'Nothing to filter by yet.',
  maxHeightClass = 'max-h-72',
  searchPlaceholder,
  headerContent,
  maxInitialShown = 150,
}) => {
  const [search, setSearch] = useState('');
  const chosen = useMemo(() => new Set(selected), [selected]);
  const needle = search.trim().toLowerCase();

  const isCapped = !needle && options.length > maxInitialShown;

  const visible = useMemo(() => {
    if (needle) {
      return options.filter(o => `${o.label} ${o.group ?? ''} ${o.hint ?? ''}`.toLowerCase().includes(needle));
    }
    return options.slice(0, maxInitialShown);
  }, [options, needle, maxInitialShown]);

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
    <div className="w-80 max-w-[88vw] space-y-3">
      {title && <h3 className="type-card-title text-base font-bold text-ink">{title}</h3>}

      {headerContent}

      {options.length >= searchFrom && (
        <div className="relative">
          <Icon name="search" size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={searchPlaceholder ?? `Search ${label.toLowerCase()}`}
            className="h-11 w-full rounded-full border border-line bg-inset pl-10 pr-4 text-sm text-ink outline-none placeholder:text-muted focus:border-primary"
          />
        </div>
      )}

      {quick && quick.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick filters">
          {quick.map(q => {
            const on = q.ids.length > 0 && q.ids.length === selected.length && q.ids.every(id => chosen.has(id));
            return (
              <button
                key={q.label}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(on ? [] : q.ids)}
                className={cn(
                  'h-8 truncate rounded-full border px-3 text-xs font-medium transition-colors',
                  on
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-line bg-inset text-ink hover:border-muted',
                )}
              >
                {q.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted tabular-nums">
          {selected.length ? `${selected.length} selected` : `${options.length} options`}
        </span>
        <button
          type="button"
          onClick={selected.length === options.length ? clearAll : selectAll}
          className="font-semibold text-primary hover:underline"
        >
          {selected.length === options.length ? 'Clear all' : 'Select all'}
        </button>
      </div>

      {isCapped && (
        <p className="text-xs text-muted/80">
          Showing the first {maxInitialShown} of {options.length}. Search to find the rest.
        </p>
      )}

      <div className={cn('overflow-y-auto space-y-1 pr-1 scroll-touch', maxHeightClass)}>
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
                    className="flex min-h-8 w-full cursor-pointer items-center gap-2.5 rounded-lg px-1.5 text-left text-xs font-semibold uppercase tracking-wider text-muted hover:bg-inset/70"
                  >
                    <CheckIndicator on={count === ids.length} partial={count > 0 && count < ids.length} />
                    <span className="flex-1 truncate">{group}</span>
                    <span className="tabular-nums font-medium normal-case tracking-normal text-muted">
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
                    style={{ paddingLeft: 6 + (o.level ?? 0) * 20 }}
                    className={cn(
                      'flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 text-left text-sm text-ink transition-colors',
                      chosen.has(o.id) ? 'bg-primary-soft/50 font-medium' : 'hover:bg-inset/60',
                    )}
                  >
                    <CheckIndicator on={chosen.has(o.id)} />
                    {o.visual ?? (o.color && (
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: o.color }} aria-hidden />
                    ))}
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {o.hint && <span className="shrink-0 text-xs text-muted tabular-nums">{o.hint}</span>}
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
