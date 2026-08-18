import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, CHECKBOX_STYLE, INPUT_BASE_STYLE } from '../constants';
import { Account } from '../types';
import Icon from './ui/Icon';

interface ExportModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onExport: (config: ExportConfig) => void;
  accounts: Account[];
  initialFormat?: 'json' | 'csv';
}

export interface ExportConfig {
    format: 'json' | 'csv';
    dataTypes: string[];
    dateRange?: { start: string; end: string };
    accountIds?: string[]; // Empty means all
}

const DATA_TYPES: { id: string; label: string; icon: string }[] = [
    { id: 'accounts', label: 'Accounts', icon: 'account_balance' },
    { id: 'transactions', label: 'Transactions', icon: 'receipt_long' },
    { id: 'invoices', label: 'Quotes & Invoices', icon: 'description' },
    { id: 'schedule', label: 'Schedule & Bills', icon: 'calendar_month' },
    { id: 'memberships', label: 'Loyalty Cards', icon: 'loyalty' },
    { id: 'goals', label: 'Forecasting & Goals', icon: 'flag' },
    { id: 'investments', label: 'Investments', icon: 'candlestick_chart' },
    { id: 'budgets', label: 'Budgets', icon: 'pie_chart' },
    { id: 'tasks', label: 'Tasks', icon: 'task_alt' },
    { id: 'categories', label: 'Categories', icon: 'category' },
    { id: 'tags', label: 'Tags', icon: 'label' },
    { id: 'preferences', label: 'Preferences', icon: 'settings' },
    { id: 'userStats', label: 'User Stats', icon: 'analytics' },
];

