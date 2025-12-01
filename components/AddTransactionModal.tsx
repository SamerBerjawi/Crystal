
import React, { useState, useMemo, useEffect, useRef } from 'react';
import Modal from './Modal';
import { Account, Category, Transaction, Tag } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, CHECKBOX_STYLE, ALL_ACCOUNT_TYPES } from '../constants';
import { v4 as uuidv4 } from 'uuid';
import LocationAutocomplete from './LocationAutocomplete';
import { toLocalISOString } from '../utils';

interface AddTransactionModalProps {
  onClose: () => void;
  onSave: (transactionsToSave: (Omit<Transaction, 'id'> & { id?: string })[], idsToDelete: string[]) => void;
  accounts: Account[];
  incomeCategories: Category[];
  expenseCategories: Category[];
  transactions?: Transaction[];
  transactionToEdit?: Transaction | null;
  initialType?: 'expense' | 'income' | 'transfer';
  initialFromAccountId?: string;
  initialToAccountId?: string;
  initialCategory?: string;
  tags: Tag[];
  initialDetails?: {
    date?: string;
    amount?: string;
    principal?: string;
    interest?: string;
    description?: string;
  };
}

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

// Helper to group accounts by type
const AccountOptions: React.FC<{ accounts: Account[] }> = ({ accounts }) => {
  const groupedAccounts = useMemo(() => {
    const groups: Record<string, Account[]> = {};
    accounts.forEach(acc => {
      if (!groups[acc.type]) groups[acc.type] = [];
      groups[acc.type].push(acc);
    });
    return groups;
  }, [accounts]);

  return (
    <>
      {ALL_ACCOUNT_TYPES.map(type => {
        const group = groupedAccounts[type];
        if (!group || group.length === 0) return null;
        return (
          <optgroup key={type} label={type}>
            {group.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </optgroup>
        );
      })}
    </>
  );
};


const AddTransactionModal: React.FC<AddTransactionModalProps> = ({ onClose, onSave, accounts, incomeCategories, expenseCategories, transactions, transactionToEdit, initialType, initialFromAccountId, initialToAccountId, initialCategory, tags, initialDetails }) => {
  const isEditing = !!transactionToEdit;

  const defaultAccountId = useMemo(() => {
    const primary = accounts.find(a => a.isPrimary);
    return primary ? primary.id : (accounts.length > 0 ? accounts[0].id : '');
  }, [accounts]);
  
  const [type, setType] = useState<'expense' | 'income' | 'transfer'>(isEditing ? (transactionToEdit.transferId ? 'transfer' : transactionToEdit.type) : (initialType || 'expense'));
  const [date, setDate] = useState(toLocalISOString(new Date()));
  const [fromAccountId, setFromAccountId] = useState(initialFromAccountId || defaultAccountId);
  const [toAccountId, setToAccountId] = useState(initialToAccountId || defaultAccountId);
  const [description, setDescription] = useState('');
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const tagSelectorRef = useRef<HTMLDivElement>(null);
  
  // Location fields
  const [locationString, setLocationString] = useState('');
  const [locationData, setLocationData] = useState<{city?: string, country?: string, lat?: number, lon?: number}>({});


  // Loan payment split state
  const [principalPayment, setPrincipalPayment] = useState('');
  const [interestPayment, setInterestPayment] = useState('');

  const isLoanPayment = useMemo(() => {
    const targetAccountId = type === 'income' ? toAccountId : (type === 'transfer' ? toAccountId : null);
    if (!targetAccountId) return false;
    const targetAccount = accounts.find(a => a.id === targetAccountId);
    return targetAccount?.type === 'Loan';
  }, [type, toAccountId, accounts]);

  // Auto-calculate principal and interest for loan payments
  useEffect(() => {
    const targetAccount = accounts.find(a => a.id === toAccountId);
    const isPaymentToLoan = (type === 'income' || type === 'transfer') && targetAccount?.type === 'Loan';

    // Only calculate if it's a loan payment, rate is defined, and amount is a positive number
    if (isPaymentToLoan && targetAccount.interestRate && parseFloat(amount) > 0) {
        const totalPayment = parseFloat(amount);
        // Loan balance is negative, so we take its absolute value
        const outstandingPrincipal = Math.abs(targetAccount.balance); 
        const monthlyInterestRate = (targetAccount.interestRate / 100) / 12;
        
        const calculatedInterest = parseFloat((outstandingPrincipal * monthlyInterestRate).toFixed(2));
        
        // The interest portion cannot be more than the total payment itself.
        const interest = Math.min(totalPayment, calculatedInterest);
        const principal = totalPayment - interest;

        setPrincipalPayment(principal.toFixed(2));
        setInterestPayment(interest.toFixed(2));
    } else {
        // If it's not a loan payment or there's not enough info, clear the fields.
        setPrincipalPayment('');
        setInterestPayment('');
    }
  }, [amount, toAccountId, type, accounts]);
  
  const handlePrincipalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPrincipalValue = e.target.value;
    const totalPayment = parseFloat(amount) || 0;
    let newPrincipal = parseFloat(newPrincipalValue) || 0;

    if (newPrincipal > totalPayment) newPrincipal = totalPayment;
    if (newPrincipal < 0) newPrincipal = 0;

    setPrincipalPayment(String(newPrincipal));
    
    const newInterest = totalPayment - newPrincipal;
    setInterestPayment(newInterest.toFixed(2));
  };

  const handleInterestChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newInterestValue = e.target.value;
    const totalPayment = parseFloat(amount) || 0;
    let newInterest = parseFloat(newInterestValue) || 0;

    if (newInterest > totalPayment) newInterest = totalPayment;
    if (newInterest < 0) newInterest = 0;

    setInterestPayment(String(newInterest));

    const newPrincipal = totalPayment - newInterest;
    setPrincipalPayment(newPrincipal.toFixed(2));
  };


  useEffect(() => {
    if (isEditing && transactionToEdit) {
        let principal = '';
        let interest = '';
        let amountToSet = String(Math.abs(transactionToEdit.amount));
        setTagIds(transactionToEdit.tagIds || []);
        
        // Load location
        if (transactionToEdit.city && transactionToEdit.country) {
            setLocationString(`${transactionToEdit.city}, ${transactionToEdit.country}`);
            setLocationData({
                city: transactionToEdit.city,
                country: transactionToEdit.country,
                lat: transactionToEdit.latitude,
                lon: transactionToEdit.longitude
            });
        }

        if (transactionToEdit.transferId && transactions) {
            setType('transfer');
            const counterpart = transactions.find(t => t.transferId === transactionToEdit.transferId && t.id !== transactionToEdit.id);
            if (counterpart) {
                const expensePart = transactionToEdit.type === 'expense' ? transactionToEdit : counterpart;
                const incomePart = transactionToEdit.type === 'income' ? transactionToEdit : counterpart;
                setFromAccountId(expensePart.accountId);
                setToAccountId(incomePart.accountId);
                // The income part of the transfer holds the principal/interest info for a loan payment
                principal = String(incomePart.principalAmount || '');
                interest = String(incomePart.interestAmount || '');
                amountToSet = String(Math.abs(incomePart.amount)); // Use amount from income part for consistency
            }
            const baseDescription = transactionToEdit.description.replace(/Transfer to .*|Transfer from .*/, 'Account Transfer');
            setDescription(baseDescription);
            setMerchant(transactionToEdit.merchant || 'Internal Transfer');
        } else {
            // This is a regular income/expense transaction
            setType(transactionToEdit.type);
            if (transactionToEdit.type === 'income') {
                setToAccountId(transactionToEdit.accountId);
                setFromAccountId(defaultAccountId);
            } else {
                setFromAccountId(transactionToEdit.accountId);
                setToAccountId(defaultAccountId);
            }
            setDescription(transactionToEdit.description);
            setCategory(transactionToEdit.category);
            setMerchant(transactionToEdit.merchant || '');
            principal = String(transactionToEdit.principalAmount || '');
            interest = String(transactionToEdit.interestAmount || '');
        }
        
        setDate(transactionToEdit.date);
        setAmount(amountToSet);
        setPrincipalPayment(principal);
        setInterestPayment(interest);

    } else {
        // Reset for new transaction
        setType(initialType || 'expense');
        setDate(initialDetails?.date || toLocalISOString(new Date()));
        setFromAccountId(initialFromAccountId || defaultAccountId);
        setToAccountId(initialToAccountId || defaultAccountId);
        setDescription(initialDetails?.description || '');
        setMerchant('');
        setAmount(initialDetails?.amount || '');
        setCategory(initialCategory || '');
        setPrincipalPayment(initialDetails?.principal || '');
        setInterestPayment(initialDetails?.interest || '');
        setTagIds([]);
        setLocationString('');
        setLocationData({});
    }
  }, [transactionToEdit, isEditing, accounts, transactions, initialType, initialFromAccountId, initialToAccountId, initialDetails, defaultAccountId, initialCategory]);
  
  const availableAccounts = useMemo(() => {
    return accounts.filter(acc => acc.status !== 'closed' || acc.id === fromAccountId || acc.id === toAccountId);
  }, [accounts, fromAccountId, toAccountId]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagSelectorRef.current && !tagSelectorRef.current.contains(event.target as Node)) {
        setIsTagSelectorOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTagToggle = (tagId: string) => {
    setTagIds(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]);
  };
  
  const selectedTags = useMemo(() => {
    return tagIds.map(id => tags.find(t => t.id === id)).filter(Boolean) as Tag[];
  }, [tagIds, tags]);

  const activeCategories = useMemo(() => {
    return type === 'income' ? incomeCategories : expenseCategories;
  }, [type, incomeCategories, expenseCategories]);
  
  useEffect(() => {
    if (!isEditing) {
        setCategory(initialCategory || '');
    }
  }, [type, isEditing, initialCategory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let toSave: (Omit<Transaction, 'id'> & { id?: string })[] = [];
    let toDelete: string[] = [];

    const totalAmount = isLoanPayment 
      ? (parseFloat(principalPayment) || 0) + (parseFloat(interestPayment) || 0) 
      : (parseFloat(amount) || 0);
      
    if (!totalAmount) return;

    const wasTransfer = isEditing && !!transactionToEdit.transferId;
    const isNowTransfer = type === 'transfer';

    // Determine what to delete if a conversion is happening
    if (isEditing) {
        if (wasTransfer && !isNowTransfer) { // From Transfer -> Income/Expense
            const counterpart = transactions?.find(t => t.transferId === transactionToEdit.transferId && t.id !== transactionToEdit.id);
            toDelete.push(transactionToEdit.id);
            if (counterpart) toDelete.push(counterpart.id);
        } else if (!wasTransfer && isNowTransfer) { // From Income/Expense -> Transfer
            toDelete.push(transactionToEdit.id);
        }
    }

    // Construct location data to mix in
    const locationProps = {
        city: locationData.city,
        country: locationData.country,
        latitude: locationData.lat,
        longitude: locationData.lon,
    };


    // Determine what to save
    if (isNowTransfer) {
        if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) {
            alert("Please select two different accounts for the transfer.");
            return;
        }
        const fromAcc = accounts.find(acc => acc.id === fromAccountId);
        const toAcc = accounts.find(acc => acc.id === toAccountId);
        if (!fromAcc || !toAcc) return;

        const transferId = (isEditing && wasTransfer) ? transactionToEdit.transferId : `xfer-${uuidv4()}`;
        
        const expenseTx: Omit<Transaction, 'id'> & { id?: string } = {
            accountId: fromAccountId,
            date,
            description: description || `Transfer to ${toAcc.name}`,
            merchant: merchant || 'Internal Transfer',
            amount: -Math.abs(totalAmount),
            category: 'Transfer',
            type: 'expense',
            currency: fromAcc.currency,
            transferId,
            tagIds,
            ...locationProps
        };

        const incomeTx: Omit<Transaction, 'id'> & { id?: string } = {
            accountId: toAccountId,
            date,
            description: description || `Transfer from ${fromAcc.name}`,
            merchant: merchant || 'Internal Transfer',
            amount: Math.abs(totalAmount),
            category: 'Transfer',
            type: 'income',
            currency: toAcc.currency,
            transferId,
            tagIds,
            ...locationProps
        };
        
        // If it's a loan payment transfer, add the split
        if (isLoanPayment) {
            incomeTx.principalAmount = parseFloat(principalPayment) || 0;
            incomeTx.interestAmount = parseFloat(interestPayment) || 0;
        }

        // If not converting, we are updating, so keep original IDs
        if (isEditing && wasTransfer) {
            const originalExpense = transactions!.find(t => t.transferId === transferId && t.type === 'expense');
            const originalIncome = transactions!.find(t => t.transferId === transferId && t.type === 'income');
            expenseTx.id = originalExpense?.id;
            incomeTx.id = originalIncome?.id;
        }

        toSave.push(expenseTx, incomeTx);
    } else { // Saving as Income or Expense
        const accountId = type === 'income' ? toAccountId : fromAccountId;
        if (!accountId || !category) {
            alert("Please fill out all required fields.");
            return;
        }
        const selectedAccount = accounts.find(acc => acc.id === accountId);
        if (!selectedAccount) return;

        const transactionData: Omit<Transaction, 'id'> & { id?: string } = {
            accountId,
            date,
            description,
            merchant,
            amount: type === 'expense' ? -Math.abs(totalAmount) : Math.abs(totalAmount),
            category,
            type,
            currency: selectedAccount.currency,
            tagIds,
            ...locationProps
        };
        
        if (isLoanPayment) {
            transactionData.principalAmount = parseFloat(principalPayment) || 0;
            transactionData.interestAmount = parseFloat(interestPayment) || 0;
        }

        // If regular edit (not converting), keep the ID for update
        if (isEditing && !wasTransfer) {
            transactionData.id = transactionToEdit.id;
        }

        toSave.push(transactionData);
    }
    
    onSave(toSave, toDelete);
  };

  const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";
  const typeFilterOptions: { label: string; value: 'expense' | 'income' | 'transfer' }[] = [
    { label: 'Expense', value: 'expense' },
    { label: 'Income', value: 'income' },
    { label: 'Transfer', value: 'transfer' },
  ];

  const modalTitle = isEditing ? 'Edit Transaction' : 'Add New Transaction';
  const saveButtonText = isEditing ? 'Save Changes' : 'Add Transaction';
  
  return (
    <Modal onClose={onClose} title={modalTitle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        
        <div>
            <label className={labelStyle}>Type</label>
            <div className="flex bg-light-bg dark:bg-dark-bg p-1 rounded-lg shadow-neu-inset-light dark:shadow-neu-inset-dark h-10 items-center">
                {typeFilterOptions.map(opt => (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => setType(opt.value)}
                        className={`w-full text-center text-sm font-semibold py-1.5 px-3 rounded-md transition-all duration-200 ${
                            type === opt.value
                            ? 'bg-light-card dark:bg-dark-card shadow-neu-raised-light dark:shadow-neu-raised-dark'
                            : 'text-light-text-secondary dark:text-dark-text-secondary'
                        }`}
                        aria-pressed={type === opt.value}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
        
        {type === 'transfer' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                  <label htmlFor="tx-from-account" className={labelStyle}>From</label>
                  <div className={SELECT_WRAPPER_STYLE}>
                    <select id="tx-from-account" value={fromAccountId} onChange={e => setFromAccountId(e.target.value)} className={INPUT_BASE_STYLE} required>
                      <AccountOptions accounts={availableAccounts.filter(a => a.id !== toAccountId)} />
                    </select>
                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                  </div>
              </div>
              <div>
                  <label htmlFor="tx-to-account" className={labelStyle}>To</label>
                   <div className={SELECT_WRAPPER_STYLE}>
                    <select id="tx-to-account" value={toAccountId} onChange={e => setToAccountId(e.target.value)} className={INPUT_BASE_STYLE} required>
                      <AccountOptions accounts={availableAccounts.filter(a => a.id !== fromAccountId)} />
                    </select>
                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                  </div>
              </div>
          </div>
        ) : (
            <div>
              <label htmlFor="tx-account" className={labelStyle}>{type === 'income' ? 'To Account' : 'From Account'}</label>
              <div className={SELECT_WRAPPER_STYLE}>
                <select id="tx-account" value={type === 'income' ? toAccountId : fromAccountId} onChange={e => type === 'income' ? setToAccountId(e.target.value) : setFromAccountId(e.target.value)} className={INPUT_BASE_STYLE} required>
                  <option value="" disabled>Select an account</option>
                  <AccountOptions accounts={availableAccounts} />
                </select>
                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
              </div>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="tx-amount" className={labelStyle}>{isLoanPayment ? 'Total Payment' : 'Amount'}</label>
              <input id="tx-amount" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className={INPUT_BASE_STYLE} placeholder="0.00" required />
            </div>
             <div>
              <label htmlFor="tx-date" className={labelStyle}>Date</label>
              <input id="tx-date" type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT_BASE_STYLE} required />
            </div>
        </div>
        
        {isLoanPayment && (
            <div className="p-4 bg-black/5 dark:bg-white/5 rounded-lg space-y-2">
                <p className="font-medium text-sm">Loan Payment Breakdown</p>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary -mt-1 mb-2">Principal and interest are calculated automatically but can be manually adjusted.</p>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="principal-payment" className={labelStyle}>Principal</label>
                        <input id="principal-payment" type="number" step="0.01" value={principalPayment} onChange={handlePrincipalChange} className={INPUT_BASE_STYLE} placeholder="0.00" />
                    </div>
                    <div>
                        <label htmlFor="interest-payment" className={labelStyle}>Interest</label>
                        <input id="interest-payment" type="number" step="0.01" value={interestPayment} onChange={handleInterestChange} className={INPUT_BASE_STYLE} placeholder="0.00" />
                    </div>
                </div>
            </div>
        )}

        {type !== 'transfer' && (
            <div>
              <label htmlFor="tx-merchant" className={labelStyle}>Merchant (Optional)</label>
              <input id="tx-merchant" type="text" value={merchant} onChange={e => setMerchant(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g., Amazon, Netflix" />
            </div>
        )}
        
        <div>
            <label htmlFor="tx-location" className={labelStyle}>Location (Optional)</label>
            <LocationAutocomplete
                value={locationString}
                onChange={(val, data) => {
                    setLocationString(val);
                    setLocationData(data || {});
                }}
            />
        </div>

        <div>
          <label htmlFor="tx-description" className={labelStyle}>Description</label>
          <input id="tx-description" type="text" value={description} onChange={e => setDescription(e.target.value)} className={INPUT_BASE_STYLE} placeholder={type === 'transfer' ? 'e.g., Monthly savings' : 'e.g., Groceries'} required />
        </div>

        {type !== 'transfer' && (
          <>
            <div>
              <label htmlFor="tx-category" className={labelStyle}>Category</label>
              <div className={SELECT_WRAPPER_STYLE}>
                <select id="tx-category" value={category} onChange={e => setCategory(e.target.value)} className={INPUT_BASE_STYLE} required>
                  <CategoryOptions categories={activeCategories} />
                </select>
                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
              </div>
            </div>
            <div>
                <label className={labelStyle}>Tags (Optional)</label>
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
                            <span className="text-light-text-secondary dark:text-dark-text-secondary px-1">Select tags...</span>
                        )}
                    </div>
                    {isTagSelectorOpen && (
                        <div className="absolute top-full left-0 mt-1 w-full bg-light-card dark:bg-dark-card rounded-lg shadow-lg border border-black/10 dark:border-white/10 z-10 max-h-48 overflow-y-auto">
                            {tags.length > 0 ? tags.map(tag => (
                                <label key={tag.id} className="flex items-center gap-3 p-2 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={tagIds.includes(tag.id)}
                                        onChange={() => handleTagToggle(tag.id)}
                                        className={CHECKBOX_STYLE}
                                    />
                                    <span className="text-sm font-medium">{tag.name}</span>
                                </label>
                            )) : (
                              <div className="p-4 text-center text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                No tags created yet. Go to the Tags page to add one.
                              </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
          </>
        )}
        
        <div className="flex justify-end gap-4 pt-4">
          <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
          <button type="submit" className={BTN_PRIMARY_STYLE}>{saveButtonText}</button>
        </div>
      </form>
    </Modal>
  );
};

export default AddTransactionModal;
