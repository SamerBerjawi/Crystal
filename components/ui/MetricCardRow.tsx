import React from 'react';
import HeroMetricCard, { HeroMetricCardProps } from './HeroMetricCard';
import { cn } from '../../lib/utils';

export interface MetricCardRowProps {
  children?: React.ReactNode;
  /** Optional array of card configurations if not using children directly */
  cards?: HeroMetricCardProps[];
  /** Grid column configuration */
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}

const COLUMN_MAP = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
};

/**
 * MetricCardRow — canonical hero stat card group for Crystal.
 *
 * Enforces unified visual rhythm across all pages:
 * - Supports 1 primary card (larger value, accent border/glow) + secondary cards
 * - Standardized grid spacing (gap-3 sm:gap-4 lg:gap-6)
 * - Light and dark mode support
 */
export const MetricCardRow: React.FC<MetricCardRowProps> & {
  Card: typeof HeroMetricCard;
} = ({
  children,
  cards,
  columns = 4,
  className,
}) => {
  const colClass = COLUMN_MAP[columns] || COLUMN_MAP[4];

  return (
    <div className={cn('grid auto-rows-auto gap-3 sm:gap-4 lg:gap-6 w-full', colClass, className)}>
      {cards
        ? cards.map((card, idx) => (
            <HeroMetricCard key={card.label || idx} {...card} />
          ))
        : children}
    </div>
  );
};

MetricCardRow.Card = HeroMetricCard;

export default MetricCardRow;
