import React, { useMemo } from 'react';
import { CategorySpending } from '../types';
import { getMainCurrency } from '../utils';
import { EntityGlyph } from './EntityIcon';
import { Amount } from './ui/Money';
import { EmptyState } from './ui/States';

interface OutflowsChartProps {
  data: CategorySpending[];
  onCategoryClick: (categoryName: string) => void;
}

/** Spending by category as bars. Each row opens that category's transactions. */
const OutflowsChart: React.FC<OutflowsChartProps> = ({ data, onCategoryClick }) => {
  const total = useMemo(() => (data || []).reduce((sum, item) => sum + item.value, 0), [data]);
  const max = useMemo(() => Math.max(...(data || []).map(item => item.value), 1), [data]);
  const currency = getMainCurrency();

  if (!data || data.length === 0) {
    return <EmptyState icon="pie-chart-01" title="No spending" description="Nothing went out in this period." className="h-full py-6" />;
  }

  return (
    <ul className="no-scrollbar -mx-2 h-full space-y-1 overflow-y-auto">
      {data.map(item => {
        const color = item.color || 'var(--chart-1)';
        return (
          <li key={item.name}>
            <button
              type="button"
              onClick={() => onCategoryClick(item.name)}
              className="w-full rounded-[var(--radius-md)] px-2 py-1.5 text-left transition-colors hover:bg-inset focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
              aria-label={`${item.name}, show its transactions`}
            >
              <span className="type-body mb-1 flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-ink">
                  <EntityGlyph icon={item.icon} label={item.name} color={item.color} size={16} />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="type-figure-row shrink-0 text-ink">
                  <Amount value={item.value} currency={currency} />
                  <span className="type-caption ml-2 inline-block w-10 text-right text-muted">{total > 0 ? ((item.value / total) * 100).toFixed(1) : '0'}%</span>
                </span>
              </span>
              <span className="block h-1.5 overflow-hidden rounded-full bg-inset" aria-hidden>
                <span className="block h-full rounded-full" style={{ width: `${Math.max((item.value / max) * 100, 2)}%`, backgroundColor: color }} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default OutflowsChart;
