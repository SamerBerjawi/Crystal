
import React, { useState, useMemo, useRef, useEffect } from 'react';
import Modal from './Modal';
import { Transaction, Account, Category, Tag } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, CHECKBOX_STYLE } from '../constants';
import LocationAutocomplete from './LocationAutocomplete';

const RecursiveCategoryOptions: React.FC<{ categories: Category[], level: number }> = ({ categories, level }) => {
    const indent = '\u00A0\u00A0'.repeat(level * 2);
    return (
        <>
            {categories.map(cat => (
                <React.Fragment key={cat.id}>
                    <option value={cat.name}>{indent}{cat.name}</option>
                    {cat.subCategories && cat.subCategories.length > 0 && (
                        <RecursiveCategoryOptions categories={cat.subCategories} level={level + 1} />
                    )}
                </React.Fragment>
            ))}
        </>
    );
};

const CategoryOptions: React.FC<{ categories: Category[] }> = ({ categories }) => (
  <>
    <option value="">Select a category</option>
    {categories.map(parentCat => (
      <optgroup key={parentCat.id} label={parentCat.name}>
        <option value={parentCat.name}>{parentCat.name}</option>
        {parentCat.subCategories.map(subCat => (
           <RecursiveCategoryOptions key={subCat.id} categories={[subCat]} level={1} />
        ))}
      </optgroup>
    ))}
  </>
);

interface CheckboxFieldProps {
  field: string;
  label: string;
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}

const CheckboxField: React.FC<CheckboxFieldProps> = ({field, label, checked, onChange, children}) => (
    <div className="flex items-start gap-4 p-4 rounded-lg transition-colors duration-200 hover:bg-black/5 dark:hover:bg-white/5">
      <div className="pt-2">
          <input 
              type="checkbox"
              id={`cb-${field}`}
              checked={checked}
              onChange={onChange}
              className={CHECKBOX_STYLE}
          />
      </div>
      <div className="flex-grow">
        <label htmlFor={`cb-${field}`} className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1 cursor-pointer">{label}</label>
        <div className={!checked ? 'opacity-50 pointer-events-none' : ''}>
          {children}
        </div>
      </div>
    </div>
);

interface BulkEditTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedTransactions: Transaction[]) => void;
  transactionsToEdit: Transaction[];
  accounts: Account[];
  incomeCategories: Category[];
  expenseCategories: Category[];
  tags: Tag[];
}

