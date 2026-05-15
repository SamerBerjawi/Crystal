
import React, { useState, useMemo } from 'react';
import Modal from './Modal';
import { Account, BillPayment } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, LIQUID_ACCOUNT_TYPES, ALL_ACCOUNT_TYPES } from '../constants';
import { toLocalISOString } from '../utils';

interface BillPaymentModalProps {
    bill: Omit<BillPayment, 'id'> & { id?: string } | null;
    onSave: (data: Omit<BillPayment, 'id'> & { id?: string }) => void;
    onClose: () => void;
    accounts: Account[];
    initialDate?: string;
}

const BillPaymentModal: React.FC<BillPaymentModalProps> = ({ bill, onSave, onClose, accounts, initialDate }) => {
    const isEditing = !!bill?.id;
    const [description, setDescription] = useState(bill?.description || '');
    const [amount, setAmount] = useState(bill ? String(Math.abs(bill.amount)) : '');
    const [type, setType] = useState<'payment' | 'deposit'>(bill?.type || 'payment');
    const [dueDate, setDueDate] = useState(bill?.dueDate || initialDate || toLocalISOString(new Date()));
    const [accountId, setAccountId] = useState(bill?.accountId || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            id: bill?.id,
            description,
            amount: type === 'payment' ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount)),
            type,
            currency: 'EUR',
            dueDate,
            status: bill?.status || 'unpaid',
            accountId: accountId || undefined,
        });
        onClose();
    };

    const labelStyle = "block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1.5";
    
    const groupedPaymentAccounts = useMemo(() => {
        const paymentAccounts = accounts.filter(a => LIQUID_ACCOUNT_TYPES.includes(a.type));
        const groups: Record<string, Account[]> = {};
        paymentAccounts.forEach(acc => {
            if (!groups[acc.type]) groups[acc.type] = [];
            groups[acc.type].push(acc);
        });
        return groups;
    }, [accounts]);

    return (
        <Modal onClose={onClose} title={isEditing ? 'Payment Logistics' : 'New One-time Obligation'}>
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[2.5rem]">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-500/10 blur-[80px] rounded-full" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-amber-500/10 blur-[80px] rounded-full" />
            </div>

            <form onSubmit={handleSubmit} className="relative z-10 space-y-8">
                
                {/* Type Segmented Control */}
                <div className="flex bg-gray-100 dark:bg-white/10 p-1 rounded-2xl border border-black/5 dark:border-white/5">
                    <button 
                        type="button" 
                        onClick={() => setType('payment')} 
                        className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${type === 'payment' ? 'bg-white dark:bg-dark-card text-rose-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    >
                        Expenditure
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setType('deposit')} 
                        className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${type === 'deposit' ? 'bg-white dark:bg-dark-card text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    >
                        Acquisition
                    </button>
                </div>

                {/* Hero Amount Input */}
                <div className="bg-light-fill dark:bg-dark-fill/50 p-8 rounded-[2rem] border border-black/5 dark:border-white/5">
                    <div className="flex flex-col items-center">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary/60 mb-4 text-center">Settlement Value</label>
                        <div className="relative w-full max-w-[280px]">
                            <span className={`absolute left-0 top-1/2 -translate-y-1/2 text-3xl font-black text-light-text-secondary dark:text-dark-text-secondary pointer-events-none transition-opacity ${amount ? 'opacity-100' : 'opacity-30'}`}>
                                €
                            </span>
                            <input 
                                id="bill-amount"
                                type="number" 
                                step="0.01" 
                                value={amount} 
                                onChange={e => setAmount(e.target.value)} 
                                className="w-full bg-transparent border-none text-center text-6xl font-black text-light-text dark:text-dark-text tabular-nums placeholder-gray-200 dark:placeholder-gray-800 focus:outline-none focus:ring-0 py-2 pl-8" 
                                placeholder="0.00" 
                                autoFocus
                                required 
                            />
                            <div className="mt-4 w-12 h-1 bg-primary-500/20 mx-auto rounded-full" />
                        </div>
                    </div>
                </div>

                {/* Details Grid */}
                <div className="space-y-6">
                    <div>
                        <label htmlFor="desc" className={labelStyle}>Operational Description</label>
                        <input id="desc" type="text" value={description} onChange={e => setDescription(e.target.value)} className={`${INPUT_BASE_STYLE} !h-14 !text-xl font-black uppercase tracking-tight`} placeholder="e.g. Q2 TAXES" required />
                    </div>
                
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div>
                            <label htmlFor="dueDate" className={labelStyle}>Maturity Date</label>
                            <input id="dueDate" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-bold`} required />
                        </div>
                        <div>
                            <label htmlFor="bill-account" className={labelStyle}>Linked Capital Account</label>
                            <div className={SELECT_WRAPPER_STYLE}>
                                <select id="bill-account" value={accountId} onChange={e => setAccountId(e.target.value)} className={`${SELECT_STYLE} h-14 font-bold transition-all`}>
                                    <option value="">Default Liquidity</option>
                                    {ALL_ACCOUNT_TYPES.map(type => {
                                        const group = groupedPaymentAccounts[type];
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
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t border-black/5 dark:border-white/5">
                    <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Dismiss</button>
                    <button type="submit" className={`${BTN_PRIMARY_STYLE} px-10 animate-glow`}>{isEditing ? 'Update Entry' : 'Commit Entry'}</button>
                </div>
            </form>
        </Modal>
    );
};

export default BillPaymentModal;
