import React, { useState, useMemo, useEffect } from 'react';
import Modal from './Modal';
import { Account, Category, Transaction } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE } from '../constants';
import { v4 as uuidv4 } from 'uuid';

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


const AddTransactionModal: React.FC<AddTransactionModalProps> = ({ onClose, onSave, accounts, incomeCategories, expenseCategories, transactions, transactionToEdit, initialType, initialFromAccountId, initialToAccountId }) => {
  const isEditing = !!transactionToEdit;
  
  const [type, setType] = useState<'expense' | 'income' | 'transfer'>(isEditing ? (transactionToEdit.transferId ? 'transfer' : transactionToEdit.type) : (initialType || 'expense'));
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [fromAccountId, setFromAccountId] = useState(accounts.length > 0 ? accounts[0].id : '');
  const [toAccountId, setToAccountId] = useState(accounts.length > 1 ? accounts[1].id : '');
  const [description, setDescription] = useState('');
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  
  // Loan payment split state
  const [principalPayment, setPrincipalPayment] = useState('');
  const [interestPayment, setInterestPayment] = useState('');
  const [lastPaymentFieldEdited, setLastPaymentFieldEdited] = useState<'total' | 'principal' | 'interest' | null>(null);

  const isLoanPayment = useMemo(() => {
    const targetAccountId = type === 'income' ? toAccountId : (type === 'transfer' ? toAccountId : null);
    if (!targetAccountId) return false;
    const targetAccount = accounts.find(a => a.id === targetAccountId);
    return targetAccount?.type === 'Loan';
  }, [type, toAccountId, accounts]);

  useEffect(() => {
    const total = parseFloat(amount);
    const principal = parseFloat(principalPayment);
    const interest = parseFloat(interestPayment);

    if (lastPaymentFieldEdited === 'total') {
        if (!isNaN(total) && !isNaN(principal)) {
            setInterestPayment((total - principal).toFixed(2));
        }
    } else if (lastPaymentFieldEdited === 'principal' || lastPaymentFieldEdited === 'interest') {
        if (!isNaN(principal) && !isNaN(interest)) {
            setAmount((principal + interest).toFixed(2));
        }
    }
  }, [amount, principalPayment, interestPayment, lastPaymentFieldEdited]);


  useEffect(() => {
    if (isEditing && transactionToEdit) {
        let principal = '';
        let interest = '';
        let amountToSet = String(Math.abs(transactionToEdit.amount));

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
                setFromAccountId(accounts.length > 0 ? accounts[0].id : '');
            } else {
                setFromAccountId(transactionToEdit.accountId);
                setToAccountId(accounts.length > 1 ? accounts[1].id : '');
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
        setDate(new Date().toISOString().split('T')[0]);
        setFromAccountId(initialFromAccountId || (accounts.length > 0 ? accounts[0].id : ''));
        setToAccountId(initialToAccountId || (accounts.length > 1 ? accounts[1].id : ''));
        setDescription('');
        setMerchant('');
        setAmount('');
        setCategory('');
        setPrincipalPayment('');
        setInterestPayment('');
    }
  }, [transactionToEdit, isEditing, accounts, transactions, initialType, initialFromAccountId, initialToAccountId]);
  
  const activeCategories = useMemo(() => {
    return type === 'income' ? incomeCategories : expenseCategories;
  }, [type, incomeCategories, expenseCategories]);
  
  useEffect(() => {
    if (!isEditing) {
        setCategory('');
    }
  }, [type, isEditing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;

    let toSave: (Omit<Transaction, 'id'> & { id?: string })[] = [];
    let toDelete: string[] = [];

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
            amount: -Math.abs(parseFloat(amount)),
            category: 'Transfer',
            type: 'expense',
            currency: fromAcc.currency,
            transferId,
        };

        const incomeTx: Omit<Transaction, 'id'> & { id?: string } = {
            accountId: toAccountId,
            date,
            description: description || `Transfer from ${fromAcc.name}`,
            merchant: merchant || 'Internal Transfer',
            amount: Math.abs(parseFloat(amount)),
            category: 'Transfer',
            type: 'income',
            currency: toAcc.currency,
            transferId,
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
            amount: type === 'expense' ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount)),
            category,
            type,
            currency: selectedAccount.currency,
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
                      {accounts.filter(a => a.id !== toAccountId).map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                    </select>
                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                  </div>
              </div>
              <div>
                  <label htmlFor="tx-to-account" className={labelStyle}>To</label>
                   <div className={SELECT_WRAPPER_STYLE}>
                    <select id="tx-to-account" value={toAccountId} onChange={e => setToAccountId(e.target.value)} className={INPUT_BASE_STYLE} required>
                      {accounts.filter(a => a.id !== fromAccountId).map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
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
                  {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                </select>
                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
              </div>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="tx-amount" className={labelStyle}>{isLoanPayment ? 'Total Payment' : 'Amount'}</label>
              <input id="tx-amount" type="number" step="0.01" value={amount} onFocus={() => setLastPaymentFieldEdited('total')} onChange={e => {setAmount(e.target.value); setLastPaymentFieldEdited('total');}} className={INPUT_BASE_STYLE} placeholder="0.00" required />
            </div>
             <div>
              <label htmlFor="tx-date" className={labelStyle}>Date</label>
              <input id="tx-date" type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT_BASE_STYLE} required />
            </div>
        </div>
        
        {isLoanPayment && (
            <div className="p-4 bg-black/5 dark:bg-white/5 rounded-lg space-y-2">
                <p className="font-medium text-sm">Loan Payment Breakdown</p>
                <div className="grid grid-cols-2 gap-4">
                    <div><label htmlFor="principal-payment" className={labelStyle}>Principal</label><input id="principal-payment" type="number" step="0.01" value={principalPayment} onFocus={() => setLastPaymentFieldEdited('principal')} onChange={e => {setPrincipalPayment(e.target.value); setLastPaymentFieldEdited('principal');}} className={INPUT_BASE_STYLE} placeholder="0.00" /></div>
                    <div><label htmlFor="interest-payment" className={labelStyle}>Interest</label><input id="interest-payment" type="number" step="0.01" value={interestPayment} onFocus={() => setLastPaymentFieldEdited('interest')} onChange={e => {setInterestPayment(e.target.value); setLastPaymentFieldEdited('interest');}} className={INPUT_BASE_STYLE} placeholder="0.00" /></div>
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
          <label htmlFor="tx-description" className={labelStyle}>Description</label>
          <input id="tx-description" type="text" value={description} onChange={e => setDescription(e.target.value)} className={INPUT_BASE_STYLE} placeholder={type === 'transfer' ? 'e.g., Monthly savings' : 'e.g., Groceries'} required />
        </div>

        {type !== 'transfer' && (
            <div>
              <label htmlFor="tx-category" className={labelStyle}>Category</label>
              <div className={SELECT_WRAPPER_STYLE}>
                <select id="tx-category" value={category} onChange={e => setCategory(e.target.value)} className={INPUT_BASE_STYLE} required>
                  <CategoryOptions categories={activeCategories} />
                </select>
                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
              </div>
            </div>
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