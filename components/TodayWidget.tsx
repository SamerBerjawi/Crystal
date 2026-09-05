
import React, { useMemo } from 'react';
import { Task, RecurringTransaction, BillPayment, FinancialGoal, RecurringTransactionOverride } from '../types';
import { parseLocalDate, formatCurrency, toLocalISOString } from '../utils';
import Icon from './ui/Icon';

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
    | { type: 'task'; data: Task; date: Date; daysUntil: number; sortDate: number }
    | { type: 'recurring'; data: RecurringTransaction; date: Date; daysUntil: number; sortDate: number }
    | { type: 'bill'; data: BillPayment; date: Date; daysUntil: number; sortDate: number }
    | { type: 'goal'; data: FinancialGoal; date: Date; daysUntil: number; sortDate: number };

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
        const todayStr = toLocalISOString(new Date());
        const todayDate = parseLocalDate(todayStr); // Local midnight representation of Today

        const getDaysUntil = (dateStr: string) => {
            const d = parseLocalDate(dateStr);
            const diffTime = d.getTime() - todayDate.getTime();
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        };

        // Tasks (due in <= 3 days and >= -7 days)
        tasks.forEach(task => {
            if (task.status !== 'Done' && task.dueDate) {
                const days = getDaysUntil(task.dueDate);
                if (days <= 3 && days >= -7) {
                    const date = parseLocalDate(task.dueDate);
                    items.push({ type: 'task', data: task, date, daysUntil: days, sortDate: date.getTime() });
                }
            }
        });

        // Bills (unpaid and due in <= 3 days and >= -7 days)
        bills.forEach(bill => {
            if (bill.status === 'unpaid') {
                const days = getDaysUntil(bill.dueDate);
                if (days <= 3 && days >= -7) {
                    const date = parseLocalDate(bill.dueDate);
                    items.push({ type: 'bill', data: bill, date, daysUntil: days, sortDate: date.getTime() });
                }
            }
        });

        // Recurring Transactions (due in <= 3 days and >= -7 days)
        recurringTransactions.forEach(rt => {
            if (rt.type === 'income') return; // Only process bill/expense/transfer obligations
            if (!rt.nextDueDate) return;

            let nextDue = parseLocalDate(rt.nextDueDate);
            const startDateLocal = parseLocalDate(rt.startDate);
            const endDateLocal = rt.endDate ? parseLocalDate(rt.endDate) : null;
            
            let iterations = 0;
            const maxIterations = 366;

            while (iterations < maxIterations) {
                const dateStr = toLocalISOString(nextDue);
                const days = getDaysUntil(dateStr);
                
                // If we've scanned more than 3 days into the future, stop checking this transaction
                if (days > 3) break;
                if (endDateLocal && nextDue > endDateLocal) break;

                const override = overrides.find(o => o.recurringTransactionId === rt.id && o.originalDate === dateStr);
                
                if (!override?.isSkipped) {
                    const effectiveDateStr = override?.date || dateStr;
                    const effectiveDays = getDaysUntil(effectiveDateStr);
                    
                    if (effectiveDays <= 3 && effectiveDays >= -7) {
                        const effectiveData = override ? { 
                            ...rt, 
                            amount: override.amount ?? rt.amount, 
                            description: override.description ?? rt.description 
                        } : rt;
                        
                        items.push({ type: 'recurring', data: effectiveData, date: parseLocalDate(effectiveDateStr), daysUntil: effectiveDays, sortDate: parseLocalDate(effectiveDateStr).getTime() });
                        break; 
                    }
                }
                
                const interval = rt.frequencyInterval || 1;
                const d = new Date(nextDue);
                if (rt.frequency === 'monthly') {
                    const targetDay = rt.dueDateOfMonth || startDateLocal.getDate();
                    d.setMonth(d.getMonth() + interval);
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

        // Goals (Deadline within 3 days)
        goals.forEach(goal => {
            if (goal.type === 'one-time' && goal.date && goal.currentAmount < goal.amount) {
                const days = getDaysUntil(goal.date);
                if (days <= 3) {
                    const date = parseLocalDate(goal.date);
                    items.push({ type: 'goal', data: goal, date, daysUntil: days, sortDate: date.getTime() });
                }
            }
        });

        return items.sort((a, b) => a.daysUntil - b.daysUntil || a.sortDate - b.sortDate);
    }, [tasks, recurringTransactions, bills, goals, overrides]);

    const handleTaskToggle = (task: Task) => {
        onTaskUpdate({ ...task, status: 'Done' });
    };

    const renderDueBadge = (daysUntil: number) => {
        if (daysUntil < 0) {
            return (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30">
                    Overdue ({Math.abs(daysUntil)}d)
                </span>
            );
        }
        if (daysUntil === 0) {
            return (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30">
                    Due Today
                </span>
            );
        }
        if (daysUntil === 1) {
            return (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                    Due Tomorrow
                </span>
            );
        }
        return (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30">
                In {daysUntil} days
            </span>
        );
    };

    if (agendaItems.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-transparent">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mb-3">
                    <Icon name="check_circle" className="text-2xl" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">No upcoming obligations</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                    You have no tasks or bill payments scheduled for the next 3 days.
                </p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-0 overflow-hidden bg-transparent">
            <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 custom-scrollbar">
                {agendaItems.map((item) => {
                    if (item.type === 'task') {
                        return (
                            <div key={`task-${item.data.id}`} className="flex items-center gap-3 p-3 rounded-2xl glass-tile group transition-all">
                                <button 
                                    onClick={() => handleTaskToggle(item.data)}
                                    className="w-5 h-5 rounded-lg border border-slate-300 dark:border-white/20 shrink-0 flex items-center justify-center hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors cursor-pointer"
                                    aria-label="Mark task as complete"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{item.data.title}</p>
                                        {renderDueBadge(item.daysUntil)}
                                    </div>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                                        <Icon name="task_alt" className="text-xs text-slate-400 dark:text-slate-500" /> Task
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
                            <div key={`${item.type}-${data.id}`} className="flex items-center gap-3 p-3 rounded-2xl glass-tile group transition-all">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${isBill ? 'bg-amber-500/15 border-amber-500/30 text-amber-500' : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-500'}`}>
                                    <Icon 
                                        name={isBill ? 'receipt' : 'sync'} 
                                        className="text-base" 
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{description}</p>
                                        {renderDueBadge(item.daysUntil)}
                                    </div>
                                    <p className="text-xs font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                                        <span className="privacy-blur">
                                            {formatCurrency(amount, currency)}
                                        </span>
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                     <button 
                                        onClick={() => onProcessItem(data)}
                                        className="h-8 inline-flex items-center justify-center bg-primary-600 hover:bg-primary-500 text-white font-semibold text-xs px-3 rounded-xl shadow-xs border border-primary-500/30 dark:bg-primary-500 transition-all active:scale-95 cursor-pointer"
                                    >
                                        {isBill ? 'Pay' : 'Post'}
                                    </button>
                                </div>
                            </div>
                        );
                    }

                    if (item.type === 'goal') {
                        return (
                            <div key={`goal-${item.data.id}`} className="flex items-center gap-3 p-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/50">
                                <Icon name="target" className="text-xl shrink-0 text-amber-600 dark:text-amber-400" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-light-text dark:text-dark-text truncate">{item.data.name}</p>
                                        {renderDueBadge(item.daysUntil)}
                                    </div>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">Goal Target Date</p>
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
