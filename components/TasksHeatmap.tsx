
import React, { useMemo } from 'react';
import { Task, TaskPriority } from '../types';
import Card from './Card';
import { parseDateAsUTC } from '../utils';

interface TasksHeatmapProps {
    tasks: Task[];
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
    'High': 'bg-red-500',
    'Medium': 'bg-yellow-400',
    'Low': 'bg-blue-400',
};
const NO_TASK_COLOR = 'bg-gray-200 dark:bg-gray-700';
const PRIORITY_ORDER: Record<TaskPriority, number> = { 'High': 3, 'Medium': 2, 'Low': 1 };

const TasksHeatmap: React.FC<TasksHeatmapProps> = ({ tasks }) => {

    const { gridDays, monthLabels, tasksByDate, totalColumns } = useMemo(() => {
        const now = new Date();
        // Start from the 1st of the current month in UTC to avoid timezone offsets affecting "1st"
        const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        
        // Show 12 full months roughly (53 weeks cover a year + a bit)
        const endDate = new Date(startDate);
        endDate.setUTCFullYear(endDate.getUTCFullYear() + 1);
        endDate.setUTCDate(0); // Back up to last day of previous month

        const tasksByDate = new Map<string, { priority: TaskPriority, count: number }>();
        tasks.forEach(task => {
            if (task.dueDate) {
                const taskDate = parseDateAsUTC(task.dueDate);

                if (taskDate >= startDate && taskDate <= endDate) {
                    const dateStr = task.dueDate;
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

        const allDays: Date[] = [];
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            allDays.push(new Date(currentDate));
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }

        // Logic to make Monday the first day of the week (Row 0)
        // getUTCDay() returns 0 for Sunday. We want Mon=0, Tue=1... Sun=6.
        const startDayOfWeek = (startDate.getUTCDay() + 6) % 7;
        
        // Pad the start
        const paddedDays: (Date | null)[] = [...Array(startDayOfWeek).fill(null), ...allDays];

        const monthLabels: { label: string; colStart: number }[] = [];
        let lastMonth = -1;

        paddedDays.forEach((day, index) => {
            if (day) {
                const month = day.getUTCMonth();
                if (month !== lastMonth) {
                    // Calculate column index (0-based)
                    const colIndex = Math.floor(index / 7);
                    const currentColStart = colIndex + 1;
                    
                    // Only add label if it's not too close to the previous one to avoid overlap
                    const prevColStart = monthLabels.length > 0 ? monthLabels[monthLabels.length - 1].colStart : -10;
                    
                    // We need at least 3 columns gap to show the next label comfortably
                    if (currentColStart - prevColStart >= 3) {
                         monthLabels.push({ 
                            label: day.toLocaleString('default', { month: 'short', timeZone: 'UTC' }), 
                            colStart: currentColStart // Grid lines are 1-based
                        });
                        lastMonth = month;
                    }
                }
            }
        });
        
        const totalColumns = Math.ceil(paddedDays.length / 7);

        return { gridDays: paddedDays, monthLabels, tasksByDate, totalColumns };

    }, [tasks]);
    
    const todayStr = new Date().toISOString().split('T')[0];

    return (
        <Card>
            <h3 className="text-xl font-semibold mb-4">Task Priority Forecast (Upcoming Year)</h3>
            <div className="flex gap-2">
                {/* Day Labels (Monday Start) */}
                <div className="flex flex-col justify-between pt-5 pb-1 text-xs text-light-text-secondary dark:text-dark-text-secondary pr-1 h-[116px]">
                    <div className="h-3 leading-3">Mon</div>
                    <div className="h-3 leading-3">Wed</div>
                    <div className="h-3 leading-3">Fri</div>
                </div>
                
                <div className="overflow-x-auto pb-2 flex-1">
                    <div className="inline-block min-w-full">
                        {/* Month Labels */}
                        <div 
                            className="grid mb-1 h-4" 
                            style={{ 
                                gridTemplateColumns: `repeat(${totalColumns}, 14px)`,
                                gap: '4px'
                            }}
                        >
                            {monthLabels.map(({ label, colStart }) => (
                                <div 
                                    key={`${label}-${colStart}`} 
                                    className="text-xs text-left text-light-text-secondary dark:text-dark-text-secondary whitespace-nowrap" 
                                    style={{ gridColumnStart: colStart }}
                                >
                                    {label}
                                </div>
                            ))}
                        </div>

                        {/* Heatmap Grid */}
                        <div 
                            className="grid grid-rows-7 grid-flow-col" 
                            style={{ 
                                gridTemplateColumns: `repeat(${totalColumns}, 14px)`,
                                gap: '4px' 
                            }}
                        >
                            {gridDays.map((day, index) => {
                                if (!day) {
                                    return <div key={`pad-${index}`} className="w-[14px] h-[14px]" />;
                                }
                                const dateStr = day.toISOString().split('T')[0];
                                const isToday = dateStr === todayStr;
                                
                                const dayData = tasksByDate.get(dateStr);
                                const color = dayData ? PRIORITY_COLORS[dayData.priority] : NO_TASK_COLOR;
                                const tooltip = dayData
                                    ? `${day.toLocaleDateString('en-US', { timeZone: 'UTC' })}: ${dayData.count} task(s), highest: ${dayData.priority}`
                                    : day.toLocaleDateString('en-US', { timeZone: 'UTC' });

                                return (
                                    <div 
                                        key={dateStr} 
                                        className={`w-[14px] h-[14px] rounded-sm ${color} hover:opacity-80 transition-opacity ${isToday ? 'ring-2 ring-primary-500 dark:ring-primary-400 z-10' : ''}`} 
                                        title={isToday ? `Today - ${tooltip}` : tooltip} 
                                    />
                                );
                            })}
                        </div>
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
