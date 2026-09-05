
import React, { useState, useMemo } from 'react';
import { Invoice, InvoiceType, InvoiceStatus, Currency } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE, SELECT_STYLE } from '../constants';
import { formatCurrency, parseLocalDate, toLocalISOString } from '../utils';
import Card from '../components/Card';
import ConfirmationModal from '../components/ConfirmationModal';
import { useInvoicesContext, usePreferencesContext, usePreferencesSelector } from '../contexts/DomainProviders';
import PageHeader from '../components/PageHeader';
import HeaderButton from '../components/HeaderButton';
import InvoiceModal from '../components/InvoiceModal';
import { getMerchantLogoUrl, normalizeMerchantKey } from '../utils/brandfetch';
import Icon from '../components/ui/Icon';
import HeroMetricCard from '../components/ui/HeroMetricCard';
import MetricCardRow from '../components/ui/MetricCardRow';
import SegmentedControl from '../components/ui/SegmentedControl';
import FilterBar from '../components/ui/FilterBar';

const STATUS_COLORS: Record<InvoiceStatus, { bg: string, text: string, icon: string }> = {
    draft: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', icon: 'Edit02' },
    sent: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', icon: 'send' },
    paid: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', icon: 'check_circle' },
    overdue: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', icon: 'alert_triangle' },
    accepted: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', icon: 'check_circle' },
    rejected: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-600 dark:text-rose-400', icon: 'x_circle' },
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
        <div className="w-full space-y-10 pb-20 animate-fade-in-up">
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

            <PageHeader
                accentColor="indigo"
                markerIcon="ReceiptCheck"
                markerLabel="Ledger & Receivables"
                title="Invoices & Quotes"
                subtitle="Financial Document Lifecycle Management"
                actions={
                    <div className="flex items-center gap-2">
                        <HeaderButton
                            variant="secondary"
                            icon="PlusCircle"
                            onClick={() => handleOpenEditor('quote')}
                        >
                            Draft Quote
                        </HeaderButton>
                        <HeaderButton
                            variant="primary"
                            icon="PlusCircle"
                            onClick={() => handleOpenEditor('invoice')}
                        >
                            New Invoice
                        </HeaderButton>
                    </div>
                }
            />

            {/* Financial Intelligence Hub */}
            <MetricCardRow columns={4}>
                <HeroMetricCard
                    variant="primary"
                    label="Aggregate Billing"
                    value={formatCurrency(metrics.paidMonth, currencyCode)}
                    subtext="Total invoices paid (Mo)"
                    icon="receipt"
                    iconColor="primary"
                    privacyBlur
                />
                <HeroMetricCard
                    variant="secondary"
                    label="Risk Exposure"
                    value={formatCurrency(metrics.overdue, currencyCode)}
                    subtext="Active overdue receivables"
                    icon="alert_triangle"
                    iconColor={metrics.overdue > 0 ? "rose" : "emerald"}
                    badgeText={metrics.overdue > 0 ? "At Risk" : "Clear"}
                    badgeVariant={metrics.overdue > 0 ? "elevated" : "optimal"}
                    privacyBlur
                />
                <HeroMetricCard
                    variant="secondary"
                    label="Liquid Pipeline"
                    value={formatCurrency(metrics.outstanding, currencyCode)}
                    subtext="Outstanding receivables"
                    icon="clock"
                    iconColor="blue"
                    privacyBlur
                />
                <HeroMetricCard
                    variant="secondary"
                    label="Quote Velocity"
                    value={formatCurrency(metrics.pendingQuotes, currencyCode)}
                    subtext="Active proposals pipeline"
                    icon="file_text"
                    iconColor="amber"
                    privacyBlur
                />
            </MetricCardRow>

            {/* Content Switcher & Filters */}
            <div className="glass-section rounded-[2.5rem] shadow-card overflow-hidden">
                <div className="p-6 sm:p-8 border-b border-slate-200/60 dark:border-white/5 flex flex-col xl:flex-row gap-6 justify-between items-center bg-transparent">
                    <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
                        {/* Tab Switcher */}
                        <SegmentedControl
                          items={[
                            { id: 'invoices', label: 'Invoices', icon: 'receipt_long' },
                            { id: 'quotes',   label: 'Proposals', icon: 'request_quote' },
                          ]}
                          activeId={activeTab}
                          onChange={(id) => setActiveTab(id as 'invoices' | 'quotes')}
                          className="w-full md:w-auto"
                        />

                        <div className="w-full md:w-96">
                            <FilterBar.Search 
                                placeholder="Search by identifier or entity..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="w-full xl:w-auto overflow-x-auto no-scrollbar">
                        <SegmentedControl
                            items={[
                                { id: 'all', label: 'All Status' },
                                ...Object.keys(STATUS_COLORS).map(s => ({
                                    id: s,
                                    label: s.charAt(0).toUpperCase() + s.slice(1),
                                    icon: STATUS_COLORS[s as InvoiceStatus]?.icon,
                                }))
                            ]}
                            activeId={statusFilter}
                            onChange={(id) => setStatusFilter(id as any)}
                            scrollable
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-900/[0.02] dark:bg-white/[0.02] border-b border-slate-200/60 dark:border-white/5">
                                <th className="px-6 sm:px-10 py-4 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Reference</th>
                                <th className="px-6 sm:px-10 py-4 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Entity Designation</th>
                                <th className="px-6 sm:px-10 py-4 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider hidden md:table-cell">Status Details</th>
                                <th className="px-6 sm:px-10 py-4 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider text-right">Aggregate Total</th>
                                <th className="px-6 sm:px-10 py-4 w-20"></th>
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
                                            <td className="px-6 sm:px-10 py-6">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-bold text-sm text-light-text dark:text-dark-text group-hover:text-primary-500 transition-colors">{doc.number}</span>
                                                    <span className="text-xs font-normal text-light-text-secondary dark:text-dark-text-secondary">{doc.date}</span>
                                                    <div className="md:hidden mt-2">
                                                         <div className={`inline-flex items-center gap-2 px-2.5 py-0.5 rounded-lg text-xs font-semibold border border-current border-opacity-10 shadow-sm ${statusStyle.bg} ${statusStyle.text}`}>
                                                             {doc.status}
                                                         </div>
                                                     </div>
                                                 </div>
                                             </td>
                                             <td className="px-6 sm:px-10 py-6">
                                                 <div className="flex items-center gap-4">
                                                     <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden transition-transform group-hover:scale-105 ${hasLogo ? 'bg-white dark:bg-white/10' : 'bg-gray-100 dark:bg-white/10 text-gray-400'}`}>
                                                         {hasLogo ? (
                                                             <img 
                                                                 src={logoUrl!} 
                                                                 alt={doc.entityName} 
                                                                 className="w-full h-full object-cover p-0 border-0" 
                                                                 onError={() => handleLogoError(logoUrl!)}
                                                             />
                                                         ) : (
                                                             <span className="font-bold text-lg opacity-40">{initial}</span>
                                                         )}
                                                     </div>
                                                     <div className="flex flex-col gap-1 min-w-0">
                                                         <span className="font-semibold text-sm text-light-text dark:text-dark-text truncate">{doc.entityName}</span>
                                                         <span className="text-xs font-normal text-light-text-secondary dark:text-dark-text-secondary truncate hidden sm:block">Client Identity</span>
                                                     </div>
                                                 </div>
                                             </td>
                                             <td className="px-6 sm:px-10 py-6 hidden md:table-cell">
                                                 <div className="flex items-center gap-3">
                                                     <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border border-current border-opacity-10 shadow-sm ${statusStyle.bg} ${statusStyle.text}`}>
                                                         <Icon name={statusStyle.icon} className="text-sm" />
                                                         {doc.status}
                                                     </div>
                                                     {doc.dueDate && (
                                                          <div className={`flex items-center gap-1.5 text-xs font-normal ${doc.status === 'overdue' ? 'text-rose-500 font-semibold' : 'text-light-text-secondary dark:text-dark-text-secondary opacity-75'}`}>
                                                             <Icon name={doc.status === 'overdue' ? 'warning' : 'event'} className="text-sm" />
                                                             Due {parseLocalDate(doc.dueDate).toLocaleDateString()}
                                                         </div>
                                                     )}
                                                 </div>
                                             </td>
                                             <td className="px-6 sm:px-10 py-6 text-right">
                                                 <span className="text-base sm:text-lg font-black font-mono tabular-nums tracking-tight text-light-text dark:text-dark-text privacy-blur">
                                                     {formatCurrency(doc.total, doc.currency)}
                                                 </span>
                                             </td>
                                             <td className="px-6 sm:px-10 py-6">
                                                 <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                     {doc.type === 'quote' && (
                                                         <button 
                                                             onClick={(e) => { e.stopPropagation(); handleConvertToInvoice(doc); }}
                                                             className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-emerald-500 hover:bg-emerald-500/10 rounded-2xl transition-all active:scale-90"
                                                             title="Convert to Invoice"
                                                         >
                                                             <Icon name="transform" className="text-xl sm:text-2xl" />
                                                         </button>
                                                     )}
                                                     <button 
                                                         onClick={(e) => { e.stopPropagation(); setDeletingId(doc.id); }}
                                                         className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all active:scale-90"
                                                     >
                                                         <Icon name="delete_sweep" className="text-xl sm:text-2xl" />
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
                                             <Icon name="inbox_customize" className="text-8xl" />
                                             <div className="space-y-1">
                                                 <p className="text-sm font-semibold uppercase tracking-wider">No Documents Identified</p>
                                                 <p className="text-xs font-normal">Adjust filters or issue a new record</p>
                                             </div>
                                         </div>
                                     </td>
                                 </tr>
                             )}
                         </tbody>
                     </table>
                 </div>

                 <div className="p-6 sm:p-8 bg-transparent border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between">
                     <p className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary">
                         Displaying {displayedDocs.length} of {invoices.length} Records
                     </p>
                    <div className="flex gap-2">
                         <button className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-2xl glass-tile text-gray-400 hover:text-primary-500 transition-colors disabled:opacity-30" disabled>
                            <Icon name="chevron_left" className="text-2xl" />
                         </button>
                         <button className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-2xl glass-tile text-gray-400 hover:text-primary-500 transition-colors disabled:opacity-30" disabled>
                            <Icon name="chevron_right" className="text-2xl" />
                         </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InvoicesPage;
