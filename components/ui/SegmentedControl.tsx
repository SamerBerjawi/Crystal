import React from 'react';
import Icon from './Icon';
import { cn } from '../../lib/utils';

// Kept so existing callers still type-check. Every accent now reads as the one segmented control.
const ACCENT_MAP = { primary: 0, amber: 0, emerald: 0, indigo: 0, cyan: 0, rose: 0, purple: 0, teal: 0, orange: 0 };

export interface SegmentedControlItem {
  id: string;
  label: string;
  icon?: string;
  count?: number;
  badge?: number | string | null;
}

export interface SegmentedControlProps {
  /** Mode: 'tabs' (default) or 'stepper' (for cycle/period navigation with prev/next arrows) */
  mode?: 'tabs' | 'stepper';
  /** Tab mode items */
  items?: SegmentedControlItem[];
  activeId?: string;
  activeTab?: string;
  onChange?: (id: string) => void;
  onTabChange?: (id: string) => void;
  /**
   * Semantic accent color for the active tab highlight.
   * @default "primary"
   */
  accentColor?: keyof typeof ACCENT_MAP;
  /**
   * When true, enables horizontal scrolling for many tabs on mobile.
   * Auto-enabled when items.length >= 5.
   */
  scrollable?: boolean;
  /** Stepper mode props */
  stepperLabel?: string;
  stepperValue?: string;
  stepperSubvalue?: string;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  /** Optional secondary action slot placed inside or alongside the stepper */
  rightSlot?: React.ReactNode;
  className?: string;
}

/**
 * SegmentedControl — the single, canonical tab and period selector for Crystal.
 *
 * Parameterized to handle:
 * 1. "Tabs with counts" across all views.
 * 2. "Period/cycle selectors with arrows" (e.g. Budgeting, Schedule).
 *
 * Conforms strictly to DESIGN.md tokens:
 * - rounded-2xl glass-subwell shell
 * - rounded-xl interactive buttons with 44px minimum touch target
 * - spring-animated active tab indicator
 */
const SegmentedControl: React.FC<SegmentedControlProps> = ({
  mode = 'tabs',
  items = [],
  activeId,
  activeTab,
  onChange,
  onTabChange,
  accentColor = 'primary',
  scrollable,
  stepperLabel = 'Active cycle',
  stepperValue,
  stepperSubvalue,
  onPrev,
  onNext,
  hasPrev = true,
  hasNext = true,
  rightSlot,
  className,
}) => {
  const isScrollable = scrollable ?? items.length >= 5;

  // Render Stepper Mode (Cycle/Month/Period Selector)
  if (mode === 'stepper') {
    return (
      <div
        className={cn(
          'flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3',
          'bg-inset p-[3px] rounded-full',
          className
        )}
      >
        {/* Prev / Current / Next Stepper */}
        <div className="flex items-center justify-between sm:justify-start gap-1 ">
          <button
            type="button"
            onClick={onPrev}
            disabled={!hasPrev}
            className={cn(
              'size-10 pointer-coarse:size-11 rounded-full transition-colors group shrink-0 flex items-center justify-center cursor-pointer text-ink',
              'hover:bg-surface disabled:opacity-30 disabled:pointer-events-none'
            )}
            title="Previous"
            aria-label="Previous"
          >
            <Icon name="chevron_left" className="text-lg leading-none group-hover:-translate-x-0.5 transition-transform" />
          </button>

          <div className="flex flex-col items-center px-4 sm:px-6 min-w-[130px] sm:min-w-[150px] select-none">
            {stepperLabel && (
              <span className="type-caption text-muted">
                {stepperLabel}
              </span>
            )}
            <span className="type-label text-ink">
              {stepperValue}
            </span>
            {stepperSubvalue && (
              <span className="type-caption text-muted">
                {stepperSubvalue}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onNext}
            disabled={!hasNext}
            className={cn(
              'size-10 pointer-coarse:size-11 rounded-full transition-colors group shrink-0 flex items-center justify-center cursor-pointer text-ink',
              'hover:bg-surface disabled:opacity-30 disabled:pointer-events-none'
            )}
            title="Next"
            aria-label="Next"
          >
            <Icon name="chevron_right" className="text-lg leading-none group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* Optional Right Action Slot */}
        {rightSlot && (
          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            {rightSlot}
          </div>
        )}
      </div>
    );
  }

  // Render Tabs Mode
  return (
    <div
      className={cn(
        'bg-inset p-[3px] rounded-full w-fit max-w-full',
        isScrollable ? 'overflow-x-auto no-scrollbar' : '',
        className
      )}
    >
      <div
        className={cn(
          'flex items-stretch gap-0.5',
          isScrollable ? 'min-w-max' : 'w-full'
        )}
      >
        {items.map((item) => {
          const currentActiveId = activeId ?? activeTab;
          const isActive = currentActiveId === item.id;
          const displayBadge = item.badge ?? item.count;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onChange?.(item.id);
                onTabChange?.(item.id);
              }}
              className={cn(
                'relative flex items-center gap-1.5 h-8 pointer-coarse:h-11 px-3.5 rounded-full',
                'text-[.8125rem] font-bold whitespace-nowrap',
                'transition-colors duration-[var(--duration-fast)] cursor-pointer select-none',
                isScrollable ? 'flex-none' : 'flex-1 justify-center',
                isActive
                  ? 'bg-surface text-ink'
                  : 'text-muted hover:text-ink'
              )}
            >

              {item.icon && (
                <Icon
                  name={item.icon}
                  size={16}
                  className="relative z-10"
                />
              )}

              <span className="relative z-10">{item.label}</span>

              {displayBadge !== undefined && displayBadge !== null && (
                <span
                  className="relative z-10 px-1.5 rounded-full bg-primary-soft text-ink type-caption tabular-nums"
                >
                  {displayBadge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SegmentedControl;
