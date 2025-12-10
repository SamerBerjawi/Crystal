
import React, { useState } from 'react';
import Modal from './Modal';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, CHECKBOX_STYLE, INPUT_BASE_STYLE } from '../constants';
import { Account } from '../types';

interface ExportModalProps {
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
    { id: 'accounts', label: 'Accounts', icon: 'wallet' },
    { id: 'transactions', label: 'Transactions', icon: 'receipt_long' },
    { id: 'invoices', label: 'Quotes & Invoices', icon: 'description' },
    { id: 'schedule', label: 'Schedule & Bills', icon: 'calendar_month' },
    { id: 'memberships', label: 'Loyalty Wallet', icon: 'loyalty' },
    { id: 'goals', label: 'Forecasting & Goals', icon: 'flag' },
    { id: 'investments', label: 'Investments', icon: 'candlestick_chart' },
    { id: 'budgets', label: 'Budgets', icon: 'pie_chart' },
    { id: 'tasks', label: 'Tasks', icon: 'task_alt' },
    { id: 'categories', label: 'Categories', icon: 'category' },
    { id: 'tags', label: 'Tags', icon: 'label' },
];

const ExportModal: React.FC<ExportModalProps> = ({ onClose, onExport, accounts, initialFormat = 'csv' }) => {
    const [format, setFormat] = useState<'json' | 'csv'>(initialFormat);
    // Default to ALL types selected
    const [selectedTypes, setSelectedTypes] = useState<string[]>(DATA_TYPES.map(d => d.id));
    const [accountIds, setAccountIds] = useState<string[]>([]); // Empty = All
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

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
    
    const selectAllAccounts = () => setAccountIds([]); // Empty implies all logic in this UI context

    const handleExport = () => {
        onExport({
            format,
            dataTypes: selectedTypes,
            dateRange: (startDate && endDate) ? { start: startDate, end: endDate } : undefined,
            accountIds: accountIds.length > 0 ? accountIds : undefined
        });
        onClose();
    };

    const isAllSelected = selectedTypes.length === DATA_TYPES.length;

    return (
        <Modal onClose={onClose} title="Export Data">
            <div className="space-y-6">
                
                {/* Format Selection */}
                <div className="flex bg-light-fill dark:bg-dark-fill p-1 rounded-lg">
                    <button 
                        onClick={() => setFormat('csv')} 
                        className={`flex-1 py-2 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-2 ${format === 'csv' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600' : 'text-light-text-secondary hover:text-light-text'}`}
                    >
                        <span className="material-symbols-outlined text-lg">table_view</span> CSV (Spreadsheet)
                    </button>
                    <button 
                        onClick={() => setFormat('json')} 
                        className={`flex-1 py-2 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-2 ${format === 'json' ? 'bg-white dark:bg-dark-card shadow-sm text-purple-600' : 'text-light-text-secondary hover:text-light-text'}`}
                    >
                        <span className="material-symbols-outlined text-lg">code</span> JSON (Backup)
                    </button>
                </div>

                {/* Data Types */}
                <div>
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">Include Data</h4>
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 px-2 py-1 rounded transition-colors">
                             <input 
                                type="checkbox" 
                                checked={isAllSelected} 
                                onChange={toggleSelectAll} 
                                className={CHECKBOX_STYLE} 
                             />
                             <span className="text-xs font-medium text-light-text dark:text-dark-text">Select All</span>
                        </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                        {DATA_TYPES.map(type => (
                            <label key={type.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedTypes.includes(type.id) ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800' : 'bg-light-bg dark:bg-dark-bg border-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}>
                                <input type="checkbox" checked={selectedTypes.includes(type.id)} onChange={() => toggleType(type.id)} className={CHECKBOX_STYLE} />
                                <div className="flex items-center gap-2">
                                     <span className="material-symbols-outlined text-lg opacity-70">{type.icon}</span>
                                     <span className="font-medium text-sm">{type.label}</span>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Filters (Transactions Only) */}
                {selectedTypes.includes('transactions') && (
                    <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-black/5 dark:border-white/5 space-y-4 animate-fade-in-up">
                         <h4 className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">Transaction Filters</h4>
                         
                         <div className="grid grid-cols-2 gap-4">
                             <div>
                                 <label className="block text-xs font-medium mb-1">Start Date</label>
                                 <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={INPUT_BASE_STYLE} />
                             </div>
                             <div>
                                 <label className="block text-xs font-medium mb-1">End Date</label>
                                 <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={INPUT_BASE_STYLE} />
                             </div>
                         </div>

                         <div>
                             <label className="block text-xs font-medium mb-2">Filter by Account (Optional)</label>
                             <div className="max-h-32 overflow-y-auto space-y-1 p-1">
                                 <label className="flex items-center gap-2 text-sm cursor-pointer p-1 hover:bg-black/5 rounded">
                                     <input type="checkbox" checked={accountIds.length === 0} onChange={selectAllAccounts} className={CHECKBOX_STYLE} />
                                     <span className="font-bold">All Accounts</span>
                                 </label>
                                 {accounts.map(acc => (
                                     <label key={acc.id} className="flex items-center gap-2 text-sm cursor-pointer p-1 hover:bg-black/5 rounded">
                                         <input 
                                            type="checkbox" 
                                            checked={accountIds.includes(acc.id)} 
                                            onChange={() => toggleAccount(acc.id)} 
                                            // Uncheck "All" implies filtering, so if All is selected, clicking one selects just that one
                                            className={CHECKBOX_STYLE} 
                                        />
                                         <span className="truncate">{acc.name}</span>
                                     </label>
                                 ))}
                             </div>
                         </div>
                    </div>
                )}

                <div className="flex justify-end gap-4 pt-2">
                    <button onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                    <button onClick={handleExport} className={BTN_PRIMARY_STYLE} disabled={selectedTypes.length === 0}>
                        Export {selectedTypes.length} Items
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ExportModal;
