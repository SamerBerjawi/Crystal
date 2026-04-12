
import React from 'react';
import Modal from './Modal';
import { BTN_PRIMARY_STYLE } from '../constants';

interface EditRecurrenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEditSingle: () => void;
  onEditSeries: () => void;
  onEditFuture?: () => void; // New prop for editing future
}

const EditRecurrenceModal: React.FC<EditRecurrenceModalProps> = ({ isOpen, onClose, onEditSingle, onEditSeries, onEditFuture }) => {
  if (!isOpen) return null;

  return (
    <Modal onClose={onClose} title="Edit Recurring Event">
      <div className="space-y-4">
        <p className="text-light-text-secondary dark:text-dark-text-secondary">
          Which occurrences do you want to modify?
        </p>
        <div className="flex flex-col gap-3 pt-4">
          <button onClick={onEditSingle} className={BTN_PRIMARY_STYLE}>
            This Occurrence Only
          </button>
           {onEditFuture && (
              <button onClick={onEditFuture} className={BTN_PRIMARY_STYLE}>
                This and Future Occurrences
              </button>
          )}
          <button onClick={onEditSeries} className={BTN_PRIMARY_STYLE}>
            The Entire Series
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default EditRecurrenceModal;
