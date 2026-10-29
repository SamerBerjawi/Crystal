import React from 'react';
import { Menu } from '@base-ui/react/menu';
import { cn } from '../../../lib/utils';
import { formatShortDate } from '../../../utils/dateFormat';
import { parseLocalDate } from '../../../utils';
import { netOf, type Occurrence, type OccurrenceSource } from '../../../utils/scheduleModel';
import type { ScheduleData } from '../../../hooks/useScheduleData';
import { EntityGlyph, LogoTile } from '../EntityIcon';
import { NvIcon, type NvIconName } from '../NvIcon';
import { Badge, Money } from '../ui';

/* Parts of ScheduleNew (docs/SCHEDULE_NEW_PLAN.md §4): the payment row, its menu, group headers, badges. */

const DAY_MS = 24 * 60 * 60 * 1000;

/** "today", "tomorrow", "in 3 days", "17 days late". */
export const relativeDay = (date: string, today: Date): string => {
  const days = Math.round((parseLocalDate(date).getTime() - today.getTime()) / DAY_MS);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return '1 day late';
  if (days < 0) return `${-days} days late`;
  return `in ${days} days`;
};

export const SOURCE_BADGE: Record<Exclude<OccurrenceSource, 'recurring'>, { label: string; icon: NvIconName }> = {
  bill: { label: 'Bill', icon: 'invoice' },
  loan: { label: 'Loan', icon: 'bank' },
  card: { label: 'Card', icon: 'card' },
  property: { label: 'Property', icon: 'home' },
};

/** Logo for a merchant, else the category's glyph, else an icon for the kind of payment. */
export const OccurrenceAvatar: React.FC<{ o: Occurrence; data: ScheduleData; size?: number }> = ({ o, data, size = 44 }) => {
  const category = o.category ? data.categoryByName.get(o.category) : undefined;
  const logo = o.merchant ? data.logoFor(o.merchant) : null;
  if (logo) return <LogoTile url={logo} label={o.merchant ?? o.description} size={size} />;
  if (category) {
    return (
      <span className="flex shrink-0 items-center justify-center rounded-xl bg-nv-surface" style={{ width: size, height: size }} aria-hidden>
        <EntityGlyph icon={category.icon} label={category.name} color={category.color} size={Math.round(size * 0.45)} />
      </span>
    );
  }
  const icon: NvIconName = o.source !== 'recurring' ? SOURCE_BADGE[o.source].icon : o.flow === 'in' ? 'money' : o.flow === 'move' ? 'transfer' : 'repeat';
  return (
    <span className="flex shrink-0 items-center justify-center rounded-xl bg-nv-surface text-nv-muted" style={{ width: size, height: size }} aria-hidden>
      <NvIcon name={icon} size={Math.round(size * 0.45)} />
    </span>
  );
};

/** The amount with its sign: money in green, out in ink, moves in sky; skipped ones struck through. */
export const OccurrenceAmount: React.FC<{ o: Occurrence; size?: 'md' | 'lg' | 'xl' | 'hero'; className?: string }> = ({ o, size = 'md', className }) => (
  <Money
    amount={o.flow === 'move' ? o.amount : netOf(o)}
    currency={o.currency}
    signed={o.flow !== 'move'}
    size={size}
    tone={o.flow === 'in' ? 'income' : 'ink'}
    className={cn(o.flow === 'move' && 'text-nv-sky-text', o.status === 'skipped' && 'line-through opacity-60', className)}
  />
);

/** The notable things about a payment (Q5, D12: every badge has an icon). */
export const OccurrenceBadges: React.FC<{ o: Occurrence; className?: string }> = ({ o, className }) => {
  const badges: React.ReactNode[] = [];
  if (o.status === 'skipped') badges.push(<Badge key="skip" icon="undo">Skipped</Badge>);
  if (o.status === 'paid') badges.push(<Badge key="paid" tone="green" icon="checkCircle">Paid</Badge>);
  if (o.isOverride && o.status !== 'skipped') badges.push(<Badge key="chg" icon="edit">Changed</Badge>);
  if (o.source !== 'recurring') badges.push(<Badge key="src" tone="sky" icon={SOURCE_BADGE[o.source].icon}>{SOURCE_BADGE[o.source].label}</Badge>);
  if (o.bill?.warrantId) badges.push(<Badge key="war" tone="violet" icon="investments">Warrant tax</Badge>);
  if (!badges.length) return null;
  return <span className={cn('flex flex-wrap gap-1.5', className)}>{badges}</span>;
};

