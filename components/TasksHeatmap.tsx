import React, { useMemo } from 'react';
import { Task, TaskPriority } from '../types';
import Card from './Card';

interface TasksHeatmapProps {
    tasks: Task[];
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
    'High': 'bg-red-500',
    'Medium': 'bg-yellow-400',
    'Low': 'bg-blue-400',
};
const NO_TASK_COLOR = 'bg-gray-200 dark:bg-gray-800';
const PRIORITY_ORDER: Record<TaskPriority, number> = { 'High': 3, 'Medium': 2, 'Low': 1 };

const TasksHeatmap: React.FC<TasksHeatmapProps> = ({ tasks }) => {

    // FIX: Destructure `tasksByDate` from useMemo result to make it accessible in the component's scope.
    const { gridDays, monthLabels, tasksByDate } = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const endDate = new Date(today);
        const startDate = new Date(today);
        startDate.setFullYear(startDate.getFullYear() - 1);
        startDate.setDate(startDate.getDate() + 1);

        const tasksByDate = new Map<string, { priority: TaskPriority, count: number }>();
        tasks.forEach(task => {
            if (task.dueDate) {
                const taskDate = new Date(task.dueDate);
                taskDate.setMinutes(taskDate.getMinutes() + taskDate.getTimezoneOffset());
                if (taskDate >= startDate && taskDate <= endDate) {
                    const dateStr = taskDate.toISOString().split('T')[0];
                    const existing = tasksByDate.get(dateStr);
                    if (existing) {
                        if (PRIORITY_ORDER[task.priority] > PRIORITY_ORDER[existing.priority]) {
                            existing.priority = task.priority;
                        }
                        existing.count += 1;
                    } else {
                        tasksByDate.set(dateStr, { priority: task.priority, count: 1 });
                    }
                }
            }
        });

        const allDays = [];
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            allDays.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }

        const firstDayOfWeek = startDate.getDay();
        const paddedDays: (Date | null)[] = [...Array(firstDayOfWeek).fill(null), ...allDays];

        const monthLabels: { label: string; colStart: number }[] = [];
        let lastMonth = -1;
        paddedDays.forEach((day, index) => {
            if (day) {
                const month = day.getMonth();
                if (month !== lastMonth) {
                    monthLabels.push({ label: day.toLocaleString('default', { month: 'short' }), colStart: Math.floor(index / 7) + 1 });
                    lastMonth = month;
                }
            }
        });

        // FIX: Return `tasksByDate` so it can be used in the render method.
        return { gridDays: paddedDays, monthLabels, tasksByDate };

    }, [tasks]);
    

    return (
        <Card>
            <h3 className="text-xl font-semibold mb-4">Task Priority Heatmap (Last Year)</h3>
            <div className="overflow-x-auto pb-2">
                <div className="inline-block">
                    <div className="grid grid-flow-col gap-x-1" style={{ gridAutoColumns: '16px' }}>
                       {monthLabels.map(({ label, colStart }, index) => {
                            const prevColStart = index > 0 ? monthLabels[index - 1].colStart : 0;
                            const span = colStart - prevColStart;
                            return (
                                <div key={label} className="text-xs text-center" style={{ gridColumn: `span ${span}` }}>
                                    {span > 1 ? label : ''}
                                </div>
                            );
                       })}
                    </div>
                    <div className="grid grid-flow-col grid-rows-7 gap-1" style={{ gridAutoColumns: '16px' }}>
                        {gridDays.map((day, index) => {
                            if (!day) {
                                return <div key={`pad-${index}`} className="w-4 h-4" />;
                            }
                            const dateStr = day.toISOString().split('T')[0];
                            const dayData = tasksByDate.get(dateStr);
                            const color = dayData ? PRIORITY_COLORS[dayData.priority] : NO_TASK_COLOR;
                            const tooltip = dayData
                                ? `${day.toLocaleDateString()}: ${dayData.count} task(s), highest: ${dayData.priority}`
                                : day.toLocaleDateString();

                            return <div key={dateStr} className={`w-4 h-4 rounded-sm ${color}`} title={tooltip} />;
                        })}
                    </div>
                </div>
            </div>
            <div className="flex justify-end items-center gap-4 mt-4 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                <span>Priority:</span>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-blue-400"></div><span>Low</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-yellow-400"></div><span>Medium</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-red-500"></div><span>High</span></div>
            </div>
        </Card>
    );
};

export default TasksHeatmap;