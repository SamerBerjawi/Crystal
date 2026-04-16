import React, { useState, useMemo } from 'react';
import { ScheduledItem, FinancialGoal, Account, Currency } from '../types';
import { formatCurrency, parseLocalDate, toLocalISOString, convertToEur } from '../utils';
import Card from './Card';

interface CalendarViewProps {
    items: ScheduledItem[];
    goals: FinancialGoal[];
    accounts: Account[];
    onEditItem: (item: ScheduledItem) => void;
    onPostItem: (item: ScheduledItem) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ items, goals, accounts, onEditItem, onPostItem }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const accountMap = useMemo(() => accounts.reduce((acc, current) => {
        acc[current.id] = current.name;
        return acc;
    }, {} as Record<string, string>), [accounts]);

    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDate = new Date(monthStart);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // Start from Sunday
    const endDate = new Date(monthEnd);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay())); // End on Saturday

    const calendarDays = useMemo(() => {
        const days = [];
        let day = new Date(startDate);
        while (day <= endDate) {
            days.push(new Date(day));
            day.setDate(day.getDate() + 1);
        }
        return days;
    }, [startDate, endDate]);

    const itemsByDate = useMemo(() => {
        const map: Record<string, ScheduledItem[]> = {};
        items.forEach(item => {
            if (!map[item.date]) map[item.date] = [];
            map[item.date].push(item);
        });
        return map;
    }, [items]);

    const goalOccurrences = useMemo(() => {
        const occurrences: Record<string, any[]> = {};
        goals.forEach(goal => {
            if (goal.type === 'one-time' && goal.date) {
                if (!occurrences[goal.date]) occurrences[goal.date] = [];
                occurrences[goal.date].push({ ...goal, isGoal: true });
            } else if (goal.type === 'recurring' && goal.startDate && goal.frequency) {
                let nextDate = parseLocalDate(goal.startDate);
                const forecastEnd = new Date(monthEnd);
                forecastEnd.setMonth(forecastEnd.getMonth() + 1); // Buffer

                while (nextDate <= forecastEnd) {
                    const dateStr = toLocalISOString(nextDate);
                    if (dateStr >= toLocalISOString(monthStart) && dateStr <= toLocalISOString(monthEnd)) {
                        if (!occurrences[dateStr]) occurrences[dateStr] = [];
                        occurrences[dateStr].push({ ...goal, isGoal: true });
                    }
                    
                    const d = new Date(nextDate);
                    if (goal.frequency === 'monthly') {
                        d.setMonth(d.getMonth() + 1);
                        if (goal.dueDateOfMonth) {
                            const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
                            d.setDate(Math.min(goal.dueDateOfMonth, lastDay));
                        }
                    } else if (goal.frequency === 'weekly') {
                        d.setDate(d.getDate() + 7);
                    } else if (goal.frequency === 'daily') {
                        d.setDate(d.getDate() + 1);
                    } else if (goal.frequency === 'yearly') {
                        d.setFullYear(d.getFullYear() + 1);
                    }
                    nextDate = d;
                    if (goal.endDate && nextDate > parseLocalDate(goal.endDate)) break;
                }
            }
        });
        return occurrences;
    }, [goals, monthStart, monthEnd]);

    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const goToToday = () => setCurrentDate(new Date());

    const todayStr = toLocalISOString(new Date());

    return (
        <Card className="p-0 overflow-hidden border-none shadow-xl bg-white dark:bg-dark-card">
            <div className="p-6 border-b border-black/5 dark:border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50/50 dark:bg-white/5">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-black tracking-tight text-light-text dark:text-dark-text">
                        {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </h2>
                    <div className="flex bg-white dark:bg-dark-fill rounded-lg p-1 shadow-sm border border-black/5 dark:border-white/5">
                        <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors">
                            <span className="material-symbols-outlined text-xl">chevron_left</span>
                        </button>
                        <button onClick={goToToday} className="px-3 py-1 text-xs font-bold uppercase tracking-wider hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors">
                            Today
                        </button>
                        <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors">
                            <span className="material-symbols-outlined text-xl">chevron_right</span>
                        </button>
                    </div>
                </div>
                
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Income</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Expense</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Transfer</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Goal</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-7 bg-gray-100 dark:bg-white/5 gap-px">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="bg-gray-50 dark:bg-dark-card p-3 text-center">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary">
                            {day}
                        </span>
                    </div>
                ))}

                {calendarDays.map((date, idx) => {
                    const dateStr = toLocalISOString(date);
                    const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                    const isToday = dateStr === todayStr;
                    const dayItems = itemsByDate[dateStr] || [];
                    const dayGoals = goalOccurrences[dateStr] || [];

                    return (
                        <div 
                            key={idx} 
                            className={`min-h-[140px] bg-white dark:bg-dark-card p-2 transition-colors hover:bg-gray-50/50 dark:hover:bg-white/[0.02] group ${!isCurrentMonth ? 'opacity-40' : ''}`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-sm font-mono font-bold w-7 h-7 flex items-center justify-center rounded-full transition-colors ${isToday ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30' : 'text-light-text-secondary dark:text-dark-text-secondary group-hover:text-primary-500'}`}>
                                    {date.getDate()}
                                </span>
                            </div>

                            <div className="space-y-1">
                                {dayItems.map(item => {
                                    const isIncome = item.type === 'income' || item.type === 'deposit';
                                    const isTransfer = item.type === 'transfer';
                                    const isSkipped = item.isSkipped;
                                    const colorClass = isTransfer ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-100 dark:border-blue-800/30' : 
                                                     isIncome ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800/30' : 
                                                     'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300 border-rose-100 dark:border-rose-800/30';
                                    
                                    return (
                                        <div 
                                            key={item.id}
                                            className={`group/item relative px-1.5 py-1 rounded border text-[10px] font-bold transition-all hover:shadow-sm ${colorClass} ${isSkipped ? 'opacity-50 line-through' : ''}`}
                                        >
                                            <div className="flex justify-between items-center gap-1">
                                                <span 
                                                    className="truncate cursor-pointer flex-grow" 
                                                    onClick={() => onEditItem(item)}
                                                    title={`${item.description}: ${formatCurrency(item.amount, (item.originalItem as any).currency)}`}
                                                >
                                                    {item.description}
                                                </span>
                                                {!isSkipped && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); onPostItem(item); }}
                                                        className="opacity-0 group-hover/item:opacity-100 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-opacity"
                                                        title="Post Transaction"
                                                    >
                                                        <span className="material-symbols-outlined text-[12px]">check</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {dayGoals.map(goal => (
                                    <div 
                                        key={goal.id}
                                        className="px-1.5 py-1 rounded border border-amber-100 dark:border-amber-800/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 text-[10px] font-bold truncate cursor-default flex items-center gap-1"
                                        title={`Goal: ${goal.name} - Contribution: ${formatCurrency(goal.monthlyContribution || 0, goal.currency)}`}
                                    >
                                        <span className="material-symbols-outlined text-[12px]">track_changes</span>
                                        <span className="truncate">{goal.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
};

export default CalendarView;