const BulkEditTransactionsModal: React.FC<BulkEditTransactionsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  transactionsToEdit,
  accounts,
  incomeCategories,
  expenseCategories,
  tags,
}) => {
  const [fieldsToUpdate, setFieldsToUpdate] = useState({
    date: false,
    accountId: false,
    description: false,
    merchant: false,
    category: false,
    tags: false,
    location: false,
  });

  const [updatedValues, setUpdatedValues] = useState({
    date: new Date().toISOString().split('T')[0],
    accountId: accounts.length > 0 ? accounts[0].id : '',
    description: '',
    merchant: '',
    category: '',
    tagIds: [] as string[],
    locationString: '',
    locationData: {} as {city?: string, country?: string, lat?: number, lon?: number},
  });

  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const tagSelectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagSelectorRef.current && !tagSelectorRef.current.contains(event.target as Node)) {
        setIsTagSelectorOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const handleToggle = (field: keyof typeof fieldsToUpdate) => {
    setFieldsToUpdate(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleChange = (field: keyof Omit<typeof updatedValues, 'tagIds' | 'locationString' | 'locationData'>, value: string) => {
    setUpdatedValues(prev => ({ ...prev, [field]: value }));
  };

  const handleTagToggle = (tagId: string) => {
    setUpdatedValues(prev => ({
        ...prev,
        tagIds: prev.tagIds.includes(tagId) ? prev.tagIds.filter(id => id !== tagId) : [...prev.tagIds, tagId]
    }));
  };
  
  const selectedTags = useMemo(() => {
    return updatedValues.tagIds.map(id => tags.find(t => t.id === id)).filter(Boolean) as Tag[];
  }, [updatedValues.tagIds, tags]);
  
  const allCategories = useMemo(() => [...expenseCategories, ...incomeCategories], [expenseCategories, incomeCategories]);

  const findCategory = (name: string, categories: Category[]): Category | undefined => {
    for (const cat of categories) {
        if (cat.name === name) return cat;
        if (cat.subCategories && cat.subCategories.length > 0) {
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
      if (fieldsToUpdate.tags) updatedTx.tagIds = updatedValues.tagIds;
      if (fieldsToUpdate.location) {
        updatedTx.city = updatedValues.locationData.city;
        updatedTx.country = updatedValues.locationData.country;
        updatedTx.latitude = updatedValues.locationData.lat;
        updatedTx.longitude = updatedValues.locationData.lon;
      }

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
  
  return (
    <Modal onClose={onClose} title={`Bulk Edit ${transactionsToEdit.length} Transactions`}>
        <form onSubmit={handleSubmit} className="space-y-2">
            <CheckboxField field="date" label="Change Date" checked={fieldsToUpdate.date} onChange={() => handleToggle('date')}>
                <input type="date" value={updatedValues.date} onChange={e => handleChange('date', e.target.value)} className={INPUT_BASE_STYLE} />
            </CheckboxField>
            
            <CheckboxField field="accountId" label="Change Account" checked={fieldsToUpdate.accountId} onChange={() => handleToggle('accountId')}>
                 <div className={SELECT_WRAPPER_STYLE}>
                    <select value={updatedValues.accountId} onChange={e => handleChange('accountId', e.target.value)} className={INPUT_BASE_STYLE}>
                       {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                    </select>
                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                </div>
            </CheckboxField>
            
             <CheckboxField field="description" label="Change Description" checked={fieldsToUpdate.description} onChange={() => handleToggle('description')}>
                <input type="text" value={updatedValues.description} onChange={e => handleChange('description', e.target.value)} className={INPUT_BASE_STYLE} placeholder="Enter new description" />
            </CheckboxField>
            
             <CheckboxField field="merchant" label="Change Merchant" checked={fieldsToUpdate.merchant} onChange={() => handleToggle('merchant')}>
                <input type="text" value={updatedValues.merchant} onChange={e => handleChange('merchant', e.target.value)} className={INPUT_BASE_STYLE} placeholder="Enter new merchant name" />
            </CheckboxField>
            
            <CheckboxField field="category" label="Change Category" checked={fieldsToUpdate.category} onChange={() => handleToggle('category')}>
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
            
            <CheckboxField field="tags" label="Change Tags" checked={fieldsToUpdate.tags} onChange={() => handleToggle('tags')}>
                <div className="relative" ref={tagSelectorRef}>
                    <div
                        onClick={() => setIsTagSelectorOpen(prev => !prev)}
                        className={`${INPUT_BASE_STYLE} flex items-center flex-wrap gap-1 cursor-pointer h-auto min-h-10 py-1.5`}
                    >
                        {selectedTags.length > 0 ? (
                            selectedTags.map(tag => (
                                <span key={tag.id} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${tag.color}30`, color: tag.color }}>
                                    {tag.name}
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); handleTagToggle(tag.id); }}
                                        className="text-xs hover:text-black dark:hover:text-white"
                                    >
                                        &times;
                                    </button>
                                </span>
                            ))
                        ) : (
                            <span className="text-light-text-secondary dark:text-dark-text-secondary px-1">Select tags to apply...</span>
                        )}
                    </div>
                    {isTagSelectorOpen && (
                        <div className="absolute top-full left-0 mt-1 w-full bg-light-card dark:bg-dark-card rounded-lg shadow-lg border border-black/10 dark:border-white/10 z-10 max-h-48 overflow-y-auto">
                            {tags.length > 0 ? tags.map(tag => (
                                <label key={tag.id} className="flex items-center gap-3 p-2 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={updatedValues.tagIds.includes(tag.id)}
                                        onChange={() => handleTagToggle(tag.id)}
                                        className={CHECKBOX_STYLE}
                                    />
                                    <span className="text-sm font-medium">{tag.name}</span>
                                </label>
                            )) : (
                              <div className="p-4 text-center text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                No tags created yet.
                              </div>
                            )}
                        </div>
                    )}
                </div>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">This will replace all existing tags on the selected transactions.</p>
            </CheckboxField>
            
            <CheckboxField field="location" label="Change Location" checked={fieldsToUpdate.location} onChange={() => handleToggle('location')}>
                <LocationAutocomplete
                    value={updatedValues.locationString}
                    onChange={(val, data) => {
                        setUpdatedValues(prev => ({
                            ...prev,
                            locationString: val,
                            locationData: data || {}
                        }));
                    }}
                />
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">This will replace any existing location on the selected transactions.</p>
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
