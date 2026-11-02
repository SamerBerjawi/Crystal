import React, { useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Category, Page } from '../types';
import CategoryItem from '../components/CategoryItem';
import CategoryModal from '../components/CategoryModal';
import SettingsSubpageHeader from '../components/SettingsSubpageHeader';
import { Button } from '../components/ui/Actions';
import { TextInput } from '../components/ui/Fields';
import { ConfirmDialog } from '../components/ui/Overlays';
import SegmentedControl from '../components/ui/SegmentedControl';
import { EmptyState } from '../components/ui/States';
import { addSubCategory, DropPosition, filterCategories, moveCategory, removeCategory, shiftCategory, updateCategory } from '../utils/categoryTree';

type Classification = 'income' | 'expense';

interface EditState {
  mode: 'add' | 'edit';
  category: Category | null;
  parentId?: string;
  classification: Classification;
}

interface CategoriesProps {
  incomeCategories: Category[];
  setIncomeCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  expenseCategories: Category[];
  setExpenseCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  setCurrentPage: (page: Page) => void;
}

const countSubCategories = (categories: Category[]) => categories.reduce((sum, category) => sum + (category.subCategories?.length || 0), 0);

const Categories: React.FC<CategoriesProps> = ({ incomeCategories, setIncomeCategories, expenseCategories, setExpenseCategories, setCurrentPage }) => {
  const [activeTab, setActiveTab] = useState<Classification>('expense');
  const [editing, setEditing] = useState<EditState | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: DropPosition } | null>(null);

  const setterFor = (classification: Classification) => (classification === 'income' ? setIncomeCategories : setExpenseCategories);
  const setActive = setterFor(activeTab);
  const list = activeTab === 'income' ? incomeCategories : expenseCategories;
  const visible = useMemo(() => filterCategories(list, search), [list, search]);

  const save = (saved: Category, parentId?: string) => {
    const setCategories = setterFor(saved.classification);
    if (saved.id) {
      setCategories(prev => updateCategory(prev, saved.id, saved));
    } else {
      const created = { ...saved, id: `cat-${uuidv4()}` };
      setCategories(prev => (parentId ? addSubCategory(prev, parentId, created) : [...prev, created]));
    }
    setEditing(null);
  };

  const endDrag = () => { setDraggedId(null); setDropTarget(null); };
  const drop = () => {
    if (draggedId && dropTarget) setActive(prev => moveCategory(prev, draggedId, dropTarget.id, dropTarget.position));
    endDrag();
  };

  return (
    <div className="space-y-6">
      <SettingsSubpageHeader
        title="Categories"
        setCurrentPage={setCurrentPage}
        stats={[
          { label: 'Expense', icon: 'arrow_upward', value: expenseCategories.length },
          { label: 'Income', icon: 'arrow_downward', value: incomeCategories.length },
          { label: 'Sub-categories', icon: 'folder', value: countSubCategories(expenseCategories) + countSubCategories(incomeCategories) },
        ]}
        actions={<Button icon="add" onPress={() => setEditing({ mode: 'add', category: null, classification: activeTab })}>New category</Button>}
      />

      {editing && (
        <CategoryModal isOpen onClose={() => setEditing(null)} onSave={save} category={editing.category} parentId={editing.parentId} mode={editing.mode} classification={editing.classification} />
      )}
      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={() => { if (deletingId) setActive(prev => removeCategory(prev, deletingId)); setDeletingId(null); }}
        title="Delete this category?"
        message="Its sub-categories go too. You can’t undo this."
        confirmLabel="Delete category"
        isDestructive
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <SegmentedControl
          items={[{ id: 'expense', label: 'Expenses' }, { id: 'income', label: 'Income' }]}
          activeId={activeTab}
          onChange={id => setActiveTab(id as Classification)}
        />
        <TextInput label="Find a category" className="w-full md:w-72" value={search} onChange={setSearch} />
      </div>

      {visible.length > 0 ? (
        <ul className="surface-card min-w-0 divide-y divide-line rounded-[var(--radius-xl)] px-4 py-1">
          {visible.map(category => (
            <CategoryItem
              key={category.id}
              category={category}
              level={0}
              isForcedOpen={!!search.trim()}
              onEdit={item => setEditing({ mode: 'edit', category: item, classification: activeTab })}
              onDelete={setDeletingId}
              onAddSubCategory={parentId => setEditing({ mode: 'add', category: null, parentId, classification: activeTab })}
              onShift={(id, direction) => setActive(prev => shiftCategory(prev, id, direction))}
              draggedId={draggedId}
              dropTarget={dropTarget}
              onDragStart={setDraggedId}
              onDragOver={(id, position) => setDropTarget({ id, position })}
              onDragLeave={() => setDropTarget(null)}
              onDrop={drop}
              onDragEnd={endDrag}
            />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon="folder"
          title={search ? 'No categories match' : 'No categories yet'}
          description={search ? 'Try another word.' : 'Add one to start grouping transactions.'}
          actionLabel={search ? undefined : 'New category'}
          onAction={() => setEditing({ mode: 'add', category: null, classification: activeTab })}
        />
      )}
    </div>
  );
};

export default Categories;
