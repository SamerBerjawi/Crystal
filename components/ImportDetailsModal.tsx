import React, { useState } from 'react';
import { ImportExportHistoryItem } from '../types';
import Modal from './Modal';
import ConfirmationModal from './ConfirmationModal';
import Icon from './ui/Icon';

interface ImportDetailsModalProps {
    item: ImportExportHistoryItem;
    onClose: () => void;
    onDeleteImport: (importId: string) => void;
}

const ImportDetailsModal: React.FC<ImportDetailsModalProps> = ({ item, onClose, onDeleteImport }) => {
    const [activeTab, setActiveTab] = useState<'successful' | 'errors'>('successful');
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    
    const successfulRows = item.importedData?.filter((_, index) => !item.errors?.[index]) || [];
    const errorRows = Object.entries(item.errors || {}).map(([index, error]) => ({
        originalIndex: parseInt(index, 10),
        data: item.importedData?.[parseInt(index, 10)] || {},
        error: Object.values(error).join(', '),
    }));

    const headers = item.importedData && item.importedData.length > 0 ? Object.keys(item.importedData[0]) : [];
    
    const TabButton: React.FC<{ tabName: 'successful' | 'errors'; label: string; count: number }> = ({ tabName, label, count }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${activeTab === tabName ? 'border-primary-500 text-primary-500' : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:border-gray-300 dark:hover:border-gray-600'}`}
        >
            {label} <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${activeTab === tabName ? 'bg-primary-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>{count}</span>
        </button>
    );

    const handleDeleteClick = () => {
        setIsConfirmOpen(true);
    };

    const handleConfirmDelete = () => {
        onDeleteImport(item.id);
        setIsConfirmOpen(false);
        onClose();
    };

    return (
        <>
            <Modal onClose={onClose} title={`Import Details: ${item.fileName}`}>
                <div className="space-y-4">
                    <div className="text-sm space-y-1 text-light-text-secondary dark:text-dark-text-secondary">
                        <p><strong>Date:</strong> {new Date(item.date).toLocaleString()}</p>
                        <p><strong>Status:</strong> {item.status}</p>
                        <p><strong>Successfully Imported:</strong> {item.itemCount} rows</p>
                        <p><strong>Errors Found:</strong> {errorRows.length} rows</p>
                    </div>

                    <div className="border-b border-black/10 dark:border-white/10">
                        <TabButton tabName="successful" label="Successful Rows" count={successfulRows.length} />
                        <TabButton tabName="errors" label="Error Rows" count={errorRows.length} />
                    </div>

                    <div className="max-h-80 overflow-auto">
                        {activeTab === 'successful' && (
                            <table className="w-full text-xs text-left">
                                <thead>
                                    <tr className="border-b border-black/10 dark:border-white/10 bg-light-bg dark:bg-dark-bg">
                                        {headers.map(h => <th key={h} className="p-2 font-semibold capitalize">{h}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {successfulRows.map((row, index) => (
                                        <tr key={index} className="border-b border-black/5 dark:border-white/5 last:border-b-0">
                                            {headers.map(h => <td key={h} className="p-2 truncate">{row[h]}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'errors' && (
                            <table className="w-full text-xs text-left">
                                <thead>
                                    <tr className="border-b border-black/10 dark:border-white/10 bg-light-bg dark:bg-dark-bg">
                                        <th className="p-2 font-semibold">Row #</th>
                                        <th className="p-2 font-semibold">Error Message</th>
                                        {headers.map(h => <th key={h} className="p-2 font-semibold capitalize">{h}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {errorRows.map(({ originalIndex, data, error }) => (
                                        <tr key={originalIndex} className="border-b border-black/5 dark:border-white/5 last:border-b-0 bg-red-500/10">
                                            <td className="p-2 font-mono">{originalIndex + 2}</td>
                                            <td className="p-2 text-red-600 dark:text-red-400 font-semibold">{error}</td>
                                            {headers.map(h => <td key={h} className="p-2 truncate">{data[h]}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
                {item.type === 'import' && item.dataType === 'transactions' && item.status === 'Complete' && item.itemCount > 0 && (
                    <div className="flex justify-between items-center pt-4 mt-4 border-t border-black/10 dark:border-white/10">
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary max-w-xs">
                            Not happy with the result? You can remove all transactions created by this import.
                        </p>
                        <button
                            onClick={handleDeleteClick}
                            className="flex items-center gap-2 bg-red-100 text-red-700 font-semibold py-2 px-4 rounded-lg hover:bg-red-200 transition-all duration-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/70"
                        >
                            <Icon name="delete_forever" />
                            Delete Import
                        </button>
                    </div>
                )}
            </Modal>
            <ConfirmationModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Confirm Deletion"
                message={`Are you sure you want to delete this import and its ${item.itemCount} associated transactions? This action cannot be undone.`}
                confirmButtonText="Delete"
            />
        </>
    );
};

export default ImportDetailsModal;