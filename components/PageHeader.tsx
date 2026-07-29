import React from 'react';
import { useHeaderControls } from '@/contexts/HeaderContext';

interface PageHeaderProps {
  markerIcon?: string;
  markerLabel?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  markerIcon,
  markerLabel,
  title,
  subtitle,
  actions,
  className = '',
}) => {
  const { onOpenSidebar, onOpenSearch, notificationCenter } = useHeaderControls();

  return (
    <header className={`flex flex-col gap-3 pb-4 mb-6 border-b border-black/5 dark:border-white/5 ${className}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Side: Mobile Menu Toggle + Marker + Title + Subtitle */}
        <div className="flex items-start gap-3 min-w-0">
          {onOpenSidebar && (
            <button
              onClick={onOpenSidebar}
              className="md:hidden p-2 rounded-xl text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0 mt-0.5"
              aria-label="Open navigation menu"
            >
              <span className="material-symbols-outlined text-xl">menu</span>
            </button>
          )}

          <div className="flex flex-col gap-1 min-w-0">
            {markerIcon && markerLabel && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary-600 dark:text-primary-400 tracking-wide">
                <span className="material-symbols-outlined text-base leading-none">{markerIcon}</span>
                <span className="leading-none">{markerLabel}</span>
              </div>
            )}
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight text-light-text dark:text-dark-text">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary max-w-3xl opacity-70 leading-relaxed">
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
                <span className="material-symbols-outlined text-base">search</span>
                <span>Search</span>
                <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 text-[10px] font-mono leading-none">⌘K</kbd>
              </button>
              <button
                onClick={onOpenSearch}
                className="flex sm:hidden items-center justify-center w-9 h-9 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary border border-black/5 dark:border-white/5 transition-all active:scale-[0.98]"
                title="Search & Quick Actions"
                aria-label="Search"
              >
                <span className="material-symbols-outlined text-base">search</span>
              </button>
            </>
          )}

          {notificationCenter}
        </div>
      </div>
    </header>
  );
};

export default PageHeader;
