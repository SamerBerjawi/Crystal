
import React, { useState, useMemo } from 'react';
import { Invoice, InvoiceType, InvoiceStatus, Currency } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE, SELECT_STYLE } from '../constants';
import { formatCurrency, parseLocalDate, toLocalISOString } from '../utils';
import Card from '../components/Card';
import ConfirmationModal from '../components/ConfirmationModal';
import { useInvoicesContext, usePreferencesContext, usePreferencesSelector } from '../contexts/DomainProviders';
import PageHeader from '../components/PageHeader';
import InvoiceModal from '../components/InvoiceModal';
import { getMerchantLogoUrl, normalizeMerchantKey } from '../utils/brandfetch';

const STATUS_COLORS: Record<InvoiceStatus, { bg: string, text: string, icon: string }> = {
    draft: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', icon: 'edit_note' },
    sent: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', icon: 'send' },
    paid: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', icon: 'check_circle' },
    overdue: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', icon: 'warning' },
    accepted: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', icon: 'thumb_up' },
    rejected: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-600 dark:text-rose-400', icon: 'thumb_down' },
};

const InvoicesPage: React.FC = () => {
    const { invoices, saveInvoice, deleteInvoice } = useInvoicesContext();
    const { preferences } = usePreferencesContext();
    const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
    const merchantLogoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});

    const [activeTab, setActiveTab] = useState<'invoices' | 'quotes'>('invoices');
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
    const [editorInitialType, setEditorInitialType] = useState<InvoiceType>('invoice');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
    const [logoLoadErrors, setLogoLoadErrors] = useState<Record<string, boolean>>({});

    // Derived Lists
    const displayedDocs = useMemo(() => {
        const typeMatch = activeTab === 'invoices' ? 'invoice' : 'quote';
        return invoices
            .filter(doc => doc.type === typeMatch)
            .filter(doc => statusFilter === 'all' || doc.status === statusFilter)
            .filter(doc => 
                !searchTerm || 
                doc.entityName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                doc.number.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a,b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());
    }, [invoices, activeTab, statusFilter, searchTerm]);

    // Metrics
    const metrics = useMemo(() => {
        const typeInvoices = invoices.filter(i => i.type === 'invoice');
        const typeQuotes = invoices.filter(i => i.type === 'quote');
        
        const overdue = typeInvoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + i.total, 0);
        const outstanding = typeInvoices.filter(i => i.status === 'sent').reduce((sum, i) => sum + i.total, 0);
        const paidMonth = typeInvoices
            .filter(i => i.status === 'paid' && new Date(i.date).getMonth() === new Date().getMonth())
            .reduce((sum, i) => sum + i.total, 0);
        
        const pendingQuotes = typeQuotes.filter(q => q.status === 'sent').reduce((sum, q) => sum + q.total, 0);

        return { overdue, outstanding, paidMonth, pendingQuotes };
    }, [invoices]);

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
            number: `INV-${new Date().getTime().toString().slice(-6)}`,
            date: toLocalISOString(new Date())
        };
        saveInvoice(newInvoice);
        saveInvoice({ ...quote, status: 'accepted' });
        setActiveTab('invoices');
    };

    const handleLogoError = (url: string) => setLogoLoadErrors(prev => ({ ...prev, [url]: true }));

    const currencyCode = (preferences.currency.split(' ')[0] as Currency) || 'EUR';

    return (
        <div className="max-w-7xl mx-auto space-y-10 pb-20 animate-fade-in-up">
            {isEditorOpen && (
                <InvoiceModal 
                    isOpen={isEditorOpen}
                    invoice={editingInvoice}
                    initialType={editorInitialType}
                    onSave={saveInvoice} 
                    onClose={() => setIsEditorOpen(false)}
                />
            )}
            
            <ConfirmationModal
                isOpen={!!deletingId}
                onClose={() => setDeletingId(null)}
                onConfirm={handleDelete}
                title="Deconstruct Financial Record"
                message="Are you sure you want to permanently excise this document from the ledger? This action cannot be reversed."
                confirmButtonText="Excision Document"
            />

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pt-4">
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-primary-500/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary-500 text-3xl">account_balance_wallet</span>
                        </div>
                        <div className="space-y-0.5">
                            <h1 className="text-4xl font-black tracking-tight text-light-text dark:text-dark-text">
                                Ledger & Receivables
                            </h1>
                            <p className="text-light-text-secondary dark:text-dark-text-secondary font-black uppercase tracking-[0.3em] text-[10px] opacity-60">
                                Financial Document Lifecycle Management
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex bg-gray-100 dark:bg-white/5 p-1.5 rounded-[1.5rem] border border-black/5 dark:border-white/5 shadow-inner gap-3">
                    <button 
                        onClick={() => handleOpenEditor('quote')}
                        className={`${BTN_SECONDARY_STYLE} h-12 px-6 gap-3 rounded-2xl text-[10px] uppercase font-black tracking-widest`}
                    >
                        <span className="material-symbols-outlined text-lg">add</span>
                        Draft Quote
                    </button>
                    <button 
                        onClick={() => handleOpenEditor('invoice')}
                        className={`${BTN_PRIMARY_STYLE} h-12 px-8 gap-3 animate-glow rounded-2xl text-[10px] uppercase font-black tracking-widest`}
                    >
                        <span className="material-symbols-outlined text-lg">add_circle</span>
                        New Invoice
                    </button>
                </div>
            </div>

            {/* Financial Intelligence Hub */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Aggregate Billing', value: metrics.paidMonth, icon: 'receipt_long', color: 'text-primary-500', bg: 'bg-primary-500/5', desc: 'Total invoices paid (Mo)' },
                    { label: 'Risk exposure', value: metrics.overdue, icon: 'warning', color: 'text-rose-500', bg: 'bg-rose-500/5', desc: 'Active overdue receivables' },
                    { label: 'Liquid Pipeline', value: metrics.outstanding, icon: 'schedule', color: 'text-blue-500', bg: 'bg-blue-500/5', desc: 'Outstanding receivables' },
                    { label: 'Quote Velocity', value: metrics.pendingQuotes, icon: 'request_quote', color: 'text-amber-500', bg: 'bg-amber-500/5', desc: 'Active proposals pipeline' },
                ].map((stat, idx) => (
                    <div key={idx} className="bg-white dark:bg-dark-card p-8 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group overflow-hidden relative">
                        <div className={`absolute top-0 right-0 w-24 h-24 ${stat.bg} blur-3xl rounded-full -translate-y-8 translate-x-8 opacity-0 group-hover:opacity-100 transition-opacity`} />
                        <div className="flex flex-col gap-6 relative z-10">
                            <div className="flex items-center justify-between">
                                <div className={`w-12 h-12 rounded-2xl ${stat.bg} flex items-center justify-center`}>
                                    <span className={`material-symbols-outlined ${stat.color} text-2xl`}>{stat.icon}</span>
                                </div>
                                <span className="text-[10px] font-black text-gray-300 dark:text-gray-700 uppercase tracking-widest">METRIC Node {idx + 1}</span>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-light-text-secondary dark:text-dark-text-secondary/60">{stat.label}</p>
                                <h3 className="text-3xl font-black tabular-nums tracking-tighter privacy-blur">
                                    {formatCurrency(stat.value, currencyCode)}
                                </h3>
                                <p className="text-[10px] font-bold text-gray-300 dark:text-gray-600 uppercase tracking-widest">{stat.desc}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Content Switcher & Filters */}
            <div className="bg-white dark:bg-dark-card rounded-[2.5rem] border border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-black/5 dark:border-white/5 flex flex-col xl:flex-row gap-8 justify-between items-center bg-gray-50/30 dark:bg-white/[0.01]">
                    <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
                        {/* Tab Switcher */}
                        <div className="flex bg-light-fill dark:bg-dark-fill p-1.5 rounded-2xl border border-black/5 dark:border-white/5 w-full md:w-auto shadow-inner">
                            <button 
                                onClick={() => setActiveTab('invoices')} 
                                className={`flex items-center gap-3 px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'invoices' ? 'bg-white dark:bg-dark-card shadow-lg text-primary-600 dark:text-primary-400 scale-[1.02]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-60'}`}
                            >
                                <span className="material-symbols-outlined text-xl">receipt_long</span>
                                Invoices
                            </button>
                            <button 
                                onClick={() => setActiveTab('quotes')} 
                                className={`flex items-center gap-3 px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'quotes' ? 'bg-white dark:bg-dark-card shadow-lg text-primary-600 dark:text-primary-400 scale-[1.02]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-60'}`}
                            >
                                <span className="material-symbols-outlined text-xl">request_quote</span>
                                Proposals
                            </button>
                        </div>

                        <div className="relative group w-full md:w-96">
                            <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors">search</span>
                            <input 
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-light-fill dark:bg-dark-fill border border-black/5 dark:border-white/5 rounded-2xl pl-14 pr-6 h-14 text-sm font-bold outline-none focus:ring-4 focus:ring-primary-500/10 transition-all placeholder:text-[10px] placeholder:uppercase placeholder:tracking-[0.2em] placeholder:opacity-40"
                                placeholder="Search by identifier or entity..."
                            />
                        </div>
                    </div>

                    <div className="flex bg-light-fill dark:bg-dark-fill p-1.5 rounded-2xl border border-black/5 dark:border-white/5 w-full xl:w-auto shadow-inner">
                        <div className="flex flex-wrap gap-1">
                            <button
                                onClick={() => setStatusFilter('all')}
                                className={`px-5 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${
                                    statusFilter === 'all' 
                                    ? 'bg-white dark:bg-dark-card shadow-lg text-primary-500' 
                                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-60'
                                }`}
                            >
                                All Status
                            </button>
                            {Object.keys(STATUS_COLORS).map(s => (
                                <button
                                    key={s}
                                    onClick={() => setStatusFilter(s as any)}
                                    className={`px-5 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${
                                        statusFilter === s 
                                        ? 'bg-white dark:bg-dark-card shadow-lg text-primary-500' 
                                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-60'
                                    }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-100/30 dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5">
                                <th className="px-6 sm:px-10 py-6 text-[10px] font-black uppercase tracking-[0.25em] text-light-text-secondary dark:text-dark-text-secondary">Reference</th>
                                <th className="px-6 sm:px-10 py-6 text-[10px] font-black uppercase tracking-[0.25em] text-light-text-secondary dark:text-dark-text-secondary">Entity Designation</th>
                                <th className="px-6 sm:px-10 py-6 text-[10px] font-black uppercase tracking-[0.25em] text-light-text-secondary dark:text-dark-text-secondary hidden md:table-cell">Status Details</th>
                                <th className="px-6 sm:px-10 py-6 text-[10px] font-black uppercase tracking-[0.25em] text-light-text-secondary dark:text-dark-text-secondary text-right">Aggregate Total</th>
                                <th className="px-6 sm:px-10 py-6 w-20"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/[0.03] dark:divide-white/[0.03]">
                            {displayedDocs.length > 0 ? (
                                displayedDocs.map(doc => {
                                    const statusStyle = STATUS_COLORS[doc.status];
                                    const logoUrl = getMerchantLogoUrl(doc.entityName, brandfetchClientId, merchantLogoOverrides, { fallback: 'lettermark', type: 'icon', width: 64, height: 64 });
                                    const hasLogo = Boolean(logoUrl && !logoLoadErrors[logoUrl!]);
                                    const initial = doc.entityName.charAt(0).toUpperCase();

                                    return (
                                        <tr 
                                            key={doc.id} 
                                            onClick={() => handleOpenEditor(doc.type, doc)}
                                            className="group hover:bg-primary-500/[0.02] transition-colors cursor-pointer"
                                        >
                                            <td className="px-6 sm:px-10 py-8">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-black text-sm tracking-widest uppercase text-light-text dark:text-dark-text group-hover:text-primary-500 transition-colors">{doc.number}</span>
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{doc.date}</span>
                                                    <div className="md:hidden mt-2">
                                                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-current border-opacity-10 shadow-sm ${statusStyle.bg} ${statusStyle.text}`}>
                                                            {doc.status}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 sm:px-10 py-8">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border border-black/5 dark:border-white/10 overflow-hidden shadow-sm transition-transform group-hover:scale-105 ${hasLogo ? 'bg-white' : 'bg-gray-100 dark:bg-white/10 text-gray-400'}`}>
                                                        {hasLogo ? (
                                                            <img 
                                                                src={logoUrl!} 
                                                                alt={doc.entityName} 
                                                                className="w-full h-full object-contain p-2" 
                                                                onError={() => handleLogoError(logoUrl!)}
                                                            />
                                                        ) : (
                                                            <span className="font-black text-lg opacity-40 uppercase">{initial}</span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col gap-1 min-w-0">
                                                        <span className="font-black text-sm uppercase text-light-text dark:text-dark-text truncate">{doc.entityName}</span>
                                                        <span className="text-[10px] font-bold text-gray-300 dark:text-gray-600 uppercase tracking-widest truncate hidden sm:block">Client Identity</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 sm:px-10 py-8 hidden md:table-cell">
                                                <div className="flex items-center gap-3">
                                                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-current border-opacity-10 shadow-sm ${statusStyle.bg} ${statusStyle.text}`}>
                                                        <span className="material-symbols-outlined text-sm">{statusStyle.icon}</span>
                                                        {doc.status}
                                                    </div>
                                                    {doc.dueDate && (
                                                         <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-tighter ${doc.status === 'overdue' ? 'text-rose-500' : 'text-gray-400 opacity-60'}`}>
                                                            <span className="material-symbols-outlined text-sm">{doc.status === 'overdue' ? 'warning' : 'event'}</span>
                                                            Due {parseLocalDate(doc.dueDate).toLocaleDateString()}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 sm:px-10 py-8 text-right">
                                                <span className="text-lg sm:text-xl font-black tabular-nums tracking-tighter text-light-text dark:text-dark-text privacy-blur">
                                                    {formatCurrency(doc.total, doc.currency)}
                                                </span>
                                            </td>
                                            <td className="px-6 sm:px-10 py-8">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {doc.type === 'quote' && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleConvertToInvoice(doc); }}
                                                            className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-emerald-500 hover:bg-emerald-500/10 rounded-2xl transition-all active:scale-90"
                                                            title="Convert to Invoice"
                                                        >
                                                            <span className="material-symbols-outlined text-xl sm:text-2xl">transform</span>
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setDeletingId(doc.id); }}
                                                        className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all active:scale-90"
                                                    >
                                                        <span className="material-symbols-outlined text-xl sm:text-2xl">delete_sweep</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-10 py-32 text-center">
                                        <div className="flex flex-col items-center gap-6 opacity-20">
                                            <span className="material-symbols-outlined text-8xl">inbox_customize</span>
                                            <div className="space-y-1">
                                                <p className="text-[12px] font-black uppercase tracking-[0.5em]">No Documents Identified</p>
                                                <p className="text-[10px] font-bold uppercase tracking-widest">Adjust filters or issue a new record</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-8 bg-gray-50/50 dark:bg-white/[0.01] border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Displaying {displayedDocs.length} of {invoices.length} Records
                    </p>
                    <div className="flex gap-2">
                         <button className="w-12 h-12 flex items-center justify-center rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-dark-card text-gray-400 hover:text-primary-500 transition-colors disabled:opacity-30" disabled>
                            <span className="material-symbols-outlined text-2xl">chevron_left</span>
                         </button>
                         <button className="w-12 h-12 flex items-center justify-center rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-dark-card text-gray-400 hover:text-primary-500 transition-colors disabled:opacity-30" disabled>
                            <span className="material-symbols-outlined text-2xl">chevron_right</span>
                         </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InvoicesPage;
