import React from 'react';
import Modal from './Modal';
import { BTN_SECONDARY_STYLE, BTN_PRIMARY_STYLE } from '../constants';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmButtonText?: string;
  confirmButtonVariant?: 'primary' | 'danger';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmButtonText = 'Confirm',
  confirmButtonVariant = 'danger',
}) => {
  if (!isOpen) return null;

  const confirmButtonStyle = confirmButtonVariant === 'danger'
    ? "bg-red-500 text-white font-semibold py-2 px-4 rounded-lg shadow-card hover:bg-red-600 transition-all duration-200"
    : BTN_PRIMARY_STYLE;

  return (
    <Modal onClose={onClose} title={title}>
      <p className="text-light-text-secondary dark:text-dark-text-secondary">{message}</p>

      <div className="flex justify-end gap-4 pt-6 mt-4 border-t border-black/10 dark:border-white/10">
        <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>
          Cancel
        </button>
        <button type="button" onClick={onConfirm} className={confirmButtonStyle}>
          {confirmButtonText}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;