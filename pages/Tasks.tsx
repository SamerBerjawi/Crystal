import React, { useMemo, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task, TaskStatus } from '../types';
import PageHeader, { type PageStat } from '../components/PageHeader';
import TaskItem from '../components/TaskItem';
import TaskModal from '../components/TaskModal';
import TaskKanbanBoard from '../components/TaskKanbanBoard';
import TasksHeatmap from '../components/TasksHeatmap';
import { Button } from '../components/ui/Actions';
import { ConfirmDialog } from '../components/ui/Overlays';
import { Select } from '../components/ui/Pickers';
import SegmentedControl from '../components/ui/SegmentedControl';
import { EmptyState } from '../components/ui/States';
import Icon from '../components/ui/Icon';
import { placeTask, sortTasks, statusAfterTick, taskStats, type TaskSort } from '../utils/tasksModel';

interface TasksProps {
  tasks: Task[];
  saveTask: (task: Omit<Task, 'id'> & { id?: string }) => void;
  deleteTask: (id: string) => void;
  taskOrder: string[];
  setTaskOrder: React.Dispatch<React.SetStateAction<string[]>>;
}

type Filter = 'all' | TaskStatus | 'dueSoon';

const STATUSES: TaskStatus[] = ['To Do', 'In Progress', 'Done'];
const VIEWS = [{ id: 'list', label: 'List' }, { id: 'board', label: 'Board' }];
const FILTERS = [
  { id: 'all', label: 'All' },
  ...STATUSES.map(id => ({ id, label: id })),
  { id: 'dueSoon', label: 'Due in 7d' },
];
const SORTS = [{ id: 'priority', label: 'Priority' }, { id: 'due', label: 'Due date' }, { id: 'manual', label: 'Your order' }];

const SortableTask: React.FC<{ task: Task; canDrag: boolean; row: (handle?: React.ReactNode) => React.ReactNode }> = ({ task, canDrag, row }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: !canDrag });
  const handle = canDrag ? (
    <span {...attributes} {...listeners} aria-label={`Move ${task.title}`} className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center text-muted">
      ⠿
    </span>
  ) : undefined;
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}>
      {row(handle)}
    </li>
  );
};

