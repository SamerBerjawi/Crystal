import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ImportExportHistoryItem } from '../types';
import ConfirmationModal from './ConfirmationModal';
import { BTN_SECONDARY_STYLE } from '../constants';
import Icon from './ui/Icon';

interface ImportDetailsModalProps {
    isOpen?: boolean;
    item: ImportExportHistoryItem;
    onClose: () => void;
    onDeleteImport: (importId: string) => void;
}

const ImportDetailsModal: React.FC<ImportDetailsModalProps> = ({ item, onClose, onDeleteImport }) => {
    const [activeTab, setActiveTab] = useState<'successful' | 'errors'>('successful');
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 20);
        return () => clearTimeout(timer);
    }, []);

    // Handle ESC key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isConfirmOpen) {
                handleClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isConfirmOpen]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 250);
    };
    
    const successfulRows = item.importedData?.filter((_, index) => !item.errors?.[index]) || [];
    const errorRows = Object.entries(item.errors || {}).map(([index, error]) => ({
        originalIndex: parseInt(index, 10),
        data: item.importedData?.[parseInt(index, 10)] || {},
        error: Object.values(error).join(', '),
    }));

    const headers = item.importedData && item.importedData.length > 0 ? Object.keys(item.importedData[0]) : [];
    
    const handleConfirmDelete = () => {
        onDeleteImport(item.id);
        setIsConfirmOpen(false);
        handleClose();
    };

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
                    className={`w-screen max-w-2xl bg-light-card dark:bg-dark-card shadow-2xl border-l border-black/10 dark:border-white/10 flex flex-col transform transition-transform duration-300 ease-out ${
                        isVisible ? 'translate-x-0' : 'translate-x-full'
                    }`}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-primary-500/5 to-transparent">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0 border border-primary-500/20 shadow-xs">
                                <Icon name="table_view" className="text-2xl" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight truncate">
                                    Import History Log
                                </h2>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5 font-medium">
                                    {item.fileName}
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

                            {/* Stat Chips */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="p-3.5 rounded-2xl bg-light-fill dark:bg-dark-fill/50 border border-black/5 dark:border-white/5">
                                    <span className="text-2xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70 block">
                                        Timestamp
                                    </span>
                                    <span className="text-xs font-bold text-light-text dark:text-dark-text mt-1 block truncate">
                                        {new Date(item.date).toLocaleDateString(undefined, { dateStyle: 'short' })}
                                    </span>
                                </div>

                                <div className="p-3.5 rounded-2xl bg-light-fill dark:bg-dark-fill/50 border border-black/5 dark:border-white/5">
                                    <span className="text-2xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70 block">
                                        Status
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500 mt-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        {item.status}
                                    </span>
                                </div>

                                <div className="p-3.5 rounded-2xl bg-light-fill dark:bg-dark-fill/50 border border-black/5 dark:border-white/5">
                                    <span className="text-2xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70 block">
                                        Imported
                                    </span>
                                    <span className="text-xs font-black text-light-text dark:text-dark-text mt-1 block">
                                        {item.itemCount} rows
                                    </span>
                                </div>

                                <div className="p-3.5 rounded-2xl bg-light-fill dark:bg-dark-fill/50 border border-black/5 dark:border-white/5">
                                    <span className="text-2xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70 block">
                                        Errors
                                    </span>
                                    <span className={`text-xs font-black mt-1 block ${errorRows.length > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                        {errorRows.length} errors
                                    </span>
                                </div>
                            </div>

                            {/* Mode Tabs */}
                            <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-black/5 dark:border-white/5">
                                <button
                                    onClick={() => setActiveTab('successful')}
                                    className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                                        activeTab === 'successful'
                                            ? 'bg-white dark:bg-dark-card text-emerald-500 shadow-sm'
                                            : 'text-light-text-secondary dark:text-dark-text-secondary opacity-60 hover:opacity-100'
                                    }`}
                                >
                                    <Icon name="check_circle" className="text-sm" />
                                    <span>Imported Records ({successfulRows.length})</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('errors')}
                                    className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                                        activeTab === 'errors'
                                            ? 'bg-white dark:bg-dark-card text-rose-500 shadow-sm'
                                            : 'text-light-text-secondary dark:text-dark-text-secondary opacity-60 hover:opacity-100'
                                    }`}
                                >
                                    <Icon name="error" className="text-sm" />
                                    <span>Errors ({errorRows.length})</span>
                                </button>
                            </div>

                            {/* Table Display */}
                            <div className="rounded-2xl border border-black/5 dark:border-white/5 overflow-hidden bg-white dark:bg-dark-card">
                                <div className="max-h-96 overflow-auto custom-scrollbar">
                                    {activeTab === 'successful' && (
                                        <table className="w-full text-xs text-left">
                                            <thead>
                                                <tr className="border-b border-black/10 dark:border-white/10 bg-light-fill dark:bg-dark-fill/60">
                                                    {headers.map(h => (
                                                        <th key={h} className="p-3 font-bold uppercase tracking-wider text-2xs text-light-text-secondary dark:text-dark-text-secondary">
                                                            {h}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                                {successfulRows.map((row, index) => (
                                                    <tr key={index} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                                                        {headers.map(h => <td key={h} className="p-3 truncate max-w-xs">{row[h]}</td>)}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}

                                    {activeTab === 'errors' && (
                                        <table className="w-full text-xs text-left">
                                            <thead>
                                                <tr className="border-b border-black/10 dark:border-white/10 bg-light-fill dark:bg-dark-fill/60">
                                                    <th className="p-3 font-bold uppercase tracking-wider text-2xs">Row</th>
                                                    <th className="p-3 font-bold uppercase tracking-wider text-2xs text-rose-500">Error Detail</th>
                                                    {headers.map(h => <th key={h} className="p-3 font-bold uppercase tracking-wider text-2xs">{h}</th>)}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                                {errorRows.map(({ originalIndex, data, error }) => (
                                                    <tr key={originalIndex} className="bg-rose-500/5">
                                                        <td className="p-3 font-mono font-bold">{originalIndex + 2}</td>
                                                        <td className="p-3 text-rose-600 dark:text-rose-400 font-bold">{error}</td>
                                                        {headers.map(h => <td key={h} className="p-3 truncate max-w-xs">{data[h]}</td>)}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>

                        </div>

                        {/* Sticky Bottom Actions */}
                        <div className="p-6 border-t border-black/5 dark:border-white/5 bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-md flex items-center justify-between gap-3">
                            <div>
                                {item.type === 'import' && item.dataType === 'transactions' && item.status === 'Complete' && item.itemCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setIsConfirmOpen(true)}
                                        className="h-12 px-4 rounded-2xl text-xs font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-all flex items-center gap-1.5"
                                    >
                                        <Icon name="delete_forever" className="text-base" />
                                        <span>Purge Import Data</span>
                                    </button>
                                )}
                            </div>

                            <button 
                                type="button" 
                                onClick={handleClose} 
                                className={`${BTN_SECONDARY_STYLE} h-12 px-8 text-xs font-bold uppercase tracking-wider`}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <ConfirmationModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Purge Imported Data"
                message={`Are you sure you want to delete this import and its ${item.itemCount} associated transactions? This cannot be undone.`}
                confirmButtonText="Purge Import"
            />
        </div>
    );

    return createPortal(content, document.body);
};

export default ImportDetailsModal;