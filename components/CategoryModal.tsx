
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

const PRESET_COLORS = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#84CC16', // Lime
  '#10B981', // Emerald
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#F43F5E', // Rose
  '#64748B', // Slate
];

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
      setColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
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
  
  const title = mode === 'edit'
    ? `Edit Category`
    : parentId
      ? `Add Sub-category`
      : `New Category`;

  if (!isOpen) return null;

  return (
    <>
    {isIconPickerOpen && <IconPicker onClose={() => setIconPickerOpen(false)} onSelect={setIcon} iconList={CATEGORY_ICON_LIST} />}
    <Modal onClose={onClose} title={title} size="lg">
      <form onSubmit={handleSubmit} className="space-y-8">

        {/* Classification Toggle (Only for new top-level categories) */}
        {mode === 'add' && !parentId && (
            <div className="bg-light-fill dark:bg-dark-fill p-1 rounded-xl flex">
                <button
                    type="button"
                    onClick={() => setClassification('expense')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${classification === 'expense' ? 'bg-white dark:bg-dark-card text-red-500 shadow-sm' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}
                >
                    <span className="material-symbols-outlined text-lg">trending_down</span>
                    Expense
                </button>
                <button
                    type="button"
                    onClick={() => setClassification('income')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${classification === 'income' ? 'bg-white dark:bg-dark-card text-green-500 shadow-sm' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}
                >
                    <span className="material-symbols-outlined text-lg">trending_up</span>
                    Income
                </button>
            </div>
        )}
        
        {/* Name Input */}
        <div>
            <label htmlFor="category-name" className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-2">
                Name
            </label>
            <input
                id="category-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`${INPUT_BASE_STYLE} !text-lg !py-3 !px-4 font-semibold`}
                placeholder="e.g. Groceries"
                required
                autoFocus
            />
        </div>

        {/* Appearance Section */}
        <div>
            <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-3">
                Appearance
            </label>
            <div className="flex flex-col sm:flex-row gap-6">
                
                {/* Icon Preview / Selector */}
                <div className="flex flex-col items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setIconPickerOpen(true)}
                        className="w-20 h-20 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform transform hover:scale-105 active:scale-95 ring-4 ring-transparent hover:ring-black/5 dark:hover:ring-white/10"
                        style={{ backgroundColor: color }}
                    >
                        <span className="material-symbols-outlined text-4xl drop-shadow-md">{icon}</span>
                    </button>
                    <span className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary">Tap to change</span>
                </div>

                {/* Color Swatches */}
                <div className="flex-1">
                    <div className="grid grid-cols-6 gap-3">
                        {PRESET_COLORS.map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setColor(c)}
                                className={`w-8 h-8 rounded-full transition-transform hover:scale-110 focus:outline-none ${color === c ? 'ring-2 ring-offset-2 ring-offset-light-card dark:ring-offset-dark-card ring-primary-500 scale-110' : ''}`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                        {/* Custom Color Input Wrapper */}
                        <div className="relative w-8 h-8 rounded-full overflow-hidden cursor-pointer hover:scale-110 transition-transform bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 flex items-center justify-center">
                             <span className="material-symbols-outlined text-white text-sm drop-shadow-md">add</span>
                             <input
                                type="color"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Preview Strip */}
        <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 flex items-center justify-between border border-black/5 dark:border-white/5">
             <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: color }}>
                     <span className="material-symbols-outlined text-xl">{icon}</span>
                 </div>
                 <div>
                     <p className="font-bold text-light-text dark:text-dark-text text-sm">{name || 'Category Name'}</p>
                     <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Preview</p>
                 </div>
             </div>
             <div className="px-3 py-1 rounded-full bg-white dark:bg-black/20 text-xs font-mono font-bold text-light-text dark:text-dark-text border border-black/5 dark:border-white/5">
                 €0.00
             </div>
        </div>
        
        <div className="flex justify-end gap-3 pt-4 border-t border-black/5 dark:border-white/5">
          <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
          <button type="submit" className={BTN_PRIMARY_STYLE}>Save Category</button>
        </div>
      </form>
    </Modal>
    </>
  );
};

export default CategoryModal;
