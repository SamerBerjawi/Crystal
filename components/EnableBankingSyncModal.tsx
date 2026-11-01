import React, { useEffect, useState } from 'react';
import { EnableBankingSyncOptions } from '../types';
import { toLocalISOString } from '../utils';
import { Button } from './ui/Actions';
import { DateInput, Radio, RadioGroup } from './ui/Fields';
import { Dialog } from './ui/Overlays';

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

type SyncMode = NonNullable<EnableBankingSyncOptions['transactionMode']>;

const clampDate = (value: string | undefined, min: string, max: string) => {
  if (!value) return value;
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const ModeLabel: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <>
    <span className="type-body-strong block text-ink">{title}</span>
    <span className="type-caption mt-0.5 block text-muted">{description}</span>
  </>
);

const EnableBankingSyncModal: React.FC<EnableBankingSyncModalProps> = ({ isOpen, title, description, minDate, maxDate, initialState, onClose, onConfirm }) => {
  const [mode, setMode] = useState<SyncMode>(initialState.transactionMode || 'full');
  const [startDate, setStartDate] = useState(clampDate(initialState.syncStartDate, minDate, maxDate) || minDate);

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialState.transactionMode || 'full');
    setStartDate(clampDate(initialState.syncStartDate, minDate, maxDate) || minDate);
  }, [initialState, isOpen, maxDate, minDate]);

  const confirm = () => onConfirm({
    transactionMode: mode,
    updateBalance: mode === 'none' ? true : initialState.updateBalance || mode === 'incremental',
    syncStartDate: clampDate(startDate, minDate, maxDate) || minDate,
  });

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      footer={close => (
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="ghost" onPress={close}>Cancel</Button>
          <Button icon="sync" isDisabled={mode === 'full' && !startDate} onPress={confirm}>Start sync</Button>
        </div>
      )}
    >
      <RadioGroup label="What to sync" value={mode} onChange={value => setMode(value as SyncMode)}>
        <Radio value="full"><ModeLabel title="Transactions and balance" description="Import from a date you choose and update the balance." /></Radio>
        <Radio value="incremental"><ModeLabel title="New transactions only" description="Import what’s new since the last sync and update the balance." /></Radio>
        <Radio value="none"><ModeLabel title="Balance only" description="Update the balance and skip transactions." /></Radio>
      </RadioGroup>
      {mode === 'full' && (
        <div className="mt-4 flex items-end gap-2">
          <DateInput
            label="Import from"
            help="Up to 90 days back."
            className="min-w-0 flex-1"
            value={startDate}
            onChange={value => setStartDate(clampDate(value, minDate, maxDate) || '')}
          />
          <Button variant="secondary" size="sm" className="mb-6" onPress={() => setStartDate(toLocalISOString(new Date()))}>Today</Button>
        </div>
      )}
    </Dialog>
  );
};

export default EnableBankingSyncModal;
