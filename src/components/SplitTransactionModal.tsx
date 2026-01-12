
import React, { useState, useMemo, useEffect } from 'react';
import Modal from './Modal';
import { Transaction, Category, SubTransaction } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, BTN_DANGER_STYLE, INPUT_BASE_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE } from '../constants';
import { formatCurrency, convertToEur } from '../utils';
import { v4 as uuidv4 } from 'uuid';

interface SplitTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedTransaction: Transaction) => void;
  transaction: Transaction;
  categories: Category[];
}

const CategoryOptions: React.FC<{ categories: Category[] }> = ({ categories }) => (
    <>
      <option value="">Select Category</option>
      {categories.map(parentCat => (
        <optgroup key={parentCat.id} label={parentCat.name}>
          <option value={parentCat.name}>{parentCat.name}</option>
          {parentCat.subCategories.map(subCat => (
            <option key={subCat.id} value={subCat.name}>
              &nbsp;&nbsp;{subCat.name}
            </option>
          ))}
        </optgroup>
      ))}
    </>
);

const SplitTransactionModal: React.FC<SplitTransactionModalProps> = ({ isOpen, onClose, onSave, transaction, categories }) => {
    const [splits, setSplits] = useState<SubTransaction[]>([]);
    
    useEffect(() => {
        if (transaction.subTransactions && transaction.subTransactions.length > 0) {
            setSplits(transaction.subTransactions);
        } else {
            // Initial state: One row with full amount
            setSplits([{
                id: uuidv4(),
                amount: Math.abs(transaction.amount),
                category: transaction.category,
                description: transaction.description
            }]);
        }
    }, [transaction]);

    const totalTransactionAmount = Math.abs(transaction.amount);
    
    const currentSum = useMemo(() => {
        return splits.reduce((sum, split) => sum + (parseFloat(String(split.amount)) || 0), 0);
    }, [splits]);

    const remainder = totalTransactionAmount - currentSum;
    const isBalanced = Math.abs(remainder) < 0.01;

    const handleSplitChange = (id: string, field: keyof SubTransaction, value: string | number) => {
        setSplits(prev => prev.map(s => {
            if (s.id === id) {
                return { ...s, [field]: value };
            }
            return s;
        }));
    };

    const addSplit = () => {
        setSplits(prev => [
            ...prev,
            {
                id: uuidv4(),
                amount: remainder > 0 ? parseFloat(remainder.toFixed(2)) : 0,
                category: '',
                description: ''
            }
        ]);
    };

    const removeSplit = (id: string) => {
        setSplits(prev => prev.filter(s => s.id !== id));
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isBalanced) return;

        const updatedTx: Transaction = {
            ...transaction,
            category: 'Split', // Special category for split parent
            subTransactions: splits.map(s => ({
                ...s,
                amount: parseFloat(String(s.amount))
            }))
        };
        onSave(updatedTx);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <Modal onClose={onClose} title="Split Transaction" size="xl">
            <form onSubmit={handleSave} className="space-y-6">
                <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-black/5 dark:border-white/5 flex justify-between items-center">
                    <div>
                        <p className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-0.5">Total Amount</p>
                        <p className="text-2xl font-mono font-bold text-light-text dark:text-dark-text">{formatCurrency(totalTransactionAmount, transaction.currency)}</p>
                    </div>
                    <div className={`text-right ${isBalanced ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        <p className="text-xs font-bold uppercase tracking-wider mb-0.5">Remaining</p>
                        <p className="text-xl font-mono font-bold">{formatCurrency(remainder, transaction.currency)}</p>
                    </div>
                </div>

                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                    {splits.map((split, index) => (
                        <div key={split.id} className="flex flex-col sm:flex-row gap-3 p-3 rounded-lg bg-light-bg dark:bg-dark-bg border border-black/5 dark:border-white/5 items-start sm:items-center">
                            <div className="flex-1 w-full sm:w-auto">
                                <label className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase mb-1 block">Description</label>
                                <input
                                    type="text"
                                    value={split.description || ''}
                                    onChange={(e) => handleSplitChange(split.id, 'description', e.target.value)}
                                    className={`${INPUT_BASE_STYLE} !py-1 !text-sm`}
                                    placeholder="Item description"
                                />
                            </div>
                            <div className="w-full sm:w-1/3">
                                <label className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase mb-1 block">Category</label>
                                <div className={SELECT_WRAPPER_STYLE}>
                                    <select
                                        value={split.category}
                                        onChange={(e) => handleSplitChange(split.id, 'category', e.target.value)}
                                        className={`${INPUT_BASE_STYLE} !py-1 !text-sm`}
                                        required
                                    >
                                        <CategoryOptions categories={categories} />
                                    </select>
                                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined text-sm">expand_more</span></div>
                                </div>
                            </div>
                            <div className="w-32">
                                <label className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase mb-1 block">Amount</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={split.amount}
                                    onChange={(e) => handleSplitChange(split.id, 'amount', e.target.value)}
                                    className={`${INPUT_BASE_STYLE} !py-1 !text-sm text-right font-mono`}
                                    required
                                />
                            </div>
                            <div className="pt-5">
                                <button
                                    type="button"
                                    onClick={() => removeSplit(split.id)}
                                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    disabled={splits.length <= 1}
                                    title="Remove Split"
                                >
                                    <span className="material-symbols-outlined text-lg">delete</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-black/10 dark:border-white/10">
                    <button
                        type="button"
                        onClick={addSplit}
                        className={`${BTN_SECONDARY_STYLE} flex items-center gap-2`}
                        disabled={remainder <= 0}
                    >
                        <span className="material-symbols-outlined text-lg">add</span>
                        Add Split
                    </button>
                    
                    <div className="flex gap-3">
                         <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                         <button 
                            type="submit" 
                            className={BTN_PRIMARY_STYLE} 
                            disabled={!isBalanced}
                            title={!isBalanced ? `Please assign the remaining ${formatCurrency(remainder, transaction.currency)}` : ''}
                        >
                             Save Splits
                         </button>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default SplitTransactionModal;
