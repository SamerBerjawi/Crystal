import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Account, AssetClosureDetails } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE } from '../constants';
import { formatCurrency, toLocalISOString } from '../utils';
import Icon from './ui/Icon';

interface CloseAssetModalProps {
  isOpen?: boolean;
  onClose: () => void;
  account: Account;
  accounts: Account[];
  onConfirm: (details: AssetClosureDetails) => void;
}

const CloseAssetModal: React.FC<CloseAssetModalProps> = ({
  isOpen = true,
  onClose,
  account,
  accounts,
  onConfirm
}) => {
  const [closureType, setClosureType] = useState<AssetClosureDetails['closureType']>('Sold');
  const [date, setDate] = useState(toLocalISOString(new Date()));
  const [value, setValue] = useState(account.balance.toString());
  const [incomeAccountId, setIncomeAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 20);
    return () => clearTimeout(timer);
  }, []);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 250);
  };

  const liquidAccounts = accounts.filter(acc => 
    acc.type === 'Checking' || acc.type === 'Savings'
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      closureType,
      date,
      value: parseFloat(value) || 0,
      incomeAccountId: closureType === 'Sold' ? incomeAccountId : undefined,
      notes
    });
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
          className={`w-screen max-w-lg bg-light-card dark:bg-dark-card shadow-2xl border-l border-black/10 dark:border-white/10 flex flex-col transform transition-transform duration-300 ease-out ${
            isVisible ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Header */}
          <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-rose-500/5 to-transparent">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20 shadow-xs">
                <Icon name="archive" className="text-2xl" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight truncate">
                  Close & Liquidate Asset
                </h2>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5 font-medium">
                  {account.name} ({formatCurrency(account.balance, account.currency)})
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

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

              {/* Closure Type Picker */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                  Closure Disposition
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 p-1 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5">
                  {([
                    { id: 'Sold', label: 'Sell' },
                    { id: 'Returned', label: 'Return' },
                    { id: 'Gifted', label: 'Give Away' },
                    { id: 'Retired', label: 'Retire' },
                    { id: 'Written Off', label: 'Write Off' }
                  ] as const).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setClosureType(item.id)}
                      className={`py-2.5 px-1 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-center ${
                        closureType === item.id 
                          ? 'bg-white dark:bg-dark-card shadow-sm text-rose-500' 
                          : 'text-light-text-secondary dark:text-dark-text-secondary opacity-60 hover:opacity-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Value and Date Grid */}
              <div className="p-5 rounded-3xl bg-light-fill dark:bg-dark-fill/50 border border-black/5 dark:border-white/5 space-y-4">
                <div className="space-y-2">
                  <label htmlFor="closure-value" className="block text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                    {closureType === 'Sold' ? 'Realized Selling Price' : 'Closing Valuation'} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">€</span>
                    <input
                      id="closure-value"
                      type="number"
                      step="0.01"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      className={`${INPUT_BASE_STYLE} pl-9 h-14 !text-2xl font-bold`}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="closure-date" className="block text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                    Effective Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="closure-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={`${INPUT_BASE_STYLE} h-12`}
                    required
                  />
                </div>

                {closureType === 'Sold' && (
                  <div className="space-y-2">
                    <label htmlFor="income-acc" className="block text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                      Deposit Proceeds To <span className="text-rose-500">*</span>
                    </label>
                    <div className={SELECT_WRAPPER_STYLE}>
                      <select
                        id="income-acc"
                        value={incomeAccountId}
                        onChange={(e) => setIncomeAccountId(e.target.value)}
                        className={`${SELECT_STYLE} h-12 font-bold`}
                        required
                      >
                        <option value="">Select Destination Account</option>
                        {liquidAccounts.map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({formatCurrency(acc.balance, acc.currency)})
                          </option>
                        ))}
                      </select>
                      <div className={SELECT_ARROW_STYLE}>
                        <Icon name="expand_more" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label htmlFor="closure-notes" className="block text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                  Closing Notes & Documentation
                </label>
                <textarea
                  id="closure-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={`${INPUT_BASE_STYLE} p-4`}
                  rows={3}
                  placeholder="Reason for closure, buyer information, or receipt reference..."
                />
              </div>

            </div>

            {/* Sticky Bottom Actions */}
            <div className="p-6 border-t border-black/5 dark:border-white/5 bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-md flex items-center justify-between gap-3">
              <button 
                type="button" 
                onClick={handleClose} 
                className={`${BTN_SECONDARY_STYLE} h-12 px-6 text-xs font-bold uppercase tracking-wider`}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="h-12 px-8 rounded-2xl text-xs font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-2 shadow-lg shadow-rose-600/20 active:scale-95 transition-all"
              >
                <span>Confirm Closure</span>
                <Icon name="check" className="text-base" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default CloseAssetModal;
