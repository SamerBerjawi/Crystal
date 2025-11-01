import React from 'react';
import Modal from './Modal';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';

interface EnableBankingConnectModalProps {
  // FIX: Add isOpen prop to control modal visibility from parent component.
  isOpen: boolean;
  onClose: () => void;
  onConnect: () => void;
  isConnecting: boolean;
}

const EnableBankingConnectModal: React.FC<EnableBankingConnectModalProps> = ({ isOpen, onClose, onConnect, isConnecting }) => {
  // FIX: Conditionally render the modal based on the isOpen prop.
  if (!isOpen) {
    return null;
  }

  return (
    <Modal onClose={onClose} title="Link Your Bank Account">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-primary-500">
              account_balance
            </span>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">Secure Connection via Enable Banking</h3>
        <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
          Finaura uses Enable Banking to securely connect to your bank account. This is a secure, read-only connection. Your credentials are never shared with Finaura.
        </p>
      </div>
      <div className="flex justify-end gap-4 pt-6 mt-4 border-t border-black/10 dark:border-white/10">
        <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE} disabled={isConnecting}>
          Cancel
        </button>
        <button type="button" onClick={onConnect} className={BTN_PRIMARY_STYLE} disabled={isConnecting}>
           {isConnecting ? (
            <div className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Connecting...</span>
            </div>
        ) : (
            'Connect Securely'
        )}
        </button>
      </div>
    </Modal>
  );
};

export default EnableBankingConnectModal;