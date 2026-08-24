import React, { useMemo } from 'react';
import { Task, TaskPriority } from '../types';
import { parseLocalDate, toLocalISOString } from '../utils';
import {
  HeatmapChart,
  HeatmapCells,
  HeatmapXAxis,
  HeatmapYAxis,
  HeatmapTooltip,
  type HeatmapColumn,
  type HeatmapLevelStyles,
} from '../src/components/charts/heatmap';

interface TasksHeatmapProps {
  tasks: Task[];
}

// Exact priority color constants from previous design:
// Level 0: No Tasks
// Level 1: Low Priority (blue-400)
// Level 2: Medium Priority (yellow-400)
// Level 3: High Priority (red-500)
const PRIORITY_COLORS = {
  Low: '#60a5fa', // bg-blue-400
  Medium: '#facc15', // bg-yellow-400
  High: '#ef4444', // bg-red-500
};

const PRIORITY_ORDER: Record<TaskPriority, number> = { High: 3, Medium: 2, Low: 1 };

enum TaskColorLevel {
  None = 0,
  Low = 1,
  Medium = 2,
  High = 3,
}

const TasksHeatmap: React.FC<TasksHeatmapProps> = ({ tasks }) => {
  const { heatmapData, tasksByDate } = useMemo(() => {
    const now = new Date();
    // Start from the 1st of the current month in LOCAL time
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    startDate.setHours(0, 0, 0, 0);

    // Show 12 full months (covers a year)
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 12, 0);
    endDate.setHours(23, 59, 59, 999);

    const map = new Map<string, { priority: TaskPriority; count: number }>();

    tasks.forEach(task => {
      if (task.dueDate) {
        const taskDate = parseLocalDate(task.dueDate);
        if (taskDate >= startDate && taskDate <= endDate) {
          const dateStr = task.dueDate;
          const existing = map.get(dateStr);
          if (existing) {
            if (PRIORITY_ORDER[task.priority] > PRIORITY_ORDER[existing.priority]) {
              existing.priority = task.priority;
            }
            existing.count += 1;
          } else {
            map.set(dateStr, { priority: task.priority, count: 1 });
          }
        }
      }
    });

    // Align start to the previous Sunday (bklit heatmap default)
    const gridStart = new Date(startDate);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());
    gridStart.setHours(0, 0, 0, 0);

    const gridEnd = new Date(endDate);
    gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));
    gridEnd.setHours(23, 59, 59, 999);

    const columns: HeatmapColumn[] = [];
    let cur = new Date(gridStart);
    let colIdx = 0;

    while (cur <= gridEnd) {
      const bins = [];
      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        const binDate = new Date(cur);
        const dateKey = toLocalISOString(binDate);
        const dayData = map.get(dateKey);

        let colorLevel = TaskColorLevel.None;
        if (dayData) {
          if (dayData.priority === 'High') colorLevel = TaskColorLevel.High;
          else if (dayData.priority === 'Medium') colorLevel = TaskColorLevel.Medium;
          else if (dayData.priority === 'Low') colorLevel = TaskColorLevel.Low;
        }

        bins.push({
          bin: dayOfWeek,
          count: colorLevel,
          date: binDate,
        });

        cur.setDate(cur.getDate() + 1);
      }

      columns.push({
        bin: colIdx,
        bins,
      });
      colIdx++;
    }

    return { heatmapData: columns, tasksByDate: map };
  }, [tasks]);

  // Pass levelStyles so fillScale uses the exact priority colors on the SVG rects
  const tasksLevelStyles: HeatmapLevelStyles = useMemo(
    () => [
      { color: 'oklch(0.92 0.01 260 / 0.35)', fillMode: 'solid', pattern: 'none' }, // Level 0: No Tasks
      { color: PRIORITY_COLORS.Low, fillMode: 'solid', pattern: 'none' },            // Level 1: Low
      { color: PRIORITY_COLORS.Medium, fillMode: 'solid', pattern: 'none' },         // Level 2: Medium
      { color: PRIORITY_COLORS.High, fillMode: 'solid', pattern: 'none' },           // Level 3: High
      { color: PRIORITY_COLORS.High, fillMode: 'solid', pattern: 'none' },           // Level 4: High
    ],
    []
  );

  const customTooltipLabel = (_count: number, date: Date) => {
    const dateKey = toLocalISOString(date);
    const dayData = tasksByDate.get(dateKey);

    if (!dayData) {
      return 'No tasks due';
    }

    return `${dayData.count} task(s), highest: ${dayData.priority}`;
  };

  return (
    <div className="flex flex-col items-center w-full">
      <div className="overflow-x-auto w-full flex justify-center py-1">
        <div className="w-full max-w-4xl">
          <HeatmapChart
            data={heatmapData}
            weekStartDay={1} // Monday start (Row 0 = Mon)
            binSize={14} // Exact 14px cell size as original
            gap={4} // Exact 4px gap as original
            levelStyles={tasksLevelStyles}
            layout="fluid"
            margin={{ top: 22, right: 10, bottom: 4, left: 32 }}
          >
            <HeatmapCells cornerRadius={2} />
            <HeatmapXAxis className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-medium" />
            <HeatmapYAxis
              tickFilter="odd" // Mon / Wed / Fri as in original
              labelFormat="full"
              className="text-xs text-right pr-1 text-light-text-secondary dark:text-dark-text-secondary font-medium"
            />
            <HeatmapTooltip formatLabel={customTooltipLabel} />
          </HeatmapChart>
        </div>
      </div>

      {/* Exact original legend */}
      <div className="flex justify-center items-center gap-4 mt-4 text-xs text-light-text-secondary dark:text-dark-text-secondary">
        <span>Priority:</span>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-xs bg-blue-400" />
          <span>Low</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-xs bg-yellow-400" />
          <span>Medium</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-xs bg-red-500" />
          <span>High</span>
        </div>
      </div>
    </div>
  );
};

export default TasksHeatmap;
