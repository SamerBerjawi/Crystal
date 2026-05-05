import React, { useState, useMemo, useRef, useEffect } from 'react';
import Modal from './Modal';
import { Transaction, Account, Category, Tag } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, CHECKBOX_STYLE } from '../constants';
import LocationAutocomplete from './LocationAutocomplete';
import { toLocalISOString } from '../utils';

const RecursiveCategoryOptions: React.FC<{ categories: Category[], level: number }> = ({ categories, level }) => {
    const indent = '\u00A0\u00A0'.repeat(level * 2);
    return (
        <>
            {categories.map(cat => (
                <React.Fragment key={cat.id}>
                    <option className="bg-white dark:bg-gray-900 text-black dark:text-white py-1" value={cat.name}>{indent}{cat.name}</option>
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
    {categories.map(parentCat => (
      <optgroup className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs uppercase tracking-wider h-10" key={parentCat.id} label={parentCat.name}>
        <option className="bg-white dark:bg-gray-900 text-black dark:text-white font-medium py-2" value={parentCat.name}>{parentCat.name}</option>
        {parentCat.subCategories.map(subCat => (
           <RecursiveCategoryOptions key={subCat.id} categories={[subCat]} level={1} />
        ))}
      </optgroup>
    ))}
  </>
);

const CheckboxField: React.FC<{field: string, label: string, isChecked: boolean, onToggle: (f: string) => void, children: React.ReactNode}> = ({field, label, isChecked, onToggle, children}) => (
      <div className={`flex flex-col gap-3 p-4 rounded-xl border transition-all duration-200 ${isChecked ? 'bg-primary-50/50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800/30 shadow-sm' : 'bg-transparent border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10'}`}>
        <div className="flex items-center gap-3">
            <input 
                type="checkbox"
                id={`cb-${field}`}
                checked={isChecked}
                onChange={() => onToggle(field)}
                className={CHECKBOX_STYLE}
            />
            <label htmlFor={`cb-${field}`} className={`text-sm font-semibold cursor-pointer select-none transition-colors ${isChecked ? 'text-primary-700 dark:text-primary-400' : 'text-light-text dark:text-dark-text'}`}>{label}</label>
        </div>
        <div className={`pl-7 transition-opacity duration-200 ${!isChecked ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
          {children}
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
    date: toLocalISOString(new Date()),
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

  const handleToggle = (field: string) => {
    setFieldsToUpdate(prev => ({ ...prev, [field as keyof typeof fieldsToUpdate]: !prev[field as keyof typeof fieldsToUpdate] }));
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
    <Modal onClose={onClose} title={`Bulk Edit ${transactionsToEdit.length} Transactions`} zIndexClass="z-[9999]" size="2xl">
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded-xl flex items-start gap-3 text-sm border border-blue-100 dark:border-blue-800/30">
            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">info</span>
            <div>
                <p className="font-semibold mb-0.5 text-base">Editing {transactionsToEdit.length} selected transaction{transactionsToEdit.length !== 1 ? 's' : ''}</p>
                <p className="opacity-90">Only selected fields will be applied. Empty fields will replace existing data if checked.</p>
            </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
            <CheckboxField field="date" label="Adjust Date" isChecked={fieldsToUpdate.date} onToggle={handleToggle}>
                <div className="relative group">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg group-focus-within:text-primary-500 pointer-events-none">calendar_today</span>
                    <input type="date" value={updatedValues.date} onChange={e => handleChange('date', e.target.value)} className={`${INPUT_BASE_STYLE} pl-10 h-11 [&::-webkit-calendar-picker-indicator]:cursor-pointer`} />
                </div>
            </CheckboxField>
            
            <CheckboxField field="accountId" label="Transfer to Account" isChecked={fieldsToUpdate.accountId} onToggle={handleToggle}>
                 <div className={SELECT_WRAPPER_STYLE}>
                    <select value={updatedValues.accountId} onChange={e => handleChange('accountId', e.target.value)} className={`${INPUT_BASE_STYLE} h-11 pl-4 cursor-pointer`}>
                       {accounts.map(acc => <option className="bg-white dark:bg-gray-900 text-black dark:text-white" key={acc.id} value={acc.id}>{acc.name}</option>)}
                    </select>
                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                </div>
            </CheckboxField>
            
             <CheckboxField field="description" label="Update Memo" isChecked={fieldsToUpdate.description} onToggle={handleToggle}>
                <div className="relative group">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg group-focus-within:text-primary-500 pointer-events-none">description</span>
                    <input type="text" value={updatedValues.description} onChange={e => handleChange('description', e.target.value)} className={`${INPUT_BASE_STYLE} pl-10 h-11`} placeholder="New memo..." />
                </div>
            </CheckboxField>
            
             <CheckboxField field="merchant" label="Update Source" isChecked={fieldsToUpdate.merchant} onToggle={handleToggle}>
                <div className="relative group">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg group-focus-within:text-primary-500 pointer-events-none">store</span>
                    <input type="text" value={updatedValues.merchant} onChange={e => handleChange('merchant', e.target.value)} className={`${INPUT_BASE_STYLE} pl-10 h-11`} placeholder="New merchant or payee..." />
                </div>
            </CheckboxField>
            
            <CheckboxField field="category" label="Categorize As" isChecked={fieldsToUpdate.category} onToggle={handleToggle}>
                <div className={SELECT_WRAPPER_STYLE}>
                    <select value={updatedValues.category} onChange={e => handleChange('category', e.target.value)} className={`${INPUT_BASE_STYLE} h-11 pl-4 cursor-pointer`} >
                         <option className="bg-white dark:bg-gray-900 text-black dark:text-white" value="" disabled>Select a category</option>
                         <optgroup className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-[10px] uppercase tracking-[0.2em] h-10" label="Outgoing"></optgroup>
                         <CategoryOptions categories={expenseCategories} />
                         <optgroup className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-[10px] uppercase tracking-[0.2em] h-10" label="Incoming"></optgroup>
                         <CategoryOptions categories={incomeCategories} />
                    </select>
                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                </div>
                 <div className="flex gap-2.5 items-start mt-4 p-3 rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20">
                     <span className="material-symbols-outlined text-[18px] text-orange-600 dark:text-orange-400 mt-0.5">warning</span>
                     <p className="text-[11px] text-orange-800 dark:text-orange-300 leading-relaxed font-bold uppercase tracking-tight">Type conversion alert: Categorizing as income will flip expense amounts to positive.</p>
                 </div>
            </CheckboxField>
            
            <CheckboxField field="tags" label="Apply Tags" isChecked={fieldsToUpdate.tags} onToggle={handleToggle}>
                <div className="relative" ref={tagSelectorRef}>
                    <div
                        onClick={() => setIsTagSelectorOpen(prev => !prev)}
                        className={`${INPUT_BASE_STYLE} flex items-center flex-wrap gap-1.5 cursor-pointer h-auto min-h-[44px] py-1.5 pl-3 transition-shadow`}
                        tabIndex={0}
                    >
                        {selectedTags.length > 0 ? (
                            selectedTags.map(tag => (
                                <span key={tag.id} className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full border border-black/5 dark:border-white/10 font-bold" style={{ backgroundColor: `${tag.color}25`, color: tag.color }}>
                                    {tag.name}
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); handleTagToggle(tag.id); }}
                                        className="hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5 ml-1 transition-colors"
                                    >
                                        &times;
                                    </button>
                                </span>
                            ))
                        ) : (
                            <span className="text-gray-400 text-sm">Add tags to overwrite...</span>
                        )}
                        <span className="material-symbols-outlined ml-auto text-gray-400 text-lg pr-2 pointer-events-none">label_important</span>
                    </div>
                    {isTagSelectorOpen && (
                        <div className="absolute bottom-full mb-2 left-0 w-full bg-white/95 dark:bg-[#1E1E1E]/95 backdrop-blur-xl rounded-xl shadow-2xl border border-black/10 dark:border-white/10 z-[100] max-h-60 overflow-y-auto p-2">
                            {tags.length > 0 ? tags.map(tag => (
                                <label key={tag.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors group">
                                    <input
                                        type="checkbox"
                                        checked={updatedValues.tagIds.includes(tag.id)}
                                        onChange={() => handleTagToggle(tag.id)}
                                        className={CHECKBOX_STYLE}
                                    />
                                    <div className="flex-1 flex justify-between items-center">
                                       <span className="text-sm font-semibold text-light-text dark:text-dark-text group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors uppercase tracking-tight">{tag.name}</span>
                                       <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: tag.color }} />
                                    </div>
                                </label>
                            )) : (
                              <div className="p-4 text-center text-xs font-bold text-gray-400 uppercase tracking-widest leading-loose">No tags found.<br/>Create one in Settings first.</div>
                            )}
                        </div>
                    )}
                </div>
            </CheckboxField>
            
            <CheckboxField field="location" label="Update Location" isChecked={fieldsToUpdate.location} onToggle={handleToggle}>
                <LocationAutocomplete
                    value={updatedValues.locationString}
                    onChange={(val, data) => {
                        setUpdatedValues(prev => ({
                            ...prev,
                            locationString: val,
                            locationData: data ? {
                                city: data.city,
                                country: data.country,
                                lat: data.lat,
                                lon: data.lon
                            } : {}
                        }));
                    }}
                />
            </CheckboxField>

            <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-black/5 dark:border-white/5 bg-light-card dark:bg-dark-card">
                <button type="button" onClick={onClose} className={`${BTN_SECONDARY_STYLE} h-11`}>Discard Changes</button>
                <button type="submit" className={`${BTN_PRIMARY_STYLE} h-11 px-8`}>Update {transactionsToEdit.length} Records</button>
            </div>
        </form>
    </Modal>
  );
};

export default BulkEditTransactionsModal;