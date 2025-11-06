import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Category } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, CATEGORY_ICON_LIST } from '../constants';
import IconPicker from './IconPicker';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (category: Category, parentId?: string) => void;
  category: Category | null;
  parentId?: string;
  mode: 'add' | 'edit';
  classification: 'income' | 'expense';
}

const CategoryModal: React.FC<CategoryModalProps> = ({ isOpen, onClose, onSave, category, parentId, mode, classification: initialClassification }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [icon, setIcon] = useState('category');
  const [classification, setClassification] = useState(initialClassification);
  const [isIconPickerOpen, setIconPickerOpen] = useState(false);

  useEffect(() => {
    if (category) {
      setName(category.name || '');
      setColor(category.color || '#6366f1');
      setIcon(category.icon || 'category');
      setClassification(category.classification);
    } else {
      setName('');
      setColor('#6366f1');
      setIcon('category');
      setClassification(initialClassification);
    }
  }, [category, isOpen, initialClassification]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    
    const newCategoryData: Category = {
      id: category?.id || '',
      name,
      color,
      icon,
      classification,
      subCategories: category?.subCategories || [],
      parentId,
    };
    onSave(newCategoryData, parentId);
  };
  
  const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";
  const radioLabelStyle = "flex items-center gap-2 text-sm font-medium text-light-text dark:text-dark-text cursor-pointer p-2 rounded-lg transition-colors";

  if (!isOpen) return null;

  const title = mode === 'edit'
    ? `Edit Category`
    : parentId
      ? `Add Sub-category`
      : `Add New Category`;


  return (
    <>
    {isIconPickerOpen && <IconPicker onClose={() => setIconPickerOpen(false)} onSelect={setIcon} iconList={CATEGORY_ICON_LIST} />}
    <Modal onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-6">

        {mode === 'add' && !parentId && (
            <div>
                 <label className={labelStyle}>Category Type</label>
                 <div className="flex items-center gap-4 bg-light-bg dark:bg-dark-bg p-1 rounded-lg shadow-neu-inset-light dark:shadow-neu-inset-dark">
                    <label className={`${radioLabelStyle} flex-1 justify-center ${classification === 'expense' ? 'bg-light-card dark:bg-dark-card shadow-neu-raised-light dark:shadow-neu-raised-dark' : ''}`}>
                         <input type="radio" value="expense" checked={classification === 'expense'} onChange={(e) => setClassification(e.target.value as 'income' | 'expense')} className="sr-only" />
                         Expense
                    </label>
                     <label className={`${radioLabelStyle} flex-1 justify-center ${classification === 'income' ? 'bg-light-card dark:bg-dark-card shadow-neu-raised-light dark:shadow-neu-raised-dark' : ''}`}>
                         <input type="radio" value="income" checked={classification === 'income'} onChange={(e) => setClassification(e.target.value as 'income' | 'expense')} className="sr-only" />
                         Income
                    </label>
                 </div>
            </div>
        )}
        
        <div className="flex items-end gap-4">
            <div className="flex-grow">
                <label htmlFor="category-name" className={labelStyle}>Category Name</label>
                <input
                    id="category-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={INPUT_BASE_STYLE}
                    required
                    autoFocus
                />
            </div>
            <button
              type="button"
              onClick={() => setIconPickerOpen(true)}
              className="flex-shrink-0 flex items-center justify-center w-10 h-10 bg-light-bg dark:bg-dark-bg rounded-lg shadow-neu-raised-light dark:shadow-neu-raised-dark hover:shadow-neu-inset-light dark:hover:shadow-neu-inset-dark transition-shadow text-primary-500"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                {icon}
              </span>
            </button>
             <div
                className="relative flex-shrink-0 w-10 h-10 rounded-lg border border-black/10 dark:border-white/10 overflow-hidden cursor-pointer"
                style={{ backgroundColor: color }}
                title="Select color"
              >
                <label htmlFor="category-color" className="sr-only">Select color</label>
                <input
                  id="category-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
        </div>
        
        <div className="flex justify-end gap-4 pt-4">
          <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
          <button type="submit" className={BTN_PRIMARY_STYLE}>Save</button>
        </div>
      </form>
    </Modal>
    </>
  );
};

export default CategoryModal;