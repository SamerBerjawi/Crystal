import type { Category } from '../types';

export const getCategoryDetails = (name: string, categories: Category[]): { icon?: string; color?: string } => {
  for (const category of categories) {
    if (category.name === name) return { icon: category.icon, color: category.color };
    if (category.subCategories.length > 0) {
      const found = getCategoryDetails(name, category.subCategories);
      if (found.icon) return found;
    }
  }
  return {};
};
