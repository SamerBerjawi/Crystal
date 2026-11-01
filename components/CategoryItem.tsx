import React, { useState } from 'react';
import { Category } from '../types';
import { cn } from '../lib/utils';
import { DropPosition } from '../utils/categoryTree';
import { IconButton } from './ui/Actions';
import { CountPill } from './ui/Display';
import Icon from './ui/Icon';
import { Menu } from './ui/Menu';

interface CategoryItemProps {
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (categoryId: string) => void;
  onAddSubCategory: (parentId: string) => void;
  onShift: (categoryId: string, direction: -1 | 1) => void;
  level: number;
  /** A search opens every parent, so matches aren't hidden. */
  isForcedOpen: boolean;
  draggedId: string | null;
  dropTarget: { id: string; position: DropPosition } | null;
  onDragStart: (id: string) => void;
  onDragOver: (id: string, position: DropPosition) => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

const CategoryItem: React.FC<CategoryItemProps> = props => {
  const { category, onEdit, onDelete, onAddSubCategory, onShift, level, isForcedOpen, draggedId, dropTarget, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd } = props;
  const [isExpanded, setExpanded] = useState(false);
  const hasChildren = category.subCategories?.length > 0;
  const isSubCategory = level > 0;
  const isOpen = hasChildren && (isExpanded || isForcedOpen);
  const dropPosition = dropTarget?.id === category.id ? dropTarget.position : null;

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!draggedId || draggedId === category.id) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (isSubCategory) {
      onDragOver(category.id, event.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom');
      return;
    }
    const third = rect.height / 3;
    onDragOver(category.id, event.clientY < rect.top + third ? 'top' : event.clientY > rect.bottom - third ? 'bottom' : 'middle');
  };

  return (
    <li
      draggable
      onDragStart={event => { event.stopPropagation(); onDragStart(category.id); }}
      onDragEnd={event => { event.stopPropagation(); onDragEnd(); }}
      onDrop={event => { event.stopPropagation(); onDrop(); }}
      onDragOver={handleDragOver}
      onDragLeave={event => { event.stopPropagation(); onDragLeave(); }}
      className={cn('relative', draggedId === category.id && 'opacity-50')}
    >
      {dropPosition === 'top' && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 rounded-full bg-primary" />}
      {dropPosition === 'bottom' && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />}
      <div className={cn('flex min-h-14 items-center gap-2 rounded-[var(--radius-md)] py-1.5 pr-1', dropPosition === 'middle' && 'bg-inset')}>
        <Icon name="drag_indicator" size={16} className="hidden shrink-0 cursor-grab text-muted md:block" />
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)]" style={{ backgroundColor: `${category.color}26`, color: category.color }}>
          <Icon name={category.icon || 'category'} size={20} />
        </span>
        <span className="type-body min-w-0 flex-1 truncate text-ink">{category.name}</span>
        {hasChildren && <CountPill count={category.subCategories.length} />}
        {hasChildren && (
          <IconButton
            icon={isOpen ? 'expand_less' : 'expand_more'}
            label={`${isOpen ? 'Hide' : 'Show'} sub-categories of ${category.name}`}
            onPress={() => setExpanded(open => !open)}
          />
        )}
        <Menu
          title={category.name}
          trigger={<IconButton icon="more_horiz" label={`More for ${category.name}`} />}
          items={[
            ...(isSubCategory ? [] : [{ id: 'add', label: 'Add sub-category', icon: 'add', onAction: () => onAddSubCategory(category.id) }]),
            { id: 'edit', label: 'Edit', icon: 'edit', onAction: () => onEdit(category) },
            { id: 'up', label: 'Move up', icon: 'arrow_upward', startsGroup: true, onAction: () => onShift(category.id, -1) },
            { id: 'down', label: 'Move down', icon: 'arrow_downward', onAction: () => onShift(category.id, 1) },
            { id: 'delete', label: 'Delete', icon: 'delete', isDestructive: true, startsGroup: true, onAction: () => onDelete(category.id) },
          ]}
        />
      </div>
      {isOpen && (
        <ul className="ml-5 border-l border-line pl-3">
          {category.subCategories.map(child => <CategoryItem key={child.id} {...props} category={child} level={level + 1} />)}
        </ul>
      )}
    </li>
  );
};

export default CategoryItem;
