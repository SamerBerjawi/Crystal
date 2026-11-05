import { useEffect, useRef } from 'react';
import { Page } from '../types';

export interface KeyboardShortcutsOptions {
  onNavigate: (page: Page) => void;
  onOpenNewTransaction: () => void;
  onToggleShortcutsModal: () => void;
  onCloseShortcutsModal?: () => void;
  onLock?: () => void;
  onTogglePrivacyMode?: () => void;
  isDisabled?: boolean;
}

export interface KeyboardShortcutsState {
  gKeyPressed: boolean;
  gTimer: NodeJS.Timeout | null;
}

export const handleShortcutKeyDown = (
  e: { key: string; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; preventDefault?: () => void },
  state: KeyboardShortcutsState,
  options: KeyboardShortcutsOptions,
  activeElement?: { tagName?: string; isContentEditable?: boolean; closest?: (selector: string) => Element | null } | null,
  hasOpenDialog?: boolean,
): void => {
  if (options.isDisabled) return;

  const isInput =
    activeElement &&
    (activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.tagName === 'SELECT' ||
      activeElement.isContentEditable);

  if (isInput) return;

  const key = e.key.toLowerCase();

  // Shift + P toggles privacy mode globally (even if a dialog is open, unless typing in an input)
  if (e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && key === 'p' && options.onTogglePrivacyMode) {
    e.preventDefault?.();
    options.onTogglePrivacyMode();
    return;
  }

  // '?' toggles the shortcuts modal unless another modal/dialog is open
  if ((key === '?' || (e.shiftKey && key === '/')) && !e.metaKey && !e.ctrlKey && !e.altKey) {
    if (hasOpenDialog) return;
    e.preventDefault?.();
    options.onToggleShortcutsModal();
    return;
  }

  // Suppress single-key / chord shortcuts when a dialog or overlay is active
  if (hasOpenDialog) return;

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
      case 'f':
        e.preventDefault?.();
        options.onCloseShortcutsModal?.();
        options.onNavigate('Forecasting');
        return;
      case 'g':
        e.preventDefault?.();
        options.onCloseShortcutsModal?.();
        options.onNavigate('Goals');
        return;
      case 'c':
        e.preventDefault?.();
        options.onCloseShortcutsModal?.();
        options.onNavigate('Schedule & Bills');
        return;
      case 'r':
        e.preventDefault?.();
        options.onCloseShortcutsModal?.();
        options.onNavigate('Reports');
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

  if (key === 'g' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
    state.gKeyPressed = true;
    if (state.gTimer) clearTimeout(state.gTimer);
    state.gTimer = setTimeout(() => {
      state.gKeyPressed = false;
    }, 1200);
    return;
  }

  if (key === 'l' && options.onLock && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
    e.preventDefault?.();
    options.onCloseShortcutsModal?.();
    options.onLock();
    return;
  }

  if (key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
    e.preventDefault?.();
    options.onCloseShortcutsModal?.();
    options.onOpenNewTransaction();
    return;
  }
};

export const useKeyboardShortcuts = ({
  onNavigate,
  onOpenNewTransaction,
  onToggleShortcutsModal,
  onCloseShortcutsModal,
  onLock,
  onTogglePrivacyMode,
  isDisabled,
}: KeyboardShortcutsOptions) => {
  const state = useRef<KeyboardShortcutsState>({ gKeyPressed: false, gTimer: null });

  useEffect(() => {
    if (isDisabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const openModal = typeof document !== 'undefined'
        ? Boolean(document.querySelector('[aria-modal="true"], [role="dialog"]'))
        : false;
      handleShortcutKeyDown(
        e,
        state.current,
        { onNavigate, onOpenNewTransaction, onToggleShortcutsModal, onCloseShortcutsModal, onLock, onTogglePrivacyMode, isDisabled },
        typeof document !== 'undefined' ? (document.activeElement as any) : null,
        openModal,
      );
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (state.current.gTimer) clearTimeout(state.current.gTimer);
    };
  }, [onNavigate, onOpenNewTransaction, onToggleShortcutsModal, onCloseShortcutsModal, onLock, onTogglePrivacyMode, isDisabled]);
};
