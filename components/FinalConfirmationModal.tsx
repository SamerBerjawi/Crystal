import React, { useState } from 'react';
import Modal from './Modal';
import { BTN_SECONDARY_STYLE, INPUT_BASE_STYLE } from '../constants';

interface FinalConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  requiredText: string;
  confirmButtonText?: string;
}

const FinalConfirmationModal: React.FC<FinalConfirmationModalProps> = ({
  isOpen, onClose, onConfirm, title, message, requiredText, confirmButtonText = 'Confirm'
}) => {
  const [inputText, setInputText] = useState('');
  const isMatch = inputText === requiredText;

  if (!isOpen) return null;

  return (
    <Modal onClose={onClose} title={title} zIndexClass="z-[80]">
      <div className="space-y-4">
        <div className="text-xs text-light-text dark:text-dark-text leading-relaxed font-medium">
          {message}
        </div>
        <div>
          <label htmlFor="confirm-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
            To confirm, type <span className="font-mono font-bold text-rose-600 dark:text-rose-400 underline decoration-rose-500/30">"{requiredText}"</span> in the box below:
          </label>
          <input
            id="confirm-input"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className={`${INPUT_BASE_STYLE} h-12 text-center font-mono font-bold text-base`}
            autoFocus
            autoComplete="off"
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-black/5 dark:border-white/5">
        <button type="button" onClick={onClose} className={`${BTN_SECONDARY_STYLE} h-11 px-6 text-xs font-bold uppercase tracking-wider`}>
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="h-11 px-6 rounded-2xl text-xs font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!isMatch}
        >
          {confirmButtonText}
        </button>
      </div>
    </Modal>
  );
};

export default FinalConfirmationModal;
