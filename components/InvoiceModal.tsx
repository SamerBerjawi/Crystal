
import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import { Invoice, InvoiceItem, InvoiceType, InvoiceDirection, InvoiceStatus, Currency, PaymentTerm } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE } from '../constants';
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

    const labelStyle = "block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1.5";

    return (
        <Modal onClose={onClose} title={isEditing ? `Edit ${type === 'quote' ? 'Quote' : 'Invoice'}` : `New ${type === 'quote' ? 'Quote' : 'Invoice'}`} size="3xl">
            <form onSubmit={handleSubmit} className="space-y-8">
                
                {/* Top Controls: Type, Status, Currency */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-black/5 dark:border-white/5">
                    <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${type === 'invoice' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'}`}>
                            <span className="material-symbols-outlined text-xl">{type === 'invoice' ? 'description' : 'request_quote'}</span>
                        </div>
                        <div>
                             <div className={SELECT_WRAPPER_STYLE}>
                                <select value={status} onChange={e => setStatus(e.target.value as InvoiceStatus)} className={`${INPUT_BASE_STYLE} !py-1 !text-sm font-bold uppercase w-32`}>
                                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined text-sm">expand_more</span></div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                         <div className={SELECT_WRAPPER_STYLE}>
                            <select value={currency} onChange={e => setCurrency(e.target.value as Currency)} className={`${INPUT_BASE_STYLE} !py-1 !text-sm w-24 text-right font-mono`}>
                                <option value="EUR">EUR</option>
                                <option value="USD">USD</option>
                                <option value="GBP">GBP</option>
                            </select>
                            <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined text-sm">expand_more</span></div>
                        </div>
                    </div>
                </div>

                {/* Header: Document Info & Client */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-light-text dark:text-dark-text border-b border-black/5 dark:border-white/5 pb-2">Document Details</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelStyle}>Number</label>
                                <input type="text" value={number} onChange={e => setNumber(e.target.value)} className={INPUT_BASE_STYLE} required />
                            </div>
                            <div>
                                <label className={labelStyle}>Issue Date</label>
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT_BASE_STYLE} required />
                            </div>
                             <div>
                                <label className={labelStyle}>Due Date</label>
                                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={INPUT_BASE_STYLE} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-light-text dark:text-dark-text border-b border-black/5 dark:border-white/5 pb-2 flex justify-between">
                            <span>Client / Entity</span>
                            {showLogo && <img src={clientLogo!} alt="logo" className="w-5 h-5 object-contain rounded" onError={() => setLogoLoadError(true)} />}
                        </h4>
                        <div className="space-y-3">
                            <div>
                                <label className={labelStyle}>Name</label>
                                <input 
                                    type="text" 
                                    value={entityName} 
                                    onChange={e => { setEntityName(e.target.value); setLogoLoadError(false); }} 
                                    className={INPUT_BASE_STYLE} 
                                    placeholder="Client or Company Name" 
                                    required 
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelStyle}>Email</label>
                                    <input type="email" value={entityEmail} onChange={e => setEntityEmail(e.target.value)} className={INPUT_BASE_STYLE} placeholder="billing@client.com" />
                                </div>
                                <div>
                                    <label className={labelStyle}>Address</label>
                                    <input type="text" value={entityAddress} onChange={e => setEntityAddress(e.target.value)} className={INPUT_BASE_STYLE} placeholder="City, Country" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Line Items */}
                <div>
                    <h4 className="text-sm font-bold text-light-text dark:text-dark-text mb-3">Line Items</h4>
                    <div className="border border-black/10 dark:border-white/10 rounded-lg overflow-hidden">
                        <table className="w-full text-left text-xs sm:text-sm">
                            <thead className="bg-gray-50 dark:bg-white/5 border-b border-black/10 dark:border-white/10">
                                <tr>
                                    <th className="p-3 font-semibold w-1/2">Description</th>
                                    <th className="p-3 font-semibold text-right w-20">Qty</th>
                                    <th className="p-3 font-semibold text-right w-24">Price</th>
                                    <th className="p-3 font-semibold text-right w-24">Total</th>
                                    <th className="p-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5 dark:divide-white/5 bg-white dark:bg-dark-card">
                                {items.map((item) => (
                                    <tr key={item.id} className="group">
                                        <td className="p-2">
                                            <input 
                                                type="text" 
                                                value={item.description} 
                                                onChange={e => handleItemChange(item.id, 'description', e.target.value)} 
                                                className="w-full bg-transparent outline-none placeholder-gray-300 dark:placeholder-gray-700" 
                                                placeholder="Item name..." 
                                                required 
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input 
                                                type="number" 
                                                step="any" 
                                                value={item.quantity} 
                                                onChange={e => handleItemChange(item.id, 'quantity', parseFloat(e.target.value))} 
                                                className="w-full bg-transparent outline-none text-right" 
                                                required 
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input 
                                                type="number" 
                                                step="0.01" 
                                                value={item.unitPrice} 
                                                onChange={e => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value))} 
                                                className="w-full bg-transparent outline-none text-right" 
                                                required 
                                            />
                                        </td>
                                        <td className="p-3 text-right font-mono font-medium">
                                            {formatCurrency(item.total, currency)}
                                        </td>
                                        <td className="p-2 text-center">
                                            <button 
                                                type="button" 
                                                onClick={() => handleRemoveItem(item.id)}
                                                className="text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <span className="material-symbols-outlined text-lg">close</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button type="button" onClick={handleAddItem} className="w-full py-2 text-xs font-bold text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors flex items-center justify-center gap-1">
                            <span className="material-symbols-outlined text-sm">add</span> Add Item
                        </button>
                    </div>
                </div>

                {/* Footer: Notes & Totals */}
                <div className="flex flex-col sm:flex-row gap-8">
                    <div className="flex-1 space-y-2">
                        <label className={labelStyle}>Notes / Terms</label>
                        <textarea 
                            value={notes} 
                            onChange={e => setNotes(e.target.value)} 
                            className={`${INPUT_BASE_STYLE} min-h-[100px] text-sm`} 
                            placeholder="Payment terms, thank you note, etc." 
                        />
                    </div>
                    <div className="w-full sm:w-64 space-y-3 pt-6">
                        <div className="flex justify-between text-sm">
                            <span className="text-light-text-secondary dark:text-dark-text-secondary">Subtotal</span>
                            <span className="font-semibold">{formatCurrency(totals.subtotal, currency)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-light-text-secondary dark:text-dark-text-secondary">Discount (Flat)</span>
                            <input 
                                type="number" 
                                step="0.01" 
                                value={globalDiscount} 
                                onChange={e => setGlobalDiscount(e.target.value)} 
                                className="w-20 text-right bg-transparent border-b border-black/10 dark:border-white/10 focus:border-primary-500 outline-none" 
                                placeholder="0.00"
                            />
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-light-text-secondary dark:text-dark-text-secondary">Tax Rate (%)</span>
                            <input 
                                type="number" 
                                step="0.01" 
                                value={taxRate} 
                                onChange={e => setTaxRate(e.target.value)} 
                                className="w-20 text-right bg-transparent border-b border-black/10 dark:border-white/10 focus:border-primary-500 outline-none" 
                                placeholder="0"
                            />
                        </div>
                        {totals.taxAmount > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-light-text-secondary dark:text-dark-text-secondary">Tax Amount</span>
                                <span>{formatCurrency(totals.taxAmount, currency)}</span>
                            </div>
                        )}
                        <div className="border-t-2 border-black/10 dark:border-white/10 pt-3 flex justify-between items-center">
                            <span className="font-bold text-lg">Total</span>
                            <span className="font-black text-xl">{formatCurrency(totals.total, currency)}</span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-black/10 dark:border-white/10">
                    <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                    <button type="submit" className={BTN_PRIMARY_STYLE}>Save Document</button>
                </div>
            </form>
        </Modal>
    );
};

export default InvoiceModal;
