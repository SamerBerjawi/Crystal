
import React, { useState } from 'react';
import Modal from './Modal';
import { Warrant } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { toLocalISOString, formatCurrency } from '../utils';

interface WarrantModalProps {
  onClose: () => void;
  onSave: (warrant: Omit<Warrant, 'id'> & { id?: string }) => void;
  warrantToEdit?: Warrant | null;
}

const WarrantModal: React.FC<WarrantModalProps> = ({ onClose, onSave, warrantToEdit }) => {
    const isEditing = !!warrantToEdit;
    
    const [isin, setIsin] = useState(warrantToEdit?.isin || '');
    const [name, setName] = useState(warrantToEdit?.name || '');
    const [grantDate, setGrantDate] = useState(warrantToEdit?.grantDate || toLocalISOString(new Date()));
    const [quantity, setQuantity] = useState(warrantToEdit?.quantity ? String(warrantToEdit.quantity) : '');
    const [grantPrice, setGrantPrice] = useState(warrantToEdit?.grantPrice !== undefined ? String(warrantToEdit.grantPrice) : '10.00');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            id: warrantToEdit?.id,
            isin: isin.toUpperCase(),
            name,
            grantDate,
            quantity: parseFloat(quantity),
            grantPrice: parseFloat(grantPrice),
        });
        onClose();
    };

    const labelStyle = "block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1.5";
    const modalTitle = isEditing ? 'Edit Warrant Grant' : 'Add Warrant Grant';
    
    const totalGrantValue = (parseFloat(quantity) || 0) * (parseFloat(grantPrice) || 0);

    return (
        <Modal onClose={onClose} title={modalTitle}>
            <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Asset Info Section */}
                <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-black/5 dark:border-white/5 space-y-4">
                    <h4 className="font-bold text-sm text-light-text dark:text-dark-text flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary-500">token</span>
                        Asset Information
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-1">
                            <label htmlFor="isin" className={labelStyle}>Ticker / ISIN</label>
                            <input id="isin" type="text" value={isin} onChange={e => setIsin(e.target.value)} className={`${INPUT_BASE_STYLE} uppercase font-mono`} placeholder="AAPL" required autoFocus />
                        </div>
                        <div className="col-span-2">
                            <label htmlFor="name" className={labelStyle}>Asset Name</label>
                            <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g. Apple Inc." required />
                        </div>
                    </div>
                </div>

                {/* Grant Details Section */}
                <div>
                     <h4 className="font-bold text-sm text-light-text dark:text-dark-text mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary-500">contract</span>
                        Grant Details
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="quantity" className={labelStyle}>Quantity</label>
                            <input id="quantity" type="number" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} className={`${INPUT_BASE_STYLE} font-mono`} placeholder="0" required />
                        </div>
                        <div>
                            <label htmlFor="grantPrice" className={labelStyle}>Strike Price (€)</label>
                            <input id="grantPrice" type="number" step="0.01" value={grantPrice} onChange={e => setGrantPrice(e.target.value)} className={`${INPUT_BASE_STYLE} font-mono`} required />
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Total Grant Value</span>
                    <span className="text-xl font-bold text-blue-700 dark:text-blue-300 font-mono">{formatCurrency(totalGrantValue, 'EUR')}</span>
                </div>

                <div>
                    <label htmlFor="grantDate" className={labelStyle}>Grant Date</label>
                    <input id="grantDate" type="date" value={grantDate} onChange={e => setGrantDate(e.target.value)} className={INPUT_BASE_STYLE} required />
                </div>
                
                <div className="flex justify-end gap-3 pt-4 border-t border-black/5 dark:border-white/5">
                    <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                    <button type="submit" className={BTN_PRIMARY_STYLE}>{isEditing ? 'Save Changes' : 'Add Grant'}</button>
                </div>
            </form>
        </Modal>
    );
};

export default WarrantModal;
