import React from 'react';
import { Category } from '../types';

interface CategoryItemProps {
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (categoryId: string) => void;
  onAddSubCategory: (parentId: string) => void;
  level?: number;
}

const CategoryItem: React.FC<CategoryItemProps> = ({ category, onEdit, onDelete, onAddSubCategory, level = 0 }) => {
  const isSubCategory = level > 0;

  return (
    <div className={`rounded-lg ${!isSubCategory ? 'py-1' : ''}`}>
      <div className={`flex items-center group ${isSubCategory ? 'ml-6 border-l-2 border-black/10 dark:border-white/10 pl-4 py-2' : ''}`}>
        <div className="flex items-center flex-grow gap-3">
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-light-bg dark:bg-dark-bg shadow-neu-inset-light dark:shadow-neu-inset-dark flex items-center justify-center">
                <span 
                    className="material-symbols-outlined"
                    style={{
                        fontSize: '24px',
                        color: category.color,
                    }}
                >
                    {category.icon || 'category'}
                </span>
            </div>
          <span className="font-medium text-base text-light-text dark:text-dark-text">{category.name}</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isSubCategory && (
             <button onClick={() => onAddSubCategory(category.id)} className="p-2 text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/10 dark:hover:bg-white/10 rounded-full" title="Add Sub-category">
                <span className="material-symbols-outlined text-base">add</span>
            </button>
          )}
          <button onClick={() => onEdit(category)} className="p-2 text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/10 dark:hover:bg-white/10 rounded-full" title="Edit">
            <span className="material-symbols-outlined text-base">edit</span>
          </button>
          <button onClick={() => onDelete(category.id)} className="p-2 text-red-500/80 hover:bg-red-500/10 rounded-full" title="Delete">
            <span className="material-symbols-outlined text-base">delete</span>
          </button>
        </div>
      </div>
      {category.subCategories && category.subCategories.length > 0 && (
        <div className="mt-1">
          {category.subCategories.map(subCat => (
            <CategoryItem
              key={subCat.id}
              category={subCat}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddSubCategory={onAddSubCategory}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryItem;