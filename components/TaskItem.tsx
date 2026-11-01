import React from 'react';
import type { Task, TaskPriority, TaskStatus } from '../types';
import { dueLabel } from '../utils/tasksModel';
import { cn } from '../lib/utils';
import { IconButton } from './ui/Actions';
import { Badge } from './ui/Display';
import { Checkbox } from './ui/Fields';
import Icon from './ui/Icon';
import { Menu } from './ui/Menu';

const PRIORITY_TONE: Record<TaskPriority, 'negative' | 'attention' | 'neutral'> = { High: 'negative', Medium: 'attention', Low: 'neutral' };
const STATUSES: TaskStatus[] = ['To Do', 'In Progress', 'Done'];

interface TaskItemProps {
  task: Task;
  today: Date;
  onEdit: (task: Task) => void;
  onTick: (task: Task) => void;
  onMove: (task: Task, status: TaskStatus) => void;
  onDelete: (id: string) => void;
  /** Handles shown when reordering. */
  reorder?: React.ReactNode;
}

/** A task as a line on a checklist (D-017): tick it, open it, or use the menu. */
const TaskItem: React.FC<TaskItemProps> = ({ task, today, onEdit, onTick, onMove, onDelete, reorder }) => {
  const isDone = task.status === 'Done';
  const due = task.dueDate ? dueLabel(task.dueDate, today) : null;
  return (
    <div className="flex items-start gap-2 py-2">
      <span className="shrink-0 pt-0.5"><Checkbox isSelected={isDone} onChange={() => onTick(task)}><span className="sr-only">{task.title} done</span></Checkbox></span>
      <button type="button" onClick={() => onEdit(task)} className="min-w-0 flex-1 cursor-pointer text-left">
        <span className={cn('type-body-strong block truncate text-ink', isDone && 'text-muted line-through')}>{task.title}</span>
        {task.description && <span className="type-caption block truncate text-muted">{task.description}</span>}
        <span className="mt-1 flex flex-wrap items-center gap-2">
          <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
          {due && !isDone && <span className={cn('type-caption', due.isLate ? 'text-money-out' : due.isSoon ? 'text-attention-text' : 'text-muted')}>{due.text}</span>}
          {task.reminderDate && <Icon name="notifications" size={14} className="text-muted" aria-label="Has a reminder" />}
        </span>
      </button>
      {reorder}
      <Menu
        title={task.title}
        trigger={<IconButton icon="more_horiz" label={`Actions for ${task.title}`} tooltipPlacement="left" />}
        items={[
          { id: 'edit', label: 'Edit', icon: 'edit', onAction: () => onEdit(task) },
          ...STATUSES.filter(status => status !== task.status).map(status => ({ id: status, label: `Move to ${status}`, icon: 'arrow_forward', onAction: () => onMove(task, status) })),
          { id: 'delete', label: 'Delete', icon: 'delete', isDestructive: true, startsGroup: true, onAction: () => onDelete(task.id) },
        ]}
      />
    </div>
  );
};

export default React.memo(TaskItem);
