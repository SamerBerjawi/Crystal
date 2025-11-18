import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import { FinancialGoal, GoalType, RecurrenceFrequency, Currency, Account } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, FREQUENCIES, ASSET_TYPES, DEBT_TYPES } from '../constants';

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
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [monthlyContribution, setMonthlyContribution] = useState('');
    const [dueDateOfMonth, setDueDateOfMonth] = useState('');
    const [isBucket, setIsBucket] = useState(false);
    const [parentId, setParentId] = useState<string | undefined>(preselectedParentId);
    const [paymentAccountId, setPaymentAccountId] = useState<string | undefined>();

    const parentGoalOptions = useMemo(() => 
        financialGoals.filter(g => (g.isBucket || !g.parentId) && g.id !== goalToEdit?.id),
    [financialGoals, goalToEdit]);
    
    useEffect(() => {
        if (isEditing && goalToEdit) {
            setName(goalToEdit.name);
            setType(goalToEdit.type);
            setTransactionType(goalToEdit.transactionType);
            setAmount(String(goalToEdit.amount));
            setCurrentAmount(String(goalToEdit.currentAmount || 0));
            setDate(goalToEdit.date || new Date().toISOString().split('T')[0]);
            setFrequency(goalToEdit.frequency || 'monthly');
            setStartDate(goalToEdit.startDate || new Date().toISOString().split('T')[0]);
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
            setDate(new Date().toISOString().split('T')[0]);
            setFrequency('monthly');
            setStartDate(new Date().toISOString().split('T')[0]);
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
    const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";
    const modalTitle = isEditing ? 'Edit Goal / Scenario' : (isSubGoal ? 'Add Item to Goal' : 'Add Goal / Scenario');
    const saveButtonText = isEditing ? 'Save Changes' : (isSubGoal ? 'Add Item' : 'Add Goal');

    return (
        <Modal onClose={onClose} title={modalTitle} size="2xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                {!isEditing && !isSubGoal && (
                     <div className="p-4 bg-black/5 dark:bg-white/5 rounded-lg flex justify-between items-center">
                        <div>
                            <p className="font-medium text-light-text dark:text-dark-text">Is this a goal bucket?</p>
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">e.g., "Vacation" to hold items like "Flights" and "Hotel".</p>
                        </div>
                        <div 
                        onClick={() => setIsBucket(!isBucket)}
                        className={`w-12 h-6 rounded-full p-1 flex items-center cursor-pointer transition-colors ${isBucket ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-700'}`}
                        >
                        <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${isBucket ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </div>
                    </div>
                )}

                <div>
                    <label htmlFor="goal-name" className={labelStyle}>{isBucket ? 'Bucket Name' : (isSubGoal ? 'Item Name' : 'Goal Name')}</label>
                    <input id="goal-name" type="text" value={name} onChange={e => setName(e.target.value)} className={INPUT_BASE_STYLE} required autoFocus/>
                </div>
                
                {!isBucket && (
                <>
                    {!isSubGoal && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelStyle}>Goal Type</label>
                                <div className="flex bg-light-bg dark:bg-dark-bg p-1 rounded-lg shadow-neu-inset-light dark:shadow-neu-inset-dark h-10 items-center">
                                    <button type="button" onClick={() => setType('one-time')} className={`w-full text-center text-sm font-semibold py-1.5 px-3 rounded-md transition-all ${type === 'one-time' ? 'bg-light-card dark:bg-dark-card shadow-neu-raised-light dark:shadow-neu-raised-dark' : 'text-light-text-secondary'}`}>One-time</button>
                                    <button type="button" onClick={() => setType('recurring')} className={`w-full text-center text-sm font-semibold py-1.5 px-3 rounded-md transition-all ${type === 'recurring' ? 'bg-light-card dark:bg-dark-card shadow-neu-raised-light dark:shadow-neu-raised-dark' : 'text-light-text-secondary'}`}>Recurring</button>
                                </div>
                            </div>
                            <div>
                                <label className={labelStyle}>Transaction Type</label>
                                <div className="flex bg-light-bg dark:bg-dark-bg p-1 rounded-lg shadow-neu-inset-light dark:shadow-neu-inset-dark h-10 items-center">
                                    <button type="button" onClick={() => setTransactionType('expense')} className={`w-full text-center text-sm font-semibold py-1.5 px-3 rounded-md transition-all ${transactionType === 'expense' ? 'bg-light-card dark:bg-dark-card shadow-neu-raised-light dark:shadow-neu-raised-dark' : 'text-light-text-secondary'}`}>Expense</button>
                                    <button type="button" onClick={() => setTransactionType('income')} className={`w-full text-center text-sm font-semibold py-1.5 px-3 rounded-md transition-all ${transactionType === 'income' ? 'bg-light-card dark:bg-dark-card shadow-neu-raised-light dark:shadow-neu-raised-dark' : 'text-light-text-secondary'}`}>Income</button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="goal-amount" className={labelStyle}>Target Amount (EUR)</label>
                            <input id="goal-amount" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className={INPUT_BASE_STYLE} placeholder="0.00" required />
                        </div>
                        <div>
                            <label htmlFor="goal-current-amount" className={labelStyle}>Current Amount Saved (EUR)</label>
                            <input id="goal-current-amount" type="number" step="0.01" value={currentAmount} onChange={e => setCurrentAmount(e.target.value)} className={INPUT_BASE_STYLE} placeholder="0.00" required />
                        </div>
                    </div>


                    {type === 'one-time' ? (
                        <div>
                            <label htmlFor="goal-date" className={labelStyle}>Target Date</label>
                            <input id="goal-date" type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT_BASE_STYLE} required />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="monthly-contribution" className={labelStyle}>Contribution Amount</label>
                                    <input id="monthly-contribution" type="number" step="0.01" value={monthlyContribution} onChange={e => setMonthlyContribution(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g., 250" />
                                </div>
                                {(frequency === 'monthly' || frequency === 'yearly') && (
                                    <div>
                                        <label htmlFor="goal-due-date" className={labelStyle}>Day of Month (Optional)</label>
                                        <input id="goal-due-date" type="number" min="1" max="31" value={dueDateOfMonth} onChange={e => setDueDateOfMonth(e.target.value)} className={INPUT_BASE_STYLE} placeholder="Uses start date's day" />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    
                    <div>
                        <label htmlFor="goal-payment-account" className={labelStyle}>Payment Account (Optional)</label>
                        <div className={SELECT_WRAPPER_STYLE}>
                            <select id="goal-payment-account" value={paymentAccountId || ''} onChange={e => setPaymentAccountId(e.target.value || undefined)} className={INPUT_BASE_STYLE}>
                                <option value="">None</option>
                                <optgroup label="Assets">
                                    {accounts.filter(a => ASSET_TYPES.includes(a.type)).map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                </optgroup>
                                <optgroup label="Liabilities">
                                    {accounts.filter(a => DEBT_TYPES.includes(a.type)).map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                </optgroup>
                            </select>
                            <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                        </div>
                    </div>

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

export default GoalScenarioModal;