/** A checklist of what's on your plate (Rapport's Today), with an interactive drag-and-drop Kanban board view. */
const Tasks: React.FC<TasksProps> = ({ tasks, saveTask, deleteTask, taskOrder, setTaskOrder }) => {
  const [isFormOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sort, setSort] = useState<TaskSort>('priority');
  const [filter, setFilter] = useState<Filter>('all');
  const [view, setView] = useState('board');
  const [listQuickTitle, setListQuickTitle] = useState('');

  const today = useMemo(() => new Date(), []);
  const stats = useMemo(() => taskStats(tasks, today), [tasks, today]);
  const sorted = useMemo(() => sortTasks(tasks, sort, taskOrder), [tasks, sort, taskOrder]);

  const shown = useMemo(() => {
    if (filter === 'all') return sorted;
    if (filter === 'dueSoon') {
      const in7Days = new Date(today);
      in7Days.setDate(in7Days.getDate() + 7);
      return sorted.filter(task => {
        if (!task.dueDate || task.status === 'Done') return false;
        return task.dueDate <= in7Days.toISOString().slice(0, 10);
      });
    }
    return sorted.filter(task => task.status === filter);
  }, [sorted, filter, today]);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: undefined }));

  const openForm = (task?: Task) => {
    setEditingTask(task ?? null);
    setFormOpen(true);
  };

  const tick = (task: Task) => saveTask({ ...task, status: statusAfterTick(task) });
  const move = (task: Task, status: TaskStatus) => saveTask({ ...task, status });

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const allSortedIds = sorted.map(task => task.id);
    const reordered = placeTask(allSortedIds, String(active.id), String(over.id));
    setTaskOrder([...reordered, ...(taskOrder || []).filter(id => !allSortedIds.includes(id))]);
    if (sort !== 'manual') setSort('manual');
  };

  const handleCommitMove = (taskId: string, targetStatus: TaskStatus, newOrderedIds: string[]) => {
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== targetStatus) {
      saveTask({ ...task, status: targetStatus });
    }
    setTaskOrder(newOrderedIds);
    if (sort !== 'manual') setSort('manual');
  };

  const handleQuickAdd = (title: string, status: TaskStatus = 'To Do') => {
    saveTask({
      title: title.trim(),
      status,
      priority: 'Medium',
    });
  };

  const row = (task: Task, handle?: React.ReactNode) => (
    <TaskItem task={task} today={today} onEdit={openForm} onTick={tick} onMove={move} onDelete={setDeletingId} reorder={handle} />
  );

  const pageStats: PageStat[] = [
    { label: 'Open tasks', icon: 'task-01', value: stats.open, ...(stats.pendingHigh ? { badge: `${stats.pendingHigh} high`, badgeTone: 'tomato' as const } : {}) },
    { label: 'Due in 7 days', icon: 'clock-01', value: stats.dueSoon, ...(stats.overdue ? { badge: `${stats.overdue} overdue`, badgeTone: 'butter' as const } : {}) },
    { label: 'Completed', icon: 'checkmark-circle-02', value: stats.rate, format: 'percent' },
  ];

  return (
    <div className="space-y-6 pb-8 max-md:space-y-4">
      <PageHeader title="Tasks" stats={pageStats} actions={<Button icon="add-01" onPress={() => openForm()}>New task</Button>} />

      {tasks.length === 0 ? (
        <EmptyState icon="task-01" title="No tasks yet" description="Keep financial to-dos, tax deadlines and reminders in one place." actionLabel="New task" onAction={() => openForm()} />
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <SegmentedControl items={FILTERS} activeId={filter} onChange={id => setFilter(id as Filter)} scrollable />
              <Select className="w-44" label="Sort by" options={SORTS} value={sort} onChange={id => setSort(id as TaskSort)} />
            </div>
            <SegmentedControl items={VIEWS} activeId={view} onChange={setView} />
          </div>

          {view === 'board' ? (
            <TaskKanbanBoard
              tasks={shown}
              today={today}
              onEdit={openForm}
              onTick={tick}
              onMove={move}
              onDelete={setDeletingId}
              onQuickAdd={handleQuickAdd}
              onCommitMove={handleCommitMove}
            />
          ) : (
            <section aria-label="Tasks" className="surface-card rounded-[var(--radius-xl)] p-5 max-md:p-4">
              {/* List View Quick Add Input */}
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-inset p-2 border border-line/70 focus-within:border-primary">
                <Icon name="add-01" size={16} className="text-muted ml-1" />
                <input
                  type="text"
                  value={listQuickTitle}
                  onChange={e => setListQuickTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && listQuickTitle.trim()) {
                      e.preventDefault();
                      handleQuickAdd(listQuickTitle.trim(), 'To Do');
                      setListQuickTitle('');
                    }
                  }}
                  placeholder="Add a task to your plate... (Press Enter to save)"
                  className="type-body flex-1 bg-transparent px-1 text-sm text-ink placeholder:text-muted focus:outline-hidden"
                />
                {listQuickTitle.trim() && (
                  <Button
                    size="sm"
                    onPress={() => {
                      handleQuickAdd(listQuickTitle.trim(), 'To Do');
                      setListQuickTitle('');
                    }}
                  >
                    Add task
                  </Button>
                )}
              </div>

              {shown.length === 0 ? (
                <p className="type-body text-muted py-6 text-center">Nothing here.</p>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={shown.map(task => task.id)} strategy={verticalListSortingStrategy}>
                    <ul className="divide-y divide-line">
                      {shown.map(task => <SortableTask key={task.id} task={task} canDrag={true} row={handle => row(task, handle)} />)}
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
