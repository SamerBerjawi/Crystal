import React, { useState, useMemo } from 'react';
import { ScheduledItem, FinancialGoal, Account } from '../types';
import { formatCurrency, parseLocalDate, toLocalISOString } from '../utils';

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
    <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl overflow-hidden font-sans">
      {/* Untitled UI Calendar Top Header */}
      <div className="px-6 py-5 border-b border-neutral-200/80 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-neutral-900">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight">
              {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h2>
          </div>

          {/* Navigation Controls Button Group */}
          <div className="flex items-center rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 p-0.5 shadow-sm">
            <button
              onClick={prevMonth}
              className="p-1.5 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-white dark:hover:bg-neutral-700/60 rounded-md transition-all duration-150"
              title="Previous Month"
            >
              <span className="material-symbols-outlined text-lg leading-none">chevron_left</span>
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1 text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:text-neutral-900 dark:hover:text-white hover:bg-white dark:hover:bg-neutral-700/60 rounded-md transition-all duration-150 border-x border-neutral-200/60 dark:border-neutral-800"
            >
              Today
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-white dark:hover:bg-neutral-700/60 rounded-md transition-all duration-150"
              title="Next Month"
            >
              <span className="material-symbols-outlined text-lg leading-none">chevron_right</span>
            </button>
          </div>
        </div>

        {/* Legend Pills */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Income
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/40 text-rose-700 dark:text-rose-300 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Expense
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-50 dark:bg-sky-950/40 border border-sky-200/60 dark:border-sky-800/40 text-sky-700 dark:text-sky-300 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
            Transfer
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 text-amber-700 dark:text-amber-300 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Goal
          </div>
        </div>
      </div>

      {/* Weekday Header Row */}
      <div className="grid grid-cols-7 border-b border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/80">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div
            key={day}
            className="py-2.5 text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400 tracking-wider uppercase"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 auto-rows-fr bg-neutral-200/60 dark:bg-neutral-800/60 gap-px">
        {calendarDays.map((date, idx) => {
          const dateStr = toLocalISOString(date);
          const isCurrentMonth = date.getMonth() === currentDate.getMonth();
          const isToday = dateStr === todayStr;
          const dayItems = itemsByDate[dateStr] || [];
          const dayGoals = goalOccurrences[dateStr] || [];

          return (
            <div
              key={idx}
              className={`min-h-[135px] p-2 bg-white dark:bg-neutral-900 transition-colors duration-150 hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 flex flex-col justify-between group ${
                !isCurrentMonth ? 'bg-neutral-50/40 dark:bg-neutral-950/40 opacity-45' : ''
              }`}
            >
              <div>
                {/* Date Header */}
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`inline-flex items-center justify-center text-xs font-medium w-6 h-6 rounded-full transition-all ${
                      isToday
                        ? 'bg-primary-600 text-white font-semibold shadow-md shadow-primary-500/30'
                        : isCurrentMonth
                        ? 'text-neutral-700 dark:text-neutral-300 group-hover:text-primary-600 dark:group-hover:text-primary-400'
                        : 'text-neutral-400 dark:text-neutral-600'
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
                      'bg-rose-50/90 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200/70 dark:border-rose-900/40';
                    let dotColor = 'bg-rose-500';

                    if (isTransfer) {
                      badgeClass =
                        'bg-sky-50/90 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200/70 dark:border-sky-900/40';
                      dotColor = 'bg-sky-500';
                    } else if (isIncome) {
                      badgeClass =
                        'bg-emerald-50/90 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-900/40';
                      dotColor = 'bg-emerald-500';
                    }

                    return (
                      <div
                        key={item.id}
                        className={`group/item flex items-center justify-between gap-1.5 px-2 py-1 rounded-md border text-[11px] font-medium transition-all duration-150 hover:shadow-sm cursor-pointer ${badgeClass} ${
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
                          <span className="truncate font-medium">{item.description}</span>
                        </div>
                        {!isSkipped && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onPostItem(item);
                            }}
                            className="opacity-0 group-hover/item:opacity-100 p-0.5 rounded text-neutral-500 hover:text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all flex-shrink-0"
                            title="Post Transaction"
                          >
                            <span className="material-symbols-outlined text-[13px] leading-none">
                              check
                            </span>
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {dayGoals.map((goal) => (
                    <div
                      key={goal.id}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-amber-200/70 dark:border-amber-900/40 bg-amber-50/90 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[11px] font-medium truncate cursor-default shadow-2xs"
                      title={`Goal: ${goal.name} - Contribution: ${formatCurrency(
                        goal.monthlyContribution || 0,
                        goal.currency || 'EUR'
                      )}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"></span>
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
