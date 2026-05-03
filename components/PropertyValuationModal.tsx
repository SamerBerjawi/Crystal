
import React, { useState } from 'react';
import Modal from './Modal';
import { Account, PriceHistoryEntry } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { formatCurrency, toLocalISOString } from '../utils';

interface PropertyValuationModalProps {
  onClose: () => void;
  onSave: (newValue: number, date: string) => void;
  account: Account;
}

const PropertyValuationModal: React.FC<PropertyValuationModalProps> = ({ onClose, onSave, account }) => {
  const [newValue, setNewValue] = useState(String(account.balance));
  const [date, setDate] = useState(toLocalISOString(new Date()));
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newValue);
    if (!isNaN(val)) {
        onSave(val, date);
    }
  };
  
  const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";
  
  return (
    <Modal onClose={onClose} title={`Update Valuation for ${account.name}`}>
      <form onSubmit={handleSubmit} className="space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-light-fill dark:bg-white/5 border border-black/5 dark:border-white/5 text-center">
                <p className={labelStyle}>Last Valuation</p>
                <p className="text-xl font-bold">{formatCurrency(account.balance, account.currency)}</p>
            </div>
            <div className="p-4 rounded-xl bg-light-fill dark:bg-white/5 border border-black/5 dark:border-white/5 text-center">
                <p className={labelStyle}>Appreciation</p>
                <p className={`text-xl font-bold ${(parseFloat(newValue) - account.balance) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {(parseFloat(newValue) - account.balance) >= 0 ? '+' : ''}{formatCurrency(parseFloat(newValue) - account.balance, account.currency)}
                </p>
            </div>
        </div>

        <div>
          <label htmlFor="new-value" className={labelStyle}>New Market Value</label>
          <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 font-medium">{account.currency === 'EUR' ? '€' : account.currency === 'USD' ? '$' : account.currency}</span>
              <input
                id="new-value"
                type="number"
                step="any"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className={`${INPUT_BASE_STYLE} pl-10 h-12 text-lg font-bold`}
                required
                autoFocus
              />
          </div>
          <p className="mt-2 text-xs text-light-text-secondary dark:text-dark-text-secondary italic">The current balance of the account will be updated to reflect this valuation.</p>
        </div>
        
        <div>
          <label htmlFor="valuation-date" className={labelStyle}>Valuation Date</label>
          <input
            id="valuation-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={INPUT_BASE_STYLE}
            required
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-black/5 dark:border-white/5">
          <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
          <button type="submit" className={BTN_PRIMARY_STYLE}>Confirm New Valuation</button>
        </div>
      </form>
    </Modal>
  );
};

export default PropertyValuationModal;
