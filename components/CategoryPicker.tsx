import React, { useMemo } from 'react';
import type { Category } from '../types';
import { Checkbox } from './ui/Fields';
import { Combobox } from './ui/Pickers';
import Icon from './ui/Icon';
import { EntityGlyph } from './EntityIcon';
import { getCategoryDetails } from '../utils/categories';
import { cn } from '../lib/utils';

interface CategoryPickerProps {
  error?: string;
  categories: Category[];
  suggestions: string[];
  value: string | null;
  onChange: (name: string) => void;
  /** "Always file like this" (D-041). Leave out where there's no merchant to remember it for. */
  alwaysFile?: { merchant: string; isSelected: boolean; onChange: (selected: boolean) => void };
  /** Supports an "All categories" option (id: 'all') for filtering. */
  allowAll?: boolean;
}

const flatten = (categories: Category[], allowAll?: boolean) => {
  const base = categories.flatMap(category => [
    {
      id: category.name,
      label: category.name,
      group: category.name,
      level: 0,
      visual: <EntityGlyph icon={category.icon} label={category.name} color={category.color} size={16} />,
    },
    ...category.subCategories.map(sub => ({
      id: sub.name,
      label: sub.name,
      description: category.name,
      group: category.name,
      level: 1,
      visual: <EntityGlyph icon={sub.icon || category.icon} label={sub.name} color={sub.color || category.color} size={16} />,
    })),
  ]);

  if (allowAll) {
    return [
      {
        id: 'all',
        label: 'All categories',
        description: 'Show spending across all categories',
        group: 'All',
        level: 0,
        visual: <EntityGlyph icon="category" label="All" color="var(--muted)" size={16} />,
      },
      ...base,
    ];
  }

  return base;
};

/** Three suggestions, a searchable list, and a way to make it stick. */
const CategoryPicker: React.FC<CategoryPickerProps> = ({ categories, suggestions, value, onChange, alwaysFile, error, allowAll }) => {
  const options = useMemo(() => {
    const seen = new Set<string>();
    return flatten(categories, allowAll).filter(option => !seen.has(option.id) && !!seen.add(option.id));
  }, [categories, allowAll]);

  return (
    <div className="space-y-3">
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested categories">
          {suggestions.map(name => {
            const isAll = name === 'all' || name === 'All categories';
            const details = isAll ? { icon: 'category', color: 'var(--muted)' } : getCategoryDetails(name, categories);
            const isPicked = (isAll && (value === 'all' || !value)) || value === name;
            return (
              <button
                key={name}
                type="button"
                aria-pressed={isPicked}
                onClick={() => onChange(isAll ? 'all' : name)}
                className={cn(
                  'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm font-bold transition-colors pointer-coarse:h-11',
                  isPicked ? 'border-primary bg-primary-soft text-ink shadow-2xs' : 'border-line-strong text-ink hover:bg-inset',
                )}
              >
                {details.icon && (
                  <span
                    className="flex size-4 shrink-0 items-center justify-center rounded"
                    style={{ backgroundColor: `${details.color || 'var(--muted)'}22`, color: details.color || 'var(--muted)' }}
                  >
                    <Icon name={details.icon} size={10} />
                  </span>
                )}
                <span>{isAll ? 'All categories' : name}</span>
              </button>
            );
          })}
        </div>
      )}
      <Combobox
        label="Category"
        error={error}
        placeholder={allowAll ? 'All categories' : 'Search categories'}
        options={options}
        value={value ?? (allowAll ? 'all' : null)}
        onChange={id => { if (id) onChange(id); else if (allowAll) onChange('all'); }}
      />
      {alwaysFile && (
        <Checkbox isSelected={alwaysFile.isSelected} onChange={alwaysFile.onChange}>
          Always file {alwaysFile.merchant} like this
        </Checkbox>
      )}
    </div>
  );
};

export default CategoryPicker;
