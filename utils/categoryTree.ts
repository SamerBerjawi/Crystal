import React from 'react';
import { Category } from '../types';
import { flattenCategories } from '../utils';
import Icon from '../components/ui/Icon';

/** Every category once, for a picker. */
export const categoryPickerOptions = (expenseCategories: Category[], incomeCategories: Category[]) => {
  const seen = new Set<string>();
  const withKind = (categories: Category[], description: string) => flattenCategories(categories)
    .filter(category => !seen.has(category.name) && !!seen.add(category.name))
    .map(category => ({
      id: category.name,
      label: category.name,
      description,
      visual: React.createElement(
        'span',
        {
          className: 'flex size-5 shrink-0 items-center justify-center rounded-md',
          style: { backgroundColor: `${category.color || 'var(--muted)'}22`, color: category.color || 'var(--muted)' },
        },
        React.createElement(Icon, { name: category.icon || 'category', size: 12 }),
      ),
    }));
  return [...withKind(expenseCategories, 'Expense'), ...withKind(incomeCategories, 'Income')];
};

export type DropPosition = 'top' | 'bottom' | 'middle';

export const updateCategory = (categories: Category[], targetId: string, updates: Pick<Category, 'name' | 'color' | 'icon'>): Category[] =>
  categories.map(category => {
    if (category.id === targetId) return { ...category, name: updates.name, color: updates.color, icon: updates.icon };
    return category.subCategories.length > 0 ? { ...category, subCategories: updateCategory(category.subCategories, targetId, updates) } : category;
  });

export const addSubCategory = (categories: Category[], parentId: string, child: Category): Category[] =>
  categories.map(category => {
    if (category.id === parentId) return { ...category, subCategories: [...category.subCategories, child] };
    return category.subCategories.length > 0 ? { ...category, subCategories: addSubCategory(category.subCategories, parentId, child) } : category;
  });

export const removeCategory = (categories: Category[], id: string): Category[] =>
  categories
    .filter(category => category.id !== id)
    .map(category => (category.subCategories?.length ? { ...category, subCategories: removeCategory(category.subCategories, id) } : category));

/** A parent that matches keeps all its children. Otherwise it stays for the children that match. */
export const filterCategories = (categories: Category[], term: string): Category[] => {
  const query = term.toLowerCase().trim();
  if (!query) return categories;
  return categories.flatMap(category => {
    if (category.name.toLowerCase().includes(query)) return [category];
    const matches = filterCategories(category.subCategories, query);
    return matches.length > 0 ? [{ ...category, subCategories: matches }] : [];
  });
};

const findCategory = (categories: Category[], id: string): Category | null => {
  for (const category of categories) {
    if (category.id === id) return category;
    const found = category.subCategories?.length ? findCategory(category.subCategories, id) : null;
    if (found) return found;
  }
  return null;
};

/** Drops one category beside another, or into it. Nothing moves into its own children. */
export const moveCategory = (categories: Category[], movedId: string, targetId: string, position: DropPosition): Category[] => {
  const moved = findCategory(categories, movedId);
  if (!moved || movedId === targetId || findCategory(moved.subCategories, targetId)) return categories;

  const withoutMoved = removeCategory(categories, movedId);

  const insert = (items: Category[], parentId?: string): Category[] => {
    if (position === 'middle') {
      return items.map(item => {
        if (item.id !== targetId) return { ...item, subCategories: insert(item.subCategories, item.id) };
        const adoptColor = (category: Category): Category => ({ ...category, color: item.color, subCategories: category.subCategories.map(adoptColor) });
        return { ...item, subCategories: [...item.subCategories, adoptColor({ ...moved, parentId: targetId })] };
      });
    }
    const index = items.findIndex(item => item.id === targetId);
    if (index === -1) return items.map(item => ({ ...item, subCategories: insert(item.subCategories, item.id) }));
    const next = [...items];
    next.splice(position === 'top' ? index : index + 1, 0, { ...moved, parentId });
    return next;
  };
  return insert(withoutMoved);
};

/** One step up or down among its siblings, for touch and keyboard. */
export const shiftCategory = (categories: Category[], id: string, direction: -1 | 1): Category[] => {
  const index = categories.findIndex(category => category.id === id);
  if (index === -1) return categories.map(category => ({ ...category, subCategories: shiftCategory(category.subCategories, id, direction) }));
  const target = index + direction;
  if (target < 0 || target >= categories.length) return categories;
  const next = [...categories];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};
