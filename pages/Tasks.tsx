import React, { useMemo, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task, TaskStatus } from '../types';
import PageHeader, { type PageStat } from '../components/PageHeader';
import TaskItem from '../components/TaskItem';
import TaskModal from '../components/TaskModal';
import TasksHeatmap from '../components/TasksHeatmap';
import { Button } from '../components/ui/Actions';
import { CountPill } from '../components/ui/Display';
import { ConfirmDialog } from '../components/ui/Overlays';
import { Select } from '../components/ui/Pickers';
import SegmentedControl from '../components/ui/SegmentedControl';
import { EmptyState } from '../components/ui/States';
import { placeTask, sortTasks, statusAfterTick, taskStats, type TaskSort } from '../utils/tasksModel';

interface TasksProps {
  tasks: Task[];
  saveTask: (task: Omit<Task, 'id'> & { id?: string }) => void;
  deleteTask: (id: string) => void;
  taskOrder: string[];
  setTaskOrder: React.Dispatch<React.SetStateAction<string[]>>;
}

type Filter = 'all' | TaskStatus;

const STATUSES: TaskStatus[] = ['To Do', 'In Progress', 'Done'];
const VIEWS = [{ id: 'list', label: 'List' }, { id: 'board', label: 'Board' }];
const FILTERS = [{ id: 'all', label: 'All' }, ...STATUSES.map(id => ({ id, label: id }))];
const SORTS = [{ id: 'priority', label: 'Priority' }, { id: 'due', label: 'Due date' }, { id: 'manual', label: 'Your order' }];

const SortableTask: React.FC<{ task: Task; canDrag: boolean; row: (handle?: React.ReactNode) => React.ReactNode }> = ({ task, canDrag, row }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: !canDrag });
  const handle = canDrag ? <span {...attributes} {...listeners} aria-label={`Move ${task.title}`} className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center text-muted">⠿</span> : undefined;
  return <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}>{row(handle)}</li>;
};

/** A checklist of what's on your plate (Rapport's Today), with a board view too. */
const Tasks: React.FC<TasksProps> = ({ tasks, saveTask, deleteTask, taskOrder, setTaskOrder }) => {
  const [isFormOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sort, setSort] = useState<TaskSort>('priority');
  const [filter, setFilter] = useState<Filter>('all');
  const [view, setView] = useState('list');

  const today = useMemo(() => new Date(), []);
  const stats = useMemo(() => taskStats(tasks, today), [tasks, today]);
  const sorted = useMemo(() => sortTasks(tasks, sort, taskOrder), [tasks, sort, taskOrder]);
  const shown = useMemo(() => (filter === 'all' ? sorted : sorted.filter(task => task.status === filter)), [sorted, filter]);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const openForm = (task?: Task) => {
    setEditingTask(task ?? null);
    setFormOpen(true);
  };

  const tick = (task: Task) => saveTask({ ...task, status: statusAfterTick(task) });
  const move = (task: Task, status: TaskStatus) => saveTask({ ...task, status });

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    setTaskOrder(placeTask(sorted.map(task => task.id), String(active.id), String(over.id)));
  };

  const row = (task: Task, handle?: React.ReactNode) => (
    <TaskItem task={task} today={today} onEdit={openForm} onTick={tick} onMove={move} onDelete={setDeletingId} reorder={handle} />
  );

  const pageStats: PageStat[] = [
    { label: 'Open tasks', icon: 'task', value: stats.open, ...(stats.pendingHigh ? { badge: `${stats.pendingHigh} high`, badgeTone: 'tomato' as const } : {}) },
    { label: 'Due in 7 days', icon: 'schedule', value: stats.dueSoon, ...(stats.overdue ? { badge: `${stats.overdue} overdue`, badgeTone: 'butter' as const } : {}) },
    { label: 'Completed', icon: 'check_circle', value: stats.rate, format: 'percent' },
  ];

  return (
    <div className="space-y-6 pb-8 max-md:space-y-4">
      <PageHeader title="Tasks" stats={pageStats} className="!mb-0" actions={<Button icon="add" onPress={() => openForm()}>New task</Button>} />

      {tasks.length === 0 ? (
        <EmptyState icon="task" title="No tasks yet" description="Keep financial to-dos, tax deadlines and reminders in one place." actionLabel="New task" onAction={() => openForm()} />
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              {view === 'list' && <SegmentedControl items={FILTERS} activeId={filter} onChange={id => setFilter(id as Filter)} scrollable />}
              <Select className="w-44" label="Sort by" options={SORTS} value={sort} onChange={id => setSort(id as TaskSort)} />
            </div>
            <span className="max-md:hidden"><SegmentedControl items={VIEWS} activeId={view} onChange={setView} /></span>
          </div>

          {view === 'board' ? (
            <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-1 lg:grid lg:grid-cols-3">
              {STATUSES.map(status => {
                const column = sorted.filter(task => task.status === status);
                return (
                  <section key={status} aria-label={status} className="surface-card w-80 shrink-0 self-start rounded-[var(--radius-xl)] p-4 lg:w-auto">
                    <h2 className="type-card-title flex items-center gap-2 text-ink">{status} <CountPill count={column.length} /></h2>
                    {column.length ? <ul className="mt-1 divide-y divide-line">{column.map(task => <li key={task.id}>{row(task)}</li>)}</ul> : <p className="type-body mt-2 text-muted">Nothing here.</p>}
                  </section>
                );
              })}
            </div>
          ) : (
            <section aria-label="Tasks" className="surface-card rounded-[var(--radius-xl)] p-5 max-md:p-4">
              {shown.length === 0 ? (
                <p className="type-body text-muted">Nothing here.</p>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={shown.map(task => task.id)} strategy={verticalListSortingStrategy}>
                    <ul className="divide-y divide-line">
                      {shown.map(task => <SortableTask key={task.id} task={task} canDrag={sort === 'manual'} row={handle => row(task, handle)} />)}
                    </ul>
                  </SortableContext>
                </DndContext>
              )}
            </section>
          )}

          <section aria-label="Tasks by date" className="surface-card rounded-[var(--radius-xl)] p-5 max-md:p-4">
            <h2 className="type-card-title text-ink">The year ahead</h2>
            <TasksHeatmap tasks={tasks} />
          </section>
        </>
      )}

      {isFormOpen && <TaskModal task={editingTask} onSave={data => { saveTask(data); setFormOpen(false); }} onClose={() => setFormOpen(false)} onDelete={setDeletingId} />}

      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={() => { if (deletingId) deleteTask(deletingId); setDeletingId(null); setFormOpen(false); }}
        title="Delete this task?"
        message="You can't undo this."
        confirmLabel="Delete task"
        isDestructive
      />
    </div>
  );
};

export default Tasks;
