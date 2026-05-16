
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Budget, Category, Currency } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE, SELECT_STYLE } from '../constants';

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
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[2.5rem]">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-500/10 blur-[80px] rounded-full" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-rose-500/10 blur-[80px] rounded-full" />
            </div>

            <form onSubmit={handleSubmit} className="relative z-10 space-y-8 pb-4">
                
                {/* Hero Allocation Threshold Section */}
                <div className="bg-white dark:bg-black/20 p-8 rounded-[2rem] border border-black/5 dark:border-white/5 space-y-8 flex flex-col items-center shadow-sm">
                    <label htmlFor="budget-amount" className={labelStyle}>Monthly Allocation Threshold</label>
                    <div className="relative group w-full max-w-[320px] flex justify-center py-4">
                         <div className="text-7xl font-black tracking-tighter tabular-nums flex items-baseline gap-2">
                             <input 
                                id="budget-amount"
                                type="number" 
                                step="0.01" 
                                value={amount} 
                                onChange={e => setAmount(e.target.value)} 
                                className="bg-transparent border-none text-center focus:ring-0 w-full p-0 placeholder-gray-200 dark:placeholder-gray-800" 
                                placeholder="0.00"
                                required 
                                autoFocus
                             />
                             <span className="text-3xl text-gray-300 dark:text-gray-700">EUR</span>
                         </div>
                    </div>
                </div>

                <div className="bg-light-fill dark:bg-dark-fill/50 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary-500 text-lg">category</span>
                        Allocation Parameter
                    </h4>
                    
                    <div>
                        <label htmlFor="budget-category" className={labelStyle}>Financial Domain / Category</label>
                        <div className={SELECT_WRAPPER_STYLE}>
                            <select
                                id="budget-category"
                                value={categoryName}
                                onChange={e => setCategoryName(e.target.value)}
                                className={`${SELECT_STYLE} !text-lg font-bold h-14`}
                                required
                                disabled={isEditing || !!categoryNameToCreate}
                            >
                                <option value="" disabled>Select domain...</option>
                                {availableCategories.map(cat => (
                                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                                ))}
                            </select>
                            <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                        </div>
                        {(isEditing || !!categoryNameToCreate) && (
                            <div className="flex items-start gap-2 mt-4 p-4 bg-primary-500/5 dark:bg-primary-500/10 rounded-2xl border border-primary-500/20">
                                <span className="material-symbols-outlined text-primary-500 text-lg">info</span>
                                <p className="text-[10px] font-bold text-primary-600 dark:text-primary-400 leading-tight uppercase tracking-wide">
                                    Domain Lock active. Delete node and recreate to change classification.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-black/5 dark:border-white/5">
                    <button type="button" onClick={onClose} className={`${BTN_SECONDARY_STYLE} h-12 px-8 uppercase tracking-widest text-[10px] font-black`}>Retract</button>
                    <button type="submit" className={`${BTN_PRIMARY_STYLE} h-12 px-10 gap-2 group animate-glow uppercase tracking-widest text-[10px] font-black`}>
                        {isEditing ? 'Commit Changes' : 'Deploy Budget'}
                        <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">rocket_launch</span>
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default BudgetModal;
