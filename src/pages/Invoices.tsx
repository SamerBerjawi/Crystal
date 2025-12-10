
import React, { useState, useMemo, useEffect } from 'react';
import { Invoice, InvoiceItem, InvoiceType, InvoiceStatus, InvoiceDirection, Currency, PaymentTerm } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE } from '../constants';
import { formatCurrency, toLocalISOString, parseDateAsUTC } from '../utils';
import Card from '../components/Card';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import { v4 as uuidv4 } from 'uuid';
import { useInvoicesContext, usePreferencesContext } from '../contexts/DomainProviders';

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
    
    const labelStyle = "block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1.5";

    return (
        <Modal onClose={onClose} title={`${isEditing ? 'Edit' : 'New'} ${type === 'quote' ? 'Quote' : 'Invoice'}`} size="3xl">
            <form onSubmit={handleSubmit} className="space-y-8">
                
                {/* Header: Number and Status */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                     <div className="flex-1 w-full sm:w-auto">
                        <label className={labelStyle}>Document No.</label>
                        <div className="relative">
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary font-mono text-sm">#</span>
                            <input
                                type="text"
                                value={number}
                                onChange={e => setNumber(e.target.value)}
                                className="w-full pl-4 font-mono font-bold text-xl bg-transparent border-b-2 border-x-0 border-t-0 rounded-none px-0 focus:ring-0 border-gray-200 dark:border-gray-700 focus:border-primary-500 transition-colors text-light-text dark:text-dark-text placeholder-gray-400"
                                required
                            />
                        </div>
                     </div>
                     <div className="w-full sm:w-48">
                        <label className={labelStyle}>Status</label>
                         <div className={SELECT_WRAPPER_STYLE}>
                            <select value={status} onChange={e => setStatus(e.target.value as InvoiceStatus)} className={`${INPUT_BASE_STYLE} font-medium`}>
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
                </div>

                {/* Control Bar: Direction & Dates */}
                <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-black/5 dark:border-white/5 grid grid-cols-1 lg:grid-cols-2 gap-6 items-end">
                    <div className="space-y-1.5">
                        <label className={labelStyle}>Direction</label>
                        <div className="flex bg-white dark:bg-black/20 p-1 rounded-lg border border-black/5 dark:border-white/5">
                            <button 
                                type="button"
                                onClick={() => setDirection('sent')}
                                className={`flex-1 py-1.5 rounded-md text-sm font-semibold transition-all flex items-center justify-center gap-2 ${direction === 'sent' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 shadow-sm' : 'text-light-text-secondary hover:text-light-text dark:text-dark-text-secondary dark:hover:text-dark-text'}`}
                            >
                                <span className="material-symbols-outlined text-base">arrow_upward</span>
                                Sending
                            </button>
                            <button 
                                 type="button"
                                 onClick={() => setDirection('received')}
                                 className={`flex-1 py-1.5 rounded-md text-sm font-semibold transition-all flex items-center justify-center gap-2 ${direction === 'received' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 shadow-sm' : 'text-light-text-secondary hover:text-light-text dark:text-dark-text-secondary dark:hover:text-dark-text'}`}
                            >
                                <span className="material-symbols-outlined text-base">arrow_downward</span>
                                Receiving
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                             <label className={labelStyle}>Date Issued</label>
                             <input type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT_BASE_STYLE} required />
                        </div>
                        <div>
                             <label className={labelStyle}>Due Date</label>
                             <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={INPUT_BASE_STYLE} />
                        </div>
                    </div>
                </div>

                {/* Entity Details */}
                <div className="space-y-4">
                     <h4 className="text-sm font-bold text-light-text dark:text-dark-text flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary-500">
                            {direction === 'sent' ? 'person' : 'store'}
                        </span>
                        {direction === 'sent' ? 'Client Details' : 'Merchant Details'}
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

                {/* Line Items */}
                <div className="space-y-4">
                     <div className="flex justify-between items-center">
                        <h4 className="text-sm font-bold text-light-text dark:text-dark-text flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary-500">list</span>
                            Line Items
                        </h4>
                     </div>
                     
                     <div className="overflow-hidden border border-black/5 dark:border-white/5 rounded-xl shadow-sm">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-light-fill dark:bg-white/5 text-xs uppercase font-bold text-light-text-secondary dark:text-dark-text-secondary">
                                <tr>
                                    <th className="p-3 pl-4 font-bold">Description</th>
                                    <th className="p-3 w-20 text-right font-bold">Qty</th>
                                    <th className="p-3 w-28 text-right font-bold">Price</th>
                                    <th className="p-3 w-20 text-right font-bold">Disc %</th>
                                    <th className="p-3 w-28 text-right font-bold">Total</th>
                                    <th className="p-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5 dark:divide-white/5 bg-white dark:bg-dark-card">
                                {items.map((item) => (
                                    <tr key={item.id} className="group">
                                        <td className="p-3 pl-4">
                                            <input type="text" value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} className={`${INPUT_BASE_STYLE} !h-9 !border-transparent hover:!border-gray-200 dark:hover:!border-gray-700 focus:!border-primary-500 !bg-transparent px-2 -ml-2`} placeholder="Item description" required />
                                            <input type="text" value={item.sku || ''} onChange={e => updateItem(item.id, 'sku', e.target.value)} className="block w-full text-xs text-light-text-secondary dark:text-dark-text-secondary bg-transparent border-none p-0 px-2 -ml-2 focus:ring-0 placeholder-gray-400 mt-0.5" placeholder="SKU (optional)" />
                                        </td>
                                        <td className="p-3 align-top"><input type="number" step="any" value={item.quantity} onChange={e => updateItem(item.id, 'quantity', e.target.value)} className={`${INPUT_BASE_STYLE} !h-9 text-right !bg-transparent`} required /></td>
                                        <td className="p-3 align-top"><input type="number" step="0.01" value={item.unitPrice} onChange={e => updateItem(item.id, 'unitPrice', e.target.value)} className={`${INPUT_BASE_STYLE} !h-9 text-right !bg-transparent`} required /></td>
                                        <td className="p-3 align-top"><input type="number" step="0.01" value={item.discountPercent || ''} onChange={e => updateItem(item.id, 'discountPercent', e.target.value)} className={`${INPUT_BASE_STYLE} !h-9 text-right !bg-transparent`} placeholder="0" /></td>
                                        <td className="p-3 align-top text-right font-mono font-medium pt-4 text-light-text dark:text-dark-text">{formatCurrency(item.total, currency)}</td>
                                        <td className="p-3 align-top text-center pt-3">
                                            <button type="button" onClick={() => removeItem(item.id)} className="text-light-text-secondary hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><span className="material-symbols-outlined text-lg">delete</span></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                     </div>
                     <button type="button" onClick={addItem} className={`${BTN_SECONDARY_STYLE} w-full border-dashed border-2 !bg-transparent hover:!bg-black/5 dark:hover:!bg-white/5`}>+ Add Item</button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                    {/* Left: Notes & Terms */}
                    <div className="space-y-6">
                         <div>
                            <label className={labelStyle}>Payment Terms & Schedule</label>
                            <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-black/5 dark:border-white/5 space-y-3">
                                {paymentTerms.map((term) => (
                                    <div key={term.id} className="grid grid-cols-12 gap-2 items-center text-sm">
                                        <div className="col-span-5">
                                            <input type="text" value={term.label} onChange={e => updatePaymentTerm(term.id, 'label', e.target.value)} className={`${INPUT_BASE_STYLE} !h-8 text-xs`} placeholder="Label" />
                                        </div>
                                        <div className="col-span-3">
                                             <input type="number" value={Number(term.amount).toFixed(2)} onChange={e => updatePaymentTerm(term.id, 'amount', e.target.value)} className={`${INPUT_BASE_STYLE} !h-8 text-right text-xs`} />
                                        </div>
                                        <div className="col-span-3">
                                             <input type="date" value={term.dueDate} onChange={e => updatePaymentTerm(term.id, 'dueDate', e.target.value)} className={`${INPUT_BASE_STYLE} !h-8 text-xs`} />
                                        </div>
                                        <div className="col-span-1 text-center">
                                             <button type="button" onClick={() => removePaymentTerm(term.id)} className="text-light-text-secondary hover:text-red-500"><span className="material-symbols-outlined text-sm">close</span></button>
                                        </div>
                                    </div>
                                ))}
                                <div className="flex justify-between items-center pt-2">
                                     <button type="button" onClick={addPaymentTerm} className="text-xs font-bold text-primary-600 hover:underline">+ Add Term</button>
                                     <span className={`text-xs ${Math.abs(termsRemainingAmount) < 0.05 ? 'text-green-600' : 'text-amber-600'}`}>Remaining: {formatCurrency(termsRemainingAmount, currency)}</span>
                                </div>
                            </div>
                        </div>

                         <div>
                            <label className={labelStyle}>Notes / Memo</label>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} className={INPUT_BASE_STYLE} rows={3} placeholder="Payment instructions, thank you notes..." />
                         </div>
                    </div>

                    {/* Right: Totals */}
                    <div className="bg-gray-50 dark:bg-white/5 p-6 rounded-xl border border-black/5 dark:border-white/5 space-y-4 h-fit">
                         <div className="flex justify-between items-center">
                            <label className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">Currency</label>
                            <div className={`${SELECT_WRAPPER_STYLE} !w-32`}>
                                <select value={currency} onChange={e => setCurrency(e.target.value as Currency)} className={`${INPUT_BASE_STYLE} !h-8 text-right pr-8 !py-0`}>
                                    <option value="EUR">EUR (€)</option>
                                    <option value="USD">USD ($)</option>
                                    <option value="GBP">GBP (£)</option>
                                </select>
                                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined text-sm">expand_more</span></div>
                            </div>
                         </div>
                         
                         <div className="border-t border-black/5 dark:border-white/5 my-2"></div>
                         
                         <div className="flex justify-between py-1 text-sm">
                            <span className="text-light-text-secondary dark:text-dark-text-secondary">Subtotal</span>
                            <span className="font-medium text-light-text dark:text-dark-text">{formatCurrency(totals.subtotal, currency)}</span>
                        </div>
                        
                        <div className="flex justify-between items-center py-1 text-sm">
                             <span className="text-light-text-secondary dark:text-dark-text-secondary">Discount</span>
                             <div className="w-24">
                                <input type="number" step="0.01" value={globalDiscount} onChange={e => setGlobalDiscount(e.target.value)} className={`${INPUT_BASE_STYLE} !h-7 text-right !py-0 !px-2 text-xs`} placeholder="0.00" />
                             </div>
                        </div>
                        
                        <div className="flex justify-between items-center py-1 text-sm">
                             <span className="text-light-text-secondary dark:text-dark-text-secondary">Tax Rate %</span>
                             <div className="w-24">
                                <input type="number" step="0.01" value={taxRate} onChange={e => setTaxRate(e.target.value)} className={`${INPUT_BASE_STYLE} !h-7 text-right !py-0 !px-2 text-xs`} placeholder="0" />
                             </div>
                        </div>
                        
                         <div className="flex justify-between py-1 text-sm pb-2">
                            <span className="text-light-text-secondary dark:text-dark-text-secondary">Tax Amount</span>
                            <span className="font-medium text-light-text dark:text-dark-text">{formatCurrency(totals.taxVal, currency)}</span>
                        </div>
                        
                        <div className="flex justify-between py-3 border-t border-black/10 dark:border-white/10 text-xl font-bold text-light-text dark:text-dark-text">
                            <span>Total</span>
                            <span>{formatCurrency(totals.total, currency)}</span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-black/10 dark:border-white/10">
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
    const [activeTab, setActiveTab] = useState<'invoices' | 'quotes'>('invoices');
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const filteredList = useMemo(() => {
        return invoices.filter(inv => 
            activeTab === 'invoices' ? inv.type === 'invoice' : inv.type === 'quote'
        ).sort((a,b) => parseDateAsUTC(b.date).getTime() - parseDateAsUTC(a.date).getTime());
    }, [invoices, activeTab]);

    const stats = useMemo(() => {
        const totalAmount = filteredList.reduce((sum, item) => sum + item.total, 0);
        const pendingStatus = activeTab === 'invoices' ? ['sent', 'overdue'] : ['sent'];
        const pendingAmount = filteredList
            .filter(item => pendingStatus.includes(item.status))
            .reduce((sum, item) => sum + item.total, 0);
            
        return { totalAmount, pendingAmount, count: filteredList.length };
    }, [filteredList, activeTab]);

    const handleOpenEditor = (invoice?: Invoice) => {
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
        setActiveTab('invoices');
    };

    return (
        <div className="space-y-8 pb-12 animate-fade-in-up">
            {isEditorOpen && (
                <InvoiceEditor 
                    invoice={editingInvoice} 
                    initialType={activeTab === 'quotes' ? 'quote' : 'invoice'}
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

            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                 <div>
                    <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">Quotes & Invoices</h1>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Manage your business documents and billing.</p>
                 </div>
                 
                 <div className="flex gap-3">
                    <div className="flex bg-light-fill dark:bg-dark-fill p-1 rounded-lg">
                        <button 
                            onClick={() => setActiveTab('invoices')} 
                            className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === 'invoices' ? 'bg-white dark:bg-dark-card text-primary-600 shadow-sm' : 'text-light-text-secondary hover:text-light-text'}`}
                        >
                            Invoices
                        </button>
                        <button 
                            onClick={() => setActiveTab('quotes')} 
                            className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === 'quotes' ? 'bg-white dark:bg-dark-card text-primary-600 shadow-sm' : 'text-light-text-secondary hover:text-light-text'}`}
                        >
                            Quotes
                        </button>
                    </div>
                    <button onClick={() => handleOpenEditor()} className={BTN_PRIMARY_STYLE}>
                        <span className="material-symbols-outlined text-lg mr-2">add</span>
                        New {activeTab === 'quotes' ? 'Quote' : 'Invoice'}
                    </button>
                </div>
            </header>
            
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <Card className="flex items-center gap-4 p-5">
                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">description</span>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">Total Documents</p>
                        <p className="text-2xl font-bold">{stats.count}</p>
                    </div>
                 </Card>
                 <Card className="flex items-center gap-4 p-5">
                    <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">payments</span>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">Total Value</p>
                        <p className="text-2xl font-bold">{formatCurrency(stats.totalAmount, preferences.currency.split(' ')[0] as Currency)}</p>
                    </div>
                 </Card>
                 <Card className="flex items-center gap-4 p-5">
                    <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">pending</span>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">Pending / Outstanding</p>
                        <p className="text-2xl font-bold">{formatCurrency(stats.pendingAmount, preferences.currency.split(' ')[0] as Currency)}</p>
                    </div>
                 </Card>
            </div>

            {/* List */}
            <Card className="p-0 overflow-hidden min-h-[400px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-light-bg dark:bg-white/5 border-b border-black/5 dark:border-white/5 text-xs uppercase font-bold text-light-text-secondary dark:text-dark-text-secondary">
                            <tr>
                                <th className="px-6 py-4">Number</th>
                                <th className="px-6 py-4 w-8">Dir.</th>
                                <th className="px-6 py-4">{activeTab === 'invoices' ? 'Entity' : 'Entity'}</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Due Date</th>
                                <th className="px-6 py-4 text-right">Amount</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5 dark:divide-white/5">
                            {filteredList.map(item => (
                                <tr key={item.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => handleOpenEditor(item)}>
                                    <td className="px-6 py-4 font-mono font-medium">{item.number}</td>
                                    <td className="px-6 py-4">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${item.direction === 'sent' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                                            <span className="material-symbols-outlined text-sm">{item.direction === 'sent' ? 'arrow_upward' : 'arrow_downward'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-semibold">{item.entityName}</td>
                                    <td className="px-6 py-4 text-light-text-secondary dark:text-dark-text-secondary">{parseDateAsUTC(item.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 text-light-text-secondary dark:text-dark-text-secondary">{item.dueDate ? parseDateAsUTC(item.dueDate).toLocaleDateString() : '—'}</td>
                                    <td className="px-6 py-4 text-right font-bold font-mono">{formatCurrency(item.total, item.currency)}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${STATUS_COLORS[item.status]}`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {item.type === 'quote' && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleConvertToInvoice(item); }}
                                                    className="p-1.5 rounded-md text-light-text-secondary hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                                                    title="Convert to Invoice"
                                                >
                                                    <span className="material-symbols-outlined text-lg">transform</span>
                                                </button>
                                            )}
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setDeletingId(item.id); }}
                                                className="p-1.5 rounded-md text-light-text-secondary hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                title="Delete"
                                            >
                                                <span className="material-symbols-outlined text-lg">delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredList.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-light-text-secondary dark:text-dark-text-secondary">
                                        No {activeTab} found. Create one to get started.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default InvoicesPage;
