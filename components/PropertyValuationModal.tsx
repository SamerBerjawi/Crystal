import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Account, PriceHistoryEntry } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { formatCurrency, toLocalISOString, parseLocalDate } from '../utils';
import Icon from './ui/Icon';

interface PropertyValuationModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onSave: (newValue: number, date: string) => void;
  onDeleteEntry?: (date: string) => void;
  account: Account;
}

const PropertyValuationModal: React.FC<PropertyValuationModalProps> = ({
  isOpen = true,
  onClose,
  onSave,
  onDeleteEntry,
  account
}) => {
  const [newValue, setNewValue] = useState(String(account.balance));
  const [date, setDate] = useState(toLocalISOString(new Date()));
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setNewValue(String(account.balance));
    setDate(toLocalISOString(new Date()));

    const timer = setTimeout(() => setIsVisible(true), 20);
    return () => clearTimeout(timer);
  }, [account]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newValue);
    if (!isNaN(val)) {
      onSave(val, date);
      handleClose();
    }
  };

  const delta = (parseFloat(newValue) || 0) - account.balance;
  const deltaPercent = account.balance > 0 ? (delta / account.balance) * 100 : 0;

  const content = (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Sidebar Drawer */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div 
          className={`w-screen max-w-lg bg-white dark:bg-dark-card backdrop-blur-2xl dark:shadow-[inset_1px_0_0_0_rgba(255,255,255,0.1)] text-light-text dark:text-dark-text shadow-2xl border-l border-black/10 dark:border-white/10 flex flex-col transform transition-transform duration-300 ease-out ${
            isVisible ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Header */}
          <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-orange-500/5 to-transparent">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 border border-orange-500/20 shadow-xs">
                <Icon name="home_work" className="text-2xl" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight truncate">
                  Property Valuation
                </h2>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5 font-medium">
                  {account.name}
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

          {/* Form / Scroll Content */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

              {/* Benchmark vs Delta Comparison */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-light-fill dark:bg-dark-fill/50 border border-black/5 dark:border-white/5">
                  <span className="text-2xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70 block">
                    Current Value
                  </span>
                  <span className="text-lg font-black text-light-text dark:text-dark-text tracking-tight mt-1 block">
                    {formatCurrency(account.balance, account.currency)}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-light-fill dark:bg-dark-fill/50 border border-black/5 dark:border-white/5">
                  <span className="text-2xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70 block">
                    Appreciation Delta
                  </span>
                  <span className={`text-lg font-black tracking-tight mt-1 block ${delta >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {delta >= 0 ? '+' : ''}{formatCurrency(delta, account.currency)} ({delta >= 0 ? '+' : ''}{deltaPercent.toFixed(1)}%)
                  </span>
                </div>
              </div>

              {/* Valuation Input */}
              <div className="p-5 rounded-3xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-sm space-y-4">
                <div className="space-y-2">
                  <label htmlFor="new-value" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Updated Market Assessment <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400 group-focus-within:text-orange-500 transition-colors">
                      {account.currency === 'EUR' ? '€' : account.currency === 'USD' ? '$' : account.currency}
                    </span>
                    <input
                      id="new-value"
                      type="number"
                      step="any"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      className={`${INPUT_BASE_STYLE} pl-9 h-14 !text-xl font-bold`}
                      required
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                    Net worth and property equity benchmarks will recalculate with this value.
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="valuation-date" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Appraisal Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="valuation-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={`${INPUT_BASE_STYLE} h-12`}
                    required
                  />
                </div>
              </div>

              {/* Historical Appraisal Ledger */}
              {account.priceHistory && account.priceHistory.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon name="history_edu" className="text-primary-500 text-base" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Valuation History ({account.priceHistory.length})
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                    {[...account.priceHistory].reverse().map((entry, idx) => (
                      <div 
                        key={idx} 
                        className="p-3.5 rounded-2xl bg-light-fill dark:bg-dark-fill/50 border border-black/5 dark:border-white/5 flex items-center justify-between gap-3 group"
                      >
                        <div>
                          <p className="text-sm font-bold text-light-text dark:text-dark-text">
                            {formatCurrency(entry.price, account.currency)}
                          </p>
                          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                            {parseLocalDate(entry.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setNewValue(String(entry.price));
                              setDate(entry.date);
                            }}
                            className="p-1.5 rounded-xl text-primary-500 hover:bg-primary-500/10 transition-colors"
                            title="Load valuation"
                          >
                            <Icon name="edit_note" className="text-base" />
                          </button>
                          {onDeleteEntry && (
                            <button
                              type="button"
                              onClick={() => onDeleteEntry(entry.date)}
                              className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors"
                              title="Delete record"
                            >
                              <Icon name="delete" className="text-base" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Sticky Bottom Actions */}
            <div className="p-6 border-t border-black/5 dark:border-white/5 bg-white/90 dark:bg-dark-card/80 backdrop-blur-md flex items-center justify-between gap-3">
              <button 
                type="button" 
                onClick={handleClose} 
                className={`${BTN_SECONDARY_STYLE} h-12 px-6 text-xs font-bold uppercase tracking-wider`}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className={`${BTN_PRIMARY_STYLE} h-12 px-8 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-primary-500/20 active:scale-95`}
              >
                <span>Save Valuation</span>
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

export default PropertyValuationModal;
