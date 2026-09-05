
import React, { useState, useMemo } from 'react';
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
import { arrayToCSV, downloadCSV, parseLocalDate, toLocalISOString } from '../utils';
import PageHeader from '../components/PageHeader';
import SettingsSubpageHeader from '../components/SettingsSubpageHeader';
import Icon from '../components/ui/Icon';
import StatCard from '../components/StatCard';
import { BentoGrid } from '../components/ui/bento-grid';

interface DataImportExportProps {
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
  onLogExport?: (dataType: ImportDataType, format: 'csv' | 'json', itemCount: number) => void;
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
            <Icon name={icon} className="text-xs" />
            {status}
        </span>
    );
};

const TypeBadge: React.FC<{ type: 'import' | 'export' | 'restore' }> = ({ type }) => {
    const isImport = type === 'import';
    const isRestore = type === 'restore';
    
    if (isRestore) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold  tracking-wide bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                Restore
            </span>
        );
    }
    
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold  tracking-wide ${isImport ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'}`}>
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
                                    <Icon name={source.icon} />
                                </div>
                                <div>
                                    <span className="font-semibold text-light-text dark:text-dark-text block">{source.name}</span>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{source.description}</p>
                                </div>
                            </div>
                            <Icon name="chevron_right" className="text-light-text-secondary dark:text-dark-text-secondary" />
                        </button>
                    ))}
                </div>
            </div>
        </Modal>
    );
};

