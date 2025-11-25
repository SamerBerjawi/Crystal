
import React, { useState } from 'react';
import Modal from './Modal';
import { Category } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE } from '../constants';

interface BulkCategorizeModalProps {
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

const BulkCategorizeModal: React.FC<BulkCategorizeModalProps> = ({ onClose, onSave, incomeCategories, expenseCategories }) => {
    const [selectedCategory, setSelectedCategory] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedCategory) {
            onSave(selectedCategory);
        }
    };
    
    const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";

    return (
        <Modal onClose={onClose} title="Assign Category">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="bulk-category" className={labelStyle}>New Category</label>
                    <div className={SELECT_WRAPPER_STYLE}>
                        <select
                            id="bulk-category"
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className={INPUT_BASE_STYLE}
                            required
                        >
                            <option value="" disabled>Select a category</option>
                            <optgroup label="--- EXPENSES ---"></optgroup>
                            <CategoryOptions categories={expenseCategories} />
                            <optgroup label="--- INCOME ---"></optgroup>
                            <CategoryOptions categories={incomeCategories} />
                        </select>
                        <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                    </div>
                </div>
                 <div className="flex justify-end gap-4 pt-4">
                    <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                    <button type="submit" className={BTN_PRIMARY_STYLE}>Assign Category</button>
                </div>
            </form>
        </Modal>
    );
};

export default BulkCategorizeModal;
