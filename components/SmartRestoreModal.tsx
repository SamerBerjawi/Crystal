
import React, { useState } from 'react';
import Modal from './Modal';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, CHECKBOX_STYLE } from '../constants';
import { FinancialData } from '../types';

interface SmartRestoreModalProps {
  onClose: () => void;
  onRestore: (data: FinancialData, strategy: Record<string, 'merge' | 'replace'>) => void;
  currentData: FinancialData;
}

type SectionKey = keyof FinancialData;

const SECTIONS: { key: SectionKey; label: string; icon: string }[] = [
    { key: 'userProfile', label: 'User Profile (Name, Email, etc.)', icon: 'person' },
    { key: 'accounts', label: 'Accounts', icon: 'wallet' },
    { key: 'transactions', label: 'Transactions', icon: 'receipt_long' },
    { key: 'invoices', label: 'Quotes & Invoices', icon: 'description' },
    { key: 'budgets', label: 'Budgets', icon: 'pie_chart' },
    { key: 'financialGoals', label: 'Goals', icon: 'flag' },
    { key: 'predictions', label: 'Predictions', icon: 'psychology' },
    { key: 'recurringTransactions', label: 'Recurring Rules', icon: 'update' },
    { key: 'recurringTransactionOverrides', label: 'Schedule Overrides', icon: 'edit_calendar' },
    { key: 'billsAndPayments', label: 'Bills', icon: 'receipt' },
    { key: 'memberships', label: 'Loyalty Wallet', icon: 'loyalty' },
    { key: 'tasks', label: 'Tasks', icon: 'task_alt' },
    { key: 'investmentTransactions', label: 'Investment Txns', icon: 'candlestick_chart' },
    { key: 'warrants', label: 'Warrants/Grants', icon: 'card_membership' },
    { key: 'manualWarrantPrices', label: 'Manual Asset Prices', icon: 'price_change' },
    { key: 'priceHistory', label: 'Price History Logs', icon: 'history' },
    { key: 'loanPaymentOverrides', label: 'Loan Overrides', icon: 'edit_note' },
    { key: 'tags', label: 'Tags', icon: 'label' },
    { key: 'incomeCategories', label: 'Income Categories', icon: 'category' },
    { key: 'expenseCategories', label: 'Expense Categories', icon: 'category' },
    { key: 'userStats', label: 'User Statistics', icon: 'analytics' },
    { key: 'preferences', label: 'Settings & Preferences', icon: 'settings' },
];

