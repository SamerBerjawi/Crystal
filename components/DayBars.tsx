import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { formatCurrency, parseLocalDate, getMainCurrency } from '../utils';
import { heatKind, type DayCommitted, type HeatKind } from '../utils/scheduleModel';
import SegmentedControl from './ui/SegmentedControl';

const VIEWS = [{ id: 'bars', label: 'Next 30 days' }, { id: 'heatmap', label: 'Year heatmap' }];
const BAR_HEIGHT = 112;
const HEAT_COLOURS: Record<HeatKind, string> = { none: 'var(--inset)', in: 'var(--money-in)', out: 'var(--tomato)', move: 'var(--blue)', mixed: 'var(--rose)' };
const HEAT_LABELS: [HeatKind, string][] = [['in', 'Money in'], ['out', 'Money out'], ['move', 'Transfers'], ['mixed', 'Mixed']];

const dateLabel = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const describe = (day: DayCommitted) => `${dateLabel(day.date)}: ${[day.in > 0 && `in ${formatCurrency(day.in, getMainCurrency())}`, day.out > 0 && `out ${formatCurrency(day.out, getMainCurrency())}`, day.moves > 0 && `moves ${formatCurrency(day.moves, getMainCurrency())}`].filter(Boolean).join(', ') || 'nothing'}`;

interface DayBarsProps {
  days: DayCommitted[];
  yearDays: DayCommitted[];
  onSelect: (date: string) => void;
}

/** When money moves: a bar for each of the next 30 days, with the year as a heatmap behind a toggle (D-033). */
const DayBars: React.FC<DayBarsProps> = ({ days, yearDays, onSelect }) => {
  const [view, setView] = useState('bars');
  const largest = useMemo(() => Math.max(1, ...days.map(day => Math.max(day.in, day.out + day.moves))), [days]);
  const weeks = useMemo(() => {
    const rows: DayCommitted[][] = [];
    for (let i = 0; i < yearDays.length; i += 7) rows.push(yearDays.slice(i, i + 7));
    return rows;
  }, [yearDays]);

  return (
    <section aria-label="When money moves" className="surface-card rounded-[var(--radius-xl)] p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="type-card-title text-ink">When money moves</h2>
        <SegmentedControl items={VIEWS} activeId={view} onChange={setView} />
      </div>
      {view === 'bars' ? (
        <div className="no-scrollbar overflow-x-auto">
          <ul className="flex min-w-[640px] items-end gap-1" aria-label="Next 30 days">
            {days.map((day, index) => {
              const date = parseLocalDate(day.date);
              return (
                <li key={day.date} className="min-w-0 flex-1">
                  <button type="button" aria-label={describe(day)} title={describe(day)} onClick={() => onSelect(day.date)} className="block w-full cursor-pointer">
                    <span className="flex flex-col justify-end gap-0.5 overflow-hidden border-b border-line" style={{ height: BAR_HEIGHT }}>
                      {[{ value: day.in, colour: 'var(--money-in)' }, { value: day.moves, colour: 'var(--blue)' }, { value: day.out, colour: 'var(--tomato)' }].filter(bar => bar.value > 0).map(bar => (
                        <motion.span
                          key={bar.colour}
                          className="block origin-bottom rounded-[4px]"
                          style={{ height: Math.max(4, (bar.value / largest) * (BAR_HEIGHT - 4)), backgroundColor: bar.colour }}
                          initial={{ scaleY: 0 }}
                          animate={{ scaleY: 1 }}
                          transition={{ duration: 0.9, delay: index * 0.035, ease: [0.165, 0.84, 0.44, 1] }}
                        />
                      ))}
                    </span>
                    <span className="type-caption mt-1 block text-center text-muted">{date.getDate()}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="no-scrollbar overflow-x-auto">
          <div role="img" aria-label="The next year by day. The list shows the same items." className="flex w-max gap-[3px]">
            {weeks.map((week, index) => (
              <div key={index} className="grid gap-[3px]">
                {week.map(day => <button key={day.date} type="button" title={describe(day)} aria-label={describe(day)} onClick={() => onSelect(day.date)} className="size-3 cursor-pointer rounded-[3px]" style={{ backgroundColor: HEAT_COLOURS[heatKind(day)] }} />)}
              </div>
            ))}
          </div>
        </div>
      )}
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {HEAT_LABELS.filter(([kind]) => view === 'heatmap' || kind !== 'mixed').map(([kind, label]) => (
          <li key={kind} className="type-caption flex items-center gap-1.5 text-muted"><span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ backgroundColor: HEAT_COLOURS[kind] }} />{label}</li>
        ))}
      </ul>
    </section>
  );
};

export default DayBars;
