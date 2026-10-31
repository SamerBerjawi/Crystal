import React, { useMemo } from 'react';
import type { Category } from '../types';
import { Checkbox } from './ui/Fields';
import { Combobox } from './ui/Pickers';
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
  { id: category.name, label: category.name },
  ...category.subCategories.map(sub => ({ id: sub.name, label: sub.name, description: category.name })),
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
          {suggestions.map(name => (
            <button
              key={name}
              type="button"
              aria-pressed={value === name}
              onClick={() => onChange(name)}
              className={cn('h-9 cursor-pointer rounded-full border px-3.5 text-sm font-bold pointer-coarse:h-11', value === name ? 'border-primary bg-primary-soft text-ink' : 'border-line-strong text-ink hover:bg-inset')}
            >
              {name}
            </button>
          ))}
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
