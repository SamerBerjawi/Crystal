import type { Category } from '../types';

export const getCategoryDetails = (
  name: string,
  categories: Category[],
  parentName?: string
): { icon?: string; color?: string; parent?: string } => {
  for (const category of categories) {
    if (category.name === name) {
      return { icon: category.icon, color: category.color, parent: parentName };
    }
    if (category.subCategories && category.subCategories.length > 0) {
      const found = getCategoryDetails(name, category.subCategories, category.name);
      if (found.icon || found.color || found.parent) return found;
    }
  }
  return {};
};
