
import React, { useState } from 'react';
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
  // By default, show children if search is active (to reveal matches) or let user toggle
  const [isExpanded, setIsExpanded] = useState(false);
  const hasSubCategories = category.subCategories && category.subCategories.length > 0;
  const isDragging = draggedItem?.id === category.id;
  const isDropTarget = dropTarget?.id === category.id ? dropTarget : null;
  const isSubCategory = level > 0;

  const handleDragOverInternal = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem || draggedItem.id === category.id) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const third = rect.height / 3;
    let position: 'top' | 'bottom' | 'middle' = 'middle';
    
    if (isSubCategory) {
        // Sub-items reorder only
        position = e.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom';
    } else {
        // Top items can accept nesting (middle)
        if (e.clientY < rect.top + third) {
            position = 'top';
        } else if (e.clientY > rect.bottom - third) {
            position = 'bottom';
        }
    }
    
    handleDragOver(category.id, position);
  };
  
  // --- Visual Styles ---
  
  // Top Level vs Sub Item container styles
  const containerBase = "group relative flex items-center justify-between transition-all duration-200 cursor-pointer select-none";
  const containerStyles = isSubCategory 
    ? `${containerBase} p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-sm ml-6 border-l-2 border-black/10 dark:border-white/10`
    : `${containerBase} bg-light-card dark:bg-dark-card p-4 rounded-xl border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md hover:border-primary-500/30 z-10`;

  return (
    <div 
        draggable
        onDragStart={(e) => { e.stopPropagation(); handleDragStart(category.id, classification); }}
        onDragEnd={(e) => { e.stopPropagation(); handleDragEnd(); }}
        onDrop={(e) => { e.stopPropagation(); handleDrop(); }}
        onDragOver={handleDragOverInternal}
        onDragLeave={(e) => { e.stopPropagation(); handleDragLeave(); }}
        className={`transition-opacity duration-200 ${isDragging ? 'opacity-30' : 'opacity-100'} relative`}
    >
        {/* Drop Indicators */}
        {isDropTarget?.position === 'top' && <div className="absolute -top-1 left-0 right-0 h-1 bg-primary-500 rounded-full z-20 shadow-sm pointer-events-none" />}
        {isDropTarget?.position === 'bottom' && <div className="absolute -bottom-1 left-0 right-0 h-1 bg-primary-500 rounded-full z-20 shadow-sm pointer-events-none" />}
        {isDropTarget?.position === 'middle' && !isSubCategory && <div className="absolute inset-0 bg-primary-500/10 rounded-xl border-2 border-primary-500 border-dashed z-20 pointer-events-none" />}

        <div 
            className={containerStyles}
            onClick={() => hasSubCategories && setIsExpanded(!isExpanded)}
        >
            {/* Drag Handle (Visible on Hover) */}
            <span className="material-symbols-outlined absolute left-2 text-light-text-secondary dark:text-dark-text-secondary opacity-0 group-hover:opacity-50 cursor-grab text-base" title="Drag to reorder">drag_indicator</span>

            <div className="flex items-center gap-3 pl-6 min-w-0 flex-grow">
                <div className={`flex-shrink-0 rounded-lg flex items-center justify-center ${isSubCategory ? 'w-6 h-6' : 'w-10 h-10'}`} style={{ backgroundColor: `${category.color}20` }}>
                    <span 
                        className="material-symbols-outlined"
                        style={{
                            fontSize: isSubCategory ? '16px' : '20px',
                            color: category.color,
                        }}
                    >
                        {category.icon || 'category'}
                    </span>
                </div>
                
                <span className={`font-semibold text-light-text dark:text-dark-text truncate ${isSubCategory ? 'text-sm' : 'text-base'}`}>
                    {category.name}
                </span>
                
                {!isSubCategory && hasSubCategories && (
                    <span className="bg-black/5 dark:bg-white/10 text-[10px] px-2 py-0.5 rounded-full text-light-text-secondary dark:text-dark-text-secondary font-medium ml-2">
                        {category.subCategories.length}
                    </span>
                )}
            </div>

            <div className="flex items-center gap-1">
                {/* Action Buttons - Reveal on Hover */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 mr-2">
                    {!isSubCategory && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onAddSubCategory(category.id); }} 
                            className="p-1.5 text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/10 dark:hover:bg-white/10 rounded-md hover:text-primary-500 transition-colors" 
                            title="Add Sub-category"
                        >
                            <span className="material-symbols-outlined text-lg">add</span>
                        </button>
                    )}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onEdit(category); }} 
                        className="p-1.5 text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/10 dark:hover:bg-white/10 rounded-md hover:text-blue-500 transition-colors" 
                        title="Edit"
                    >
                        <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(category.id); }} 
                        className="p-1.5 text-light-text-secondary dark:text-dark-text-secondary hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md hover:text-red-500 transition-colors" 
                        title="Delete"
                    >
                        <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                </div>

                {/* Expand/Collapse Chevron (Only for parents) */}
                {hasSubCategories && !isSubCategory && (
                    <span className={`material-symbols-outlined text-light-text-secondary dark:text-dark-text-secondary transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                        expand_more
                    </span>
                )}
            </div>
        </div>

        {/* Nested Sub-Categories - Accordion Body */}
        {hasSubCategories && isExpanded && (
            <div className="pl-6 space-y-1 pt-1 animate-fade-in-up origin-top">
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
  );
};

export default CategoryItem;
