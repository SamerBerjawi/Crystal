
import React, { useState, useMemo } from 'react';
import { BTN_PRIMARY_STYLE, INPUT_BASE_STYLE } from '../constants';
import { Category, Page } from '../types';
import Card from '../components/Card';
import CategoryModal from '../components/CategoryModal';
import Modal from '../components/Modal';
import { v4 as uuidv4 } from 'uuid';
import CategoryItem from '../components/CategoryItem';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';

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
    <div className="w-full pb-12 space-y-12 animate-fade-in-up px-4">
      {isModalOpen && editingState && <CategoryModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} onSave={handleSaveCategory} category={editingState.category} parentId={editingState.parentId} mode={modalMode} classification={editingState.classification} />}
      {confirmingDelete && (
          <Modal onClose={() => setConfirmingDelete(null)} title="Confirm Deletion">
              <div className="space-y-6">
                  <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm font-bold opacity-60 leading-relaxed  tracking-widest">
                      Irreversible Operation Detected. Primary and secondary category nodes will be excised. Proceed?
                  </p>
                  <div className="flex justify-end gap-3 pt-6 border-t border-black/5 dark:border-white/5">
                      <button type="button" onClick={() => setConfirmingDelete(null)} className="px-5 py-2.5 rounded-xl text-[10px] font-black  tracking-widest text-light-text dark:text-dark-text bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors">Abort</button>
                      <button type="button" onClick={executeDelete} className="px-5 py-2.5 rounded-xl text-[10px] font-black  tracking-widest text-white bg-red-500 hover:bg-red-600 shadow-xl shadow-red-500/20 transition-colors">Execute Deletion</button>
                  </div>
              </div>
          </Modal>
      )}
      
       {/* Navigation & Header */}
       <div className="space-y-6">
        <nav className="flex items-center gap-3">
            <button 
              onClick={() => setCurrentPage('Settings')} 
              className="group flex items-center gap-2 text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary  tracking-widest hover:text-primary-500 transition-colors"
            >
                <div className="w-6 h-6 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center group-hover:bg-primary-500 group-hover:text-white transition-all">
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                </div>
                <span>Back to Control Center</span>
            </button>
        </nav>
        
        <PageHeader
          markerIcon="schema"
          markerLabel="Taxonomy Blueprint"
          title="Categories"
          subtitle="Define the logical structure of your ledger. Map telemetry objects into specific spending and earning protocols."
          actions={
            <button onClick={() => openModal('add', activeTab)} className="px-8 py-4 bg-primary-500 text-white rounded-2xl text-[10px] font-black  tracking-[0.2em] shadow-xl shadow-primary-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3">
                <span className="material-symbols-outlined text-xl">add_circle</span>
                New Category
            </button>
          }
        />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Major Nodes" value={stats.parents} icon="data_object" colorClass="bg-blue-500 text-white shadow-blue-500/20" />
          <StatCard title="Sub-Nodes" value={stats.subs} icon="mediation" colorClass="bg-indigo-500 text-white shadow-indigo-500/20" />
          <StatCard title="Total Schema" value={stats.total} icon="account_tree" colorClass="bg-emerald-500 text-white shadow-emerald-500/20" />
          <StatCard title="Search" value={searchTerm ? '1' : '0'} icon="filter_list" colorClass="bg-orange-500 text-white shadow-orange-500/20" />
      </div>

      {/* Controls Section */}
      <div className="flex flex-col sm:flex-row justify-between gap-6 px-2">
        {/* Tab Switcher */}
        <div className="flex bg-black/5 dark:bg-white/5 p-1.5 rounded-2xl w-full sm:w-auto">
            <button 
                onClick={() => setActiveTab('expense')} 
                className={`flex-1 sm:flex-none px-8 py-3 rounded-xl text-[10px] font-black  tracking-widest transition-all duration-300 ${activeTab === 'expense' ? 'bg-white dark:bg-dark-card text-primary-500 shadow-xl shadow-black/5' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-500'}`}
            >
                Debit (Expenses)
            </button>
            <button 
                onClick={() => setActiveTab('income')} 
                className={`flex-1 sm:flex-none px-8 py-3 rounded-xl text-[10px] font-black  tracking-widest transition-all duration-300 ${activeTab === 'income' ? 'bg-white dark:bg-dark-card text-primary-500 shadow-xl shadow-black/5' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-500'}`}
            >
                Credit (Income)
            </button>
        </div>

        {/* Search */}
        <div className="relative flex-grow max-w-md group">
             <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-light-text-secondary/40 group-focus-within:text-primary-500 transition-colors pointer-events-none">search_check</span>
             <input 
                type="text" 
                placeholder="Query taxonomy structure..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="w-full bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-2xl pl-12 pr-4 py-4 text-xs font-bold  tracking-widest placeholder:text-light-text-secondary/30 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all shadow-sm"
             />
        </div>
      </div>

      {/* Categories List */}
      <div className="space-y-4">
        {activeCategories.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
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
          <div className="flex flex-col items-center justify-center py-32 bg-white/50 dark:bg-dark-card/30 rounded-3xl border border-dashed border-black/5 dark:border-white/5">
              <div className="w-20 h-20 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-4xl opacity-20">category</span>
              </div>
              <p className="text-[11px] font-black  tracking-[0.4em] text-light-text-secondary dark:text-dark-text-secondary opacity-40">Schema Nullified</p>
              {!searchTerm && (
                  <button onClick={() => openModal('add', activeTab)} className="mt-8 px-8 py-4 bg-primary-500 text-white rounded-2xl text-[10px] font-black  tracking-widest shadow-xl shadow-primary-500/20 hover:scale-105 active:scale-95 transition-all">
                      Initialize Root Category
                  </button>
              )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Categories;
