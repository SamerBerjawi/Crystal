import React, { useState, useMemo } from 'react';
import { ScheduledItem, FinancialGoal, Account } from '../types';
import { formatCurrency, parseLocalDate, toLocalISOString } from '../utils';
import Icon from './ui/Icon';

interface CalendarViewProps {
  items: ScheduledItem[];
  goals: FinancialGoal[];
  accounts: Account[];
  onEditItem: (item: ScheduledItem) => void;
  onPostItem: (item: ScheduledItem) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  items,
  goals,
  accounts,
  onEditItem,
  onPostItem,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  const startDate = new Date(monthStart);
  // Adjust so week starts on Monday
  const startDayOfWeek = startDate.getDay() === 0 ? 6 : startDate.getDay() - 1;
  startDate.setDate(startDate.getDate() - startDayOfWeek);

  const endDate = new Date(monthEnd);
  const endDayOfWeek = endDate.getDay() === 0 ? 6 : endDate.getDay() - 1;
  endDate.setDate(endDate.getDate() + (6 - endDayOfWeek));

  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    let day = new Date(startDate);
    while (day <= endDate) {
      days.push(new Date(day));
      day.setDate(day.getDate() + 1);
    }
    return days;
  }, [startDate, endDate]);

  const itemsByDate = useMemo(() => {
    const map: Record<string, ScheduledItem[]> = {};
    items.forEach((item) => {
      if (!map[item.date]) map[item.date] = [];
      map[item.date].push(item);
    });
    return map;
  }, [items]);

  const goalOccurrences = useMemo(() => {
    const occurrences: Record<string, any[]> = {};
    goals.forEach((goal) => {
      if (goal.type === 'one-time' && goal.date) {
        if (!occurrences[goal.date]) occurrences[goal.date] = [];
        occurrences[goal.date].push({ ...goal, isGoal: true });
      } else if (goal.type === 'recurring' && goal.startDate && goal.frequency) {
        let nextDate = parseLocalDate(goal.startDate);
        const forecastEnd = new Date(monthEnd);
        forecastEnd.setMonth(forecastEnd.getMonth() + 1);

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

  const nextMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const todayStr = toLocalISOString(new Date());

  return (
    <div className="glass-section rounded-2xl shadow-card overflow-hidden font-sans">
      {/* Untitled UI Calendar Top Header */}
      <div className="px-6 py-5 border-b border-neutral-300 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 bg-transparent">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h2>
          </div>

          {/* Navigation Controls Button Group */}
          <div className="flex items-center rounded-lg border border-neutral-300 dark:border-white/10 bg-white/70 dark:bg-white/5 p-0.5 shadow-xs">
            <button
              onClick={prevMonth}
              className="p-1.5 text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-white/10 rounded-md transition-all duration-150"
              title="Previous Month"
            >
              <Icon name="chevron_left" className="text-lg leading-none" />
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1 text-xs font-bold text-neutral-800 dark:text-neutral-200 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-white/10 rounded-md transition-all duration-150 border-x border-neutral-300 dark:border-white/10"
            >
              Today
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-white/10 rounded-md transition-all duration-150"
              title="Next Month"
            >
              <Icon name="chevron_right" className="text-lg leading-none" />
            </button>
          </div>
        </div>

        {/* Legend Pills */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100/90 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-500"></span>
            Income
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-100/90 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800/40 text-rose-900 dark:text-rose-300 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 dark:bg-rose-500"></span>
            Expense
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-100/90 dark:bg-sky-950/40 border border-sky-300 dark:border-sky-800/40 text-sky-900 dark:text-sky-300 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-600 dark:bg-sky-500"></span>
            Transfer
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/40 text-amber-900 dark:text-amber-300 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-500"></span>
            Goal
          </div>
        </div>
      </div>

      {/* Weekday Header Row */}
      <div className="grid grid-cols-7 border-b border-neutral-300 dark:border-white/10 bg-neutral-100/80 dark:bg-white/[0.02]">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div
            key={day}
            className="py-2.5 text-center text-xs font-bold text-neutral-800 dark:text-neutral-300 tracking-wider uppercase"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 auto-rows-fr bg-neutral-300 dark:bg-white/[0.08] gap-px">
        {calendarDays.map((date, idx) => {
          const dateStr = toLocalISOString(date);
          const isCurrentMonth = date.getMonth() === currentDate.getMonth();
          const isToday = dateStr === todayStr;
          const dayItems = itemsByDate[dateStr] || [];
          const dayGoals = goalOccurrences[dateStr] || [];

          return (
            <div
              key={idx}
              className={`min-h-[135px] p-2 transition-colors duration-150 flex flex-col justify-between group ${
                isCurrentMonth
                  ? 'bg-white/90 dark:bg-black/20 hover:bg-white dark:hover:bg-white/[0.06]'
                  : 'bg-neutral-100/70 dark:bg-black/40 opacity-60 hover:bg-neutral-100 dark:hover:bg-black/50'
              }`}
            >
              <div>
                {/* Date Header */}
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`inline-flex items-center justify-center text-xs w-6 h-6 rounded-full transition-all ${
                      isToday
                        ? 'bg-primary-600 text-white font-bold shadow-md shadow-primary-500/30'
                        : isCurrentMonth
                        ? 'text-neutral-900 font-bold dark:text-neutral-100 group-hover:text-primary-600 dark:group-hover:text-primary-400'
                        : 'text-neutral-500 font-medium dark:text-neutral-500'
                    }`}
                  >
                    {date.getDate()}
                  </span>
                </div>

                {/* Items & Goals List */}
                <div className="space-y-1.5">
                  {dayItems.map((item) => {
                    const isIncome = item.type === 'income' || item.type === 'deposit';
                    const isTransfer = item.type === 'transfer';
                    const isSkipped = item.isSkipped;

                    let badgeClass =
                      'bg-rose-50 text-rose-900 border-rose-300 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900/50';
                    let dotColor = 'bg-rose-600 dark:bg-rose-500';

                    if (isTransfer) {
                      badgeClass =
                        'bg-sky-50 text-sky-900 border-sky-300 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900/50';
                      dotColor = 'bg-sky-600 dark:bg-sky-500';
                    } else if (isIncome) {
                      badgeClass =
                        'bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900/50';
                      dotColor = 'bg-emerald-600 dark:bg-emerald-500';
                    }

                    return (
                      <div
                        key={item.id}
                        className={`group/item flex items-center justify-between gap-1.5 px-2 py-1 rounded-md border text-xs font-semibold transition-all duration-150 hover:shadow-xs cursor-pointer ${badgeClass} ${
                          isSkipped ? 'opacity-40 line-through' : ''
                        }`}
                        onClick={() => onEditItem(item)}
                        title={`${item.description}: ${formatCurrency(
                          item.amount,
                          (item.originalItem as any)?.currency || 'EUR'
                        )}`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`}></span>
                          <span className="truncate">{item.description}</span>
                        </div>
                        {!isSkipped && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onPostItem(item);
                            }}
                            className="opacity-0 group-hover/item:opacity-100 p-0.5 rounded text-neutral-600 hover:text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all flex-shrink-0"
                            title="Post Transaction"
                          >
                            <Icon name="check" className="text-xs leading-none" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {dayGoals.map((goal) => (
                    <div
                      key={goal.id}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-amber-300 dark:border-amber-900/50 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 text-xs font-semibold truncate cursor-default shadow-2xs"
                      title={`Goal: ${goal.name} - Contribution: ${formatCurrency(
                        goal.monthlyContribution || 0,
                        goal.currency || 'EUR'
                      )}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-500 flex-shrink-0"></span>
                      <span className="truncate">{goal.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarView;
