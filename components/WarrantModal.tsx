
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Warrant, PaymentTerm } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE } from '../constants';
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
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[2.5rem]">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-500/10 blur-[80px] rounded-full" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-rose-500/10 blur-[80px] rounded-full" />
            </div>

            <form onSubmit={handleSubmit} className="relative z-10 space-y-8 pb-4">
                
                {/* Hero Target Section */}
                <div className="bg-white dark:bg-black/20 p-8 rounded-[2.5rem] border border-black/5 dark:border-white/5 flex flex-col items-center gap-2 shadow-sm">
                    <label className={labelStyle}>Total Grant Valuation</label>
                    <div className="relative group w-full max-w-[320px] flex justify-center py-4">
                         <div className="text-7xl font-black tracking-tighter tabular-nums flex items-baseline gap-3 text-light-text dark:text-dark-text">
                             <span className="text-3xl text-gray-300 dark:text-gray-700 font-medium">€</span>
                             {totalGrantValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                         </div>
                    </div>
                    <div className="h-1 w-20 bg-primary-500/20 rounded-full" />
                </div>

                {/* 1. Asset Identity Section */}
                <div className="bg-light-fill dark:bg-dark-fill/50 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary-500 text-lg">fingerprint</span>
                        Security Identification
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="col-span-1 space-y-2">
                            <label htmlFor="isin" className={labelStyle}>Ticker / SYMBOL</label>
                            <input 
                                id="isin" 
                                type="text" 
                                value={isin} 
                                onChange={e => setIsin(e.target.value)} 
                                className={`${INPUT_BASE_STYLE} uppercase font-black tracking-widest h-14 !text-xl`} 
                                placeholder="TICKER" 
                                required 
                                autoFocus 
                            />
                        </div>
                        <div className="col-span-2 space-y-2">
                            <label htmlFor="name" className={labelStyle}>Asset Designation</label>
                            <input 
                                id="name" 
                                type="text" 
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                                className={`${INPUT_BASE_STYLE} h-14 font-black uppercase`} 
                                placeholder="e.g. CORE ASSETS INC." 
                                required 
                            />
                        </div>
                    </div>
                </div>

                {/* 2. Grant Specifications */}
                <div className="bg-white dark:bg-black/20 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary-500 text-lg">contract</span>
                        Exercise Parameters
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label htmlFor="quantity" className={labelStyle}>Inventory Quantity</label>
                            <input id="quantity" type="number" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black tabular-nums text-xl`} placeholder="0" required />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="grantPrice" className={labelStyle}>Strike / Grant Price</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">€</span>
                                <input id="grantPrice" type="number" step="0.01" value={grantPrice} onChange={e => setGrantPrice(e.target.value)} className={`${INPUT_BASE_STYLE} pl-10 h-14 font-black tabular-nums text-xl`} placeholder="0.00" required />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 pt-4">
                        <label htmlFor="grantDate" className={labelStyle}>Inception / Grant Date</label>
                        <input id="grantDate" type="date" value={grantDate} onChange={e => setGrantDate(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black uppercase tracking-tighter`} required />
                    </div>
                </div>

                {/* 3. Tax Strategy */}
                <div className="bg-light-fill dark:bg-dark-fill/50 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-8">
                    <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-500 text-lg">receipt_long</span>
                            Tax Liability Strategy
                        </h4>
                        <div className="flex bg-gray-100 dark:bg-white/10 p-1.5 rounded-xl border border-black/5 dark:border-white/5 space-x-1">
                            <button type="button" onClick={() => setTaxType('percentage')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${taxType === 'percentage' ? 'bg-white dark:bg-dark-card shadow-md text-amber-600' : 'text-gray-400 opacity-60'}`}>%</button>
                            <button type="button" onClick={() => setTaxType('amount')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${taxType === 'amount' ? 'bg-white dark:bg-dark-card shadow-md text-amber-600' : 'text-gray-400 opacity-60'}`}>€</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className={labelStyle}>{taxType === 'percentage' ? 'Rate Coefficient (%)' : 'Calculated Fixed Amount'}</label>
                            <input 
                                type="number" 
                                step="any" 
                                value={taxValue} 
                                onChange={e => setTaxValue(e.target.value)} 
                                className={`${INPUT_BASE_STYLE} h-14 font-black tabular-nums text-xl`}
                                placeholder="0"
                            />
                        </div>
                        <div className="flex flex-col justify-center items-end p-5 bg-white dark:bg-black/20 rounded-[1.5rem] border border-black/5 dark:border-white/5 shadow-sm">
                            <span className="text-[9px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-[0.2em] mb-1">Calculated Obligation</span>
                            <span className="text-3xl font-black text-amber-900 dark:text-amber-200 tabular-nums">{formatCurrency(calculatedTaxAmount, 'EUR')}</span>
                        </div>
                    </div>

                    {/* Payment Schedule */}
                    <div className="space-y-6 pt-4">
                        <div className="flex items-center justify-between">
                            <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-light-text-secondary dark:text-dark-text-secondary opacity-60">Settlement Sequence</h5>
                            <button 
                                type="button" 
                                onClick={handleAddPayment}
                                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary-500 hover:text-primary-600 group transition-all"
                            >
                                <span className="material-symbols-outlined text-lg group-active:scale-90">add_circle</span>
                                Add Milestone
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {taxPayments.map((payment) => (
                                <div key={payment.id} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end bg-white dark:bg-black/40 p-4 rounded-3xl border border-transparent dark:border-white/5 hover:border-black/5 transition-all shadow-sm group">
                                    <div className="sm:col-span-6 space-y-2">
                                        <label className={labelStyle}>Maturity Date</label>
                                        <input 
                                            type="date" 
                                            value={payment.dueDate} 
                                            onChange={e => handleUpdatePayment(payment.id, { dueDate: e.target.value })}
                                            className={`${INPUT_BASE_STYLE} h-12 !text-[11px] font-black uppercase tracking-widest`}
                                        />
                                    </div>
                                    <div className="sm:col-span-5 relative space-y-2">
                                        <label className={labelStyle}>Allocated Amount</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">€</span>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                value={payment.amount} 
                                                onChange={e => handleUpdatePayment(payment.id, { amount: parseFloat(e.target.value) || 0 })}
                                                className={`${INPUT_BASE_STYLE} h-12 pl-10 !text-sm font-black tabular-nums`}
                                            />
                                        </div>
                                    </div>
                                    <div className="sm:col-span-1 flex justify-center pt-2 sm:pt-0">
                                        <button 
                                            type="button" 
                                            onClick={() => handleRemovePayment(payment.id)}
                                            className="w-12 h-12 flex items-center justify-center text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all active:scale-90"
                                        >
                                            <span className="material-symbols-outlined text-xl">delete</span>
                                        </button>
                                    </div>
                                </div>
                            ))}

                            <div className={`p-6 rounded-[2rem] border-2 flex items-center justify-between transition-all duration-700 shadow-xl ${
                                isBalanceZero 
                                    ? 'bg-emerald-500/5 border-emerald-500/20' 
                                    : 'bg-rose-500/5 border-rose-500/20 shadow-rose-500/5'
                            }`}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isBalanceZero ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white animate-pulse'}`}>
                                        <span className="material-symbols-outlined text-xl">
                                            {isBalanceZero ? 'check_circle' : 'pending_actions'}
                                        </span>
                                    </div>
                                    <div className="space-y-0.5">
                                        <span className={`text-[10px] font-black uppercase tracking-[0.25em] ${isBalanceZero ? 'text-emerald-800 dark:text-emerald-400' : 'text-rose-800 dark:text-rose-400'}`}>
                                            {isBalanceZero ? 'FISCAL EQUILIBRIUM' : 'REMAINING LIABILITY'}
                                        </span>
                                        <p className="text-[9px] font-bold uppercase tracking-widest opacity-60">Settlement Verification</p>
                                    </div>
                                </div>
                                <span className={`text-2xl font-black tabular-nums ${isBalanceZero ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                                    {formatCurrency(remainingTaxBalance, 'EUR')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-black/5 dark:border-white/5">
                    <button type="button" onClick={onClose} className={`${BTN_SECONDARY_STYLE} h-12 px-8 uppercase tracking-widest text-[10px] font-black`}>Retract</button>
                    <button 
                        type="submit" 
                        disabled={!isBalanceZero}
                        className={`${BTN_PRIMARY_STYLE} h-12 px-10 gap-3 group animate-glow uppercase tracking-widest text-[10px] font-black ${!isBalanceZero ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                    >
                        {isEditing ? 'Commit Changes' : 'Confirm Execution'}
                        <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">verified</span>
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default WarrantModal;
