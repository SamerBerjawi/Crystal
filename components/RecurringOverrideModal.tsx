import React, { useState } from 'react';
import { parseLocalDate, safeRound } from '../utils';
import type { RecurringTransaction, RecurringTransactionOverride, ScheduledItem } from '../types';
import { Button } from './ui/Actions';
import { AmountInput, DateInput, TextInput } from './ui/Fields';
import { Dialog } from './ui/Overlays';

interface RecurringOverrideModalProps {
  item: ScheduledItem;
  onClose: () => void;
  onSave: (override: RecurringTransactionOverride) => void;
  onDelete: (recurringTransactionId: string, originalDate: string) => void;
  recurringTransactionOverrides: RecurringTransactionOverride[];
}

/** One date in a series: change it, skip it, or put it back (SCH-10). */
const RecurringOverrideModal: React.FC<RecurringOverrideModalProps> = ({ item, onClose, onSave, onDelete, recurringTransactionOverrides }) => {
  const recurringTransactionId = (item.originalItem as RecurringTransaction).id;
  const originalDate = item.originalDateForOverride!;
  const existing = recurringTransactionOverrides.find(override => override.recurringTransactionId === recurringTransactionId && override.originalDate === originalDate);

  const startAmount = safeRound(Math.abs(existing?.amount ?? item.amount), 2).toFixed(2);
  const startDate = existing?.date || item.date;
  const startDescription = existing?.description || item.description;
  const [date, setDate] = useState(startDate);
  const [amount, setAmount] = useState(startAmount);
  const [description, setDescription] = useState(startDescription);
  const isSkipped = !!existing?.isSkipped;
  const sign = item.amount < 0 ? -1 : 1;

  const handleSave = () => {
    onSave({ recurringTransactionId, originalDate, date, amount: sign * safeRound(parseFloat(amount) || 0, 2), description, isSkipped });
    onClose();
  };

  const toggleSkip = () => {
    onSave({ recurringTransactionId, originalDate, isSkipped: !isSkipped, date, amount: existing?.amount ?? sign * safeRound(Math.abs(item.amount), 2), description });
    onClose();
  };

  const originalLabel = parseLocalDate(originalDate).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={`Change ${item.description}`}
      description={`Just the payment planned for ${originalLabel}.`}
      isDirty={date !== startDate || amount !== startAmount || description !== startDescription}
      footer={close => (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1">
            <Button variant="ghost" onPress={toggleSkip}>{isSkipped ? 'Include it' : 'Skip it'}</Button>
            {existing && <Button variant="ghost" onPress={() => { onDelete(recurringTransactionId, originalDate); onClose(); }}>Put it back</Button>}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onPress={close}>Cancel</Button>
            <Button onPress={handleSave}>Save changes</Button>
          </div>
        </div>
      )}
    >
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSave(); }}>
        <div className="grid grid-cols-2 gap-3">
          <DateInput label="Date" value={date} onChange={setDate} />
          <AmountInput label="Amount" value={amount} onChange={setAmount} />
        </div>
        <TextInput label="Description" value={description} onChange={setDescription} />
      </form>
    </Dialog>
  );
};

export default RecurringOverrideModal;