const DataImportExportPage: React.FC<DataImportExportProps> = (props) => {
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
        const restores = sortedHistory.filter(h => h.type === 'restore').length;
        const lastActivity = sortedHistory.length > 0 
            ? new Date(sortedHistory[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) 
            : 'None';
        return { imports, exports, restores, lastActivity };
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
            const start = parseLocalDate(dateRange.start);
            const end = parseLocalDate(dateRange.end);
            end.setHours(23, 59, 59, 999);
            filteredTransactions = filteredTransactions.filter(t => {
                const d = parseLocalDate(t.date);
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
            
            if (dataTypes.includes('schedule')) {
                exportData.recurringTransactions = props.recurringTransactions;
                // Include related schedule metadata
                exportData.recurringTransactionOverrides = props.fullFinancialData.recurringTransactionOverrides;
                exportData.loanPaymentOverrides = props.fullFinancialData.loanPaymentOverrides;
                exportData.billsAndPayments = props.fullFinancialData.billsAndPayments;
            }

            if (dataTypes.includes('categories')) {
                exportData.incomeCategories = props.allCategories.filter(c => c.classification === 'income');
                exportData.expenseCategories = props.allCategories.filter(c => c.classification === 'expense');
            }
            
            if (props.fullFinancialData) {
                 if (dataTypes.includes('investments')) {
                     exportData.investmentTransactions = props.fullFinancialData.investmentTransactions;
                     exportData.warrants = props.fullFinancialData.warrants;
                     // Include prices and history to ensure portfolio value is correct on restore
                     exportData.manualWarrantPrices = props.fullFinancialData.manualWarrantPrices;
                     exportData.priceHistory = props.fullFinancialData.priceHistory;
                 }
                 if (dataTypes.includes('invoices')) {
                     exportData.invoices = props.fullFinancialData.invoices;
                 }
                 if (dataTypes.includes('memberships')) {
                     exportData.memberships = props.fullFinancialData.memberships;
                 }
                 if (dataTypes.includes('goals')) {
                     exportData.financialGoals = props.fullFinancialData.financialGoals;
                     exportData.predictions = props.fullFinancialData.predictions;
                 }
                 if (dataTypes.includes('tasks')) {
                     exportData.tasks = props.fullFinancialData.tasks;
                 }
                 if (dataTypes.includes('tags')) {
                     exportData.tags = props.fullFinancialData.tags;
                 }
                 if (dataTypes.includes('preferences')) {
                     exportData.preferences = props.fullFinancialData.preferences || {};
                 }
                 if (dataTypes.includes('userStats')) {
                     exportData.userStats = props.fullFinancialData.userStats;
                 }
            }
            
            props.onLogExport?.('snapshot', 'json', Object.keys(exportData).length);
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `crystal-export-${toLocalISOString(new Date())}.json`;
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
                     props.onLogExport?.(type as ImportDataType, 'csv', data.length);
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
    <div className="w-full pb-12 space-y-12 animate-fade-in-up px-4">
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


       {/* Navigation & Header */}
       <SettingsSubpageHeader
         markerIcon="download"
         markerLabel="Systems Core"
         title="Data Management"
         subtitle="Atomic data operations: maintain snapshots, import external ledgers, and manage system state."
         setCurrentPage={props.setCurrentPage}
       />
      
      {/* Stats Overview */}
      <BentoGrid className="grid-cols-2 md:grid-cols-4 auto-rows-auto gap-4 sm:gap-6">
          <StatCard title="Ingress" value={stats.imports} icon="download" colorClass="text-blue-600 dark:text-blue-400" />
          <StatCard title="Egress" value={stats.exports} icon="upload" colorClass="text-indigo-600 dark:text-indigo-400" />
          <StatCard title="Restored" value={stats.restores} icon="refresh" colorClass="text-emerald-600 dark:text-emerald-400" />
          <StatCard title="Uptime" value={stats.lastActivity} icon="history" colorClass="text-amber-600 dark:text-amber-400" />
      </BentoGrid>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
           {/* External Data */}
           <div className="relative group rounded-3xl overflow-hidden">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-3xl blur opacity-5 group-hover:opacity-10 transition duration-1000"></div>
              <div className="relative glass-section rounded-3xl p-8 border border-slate-200/60 dark:border-white/5 shadow-card flex flex-col h-full">
                  <div className="flex items-center gap-4 mb-6">
                      <div className="w-14 h-14 rounded-2xl bg-blue-500 text-white flex items-center justify-center shadow-xl shadow-blue-500/20">
                          <Icon name="table_chart" className="text-3xl" />
                      </div>
                      <div>
                          <h3 className="text-lg font-semibold text-light-text dark:text-dark-text leading-tight">External Data Desk</h3>
                          <p className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mt-1 opacity-70">CSV Ingress & Egress</p>
                      </div>
                  </div>
                  <p className="text-xs font-normal text-light-text-secondary dark:text-dark-text-secondary leading-relaxed opacity-80 mb-8">
                    Import transactions from bank statements or existing spreadsheets using the mapping engine.
                  </p>
                  <div className="mt-auto grid grid-cols-2 gap-4">
                      <button onClick={() => setNewImportModalOpen(true)} className="px-5 py-3 rounded-2xl bg-blue-500 text-white text-xs font-semibold tracking-wide shadow-xl shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2">
                        <Icon name="add_circle" className="text-lg" />
                        Import
                      </button>
                      <button onClick={() => setExportConfig({ isOpen: true, format: 'csv' })} className="px-5 py-3 rounded-2xl bg-black/5 dark:bg-white/5 text-xs font-semibold tracking-wide hover:bg-black/10 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                        <Icon name="download" className="text-lg" />
                        Export
                      </button>
                  </div>
              </div>
           </div>

           {/* Backup & Restore */}
           <div className="relative group rounded-3xl overflow-hidden">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-3xl blur opacity-5 group-hover:opacity-10 transition duration-1000"></div>
              <div className="relative glass-section rounded-3xl p-8 border border-slate-200/60 dark:border-white/5 shadow-card flex flex-col h-full">
                  <div className="flex items-center gap-4 mb-6">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-xl shadow-indigo-500/20">
                          <Icon name="terminal" className="text-3xl" />
                      </div>
                      <div>
                          <h3 className="text-lg font-semibold text-light-text dark:text-dark-text leading-tight">System Snapshots</h3>
                          <p className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mt-1 opacity-70">Full Environment State</p>
                      </div>
                  </div>
                  <p className="text-xs font-normal text-light-text-secondary dark:text-dark-text-secondary leading-relaxed opacity-80 mb-8">
                    Create atomic JSON backups of your entire configuration, including preferences, accounts, and histories.
                  </p>
                  <div className="mt-auto grid grid-cols-2 gap-4">
                      <button onClick={() => setExportConfig({ isOpen: true, format: 'json' })} className="px-5 py-3 rounded-2xl bg-indigo-500 text-white text-xs font-semibold tracking-wide shadow-xl shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2">
                        <Icon name="backup" className="text-lg" />
                        Backup
                      </button>
                      <button onClick={() => setRestoreModalOpen(true)} className="px-5 py-3 rounded-2xl bg-black/5 dark:bg-white/5 text-xs font-semibold tracking-wide hover:bg-black/10 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                        <Icon name="restore" className="text-lg" />
                        Restore
                      </button>
                  </div>
              </div>
           </div>
      </div>

      {/* Activity History */}
      <div className="glass-section rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-card overflow-hidden mb-12">
          <div className="p-8 border-b border-slate-200/60 dark:border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900/[0.02] dark:bg-white/[0.02]">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center">
                    <Icon name="history" />
                 </div>
                 <div>
                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text tracking-tight">Audit Trail</h3>
                    <p className="text-xs font-normal text-light-text-secondary dark:text-dark-text-secondary">Chronological Operation Log</p>
                 </div>
              </div>
              <div className="text-xs font-semibold text-primary-500 bg-primary-500/10 border border-primary-500/20 px-3 py-1 rounded-lg">
                  {sortedHistory.length} Registered Events
              </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
                <thead>
                    <tr className="bg-black/[0.03] dark:bg-white/[0.03] border-b border-black/5 dark:border-white/5">
                        <th className="px-8 py-4 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Type</th>
                        <th className="px-8 py-4 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Identifier</th>
                        <th className="px-8 py-4 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Timestamp</th>
                        <th className="px-8 py-4 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Status</th>
                        <th className="px-8 py-4 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider text-right">Control</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                    {sortedHistory.length > 0 ? (
                        sortedHistory.map(item => (
                            <tr key={item.id} className="hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors group">
                                <td className="px-8 py-6">
                                    <TypeBadge type={item.type} />
                                </td>
                                <td className="px-8 py-6">
                                    <p className="font-semibold text-light-text dark:text-dark-text tracking-tight">{item.fileName}</p>
                                    <p className="text-xs font-normal text-light-text-secondary dark:text-dark-text-secondary opacity-60 mt-0.5">
                                        Collection: {item.dataType}
                                        {item.details && (
                                            <span className="ml-2 text-primary-500">[{item.details}]</span>
                                        )}
                                    </p>
                                </td>
                                <td className="px-8 py-6 text-light-text-secondary dark:text-dark-text-secondary text-xs font-normal">
                                    {new Date(item.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                </td>
                                <td className="px-8 py-6">
                                    <StatusBadge status={item.status} />
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => item.type === 'import' ? setViewingDetails(item) : {}}
                                            disabled={item.type !== 'import'}
                                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-black/5 dark:bg-white/5 text-light-text-secondary dark:text-dark-text-secondary hover:bg-primary-500 hover:text-white disabled:opacity-20 transition-all shadow-sm"
                                            title="Inspector"
                                        >
                                            <Icon name="analytics" className="text-lg" />
                                        </button>
                                        <button 
                                            onClick={() => props.onDeleteHistoryItem(item.id)}
                                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                            title="Evict Log"
                                        >
                                            <Icon name="delete_sweep" className="text-lg" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={5} className="px-8 py-20 text-center">
                                <div className="flex flex-col items-center gap-3 opacity-20">
                                   <Icon name="inventory_2" className="text-5xl" />
                                   <p className="text-xs font-semibold uppercase tracking-wider">Vault Empty</p>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
          </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-500/5 border border-red-500/20 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0 border border-red-500/20">
                    <Icon name="dangerous" className="text-3xl" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 tracking-tight">Factory Reset</h3>
                    <p className="text-xs font-normal text-red-600/70 dark:text-red-400/70 mt-1 max-w-xl leading-relaxed">
                        Irreversible atomic wipe of all database records, configurations, and encrypted keys. This operation cannot be rolled back without a pre-existing System Snapshot.
                    </p>
                </div>
            </div>
            <button 
                onClick={() => setConfirmingAction({ type: 'reset' })}
                className="px-6 py-3 bg-red-500 text-white rounded-2xl text-xs font-semibold tracking-wide shadow-lg shadow-red-500/20 hover:scale-105 active:scale-95 transition-all whitespace-nowrap"
            >
                Execute Wipe
            </button>
      </div>

    </div>
  );
};

export default DataImportExportPage;
