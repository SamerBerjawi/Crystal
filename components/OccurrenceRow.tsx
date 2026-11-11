import React from 'react';
import { parseLocalDate } from '../utils';
import type { Occurrence } from '../utils/scheduleModel';
import { cn } from '../lib/utils';
import { Button, IconButton } from './ui/Actions';
import { Badge } from './ui/Display';
import { Menu, type MenuAction } from './ui/Menu';
import { Amount } from './ui/Money';
import { MerchantLogo } from './EntityIcon';

export const SOURCE_LABEL = { recurring: 'Recurring', bill: 'One-time', loan: 'Loan', card: 'Card', property: 'Property' };

const shortDay = (date: string) => {
  const day = parseLocalDate(date);
  return day.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(day.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }) });
};

export interface OccurrenceActions {
  onPost: (o: Occurrence) => void;
  onEdit: (o: Occurrence) => void;
  onSkip: (o: Occurrence, skip: boolean) => void;
  onEndSeries: (o: Occurrence) => void;
  onExpire: (o: Occurrence) => void;
  onDelete: (o: Occurrence) => void;
}

interface OccurrenceRowProps extends OccurrenceActions {
  occurrence: Occurrence;
  accountName: (id?: string) => string | undefined;
  showDate?: boolean;
  /** Two lines, for the narrow day panel. */
  isCompact?: boolean;
}

/** One payment or deposit: Post it, or open the menu for the rest (SCH-05, SCH-10 to SCH-13). */
const OccurrenceRow: React.FC<OccurrenceRowProps> = ({ occurrence: o, accountName, showDate, isCompact, onPost, onEdit, onSkip, onEndSeries, onExpire, onDelete }) => {
  const isSkipped = o.status === 'skipped';
  const isOverdue = o.status === 'overdue';
  const signed = o.flow === 'in' ? o.amount : o.flow === 'out' ? -o.amount : o.amount;
  const account = o.flow === 'move' ? `${accountName(o.accountId) ?? 'External'} to ${accountName(o.toAccountId) ?? 'External'}` : accountName(o.accountId);
  const name = o.merchant || o.description;

  const actions: MenuAction[] = o.isReadOnly ? [] : [
    { id: 'edit', label: 'Edit', icon: 'pencil-edit-02', onAction: () => onEdit(o) },
    ...(isOverdue ? [
      { id: 'expire', label: 'Mark as expired', icon: 'calendar-03', onAction: () => onExpire(o) },
      ...(o.source === 'recurring' ? [
        { id: 'end', label: 'End the series here', icon: 'cancel-circle', onAction: () => onEndSeries(o) },
      ] : []),
    ] : o.source === 'recurring' ? [
      { id: 'skip', label: isSkipped ? 'Include this one' : 'Skip this one', icon: 'refresh', onAction: () => onSkip(o, !isSkipped) },
      { id: 'end', label: 'End the series here', icon: 'cancel-circle', onAction: () => onEndSeries(o) },
    ] : [
      { id: 'expire', label: 'Mark as expired', icon: 'calendar-03', onAction: () => onExpire(o) },
    ]),
    { id: 'delete', label: o.source === 'recurring' ? 'Delete the series' : 'Delete', icon: 'delete-02', isDestructive: true, startsGroup: true, onAction: () => onDelete(o) },
  ];

  const figure = <span className="type-figure-row shrink-0 text-ink"><Amount value={signed} currency={o.currency} tone={o.flow === 'in' ? 'flow' : 'plain'} /></span>;
  const post = !isSkipped && !o.isReadOnly && <Button variant="secondary" size="sm" className="shrink-0" onPress={() => onPost(o)}>Post</Button>;
  const more = actions.length > 0 && <Menu title={o.description} trigger={<IconButton icon="more-horizontal" label={`Actions for ${o.description}`} tooltipPlacement="left" />} items={actions} />;

  if (isCompact) {
    return (
      <li className="py-2.5">
        <div className="flex items-center gap-2.5">
          <MerchantLogo name={name} size={28} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className={cn('flex items-baseline justify-between gap-2', isSkipped && 'opacity-60')}>
              <span className={cn('type-body-strong truncate text-ink flex items-center gap-1.5', isSkipped && 'line-through')}>
                {name}
                {isOverdue && <Badge tone="attention" icon="alert-02" className="h-5 px-1.5 text-[11px] font-bold bg-amber/25 text-attention-text border border-amber/40">Overdue</Badge>}
              </span>
              {figure}
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-2">
              <span className="type-caption truncate text-muted">{[showDate ? shortDay(o.date) : '', SOURCE_LABEL[o.source], account].filter(Boolean).join(', ')}</span>
              <span className="flex shrink-0 items-center gap-1">{post}{more}</span>
            </div>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="flex min-h-14 items-center gap-3 py-2 transition-colors hover:bg-inset/30 -mx-2 px-2 rounded-[var(--radius-md)]">
      <MerchantLogo name={name} size={36} className="shrink-0" />
      <div className={cn('min-w-0 flex-1', isSkipped && 'opacity-60')}>
        <p className="flex flex-wrap items-center gap-2">
          <span className={cn('type-body-strong truncate text-ink', isSkipped && 'line-through')}>{name}</span>
          {isOverdue && <Badge tone="attention" icon="alert-02" className="bg-amber/25 text-attention-text border border-amber/40 font-bold">Overdue</Badge>}
          {isSkipped && <Badge tone="neutral">Skipped</Badge>}
          {o.isOverride && !isSkipped && <Badge tone="neutral">Changed</Badge>}
          {o.flow === 'in' && <Badge tone="positive">Income</Badge>}
        </p>
        <p className="type-caption mt-0.5 flex flex-wrap items-center gap-1.5 text-muted">
          {showDate && <span className="font-medium text-ink">{shortDay(o.date)}</span>}
          {showDate && <span>·</span>}
          <span>{SOURCE_LABEL[o.source]}</span>
          {account && (
            <>
              <span>·</span>
              <span className="truncate">{account}</span>
            </>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {figure}
        {post}
        {more}
      </div>
    </li>
  );
};

export default OccurrenceRow;
