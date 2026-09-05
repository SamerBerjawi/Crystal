
import React, { useState, useMemo } from 'react';
import { BTN_PRIMARY_STYLE, INPUT_BASE_STYLE } from '../constants';
import { Category, Page } from '../types';
import Card from '../components/Card';
import CategoryModal from '../components/CategoryModal';
import Modal from '../components/Modal';
import { v4 as uuidv4 } from 'uuid';
import CategoryItem from '../components/CategoryItem';
import SettingsSubpageHeader from '../components/SettingsSubpageHeader';
import HeaderButton from '../components/HeaderButton';
import HeroMetricCard from '../components/ui/HeroMetricCard';
import MetricCardRow from '../components/ui/MetricCardRow';
import SegmentedControl from '../components/ui/SegmentedControl';
import FilterBar from '../components/ui/FilterBar';
import Icon from '../components/ui/Icon';

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
                  <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm font-normal leading-relaxed">
                      Irreversible Operation Detected. Primary and secondary category nodes will be excised. Proceed?
                  </p>
                  <div className="flex justify-end gap-3 pt-6 border-t border-black/5 dark:border-white/5">
                      <button type="button" onClick={() => setConfirmingDelete(null)} className="px-5 py-2.5 rounded-xl text-xs font-semibold text-light-text dark:text-dark-text bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors">Abort</button>
                      <button type="button" onClick={executeDelete} className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20 transition-colors">Execute Deletion</button>
                  </div>
              </div>
          </Modal>
      )}
      
       {/* Navigation & Header */}
       <SettingsSubpageHeader
         accentColor="indigo"
         markerIcon="folder"
         markerLabel="Taxonomy Blueprint"
         title="Categories"
         subtitle="Define the logical structure of your ledger. Map telemetry objects into specific spending and earning protocols."
         setCurrentPage={setCurrentPage}
         actions={
           <HeaderButton
             variant="primary"
             icon="PlusCircle"
             onClick={() => openModal('add', activeTab)}
           >
             New Category
           </HeaderButton>
         }
       />

      {/* Stats Row */}
      <MetricCardRow columns={3}>
          <HeroMetricCard 
              variant="primary"
              label="Total Schema" 
              value={stats.total} 
              icon="folder" 
              iconColor="emerald"
              subtext="Active category nodes"
          />
          <HeroMetricCard 
              variant="secondary"
              label="Major Nodes" 
              value={stats.parents} 
              icon="folder" 
              iconColor="blue"
              subtext="Primary classification groups"
          />
          <HeroMetricCard 
              variant="secondary"
              label="Sub-Nodes" 
              value={stats.subs} 
              icon="folder" 
              iconColor="indigo"
              subtext="Nested classification points"
          />
      </MetricCardRow>

      {/* Controls Section */}
      <div className="flex flex-col sm:flex-row justify-between gap-6 px-2 items-center">
        {/* Tab Switcher */}
        <SegmentedControl
          items={[
            { id: 'expense', label: 'Debit (Expenses)', icon: 'arrow_upward' },
            { id: 'income', label: 'Credit (Income)', icon: 'arrow_downward' },
          ]}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as 'expense' | 'income')}
          className="w-full sm:w-auto"
        />

        {/* Search */}
        <div className="w-full sm:max-w-md">
          <FilterBar.Search
            placeholder="Query taxonomy structure..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
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
          <div className="flex flex-col items-center justify-center py-32 glass-subwell rounded-3xl border border-dashed border-slate-300 dark:border-white/10">
              <div className="w-20 h-20 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
                <Icon name="folder" className="text-4xl opacity-20" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-60">Schema Nullified</p>
              {!searchTerm && (
                  <button onClick={() => openModal('add', activeTab)} className="mt-6 px-6 py-3 bg-primary-500 text-white rounded-2xl text-xs font-semibold tracking-wide shadow-lg shadow-primary-500/20 hover:scale-105 active:scale-95 transition-all">
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
