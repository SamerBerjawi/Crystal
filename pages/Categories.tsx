import React, { useState, useMemo } from 'react';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE } from '../constants';
import { Category, Page } from '../types';
import Card from '../components/Card';
import CategoryItem from '../components/CategoryItem';
import CategoryModal from '../components/CategoryModal';
import Modal from '../components/Modal';
import { v4 as uuidv4 } from 'uuid';

const generateId = () => `cat-${uuidv4()}`;

interface EditState {
  category: Category;
  parentId?: string;
  classification: 'income' | 'expense';
}

interface CategoriesProps {
  incomeCategories: Category[];
  setIncomeCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  expenseCategories: Category[];
  setExpenseCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  setCurrentPage: (page: Page) => void;
}

const Categories: React.FC<CategoriesProps> = ({ incomeCategories, setIncomeCategories, expenseCategories, setExpenseCategories, setCurrentPage }) => {
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingState, setEditingState] = useState<EditState | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [confirmingDelete, setConfirmingDelete] = useState<{
    categoryId: string;
    classification: 'income' | 'expense';
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const openModal = (
    mode: 'add' | 'edit', 
    classification: 'income' | 'expense',
    category?: Category,
    parentId?: string
  ) => {
    setModalMode(mode);
    setEditingState({
        category: category || { id: '', name: '', color: '#6366f1', classification, subCategories: [], icon: 'category' },
        parentId: parentId,
        classification,
    });
    setModalOpen(true);
  };

  const handleSaveCategory = (savedCategory: Category, parentId?: string) => {
    const isEditing = !!savedCategory.id;
    const classification = savedCategory.classification;
    const setCategories = classification === 'income' ? setIncomeCategories : setExpenseCategories;
    
    const updateRecursively = (categories: Category[], targetId: string, updatedCat: Category): Category[] => {
        return categories.map(cat => {
            if (cat.id === targetId) return { ...cat, name: updatedCat.name, color: updatedCat.color, icon: updatedCat.icon };
            if (cat.subCategories.length > 0) {
                return { ...cat, subCategories: updateRecursively(cat.subCategories, targetId, updatedCat) };
            }
            return cat;
        });
    };

    const addSubCategoryRecursively = (categories: Category[], pId: string, newCat: Category): Category[] => {
        return categories.map(cat => {
            if (cat.id === pId) return { ...cat, subCategories: [...cat.subCategories, newCat] };
            if (cat.subCategories.length > 0) {
                 return { ...cat, subCategories: addSubCategoryRecursively(cat.subCategories, pId, newCat) };
            }
            return cat;
        });
    };

    if (isEditing) {
        // In this app, we don't allow changing classification in the edit modal, so we just update in place.
        setCategories(prev => updateRecursively(prev, savedCategory.id, savedCategory));
    } else {
        const newCategoryWithId = { ...savedCategory, id: generateId() };
        if (parentId) {
            setCategories(prev => addSubCategoryRecursively(prev, parentId, newCategoryWithId));
        } else {
            setCategories(prev => [...prev, newCategoryWithId]);
        }
    }

    setModalOpen(false);
    setEditingState(null);
  };

  const handleDeleteCategory = (categoryId: string, classification: 'income' | 'expense') => {
    setConfirmingDelete({ categoryId, classification });
  };

  const executeDelete = () => {
    if (!confirmingDelete) return;

    const { categoryId, classification } = confirmingDelete;
    const setCategories = classification === 'income' ? setIncomeCategories : setExpenseCategories;
    
    const removeRecursively = (categories: Category[], idToRemove: string): Category[] => {
        const filtered = categories.filter(cat => cat.id !== idToRemove);
        
        return filtered.map(cat => {
            if (cat.subCategories && cat.subCategories.length > 0) {
                return { ...cat, subCategories: removeRecursively(cat.subCategories, idToRemove) };
            }
            return cat;
        });
    };

    setCategories(prev => removeRecursively(prev, categoryId));
    setConfirmingDelete(null);
  };

  const filterCategories = (categories: Category[], term: string): Category[] => {
    const lowercasedTerm = term.toLowerCase().trim();
    if (!lowercasedTerm) {
      return categories;
    }

    const results: Category[] = [];

    for (const category of categories) {
      if (category.name.toLowerCase().includes(lowercasedTerm)) {
        results.push(category);
        continue;
      }

      const matchingSubcategories = filterCategories(category.subCategories, lowercasedTerm);
      if (matchingSubcategories.length > 0) {
        results.push({ ...category, subCategories: matchingSubcategories });
      }
    }

    return results;
  };

  const filteredIncomeCategories = useMemo(() => filterCategories(incomeCategories, searchTerm), [incomeCategories, searchTerm]);
  const filteredExpenseCategories = useMemo(() => filterCategories(expenseCategories, searchTerm), [expenseCategories, searchTerm]);


  return (
    <div className="space-y-8">
      {isModalOpen && editingState && (
        <CategoryModal
          isOpen={isModalOpen}
          onClose={() => setModalOpen(false)}
          onSave={handleSaveCategory}
          category={editingState.category}
          parentId={editingState.parentId}
          mode={modalMode}
          classification={editingState.classification}
        />
      )}

      {confirmingDelete && (
        <Modal
          onClose={() => setConfirmingDelete(null)}
          title="Confirm Deletion"
        >
          <div className="space-y-6">
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              Are you sure you want to delete this category and all its sub-categories? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => setConfirmingDelete(null)}
                className={BTN_SECONDARY_STYLE}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="bg-red-500 text-white font-semibold py-2 px-4 rounded-lg shadow-neu-raised-light dark:shadow-neu-raised-dark hover:bg-red-600 active:shadow-neu-inset-light dark:active:shadow-neu-inset-dark transition-all duration-200"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
      
      <header>
        <div className="flex items-center gap-4">
            <button onClick={() => setCurrentPage('Settings')} className="text-light-text-secondary dark:text-dark-text-secondary p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
                <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                <span onClick={() => setCurrentPage('Settings')} className="hover:underline cursor-pointer">Settings</span>
                <span> / </span>
                <span className="text-light-text dark:text-dark-text font-medium">Categories</span>
            </div>
        </div>
        <div className="mt-4 flex justify-between items-center">
            <div>
              <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Manage your income and expense categories.</p>
            </div>
            <div className="flex items-center gap-4">
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none">
                        search
                    </span>
                    <input
                        type="text"
                        placeholder="Search categories..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`${INPUT_BASE_STYLE} pl-10`}
                    />
                </div>
                <button onClick={() => openModal('add', 'expense')} className={BTN_PRIMARY_STYLE}>
                    Add Category
                </button>
            </div>
        </div>
      </header>

      <div className="space-y-8">
        <section>
          <h3 className="text-xl font-semibold text-light-text dark:text-dark-text mb-4">Income Categories</h3>
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
              {filteredIncomeCategories.map(cat => (
                <CategoryItem 
                  key={cat.id} 
                  category={cat} 
                  onEdit={(c) => openModal('edit', 'income', c)}
                  onDelete={(id) => handleDeleteCategory(id, 'income')}
                  onAddSubCategory={(parentId) => openModal('add', 'income', undefined, parentId)}
                />
              ))}
            </div>
             {filteredIncomeCategories.length === 0 && (
                <p className="text-center text-light-text-secondary dark:text-dark-text-secondary py-4">
                    {searchTerm ? 'No matching income categories found.' : 'No income categories defined.'}
                </p>
             )}
          </Card>
        </section>
        <section>
          <h3 className="text-xl font-semibold text-light-text dark:text-dark-text mb-4">Expense Categories</h3>
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            {filteredExpenseCategories.map(cat => (
              <CategoryItem 
                key={cat.id} 
                category={cat}
                onEdit={(c) => openModal('edit', 'expense', c)}
                onDelete={(id) => handleDeleteCategory(id, 'expense')}
                onAddSubCategory={(parentId) => openModal('add', 'expense', undefined, parentId)}
              />
            ))}
            </div>
             {filteredExpenseCategories.length === 0 && (
                <p className="text-center text-light-text-secondary dark:text-dark-text-secondary py-4">
                    {searchTerm ? 'No matching expense categories found.' : 'No expense categories defined.'}
                </p>
             )}
          </Card>
        </section>
      </div>
    </div>
  );
};

export default Categories;