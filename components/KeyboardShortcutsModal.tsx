import React from 'react';
import Modal from './Modal';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { key: '⌘ K / Ctrl K', description: 'Open Command Center' },
  { key: 'N', description: 'Create new transaction' },
  { key: '⇧ P', description: 'Toggle Privacy Mode' },
  { key: 'L', description: 'Lock Crystal' },
  { key: 'G then D', description: 'Go to Overview (Dashboard)' },
  { key: 'G then A', description: 'Go to Accounts' },
  { key: 'G then T', description: 'Go to Transactions' },
  { key: 'G then F', description: 'Go to Forecasting' },
  { key: 'G then B', description: 'Go to Budget' },
  { key: 'G then G', description: 'Go to Goals' },
  { key: 'G then C', description: 'Go to Schedule & Calendar' },
  { key: 'G then I', description: 'Go to Investments' },
  { key: 'G then R', description: 'Go to Reports' },
  { key: 'G then S', description: 'Go to Settings' },
  { key: '?', description: 'Open Keyboard Shortcuts' },
  { key: 'Esc', description: 'Close modal or overlay' },
];

const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <Modal onClose={onClose} title="Keyboard Shortcuts" size="lg">
      <div className="space-y-2">
        {shortcuts.map((s) => (
          <div
            key={s.key}
            className="flex items-center justify-between rounded-[var(--radius-md)] border border-line bg-inset px-3.5 py-2.5"
          >
            <span className="type-body-strong text-ink">
              {s.description}
            </span>
            <kbd className="rounded-lg border border-line-strong bg-solid px-2.5 py-1 font-mono text-xs font-bold text-primary shadow-2xs">
              {s.key}
            </kbd>
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default KeyboardShortcutsModal;