const ExportModal: React.FC<ExportModalProps> = ({ isOpen = true, onClose, onExport, accounts, initialFormat = 'csv' }) => {
    const [format, setFormat] = useState<'json' | 'csv'>(initialFormat);
    const [selectedTypes, setSelectedTypes] = useState<string[]>(DATA_TYPES.map(d => d.id));
    const [accountIds, setAccountIds] = useState<string[]>([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 20);
        return () => clearTimeout(timer);
    }, []);

    // Handle ESC key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 250);
    };

    const toggleType = (id: string) => {
        setSelectedTypes(prev => 
            prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedTypes.length === DATA_TYPES.length) {
            setSelectedTypes([]);
        } else {
            setSelectedTypes(DATA_TYPES.map(d => d.id));
        }
    };

    const toggleAccount = (id: string) => {
        setAccountIds(prev => 
            prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
        );
    };
    
    const selectAllAccounts = () => setAccountIds([]);

    const handleExport = () => {
        onExport({
            format,
            dataTypes: selectedTypes,
            dateRange: (startDate && endDate) ? { start: startDate, end: endDate } : undefined,
            accountIds: accountIds.length > 0 ? accountIds : undefined
        });
        handleClose();
    };

    const isAllSelected = selectedTypes.length === DATA_TYPES.length;

    const content = (
        <div className="fixed inset-0 z-50 overflow-hidden font-sans">
            {/* Backdrop */}
            <div 
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
                    isVisible ? 'opacity-100' : 'opacity-0'
                }`}
                onClick={handleClose}
            />

            {/* Sidebar Drawer */}
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
                <div 
                    className={`w-screen max-w-lg bg-light-card dark:bg-dark-card shadow-2xl border-l border-black/10 dark:border-white/10 flex flex-col transform transition-transform duration-300 ease-out ${
                        isVisible ? 'translate-x-0' : 'translate-x-full'
                    }`}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-primary-500/5 to-transparent">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0 border border-primary-500/20 shadow-xs">
                                <Icon name="download" className="text-2xl" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight truncate">
                                    Export Workspace Data
                                </h2>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5 font-medium">
                                    Generate CSV spreadsheet or full JSON backup
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={handleClose}
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
                            aria-label="Close drawer"
                        >
                            <Icon name="close" className="text-lg" />
                        </button>
                    </div>

                    {/* Scrollable Body */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

                            {/* Format Switcher */}
                            <div className="p-1 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex gap-1">
                                <button 
                                    onClick={() => setFormat('csv')} 
                                    className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                                        format === 'csv' 
                                            ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400' 
                                            : 'text-light-text-secondary dark:text-dark-text-secondary opacity-70 hover:opacity-100'
                                    }`}
                                >
                                    <Icon name="table_view" className="text-base" />
                                    <span>CSV Tables</span>
                                </button>
                                <button 
                                    onClick={() => setFormat('json')} 
                                    className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                                        format === 'json' 
                                            ? 'bg-white dark:bg-dark-card shadow-sm text-purple-600 dark:text-purple-400' 
                                            : 'text-light-text-secondary dark:text-dark-text-secondary opacity-70 hover:opacity-100'
                                    }`}
                                >
                                    <Icon name="code" className="text-base" />
                                    <span>Full JSON Backup</span>
                                </button>
                            </div>

                            {/* Data Type Checkboxes */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                                        Data Sets ({selectedTypes.length}/{DATA_TYPES.length})
                                    </span>
                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-primary-500 hover:text-primary-600">
                                        <input 
                                            type="checkbox" 
                                            checked={isAllSelected} 
                                            onChange={toggleSelectAll} 
                                            className={CHECKBOX_STYLE} 
                                        />
                                        <span>Select All</span>
                                    </label>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    {DATA_TYPES.map(type => {
                                        const isSelected = selectedTypes.includes(type.id);
                                        return (
                                            <label 
                                                key={type.id} 
                                                className={`flex items-center gap-2.5 p-3 rounded-2xl border cursor-pointer transition-all ${
                                                    isSelected 
                                                        ? 'bg-primary-500/10 border-primary-500/30 text-primary-600 dark:text-primary-400 shadow-xs' 
                                                        : 'bg-light-fill dark:bg-dark-fill/50 border-black/5 dark:border-white/5 opacity-70 hover:opacity-100'
                                                }`}
                                            >
                                                <input 
                                                    type="checkbox" 
                                                    checked={isSelected} 
                                                    onChange={() => toggleType(type.id)} 
                                                    className={CHECKBOX_STYLE} 
                                                />
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Icon name={type.icon} className="text-base shrink-0" />
                                                    <span className="font-bold text-xs truncate">{type.label}</span>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Transaction-Specific Filters */}
                            {selectedTypes.includes('transactions') && (
                                <div className="p-5 rounded-3xl bg-light-fill dark:bg-dark-fill/50 border border-black/5 dark:border-white/5 space-y-4">
                                    <span className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary block">
                                        Transaction Date & Account Filter
                                    </span>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-2xs font-bold uppercase tracking-wider mb-1 text-light-text-secondary dark:text-dark-text-secondary">Start Date</label>
                                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={`${INPUT_BASE_STYLE} h-11 text-xs`} />
                                        </div>
                                        <div>
                                            <label className="block text-2xs font-bold uppercase tracking-wider mb-1 text-light-text-secondary dark:text-dark-text-secondary">End Date</label>
                                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={`${INPUT_BASE_STYLE} h-11 text-xs`} />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-2xs font-bold uppercase tracking-wider mb-2 text-light-text-secondary dark:text-dark-text-secondary">Scope to Specific Accounts</label>
                                        <div className="max-h-36 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                                            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl">
                                                <input type="checkbox" checked={accountIds.length === 0} onChange={selectAllAccounts} className={CHECKBOX_STYLE} />
                                                <span>All Accounts</span>
                                            </label>
                                            {accounts.map(acc => (
                                                <label key={acc.id} className="flex items-center gap-2 text-xs font-medium cursor-pointer p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={accountIds.includes(acc.id)} 
                                                        onChange={() => toggleAccount(acc.id)} 
                                                        className={CHECKBOX_STYLE} 
                                                    />
                                                    <span className="truncate">{acc.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Sticky Bottom Actions */}
                        <div className="p-6 border-t border-black/5 dark:border-white/5 bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-md flex items-center justify-between gap-3">
                            <button 
                                type="button" 
                                onClick={handleClose} 
                                className={`${BTN_SECONDARY_STYLE} h-12 px-6 text-xs font-bold uppercase tracking-wider`}
                            >
                                Cancel
                            </button>
                            <button 
                                type="button" 
                                onClick={handleExport} 
                                disabled={selectedTypes.length === 0}
                                className={`${BTN_PRIMARY_STYLE} h-12 px-8 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-primary-500/20 active:scale-95 disabled:opacity-50`}
                            >
                                <span>Export ({selectedTypes.length})</span>
                                <Icon name="download" className="text-base" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
};

export default ExportModal;
