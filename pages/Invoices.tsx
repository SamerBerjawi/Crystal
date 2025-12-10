
import React, { useState, useMemo, useEffect } from 'react';
import { Invoice, InvoiceItem, InvoiceType, InvoiceStatus, InvoiceDirection, Currency, PaymentTerm } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE } from '../constants';
import { formatCurrency, toLocalISOString, parseDateAsUTC } from '../utils';
import Card from '../components/Card';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import { v4 as uuidv4 } from 'uuid';
import { useInvoicesContext, usePreferencesContext } from '../contexts/DomainProviders';
import PageHeader from '../components/PageHeader';

interface InvoicesProps {}

const STATUS_COLORS: Record<InvoiceStatus, string> = {
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    accepted: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const InvoiceEditor: React.FC<{
    invoice: Invoice | null;
    initialType: InvoiceType;
    onSave: (invoice: Omit<Invoice, 'id'> & { id?: string }) => void;
    onClose: () => void;
    preferences: any;
}> = ({ invoice, initialType, onSave, onClose, preferences }) => {
    const isEditing = !!invoice;
    
    // Core details
    const [number, setNumber] = useState(invoice?.number || `INV-${new Date().getTime().toString().slice(-6)}`);
    const [date, setDate] = useState(invoice?.date || toLocalISOString(new Date()));
    const [dueDate, setDueDate] = useState(invoice?.dueDate || '');
    const [type, setType] = useState<InvoiceType>(invoice?.type || initialType);
    const [direction, setDirection] = useState<InvoiceDirection>(invoice?.direction || 'sent');
    const [status, setStatus] = useState<InvoiceStatus>(invoice?.status || 'draft');
    
    // Entity details (Client or Merchant)
    const [entityName, setEntityName] = useState(invoice?.entityName || '');
    const [entityEmail, setEntityEmail] = useState(invoice?.entityEmail || '');
    const [entityAddress, setEntityAddress] = useState(invoice?.entityAddress || '');
    
    // Financials
    const [items, setItems] = useState<InvoiceItem[]>(invoice?.items || []);
    const [taxRate, setTaxRate] = useState(invoice?.taxRate?.toString() || '0');
    const [globalDiscount, setGlobalDiscount] = useState(invoice?.globalDiscountValue?.toString() || '0');
    const [currency, setCurrency] = useState<Currency>(invoice?.currency || (preferences.currency.split(' ')[0] as Currency) || 'EUR');
    const [notes, setNotes] = useState(invoice?.notes || '');
    
    // Payment Terms
    const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>(invoice?.paymentTerms || []);

    // Initialize with one empty item if new
    useEffect(() => {
        if (!isEditing && items.length === 0) {
            addItem();
        }
        if (!isEditing) {
            setNumber(`${initialType === 'quote' ? 'QT' : 'INV'}-${new Date().getTime().toString().slice(-6)}`);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditing, initialType]);

    const addItem = () => {
        setItems(prev => [
            ...prev, 
            { id: uuidv4(), description: '', quantity: 1, unitPrice: 0, total: 0, discountPercent: 0 }
        ]);
    };

    const removeItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value };
                // Recalculate line total
                const qty = field === 'quantity' ? Number(value) : item.quantity;
                const price = field === 'unitPrice' ? Number(value) : item.unitPrice;
                const disc = field === 'discountPercent' ? Number(value) : (item.discountPercent || 0);
                
                updated.total = (qty * price) * (1 - (disc / 100));
                return updated;
            }
            return item;
        }));
    };

    const totals = useMemo(() => {
        const subtotal = items.reduce((sum, item) => sum + item.total, 0);
        const discountVal = parseFloat(globalDiscount) || 0;
        const taxVal = (subtotal - discountVal) * ((parseFloat(taxRate) || 0) / 100);
        const total = Math.max(0, subtotal - discountVal + taxVal);
        return { subtotal, taxVal, total };
    }, [items, globalDiscount, taxRate]);
    
    // Payment Terms Logic
    const addPaymentTerm = () => {
        const remainingPercentage = Math.max(0, 100 - paymentTerms.reduce((sum, t) => sum + t.percentage, 0));
        setPaymentTerms(prev => [
            ...prev,
            { 
                id: uuidv4(), 
                label: `Installment ${prev.length + 1}`, 
                percentage: remainingPercentage, 
                amount: totals.total * (remainingPercentage / 100), 
                dueDate: dueDate || date,
                status: 'pending'
            }
        ]);
    };

    const removePaymentTerm = (id: string) => {
        setPaymentTerms(prev => prev.filter(t => t.id !== id));
    };

    const updatePaymentTerm = (id: string, field: keyof PaymentTerm, value: string | number) => {
        setPaymentTerms(prev => prev.map(term => {
            if (term.id === id) {
                const updated = { ...term, [field]: value };
                
                if (field === 'percentage') {
                    // Update amount based on new percentage
                    updated.amount = totals.total * (Number(value) / 100);
                } else if (field === 'amount') {
                    // Update percentage based on new amount
                    updated.percentage = totals.total > 0 ? (Number(value) / totals.total) * 100 : 0;
                }
                
                return updated;
            }
            return term;
        }));
    };
    
    // Sync payment terms amounts when Total changes
    useEffect(() => {
        if (paymentTerms.length > 0) {
            setPaymentTerms(prev => prev.map(term => ({
                ...term,
                amount: totals.total * (term.percentage / 100)
            })));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [totals.total]);
    
    const termsTotalPercent = paymentTerms.reduce((sum, t) => sum + t.percentage, 0);
    const termsRemainingAmount = totals.total - paymentTerms.reduce((sum, t) => sum + t.amount, 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            id: invoice?.id,
            type,
            direction,
            number,
            date,
            dueDate: dueDate || undefined,
            entityName,
            entityEmail: entityEmail || undefined,
            entityAddress: entityAddress || undefined,
            currency,
            items,
            subtotal: totals.subtotal,
            globalDiscountValue: parseFloat(globalDiscount) || 0,
            taxRate: parseFloat(taxRate) || 0,
            taxAmount: totals.taxVal,
            total: totals.total,
            paymentTerms,
            status,
            notes: notes || undefined
        });
        onClose();
    };
    
    const labelStyle = "block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1";

    return (
        <Modal onClose={onClose} title={`${isEditing ? 'Edit' : 'New'} ${type === 'quote' ? 'Quote' : 'Invoice'}`} size="3xl">
            <form onSubmit={handleSubmit} className="space-y-8">
                
                {/* Direction Toggle */}
                {!isEditing && (
                    <div className="flex bg-light-fill dark:bg-dark-fill p-1 rounded-lg">
                        <button 
                            type="button"
                            onClick={() => setDirection('sent')}
                            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all flex items-center justify-center gap-2 ${direction === 'sent' ? 'bg-white dark:bg-dark-card shadow-sm text-green-600 dark:text-green-400' : 'text-light-text-secondary hover:text-light-text'}`}
                        >
                            <span className="material-symbols-outlined text-lg">arrow_upward</span>
                            I'm Sending (Income)
                        </button>
                        <button 
                             type="button"
                             onClick={() => setDirection('received')}
                             className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all flex items-center justify-center gap-2 ${direction === 'received' ? 'bg-white dark:bg-dark-card shadow-sm text-red-600 dark:text-red-400' : 'text-light-text-secondary hover:text-light-text'}`}
                        >
                            <span className="material-symbols-outlined text-lg">arrow_downward</span>
                            I'm Receiving (Expense)
                        </button>
                    </div>
                )}

                {/* Header Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className={labelStyle}>Document No.</label>
                        <input type="text" value={number} onChange={e => setNumber(e.target.value)} className={INPUT_BASE_STYLE} required />
                    </div>
                    <div>
                         <label className={labelStyle}>Date</label>
                         <input type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT_BASE_STYLE} required />
                    </div>
                    <div>
                         <label className={labelStyle}>Due / Expiry Date</label>
                         <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={INPUT_BASE_STYLE} />
                    </div>
                </div>
                
                {/* Client/Merchant Info */}
                <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-lg border border-black/5 dark:border-white/5 space-y-4">
                     <h4 className="font-bold text-sm text-light-text dark:text-dark-text border-b border-black/5 dark:border-white/5 pb-2">
                        {direction === 'sent' ? 'Client Details' : 'Merchant / Vendor Details'}
                     </h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelStyle}>{direction === 'sent' ? 'Client Name' : 'Merchant Name'}</label>
                            <input type="text" value={entityName} onChange={e => setEntityName(e.target.value)} className={INPUT_BASE_STYLE} required placeholder="Company or Person" />
                        </div>
                        <div>
                            <label className={labelStyle}>Email (Optional)</label>
                            <input type="email" value={entityEmail} onChange={e => setEntityEmail(e.target.value)} className={INPUT_BASE_STYLE} placeholder="contact@example.com" />
                        </div>
                        <div className="md:col-span-2">
                             <label className={labelStyle}>Address (Optional)</label>
                             <input type="text" value={entityAddress} onChange={e => setEntityAddress(e.target.value)} className={INPUT_BASE_STYLE} placeholder="Street, City, Zip" />
                        </div>
                     </div>
                </div>

                {/* Items Table */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-bold text-sm text-light-text dark:text-dark-text">Line Items</h4>
                        <button type="button" onClick={addItem} className={`${BTN_SECONDARY_STYLE} !py-1 !px-2 !text-xs`}>+ Add Item</button>
                    </div>
                    <div className="overflow-x-auto border border-black/5 dark:border-white/10 rounded-lg">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-light-fill dark:bg-dark-fill text-xs uppercase font-bold text-light-text-secondary dark:text-dark-text-secondary">
                                <tr>
                                    <th className="p-2 pl-3">Description</th>
                                    <th className="p-2 w-20 text-right">Qty</th>
                                    <th className="p-2 w-24 text-right">Price</th>
                                    <th className="p-2 w-20 text-right">Disc %</th>
                                    <th className="p-2 w-24 text-right">Total</th>
                                    <th className="p-2 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                {items.map((item) => (
                                    <tr key={item.id} className="group">
                                        <td className="p-2 pl-3">
                                            <input type="text" value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} className={`${INPUT_BASE_STYLE} !h-8`} placeholder="Item description" required />
                                            <input type="text" value={item.sku || ''} onChange={e => updateItem(item.id, 'sku', e.target.value)} className={`${INPUT_BASE_STYLE} !h-6 !text-xs mt-1 !bg-transparent !border-none !p-0 placeholder:text-gray-400`} placeholder="SKU (optional)" />
                                        </td>
                                        <td className="p-2 align-top"><input type="number" step="any" value={item.quantity} onChange={e => updateItem(item.id, 'quantity', e.target.value)} className={`${INPUT_BASE_STYLE} !h-8 text-right`} required /></td>
                                        <td className="p-2 align-top"><input type="number" step="0.01" value={item.unitPrice} onChange={e => updateItem(item.id, 'unitPrice', e.target.value)} className={`${INPUT_BASE_STYLE} !h-8 text-right`} required /></td>
                                        <td className="p-2 align-top"><input type="number" step="0.01" value={item.discountPercent || ''} onChange={e => updateItem(item.id, 'discountPercent', e.target.value)} className={`${INPUT_BASE_STYLE} !h-8 text-right`} placeholder="0" /></td>
                                        <td className="p-2 align-top text-right font-mono font-medium pt-3">{formatCurrency(item.total, currency)}</td>
                                        <td className="p-2 align-top text-center pt-2">
                                            <button type="button" onClick={() => removeItem(item.id)} className="text-light-text-secondary hover:text-red-500 transition-colors"><span className="material-symbols-outlined text-lg">delete</span></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                {/* Payment Terms Section */}
                <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-lg border border-black/5 dark:border-white/5">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="font-bold text-sm text-light-text dark:text-dark-text">Payment Terms & Schedule</h4>
                        <button type="button" onClick={addPaymentTerm} className={`${BTN_SECONDARY_STYLE} !py-1 !px-2 !text-xs`}>+ Add Term</button>
                    </div>
                    
                    {paymentTerms.length > 0 ? (
                        <div className="space-y-2">
                            {paymentTerms.map((term) => (
                                <div key={term.id} className="grid grid-cols-12 gap-2 items-center text-sm">
                                    <div className="col-span-4 sm:col-span-5">
                                        <input 
                                            type="text" 
                                            value={term.label} 
                                            onChange={e => updatePaymentTerm(term.id, 'label', e.target.value)} 
                                            className={`${INPUT_BASE_STYLE} !h-8 text-xs`} 
                                            placeholder="Description (e.g. Deposit)" 
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                value={Number(term.percentage).toFixed(2)} 
                                                onChange={e => updatePaymentTerm(term.id, 'percentage', e.target.value)} 
                                                className={`${INPUT_BASE_STYLE} !h-8 pr-6 text-right`} 
                                            />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-light-text-secondary">%</span>
                                        </div>
                                    </div>
                                    <div className="col-span-3 sm:col-span-2">
                                         <input 
                                            type="number" 
                                            value={Number(term.amount).toFixed(2)} 
                                            onChange={e => updatePaymentTerm(term.id, 'amount', e.target.value)} 
                                            className={`${INPUT_BASE_STYLE} !h-8 text-right`} 
                                        />
                                    </div>
                                    <div className="col-span-2">
                                         <input 
                                            type="date" 
                                            value={term.dueDate} 
                                            onChange={e => updatePaymentTerm(term.id, 'dueDate', e.target.value)} 
                                            className={`${INPUT_BASE_STYLE} !h-8`} 
                                        />
                                    </div>
                                    <div className="col-span-1 text-center">
                                         <button type="button" onClick={() => removePaymentTerm(term.id)} className="text-light-text-secondary hover:text-red-500 transition-colors"><span className="material-symbols-outlined text-lg">delete</span></button>
                                    </div>
                                </div>
                            ))}
                            <div className="flex justify-end pt-2 text-xs font-bold border-t border-black/5 dark:border-white/5 mt-2">
                                <span className={`mr-4 ${Math.abs(termsTotalPercent - 100) < 0.1 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                    Total: {termsTotalPercent.toFixed(1)}%
                                </span>
                                <span className={`${Math.abs(termsRemainingAmount) < 0.05 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                    Remaining: {formatCurrency(termsRemainingAmount, currency)}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary italic">No specific terms added. Full amount due on Due Date.</p>
                    )}
                </div>

                {/* Footer Totals */}
                <div className="flex flex-col sm:flex-row justify-between gap-8 border-t border-black/10 dark:border-white/10 pt-6">
                    <div className="flex-1 space-y-4">
                         <div>
                            <label className={labelStyle}>Notes</label>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} className={INPUT_BASE_STYLE} rows={3} placeholder="Payment terms, thank you notes, etc." />
                         </div>
                         
                         <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className={labelStyle}>Status</label>
                                <div className={SELECT_WRAPPER_STYLE}>
                                    <select value={status} onChange={e => setStatus(e.target.value as InvoiceStatus)} className={INPUT_BASE_STYLE}>
                                        <option value="draft">Draft</option>
                                        {type === 'invoice' ? (
                                            <>
                                                <option value="sent">Sent</option>
                                                <option value="paid">Paid</option>
                                                <option value="overdue">Overdue</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="sent">Sent</option>
                                                <option value="accepted">Accepted</option>
                                                <option value="rejected">Rejected</option>
                                            </>
                                        )}
                                    </select>
                                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                </div>
                             </div>
                             <div>
                                <label className={labelStyle}>Currency</label>
                                <div className={SELECT_WRAPPER_STYLE}>
                                    <select value={currency} onChange={e => setCurrency(e.target.value as Currency)} className={INPUT_BASE_STYLE}>
                                        <option value="EUR">EUR (€)</option>
                                        <option value="USD">USD ($)</option>
                                        <option value="GBP">GBP (£)</option>
                                    </select>
                                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                </div>
                             </div>
                         </div>
                    </div>
                    
                    <div className="w-full sm:w-72 space-y-2 text-sm">
                        <div className="flex justify-between py-1">
                            <span className="text-light-text-secondary dark:text-dark-text-secondary">Subtotal</span>
                            <span className="font-medium">{formatCurrency(totals.subtotal, currency)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                             <span className="text-light-text-secondary dark:text-dark-text-secondary">Discount</span>
                             <div className="w-24">
                                <input type="number" step="0.01" value={globalDiscount} onChange={e => setGlobalDiscount(e.target.value)} className={`${INPUT_BASE_STYLE} !h-7 text-right !py-0 !px-2 text-xs`} placeholder="0.00" />
                             </div>
                        </div>
                        <div className="flex justify-between items-center py-1">
                             <span className="text-light-text-secondary dark:text-dark-text-secondary">Tax Rate %</span>
                             <div className="w-24">
                                <input type="number" step="0.01" value={taxRate} onChange={e => setTaxRate(e.target.value)} className={`${INPUT_BASE_STYLE} !h-7 text-right !py-0 !px-2 text-xs`} placeholder="0" />
                             </div>
                        </div>
                         <div className="flex justify-between py-1 border-b border-black/5 dark:border-white/5 pb-2">
                            <span className="text-light-text-secondary dark:text-dark-text-secondary">Tax Amount</span>
                            <span className="font-medium">{formatCurrency(totals.taxVal, currency)}</span>
                        </div>
                         <div className="flex justify-between py-2 text-lg font-bold text-light-text dark:text-dark-text">
                            <span>Total</span>
                            <span>{formatCurrency(totals.total, currency)}</span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t border-black/10 dark:border-white/10">
                    <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                    <button type="submit" className={BTN_PRIMARY_STYLE}>Save {type === 'quote' ? 'Quote' : 'Invoice'}</button>
                </div>
            </form>
        </Modal>
    );
};

