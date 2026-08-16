import React, { useState, useEffect, useRef } from 'react';
import { useHeaderControls } from '@/contexts/HeaderContext';
import Icon from './ui/Icon';

interface PageHeaderProps {
  markerIcon?: string;
  markerLabel?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Responsive PageHeader — Apple HIG Large Title on mobile.
 *
 * On mobile (< md), the title starts large and compacts on scroll,
 * mimicking the iOS large-title → inline-title navigation bar behaviour.
 */
const PageHeader: React.FC<PageHeaderProps> = ({
  markerIcon,
  markerLabel,
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

  return (
    <>
      {/* Sentinel element — when this scrolls out of view, title compacts */}
      <div ref={sentinelRef} className="h-0 w-0 md:hidden" aria-hidden="true" />

      <header className={`flex flex-col gap-3 pb-4 mb-6 border-b border-black/5 dark:border-white/5 ${className}`}>
        {/* Mobile: Compact inline bar (visible after scroll) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left Side: Mobile Menu Toggle + Marker + Title + Subtitle */}
          <div className="flex items-start gap-3 min-w-0">
            {onOpenSidebar && (
              <button
                onClick={onOpenSidebar}
                className="md:hidden p-2 rounded-xl text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0 mt-0.5 min-h-[44px] min-w-[44px] flex items-center justify-center touch-feedback"
                aria-label="Open navigation menu"
              >
                <Icon name="menu" className="text-xl" />
              </button>
            )}

            <div className="flex flex-col gap-1 min-w-0">
              {markerIcon && markerLabel && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 dark:text-primary-400 tracking-wider uppercase">
                  <Icon name={markerIcon} className="text-sm leading-none" />
                  <span className="leading-none">{markerLabel}</span>
                </div>
              )}

              {/* Mobile: Large title that fades to compact */}
              <h1
                className={`font-bold tracking-tight leading-tight text-light-text dark:text-dark-text transition-all duration-200 ease-out ${isCompact
                    ? 'text-lg md:text-3xl'
                    : 'text-2xl md:text-4xl'
                  }`}
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
                  onClick={onOpenSearch}
                  className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-xs font-semibold transition-all text-light-text-secondary dark:text-dark-text-secondary border border-black/5 dark:border-white/5 active:scale-[0.98]"
                  title="Search & Quick Actions (⌘K)"
                >
                  <Icon name="search" className="text-base" />
                  <span>Search</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 text-xs font-mono leading-none">⌘K</kbd>
                </button>
                <button
                  onClick={onOpenSearch}
                  className="flex sm:hidden items-center justify-center w-9 h-9 min-h-[44px] min-w-[44px] rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary border border-black/5 dark:border-white/5 transition-all touch-feedback"
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

export default PageHeader;
