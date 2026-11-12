import React, { useMemo, useState } from 'react';
import type { Task, TaskPriority, TaskStatus } from '../types';
import { dueLabel } from '../utils/tasksModel';
import { cn } from '../lib/utils';
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnContent,
  KanbanColumnHandle,
  KanbanItem,
  KanbanOverlay,
} from './reui/kanban';
import { Badge, CountPill } from './ui/Display';
import { Checkbox } from './ui/Fields';
import { IconButton } from './ui/Actions';
import Icon from './ui/Icon';
import { Menu } from './ui/Menu';

const STATUSES: TaskStatus[] = ['To Do', 'In Progress', 'Done'];

const STATUS_ICONS: Record<TaskStatus, string> = {
  'To Do': 'circle',
  'In Progress': 'clock-01',
  'Done': 'checkmark-circle-02',
};

const PRIORITY_TONE: Record<TaskPriority, 'negative' | 'attention' | 'neutral'> = {
  High: 'negative',
  Medium: 'attention',
  Low: 'neutral',
};

interface TaskKanbanBoardProps {
  tasks: Task[];
  today: Date;
  onEdit: (task: Task) => void;
  onTick: (task: Task) => void;
  onMove: (task: Task, status: TaskStatus) => void;
  onDelete: (id: string) => void;
  onQuickAdd: (title: string, status: TaskStatus) => void;
  onCommitMove: (taskId: string, targetStatus: TaskStatus, newOrderedIds: string[]) => void;
}

/** Individual task card within a Kanban column */
const KanbanTaskCard: React.FC<{
  task: Task;
  today: Date;
  onEdit: (task: Task) => void;
  onTick: (task: Task) => void;
  onMove: (task: Task, status: TaskStatus) => void;
  onDelete: (id: string) => void;
  isOverlay?: boolean;
}> = ({ task, today, onEdit, onTick, onMove, onDelete, isOverlay }) => {
  const isDone = task.status === 'Done';
  const due = task.dueDate ? dueLabel(task.dueDate, today) : null;

  return (
    <article
      className={cn(
        'group surface-card relative rounded-xl border border-line p-3.5 shadow-2xs transition-all select-none',
        isOverlay
          ? 'shadow-xl ring-2 ring-primary border-primary/60 bg-solid cursor-grabbing'
          : 'hover:border-line-strong hover:shadow-xs cursor-grab active:cursor-grabbing'
      )}
    >
      {/* Top Meta: Priority Badge, Due Tag, Grip Icon, and Actions Menu */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge tone={PRIORITY_TONE[task.priority]} className="text-[10px] px-1.5 py-0.5 font-semibold">
            {task.priority}
          </Badge>
          {due && !isDone && (
            <span
              className={cn(
                'type-caption text-[11px] font-medium flex items-center gap-1',
                due.isLate ? 'text-money-out font-semibold' : due.isSoon ? 'text-attention-text' : 'text-muted'
              )}
            >
              <Icon name="calendar-03" size={11} />
              <span>{due.text}</span>
            </span>
          )}
        </div>

        {!isOverlay && (
          <div
            className="flex items-center gap-0.5 shrink-0 -mr-1 -mt-1"
            onPointerDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            <span
              className="text-muted/40 group-hover:text-muted/80 transition-colors p-1"
              title="Drag to move"
              aria-hidden="true"
            >
              <Icon name="menu-01" size={13} />
            </span>
            <Menu
              title={task.title}
              trigger={
                <IconButton
                  icon="more-horizontal"
                  label={`Actions for ${task.title}`}
                  tooltipPlacement="left"
                  className="size-7 text-muted hover:text-ink opacity-60 group-hover:opacity-100 transition-opacity"
                  iconSize={14}
                />
              }
              items={[
                { id: 'edit', label: 'Edit', icon: 'pencil-edit-02', onAction: () => onEdit(task) },
                ...STATUSES.filter(s => s !== task.status).map(status => ({
                  id: status,
                  label: `Move to ${status}`,
                  icon: 'arrow-right-01',
                  onAction: () => onMove(task, status),
                })),
                { id: 'delete', label: 'Delete', icon: 'delete-02', isDestructive: true, startsGroup: true, onAction: () => onDelete(task.id) },
              ]}
            />
          </div>
        )}
      </div>

      {/* Task Title & Interactive Checkbox */}
      <div className="mt-2 flex items-start gap-2.5">
        <span
          className="shrink-0 pt-0.5"
          onPointerDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        >
          <Checkbox isSelected={isDone} onChange={() => onTick(task)}>
            <span className="sr-only">{task.title} done</span>
          </Checkbox>
        </span>
        <div
          onClick={() => onEdit(task)}
          className="min-w-0 flex-1 text-left cursor-pointer focus-visible:outline-hidden"
        >
          <span
            className={cn(
              'type-body-strong block text-ink text-sm font-semibold leading-snug line-clamp-2',
              isDone && 'text-muted line-through opacity-75'
            )}
          >
            {task.title}
          </span>
          {task.description && (
            <p className="type-caption text-muted text-xs line-clamp-2 mt-1">
              {task.description}
            </p>
          )}
        </div>
      </div>

      {/* Footer Meta: Financial Entity / Page Link & Reminder */}
      {(task.linkedEntityName || task.linkedPage || task.reminderDate) && (
        <div className="mt-3 pt-2.5 border-t border-line/60 flex items-center justify-between text-xs text-muted">
          <div className="flex items-center gap-1.5 truncate">
            {task.linkedEntityName ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-inset px-2 py-0.5 text-[11px] font-medium text-ink border border-line/80 truncate max-w-[180px]">
                <Icon
                  name={
                    task.linkedEntityType === 'goal'
                      ? 'target-01'
                      : task.linkedEntityType === 'bill'
                        ? 'invoice-01'
                        : 'wallet-02'
                  }
                  size={11}
                  className="text-primary shrink-0"
                />
                <span className="truncate">{task.linkedEntityName}</span>
              </span>
            ) : task.linkedPage ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-inset px-2 py-0.5 text-[11px] font-medium text-muted border border-line/60">
                <Icon name="link-01" size={10} className="text-muted shrink-0" />
                <span>{task.linkedPage}</span>
              </span>
            ) : null}
          </div>

          {task.reminderDate && (
            <span className="shrink-0 text-muted" title={`Reminder: ${task.reminderDate}`}>
              <Icon name="notifications" size={13} />
            </span>
          )}
        </div>
      )}
    </article>
  );
};

