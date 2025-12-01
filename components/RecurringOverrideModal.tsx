
import React, { useState } from 'react';
import Modal from './Modal';
import { RecurringTransaction, RecurringTransactionOverride, ScheduledItem } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, BTN_DANGER_STYLE } from '../constants';

interface RecurringOverrideModalProps {
  item: ScheduledItem;
  onClose: () => void;
  onSave: (override: RecurringTransactionOverride) => void;
  onDelete: (recurringTransactionId: string, originalDate: string) => void;
  recurringTransactionOverrides: RecurringTransactionOverride[];
}

const RecurringOverrideModal: React.FC<RecurringOverrideModalProps> = ({ item, onClose, onSave, onDelete, recurringTransactionOverrides }) => {
    const existingOverride = recurringTransactionOverrides.find(
        (o: RecurringTransactionOverride) => o.recurringTransactionId === (item.originalItem as RecurringTransaction).id && o.originalDate === item.originalDateForOverride
    );

    const [date, setDate] = useState(existingOverride?.date || item.date);
    const [amount, setAmount] = useState(String(Math.abs(existingOverride?.amount ?? item.amount)));
    const [description, setDescription] = useState(existingOverride?.description || item.description);
    const [isSkipped, setIsSkipped] = useState(existingOverride?.isSkipped || false);

    const recurringTransactionId = (item.originalItem as RecurringTransaction).id;
    const originalDate = item.originalDateForOverride!;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const newAmount = parseFloat(amount) || 0;
        onSave({
            recurringTransactionId,
            originalDate,
            date,
            amount: item.amount < 0 ? -newAmount : newAmount,
            description,
            isSkipped,
        });
        onClose();
    };

    const handleDelete = () => {
        onDelete(recurringTransactionId, originalDate);
        onClose();
    };

    const handleSkipToggle = () => {
      const shouldSkip = !isSkipped;
      setIsSkipped(shouldSkip);
      // Immediately save if skipping/unskipping
      onSave({
          recurringTransactionId,
          originalDate,
          isSkipped: shouldSkip,
          // Retain other override data in case they unskip later
          date: existingOverride?.date || date,
          amount: existingOverride?.amount !== undefined ? existingOverride.amount : (item.amount < 0 ? -parseFloat(amount) : parseFloat(amount)),
          description: existingOverride?.description || description,
      });
      onClose();
    };

    const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";
    
    return (
        <Modal onClose={onClose} title="Edit Occurrence">
            <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    You are editing a single occurrence of "{item.description}". Original date was {originalDate}.
                </p>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="override-date" className={labelStyle}>Date</label>
                        <input id="override-date" type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT_BASE_STYLE} disabled={isSkipped} />
                    </div>
                    <div>
                        <label htmlFor="override-amount" className={labelStyle}>Amount</label>
                        <input id="override-amount" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className={INPUT_BASE_STYLE} disabled={isSkipped} />
                    </div>
                </div>

                <div>
                    <label htmlFor="override-description" className={labelStyle}>Description</label>
                    <input id="override-description" type="text" value={description} onChange={e => setDescription(e.target.value)} className={INPUT_BASE_STYLE} disabled={isSkipped} />
                </div>
                
                <div className="flex justify-between items-center pt-4 border-t border-black/10 dark:border-white/10">
                    <button type="button" onClick={handleDelete} className={BTN_SECONDARY_STYLE}>
                        Revert to Original
                    </button>
                    <div className="flex gap-4">
                        <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                        <button type="submit" className={BTN_PRIMARY_STYLE} disabled={isSkipped}>Save Changes</button>
                    </div>
                </div>
            </form>
             <div className="mt-4 pt-4 border-t border-black/10 dark:border-white/10">
                <div className="flex justify-between items-center">
                    <div>
                        <p className="font-medium text-light-text dark:text-dark-text">Skip this occurrence</p>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">This will remove the transaction for this date only.</p>
                    </div>
                     <button type="button" onClick={handleSkipToggle} className={isSkipped ? BTN_SECONDARY_STYLE : BTN_DANGER_STYLE}>
                        {isSkipped ? 'Un-skip Occurrence' : 'Skip Occurrence'}
                    </button>
                </div>
             </div>
        </Modal>
    );
};
export default RecurringOverrideModal;
