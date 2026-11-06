import React, { useMemo, useState } from 'react';
import type { Currency, FinancialGoal } from '../types';
import { goalViews } from '../utils/budgetModel';
import { RingChart, Ring, RingCenter } from '../src/components/charts';
import { parseLocalDate } from '../utils';
import { Amount } from './ui/Money';
import { EmptyState } from './ui/States';
import { fitRows, useWidgetBox } from './ui/WidgetGrid';

interface GoalsRingsWidgetProps {
  goals: FinancialGoal[];
  currency: Currency;
  /** Converts an amount in its own currency to the display currency. */
  toDisplay: (amount: number, from: Currency) => number;
  onOpenGoals: () => void;
}

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
const MAX_RINGS = 5;

/** Each goal still being saved for is a ring, filling towards its target, with the total saved in the middle. */
const GoalsRingsWidget: React.FC<GoalsRingsWidgetProps> = ({ goals, currency, toDisplay, onOpenGoals }) => {
  const box = useWidgetBox();
  const [hovered, setHovered] = useState<number | null>(null);

  const open = useMemo(() => goalViews(goals, toDisplay).filter(goal => !goal.done && goal.target > 0), [goals, toDisplay]);
  const shown = open.slice(0, MAX_RINGS);
  const extra = open.length - shown.length;
  const saved = shown.reduce((sum, goal) => sum + goal.saved, 0);
  const target = shown.reduce((sum, goal) => sum + goal.target, 0);

  if (open.length === 0) {
    return <EmptyState icon="target-01" title="No goals in progress" description="Set a goal and its progress fills a ring here." actionLabel="Open Goals" onAction={onOpenGoals} className="h-full py-6" />;
  }

  const side = box.width >= 440 || box.width === 0;
  const size = box.height > 0 ? Math.max(120, Math.min(box.height - 8, side ? Math.round(box.width * 0.42) : box.width - 8, 300)) : 220;
  const showRing = box.height === 0 || box.height >= 180;
  const rowsFit = fitRows(box, 48, shown.length, side ? 0 : size + 8);
  const data = shown.map((goal, index) => ({ label: goal.name, value: goal.saved, maxValue: goal.target, color: COLORS[index] }));
  const strokeWidth = Math.max(6, Math.round(size / 22));

  return (
    <div className={`flex h-full gap-5 ${side ? '' : 'flex-col items-center'}`}>
      {showRing && (
        <div className="flex shrink-0 items-center justify-center" style={{ width: side ? size : undefined }}>
          <RingChart data={data} size={size} strokeWidth={strokeWidth} ringGap={Math.max(3, Math.round(strokeWidth / 2))} baseInnerRadius={Math.round(size * 0.2)} hoveredIndex={hovered} onHoverChange={setHovered}>
            {data.map((_, index) => <Ring key={index} index={index} />)}
            <RingCenter defaultLabel="Saved" formatOptions={{ style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }} />
          </RingChart>
        </div>
      )}

      <ul className="no-scrollbar -mx-1 min-h-0 min-w-0 flex-1 space-y-0.5 self-stretch overflow-y-auto px-1">
        {shown.slice(0, Math.max(1, rowsFit)).map((goal, index) => (
          <li key={goal.id}>
            <button
              type="button"
              onClick={onOpenGoals}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
              className={`flex w-full items-center gap-3 rounded-[var(--radius-md)] px-2 py-1.5 text-left transition-colors hover:bg-inset focus-visible:outline-2 focus-visible:outline-[var(--focus)] ${hovered === index ? 'bg-inset' : ''}`}
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index] }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="type-body-strong block truncate text-ink">{goal.name}</span>
                <span className="type-caption block truncate text-muted">
                  <Amount value={goal.saved} currency={currency} /> of <Amount value={goal.target} currency={currency} />
                  {goal.due ? ` · by ${parseLocalDate(goal.due).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}` : ''}
                </span>
              </span>
              <span className="type-figure-row shrink-0 text-ink">{Math.round(goal.pct)}%</span>
            </button>
          </li>
        ))}
        {extra > 0 && <li className="type-caption px-2 pt-1 text-muted">+{extra} more in Goals</li>}
      </ul>
    </div>
  );
};

export default GoalsRingsWidget;
