import React from 'react';
import { Menu } from '@base-ui/react/menu';
import { cn } from '../../lib/utils';
import { Drawer } from './Drawer';
import { NvIcon, type NvIconName } from './NvIcon';
import { FilterChip } from './tile';
import { Button, Switch } from './ui';

/*
 * The toolbar every New list page puts in its content, directly above the list it controls (UI_UX_DESIGN_REFERENCE.md
 * §21, N20 to N24). The shell header holds only the title, search, the page's one violet action and the account menu.
 *
 *   [segment tabs]                          (above the list, scrolls sideways on a phone)
 *   [Filters · 3]  ·····  [Sync] [Export]    (one Filters button, the page's tools on the right)
 *   [chip ×] [chip ×] [Clear all]            (only while a filter is active)
 *
 * Every filter, and the sort, lives in one Filters sheet. A tool is a labelled button from 640px and an icon on a
 * phone; more than two tools collapse into a ⋯ menu.
 */

/** The row of controls above a list. Put `FilterButton` first and the tools after a `ToolbarSpacer`. */
export const PageToolbar: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
);

export const ToolbarSpacer: React.FC = () => <span className="flex-1" aria-hidden />;

/** The one Filters button. The ink counter says how many filters are on (search and sort are not counted). */
export const FilterButton: React.FC<{ count?: number; onClick: () => void; label?: string }> = ({ count = 0, onClick, label = 'Filters' }) => (
  <Button icon="filter" onClick={onClick} aria-haspopup="dialog" aria-label={count ? `${label}, ${count} on` : label}>
    {label}
    {count > 0 && <span className="nv-tabular -mr-1 rounded-full bg-nv-ink px-2 text-[11px] font-semibold leading-5 text-nv-on-ink">{count}</span>}
  </Button>
);

/** A page tool: icon and label from 640px, a 44px icon button on a phone. `success` is the green Sync (N7). */
export const ToolButton: React.FC<{
  icon: NvIconName;
  label: string;
  onClick: () => void;
  variant?: 'secondary' | 'success' | 'primary';
  disabled?: boolean;
}> = ({ icon, label, onClick, variant = 'secondary', disabled }) => (
  <Button variant={variant} icon={icon} onClick={onClick} disabled={disabled} aria-label={label} title={label} className="max-sm:w-11 max-sm:px-0">
    <span className="max-sm:sr-only">{label}</span>
  </Button>
);

export interface ToolMenuItem { label: string; icon: NvIconName; onClick: () => void }

/** The ⋯ menu for the tools that do not fit beside Filters. */
export const ToolMenu: React.FC<{ items: ToolMenuItem[]; label?: string }> = ({ items, label = 'More actions' }) => (
  <Menu.Root>
    <Menu.Trigger
      aria-label={label}
      title={label}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-nv-line bg-nv-surface text-nv-ink transition-colors hover:bg-nv-inset data-[popup-open]:bg-nv-inset"
    >
      <NvIcon name="more" size={20} />
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner sideOffset={8} align="end" className="pointer-events-auto z-popover">
        <Menu.Popup className="crystal-new min-w-52 origin-[var(--transform-origin)] rounded-nv-sub bg-nv-surface p-1.5 shadow-nv-float transition-[transform,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
          {items.map(item => (
            <Menu.Item
              key={item.label}
              onClick={item.onClick}
              className="flex h-11 cursor-default items-center gap-3 rounded-xl px-3 text-[15px] text-nv-ink outline-none data-[highlighted]:bg-nv-inset"
            >
              <NvIcon name={item.icon} size={18} className="text-nv-muted" />
              {item.label}
            </Menu.Item>
          ))}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
);

export interface ActiveFilter { key: string; label: string; icon?: NvIconName; onRemove: () => void }

/** The filters that are on, as removable chips: one scrolling line on a phone, wrapping from 1024px. Nothing when none are on. */
export const ActiveFilters: React.FC<{ filters: ActiveFilter[]; onClearAll: () => void; className?: string }> = ({ filters, onClearAll, className }) => {
  if (filters.length === 0) return null;
  return (
    <div role="group" aria-label="Active filters" className={cn('-mx-4 flex items-center gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0', className)}>
      {filters.map(f => <FilterChip key={f.key} label={f.label} icon={f.icon} onRemove={f.onRemove} />)}
      <Button size="sm" variant="ghost" onClick={onClearAll} className="shrink-0">Clear all</Button>
    </div>
  );
};

/** The Filters sheet: sections inside, Reset and "Show N …" in the footer. */
export const FilterSheet: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The footer button, e.g. "Show 12 accounts". */
  resultLabel: string;
  onReset: () => void;
  children: React.ReactNode;
}> = ({ open, onOpenChange, resultLabel, onReset, children }) => (
  <Drawer
    open={open}
    onOpenChange={onOpenChange}
    title="Filters"
    footer={
      <div className="flex gap-3">
        <Button size="lg" onClick={onReset}>Reset</Button>
        <Button variant="primary" size="lg" className="flex-1" onClick={() => onOpenChange(false)}>{resultLabel}</Button>
      </div>
    }
  >
    {children}
  </Drawer>
);

/** A titled block of the Filters sheet; the ink counter shows how many of its options are chosen. */
export const FilterSection: React.FC<{ title: string; count?: number; children: React.ReactNode }> = ({ title, count, children }) => (
  <section className="mb-6">
    <h3 className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-nv-ink">
      {title}
      {!!count && <span className="nv-tabular rounded-full bg-nv-ink px-2 text-xs font-semibold text-nv-on-ink">{count}</span>}
    </h3>
    {children}
  </section>
);

export interface Choice { id: string; label: string; icon?: NvIconName; color?: string }

/** A few options as chips. One choice by default (radio semantics), several with `multiple`. */
export const ChoiceChips: React.FC<{
  label: string;
  options: Choice[];
  selected: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
}> = ({ label, options, selected, onChange, multiple }) => (
  <div role={multiple ? 'group' : 'radiogroup'} aria-label={label} className="flex flex-wrap gap-2">
    {options.map(o => {
      const on = selected.includes(o.id);
      return (
        <button
          key={o.id}
          type="button"
          role={multiple ? undefined : 'radio'}
          aria-checked={multiple ? undefined : on}
          aria-pressed={multiple ? on : undefined}
          onClick={() => onChange(multiple ? (on ? selected.filter(x => x !== o.id) : [...selected, o.id]) : [o.id])}
          className={cn('inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium', on ? 'border-nv-ink bg-nv-ink text-nv-on-ink' : 'border-nv-line bg-nv-inset text-nv-ink')}
        >
          {o.icon && <NvIcon name={o.icon} size={16} />}
          {o.color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: o.color }} aria-hidden />}
          {o.label}
        </button>
      );
    })}
  </div>
);

/** A yes/no filter: an icon, its name and a switch, on an inset panel. */
export const FilterToggle: React.FC<{ icon: NvIconName; label: string; checked: boolean; onChange: (checked: boolean) => void }> = ({ icon, label, checked, onChange }) => (
  <div className="flex min-h-11 items-center justify-between gap-3 rounded-nv-sub bg-nv-inset pl-4 pr-1">
    <span className="flex items-center gap-3 text-[15px] text-nv-ink">
      <NvIcon name={icon} size={18} className="text-nv-muted" />
      {label}
    </span>
    <Switch checked={checked} onChange={onChange} label={label} />
  </div>
);
