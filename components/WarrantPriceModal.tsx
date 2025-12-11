
import React, { useState } from 'react';
import Modal from './Modal';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, BTN_DANGER_STYLE, INPUT_BASE_STYLE } from '../constants';
import { formatCurrency, toLocalISOString } from '../utils';

interface WarrantPriceModalProps {
  onClose: () => void;
  onSave: (isin: string, price: number | null, date?: string) => void;
  isin: string;
  name: string;
  manualPrice: number | undefined;
}

const WarrantPriceModal: React.FC<WarrantPriceModalProps> = ({ onClose, onSave, isin, name, manualPrice }) => {
    const [newPrice, setNewPrice] = useState(manualPrice !== undefined ? String(manualPrice) : '');
    const [date, setDate] = useState(toLocalISOString(new Date()));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const parsedPrice = parseFloat(newPrice);
        if (newPrice.trim() === '' || isNaN(parsedPrice)) {
            onSave(isin, null, date); // Treat empty/invalid as clearing
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
    
    return (
        <Modal onClose={onClose} title={`Set Price for ${name}`}>
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
                    />
                </div>

                <div>
                    <label htmlFor="manual-price" className={labelStyle}>Price (€)</label>
                    <input
                        id="manual-price"
                        type="number"
                        step="any"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                        className={INPUT_BASE_STYLE}
                        placeholder={manualPrice !== undefined ? formatCurrency(manualPrice, 'EUR') : 'e.g., 12.34'}
                        autoFocus
                    />
                     <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                        Sets the price for the selected date. The latest date will determine the current value.
                     </p>
                </div>
                
                <div className="flex justify-between items-center pt-4">
                    <button type="button" onClick={handleClear} className={BTN_DANGER_STYLE} disabled={manualPrice === undefined && date === toLocalISOString(new Date())}>
                        Remove Entry
                    </button>
                    <div className="flex gap-4">
                        <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                        <button type="submit" className={BTN_PRIMARY_STYLE}>Save Price</button>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default WarrantPriceModal;
