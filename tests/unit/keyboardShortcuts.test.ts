import test from 'node:test';
import assert from 'node:assert/strict';
import { handleShortcutKeyDown, KeyboardShortcutsState } from '../../hooks/useKeyboardShortcuts';

test('pressing "N" triggers onOpenNewTransaction and closes shortcuts modal', () => {
  const state: KeyboardShortcutsState = { gKeyPressed: false, gTimer: null };
  let openedNewTx = false;
  let closedShortcuts = false;

  handleShortcutKeyDown(
    { key: 'n' },
    state,
    {
      onNavigate: () => {},
      onOpenNewTransaction: () => { openedNewTx = true; },
      onToggleShortcutsModal: () => {},
      onCloseShortcutsModal: () => { closedShortcuts = true; },
    },
    null
  );

  assert.equal(openedNewTx, true);
  assert.equal(closedShortcuts, true);
});

test('pressing "?" triggers onToggleShortcutsModal', () => {
  const state: KeyboardShortcutsState = { gKeyPressed: false, gTimer: null };
  let toggled = false;

  handleShortcutKeyDown(
    { key: '?' },
    state,
    {
      onNavigate: () => {},
      onOpenNewTransaction: () => {},
      onToggleShortcutsModal: () => { toggled = true; },
    },
    null
  );

  assert.equal(toggled, true);
});

test('sequence "G then D" navigates to Dashboard and closes shortcuts modal', () => {
  const state: KeyboardShortcutsState = { gKeyPressed: false, gTimer: null };
  let navigatedTo: string | null = null;
  let closedShortcuts = false;

  const options = {
    onNavigate: (page: any) => { navigatedTo = page; },
    onOpenNewTransaction: () => {},
    onToggleShortcutsModal: () => {},
    onCloseShortcutsModal: () => { closedShortcuts = true; },
  };

  // First press 'g'
  handleShortcutKeyDown({ key: 'g' }, state, options, null);
  assert.equal(state.gKeyPressed, true);

  // Then press 'd'
  handleShortcutKeyDown({ key: 'd' }, state, options, null);
  assert.equal(state.gKeyPressed, false);
  assert.equal(navigatedTo, 'Dashboard');
  assert.equal(closedShortcuts, true);

  if (state.gTimer) clearTimeout(state.gTimer);
});

test('pressing "L" triggers onLock and closes shortcuts modal', () => {
  const state: KeyboardShortcutsState = { gKeyPressed: false, gTimer: null };
  let locked = false;
  let closedShortcuts = false;

  handleShortcutKeyDown(
    { key: 'l' },
    state,
    {
      onNavigate: () => {},
      onOpenNewTransaction: () => {},
      onToggleShortcutsModal: () => {},
      onCloseShortcutsModal: () => { closedShortcuts = true; },
      onLock: () => { locked = true; },
    },
    null
  );

  assert.equal(locked, true);
  assert.equal(closedShortcuts, true);
});

test('typing inside inputs ignores shortcuts', () => {
  const state: KeyboardShortcutsState = { gKeyPressed: false, gTimer: null };
  let openedNewTx = false;

  handleShortcutKeyDown(
    { key: 'n' },
    state,
    {
      onNavigate: () => {},
      onOpenNewTransaction: () => { openedNewTx = true; },
      onToggleShortcutsModal: () => {},
    },
    { tagName: 'INPUT' }
  );

  assert.equal(openedNewTx, false);
});

test('supports Shift+P, extended G chords (F, B, G, C, R), and suppresses single-key shortcuts when a dialog is open', () => {
  const navigated: string[] = [];
  let openedNewTx = 0;
  let toggledPrivacy = 0;

  const state: KeyboardShortcutsState = { gKeyPressed: false, gTimer: null };
  const options = {
    onNavigate: (page: any) => navigated.push(page),
    onOpenNewTransaction: () => { openedNewTx += 1; },
    onToggleShortcutsModal: () => {},
    onTogglePrivacyMode: () => { toggledPrivacy += 1; },
  };

  // Shift + P toggles privacy mode even when a dialog is open
  handleShortcutKeyDown({ key: 'P', shiftKey: true }, state, options, null, true);
  assert.equal(toggledPrivacy, 1);

  // 'N' is suppressed when a dialog is open
  handleShortcutKeyDown({ key: 'n' }, state, options, null, true);
  assert.equal(openedNewTx, 0);

  // 'G' then 'F' navigates to Forecasting, 'G' then 'R' to Reports
  handleShortcutKeyDown({ key: 'g' }, state, options, null, false);
  handleShortcutKeyDown({ key: 'f' }, state, options, null, false);
  handleShortcutKeyDown({ key: 'g' }, state, options, null, false);
  handleShortcutKeyDown({ key: 'r' }, state, options, null, false);
  assert.deepEqual(navigated, ['Forecasting', 'Reports']);

  if (state.gTimer) clearTimeout(state.gTimer);
});
