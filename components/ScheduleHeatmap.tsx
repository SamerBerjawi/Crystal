
import React, { useMemo } from 'react';
// FIX: Import 'ScheduledItem' from '../types' as it is no longer exported from '../pages/Schedule'.
import { ScheduledItem } from '../types';
import { parseLocalDate, toLocalISOString } from '../utils';

// Define new color constants
const INCOME_COLOR = 'bg-green-500';
const EXPENSE_COLOR = 'bg-red-500';
const MIXED_COLOR = 'bg-purple-500';
const NO_ACTIVITY_COLOR = 'bg-gray-200 dark:bg-gray-700';
const TRANSFER_COLOR = 'bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-600';


// FIX: Define ScheduleHeatmapProps interface to resolve 'Cannot find name' error.
interface ScheduleHeatmapProps {
    items: ScheduledItem[];
}

const ScheduleHeatmap: React.FC<ScheduleHeatmapProps> = ({ items }) => {

    const { gridDays, monthLabels, itemsByDate, totalColumns } = useMemo(() => {
        const now = new Date();
        // Start from the 1st of the current month in LOCAL time
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        
        // Show 12 full months roughly (covers a year + a bit)
        const endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
        endDate.setDate(0); // Back up to last day of previous month

        const itemsByDate = new Map<string, { incomeCount: number, expenseCount: number, transferCount: number }>();

        items.forEach(item => {
            const itemDate = parseLocalDate(item.date);
            if (itemDate >= startDate && itemDate <= endDate) {
                // Re-format date to ensure consistency with grid date strings (YYYY-MM-DD)
                const dateStr = item.date; // Assuming item.date is already YYYY-MM-DD
                
                const existing = itemsByDate.get(dateStr) || { incomeCount: 0, expenseCount: 0, transferCount: 0 };
                
                if (item.isTransfer) {
                    existing.transferCount += 1;
                } else if (item.amount > 0) {
                    existing.incomeCount += 1;
                } else {
                    existing.expenseCount += 1;
                }
                itemsByDate.set(dateStr, existing);
            }
        });

        const allDays: Date[] = [];
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            allDays.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Logic to make Monday the first day of the week (Row 0)
        // getDay() returns 0 for Sunday. We want Mon=0, Tue=1... Sun=6.
        const startDayOfWeek = (startDate.getDay() + 6) % 7;
        
        // Pad the start
        const paddedDays: (Date | null)[] = [...Array(startDayOfWeek).fill(null), ...allDays];

        const monthLabels: { label: string; colStart: number }[] = [];
        let lastMonth = -1;
        
        paddedDays.forEach((day, index) => {
            if (day) {
                const month = day.getMonth();
                if (month !== lastMonth) {
                    // Calculate column index (0-based)
                    const colIndex = Math.floor(index / 7);
                    const currentColStart = colIndex + 1;

                    // Only add label if it's not too close to the previous one to avoid overlap
                    const prevColStart = monthLabels.length > 0 ? monthLabels[monthLabels.length - 1].colStart : -10;

                    if (currentColStart - prevColStart >= 3) {
                        monthLabels.push({ 
                            label: day.toLocaleString('default', { month: 'short' }), 
                            colStart: currentColStart 
                        });
                        lastMonth = month;
                    }
                }
            }
        });

        const totalColumns = Math.ceil(paddedDays.length / 7);

        return { gridDays: paddedDays, monthLabels, itemsByDate, totalColumns };

    }, [items]);

    const todayStr = toLocalISOString(new Date());

    const getActivityColor = (dayData?: { incomeCount: number, expenseCount: number, transferCount: number }): string => {
        if (!dayData || (dayData.incomeCount === 0 && dayData.expenseCount === 0 && dayData.transferCount === 0)) {
            return NO_ACTIVITY_COLOR;
        }
        if (dayData.transferCount > 0) {
            return TRANSFER_COLOR;
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
    
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <div className="w-full flex flex-col items-center gap-3">
            <div className="overflow-x-auto w-full flex justify-center">
                <div
                    className="inline-grid"
                    style={{
                        gridTemplateColumns: `28px repeat(${totalColumns}, 14px)`,
                        gridTemplateRows: `16px repeat(7, 14px)`,
                        columnGap: '4px',
                        rowGap: '4px'
                    }}
                >
                    {/* Month Labels */}
                    {monthLabels.map(({ label, colStart }) => (
                        <div
                            key={`${label}-${colStart}`}
                            className="text-xs text-left text-light-text-secondary dark:text-dark-text-secondary whitespace-nowrap"
                            style={{ gridColumnStart: colStart + 1, gridRowStart: 1 }}
                        >
                            {label}
                        </div>
                    ))}

                    {/* Day Labels */}
                    {dayLabels.map((day, index) => (
                        <div
                            key={day}
                            className="text-xs text-right pr-1 text-light-text-secondary dark:text-dark-text-secondary"
                            style={{ gridColumnStart: 1, gridRowStart: index + 2 }}
                        >
                            {day}
                        </div>
                    ))}

                    {/* Heatmap Grid */}
                    {gridDays.map((day, index) => {
                        const colIndex = Math.floor(index / 7);
                        const rowIndex = index % 7;

                        if (!day) {
                            return (
                                <div
                                    key={`pad-${index}`}
                                    className="w-[14px] h-[14px]"
                                    style={{ gridColumnStart: colIndex + 2, gridRowStart: rowIndex + 2 }}
                                />
                            );
                        }

                        const dateStr = toLocalISOString(day);
                        const isToday = dateStr === todayStr;
                        const dayData = itemsByDate.get(dateStr);
                        const color = getActivityColor(dayData);

                        let tooltip = day.toLocaleDateString();
                        if (dayData) {
                            const parts = [];
                            if (dayData.transferCount > 0) parts.push(`${dayData.transferCount} transfer(s)`);
                            if (dayData.incomeCount > 0) parts.push(`${dayData.incomeCount} income`);
                            if (dayData.expenseCount > 0) parts.push(`${dayData.expenseCount} expense(s)`);
                            tooltip = `${day.toLocaleDateString()}: ${parts.join(', ')}`;
                        }

                        return (
                            <div
                                key={dateStr}
                                className={`w-[14px] h-[14px] rounded-sm ${color} hover:opacity-80 transition-opacity ${isToday ? 'ring-2 ring-primary-500 dark:ring-primary-400 z-10' : ''}`}
                                style={{ gridColumnStart: colIndex + 2, gridRowStart: rowIndex + 2 }}
                                title={isToday ? `Today - ${tooltip}` : tooltip}
                            />
                        );
                    })}
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap justify-center items-center gap-4 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                <div className="flex items-center gap-1"><div className={`w-3 h-3 rounded-sm ${NO_ACTIVITY_COLOR}`}></div><span>No Activity</span></div>
                <div className="flex items-center gap-1"><div className={`w-3 h-3 rounded-sm ${TRANSFER_COLOR}`}></div><span>Transfer</span></div>
                <div className="flex items-center gap-1"><div className={`w-3 h-3 rounded-sm ${INCOME_COLOR}`}></div><span>Income</span></div>
                <div className="flex items-center gap-1"><div className={`w-3 h-3 rounded-sm ${EXPENSE_COLOR}`}></div><span>Expense</span></div>
                <div className="flex items-center gap-1"><div className={`w-3 h-3 rounded-sm ${MIXED_COLOR}`}></div><span>Mixed</span></div>
            </div>
        </div>
    );
};

export default ScheduleHeatmap;
