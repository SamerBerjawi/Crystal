import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Open dialogs, outermost first. Only the last one reacts to Tab / Escape. */
const openDialogs: HTMLElement[] = [];

export const isTopmostDialog = (el: HTMLElement | null) => !!el && openDialogs[openDialogs.length - 1] === el;

const isVisible = (el: HTMLElement) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';

let labelCounter = 0;

// Focus moves into a dialog (autofocus, or our own focus()) before this hook can look at document.activeElement, so
// remember recent focus targets and pick the most recent one that is not inside the dialog as its opener.
const focusHistory: HTMLElement[] = [];
if (typeof document !== 'undefined') {
  document.addEventListener('focusin', event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (focusHistory[focusHistory.length - 1] === target) return;
    focusHistory.push(target);
    if (focusHistory.length > 8) focusHistory.shift();
  }, true);
}

const findOpener = (root: HTMLElement): HTMLElement | null => {
  for (let i = focusHistory.length - 1; i >= 0; i--) {
    const candidate = focusHistory[i];
    if (candidate !== document.body && !root.contains(candidate) && document.contains(candidate)) return candidate;
  }
  return null;
};

/**
 * Makes an overlay behave as a modal dialog: it is announced (role + label are applied by the caller or derived from
 * the first heading), focus moves into it, Tab cycles inside it, and focus returns to the opener when it closes.
 * Attach the returned ref to the dialog's root element and give that element `role="dialog" aria-modal="true"`.
 */
export function useDialogA11y<T extends HTMLElement = HTMLDivElement>(active: boolean = true) {
  const ref = useRef<T>(null);
  const bound = useRef<{ root: HTMLElement | null; teardown: (() => void) | null }>({ root: null, teardown: null });

  // Runs after every render so a dialog that stays mounted while its root appears/disappears (isOpen toggling)
  // is set up and torn down at the right time, not only on mount.
  useEffect(() => {
    const root = active ? ref.current : null;
    if (bound.current.root === root) return;
    bound.current.teardown?.();
    bound.current = { root, teardown: root ? setupDialog(root) : null };
  });

  useEffect(() => () => {
    bound.current.teardown?.();
    bound.current = { root: null, teardown: null };
  }, []);

  return ref;
}

function setupDialog(root: HTMLElement): () => void {
  const opener = findOpener(root);
  openDialogs.push(root);

  // Name the dialog from its first heading unless the author already did.
  if (!root.hasAttribute('aria-label') && !root.hasAttribute('aria-labelledby')) {
    const heading = root.querySelector<HTMLElement>('h1, h2, h3');
    if (heading) {
      if (!heading.id) heading.id = `dialog-title-${++labelCounter}`;
      root.setAttribute('aria-labelledby', heading.id);
    }
  }

  if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '-1');
  // Respect an autofocused field; otherwise land on the dialog itself so it is read out before its controls.
  if (!root.contains(document.activeElement)) root.focus({ preventScroll: true });

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab' || !isTopmostDialog(root)) return;
    const focusables = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisible);
    if (focusables.length === 0) {
      event.preventDefault();
      root.focus();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const current = document.activeElement as HTMLElement | null;
    if (event.shiftKey && (current === first || current === root || !root.contains(current))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (current === last || !root.contains(current))) {
      event.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('keydown', onKeyDown, true);

  return () => {
    document.removeEventListener('keydown', onKeyDown, true);
    const index = openDialogs.indexOf(root);
    if (index >= 0) openDialogs.splice(index, 1);
    // Give focus back to what opened the dialog, if it is still on the page.
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
  };
}
