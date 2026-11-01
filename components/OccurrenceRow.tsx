import React from 'react';
import { parseLocalDate } from '../utils';
import type { Occurrence } from '../utils/scheduleModel';
import { cn } from '../lib/utils';
import { Button, IconButton } from './ui/Actions';
import { Badge } from './ui/Display';
import { Menu, type MenuAction } from './ui/Menu';
import { Amount } from './ui/Money';

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
  const signed = o.flow === 'in' ? o.amount : o.flow === 'out' ? -o.amount : o.amount;
  const account = o.flow === 'move' ? `${accountName(o.accountId) ?? 'External'} to ${accountName(o.toAccountId) ?? 'External'}` : accountName(o.accountId);

  const actions: MenuAction[] = o.isReadOnly ? [] : [
    { id: 'edit', label: 'Edit', icon: 'edit', onAction: () => onEdit(o) },
    ...(o.source === 'recurring' ? [
      { id: 'skip', label: isSkipped ? 'Include this one' : 'Skip this one', icon: 'skip_next', onAction: () => onSkip(o, !isSkipped) },
      { id: 'end', label: 'End the series here', icon: 'event_busy', onAction: () => onEndSeries(o) },
    ] : [
      { id: 'expire', label: 'Mark as expired', icon: 'event_busy', onAction: () => onExpire(o) },
    ]),
    { id: 'delete', label: o.source === 'recurring' ? 'Delete the series' : 'Delete', icon: 'delete', isDestructive: true, startsGroup: true, onAction: () => onDelete(o) },
  ];

  const figure = <span className="type-figure-row shrink-0 text-ink"><Amount value={signed} currency={o.currency} tone={o.flow === 'in' ? 'flow' : 'plain'} /></span>;
  const post = !isSkipped && !o.isReadOnly && <Button variant="secondary" size="sm" className="shrink-0" onPress={() => onPost(o)}>Post</Button>;
  const more = actions.length > 0 && <Menu title={o.description} trigger={<IconButton icon="more_horiz" label={`Actions for ${o.description}`} tooltipPlacement="left" />} items={actions} />;

  if (isCompact) {
    return (
      <li className="py-2">
        <div className={cn('flex items-baseline justify-between gap-3', isSkipped && 'opacity-60')}>
          <span className={cn('type-body-strong min-w-0 truncate text-ink', isSkipped && 'line-through')}>{o.merchant || o.description}</span>
          {figure}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="type-caption min-w-0 truncate text-muted">{[showDate ? shortDay(o.date) : '', SOURCE_LABEL[o.source], account].filter(Boolean).join(', ')}</span>
          <span className="flex shrink-0 items-center gap-1">{post}{more}</span>
        </div>
      </li>
    );
  }

  return (
    <li className="flex min-h-14 items-center gap-2 py-1.5">
      <div className={cn('min-w-0 flex-1', isSkipped && 'opacity-60')}>
        <p className="flex min-w-0 items-center gap-2">
          <span className={cn('type-body-strong truncate text-ink', isSkipped && 'line-through')}>{o.merchant || o.description}</span>
          {o.status === 'overdue' && <Badge tone="attention">Overdue</Badge>}
          {o.isOverride && !isSkipped && <Badge tone="neutral">Changed</Badge>}
        </p>
        <p className="type-caption truncate text-muted">{[showDate ? shortDay(o.date) : '', SOURCE_LABEL[o.source], account].filter(Boolean).join(', ')}</p>
      </div>
      {figure}
      {post}
      {more}
    </li>
  );
};

export default OccurrenceRow;
