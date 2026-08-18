import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Account } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, CHECKBOX_STYLE } from '../constants';
import { formatCurrency, toLocalISOString } from '../utils';
import Icon from './ui/Icon';

interface BalanceAdjustmentModalProps {
  onClose: () => void;
  onSave: (adjustmentAmount: number, date: string, notes: string, isMarketAdjustment?: boolean) => void;
  account: Account;
}

const BalanceAdjustmentModal: React.FC<BalanceAdjustmentModalProps> = ({ onClose, onSave, account }) => {
  const [newBalance, setNewBalance] = useState(String(account.balance));
  const [date, setDate] = useState(toLocalISOString(new Date()));
  const [notes, setNotes] = useState('');
  const [isMarketAdjustment, setIsMarketAdjustment] = useState(false);
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
  
  const adjustmentAmount = useMemo(() => {
    const newBal = parseFloat(newBalance);
    if (isNaN(newBal)) {
      return 0;
    }
    return newBal - account.balance;
  }, [newBalance, account.balance]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(adjustmentAmount, date, notes, isMarketAdjustment);
    handleClose();
  };

  const handleQuickAdjust = (delta: number) => {
    const current = parseFloat(newBalance) || account.balance;
    const next = Math.round((current + delta) * 100) / 100;
    setNewBalance(String(next));
  };

  const handleSetExact = (val: number) => {
    setNewBalance(String(val));
  };
  
  const labelStyle = "block text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1.5";
  const isPositive = adjustmentAmount >= 0;
  const isZero = Math.abs(adjustmentAmount) < 0.0001;

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
          <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-amber-500/5 via-primary-500/5 to-transparent">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20 shadow-xs">
                <Icon name="tune" className="text-xl" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight truncate">
                    Adjust Balance
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                    {account.subType || account.type}
                  </span>
                </div>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5 font-medium">
                  {account.name} {account.financialInstitution ? `• ${account.financialInstitution}` : ''}
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

          {/* Form / Scrollable Content */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              
              {/* Balance Comparison Hero Card */}
              <div className="grid grid-cols-2 gap-4 p-5 rounded-3xl bg-gradient-to-br from-light-fill to-light-bg dark:from-dark-fill/60 dark:to-dark-bg/60 border border-black/5 dark:border-white/5">
                <div className="space-y-1">
                  <span className="text-2xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70 block">
                    Current Book Balance
                  </span>
                  <p className="text-xl sm:text-2xl font-black text-light-text dark:text-dark-text tracking-tight tabular-nums">
                    {formatCurrency(account.balance, account.currency)}
                  </p>
                </div>
                <div className="space-y-1 text-right">
                  <span className="text-2xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70 block">
                    Net Correction
                  </span>
                  <div className={`text-xl sm:text-2xl font-black tracking-tight tabular-nums flex items-center justify-end gap-1 ${
                    isZero 
                      ? 'text-gray-400 dark:text-gray-500' 
                      : isPositive 
                        ? 'text-emerald-500 dark:text-emerald-400' 
                        : 'text-rose-500 dark:text-rose-400'
                  }`}>
                    {!isZero && (isPositive ? '+' : '')}
                    {formatCurrency(adjustmentAmount, account.currency)}
                  </div>
                </div>
              </div>

              {/* Stated New Balance Input */}
              <div className="space-y-2">
                <label htmlFor="new-balance" className={labelStyle}>
                  Stated Target Balance <span className="text-rose-500">*</span>
                </label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-400 group-focus-within:text-primary-500 transition-colors">
                    {account.currency === 'USD' ? '$' : account.currency === 'GBP' ? '£' : '€'}
                  </span>
                  <input
                    id="new-balance"
                    type="number"
                    step="any"
                    value={newBalance}
                    onChange={(e) => setNewBalance(e.target.value)}
                    className={`${INPUT_BASE_STYLE} pl-10 h-14 !text-2xl font-black tabular-nums`}
                    placeholder="0.00"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Quick Adjustment Presets */}
              <div className="space-y-2">
                <span className="text-2xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-60 block">
                  Quick Adjustments
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickAdjust(50)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20 transition-all active:scale-95"
                  >
                    +50
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAdjust(100)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20 transition-all active:scale-95"
                  >
                    +100
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAdjust(500)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20 transition-all active:scale-95"
                  >
                    +500
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAdjust(-50)}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-500/20 transition-all active:scale-95"
                  >
                    -50
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAdjust(-100)}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-500/20 transition-all active:scale-95"
                  >
                    -100
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetExact(account.balance)}
                    className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 text-light-text-secondary dark:text-dark-text-secondary text-xs font-bold transition-all"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetExact(0)}
                    className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 text-light-text-secondary dark:text-dark-text-secondary text-xs font-bold transition-all"
                  >
                    Zero Out
                  </button>
                </div>
              </div>

              {/* Date & Note inputs */}
              <div className="space-y-4 pt-2">
                <div>
                  <label htmlFor="adjustment-date" className={labelStyle}>
                    Effective Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="adjustment-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={`${INPUT_BASE_STYLE} h-12 font-semibold`}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="adjustment-notes" className={labelStyle}>
                    Adjustment Memo / Reason (Optional)
                  </label>
                  <input
                    id="adjustment-notes"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={`${INPUT_BASE_STYLE} h-12`}
                    placeholder="e.g. Month-end statement reconciliation, cash count error"
                  />
                </div>
              </div>

              {/* Market Value Adjustment Checkbox for Investment/Asset accounts */}
              {(account.type === 'Investment' || account.type === 'Other Assets') && (
                <label className="flex items-start gap-3 p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-800/30 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={isMarketAdjustment}
                    onChange={(e) => setIsMarketAdjustment(e.target.checked)}
                    className={`${CHECKBOX_STYLE} mt-0.5`}
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 block">
                      Market Value Adjustment (Unrealized Revaluation)
                    </span>
                    <span className="text-2xs text-indigo-900/60 dark:text-indigo-300/60 block leading-relaxed">
                      Flags this transaction as a market capital gain or loss rather than manual cash deposit or withdrawal.
                    </span>
                  </div>
                </label>
              )}

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
                className={`${BTN_PRIMARY_STYLE} h-12 px-8 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-primary-500/20 active:scale-95`}
              >
                <span>Save Adjustment</span>
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

export default BalanceAdjustmentModal;
