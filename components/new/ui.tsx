import React, { useId, useRef } from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { formatCurrency } from '../../utils';
import type { Currency } from '../../types';
import { NvIcon, type NvIconName } from './NvIcon';
import { SmoothTab } from '../kokonutui/smooth-tab';

/* Primitives for the New pages (UI_UX_DESIGN_REFERENCE.md §1–§3). Nothing here may import classic UI. */

/**
 * A tile (R2): grey on the white page, no shadow or outline, 28px corners. `top` makes it a split tile: a
 * white sub-card above the grey part (R2). `tone="surface"` is a white card for use inside a tile or sheet.
 */
export const Card: React.FC<Omit<React.HTMLAttributes<HTMLElement>, 'title'> & {
  as?: 'section' | 'div' | 'article'; tone?: 'tile' | 'surface' | 'peach' | 'inset'; top?: React.ReactNode;
}> = ({ as: Tag = 'section', tone = 'tile', top, className, children, ...rest }) => (
  <Tag
    className={cn(
      'rounded-nv-card',
      top ? 'p-1.5' : 'p-5 sm:p-6',
      tone === 'tile' && 'bg-nv-tile',
      tone === 'surface' && 'bg-nv-surface',
      tone === 'peach' && 'bg-nv-peach',
      tone === 'inset' && 'bg-nv-inset',
      className,
    )}
    {...rest}
  >
    {top ? (
      <>
        <div className="rounded-nv-sub bg-nv-surface p-5">{top}</div>
        <div className="px-4 pb-4 pt-4 sm:px-5">{children}</div>
      </>
    ) : children}
  </Tag>
);

export const CardTitle: React.FC<{ children: React.ReactNode; action?: React.ReactNode; className?: string }> = ({ children, action, className }) => (
  <div className={cn('mb-4 flex items-center justify-between gap-3', className)}>
    <h2 className="text-lg font-medium text-nv-ink">{children}</h2>
    {action}
  </div>
);

/**
 * R7: `primary` is ink (everyday primary and selected); `cta` is violet, for the single hero call to action
 * on a screen; `secondary` is the light pill beside them.
 */
type ButtonVariant = 'primary' | 'cta' | 'success' | 'secondary' | 'ghost' | 'danger';

const buttonClass = (variant: ButtonVariant, size: 'sm' | 'md' | 'lg') => cn(
  'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[background-color,color,box-shadow,transform] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
  size === 'sm' && 'h-9 px-4 text-sm',
  size === 'md' && 'h-11 px-5 text-[15px]',
  size === 'lg' && 'h-14 px-6 text-base',
  variant === 'primary' && 'bg-nv-ink text-nv-on-ink hover:opacity-90',
  variant === 'cta' && 'bg-nv-violet text-nv-on-violet shadow-nv-violet hover:bg-nv-violet-strong',
  variant === 'success' && 'bg-nv-green text-nv-on-green hover:brightness-95',
  variant === 'secondary' && 'border border-nv-line bg-nv-surface text-nv-ink hover:bg-nv-inset',
  variant === 'ghost' && 'text-nv-ink hover:bg-nv-inset',
  variant === 'danger' && 'bg-nv-red text-white hover:brightness-95',
);

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant; size?: 'sm' | 'md' | 'lg'; icon?: NvIconName;
}>(({ variant = 'secondary', size = 'md', icon, className, children, type = 'button', ...rest }, ref) => (
  <button ref={ref} type={type} className={cn(buttonClass(variant, size), className)} {...rest}>
    {icon && <NvIcon name={icon} size={size === 'sm' ? 16 : 18} />}
    {children}
  </button>
));
Button.displayName = 'Button';

/** Round icon-only button. `label` is required: it becomes the accessible name and the tooltip. */
export const IconButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: NvIconName; label: string; tone?: 'plain' | 'outline' | 'chip' | 'ink' | 'violet'; size?: number; badge?: boolean;
}>(({ icon, label, tone = 'outline', size = 44, badge, className, type = 'button', ...rest }, ref) => (
  <button
    ref={ref}
    type={type}
    aria-label={label}
    title={label}
    style={{ width: size, height: size }}
    className={cn(
      'relative inline-flex shrink-0 items-center justify-center rounded-full transition-colors active:scale-[0.97]',
      tone === 'plain' && 'text-nv-ink hover:bg-nv-inset',
      tone === 'outline' && 'border border-nv-line bg-transparent text-nv-ink hover:bg-nv-surface',
      tone === 'chip' && 'bg-nv-surface text-nv-ink hover:bg-nv-inset',
      tone === 'ink' && 'bg-nv-ink text-nv-on-ink hover:opacity-90',
      tone === 'violet' && 'bg-nv-violet text-nv-on-violet shadow-nv-violet hover:bg-nv-violet-strong',
      className,
    )}
    {...rest}
  >
    <NvIcon name={icon} size={Math.round(size * 0.45)} />
    {badge && <span className="absolute right-[22%] top-[22%] h-2 w-2 rounded-full bg-nv-violet ring-2 ring-nv-tile" aria-hidden />}
  </button>
));
IconButton.displayName = 'IconButton';

