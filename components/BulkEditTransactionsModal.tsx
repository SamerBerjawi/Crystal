import React, { useState, useMemo } from 'react';
import Modal from './Modal';
import { Transaction, Account, Category } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE } from '../constants';

const CategoryOptions: React.FC<{ categories: Category[] }> = ({ categories }) => (
    <>
      <option value="">Select a category</option>
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
  

interface BulkEditTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedTransactions: Transaction[]) => void;
  transactionsToEdit: Transaction[];
  accounts: Account[];
  incomeCategories: Category[];
  expenseCategories: Category[];
}

const BulkEditTransactionsModal: React.FC<BulkEditTransactionsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  transactionsToEdit,
  accounts,
  incomeCategories,
  expenseCategories,
}) => {
  const [fieldsToUpdate, setFieldsToUpdate] = useState({
    date: false,
    accountId: false,
    description: false,
    merchant: false,
    category: false,
  });

  const [updatedValues, setUpdatedValues] = useState({
    date: new Date().toISOString().split('T')[0],
    accountId: accounts.length > 0 ? accounts[0].id : '',
    description: '',
    merchant: '',
    category: '',
  });

  if (!isOpen) return null;

  const handleToggle = (field: keyof typeof fieldsToUpdate) => {
    setFieldsToUpdate(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleChange = (field: keyof typeof updatedValues, value: string) => {
    setUpdatedValues(prev => ({ ...prev, [field]: value }));
  };
  
  const allCategories = useMemo(() => [...expenseCategories, ...incomeCategories], [expenseCategories, incomeCategories]);

  const findCategory = (name: string, categories: Category[]): Category | undefined => {
    for (const cat of categories) {
        if (cat.name === name) return cat;
        if (cat.subCategories.length > 0) {
            const found = findCategory(name, cat.subCategories);
            if (found) return found;
        }
    }
    return undefined;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const updatedTransactions = transactionsToEdit.map(tx => {
      const updatedTx = { ...tx };
      
      if (fieldsToUpdate.date) updatedTx.date = updatedValues.date;
      if (fieldsToUpdate.accountId) updatedTx.accountId = updatedValues.accountId;
      if (fieldsToUpdate.description) updatedTx.description = updatedValues.description;
      if (fieldsToUpdate.merchant) updatedTx.merchant = updatedValues.merchant;

      if (fieldsToUpdate.category) {
        updatedTx.category = updatedValues.category;
        const categoryDetails = findCategory(updatedValues.category, allCategories);
        if (categoryDetails) {
          const newType = categoryDetails.classification;
          updatedTx.type = newType;
          updatedTx.amount = newType === 'income' ? Math.abs(updatedTx.amount) : -Math.abs(updatedTx.amount);
        }
      }
      return updatedTx;
    });

    onSave(updatedTransactions);
  };
  
  const CheckboxField: React.FC<{field: keyof typeof fieldsToUpdate, label: string, children: React.ReactNode}> = ({field, label, children}) => (
      <div className="flex items-start gap-4 p-4 rounded-lg transition-colors duration-200 hover:bg-black/5 dark:hover:bg-white/5">
        <div className="pt-2">
            <input 
                type="checkbox"
                id={`cb-${field}`}
                checked={fieldsToUpdate[field]}
                onChange={() => handleToggle(field)}
                className="w-5 h-5 rounded text-primary-500 bg-transparent border-gray-400 focus:ring-primary-500"
            />
        </div>
        <div className="flex-grow">
          <label htmlFor={`cb-${field}`} className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1 cursor-pointer">{label}</label>
          <div className={!fieldsToUpdate[field] ? 'opacity-50 pointer-events-none' : ''}>
            {children}
          </div>
        </div>
      </div>
  );

  return (
    <Modal onClose={onClose} title={`Bulk Edit ${transactionsToEdit.length} Transactions`}>
        <form onSubmit={handleSubmit} className="space-y-2">
            <CheckboxField field="date" label="Change Date">
                <input type="date" value={updatedValues.date} onChange={e => handleChange('date', e.target.value)} className={INPUT_BASE_STYLE} />
            </CheckboxField>
            
            <CheckboxField field="accountId" label="Change Account">
                 <div className={SELECT_WRAPPER_STYLE}>
                    <select value={updatedValues.accountId} onChange={e => handleChange('accountId', e.target.value)} className={INPUT_BASE_STYLE}>
                       {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                    </select>
                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                </div>
            </CheckboxField>
            
             <CheckboxField field="description" label="Change Description">
                <input type="text" value={updatedValues.description} onChange={e => handleChange('description', e.target.value)} className={INPUT_BASE_STYLE} placeholder="Enter new description" />
            </CheckboxField>
            
             <CheckboxField field="merchant" label="Change Merchant">
                <input type="text" value={updatedValues.merchant} onChange={e => handleChange('merchant', e.target.value)} className={INPUT_BASE_STYLE} placeholder="Enter new merchant name" />
            </CheckboxField>
            
            <CheckboxField field="category" label="Change Category">
                <div className={SELECT_WRAPPER_STYLE}>
                    <select value={updatedValues.category} onChange={e => handleChange('category', e.target.value)} className={INPUT_BASE_STYLE} >
                         <option value="" disabled>Select a category</option>
                         <optgroup label="--- EXPENSES ---"></optgroup>
                         <CategoryOptions categories={expenseCategories} />
                         <optgroup label="--- INCOME ---"></optgroup>
                         <CategoryOptions categories={incomeCategories} />
                    </select>
                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                </div>
                 <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">Changing category will also update the transaction type (income/expense) and adjust the amount sign accordingly.</p>
            </CheckboxField>

            <div className="flex justify-end gap-4 pt-4 mt-4 border-t border-black/10 dark:border-white/10">
                <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                <button type="submit" className={BTN_PRIMARY_STYLE}>Apply Changes</button>
            </div>
        </form>
    </Modal>
  );
};

export default BulkEditTransactionsModal;
