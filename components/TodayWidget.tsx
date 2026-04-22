
import React, { useMemo } from 'react';
import { Task, RecurringTransaction, BillPayment, FinancialGoal, RecurringTransactionOverride } from '../types';
import { parseLocalDate, formatCurrency, toLocalISOString } from '../utils';

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
        const todayDate = parseLocalDate(todayStr); // Local midnight representation of Today

        const isToday = (dateStr: string) => dateStr === todayStr;

        // Tasks
        tasks.forEach(task => {
            if (task.status !== 'Done' && task.dueDate) {
                if (isToday(task.dueDate)) {
                    const date = parseLocalDate(task.dueDate);
                    items.push({ type: 'task', data: task, date, sortDate: date.getTime() });
                }
            }
        });

        // Bills
        bills.forEach(bill => {
            if (bill.status === 'unpaid') {
                if (isToday(bill.dueDate)) {
                    const date = parseLocalDate(bill.dueDate);
                    items.push({ type: 'bill', data: bill, date, sortDate: date.getTime() });
                }
            }
        });

        // Recurring Transactions
        recurringTransactions.forEach(rt => {
            let nextDue = parseLocalDate(rt.nextDueDate);
            const startDateLocal = parseLocalDate(rt.startDate);
            const endDateLocal = rt.endDate ? parseLocalDate(rt.endDate) : null;
            
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
                if (endDateLocal && nextDue > endDateLocal) break;

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
                
                // Advance Date using local methods to align with device timezone
                const interval = rt.frequencyInterval || 1;
                const d = new Date(nextDue);
                if (rt.frequency === 'monthly') {
                    const targetDay = rt.dueDateOfMonth || startDateLocal.getDate();
                    d.setMonth(d.getMonth() + interval);
                    // Handle month end logic (e.g. Jan 31 -> Feb 28)
                    const year = d.getFullYear();
                    const month = d.getMonth();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    d.setDate(Math.min(targetDay, daysInMonth));
                } else if (rt.frequency === 'weekly') {
                    d.setDate(d.getDate() + (7 * interval));
                } else if (rt.frequency === 'daily') {
                    d.setDate(d.getDate() + interval);
                } else if (rt.frequency === 'yearly') {
                    d.setFullYear(d.getFullYear() + interval);
                }
                nextDue = d;
                iterations++;
            }
        });

        // Goals (Deadline today)
        goals.forEach(goal => {
            if (goal.type === 'one-time' && goal.date && goal.currentAmount < goal.amount) {
                if (isToday(goal.date)) {
                    const date = parseLocalDate(goal.date);
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
            <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-white/40 dark:bg-dark-card/20 backdrop-blur-xl border border-black/5 dark:border-white/5 rounded-[2rem] relative overflow-hidden group">
                <div className="absolute -right-20 -bottom-20 w-64 h-64 rounded-full bg-primary-500/5 blur-[100px] pointer-events-none group-hover:bg-primary-500/10 transition-all duration-700"></div>
                
                <div className="relative z-10">
                    <div className="w-20 h-20 bg-white/50 dark:bg-white/5 rounded-[2rem] flex items-center justify-center mb-6 shadow-xl border border-white/20">
                        <span className="material-symbols-outlined text-5xl text-primary-500 animate-pulse">wb_sunny</span>
                    </div>
                    <h3 className="text-sm font-black text-light-text dark:text-dark-text uppercase tracking-[0.3em] mb-2 leading-none">Status: Clear</h3>
                    <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-40">
                        All systems operational. No items due today.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-6 bg-white/40 dark:bg-dark-card/20 backdrop-blur-xl border border-black/5 dark:border-white/5 rounded-[2rem] relative overflow-hidden">
            <div className="absolute -left-20 -top-20 w-64 h-64 rounded-full bg-primary-500/5 blur-[100px] pointer-events-none"></div>

            <div className="mb-6 flex justify-between items-center relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-primary-500 text-white flex items-center justify-center shadow-lg shadow-primary-500/30">
                        <span className="material-symbols-outlined text-lg filled-icon">today</span>
                    </div>
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-light-text dark:text-dark-text leading-tight">Agenda</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="w-1 h-1 rounded-full bg-primary-500 animate-pulse"></span>
                            <span className="text-[9px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-40">Real-time sync</span>
                        </div>
                    </div>
                </div>
                <div className="px-3 py-1 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 flex items-center gap-2">
                    <span className="text-[10px] font-black font-mono text-primary-500">{agendaItems.length}</span>
                    <span className="text-[8px] font-black uppercase tracking-widest opacity-40">Nodes</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1 relative z-10">
                {agendaItems.map((item) => {
                    if (item.type === 'task') {
                        return (
                            <div key={`task-${item.data.id}`} className="flex items-center p-4 rounded-2xl bg-white/50 dark:bg-white/5 border border-black/5 dark:border-white/5 hover:border-primary-500/30 hover:bg-white/80 dark:hover:bg-white/10 transition-all duration-300 group">
                                <button 
                                    onClick={() => handleTaskToggle(item.data)}
                                    className="w-6 h-6 rounded-lg border-2 border-black/10 dark:border-white/10 mr-4 flex items-center justify-center hover:border-primary-500 hover:bg-primary-500/10 transition-all duration-300 group-hover:scale-110"
                                >
                                    <span className="material-symbols-outlined text-primary-500 text-sm opacity-0 hover:opacity-100">check</span>
                                </button>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-black text-light-text dark:text-dark-text uppercase tracking-widest truncate leading-tight mb-1">{item.data.title}</p>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1 h-1 rounded-full bg-emerald-500"></div>
                                        <p className="text-[8px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-40">Active Task Node</p>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    if (item.type === 'bill' || item.type === 'recurring') {
                        const isBill = item.type === 'bill';
                        const data = item.data as (BillPayment | RecurringTransaction);
                        const amount = Math.abs(data.amount);
                        const currency = (data as any).currency || 'EUR';
                        
                        return (
                            <div key={`${item.type}-${data.id}`} className="flex items-center p-4 rounded-2xl bg-white/50 dark:bg-white/5 border border-black/5 dark:border-white/5 hover:border-amber-500/30 hover:bg-white/80 dark:hover:bg-white/10 transition-all duration-300 group">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 shrink-0 shadow-sm ${isBill ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' : 'bg-primary-500/10 text-primary-600 border border-primary-500/20'}`}>
                                    <span className="material-symbols-outlined text-xl filled-icon">{isBill ? 'receipt' : 'update'}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-black text-light-text dark:text-dark-text uppercase tracking-widest truncate leading-tight mb-1">{data.description}</p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-[10px] font-black text-light-text dark:text-dark-text font-mono tracking-tighter opacity-80">
                                            {formatCurrency(amount, currency)}
                                        </p>
                                        <span className="w-3 h-px bg-black/10 dark:bg-white/10"></span>
                                        <p className="text-[8px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-[0.15em] opacity-40">{isBill ? 'Invoice' : 'Recurring'}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => onProcessItem(data)}
                                    className="opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300 text-[9px] font-black uppercase tracking-widest bg-primary-500 text-white px-3 py-1.5 rounded-full shadow-lg shadow-primary-500/30 hover:bg-primary-600"
                                >
                                    {isBill ? 'Execute' : 'Commit'}
                                </button>
                            </div>
                        );
                    }

                    if (item.type === 'goal') {
                        return (
                            <div key={`goal-${item.data.id}`} className="flex items-center p-4 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 group">
                                 <div className="w-10 h-10 rounded-xl flex items-center justify-center mr-4 shrink-0 bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
                                    <span className="material-symbols-outlined text-xl filled-icon">flag</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-black text-light-text dark:text-dark-text uppercase tracking-widest truncate leading-tight mb-1">{item.data.name}</p>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                                        <p className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Milestone Target Met</p>
                                    </div>
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
