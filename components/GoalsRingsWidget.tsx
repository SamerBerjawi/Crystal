import React, { useMemo, useState } from 'react';
import type { Currency, FinancialGoal } from '../types';
import { goalViews } from '../utils/budgetModel';
import { RingChart, Ring, RingCenter } from '../src/components/charts';
import { currencyCode, parseLocalDate } from '../utils';
import { Amount } from './ui/Money';
import { EmptyState } from './ui/States';
import { useWidgetBox } from './ui/WidgetGrid';
import { cn } from '../lib/utils';

interface GoalsRingsWidgetProps {
  goals: FinancialGoal[];
  currency: Currency;
  /** Converts an amount in its own currency to the display currency. */
  toDisplay: (amount: number, from: Currency) => number;
  onOpenGoals: () => void;
}

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
const MAX_RINGS = 5;
const ROW_FULL = 60; // name, a bar, and saved of target
const ROW_COMPACT = 40; // name and percentage
const GAP = 20;

/**
 * Each goal still being saved for, as a ring that fills towards its target with the total in the middle, and as a row
 * with its own bar. The ring and the rows divide the widget by its shape: side by side when it is wide, one above the
 * other when it is narrow, rows alone when it is short, and the rows run in two columns when there is room for both.
 */
const GoalsRingsWidget: React.FC<GoalsRingsWidgetProps> = ({ goals, currency, toDisplay, onOpenGoals }) => {
  const box = useWidgetBox();
  const [hovered, setHovered] = useState<number | null>(null);

  const open = useMemo(() => goalViews(goals, toDisplay).filter(goal => !goal.done && goal.target > 0), [goals, toDisplay]);

  if (open.length === 0) {
    return <EmptyState icon="target-01" title="No goals in progress" description="Set a goal and its progress fills a ring here." actionLabel="Open Goals" onAction={onOpenGoals} className="h-full py-6" />;
  }

  const width = box.width || 520;
  const height = box.height || 300;
  const rings = open.slice(0, MAX_RINGS);
  const saved = open.reduce((sum, goal) => sum + goal.saved, 0);
  const data = rings.map((goal, index) => ({ label: goal.name, value: goal.saved, maxValue: goal.target, color: COLORS[index] }));

  // Decide the shape. A short widget gives the rows all of it; a wide one puts the ring beside them; a narrow, tall
  // one stacks them.
  const wide = width >= 480;
  const ringFits = height >= (wide ? 170 : 330);
  const stacked = !wide && ringFits;
  const ringSize = !ringFits ? 0 : wide ? Math.max(120, Math.min(height - 8, Math.round(width * 0.4), 320)) : Math.max(120, Math.min(width - 8, Math.round(height * 0.42), 240));
  const strokeWidth = Math.max(6, Math.round(ringSize / 20));

  // The rows get what the ring leaves, in one column or two.
  const listW = wide && ringSize ? width - ringSize - GAP : width;
  const listH = stacked ? height - ringSize - GAP : height;
  const columns = listW >= 640 ? 2 : 1;
  const compact = listH < open.length * ROW_FULL / columns && listH < 190 || listW < 230;
  const rowH = compact ? ROW_COMPACT : ROW_FULL;
  const capacity = Math.max(1, Math.floor(listH / rowH)) * columns;
  const rows = open.slice(0, open.length > capacity ? Math.max(1, capacity - 1) : capacity);
  const left = open.length - rows.length;

  return (
    <div className={cn('flex h-full min-h-0', stacked ? 'flex-col items-center' : 'items-center')} style={{ gap: GAP }}>
      {ringSize > 0 && (
        <div className="flex shrink-0 items-center justify-center" style={{ width: stacked ? undefined : ringSize }}>
          <RingChart data={data} size={ringSize} strokeWidth={strokeWidth} ringGap={Math.max(3, Math.round(strokeWidth / 2))} baseInnerRadius={Math.round(ringSize * 0.22)} hoveredIndex={hovered} onHoverChange={setHovered}>
            {data.map((_, index) => <Ring key={index} index={index} />)}
            <RingCenter defaultLabel="Saved" formatOptions={{ style: 'currency', currency: currencyCode(currency), notation: 'compact', maximumFractionDigits: 1 }} />
          </RingChart>
        </div>
      )}

      <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col justify-center self-stretch', stacked && 'w-full')}>
        {ringSize === 0 && (
          <p className="type-caption mb-1 flex shrink-0 items-baseline justify-between gap-3 text-muted">
            <span>Saved towards {open.length} {open.length === 1 ? 'goal' : 'goals'}</span>
            <span className="type-figure-row text-ink"><Amount value={saved} currency={currency} /></span>
          </p>
        )}
        <ul className={cn('no-scrollbar min-h-0 overflow-y-auto', columns === 2 ? 'grid grid-cols-2 gap-x-6 gap-y-0.5' : 'space-y-0.5')}>
          {rows.map((goal, index) => {
            const color = COLORS[index] ?? 'var(--muted)';
            const pct = Math.min(100, Math.round(goal.pct));
            return (
              <li key={goal.id}>
                <button
                  type="button"
                  onClick={onOpenGoals}
                  onMouseEnter={() => setHovered(index < MAX_RINGS ? index : null)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(index < MAX_RINGS ? index : null)}
                  onBlur={() => setHovered(null)}
                  className={cn('block w-full rounded-[var(--radius-md)] px-2 py-1.5 text-left transition-colors hover:bg-inset focus-visible:outline-2 focus-visible:outline-[var(--focus)]', hovered === index && 'bg-inset')}
                  style={{ minHeight: rowH - 2 }}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
                    <span className="type-body-strong min-w-0 flex-1 truncate text-ink">{goal.name}</span>
                    <span className="type-figure-row shrink-0 text-ink">{pct}%</span>
                  </span>
                  {!compact && (
                    <>
                      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-inset" role="progressbar" aria-label={`${goal.name} saved`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                        <span className="block h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }} />
                      </span>
                      <span className="type-caption mt-1 block truncate text-muted">
                        <Amount value={goal.saved} currency={currency} /> of <Amount value={goal.target} currency={currency} />
                        {goal.due ? ` · by ${parseLocalDate(goal.due).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}` : ''}
                      </span>
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        {left > 0 && <button type="button" onClick={onOpenGoals} className="type-caption mt-1 self-start rounded-full px-2 text-muted underline underline-offset-2 hover:text-ink">+{left} more in Goals</button>}
      </div>
    </div>
  );
};

export default GoalsRingsWidget;
