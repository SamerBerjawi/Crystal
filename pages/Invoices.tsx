
import React, { useState, useMemo, useEffect } from 'react';
import { Invoice, InvoiceItem, InvoiceType, InvoiceStatus, InvoiceDirection, Currency, PaymentTerm } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE } from '../constants';
import { formatCurrency, toLocalISOString, parseLocalDate } from '../utils';
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
            paymentTerms, // Keep existing terms logic if needed, hidden for cleaner UI unless requested
            status,
            notes: notes || undefined
        });
        onClose();
    };
    
    const labelStyle = "block text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1";
    const inputMinimalStyle = "w-full bg-transparent border-b border-black/10 dark:border-white/10 focus:border-primary-500 text-sm py-1 outline-none transition-colors";

    return (
        <Modal onClose={onClose} title={`${isEditing ? 'Edit' : 'New'} ${type === 'quote' ? 'Quote' : 'Invoice'}`} size="3xl">
            <form onSubmit={handleSubmit} className="flex flex-col h-full">
                
                {/* Top Toolbar */}
                <div className="bg-light-bg dark:bg-black/20 -mx-6 -mt-4 px-6 py-3 mb-6 border-b border-black/5 dark:border-white/5 flex flex-wrap gap-4 justify-between items-center">
                    <div className="flex items-center gap-2">
                        {/* Direction Toggle */}
                        <div className="flex bg-white dark:bg-white/10 rounded-lg p-0.5 shadow-sm border border-black/5 dark:border-white/5">
                            <button 
                                type="button"
                                onClick={() => setDirection('sent')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${direction === 'sent' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'text-light-text-secondary hover:text-light-text dark:text-dark-text-secondary dark:hover:text-dark-text'}`}
                            >
                                <span className="material-symbols-outlined text-sm">arrow_upward</span> Income
                            </button>
                            <button 
                                type="button"
                                onClick={() => setDirection('received')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${direction === 'received' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' : 'text-light-text-secondary hover:text-light-text dark:text-dark-text-secondary dark:hover:text-dark-text'}`}
                            >
                                <span className="material-symbols-outlined text-sm">arrow_downward</span> Expense
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Currency */}
                        <div className={SELECT_WRAPPER_STYLE}>
                            <select value={currency} onChange={e => setCurrency(e.target.value as Currency)} className={`${INPUT_BASE_STYLE} !py-1 !h-8 !text-xs w-24 bg-white dark:bg-dark-card`}>
                                <option value="EUR">EUR (€)</option>
                                <option value="USD">USD ($)</option>
                                <option value="GBP">GBP (£)</option>
                            </select>
                            <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined text-sm">expand_more</span></div>
                        </div>

                        {/* Status */}
                        <div className={SELECT_WRAPPER_STYLE}>
                            <select value={status} onChange={e => setStatus(e.target.value as InvoiceStatus)} className={`${INPUT_BASE_STYLE} !py-1 !h-8 !text-xs w-32 font-bold uppercase bg-white dark:bg-dark-card`}>
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
                            <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined text-sm">expand_more</span></div>
                        </div>
                    </div>
                </div>

                {/* Document Canvas */}
                <div className="bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-xl shadow-sm p-8 space-y-8">
                    
                    {/* Header: Title & Dates */}
                    <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                        <div>
                             <h1 className="text-4xl font-extrabold text-light-text dark:text-dark-text tracking-tight uppercase mb-6">
                                 {type}
                             </h1>
                             <div className="space-y-4">
                                <div>
                                    <label className={labelStyle}>Document No.</label>
                                    <input type="text" value={number} onChange={e => setNumber(e.target.value)} className={`${INPUT_BASE_STYLE} w-48 font-mono`} required />
                                </div>
                             </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4 text-right">
                             <div>
                                 <label className={labelStyle}>Issue Date</label>
                                 <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${INPUT_BASE_STYLE} w-40 text-right`} required />
                            </div>
                            <div>
                                 <label className={labelStyle}>Due Date</label>
                                 <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={`${INPUT_BASE_STYLE} w-40 text-right`} />
                            </div>
                        </div>
                    </div>

                    <hr className="border-black/5 dark:border-white/5" />

                    {/* Entity Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div>
                            <p className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-3">From</p>
                            <div className="text-sm font-medium text-light-text dark:text-dark-text opacity-70 italic">
                                (Your Business Details)
                            </div>
                            {/* In a real app, this would be user profile data */}
                        </div>
                        <div>
                            <p className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-3">{direction === 'sent' ? 'Bill To' : 'Pay To'}</p>
                            <div className="space-y-3">
                                <input 
                                    type="text" 
                                    value={entityName} 
                                    onChange={e => setEntityName(e.target.value)} 
                                    className={inputMinimalStyle} 
                                    required 
                                    placeholder="Client or Company Name" 
                                />
                                <input 
                                    type="email" 
                                    value={entityEmail} 
                                    onChange={e => setEntityEmail(e.target.value)} 
                                    className={inputMinimalStyle} 
                                    placeholder="Email Address" 
                                />
                                <input 
                                    type="text" 
                                    value={entityAddress} 
                                    onChange={e => setEntityAddress(e.target.value)} 
                                    className={inputMinimalStyle} 
                                    placeholder="Billing Address" 
                                />
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="mt-8">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead>
                                <tr className="border-b-2 border-black/10 dark:border-white/10">
                                    <th className="py-2 font-bold text-light-text dark:text-dark-text w-[40%]">Item Description</th>
                                    <th className="py-2 font-bold text-light-text dark:text-dark-text text-right">Qty</th>
                                    <th className="py-2 font-bold text-light-text dark:text-dark-text text-right">Price</th>
                                    <th className="py-2 font-bold text-light-text dark:text-dark-text text-right">Disc %</th>
                                    <th className="py-2 font-bold text-light-text dark:text-dark-text text-right">Total</th>
                                    <th className="py-2 w-8"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                {items.map((item) => (
                                    <tr key={item.id} className="group">
                                        <td className="py-2 pr-2 align-top">
                                            <input 
                                                type="text" 
                                                value={item.description} 
                                                onChange={e => updateItem(item.id, 'description', e.target.value)} 
                                                className="w-full bg-transparent outline-none placeholder-gray-300 dark:placeholder-gray-700 font-medium" 
                                                placeholder="Description of service or product..." 
                                                required 
                                            />
                                            <input 
                                                type="text" 
                                                value={item.sku || ''} 
                                                onChange={e => updateItem(item.id, 'sku', e.target.value)} 
                                                className="w-full bg-transparent outline-none text-xs text-gray-400 mt-1" 
                                                placeholder="SKU / ID (Optional)" 
                                            />
                                        </td>
                                        <td className="py-2 align-top"><input type="number" step="any" value={item.quantity} onChange={e => updateItem(item.id, 'quantity', e.target.value)} className="w-full bg-transparent outline-none text-right" required /></td>
                                        <td className="py-2 align-top"><input type="number" step="0.01" value={item.unitPrice} onChange={e => updateItem(item.id, 'unitPrice', e.target.value)} className="w-full bg-transparent outline-none text-right" required /></td>
                                        <td className="py-2 align-top"><input type="number" step="0.01" value={item.discountPercent || ''} onChange={e => updateItem(item.id, 'discountPercent', e.target.value)} className="w-full bg-transparent outline-none text-right text-gray-500" placeholder="0" /></td>
                                        <td className="py-2 align-top text-right font-mono font-medium text-light-text dark:text-dark-text">{formatCurrency(item.total, currency)}</td>
                                        <td className="py-2 align-top text-right">
                                            <button type="button" onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><span className="material-symbols-outlined text-lg">close</span></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button type="button" onClick={addItem} className="mt-4 text-sm font-semibold text-primary-500 hover:text-primary-600 flex items-center gap-1 transition-colors">
                            <span className="material-symbols-outlined text-lg">add</span> Add Line Item
                        </button>
                    </div>

                    {/* Footer Layout */}
                    <div className="flex flex-col md:flex-row gap-12 pt-6">
                        <div className="flex-1 space-y-4">
                             <div>
                                <label className={labelStyle}>Notes & Terms</label>
                                <textarea 
                                    value={notes} 
                                    onChange={e => setNotes(e.target.value)} 
                                    className="w-full bg-gray-50 dark:bg-white/5 rounded-lg border border-black/5 dark:border-white/5 p-3 text-sm focus:border-primary-500 outline-none transition-colors resize-none" 
                                    rows={4} 
                                    placeholder="Payment due within 30 days. Thank you for your business." 
                                />
                             </div>
                        </div>
                        
                        <div className="w-full md:w-80 space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-light-text-secondary dark:text-dark-text-secondary font-medium">Subtotal</span>
                                <span className="font-semibold">{formatCurrency(totals.subtotal, currency)}</span>
                            </div>
                            
                            <div className="flex justify-between items-center text-sm group">
                                 <span className="text-light-text-secondary dark:text-dark-text-secondary font-medium border-b border-dashed border-gray-300 dark:border-gray-700 cursor-help">Discount (Flat)</span>
                                 <div className="flex items-center gap-2 justify-end w-24">
                                     <span className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">-</span>
                                     <input type="number" step="0.01" value={globalDiscount} onChange={e => setGlobalDiscount(e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-primary-500 text-right outline-none transition-colors" placeholder="0.00" />
                                 </div>
                            </div>

                            <div className="flex justify-between items-center text-sm group">
                                 <span className="text-light-text-secondary dark:text-dark-text-secondary font-medium">Tax Rate (%)</span>
                                 <div className="flex items-center gap-2 justify-end w-20">
                                     <input type="number" step="0.01" value={taxRate} onChange={e => setTaxRate(e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-primary-500 text-right outline-none transition-colors" placeholder="0" />
                                 </div>
                            </div>
                            
                            {totals.taxVal > 0 && (
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-light-text-secondary dark:text-dark-text-secondary font-medium">Tax Amount</span>
                                    <span className="font-semibold text-light-text dark:text-dark-text">{formatCurrency(totals.taxVal, currency)}</span>
                                </div>
                            )}
                            
                             <div className="flex justify-between items-center py-4 border-t-2 border-black/10 dark:border-white/10 mt-2">
                                <span className="text-lg font-bold text-light-text dark:text-dark-text">Total</span>
                                <span className="text-2xl font-black text-light-text dark:text-dark-text tracking-tight">{formatCurrency(totals.total, currency)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sticky Action Footer */}
                <div className="flex justify-end gap-4 pt-6 mt-auto">
                    <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                    <button type="submit" className={`${BTN_PRIMARY_STYLE} px-8 shadow-lg shadow-primary-500/20`}>Save Document</button>
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
            .sort((a,b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());
    }, [invoices]);

    const quotesList = useMemo(() => {
        return invoices
            .filter(inv => inv.type === 'quote')
            .sort((a,b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());
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
