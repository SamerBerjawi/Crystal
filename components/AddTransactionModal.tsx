
import React, { useState, useMemo, useEffect, useRef, useId } from 'react';
import Modal from './Modal';
import { Account, Category, Transaction, Tag, Currency } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, CHECKBOX_STYLE, ALL_ACCOUNT_TYPES } from '../constants';
import { v4 as uuidv4 } from 'uuid';
import LocationAutocomplete from './LocationAutocomplete';
import { toLocalISOString, formatCurrency } from '../utils';

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
  const [showDetails, setShowDetails] = useState(false);
  
  // Location fields
  const [locationString, setLocationString] = useState('');
  const [locationData, setLocationData] = useState<{city?: string, country?: string, lat?: number, lon?: number}>({});

  // Loan payment split state
  const [principalPayment, setPrincipalPayment] = useState('');
  const [interestPayment, setInterestPayment] = useState('');
  
  // Spare Change State
  const [enableRoundUp, setEnableRoundUp] = useState(false);
  const [roundUpBehavior, setRoundUpBehavior] = useState<'skip' | 'unit'>('skip');
  const [roundUpMultiplier, setRoundUpMultiplier] = useState('1');
  const merchantListId = useId();

  const merchantSuggestions = useMemo(() => {
    if (!transactions) return [] as string[];

    const counts = new Map<string, number>();
    transactions.forEach(tx => {
      if (!tx.merchant) return;
      const name = tx.merchant.trim();
      if (!name) return;
      counts.set(name, (counts.get(name) || 0) + 1);
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [transactions]);

  const activeAccount = useMemo(() => {
    const accId = type === 'income' ? toAccountId : fromAccountId;
    return accounts.find(a => a.id === accId);
  }, [accounts, type, fromAccountId, toAccountId]);

  const currencySymbol = activeAccount ? (activeAccount.currency === 'USD' ? '$' : activeAccount.currency === 'EUR' ? '€' : activeAccount.currency === 'GBP' ? '£' : '') : '€';

  const isLoanPayment = useMemo(() => {
    const targetAccountId = type === 'income' ? toAccountId : (type === 'transfer' ? toAccountId : null);
    if (!targetAccountId) return false;
    const targetAccount = accounts.find(a => a.id === targetAccountId);
    return targetAccount?.type === 'Loan';
  }, [type, toAccountId, accounts]);

  // Detect linked spare change account
  const linkedSpareChangeAccount = useMemo(() => {
    if ((type !== 'expense' && type !== 'transfer') || !fromAccountId) return null;
    return accounts.find(a =>
        a.type === 'Investment' &&
        a.subType === 'Spare Change' &&
        a.linkedAccountId === fromAccountId
    );
  }, [accounts, fromAccountId, type]);

  // Calculate Round Up
  const roundUpAmount = useMemo(() => {
      const val = parseFloat(amount);
      if (isNaN(val) || val <= 0) return 0;
      
      const remainder = val % 1;
      const cleanRemainder = parseFloat(remainder.toFixed(2));
      
      if (cleanRemainder === 0) {
          return roundUpBehavior === 'unit' ? 1.00 : 0;
      }

      return 1.00 - cleanRemainder;
  }, [amount, roundUpBehavior]);

  const isExactAmount = useMemo(() => {
      const val = parseFloat(amount);
      if (isNaN(val) || val <= 0) return false;

      const remainder = val % 1;
      const cleanRemainder = parseFloat(remainder.toFixed(2));
      return cleanRemainder === 0;
  }, [amount]);

  const roundUpMultiplierValue = useMemo(() => {
      const multiplier = parseFloat(roundUpMultiplier);
      if (isNaN(multiplier)) return 1;
      return Math.max(0, multiplier);
  }, [roundUpMultiplier]);

  const adjustedRoundUpAmount = useMemo(() => {
      return parseFloat((roundUpAmount * roundUpMultiplierValue).toFixed(2));
  }, [roundUpAmount, roundUpMultiplierValue]);


  // Auto-calculate principal and interest for loan payments
  useEffect(() => {
    const targetAccount = accounts.find(a => a.id === toAccountId);
    const isPaymentToLoan = (type === 'income' || type === 'transfer') && targetAccount?.type === 'Loan';

    if (isPaymentToLoan && targetAccount.interestRate && parseFloat(amount) > 0) {
        const totalPayment = parseFloat(amount);
        const outstandingPrincipal = Math.abs(targetAccount.balance); 
        const monthlyInterestRate = (targetAccount.interestRate / 100) / 12;
        
        const calculatedInterest = parseFloat((outstandingPrincipal * monthlyInterestRate).toFixed(2));
        const interest = Math.min(totalPayment, calculatedInterest);
        const principal = totalPayment - interest;

        setPrincipalPayment(principal.toFixed(2));
        setInterestPayment(interest.toFixed(2));
    } else {
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
        
        if (transactionToEdit.city && transactionToEdit.country) {
            setLocationString(`${transactionToEdit.city}, ${transactionToEdit.country}`);
            setLocationData({
                city: transactionToEdit.city,
                country: transactionToEdit.country,
                lat: transactionToEdit.latitude,
                lon: transactionToEdit.longitude
            });
            setShowDetails(true);
        }
        
        if (transactionToEdit.tagIds && transactionToEdit.tagIds.length > 0) {
            setShowDetails(true);
        }

        if (transactionToEdit.transferId && transactions) {
            setType('transfer');
            const counterpart = transactions.find(t => t.transferId === transactionToEdit.transferId && t.id !== transactionToEdit.id);
            if (counterpart) {
                const expensePart = transactionToEdit.type === 'expense' ? transactionToEdit : counterpart;
                const incomePart = transactionToEdit.type === 'income' ? transactionToEdit : counterpart;
                setFromAccountId(expensePart.accountId);
                setToAccountId(incomePart.accountId);
                principal = String(incomePart.principalAmount || '');
                interest = String(incomePart.interestAmount || '');
                amountToSet = String(Math.abs(incomePart.amount));
            }
            const baseDescription = transactionToEdit.description.replace(/Transfer to .*|Transfer from .*/, 'Account Transfer');
            setDescription(baseDescription);
            setMerchant(transactionToEdit.merchant || 'Internal Transfer');
        } else {
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
        setEnableRoundUp(false);
        setRoundUpBehavior('skip');
        setRoundUpMultiplier('1');
        setShowDetails(false);
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

    if (isEditing) {
        if (wasTransfer && !isNowTransfer) {
            const counterpart = transactions?.find(t => t.transferId === transactionToEdit.transferId && t.id !== transactionToEdit.id);
            toDelete.push(transactionToEdit.id);
            if (counterpart) toDelete.push(counterpart.id);
        } else if (!wasTransfer && isNowTransfer) {
            toDelete.push(transactionToEdit.id);
        }
    }

    const locationProps = {
        city: locationData.city,
        country: locationData.country,
        latitude: locationData.lat,
        longitude: locationData.lon,
    };

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
        
        if (isLoanPayment) {
            incomeTx.principalAmount = parseFloat(principalPayment) || 0;
            incomeTx.interestAmount = parseFloat(interestPayment) || 0;
        }

        if (isEditing && wasTransfer) {
            const originalExpense = transactions!.find(t => t.transferId === transferId && t.type === 'expense');
            const originalIncome = transactions!.find(t => t.transferId === transferId && t.type === 'income');
            expenseTx.id = originalExpense?.id;
            incomeTx.id = originalIncome?.id;
        }

        toSave.push(expenseTx, incomeTx);

        if (linkedSpareChangeAccount && enableRoundUp && adjustedRoundUpAmount > 0) {
            const spareChangeTransferId = `spare-${uuidv4()}`;

            const spareExpenseTx: Omit<Transaction, 'id'> = {
                accountId: fromAccountId,
                date,
                description: `Spare change for ${description || 'Transfer'}`,
                merchant: 'Round Up',
                amount: -Math.abs(adjustedRoundUpAmount),
                category: 'Transfer',
                type: 'expense',
                currency: expenseTx.currency,
                transferId: spareChangeTransferId,
            };

            const spareIncomeTx: Omit<Transaction, 'id'> = {
                accountId: linkedSpareChangeAccount.id,
                date,
                description: `Spare change from ${description || 'Transfer'}`,
                merchant: 'Round Up',
                amount: Math.abs(adjustedRoundUpAmount),
                category: 'Transfer',
                type: 'income',
                currency: linkedSpareChangeAccount.currency,
                transferId: spareChangeTransferId,
            };

            toSave.push(spareExpenseTx, spareIncomeTx);
        }
    } else {
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

        if (isEditing && !wasTransfer) {
            transactionData.id = transactionToEdit.id;
        }

        toSave.push(transactionData);
        
        if (type === 'expense' && linkedSpareChangeAccount && enableRoundUp && adjustedRoundUpAmount > 0) {
             const spareChangeTransferId = `spare-${uuidv4()}`;
             
             const spareExpenseTx: Omit<Transaction, 'id'> = {
                accountId: fromAccountId,
                date,
                description: `Spare change for ${description || 'Transaction'}`,
                merchant: 'Round Up',
                amount: -Math.abs(adjustedRoundUpAmount),
                category: 'Transfer',
                type: 'expense',
                currency: selectedAccount.currency,
                transferId: spareChangeTransferId,
            };

            const spareIncomeTx: Omit<Transaction, 'id'> = {
                accountId: linkedSpareChangeAccount.id,
                date,
                description: `Spare change from ${description || 'Transaction'}`,
                merchant: 'Round Up',
                amount: Math.abs(adjustedRoundUpAmount),
                category: 'Transfer',
                type: 'income',
                currency: linkedSpareChangeAccount.currency,
                transferId: spareChangeTransferId,
            };
            
            toSave.push(spareExpenseTx, spareIncomeTx);
        }
    }
    
    onSave(toSave, toDelete);
  };

  const modalTitle = isEditing ? 'Edit Transaction' : 'New Transaction';
  const saveButtonText = isEditing ? 'Save Changes' : 'Add Transaction';
  const labelStyle = "block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1.5";

  return (
    <Modal onClose={onClose} title={modalTitle} size="lg">
      <form onSubmit={handleSubmit} className="space-y-6 pb-4">
        
        {/* 1. Type Selector */}
        <div className="flex justify-center">
            <div className="bg-gray-100 dark:bg-white/5 p-1 rounded-full inline-flex relative shadow-inner">
                 {['expense', 'income', 'transfer'].map(t => (
                     <button
                        key={t}
                        type="button"
                        onClick={() => setType(t as any)}
                        className={`px-6 py-2 rounded-full text-sm font-bold capitalize transition-all duration-200 ${type === t ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-600 dark:text-primary-400 scale-105' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                     >
                         {t}
                     </button>
                 ))}
            </div>
        </div>
        
        {/* 2. Hero Amount */}
        <div className="flex flex-col items-center justify-center py-4">
            <div className="relative w-full max-w-[280px]">
                <span className={`absolute left-0 top-1/2 -translate-y-1/2 text-4xl font-medium text-light-text-secondary dark:text-dark-text-secondary pointer-events-none transition-opacity duration-200 ${amount ? 'opacity-100' : 'opacity-50'}`}>
                    {currencySymbol}
                </span>
                <input 
                    id="tx-amount"
                    type="number" 
                    step="0.01" 
                    value={amount} 
                    onChange={e => setAmount(e.target.value)} 
                    className="w-full bg-transparent border-none text-center text-6xl font-extrabold text-light-text dark:text-dark-text placeholder-gray-200 dark:placeholder-gray-700 focus:ring-0 py-2 pl-8 tracking-tight" 
                    placeholder="0.00" 
                    autoFocus
                    required 
                />
            </div>
             {isLoanPayment && (
                 <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full mt-2">
                     Loan Payment
                 </span>
             )}
        </div>
        
        {/* 3. Main Form Grid */}
        <div className="bg-gray-50 dark:bg-white/5 p-6 rounded-2xl border border-black/5 dark:border-white/5 space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Date & Merchant */}
                 <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                     <div>
                        <label className={labelStyle}>Date</label>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">calendar_today</span>
                            <input id="tx-date" type="date" value={date} onChange={e => setDate(e.target.value)} className={`${INPUT_BASE_STYLE} pl-10`} required />
                        </div>
                     </div>
                     <div>
                        <label className={labelStyle}>Merchant / Payee</label>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">store</span>
                            <input
                                id="tx-merchant"
                                type="text"
                                value={merchant}
                                onChange={e => setMerchant(e.target.value)}
                                className={`${INPUT_BASE_STYLE} pl-10`}
                                placeholder="Optional"
                                list={merchantSuggestions.length > 0 ? merchantListId : undefined}
                            />
                            {merchantSuggestions.length > 0 && (
                                <datalist id={merchantListId}>
                                    {merchantSuggestions.map(name => (
                                        <option key={name} value={name} />
                                    ))}
                                </datalist>
                            )}
                        </div>
                     </div>
                 </div>

                 {/* Account Selection */}
                 <div className="md:col-span-2">
                     <div className="flex flex-col sm:flex-row items-center gap-4">
                         <div className="flex-1 w-full">
                            <label className={labelStyle}>{type === 'income' ? 'To Account' : 'From Account'}</label>
                            <div className={SELECT_WRAPPER_STYLE}>
                                <select id="tx-account-1" value={type === 'income' ? toAccountId : fromAccountId} onChange={e => type === 'income' ? setToAccountId(e.target.value) : setFromAccountId(e.target.value)} className={INPUT_BASE_STYLE} required>
                                    <option value="" disabled>Select account</option>
                                    <AccountOptions accounts={accounts} />
                                </select>
                                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                            </div>
                         </div>
                         
                         {type === 'transfer' && (
                             <>
                                <span className="material-symbols-outlined text-gray-400 mt-6 hidden sm:block">arrow_forward</span>
                                <div className="flex-1 w-full">
                                    <label className={labelStyle}>To Account</label>
                                    <div className={SELECT_WRAPPER_STYLE}>
                                        <select id="tx-account-2" value={toAccountId} onChange={e => setToAccountId(e.target.value)} className={INPUT_BASE_STYLE} required>
                                            <option value="" disabled>Select account</option>
                                            <AccountOptions accounts={accounts.filter(a => a.id !== fromAccountId)} />
                                        </select>
                                        <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                    </div>
                                </div>
                             </>
                         )}
                     </div>
                 </div>

                 {/* Category & Description */}
                 {type !== 'transfer' ? (
                     <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                         <div>
                             <label className={labelStyle}>Category</label>
                             <div className={SELECT_WRAPPER_STYLE}>
                                <select id="tx-category" value={category} onChange={e => setCategory(e.target.value)} className={INPUT_BASE_STYLE} required>
                                    <CategoryOptions categories={activeCategories} />
                                </select>
                                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                            </div>
                         </div>
                         <div>
                             <label className={labelStyle}>Description</label>
                             <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">description</span>
                                <input id="tx-description" type="text" value={description} onChange={e => setDescription(e.target.value)} className={`${INPUT_BASE_STYLE} pl-10`} placeholder="What was this for?" required />
                             </div>
                         </div>
                     </div>
                 ) : (
                      <div className="md:col-span-2">
                         <label className={labelStyle}>Description</label>
                         <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">description</span>
                            <input id="tx-description" type="text" value={description} onChange={e => setDescription(e.target.value)} className={`${INPUT_BASE_STYLE} pl-10`} placeholder="Reason for transfer" required />
                         </div>
                     </div>
                 )}
             </div>
        </div>

        {/* 4. Details / Metadata Accordion */}
        <div>
             <button type="button" onClick={() => setShowDetails(!showDetails)} className="flex items-center gap-2 text-sm font-semibold text-primary-500 hover:text-primary-600 transition-colors">
                <span>{showDetails ? 'Hide Details' : 'Add Details (Tags, Location)'}</span>
                <span className={`material-symbols-outlined transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`}>expand_more</span>
             </button>

             {showDetails && (
                 <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 animate-fade-in-up">
                      {/* Tags */}
                      <div className="md:col-span-2">
                          <label className={labelStyle}>Tags</label>
                          <div className="relative" ref={tagSelectorRef}>
                                <div
                                    onClick={() => setIsTagSelectorOpen(prev => !prev)}
                                    className={`${INPUT_BASE_STYLE} flex items-center flex-wrap gap-1 cursor-pointer min-h-[42px] py-1.5`}
                                >
                                    {tagIds.length > 0 ? (
                                        tagIds.map(id => {
                                            const tag = tags.find(t => t.id === id);
                                            if (!tag) return null;
                                            return (
                                                <span key={tag.id} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium" style={{ backgroundColor: `${tag.color}20`, color: tag.color }}>
                                                    {tag.name}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); handleTagToggle(tag.id); }}
                                                        className="hover:opacity-70"
                                                    >
                                                        &times;
                                                    </button>
                                                </span>
                                            );
                                        })
                                    ) : (
                                        <span className="text-light-text-secondary dark:text-dark-text-secondary text-sm">Select tags...</span>
                                    )}
                                </div>
                                 {isTagSelectorOpen && (
                                    <div className="absolute top-full left-0 mt-1 w-full bg-light-card dark:bg-dark-card rounded-lg shadow-xl border border-black/10 dark:border-white/10 z-20 max-h-48 overflow-y-auto p-1">
                                        {tags.length > 0 ? tags.map(tag => (
                                            <label key={tag.id} className="flex items-center gap-3 p-2 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer rounded-md">
                                                <input
                                                    type="checkbox"
                                                    checked={tagIds.includes(tag.id)}
                                                    onChange={() => handleTagToggle(tag.id)}
                                                    className={CHECKBOX_STYLE}
                                                />
                                                <span className="text-sm font-medium">{tag.name}</span>
                                            </label>
                                        )) : (
                                          <div className="p-3 text-center text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                            No tags created yet.
                                          </div>
                                        )}
                                    </div>
                                )}
                            </div>
                      </div>
                      
                      {/* Location */}
                      <div className="md:col-span-2">
                           <label className={labelStyle}>Location</label>
                           <LocationAutocomplete
                                value={locationString}
                                onChange={(val, data) => {
                                    setLocationString(val);
                                    setLocationData(data || {});
                                }}
                                placeholder="Start typing city..."
                            />
                      </div>
                 </div>
             )}
        </div>
        
        {/* Special Sections (Loan & Round Up) */}
        {(isLoanPayment || ((type === 'expense' || type === 'transfer') && linkedSpareChangeAccount)) && (
            <div className="space-y-4 pt-2">
                 {/* Loan Breakdown */}
                 {isLoanPayment && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/30">
                        <div className="flex items-center gap-2 mb-3 text-blue-700 dark:text-blue-300">
                             <span className="material-symbols-outlined text-lg">pie_chart</span>
                             <p className="font-bold text-xs uppercase tracking-wider">Loan Payment Split</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelStyle}>Principal</label>
                                <input id="principal-payment" type="number" step="0.01" value={principalPayment} onChange={handlePrincipalChange} className={INPUT_BASE_STYLE} placeholder="0.00" />
                            </div>
                            <div>
                                <label className={labelStyle}>Interest</label>
                                <input id="interest-payment" type="number" step="0.01" value={interestPayment} onChange={handleInterestChange} className={INPUT_BASE_STYLE} placeholder="0.00" />
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Round Up */}
                {(type === 'expense' || type === 'transfer') && linkedSpareChangeAccount && (
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                        <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400">savings</span>
                                <label className="text-sm font-bold text-indigo-900 dark:text-indigo-200 cursor-pointer select-none">
                                    Round up to {linkedSpareChangeAccount.name}
                                </label>
                             </div>
                             <div className="flex items-center gap-3">
                                 <span className="font-bold font-mono text-indigo-700 dark:text-indigo-300">
                                    {formatCurrency(adjustedRoundUpAmount, 'EUR')}
                                </span>
                                 <input
                                    type="checkbox"
                                    checked={enableRoundUp} 
                                    onChange={e => setEnableRoundUp(e.target.checked)} 
                                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300 cursor-pointer"
                                />
                             </div>
                        </div>
                        {enableRoundUp && (
                             <div className="mt-4 pt-3 border-t border-indigo-200 dark:border-indigo-800/30 grid grid-cols-2 gap-4 text-xs">
                                {isExactAmount && (
                                    <div>
                                        <label className={labelStyle}>On Exact Amounts</label>
                                        <div className={SELECT_WRAPPER_STYLE}>
                                            <select
                                                value={roundUpBehavior}
                                                onChange={e => setRoundUpBehavior(e.target.value as 'skip' | 'unit')}
                                                className={`${INPUT_BASE_STYLE} !py-1 !text-xs`}
                                            >
                                                <option value="skip">Skip (€0.00)</option>
                                                <option value="unit">Add €1.00</option>
                                            </select>
                                            <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined text-sm">expand_more</span></div>
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <label className={labelStyle}>Multiplier</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        value={roundUpMultiplier}
                                        onChange={e => setRoundUpMultiplier(e.target.value)}
                                        className={`${INPUT_BASE_STYLE} !py-1 !text-xs`}
                                    />
                                </div>
                             </div>
                        )}
                    </div>
                )}
            </div>
        )}

        <div className="flex justify-end gap-3 pt-6 border-t border-black/5 dark:border-white/5">
          <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
          <button type="submit" className={`${BTN_PRIMARY_STYLE} px-8 shadow-lg shadow-primary-500/20`}>{saveButtonText}</button>
        </div>
      </form>
    </Modal>
  );
};

export default AddTransactionModal;
