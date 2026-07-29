import React from 'react';
import Modal from './Modal';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { key: '⌘ K / Ctrl K', description: 'Open Command Center' },
  { key: 'N', description: 'Create new transaction' },
  { key: 'G then D', description: 'Go to Dashboard' },
  { key: 'G then A', description: 'Go to Accounts' },
  { key: 'G then T', description: 'Go to Transactions' },
  { key: 'G then I', description: 'Go to Investments' },
  { key: 'G then B', description: 'Go to Budgeting' },
  { key: 'G then S', description: 'Go to Settings' },
  { key: '?', description: 'Open Keyboard Shortcuts' },
  { key: 'Esc', description: 'Close modal or overlay' },
];

const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <Modal onClose={onClose} title="Keyboard Shortcuts" size="lg">
      <div className="space-y-3">
        {shortcuts.map((s) => (
          <div
            key={s.key}
            className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-black/5 dark:border-white/5"
          >
            <span className="text-sm font-medium text-light-text dark:text-dark-text">
              {s.description}
            </span>
            <kbd className="px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 border border-black/10 dark:border-white/10 text-xs font-mono font-bold text-primary-600 dark:text-primary-400 shadow-sm">
              {s.key}
            </kbd>
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default KeyboardShortcutsModal;