const InvoicesPage: React.FC<InvoicesProps> = () => {
    const { invoices, saveInvoice, deleteInvoice } = useInvoicesContext();
    const { preferences } = usePreferencesContext();
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
    const [editorInitialType, setEditorInitialType] = useState<InvoiceType>('invoice');
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const invoicesList = useMemo(() => {
        return invoices
            .filter(inv => inv.type === 'invoice')
            .sort((a,b) => parseDateAsUTC(b.date).getTime() - parseDateAsUTC(a.date).getTime());
    }, [invoices]);

    const quotesList = useMemo(() => {
        return invoices
            .filter(inv => inv.type === 'quote')
            .sort((a,b) => parseDateAsUTC(b.date).getTime() - parseDateAsUTC(a.date).getTime());
    }, [invoices]);

    const stats = useMemo(() => {
        const outstandingInvoices = invoicesList
            .filter(i => i.status === 'sent' || i.status === 'overdue')
            .reduce((sum, i) => sum + i.total, 0);
            
        const potentialQuotes = quotesList
            .filter(q => q.status === 'sent')
            .reduce((sum, q) => sum + q.total, 0);
            
        const overdueAmount = invoicesList
            .filter(i => i.status === 'overdue')
            .reduce((sum, i) => sum + i.total, 0);
            
        return { outstandingInvoices, potentialQuotes, overdueAmount };
    }, [invoicesList, quotesList]);

    const handleOpenEditor = (type: InvoiceType, invoice?: Invoice) => {
        setEditorInitialType(type);
        setEditingInvoice(invoice || null);
        setIsEditorOpen(true);
    };

    const handleDelete = () => {
        if (deletingId) {
            deleteInvoice(deletingId);
            setDeletingId(null);
        }
    };
    
    const handleConvertToInvoice = (quote: Invoice) => {
        const newInvoice: Omit<Invoice, 'id'> = {
            ...quote,
            type: 'invoice',
            status: 'draft',
            number: `INV-${new Date().getTime().toString().slice(-6)}`, // New number
            date: toLocalISOString(new Date())
        };
        saveInvoice(newInvoice);
        // Optionally update quote status to accepted
        saveInvoice({ ...quote, status: 'accepted' });
    };

    // Reusable Table Row for both lists
    const renderRow = (item: Invoice) => (
        <tr key={item.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => handleOpenEditor(item.type, item)}>
            <td className="px-4 py-3 font-mono font-medium text-xs truncate max-w-[100px]">{item.number}</td>
            <td className="px-4 py-3 font-semibold text-xs truncate max-w-[150px]">{item.entityName}</td>
            <td className="px-4 py-3 text-right font-bold font-mono text-xs">{formatCurrency(item.total, item.currency)}</td>
            <td className="px-4 py-3 text-center">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${STATUS_COLORS[item.status]}`}>
                    {item.status}
                </span>
            </td>
            <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.type === 'quote' && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleConvertToInvoice(item); }}
                            className="p-1 rounded-md text-light-text-secondary hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                            title="Convert to Invoice"
                        >
                            <span className="material-symbols-outlined text-base">transform</span>
                        </button>
                    )}
                    <button 
                        onClick={(e) => { e.stopPropagation(); setDeletingId(item.id); }}
                        className="p-1 rounded-md text-light-text-secondary hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Delete"
                    >
                        <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                </div>
            </td>
        </tr>
    );

    return (
        <div className="space-y-8 pb-12 animate-fade-in-up">
            {isEditorOpen && (
                <InvoiceEditor 
                    invoice={editingInvoice} 
                    initialType={editorInitialType}
                    onSave={saveInvoice} 
                    onClose={() => setIsEditorOpen(false)}
                    preferences={preferences}
                />
            )}
            
            <ConfirmationModal
                isOpen={!!deletingId}
                onClose={() => setDeletingId(null)}
                onConfirm={handleDelete}
                title="Delete Document"
                message="Are you sure you want to delete this document? This cannot be undone."
                confirmButtonText="Delete"
            />

            <PageHeader
                markerIcon="request_quote"
                markerLabel="Billing Desk"
                title="Quotes & Invoices"
                subtitle="Draft, send, and track receivables with status, due dates, and follow-up nudges."
                actions={(
                    <div className="flex gap-3">
                        <button onClick={() => handleOpenEditor('quote')} className={BTN_SECONDARY_STYLE}>
                            <span className="material-symbols-outlined text-lg mr-2">add</span>
                            New Quote
                        </button>
                        <button onClick={() => handleOpenEditor('invoice')} className={BTN_PRIMARY_STYLE}>
                            <span className="material-symbols-outlined text-lg mr-2">add</span>
                            New Invoice
                        </button>
                    </div>
                )}
            />
            
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <Card className="flex items-center gap-4 p-5">
                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">pending</span>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">Outstanding Invoices</p>
                        <p className="text-2xl font-bold">{formatCurrency(stats.outstandingInvoices, preferences.currency.split(' ')[0] as Currency)}</p>
                    </div>
                 </Card>
                 <Card className="flex items-center gap-4 p-5">
                    <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">request_quote</span>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">Pending Quotes</p>
                        <p className="text-2xl font-bold">{formatCurrency(stats.potentialQuotes, preferences.currency.split(' ')[0] as Currency)}</p>
                    </div>
                 </Card>
                 <Card className="flex items-center gap-4 p-5">
                    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">warning</span>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">Total Overdue</p>
                        <p className="text-2xl font-bold">{formatCurrency(stats.overdueAmount, preferences.currency.split(' ')[0] as Currency)}</p>
                    </div>
                 </Card>
            </div>

            {/* Split View */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Invoices Column */}
                <Card className="p-0 overflow-hidden flex flex-col h-full min-h-[400px]">
                    <div className="p-4 border-b border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] flex justify-between items-center">
                         <div className="flex items-center gap-2">
                             <span className="material-symbols-outlined text-primary-500">description</span>
                             <h3 className="font-bold text-lg text-light-text dark:text-dark-text">Invoices</h3>
                         </div>
                         <span className="text-xs bg-black/5 dark:bg-white/10 px-2 py-1 rounded-full font-bold text-light-text-secondary dark:text-dark-text-secondary">{invoicesList.length}</span>
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-light-bg dark:bg-white/5 border-b border-black/5 dark:border-white/5 text-xs uppercase font-bold text-light-text-secondary dark:text-dark-text-secondary">
                                <tr>
                                    <th className="px-4 py-3">No.</th>
                                    <th className="px-4 py-3">Entity</th>
                                    <th className="px-4 py-3 text-right">Total</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                    <th className="px-4 py-3 text-right w-20"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                {invoicesList.map(renderRow)}
                                {invoicesList.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-light-text-secondary dark:text-dark-text-secondary italic">
                                            No invoices created yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* Quotes Column */}
                <Card className="p-0 overflow-hidden flex flex-col h-full min-h-[400px]">
                    <div className="p-4 border-b border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] flex justify-between items-center">
                         <div className="flex items-center gap-2">
                             <span className="material-symbols-outlined text-purple-500">request_quote</span>
                             <h3 className="font-bold text-lg text-light-text dark:text-dark-text">Quotes</h3>
                         </div>
                         <span className="text-xs bg-black/5 dark:bg-white/10 px-2 py-1 rounded-full font-bold text-light-text-secondary dark:text-dark-text-secondary">{quotesList.length}</span>
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-light-bg dark:bg-white/5 border-b border-black/5 dark:border-white/5 text-xs uppercase font-bold text-light-text-secondary dark:text-dark-text-secondary">
                                <tr>
                                    <th className="px-4 py-3">No.</th>
                                    <th className="px-4 py-3">Entity</th>
                                    <th className="px-4 py-3 text-right">Total</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                    <th className="px-4 py-3 text-right w-20"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                {quotesList.map(renderRow)}
                                {quotesList.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-light-text-secondary dark:text-dark-text-secondary italic">
                                            No quotes created yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default InvoicesPage;
