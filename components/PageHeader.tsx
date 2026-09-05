import React, { useState, useEffect, useRef } from 'react';
import { useHeaderControls } from '@/contexts/HeaderContext';
import Icon from './ui/Icon';
import { cn } from '../lib/utils';

export interface PageHeaderProps {
  markerIcon?: string;
  markerLabel?: string;
  markerClassName?: string;
  /**
   * Semantic accent color for the category badge tint.
   * Defaults to 'primary'.
   */
  accentColor?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

const BADGE_ACCENT_MAP: Record<string, string> = {
  primary: 'bg-primary-500/10 dark:bg-primary-500/15 border-primary-500/20 text-primary-600 dark:text-primary-400',
  emerald: 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  rose: 'bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/20 text-rose-600 dark:text-rose-400',
  amber: 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/20 text-amber-700 dark:text-amber-300',
  blue: 'bg-blue-500/10 dark:bg-blue-500/15 border-blue-500/20 text-blue-600 dark:text-blue-400',
  indigo: 'bg-indigo-500/10 dark:bg-indigo-500/15 border-indigo-500/20 text-indigo-600 dark:text-indigo-400',
  purple: 'bg-purple-500/10 dark:bg-purple-500/15 border-purple-500/20 text-purple-600 dark:text-purple-400',
  teal: 'bg-teal-500/10 dark:bg-teal-500/15 border-teal-500/20 text-teal-600 dark:text-teal-400',
  orange: 'bg-orange-500/10 dark:bg-orange-500/15 border-orange-500/20 text-orange-600 dark:text-orange-400',
  slate: 'bg-slate-500/10 dark:bg-slate-500/15 border-slate-500/20 text-slate-600 dark:text-slate-400',
};

/**
 * Responsive PageHeader / HeroHeader — Apple HIG Large Title on mobile.
 *
 * Conforms to DESIGN.md:
 * - Tinted category badge with micro-rhythm (rounded-full, px-2.5 py-0.5, text-[11px] font-bold)
 * - Large Title H1 (text-2xl md:text-4xl font-bold) with mobile compact scroll effect
 * - Standardized action-bar slot
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  markerIcon,
  markerLabel,
  markerClassName,
  accentColor = 'primary',
  title,
  subtitle,
  actions,
  className = '',
}) => {
  const { onOpenSidebar, onOpenSearch, notificationCenter } = useHeaderControls();
  const [isCompact, setIsCompact] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver collapses the large title once it scrolls off-screen
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsCompact(!entry.isIntersecting),
      { threshold: 0, rootMargin: '-1px 0px 0px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const badgeColorClass =
    markerClassName ||
    BADGE_ACCENT_MAP[accentColor] ||
    BADGE_ACCENT_MAP.primary;

  return (
    <>
      {/* Sentinel element — when this scrolls out of view, title compacts */}
      <div ref={sentinelRef} className="h-0 w-0 md:hidden" aria-hidden="true" />

      <header className={cn('flex flex-col gap-3 pb-4 mb-6 border-b border-slate-200/60 dark:border-white/5', className)}>
        {/* Mobile: Compact inline bar (visible after scroll) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left Side: Mobile Menu Toggle + Marker + Title + Subtitle */}
          <div className="flex items-start gap-3 min-w-0">
            {onOpenSidebar && (
              <button
                type="button"
                onClick={onOpenSidebar}
                className="md:hidden p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/5 transition-colors shrink-0 mt-0.5 min-h-[44px] min-w-[44px] flex items-center justify-center touch-feedback cursor-pointer"
                aria-label="Open navigation menu"
              >
                <Icon name="menu" className="text-xl" />
              </button>
            )}

            <div className="flex flex-col gap-1 min-w-0">
              {markerIcon && markerLabel && (
                <div
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full w-fit text-[11px] font-bold tracking-wider uppercase mb-0.5 border',
                    badgeColorClass
                  )}
                >
                  <Icon name={markerIcon} className="text-xs leading-none" />
                  <span className="leading-none">{markerLabel}</span>
                </div>
              )}

              {/* Title (Apple HIG Large Title with compact transition) */}
              <h1
                className={cn(
                  'font-bold tracking-tight leading-tight text-light-text dark:text-dark-text transition-all duration-200 ease-out',
                  isCompact ? 'text-lg md:text-3xl' : 'text-2xl md:text-4xl'
                )}
              >
                {title}
              </h1>

              {subtitle && !isCompact && (
                <p className="text-sm md:text-base font-normal text-light-text-secondary dark:text-dark-text-secondary max-w-3xl leading-normal">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Right Side: Page Action Buttons + Search Button + Notification Bell */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap justify-end">
            {actions}

            {onOpenSearch && (
              <>
                <button
                  type="button"
                  onClick={onOpenSearch}
                  className="hidden sm:flex items-center gap-2 h-10 px-3 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-xs font-semibold transition-all text-light-text-secondary dark:text-dark-text-secondary border border-black/5 dark:border-white/5 active:scale-[0.98] min-h-[44px] cursor-pointer"
                  title="Search & Quick Actions (⌘K)"
                >
                  <Icon name="search" className="text-base" />
                  <span>Search</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 text-xs font-mono leading-none">⌘K</kbd>
                </button>
                <button
                  type="button"
                  onClick={onOpenSearch}
                  className="flex sm:hidden items-center justify-center w-11 h-11 min-h-[44px] min-w-[44px] rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary border border-black/5 dark:border-white/5 transition-all touch-feedback cursor-pointer"
                  title="Search & Quick Actions"
                  aria-label="Search"
                >
                  <Icon name="search" className="text-base" />
                </button>
              </>
            )}

            {notificationCenter}
          </div>
        </div>
      </header>
    </>
  );
};

export const HeroHeader = PageHeader;
export default PageHeader;
