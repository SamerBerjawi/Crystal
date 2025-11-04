import React, { useMemo } from 'react';
import { ScheduledItem } from '../pages/Schedule';
import Card from './Card';
import { RecurringTransaction } from '../types';

// Define new color constants
const INCOME_COLOR = 'bg-green-500';
const EXPENSE_COLOR = 'bg-red-500';
const MIXED_COLOR = 'bg-purple-500';
const NO_ACTIVITY_COLOR = 'bg-gray-200 dark:bg-gray-800';

// FIX: Define ScheduleHeatmapProps interface to resolve 'Cannot find name' error.
interface ScheduleHeatmapProps {
    items: ScheduledItem[];
}

const ScheduleHeatmap: React.FC<ScheduleHeatmapProps> = ({ items }) => {

    const { gridDays, monthLabels, itemsByDate } = useMemo(() => {
        const today = new Date();
        const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
        endDate.setDate(0);
        endDate.setHours(23, 59, 59, 999);

        const allOccurrences: ScheduledItem[] = [];

        // Helper to parse date string as UTC midnight to avoid timezone issues
        const parseAsUTC = (dateString: string): Date => {
            const [year, month, day] = dateString.split('-').map(Number);
            return new Date(Date.UTC(year, month - 1, day));
        };

        items.forEach(item => {
            if (!item.isRecurring) {
                const itemDate = parseAsUTC(item.date);
                if (itemDate >= startDate && itemDate <= endDate) {
                    allOccurrences.push(item);
                }
            } else {
                const rt = item.originalItem as RecurringTransaction;
                let nextDate = parseAsUTC(rt.nextDueDate);
                const endDateUTC = rt.endDate ? parseAsUTC(rt.endDate) : null;
                const startDateUTC = parseAsUTC(rt.startDate);

                // Fast-forward to the first occurrence within or after the display window starts
                while (nextDate < startDate && (!endDateUTC || nextDate < endDateUTC)) {
                    const interval = rt.frequencyInterval || 1;
                    switch (rt.frequency) {
                        case 'daily':
                            nextDate.setUTCDate(nextDate.getUTCDate() + interval);
                            break;
                        case 'weekly':
                            nextDate.setUTCDate(nextDate.getUTCDate() + 7 * interval);
                            break;
                        case 'monthly': {
                            const d = rt.dueDateOfMonth || startDateUTC.getUTCDate();
                            nextDate.setUTCMonth(nextDate.getUTCMonth() + interval, 1);
                            const lastDayOfNextMonth = new Date(Date.UTC(nextDate.getUTCFullYear(), nextDate.getUTCMonth() + 1, 0)).getUTCDate();
                            nextDate.setUTCDate(Math.min(d, lastDayOfNextMonth));
                            break;
                        }
                        case 'yearly': {
                            const d = rt.dueDateOfMonth || startDateUTC.getUTCDate();
                            const m = startDateUTC.getUTCMonth();
                            nextDate.setUTCFullYear(nextDate.getUTCFullYear() + interval);
                            const lastDayOfNextMonth = new Date(Date.UTC(nextDate.getUTCFullYear(), m + 1, 0)).getUTCDate();
                            nextDate.setUTCMonth(m, Math.min(d, lastDayOfNextMonth));
                            break;
                        }
                    }
                }

                // Now generate all occurrences until the end of the display window
                while (nextDate <= endDate && (!endDateUTC || nextDate <= endDateUTC)) {
                    allOccurrences.push({
                        ...item,
                        id: `${item.id}-${nextDate.toISOString()}`,
                        date: nextDate.toISOString().split('T')[0],
                    });
                    
                    const interval = rt.frequencyInterval || 1;
                    switch (rt.frequency) {
                        case 'daily':
                            nextDate.setUTCDate(nextDate.getUTCDate() + interval);
                            break;
                        case 'weekly':
                            nextDate.setUTCDate(nextDate.getUTCDate() + 7 * interval);
                            break;
                        case 'monthly': {
                            const d = rt.dueDateOfMonth || startDateUTC.getUTCDate();
                            nextDate.setUTCMonth(nextDate.getUTCMonth() + interval, 1);
                            const lastDayOfNextMonth = new Date(Date.UTC(nextDate.getUTCFullYear(), nextDate.getUTCMonth() + 1, 0)).getUTCDate();
                            nextDate.setUTCDate(Math.min(d, lastDayOfNextMonth));
                            break;
                        }
                        case 'yearly': {
                            const d = rt.dueDateOfMonth || startDateUTC.getUTCDate();
                            const m = startDateUTC.getUTCMonth();
                            nextDate.setUTCFullYear(nextDate.getUTCFullYear() + interval);
                            const lastDayOfNextMonth = new Date(Date.UTC(nextDate.getUTCFullYear(), m + 1, 0)).getUTCDate();
                            nextDate.setUTCMonth(m, Math.min(d, lastDayOfNextMonth));
                            break;
                        }
                    }
                }
            }
        });

        const itemsByDate = new Map<string, { incomeCount: number, expenseCount: number }>();
        allOccurrences.forEach(item => {
            const itemDate = parseAsUTC(item.date);
            if (itemDate >= startDate && itemDate <= endDate) {
                const dateStr = itemDate.toISOString().split('T')[0];
                const existing = itemsByDate.get(dateStr) || { incomeCount: 0, expenseCount: 0 };
                
                if (item.amount > 0) {
                    existing.incomeCount += 1;
                } else {
                    existing.expenseCount += 1;
                }
                itemsByDate.set(dateStr, existing);
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
                const weekIndex = Math.floor(index / 7);
                if (month !== lastMonth) {
                    if (monthLabels.length === 0 || weekIndex > monthLabels[monthLabels.length - 1].colStart + 2) {
                        monthLabels.push({ label: day.toLocaleString('default', { month: 'short' }), colStart: weekIndex + 1 });
                    }
                    lastMonth = month;
                }
            }
        });

        return { gridDays: paddedDays, monthLabels, itemsByDate };

    }, [items]);

    const getActivityColor = (dayData?: { incomeCount: number, expenseCount: number }): string => {
        if (!dayData || (dayData.incomeCount === 0 && dayData.expenseCount === 0)) {
            return NO_ACTIVITY_COLOR;
        }
        if (dayData.incomeCount > 0 && dayData.expenseCount > 0) {
            return MIXED_COLOR;
        }
        if (dayData.incomeCount > 0) {
            return INCOME_COLOR;
        }
        if (dayData.expenseCount > 0) {
            return EXPENSE_COLOR;
        }
        return NO_ACTIVITY_COLOR;
    };
    
    return (
        <Card>
            <h3 className="text-xl font-semibold mb-4">Schedule Activity (Next 12 Months)</h3>
            <div className="overflow-x-auto pb-2">
                <div className="inline-block">
                    <div className="grid grid-flow-col gap-x-1 mb-1 text-light-text-secondary dark:text-dark-text-secondary" style={{ gridTemplateColumns: `repeat(${monthLabels.length > 0 ? monthLabels[monthLabels.length - 1].colStart + 8 : 53}, 16px)` }}>
                       {monthLabels.map(({ label, colStart }) => (
                            <div key={label} className="text-xs text-left" style={{ gridColumnStart: colStart }}>
                                {label}
                            </div>
                       ))}
                    </div>
                    <div className="grid grid-flow-col grid-rows-7 gap-1" style={{ gridAutoColumns: '16px' }}>
                        {gridDays.map((day, index) => {
                            if (!day) {
                                return <div key={`pad-${index}`} className="w-4 h-4" />;
                            }
                            const dateStr = day.toISOString().split('T')[0];
                            const dayData = itemsByDate.get(dateStr);
                            const color = getActivityColor(dayData);
                            
                            let tooltip = day.toLocaleDateString();
                            if (dayData) {
                                const parts = [];
                                if (dayData.incomeCount > 0) parts.push(`${dayData.incomeCount} income`);
                                if (dayData.expenseCount > 0) parts.push(`${dayData.expenseCount} expense(s)`);
                                tooltip = `${day.toLocaleDateString()}: ${parts.join(', ')}`;
                            }

                            return <div key={dateStr} className={`w-4 h-4 rounded-sm ${color}`} title={tooltip} />;
                        })}
                    </div>
                </div>
            </div>
            {/* New Legend */}
            <div className="flex justify-end items-center gap-4 mt-4 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                <div className="flex items-center gap-1"><div className={`w-3 h-3 rounded-sm ${NO_ACTIVITY_COLOR}`}></div><span>No Activity</span></div>
                <div className="flex items-center gap-1"><div className={`w-3 h-3 rounded-sm ${INCOME_COLOR}`}></div><span>Income</span></div>
                <div className="flex items-center gap-1"><div className={`w-3 h-3 rounded-sm ${EXPENSE_COLOR}`}></div><span>Expense</span></div>
                <div className="flex items-center gap-1"><div className={`w-3 h-3 rounded-sm ${MIXED_COLOR}`}></div><span>Mixed</span></div>
            </div>
        </Card>
    );
};

export default ScheduleHeatmap;