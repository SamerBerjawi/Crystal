
import React from 'react';
import Modal from './Modal';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';

interface DemoRestorePromptProps {
  onClose: () => void;
  onConfirm: () => void;
}

const DemoRestorePrompt: React.FC<DemoRestorePromptProps> = ({ onClose, onConfirm }) => {
  return (
    <Modal onClose={onClose} title="Welcome to Demo Mode" size="lg" zIndexClass="z-[60]">
      <div className="space-y-6">
        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 flex items-start gap-4">
            <div className="bg-indigo-100 dark:bg-indigo-800/50 p-2 rounded-lg text-indigo-600 dark:text-indigo-300">
                <span className="material-symbols-outlined text-2xl">science</span>
            </div>
            <div>
                <h4 className="font-bold text-indigo-800 dark:text-indigo-200 mb-1">Sandbox Environment</h4>
                <p className="text-sm text-indigo-700/80 dark:text-indigo-300/80">
                    You are currently viewing sample data. Any changes you make here are temporary and will not be saved to a server.
                </p>
            </div>
        </div>

        <div>
            <p className="text-light-text dark:text-dark-text mb-4">
                Do you have an existing Crystal backup file? You can load it now to explore the new features with your own data.
            </p>
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                Your data will be loaded into memory only. It will not be uploaded to any server in Demo Mode.
            </p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className={BTN_SECONDARY_STYLE}>
                No, Use Sample Data
            </button>
            <button onClick={onConfirm} className={BTN_PRIMARY_STYLE}>
                <span className="material-symbols-outlined text-lg mr-2">upload_file</span>
                Yes, Load My Data
            </button>
        </div>
      </div>
    </Modal>
  );
};

export default DemoRestorePrompt;
