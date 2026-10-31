import React from 'react';
import type { BudgetStatus } from '../utils/budgetModel';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { Badge } from './ui/Display';
import Icon from './ui/Icon';
import { Amount } from './ui/Money';

const STATUS = {
  over: { label: 'Over', tone: 'negative', bar: 'bg-money-out' },
  near: { label: 'Near the cap', tone: 'attention', bar: 'bg-amber' },
  ahead: { label: 'Ahead of pace', tone: 'attention', bar: 'bg-amber' },
  ok: { label: 'Under pace', tone: 'positive', bar: 'bg-[var(--primary)]' },
} as const;

const toneDot = (color?: string) => (color ? { color } : undefined);

export interface BudgetRowProps {
  name: string;
  icon?: string;
  color?: string;
  spent: number;
  /** Absent for a category with no budget. */
  limit?: number;
  pct?: number;
  status?: BudgetStatus;
  /** Where even spending would be today, 0 to 100. */
  pacePct?: number;
  currency: 'EUR';
  onPress: () => void;
}

/** One category: spent against its cap, with a tick where even spending would be today (D-015). */
const BudgetRow: React.FC<BudgetRowProps> = ({ name, icon, color, spent, limit, pct = 0, status, pacePct, currency, onPress }) => {
  const style = status ? STATUS[status] : null;
  const hasLimit = limit !== undefined;
  const remaining = hasLimit ? limit - spent : 0;
  return (
    <button type="button" onClick={onPress} className="flex w-full cursor-pointer items-start gap-3 rounded-[var(--radius-lg)] p-2 text-left transition-colors duration-[var(--duration-fast)] hover:bg-inset">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-inset" style={toneDot(color)}><Icon name={icon || 'category'} size={20} /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <span className="type-body-strong truncate text-ink">{name}</span>
            {style && <span className="max-sm:hidden"><Badge tone={style.tone}>{style.label}</Badge></span>}
          </span>
          <span className="shrink-0 text-right text-ink">
            <span className="type-figure-row"><Amount value={spent} currency={currency} /></span>
            {hasLimit && <span className="type-caption text-muted"> of <Amount value={limit} currency={currency} /></span>}
          </span>
        </span>
        {hasLimit ? (
          <>
            <span className="relative mt-2 block h-2 rounded-full bg-inset">
              <span className="block h-full overflow-hidden rounded-full">
                <motion.span
                  className={cn('block h-full rounded-full', style?.bar)}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, pct)}%` }}
                  transition={{ duration: 0.9, ease: [0.77, 0, 0.175, 1] }}
                />
              </span>
              {pacePct !== undefined && <span aria-hidden="true" className="absolute -inset-y-1 w-0.5 rounded-full bg-ink" style={{ left: `${pacePct}%` }} />}
            </span>
            <span className={cn('type-caption mt-1 block', remaining < 0 ? 'text-money-out' : 'text-muted')}>
              <Amount value={Math.abs(remaining)} currency={currency} /> {remaining < 0 ? 'over' : 'left'}, {Math.round(pct)}% used
              {style && <span className="sm:hidden">. {style.label}</span>}
            </span>
          </>
        ) : (
          <span className="type-caption mt-1 block text-muted">No budget yet. Tap to set one.</span>
        )}
      </span>
    </button>
  );
};

export default BudgetRow;
