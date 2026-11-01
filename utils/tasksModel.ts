import type { Task, TaskPriority, TaskStatus } from '../types';
import { parseLocalDate } from '../utils';
import { addDays, iso } from './scheduleModel';

/* Tasks model: figures, sorting and order. Pure, and tested in tests/unit/tasksModel.test.ts. */

export type TaskSort = 'manual' | 'priority' | 'due';

const PRIORITY_RANK: Record<TaskPriority, number> = { High: 3, Medium: 2, Low: 1 };

export interface TaskStats { total: number; open: number; completed: number; rate: number; pendingHigh: number; dueSoon: number; overdue: number }

export const taskStats = (tasks: Task[], today: Date): TaskStats => {
  const todayStr = iso(today);
  const weekEnd = iso(addDays(today, 7));
  const open = tasks.filter(task => task.status !== 'Done');
  const completed = tasks.length - open.length;
  return {
    total: tasks.length,
    open: open.length,
    completed,
    rate: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
    pendingHigh: open.filter(task => task.priority === 'High').length,
    dueSoon: open.filter(task => !!task.dueDate && task.dueDate >= todayStr && task.dueDate <= weekEnd).length,
    overdue: open.filter(task => !!task.dueDate && task.dueDate < todayStr).length,
  };
};

/** Finished tasks stay in place. Tasks with no date go last when sorting by date. */
export const sortTasks = (tasks: Task[], sort: TaskSort, order: string[]): Task[] => {
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...tasks].sort((a, b) => {
    if (sort === 'priority') return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    if (sort === 'due') {
      if (!a.dueDate) return b.dueDate ? 1 : 0;
      if (!b.dueDate) return -1;
      return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
    }
    return (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9);
  });
};

/** `ids` with `id` placed where `targetId` is. */
export const placeTask = (ids: string[], id: string, targetId: string): string[] => {
  const from = ids.indexOf(id);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return ids;
  const next = ids.filter(item => item !== id);
  next.splice(to, 0, id);
  return next;
};

export const statusAfterTick = (task: Task): TaskStatus => (task.status === 'Done' ? 'To Do' : 'Done');

/** "3 days overdue", "Today", "Tomorrow", "In 4 days", or the date. */
export const dueLabel = (date: string, today: Date): { text: string; isLate: boolean; isSoon: boolean } => {
  const days = Math.round((parseLocalDate(date).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
  if (days < 0) return { text: `${-days} ${days === -1 ? 'day' : 'days'} overdue`, isLate: true, isSoon: false };
  if (days === 0) return { text: 'Today', isLate: false, isSoon: true };
  if (days === 1) return { text: 'Tomorrow', isLate: false, isSoon: true };
  if (days <= 7) return { text: `In ${days} days`, isLate: false, isSoon: false };
  return { text: parseLocalDate(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), isLate: false, isSoon: false };
};
