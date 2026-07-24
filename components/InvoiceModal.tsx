
import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import { Invoice, InvoiceItem, InvoiceType, InvoiceDirection, InvoiceStatus, Currency, PaymentTerm } from '../types';
import { INPUT_BASE_STYLE, SELECT_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE } from '../constants';
import { v4 as uuidv4 } from 'uuid';
import { formatCurrency, toLocalISOString } from '../utils';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { getMerchantLogoUrl } from '../utils/brandfetch';

interface InvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (invoice: Omit<Invoice, 'id'> & { id?: string }) => void;
    invoice?: Invoice | null;
    initialType?: InvoiceType;
}

const STATUS_OPTIONS: InvoiceStatus[] = ['draft', 'sent', 'paid', 'overdue', 'accepted', 'rejected'];

const InvoiceModal: React.FC<InvoiceModalProps> = ({ isOpen, onClose, onSave, invoice, initialType = 'invoice' }) => {
    const isEditing = !!invoice;
    const preferences = usePreferencesSelector(p => p);
    const brandfetchClientId = preferences.brandfetchClientId || '';
    const merchantLogoOverrides = preferences.merchantLogoOverrides || {};

    // Core State
    const [type, setType] = useState<InvoiceType>(initialType);
    const [direction, setDirection] = useState<InvoiceDirection>('sent');
    const [status, setStatus] = useState<InvoiceStatus>('draft');
    const [number, setNumber] = useState('');
    const [date, setDate] = useState(toLocalISOString(new Date()));
    const [dueDate, setDueDate] = useState('');
    const [currency, setCurrency] = useState<Currency>('EUR');

    // Entity State
    const [entityName, setEntityName] = useState('');
    const [entityEmail, setEntityEmail] = useState('');
    const [entityAddress, setEntityAddress] = useState('');
    const [logoLoadError, setLogoLoadError] = useState(false);

    // Items State
    const [items, setItems] = useState<InvoiceItem[]>([]);
    
    // Totals State
    const [taxRate, setTaxRate] = useState('');
    const [globalDiscount, setGlobalDiscount] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (invoice) {
                setType(invoice.type);
                setDirection(invoice.direction);
                setStatus(invoice.status);
                setNumber(invoice.number);
                setDate(invoice.date);
                setDueDate(invoice.dueDate || '');
                setCurrency(invoice.currency);
                setEntityName(invoice.entityName);
                setEntityEmail(invoice.entityEmail || '');
                setEntityAddress(invoice.entityAddress || '');
                setItems(invoice.items.map(i => ({ ...i }))); // Deep copy items
                setTaxRate(invoice.taxRate ? String(invoice.taxRate) : '');
                setGlobalDiscount(invoice.globalDiscountValue ? String(invoice.globalDiscountValue) : '');
                setNotes(invoice.notes || '');
            } else {
                // Reset for new
                setType(initialType);
                setDirection('sent');
                setStatus('draft');
                setNumber(`${initialType === 'quote' ? 'QT' : 'INV'}-${Date.now().toString().slice(-6)}`);
                setDate(toLocalISOString(new Date()));
                setDueDate('');
                setCurrency((preferences.currency.split(' ')[0] as Currency) || 'EUR');
                setEntityName('');
                setEntityEmail('');
                setEntityAddress('');
                setItems([{ id: uuidv4(), description: '', quantity: 1, unitPrice: 0, total: 0, discountPercent: 0 }]);
                setTaxRate('');
                setGlobalDiscount('');
                setNotes('');
            }
            setLogoLoadError(false);
        }
    }, [isOpen, invoice, initialType, preferences.currency]);

    // Recalculate totals
    const totals = useMemo(() => {
        const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice * (1 - (item.discountPercent || 0) / 100)), 0);
        const disc = parseFloat(globalDiscount) || 0;
        const taxPercent = parseFloat(taxRate) || 0;
        const taxableAmount = Math.max(0, subtotal - disc);
        const taxAmount = taxableAmount * (taxPercent / 100);
        const total = taxableAmount + taxAmount;
        return { subtotal, taxAmount, total };
    }, [items, globalDiscount, taxRate]);

    const handleItemChange = (id: string, field: keyof InvoiceItem, value: string | number) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value };
                // Recalculate line total logic handled in submit/render, but updated here for state consistency
                updated.total = updated.quantity * updated.unitPrice * (1 - (updated.discountPercent || 0) / 100);
                return updated;
            }
            return item;
        }));
    };

    const handleAddItem = () => {
        setItems(prev => [...prev, { id: uuidv4(), description: '', quantity: 1, unitPrice: 0, total: 0, discountPercent: 0 }]);
    };

    const handleRemoveItem = (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            id: invoice?.id,
            type,
            direction,
            status,
            number,
            date,
            dueDate: dueDate || undefined,
            currency,
            entityName,
            entityEmail: entityEmail || undefined,
            entityAddress: entityAddress || undefined,
            items,
            subtotal: totals.subtotal,
            taxRate: parseFloat(taxRate) || 0,
            taxAmount: totals.taxAmount,
            globalDiscountValue: parseFloat(globalDiscount) || 0,
            total: totals.total,
            notes: notes || undefined
        });
        onClose();
    };

    const clientLogo = getMerchantLogoUrl(entityName, brandfetchClientId, merchantLogoOverrides, { fallback: 'lettermark', type: 'icon', width: 64, height: 64 });
    const showLogo = clientLogo && !logoLoadError;

    const labelStyle = "block text-[10px] font-black  tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary mb-2";

    return (
        <Modal onClose={onClose} title={isEditing ? `Modify ${type === 'quote' ? 'Proposal' : 'Invoice'}` : `Initialize ${type === 'quote' ? 'Proposal' : 'Invoice'}`} size="3xl">
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[2.5rem]">
                <div className="absolute -top-24 -right-24 w-80 h-80 bg-primary-500/10 blur-[100px] rounded-full" />
                <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-blue-500/10 blur-[100px] rounded-full" />
            </div>

            <form onSubmit={handleSubmit} className="relative z-10 space-y-10 pb-4">
                
                {/* 1. Logic Hub: Identity & Lifecycle */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-white dark:bg-black/20 p-8 rounded-[2.5rem] border border-black/5 dark:border-white/5 shadow-sm overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary-500 to-blue-500" />
                    
                    <div className="md:col-span-8 flex items-center gap-8">
                        <div className={`w-20 h-20 flex items-center justify-center rounded-3xl shadow-2xl transition-transform hover:scale-105 active:scale-95 ${type === 'invoice' ? 'bg-blue-500 text-white shadow-blue-500/30' : 'bg-amber-500 text-white shadow-amber-500/30'}`}>
                            <span className="material-symbols-outlined text-4xl leading-none">{type === 'invoice' ? 'receipt_long' : 'request_quote'}</span>
                        </div>
                        <div className="flex-1 space-y-4">
                            <div className="space-y-1">
                                <label className={labelStyle}>Deployment Status</label>
                                <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-2xl border border-black/5 dark:border-white/5 space-x-1">
                                    {STATUS_OPTIONS.map(s => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setStatus(s)}
                                            className={`flex-1 py-2 text-[9px] font-black  tracking-widest rounded-xl transition-all ${
                                                status === s 
                                                ? 'bg-white dark:bg-dark-card shadow-md text-primary-600' 
                                                : 'text-gray-400 opacity-60 hover:opacity-100'
                                            }`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-4 flex flex-col justify-end space-y-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Fiscal Basis</label>
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-lg group-focus-within:text-primary-500 transition-colors">payments</span>
                                <select 
                                    value={currency} 
                                    onChange={e => setCurrency(e.target.value as Currency)} 
                                    className="w-full appearance-none bg-gray-50 dark:bg-dark-fill border border-black/5 dark:border-white/5 rounded-2xl pl-12 pr-10 h-14 text-sm font-black outline-none focus:ring-2 focus:ring-primary-500/20 transition-all cursor-pointer"
                                >
                                    <option value="EUR">EUR (€)</option>
                                    <option value="USD">USD ($)</option>
                                    <option value="GBP">GBP (£)</option>
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-300">
                                    <span className="material-symbols-outlined text-sm">expand_more</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Logistics & Entity Split */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Document Logistics */}
                    <div className="bg-light-fill dark:bg-dark-fill/50 p-8 rounded-[2rem] border border-black/5 dark:border-white/5 space-y-8">
                        <h4 className="text-[10px] font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary-500 text-lg">assured_workload</span>
                            Document Parameters
                        </h4>
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className={labelStyle}>Ledger Index (ID)</label>
                                <input 
                                    type="text" 
                                    value={number} 
                                    onChange={e => setNumber(e.target.value)} 
                                    className="w-full bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-2xl px-6 h-14 text-sm font-black  tracking-[0.2em] outline-none focus:ring-2 focus:ring-primary-500/20 transition-all shadow-sm" 
                                    required 
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className={labelStyle}>Emission</label>
                                    <input 
                                        type="date" 
                                        value={date} 
                                        onChange={e => setDate(e.target.value)} 
                                        className="w-full bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-2xl px-5 h-14 text-xs font-black  tracking-tighter outline-none focus:ring-2 focus:ring-primary-500/20 transition-all shadow-sm" 
                                        required 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelStyle}>Maturity</label>
                                    <input 
                                        type="date" 
                                        value={dueDate} 
                                        onChange={e => setDueDate(e.target.value)} 
                                        className="w-full bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-2xl px-5 h-14 text-xs font-black  tracking-tighter outline-none focus:ring-2 focus:ring-primary-500/20 transition-all shadow-sm" 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Client Information */}
                    <div className="bg-light-fill dark:bg-dark-fill/50 p-8 rounded-[2rem] border border-black/5 dark:border-white/5 space-y-8">
                        <div className="flex justify-between items-center">
                            <h4 className="text-[10px] font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                                <span className="material-symbols-outlined text-blue-500 text-lg">corporate_fare</span>
                                Entity Identification
                            </h4>
                            {showLogo && (
                                <div className="w-12 h-12 rounded-2xl bg-white p-1.5 border border-black/5 shadow-xl group active:scale-95 transition-transform overflow-hidden rotate-3">
                                    <img src={clientLogo!} alt="logo" className="w-full h-full object-contain" onError={() => setLogoLoadError(true)} />
                                </div>
                            )}
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className={labelStyle}>Legal Designation</label>
                                <input 
                                    type="text" 
                                    value={entityName} 
                                    onChange={e => { setEntityName(e.target.value); setLogoLoadError(false); }} 
                                    className="w-full bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-2xl px-6 h-14 text-sm font-black outline-none focus:ring-2 focus:ring-primary-500/20 transition-all shadow-sm" 
                                    placeholder="e.g. Acme Corporation" 
                                    required 
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                <div className="relative group">
                                    <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">alternate_email</span>
                                    <input 
                                        type="email" 
                                        value={entityEmail} 
                                        onChange={e => setEntityEmail(e.target.value)} 
                                        className="w-full bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-2xl pl-14 pr-6 h-14 text-xs font-bold outline-none focus:ring-2 focus:ring-primary-500/20 transition-all shadow-sm" 
                                        placeholder="billing-authority@entity.com" 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Ledger Line Entries */}
                <div className="bg-white dark:bg-black/20 rounded-[2.5rem] border border-black/5 dark:border-white/5 overflow-hidden shadow-sm">
                    <div className="p-8 pb-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
                         <h4 className="text-[10px] font-bold tracking-[0.3em] text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Billable Resource Allocation
                        </h4>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-gray-400  tracking-widest">{items.length} Elements</span>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50/50 dark:bg-white/[0.02]">
                                <tr className="border-b border-black/5 dark:border-white/5">
                                    <th className="px-8 py-5 text-[9px] font-black  tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary">Execution Details / Metadata</th>
                                    <th className="px-8 py-5 text-[9px] font-black  tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary text-right w-24">Quant.</th>
                                    <th className="px-8 py-5 text-[9px] font-black  tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary text-right w-36">Rate</th>
                                    <th className="px-8 py-5 text-[9px] font-black  tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary text-right w-44">Yield</th>
                                    <th className="px-2 py-5 w-14"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                {items.map((item) => (
                                    <tr key={item.id} className="group hover:bg-primary-500/[0.02] transition-colors relative">
                                        <td className="px-8 py-6">
                                            <input 
                                                type="text" 
                                                value={item.description} 
                                                onChange={e => handleItemChange(item.id, 'description', e.target.value)} 
                                                className="w-full bg-transparent border-none outline-none font-bold text-sm text-light-text dark:text-dark-text placeholder:text-gray-300 dark:placeholder:text-gray-700 focus:text-primary-500 transition-colors" 
                                                placeholder="Service or Product node definition..." 
                                                required 
                                            />
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <input 
                                                type="number" 
                                                step="any" 
                                                value={item.quantity} 
                                                onChange={e => handleItemChange(item.id, 'quantity', parseFloat(e.target.value))} 
                                                className="w-full bg-transparent border-none outline-none text-right font-black tabular-nums text-sm focus:text-primary-500" 
                                                required 
                                            />
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <input 
                                                type="number" 
                                                step="0.01" 
                                                value={item.unitPrice} 
                                                onChange={e => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value))} 
                                                className="w-full bg-transparent border-none outline-none text-right font-black tabular-nums text-sm focus:text-primary-500" 
                                                required 
                                            />
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <span className="font-black tabular-nums text-sm text-primary-600 dark:text-primary-400">
                                                {formatCurrency(item.total, currency)}
                                            </span>
                                        </td>
                                        <td className="px-2 py-6 text-center">
                                            <button 
                                                type="button" 
                                                onClick={() => handleRemoveItem(item.id)}
                                                className="w-10 h-10 flex items-center justify-center text-gray-300 hover:text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all opacity-0 group-hover:opacity-100 active:scale-90"
                                            >
                                                <span className="material-symbols-outlined text-xl leading-none">close</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    
                    <button 
                        type="button" 
                        onClick={handleAddItem} 
                        className="w-full py-8 text-[11px] font-black  tracking-[0.4em] text-primary-500 hover:bg-primary-500/5 transition-all flex items-center justify-center gap-3 border-t border-black/5 dark:border-white/5 active:bg-primary-500/[0.08]"
                    >
                        <span className="material-symbols-outlined text-xl leading-none">add_circle</span> 
                        Initialize New Entry Node
                    </button>
                </div>

                {/* 4. Financial Recapitulation */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start pb-4">
                    <div className="lg:col-span-7 space-y-4">
                        <label className={labelStyle}>Agreement Clauses & Directives</label>
                        <textarea 
                            value={notes} 
                            onChange={e => setNotes(e.target.value)} 
                            className="w-full bg-white dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-[2.5rem] p-8 text-sm font-bold leading-relaxed outline-none focus:ring-2 focus:ring-primary-500/20 transition-all min-h-[220px] shadow-sm placeholder:text-[10px]  placeholder:tracking-widest placeholder:opacity-30" 
                            placeholder="Specify payment rail identifiers (IBAN/SWIFT), tax registration numbers, and contractual maturity conditions..." 
                        />
                    </div>

                    <div className="lg:col-span-5 bg-light-fill dark:bg-dark-fill/50 p-10 rounded-[3rem] border border-black/5 dark:border-white/5 space-y-8 shadow-inner relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 blur-3xl rounded-full -translate-y-12 translate-x-12" />
                        
                        <h4 className="text-[12px] font-bold tracking-[0.3em] text-light-text-secondary dark:text-dark-text-secondary border-b border-black/10 dark:border-white/10 pb-6">Ledger Summation</h4>
                        
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-light-text-secondary dark:text-dark-text-secondary opacity-50  tracking-[0.2em] text-[10px]">Basis Subtotal</span>
                                <span className="font-black tabular-nums text-lg">{formatCurrency(totals.subtotal, currency)}</span>
                            </div>

                            <div className="flex justify-between items-center group/field">
                                <span className="text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary opacity-50  tracking-[0.2em]">Operational Correction</span>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        value={globalDiscount} 
                                        onChange={e => setGlobalDiscount(e.target.value)} 
                                        className="w-28 text-right bg-transparent border-b-2 border-black/5 dark:border-white/5 focus:border-primary-500 outline-none font-black text-base tabular-nums py-1 group-hover/field:border-primary-500/30 transition-all" 
                                        placeholder="0.00"
                                    />
                                    <span className="absolute -right-4 top-1/2 -translate-y-1/2 text-[10px] text-gray-300 font-black">±</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center group/field">
                                <span className="text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary opacity-50  tracking-[0.2em]">Fiscal Leverage (VAT %)</span>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        value={taxRate} 
                                        onChange={e => setTaxRate(e.target.value)} 
                                        className="w-28 text-right bg-transparent border-b-2 border-black/5 dark:border-white/5 focus:border-primary-500 outline-none font-black text-base tabular-nums py-1 group-hover/field:border-primary-500/30 transition-all" 
                                        placeholder="0.00"
                                    />
                                    <span className="absolute -right-4 top-1/2 -translate-y-1/2 text-[10px] text-gray-300 font-black">%</span>
                                </div>
                            </div>

                            <div className="pt-10 border-t-2 border-dashed border-black/10 dark:border-white/10 flex flex-col items-end gap-2">
                                <span className="text-[9px] font-black  text-primary-500 tracking-[0.5em] animate-pulse">Aggregate Settlement</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-black text-gray-300 ">{currency}</span>
                                    <div className="font-black text-5xl tabular-nums text-primary-600 dark:text-primary-400 tracking-tighter drop-shadow-2xl">
                                        {formatCurrency(totals.total, currency).split(currency)[0]}
                                        <span className="text-4xl">{formatCurrency(totals.total, currency).split(currency)[1]}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-10 border-t border-black/5 dark:border-white/5">
                    <button type="button" onClick={onClose} className={`${BTN_SECONDARY_STYLE} h-14 px-10  tracking-[0.2em] text-[10px] font-black rounded-2xl`}>Retract Order</button>
                    <button type="submit" className={`${BTN_PRIMARY_STYLE} h-14 px-12 gap-4 group animate-glow  tracking-[0.2em] text-[10px] font-black rounded-2xl`}>
                        Commit to Ledger
                        <span className="material-symbols-outlined text-2xl transition-transform group-hover:translate-x-2">send_and_archive</span>
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default InvoiceModal;
