
import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import { FinancialGoal, GoalType, GoalCategory, RecurrenceFrequency, Account } from '../types';
import { INPUT_BASE_STYLE, SELECT_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, FREQUENCIES, ALL_ACCOUNT_TYPES } from '../constants';
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
    const [goalCategory, setGoalCategory] = useState<GoalCategory>('savings');
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
            setGoalCategory(goalToEdit.goalCategory || (goalToEdit.transactionType === 'income' ? 'income' : 'savings'));
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
            setGoalCategory('savings');
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
            goalCategory: isBucket ? 'savings' : goalCategory,
            transactionType: (isBucket ? 'expense' : (goalCategory === 'income' ? 'income' : 'expense')) as 'income' | 'expense',
            amount: isBucket ? 0 : parseFloat(amount),
            currentAmount: isBucket ? 0 : parseFloat(currentAmount),
            currency: 'EUR' as const,
            date: isBucket ? undefined : type === 'one-time' ? date : undefined,
            frequency: isBucket ? undefined : type === 'recurring' ? frequency : undefined,
            startDate: isBucket ? undefined : type === 'recurring' ? startDate : undefined,
            monthlyContribution: isBucket ? undefined : monthlyContribution ? parseFloat(monthlyContribution) : undefined,
            dueDateOfMonth: isBucket ? undefined : type === 'recurring' && (frequency === 'monthly' || frequency === 'yearly') && dueDateOfMonth ? parseInt(dueDateOfMonth) : undefined,
            isBucket,
            parentId: isBucket ? undefined : parentId,
            paymentAccountId: isBucket ? undefined : paymentAccountId,
        };
        onSave(goalData);
        onClose();
    };

    const isSubGoal = !!parentId;
    const labelStyle = "block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary  tracking-wider mb-1.5";
    const modalTitle = isEditing ? 'Edit Goal' : (isSubGoal ? 'Add Item to Goal' : 'New Goal');

    const getAmountLabels = () => {
        switch (goalCategory) {
            case 'expense': return { target: 'Target Budget', current: 'Spent So Far' };
            case 'income': return { target: 'Target Income', current: 'Earned So Far' };
            default: return { target: 'Target Amount', current: 'Saved So Far' };
        }
    };
    const amountLabels = getAmountLabels();

    return (
        <Modal onClose={onClose} title={modalTitle} size="xl">
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[2.5rem]">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-500/10 blur-[80px] rounded-full" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-rose-500/10 blur-[80px] rounded-full" />
            </div>

            <form onSubmit={handleSubmit} className="relative z-10 space-y-8">
                
                {/* Mode Selection Control */}
                {!isEditing && !isSubGoal && (
                   <div className="flex bg-gray-100 dark:bg-white/10 p-1.5 rounded-2xl border border-black/5 dark:border-white/5 space-x-1">
                        <button
                            type="button"
                            onClick={() => { setIsBucket(false); setType('one-time'); }}
                            className={`flex-1 py-3 text-[10px] font-black  tracking-widest rounded-xl transition-all ${!isBucket && type === 'one-time' ? 'bg-white dark:bg-dark-card shadow-md text-primary-600' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                        >
                            Target Date
                        </button>
                        <button
                            type="button"
                            onClick={() => { setIsBucket(false); setType('recurring'); }}
                            className={`flex-1 py-3 text-[10px] font-black  tracking-widest rounded-xl transition-all ${!isBucket && type === 'recurring' ? 'bg-white dark:bg-dark-card shadow-md text-primary-600' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                        >
                            Recurring
                        </button>
                         <button
                            type="button"
                            onClick={() => setIsBucket(true)}
                            className={`flex-1 py-3 text-[10px] font-black  tracking-widest rounded-xl transition-all ${isBucket ? 'bg-white dark:bg-dark-card shadow-md text-primary-600' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                        >
                            Goal Bucket
                        </button>
                   </div>
                )}

                {/* Hero Target Section */}
                {!isBucket && (
                    <div className="bg-white dark:bg-black/20 p-8 rounded-[2.5rem] border border-black/5 dark:border-white/5 flex flex-col items-center gap-2 shadow-sm">
                        <label className={labelStyle}>{amountLabels.target}</label>
                        <div className="relative group w-full max-w-[320px] flex justify-center py-4">
                             <div className="text-7xl font-black tracking-tighter tabular-nums flex items-baseline gap-2">
                                 <input 
                                    type="number" 
                                    step="0.01" 
                                    value={amount} 
                                    onChange={e => setAmount(e.target.value)} 
                                    className="bg-transparent border-none text-center focus:ring-0 w-full p-0 placeholder-gray-200 dark:placeholder-gray-800" 
                                    placeholder="0.00"
                                    required 
                                 />
                                 <span className="text-3xl text-gray-300 dark:text-gray-700">EUR</span>
                             </div>
                        </div>
                    </div>
                )}

                <div className="bg-light-fill dark:bg-dark-fill/50 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-6">
                    <h4 className="text-[10px] font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary-500 text-lg">flag</span>
                        Objective Parameters
                    </h4>

                    <div>
                        <label htmlFor="goal-name" className={labelStyle}>{isBucket ? 'Bucket Alias' : (isSubGoal ? 'Objective Component' : 'Goal Alias')}</label>
                        <input 
                            id="goal-name" 
                            type="text" 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            className={`${INPUT_BASE_STYLE} !text-xl font-bold h-14`} 
                            placeholder={isBucket ? "e.g. Tactical Reserve" : "e.g. Asset Acquisition"}
                            required 
                            autoFocus={isBucket || isSubGoal}
                        />
                    </div>
                </div>
                
                {!isBucket && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
                    {/* Left Column: Progress & Classification */}
                    <div className="bg-light-fill dark:bg-dark-fill/50 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-8">
                         <div className="space-y-6">
                            <h4 className="text-[10px] font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary-500 text-lg">donut_large</span>
                                Progress Metrics
                            </h4>
                            <div className="grid grid-cols-1 gap-6">
                                 <div>
                                     <label htmlFor="goal-current-amount" className={labelStyle}>{amountLabels.current}</label>
                                     <div className="relative">
                                         <span className="absolute left-4 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary font-bold">€</span>
                                         <input 
                                             id="goal-current-amount" 
                                             type="number" 
                                             step="0.01" 
                                             value={currentAmount} 
                                             onChange={e => setCurrentAmount(e.target.value)} 
                                             className={`${INPUT_BASE_STYLE} pl-10 h-14 font-black tabular-nums`} 
                                             placeholder="0.00" 
                                         />
                                     </div>
                                </div>
                                 <div className="space-y-2">
                                     <label className={labelStyle}>Logical Classification</label>
                                     <div className={SELECT_WRAPPER_STYLE}>
                                         <select value={goalCategory} onChange={e => setGoalCategory(e.target.value as GoalCategory)} className={`${SELECT_STYLE} h-14 font-black  tracking-tight`}>
                                             <option value="savings">Saving Strategy</option>
                                             <option value="expense">Spending Target</option>
                                             <option value="income">Income Objective</option>
                                         </select>
                                         <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                     </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6 pt-6 border-t border-black/5 dark:border-white/5">
                            <h4 className="text-[10px] font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary-500 text-lg">event</span>
                                Temporal Configuration
                            </h4>
                            {type === 'one-time' ? (
                                <div className="space-y-2">
                                    <label htmlFor="goal-date" className={labelStyle}>Deployment / Target Date</label>
                                    <input id="goal-date" type="date" value={date} onChange={e => setDate(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-bold`} required />
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className={labelStyle}>Frequency</label>
                                        <div className={SELECT_WRAPPER_STYLE}>
                                            <select id="goal-frequency" value={frequency} onChange={e => setFrequency(e.target.value as RecurrenceFrequency)} className={`${SELECT_STYLE} h-14 font-black  tracking-widest`}>
                                                {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                            </select>
                                            <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className={labelStyle}>Start Sequence</label>
                                        <input id="goal-start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-bold`} required />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Execution & Integration */}
                    <div className="bg-light-fill dark:bg-dark-fill/50 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-8">
                        <div className="space-y-6">
                            <h4 className="text-[10px] font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary-500 text-lg">savings</span>
                                Contribution Strategy
                            </h4>
                            <div>
                                <label htmlFor="monthly-contribution" className={labelStyle}>
                                    {type === 'one-time' ? 'Projected Monthly Contribution' : 'Recurrent Contribution'}
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary font-bold">€</span>
                                    <input 
                                        id="monthly-contribution" 
                                        type="number" 
                                        step="0.01" 
                                        value={monthlyContribution} 
                                        onChange={e => setMonthlyContribution(e.target.value)} 
                                        className={`${INPUT_BASE_STYLE} pl-10 h-14 font-black tabular-nums placeholder:text-[10px]`} 
                                        placeholder={type === 'one-time' ? "AUTOCALCULATE" : "e.g. 250.00"} 
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6 pt-6 border-t border-black/5 dark:border-white/5">
                            <h4 className="text-[10px] font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary-500 text-lg">account_tree</span>
                                Network Integration
                            </h4>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className={labelStyle}>Funding Source / Linkage</label>
                                    <div className={SELECT_WRAPPER_STYLE}>
                                        <select id="goal-payment-account" value={paymentAccountId || ''} onChange={e => setPaymentAccountId(e.target.value || undefined)} className={`${SELECT_STYLE} h-14 font-black`}>
                                            <option value="">Decoupled Status</option>
                                            {Object.entries(groupedAccounts).map(([type, group]) => (
                                                <optgroup key={type} label={type} className="font-black  tracking-widest bg-gray-50 dark:bg-dark-bg p-2 h-10">
                                                    {group.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                                </optgroup>
                                            ))}
                                        </select>
                                        <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                    </div>
                                </div>
                                
                                {parentId && (
                                     <div className="bg-primary-500/5 dark:bg-primary-500/10 p-4 rounded-2xl border border-primary-500/20">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-primary-500 text-base">subdirectory_arrow_right</span>
                                            <span className="text-[10px] font-black  tracking-widest text-primary-600">Sub-Goal Active</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                )}
                
                <div className="flex justify-end gap-3 pt-6 border-t border-black/5 dark:border-white/5">
                    <button type="button" onClick={onClose} className={`${BTN_SECONDARY_STYLE} h-12 px-8  tracking-widest text-[10px] font-black`}>Retract</button>
                    <button type="submit" className={`${BTN_PRIMARY_STYLE} h-12 px-10 gap-2 group animate-glow  tracking-widest text-[10px] font-black`}>
                        {isEditing ? 'Commit Objective' : 'Deploy Goal'}
                        <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">track_changes</span>
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default GoalScenarioModal;
