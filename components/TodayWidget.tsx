
import React, { useMemo } from 'react';
import { Task, RecurringTransaction, BillPayment, FinancialGoal, RecurringTransactionOverride } from '../types';
import { parseDateAsUTC, formatCurrency, toLocalISOString } from '../utils';

interface TodayWidgetProps {
    tasks: Task[];
    recurringTransactions: RecurringTransaction[];
    bills: BillPayment[];
    goals: FinancialGoal[];
    overrides: RecurringTransactionOverride[];
    onTaskUpdate: (task: Task) => void;
    onProcessItem: (item: RecurringTransaction | BillPayment) => void;
}

type AgendaItem = 
    | { type: 'task'; data: Task; date: Date; sortDate: number }
    | { type: 'recurring'; data: RecurringTransaction; date: Date; sortDate: number }
    | { type: 'bill'; data: BillPayment; date: Date; sortDate: number }
    | { type: 'goal'; data: FinancialGoal; date: Date; sortDate: number };

const TodayWidget: React.FC<TodayWidgetProps> = ({ 
    tasks, 
    recurringTransactions, 
    bills, 
    goals,
    overrides = [],
    onTaskUpdate,
    onProcessItem
}) => {
    const agendaItems = useMemo(() => {
        const items: AgendaItem[] = [];
        // Get today's date as a local YYYY-MM-DD string for strict comparison
        const todayStr = toLocalISOString(new Date());
        const todayDate = parseDateAsUTC(todayStr); // UTC Midnight representation of Today

        const isToday = (dateStr: string) => dateStr === todayStr;

        // Tasks
        tasks.forEach(task => {
            if (task.status !== 'Done' && task.dueDate) {
                if (isToday(task.dueDate)) {
                    const date = parseDateAsUTC(task.dueDate);
                    items.push({ type: 'task', data: task, date, sortDate: date.getTime() });
                }
            }
        });

        // Bills
        bills.forEach(bill => {
            if (bill.status === 'unpaid') {
                if (isToday(bill.dueDate)) {
                    const date = parseDateAsUTC(bill.dueDate);
                    items.push({ type: 'bill', data: bill, date, sortDate: date.getTime() });
                }
            }
        });

        // Recurring Transactions
        recurringTransactions.forEach(rt => {
            let nextDue = parseDateAsUTC(rt.nextDueDate);
            const startDate = parseDateAsUTC(rt.startDate);
            const endDateUTC = rt.endDate ? parseDateAsUTC(rt.endDate) : null;
            
            // Safety limit to prevent infinite loops if data is corrupted
            let iterations = 0;
            const maxIterations = 366; // Scan at most a year ahead/catchup

            // If the base nextDueDate is way in the future, we don't need to loop
            if (nextDue > todayDate && !isToday(rt.nextDueDate)) {
                // Optimization: Skip
                return;
            }

            // Loop to catch up overdue items or find if any occurrence is today
            while (iterations < maxIterations) {
                const dateStr = toLocalISOString(nextDue);
                
                // If we've passed today, stop checking this transaction
                if (dateStr > todayStr) break;
                
                // Check end date
                if (endDateUTC && nextDue > endDateUTC) break;

                // Check for overrides on this specific date
                const override = overrides.find(o => o.recurringTransactionId === rt.id && o.originalDate === dateStr);
                
                if (!override?.isSkipped) {
                    // Use overridden date if present, otherwise the calculated schedule date
                    const effectiveDateStr = override?.date || dateStr;
                    
                    if (isToday(effectiveDateStr)) {
                        // Found an item for today!
                        const effectiveData = override ? { 
                            ...rt, 
                            amount: override.amount ?? rt.amount, 
                            description: override.description ?? rt.description 
                        } : rt;
                        
                        items.push({ type: 'recurring', data: effectiveData, date: todayDate, sortDate: todayDate.getTime() });
                        
                        // We found today's instance, usually we stop here unless there are multiple per day
                        break; 
                    }
                }
                
                // Advance Date using local methods to ensure consistent date string generation
                const interval = rt.frequencyInterval || 1;
                const d = new Date(nextDue);
                if (rt.frequency === 'monthly') {
                    const targetDay = rt.dueDateOfMonth || startDate.getDate();
                    d.setMonth(d.getMonth() + interval);
                    // Handle month length logic using local date
                    const year = d.getFullYear();
                    const month = d.getMonth();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    d.setDate(Math.min(targetDay, daysInMonth));
                }
                else if (rt.frequency === 'weekly') d.setDate(d.getDate() + (7 * interval));
                else if (rt.frequency === 'daily') d.setDate(d.getDate() + interval);
                else if (rt.frequency === 'yearly') d.setFullYear(d.getFullYear() + interval);
                nextDue = d;
                iterations++;
            }
        });

        // Goals (Deadline today)
        goals.forEach(goal => {
            if (goal.type === 'one-time' && goal.date && goal.currentAmount < goal.amount) {
                if (isToday(goal.date)) {
                    const date = parseDateAsUTC(goal.date);
                    items.push({ type: 'goal', data: goal, date, sortDate: date.getTime() });
                }
            }
        });

        return items.sort((a, b) => a.sortDate - b.sortDate);
    }, [tasks, recurringTransactions, bills, goals, overrides]);

    const handleTaskToggle = (task: Task) => {
        onTaskUpdate({ ...task, status: 'Done' });
    };

    if (agendaItems.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-100 dark:border-blue-800/30">
                <div className="w-16 h-16 bg-white dark:bg-white/10 rounded-full flex items-center justify-center mb-4 shadow-sm">
                    <span className="material-symbols-outlined text-4xl text-blue-500">wb_sunny</span>
                </div>
                <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100">Nothing Due Today</h3>
                <p className="text-sm text-blue-700/70 dark:text-blue-300/70 mt-1">
                    You have no tasks or payments scheduled for today.
                </p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-0 overflow-hidden bg-white dark:bg-dark-card">
            <div className="p-4 border-b border-black/5 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-white/[0.02]">
                <h3 className="font-bold text-light-text dark:text-dark-text flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary-500">today</span>
                    Today's Agenda
                </h3>
                <span className="bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-bold px-2 py-0.5 rounded-full">
                    {agendaItems.length}
                </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                {agendaItems.map((item) => {
                    if (item.type === 'task') {
                        return (
                            <div key={`task-${item.data.id}`} className="flex items-center p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors group border border-transparent hover:border-black/5 dark:hover:border-white/10">
                                <button 
                                    onClick={() => handleTaskToggle(item.data)}
                                    className="w-5 h-5 rounded border-2 border-gray-400 dark:border-gray-500 mr-3 flex items-center justify-center hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-light-text dark:text-dark-text truncate">{item.data.title}</p>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[10px]">check_circle</span> Task
                                    </p>
                                </div>
                            </div>
                        );
                    }

                    if (item.type === 'bill' || item.type === 'recurring') {
                        const isBill = item.type === 'bill';
                        const data = item.data as (BillPayment | RecurringTransaction);
                        const amount = Math.abs(data.amount);
                        const currency = (data as any).currency || 'EUR';
                        const description = data.description;
                        
                        return (
                            <div key={`${item.type}-${data.id}`} className="flex items-center p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors group border border-transparent hover:border-black/5 dark:hover:border-white/10">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 shrink-0 ${isBill ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                    <span className="material-symbols-outlined text-lg">{isBill ? 'receipt' : 'update'}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-light-text dark:text-dark-text truncate">{description}</p>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
                                        {formatCurrency(amount, currency)}
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                     <button 
                                        onClick={() => onProcessItem(data)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-primary-500 text-white px-2 py-1 rounded hover:bg-primary-600"
                                    >
                                        {isBill ? 'Pay' : 'Post'}
                                    </button>
                                </div>
                            </div>
                        );
                    }

                    if (item.type === 'goal') {
                        return (
                            <div key={`goal-${item.data.id}`} className="flex items-center p-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/50">
                                 <div className="w-8 h-8 rounded-lg flex items-center justify-center mr-3 shrink-0 bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400">
                                    <span className="material-symbols-outlined text-lg">flag</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-light-text dark:text-dark-text truncate">{item.data.name}</p>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Goal Target Date</p>
                                </div>
                            </div>
                        );
                    }
                    return null;
                })}
            </div>
        </div>
    );
};

export default TodayWidget;
