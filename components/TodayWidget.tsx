import React, { useMemo } from 'react';
import { fitRows, useWidgetBox } from './ui/WidgetGrid';
import { Task, RecurringTransaction, BillPayment, FinancialGoal, RecurringTransactionOverride, Currency } from '../types';
import { convertToMain, parseLocalDate, toLocalISOString } from '../utils';
import Icon from './ui/Icon';
import { Button } from './ui/Actions';
import { LogoTile, MerchantLogo } from './EntityIcon';
import { useCategoryContext } from '../contexts/FinancialDataContext';
import type { Category } from '../types';
import { cn } from '../lib/utils';
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
    /** With these, the foot of the list adds up what goes out and what is expected in. */
    currency?: Currency;
    toDisplay?: (eur: number) => number;
    size?: 's' | 'm' | 'l';
}

type AgendaItem = 
    | { type: 'task'; data: Task; date: Date; daysUntil: number; sortDate: number }
    | { type: 'recurring'; data: RecurringTransaction; date: Date; daysUntil: number; sortDate: number }
    | { type: 'bill'; data: BillPayment; date: Date; daysUntil: number; sortDate: number }
    | { type: 'goal'; data: FinancialGoal; date: Date; daysUntil: number; sortDate: number };

/** How far ahead the agenda looks. Today's items come first, then what is coming. */
const LOOKAHEAD_DAYS = 14;

const findCategoryIcon = (name: string, categories: Category[]): string | undefined => {
    for (const category of categories) {
        if (category.name === name) return category.icon;
        const inner = category.subCategories ? findCategoryIcon(name, category.subCategories) : undefined;
        if (inner) return inner;
    }
    return undefined;
};

