

import React, { useState, useMemo, useEffect, useRef, useId } from 'react';
import Modal from './Modal';
import { Account, Category, Transaction, Tag, Currency } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, CHECKBOX_STYLE, ALL_ACCOUNT_TYPES } from '../constants';
import { v4 as uuidv4 } from 'uuid';
import LocationAutocomplete from './LocationAutocomplete';
import { toLocalISOString, formatCurrency, fuzzySearch } from '../utils';
import { normalizeMerchantKey } from '../utils/brandfetch';
import { usePreferencesSelector } from '../contexts/DomainProviders';

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
    merchant?: string;
    tagIds?: string[];
    locationString?: string;
    locationData?: { city?: string; country?: string; lat?: number; lon?: number };
  };
}

const CategoryOptions: React.FC<{ categories: Category[] }> = ({ categories }) => (
  <>
    <option className="bg-white dark:bg-gray-900 text-black dark:text-white" value="">Select Category</option>
    {categories.map(parentCat => (
      <optgroup className="bg-gray-100 dark:bg-gray-800 text-black dark:text-white font-semibold" key={parentCat.id} label={parentCat.name}>
        <option className="bg-white dark:bg-gray-900 text-black dark:text-white font-normal" value={parentCat.name}>{parentCat.name}</option>
        {parentCat.subCategories.map(subCat => (
          <option className="bg-white dark:bg-gray-900 text-black dark:text-white font-normal" key={subCat.id} value={subCat.name}>
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
          <optgroup className="bg-gray-100 dark:bg-gray-800 text-black dark:text-white font-semibold" key={type} label={type}>
            {group.map(acc => (
              <option className="bg-white dark:bg-gray-900 text-black dark:text-white font-normal" key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </optgroup>
        );
      })}
    </>
  );
};

const AddTransactionModal: React.FC<AddTransactionModalProps> = ({ onClose, onSave, accounts, incomeCategories, expenseCategories, transactions, transactionToEdit, initialType, initialFromAccountId, initialToAccountId, initialCategory, tags, initialDetails }) => {
  const isEditing = !!transactionToEdit;
  const merchantRules = usePreferencesSelector(p => p.merchantRules || {});

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
  const [useAutoLoanSplit, setUseAutoLoanSplit] = useState(true);
  
  // Spare Change State
  const [enableRoundUp, setEnableRoundUp] = useState(false);
  const [existingRoundUpTransaction, setExistingRoundUpTransaction] = useState<Transaction | null>(null);
  const [roundUpBehavior, setRoundUpBehavior] = useState<'skip' | 'unit'>('skip');
  const [roundUpMultiplier, setRoundUpMultiplier] = useState('1');
  
  // Custom Merchant Autocomplete State
  const [showMerchantSuggestions, setShowMerchantSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const merchantContainerRef = useRef<HTMLDivElement>(null);
  
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

  const filteredSuggestions = useMemo(() => {
    if (!merchant.trim() || !showMerchantSuggestions) return [];
    const normalized = merchant.toLowerCase().trim();
    
    // 1. Prioritize exact matches (case insensitive)
    const exactMatches = merchantSuggestions.filter(name => name.toLowerCase() === normalized);
    
    // 2. Prefix matches
    const prefixMatches = merchantSuggestions.filter(name => 
        name.toLowerCase().startsWith(normalized) && 
        !exactMatches.includes(name)
    );
    
    // 3. Fuzzy matches
    const otherMatches = merchantSuggestions.filter(name => 
        (name.toLowerCase().includes(normalized) || fuzzySearch(normalized, name)) &&
        !exactMatches.includes(name) &&
        !prefixMatches.includes(name)
    );
    
    return [...exactMatches, ...prefixMatches, ...otherMatches].slice(0, 8);
  }, [merchant, merchantSuggestions, showMerchantSuggestions]);

  const activeAccount = useMemo(() => {
    const accId = type === 'income' ? toAccountId : fromAccountId;
    return accounts.find(a => a.id === accId);
  }, [accounts, type, fromAccountId, toAccountId]);

  const currencySymbol = activeAccount ? (activeAccount.currency === 'USD' ? '$' : activeAccount.currency === 'EUR' ? '€' : activeAccount.currency === 'GBP' ? '£' : '') : '€';

  const loanAccount = useMemo(() => {
    if (type === 'transfer') {
      return accounts.find(a => a.id === fromAccountId && (a.type === 'Loan' || a.type === 'Lending'))
        || accounts.find(a => a.id === toAccountId && (a.type === 'Loan' || a.type === 'Lending'));
    }
    const targetAccountId = type === 'income' ? toAccountId : fromAccountId;
    if (!targetAccountId) return undefined;
    const targetAccount = accounts.find(a => a.id === targetAccountId);
    if (!targetAccount || (targetAccount.type !== 'Loan' && targetAccount.type !== 'Lending')) {
      return undefined;
    }
    return targetAccount;
  }, [type, fromAccountId, toAccountId, accounts]);

  const isLoanPayment = Boolean(loanAccount);

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
    const isPaymentToLoan = (type === 'income' || type === 'transfer') && loanAccount;

    if (isPaymentToLoan && useAutoLoanSplit && loanAccount?.interestRate && parseFloat(amount) > 0) {
        const totalPayment = parseFloat(amount);
        const outstandingPrincipal = Math.abs(loanAccount.balance); 
        const monthlyInterestRate = (loanAccount.interestRate / 100) / 12;
        
        const calculatedInterest = parseFloat((outstandingPrincipal * monthlyInterestRate).toFixed(2));
        const interest = Math.min(totalPayment, calculatedInterest);
        const principal = totalPayment - interest;

        setPrincipalPayment(principal.toFixed(2));
        setInterestPayment(interest.toFixed(2));
    } else if (!isPaymentToLoan) {
        setPrincipalPayment('');
        setInterestPayment('');
    }
  }, [amount, type, loanAccount, useAutoLoanSplit]);
  
  const handlePrincipalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUseAutoLoanSplit(false);
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
    setUseAutoLoanSplit(false);
    const newInterestValue = e.target.value;
    const totalPayment = parseFloat(amount) || 0;
    let newInterest = parseFloat(newInterestValue) || 0;

    if (newInterest > totalPayment) newInterest = totalPayment;
    if (newInterest < 0) newInterest = 0;

    setInterestPayment(String(newInterest));

    const newPrincipal = totalPayment - newInterest;
    setPrincipalPayment(newPrincipal.toFixed(2));
  };

  const handleDescriptionBlur = () => {
    if (!merchant && description) {
        const potentialMerchant = description;
        setMerchant(potentialMerchant);
        
        // Try to apply rules based on description if merchant field was empty
        applyMerchantRules(potentialMerchant);
    }
  };

  // Auto-apply merchant rules
  const applyMerchantRules = (merchantName: string) => {
      const key = normalizeMerchantKey(merchantName);
      if (!key) return;

      const rule = merchantRules[key];
      if (rule) {
          if (rule.category) setCategory(rule.category);
          if (rule.defaultDescription) setDescription(rule.defaultDescription);
      }
  };

  const handleMerchantChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setMerchant(val);
      // Debounce or just check on significant change? For now, instant feedback is nice.
      // But we check only if value length > 2 to avoid noise
      if (val.length > 2) {
          applyMerchantRules(val);
      }
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
        setUseAutoLoanSplit(!(principal || interest));

        // Detect Round Up
        if (transactions) {
            // Find a transaction that looks like a round-up for this one
            // Match: same date, same source account, merchant "Round Up", description "Spare change for..."
            const currentAccountId = transactionToEdit.type === 'income' ? transactionToEdit.accountId : (transactionToEdit.transferId ? (transactionToEdit.type === 'expense' ? transactionToEdit.accountId : (transactions.find(t => t.transferId === transactionToEdit.transferId && t.type === 'expense')?.accountId)) : transactionToEdit.accountId);

            const roundUpTx = transactions.find(t => 
                t.accountId === currentAccountId &&
                t.date === transactionToEdit.date &&
                t.merchant === 'Round Up' &&
                t.transferId?.startsWith('spare-') &&
                // Check description match loosely
                t.description.includes(transactionToEdit.description || '')
            );

            if (roundUpTx) {
                setEnableRoundUp(true);
                setExistingRoundUpTransaction(roundUpTx);
            } else {
                setEnableRoundUp(false);
                setExistingRoundUpTransaction(null);
            }
        }

    } else {
        setType(initialType || 'expense');
        setDate(initialDetails?.date || toLocalISOString(new Date()));
        setFromAccountId(initialFromAccountId || defaultAccountId);
        setToAccountId(initialToAccountId || defaultAccountId);
        setDescription(initialDetails?.description || '');
        setMerchant(initialDetails?.merchant || '');
        setAmount(initialDetails?.amount || '');
        setCategory(initialCategory || '');
        setPrincipalPayment(initialDetails?.principal || '');
        setInterestPayment(initialDetails?.interest || '');
        setUseAutoLoanSplit(!(initialDetails?.principal || initialDetails?.interest));
        setTagIds(initialDetails?.tagIds || []);
        setLocationString(initialDetails?.locationString || '');
        setLocationData(initialDetails?.locationData || {});
        setEnableRoundUp(false);
        setExistingRoundUpTransaction(null);
        setRoundUpBehavior('skip');
        setRoundUpMultiplier('1');
        setShowDetails(!!(initialDetails?.tagIds?.length || initialDetails?.locationString));
    }
  }, [transactionToEdit, isEditing, accounts, transactions, initialType, initialFromAccountId, initialToAccountId, initialDetails, defaultAccountId, initialCategory]);

  // Auto-enable round up when a linked spare change account is detected
  useEffect(() => {
    if (linkedSpareChangeAccount && !isEditing) {
      setEnableRoundUp(true);
    }
  }, [linkedSpareChangeAccount, isEditing]);
  
  const availableAccounts = useMemo(() => {
    return accounts.filter(acc => acc.status !== 'closed' || acc.id === fromAccountId || acc.id === toAccountId);
  }, [accounts, fromAccountId, toAccountId]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagSelectorRef.current && !tagSelectorRef.current.contains(event.target as Node)) {
        setIsTagSelectorOpen(false);
      }
      if (merchantContainerRef.current && !merchantContainerRef.current.contains(event.target as Node)) {
        setShowMerchantSuggestions(false);
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
        
        if (isLoanPayment && loanAccount) {
            const principalValue = parseFloat(principalPayment) || 0;
            const interestValue = parseFloat(interestPayment) || 0;
            if (expenseTx.accountId === loanAccount.id) {
                expenseTx.principalAmount = principalValue;
                expenseTx.interestAmount = interestValue;
            } else if (incomeTx.accountId === loanAccount.id) {
                incomeTx.principalAmount = principalValue;
                incomeTx.interestAmount = interestValue;
            }
        }

        if (isEditing && wasTransfer) {
            const originalExpense = transactions!.find(t => t.transferId === transferId && t.type === 'expense');
            const originalIncome = transactions!.find(t => t.transferId === transferId && t.type === 'income');
            expenseTx.id = originalExpense?.id;
            incomeTx.id = originalIncome?.id;
        }

        toSave.push(expenseTx, incomeTx);
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
        
        if (isLoanPayment && loanAccount && accountId === loanAccount.id) {
            transactionData.principalAmount = parseFloat(principalPayment) || 0;
            transactionData.interestAmount = parseFloat(interestPayment) || 0;
        }

        if (isEditing && !wasTransfer) {
            transactionData.id = transactionToEdit.id;
        }

        toSave.push(transactionData);
    }

    // Unified Round Up Logic
    // We check if we should create, update, or delete a round-up transaction based on the current state.
    
    // Conditions for having a round up:
    // 1. Must be an expense or transfer (outbound money)
    // 2. Must have a linked spare change account
    const canHaveRoundUp = (type === 'expense' || type === 'transfer') && linkedSpareChangeAccount;
    
    // Check if we should save (create/update) a round up
    const shouldSaveRoundUp = canHaveRoundUp && enableRoundUp && adjustedRoundUpAmount > 0;
    
    // Check if we should delete an existing round up
    // Delete if it exists BUT we shouldn't save one (unchecked, or conditions not met)
    const shouldDeleteRoundUp = existingRoundUpTransaction && !shouldSaveRoundUp;

    if (shouldDeleteRoundUp && existingRoundUpTransaction) {
        toDelete.push(existingRoundUpTransaction.id);
        const pair = transactions?.find(t => t.transferId === existingRoundUpTransaction.transferId && t.id !== existingRoundUpTransaction.id);
        if (pair) toDelete.push(pair.id);
    } else if (shouldSaveRoundUp && linkedSpareChangeAccount) {
         // Create or Update
         const spareTransferId = existingRoundUpTransaction?.transferId || `spare-${uuidv4()}`;
         const expenseId = existingRoundUpTransaction?.id; // undefined if creating new
         
         // Find existing pair ID if updating
         let incomeId = undefined;
         if (existingRoundUpTransaction && transactions) {
             const pair = transactions.find(t => t.transferId === spareTransferId && t.id !== existingRoundUpTransaction.id);
             incomeId = pair?.id;
         }
         
         // Use the selected account (fromAccountId) for currency and ID
         const selectedAccount = accounts.find(acc => acc.id === fromAccountId);

         if (selectedAccount) {
             const spareExpenseTx: Omit<Transaction, 'id'> & { id?: string } = {
                id: expenseId,
                accountId: fromAccountId,
                date,
                description: `Spare change for ${description || 'Transaction'}`,
                merchant: 'Round Up',
                amount: -Math.abs(adjustedRoundUpAmount),
                category: 'Transfer',
                type: 'expense',
                currency: selectedAccount.currency,
                transferId: spareTransferId,
            };

            const spareIncomeTx: Omit<Transaction, 'id'> & { id?: string } = {
                id: incomeId,
                accountId: linkedSpareChangeAccount.id,
                date,
                description: `Spare change from ${description || 'Transaction'}`,
                merchant: 'Round Up',
                amount: Math.abs(adjustedRoundUpAmount),
                category: 'Transfer',
                type: 'income',
                currency: linkedSpareChangeAccount.currency,
                transferId: spareTransferId,
            };
            
            toSave.push(spareExpenseTx, spareIncomeTx);
         }
    }
    
    onSave(toSave, toDelete);
  };

  const modalTitle = isEditing ? 'Edit Transaction' : 'New Transaction';
  const saveButtonText = isEditing ? 'Save Changes' : 'Add Transaction';
  const labelStyle = "block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-2";

  return (
    <Modal onClose={onClose} title={modalTitle} size="lg">
      <form onSubmit={handleSubmit} className="space-y-6 pb-2">
        
        {/* 1. Type Selector */}
        <div className="flex justify-center -mt-2">
            <div className="bg-gray-100 dark:bg-white/5 p-1 rounded-2xl inline-flex relative shadow-inner border border-black/5 dark:border-white/5">
                 {['expense', 'income', 'transfer'].map(t => (
                     <button
                        key={t}
                        type="button"
                        onClick={() => setType(t as any)}
                        className={`px-6 py-2 rounded-xl text-sm font-bold capitalize transition-all duration-200 z-10 ${type === t ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-600 dark:text-primary-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                     >
                         {t}
                     </button>
                 ))}
            </div>
        </div>
        
        {/* 2. Hero Amount */}
        <div className="flex flex-col items-center justify-center pt-2 pb-4">
            <div className="relative w-full max-w-[320px] group">
                <span className={`absolute left-0 top-1/2 -translate-y-1/2 text-5xl font-light text-light-text-secondary dark:text-dark-text-secondary pointer-events-none transition-all duration-300 ${amount ? 'opacity-100 -translate-x-2' : 'opacity-40'}`}>
                    {currencySymbol}
                </span>
                <input 
                    id="tx-amount"
                    type="number" 
                    step="0.01" 
                    value={amount} 
                    onChange={e => setAmount(e.target.value)} 
                    className="w-full bg-transparent border-none text-center text-7xl font-bold text-light-text dark:text-dark-text placeholder-gray-200 dark:placeholder-gray-800 focus:ring-0 py-4 pl-10 tracking-tighter" 
                    placeholder="0.00" 
                    autoFocus
                    required 
                    inputMode="decimal"
                    autoComplete="off"
                />
            </div>
             {isLoanPayment && (
                 <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full mt-1 border border-blue-100 dark:border-blue-800/30">
                     <span className="material-symbols-outlined text-[18px]">account_balance</span>
                     <span className="text-[11px] font-bold uppercase tracking-wider">Loan Payment detected</span>
                 </div>
             )}
        </div>
        
        {/* 3. Main Form Grid */}
        <div className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Basic Info Section */}
                 <div className="md:col-span-2 bg-gray-50 dark:bg-white/5 p-6 rounded-2xl border border-black/5 dark:border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-6 relative">
                     <div className="absolute -top-3 left-6 px-2 bg-light-card dark:bg-dark-card text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] border border-black/5 dark:border-white/5 rounded-md">Transaction Details</div>
                     
                     <div>
                        <label className={labelStyle}>Date</label>
                        <div className="relative group">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg transition-colors group-focus-within:text-primary-500">calendar_today</span>
                            <input id="tx-date" type="date" value={date} onChange={e => setDate(e.target.value)} className={`${INPUT_BASE_STYLE} pl-10 h-11`} required />
                        </div>
                     </div>
                     <div ref={merchantContainerRef}>
                        <label className={labelStyle}>Merchant / Payee</label>
                        <div className="relative group">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg transition-colors group-focus-within:text-primary-500">store</span>
                            <div className="relative">
                                <input
                                    id="tx-merchant"
                                    type="text"
                                    value={merchant}
                                    onChange={handleMerchantChange}
                                    onFocus={() => setShowMerchantSuggestions(true)}
                                    className={`${INPUT_BASE_STYLE} pl-10 h-11`}
                                    placeholder="Where did you spend?"
                                    autoComplete="off"
                                    autoCorrect="off"
                                    spellCheck="false"
                                    inputMode="text"
                                />
                                {showMerchantSuggestions && filteredSuggestions.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-black/10 dark:border-white/10 rounded-xl shadow-xl z-[60] max-h-60 overflow-y-auto animate-fade-in-up py-1">
                                        {filteredSuggestions.map((name, index) => (
                                            <button
                                                key={name}
                                                type="button"
                                                onClick={() => {
                                                    setMerchant(name);
                                                    applyMerchantRules(name);
                                                    setShowMerchantSuggestions(false);
                                                }}
                                                className="w-full text-left px-4 py-3 text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 text-light-text dark:text-dark-text flex items-center gap-3 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-gray-400 text-lg">history</span>
                                                <span className="truncate font-medium">{name}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                     </div>

                     <div className="sm:col-span-2">
                         <div className="flex flex-col sm:flex-row items-center gap-4">
                             <div className="flex-1 w-full">
                                <label className={labelStyle}>{type === 'income' ? 'Recipient Account' : 'Source Account'}</label>
                                <div className={SELECT_WRAPPER_STYLE}>
                                    <select id="tx-account-1" value={type === 'income' ? toAccountId : fromAccountId} onChange={e => type === 'income' ? setToAccountId(e.target.value) : setFromAccountId(e.target.value)} className={`${INPUT_BASE_STYLE} h-11 pl-4`} required>
                                        <option className="bg-white dark:bg-gray-900 text-black dark:text-white" value="" disabled>Select account</option>
                                        <AccountOptions accounts={accounts} />
                                    </select>
                                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                </div>
                             </div>
                             
                             {type === 'transfer' && (
                                 <>
                                    <div className="mt-6 flex items-center justify-center p-2 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 shadow-sm border border-primary-100 dark:border-primary-800/30">
                                        <span className="material-symbols-outlined rotate-90 sm:rotate-0">sync_alt</span>
                                    </div>
                                    <div className="flex-1 w-full">
                                        <label className={labelStyle}>Destination Account</label>
                                        <div className={SELECT_WRAPPER_STYLE}>
                                            <select id="tx-account-2" value={toAccountId} onChange={e => setToAccountId(e.target.value)} className={`${INPUT_BASE_STYLE} h-11 pl-4`} required>
                                                <option className="bg-white dark:bg-gray-900 text-black dark:text-white" value="" disabled>Select account</option>
                                                <AccountOptions accounts={accounts.filter(a => a.id !== fromAccountId)} />
                                            </select>
                                            <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                        </div>
                                    </div>
                                 </>
                             )}
                         </div>
                     </div>

                     {type !== 'transfer' && (
                        <div>
                             <label className={labelStyle}>Category</label>
                             <div className={SELECT_WRAPPER_STYLE}>
                                <select id="tx-category" value={category} onChange={e => setCategory(e.target.value)} className={`${INPUT_BASE_STYLE} h-11 pl-4`} required>
                                    <CategoryOptions categories={activeCategories} />
                                </select>
                                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                            </div>
                        </div>
                     )}
                     
                     <div className={type !== 'transfer' ? '' : 'sm:col-span-2'}>
                        <label className={labelStyle}>Description / Note</label>
                        <div className="relative group">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg transition-colors group-focus-within:text-primary-500">description</span>
                            <input 
                              id="tx-description" 
                              type="text" 
                              value={description} 
                              onChange={e => setDescription(e.target.value)} 
                              onBlur={handleDescriptionBlur} 
                              className={`${INPUT_BASE_STYLE} pl-10 h-11`} 
                              placeholder={type === 'transfer' ? 'Reason for transfer' : 'Memo...'} 
                              required 
                            />
                        </div>
                     </div>
                 </div>

                 {/* Advanced Sections */}
                 <div className="md:col-span-2 space-y-4">
                     {/* Loan Split Info */}
                     {isLoanPayment && (
                         <div className="bg-blue-50/50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-100 dark:border-blue-800/30 animate-fade-in-up">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300 flex items-center gap-2 uppercase tracking-wider">
                                    <span className="material-symbols-outlined text-lg">payments</span>
                                    Repayment Split
                                </h4>
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" checked={useAutoLoanSplit} onChange={e => setUseAutoLoanSplit(e.target.checked)} className={CHECKBOX_STYLE} />
                                    <span className="text-xs font-semibold text-blue-800 dark:text-blue-400">Auto-Calculate</span>
                                </label>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-blue-800 dark:text-blue-400 uppercase mb-1 block">Principal</label>
                                    <div className="relative group">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 dark:text-blue-600 font-bold text-sm">{currencySymbol}</span>
                                        <input type="number" step="0.01" value={principalPayment} onChange={handlePrincipalChange} className="w-full h-10 bg-white dark:bg-gray-900 rounded-lg pl-8 pr-3 text-sm font-bold text-blue-900 dark:text-blue-100 border border-blue-200 dark:border-blue-800 focus:ring-2 focus:ring-blue-500 transition-all" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-blue-800 dark:text-blue-400 uppercase mb-1 block">Interest</label>
                                    <div className="relative group">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 dark:text-blue-600 font-bold text-sm">{currencySymbol}</span>
                                        <input type="number" step="0.01" value={interestPayment} onChange={handleInterestChange} className="w-full h-10 bg-white dark:bg-gray-900 rounded-lg pl-8 pr-3 text-sm font-bold text-blue-900 dark:text-blue-100 border border-blue-200 dark:border-blue-800 focus:ring-2 focus:ring-blue-500 transition-all" />
                                    </div>
                                </div>
                            </div>
                         </div>
                     )}

                     {/* Round Up / Spare Change */}
                     {linkedSpareChangeAccount && (type === 'expense' || type === 'transfer') && (
                         <div className={`p-6 rounded-2xl border transition-all duration-300 ${enableRoundUp ? 'bg-cyan-50 dark:bg-cyan-900/10 border-cyan-100 dark:border-cyan-800/30' : 'bg-transparent border-black/5 dark:border-white/5 opacity-60'}`}>
                             <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                                        <span className="material-symbols-outlined">savings</span>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-cyan-900 dark:text-cyan-300">Spare Change Round-Up</h4>
                                        <p className="text-[10px] text-cyan-700 dark:text-cyan-500 font-medium tracking-wide">linked to {linkedSpareChangeAccount.name}</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer select-none">
                                    <input type="checkbox" checked={enableRoundUp} onChange={e => setEnableRoundUp(e.target.checked)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-300 dark:peer-focus:ring-cyan-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-cyan-600"></div>
                                </label>
                             </div>

                             {enableRoundUp && (
                                 <div className="space-y-4 animate-fade-in">
                                     <div className="grid grid-cols-2 gap-6 pt-2">
                                         <div>
                                             <label className="text-[10px] font-bold text-cyan-800 dark:text-cyan-400 uppercase mb-2 block">Rounding Strategy</label>
                                             <div className="flex bg-white dark:bg-gray-900 p-1 rounded-lg border border-cyan-100 dark:border-cyan-800">
                                                 <button type="button" onClick={() => setRoundUpBehavior('skip')} className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${roundUpBehavior === 'skip' ? 'bg-cyan-500 text-white shadow-sm' : 'text-cyan-600'}`}>Skip Whole</button>
                                                 <button type="button" onClick={() => setRoundUpBehavior('unit')} className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${roundUpBehavior === 'unit' ? 'bg-cyan-500 text-white shadow-sm' : 'text-cyan-600'}`}>+1.00 if Exact</button>
                                             </div>
                                         </div>
                                         <div>
                                             <label className="text-[10px] font-bold text-cyan-800 dark:text-cyan-400 uppercase mb-2 block">Multiplier</label>
                                             <input type="number" step="1" min="1" value={roundUpMultiplier} onChange={e => setRoundUpMultiplier(e.target.value)} className="w-full h-9 bg-white dark:bg-gray-900 rounded-lg px-3 text-xs font-bold text-cyan-900 dark:text-cyan-100 border border-cyan-100 dark:border-cyan-800 focus:ring-2 focus:ring-cyan-500" />
                                         </div>
                                     </div>
                                     <div className="flex items-center justify-between p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                                         <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-400">Transfer Amount</span>
                                         <span className="text-lg font-bold text-cyan-700 dark:text-cyan-300">{formatCurrency(adjustedRoundUpAmount, activeAccount?.currency || 'EUR')}</span>
                                     </div>
                                 </div>
                             )}
                         </div>
                     )}

                     {/* Extra Details Accordion */}
                     <div className="bg-transparent rounded-2xl border border-black/5 dark:border-white/5 overflow-hidden">
                         <button type="button" onClick={() => setShowDetails(!showDetails)} className="w-full flex items-center justify-between p-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className={`material-symbols-outlined text-gray-400 transition-transform ${showDetails ? 'rotate-90' : ''}`}>chevron_right</span>
                                <span className="text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Advanced Details</span>
                            </div>
                            <div className="flex gap-2">
                                {tagIds.length > 0 && <span className="text-[10px] font-bold bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded-full">{tagIds.length} Tags</span>}
                                {locationString && <span className="text-[10px] font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full">Location</span>}
                            </div>
                         </button>

                         {showDetails && (
                             <div className="p-6 pt-2 border-t border-black/5 dark:border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-6 animate-fade-in-down">
                                  <div>
                                      <label className={labelStyle}>Categorical Tags</label>
                                      <div className="relative" ref={tagSelectorRef}>
                                            <div
                                                onClick={() => setIsTagSelectorOpen(prev => !prev)}
                                                className={`${INPUT_BASE_STYLE} flex items-center flex-wrap gap-1.5 cursor-pointer min-h-[44px] py-2 pl-3 transition-shadow`}
                                            >
                                                {tagIds.length > 0 ? (
                                                    tagIds.map(id => {
                                                        const tag = tags.find(t => t.id === id);
                                                        if (!tag) return null;
                                                        return (
                                                            <span key={tag.id} className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-semibold border border-black/5 dark:border-white/10" style={{ backgroundColor: `${tag.color}25`, color: tag.color }}>
                                                                {tag.name}
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); handleTagToggle(tag.id); }}
                                                                    className="hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5 ml-1 leading-none"
                                                                >
                                                                    &times;
                                                                </button>
                                                            </span>
                                                        );
                                                    })
                                                ) : (
                                                    <span className="text-sm text-gray-400">Add tags...</span>
                                                )}
                                                <span className="material-symbols-outlined ml-auto text-gray-400 pointer-events-none">label</span>
                                            </div>
                                            {isTagSelectorOpen && (
                                                <div className="absolute bottom-full mb-2 left-0 w-full bg-light-card dark:bg-dark-card rounded-xl shadow-2xl border border-black/10 dark:border-white/10 z-[60] max-h-56 overflow-y-auto p-2">
                                                    {tags.length > 0 ? tags.map(tag => (
                                                        <label key={tag.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors group">
                                                            <input
                                                                type="checkbox"
                                                                checked={tagIds.includes(tag.id)}
                                                                onChange={() => handleTagToggle(tag.id)}
                                                                className={CHECKBOX_STYLE}
                                                            />
                                                            <div className="flex-1 flex items-center justify-between">
                                                                <span className="text-sm font-medium group-hover:text-primary-600 transition-colors">{tag.name}</span>
                                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                                                            </div>
                                                        </label>
                                                    )) : (
                                                      <div className="p-4 text-center text-sm text-gray-500">No tags found.</div>
                                                    )}
                                                </div>
                                            )}
                                      </div>
                                  </div>

                                  <div>
                                      <label className={labelStyle}>Location</label>
                                      <LocationAutocomplete
                                          value={locationString}
                                          onChange={(val, data) => {
                                              setLocationString(val);
                                              if (data) {
                                                setLocationData({
                                                    city: data.city,
                                                    country: data.country,
                                                    lat: data.lat,
                                                    lon: data.lon
                                                });
                                              }
                                          }}
                                      />
                                  </div>
                             </div>
                         )}
                     </div>
                 </div>
             </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-black/5 dark:border-white/5">
            <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Discard</button>
            <button type="submit" className={`${BTN_PRIMARY_STYLE} h-11 px-8`}>{saveButtonText}</button>
        </div>
      </form>
    </Modal>
  );
};

export default AddTransactionModal;