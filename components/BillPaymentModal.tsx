
import React, { useState, useMemo } from 'react';
import Modal from './Modal';
import { Account, BillPayment } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, LIQUID_ACCOUNT_TYPES, ALL_ACCOUNT_TYPES } from '../constants';
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
        <Modal onClose={onClose} title={isEditing ? 'Edit Bill/Payment' : 'Add Bill/Payment'}>
            <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Type Segmented Control */}
                <div className="flex bg-gray-100 dark:bg-white/10 p-1 rounded-xl">
                    <button 
                        type="button" 
                        onClick={() => setType('payment')} 
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${type === 'payment' ? 'bg-white dark:bg-dark-card text-red-600 dark:text-red-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    >
                        Payment (Out)
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setType('deposit')} 
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${type === 'deposit' ? 'bg-white dark:bg-dark-card text-green-600 dark:text-green-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    >
                        Deposit (In)
                    </button>
                </div>

                {/* Hero Amount Input */}
                <div className="flex flex-col items-center justify-center py-2">
                    <div className="relative w-full max-w-[200px]">
                        <span className={`absolute left-0 top-1/2 -translate-y-1/2 text-3xl font-medium text-light-text-secondary dark:text-dark-text-secondary pointer-events-none transition-opacity duration-200 ${amount ? 'opacity-100' : 'opacity-50'}`}>
                            €
                        </span>
                        <input 
                            id="bill-amount"
                            type="number" 
                            step="0.01" 
                            value={amount} 
                            onChange={e => setAmount(e.target.value)} 
                            className="w-full bg-transparent border-b-2 border-gray-200 dark:border-gray-700 focus:border-primary-500 text-center text-5xl font-bold text-light-text dark:text-dark-text placeholder-gray-300 dark:placeholder-gray-700 focus:outline-none py-2 transition-colors pl-6" 
                            placeholder="0.00" 
                            autoFocus
                            required 
                        />
                    </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label htmlFor="desc" className={labelStyle}>Description</label>
                        <input id="desc" type="text" value={description} onChange={e => setDescription(e.target.value)} className={`${INPUT_BASE_STYLE} !text-lg font-semibold`} placeholder="e.g. Electric Bill" required />
                    </div>
                
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label htmlFor="dueDate" className={labelStyle}>Due Date</label>
                            <input id="dueDate" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={INPUT_BASE_STYLE} required />
                        </div>
                        <div>
                            <label htmlFor="bill-account" className={labelStyle}>Account (Optional)</label>
                            <div className={SELECT_WRAPPER_STYLE}>
                                <select id="bill-account" value={accountId} onChange={e => setAccountId(e.target.value)} className={INPUT_BASE_STYLE}>
                                    <option value="">Default (Primary)</option>
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

                <div className="flex justify-end gap-4 pt-4 border-t border-black/10 dark:border-white/10">
                    <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                    <button type="submit" className={BTN_PRIMARY_STYLE}>{isEditing ? 'Save Changes' : 'Add Bill'}</button>
                </div>
            </form>
        </Modal>
    );
};

export default BillPaymentModal;
