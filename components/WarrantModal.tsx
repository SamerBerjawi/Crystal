
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Warrant, PaymentTerm } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_STYLE } from '../constants';
import { toLocalISOString, formatCurrency } from '../utils';
import { v4 as uuidv4 } from 'uuid';

interface WarrantModalProps {
  onClose: () => void;
  onSave: (warrant: Omit<Warrant, 'id'> & { id?: string }) => void;
  warrantToEdit?: Warrant | null;
}

const WarrantModal: React.FC<WarrantModalProps> = ({ onClose, onSave, warrantToEdit }) => {
    const isEditing = !!warrantToEdit;
    
    const [isin, setIsin] = useState(warrantToEdit?.isin || '');
    const [name, setName] = useState(warrantToEdit?.name || '');
    const [grantDate, setGrantDate] = useState(warrantToEdit?.grantDate || toLocalISOString(new Date()));
    const [quantity, setQuantity] = useState(warrantToEdit?.quantity ? String(warrantToEdit.quantity) : '');
    const [grantPrice, setGrantPrice] = useState(warrantToEdit?.grantPrice !== undefined ? String(warrantToEdit.grantPrice) : '10.00');
    const [taxType, setTaxType] = useState<'amount' | 'percentage'>(warrantToEdit?.taxType || 'percentage');
    const [taxValue, setTaxValue] = useState(warrantToEdit?.taxValue !== undefined ? String(warrantToEdit.taxValue) : '0');
    const [taxPayments, setTaxPayments] = useState<PaymentTerm[]>(warrantToEdit?.taxPayments || []);

    const totalGrantValue = (parseFloat(quantity) || 0) * (parseFloat(grantPrice) || 0);
    
    const calculatedTaxAmount = taxType === 'percentage' 
        ? (totalGrantValue * (parseFloat(taxValue) || 0)) / 100 
        : (parseFloat(taxValue) || 0);

    const totalPaidTaxes = taxPayments.reduce((sum, p) => sum + p.amount, 0);
    const remainingTaxBalance = calculatedTaxAmount - totalPaidTaxes;
    const isBalanceZero = Math.abs(remainingTaxBalance) < 0.01;

    const handleAddPayment = () => {
        const newPayment: PaymentTerm = {
            id: uuidv4(),
            label: `Tax Payment ${taxPayments.length + 1}`,
            percentage: 0,
            amount: remainingTaxBalance > 0 ? remainingTaxBalance : 0,
            dueDate: toLocalISOString(new Date()),
            status: 'pending'
        };
        setTaxPayments([...taxPayments, newPayment]);
    };

    const handleRemovePayment = (id: string) => {
        setTaxPayments(taxPayments.filter(p => p.id !== id));
    };

    const handleUpdatePayment = (id: string, updates: Partial<PaymentTerm>) => {
        setTaxPayments(taxPayments.map(p => p.id === id ? { ...p, ...updates } : p));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!isBalanceZero) {
            return; // Prevent submission if balance is not zero
        }

        onSave({
            id: warrantToEdit?.id,
            isin: isin.toUpperCase(),
            name,
            grantDate,
            quantity: parseFloat(quantity),
            grantPrice: parseFloat(grantPrice),
            taxType,
            taxValue: parseFloat(taxValue),
            taxAmount: calculatedTaxAmount,
            taxPayments,
        });
        onClose();
    };

    const labelStyle = "block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1.5";
    const modalTitle = isEditing ? 'Edit Warrant Grant' : 'Add Warrant Grant';
    
    return (
        <Modal onClose={onClose} title={modalTitle}>
            <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Asset Info Section */}
                <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-black/5 dark:border-white/5 space-y-4">
                    <h4 className="font-bold text-sm text-light-text dark:text-dark-text flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary-500">token</span>
                        Asset Information
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-1">
                            <label htmlFor="isin" className={labelStyle}>Ticker / ISIN</label>
                            <input id="isin" type="text" value={isin} onChange={e => setIsin(e.target.value)} className={`${INPUT_BASE_STYLE} uppercase font-mono`} placeholder="AAPL" required autoFocus />
                        </div>
                        <div className="col-span-2">
                            <label htmlFor="name" className={labelStyle}>Asset Name</label>
                            <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g. Apple Inc." required />
                        </div>
                    </div>
                </div>

                {/* Grant Details Section */}
                <div>
                     <h4 className="font-bold text-sm text-light-text dark:text-dark-text mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary-500">contract</span>
                        Grant Details
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="quantity" className={labelStyle}>Quantity</label>
                            <input id="quantity" type="number" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} className={`${INPUT_BASE_STYLE} font-mono`} placeholder="0" required />
                        </div>
                        <div>
                            <label htmlFor="grantPrice" className={labelStyle}>Strike Price (€)</label>
                            <input id="grantPrice" type="number" step="0.01" value={grantPrice} onChange={e => setGrantPrice(e.target.value)} className={`${INPUT_BASE_STYLE} font-mono`} required />
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Total Grant Value</span>
                    <span className="text-xl font-bold text-blue-700 dark:text-blue-300 font-mono">{formatCurrency(totalGrantValue, 'EUR')}</span>
                </div>

                <div>
                    <label htmlFor="grantDate" className={labelStyle}>Grant Date</label>
                    <input id="grantDate" type="date" value={grantDate} onChange={e => setGrantDate(e.target.value)} className={INPUT_BASE_STYLE} required />
                </div>

                {/* Tax Section */}
                <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-200 dark:border-amber-800/50 space-y-4">
                    <h4 className="font-bold text-sm text-amber-900 dark:text-amber-200 flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-500">account_balance_wallet</span>
                        Tax Configuration
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelStyle}>Tax Type</label>
                            <select 
                                value={taxType} 
                                onChange={e => setTaxType(e.target.value as 'amount' | 'percentage')}
                                className={SELECT_STYLE}
                            >
                                <option value="percentage">Percentage (%)</option>
                                <option value="amount">Fixed Amount (€)</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelStyle}>{taxType === 'percentage' ? 'Tax Percentage' : 'Tax Amount'}</label>
                            <input 
                                type="number" 
                                step="any" 
                                value={taxValue} 
                                onChange={e => setTaxValue(e.target.value)} 
                                className={`${INPUT_BASE_STYLE} font-mono`}
                                placeholder="0"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between py-2 border-t border-amber-200 dark:border-amber-800/50">
                        <span className="text-xs font-bold uppercase text-amber-800 dark:text-amber-300">Total Tax Liability</span>
                        <span className="text-lg font-bold text-amber-700 dark:text-amber-400 font-mono">{formatCurrency(calculatedTaxAmount, 'EUR')}</span>
                    </div>

                    {/* Payment Schedule */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h5 className="text-xs font-bold uppercase tracking-widest text-amber-800 dark:text-amber-300">Payment Schedule</h5>
                            <button 
                                type="button" 
                                onClick={handleAddPayment}
                                className="text-[10px] font-bold uppercase tracking-widest bg-amber-200 dark:bg-amber-800 px-2 py-1 rounded hover:bg-amber-300 transition-colors"
                            >
                                + Add Payment
                            </button>
                        </div>

                        {taxPayments.length === 0 ? (
                            <p className="text-[10px] italic text-amber-700 dark:text-amber-400">No payments scheduled yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {taxPayments.map((payment, index) => (
                                    <div key={payment.id} className="grid grid-cols-12 gap-2 items-end bg-white/50 dark:bg-black/20 p-2 rounded-lg border border-amber-200/50 dark:border-amber-800/30">
                                        <div className="col-span-5">
                                            <label className="text-[9px] font-bold uppercase mb-1 block text-light-text-secondary dark:text-dark-text-secondary">Due Date</label>
                                            <input 
                                                type="date" 
                                                value={payment.dueDate} 
                                                onChange={e => handleUpdatePayment(payment.id, { dueDate: e.target.value })}
                                                className="w-full text-xs bg-transparent border-b border-amber-300 dark:border-amber-700 focus:outline-none text-light-text dark:text-dark-text"
                                            />
                                        </div>
                                        <div className="col-span-5">
                                            <label className="text-[9px] font-bold uppercase mb-1 block text-light-text-secondary dark:text-dark-text-secondary">Amount (€)</label>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                value={payment.amount} 
                                                onChange={e => handleUpdatePayment(payment.id, { amount: parseFloat(e.target.value) || 0 })}
                                                className="w-full text-xs bg-transparent border-b border-amber-300 dark:border-amber-700 focus:outline-none font-mono text-light-text dark:text-dark-text"
                                            />
                                        </div>
                                        <div className="col-span-2 flex justify-end">
                                            <button 
                                                type="button" 
                                                onClick={() => handleRemovePayment(payment.id)}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                <span className="material-symbols-outlined text-sm">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className={`p-3 rounded-lg border flex items-center justify-between transition-colors ${
                            isBalanceZero 
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                        }`}>
                            <div className="flex items-center gap-2">
                                <span className={`material-symbols-outlined text-sm ${isBalanceZero ? 'text-green-500' : 'text-red-500'}`}>
                                    {isBalanceZero ? 'check_circle' : 'warning'}
                                </span>
                                <span className={`text-[10px] font-bold uppercase ${isBalanceZero ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                    {isBalanceZero ? 'Balance Settled' : 'Unallocated Balance'}
                                </span>
                            </div>
                            <span className={`text-sm font-bold font-mono ${isBalanceZero ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                {formatCurrency(remainingTaxBalance, 'EUR')}
                            </span>
                        </div>
                        {!isBalanceZero && (
                            <p className="text-[10px] text-red-500 font-medium italic">
                                * Please adjust payments to match the total tax liability before saving.
                            </p>
                        )}
                    </div>
                </div>
                
                <div className="flex justify-end gap-3 pt-4 border-t border-black/5 dark:border-white/5">
                    <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                    <button 
                        type="submit" 
                        disabled={!isBalanceZero}
                        className={`${BTN_PRIMARY_STYLE} ${!isBalanceZero ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {isEditing ? 'Save Changes' : 'Add Grant'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default WarrantModal;
