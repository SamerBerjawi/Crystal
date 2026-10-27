import React, { forwardRef, useId, useState } from 'react';
import { cn } from '../../lib/utils';
import { NvIcon, type NvIconName } from './NvIcon';
import type { PageSearchConfig } from './shellContext';

/*
 * The header search (UI_UX_DESIGN_REFERENCE.md §13 N2). On a page that registers a search (usePageSearch) the
 * field filters that page: transactions on Transactions, accounts on Accounts. Elsewhere (the dashboard,
 * placeholders) it finds pages: type, then pick one with the arrow keys and Enter, or click it.
 */

export interface PageTarget { id: string; label: string; icon: NvIconName; group: string }

export const HeaderSearch = forwardRef<HTMLInputElement, {
  config: PageSearchConfig | null;
  pages: PageTarget[];
  onPickPage: (id: string) => void;
  className?: string;
}>(({ config, pages, onPickPage, className }, ref) => {
  const [pageQuery, setPageQuery] = useState('');
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const listId = useId();

  const value = config ? config.value : pageQuery;
  // Typing means the field has focus, even when a focus event was missed (it can be, right after the field mounts).
  const setValue = (v: string) => { if (config) config.onChange(v); else { setPageQuery(v); setActive(0); setFocused(true); } };
  const q = pageQuery.trim().toLowerCase();
  const matches = !config && q ? pages.filter(p => p.label.toLowerCase().includes(q) || p.group.toLowerCase().includes(q)).slice(0, 8) : [];
  const showList = !config && focused && q.length > 0;

  const pick = (id: string) => { onPickPage(id); setPageQuery(''); setActive(0); };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setValue(''); (e.target as HTMLInputElement).blur(); return; }
    if (config) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, Math.max(matches.length - 1, 0))); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && matches[active]) { e.preventDefault(); pick(matches[active].id); }
  };

  return (
    <div className={cn('relative', className)}>
      <NvIcon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-nv-muted" />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        placeholder={config?.placeholder ?? 'Search pages'}
        aria-label={config?.placeholder ?? 'Search pages'}
        role={config ? undefined : 'combobox'}
        aria-expanded={config ? undefined : showList}
        aria-controls={config ? undefined : listId}
        aria-activedescendant={showList && matches[active] ? `${listId}-${matches[active].id}` : undefined}
        aria-autocomplete={config ? undefined : 'list'}
        className="h-11 w-full rounded-full border border-nv-line bg-nv-surface pl-11 pr-10 text-[15px] text-nv-ink outline-none placeholder:text-nv-muted focus-visible:ring-2 focus-visible:ring-nv-violet [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" aria-label="Clear search" onMouseDown={e => e.preventDefault()} onClick={() => setValue('')} className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-nv-muted hover:text-nv-ink">
          <NvIcon name="close" size={16} />
        </button>
      )}
      {showList && (
        <ul id={listId} role="listbox" aria-label="Pages" className="crystal-new absolute inset-x-0 top-full z-popover mt-2 rounded-nv-tile bg-nv-surface p-1.5 shadow-nv-float">
          {matches.length === 0 && <li className="px-3 py-3 text-sm text-nv-muted">No page matches “{pageQuery.trim()}”.</li>}
          {matches.map((p, i) => (
            <li
              key={p.id}
              id={`${listId}-${p.id}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={e => { e.preventDefault(); pick(p.id); }}
              onMouseEnter={() => setActive(i)}
              className={cn('flex h-11 cursor-default items-center gap-3 rounded-xl px-3 text-[15px] text-nv-ink', i === active && 'bg-nv-inset')}
            >
              <NvIcon name={p.icon} size={18} className="text-nv-muted" />
              <span className="min-w-0 flex-1 truncate">{p.label}</span>
              <span className="text-[13px] text-nv-muted">{p.group}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
HeaderSearch.displayName = 'HeaderSearch';
