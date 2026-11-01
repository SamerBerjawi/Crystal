import React, { useState } from 'react';
import type { FinancialGoal } from '../types';
import { parseLocalDate } from '../utils';
import { goalCardView, planLine, type GoalCardView, type PlanLine } from '../utils/goalsModel';
import { cn } from '../lib/utils';
import { Button, IconButton } from './ui/Actions';
import { Badge, ProgressRing } from './ui/Display';
import { Switch } from './ui/Fields';
import Icon from './ui/Icon';
import { Menu, type MenuAction } from './ui/Menu';
import { Amount } from './ui/Money';

const shortDate = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export const GOAL_STATUS = {
  done: { label: 'Reached', tone: 'positive' },
  'on-track': { label: 'On track', tone: 'positive' },
  'at-risk': { label: 'At risk', tone: 'attention' },
  'off-track': { label: 'Behind', tone: 'negative' },
  'no-plan': { label: 'No plan yet', tone: 'neutral' },
} as const;

const monthsLeft = (date: string | undefined, today: Date) => {
  if (!date) return undefined;
  const target = parseLocalDate(date);
  return Math.max(0, (target.getFullYear() - today.getFullYear()) * 12 + target.getMonth() - today.getMonth());
};

const PlanText: React.FC<{ line: PlanLine }> = ({ line }) => {
  const money = (value: number) => <Amount value={value} currency="EUR" />;
  switch (line.kind) {
    case 'done': return <>Goal reached.</>;
    case 'late': return <>The target date, {shortDate(line.date)}, has passed.</>;
    case 'no-plan': return line.need ? <>{money(line.need)} a month gets you there{line.date ? ` by ${shortDate(line.date)}` : ''}.</> : <>Add a contribution to see when you'll get there.</>;
    case 'ongoing': return <>{money(line.contribution)} a month{line.projectedDate ? ` gets you there by ${shortDate(line.projectedDate)}` : ''}.</>;
    case 'on-pace': return <>{money(line.monthly)} a month gets you there by {shortDate(line.date)}.</>;
    case 'short': return <>Needs {money(line.need)} a month to make {shortDate(line.date)}.{line.projectedDate ? <> At {money(line.contribution)}, it's {shortDate(line.projectedDate)}.</> : null}</>;
  }
};

const planIsGood = (line: PlanLine) => line.kind === 'done' || line.kind === 'on-pace' || line.kind === 'ongoing';

interface GoalCardProps {
  goal: FinancialGoal;
  items: FinancialGoal[];
  isIncluded: boolean;
  today: Date;
  onToggleIncluded: (goal: FinancialGoal) => void;
  onToggleComplete: (goal: FinancialGoal) => void;
  onEdit: (goal: FinancialGoal) => void;
  onDuplicate: (goal: FinancialGoal) => void;
  onDelete: (goal: FinancialGoal) => void;
  onAddItem: (bucketId: string) => void;
  /** Handles shown in reorder mode. */
  reorder?: React.ReactNode;
}

const goalMenu = (goal: FinancialGoal, view: GoalCardView, props: GoalCardProps): MenuAction[] => [
  { id: 'complete', label: view.done ? 'Mark as not reached' : 'Mark as reached', icon: 'check_circle', onAction: () => props.onToggleComplete(goal) },
  ...(goal.isBucket ? [{ id: 'add', label: 'Add an item', icon: 'add', onAction: () => props.onAddItem(goal.id) }] : []),
  { id: 'duplicate', label: 'Duplicate', icon: 'content_copy', onAction: () => props.onDuplicate(goal) },
  { id: 'delete', label: 'Delete', icon: 'delete', isDestructive: true, startsGroup: true, onAction: () => props.onDelete(goal) },
];

const ItemRow: React.FC<{ item: FinancialGoal; today: Date; card: GoalCardProps }> = ({ item, today, card }) => {
  const view = goalCardView(item, [], today);
  const status = GOAL_STATUS[view.status];
  return (
    <li className="flex items-center gap-2 py-2">
      <button type="button" onClick={() => card.onEdit(item)} className="min-w-0 flex-1 cursor-pointer text-left">
        <span className="flex items-center justify-between gap-2">
          <span className={cn('type-body-strong truncate text-ink', view.done && 'line-through')}>{item.name}</span>
          <Badge tone={status.tone}>{status.label}</Badge>
        </span>
        <span className="type-caption block text-muted"><Amount value={view.saved} currency="EUR" /> of <Amount value={view.target} currency="EUR" /></span>
        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-inset"><span className="block h-full rounded-full bg-[var(--primary)]" style={{ width: `${view.pct}%` }} /></span>
      </button>
      <Menu title={item.name} trigger={<IconButton icon="more_horiz" label={`Actions for ${item.name}`} tooltipPlacement="left" />} items={goalMenu(item, view, card)} />
    </li>
  );
};

/** A goal as Rivolo draws it: ring, three figures, and what a month gets you (D-042). Buckets expand. */
const GoalCard: React.FC<GoalCardProps> = props => {
  const { goal, items, isIncluded, today, onToggleIncluded, onEdit, reorder } = props;
  const [isOpen, setOpen] = useState(false);
  const view = goalCardView(goal, items, today);
  const status = GOAL_STATUS[view.status];
  const line = planLine(goal, view, today);
  const months = monthsLeft(view.date, today);
  const ringTone = view.status === 'off-track' ? 'loss' : view.status === 'at-risk' ? 'amber' : 'pine';

  return (
    <article className="surface-card flex h-full flex-col gap-4 rounded-[var(--radius-xl)] p-5">
      <header className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-inset text-ink"><Icon name={goal.isBucket ? 'folder' : 'flag'} size={20} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="type-card-title truncate text-ink">{goal.name}</h3>
          <p className="type-caption text-muted">{goal.isBucket ? `${items.length} ${items.length === 1 ? 'item' : 'items'}` : view.date ? `By ${shortDate(view.date)}` : 'Ongoing'}</p>
        </div>
        {reorder ?? <Badge tone={status.tone}>{status.label}</Badge>}
      </header>

      <div className="flex items-center gap-4">
        <ProgressRing size={96} value={view.pct} tone={ringTone} label={`${Math.round(view.pct)}%`} caption="saved" />
        <dl className="min-w-0 flex-1 space-y-1.5">
          <div className="flex justify-between gap-3"><dt className="type-body text-muted">Saved</dt><dd className="type-figure-row text-ink"><Amount value={view.saved} currency="EUR" /></dd></div>
          <div className="flex justify-between gap-3"><dt className="type-body text-muted">Target</dt><dd className="type-figure-row text-ink"><Amount value={view.target} currency="EUR" /></dd></div>
          {months !== undefined && <div className="flex justify-between gap-3"><dt className="type-body text-muted">Months left</dt><dd className="type-figure-row text-ink">{months}</dd></div>}
        </dl>
      </div>

      <p className="type-body flex items-start gap-2 text-ink">
        <Icon name={planIsGood(line) ? 'check' : 'info'} size={18} className="mt-0.5 shrink-0 text-muted" />
        <span><PlanText line={line} /></span>
      </p>

      {goal.isBucket && (
        <div className="border-t border-line pt-1">
          <button type="button" aria-expanded={isOpen} onClick={() => setOpen(open => !open)} className="flex min-h-11 w-full cursor-pointer items-center justify-between text-left">
            <span className="type-label text-ink">{isOpen ? 'Hide items' : 'Show items'}</span>
            <Icon name="expand_more" size={20} className={cn('text-muted transition-transform duration-[var(--duration-base)]', isOpen && 'rotate-180')} />
          </button>
          {isOpen && (
            <>
              {items.length > 0 && <ul className="divide-y divide-line">{items.map(item => <ItemRow key={item.id} item={item} today={today} card={props} />)}</ul>}
              <Button variant="ghost" size="sm" icon="add" onPress={() => props.onAddItem(goal.id)}>Add an item</Button>
            </>
          )}
        </div>
      )}

      <footer className="mt-auto flex items-center justify-between gap-2">
        <Switch isSelected={isIncluded} onChange={() => onToggleIncluded(goal)} className="min-w-0 flex-1">In forecast</Switch>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="secondary" size="sm" onPress={() => onEdit(goal)}>Edit</Button>
          <Menu title={goal.name} trigger={<IconButton icon="more_horiz" label={`Actions for ${goal.name}`} tooltipPlacement="left" />} items={goalMenu(goal, view, props)} />
        </div>
      </footer>
    </article>
  );
};

export default GoalCard;
