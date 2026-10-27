import React, { useState } from 'react';
import { Menu } from '@base-ui/react/menu';
import { cn } from '../../../lib/utils';
import type { Currency } from '../../../types';
import type { TxRow } from '../../../utils/transactionsModel';
import { NvIcon, type NvIconName } from '../NvIcon';
import { Badge, Money } from '../ui';
import { EntityGlyph, EntityLabel, hasEntityIcon } from '../EntityIcon';

/* Building blocks for TransactionsNew (UI_UX_DESIGN_REFERENCE.md §5, D11, D12, Q5). */

/**
 * The row's leading circle: the merchant's logo on a white chip when one resolves (D12), else the first letter
 * in the category colour. Transfers show the transfer icon in sky.
 */
export const TxAvatar: React.FC<{ row: TxRow; logoUrl: string | null; color?: string; icon?: string; size?: number; rounded?: 'full' | 'xl' }> = ({ row, logoUrl, color, icon, size = 44, rounded = 'full' }) => {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  const shape = rounded === 'xl' ? 'rounded-2xl' : 'rounded-full';
  if (row.kind === 'transfer') {
    return <span className={cn('flex shrink-0 items-center justify-center bg-nv-sky-soft text-nv-sky-text', shape)} style={style} aria-hidden><NvIcon name="transactions" size={Math.round(size * 0.45)} /></span>;
  }
  if (logoUrl && !failed) {
    return (
      <span className={cn('flex shrink-0 items-center justify-center overflow-hidden bg-white', shape)} style={style} aria-hidden>
        <img src={logoUrl} alt="" loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span className={cn('flex shrink-0 items-center justify-center bg-nv-surface text-base font-semibold', shape)} style={{ ...style, color: color || undefined }} aria-hidden>
      {hasEntityIcon(icon) ? <EntityGlyph icon={icon} label={row.title} color={color} size={Math.round(size * 0.46)} /> : (row.title.trim()[0] || '?').toUpperCase()}
    </span>
  );
};

/** Attention badges (Q5): shown only when something is notable. Each carries an icon (D12). */
export const TxBadges: React.FC<{ row: TxRow; className?: string }> = ({ row, className }) => {
  const badges: React.ReactNode[] = [];
  if (row.kind !== 'transfer' && row.uncategorized && !row.adjustment) badges.push(<Badge key="u" tone="red" icon="alert">Uncategorized</Badge>);
  if (row.kind === 'transfer') badges.push(<Badge key="t" tone="sky" icon="transactions">{row.roundUp ? 'Round-up' : 'Transfer'}</Badge>);
  if (row.split) badges.push(<Badge key="s" icon="split">Split</Badge>);
  if (row.combined) badges.push(<Badge key="c" icon="combine">Combined</Badge>);
  if (row.recurring) badges.push(<Badge key="r" tone="green" icon="repeat">Recurring</Badge>);
  if (row.adjustment) badges.push(<Badge key="a" icon="refresh">Adjustment</Badge>);
  return badges.length ? <span className={cn('flex flex-wrap gap-1.5', className)}>{badges}</span> : null;
};

/** The amount as the row shows it: income green with a plus, expenses ink with a minus, transfers ink. */
export const TxAmount: React.FC<{ row: TxRow; size?: 'md' | 'lg' | 'hero' }> = ({ row, size = 'md' }) => (
  <Money
    amount={row.kind === 'transfer' ? row.amount : row.amount}
    currency={row.currency}
    signed={row.kind === 'income'}
    size={size}
    tone={row.kind === 'income' ? 'income' : 'ink'}
  />
);

/** The round-up folded into a transaction: what was set aside, under the amount. */
export const SpareChip: React.FC<{ row: TxRow; className?: string }> = ({ row, className }) => row.spare ? (
  <span title="Round-up set aside" className={cn('inline-flex items-center gap-1 text-[13px] text-nv-green-text', className)}>
    <NvIcon name="piggy" size={13} aria-hidden />
    <Money amount={row.spare.amount} currency={row.spare.currency} size="md" tone="inherit" className="!text-[13px] !font-medium" />
  </span>
) : null;

export const TransactionRowItem: React.FC<{
  row: TxRow;
  logoUrl: string | null;
  color?: string;
  /** The category's icon. */
  icon?: string;
  /** What sits under the title: the account (and the date, when rows are not grouped by day). */
  subtitle: string;
  selecting: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggle: () => void;
}> = ({ row, logoUrl, color, icon, subtitle, selecting, selected, onOpen, onToggle }) => (
  <li>
    <button
      type="button"
      onClick={selecting ? onToggle : onOpen}
      aria-pressed={selecting ? selected : undefined}
      className={cn('flex min-h-[72px] w-full items-center gap-3 rounded-nv-sub px-2 py-3 text-left transition-colors sm:gap-4 sm:px-3', selected ? 'bg-nv-surface ring-[1.5px] ring-nv-ink' : 'hover:bg-nv-surface')}
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 72px' }}
    >
      {selecting && (
        <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2', selected ? 'border-nv-ink bg-nv-ink text-nv-on-ink' : 'border-nv-line')} aria-hidden>
          {selected && <NvIcon name="check" size={14} strokeWidth={2.5} />}
        </span>
      )}
      <TxAvatar row={row} logoUrl={logoUrl} color={color} icon={icon} size={48} rounded="xl" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold text-nv-ink">{row.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-[13px] text-nv-muted">{subtitle}</span>
          <TxBadges row={row} className="hidden sm:flex" />
        </span>
      </span>
      <span className="flex max-w-[45%] shrink-0 flex-col items-end text-right">
        <TxAmount row={row} size="lg" />
        <SpareChip row={row} />
        <span className="mt-0.5 flex max-w-full text-[13px] text-nv-muted">{row.kind === 'transfer' ? 'Transfer' : row.uncategorized ? 'Uncategorized' : <EntityLabel icon={icon} label={row.category} color={color} size={14} />}</span>
      </span>
    </button>
  </li>
);

export interface PickerOption { value: string; label: string; hint?: string; color?: string; /** A stored icon name (a category's or tag's), shown in the colour. */ icon?: string; /** A logo or icon shown before the label (replaces the dot or glyph). */ visual?: React.ReactNode }

/**
 * A labelled select built on a Base UI menu (no raw <select>): label above, current value in a pill-shaped
 * field, options in a popup.
 */
export const PickerField: React.FC<{
  label: string; value: string; options: PickerOption[]; onChange: (value: string) => void; placeholder?: string; icon?: NvIconName; className?: string;
}> = ({ label, value, options, onChange, placeholder = 'Choose', icon, className }) => {
  const current = options.find(o => o.value === value);
  return (
    <div className={className}>
      <p className="mb-1.5 text-[13px] text-nv-muted">{label}</p>
      <Menu.Root>
        <Menu.Trigger aria-label={`${label}: ${current?.label ?? placeholder}`} className="flex h-12 w-full items-center gap-3 rounded-full bg-nv-inset px-4 text-left text-[15px] text-nv-ink outline-none focus-visible:ring-2 focus-visible:ring-nv-violet">
          {icon && <NvIcon name={icon} size={18} className="text-nv-muted" />}
          {current?.visual ?? (current && (hasEntityIcon(current.icon) ? <EntityGlyph icon={current.icon} label={current.label} color={current.color} size={18} /> : current.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: current.color }} aria-hidden />))}
          <span className={cn('min-w-0 flex-1 truncate', !current && 'text-nv-muted')}>{current?.label ?? placeholder}</span>
          <NvIcon name="arrowDown" size={16} className="text-nv-muted" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner sideOffset={6} align="start" className="pointer-events-auto z-popover">
            <Menu.Popup className="crystal-new max-h-80 min-w-[var(--anchor-width)] overflow-y-auto rounded-nv-tile bg-nv-surface p-1.5 shadow-nv-float">
              <Menu.RadioGroup value={value} onValueChange={v => onChange(String(v))}>
                {options.map(o => (
                  <Menu.RadioItem key={o.value} value={o.value} closeOnClick className="flex min-h-11 cursor-default items-center gap-3 rounded-xl px-3 text-[15px] text-nv-ink outline-none data-[highlighted]:bg-nv-inset">
                    {o.visual ?? (hasEntityIcon(o.icon) ? <EntityGlyph icon={o.icon} label={o.label} color={o.color} size={18} /> : o.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: o.color }} aria-hidden />)}
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {o.hint && <span className="text-[13px] text-nv-muted">{o.hint}</span>}
                    <Menu.RadioItemIndicator><NvIcon name="check" size={16} /></Menu.RadioItemIndicator>
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
};

/** A text field in the New style: label above, inset pill (or rounded box for multi-line). */
export const TextField: React.FC<{
  label: string; value: string; onChange: (value: string) => void; placeholder?: string; multiline?: boolean; type?: string; icon?: NvIconName; className?: string; hideLabel?: boolean;
}> = ({ label, value, onChange, placeholder, multiline, type = 'text', icon, className, hideLabel }) => (
  <label className={cn('block', className)}>
    <span className={cn(hideLabel ? 'sr-only' : 'mb-1.5 block text-[13px] text-nv-muted')}>{label}</span>
    {multiline ? (
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} className="w-full resize-none rounded-nv-tile bg-nv-inset px-4 py-3 text-[15px] text-nv-ink outline-none placeholder:text-nv-muted focus-visible:ring-2 focus-visible:ring-nv-violet" />
    ) : (
      <span className="relative block">
        {icon && <NvIcon name={icon} size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-nv-muted" />}
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cn('h-12 w-full rounded-full bg-nv-inset pr-4 text-[15px] text-nv-ink outline-none placeholder:text-nv-muted focus-visible:ring-2 focus-visible:ring-nv-violet', icon ? 'pl-11' : 'pl-4')} />
      </span>
    )}
  </label>
);

/** The currency sign Crystal shows for a currency code. */
export const currencySign = (currency: Currency) => ({ EUR: '€', USD: '$', GBP: '£', BTC: '₿', RON: 'lei ' } as Record<string, string>)[currency] ?? `${currency} `;
