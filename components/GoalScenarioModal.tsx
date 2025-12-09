
import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import { FinancialGoal, GoalType, RecurrenceFrequency, Account } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, FREQUENCIES, ALL_ACCOUNT_TYPES } from '../constants';
import { toLocalISOString } from '../utils';

interface GoalScenarioModalProps {
    onClose: () => void;
    onSave: (goal: Omit<FinancialGoal, 'id'> & { id?: string }) => void;
    goalToEdit?: FinancialGoal | null;
    financialGoals: FinancialGoal[];
    parentId?: string;
    accounts: Account[];
}

const GoalScenarioModal: React.FC<GoalScenarioModalProps> = ({ onClose, onSave, goalToEdit, financialGoals, parentId: preselectedParentId, accounts }) => {
    const isEditing = !!goalToEdit;

    const [name, setName] = useState('');
    const [type, setType] = useState<GoalType>('one-time');
    const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense');
    const [amount, setAmount] = useState('');
    const [currentAmount, setCurrentAmount] = useState('0');
    const [date, setDate] = useState(toLocalISOString(new Date()));
    const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
    const [startDate, setStartDate] = useState(toLocalISOString(new Date()));
    const [monthlyContribution, setMonthlyContribution] = useState('');
    const [dueDateOfMonth, setDueDateOfMonth] = useState('');
    const [isBucket, setIsBucket] = useState(false);
    const [parentId, setParentId] = useState<string | undefined>(preselectedParentId);
    const [paymentAccountId, setPaymentAccountId] = useState<string | undefined>();

    const parentGoalOptions = useMemo(() => 
        financialGoals.filter(g => (g.isBucket || !g.parentId) && g.id !== goalToEdit?.id),
    [financialGoals, goalToEdit]);
    
    const groupedAccounts = useMemo(() => {
        const groups: Record<string, Account[]> = {};
        accounts.forEach(acc => {
          if (!groups[acc.type]) groups[acc.type] = [];
          groups[acc.type].push(acc);
        });
        return groups;
    }, [accounts]);

    useEffect(() => {
        if (isEditing && goalToEdit) {
            setName(goalToEdit.name);
            setType(goalToEdit.type);
            setTransactionType(goalToEdit.transactionType);
            setAmount(String(goalToEdit.amount));
            setCurrentAmount(String(goalToEdit.currentAmount || 0));
            setDate(goalToEdit.date || toLocalISOString(new Date()));
            setFrequency(goalToEdit.frequency || 'monthly');
            setStartDate(goalToEdit.startDate || toLocalISOString(new Date()));
            setMonthlyContribution(String(goalToEdit.monthlyContribution || ''));
            setDueDateOfMonth(String(goalToEdit.dueDateOfMonth || ''));
            setIsBucket(!!goalToEdit.isBucket);
            setParentId(goalToEdit.parentId);
            setPaymentAccountId(goalToEdit.paymentAccountId);
        } else {
            setName('');
            setType('one-time');
            setTransactionType('expense');
            setAmount('');
            setCurrentAmount('0');
            setDate(toLocalISOString(new Date()));
            setFrequency('monthly');
            setStartDate(toLocalISOString(new Date()));
            setMonthlyContribution('');
            setDueDateOfMonth('');
            setIsBucket(false);
            setParentId(preselectedParentId);
            setPaymentAccountId(undefined);
        }
    }, [isEditing, goalToEdit, preselectedParentId]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const goalData = {
            id: isEditing ? goalToEdit.id : undefined,
            name,
            type: isBucket ? 'one-time' : type,
            transactionType: isBucket ? 'expense' : transactionType,
            amount: isBucket ? 0 : parseFloat(amount),
            currentAmount: isBucket ? 0 : parseFloat(currentAmount),
            currency: 'EUR' as const,
            date: isBucket ? undefined : type === 'one-time' ? date : undefined,
            frequency: isBucket ? undefined : type === 'recurring' ? frequency : undefined,
            startDate: isBucket ? undefined : type === 'recurring' ? startDate : undefined,
            monthlyContribution: isBucket ? undefined : type === 'recurring' && monthlyContribution ? parseFloat(monthlyContribution) : undefined,
            dueDateOfMonth: isBucket ? undefined : type === 'recurring' && (frequency === 'monthly' || frequency === 'yearly') && dueDateOfMonth ? parseInt(dueDateOfMonth) : undefined,
            isBucket,
            parentId: isBucket ? undefined : parentId,
            paymentAccountId: isBucket ? undefined : paymentAccountId,
        };
        onSave(goalData);
        onClose();
    };

    const isSubGoal = !!parentId;
    const labelStyle = "block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1.5";
    const modalTitle = isEditing ? 'Edit Goal' : (isSubGoal ? 'Add Item to Goal' : 'New Goal');

    return (
        <Modal onClose={onClose} title={modalTitle} size="xl">
            <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Header Toggle Section */}
                {!isEditing && !isSubGoal && (
                   <div className="flex bg-gray-100 dark:bg-white/10 p-1 rounded-xl mb-6">
                        <button
                            type="button"
                            onClick={() => { setIsBucket(false); setType('one-time'); }}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isBucket && type === 'one-time' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                        >
                            Target Date
                        </button>
                        <button
                            type="button"
                            onClick={() => { setIsBucket(false); setType('recurring'); }}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isBucket && type === 'recurring' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                        >
                            Recurring
                        </button>
                         <button
                            type="button"
                            onClick={() => setIsBucket(true)}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${isBucket ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                        >
                            Goal Bucket
                        </button>
                   </div>
                )}

                {/* Name Input */}
                <div>
                    <label htmlFor="goal-name" className={labelStyle}>{isBucket ? 'Bucket Name' : (isSubGoal ? 'Item Name' : 'Goal Name')}</label>
                    <input 
                        id="goal-name" 
                        type="text" 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        className={`${INPUT_BASE_STYLE} !text-lg font-semibold`} 
                        placeholder={isBucket ? "e.g. Summer Vacation" : "e.g. New Laptop"}
                        required 
                        autoFocus
                    />
                </div>
                
                {!isBucket && (
                <>
                    {/* Hero Amount Input */}
                    <div className="flex flex-col items-center justify-center py-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5">
                        <label htmlFor="goal-amount" className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1">Target Amount</label>
                        <div className="relative w-full max-w-[200px]">
                            <span className={`absolute left-0 top-1/2 -translate-y-1/2 text-3xl font-medium text-light-text-secondary dark:text-dark-text-secondary pointer-events-none transition-opacity duration-200 ${amount ? 'opacity-100' : 'opacity-50'}`}>
                                €
                            </span>
                            <input 
                                id="goal-amount"
                                type="number" 
                                step="0.01" 
                                value={amount} 
                                onChange={e => setAmount(e.target.value)} 
                                className="w-full bg-transparent border-b-2 border-gray-200 dark:border-gray-700 focus:border-primary-500 text-center text-5xl font-bold text-light-text dark:text-dark-text placeholder-gray-300 dark:placeholder-gray-700 focus:outline-none py-2 transition-colors pl-6" 
                                placeholder="0" 
                                required 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                             <label htmlFor="goal-current-amount" className={labelStyle}>Saved So Far</label>
                             <div className="relative">
                                 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary">€</span>
                                 <input 
                                     id="goal-current-amount" 
                                     type="number" 
                                     step="0.01" 
                                     value={currentAmount} 
                                     onChange={e => setCurrentAmount(e.target.value)} 
                                     className={`${INPUT_BASE_STYLE} pl-8`} 
                                     placeholder="0.00" 
                                 />
                             </div>
                        </div>
                         <div>
                             <label className={labelStyle}>Goal Type</label>
                             <div className={SELECT_WRAPPER_STYLE}>
                                 <select value={transactionType} onChange={e => setTransactionType(e.target.value as 'income' | 'expense')} className={INPUT_BASE_STYLE}>
                                     <option value="expense">Saving up (Expense)</option>
                                     <option value="income">Earning goal (Income)</option>
                                 </select>
                                 <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                             </div>
                        </div>
                    </div>

                    {/* Schedule Section */}
                    {type === 'one-time' ? (
                        <div>
                            <label htmlFor="goal-date" className={labelStyle}>Target Date</label>
                            <input id="goal-date" type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT_BASE_STYLE} required />
                        </div>
                    ) : (
                        <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-black/5 dark:border-white/5 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="goal-frequency" className={labelStyle}>Frequency</label>
                                    <div className={SELECT_WRAPPER_STYLE}>
                                        <select id="goal-frequency" value={frequency} onChange={e => setFrequency(e.target.value as RecurrenceFrequency)} className={INPUT_BASE_STYLE}>
                                            {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                        </select>
                                        <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="goal-start-date" className={labelStyle}>Start Date</label>
                                    <input id="goal-start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={INPUT_BASE_STYLE} required />
                                </div>
                            </div>
                            
                            {type === 'recurring' && (
                                <div>
                                    <label htmlFor="monthly-contribution" className={labelStyle}>Contribution Amount</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary">€</span>
                                        <input 
                                            id="monthly-contribution" 
                                            type="number" 
                                            step="0.01" 
                                            value={monthlyContribution} 
                                            onChange={e => setMonthlyContribution(e.target.value)} 
                                            className={`${INPUT_BASE_STYLE} pl-8`} 
                                            placeholder="e.g., 250" 
                                        />
                                    </div>
                                </div>
                            )}

                            {(frequency === 'monthly' || frequency === 'yearly') && (
                                <div>
                                    <label htmlFor="goal-due-date" className={labelStyle}>Day of Month (Optional)</label>
                                    <input id="goal-due-date" type="number" min="1" max="31" value={dueDateOfMonth} onChange={e => setDueDateOfMonth(e.target.value)} className={INPUT_BASE_STYLE} placeholder="Uses start date's day" />
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Linking */}
                    <div className="pt-2 border-t border-black/10 dark:border-white/10 space-y-4">
                        <div>
                            <label htmlFor="goal-payment-account" className={labelStyle}>Linked Account (Optional)</label>
                            <div className={SELECT_WRAPPER_STYLE}>
                                <select id="goal-payment-account" value={paymentAccountId || ''} onChange={e => setPaymentAccountId(e.target.value || undefined)} className={INPUT_BASE_STYLE}>
                                    <option value="">None</option>
                                    {ALL_ACCOUNT_TYPES.map(type => {
                                        const group = groupedAccounts[type];
                                        if (!group || group.length === 0) return null;
                                        return (
                                            <optgroup key={type} label={type}>
                                                {group.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                            </optgroup>
                                        );
                                    })}
                                </select>
                                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                            </div>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">If selected, the goal will only be active when this account is selected.</p>
                        </div>

                        {!preselectedParentId && (
                            <div>
                                <label htmlFor="goal-parent" className={labelStyle}>Parent Goal (Optional)</label>
                                <div className={SELECT_WRAPPER_STYLE}>
                                    <select id="goal-parent" value={parentId || ''} onChange={e => setParentId(e.target.value || undefined)} className={INPUT_BASE_STYLE} disabled={!!preselectedParentId}>
                                        <option value="">None (Top-level goal)</option>
                                        {parentGoalOptions.map(goal => (
                                            <option key={goal.id} value={goal.id}>{goal.name}</option>
                                        ))}
                                    </select>
                                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                </div>
                            </div>
                        )}
                    </div>
                </>
                )}
                
                <div className="flex justify-end gap-3 pt-6 border-t border-black/5 dark:border-white/5">
                    <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                    <button type="submit" className={BTN_PRIMARY_STYLE}>{isEditing ? 'Save Changes' : 'Create Goal'}</button>
                </div>
            </form>
        </Modal>
    );
};

export default GoalScenarioModal;