const SmartRestoreModal: React.FC<SmartRestoreModalProps> = ({ onClose, onRestore }) => {
    const [file, setFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<FinancialData | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    // Selection state: true = include in restore
    const [selectedSections, setSelectedSections] = useState<Record<string, boolean>>({});
    
    // Strategy state: 'merge' or 'replace' per section
    const [strategies, setStrategies] = useState<Record<string, 'merge' | 'replace'>>({});

    const isObjectSection = (key: SectionKey) =>
        ['preferences', 'manualWarrantPrices', 'priceHistory', 'loanPaymentOverrides', 'userStats', 'userProfile'].includes(key);

    const hasSectionData = (key: SectionKey) => {
        if (!parsedData) return false;
        const data = parsedData[key];
        if (Array.isArray(data)) return data.length > 0;
        if (data && typeof data === 'object') return Object.keys(data).length > 0;
        return false;
    };

    const applyBulkStrategy = (strategy: 'merge' | 'replace') => {
        if (!parsedData) return;
        const nextSelections: Record<string, boolean> = {};
        const nextStrategies: Record<string, 'merge' | 'replace'> = {};

        SECTIONS.forEach(section => {
            const data = parsedData[section.key];
            const hasData = hasSectionData(section.key) || (section.key === 'preferences' && !!data);
            if (!hasData) return;
            nextSelections[section.key] = true;
            nextStrategies[section.key] = isObjectSection(section.key) ? 'replace' : strategy;
        });

        setSelectedSections(nextSelections);
        setStrategies(nextStrategies);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const json = JSON.parse(event.target?.result as string);
                    // Basic validation
                    if (!json || typeof json !== 'object') throw new Error("Invalid JSON format");
                    
                    setParsedData(json);
                    
                    // Initialize selections based on what exists in the file
                    const initialSelection: Record<string, boolean> = {};
                    const initialStrategies: Record<string, 'merge' | 'replace'> = {};
                    
                    SECTIONS.forEach(section => {
                        const data = json[section.key];
                        if (Array.isArray(data) && data.length > 0) {
                            initialSelection[section.key] = true;
                            // Change default to replace for arrays based on request
                            initialStrategies[section.key] = 'replace';
                        } else if (data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length > 0) {
                            // Objects (like preferences) default to replace usually, or merge properties
                            initialSelection[section.key] = true;
                            initialStrategies[section.key] = 'replace'; 
                        }
                    });
                    
                    setSelectedSections(initialSelection);
                    setStrategies(initialStrategies);
                    setError(null);
                } catch (err) {
                    console.error(err);
                    setError("Failed to parse backup file. Please ensure it is a valid Crystal JSON export.");
                    setParsedData(null);
                }
            };
            reader.readAsText(selectedFile);
        }
    };

    const handleRestore = () => {
        if (!parsedData) return;

        // Construct final data object based on selections
        const dataToRestore: any = {};
        
        Object.keys(selectedSections).forEach(key => {
            if (selectedSections[key]) {
                dataToRestore[key] = parsedData[key as keyof FinancialData];
            }
        });

        // Filter strategies to only include selected sections
        const activeStrategies: Record<string, 'merge' | 'replace'> = {};
        Object.keys(strategies).forEach(key => {
            if (selectedSections[key]) {
                activeStrategies[key] = strategies[key];
            }
        });

        onRestore(dataToRestore, activeStrategies);
        onClose();
    };

    const getCount = (key: SectionKey) => {
        if (!parsedData) return 0;
        const data = parsedData[key];
        if (Array.isArray(data)) return data.length;
        if (data && typeof data === 'object') return Object.keys(data).length || 1; 
        return 0;
    };

    return (
        <Modal onClose={onClose} title="Restore from Backup" size="xl">
            <div className="space-y-6">
                {!parsedData ? (
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-10 text-center hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                        <span className="material-symbols-outlined text-4xl text-gray-400 mb-2">upload_file</span>
                        <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-2">Upload Backup File</h3>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">Select a .json file exported from Crystal.</p>
                        <input 
                            type="file" 
                            accept=".json" 
                            onChange={handleFileChange} 
                            className="hidden" 
                            id="backup-upload"
                        />
                        <label htmlFor="backup-upload" className={`${BTN_PRIMARY_STYLE} inline-flex items-center cursor-pointer`}>
                            Browse Files
                        </label>
                        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex flex-col gap-4 pb-4 border-b border-black/10 dark:border-white/10">
                            <div className="flex justify-between items-center gap-4">
                                 <div className="min-w-0">
                                     <h3 className="font-bold text-light-text dark:text-dark-text truncate" title={file?.name}>{file?.name}</h3>
                                     <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Select sections to restore</p>
                                 </div>
                                 <button 
                                    onClick={() => { setParsedData(null); setFile(null); }} 
                                    className="text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                                 >
                                    Change File
                                 </button>
                            </div>
                            
                            <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 dark:bg-white/5 p-2 rounded-xl">
                                <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider px-2">Bulk Actions</span>
                                <div className="flex bg-white dark:bg-black/40 p-1 rounded-lg shadow-sm">
                                    <button 
                                        type="button"
                                        onClick={() => applyBulkStrategy('merge')}
                                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10`}
                                        title="Merge data where possible"
                                    >
                                        Merge All
                                    </button>
                                    <div className="w-px bg-gray-200 dark:bg-white/10 my-1 mx-1"></div>
                                    <button 
                                        type="button"
                                        onClick={() => applyBulkStrategy('replace')}
                                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10`}
                                        title="Overwrite existing data"
                                    >
                                        Replace All
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                            {SECTIONS.map(section => {
                                const count = getCount(section.key);
                                if (count === 0 && section.key !== 'preferences') return null; // Hide empty sections except prefs

                                const isObjectData = isObjectSection(section.key);

                                return (
                                    <div key={section.key} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-light-bg dark:bg-dark-bg border border-black/5 dark:border-white/5 gap-3">
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="checkbox" 
                                                checked={!!selectedSections[section.key]}
                                                onChange={(e) => setSelectedSections(prev => ({...prev, [section.key]: e.target.checked}))}
                                                className={CHECKBOX_STYLE}
                                            />
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-white dark:bg-white/10 text-light-text dark:text-dark-text`}>
                                                <span className="material-symbols-outlined text-lg">{section.icon}</span>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-sm text-light-text dark:text-dark-text">{section.label}</p>
                                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                                    {count} {isObjectData ? 'records' : 'items'} found
                                                </p>
                                            </div>
                                        </div>

                                        {selectedSections[section.key] && !isObjectData && (
                                            <div className="flex bg-white dark:bg-black/20 p-1 rounded-lg">
                                                <button 
                                                    onClick={() => setStrategies(prev => ({...prev, [section.key]: 'merge'}))}
                                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${strategies[section.key] === 'merge' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                                                    title="Keep existing data and add new items"
                                                >
                                                    Merge
                                                </button>
                                                <button 
                                                    onClick={() => setStrategies(prev => ({...prev, [section.key]: 'replace'}))}
                                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${strategies[section.key] === 'replace' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                                                    title="Delete existing data in this section and replace with backup"
                                                >
                                                    Replace
                                                </button>
                                            </div>
                                        )}
                                        {selectedSections[section.key] && isObjectData && (
                                             <span className="text-xs font-medium text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">Overwrites Existing</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                
                <div className="flex justify-end gap-3 pt-4 border-t border-black/10 dark:border-white/10">
                    <button onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                    <button onClick={handleRestore} disabled={!parsedData} className={BTN_PRIMARY_STYLE}>Restore Selected Data</button>
                </div>
            </div>
        </Modal>
    );
};

export default SmartRestoreModal;