const TodayWidget: React.FC<TodayWidgetProps> = ({ 
    tasks, 
    recurringTransactions, 
    bills, 
    goals,
    overrides = [],
    onTaskUpdate,
    onProcessItem,
    currency,
    toDisplay,
    size = 'm'
}) => {
    const box = useWidgetBox();
    const { expenseCategories } = useCategoryContext();
    const agendaItems = useMemo(() => {
        const items: AgendaItem[] = [];
        const todayStr = toLocalISOString(new Date());
        const todayDate = parseLocalDate(todayStr); // Local midnight representation of Today

        const getDaysUntil = (dateStr: string) => {
            const d = parseLocalDate(dateStr);
            const diffTime = d.getTime() - todayDate.getTime();
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        };

        // Tasks (due within the lookahead and >= -7 days)
        if (Array.isArray(tasks)) {
            tasks.forEach(task => {
                if (task.status !== 'Done' && task.dueDate) {
                    const days = getDaysUntil(task.dueDate);
                    if (days <= LOOKAHEAD_DAYS && days >= -7) {
                        const date = parseLocalDate(task.dueDate);
                        items.push({ type: 'task', data: task, date, daysUntil: days, sortDate: date.getTime() });
                    }
                }
            });
        }

        // Bills (unpaid and due within the lookahead and >= -7 days)
        if (Array.isArray(bills)) {
            bills.forEach(bill => {
                if (bill.status === 'unpaid') {
                    const days = getDaysUntil(bill.dueDate);
                    if (days <= LOOKAHEAD_DAYS && days >= -7) {
                        const date = parseLocalDate(bill.dueDate);
                        items.push({ type: 'bill', data: bill, date, daysUntil: days, sortDate: date.getTime() });
                    }
                }
            });
        }

        // Recurring Transactions (due within the lookahead and >= -7 days)
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
                if (days > LOOKAHEAD_DAYS) break;
                if (endDateLocal && nextDue > endDateLocal) break;

                const override = overrides.find(o => o.recurringTransactionId === rt.id && o.originalDate === dateStr);
                
                if (!override?.isSkipped) {
                    const effectiveDateStr = override?.date || dateStr;
                    const effectiveDays = getDaysUntil(effectiveDateStr);
                    
                    if (effectiveDays <= LOOKAHEAD_DAYS && effectiveDays >= -7) {
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

        // Goals (Deadline within the lookahead)
        goals.forEach(goal => {
            if (goal.type === 'one-time' && goal.date && goal.currentAmount < goal.amount) {
                const days = getDaysUntil(goal.date);
                if (days <= LOOKAHEAD_DAYS) {
                    const date = parseLocalDate(goal.date);
                    items.push({ type: 'goal', data: goal, date, daysUntil: days, sortDate: date.getTime() });
                }
            }
        });

        return items.sort((a, b) => a.daysUntil - b.daysUntil || a.sortDate - b.sortDate);
    }, [tasks, recurringTransactions, bills, goals, overrides]);

    const dueText = (daysUntil: number) => {
        if (daysUntil < 0) return `${Math.abs(daysUntil)} ${Math.abs(daysUntil) === 1 ? 'day' : 'days'} late`;
        if (daysUntil === 0) return 'today';
        if (daysUntil === 1) return 'tomorrow';
        return `in ${daysUntil} days`;
    };
    // The dot on the timeline: late is red, soon is amber, the rest is quiet.
    const dotColor = (daysUntil: number) => (daysUntil < 0 ? 'var(--money-out)' : daysUntil <= 2 ? 'var(--amber)' : 'var(--line-strong)');
    const categoryIcon = (name?: string) => (name ? findCategoryIcon(name, expenseCategories) : undefined);

    const totals = useMemo(() => {
        let out = 0;
        let incoming = 0;
        for (const item of agendaItems) {
            if (item.type === 'task' || item.type === 'goal') continue;
            const data = item.data as BillPayment | RecurringTransaction;
            const eur = convertToMain(Math.abs(data.amount), (data as { currency?: Currency }).currency || 'EUR');
            const isIn = item.type === 'bill' ? (data as BillPayment).type === 'deposit' : (data as RecurringTransaction).type === 'income';
            const isOut = item.type === 'bill' ? (data as BillPayment).type === 'payment' : (data as RecurringTransaction).type === 'expense';
            if (isIn) incoming += eur;
            else if (isOut) out += eur;
        }
        return { out, incoming };
    }, [agendaItems]);
    const showTotals = !!currency && !!toDisplay && (totals.out > 0 || totals.incoming > 0) && (box.height === 0 || box.height >= 200);

    if (agendaItems.length === 0) {
        return <EmptyState icon="checkmark-circle-02" title="Nothing due" description="No tasks, bills or payments in the next two weeks." className="h-full py-6" />;
    }

    const fallbackCount = size === 's' ? 3 : size === 'm' ? 6 : agendaItems.length;
    // A row is 60px. When some are left out, the last line says how many, so one fewer row shows.
    const fit = fitRows(box, 56, fallbackCount, showTotals ? 36 : 0);
    const count = box.height === 0 ? fallbackCount : fit >= agendaItems.length ? agendaItems.length : Math.max(1, fit - 1);
    const visibleAgenda = agendaItems.slice(0, count);
    const hiddenCount = agendaItems.length - visibleAgenda.length;
    // One row of the timeline: the date, a dot on the line, the logo, what it is and when, and what it costs.
    const narrow = box.width > 0 && box.width < 340;
    const Row: React.FC<{ date: Date; daysUntil: number; lead: React.ReactNode; title: string; subtitle: string; end?: React.ReactNode; action?: React.ReactNode; last: boolean }> = ({ date, daysUntil, lead, title, subtitle, end, action, last }) => (
        <li className="flex items-stretch gap-3 px-2">
            {!narrow && <span className="flex w-9 shrink-0 flex-col items-center justify-center py-2 text-center leading-tight">
                <span className="type-figure-row text-ink">{date.getDate()}</span>
                <span className="type-caption uppercase text-muted">{date.toLocaleDateString(undefined, { month: 'short' })}</span>
            </span>}
            <span aria-hidden className="relative flex w-3 shrink-0 justify-center">
                <span className={cn('absolute left-1/2 w-px -translate-x-1/2 bg-line', last ? 'top-0 h-1/2' : 'inset-y-0')} />
                <span className="relative top-1/2 size-2.5 -translate-y-1/2 rounded-full border-2 bg-solid" style={{ borderColor: dotColor(daysUntil) }} />
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-2.5 py-2">
                {lead}
                <span className="min-w-0 flex-1">
                    <span className="type-body-strong block truncate text-ink">{title}</span>
                    <span className={cn('type-caption block truncate', daysUntil < 0 ? 'text-tomato' : 'text-muted')}>{narrow ? `${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · ${subtitle}` : subtitle}</span>
                </span>
                {end}
                {action}
            </span>
        </li>
    );

    return (
        <div className="flex h-full flex-col">
        <ul className="no-scrollbar -mx-2 min-h-0 flex-1 overflow-y-auto">
            {visibleAgenda.map((item, index) => {
                const last = index === visibleAgenda.length - 1;
                if (item.type === 'task') {
                    return (
                        <Row
                            key={`task-${item.data.id}`}
                            date={item.date}
                            daysUntil={item.daysUntil}
                            last={last}
                            lead={<LogoTile label={item.data.title} size={32} rounded="full" fallbackIcon="checkmark-circle-02" />}
                            title={item.data.title}
                            subtitle={`Task · ${dueText(item.daysUntil)}`}
                            action={<Button variant="ghost" size="sm" onPress={() => onTaskUpdate({ ...item.data, status: 'Done' })}>Done</Button>}
                        />
                    );
                }

                if (item.type === 'bill' || item.type === 'recurring') {
                    const isBill = item.type === 'bill';
                    const data = item.data as (BillPayment | RecurringTransaction);
                    const recurring = !isBill ? (data as RecurringTransaction) : null;
                    const incoming = isBill ? (data as BillPayment).type === 'deposit' : recurring?.type === 'income';
                    return (
                        <Row
                            key={`${item.type}-${data.id}`}
                            date={item.date}
                            daysUntil={item.daysUntil}
                            last={last}
                            lead={<MerchantLogo merchant={recurring?.merchant || data.description} description={data.description} size={32} fallbackIcon={categoryIcon(recurring?.category) || (isBill ? 'invoice-03' : 'repeat')} />}
                            title={data.description}
                            subtitle={`${isBill ? 'Bill' : recurring?.category || 'Repeats'} · ${dueText(item.daysUntil)}`}
                            end={<span className="type-figure-row shrink-0 text-ink"><Amount value={incoming ? Math.abs(data.amount) : -Math.abs(data.amount)} currency={(data as { currency?: Currency }).currency || 'EUR'} tone="flow" /></span>}
                            action={<Button variant="secondary" size="sm" onPress={() => onProcessItem(data)}>{isBill ? 'Pay' : 'Post'}</Button>}
                        />
                    );
                }

                return (
                    <Row
                        key={`goal-${item.data.id}`}
                        date={item.date}
                        daysUntil={item.daysUntil}
                        last={last}
                        lead={<LogoTile label={item.data.name} size={32} rounded="full" fallbackIcon="target-01" />}
                        title={item.data.name}
                        subtitle={`Goal target date · ${dueText(item.daysUntil)}`}
                    />
                );
            })}
        </ul>
        {hiddenCount > 0 && <p className="type-caption mt-1 shrink-0 text-muted">+{hiddenCount} more coming up</p>}
        {showTotals && (
            <p className="type-caption mt-2 flex shrink-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line pt-2 text-muted">
                <span>Out <Amount value={toDisplay!(totals.out)} currency={currency!} className="text-ink" /></span>
                <span>Expected in <Amount value={toDisplay!(totals.incoming)} currency={currency!} className="text-ink" /></span>
            </p>
        )}
        </div>
    );
};

export default TodayWidget;
