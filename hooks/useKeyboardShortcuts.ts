import { useEffect, useRef } from 'react';
import { Page } from '../types';

interface KeyboardShortcutsOptions {
  onNavigate: (page: Page) => void;
  onOpenNewTransaction: () => void;
  onToggleShortcutsModal: () => void;
}

export const useKeyboardShortcuts = ({
  onNavigate,
  onOpenNewTransaction,
  onToggleShortcutsModal,
}: KeyboardShortcutsOptions) => {
  const gKeyPressed = useRef<boolean>(false);
  const gTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key events when typing inside inputs, textareas, or contenteditables
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          (activeEl as HTMLElement).isContentEditable);

      if (isInput) return;

      const key = e.key.toLowerCase();

      // Check "G then X" sequence
      if (gKeyPressed.current) {
        gKeyPressed.current = false;
        if (gTimer.current) clearTimeout(gTimer.current);

        switch (key) {
          case 'd':
            e.preventDefault();
            onNavigate('Dashboard');
            return;
          case 'a':
            e.preventDefault();
            onNavigate('Accounts');
            return;
          case 't':
            e.preventDefault();
            onNavigate('Transactions');
            return;
          case 'i':
            e.preventDefault();
            onNavigate('Investments');
            return;
          case 'b':
            e.preventDefault();
            onNavigate('Budget');
            return;
          case 's':
            e.preventDefault();
            onNavigate('Settings');
            return;
          default:
            break;
        }
      }

      if (key === 'g' && !e.metaKey && !e.ctrlKey) {
        gKeyPressed.current = true;
        if (gTimer.current) clearTimeout(gTimer.current);
        gTimer.current = setTimeout(() => {
          gKeyPressed.current = false;
        }, 1200);
        return;
      }

      if (key === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onOpenNewTransaction();
        return;
      }

      if (key === '?' || (e.shiftKey && key === '/')) {
        e.preventDefault();
        onToggleShortcutsModal();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (gTimer.current) clearTimeout(gTimer.current);
    };
  }, [onNavigate, onOpenNewTransaction, onToggleShortcutsModal]);
};
