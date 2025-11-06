import React from 'react';
import { Category } from '../types';

interface CategoryItemProps {
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (categoryId: string) => void;
  onAddSubCategory: (parentId: string) => void;
  level: number;
  classification: 'income' | 'expense';
  draggedItem: { id: string; classification: 'income' | 'expense' } | null;
  dropTarget: { id: string; position: 'top' | 'bottom' | 'middle' } | null;
  handleDragStart: (id: string, classification: 'income' | 'expense') => void;
  handleDragOver: (id: string, position: 'top' | 'bottom' | 'middle') => void;
  handleDragLeave: () => void;
  handleDrop: () => void;
  handleDragEnd: () => void;
}

const CategoryItem: React.FC<CategoryItemProps> = ({ 
    category, onEdit, onDelete, onAddSubCategory, level = 0, classification,
    draggedItem, dropTarget, handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd 
}) => {
  const isSubCategory = level > 0;
  const isDragging = draggedItem?.id === category.id;
  const isDropTarget = dropTarget?.id === category.id ? dropTarget : null;

  const handleDragOverInternal = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem || draggedItem.id === category.id) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const third = rect.height / 3;
    let position: 'top' | 'bottom' | 'middle' = 'middle';
    
    if (e.clientY < rect.top + third) {
        position = 'top';
    } else if (e.clientY > rect.bottom - third) {
        position = 'bottom';
    }

    if (level > 0 && position === 'middle') {
        const midpoint = rect.top + rect.height / 2;
        position = e.clientY < midpoint ? 'top' : 'bottom';
    }
    
    handleDragOver(category.id, position);
  };
  
  return (
    <div 
        draggable
        onDragStart={(e) => { e.stopPropagation(); handleDragStart(category.id, classification); }}
        onDragEnd={(e) => { e.stopPropagation(); handleDragEnd(); }}
        onDrop={(e) => { e.stopPropagation(); handleDrop(); }}
        onDragOver={handleDragOverInternal}
        onDragLeave={(e) => { e.stopPropagation(); handleDragLeave(); }}
        className={`relative rounded-lg ${isDragging ? 'opacity-30' : ''}`}
    >
        {isDropTarget?.position === 'top' && <div className="absolute -top-1 left-0 right-0 h-1.5 bg-primary-500 rounded-full z-10" />}
        {isDropTarget?.position === 'bottom' && <div className="absolute -bottom-1 left-0 right-0 h-1.5 bg-primary-500 rounded-full z-10" />}
        {isDropTarget?.position === 'middle' && <div className="absolute inset-0 bg-primary-500/20 rounded-lg border-2 border-primary-500 border-dashed z-10" />}

        <div className={`rounded-lg ${!isSubCategory ? 'py-1' : ''}`}>
        <div className={`flex items-center group ${isSubCategory ? 'ml-6 border-l-2 border-black/10 dark:border-white/10 pl-4 py-2' : ''}`}>
            <div className="flex items-center flex-grow gap-3">
                <span className="material-symbols-outlined cursor-grab text-light-text-secondary dark:text-dark-text-secondary opacity-0 group-hover:opacity-100 transition-opacity">drag_indicator</span>
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-light-bg dark:bg-dark-bg shadow-neu-inset-light dark:shadow-neu-inset-dark flex items-center justify-center">
                    <span 
                        className="material-symbols-outlined"
                        style={{
                            fontSize: '22px',
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
                    classification={classification}
                    draggedItem={draggedItem}
                    dropTarget={dropTarget}
                    handleDragStart={handleDragStart}
                    handleDragOver={handleDragOver}
                    handleDragLeave={handleDragLeave}
                    handleDrop={handleDrop}
                    handleDragEnd={handleDragEnd}
                />
            ))}
            </div>
        )}
        </div>
    </div>
  );
};

export default CategoryItem;