

import React, { useState, useMemo, useEffect } from 'react';
import Modal from './Modal';
import { Account, Category, RecurringTransaction, RecurrenceFrequency, WeekendAdjustment } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, FREQUENCIES, WEEKEND_ADJUSTMENTS, ALL_ACCOUNT_TYPES } from '../constants';

interface RecurringTransactionModalProps {
    onClose: () => void;
    onSave: (transaction: Omit<RecurringTransaction, 'id'> & { id?: string }) => void;
    accounts: Account[];
    incomeCategories: Category[];
    expenseCategories: Category[];
    // FIX: Updated the type to allow an optional 'id' property, aligning it with how new recurring transactions are initialized and passed from the parent component.
    recurringTransactionToEdit?: (Omit<RecurringTransaction, 'id'> & { id?: string }) | null;
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


const RecurringTransactionModal: React.FC<RecurringTransactionModalProps> = ({ onClose, onSave, accounts, incomeCategories, expenseCategories, recurringTransactionToEdit }) => {
    const isEditing = !!recurringTransactionToEdit;

    const [type, setType] = useState<'expense' | 'income' | 'transfer'>('expense');
    const [accountId, setAccountId] = useState(accounts.length > 0 ? accounts[0].id : ''); // From account
    const [toAccountId, setToAccountId] = useState(accounts.length > 1 ? accounts[1].id : ''); // To account (for transfers)
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
    const [frequencyInterval, setFrequencyInterval] = useState('1');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState('');
    const [nextDueDate, setNextDueDate] = useState('');
    const [weekendAdjustment, setWeekendAdjustment] = useState<WeekendAdjustment>('on');
    const [dueDateOfMonth, setDueDateOfMonth] = useState('');


    useEffect(() => {
        if (isEditing && recurringTransactionToEdit) {
            setType(recurringTransactionToEdit.type);
            setAccountId(recurringTransactionToEdit.accountId);
            if(recurringTransactionToEdit.type === 'transfer') {
                setToAccountId(recurringTransactionToEdit.toAccountId || '');
            }
            setDescription(recurringTransactionToEdit.description);
            setAmount(String(recurringTransactionToEdit.amount));
            setCategory(recurringTransactionToEdit.category || '');
            setFrequency(recurringTransactionToEdit.frequency);
            setFrequencyInterval(String(recurringTransactionToEdit.frequencyInterval || '1'));
            setStartDate(recurringTransactionToEdit.startDate);
            setNextDueDate(recurringTransactionToEdit.nextDueDate);
            setEndDate(recurringTransactionToEdit.endDate || '');
            setWeekendAdjustment(recurringTransactionToEdit.weekendAdjustment || 'on');
            setDueDateOfMonth(String(recurringTransactionToEdit.dueDateOfMonth || ''));
        } else {
            // Reset for new
            setType('expense');
            setAccountId(accounts.length > 0 ? accounts[0].id : '');
            setToAccountId(accounts.length > 1 ? accounts[1].id : '');
            setDescription('');
            setAmount('');
            setCategory('');
            setFrequency('monthly');
            setFrequencyInterval('1');
            setStartDate(new Date().toISOString().split('T')[0]);
            setEndDate('');
            setWeekendAdjustment('on');
            setNextDueDate('');
            setDueDateOfMonth('');
        }
    }, [recurringTransactionToEdit, isEditing, accounts]);

    const activeCategories = useMemo(() => {
        return type === 'income' ? incomeCategories : expenseCategories;
    }, [type, incomeCategories, expenseCategories]);
    
    const availableAccounts = useMemo(() => {
        return accounts.filter(acc => acc.status !== 'closed' || acc.id === accountId || acc.id === toAccountId);
    }, [accounts, accountId, toAccountId]);

    useEffect(() => {
        if (!isEditing) {
            setCategory('');
        }
    }, [type, isEditing]);

    useEffect(() => {
        // Reset interval to 1 if frequency is daily
        if (frequency === 'daily') {
            setFrequencyInterval('1');
        }
    }, [frequency]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const isTransfer = type === 'transfer';
        const isMissingCategory = !isTransfer && !category;
        const isMissingToAccount = isTransfer && !toAccountId;
        const interval = parseInt(frequencyInterval, 10);

        if (!amount || !accountId || !startDate || isMissingCategory || isMissingToAccount || !interval || interval < 1) {
            alert("Please fill in all required fields with valid values.");
            return;
        }

        const fromAccount = accounts.find(acc => acc.id === accountId);
        if (!fromAccount) {
            alert("Selected 'from' account is invalid.");
            return;
        }

        const start = new Date(`${startDate}T12:00:00Z`); // Use noon to avoid timezone issues
        let nextDue = new Date(start);

        if ((frequency === 'monthly' || frequency === 'yearly') && dueDateOfMonth) {
            const day = parseInt(dueDateOfMonth, 10);
            nextDue.setUTCDate(day);
            if (nextDue < start) {
                nextDue.setUTCMonth(nextDue.getUTCMonth() + 1);
            }
        }

        const firstDueDate = nextDue.toISOString().split('T')[0];

        const dataToSave: Omit<RecurringTransaction, 'id'> & { id?: string } = {
            id: isEditing ? recurringTransactionToEdit.id : undefined,
            accountId,
            toAccountId: isTransfer ? toAccountId : undefined,
            description,
            amount: parseFloat(amount),
            category: isTransfer ? 'Transfer' : category,
            type,
            currency: fromAccount.currency,
            frequency,
            frequencyInterval: interval,
            startDate,
            endDate: endDate || undefined,
            nextDueDate: firstDueDate,
            dueDateOfMonth: (frequency === 'monthly' || frequency === 'yearly') && dueDateOfMonth ? parseInt(dueDateOfMonth) : undefined,
            weekendAdjustment,
        };

        onSave(dataToSave);
    };

    const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";
    const typeFilterOptions: { label: string; value: 'expense' | 'income' | 'transfer' }[] = [
        { label: 'Expense', value: 'expense' },
        { label: 'Income', value: 'income' },
        { label: 'Transfer', value: 'transfer' },
    ];

    const modalTitle = isEditing ? 'Edit Recurring Transaction' : 'Add Recurring Transaction';
    const saveButtonText = isEditing ? 'Save Changes' : 'Add Recurring';

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
                            <label htmlFor="rec-from-account" className={labelStyle}>From</label>
                            <div className={SELECT_WRAPPER_STYLE}>
                                <select id="rec-from-account" value={accountId} onChange={e => setAccountId(e.target.value)} className={INPUT_BASE_STYLE} required>
                                    <option value="" disabled>Select account</option>
                                    <AccountOptions accounts={availableAccounts.filter(a => a.id !== toAccountId)} />
                                </select>
                                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="rec-to-account" className={labelStyle}>To</label>
                            <div className={SELECT_WRAPPER_STYLE}>
                                <select id="rec-to-account" value={toAccountId} onChange={e => setToAccountId(e.target.value)} className={INPUT_BASE_STYLE} required>
                                    <option value="" disabled>Select account</option>
                                    <AccountOptions accounts={availableAccounts.filter(a => a.id !== accountId)} />
                                </select>
                                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div>
                        <label htmlFor="rec-account" className={labelStyle}>Account</label>
                        <div className={SELECT_WRAPPER_STYLE}>
                            <select id="rec-account" value={accountId} onChange={e => setAccountId(e.target.value)} className={INPUT_BASE_STYLE} required>
                                <option value="" disabled>Select an account</option>
                                <AccountOptions accounts={availableAccounts} />
                            </select>
                            <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                        </div>
                    </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="rec-amount" className={labelStyle}>Amount</label>
                        <input id="rec-amount" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className={INPUT_BASE_STYLE} placeholder="0.00" required />
                    </div>
                    {type !== 'transfer' && (
                        <div>
                            <label htmlFor="rec-category" className={labelStyle}>Category</label>
                            <div className={SELECT_WRAPPER_STYLE}>
                                <select id="rec-category" value={category} onChange={e => setCategory(e.target.value)} className={INPUT_BASE_STYLE} required>
                                    <CategoryOptions categories={activeCategories} />
                                </select>
                                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                            </div>
                        </div>
                    )}
                </div>

                <div>
                    <label htmlFor="rec-description" className={labelStyle}>Description</label>
                    <input id="rec-description" type="text" value={description} onChange={e => setDescription(e.target.value)} className={INPUT_BASE_STYLE} placeholder={type === 'transfer' ? 'e.g., Monthly savings' : 'e.g., Netflix Subscription'} required />
                </div>
                
                <div className="p-4 bg-black/5 dark:bg-white/5 rounded-lg space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label htmlFor="rec-frequency" className={labelStyle}>Frequency</label>
                            <div className="flex items-center gap-2">
                                {frequency !== 'daily' && <input type="number" value={frequencyInterval} onChange={e => setFrequencyInterval(e.target.value)} className={`${INPUT_BASE_STYLE} w-20`} min="1" />}
                                <div className={`${SELECT_WRAPPER_STYLE} flex-1`}>
                                    <select id="rec-frequency" value={frequency} onChange={e => setFrequency(e.target.value as RecurrenceFrequency)} className={INPUT_BASE_STYLE}>
                                        {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                    </select>
                                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                </div>
                            </div>
                        </div>
                         <div>
                            <label htmlFor="rec-weekend-adjustment" className={labelStyle}>If on a weekend</label>
                             <div className={SELECT_WRAPPER_STYLE}>
                                <select id="rec-weekend-adjustment" value={weekendAdjustment} onChange={e => setWeekendAdjustment(e.target.value as WeekendAdjustment)} className={INPUT_BASE_STYLE}>
                                    {WEEKEND_ADJUSTMENTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                            </div>
                        </div>
                    </div>
                    {(frequency === 'monthly' || frequency === 'yearly') && (
                        <div>
                            <label htmlFor="rec-due-date" className={labelStyle}>Day of Month (Optional)</label>
                            <input id="rec-due-date" type="number" min="1" max="31" value={dueDateOfMonth} onChange={e => setDueDateOfMonth(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g., 15 (uses start date's day if empty)" />
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                Specify the day of the month for this transaction to occur.
                            </p>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="rec-start-date" className={labelStyle}>Start Date</label>
                            <input id="rec-start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={INPUT_BASE_STYLE} required />
                        </div>
                        <div>
                            <label htmlFor="rec-end-date" className={labelStyle}>End Date (Optional)</label>
                            <input id="rec-end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={INPUT_BASE_STYLE} />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-4 pt-4">
                    <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                    <button type="submit" className={BTN_PRIMARY_STYLE}>{saveButtonText}</button>
                </div>
            </form>
        </Modal>
    );
};

export default RecurringTransactionModal;