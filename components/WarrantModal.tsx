
import React, { useState } from 'react';
import Modal from './Modal';
import { Warrant } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { toLocalISOString } from '../utils';

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
    // FIX: Check for undefined/null to allow 0 as a valid price
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

    const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";
    const modalTitle = isEditing ? 'Edit Warrant Grant' : 'Add Warrant Grant';

    return (
        <Modal onClose={onClose} title={modalTitle}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="isin" className={labelStyle}>ISIN / Ticker</label>
                        <input id="isin" type="text" value={isin} onChange={e => setIsin(e.target.value)} className={`${INPUT_BASE_STYLE} uppercase`} placeholder="NL0015001WR5" required />
                    </div>
                    <div>
                        <label htmlFor="name" className={labelStyle}>Name</label>
                        <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g., Prosus Warrants Q2 2024" required />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="quantity" className={labelStyle}>Quantity</label>
                        <input id="quantity" type="number" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} className={INPUT_BASE_STYLE} placeholder="100" required />
                    </div>
                    <div>
                        <label htmlFor="grantPrice" className={labelStyle}>Grant Price (€)</label>
                        <input id="grantPrice" type="number" step="0.01" value={grantPrice} onChange={e => setGrantPrice(e.target.value)} className={INPUT_BASE_STYLE} required />
                    </div>
                </div>
                <div>
                    <label htmlFor="grantDate" className={labelStyle}>Grant Date</label>
                    <input id="grantDate" type="date" value={grantDate} onChange={e => setGrantDate(e.target.value)} className={INPUT_BASE_STYLE} required />
                </div>
                <div className="flex justify-end gap-4 pt-4">
                    <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                    <button type="submit" className={BTN_PRIMARY_STYLE}>{isEditing ? 'Save Changes' : 'Add Grant'}</button>
                </div>
            </form>
        </Modal>
    );
};

export default WarrantModal;
