
import React, { useState, useRef, useMemo, useCallback } from 'react';
import { Account, Transaction, Budget, RecurringTransaction, ImportExportHistoryItem, HistoryStatus, ImportDataType, Category, Page, FinancialData } from '../types';
import Card from '../components/Card';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import Modal from '../components/Modal';
import ImportWizard from '../components/ImportWizard';
import ExportModal, { ExportConfig } from '../components/ExportModal';
import ImportDetailsModal from '../components/ImportDetailsModal';
import ConfirmationModal from '../components/ConfirmationModal';
import FinalConfirmationModal from '../components/FinalConfirmationModal';
import SmartRestoreModal from '../components/SmartRestoreModal';
import { v4 as uuidv4 } from 'uuid';
import { arrayToCSV, downloadCSV, parseDateAsUTC } from '../utils';

interface DataManagementProps {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  recurringTransactions: RecurringTransaction[];
  allCategories: Category[];
  history: ImportExportHistoryItem[];
  onPublishImport: (items: any[], dataType: 'accounts' | 'transactions', fileName: string, originalData: Record<string, any>[], errors: Record<number, Record<string, string>>, newAccounts?: Account[]) => void;
  onDeleteHistoryItem: (id: string) => void;
  onDeleteImportedTransactions: (importId: string) => void;
  onResetAccount: () => void;
  setCurrentPage: (page: Page) => void;
  onRestoreData: (data: FinancialData) => void;
  fullFinancialData: FinancialData; 
}

const StatusBadge: React.FC<{ status: HistoryStatus }> = ({ status }) => {
    const config = {
        'Complete': { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', icon: 'check_circle' },
        'Failed': { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: 'error' },
        'In Progress': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', icon: 'sync' }
    };
    const { bg, text, icon } = config[status] || config['In Progress'];

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
            <span className="material-symbols-outlined text-[14px]">{icon}</span>
            {status}
        </span>
    );
};

const TypeBadge: React.FC<{ type: 'import' | 'export' }> = ({ type }) => {
    const isImport = type === 'import';
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide ${isImport ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'}`}>
            {isImport ? 'Import' : 'Export'}
        </span>
    );
};

const NewImportModal: React.FC<{ onClose: () => void, onSelect: (type: ImportDataType) => void }> = ({ onClose, onSelect }) => {
    const sources: { name: string; icon: string; type: ImportDataType, enabled: boolean, description: string }[] = [
        { name: 'Transactions (CSV)', icon: 'receipt_long', type: 'transactions', enabled: true, description: 'Import transactions from a CSV file.' },
        { name: 'Accounts (CSV)', icon: 'wallet', type: 'accounts', enabled: true, description: 'Import accounts from a CSV file.' },
    ];
    
    return (
        <Modal onClose={onClose} title="New External Import">
            <div className="space-y-4">
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    Import data from external sources like bank statements.
                </p>
                <div className="space-y-2">
                    {sources.map(source => (
                        <button 
                            key={source.type}
                            onClick={() => onSelect(source.type)}
                            disabled={!source.enabled}
                            className="w-full flex justify-between items-center p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left border border-transparent hover:border-black/5 dark:hover:border-white/10"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center text-primary-600 dark:text-primary-400">
                                    <span className="material-symbols-outlined">{source.icon}</span>
                                </div>
                                <div>
                                    <span className="font-semibold text-light-text dark:text-dark-text block">{source.name}</span>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{source.description}</p>
                                </div>
                            </div>
                            <span className="material-symbols-outlined text-light-text-secondary dark:text-dark-text-secondary">chevron_right</span>
                        </button>
                    ))}
                </div>
            </div>
        </Modal>
    );
};

