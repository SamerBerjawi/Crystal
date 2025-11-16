import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Budget, Category, Currency } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE } from '../constants';

interface BudgetModalProps {
    onClose: () => void;
    onSave: (budget: Omit<Budget, 'id'> & { id?: string }) => void;
    budgetToEdit?: Budget | null;
    categoryNameToCreate?: string;
    existingBudgets: Budget[];
    expenseCategories: Category[];
}

const BudgetModal: React.FC<BudgetModalProps> = ({ onClose, onSave, budgetToEdit, categoryNameToCreate, existingBudgets, expenseCategories }) => {
    const isEditing = !!budgetToEdit;

    const [categoryName, setCategoryName] = useState('');
    const [amount, setAmount] = useState('');

    useEffect(() => {
        if (isEditing && budgetToEdit) {
            setCategoryName(budgetToEdit.categoryName);
            setAmount(String(budgetToEdit.amount));
        } else if (categoryNameToCreate) {
            setCategoryName(categoryNameToCreate);
            setAmount('');
        } else {
            setCategoryName('');
            setAmount('');
        }
    }, [isEditing, budgetToEdit, categoryNameToCreate]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!categoryName || !amount) return;
        
        const budgetData = {
            id: isEditing ? budgetToEdit.id : undefined,
            categoryName,
            amount: parseFloat(amount),
            period: 'monthly' as const,
            currency: 'EUR' as const,
        };

        onSave(budgetData);
        onClose();
    };

    const availableCategories = expenseCategories.filter(cat => {
        if (isEditing && cat.name === budgetToEdit.categoryName) {
            return true; // Always show the category being edited
        }
        if (categoryNameToCreate && cat.name === categoryNameToCreate) {
            return true; // Always show the category being created
        }
        return !existingBudgets.some(b => b.categoryName === cat.name);
    });

    const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";
    const modalTitle = isEditing ? 'Edit Budget' : 'Create New Budget';
    const saveButtonText = isEditing ? 'Save Changes' : 'Create Budget';

    return (
        <Modal onClose={onClose} title={modalTitle}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="budget-category" className={labelStyle}>Category</label>
                    <div className={SELECT_WRAPPER_STYLE}>
                        <select
                            id="budget-category"
                            value={categoryName}
                            onChange={e => setCategoryName(e.target.value)}
                            className={INPUT_BASE_STYLE}
                            required
                            disabled={isEditing || !!categoryNameToCreate}
                        >
                            <option value="" disabled>Select a category</option>
                            {availableCategories.map(cat => (
                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                            ))}
                        </select>
                         <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                    </div>
                     {(isEditing || !!categoryNameToCreate) && <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">Category cannot be changed after creation.</p>}
                </div>

                <div>
                    <label htmlFor="budget-amount" className={labelStyle}>Monthly Amount (EUR)</label>
                    <input
                        id="budget-amount"
                        type="number"
                        step="0.01"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className={INPUT_BASE_STYLE}
                        placeholder="0.00"
                        required
                    />
                </div>

                <div className="flex justify-end gap-4 pt-4">
                    <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                    <button type="submit" className={BTN_PRIMARY_STYLE}>{saveButtonText}</button>
                </div>
            </form>
        </Modal>
    );
};

export default BudgetModal;