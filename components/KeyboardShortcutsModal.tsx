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
      <div className="space-y-2.5">
        {shortcuts.map((s) => (
          <div
            key={s.key}
            className="flex items-center justify-between p-3.5 rounded-2xl bg-light-fill dark:bg-dark-fill/50 border border-black/5 dark:border-white/5"
          >
            <span className="text-xs font-bold text-light-text dark:text-dark-text">
              {s.description}
            </span>
            <kbd className="px-2.5 py-1 rounded-xl bg-white dark:bg-dark-card border border-black/10 dark:border-white/10 text-xs font-mono font-bold text-primary-600 dark:text-primary-400 shadow-sm">
              {s.key}
            </kbd>
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default KeyboardShortcutsModal;