/** The four accents (D1). Red is status only and is not an accent. */
export type Accent = 'violet' | 'green' | 'orange' | 'sky';

/**
 * Class sets per accent (R9): accents live on icons, badges, charts and text only, never on tile or pill
 * surfaces. `icon` is the soft circle behind an icon; `text` is for small text and icons.
 */
export const ACCENT: Record<Accent, { icon: string; text: string }> = {
  violet: { icon: 'bg-nv-violet-soft text-nv-violet-text', text: 'text-nv-violet-text' },
  green: { icon: 'bg-nv-green-soft text-nv-green-text', text: 'text-nv-green-text' },
  orange: { icon: 'bg-nv-orange-soft text-nv-orange-text', text: 'text-nv-orange-text' },
  sky: { icon: 'bg-nv-sky-soft text-nv-sky-text', text: 'text-nv-sky-text' },
};

/** A tab. `icon` helps recognition; with `accent` the icon takes that accent while the tab is not selected (R9). */
export interface TabItem<T extends string> { id: T; label: string; accent?: Accent; icon?: NvIconName }

/**
 * Segmented tabs (§3.2), drawn by the Smooth Tab (kokonutui): an ink pill that slides under the labels on a grey track. Arrow keys move between tabs. Used for page tabs in
 * the top bar (decision Q7) and for period switches inside cards.
 */
export function SegmentedTabs<T extends string>({ items, value, onChange, label, size = 'md', className }: {
  items: TabItem<T>[]; value: T; onChange: (id: T) => void; label: string; size?: 'sm' | 'md'; className?: string;
}) {
  return (
    <SmoothTab<T>
      label={label}
      size={size}
      value={value}
      onChange={onChange}
      fill={/\bw-full\b/.test(className ?? '')}
      className={className?.replace('[&>button]:flex-1', '')}
      items={items.map(item => ({ id: item.id, label: item.label, icon: item.icon, iconClass: item.accent ? ACCENT[item.accent].text : undefined }))}
    />
  );
}

/**
 * Money (§1.2 rule 1, R6): the currency symbol in violet, the whole part dark and bold, decimals faint.
 * Tabular figures, and `privacy-blur` so privacy mode hides it. On a filled tile (`tone="inherit"`) the symbol
 * and decimals fade instead of taking colour.
 */
export const Money: React.FC<{
  amount: number; currency: Currency; size?: 'hero' | 'xl' | 'lg' | 'md'; signed?: boolean; compact?: boolean;
  tone?: 'ink' | 'income' | 'expense' | 'inherit'; className?: string;
}> = ({ amount, currency, size = 'md', signed, compact, tone = 'ink', className }) => {
  const text = formatCurrency(amount, currency, { showPlusSign: signed, compact });
  // "-€1,234.50" → sign "-", symbol "€", digits "1,234", fraction ".50". BTC ("0.5 BTC") keeps its suffix as is.
  const match = currency === 'BTC' ? null : text.match(/^([+-]?)([^\d]*)(\d[\d,]*)(\.\d+)?(.*)$/);
  const [, sign = '', symbol = '', digits = text, fraction = '', rest = ''] = match ?? [];
  const faint = tone === 'inherit' ? 'opacity-60' : 'text-nv-faint';
  return (
    <span
      className={cn(
        'nv-tabular privacy-blur whitespace-nowrap tracking-tight',
        size === 'hero' && 'text-[44px] font-semibold leading-none sm:text-5xl',
        size === 'xl' && 'text-3xl font-semibold leading-tight',
        size === 'lg' && 'text-xl font-semibold',
        size === 'md' && 'text-[15px] font-medium',
        tone === 'inherit' ? '' : 'text-nv-ink',
        className,
      )}
    >
      {sign}
      {symbol && (
        <span
          className={
            tone === 'inherit'
              ? 'opacity-80'
              : tone === 'expense'
              ? 'text-nv-red-text'
              : tone === 'income'
              ? 'text-nv-green-text'
              : 'text-nv-violet-text'
          }
        >
          {symbol.trim()}
        </span>
      )}
      {digits}
      {fraction && <span className={faint}>{fraction}</span>}
      {rest}
    </span>
  );
};

