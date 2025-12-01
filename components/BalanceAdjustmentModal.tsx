
import React, { useState, useMemo } from 'react';
import Modal from './Modal';
import { Account } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { formatCurrency, toLocalISOString } from '../utils';

interface BalanceAdjustmentModalProps {
  onClose: () => void;
  onSave: (adjustmentAmount: number, date: string, notes: string) => void;
  account: Account;
}

const BalanceAdjustmentModal: React.FC<BalanceAdjustmentModalProps> = ({ onClose, onSave, account }) => {
  const [newBalance, setNewBalance] = useState(String(account.balance));
  const [date, setDate] = useState(toLocalISOString(new Date()));
  const [notes, setNotes] = useState('');
  
  const adjustmentAmount = useMemo(() => {
    const newBal = parseFloat(newBalance);
    if (isNaN(newBal)) {
      return 0;
    }
    return newBal - account.balance;
  }, [newBalance, account.balance]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(adjustmentAmount, date, notes);
  };
  
  const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";
  
  return (
    <Modal onClose={onClose} title={`Adjust Balance for ${account.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        
        <div className="p-4 rounded-lg bg-light-bg dark:bg-dark-bg text-center">
            <p className={labelStyle}>Current Balance</p>
            <p className="text-2xl font-bold">{formatCurrency(account.balance, account.currency)}</p>
        </div>

        <div>
          <label htmlFor="new-balance" className={labelStyle}>New Balance</label>
          <input
            id="new-balance"
            type="number"
            step="any"
            value={newBalance}
            onChange={(e) => setNewBalance(e.target.value)}
            className={INPUT_BASE_STYLE}
            required
            autoFocus
          />
        </div>
        
        <div className="p-4 rounded-lg bg-light-bg dark:bg-dark-bg text-center">
            <p className={labelStyle}>Adjustment</p>
            <p className={`text-2xl font-bold ${adjustmentAmount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {adjustmentAmount >= 0 ? '+' : ''}{formatCurrency(adjustmentAmount, account.currency)}
            </p>
        </div>

        <div>
          <label htmlFor="adjustment-date" className={labelStyle}>Adjustment Date</label>
          <input
            id="adjustment-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={INPUT_BASE_STYLE}
            required
          />
        </div>

        <div>
          <label htmlFor="adjustment-notes" className={labelStyle}>Notes (Optional)</label>
          <input
            id="adjustment-notes"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={INPUT_BASE_STYLE}
            placeholder="e.g., Found cash, corrected error"
          />
        </div>

        <div className="flex justify-end gap-4 pt-4">
          <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
          <button type="submit" className={BTN_PRIMARY_STYLE}>Save Adjustment</button>
        </div>
      </form>
    </Modal>
  );
};

export default BalanceAdjustmentModal;
