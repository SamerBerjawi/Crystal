import React, { useState, useMemo, useEffect, useRef, useId } from 'react';
import Modal from './Modal';
import { Account, Category, Transaction, Tag, Currency } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, CHECKBOX_STYLE, ALL_ACCOUNT_TYPES } from '../constants';
import { v4 as uuidv4 } from 'uuid';
import LocationAutocomplete from './LocationAutocomplete';
import { toLocalISOString, formatCurrency, fuzzySearch } from '../utils';
import { normalizeMerchantKey } from '../utils/brandfetch';
import { applyTransactionRulesToFields } from '../utils/rules';
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
    notes?: string;
  };
}

const CategoryOptions: React.FC<{ categories: Category[], showTransferOption?: boolean }> = ({ categories, showTransferOption }) => (
  <>
    <option className="bg-white dark:bg-gray-900 text-black dark:text-white" value="">Select Category</option>
    {showTransferOption && (
      <option className="bg-white dark:bg-gray-900 text-black dark:text-white font-semibold" value="Transfer">
        Transfer (Internal)
      </option>
    )}
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
  const transactionRules = usePreferencesSelector(p => p.transactionRules || []);

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
  const [notes, setNotes] = useState('');
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

  const applyRules = (merchantName: string, descText: string, amountText: string) => {
      // 1. Merchant rule - if merchant already exists/keys and has category configured, it takes absolute precedence!
      const key = normalizeMerchantKey(merchantName || descText);
      if (key) {
          const mRule = merchantRules[key];
          if (mRule && mRule.category) {
              setCategory(mRule.category);
              if (mRule.defaultDescription) {
                  setDescription(mRule.defaultDescription);
              }
              if (merchantName && merchantName !== merchant) {
                  setMerchant(merchantName);
              }
              return;
          }
      }

      // 2. Rule engine (IF-WHEN-THEN rules)
      const rawTx = {
          description: descText || '',
          merchant: merchantName || '',
          category: category || '',
          amount: parseFloat(amountText) || 0,
          type: type || 'expense'
      };

      const result = applyTransactionRulesToFields(rawTx, merchantRules, transactionRules);

      if (result.category) {
          setCategory(result.category);
      }
      if (result.merchant && result.merchant !== merchantName) {
          setMerchant(result.merchant);
      }
      if (result.description && result.description !== descText) {
          setDescription(result.description);
      }
  };

  const handleDescriptionBlur = () => {
    let currentMerchant = merchant;
    if (!merchant && description) {
        currentMerchant = description;
        setMerchant(currentMerchant);
    }
    applyRules(currentMerchant, description, amount);
  };

  const handleMerchantChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setMerchant(val);
      if (val.length > 2) {
          applyRules(val, description, amount);
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
            setCategory(transactionToEdit.category || 'Transfer');
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
            setNotes(transactionToEdit.notes || '');
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
        setNotes(initialDetails?.notes || '');
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
        if (type === 'transfer') {
            setCategory(initialCategory || 'Transfer');
        } else {
            setCategory(initialCategory || '');
        }
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
            category: category || 'Transfer',
            type: 'expense',
            currency: fromAcc.currency,
            transferId,
            tagIds,
            notes,
            ...locationProps
        };

        const incomeTx: Omit<Transaction, 'id'> & { id?: string } = {
            accountId: toAccountId,
            date,
            description: description || `Transfer from ${fromAcc.name}`,
            merchant: merchant || 'Internal Transfer',
            amount: Math.abs(totalAmount),
            category: category || 'Transfer',
            type: 'income',
            currency: toAcc.currency,
            transferId,
            tagIds,
            notes,
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
            notes,
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
  const labelStyle = "block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary  tracking-widest mb-1.5";

  return (
        <Modal onClose={onClose} title={modalTitle} size="5xl">
            {/* Smooth visual glowing spots */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[2.5rem]">
                <div className="absolute -top-32 -right-32 w-80 h-80 bg-primary-500/10 blur-[100px] rounded-full" />
                <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-rose-500/10 blur-[100px] rounded-full" />
                <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-cyan-500/5 blur-[80px] rounded-full" />
            </div>

            <form onSubmit={handleSubmit} className="relative z-10 font-sans">
                
                {/* Header Section: Type Selector & Hero Amount side-by-side */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-4 border-b border-light-separator dark:border-dark-separator mb-4">
                    {/* Segmented Type Control */}
                    <div className="w-full md:w-auto flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl border border-black/5 dark:border-white/5 md:min-w-[320px]">
                        <button
                            type="button"
                            onClick={() => setType('expense')}
                            className={`flex-1 py-1.5 text-xs font-black  tracking-widest rounded-lg transition-all ${type === 'expense' ? 'bg-white dark:bg-dark-card text-rose-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                        >
                            Expense
                        </button>
                        <button
                            type="button"
                            onClick={() => setType('income')}
                            className={`flex-1 py-1.5 text-xs font-black  tracking-widest rounded-lg transition-all ${type === 'income' ? 'bg-white dark:bg-dark-card text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                        >
                            Income
                        </button>
                        <button
                            type="button"
                            onClick={() => setType('transfer')}
                            className={`flex-1 py-1.5 text-xs font-black  tracking-widest rounded-lg transition-all ${type === 'transfer' ? 'bg-white dark:bg-dark-card text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                        >
                            Transfer
                        </button>
                    </div>

                    {/* Highly Compact Hero Amount */}
                    <div className="flex flex-col items-center md:items-end w-full md:w-auto shrink-0 pr-2">
                        <div className="relative group max-w-[260px] flex items-center justify-end">
                            <span className={`text-4xl font-light text-light-text-secondary dark:text-dark-text-secondary pointer-events-none mr-2 transition-all ${amount ? 'opacity-100' : 'opacity-40'}`}>
                                {currencySymbol}
                            </span>
                            <input 
                                id="tx-amount"
                                type="number" 
                                step="0.01" 
                                value={amount} 
                                onChange={e => setAmount(e.target.value)} 
                                onBlur={() => applyRules(merchant, description, amount)}
                                className="bg-transparent border-none text-right text-4xl font-black text-light-text dark:text-dark-text placeholder-black/5 dark:placeholder-white/5 focus:ring-0 py-0 tracking-tighter tabular-nums w-48" 
                                placeholder="0.00" 
                                autoFocus
                                required 
                                inputMode="decimal"
                                autoComplete="off"
                            />
                        </div>
                        {isLoanPayment && (
                            <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/15 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-full mt-1 border border-blue-100 dark:border-blue-800/20">
                                <span className="material-symbols-outlined text-xs">account_balance</span>
                                <span className="text-[11px] font-black  tracking-widest">Loan Payment Detected</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Primary Multi-Column Content Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                    
                    {/* Left Column: Core Fields */}
                    <div className="lg:col-span-7 space-y-4 flex flex-col justify-between">
                        <div className="bg-light-fill/30 dark:bg-dark-fill/20 p-4 rounded-2xl border border-black/5 dark:border-white/5 space-y-4">
                            <h3 className="text-xs font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2 mb-1">
                                <span className="material-symbols-outlined text-primary-500 text-base">assignment</span>
                                Core Information
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelStyle}>Execution Date</label>
                                    <div className="relative group">
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base">calendar_today</span>
                                        <input id="tx-date" type="date" value={date} onChange={e => setDate(e.target.value)} className={`${INPUT_BASE_STYLE} pl-9 h-10 font-bold text-sm`} required />
                                    </div>
                                </div>

                                <div ref={merchantContainerRef}>
                                    <label className={labelStyle}>Counterparty / Merchant</label>
                                    <div className="relative group">
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base">store</span>
                                        <div className="relative">
                                            <input
                                                id="tx-merchant"
                                                type="text"
                                                value={merchant}
                                                onChange={handleMerchantChange}
                                                onFocus={() => setShowMerchantSuggestions(true)}
                                                className={`${INPUT_BASE_STYLE} pl-9 h-10 font-bold text-sm`}
                                                placeholder="Who or where?"
                                                autoComplete="off"
                                            />
                                            {showMerchantSuggestions && filteredSuggestions.length > 0 && (
                                                <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-dark-card border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl z-[60] max-h-40 overflow-y-auto py-1">
                                                    {filteredSuggestions.map((name) => (
                                                        <button
                                                            key={name}
                                                            type="button"
                                                            onClick={() => {
                                                                setMerchant(name);
                                                                applyRules(name, description, amount);
                                                                setShowMerchantSuggestions(false);
                                                            }}
                                                            className="w-full text-left px-3.5 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/5 text-light-text dark:text-dark-text flex items-center justify-between transition-colors group"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <span className="material-symbols-outlined text-gray-400 text-sm group-hover:text-primary-500 transition-colors">history</span>
                                                                <span className="font-bold tracking-tight">{name}</span>
                                                            </div>
                                                            <span className="text-[11px] font-black  tracking-widest text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity">Select</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className={type === 'transfer' ? 'md:col-span-2' : ''}>
                                    <div className="flex flex-col sm:flex-row items-center gap-3">
                                        <div className="flex-1 w-full">
                                            <label className={labelStyle}>{type === 'income' ? 'Holding Account' : 'From Account'}</label>
                                            <div className={SELECT_WRAPPER_STYLE}>
                                                <select id="tx-account-1" value={type === 'income' ? toAccountId : fromAccountId} onChange={e => type === 'income' ? setToAccountId(e.target.value) : setFromAccountId(e.target.value)} className={`${SELECT_STYLE} h-10 font-bold text-sm`} required>
                                                    <option value="" disabled>Select account</option>
                                                    <AccountOptions accounts={accounts} />
                                                </select>
                                                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined text-sm">expand_more</span></div>
                                            </div>
                                        </div>
                                        
                                        {type === 'transfer' && (
                                            <>
                                                <div className="mt-5 text-primary-500 bg-primary-500/10 p-1.5 rounded-lg shrink-0">
                                                    <span className="material-symbols-outlined rotate-90 sm:rotate-0 text-sm font-bold">sync_alt</span>
                                                </div>
                                                <div className="flex-1 w-full">
                                                    <label className={labelStyle}>To Account</label>
                                                    <div className={SELECT_WRAPPER_STYLE}>
                                                        <select id="tx-account-2" value={toAccountId} onChange={e => setToAccountId(e.target.value)} className={`${SELECT_STYLE} h-10 font-bold text-sm`} required>
                                                            <option value="" disabled>Select account</option>
                                                            <AccountOptions accounts={accounts.filter(a => a.id !== fromAccountId)} />
                                                        </select>
                                                        <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined text-sm">expand_more</span></div>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {type !== 'transfer' ? (
                                    <div>
                                        <label className={labelStyle}>Category</label>
                                        <div className={SELECT_WRAPPER_STYLE}>
                                            <select id="tx-category" value={category} onChange={e => setCategory(e.target.value)} className={`${SELECT_STYLE} h-10 font-bold text-sm`} required>
                                                <CategoryOptions categories={activeCategories} />
                                            </select>
                                            <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined text-sm">expand_more</span></div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="md:col-span-2">
                                        <label className={labelStyle}>Category</label>
                                        <div className={SELECT_WRAPPER_STYLE}>
                                            <select id="tx-category" value={category} onChange={e => setCategory(e.target.value || 'Transfer')} className={`${SELECT_STYLE} h-10 font-bold text-sm`}>
                                                <CategoryOptions categories={activeCategories} showTransferOption />
                                            </select>
                                            <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined text-sm">expand_more</span></div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className={labelStyle}>Internal Memo / Description</label>
                                <div className="relative group">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base">description</span>
                                    <input 
                                        id="tx-description" 
                                        type="text" 
                                        value={description} 
                                        onChange={e => setDescription(e.target.value)} 
                                        onBlur={handleDescriptionBlur} 
                                        className={`${INPUT_BASE_STYLE} pl-9 h-10 font-medium text-sm`} 
                                        placeholder={type === 'transfer' ? 'Purpose of transfer' : 'What was this for?'} 
                                        required 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Loan Repayment Split */}
                        {isLoanPayment && (
                            <div className="bg-blue-500/5 dark:bg-blue-500/10 p-4 rounded-xl border border-blue-500/10 space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-black  tracking-widest text-blue-600">Amortization Split</span>
                                    <label className="flex items-center gap-1.5 cursor-pointer group">
                                        <input type="checkbox" checked={useAutoLoanSplit} onChange={e => setUseAutoLoanSplit(e.target.checked)} className={CHECKBOX_STYLE} />
                                        <span className="text-[11px] font-black  tracking-widest text-blue-400 group-hover:text-blue-500 transition-colors">Auto-Calc</span>
                                    </label>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-black  tracking-widest text-blue-400">Principal</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500/40 font-bold text-xs">{currencySymbol}</span>
                                            <input type="number" step="0.01" value={principalPayment} onChange={handlePrincipalChange} className="w-full h-9 bg-white dark:bg-black/20 rounded-lg pl-8 pr-3 text-xs font-black text-blue-600 tabular-nums border border-blue-500/5 focus:ring-2 focus:ring-blue-500 transition-all" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-black  tracking-widest text-blue-400">Interest</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500/40 font-bold text-xs">{currencySymbol}</span>
                                            <input type="number" step="0.01" value={interestPayment} onChange={handleInterestChange} className="w-full h-9 bg-white dark:bg-black/20 rounded-lg pl-8 pr-3 text-xs font-black text-rose-600 tabular-nums border border-blue-500/5 focus:ring-2 focus:ring-blue-500 transition-all" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Spare Change Configuration */}
                        {linkedSpareChangeAccount && (type === 'expense' || type === 'transfer') && (
                            <div className={`p-4 rounded-xl border transition-all duration-300 ${enableRoundUp ? 'bg-cyan-500/5 border-cyan-500/20' : 'bg-black/5 dark:bg-white/5 border-transparent opacity-65'}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${enableRoundUp ? 'bg-cyan-500 text-white shadow-md' : 'bg-gray-200 dark:bg-gray-800 text-gray-400'}`}>
                                            <span className="material-symbols-outlined text-sm font-bold">savings</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <h4 className={`text-xs font-bold tracking-tight ${enableRoundUp ? 'text-cyan-600' : 'text-gray-500'}`}>Spare Change Round-Up</h4>
                                            <span className="text-[11px] font-bold text-gray-400">Target: {linkedSpareChangeAccount.name}</span>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={enableRoundUp} onChange={e => setEnableRoundUp(e.target.checked)} className="sr-only peer" />
                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
                                    </label>
                                </div>

                                {enableRoundUp && (
                                    <div className="space-y-3 mt-3 animate-fade-in">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-black  tracking-widest text-cyan-600/60">Strategy</label>
                                                <div className="flex bg-white dark:bg-black/20 p-0.5 rounded-lg border border-cyan-500/10">
                                                    <button type="button" onClick={() => setRoundUpBehavior('skip')} className={`flex-1 py-1 text-[11px] font-black  tracking-wider rounded-md transition-all ${roundUpBehavior === 'skip' ? 'bg-cyan-500 text-white shadow-sm' : 'text-cyan-600 hover:bg-cyan-500/5'}`}>Skip Whole</button>
                                                    <button type="button" onClick={() => setRoundUpBehavior('unit')} className={`flex-1 py-1 text-[11px] font-black  tracking-wider rounded-md transition-all ${roundUpBehavior === 'unit' ? 'bg-cyan-500 text-white shadow-sm' : 'text-cyan-600 hover:bg-cyan-500/5'}`}>Unit Push</button>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-black  tracking-widest text-cyan-600/60">Multiplier</label>
                                                <input type="number" step="1" min="1" value={roundUpMultiplier} onChange={e => setRoundUpMultiplier(e.target.value)} className={`${INPUT_BASE_STYLE} !h-7 font-black text-cyan-600 text-xs border-cyan-500/10 focus:ring-cyan-500`} />
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/10">
                                            <span className="text-[11px] font-black  tracking-widest text-cyan-600">Calculated Sweep</span>
                                            <span className="text-xs font-black text-cyan-600 tabular-nums">{formatCurrency(adjustedRoundUpAmount, activeAccount?.currency || 'EUR')}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Column: Metadata & Context */}
                    <div className="lg:col-span-5 space-y-4">
                        <div className="bg-light-fill/30 dark:bg-dark-fill/20 p-4 rounded-2xl border border-black/5 dark:border-white/5 space-y-4 h-full flex flex-col justify-between">
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2 mb-1">
                                    <span className="material-symbols-outlined text-primary-500 text-base">style</span>
                                    Metadata & Context
                                </h3>

                                {/* Beautiful direct visual tags select list */}
                                <div>
                                    <label className={labelStyle}>Categorical Tags</label>
                                    {tags.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto p-2 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
                                            {tags.map(tag => {
                                                const isSelected = tagIds.includes(tag.id);
                                                return (
                                                    <button
                                                        key={tag.id}
                                                        type="button"
                                                        onClick={() => handleTagToggle(tag.id)}
                                                        className={`px-2 py-1 rounded-lg text-[11px] font-black  tracking-wider transition-all border ${
                                                            isSelected 
                                                                ? 'scale-[1.02] shadow-sm' 
                                                                : 'border-transparent bg-gray-200/50 dark:bg-gray-800/10 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800/20'
                                                        }`}
                                                        style={isSelected ? { backgroundColor: `${tag.color}20`, color: tag.color, borderColor: tag.color } : {}}
                                                    >
                                                        <span className="inline-block w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: tag.color }} />
                                                        {tag.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-2.5 border border-dashed border-black/10 dark:border-white/10 rounded-xl text-gray-400 text-[11px] font-bold  tracking-widest">
                                            No Tags Defined
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className={labelStyle}>Geographic Location</label>
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

                            <div className="pt-2">
                                <label className={labelStyle}>Extended Notes</label>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    className={`${INPUT_BASE_STYLE} min-h-[64px] p-2.5 text-xs font-medium resize-none border-dashed bg-transparent`}
                                    placeholder="Add contextual remarks or details..."
                                />
                            </div>
                        </div>
                    </div>

                </div>

                {/* Sticky Footer Action Bar */}
                <div className="flex justify-end gap-3 pt-3 mt-4 border-t border-light-separator dark:border-dark-separator">
                    <button type="button" onClick={onClose} className={`${BTN_SECONDARY_STYLE} !py-2 !text-xs`}>Dismiss</button>
                    <button type="submit" className={`${BTN_PRIMARY_STYLE} px-6 !py-2 !text-xs animate-glow`}>{isEditing ? 'Sync Changes' : 'Confirm Transaction'}</button>
                </div>
            </form>
        </Modal>
    );
};

export default AddTransactionModal;
