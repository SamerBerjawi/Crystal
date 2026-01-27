
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

    const [activeTab, setActiveTab] = useState<'invoices' | 'quotes'>('invoice');
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
    const [editorInitialType, setEditorInitialType] = useState<InvoiceType>('invoice');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
    const [logoLoadErrors, setLogoLoadErrors] = useState<Record<string, boolean>>({});

    // Derived Lists
    const displayedDocs = useMemo(() => {
        const typeMatch = activeTab === 'invoice' ? 'invoice' : 'quote';
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
        setActiveTab('invoice'); // Switch tab to show new invoice
    };

    const handleLogoError = (url: string) => setLogoLoadErrors(prev => ({ ...prev, [url]: true }));

    const MetricCard = ({ title, value, colorClass, icon }: { title: string, value: number, colorClass: string, icon: string }) => (
        <div className="bg-white dark:bg-dark-card p-4 rounded-xl border border-black/5 dark:border-white/5 shadow-sm flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">{title}</span>
                <span className={`material-symbols-outlined text-xl ${colorClass.split(' ')[0]}`}>{icon}</span>
            </div>
            <p className={`text-2xl font-bold ${colorClass.split(' ')[0]}`}>{formatCurrency(value, metrics.baseCurrency)}</p>
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
                            onClick={() => setActiveTab('invoice')} 
                            className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'invoice' ? 'bg-white dark:bg-dark-card shadow text-primary-600 dark:text-primary-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
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
                                    className="group bg-white dark:bg-dark-card p-4 rounded-xl border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        {/* Status Strip & Icon */}
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border border-black/5 dark:border-white/10 overflow-hidden ${hasLogo ? 'bg-white' : 'bg-gray-100 dark:bg-white/10 text-gray-500'}`}>
                                             {hasLogo ? (
                                                <img 
                                                    src={logoUrl!} 
                                                    alt={doc.entityName} 
                                                    className="w-full h-full object-contain" 
                                                    onError={() => handleLogoError(logoUrl!)}
                                                />
                                            ) : (
                                                <span className="font-bold text-lg">{initial}</span>
                                            )}
                                        </div>
                                        
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <h4 className="font-bold text-light-text dark:text-dark-text text-base truncate">{doc.entityName}</h4>
                                                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-mono bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded">{doc.number}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                                <span className="flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                                    {parseLocalDate(doc.date).toLocaleDateString()}
                                                </span>
                                                {doc.dueDate && (
                                                    <span className={`flex items-center gap-1 ${doc.status === 'overdue' ? 'text-red-500 font-bold' : ''}`}>
                                                        <span className="material-symbols-outlined text-[14px]">event_busy</span>
                                                        Due {parseLocalDate(doc.dueDate).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                                         <div className="text-right">
                                             <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider mb-1 ${statusStyle.bg} ${statusStyle.text}`}>
                                                <span className="material-symbols-outlined text-[12px]">{statusStyle.icon}</span>
                                                {doc.status}
                                             </span>
                                             <p className="font-mono font-bold text-lg text-light-text dark:text-dark-text">{formatCurrency(doc.total, doc.currency)}</p>
                                         </div>
                                         
                                         <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                             {doc.type === 'quote' && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleConvertToInvoice(doc); }}
                                                    className="p-2 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400"
                                                    title="Convert to Invoice"
                                                >
                                                    <span className="material-symbols-outlined text-xl">transform</span>
                                                </button>
                                             )}
                                             <button 
                                                onClick={(e) => { e.stopPropagation(); setDeletingId(doc.id); }}
                                                className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
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
