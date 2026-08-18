import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Transaction, Account, Category, Tag } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, CHECKBOX_STYLE } from '../constants';
import AddressAutocomplete from './AddressAutocomplete';
import { toLocalISOString } from '../utils';
import Icon from './ui/Icon';

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
      <optgroup className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs tracking-wider h-10" key={parentCat.id} label={parentCat.name}>
        <option className="bg-white dark:bg-gray-900 text-black dark:text-white font-medium py-2" value={parentCat.name}>{parentCat.name}</option>
        {parentCat.subCategories.map(subCat => (
           <RecursiveCategoryOptions key={subCat.id} categories={[subCat]} level={1} />
        ))}
      </optgroup>
    ))}
  </>
);

const CheckboxField: React.FC<{field: string, label: string, isChecked: boolean, onToggle: (f: string) => void, children: React.ReactNode}> = ({field, label, isChecked, onToggle, children}) => (
  <div className={`flex flex-col gap-3 p-4 rounded-2xl border transition-all duration-200 ${isChecked ? 'bg-primary-50/50 dark:bg-primary-900/10 border-primary-300 dark:border-primary-800/40 shadow-sm' : 'bg-black/[0.02] dark:bg-white/[0.02] border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10'}`}>
    <div className="flex items-center gap-3">
        <input 
            type="checkbox"
            id={`cb-${field}`}
            checked={isChecked}
            onChange={() => onToggle(field)}
            className={CHECKBOX_STYLE}
        />
        <label htmlFor={`cb-${field}`} className={`text-xs font-bold uppercase tracking-wider cursor-pointer select-none transition-colors ${isChecked ? 'text-primary-600 dark:text-primary-400' : 'text-light-text dark:text-dark-text'}`}>{label}</label>
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
    locationData: {} as {
        address?: string;
        placeName?: string;
        street?: string;
        city?: string;
        postalCode?: string;
        state?: string;
        country?: string;
        lat?: number;
        lon?: number;
        locationLabel?: string;
    },
  });

  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const tagSelectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setIsVisible(true), 20);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagSelectorRef.current && !tagSelectorRef.current.contains(event.target as Node)) {
        setIsTagSelectorOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 250);
  };

  if (!isOpen && !isVisible) return null;

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
  
  const selectedTags = updatedValues.tagIds.map(id => tags.find(t => t.id === id)).filter(Boolean) as Tag[];
  const allCategories = [...expenseCategories, ...incomeCategories];

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
        const hasLoc = Boolean(updatedValues.locationString?.trim());
        updatedTx.address = hasLoc ? (updatedValues.locationData?.address || updatedValues.locationString.trim()) : undefined;
        updatedTx.placeName = hasLoc ? updatedValues.locationData?.placeName : undefined;
        updatedTx.street = hasLoc ? updatedValues.locationData?.street : undefined;
        updatedTx.city = hasLoc ? (updatedValues.locationData?.city || updatedValues.locationString.trim()) : undefined;
        updatedTx.postalCode = hasLoc ? updatedValues.locationData?.postalCode : undefined;
        updatedTx.state = hasLoc ? updatedValues.locationData?.state : undefined;
        updatedTx.country = hasLoc ? updatedValues.locationData?.country : undefined;
        updatedTx.latitude = hasLoc ? updatedValues.locationData?.lat : undefined;
        updatedTx.longitude = hasLoc ? updatedValues.locationData?.lon : undefined;
        updatedTx.locationLabel = hasLoc ? updatedValues.locationData?.locationLabel : undefined;
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
    handleClose();
  };

  const content = (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Sidebar Drawer */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div 
          className={`w-screen max-w-xl bg-light-card dark:bg-dark-card shadow-2xl border-l border-black/10 dark:border-white/10 flex flex-col transform transition-transform duration-300 ease-out ${
            isVisible ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Header */}
          <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-primary-500/5 to-transparent">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0 border border-primary-500/20 shadow-xs">
                <Icon name="tune" className="text-2xl" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight truncate">
                  Bulk Edit Transactions
                </h2>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5 font-medium">
                  Modifying {transactionsToEdit.length} selected record{transactionsToEdit.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button 
              onClick={handleClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
              aria-label="Close drawer"
            >
              <Icon name="close" className="text-lg" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">

              <div className="p-4 bg-blue-500/10 text-blue-800 dark:text-blue-200 rounded-2xl flex items-start gap-3 text-xs border border-blue-500/20">
                <Icon name="info" className="text-blue-600 dark:text-blue-400 text-base shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold mb-0.5 text-sm">Targeting {transactionsToEdit.length} items</p>
                  <p className="opacity-80">Only checked fields below will be updated. Unchecked fields will remain untouched.</p>
                </div>
              </div>

              <CheckboxField field="date" label="Adjust Date" isChecked={fieldsToUpdate.date} onToggle={handleToggle}>
                <div className="relative group">
                  <Icon name="calendar_today" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base group-focus-within:text-primary-500 pointer-events-none" />
                  <input type="date" value={updatedValues.date} onChange={e => handleChange('date', e.target.value)} className={`${INPUT_BASE_STYLE} pl-10 h-11`} />
                </div>
              </CheckboxField>
              
              <CheckboxField field="accountId" label="Transfer to Account" isChecked={fieldsToUpdate.accountId} onToggle={handleToggle}>
                <div className={SELECT_WRAPPER_STYLE}>
                  <select value={updatedValues.accountId} onChange={e => handleChange('accountId', e.target.value)} className={`${SELECT_STYLE} h-11 pl-4 cursor-pointer font-bold`}>
                    {accounts.map(acc => <option className="bg-white dark:bg-gray-900 text-black dark:text-white" key={acc.id} value={acc.id}>{acc.name}</option>)}
                  </select>
                  <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                </div>
              </CheckboxField>
              
              <CheckboxField field="description" label="Update Memo / Description" isChecked={fieldsToUpdate.description} onToggle={handleToggle}>
                <div className="relative group">
                  <Icon name="description" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base group-focus-within:text-primary-500 pointer-events-none" />
                  <input type="text" value={updatedValues.description} onChange={e => handleChange('description', e.target.value)} className={`${INPUT_BASE_STYLE} pl-10 h-11`} placeholder="New memo..." />
                </div>
              </CheckboxField>
              
              <CheckboxField field="merchant" label="Update Merchant" isChecked={fieldsToUpdate.merchant} onToggle={handleToggle}>
                <div className="relative group">
                  <Icon name="store" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base group-focus-within:text-primary-500 pointer-events-none" />
                  <input type="text" value={updatedValues.merchant} onChange={e => handleChange('merchant', e.target.value)} className={`${INPUT_BASE_STYLE} pl-10 h-11`} placeholder="New merchant or payee..." />
                </div>
              </CheckboxField>
              
              <CheckboxField field="category" label="Re-categorize" isChecked={fieldsToUpdate.category} onToggle={handleToggle}>
                <div className={SELECT_WRAPPER_STYLE}>
                  <select value={updatedValues.category} onChange={e => handleChange('category', e.target.value)} className={`${SELECT_STYLE} h-11 pl-4 cursor-pointer font-bold`}>
                    <option className="bg-white dark:bg-gray-900 text-black dark:text-white" value="" disabled>Select a category</option>
                    <optgroup className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold text-xs uppercase tracking-wider h-10" label="Outgoing"></optgroup>
                    <CategoryOptions categories={expenseCategories} />
                    <optgroup className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold text-xs uppercase tracking-wider h-10" label="Incoming"></optgroup>
                    <CategoryOptions categories={incomeCategories} />
                  </select>
                  <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                </div>
                <div className="flex gap-2 items-start mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 font-semibold">
                  <Icon name="warning" className="text-amber-600 dark:text-amber-400 text-sm mt-0.5 shrink-0" />
                  <p>Categorizing as income will normalize transaction sign to positive.</p>
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
                        <span key={tag.id} className="flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full border border-black/5 dark:border-white/10 font-semibold" style={{ backgroundColor: `${tag.color}25`, color: tag.color }}>
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
                      <span className="text-gray-400 text-xs">Add tags to overwrite...</span>
                    )}
                    <Icon name="label_important" className="ml-auto text-gray-400 text-base pr-1 pointer-events-none" />
                  </div>
                  {isTagSelectorOpen && (
                    <div className="absolute bottom-full mb-2 left-0 w-full bg-white/95 dark:bg-[#1E1E1E]/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 z-[100] max-h-60 overflow-y-auto p-2">
                      {tags.length > 0 ? tags.map(tag => (
                        <label key={tag.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors group">
                          <input
                            type="checkbox"
                            checked={updatedValues.tagIds.includes(tag.id)}
                            onChange={() => handleTagToggle(tag.id)}
                            className={CHECKBOX_STYLE}
                          />
                          <div className="flex-1 flex justify-between items-center">
                            <span className="text-xs font-bold text-light-text dark:text-dark-text group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{tag.name}</span>
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                          </div>
                        </label>
                      )) : (
                        <div className="p-4 text-center text-xs font-semibold text-gray-400">No tags configured.</div>
                      )}
                    </div>
                  )}
                </div>
              </CheckboxField>
              
              <CheckboxField field="location" label="Update Location" isChecked={fieldsToUpdate.location} onToggle={handleToggle}>
                <div>
                  <AddressAutocomplete
                    value={updatedValues.locationString}
                    onChange={(val, data) => {
                      setUpdatedValues(prev => ({
                        ...prev,
                        locationString: val,
                        locationData: data ? {
                          address: data.formattedAddress,
                          placeName: data.placeName,
                          street: data.street,
                          city: data.city,
                          postalCode: data.postalCode,
                          state: data.state,
                          country: data.country,
                          lat: data.lat,
                          lon: data.lon,
                          locationLabel: data.placeName || data.title
                        } : (val.trim() ? { city: val.trim() } : {})
                      }));
                    }}
                    placeholder="Search address or business"
                  />
                  <p className="text-2xs text-light-text-secondary dark:text-dark-text-secondary mt-1 pl-1 opacity-70">
                    Leave blank to wipe location metadata from all selected transactions.
                  </p>
                </div>
              </CheckboxField>

            </div>

            {/* Sticky Bottom Actions */}
            <div className="p-6 border-t border-black/5 dark:border-white/5 bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-md flex items-center justify-between gap-3">
              <button 
                type="button" 
                onClick={handleClose} 
                className={`${BTN_SECONDARY_STYLE} h-12 px-6 text-xs font-bold uppercase tracking-wider`}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className={`${BTN_PRIMARY_STYLE} h-12 px-8 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-primary-500/20 active:scale-95`}
              >
                <span>Update {transactionsToEdit.length} Records</span>
                <Icon name="check" className="text-base" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default BulkEditTransactionsModal;