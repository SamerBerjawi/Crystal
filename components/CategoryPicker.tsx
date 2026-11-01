import React, { useMemo } from 'react';
import type { Category } from '../types';
import { Checkbox } from './ui/Fields';
import { Combobox } from './ui/Pickers';
import Icon from './ui/Icon';
import { getCategoryDetails } from '../utils/categories';
import { cn } from '../lib/utils';

interface CategoryPickerProps {
  categories: Category[];
  suggestions: string[];
  value: string | null;
  onChange: (name: string) => void;
  /** "Always file like this" (D-041). Leave out where there's no merchant to remember it for. */
  alwaysFile?: { merchant: string; isSelected: boolean; onChange: (selected: boolean) => void };
}

const flatten = (categories: Category[]) => categories.flatMap(category => [
  {
    id: category.name,
    label: category.name,
    visual: (
      <span
        className="flex size-5 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: `${category.color || 'var(--muted)'}22`, color: category.color || 'var(--muted)' }}
      >
        <Icon name={category.icon || 'category'} size={12} />
      </span>
    ),
  },
  ...category.subCategories.map(sub => ({
    id: sub.name,
    label: sub.name,
    description: category.name,
    visual: (
      <span
        className="flex size-5 shrink-0 items-center justify-center rounded-md"
        style={{
          backgroundColor: `${sub.color || category.color || 'var(--muted)'}22`,
          color: sub.color || category.color || 'var(--muted)',
        }}
      >
        <Icon name={sub.icon || category.icon || 'category'} size={12} />
      </span>
    ),
  })),
]);

/** Three suggestions, a searchable list, and a way to make it stick. */
const CategoryPicker: React.FC<CategoryPickerProps> = ({ categories, suggestions, value, onChange, alwaysFile }) => {
  const options = useMemo(() => {
    const seen = new Set<string>();
    return flatten(categories).filter(option => !seen.has(option.id) && !!seen.add(option.id));
  }, [categories]);

  return (
    <div className="space-y-3">
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested categories">
          {suggestions.map(name => {
            const details = getCategoryDetails(name, categories);
            return (
              <button
                key={name}
                type="button"
                aria-pressed={value === name}
                onClick={() => onChange(name)}
                className={cn(
                  'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-sm font-bold pointer-coarse:h-11',
                  value === name ? 'border-primary bg-primary-soft text-ink' : 'border-line-strong text-ink hover:bg-inset',
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
                <span>{name}</span>
              </button>
            );
          })}
        </div>
      )}
      <Combobox label="Category" placeholder="Search categories" options={options} value={value} onChange={id => { if (id) onChange(id); }} />
      {alwaysFile && (
        <Checkbox isSelected={alwaysFile.isSelected} onChange={alwaysFile.onChange}>
          Always file {alwaysFile.merchant} like this
        </Checkbox>
      )}
    </div>
  );
};

export default CategoryPicker;
