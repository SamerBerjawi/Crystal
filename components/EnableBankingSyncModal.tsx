import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { EnableBankingSyncOptions } from '../types';
import { toLocalISOString } from '../utils';
import Icon from './ui/Icon';

interface EnableBankingSyncModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  minDate: string;
  maxDate: string;
  initialState: {
    transactionMode: EnableBankingSyncOptions['transactionMode'];
    updateBalance: boolean;
    syncStartDate: string;
  };
  onClose: () => void;
  onConfirm: (options: Required<Pick<EnableBankingSyncOptions, 'transactionMode' | 'updateBalance' | 'syncStartDate'>>) => void;
}

const EnableBankingSyncModal: React.FC<EnableBankingSyncModalProps> = ({
  isOpen,
  title,
  description,
  minDate,
  maxDate,
  initialState,
  onClose,
  onConfirm,
}) => {
  const clampDate = useMemo(
    () => (value?: string) => {
      if (!value) return value;
      const parsed = new Date(value);
      const min = new Date(minDate);
      const max = new Date(maxDate);

      if (parsed < min) return minDate;
      if (parsed > max) return maxDate;
      return value;
    },
    [maxDate, minDate]
  );

  const [state, setState] = useState({
    transactionMode: initialState.transactionMode || 'full',
    updateBalance: initialState.updateBalance,
    syncStartDate: clampDate(initialState.syncStartDate) || minDate,
  });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setState({
        transactionMode: initialState.transactionMode || 'full',
        updateBalance: initialState.updateBalance,
        syncStartDate: clampDate(initialState.syncStartDate) || minDate,
      });
      const timer = setTimeout(() => setIsVisible(true), 20);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [clampDate, initialState, isOpen, minDate]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 250);
  };

  const handleSetToday = () => {
    setState(prev => ({ ...prev, syncStartDate: toLocalISOString(new Date()) }));
  };

  const handleConfirm = () => {
    const transactionMode = state.transactionMode || 'full';
    const resolvedSyncStartDate = clampDate(state.syncStartDate) || minDate;
    const resolvedUpdateBalance = transactionMode === 'none' ? true : state.updateBalance;

    if (transactionMode === 'full' && !resolvedSyncStartDate) {
      alert('Select a sync start date to continue.');
      return;
    }

    onConfirm({
      transactionMode,
      updateBalance: resolvedUpdateBalance,
      syncStartDate: resolvedSyncStartDate,
    });
  };

  if (!isOpen && !isVisible) return null;

  const content = (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 font-sans">
      <div 
        className={`fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />
      <div className={`w-full max-w-lg bg-white dark:bg-dark-card backdrop-blur-2xl dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] text-light-text dark:text-dark-text shadow-2xl border border-black/10 dark:border-white/10 rounded-3xl overflow-hidden flex flex-col relative z-10 transform transition-all duration-300 ${
        isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
      }`}>
        
        {/* Header */}
        <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-primary-500/5 to-transparent">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-primary-500/10 border border-primary-500/20 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0 shadow-md">
              <Icon name="sync_alt" className="text-2xl" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight truncate">{title}</h4>
                <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20">
                  Sync
                </span>
              </div>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5 font-medium">{description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
            aria-label="Close modal"
          >
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        {/* Options */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          
          {/* Option 1: Transactions from a date */}
          <div
            className={`p-5 rounded-3xl border transition-all cursor-pointer ${
              state.transactionMode === 'full' 
                ? 'bg-primary-500/5 dark:bg-primary-500/10 border-primary-500/30 ring-1 ring-primary-500/20 shadow-sm' 
                : 'bg-light-fill dark:bg-dark-fill/50 border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10'
            }`}
            onClick={() => setState(prev => ({ ...prev, transactionMode: 'full' }))}
          >
            <div className="flex items-start gap-3.5">
              <div className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center ${state.transactionMode === 'full' ? 'border-primary-500 bg-primary-500 text-white' : 'border-black/30 dark:border-white/30'}`}>
                {state.transactionMode === 'full' && <div className="w-2 h-2 bg-white rounded-full"></div>}
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <div className="font-bold text-sm text-light-text dark:text-dark-text">Sync transactions & balance</div>
                  <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">Import transactions starting from a specific date and update account balance.</div>
                </div>
                
                {/* Date Picker (Nested) */}
                {state.transactionMode === 'full' && (
                  <div className="p-4 rounded-2xl bg-white/60 dark:bg-dark-card/70 backdrop-blur-xl border border-black/5 dark:border-white/10 space-y-2" onClick={e => e.stopPropagation()}>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300" htmlFor="enable-banking-sync-start">
                      Import From Date
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="enable-banking-sync-start"
                        type="date"
                        min={minDate}
                        max={maxDate}
                        value={clampDate(state.syncStartDate) || ''}
                        onChange={(e) => setState(prev => ({ ...prev, syncStartDate: clampDate(e.target.value) || '' }))}
                        className={`${INPUT_BASE_STYLE} h-11 flex-1 font-medium`}
                      />
                      <button 
                        type="button" 
                        onClick={handleSetToday}
                        className={`${BTN_SECONDARY_STYLE} h-11 px-4 text-xs font-bold uppercase tracking-wider`}
                      >
                        Today
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Option 2: Sync only new transactions */}
          <div
            className={`p-5 rounded-3xl border transition-all cursor-pointer ${
              state.transactionMode === 'incremental' 
                ? 'bg-primary-500/5 dark:bg-primary-500/10 border-primary-500/30 ring-1 ring-primary-500/20 shadow-sm' 
                : 'bg-light-fill dark:bg-dark-fill/50 border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10'
            }`}
            onClick={() => setState(prev => ({ ...prev, transactionMode: 'incremental', updateBalance: true }))}
          >
            <div className="flex items-start gap-3.5">
              <div className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center ${state.transactionMode === 'incremental' ? 'border-primary-500 bg-primary-500 text-white' : 'border-black/30 dark:border-white/30'}`}>
                {state.transactionMode === 'incremental' && <div className="w-2 h-2 bg-white rounded-full"></div>}
              </div>
              <div>
                <div className="font-bold text-sm text-light-text dark:text-dark-text">Sync only new transactions</div>
                <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">Use the last synced time for this account to import only fresh activity and update balance.</div>
              </div>
            </div>
          </div>

          {/* Option 3: Balance Only */}
          <div
            className={`p-5 rounded-3xl border transition-all cursor-pointer ${
              state.transactionMode === 'none' 
                ? 'bg-primary-500/5 dark:bg-primary-500/10 border-primary-500/30 ring-1 ring-primary-500/20 shadow-sm' 
                : 'bg-light-fill dark:bg-dark-fill/50 border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10'
            }`}
            onClick={() => setState(prev => ({ ...prev, transactionMode: 'none', updateBalance: true }))}
          >
            <div className="flex items-start gap-3.5">
              <div className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center ${state.transactionMode === 'none' ? 'border-primary-500 bg-primary-500 text-white' : 'border-black/30 dark:border-white/30'}`}>
                {state.transactionMode === 'none' && <div className="w-2 h-2 bg-white rounded-full"></div>}
              </div>
              <div>
                <div className="font-bold text-sm text-light-text dark:text-dark-text">Update balance only</div>
                <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">Skip transaction import, just refresh the numbers.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-black/5 dark:border-white/5 bg-white/90 dark:bg-dark-card/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
          <button 
            type="button" 
            onClick={handleClose} 
            className={`${BTN_SECONDARY_STYLE} h-12 px-6 text-xs font-bold uppercase tracking-wider`}
          >
            Cancel
          </button>
          <button 
            type="button" 
            onClick={handleConfirm} 
            className={`${BTN_PRIMARY_STYLE} h-12 px-8 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-primary-500/20 active:scale-95`}
          >
            <span>Start Sync</span>
            <Icon name="sync" className="text-base" />
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default EnableBankingSyncModal;
