import React, { useState } from 'react';
import Modal from './Modal';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, BTN_DANGER_STYLE, INPUT_BASE_STYLE } from '../constants';
import { formatCurrency } from '../utils';

interface WarrantPriceModalProps {
  onClose: () => void;
  onSave: (isin: string, price: number | null) => void;
  isin: string;
  name: string;
  scrapedPrice: number | null;
  manualPrice: number | undefined;
}

const WarrantPriceModal: React.FC<WarrantPriceModalProps> = ({ onClose, onSave, isin, name, scrapedPrice, manualPrice }) => {
    const [newPrice, setNewPrice] = useState(manualPrice !== undefined ? String(manualPrice) : '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const parsedPrice = parseFloat(newPrice);
        if (newPrice.trim() === '' || isNaN(parsedPrice)) {
            onSave(isin, null); // Treat empty/invalid as clearing the override
        } else {
            onSave(isin, parsedPrice);
        }
        onClose();
    };
    
    const handleClear = () => {
        onSave(isin, null);
        onClose();
    };

    const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";
    
    return (
        <Modal onClose={onClose} title={`Set Manual Price for ${name}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                
                <div className="p-4 rounded-lg bg-light-bg dark:bg-dark-bg text-center">
                    <p className={labelStyle}>Live Market Price</p>
                    <p className="text-2xl font-bold">{scrapedPrice !== null ? formatCurrency(scrapedPrice, 'EUR') : 'Not available'}</p>
                </div>

                <div>
                    <label htmlFor="manual-price" className={labelStyle}>New Manual Price (€)</label>
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
                        Enter a price to override the live price. Leave blank and save to remove the override.
                     </p>
                </div>
                
                <div className="flex justify-between items-center pt-4">
                    <button type="button" onClick={handleClear} className={BTN_DANGER_STYLE} disabled={manualPrice === undefined}>
                        Remove Override
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