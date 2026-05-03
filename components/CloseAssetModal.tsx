import React, { useState } from 'react';
import Modal from './Modal';
import { Account, AssetClosureDetails } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE } from '../constants';
import { formatCurrency } from '../utils';

interface CloseAssetModalProps {
  onClose: () => void;
  account: Account;
  accounts: Account[];
  onConfirm: (details: AssetClosureDetails) => void;
}

const CloseAssetModal: React.FC<CloseAssetModalProps> = ({
  onClose,
  account,
  accounts,
  onConfirm
}) => {
  const [closureType, setClosureType] = useState<AssetClosureDetails['closureType']>('Sold');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [value, setValue] = useState(account.balance.toString());
  const [incomeAccountId, setIncomeAccountId] = useState('');
  const [notes, setNotes] = useState('');

  const liquidAccounts = accounts.filter(acc => 
    acc.type === 'Checking' || acc.type === 'Savings'
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      closureType,
      date,
      value: parseFloat(value),
      incomeAccountId: closureType === 'Sold' ? incomeAccountId : undefined,
      notes
    });
  };

  return (
    <Modal onClose={onClose} title={`Close ${account.type}: ${account.name}`}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-2">Closure Type</label>
            <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl gap-1">
              {(['Sold', 'Returned', 'Gifted', 'Written Off'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setClosureType(type)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${closureType === type ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-2">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={INPUT_BASE_STYLE}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-2">
              {closureType === 'Sold' ? 'Selling Price' : 'Value at Closure'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">€</span>
              <input
                type="number"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className={`${INPUT_BASE_STYLE} pl-8`}
                required
              />
            </div>
          </div>

          {closureType === 'Sold' && (
            <div className="col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-2">Deposit Funds To</label>
              <div className={SELECT_WRAPPER_STYLE}>
                <select
                  value={incomeAccountId}
                  onChange={(e) => setIncomeAccountId(e.target.value)}
                  className={SELECT_STYLE}
                  required
                >
                  <option value="">Select Account</option>
                  {liquidAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance, acc.currency)})</option>
                  ))}
                </select>
                <div className={SELECT_ARROW_STYLE}>
                  <span className="material-symbols-outlined">expand_more</span>
                </div>
              </div>
            </div>
          )}

          <div className="col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`${INPUT_BASE_STYLE} h-24 py-2 resize-none`}
              placeholder="Reason for closure, buyer details, etc."
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className={`${BTN_SECONDARY_STYLE} flex-1`}>Cancel</button>
          <button type="submit" className={`${BTN_PRIMARY_STYLE} flex-1 bg-red-600 hover:bg-red-700 text-white border-none`}>
            Confirm Closure
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CloseAssetModal;