/** Kanban Column with Header, Task List, and Inline Quick Add Input */
const KanbanTaskColumn: React.FC<{
  status: TaskStatus;
  tasks: Task[];
  today: Date;
  onEdit: (task: Task) => void;
  onTick: (task: Task) => void;
  onMove: (task: Task, status: TaskStatus) => void;
  onDelete: (id: string) => void;
  onQuickAdd: (title: string, status: TaskStatus) => void;
}> = ({ status, tasks, today, onEdit, onTick, onMove, onDelete, onQuickAdd }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');

  const submitQuickAdd = () => {
    const clean = quickTitle.trim();
    if (clean) {
      onQuickAdd(clean, status);
      setQuickTitle('');
    }
    setIsAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitQuickAdd();
    } else if (e.key === 'Escape') {
      setQuickTitle('');
      setIsAdding(false);
    }
  };

  return (
    <KanbanColumn value={status} className="w-80 shrink-0 self-start lg:w-auto">
      <div className="surface-card rounded-[var(--radius-xl)] border border-line p-4 flex flex-col min-h-[420px]">
        {/* Column Header */}
        <div className="flex items-center justify-between pb-3 border-b border-line/70">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'size-2.5 rounded-full',
                status === 'To Do' && 'bg-amber',
                status === 'In Progress' && 'bg-primary',
                status === 'Done' && 'bg-money-in'
              )}
              aria-hidden="true"
            />
            <h2 className="type-card-title text-ink font-semibold flex items-center gap-2 text-sm">
              <span>{status}</span>
              <CountPill count={tasks.length} />
            </h2>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="size-7 rounded-lg text-muted hover:text-ink hover:bg-inset flex items-center justify-center transition-colors"
              aria-label={`Add task to ${status}`}
              title={`Add task to ${status}`}
            >
              <Icon name="add-01" size={16} />
            </button>
            <KanbanColumnHandle
              render={props => (
                <button
                  {...props}
                  type="button"
                  aria-label={`Drag ${status} column`}
                  className="size-7 rounded-lg text-muted hover:text-ink hover:bg-inset flex items-center justify-center transition-colors cursor-grab active:cursor-grabbing"
                >
                  <Icon name="menu-01" size={14} />
                </button>
              )}
            />
          </div>
        </div>

        {/* Column Content: Drag and Drop Task Items */}
        <KanbanColumnContent value={status} className="mt-3 flex flex-col gap-3 min-h-[60px] flex-1">
          {tasks.map(task => (
            <KanbanItem key={task.id} value={task.id} asHandle>
              <KanbanTaskCard
                task={task}
                today={today}
                onEdit={onEdit}
                onTick={onTick}
                onMove={onMove}
                onDelete={onDelete}
              />
            </KanbanItem>
          ))}
          {tasks.length === 0 && !isAdding && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-line rounded-xl">
              <Icon name={STATUS_ICONS[status]} size={20} className="text-muted/50 mb-1" />
              <p className="type-caption text-muted text-xs">No tasks in {status}</p>
            </div>
          )}
        </KanbanColumnContent>

        {/* Inline Quick Add Input */}
        <div className="mt-3 pt-2 border-t border-line/60">
          {isAdding ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={quickTitle}
                onChange={e => setQuickTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={submitQuickAdd}
                placeholder={`New ${status} task... (Enter to save)`}
                autoFocus
                className="type-body flex-1 rounded-lg border border-line bg-inset px-2.5 py-1.5 text-xs text-ink placeholder:text-muted focus:border-primary focus:outline-hidden"
              />
              <button
                type="button"
                onClick={submitQuickAdd}
                className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-on-primary hover:bg-primary-hover transition-colors"
              >
                Add
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted hover:text-ink hover:bg-inset transition-colors"
            >
              <Icon name="add-01" size={13} className="text-muted" />
              <span>Add task</span>
            </button>
          )}
        </div>
      </div>
    </KanbanColumn>
  );
};

