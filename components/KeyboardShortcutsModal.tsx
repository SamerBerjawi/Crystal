import React from 'react';
import { Dialog } from './ui/Overlays';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Matches hooks/useKeyboardShortcuts.ts and the ⌘K handler in App.tsx. */
const GROUPS: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: 'Anywhere',
    items: [
      { keys: [isMac ? '⌘' : 'Ctrl', 'K'], label: 'Search' },
      { keys: ['N'], label: 'Add a transaction' },
      { keys: ['⇧', 'P'], label: 'Hide or show amounts' },
      { keys: ['L'], label: 'Lock Crystal, once you have a PIN' },
      { keys: ['?'], label: 'Show these shortcuts' },
      { keys: ['Esc'], label: 'Close what’s open' },
    ],
  },
  {
    title: 'Go to, press G then',
    items: [
      { keys: ['D'], label: 'Home' },
      { keys: ['A'], label: 'Accounts' },
      { keys: ['T'], label: 'Ledger' },
      { keys: ['F'], label: 'Forecast' },
      { keys: ['B'], label: 'Budget' },
      { keys: ['G'], label: 'Goals' },
      { keys: ['C'], label: 'Calendar' },
      { keys: ['I'], label: 'Investments' },
      { keys: ['R'], label: 'Reports' },
      { keys: ['S'], label: 'Settings' },
    ],
  },
];

const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => (
  <Dialog isOpen={isOpen} onClose={onClose} title="Keyboard shortcuts" description="They don’t work while you’re typing in a field.">
    <div className="space-y-5">
      {GROUPS.map(group => (
        <section key={group.title}>
          <h3 className="type-label text-muted">{group.title}</h3>
          <dl className="mt-1 divide-y divide-line">
            {group.items.map(item => (
              <div key={item.label} className="flex items-center justify-between gap-4 py-2">
                <dt className="type-body text-ink">{item.label}</dt>
                <dd className="flex shrink-0 gap-1">
                  {item.keys.map(key => (
                    <kbd key={key} className="type-caption min-w-7 rounded-[var(--radius-sm)] border border-line-strong bg-inset px-1.5 py-0.5 text-center font-semibold text-ink">{key}</kbd>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  </Dialog>
);

export default KeyboardShortcutsModal;