/** "Main checking", "Checking → Savings". */
export const accountLine = (o: Occurrence, data: ScheduleData): string => {
  const from = data.accountName(o.accountId) || (o.accountId ? '' : 'Any account');
  if (o.type === 'transfer') return `${from || 'Outside'} → ${data.accountName(o.toAccountId) || 'Outside'}`;
  return from;
};

export interface MenuEntry { label: string; icon: NvIconName; onClick: () => void; danger?: boolean }

/** A ⋯ menu (Base UI): arrow keys, Enter, Escape. */
export const RowMenu: React.FC<{ entries: MenuEntry[]; label: string }> = ({ entries, label }) => (
  <Menu.Root>
    <Menu.Trigger
      aria-label={label}
      title={label}
      onClick={e => e.stopPropagation()}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-nv-muted transition-colors hover:bg-nv-surface hover:text-nv-ink data-[popup-open]:bg-nv-surface"
    >
      <NvIcon name="more" size={20} />
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner sideOffset={6} align="end" className="pointer-events-auto z-popover">
        <Menu.Popup className="crystal-new min-w-56 origin-[var(--transform-origin)] rounded-nv-sub bg-nv-surface p-1.5 shadow-nv-float transition-[transform,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
          {entries.map(item => (
            <Menu.Item
              key={item.label}
              onClick={item.onClick}
              className={cn('flex h-11 cursor-default items-center gap-3 rounded-xl px-3 text-[15px] outline-none data-[highlighted]:bg-nv-inset', item.danger ? 'text-nv-red-text' : 'text-nv-ink')}
            >
              <NvIcon name={item.icon} size={18} className={item.danger ? '' : 'text-nv-muted'} />
              {item.label}
            </Menu.Item>
          ))}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
);

/** One payment in a list (§4.2): avatar, name, account · date · how soon, amount, badges and its menu. */
export const OccurrenceRow: React.FC<{
  o: Occurrence;
  data: ScheduleData;
  onOpen: (o: Occurrence) => void;
  menu: MenuEntry[];
  showDate?: boolean;
}> = ({ o, data, onOpen, menu, showDate = true }) => {
  const late = o.status === 'overdue';
  return (
    <li className="flex items-center gap-2 rounded-nv-sub pr-1 hover:bg-nv-surface/70">
      <button
        type="button"
        onClick={() => onOpen(o)}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-nv-sub py-2 pl-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-nv-ink"
      >
        <OccurrenceAvatar o={o} data={data} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-nv-ink">{o.merchant || o.description}</span>
          <span className="block truncate text-[13px] text-nv-muted">
            {accountLine(o, data)}
            {showDate && <> · {formatShortDate(o.date, data.today)}</>}
            {' · '}
            <span className={late ? 'font-medium text-nv-red-text' : undefined}>{relativeDay(o.date, data.today)}</span>
          </span>
          <OccurrenceBadges o={o} className="mt-1.5" />
        </span>
        <span className="shrink-0 text-right"><OccurrenceAmount o={o} /></span>
      </button>
      {menu.length > 0 && <RowMenu entries={menu} label={`Actions for ${o.merchant || o.description}`} />}
    </li>
  );
};

/** A group heading: label, count and the group's net (F2: the overdue delta). */
export const GroupHeader: React.FC<{ label: string; count: number; net: number; currency: ScheduleData['displayCurrency']; tone?: 'red' }> = ({ label, count, net, currency, tone }) => (
  <div className="flex items-center justify-between gap-3 px-2 pb-1 pt-4">
    <h3 className={cn('flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide', tone === 'red' ? 'text-nv-red-text' : 'text-nv-muted')}>
      {tone === 'red' && <NvIcon name="warning" size={15} />}
      {label}
      <span className="nv-tabular font-medium normal-case tracking-normal">· {count}</span>
    </h3>
    <Money amount={net} currency={currency} signed size="md" className="text-[13px] text-nv-muted" />
  </div>
);
