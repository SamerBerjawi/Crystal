import React, { useMemo, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { cn } from '../../../lib/utils';
import { NvIcon } from '../NvIcon';

/*
 * Building blocks of the add / edit composer (UI_UX_DESIGN_REFERENCE.md N18): a row of chips, each opening a small
 * popover with a searchable pick list, so the whole transaction fits on one screen. Popovers carry
 * `pointer-events-auto`: a sheet makes everything outside itself inert, and these open in the page's top layer.
 */

export interface PickOption {
  id: string;
  label: string;
  hint?: string;
  visual?: React.ReactNode;
  group?: string;
  /** Indent under its group (a sub-category). */
  level?: number;
}

/** A pill that shows one field's value and opens its picker. */
export const PopChip: React.FC<{
  label: string; value?: string; visual?: React.ReactNode; placeholder: string; children: (close: () => void) => React.ReactNode; className?: string; width?: string;
}> = ({ label, value, visual, placeholder, children, className, width = 'w-80' }) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={`${label}: ${value || placeholder}`}
        className={cn('inline-flex h-11 max-w-full items-center gap-2 rounded-full border px-3.5 text-[14px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-nv-violet', value ? 'border-nv-line bg-nv-surface text-nv-ink' : 'border-dashed border-nv-line text-nv-muted hover:text-nv-ink', open && 'border-nv-ink', className)}
      >
        {visual}
        <span className="truncate">{value || placeholder}</span>
        <NvIcon name="arrowDown" size={14} className="shrink-0 text-nv-muted" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="start" collisionPadding={12} className="pointer-events-auto z-popover">
          <Popover.Popup className={cn('crystal-new pointer-events-auto max-w-[calc(100vw-24px)] origin-[var(--transform-origin)] rounded-nv-tile bg-nv-surface p-3 text-nv-ink shadow-nv-float outline-none transition-[transform,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0', width)}>
            {children(() => setOpen(false))}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};

/** A single-choice list: a search box from 8 options, group headers, the current choice ticked. */
export const PickList: React.FC<{
  label: string; options: PickOption[]; value: string; onPick: (id: string) => void; searchFrom?: number; clearLabel?: string;
}> = ({ label, options, value, onPick, searchFrom = 8, clearLabel }) => {
  const [search, setSearch] = useState('');
  const needle = search.trim().toLowerCase();
  const visible = useMemo(() => (needle ? options.filter(o => `${o.label} ${o.group ?? ''}`.toLowerCase().includes(needle)) : options), [options, needle]);
  const groups = useMemo(() => {
    const map = new Map<string, PickOption[]>();
    for (const o of visible) { const k = o.group ?? ''; const l = map.get(k); if (l) l.push(o); else map.set(k, [o]); }
    return [...map.entries()];
  }, [visible]);
  return (
    <div>
      {options.length >= searchFrom && (
        <label className="relative mb-2 block">
          <span className="sr-only">Search {label.toLowerCase()}</span>
          <NvIcon name="search" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-nv-muted" />
          <input autoFocus type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${label.toLowerCase()}`} className="h-10 w-full rounded-full bg-nv-inset pl-10 pr-4 text-[14px] text-nv-ink outline-none placeholder:text-nv-muted focus-visible:ring-2 focus-visible:ring-nv-violet" />
        </label>
      )}
      <div role="listbox" aria-label={label} className="-mx-1 max-h-72 overflow-y-auto px-1">
        {clearLabel && value && <button type="button" onClick={() => onPick('')} className="mb-1 flex min-h-10 w-full items-center rounded-lg px-2 text-left text-[14px] text-nv-muted hover:bg-nv-inset">{clearLabel}</button>}
        {groups.length === 0 && <p className="py-3 text-center text-[13px] text-nv-muted">No match for “{search}”.</p>}
        {groups.map(([group, items]) => (
          <div key={group || 'all'} className="mb-1 last:mb-0">
            {group && <p className="px-2 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-wide text-nv-muted">{group}</p>}
            {items.map(o => (
              <button key={o.id} type="button" role="option" aria-selected={o.id === value} onClick={() => onPick(o.id)} style={{ paddingLeft: 8 + (o.level ?? 0) * 18 }} className={cn('flex min-h-11 w-full items-center gap-2.5 rounded-lg pr-2 text-left text-[14px] hover:bg-nv-inset', o.id === value && 'bg-nv-inset font-medium')}>
                {o.visual}
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {o.hint && <span className="shrink-0 text-[13px] text-nv-muted">{o.hint}</span>}
                {o.id === value && <NvIcon name="check" size={16} className="shrink-0" />}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
