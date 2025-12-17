
import React, { useEffect, useMemo, useState } from 'react';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { EnableBankingSyncOptions } from '../types';
import { toLocalISOString } from '../utils';

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

  useEffect(() => {
    if (!isOpen) return;
    setState({
      transactionMode: initialState.transactionMode || 'full',
      updateBalance: initialState.updateBalance,
      syncStartDate: clampDate(initialState.syncStartDate) || minDate,
    });
  }, [clampDate, initialState, isOpen, minDate]);

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

  if (!isOpen) return null;

  const isBalanceOnly = state.transactionMode === 'none';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 transition-opacity">
      <div className="w-full max-w-lg bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text rounded-2xl shadow-2xl border border-black/5 dark:border-white/10 p-6 space-y-6 animate-fade-in-up">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <span className="material-symbols-outlined text-lg">sync_alt</span>
                </div>
                <h4 className="text-xl font-bold text-light-text dark:text-dark-text">{title}</h4>
            </div>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">{description}</p>
          </div>
          <button
            onClick={onClose}
            className="text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/10 p-1 rounded-full transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Options */}
        <div className="space-y-4">
          
          {/* Option 1: Transactions */}
          <div 
            className={`p-4 rounded-xl border transition-all cursor-pointer ${state.transactionMode === 'full' ? 'bg-primary-50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800' : 'bg-transparent border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5'}`}
            onClick={() => setState(prev => ({ ...prev, transactionMode: 'full' }))}
          >
            <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${state.transactionMode === 'full' ? 'border-primary-600 bg-primary-600' : 'border-gray-400'}`}>
                    {state.transactionMode === 'full' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                </div>
                <div className="flex-1 space-y-3">
                    <div>
                        <div className="font-bold text-sm text-light-text dark:text-dark-text">Sync transactions & balance</div>
                        <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Import new transactions and update account balance.</div>
                    </div>
                    
                    {/* Date Picker (Nested) */}
                    {state.transactionMode === 'full' && (
                         <div className="flex flex-col gap-1.5 animate-fade-in-up" onClick={e => e.stopPropagation()}>
                            <label className="text-[10px] font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider" htmlFor="enable-banking-sync-start">Import from</label>
                            <div className="flex gap-2">
                                <input
                                    id="enable-banking-sync-start"
                                    type="date"
                                    min={minDate}
                                    max={maxDate}
                                    value={clampDate(state.syncStartDate) || ''}
                                    onChange={(e) => setState(prev => ({ ...prev, syncStartDate: clampDate(e.target.value) || '' }))}
                                    className={`${INPUT_BASE_STYLE} text-sm flex-1`}
                                />
                                <button 
                                    type="button"
                                    onClick={handleSetToday}
                                    className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-xs font-semibold transition-colors text-light-text dark:text-dark-text"
                                >
                                    Today
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
          </div>

          {/* Option 2: Balance Only */}
          <div 
            className={`p-4 rounded-xl border transition-all cursor-pointer ${state.transactionMode === 'none' ? 'bg-primary-50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800' : 'bg-transparent border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5'}`}
            onClick={() => setState(prev => ({ ...prev, transactionMode: 'none', updateBalance: true }))}
          >
             <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${state.transactionMode === 'none' ? 'border-primary-600 bg-primary-600' : 'border-gray-400'}`}>
                     {state.transactionMode === 'none' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                </div>
                <div>
                    <div className="font-bold text-sm text-light-text dark:text-dark-text">Update balance only</div>
                    <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Skip transaction import, just refresh the numbers.</div>
                </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t border-black/5 dark:border-white/5">
          <button onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
          <button onClick={handleConfirm} className={BTN_PRIMARY_STYLE}>Start Sync</button>
        </div>
      </div>
    </div>
  );
};

export default EnableBankingSyncModal;
