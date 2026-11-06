import React, { useMemo } from 'react';
import type { Currency, Transaction } from '../types';
import { convertToMain, formatCurrency, parseLocalDate, toLocalISOString } from '../utils';
import { addDays } from '../utils/scheduleModel';
import { Amount } from './ui/Money';
import { useWidgetBox } from './ui/WidgetGrid';

interface SpendingCalendarWidgetProps {
  /** Transactions to count, already limited to the accounts in view. */
  transactions: Transaction[];
  currency: Currency;
  toDisplay: (eur: number) => number;
  onDayClick?: (date: string) => void;
}

const WEEKDAYS = ['Mon', '', 'Wed', '', 'Fri', '', ''];
const LEVELS = [0.2, 0.4, 0.65, 1];
const GAP = 4;

/**
 * A dot for every day, in weeks, coloured by how much went out: the heatmap dot calendar. It shows as many weeks as the
 * widget is wide, ending today. Days with nothing spent are quiet outlines, so a run of them reads as a streak.
 */
const SpendingCalendarWidget: React.FC<SpendingCalendarWidgetProps> = ({ transactions, currency, toDisplay, onDayClick }) => {
  const box = useWidgetBox();
  const dot = box.width > 0 && box.width < 420 ? 12 : 14;
  const labelRoom = box.width >= 300 || box.width === 0 ? 30 : 0;
  const weekCount = box.width === 0 ? 26 : Math.max(8, Math.min(53, Math.floor((box.width - labelRoom + GAP) / (dot + GAP))));
  const showSummary = box.height === 0 || box.height >= 230;
  const showLegend = box.height === 0 || box.height >= 190;

  const { weeks, spendByDay, stats, thresholds, months } = useMemo(() => {
    const spendByDay = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.type !== 'expense' || tx.transferId || tx.isSplitParent || tx.isCombinedParent || tx.isBalanceAdjustment) continue;
      spendByDay.set(tx.date, (spendByDay.get(tx.date) || 0) + Math.abs(toDisplay(convertToMain(tx.amount, tx.currency))));
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = toLocalISOString(today);
    // The grid ends on the week that holds today, starting on a Monday.
    const endMonday = addDays(today, -((today.getDay() + 6) % 7));
    const firstMonday = addDays(endMonday, -(weekCount - 1) * 7);
    const weeks: { date: string; future: boolean }[][] = [];
    const months: { index: number; label: string }[] = [];
    for (let w = 0; w < weekCount; w++) {
      const week: { date: string; future: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const day = addDays(firstMonday, w * 7 + d);
        const date = toLocalISOString(day);
        week.push({ date, future: date > todayIso });
        if (day.getDate() <= 7 && d === 0 && (w === 0 || day.getMonth() !== addDays(day, -7).getMonth())) months.push({ index: w, label: day.toLocaleDateString(undefined, { month: 'short' }) });
      }
      weeks.push(week);
    }

    const shown = weeks.flat().filter(day => !day.future);
    const values = shown.map(day => spendByDay.get(day.date) || 0);
    const positive = values.filter(value => value > 0).sort((a, b) => a - b);
    const at = (share: number) => positive.length ? positive[Math.min(positive.length - 1, Math.floor(positive.length * share))] : 0;
    let longestStreak = 0;
    let run = 0;
    values.forEach(value => { run = value === 0 ? run + 1 : 0; longestStreak = Math.max(longestStreak, run); });
    const busiestIndex = values.reduce((best, value, index) => (value > values[best] ? index : best), 0);
    const total = values.reduce((sum, value) => sum + value, 0);
    return {
      weeks,
      spendByDay,
      months,
      thresholds: [at(0.25), at(0.5), at(0.75)],
      stats: {
        noSpend: values.filter(value => value === 0).length,
        days: values.length,
        longestStreak,
        average: values.length ? total / values.length : 0,
        busiest: values.length && values[busiestIndex] > 0 ? { date: shown[busiestIndex].date, value: values[busiestIndex] } : null,
      },
    };
  }, [transactions, toDisplay, weekCount]);

  const levelOf = (value: number) => (value <= thresholds[0] ? 0 : value <= thresholds[1] ? 1 : value <= thresholds[2] ? 2 : 3);
  const dayText = (date: string, value: number) => `${parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}: ${value > 0 ? formatCurrency(value, currency) : 'nothing spent'}`;

  return (
    <div className="flex h-full flex-col gap-3">
      {showSummary && (
        <dl className="grid grid-cols-3 gap-3">
          <div className="min-w-0">
            <dt className="type-caption text-muted">No-spend days</dt>
            <dd className="type-figure-row text-ink">{stats.noSpend}<span className="type-caption ml-1 text-muted">of {stats.days}</span></dd>
          </div>
          <div className="min-w-0">
            <dt className="type-caption text-muted">Longest streak</dt>
            <dd className="type-figure-row text-ink">{stats.longestStreak}<span className="type-caption ml-1 text-muted">{stats.longestStreak === 1 ? 'day' : 'days'}</span></dd>
          </div>
          <div className="min-w-0">
            <dt className="type-caption text-muted">Average a day</dt>
            <dd className="type-figure-row truncate text-ink"><Amount value={stats.average} currency={currency} /></dd>
          </div>
        </dl>
      )}

      <div className="no-scrollbar min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="relative w-fit">
          <div className="relative mb-1 h-4" style={{ marginLeft: labelRoom }}>
            {months.map(month => <span key={`${month.index}-${month.label}`} aria-hidden="true" className="type-caption absolute text-muted" style={{ left: month.index * (dot + GAP) }}>{month.label}</span>)}
          </div>
          <div className="flex" style={{ gap: GAP }}>
            {labelRoom > 0 && (
              <div className="grid shrink-0 text-muted" style={{ width: labelRoom - GAP, gap: GAP }} aria-hidden="true">
                {WEEKDAYS.map((label, index) => <span key={index} className="type-caption flex items-center" style={{ height: dot }}>{label}</span>)}
              </div>
            )}
            {weeks.map(week => (
              <div key={week[0].date} className="grid" style={{ gap: GAP }}>
                {week.map(day => {
                  if (day.future) return <span key={day.date} style={{ width: dot, height: dot }} />;
                  const value = spendByDay.get(day.date) || 0;
                  const label = dayText(day.date, value);
                  const style: React.CSSProperties = { width: dot, height: dot };
                  const dotEl = value > 0
                    ? <span className="block size-full rounded-full" style={{ backgroundColor: 'var(--money-out)', opacity: LEVELS[levelOf(value)] }} />
                    : <span className="block size-full rounded-full border border-line-strong" />;
                  return onDayClick && value > 0 ? (
                    <button key={day.date} type="button" title={label} aria-label={label} onClick={() => onDayClick(day.date)} style={style} className="cursor-pointer rounded-full transition-transform hover:scale-125 focus-visible:outline-2 focus-visible:outline-[var(--focus)]">{dotEl}</button>
                  ) : (
                    <span key={day.date} title={label} style={style}>{dotEl}</span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showLegend && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="type-caption min-w-0 truncate text-muted">
            {stats.busiest ? <>Busiest day {parseLocalDate(stats.busiest.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, <Amount value={stats.busiest.value} currency={currency} className="text-ink" /></> : 'Nothing spent in this stretch'}
          </p>
          <div className="type-caption flex items-center gap-1.5 text-muted" aria-hidden="true">
            <span>Less</span>
            <span className="size-3 rounded-full border border-line-strong" />
            {LEVELS.map(level => <span key={level} className="size-3 rounded-full" style={{ backgroundColor: 'var(--money-out)', opacity: level }} />)}
            <span>More</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpendingCalendarWidget;
