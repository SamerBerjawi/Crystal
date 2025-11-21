import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { MileageLog } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';

interface AddMileageLogModalProps {
  onClose: () => void;
  onSave: (log: Omit<MileageLog, 'id'> & { id?: string }) => void;
  logToEdit?: MileageLog | null;
}

const AddMileageLogModal: React.FC<AddMileageLogModalProps> = ({ onClose, onSave, logToEdit }) => {
  const isEditing = !!logToEdit;
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reading, setReading] = useState('');

  useEffect(() => {
    if (logToEdit) {
      setDate(logToEdit.date);
      setReading(String(logToEdit.reading));
    } else {
      setDate(new Date().toISOString().split('T')[0]);
      setReading('');
    }
  }, [logToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (date && reading !== '') {
      const parsedReading = parseInt(reading, 10);
      if (!isNaN(parsedReading)) {
          onSave({ id: logToEdit?.id, date, reading: parsedReading });
      }
    }
  };

  const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";
  const modalTitle = isEditing ? 'Edit Mileage Log' : 'Log Mileage';

  return (
    <Modal onClose={onClose} title={modalTitle} zIndexClass="z-[60]">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="date" className={labelStyle}>Date</label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={INPUT_BASE_STYLE}
            required
          />
        </div>
        <div>
          <label htmlFor="reading" className={labelStyle}>Odometer Reading (km)</label>
          <input
            id="reading"
            type="number"
            value={reading}
            onChange={(e) => setReading(e.target.value)}
            className={INPUT_BASE_STYLE}
            placeholder="e.g. 50000"
            required
            autoFocus
            min="0"
          />
        </div>
        <div className="flex justify-end gap-4 pt-4">
          <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
          <button type="submit" className={BTN_PRIMARY_STYLE}>{isEditing ? 'Save Changes' : 'Save Log'}</button>
        </div>
      </form>
    </Modal>
  );
};

export default AddMileageLogModal;