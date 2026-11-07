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
  /** True while the shortcuts modal itself is open, so it doesn't count as 'another dialog'. */
  isShortcutsModalOpen?: boolean;
}

export interface KeyboardShortcutsState {
  gKeyPressed: boolean;
  gTimer: NodeJS.Timeout | null;
}

export const handleShortcutKeyDown = (
  e: { key: string; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; repeat?: boolean; isComposing?: boolean; defaultPrevented?: boolean; preventDefault?: () => void },
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
      activeElement.isContentEditable ||
      Boolean(activeElement.closest?.('[role="textbox"], [role="combobox"], [role="searchbox"], [contenteditable="true"]')));

  if (isInput) return;
  if (e.repeat || e.isComposing || e.defaultPrevented) return;

  // A bare modifier press must not cancel a pending "G then X" sequence.
  if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta' || e.key === 'CapsLock') return;

  const key = e.key.toLowerCase();
  const hasModifier = Boolean(e.metaKey || e.ctrlKey || e.altKey);

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
  if (state.gKeyPressed && hasModifier) {
    // Browser/OS combos like Cmd+R or Ctrl+T must pass through untouched.
    state.gKeyPressed = false;
    if (state.gTimer) clearTimeout(state.gTimer);
    return;
  }

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

export const useKeyboardShortcuts = (options: KeyboardShortcutsOptions) => {
  const state = useRef<KeyboardShortcutsState>({ gKeyPressed: false, gTimer: null });
  // Always read the latest callbacks without re-registering the listener (which used to
  // cancel a pending "G then X" sequence on every re-render).
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const current = optionsRef.current;
      // The shortcuts modal is itself a dialog; only other dialogs should block shortcuts.
      const dialogCount = typeof document !== 'undefined'
        ? document.querySelectorAll('[role="dialog"], [role="alertdialog"]').length
        : 0;
      const otherDialogs = dialogCount - (current.isShortcutsModalOpen ? 1 : 0);
      handleShortcutKeyDown(
        e,
        state.current,
        current,
        typeof document !== 'undefined' ? (document.activeElement as any) : null,
        otherDialogs > 0,
      );
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (state.current.gTimer) clearTimeout(state.current.gTimer);
      state.current.gKeyPressed = false;
    };
  }, []);
};
