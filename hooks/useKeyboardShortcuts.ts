import { useEffect, useRef } from 'react';
import { Page } from '../types';

export interface KeyboardShortcutsOptions {
  onNavigate: (page: Page) => void;
  onOpenNewTransaction: () => void;
  onToggleShortcutsModal: () => void;
  onCloseShortcutsModal?: () => void;
  onLock?: () => void;
}

export interface KeyboardShortcutsState {
  gKeyPressed: boolean;
  gTimer: NodeJS.Timeout | null;
}

export const handleShortcutKeyDown = (
  e: { key: string; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; preventDefault?: () => void },
  state: KeyboardShortcutsState,
  options: KeyboardShortcutsOptions,
  activeElement?: { tagName?: string; isContentEditable?: boolean } | null,
): void => {
  const isInput =
    activeElement &&
    (activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.tagName === 'SELECT' ||
      activeElement.isContentEditable);

  if (isInput) return;

  const key = e.key.toLowerCase();

  // Check "G then X" sequence
  if (state.gKeyPressed) {
    state.gKeyPressed = false;
    if (state.gTimer) clearTimeout(state.gTimer);

    switch (key) {
      case 'd':
        e.preventDefault?.();
        options.onCloseShortcutsModal?.();
        options.onNavigate('Dashboard');
        return;
      case 'a':
        e.preventDefault?.();
        options.onCloseShortcutsModal?.();
        options.onNavigate('Accounts');
        return;
      case 't':
        e.preventDefault?.();
        options.onCloseShortcutsModal?.();
        options.onNavigate('Transactions');
        return;
      case 'i':
        e.preventDefault?.();
        options.onCloseShortcutsModal?.();
        options.onNavigate('Investments');
        return;
      case 'b':
        e.preventDefault?.();
        options.onCloseShortcutsModal?.();
        options.onNavigate('Budget');
        return;
      case 's':
        e.preventDefault?.();
        options.onCloseShortcutsModal?.();
        options.onNavigate('Personal Info');
        return;
      default:
        break;
    }
  }

  if (key === 'g' && !e.metaKey && !e.ctrlKey) {
    state.gKeyPressed = true;
    if (state.gTimer) clearTimeout(state.gTimer);
    state.gTimer = setTimeout(() => {
      state.gKeyPressed = false;
    }, 1200);
    return;
  }

  if (key === 'l' && options.onLock && !e.metaKey && !e.ctrlKey && !e.altKey) {
    e.preventDefault?.();
    options.onCloseShortcutsModal?.();
    options.onLock();
    return;
  }

  if (key === 'n' && !e.metaKey && !e.ctrlKey) {
    e.preventDefault?.();
    options.onCloseShortcutsModal?.();
    options.onOpenNewTransaction();
    return;
  }

  if (key === '?' || (e.shiftKey && key === '/')) {
    e.preventDefault?.();
    options.onToggleShortcutsModal();
    return;
  }
};

export const useKeyboardShortcuts = ({
  onNavigate,
  onOpenNewTransaction,
  onToggleShortcutsModal,
  onCloseShortcutsModal,
  onLock,
}: KeyboardShortcutsOptions) => {
  const state = useRef<KeyboardShortcutsState>({ gKeyPressed: false, gTimer: null });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleShortcutKeyDown(
        e,
        state.current,
        { onNavigate, onOpenNewTransaction, onToggleShortcutsModal, onCloseShortcutsModal, onLock },
        typeof document !== 'undefined' ? (document.activeElement as any) : null,
      );
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (state.current.gTimer) clearTimeout(state.current.gTimer);
    };
  }, [onNavigate, onOpenNewTransaction, onToggleShortcutsModal, onCloseShortcutsModal, onLock]);
};
