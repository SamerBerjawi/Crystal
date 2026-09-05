import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Icon from './Icon';
import { cn } from '../../lib/utils';

// Accent color → active pill classes
const ACCENT_MAP: Record<string, { active: string; glow: string; countActive: string }> = {
  primary: {
    active: 'glass-tile text-primary-600 dark:text-primary-400 border border-primary-500/30 shadow-card',
    glow: 'shadow-[0_0_16px_rgba(250,154,29,0.2)]',
    countActive: 'bg-primary-500/15 text-primary-600 dark:text-primary-400',
  },
  amber: {
    active: 'glass-tile text-amber-600 dark:text-amber-300 border border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.25)]',
    glow: '',
    countActive: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  emerald: {
    active: 'glass-tile text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-card',
    glow: '',
    countActive: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  },
  indigo: {
    active: 'glass-tile text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 shadow-card',
    glow: '',
    countActive: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
  },
  cyan: {
    active: 'glass-tile text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 shadow-card',
    glow: '',
    countActive: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
  },
  rose: {
    active: 'glass-tile text-rose-600 dark:text-rose-400 border border-rose-500/30 shadow-card',
    glow: '',
    countActive: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  },
  purple: {
    active: 'glass-tile text-purple-600 dark:text-purple-400 border border-purple-500/30 shadow-card',
    glow: '',
    countActive: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  },
  teal: {
    active: 'glass-tile text-teal-600 dark:text-teal-400 border border-teal-500/30 shadow-card',
    glow: '',
    countActive: 'bg-teal-500/15 text-teal-600 dark:text-teal-400',
  },
  orange: {
    active: 'glass-tile text-orange-600 dark:text-orange-400 border border-orange-500/30 shadow-card',
    glow: '',
    countActive: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  },
};

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
  const accent = ACCENT_MAP[accentColor] ?? ACCENT_MAP.primary;

  // Render Stepper Mode (Cycle/Month/Period Selector)
  if (mode === 'stepper') {
    return (
      <div
        className={cn(
          'flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3',
          'glass-subwell p-1.5 rounded-2xl border border-black/5 dark:border-white/5 shadow-xs',
          className
        )}
      >
        {/* Prev / Current / Next Stepper */}
        <div className="flex items-center justify-between sm:justify-start gap-1 glass-tile p-1 rounded-xl shadow-xs">
          <button
            type="button"
            onClick={onPrev}
            disabled={!hasPrev}
            className={cn(
              'p-2.5 rounded-xl transition-all active:scale-95 group shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer',
              'hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none'
            )}
            title="Previous"
            aria-label="Previous"
          >
            <Icon name="chevron_left" className="text-lg leading-none group-hover:-translate-x-0.5 transition-transform" />
          </button>

          <div className="flex flex-col items-center px-4 sm:px-6 min-w-[130px] sm:min-w-[150px] select-none">
            {stepperLabel && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-60 leading-none mb-1">
                {stepperLabel}
              </span>
            )}
            <span className="text-xs sm:text-sm font-bold tracking-tight text-light-text dark:text-dark-text leading-none">
              {stepperValue}
            </span>
            {stepperSubvalue && (
              <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary opacity-70 mt-0.5">
                {stepperSubvalue}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onNext}
            disabled={!hasNext}
            className={cn(
              'p-2.5 rounded-xl transition-all active:scale-95 group shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer',
              'hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none'
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
        'glass-subwell p-1.5 rounded-2xl shadow-xs border border-black/5 dark:border-white/5',
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
                'relative flex items-center gap-2 px-4 py-2.5 rounded-xl',
                'text-xs font-bold tracking-wide whitespace-nowrap',
                'transition-colors duration-200 cursor-pointer select-none',
                'min-h-[44px]', // DESIGN.md touch target
                isScrollable ? 'flex-none' : 'flex-1 justify-center',
                isActive
                  ? cn(accent.active, 'scale-[1.02]')
                  : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text hover:glass-tile opacity-75 hover:opacity-100'
              )}
            >
              {/* Spring-animated active background */}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="segmented-control-pill"
                    className="absolute inset-0 rounded-xl pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  />
                )}
              </AnimatePresence>

              {item.icon && (
                <Icon
                  name={item.icon}
                  className={cn(
                    'text-lg sm:text-xl relative z-10 transition-all duration-200',
                    isActive ? 'scale-110' : 'scale-100'
                  )}
                />
              )}

              <span className="relative z-10">{item.label}</span>

              {displayBadge !== undefined && displayBadge !== null && (
                <span
                  className={cn(
                    'relative z-10 px-1.5 py-0.5 rounded-md text-[10px] font-semibold tabular-nums leading-none',
                    isActive
                      ? accent.countActive
                      : 'bg-black/5 dark:bg-white/5 text-light-text-secondary/70 dark:text-dark-text-secondary/70'
                  )}
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
