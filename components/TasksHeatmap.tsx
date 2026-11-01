import React, { useMemo } from 'react';
import type { Task, TaskPriority } from '../types';
import { parseLocalDate, toLocalISOString } from '../utils';
import { addDays } from '../utils/scheduleModel';

interface TasksHeatmapProps {
  tasks: Task[];
}

const PRIORITY_COLOURS: Record<TaskPriority, string> = { Low: 'var(--blue)', Medium: 'var(--amber)', High: 'var(--tomato)' };
const PRIORITY_RANK: Record<TaskPriority, number> = { High: 3, Medium: 2, Low: 1 };
const MONTHS = 12;

interface HeatDay { date: string; count: number; priority?: TaskPriority }

/** The next twelve months by day, coloured by the most urgent task due (TSK-02). */
const TasksHeatmap: React.FC<TasksHeatmapProps> = ({ tasks }) => {
  const { weeks, months } = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(start.getFullYear(), start.getMonth() + MONTHS, 0);
    const byDate = new Map<string, { count: number; priority: TaskPriority }>();
    tasks.filter(task => task.dueDate && task.status !== 'Done').forEach(task => {
      const current = byDate.get(task.dueDate!);
      byDate.set(task.dueDate!, {
        count: (current?.count ?? 0) + 1,
        priority: !current || PRIORITY_RANK[task.priority] > PRIORITY_RANK[current.priority] ? task.priority : current.priority,
      });
    });

    const gridStart = addDays(start, -((start.getDay() + 6) % 7));
    const rows: HeatDay[][] = [];
    const labels: { index: number; label: string }[] = [];
    for (let day = gridStart, index = 0; day <= end; index++) {
      const week: HeatDay[] = [];
      for (let i = 0; i < 7; i++, day = addDays(day, 1)) {
        const date = toLocalISOString(day);
        week.push({ date, ...byDate.get(date), count: byDate.get(date)?.count ?? 0 });
        if (day.getDate() === 1) labels.push({ index, label: day.toLocaleDateString(undefined, { month: 'short' }) });
      }
      rows.push(week);
    }
    return { weeks: rows, months: labels };
  }, [tasks]);

  const describe = (day: HeatDay) => {
    const date = parseLocalDate(day.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    return day.count ? `${date}: ${day.count} ${day.count === 1 ? 'task' : 'tasks'}, highest ${day.priority}` : `${date}: nothing due`;
  };

  return (
    <div className="mt-3">
      <div className="no-scrollbar overflow-x-auto">
        <div role="img" aria-label="Tasks due over the next year. The list shows the same tasks." className="w-max">
          <div className="relative mb-1 h-4">
            {months.map(month => <span key={month.label} aria-hidden="true" className="type-caption absolute text-muted" style={{ left: month.index * 15 }}>{month.label}</span>)}
          </div>
          <div className="flex gap-[3px]">
            {weeks.map(week => (
              <div key={week[0].date} className="grid gap-[3px]">
                {week.map(day => <span key={day.date} title={describe(day)} className="size-3 rounded-[3px]" style={{ backgroundColor: day.priority ? PRIORITY_COLOURS[day.priority] : 'var(--inset)' }} />)}
              </div>
            ))}
          </div>
        </div>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {(Object.keys(PRIORITY_COLOURS) as TaskPriority[]).map(priority => (
          <li key={priority} className="type-caption flex items-center gap-1.5 text-muted"><span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ backgroundColor: PRIORITY_COLOURS[priority] }} />{priority}</li>
        ))}
      </ul>
    </div>
  );
};

export default TasksHeatmap;
