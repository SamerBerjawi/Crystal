
import React, { useState, useMemo } from 'react';
import { BTN_PRIMARY_STYLE, INPUT_BASE_STYLE } from '../constants';
import { Category, Page } from '../types';
import Card from '../components/Card';
import CategoryModal from '../components/CategoryModal';
import Modal from '../components/Modal';
import { v4 as uuidv4 } from 'uuid';
import CategoryItem from '../components/CategoryItem';

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
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingState, setEditingState] = useState<EditState | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [confirmingDelete, setConfirmingDelete] = useState<{ categoryId: string; classification: 'income' | 'expense' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [draggedItem, setDraggedItem] = useState<{ id: string; classification: 'income' | 'expense' } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: 'top' | 'bottom' | 'middle' } | null>(null);

  const activeCategoriesList = activeTab === 'income' ? incomeCategories : expenseCategories;

  const stats = useMemo(() => {
    const parents = activeCategoriesList.length;
    const subs = activeCategoriesList.reduce((acc, cat) => acc + (cat.subCategories?.length || 0), 0);
    return { parents, subs, total: parents + subs };
  }, [activeCategoriesList]);

  const openModal = (
    mode: 'add' | 'edit', 
    classification: 'income' | 'expense',
    category?: Category,
    parentId?: string
  ) => {
    setModalMode(mode);
    setEditingState({
        category: category || { id: '', name: '', color: '#6366f1', classification, subCategories: [], icon: 'category' },
        parentId,
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
    if (!lowercasedTerm) return categories;

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
  const activeCategories = activeTab === 'income' ? filteredIncomeCategories : filteredExpenseCategories;

    const handleDragStart = (id: string, classification: 'income' | 'expense') => { setDraggedItem({ id, classification }); };
    const handleDragOver = (id: string, position: 'top' | 'bottom' | 'middle') => { setDropTarget({ id, position }); };
    const handleDragLeave = () => { setDropTarget(null); };
    const handleDragEnd = () => { setDraggedItem(null); setDropTarget(null); };

    const handleDrop = () => {
        if (!draggedItem || !dropTarget || draggedItem.id === dropTarget.id) return handleDragEnd();

        const { id: draggedId, classification } = draggedItem;
        const { id: dropId, position } = dropTarget;

        if (classification !== activeTab) return handleDragEnd();

        const setCategories = classification === 'income' ? setIncomeCategories : setExpenseCategories;

        setCategories(prev => {
            let draggedCategory: Category | null = null;
            
            const isDescendant = (items: Category[], parentId: string, childId: string): boolean => {
                const findParent = (cats: Category[], id: string): Category | null => {
                    for (const cat of cats) { if (cat.id === id) return cat; if (cat.subCategories?.length) { const found = findParent(cat.subCategories, id); if (found) return found; } } return null;
                };
                const parent = findParent(items, parentId);
                return parent ? !!findParent(parent.subCategories, childId) : false;
            };
            if (isDescendant(prev, draggedId, dropId)) return prev;

            const findAndRemove = (items: Category[]): Category[] => {
                const itemIndex = items.findIndex(item => item.id === draggedId);
                if (itemIndex > -1) {
                    draggedCategory = { ...items[itemIndex] };
                    return items.filter(item => item.id !== draggedId);
                }
                return items.map(item => ({ ...item, subCategories: findAndRemove(item.subCategories) }));
            };
            const categoriesWithoutItem = findAndRemove(prev);
            if (!draggedCategory) return prev; 

            const findAndInsert = (items: Category[], parentId?: string): Category[] => {
                if (position === 'middle') {
                    return items.map(item => {
                        if (item.id === dropId) {
                            const parentColor = item.color;
                            const adaptColor = (cat: Category): Category => ({ ...cat, color: parentColor, subCategories: cat.subCategories.map(adaptColor) });
                            const newSubCategory = adaptColor({ ...draggedCategory!, parentId: dropId });
                            return { ...item, subCategories: [...item.subCategories, newSubCategory] };
                        }
                        return { ...item, subCategories: findAndInsert(item.subCategories, item.id) };
                    });
                }
                
                const targetIndex = items.findIndex(item => item.id === dropId);
                if (targetIndex > -1) {
                    const newItems = [...items];
                    newItems.splice(position === 'top' ? targetIndex : targetIndex + 1, 0, { ...draggedCategory!, parentId });
                    return newItems;
                }
                
                return items.map(item => ({ ...item, subCategories: findAndInsert(item.subCategories, item.id) }));
            };
            const newCategoryTree = findAndInsert(categoriesWithoutItem);
            return newCategoryTree;
        });

        handleDragEnd();
    };

  return (
    <div className="space-y-8 pb-12 animate-fade-in-up">
      {isModalOpen && editingState && <CategoryModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} onSave={handleSaveCategory} category={editingState.category} parentId={editingState.parentId} mode={modalMode} classification={editingState.classification} />}
      {confirmingDelete && (
          <Modal onClose={() => setConfirmingDelete(null)} title="Confirm Deletion">
              <div className="space-y-6">
                  <p className="text-light-text-secondary dark:text-dark-text-secondary">
                      Are you sure you want to delete this category? Any sub-categories will also be deleted.
                  </p>
                  <div className="flex justify-end gap-4 pt-4 border-t border-black/10 dark:border-white/10">
                      <button type="button" onClick={() => setConfirmingDelete(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-light-text dark:text-dark-text bg-light-fill dark:bg-dark-fill hover:bg-black/10 dark:hover:bg-white/10 transition-colors">Cancel</button>
                      <button type="button" onClick={executeDelete} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 shadow-sm transition-colors">Delete</button>
                  </div>
              </div>
          </Modal>
      )}
      
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <button onClick={() => setCurrentPage('Settings')} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
                <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                    <span onClick={() => setCurrentPage('Settings')} className="hover:underline cursor-pointer">Settings</span>
                    <span>/</span>
                    <span>Organization</span>
                </div>
                <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">Categories</h1>
            </div>
        </div>
        <button onClick={() => openModal('add', activeTab)} className={BTN_PRIMARY_STYLE}>
            <span className="material-symbols-outlined text-xl mr-2">add</span>
            New Category
        </button>
      </header>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="p-5 flex items-center justify-between bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-none relative overflow-hidden">
             <div className="relative z-10">
                 <p className="text-xs font-bold uppercase opacity-80 tracking-wider">Total Categories</p>
                 <p className="text-3xl font-extrabold mt-1">{stats.parents}</p>
             </div>
             <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm relative z-10">
                  <span className="material-symbols-outlined text-2xl">category</span>
             </div>
              <div className="absolute -right-4 -bottom-8 text-white opacity-10">
                   <span className="material-symbols-outlined text-9xl">folder_open</span>
              </div>
          </Card>
          
           <Card className="p-5 flex items-center justify-between">
             <div>
                 <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">Sub-Categories</p>
                 <p className="text-3xl font-extrabold text-light-text dark:text-dark-text mt-1">{stats.subs}</p>
             </div>
             <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">subdirectory_arrow_right</span>
             </div>
          </Card>

          <Card className="p-5 flex items-center justify-between">
             <div>
                 <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">Total Items</p>
                 <p className="text-3xl font-extrabold text-light-text dark:text-dark-text mt-1">{stats.total}</p>
             </div>
             <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">list_alt</span>
             </div>
          </Card>
      </div>

      {/* Controls Section */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 bg-light-card dark:bg-dark-card p-2 rounded-xl shadow-sm border border-black/5 dark:border-white/5">
        {/* Tab Switcher */}
        <div className="flex bg-light-fill dark:bg-dark-fill p-1 rounded-lg w-full sm:w-auto">
            <button 
                onClick={() => setActiveTab('expense')} 
                className={`flex-1 sm:flex-none px-6 py-2 rounded-md text-sm font-semibold transition-all duration-200 ${activeTab === 'expense' ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-sm' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}
            >
                Expenses
            </button>
            <button 
                onClick={() => setActiveTab('income')} 
                className={`flex-1 sm:flex-none px-6 py-2 rounded-md text-sm font-semibold transition-all duration-200 ${activeTab === 'income' ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-sm' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}
            >
                Income
            </button>
        </div>

        {/* Search */}
        <div className="relative flex-grow max-w-md">
             <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none">search</span>
             <input 
                type="text" 
                placeholder="Search categories..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className={`${INPUT_BASE_STYLE} pl-10 w-full !h-10 !bg-transparent border-none focus:ring-0`}
             />
        </div>
      </div>

      {/* Categories List - Single Column Stack */}
      {activeCategories.length > 0 ? (
          <div className="space-y-2 max-w-5xl mx-auto">
            {activeCategories.map(cat => (
              <CategoryItem
                key={cat.id}
                category={cat}
                onEdit={(category) => openModal('edit', activeTab, category)}
                onDelete={(id) => handleDeleteCategory(id, activeTab)}
                onAddSubCategory={(parentId) => openModal('add', activeTab, undefined, parentId)}
                level={0}
                classification={activeTab}
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
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-light-card/50 dark:bg-dark-card/50 rounded-2xl border border-dashed border-black/10 dark:border-white/10">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-3xl text-gray-400 dark:text-gray-500">category</span>
            </div>
            <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">No Categories Found</h3>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1 max-w-xs">
                {searchTerm ? `No categories match "${searchTerm}".` : `You haven't created any ${activeTab} categories yet.`}
            </p>
            {!searchTerm && (
                <button onClick={() => openModal('add', activeTab)} className={`${BTN_PRIMARY_STYLE} mt-4`}>
                    Create First Category
                </button>
            )}
        </div>
      )}
    </div>
  );
};

export default Categories;
