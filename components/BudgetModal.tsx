
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
            return true;
        }
        if (categoryNameToCreate && cat.name === categoryNameToCreate) {
            return true;
        }
        return !existingBudgets.some(b => b.categoryName === cat.name);
    });

    const labelStyle = "block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1.5";
    const modalTitle = isEditing ? 'Edit Budget' : 'Set New Budget';
    const saveButtonText = isEditing ? 'Update Budget' : 'Create Budget';

    return (
        <Modal onClose={onClose} title={modalTitle}>
            <form onSubmit={handleSubmit} className="space-y-6 pb-2">
                
                {/* Hero Amount */}
                <div className="flex flex-col items-center justify-center py-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5">
                    <label htmlFor="budget-amount" className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1">Monthly Limit</label>
                    <div className="relative w-full max-w-[200px]">
                        <span className={`absolute left-0 top-1/2 -translate-y-1/2 text-3xl font-medium text-light-text-secondary dark:text-dark-text-secondary pointer-events-none transition-opacity duration-200 ${amount ? 'opacity-100' : 'opacity-50'}`}>
                            €
                        </span>
                        <input 
                            id="budget-amount"
                            type="number" 
                            step="0.01" 
                            value={amount} 
                            onChange={e => setAmount(e.target.value)} 
                            className="w-full bg-transparent border-b-2 border-gray-200 dark:border-gray-700 focus:border-primary-500 text-center text-5xl font-bold text-light-text dark:text-dark-text placeholder-gray-300 dark:placeholder-gray-700 focus:outline-none py-2 transition-colors pl-6" 
                            placeholder="0" 
                            autoFocus
                            required 
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor="budget-category" className={labelStyle}>Category</label>
                    <div className={SELECT_WRAPPER_STYLE}>
                        <select
                            id="budget-category"
                            value={categoryName}
                            onChange={e => setCategoryName(e.target.value)}
                            className={`${INPUT_BASE_STYLE} !text-lg font-medium`}
                            required
                            disabled={isEditing || !!categoryNameToCreate}
                        >
                            <option value="" disabled>Select category...</option>
                            {availableCategories.map(cat => (
                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                            ))}
                        </select>
                         <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                    </div>
                     {(isEditing || !!categoryNameToCreate) && <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-2">To change the category, delete this budget and create a new one.</p>}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-black/5 dark:border-white/5">
                    <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                    <button type="submit" className={BTN_PRIMARY_STYLE}>{saveButtonText}</button>
                </div>
            </form>
        </Modal>
    );
};

export default BudgetModal;
