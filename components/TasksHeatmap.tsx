import React, { useMemo } from 'react';
import type { Task, TaskPriority } from '../types';
import { toLocalISOString } from '../utils';
import type { HeatColumn } from '../utils/activityModel';
import { addDays } from '../utils/scheduleModel';
import {
  HeatmapCells,
  HeatmapChart,
  HeatmapInteractionBoundary,
  HeatmapInteractionProvider,
  HeatmapLegend,
  HeatmapSeparator,
  HeatmapTooltip,
  HeatmapXAxis,
  HeatmapYAxis,
} from '../src/components/bklit';

interface TasksHeatmapProps {
  tasks: Task[];
}

const PRIORITY_RANK: Record<TaskPriority, number> = { High: 3, Medium: 2, Low: 1 };
const MONTHS = 12;

/** The next twelve months by day on the standard Bklit heatmap, coloured by due task urgency and volume. */
const TasksHeatmap: React.FC<TasksHeatmapProps> = ({ tasks }) => {
  const { data, byDate } = useMemo(() => {
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

    const first = addDays(start, -start.getDay());
    const weeks = Math.round((addDays(end, -end.getDay()).getTime() - first.getTime()) / (7 * 86_400_000)) + 1;
    const data: HeatColumn[] = Array.from({ length: weeks }, (_, week) => ({
      bin: week,
      bins: Array.from({ length: 7 }, (__, row) => {
        const date = addDays(first, week * 7 + row);
        const iso = toLocalISOString(date);
        const inside = date >= start && date <= end;
        const entry = inside ? byDate.get(iso) : undefined;
        const count = entry ? Math.min(4, Math.max(entry.count, PRIORITY_RANK[entry.priority])) : 0;
        return { bin: row, date, count };
      }),
    }));
    return { data, byDate };
  }, [tasks]);

  const describe = (_level: number, date: Date) => {
    const entry = byDate.get(toLocalISOString(date));
    if (!entry) return 'Nothing due';
    return `${entry.count} ${entry.count === 1 ? 'task' : 'tasks'} · highest ${entry.priority}`;
  };

  return (
    <div className="mt-3 pt-4" aria-label="Tasks due over the next year">
      <HeatmapInteractionProvider>
        <HeatmapInteractionBoundary>
          <div className="flex w-full flex-col items-stretch gap-3">
            <HeatmapChart data={data} gap={3} layout="fluid">
              <HeatmapCells
                cornerRadius={999}
                inactiveOpacity={0.8}
                inactiveScale={0.94}
              />
              <HeatmapSeparator
                groupBy="quarter"
                showLabels
                labelClassName="text-[var(--chart-3)]"
                spacing={12}
                startOffset={14}
                strokeOpacity={0.6}
              />
              <HeatmapXAxis />
              <HeatmapYAxis tickFilter="all" labelFormat="initial" />
              <HeatmapTooltip formatLabel={describe} />
            </HeatmapChart>
            <HeatmapLegend
              align="center"
              cornerRadius={999}
              gap={3}
              inactiveOpacity={0.8}
              inactiveScale={0.94}
            />
          </div>
        </HeatmapInteractionBoundary>
      </HeatmapInteractionProvider>
    </div>
  );
};

export default TasksHeatmap;
