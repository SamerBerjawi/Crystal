import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Category } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, CATEGORY_ICON_LIST, CATEGORY_TAG_PRESET_COLORS } from '../constants';
import IconPicker from './IconPicker';
import Icon from './ui/Icon';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (category: Category, parentId?: string) => void;
  category: Category | null;
  parentId?: string;
  mode: 'add' | 'edit';
  classification: 'income' | 'expense';
}

const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  category,
  parentId,
  mode,
  classification: initialClassification
}) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [icon, setIcon] = useState('category');
  const [classification, setClassification] = useState(initialClassification);
  const [isIconPickerOpen, setIconPickerOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (category) {
      setName(category.name || '');
      setColor(category.color || '#6366f1');
      setIcon(category.icon || 'category');
      setClassification(category.classification);
    } else {
      setName('');
      setColor(CATEGORY_TAG_PRESET_COLORS[Math.floor(Math.random() * CATEGORY_TAG_PRESET_COLORS.length)]);
      setIcon('category');
      setClassification(initialClassification);
    }

    if (isOpen) {
      const timer = setTimeout(() => setIsVisible(true), 20);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [category, isOpen, initialClassification]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 250);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newCategoryData: Category = {
      id: category?.id || '',
      name: name.trim(),
      color,
      icon,
      classification,
      subCategories: category?.subCategories || [],
      parentId,
    };
    onSave(newCategoryData, parentId);
    handleClose();
  };

  const title = mode === 'edit'
    ? 'Edit Category'
    : parentId
      ? 'New Sub-category'
      : 'New Category';

  if (!isOpen && !isVisible) return null;

  const content = (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Sidebar Drawer */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div 
          className={`w-screen max-w-lg bg-light-card dark:bg-dark-card shadow-2xl border-l border-black/10 dark:border-white/10 flex flex-col transform transition-transform duration-300 ease-out ${
            isVisible ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Header */}
          <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-primary-500/5 to-transparent">
            <div className="flex items-center gap-3 min-w-0">
              <div 
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md transition-transform hover:scale-105"
                style={{ backgroundColor: color }}
              >
                <Icon name={icon} className="text-2xl" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight truncate">
                    {title}
                  </h2>
                  <span className={`px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider ${
                    classification === 'income'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                  }`}>
                    {classification}
                  </span>
                </div>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5 font-medium">
                  {parentId ? 'Organize under parent category' : 'Configure classification and icon'}
                </p>
              </div>
            </div>
            <button 
              onClick={handleClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
              aria-label="Close drawer"
            >
              <Icon name="close" className="text-lg" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

              {/* Classification Switcher (Only for top-level categories in add mode) */}
              {mode === 'add' && !parentId && (
                <div className="bg-black/5 dark:bg-white/5 p-1 rounded-2xl flex border border-black/5 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => setClassification('expense')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                      classification === 'expense'
                        ? 'bg-white dark:bg-dark-card text-rose-500 shadow-sm'
                        : 'text-light-text-secondary dark:text-dark-text-secondary opacity-60 hover:opacity-100'
                    }`}
                  >
                    <Icon name="trending_down" className="text-base" />
                    Expense Category
                  </button>
                  <button
                    type="button"
                    onClick={() => setClassification('income')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                      classification === 'income'
                        ? 'bg-white dark:bg-dark-card text-emerald-500 shadow-sm'
                        : 'text-light-text-secondary dark:text-dark-text-secondary opacity-60 hover:opacity-100'
                    }`}
                  >
                    <Icon name="trending_up" className="text-base" />
                    Income Category
                  </button>
                </div>
              )}

              {/* Name Input */}
              <div className="space-y-2">
                <label htmlFor="category-name" className="block text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                  Category Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="category-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`${INPUT_BASE_STYLE} h-14 !text-xl font-bold`}
                  placeholder="e.g. Groceries & Supermarkets"
                  required
                  autoFocus
                />
              </div>

              {/* Appearance & Color Palette */}
              <div className="p-5 rounded-3xl bg-light-fill dark:bg-dark-fill/50 border border-black/5 dark:border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                    Icon & Accent Color
                  </span>
                  <button
                    type="button"
                    onClick={() => setIconPickerOpen(true)}
                    className="text-xs font-bold text-primary-500 hover:text-primary-600 flex items-center gap-1"
                  >
                    <span>Change Icon</span>
                    <Icon name="chevron_right" className="text-sm" />
                  </button>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setIconPickerOpen(true)}
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105 active:scale-95 border-2 border-white/20 shrink-0"
                    style={{ backgroundColor: color }}
                    title="Choose Icon"
                  >
                    <Icon name={icon} className="text-3xl drop-shadow-sm" />
                  </button>

                  {/* Swatches */}
                  <div className="flex-1">
                    <div className="grid grid-cols-6 sm:grid-cols-7 gap-2">
                      {CATEGORY_TAG_PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setColor(c)}
                          className={`w-7 h-7 rounded-full transition-all hover:scale-110 focus:outline-none ${
                            color === c ? 'ring-2 ring-offset-2 ring-offset-light-card dark:ring-offset-dark-card ring-primary-500 scale-110 shadow-sm' : ''
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      <div className="relative w-7 h-7 rounded-full overflow-hidden cursor-pointer hover:scale-110 transition-transform bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 flex items-center justify-center shrink-0">
                        <Icon name="add" className="text-white text-xs" />
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

              {/* Live Preview Card */}
              <div className="p-4 rounded-2xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: color }}>
                    <Icon name={icon} className="text-xl" />
                  </div>
                  <div>
                    <p className="font-bold text-light-text dark:text-dark-text text-sm">{name || 'Category Name'}</p>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-medium">Live Preview</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/5 text-xs font-mono font-bold text-light-text dark:text-dark-text">
                  €0.00
                </span>
              </div>

            </div>

            {/* Sticky Bottom Actions */}
            <div className="p-6 border-t border-black/5 dark:border-white/5 bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-md flex items-center justify-between gap-3">
              <button 
                type="button" 
                onClick={handleClose} 
                className={`${BTN_SECONDARY_STYLE} h-12 px-6 text-xs font-bold uppercase tracking-wider`}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className={`${BTN_PRIMARY_STYLE} h-12 px-8 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-primary-500/20 active:scale-95`}
              >
                <span>{mode === 'edit' ? 'Save Changes' : 'Create Category'}</span>
                <Icon name="check" className="text-base" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {isIconPickerOpen && (
        <IconPicker 
          onClose={() => setIconPickerOpen(false)} 
          onSelect={setIcon} 
          iconList={CATEGORY_ICON_LIST} 
        />
      )}
    </div>
  );

  return createPortal(content, document.body);
};

export default CategoryModal;
