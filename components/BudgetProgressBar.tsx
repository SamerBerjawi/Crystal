import React from 'react';
import { Currency } from '../types';
import { getMainCurrency } from '../utils';
import { Badge } from './ui/Display';
import { Amount } from './ui/Money';

export interface BudgetProgressBarProps {
  spent: number;
  budgeted: number;
  currency?: Currency;
  categoryName?: string;
  /** From this share of the budget, the bar turns amber. */
  warningThreshold?: number;
  className?: string;
}

/** One budget's spending against its limit: amber from 80%, red once over. */
export const BudgetProgressBar: React.FC<BudgetProgressBarProps> = ({
  spent,
  budgeted,
  currency = getMainCurrency(),
  categoryName,
  warningThreshold = 80,
  className = '',
}) => {
  const percentage = budgeted > 0 ? (spent / budgeted) * 100 : 0;
  const isOver = percentage >= 100;
  const isNear = !isOver && percentage >= warningThreshold;
  const fill = isOver ? 'bg-money-out' : isNear ? 'bg-amber' : 'bg-primary';

  return (
    <div className={`w-full space-y-1.5 ${className}`}>
      <div className="type-body flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          {categoryName && <span className="type-body-strong truncate text-ink">{categoryName}</span>}
          {isOver && <Badge tone="negative">Over</Badge>}
          {isNear && <Badge tone="attention">Nearly there</Badge>}
        </span>
        <span className="type-figure-row shrink-0 text-ink">{percentage.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-inset" aria-hidden>
        <div className={`h-full rounded-full transition-[width] duration-700 ${fill}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
      </div>
      <div className="type-caption flex justify-between gap-3 text-muted">
        <span><Amount value={spent} currency={currency} className="text-ink" /> spent</span>
        <span>of <Amount value={budgeted} currency={currency} className="text-ink" /></span>
      </div>
    </div>
  );
};

export default BudgetProgressBar;
