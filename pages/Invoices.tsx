
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
        const baseCurrency = (preferences.currency.split(' ')[0] as Currency) || 'EUR';
        const typeInvoices = invoices.filter(i => i.type === 'invoice');
        
        const overdue = typeInvoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + i.total, 0);
        const outstanding = typeInvoices.filter(i => i.status === 'sent').reduce((sum, i) => sum + i.total, 0);
        const draft = typeInvoices.filter(i => i.status === 'draft').reduce((sum, i) => sum + i.total, 0);
        const paidMonth = typeInvoices
            .filter(i => i.status === 'paid' && new Date(i.date).getMonth() === new Date().getMonth())
            .reduce((sum, i) => sum + i.total, 0);

        return { overdue, outstanding, draft, paidMonth, baseCurrency };
    }, [invoices, preferences.currency]);

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
        setActiveTab('invoices'); // Switch tab to show new invoice
    };

    const handleLogoError = (url: string) => setLogoLoadErrors(prev => ({ ...prev, [url]: true }));

    const MetricCard = ({ title, value, colorClass, icon }: { title: string, value: number, colorClass: string, icon: string }) => (
        <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm flex flex-col justify-between h-full group hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-black/5 dark:border-white/5 transition-colors ${colorClass.replace('text-', 'text-opacity-80 group-hover:bg-opacity-100 group-hover:').replace('600', '50').replace('400', '900/30')}`}>
                    <span className={`material-symbols-outlined text-[20px] ${colorClass}`}>{icon}</span>
                </div>
                <div className="text-right">
                    <span className="text-[10px] font-black uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-[0.1em] opacity-60">{title}</span>
                </div>
            </div>
            <p className={`text-3xl font-black tracking-tight ${colorClass}`}>{formatCurrency(value, metrics.baseCurrency)}</p>
        </div>
    );

    return (
        <div className="space-y-8 pb-12 animate-fade-in-up">
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
                            Quote
                        </button>
                        <button onClick={() => handleOpenEditor('invoice')} className={BTN_PRIMARY_STYLE}>
                            <span className="material-symbols-outlined text-lg mr-2">add</span>
                            Invoice
                        </button>
                    </div>
                )}
            />
            
            {/* Stats Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard title="Overdue" value={metrics.overdue} colorClass="text-red-600 dark:text-red-400" icon="warning" />
                <MetricCard title="Outstanding" value={metrics.outstanding} colorClass="text-blue-600 dark:text-blue-400" icon="pending" />
                <MetricCard title="Draft Value" value={metrics.draft} colorClass="text-gray-600 dark:text-gray-400" icon="edit_note" />
                <MetricCard title="Paid (Month)" value={metrics.paidMonth} colorClass="text-green-600 dark:text-green-400" icon="payments" />
            </div>

            {/* Main Content Area */}
            <div className="flex flex-col space-y-4">
                {/* Controls Bar */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-dark-card p-2 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm">
                    {/* Tab Switcher */}
                    <div className="flex bg-gray-100 dark:bg-white/10 p-1 rounded-xl w-full md:w-auto">
                        <button 
                            onClick={() => setActiveTab('invoices')} 
                            className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'invoices' ? 'bg-white dark:bg-dark-card shadow text-primary-600 dark:text-primary-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            Invoices
                        </button>
                        <button 
                            onClick={() => setActiveTab('quotes')} 
                            className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'quotes' ? 'bg-white dark:bg-dark-card shadow text-primary-600 dark:text-primary-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            Quotes
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="flex gap-3 w-full md:w-auto">
                         <div className="relative flex-grow md:max-w-xs">
                             <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary">search</span>
                             <input 
                                type="text" 
                                placeholder="Search client or number..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className={`${INPUT_BASE_STYLE} pl-10 h-10 bg-transparent border-none focus:ring-0`}
                             />
                         </div>
                         <div className={SELECT_WRAPPER_STYLE}>
                             <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className={`${SELECT_STYLE} !py-2 !h-10 text-sm`}>
                                 <option value="all">All Status</option>
                                 {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                             </select>
                             <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined text-sm">expand_more</span></div>
                         </div>
                    </div>
                </div>

                {/* Documents List */}
                <div className="grid grid-cols-1 gap-3">
                    {displayedDocs.length === 0 ? (
                        <div className="text-center py-20 bg-light-card/50 dark:bg-dark-card/30 rounded-3xl border border-dashed border-black/10 dark:border-white/10">
                            <span className="material-symbols-outlined text-5xl text-gray-300 dark:text-gray-600 mb-4">folder_off</span>
                            <p className="text-light-text-secondary dark:text-dark-text-secondary">No {activeTab} found matching filters.</p>
                        </div>
                    ) : (
                        displayedDocs.map(doc => {
                            const statusStyle = STATUS_COLORS[doc.status];
                            const logoUrl = getMerchantLogoUrl(doc.entityName, brandfetchClientId, merchantLogoOverrides, { fallback: 'lettermark', type: 'icon', width: 64, height: 64 });
                            const hasLogo = Boolean(logoUrl && !logoLoadErrors[logoUrl!]);
                            const initial = doc.entityName.charAt(0).toUpperCase();

                            return (
                                <div 
                                    key={doc.id} 
                                    onClick={() => handleOpenEditor(doc.type, doc)}
                                    className="group bg-white dark:bg-dark-card p-5 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm hover:shadow-xl hover:border-primary-500/20 transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5"
                                >
                                    <div className="flex items-center gap-5 min-w-0">
                                        {/* Logo Column */}
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 border border-black/5 dark:border-white/10 overflow-hidden shadow-inner ${hasLogo ? 'bg-white' : 'bg-gray-100 dark:bg-white/10 text-gray-500'}`}>
                                             {hasLogo ? (
                                                <img 
                                                    src={logoUrl!} 
                                                    alt={doc.entityName} 
                                                    className="w-full h-full object-contain p-2" 
                                                    onError={() => handleLogoError(logoUrl!)}
                                                />
                                            ) : (
                                                <span className="font-black text-xl opacity-40">{initial}</span>
                                            )}
                                        </div>
                                        
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h4 className="font-black text-light-text dark:text-dark-text text-lg truncate tracking-tight">{doc.entityName}</h4>
                                                <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-black tracking-widest bg-black/[0.03] dark:bg-white/5 px-2 py-0.5 rounded-full border border-black/5 dark:border-white/5">{doc.number}</span>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary opacity-60">
                                                <span className="flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                                                    {parseLocalDate(doc.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </span>
                                                {doc.dueDate && (
                                                    <span className={`flex items-center gap-1.5 ${doc.status === 'overdue' ? 'text-rose-500 opacity-100' : ''}`}>
                                                        <span className="material-symbols-outlined text-[16px]">timer</span>
                                                        Due {parseLocalDate(doc.dueDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-8 w-full sm:w-auto justify-between sm:justify-end">
                                         <div className="text-right">
                                             <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 border ${statusStyle.bg} ${statusStyle.text} border-current border-opacity-10 shadow-sm`}>
                                                <span className="material-symbols-outlined text-[14px]">{statusStyle.icon}</span>
                                                {doc.status}
                                             </span>
                                             <p className="font-mono font-black text-xl text-light-text dark:text-dark-text tracking-tighter">{formatCurrency(doc.total, doc.currency)}</p>
                                         </div>
                                         
                                         <div className="flex gap-2">
                                             {doc.type === 'quote' && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleConvertToInvoice(doc); }}
                                                    className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-white/5 flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                                                    title="Convert to Invoice"
                                                >
                                                    <span className="material-symbols-outlined text-xl">transform</span>
                                                </button>
                                             )}
                                             <button 
                                                onClick={(e) => { e.stopPropagation(); setDeletingId(doc.id); }}
                                                className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-white/5 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                                                title="Delete"
                                             >
                                                 <span className="material-symbols-outlined text-xl">delete</span>
                                             </button>
                                         </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default InvoicesPage;