/**
 * Outline status pill (§1.1): tinted text and border, no fill. Shown only when something is notable (Q5).
 * Every status chip carries an icon (D12): status is never colour alone.
 */
export const Badge: React.FC<{ tone?: Accent | 'red' | 'neutral'; icon?: NvIconName; children: React.ReactNode; className?: string }> = ({
  tone = 'neutral', icon, children, className,
}) => (
  <span
    className={cn(
      'inline-flex h-6 items-center gap-1 rounded-full border px-2.5 text-xs font-medium',
      tone === 'violet' && 'border-nv-violet/40 text-nv-violet-text',
      tone === 'green' && 'border-nv-green/50 text-nv-green-text',
      tone === 'orange' && 'border-nv-orange/60 text-nv-orange-text',
      tone === 'sky' && 'border-nv-sky/60 text-nv-sky-text',
      tone === 'red' && 'border-nv-red/50 text-nv-red-text',
      tone === 'neutral' && 'border-nv-line text-nv-muted',
      className,
    )}
  >
    {icon && <NvIcon name={icon} size={14} />}
    {children}
  </span>
);

/**
 * Stat tile (D9, R9): the page's opening triplet. A grey tile like every other; the accent is only the soft
 * circle behind the icon. Compact row: icon beside number and label.
 */
export const StatTile: React.FC<{ accent: Accent; icon: NvIconName; label: string; value: React.ReactNode; detail?: React.ReactNode; className?: string }> = ({
  accent, icon, label, value, detail, className,
}) => (
  <div className={cn('flex items-center gap-4 rounded-nv-card bg-nv-tile p-5', className)}>
    <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', ACCENT[accent].icon)}>
      <NvIcon name={icon} size={22} />
    </span>
    <div className="min-w-0">
      <div className="nv-tabular truncate text-2xl font-semibold leading-tight tracking-tight">{value}</div>
      <p className="truncate text-[13px] text-nv-muted">
        {label}{detail && <span> · {detail}</span>}
      </p>
    </div>
  </div>
);

/** On/off switch: green when on (D2). 44px target. */
export const Switch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }> = ({ checked, onChange, label, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className="inline-flex h-11 w-14 shrink-0 items-center justify-center disabled:opacity-50"
  >
    <span className={cn('relative block h-7 w-12 rounded-full transition-colors', checked ? 'bg-nv-green' : 'bg-nv-line')}>
      <span className={cn('absolute left-0 top-0.5 h-6 w-6 rounded-full bg-white shadow-nv-thumb transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </span>
  </button>
);

/** "Show all N" / "Show fewer" for capped lists (D11): a real button with aria-expanded, 44px tall. */
export const MoreButton: React.FC<{ expanded: boolean; total: number; onToggle: () => void; controls?: string; className?: string }> = ({ expanded, total, onToggle, controls, className }) => (
  <button
    type="button"
    aria-expanded={expanded}
    aria-controls={controls}
    onClick={onToggle}
    className={cn('inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-nv-violet-text hover:bg-nv-violet-soft', className)}
  >
    {expanded ? 'Show fewer' : `Show all ${total}`}
    <NvIcon name="arrowDown" size={16} className={cn('transition-transform', expanded && 'rotate-180')} />
  </button>
);

/** Progress with the percentage inside the fill and diagonal stripes (§2.2). */
export const ProgressBar: React.FC<{ value: number; tone?: 'violet' | 'green' | 'orange' | 'red'; label: string; showValue?: boolean; className?: string }> = ({
  value, tone = 'violet', label, showValue = true, className,
}) => {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className={cn('h-10 w-full overflow-hidden rounded-xl bg-nv-inset', className)}>
      <div
        className={cn(
          'nv-stripes flex h-full min-w-[3rem] items-center rounded-xl px-3 text-sm font-semibold text-white transition-[width] duration-700',
          tone === 'violet' && 'bg-nv-violet',
          tone === 'green' && 'bg-nv-green',
          tone === 'orange' && 'bg-nv-orange',
          tone === 'red' && 'bg-nv-red',
        )}
        style={{ width: `${pct}%` }}
      >
        {showValue && <span className="nv-tabular">{pct}%</span>}
      </div>
    </div>
  );
};

/** Empty or placeholder state inside a card. */
export const EmptyState: React.FC<{ icon: NvIconName; title: string; body?: React.ReactNode; action?: React.ReactNode }> = ({ icon, title, body, action }) => (
  <div className="flex flex-col items-center px-4 py-10 text-center">
    <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-nv-violet-soft text-nv-violet-text">
      <NvIcon name={icon} size={26} />
    </span>
    <h3 className="text-lg font-medium text-nv-ink">{title}</h3>
    {body && <p className="mt-1 max-w-sm text-sm text-nv-muted">{body}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);
