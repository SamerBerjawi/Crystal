
import React, { useState, useMemo } from 'react';
import Modal from './Modal';
import { Account, Category, Prediction, PredictionType, InvestmentTransaction, Warrant } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE, ALL_ACCOUNT_TYPES } from '../constants';
import { toLocalISOString } from '../utils';
import Icon from './ui/Icon';

interface PredictionModalProps {
    onClose: () => void;
    onSave: (prediction: Omit<Prediction, 'id'> & { id?: string }) => void;
    accounts: Account[];
    expenseCategories: Category[];
    investmentTransactions?: InvestmentTransaction[];
    warrants?: Warrant[];
}

const RecursiveCategoryOptions: React.FC<{ categories: Category[], level: number }> = ({ categories, level }) => {
    const indent = '\u00A0\u00A0'.repeat(level * 3);
    return (
        <>
            {categories.map(cat => (
                <React.Fragment key={cat.id}>
                    <option value={cat.name} className={level === 0 ? "font-bold text-black dark:text-white" : ""}>
                        {indent}{cat.name}
                    </option>
                    {cat.subCategories && cat.subCategories.length > 0 && (
                        <RecursiveCategoryOptions categories={cat.subCategories} level={level + 1} />
                    )}
                </React.Fragment>
            ))}
        </>
    );
};

const PredictionModal: React.FC<PredictionModalProps> = ({ onClose, onSave, accounts, expenseCategories, investmentTransactions = [], warrants = [] }) => {
    const [type, setType] = useState<PredictionType>('spending_cap');
    const [targetId, setTargetId] = useState(''); // Category Name or Account ID or Symbol
    const [targetAmount, setTargetAmount] = useState('');
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        d.setDate(0); // End of current month
        return toLocalISOString(d);
    });

    const accountGroups = useMemo(() => {
        const groups: Record<string, Account[]> = {};
        accounts.forEach(acc => {
            if (!groups[acc.type]) groups[acc.type] = [];
            groups[acc.type].push(acc);
        });
        return groups;
    }, [accounts]);

    const availableAssets = useMemo(() => {
        const symbols = new Set<string>();
        investmentTransactions.forEach(tx => symbols.add(tx.symbol));
        warrants.forEach(w => symbols.add(w.isin));
        // Add accounts that act as investments directly (e.g. crypto wallet)
        accounts.filter(a => a.type === 'Investment' && a.symbol).forEach(a => symbols.add(a.symbol!));
        
        return Array.from(symbols).sort();
    }, [investmentTransactions, warrants, accounts]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        let targetName = '';
        if (type === 'spending_cap') {
            targetName = targetId;
        } else if (type === 'net_worth_goal') {
            if (targetId === 'all_net_worth') {
                targetName = 'Total Net Worth';
            } else {
                const acc = accounts.find(a => a.id === targetId);
                targetName = acc ? acc.name : 'Unknown Account';
            }
        } else if (type === 'price_target') {
            targetName = targetId; // The symbol
        }

        onSave({
            type,
            targetId: (targetId === 'all_net_worth' && type === 'net_worth_goal') ? undefined : targetId,
            targetName,
            targetAmount: parseFloat(targetAmount),
            startDate: toLocalISOString(new Date()),
            endDate,
            status: 'active'
        });
        onClose();
    };

    return (
        <Modal onClose={onClose} title="Create Prediction Contract" size="lg">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-black/5 dark:border-white/5">
                    <button
                        type="button"
                        onClick={() => { setType('spending_cap'); setTargetId(''); }}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${type === 'spending_cap' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400' : 'text-light-text-secondary dark:text-dark-text-secondary opacity-60 hover:opacity-100'}`}
                    >
                        Spending Cap
                    </button>
                    <button
                        type="button"
                        onClick={() => { setType('net_worth_goal'); setTargetId(''); }}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${type === 'net_worth_goal' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400' : 'text-light-text-secondary dark:text-dark-text-secondary opacity-60 hover:opacity-100'}`}
                    >
                        Net Worth
                    </button>
                    <button
                        type="button"
                        onClick={() => { setType('price_target'); setTargetId(''); }}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${type === 'price_target' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400' : 'text-light-text-secondary dark:text-dark-text-secondary opacity-60 hover:opacity-100'}`}
                    >
                        Price Target
                    </button>
                </div>

                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1.5">
                        {type === 'spending_cap' ? 'Target Category' : type === 'net_worth_goal' ? 'Target Account' : 'Target Asset'}
                    </label>
                    <div className={SELECT_WRAPPER_STYLE}>
                        <select 
                            value={targetId} 
                            onChange={e => setTargetId(e.target.value)} 
                            className={`${SELECT_STYLE} h-12 font-bold`}
                            required
                        >
                            <option value="">Select target...</option>
                            
                            {type === 'spending_cap' && (
                                <RecursiveCategoryOptions categories={expenseCategories} level={0} />
                            )}

                            {type === 'net_worth_goal' && (
                                <>
                                    <option value="all_net_worth" className="font-bold">Total Net Worth</option>
                                    {ALL_ACCOUNT_TYPES.map(accType => {
                                        const group = accountGroups[accType];
                                        if (!group || group.length === 0) return null;
                                        return (
                                             <optgroup key={accType} label={accType}>
                                                {group.map(acc => (
                                                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                                                ))}
                                            </optgroup>
                                        );
                                    })}
                                </>
                            )}
                            
                            {type === 'price_target' && (
                                availableAssets.map(symbol => (
                                    <option key={symbol} value={symbol}>{symbol}</option>
                                ))
                            )}
                        </select>
                        <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1.5">
                         {type === 'spending_cap' ? 'Limit Amount' : type === 'net_worth_goal' ? 'Target Balance' : 'Target Price'}
                    </label>
                    <input 
                        type="number" 
                        value={targetAmount} 
                        onChange={e => setTargetAmount(e.target.value)} 
                        className={`${INPUT_BASE_STYLE} h-12`}
                        placeholder="0.00"
                        step="0.01"
                        required
                    />
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                        {type === 'spending_cap' 
                            ? "I bet I will spend LESS than this amount." 
                            : type === 'net_worth_goal' 
                                ? "I bet my balance will be MORE than this amount."
                                : "I bet the price will reach this amount."}
                    </p>
                </div>

                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1.5">Resolution Date</label>
                    <input 
                        type="date" 
                        value={endDate} 
                        onChange={e => setEndDate(e.target.value)} 
                        className={`${INPUT_BASE_STYLE} h-12`}
                        min={toLocalISOString(new Date())}
                        required
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-black/5 dark:border-white/5">
                    <button type="button" onClick={onClose} className={`${BTN_SECONDARY_STYLE} h-11 px-6 text-xs font-bold uppercase tracking-wider`}>Cancel</button>
                    <button type="submit" className={`${BTN_PRIMARY_STYLE} h-11 px-6 text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary-500/20 active:scale-95`}>Lock In Prediction</button>
                </div>
            </form>
        </Modal>
    );
};

export default PredictionModal;
