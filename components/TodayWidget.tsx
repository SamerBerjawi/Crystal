import React, { useMemo } from 'react';
import { Task, RecurringTransaction, BillPayment, FinancialGoal, RecurringTransactionOverride, Currency } from '../types';
import { parseLocalDate, toLocalISOString } from '../utils';
import Icon from './ui/Icon';
import { Button } from './ui/Actions';
import { Badge } from './ui/Display';
import { Amount } from './ui/Money';
import { EmptyState } from './ui/States';

interface TodayWidgetProps {
    tasks: Task[];
    recurringTransactions: RecurringTransaction[];
    bills: BillPayment[];
    goals: FinancialGoal[];
    overrides: RecurringTransactionOverride[];
    onTaskUpdate: (task: Task) => void;
    onProcessItem: (item: RecurringTransaction | BillPayment) => void;
    size?: 's' | 'm' | 'l';
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
    onProcessItem,
    size = 'm'
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
            if (rt.pausedAt) return;
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
                } else if (rt.frequency === 'biweekly') {
                    d.setDate(d.getDate() + (14 * interval));
                } else if (rt.frequency === 'weekly') {
                    d.setDate(d.getDate() + (7 * interval));
                } else if (rt.frequency === 'daily') {
                    d.setDate(d.getDate() + interval);
                } else if (rt.frequency === 'yearly') {
                    d.setFullYear(d.getFullYear() + interval);
                } else {
                    break;
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

    const dueBadge = (daysUntil: number) => {
        if (daysUntil < 0) return <Badge tone="negative">{Math.abs(daysUntil) === 1 ? '1 day late' : `${Math.abs(daysUntil)} days late`}</Badge>;
        if (daysUntil === 0) return <Badge tone="attention">Today</Badge>;
        if (daysUntil === 1) return <Badge tone="neutral">Tomorrow</Badge>;
        return <Badge tone="neutral">In {daysUntil} days</Badge>;
    };

    if (agendaItems.length === 0) {
        return <EmptyState icon="checkmark-circle-02" title="Nothing due" description="No tasks, bills or payments in the next 3 days." className="h-full py-6" />;
    }

    const visibleAgenda = size === 's' ? agendaItems.slice(0, 3) : size === 'm' ? agendaItems.slice(0, 6) : agendaItems;
    const glyph = (icon: string) => <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-inset text-muted"><Icon name={icon} size={18} /></span>;

    return (
        <ul className="no-scrollbar -mx-2 h-full divide-y divide-line overflow-y-auto">
            {visibleAgenda.map(item => {
                if (item.type === 'task') {
                    return (
                        <li key={`task-${item.data.id}`} className="flex items-center gap-3 px-2 py-2.5">
                            <button
                                type="button"
                                onClick={() => onTaskUpdate({ ...item.data, status: 'Done' })}
                                className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-inset hover:text-ink focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
                                aria-label={`Mark “${item.data.title}” done`}
                            >
                                <span className="size-5 rounded-full border-2 border-line-strong" />
                            </button>
                            <div className="min-w-0 flex-1">
                                <p className="type-body-strong truncate text-ink">{item.data.title}</p>
                                <p className="type-caption text-muted">Task</p>
                            </div>
                            {dueBadge(item.daysUntil)}
                        </li>
                    );
                }

                if (item.type === 'bill' || item.type === 'recurring') {
                    const isBill = item.type === 'bill';
                    const data = item.data as (BillPayment | RecurringTransaction);
                    return (
                        <li key={`${item.type}-${data.id}`} className="flex items-center gap-3 px-2 py-2.5">
                            {glyph(isBill ? 'invoice-03' : 'repeat')}
                            <div className="min-w-0 flex-1">
                                <p className="type-body-strong truncate text-ink">{data.description}</p>
                                <p className="type-caption flex flex-wrap items-center gap-x-2 text-muted">
                                    <Amount value={Math.abs(data.amount)} currency={(data as { currency?: Currency }).currency || 'EUR'} className="text-ink" />
                                    {dueBadge(item.daysUntil)}
                                </p>
                            </div>
                            <Button variant="secondary" size="sm" onPress={() => onProcessItem(data)}>{isBill ? 'Pay' : 'Post'}</Button>
                        </li>
                    );
                }

                return (
                    <li key={`goal-${item.data.id}`} className="flex items-center gap-3 px-2 py-2.5">
                        {glyph('target-01')}
                        <div className="min-w-0 flex-1">
                            <p className="type-body-strong truncate text-ink">{item.data.name}</p>
                            <p className="type-caption text-muted">Goal target date</p>
                        </div>
                        {dueBadge(item.daysUntil)}
                    </li>
                );
            })}
        </ul>
    );
};

export default TodayWidget;
