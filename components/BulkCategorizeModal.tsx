import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Category } from '../types';
import { SELECT_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE } from '../constants';
import Icon from './ui/Icon';

interface BulkCategorizeModalProps {
    isOpen?: boolean;
    onClose: () => void;
    onSave: (newCategory: string) => void;
    incomeCategories: Category[];
    expenseCategories: Category[];
}

const RecursiveCategoryOptions: React.FC<{ categories: Category[], level: number }> = ({ categories, level }) => {
    const indent = '\u00A0\u00A0'.repeat(level * 2);
    return (
        <>
            {categories.map(cat => (
                <React.Fragment key={cat.id}>
                    <option value={cat.name}>{indent}{cat.name}</option>
                    {cat.subCategories && cat.subCategories.length > 0 && (
                        <RecursiveCategoryOptions categories={cat.subCategories} level={level + 1} />
                    )}
                </React.Fragment>
            ))}
        </>
    );
};

const CategoryOptions: React.FC<{ categories: Category[] }> = ({ categories }) => (
  <>
    {categories.map(parentCat => (
      <optgroup key={parentCat.id} label={parentCat.name}>
        <option value={parentCat.name}>{parentCat.name}</option>
        {parentCat.subCategories.map(subCat => (
           <RecursiveCategoryOptions key={subCat.id} categories={[subCat]} level={1} />
        ))}
      </optgroup>
    ))}
  </>
);

const BulkCategorizeModal: React.FC<BulkCategorizeModalProps> = ({ isOpen = true, onClose, onSave, incomeCategories, expenseCategories }) => {
    const [selectedCategory, setSelectedCategory] = useState('');
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 20);
        return () => clearTimeout(timer);
    }, []);

    // Handle ESC key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 250);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedCategory) {
            onSave(selectedCategory);
            handleClose();
        }
    };

    const content = (
        <div className="fixed inset-0 z-50 overflow-hidden font-sans">
            {/* Backdrop */}
            <div 
                className={`fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
                    isVisible ? 'opacity-100' : 'opacity-0'
                }`}
                onClick={handleClose}
            />

            {/* Sidebar Drawer */}
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
                <div 
                    className={`w-screen max-w-md bg-white dark:bg-dark-card backdrop-blur-2xl dark:shadow-[inset_1px_0_0_0_rgba(255,255,255,0.1)] text-light-text dark:text-dark-text shadow-2xl border-l border-black/10 dark:border-white/10 flex flex-col transform transition-transform duration-300 ease-out ${
                        isVisible ? 'translate-x-0' : 'translate-x-full'
                    }`}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-primary-500/5 to-transparent">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0 border border-primary-500/20 shadow-xs">
                                <Icon name="category" className="text-2xl" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight truncate">
                                    Assign Category
                                </h2>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5 font-medium">
                                    Batch categorize selected transactions
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

                            <div className="p-5 rounded-3xl bg-light-fill dark:bg-dark-fill/50 border border-black/5 dark:border-white/5 space-y-3">
                                <label htmlFor="bulk-category" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                    Target Category <span className="text-rose-500">*</span>
                                </label>
                                <div className={SELECT_WRAPPER_STYLE}>
                                    <select
                                        id="bulk-category"
                                        value={selectedCategory}
                                        onChange={(e) => setSelectedCategory(e.target.value)}
                                        className={`${SELECT_STYLE} h-14 font-bold !text-base`}
                                        required
                                        autoFocus
                                    >
                                        <option value="" disabled>Select a target category</option>
                                        <optgroup label="--- EXPENSES ---"></optgroup>
                                        <CategoryOptions categories={expenseCategories} />
                                        <optgroup label="--- INCOME ---"></optgroup>
                                        <CategoryOptions categories={incomeCategories} />
                                    </select>
                                    <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                                </div>
                            </div>

                        </div>

                        {/* Sticky Bottom Actions */}
                        <div className="p-6 border-t border-black/5 dark:border-white/5 bg-white/90 dark:bg-dark-card/80 backdrop-blur-md flex items-center justify-between gap-3">
                            <button 
                                type="button" 
                                onClick={handleClose} 
                                className={`${BTN_SECONDARY_STYLE} h-12 px-6 text-xs font-bold uppercase tracking-wider`}
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                disabled={!selectedCategory}
                                className={`${BTN_PRIMARY_STYLE} h-12 px-8 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-primary-500/20 active:scale-95 disabled:opacity-50`}
                            >
                                <span>Assign Category</span>
                                <Icon name="check" className="text-base" />
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
};

export default BulkCategorizeModal;