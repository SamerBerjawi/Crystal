import React from 'react';
import { Menu } from '@base-ui/react/menu';
import { cn } from '../../lib/utils';
import { NvIcon, type NvIconName } from './NvIcon';

/*
 * Tile parts from the third reference (UI_UX_DESIGN_REFERENCE.md §11, R5, R8): the icon chip, the period pill
 * with a caret, filter chips with ×, the footer link and two-tone titles.
 */

/** White 40px icon circle, top-left of a tile (R5). */
export const IconChip: React.FC<{ icon: NvIconName; className?: string }> = ({ icon, className }) => (
  <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-nv-surface text-nv-ink', className)} aria-hidden>
    <NvIcon name={icon} size={20} />
  </span>
);

export interface PeriodOption<T extends string> { value: T; label: string }

/** Period or filter pill with a caret ("Weekly ▾"), opening a small menu (R5, R8). */
export function PeriodPill<T extends string>({ value, options, onChange, label, className }: {
  value: T; options: PeriodOption<T>[]; onChange: (value: T) => void; label: string; className?: string;
}) {
  const current = options.find(o => o.value === value)?.label ?? value;
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`${label}: ${current}`}
        className={cn('inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-nv-line bg-nv-surface px-4 text-sm font-medium text-nv-ink transition-colors hover:bg-nv-inset data-[popup-open]:bg-nv-inset', className)}
      >
        {current}
        <NvIcon name="arrowDown" size={14} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={8} align="end" className="z-popover">
          <Menu.Popup className="crystal-new min-w-40 origin-[var(--transform-origin)] rounded-nv-tile bg-nv-surface p-1.5 shadow-nv-float transition-[transform,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            <Menu.RadioGroup value={value} onValueChange={v => onChange(v as T)}>
              {options.map(o => (
                <Menu.RadioItem
                  key={o.value}
                  value={o.value}
                  closeOnClick
                  className="flex h-11 cursor-default items-center justify-between gap-6 rounded-xl px-3 text-[15px] text-nv-ink outline-none data-[highlighted]:bg-nv-inset"
                >
                  {o.label}
                  <Menu.RadioItemIndicator className="text-nv-ink"><NvIcon name="check" size={16} /></Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/**
 * Tile header (R5): icon chip and optional title on the left, an action (usually a PeriodPill) on the right.
 * Below it a tile shows a small grey label and a large value.
 */
export const TileHeader: React.FC<{ icon?: NvIconName; title?: React.ReactNode; action?: React.ReactNode; className?: string }> = ({ icon, title, action, className }) => (
  <div className={cn('mb-5 flex items-center justify-between gap-3', className)}>
    <div className="flex min-w-0 items-center gap-3">
      {icon && <IconChip icon={icon} />}
      {title && <h2 className="truncate text-lg font-medium text-nv-ink">{title}</h2>}
    </div>
    {action}
  </div>
);

/** The small grey label and large value under a tile header. */
export const TileValue: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
  <div className={className}>
    <p className="text-[13px] text-nv-muted">{label}</p>
    <div className="mt-1">{children}</div>
  </div>
);

/** Filter chip (R8): a pill with a remove ×. Active chips are ink. */
export const FilterChip: React.FC<{ label: string; onRemove?: () => void; active?: boolean; onClick?: () => void }> = ({ label, onRemove, active, onClick }) => (
  <span className={cn('inline-flex h-11 shrink-0 items-center rounded-full border text-sm font-medium', active ? 'border-nv-ink bg-nv-ink text-nv-on-ink' : 'border-nv-line bg-nv-surface text-nv-ink')}>
    <button type="button" onClick={onClick} aria-pressed={onClick ? !!active : undefined} className={cn('h-full rounded-full pl-4', onRemove ? 'pr-1.5' : 'pr-4')}>{label}</button>
    {onRemove && (
      <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="mr-1 flex h-9 w-9 items-center justify-center rounded-full hover:bg-nv-inset/60">
        <NvIcon name="close" size={14} />
      </button>
    )}
  </span>
);

/** Footer link (R5): accent text beside a round accent icon ("View on chart mode"). */
export const FooterLink: React.FC<{ icon: NvIconName; children: React.ReactNode; onClick: () => void; className?: string }> = ({ icon, children, onClick, className }) => (
  <button type="button" onClick={onClick} className={cn('inline-flex min-h-11 items-center gap-2 text-left text-[13px] font-medium leading-tight text-nv-violet-text', className)}>
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-nv-violet text-nv-on-violet"><NvIcon name={icon} size={14} /></span>
    <span>{children}</span>
  </button>
);

/** Two-tone title (R8): the first part ink, the second grey. `stacked` puts them on two lines. */
export const TwoToneTitle: React.FC<{ first: React.ReactNode; second: React.ReactNode; as?: 'h1' | 'h2' | 'p'; stacked?: boolean; className?: string }> = ({
  first, second, as: Tag = 'h1', stacked, className,
}) => (
  <Tag className={cn('font-medium tracking-tight', className)}>
    <span className="text-nv-ink">{first}</span>
    {stacked ? <br /> : ' '}
    <span className="text-nv-muted">{second}</span>
  </Tag>
);
