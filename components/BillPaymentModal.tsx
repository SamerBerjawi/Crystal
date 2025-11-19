
import React, { useState, useMemo } from 'react';
import Modal from './Modal';
import { Account, BillPayment } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, LIQUID_ACCOUNT_TYPES, ALL_ACCOUNT_TYPES } from '../constants';

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
    const [dueDate, setDueDate] = useState(bill?.dueDate || initialDate || new Date().toISOString().split('T')[0]);
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

    const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";
    
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
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex bg-light-bg dark:bg-dark-bg p-1 rounded-lg">
                    <button type="button" onClick={() => setType('payment')} className={`w-full py-2 rounded text-sm font-semibold ${type === 'payment' ? 'bg-red-500 text-white' : ''}`}>Payment (Out)</button>
                    <button type="button" onClick={() => setType('deposit')} className={`w-full py-2 rounded text-sm font-semibold ${type === 'deposit' ? 'bg-green-500 text-white' : ''}`}>Deposit (In)</button>
                </div>
                <div><label htmlFor="desc" className={labelStyle}>Description</label><input id="desc" type="text" value={description} onChange={e => setDescription(e.target.value)} className={INPUT_BASE_STYLE} required /></div>
                
                <div>
                    <label htmlFor="bill-account" className={labelStyle}>Payment Account (Optional)</label>
                    <div className={SELECT_WRAPPER_STYLE}>
                        <select id="bill-account" value={accountId} onChange={e => setAccountId(e.target.value)} className={INPUT_BASE_STYLE}>
                            <option value="">Default (Primary Account)</option>
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

                <div className="grid grid-cols-2 gap-4">
                    <div><label htmlFor="amount" className={labelStyle}>Amount (€)</label><input id="amount" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className={INPUT_BASE_STYLE} required /></div>
                    <div><label htmlFor="dueDate" className={labelStyle}>Due Date</label><input id="dueDate" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={INPUT_BASE_STYLE} required /></div>
                </div>
                <div className="flex justify-end gap-4 pt-4"><button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button><button type="submit" className={BTN_PRIMARY_STYLE}>{isEditing ? 'Save Changes' : 'Add Item'}</button></div>
            </form>
        </Modal>
    );
};

export default BillPaymentModal;
