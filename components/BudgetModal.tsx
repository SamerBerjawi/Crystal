import React, { useContext, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Budget, Category } from '../types';
import { formatCurrency, getMainCurrency } from '../utils';
import { parseAmount } from '../utils/budgetModel';
import { Button } from './ui/Actions';
import { AmountInput } from './ui/Fields';
import { Amount, PrivacyContext } from './ui/Money';
import { Dialog } from './ui/Overlays';
import { Combobox, type PickerOption } from './ui/Pickers';

interface BudgetModalProps {
  onClose: () => void;
  onSave: (budget: Omit<Budget, 'id'> & { id?: string }) => void;
  budgetToEdit?: Budget | null;
  /** Shown as a Delete button when editing; the caller is responsible for confirming. */
  onDelete?: () => void;
  categoryNameToCreate?: string;
  existingBudgets: Budget[];
  expenseCategories: Category[];
  historyByCategory?: Map<string, { label: string; spent: number }[]>;
}

const WEEKS_IN_MONTH = 4.33;
const DAYS_IN_MONTH = 30;

const BudgetModal: React.FC<BudgetModalProps> = ({ onClose, onSave, budgetToEdit, onDelete, categoryNameToCreate, existingBudgets, expenseCategories, historyByCategory }) => {
  const isEditing = !!budgetToEdit;
  const startCategory = budgetToEdit?.categoryName ?? categoryNameToCreate ?? '';
  const startAmount = budgetToEdit ? String(budgetToEdit.amount) : '';
  const [categoryName, setCategoryName] = useState(startCategory);
  const [amount, setAmount] = useState(startAmount);

  const options = useMemo<PickerOption[]>(() => expenseCategories
    .filter(category => category.name === startCategory || !existingBudgets.some(budget => budget.categoryName === category.name))
    .map(category => ({ id: category.name, label: category.name, icon: category.icon })), [expenseCategories, existingBudgets, startCategory]);

  const cap = parseAmount(amount);
  const isValid = !isNaN(cap) && cap > 0;

  const handleSave = () => {
    if (!categoryName) {
      toast.error('Choose a category');
      return;
    }
    if (!isValid) {
      toast.error('Enter an amount');
      return;
    }
    const matchedCategory = expenseCategories.find(c => c.name === categoryName);
    onSave({
      id: budgetToEdit?.id,
      categoryId: matchedCategory?.id ?? budgetToEdit?.categoryId,
      categoryName,
      amount: cap,
      period: 'monthly',
      currency: getMainCurrency(),
    });
    onClose();
  };

  const isPrivate = useContext(PrivacyContext);

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={isEditing ? `Edit ${budgetToEdit.categoryName}` : 'Set a budget'}
      isDirty={categoryName !== startCategory || amount !== startAmount}
      footer={close => (
        <div className="flex items-center justify-between gap-2">
          {isEditing && onDelete ? <Button variant="ghost" className="text-money-out" onPress={onDelete}>Delete</Button> : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onPress={close}>Cancel</Button>
            <Button onPress={handleSave}>{isEditing ? 'Save changes' : 'Set budget'}</Button>
          </div>
        </div>
      )}
    >
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSave(); }}>
        <Combobox label="Category" options={options} value={categoryName || null} onChange={id => setCategoryName(id ?? '')} placeholder="Search categories" />
        <AmountInput
          label="Monthly budget"
          currency={getMainCurrency()}
          value={amount}
          onChange={setAmount}
          help={isValid ? (isPrivate ? 'About ••• a day, or ••• a week.' : `About ${formatCurrency(cap / DAYS_IN_MONTH, getMainCurrency())} a day, or ${formatCurrency(cap / WEEKS_IN_MONTH, getMainCurrency())} a week.`) : undefined}
        />
        {categoryName && historyByCategory?.get(categoryName) && (
          <div className="rounded-[var(--radius-md)] border border-line bg-inset p-3">
            <p className="type-caption font-medium text-muted">Past 3 months in {categoryName}</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {historyByCategory.get(categoryName)!.map(entry => (
                <div key={entry.label} className="rounded-[var(--radius-sm)] bg-surface px-2.5 py-1.5">
                  <span className="type-caption block text-muted">{entry.label}</span>
                  <span className="type-figure-row text-ink"><Amount value={entry.spent} currency={getMainCurrency()} /></span>
                </div>
              ))}
            </div>
          </div>
        )}
      </form>
    </Dialog>
  );
};

export default BudgetModal;