/**
 * Modern interactive Kanban board for Tasks based on @reui/c-kanban-1.
 * Supports cross-column dragging, item reordering, placeholder overlay preview,
 * and inline keyboard-first task entry.
 */
export const TaskKanbanBoard: React.FC<TaskKanbanBoardProps> = ({
  tasks,
  today,
  onEdit,
  onTick,
  onMove,
  onDelete,
  onQuickAdd,
  onCommitMove,
}) => {
  // Group tasks by their status columns
  const initialColumns = useMemo(() => {
    const groups: Record<string, Task[]> = {
      'To Do': [],
      'In Progress': [],
      'Done': [],
    };
    tasks.forEach(task => {
      const col = task.status && groups[task.status] ? task.status : 'To Do';
      groups[col].push(task);
    });
    return groups;
  }, [tasks]);

  const [columns, setColumns] = useState<Record<string, Task[]>>(initialColumns);

  // Keep columns synced when tasks change from outside
  React.useEffect(() => {
    setColumns(initialColumns);
  }, [initialColumns]);

  const taskMap = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);

  return (
    <Kanban
      value={columns}
      onValueChange={setColumns}
      getItemValue={item => item.id}
      onValueCommit={(newCols, meta) => {
        const { kind, activeContainer, overContainer, event } = meta;
        if (kind === 'item') {
          const taskId = String(event.active.id);
          const task = taskMap.get(taskId);
          const targetStatus = overContainer as TaskStatus;

          // Assemble the full updated order from all columns
          const allNewOrderedIds: string[] = [
            ...(newCols['To Do'] || []).map(t => t.id),
            ...(newCols['In Progress'] || []).map(t => t.id),
            ...(newCols['Done'] || []).map(t => t.id),
          ];

          if (task && (activeContainer !== overContainer || task.status !== targetStatus)) {
            onCommitMove(taskId, targetStatus, allNewOrderedIds);
          } else {
            onCommitMove(taskId, task?.status || targetStatus, allNewOrderedIds);
          }
        }
      }}
    >
      <KanbanBoard className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-1 lg:grid lg:grid-cols-3">
        {STATUSES.map(status => (
          <KanbanTaskColumn
            key={status}
            status={status}
            tasks={columns[status] || []}
            today={today}
            onEdit={onEdit}
            onTick={onTick}
            onMove={onMove}
            onDelete={onDelete}
            onQuickAdd={onQuickAdd}
          />
        ))}
      </KanbanBoard>

      {/* Floating Drag Overlay (Placeholder / Ghost Preview) */}
      <KanbanOverlay className="rounded-xl border-2 border-dashed border-primary/50 bg-canvas/40 backdrop-blur-xs p-1">
        {({ value }) => {
          const task = taskMap.get(String(value));
          if (!task) return null;
          return (
            <KanbanTaskCard
              task={task}
              today={today}
              onEdit={() => {}}
              onTick={() => {}}
              onMove={() => {}}
              onDelete={() => {}}
              isOverlay
            />
          );
        }}
      </KanbanOverlay>
    </Kanban>
  );
};

export default TaskKanbanBoard;
