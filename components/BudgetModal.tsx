import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Budget, Category } from '../types';
import { formatCurrency } from '../utils';
import { Button } from './ui/Actions';
import { AmountInput } from './ui/Fields';
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
}

const WEEKS_IN_MONTH = 4.33;
const DAYS_IN_MONTH = 30;

const BudgetModal: React.FC<BudgetModalProps> = ({ onClose, onSave, budgetToEdit, onDelete, categoryNameToCreate, existingBudgets, expenseCategories }) => {
  const isEditing = !!budgetToEdit;
  const startCategory = budgetToEdit?.categoryName ?? categoryNameToCreate ?? '';
  const startAmount = budgetToEdit ? String(budgetToEdit.amount) : '';
  const [categoryName, setCategoryName] = useState(startCategory);
  const [amount, setAmount] = useState(startAmount);

  const options = useMemo<PickerOption[]>(() => expenseCategories
    .filter(category => category.name === startCategory || !existingBudgets.some(budget => budget.categoryName === category.name))
    .map(category => ({ id: category.name, label: category.name, icon: category.icon })), [expenseCategories, existingBudgets, startCategory]);

  const cap = parseFloat(amount);
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
    onSave({ id: budgetToEdit?.id, categoryName, amount: cap, period: 'monthly', currency: 'EUR' });
    onClose();
  };

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
          currency="EUR"
          value={amount}
          onChange={setAmount}
          help={isValid ? `About ${formatCurrency(cap / DAYS_IN_MONTH, 'EUR')} a day, or ${formatCurrency(cap / WEEKS_IN_MONTH, 'EUR')} a week.` : undefined}
        />
      </form>
    </Dialog>
  );
};

export default BudgetModal;
