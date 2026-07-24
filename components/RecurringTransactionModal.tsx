
import React, { useState, useMemo, useEffect } from 'react';
import Modal from './Modal';
import { Account, Category, RecurringTransaction, RecurrenceFrequency, WeekendAdjustment } from '../types';
import { INPUT_BASE_STYLE, SELECT_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, FREQUENCIES, WEEKEND_ADJUSTMENTS, ALL_ACCOUNT_TYPES } from '../constants';
import { parseLocalDate, toLocalISOString } from '../utils';

interface RecurringTransactionModalProps {
    onClose: () => void;
    onSave: (transaction: Omit<RecurringTransaction, 'id'> & { id?: string }) => void;
    accounts: Account[];
    incomeCategories: Category[];
    expenseCategories: Category[];
    recurringTransactionToEdit?: (Omit<RecurringTransaction, 'id'> & { id?: string }) | null;
}

const CategoryOptions: React.FC<{ categories: Category[], showTransferOption?: boolean }> = ({ categories, showTransferOption }) => (
  <>
    <option value="">Select a category</option>
    {showTransferOption && (
      <option value="Transfer">Transfer</option>
    )}
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
    const [merchant, setMerchant] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
    const [frequencyInterval, setFrequencyInterval] = useState('1');
    const [startDate, setStartDate] = useState(toLocalISOString(new Date()));
    const [endDate, setEndDate] = useState('');
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
            setMerchant(recurringTransactionToEdit.merchant || '');
            setAmount(String(recurringTransactionToEdit.amount));
            setCategory(recurringTransactionToEdit.category || '');
            setFrequency(recurringTransactionToEdit.frequency);
            setFrequencyInterval(String(recurringTransactionToEdit.frequencyInterval || '1'));
            setStartDate(recurringTransactionToEdit.startDate);
            setEndDate(recurringTransactionToEdit.endDate || '');
            setWeekendAdjustment(recurringTransactionToEdit.weekendAdjustment || 'on');
            setDueDateOfMonth(String(recurringTransactionToEdit.dueDateOfMonth || ''));
        } else {
            // Reset for new
            setType('expense');
            setAccountId(accounts.length > 0 ? accounts[0].id : '');
            setToAccountId(accounts.length > 1 ? accounts[1].id : '');
            setDescription('');
            setMerchant('');
            setAmount('');
            setCategory('');
            setFrequency('monthly');
            setFrequencyInterval('1');
            setStartDate(toLocalISOString(new Date()));
            setEndDate('');
            setWeekendAdjustment('on');
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
            if (type === 'transfer') {
                setCategory('Transfer');
            } else {
                setCategory('');
            }
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

        const start = parseLocalDate(startDate);
        let nextDue = new Date(start);

        if ((frequency === 'monthly' || frequency === 'yearly') && dueDateOfMonth) {
            const day = parseInt(dueDateOfMonth, 10);
            nextDue.setDate(day);
            if (nextDue < start) {
                nextDue.setMonth(nextDue.getMonth() + 1);
            }
        }

        const firstDueDate = toLocalISOString(nextDue);

        const dataToSave: Omit<RecurringTransaction, 'id'> & { id?: string } = {
            id: isEditing ? recurringTransactionToEdit.id : undefined,
            accountId,
            toAccountId: isTransfer ? toAccountId : undefined,
            description,
            merchant,
            amount: parseFloat(amount),
            category: isTransfer ? (category || 'Transfer') : category,
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

    const labelStyle = "block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary  tracking-wider mb-1.5";
    
    return (
        <Modal onClose={onClose} title={isEditing ? 'Renewal Policies' : 'New Service'} size="lg">
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[2.5rem]">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-500/10 blur-[80px] rounded-full" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-rose-500/10 blur-[80px] rounded-full" />
            </div>

            <form onSubmit={handleSubmit} className="relative z-10 space-y-6">

                {/* Type Segmented Control */}
                <div className="flex bg-gray-100 dark:bg-white/10 p-1 rounded-2xl border border-black/5 dark:border-white/5">
                    <button
                        type="button"
                        onClick={() => setType('expense')}
                        className={`flex-1 py-2.5 text-xs font-black  tracking-widest rounded-xl transition-all ${type === 'expense' ? 'bg-white dark:bg-dark-card text-rose-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    >
                        Expense
                    </button>
                    <button
                        type="button"
                        onClick={() => setType('income')}
                        className={`flex-1 py-2.5 text-xs font-black  tracking-widest rounded-xl transition-all ${type === 'income' ? 'bg-white dark:bg-dark-card text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    >
                        Income
                    </button>
                    <button
                        type="button"
                        onClick={() => setType('transfer')}
                        className={`flex-1 py-2.5 text-xs font-black  tracking-widest rounded-xl transition-all ${type === 'transfer' ? 'bg-white dark:bg-dark-card text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    >
                        Transfer
                    </button>
                </div>

                {/* Main Inputs */}
                <div className="bg-light-fill dark:bg-dark-fill/50 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-1">
                            <label htmlFor="rec-amount" className={labelStyle}>Amount</label>
                            <div className="relative">
                                <input id="rec-amount" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className={`${INPUT_BASE_STYLE} !pl-10 !text-xl font-black h-14 tabular-nums`} placeholder="0.00" required />
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-light-text-secondary select-none">€</span>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="rec-category" className={labelStyle}>Category</label>
                            <div className={SELECT_WRAPPER_STYLE}>
                                <select id="rec-category" value={category} onChange={e => setCategory(e.target.value)} className={`${SELECT_STYLE} h-14`} required={type !== 'transfer'}>
                                    <CategoryOptions categories={activeCategories} showTransferOption={type === 'transfer'} />
                                </select>
                                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Description & Merchant */}
                    {type !== 'transfer' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="rec-merchant" className={labelStyle}>Merchant</label>
                                <input id="rec-merchant" type="text" value={merchant} onChange={e => setMerchant(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-bold`} placeholder="e.g., Netflix" />
                            </div>
                            <div>
                                <label htmlFor="rec-description" className={labelStyle}>Internal Description</label>
                                <input id="rec-description" type="text" value={description} onChange={e => setDescription(e.target.value)} className={`${INPUT_BASE_STYLE} h-14`} placeholder="e.g., Monthly Subscription" required />
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label htmlFor="rec-description" className={labelStyle}>Description</label>
                            <input id="rec-description" type="text" value={description} onChange={e => setDescription(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-bold`} placeholder="e.g., Savings Transfer" required />
                        </div>
                    )}
                    
                    {/* Account Selection */}
                    {type === 'transfer' ? (
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <label htmlFor="rec-from-account" className={labelStyle}>From</label>
                                <div className={SELECT_WRAPPER_STYLE}>
                                    <select id="rec-from-account" value={accountId} onChange={e => setAccountId(e.target.value)} className={`${SELECT_STYLE} h-14 font-bold`} required>
                                        <option value="" disabled>Select account</option>
                                        <AccountOptions accounts={availableAccounts.filter(a => a.id !== toAccountId)} />
                                    </select>
                                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                </div>
                            </div>
                            <div className="pt-6 text-gray-400">
                                 <span className="material-symbols-outlined">sync_alt</span>
                            </div>
                            <div className="flex-1">
                                <label htmlFor="rec-to-account" className={labelStyle}>To</label>
                                <div className={SELECT_WRAPPER_STYLE}>
                                    <select id="rec-to-account" value={toAccountId} onChange={e => setToAccountId(e.target.value)} className={`${SELECT_STYLE} h-14 font-bold`} required>
                                        <option value="" disabled>Select account</option>
                                        <AccountOptions accounts={availableAccounts.filter(a => a.id !== accountId)} />
                                    </select>
                                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label htmlFor="rec-account" className={labelStyle}>Payment Method / Account</label>
                            <div className={SELECT_WRAPPER_STYLE}>
                                <select id="rec-account" value={accountId} onChange={e => setAccountId(e.target.value)} className={`${SELECT_STYLE} h-14 font-bold`} required>
                                    <option value="" disabled>Select an account</option>
                                    <AccountOptions accounts={availableAccounts} />
                                </select>
                                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Schedule Rules Card */}
                <div className="p-6 bg-white dark:bg-black/20 rounded-3xl border border-black/5 dark:border-white/5 space-y-6">
                    <h4 className="text-xs font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary-500 text-lg">event_repeat</span>
                        Schedule Configuration
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div>
                            <label htmlFor="rec-frequency" className={labelStyle}>Repeats Every</label>
                            <div className="flex items-center gap-3">
                                {frequency !== 'daily' && <input type="number" value={frequencyInterval} onChange={e => setFrequencyInterval(e.target.value)} className={`${INPUT_BASE_STYLE} w-24 text-center font-black h-12`} min="1" />}
                                <div className={`${SELECT_WRAPPER_STYLE} flex-1`}>
                                    <select id="rec-frequency" value={frequency} onChange={e => setFrequency(e.target.value as RecurrenceFrequency)} className={`${SELECT_STYLE} font-bold h-12`}>
                                        {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                    </select>
                                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                </div>
                            </div>
                        </div>
                         <div>
                            <label htmlFor="rec-weekend-adjustment" className={labelStyle}>Weekend Logic</label>
                             <div className={SELECT_WRAPPER_STYLE}>
                                <select id="rec-weekend-adjustment" value={weekendAdjustment} onChange={e => setWeekendAdjustment(e.target.value as WeekendAdjustment)} className={`${SELECT_STYLE} h-12`}>
                                    {WEEKEND_ADJUSTMENTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="rec-start-date" className={labelStyle}>Lifecycle Start</label>
                            <input id="rec-start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={`${INPUT_BASE_STYLE} h-12`} required />
                        </div>
                        <div>
                            <label htmlFor="rec-end-date" className={labelStyle}>Automatic Termination</label>
                            <input id="rec-end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={`${INPUT_BASE_STYLE} h-12`} placeholder="Optional" />
                        </div>
                    </div>

                    {(frequency === 'monthly' || frequency === 'yearly') && (
                        <div className="bg-light-fill dark:bg-white/5 p-4 rounded-2xl border border-black/5 dark:border-white/5 flex items-center gap-4">
                            <div className="shrink-0">
                                <label htmlFor="rec-due-date" className={labelStyle}>Day of Month</label>
                                <input id="rec-due-date" type="number" min="1" max="31" value={dueDateOfMonth} onChange={e => setDueDateOfMonth(e.target.value)} className={`${INPUT_BASE_STYLE} w-24 text-center font-black h-12`} placeholder="Day" />
                            </div>
                            <p className="text-xs font-medium text-light-text-secondary/60 dark:text-dark-text-secondary/60 leading-relaxed">
                                Explicit billing day. If left empty, we'll sync it with the start date of the first occurrence.
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t border-black/5 dark:border-white/5">
                    <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Dismiss</button>
                    <button type="submit" className={`${BTN_PRIMARY_STYLE} px-8 animate-glow`}>{isEditing ? 'Update Policy' : 'Confirm Policy'}</button>
                </div>
            </form>
        </Modal>
    );
};

export default RecurringTransactionModal;
