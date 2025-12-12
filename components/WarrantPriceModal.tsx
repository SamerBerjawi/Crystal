
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, BTN_DANGER_STYLE, INPUT_BASE_STYLE } from '../constants';
import { toLocalISOString } from '../utils';

interface WarrantPriceModalProps {
  onClose: () => void;
  onSave: (isin: string, price: number | null, date?: string) => void;
  isin: string;
  name: string;
  initialEntry?: { date: string; price: number }; // New prop for editing specific logs
  manualPrice?: number | null | undefined;
}

const WarrantPriceModal: React.FC<WarrantPriceModalProps> = ({ onClose, onSave, isin, name, initialEntry, manualPrice }) => {
    const [newPrice, setNewPrice] = useState('');
    const [date, setDate] = useState(toLocalISOString(new Date()));

    useEffect(() => {
        if (initialEntry) {
            setNewPrice(String(initialEntry.price));
            setDate(initialEntry.date);
        } else {
            setNewPrice(manualPrice !== undefined && manualPrice !== null ? String(manualPrice) : '');
            setDate(toLocalISOString(new Date()));
        }
    }, [initialEntry, manualPrice]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const parsedPrice = parseFloat(newPrice);
        if (newPrice.trim() === '' || isNaN(parsedPrice)) {
            // If empty, treating as a delete request for this date is safer logic downstream
            onSave(isin, null, date); 
        } else {
            onSave(isin, parsedPrice, date);
        }
        onClose();
    };
    
    const handleClear = () => {
        onSave(isin, null, date);
        onClose();
    };

    const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";
    const title = initialEntry ? `Edit Price for ${initialEntry.date}` : `Log Price for ${name}`;
    
    return (
        <Modal onClose={onClose} title={title}>
            <form onSubmit={handleSubmit} className="space-y-4">
                
                <div>
                    <label htmlFor="price-date" className={labelStyle}>Date</label>
                    <input
                        id="price-date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className={INPUT_BASE_STYLE}
                        required
                        disabled={!!initialEntry} // Lock date if editing a specific history entry to prevent accidental duplication
                    />
                </div>

                <div>
                    <label htmlFor="manual-price" className={labelStyle}>Price per Unit (€)</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary">€</span>
                        <input
                            id="manual-price"
                            type="number"
                            step="any"
                            value={newPrice}
                            onChange={(e) => setNewPrice(e.target.value)}
                            className={`${INPUT_BASE_STYLE} pl-8`}
                            placeholder="0.00"
                            autoFocus
                        />
                    </div>
                </div>
                
                <div className="flex justify-between items-center pt-4">
                    <button type="button" onClick={handleClear} className={BTN_DANGER_STYLE}>
                        {initialEntry ? 'Delete Entry' : 'Clear Value'}
                    </button>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                        <button type="submit" className={BTN_PRIMARY_STYLE}>Save Price</button>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default WarrantPriceModal;
