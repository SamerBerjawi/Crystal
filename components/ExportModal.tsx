import React, { useState } from 'react';
import Modal from './Modal';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, CHECKBOX_STYLE } from '../constants';
import { ImportDataType } from '../types';

// FIX: Changed 'recurringTransactions' to 'schedule' to align with ImportDataType
type ExportableData = 'accounts' | 'transactions' | 'budgets' | 'schedule' | 'categories' | 'investments';

interface ExportModalProps {
  onClose: () => void;
  onExport: (selectedTypes: ExportableData[]) => void;
}

const EXPORT_OPTIONS: { id: ExportableData; label: string }[] = [
    { id: 'accounts', label: 'Accounts' },
    { id: 'transactions', label: 'Transactions' },
    { id: 'investments', label: 'Investment Transactions' },
    { id: 'budgets', label: 'Budgets' },
    // FIX: Changed id to 'schedule' to match data mapping and type definitions
    { id: 'schedule', label: 'Recurring Transactions (Schedule)' },
    { id: 'categories', label: 'Categories' },
];

const ExportModal: React.FC<ExportModalProps> = ({ onClose, onExport }) => {
    const [selected, setSelected] = useState<ExportableData[]>(EXPORT_OPTIONS.map(o => o.id));

    const handleToggle = (type: ExportableData) => {
        setSelected(prev => 
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    const handleExport = () => {
        onExport(selected);
        onClose();
    };

    return (
        <Modal onClose={onClose} title="New Export">
            <div className="space-y-6">
                <div>
                    <h4 className="font-semibold text-light-text dark:text-dark-text mb-2">Select data to export to CSV</h4>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-3">
                        Select the data you want to include in your export. Each selected item will be downloaded as a separate CSV file.
                    </p>
                    <div className="space-y-2">
                        {EXPORT_OPTIONS.map(option => (
                            <label key={option.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selected.includes(option.id)}
                                    onChange={() => handleToggle(option.id)}
                                    className={CHECKBOX_STYLE}
                                />
                                <span className="font-medium text-light-text dark:text-dark-text">{option.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div className="flex justify-end gap-4">
                    <button onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                    <button onClick={handleExport} className={BTN_PRIMARY_STYLE} disabled={selected.length === 0}>Export to CSV</button>
                </div>
            </div>
        </Modal>
    );
};

export default ExportModal;