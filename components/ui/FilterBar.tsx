import React, { forwardRef } from 'react';
import Icon from './Icon';
import { cn } from '../../lib/utils';

export interface FilterBarProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * FilterBar — canonical unified filtering system for Crystal.
 *
 * Enforces uniform 44px min touch targets, consistent border/background/focus styling,
 * standardized field labels, search inputs, dropdowns, advanced filters toggle,
 * and save-view bars across all pages.
 */
export const FilterBarRoot: React.FC<FilterBarProps> = ({ children, className }) => {
  return (
    <div
      className={cn(
        'p-4 sm:p-5 glass-section rounded-2xl border border-slate-200/60 dark:border-white/5 shadow-card',
        'relative transition-all duration-300',
        className
      )}
    >
      <div className="relative z-10 flex flex-col gap-4 sm:gap-5">
        {children}
      </div>
    </div>
  );
};

// Layout row helper
export interface FilterRowProps {
  children: React.ReactNode;
  dense?: boolean;
  className?: string;
}

export const FilterRow: React.FC<FilterRowProps> = ({ children, dense = false, className }) => {
  return (
    <div
      className={cn(
        'flex flex-col xl:flex-row items-stretch xl:items-end gap-3 sm:gap-4',
        dense ? 'flex-wrap' : '',
        className
      )}
    >
      {children}
    </div>
  );
};

// Standard Field Wrapper with consistent label
export interface FilterFieldProps {
  label?: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

export const FilterField: React.FC<FilterFieldProps> = ({ label, htmlFor, className, children }) => {
  return (
    <div className={cn('flex flex-col min-w-0', className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70 mb-1.5 truncate select-none"
        >
          {label}
        </label>
      )}
      {children}
    </div>
  );
};

// Standardized Search Input
export interface FilterSearchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear?: () => void;
  containerClassName?: string;
}

export const FilterSearch = forwardRef<HTMLInputElement, FilterSearchProps>(
  ({ value, onChange, onClear, placeholder = 'Search...', containerClassName, className, ...props }, ref) => {
    return (
      <div className={cn('relative flex-1 min-w-[200px] group', containerClassName)}>
        <Icon
          name="search"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary opacity-50 group-focus-within:opacity-100 group-focus-within:text-primary-500 transition-colors pointer-events-none text-base"
        />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={cn(
            'w-full min-h-[44px] h-11 pl-10 pr-9 rounded-xl',
            'bg-white/80 dark:bg-dark-card/60 border border-slate-200/80 dark:border-white/10',
            'text-xs sm:text-sm font-medium text-light-text dark:text-dark-text',
            'placeholder:text-light-text-secondary/50 dark:placeholder:text-dark-text-secondary/50',
            'outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/50',
            'transition-all duration-150 shadow-xs',
            className
          )}
          {...props}
        />
        {value && (
          <button
            type="button"
            onClick={onClear || (() => onChange({ target: { value: '' } } as any))}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-light-text-secondary hover:text-light-text dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Clear search"
          >
            <Icon name="close" className="text-xs" />
          </button>
        )}
      </div>
    );
  }
);
FilterSearch.displayName = 'FilterSearch';

// Standardized Select Dropdown
export interface FilterSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  containerClassName?: string;
  icon?: string;
}

export const FilterSelect = forwardRef<HTMLSelectElement, FilterSelectProps>(
  ({ children, containerClassName, className, icon, ...props }, ref) => {
    return (
      <div className={cn('relative min-w-[140px] flex-1', containerClassName)}>
        {icon && (
          <Icon
            name={icon}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-light-text-secondary opacity-60 text-base pointer-events-none"
          />
        )}
        <select
          ref={ref}
          className={cn(
            'w-full min-h-[44px] h-11 py-2 rounded-xl appearance-none cursor-pointer',
            icon ? 'pl-10 pr-9' : 'pl-3.5 pr-9',
            'bg-white/80 dark:bg-dark-card/60 border border-slate-200/80 dark:border-white/10',
            'text-xs sm:text-sm font-semibold text-light-text dark:text-dark-text',
            'outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/50',
            'transition-all duration-150 shadow-xs',
            className
          )}
          {...props}
        >
          {children}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-light-text-secondary dark:text-dark-text-secondary opacity-60">
          <Icon name="expand_more" className="text-sm" />
        </div>
      </div>
    );
  }
);
FilterSelect.displayName = 'FilterSelect';

// Standardized Text / Number / Date Input
export interface FilterInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
}

