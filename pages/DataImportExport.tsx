
import React, { useState, useRef, useMemo } from 'react';
import { Account, Transaction, Budget, RecurringTransaction, ImportExportHistoryItem, HistoryStatus, ImportDataType, Category, Page } from '../types';
import Card from '../components/Card';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE } from '../constants';
import Modal from '../components/Modal';
import ImportWizard from '../components/ImportWizard';
import ExportModal from '../components/ExportModal';
import ImportDetailsModal from '../components/ImportDetailsModal';
import ConfirmationModal from '../components/ConfirmationModal';
import FinalConfirmationModal from '../components/FinalConfirmationModal';
import { v4 as uuidv4 } from 'uuid';

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
  onExportAllData: () => void;
  onImportAllData: (file: File) => void;
  onExportCSV: (types: ImportDataType[]) => void;
  setCurrentPage: (page: Page) => void;
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
        { name: 'OFX / QIF file', icon: 'file_upload', type: 'mint', enabled: false, description: 'Import from financial software formats. (Coming soon)' },
    ];
    
    return (
        <Modal onClose={onClose} title="New Import">
            <div className="space-y-4">
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    Select the type of data you would like to import.
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
    const [isExportModalOpen, setExportModalOpen] = useState(false);
    const [isWizardOpen, setWizardOpen] = useState(false);
    const [importType, setImportType] = useState<'transactions' | 'accounts' | null>(null);
    const [viewingDetails, setViewingDetails] = useState<ImportExportHistoryItem | null>(null);
    const [confirmingAction, setConfirmingAction] = useState<{ type: 'reset' } | null>(null);
    const [isFinalConfirmOpen, setFinalConfirmOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
    
    const handleRestoreClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            props.onImportAllData(file);
            if(fileInputRef.current) fileInputRef.current.value = "";
        }
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
      {isExportModalOpen && <ExportModal onClose={() => setExportModalOpen(false)} onExport={props.onExportCSV} />}
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
            <p className="text-light-text-secondary dark:text-dark-text-secondary mt-2">Import, export, and backup your financial data.</p>
        </div>
      </header>
      
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title="Total Imports" value={stats.imports} icon="cloud_upload" colorClass="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
          <StatCard title="Total Exports" value={stats.exports} icon="cloud_download" colorClass="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
          <StatCard title="Last Activity" value={stats.lastActivity} icon="history" colorClass="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           {/* CSV Operations */}
           <Card className="flex flex-col h-full">
                <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md flex-shrink-0">
                        <span className="material-symbols-outlined text-2xl">table_view</span>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-light-text dark:text-dark-text">Daily Data Tasks</h3>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">Import bank statements or export reports as CSV files.</p>
                    </div>
                </div>
                <div className="mt-auto pt-4 grid grid-cols-2 gap-4">
                    <button onClick={() => setNewImportModalOpen(true)} className={`${BTN_PRIMARY_STYLE} w-full flex justify-center items-center gap-2 !py-3`}>
                        <span className="material-symbols-outlined">add</span>
                        Import CSV
                    </button>
                    <button onClick={() => setExportModalOpen(true)} className={`${BTN_SECONDARY_STYLE} w-full flex justify-center items-center gap-2 !py-3`}>
                        <span className="material-symbols-outlined">download</span>
                        Export CSV
                    </button>
                </div>
           </Card>

           {/* Backup Operations */}
           <Card className="flex flex-col h-full">
                <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md flex-shrink-0">
                        <span className="material-symbols-outlined text-2xl">save</span>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-light-text dark:text-dark-text">Workspace Snapshots</h3>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">Save your entire Crystal setup to a JSON file for backup or migration.</p>
                    </div>
                </div>
                <div className="mt-auto pt-4 grid grid-cols-2 gap-4">
                    <button onClick={props.onExportAllData} className={`${BTN_SECONDARY_STYLE} w-full flex justify-center items-center gap-2 !py-3`}>
                        <span className="material-symbols-outlined">cloud_download</span>
                        Full Backup
                    </button>
                    <button onClick={handleRestoreClick} className={`${BTN_SECONDARY_STYLE} w-full flex justify-center items-center gap-2 !py-3`}>
                        <span className="material-symbols-outlined">cloud_upload</span>
                        Restore
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json"/>
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
