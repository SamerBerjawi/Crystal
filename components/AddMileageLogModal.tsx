
import React, { useState } from 'react';
import Modal from './Modal';
import { MileageLog } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';

interface AddMileageLogModalProps {
  onClose: () => void;
  onSave: (log: MileageLog) => void;
}

const AddMileageLogModal: React.FC<AddMileageLogModalProps> = ({ onClose, onSave }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reading, setReading] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Allow 0 as a valid reading, ensure it is not empty
    if (date && reading !== '') {
      const parsedReading = parseInt(reading, 10);
      if (!isNaN(parsedReading)) {
          onSave({ date, reading: parsedReading });
      }
    }
  };

  const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";

  return (
    <Modal onClose={onClose} title="Log Mileage" zIndexClass="z-[60]">
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
          <button type="submit" className={BTN_PRIMARY_STYLE}>Save Log</button>
        </div>
      </form>
    </Modal>
  );
};

export default AddMileageLogModal;
