import React from 'react';
import BottomSheet from './BottomSheet';
import Icon from './ui/Icon';

interface FilterChip {
  id: string;
  label: string;
  icon?: string;
  isActive: boolean;
  onToggle: () => void;
}

interface FilterSection {
  title: string;
  chips: FilterChip[];
}

interface MobileFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  sections: FilterSection[];
  /** Called when "Apply" is tapped */
  onApply?: () => void;
  /** Called when "Reset" is tapped */
  onReset?: () => void;
  /** Additional content rendered below the chip sections */
  children?: React.ReactNode;
  /** Active filter count for the badge */
  activeCount?: number;
}

/**
 * Mobile Filter Sheet — Apple HIG Bottom Sheet for Filters
 *
 * Used in Transactions, Reports, Merchants, etc. for advanced filtering.
 * Displays filter options as tappable chips grouped by section.
 */
const MobileFilterSheet: React.FC<MobileFilterSheetProps> = ({
  isOpen,
  onClose,
  title = 'Filters',
  sections,
  onApply,
  onReset,
  children,
  activeCount = 0,
}) => {
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={`${title}${activeCount > 0 ? ` (${activeCount})` : ''}`}
      maxHeight={75}
      showClose
    >
      <div className="px-5 py-4 space-y-6">
        {sections.map((section) => (
          <div key={section.title} className="space-y-2.5">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-light-text-secondary/60 dark:text-dark-text-secondary/50">
              {section.title}
            </h4>
            <div className="flex flex-wrap gap-2">
              {section.chips.map((chip) => (
                <button
                  key={chip.id}
                  onClick={chip.onToggle}
                  className={`touch-feedback inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-all duration-200 border min-h-[36px] ${
                    chip.isActive
                      ? 'bg-primary-500/15 border-primary-500/30 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'bg-gray-50 dark:bg-gray-800/50 border-black/5 dark:border-white/10 text-light-text-secondary dark:text-dark-text-secondary'
                  }`}
                >
                  {chip.icon && <Icon name={chip.icon} className="text-sm" />}
                  {chip.label}
                  {chip.isActive && (
                    <Icon name="check" className="text-sm text-primary-500" />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Additional custom content */}
        {children}

        {/* Action buttons */}
        {(onApply || onReset) && (
          <div className="flex items-center gap-3 pt-4 border-t border-black/5 dark:border-white/5">
            {onReset && (
              <button
                onClick={onReset}
                className="touch-feedback flex-1 py-3 rounded-2xl text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary bg-gray-100 dark:bg-gray-800 transition-colors min-h-[44px]"
              >
                Reset All
              </button>
            )}
            {onApply && (
              <button
                onClick={() => { onApply(); onClose(); }}
                className="touch-feedback flex-1 py-3 rounded-2xl text-sm font-bold text-white bg-primary-500 hover:bg-primary-600 transition-colors shadow-lg shadow-primary-500/25 min-h-[44px]"
              >
                Apply Filters
              </button>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
};

export default MobileFilterSheet;

/**
 * Filter Trigger Button — shown inline on mobile pages
 * to open the MobileFilterSheet.
 */
export const FilterTriggerButton: React.FC<{
  onClick: () => void;
  activeCount?: number;
  label?: string;
}> = ({ onClick, activeCount = 0, label = 'Filters' }) => (
  <button
    onClick={onClick}
    className="touch-feedback md:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/80 dark:bg-dark-card/80 border border-black/5 dark:border-white/10 text-xs font-semibold text-light-text dark:text-dark-text min-h-[36px] transition-all active:scale-95"
  >
    <Icon name="tune" className="text-base" />
    <span>{label}</span>
    {activeCount > 0 && (
      <span className="ml-0.5 w-5 h-5 rounded-full bg-primary-500 text-white text-[10px] font-bold flex items-center justify-center">
        {activeCount}
      </span>
    )}
  </button>
);
