import React, { useState, useMemo } from 'react';
import BottomSheet from './BottomSheet';
import Icon from './ui/Icon';

export interface FilterChip {
  id: string;
  label: string;
  icon?: string;
  color?: string;
  badge?: string | number;
  isActive: boolean;
  onToggle: () => void;
}

export interface FilterSection {
  title: string;
  icon?: string;
  type?: 'chips' | 'segmented';
  chips: FilterChip[];
  searchable?: boolean;
  searchPlaceholder?: string;
  onSelectAll?: () => void;
  onClearAll?: () => void;
}

interface MobileFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  sections: FilterSection[];
  /** Called when "Apply" is tapped */
  onApply?: () => void;
  /** Called when "Reset" is tapped */
  onReset?: () => void;
  /** Additional content rendered below the chip sections */
  children?: React.ReactNode;
  /** Active filter count for the badge */
  activeCount?: number;
  /** Result count for the Apply button (e.g. "142 transactions") */
  resultCount?: number;
  /** Max height percentage (default: 92) */
  maxHeight?: number;
}

/**
 * Individual iOS Grouped Section Card
 */
const FilterSectionCard: React.FC<{ section: FilterSection }> = ({ section }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const activeCount = useMemo(
    () => section.chips.filter((c) => c.isActive).length,
    [section.chips]
  );

  const filteredChips = useMemo(() => {
    if (!searchQuery.trim()) return section.chips;
    const lower = searchQuery.toLowerCase();
    return section.chips.filter((c) => c.label.toLowerCase().includes(lower));
  }, [section.chips, searchQuery]);

  if (section.type === 'segmented') {
    return (
      <div className="bg-white dark:bg-[#2c2c2e]/70 rounded-2xl p-3 border border-black/[0.04] dark:border-white/[0.06] shadow-2xs space-y-2">
        <div className="flex items-center gap-2 px-1">
          {section.icon && (
            <div className="w-5 h-5 rounded-md bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center">
              <Icon name={section.icon} className="text-xs" />
            </div>
          )}
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-light-text-secondary/70 dark:text-dark-text-secondary/70">
            {section.title}
          </h4>
        </div>

        {/* iOS Segmented Control */}
        <div className="p-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/5 dark:border-white/5 flex items-center gap-1">
          {section.chips.map((chip) => {
            const isActive = chip.isActive;
            return (
              <button
                key={chip.id}
                onClick={chip.onToggle}
                className={`touch-feedback flex-1 py-2 px-1.5 rounded-lg text-xs font-bold transition-all text-center relative flex items-center justify-center gap-1.5 min-h-[36px] ${
                  isActive
                    ? 'bg-white dark:bg-[#3a3a3c] text-light-text dark:text-white shadow-xs font-black'
                    : 'text-light-text-secondary dark:text-dark-text-secondary opacity-75 hover:opacity-100'
                }`}
              >
                {chip.icon && <Icon name={chip.icon} className="text-sm" />}
                <span className="truncate">{chip.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#2c2c2e]/70 rounded-2xl p-3.5 border border-black/[0.04] dark:border-white/[0.06] shadow-2xs space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          {section.icon && (
            <div className="w-5 h-5 rounded-md bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center">
              <Icon name={section.icon} className="text-xs" />
            </div>
          )}
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-light-text-secondary/70 dark:text-dark-text-secondary/70">
            {section.title}
          </h4>
        </div>

        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-500/15 text-primary-600 dark:text-primary-400 border border-primary-500/20">
              {activeCount} selected
            </span>
          )}
          {section.onSelectAll && (
            <button
              onClick={section.onSelectAll}
              className="text-[11px] font-semibold text-primary-600 dark:text-primary-400 hover:underline active:opacity-60 transition-opacity"
            >
              All
            </button>
          )}
          {section.onClearAll && activeCount > 0 && (
            <button
              onClick={section.onClearAll}
              className="text-[11px] font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 active:opacity-60 transition-opacity"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Optional Search bar for large chip collections */}
      {section.searchable && section.chips.length > 7 && (
        <div className="relative">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none" />
          <input
            type="text"
            placeholder={section.searchPlaceholder || `Search ${section.title.toLowerCase()}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-7 rounded-xl bg-black/[0.03] dark:bg-white/[0.06] border border-black/5 dark:border-white/5 text-[11px] font-medium text-light-text dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
            >
              <Icon name="close" className="text-xs" />
            </button>
          )}
        </div>
      )}

      {/* Chips Container */}
      <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto scroll-touch pr-0.5">
        {filteredChips.map((chip) => (
          <button
            key={chip.id}
            onClick={chip.onToggle}
            className={`touch-feedback inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-all border min-h-[36px] active:scale-95 ${
              chip.isActive
                ? 'bg-primary-500 text-white border-primary-500 shadow-sm shadow-primary-500/25 font-bold'
                : 'bg-black/[0.03] dark:bg-white/[0.06] border-black/[0.06] dark:border-white/[0.08] text-light-text dark:text-gray-200 hover:bg-black/[0.06] dark:hover:bg-white/[0.1]'
            }`}
          >
            {chip.icon && (
              <Icon
                name={chip.icon}
                className={`text-sm ${chip.isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}
                style={{ color: !chip.isActive && chip.color ? chip.color : undefined }}
              />
            )}
            <span>{chip.label}</span>
            {chip.isActive && <Icon name="check" className="text-xs text-white" />}
            {chip.badge !== undefined && (
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  chip.isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-black/5 dark:bg-white/10 text-gray-500 dark:text-gray-400'
                }`}
              >
                {chip.badge}
              </span>
            )}
          </button>
        ))}

        {filteredChips.length === 0 && (
          <p className="text-xs text-gray-400 py-3 text-center w-full">
            No matching {section.title.toLowerCase()} found
          </p>
        )}
      </div>
    </div>
  );
};

/**
 * Mobile Filter Sheet — Apple HIG Bottom Sheet for Filters
 *
 * Used in Transactions, Dashboard, Reports, etc. for advanced iOS filtering.
 */
const MobileFilterSheet: React.FC<MobileFilterSheetProps> = ({
  isOpen,
  onClose,
  title = 'Filters',
  subtitle,
  sections,
  onApply,
  onReset,
  children,
  activeCount = 0,
  resultCount,
  maxHeight = 92,
}) => {
  const hasActions = Boolean(onApply || onReset);

  // iOS Header Left Action: "Reset" Text Button
  const headerLeft = onReset ? (
    <button
      onClick={onReset}
      disabled={activeCount === 0}
      className={`touch-feedback text-sm font-semibold transition-opacity active:opacity-60 ${
        activeCount > 0
          ? 'text-primary-600 dark:text-primary-400'
          : 'text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-40'
      }`}
    >
      Reset
    </button>
  ) : null;

  // iOS Header Right Action: "Done" Button
  const headerRight = (
    <button
      onClick={() => {
        onApply?.();
        onClose();
      }}
      className="touch-feedback text-sm font-bold text-primary-600 dark:text-primary-400 active:opacity-60 px-2 py-1 transition-opacity"
    >
      Done
    </button>
  );

  // Sticky Frosted Footer
  const footer = hasActions ? (
    <div className="flex items-center gap-3">
      {onReset && (
        <button
          onClick={onReset}
          disabled={activeCount === 0}
          className={`touch-feedback flex-1 py-3 rounded-2xl text-sm font-semibold transition-all min-h-[46px] active:scale-[0.98] ${
            activeCount > 0
              ? 'text-light-text dark:text-white bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15'
              : 'text-gray-300 dark:text-gray-600 bg-black/[0.02] dark:bg-white/[0.03] opacity-40 cursor-not-allowed'
          }`}
        >
          Reset All
        </button>
      )}
      {onApply && (
        <button
          onClick={() => {
            onApply();
            onClose();
          }}
          className="touch-feedback flex-[1.6] py-3 rounded-2xl text-sm font-extrabold text-white bg-gradient-to-r from-primary-500 via-primary-600 to-indigo-600 hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-primary-500/25 min-h-[46px] flex items-center justify-center gap-2"
        >
          <span>Apply Filters</span>
          {resultCount !== undefined && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 font-mono font-bold">
              {resultCount}
            </span>
          )}
        </button>
      )}
    </div>
  ) : undefined;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={`${title}${activeCount > 0 ? ` (${activeCount})` : ''}`}
      subtitle={subtitle}
      maxHeight={maxHeight}
      headerLeft={headerLeft}
      headerRight={headerRight}
      footer={footer}
    >
      <div className="px-4 sm:px-5 py-4 space-y-4 pb-8">
        {sections.map((section) => (
          <FilterSectionCard key={section.title} section={section} />
        ))}

        {/* Additional custom content (e.g. date range selector) */}
        {children}
      </div>
    </BottomSheet>
  );
};

export default MobileFilterSheet;

/**
 * Filter Trigger Button — shown inline on mobile pages
 * with iOS pill styling and active count badge.
 */
export const FilterTriggerButton: React.FC<{
  onClick: () => void;
  activeCount?: number;
  label?: string;
  className?: string;
}> = ({ onClick, activeCount = 0, label = 'Filters', className = '' }) => (
  <button
    onClick={onClick}
    className={`touch-feedback md:hidden inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-semibold transition-all active:scale-95 shadow-xs border ${
      activeCount > 0
        ? 'bg-primary-500/15 border-primary-500/30 text-primary-600 dark:text-primary-400 font-bold shadow-primary-500/10'
        : 'bg-white/85 dark:bg-dark-card/85 backdrop-blur-md border-black/5 dark:border-white/10 text-light-text dark:text-white'
    } min-h-[38px] ${className}`}
  >
    <Icon name="tune" className={`text-base ${activeCount > 0 ? 'text-primary-500' : 'text-gray-500 dark:text-gray-400'}`} />
    <span>{label}</span>
    {activeCount > 0 && (
      <span className="ml-0.5 px-1.5 py-0.5 min-w-[20px] h-5 rounded-full bg-primary-500 text-white text-[10px] font-black flex items-center justify-center shadow-xs shadow-primary-500/40">
        {activeCount}
      </span>
    )}
  </button>
);