export const FilterInput = forwardRef<HTMLInputElement, FilterInputProps>(
  ({ containerClassName, className, ...props }, ref) => {
    return (
      <div className={cn('relative flex-1 min-w-[120px]', containerClassName)}>
        <input
          ref={ref}
          className={cn(
            'w-full min-h-[44px] h-11 px-3.5 rounded-xl',
            'bg-white/80 dark:bg-dark-card/60 border border-slate-200/80 dark:border-white/10',
            'text-xs sm:text-sm font-semibold text-light-text dark:text-dark-text',
            'placeholder:text-light-text-secondary/50 dark:placeholder:text-dark-text-secondary/50',
            'outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/50',
            'transition-all duration-150 shadow-xs',
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
FilterInput.displayName = 'FilterInput';

// Standardized Advanced Filters Toggle Button
export interface FilterAdvancedToggleProps {
  isExpanded: boolean;
  onToggle: () => void;
  activeCount?: number;
  className?: string;
}

export const FilterAdvancedToggle: React.FC<FilterAdvancedToggleProps> = ({
  isExpanded,
  onToggle,
  activeCount = 0,
  className,
}) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'min-h-[44px] h-11 px-4 rounded-xl font-semibold text-xs tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer select-none whitespace-nowrap',
        isExpanded
          ? 'bg-primary-500 text-white shadow-md shadow-primary-500/20'
          : 'bg-black/5 dark:bg-white/5 text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/10 dark:hover:bg-white/10 border border-black/5 dark:border-white/5',
        className
      )}
    >
      <Icon name={isExpanded ? 'keyboard_double_arrow_up' : 'tune'} className="text-base" />
      <span>{isExpanded ? 'Collapse filters' : 'Advanced filters'}</span>
      {activeCount > 0 && !isExpanded && (
        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-primary-500 text-white leading-none">
          {activeCount}
        </span>
      )}
    </button>
  );
};

// Standardized Save View Bar (e.g. for Reports)
export interface FilterSaveViewProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  placeholder?: string;
  isSaving?: boolean;
  className?: string;
}

export const FilterSaveView: React.FC<FilterSaveViewProps> = ({
  value,
  onChange,
  onSave,
  placeholder = 'Name this view to save configuration...',
  isSaving = false,
  className,
}) => {
  return (
    <div
      className={cn(
        'p-3 sm:p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5',
        'flex flex-col sm:flex-row items-stretch sm:items-center gap-3',
        className
      )}
    >
      <div className="relative flex-1">
        <Icon
          name="bookmark"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-light-text-secondary opacity-60 text-base"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'w-full min-h-[44px] h-11 pl-10 pr-4 rounded-xl',
            'bg-white/90 dark:bg-dark-card/80 border border-slate-200/80 dark:border-white/10',
            'text-xs sm:text-sm font-medium text-light-text dark:text-dark-text',
            'outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/50'
          )}
        />
      </div>

      <button
        type="button"
        disabled={!value.trim() || isSaving}
        onClick={onSave}
        className={cn(
          'min-h-[44px] h-11 px-5 rounded-xl text-xs font-bold tracking-wider uppercase',
          'bg-primary-600 dark:bg-primary-500 text-white shadow-md shadow-primary-600/20',
          'hover:bg-primary-500 transition-all flex items-center justify-center gap-2',
          'disabled:opacity-40 disabled:pointer-events-none cursor-pointer'
        )}
      >
        <Icon name="bookmark_add" className="text-base" />
        <span>Save view</span>
      </button>
    </div>
  );
};

// Standardized Saved Views Pill Bar
export interface SavedViewItem {
  id: string;
  name: string;
}

export interface FilterSavedViewsProps {
  views: SavedViewItem[];
  activeId?: string;
  onSelect: (view: SavedViewItem) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

export const FilterSavedViews: React.FC<FilterSavedViewsProps> = ({
  views,
  activeId,
  onSelect,
  onDelete,
  className,
}) => {
  if (!views.length) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary opacity-60 mr-1">
        Saved Views:
      </span>
      {views.map((view) => {
        const isActive = activeId === view.id;
        return (
          <div
            key={view.id}
            className={cn(
              'group flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-xl text-xs font-semibold transition-all border shadow-xs',
              isActive
                ? 'bg-primary-500/15 border-primary-500/30 text-primary-600 dark:text-primary-400'
                : 'glass-tile text-light-text-secondary hover:text-light-text border-slate-200/80 dark:border-white/10'
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(view)}
              className="cursor-pointer font-bold truncate max-w-[150px]"
            >
              {view.name}
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(view.id);
                }}
                className="w-5 h-5 rounded-md flex items-center justify-center hover:bg-rose-500 hover:text-white text-light-text-secondary transition-colors cursor-pointer"
                title="Delete view"
              >
                <Icon name="close" className="text-2xs" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Compose into canonical FilterBar object
export const FilterBar = Object.assign(FilterBarRoot, {
  Row: FilterRow,
  Field: FilterField,
  Search: FilterSearch,
  Select: FilterSelect,
  Input: FilterInput,
  AdvancedToggle: FilterAdvancedToggle,
  SaveView: FilterSaveView,
  SavedViews: FilterSavedViews,
});

export default FilterBar;