const StatCard: React.FC<{ title: string; value: string | number; icon: string; colorClass: string }> = ({ title, value, icon, colorClass }) => (
    <div className="bg-white dark:bg-dark-card p-4 rounded-xl border border-black/5 dark:border-white/5 shadow-sm flex items-center justify-between">
        <div>
            <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-1">{title}</p>
            <p className="text-2xl font-bold text-light-text dark:text-dark-text">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colorClass}`}>
            <span className="material-symbols-outlined text-2xl">{icon}</span>
        </div>
    </div>
);

const DataManagement: React.FC<DataManagementProps> = (props) => {
    const [isNewImportModalOpen, setNewImportModalOpen] = useState(false);
    
    // Updated state to handle export format
    const [exportConfig, setExportConfig] = useState<{ isOpen: boolean; format: 'json' | 'csv' }>({ isOpen: false, format: 'csv' });
    
    const [isRestoreModalOpen, setRestoreModalOpen] = useState(false);
    
    const [isWizardOpen, setWizardOpen] = useState(false);
    const [importType, setImportType] = useState<'transactions' | 'accounts' | null>(null);
    const [viewingDetails, setViewingDetails] = useState<ImportExportHistoryItem | null>(null);
    const [confirmingAction, setConfirmingAction] = useState<{ type: 'reset' } | null>(null);
    const [isFinalConfirmOpen, setFinalConfirmOpen] = useState(false);

    // Sort history descending by date
    const sortedHistory = useMemo(() => {
        return [...props.history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [props.history]);

    const stats = useMemo(() => {
        const imports = sortedHistory.filter(h => h.type === 'import').length;
        const exports = sortedHistory.filter(h => h.type === 'export').length;
        const lastActivity = sortedHistory.length > 0 
            ? new Date(sortedHistory[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) 
            : 'None';
        return { imports, exports, lastActivity };
    }, [sortedHistory]);

    const handleSelectImportType = (type: ImportDataType) => {
        if (type === 'transactions' || type === 'accounts') {
            setImportType(type);
            setNewImportModalOpen(false);
            setWizardOpen(true);
        }
    };
    
    // Process the granular export request
    const processExport = (config: ExportConfig) => {
        const { format, dataTypes, dateRange, accountIds } = config;
        
        // Filter Transactions
        let filteredTransactions = props.transactions;
        if (dateRange) {
            const start = parseDateAsUTC(dateRange.start);
            const end = parseDateAsUTC(dateRange.end);
            end.setHours(23, 59, 59, 999);
            filteredTransactions = filteredTransactions.filter(t => {
                const d = parseDateAsUTC(t.date);
                return d >= start && d <= end;
            });
        }
        if (accountIds && accountIds.length > 0) {
            filteredTransactions = filteredTransactions.filter(t => accountIds.includes(t.accountId));
        }

        // Filter Accounts
        let filteredAccounts = props.accounts;
        if (accountIds && accountIds.length > 0) {
            filteredAccounts = filteredAccounts.filter(a => accountIds.includes(a.id));
        }

        if (format === 'json') {
            // Build granular JSON
            const exportData: any = {};
            if (dataTypes.includes('accounts')) exportData.accounts = filteredAccounts;
            if (dataTypes.includes('transactions')) exportData.transactions = filteredTransactions;
            if (dataTypes.includes('budgets')) exportData.budgets = props.budgets;
            if (dataTypes.includes('schedule')) exportData.recurringTransactions = props.recurringTransactions;
            if (dataTypes.includes('categories')) {
                exportData.incomeCategories = props.allCategories.filter(c => c.classification === 'income');
                exportData.expenseCategories = props.allCategories.filter(c => c.classification === 'expense');
            }
            if (props.fullFinancialData) {
                 if (dataTypes.includes('investments')) {
                     exportData.investmentTransactions = props.fullFinancialData.investmentTransactions;
                     exportData.warrants = props.fullFinancialData.warrants;
                 }
                 if (dataTypes.includes('schedule')) {
                      exportData.billsAndPayments = props.fullFinancialData.billsAndPayments;
                 }
                 if (dataTypes.includes('invoices')) {
                     exportData.invoices = props.fullFinancialData.invoices;
                 }
                 if (dataTypes.includes('memberships')) {
                     exportData.memberships = props.fullFinancialData.memberships;
                 }
                 if (dataTypes.includes('goals')) {
                     exportData.financialGoals = props.fullFinancialData.financialGoals;
                 }
                 if (dataTypes.includes('tasks')) {
                     exportData.tasks = props.fullFinancialData.tasks;
                 }
                 if (dataTypes.includes('tags')) {
                     exportData.tags = props.fullFinancialData.tags;
                 }
            }
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `crystal-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
        } else {
            // CSV Export logic
            dataTypes.forEach(type => {
                let data: any[] = [];
                let filename = `crystal-${type}.csv`;

                if (type === 'transactions') {
                    data = filteredTransactions;
                } else if (type === 'accounts') {
                    data = filteredAccounts;
                } else if (type === 'categories') {
                    data = props.allCategories;
                } else if (type === 'budgets') {
                    data = props.budgets;
                } else if (type === 'schedule') {
                    data = [...props.recurringTransactions, ...props.fullFinancialData.billsAndPayments];
                } else if (type === 'investments' && props.fullFinancialData) {
                    data = props.fullFinancialData.investmentTransactions;
                } else if (type === 'invoices' && props.fullFinancialData) {
                    data = props.fullFinancialData.invoices || [];
                } else if (type === 'memberships' && props.fullFinancialData) {
                    data = props.fullFinancialData.memberships || [];
                } else if (type === 'goals' && props.fullFinancialData) {
                    data = props.fullFinancialData.financialGoals || [];
                } else if (type === 'tasks' && props.fullFinancialData) {
                    data = props.fullFinancialData.tasks || [];
                } else if (type === 'tags' && props.fullFinancialData) {
                    data = props.fullFinancialData.tags || [];
                }

                if (data.length > 0) {
                     const csv = arrayToCSV(data);
                     downloadCSV(csv, filename);
                }
            });
        }
    };

    const handleGranularRestore = (data: FinancialData, strategy: Record<string, 'merge' | 'replace'>) => {
        // Construct new data based on strategy
        const current = props.fullFinancialData;
        const mergedData = { ...current };

        Object.keys(data).forEach((key) => {
            const k = key as keyof FinancialData;
            const incoming = data[k];
            const existing = current[k];
            const strat = strategy[key] || 'merge';

            if (Array.isArray(incoming) && Array.isArray(existing)) {
                if (strat === 'replace') {
                    // @ts-ignore
                    mergedData[k] = incoming;
                } else {
                    // Merge - Naive concat. In a real app we might check IDs to avoid duplicates.
                    // But for now, we assume user knows what they are doing or we generate new IDs during import (hard here).
                    // We'll filter out exact ID matches to prevent hard errors, but logic issues might remain.
                    const existingIds = new Set(existing.map((i: any) => i.id).filter(Boolean));
                    const newItems = incoming.filter((i: any) => !existingIds.has(i.id));
                    // @ts-ignore
                    mergedData[k] = [...existing, ...newItems];
                }
            } else if (typeof incoming === 'object' && incoming !== null) {
                // Objects like preferences or manual prices
                if (strat === 'replace') {
                    // @ts-ignore
                    mergedData[k] = incoming;
                } else {
                    // @ts-ignore
                    mergedData[k] = { ...existing, ...incoming };
                }
            }
        });

        props.onRestoreData(mergedData);
        alert("Restore completed successfully.");
    };

    const handleWizardClose = () => {
        setWizardOpen(false);
        setImportType(null);
    };

    const handleConfirmAction = () => {
        if (!confirmingAction) return;
        if (confirmingAction.type === 'reset') {
            setFinalConfirmOpen(true);
            return;
        }
        setConfirmingAction(null);
    };

    const handleFinalConfirm = () => {
        if (confirmingAction?.type === 'reset') {
            props.onResetAccount();
        }
        setFinalConfirmOpen(false);
        setConfirmingAction(null);
    };
    
    const getConfirmationDetails = () => {
        if (!confirmingAction) return null;
        switch (confirmingAction.type) {
            case 'reset': return { title: 'Confirm Account Reset', message: 'This action will delete all your data. This cannot be undone. You will be asked for a final confirmation.', confirmText: 'Continue', variant: 'primary' as const };
            default: return null;
        }
    };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12 animate-fade-in-up">
      {isNewImportModalOpen && <NewImportModal onClose={() => setNewImportModalOpen(false)} onSelect={handleSelectImportType} />}
      
      {exportConfig.isOpen && (
        <ExportModal 
            onClose={() => setExportConfig({ ...exportConfig, isOpen: false })} 
            onExport={processExport} 
            accounts={props.accounts} 
            initialFormat={exportConfig.format}
        />
      )}

      {isRestoreModalOpen && <SmartRestoreModal onClose={() => setRestoreModalOpen(false)} onRestore={handleGranularRestore} currentData={props.fullFinancialData} />}
      
      {viewingDetails && <ImportDetailsModal item={viewingDetails} onClose={() => setViewingDetails(null)} onDeleteImport={props.onDeleteImportedTransactions} />}
      {isWizardOpen && importType && (
            <ImportWizard 
                importType={importType}
                onClose={handleWizardClose}
                onPublish={props.onPublishImport}
                existingAccounts={props.accounts}
                allCategories={props.allCategories}
            />
        )}
      
      {confirmingAction && getConfirmationDetails() && !isFinalConfirmOpen && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => setConfirmingAction(null)}
          onConfirm={handleConfirmAction}
          title={getConfirmationDetails()!.title}
          message={getConfirmationDetails()!.message}
          confirmButtonText={getConfirmationDetails()!.confirmText}
          confirmButtonVariant={getConfirmationDetails()!.variant || 'danger'}
        />
      )}
      
      {isFinalConfirmOpen && confirmingAction && (
        <FinalConfirmationModal
          isOpen={true}
          onClose={() => { setFinalConfirmOpen(false); setConfirmingAction(null); }}
          onConfirm={handleFinalConfirm}
          title="Final Confirmation"
          message={<p>This is your last chance. Once you confirm, the action will be executed permanently.</p>}
          requiredText="RESET"
          confirmButtonText={'Reset account'}
        />
      )}


      <header>
        <div className="flex items-center gap-4">
            <button onClick={() => props.setCurrentPage('Settings')} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                <span onClick={() => props.setCurrentPage('Settings')} className="hover:underline cursor-pointer">Settings</span>
                <span> / </span>
                <span className="text-light-text dark:text-dark-text font-medium">Data Management</span>
            </div>
        </div>
         <div className="mt-4">
            <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">Data Management</h1>
            <p className="text-light-text-secondary dark:text-dark-text-secondary mt-2">Control your data flow with precision.</p>
        </div>
      </header>
      
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title="Total Imports" value={stats.imports} icon="cloud_upload" colorClass="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
          <StatCard title="Total Exports" value={stats.exports} icon="cloud_download" colorClass="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
          <StatCard title="Last Activity" value={stats.lastActivity} icon="history" colorClass="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           {/* External Data */}
           <Card className="flex flex-col h-full bg-gradient-to-br from-white to-blue-50/50 dark:from-dark-card dark:to-blue-900/10 border-blue-100 dark:border-blue-900/30">
                <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
                        <span className="material-symbols-outlined text-2xl">table_view</span>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-light-text dark:text-dark-text">External Data</h3>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">Import new transactions or export for spreadsheets.</p>
                    </div>
                </div>
                <div className="mt-auto pt-6 grid grid-cols-2 gap-4">
                    <button onClick={() => setNewImportModalOpen(true)} className={`${BTN_PRIMARY_STYLE} w-full flex justify-center items-center gap-2 !py-3`}>
                        <span className="material-symbols-outlined">add</span>
                        Import CSV
                    </button>
                    <button onClick={() => setExportConfig({ isOpen: true, format: 'csv' })} className={`${BTN_SECONDARY_STYLE} w-full flex justify-center items-center gap-2 !py-3`}>
                        <span className="material-symbols-outlined">download</span>
                        Export Data
                    </button>
                </div>
           </Card>

           {/* Backup & Restore */}
           <Card className="flex flex-col h-full bg-gradient-to-br from-white to-purple-50/50 dark:from-dark-card dark:to-purple-900/10 border-purple-100 dark:border-purple-900/30">
                <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-500 text-white flex items-center justify-center shadow-lg shadow-purple-500/20 flex-shrink-0">
                        <span className="material-symbols-outlined text-2xl">save</span>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-light-text dark:text-dark-text">System Snapshots</h3>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">Backup your entire workspace or restore specific parts.</p>
                    </div>
                </div>
                <div className="mt-auto pt-6 grid grid-cols-2 gap-4">
                    <button onClick={() => setExportConfig({ isOpen: true, format: 'json' })} className={`${BTN_SECONDARY_STYLE} w-full flex justify-center items-center gap-2 !py-3`}>
                         {/* We reuse export modal but user chooses JSON format there */}
                        <span className="material-symbols-outlined">cloud_download</span>
                        Backup
                    </button>
                    <button onClick={() => setRestoreModalOpen(true)} className={`${BTN_SECONDARY_STYLE} w-full flex justify-center items-center gap-2 !py-3`}>
                        <span className="material-symbols-outlined">cloud_upload</span>
                        Restore
                    </button>
                </div>
           </Card>
      </div>

      {/* Activity History */}
      <Card className="p-0 overflow-hidden">
          <div className="p-6 border-b border-black/5 dark:border-white/5 flex justify-between items-center">
              <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Activity History</h3>
              <div className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md">
                  {sortedHistory.length} items
              </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="bg-light-bg dark:bg-black/20 border-b border-black/5 dark:border-white/5 text-light-text-secondary dark:text-dark-text-secondary uppercase text-xs font-bold tracking-wider">
                        <th className="px-6 py-3">Type</th>
                        <th className="px-6 py-3">File / Data</th>
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                    {sortedHistory.length > 0 ? (
                        sortedHistory.map(item => (
                            <tr key={item.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                                <td className="px-6 py-4">
                                    <TypeBadge type={item.type} />
                                </td>
                                <td className="px-6 py-4">
                                    <p className="font-medium text-light-text dark:text-dark-text">{item.fileName}</p>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary capitalize">{item.dataType}</p>
                                </td>
                                <td className="px-6 py-4 text-light-text-secondary dark:text-dark-text-secondary font-mono text-xs">
                                    {new Date(item.date).toLocaleString()}
                                </td>
                                <td className="px-6 py-4">
                                    <StatusBadge status={item.status} />
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => item.type === 'import' ? setViewingDetails(item) : alert('View details not available for exports.')}
                                            className="p-1.5 rounded-md text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-500 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                                            title="View Details"
                                        >
                                            <span className="material-symbols-outlined text-lg">visibility</span>
                                        </button>
                                        <button 
                                            onClick={() => props.onDeleteHistoryItem(item.id)}
                                            className="p-1.5 rounded-md text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                            title="Delete Log"
                                        >
                                            <span className="material-symbols-outlined text-lg">delete</span>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-light-text-secondary dark:text-dark-text-secondary">
                                No history recorded yet.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
          </div>
      </Card>

      {/* Danger Zone */}
      <div className="border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
                <h3 className="text-lg font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                    <span className="material-symbols-outlined">warning</span>
                    Danger Zone
                </h3>
                <p className="text-sm text-red-600/80 dark:text-red-300/80 mt-1 max-w-2xl">
                    Resetting your account will permanently delete all transactions, accounts, budgets, and settings. This action cannot be undone without a backup file.
                </p>
            </div>
            <button 
                onClick={() => setConfirmingAction({ type: 'reset' })}
                className="px-6 py-2.5 bg-white dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg font-semibold shadow-sm hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors whitespace-nowrap"
            >
                Reset Account
            </button>
      </div>

    </div>
  );
};

export default DataManagement;
