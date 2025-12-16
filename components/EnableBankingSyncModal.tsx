import React, { useEffect, useMemo, useState } from 'react';
import { INPUT_BASE_STYLE } from '../constants';
import { EnableBankingSyncOptions } from '../types';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text rounded-xl shadow-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-lg font-semibold text-light-text dark:text-dark-text">{title}</h4>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{description}</p>
          </div>
          <button
            onClick={onClose}
            className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text hover:dark:text-white"
            aria-label="Close sync options"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-3">
            <h5 className="text-sm font-semibold text-light-text dark:text-dark-text">Sync scope</h5>
            <label className="flex items-start gap-3 text-sm text-light-text dark:text-dark-text">
              <input
                type="radio"
                name="enable-banking-transaction-mode"
                value="full"
                checked={state.transactionMode === 'full'}
                onChange={() => setState(prev => ({ ...prev, transactionMode: 'full' }))}
                className="mt-1.5 h-4 w-4 text-primary-600"
              />
              <div className="space-y-2">
                <div>
                  <div className="font-semibold">Sync all transactions from the configured start date</div>
                  <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Choose where to start your import window.</div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <label className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary" htmlFor="enable-banking-sync-start">Start date</label>
                  <input
                    id="enable-banking-sync-start"
                    type="date"
                    min={minDate}
                    max={maxDate}
                    value={clampDate(state.syncStartDate) || ''}
                    onChange={(e) => setState(prev => ({ ...prev, syncStartDate: clampDate(e.target.value) || '' }))}
                    className={`${INPUT_BASE_STYLE} text-sm`}
                    disabled={state.transactionMode !== 'full'}
                  />
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 text-sm text-light-text dark:text-dark-text">
              <input
                type="radio"
                name="enable-banking-transaction-mode"
                value="none"
                checked={state.transactionMode === 'none'}
                onChange={() => setState(prev => ({ ...prev, transactionMode: 'none', updateBalance: true }))}
                className="mt-1.5 h-4 w-4 text-primary-600"
              />
              <div>
                <div className="font-semibold">Skip transaction import</div>
                <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Update balances without importing any transactions.</div>
              </div>
            </label>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-3 text-sm text-light-text dark:text-dark-text">
              <input
                type="checkbox"
                checked={state.updateBalance || isBalanceOnly}
                onChange={(e) => setState(prev => ({ ...prev, updateBalance: e.target.checked }))}
                className="h-4 w-4 text-primary-600"
                disabled={isBalanceOnly}
              />
              <div>
                <div className="font-semibold">Update balances</div>
                <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Refresh balances for any linked accounts.</div>
              </div>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary text-sm font-semibold text-light-text dark:text-dark-text"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
          >
            Start sync
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnableBankingSyncModal;
