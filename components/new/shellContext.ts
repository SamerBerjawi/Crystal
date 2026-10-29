import { createContext, useContext, useEffect, useRef } from 'react';
import type { NvIconName } from './NvIcon';

/*
 * What a page gives the shell header: its search and its one primary action. Tabs, filters, sort and tools are
 * not the header's: a page puts them in its content, above the list they control (UI_UX_DESIGN_REFERENCE.md §21, N20),
 * with the parts in `PageToolbar.tsx`.
 */

/**
 * The header search belongs to the page (UI_UX_DESIGN_REFERENCE.md §13): a page that registers one gets the
 * header field bound to its own query (transactions, accounts…). Pages that don't (the dashboard and the
 * placeholders) get a search over the app's pages.
 */
export interface PageSearchConfig { value: string; onChange: (value: string) => void; placeholder: string }

/** The page's primary action, shown as the header's violet button (§14 N4). Pages without one get "Add transaction". */
export interface PageActionConfig { label: string; icon: NvIconName; onClick: () => void }

interface ShellNewContextValue {
  setPageSearch: (search: PageSearchConfig | null) => void;
  setPageAction: (action: PageActionConfig | null) => void;
  /** The theme in use (system resolved), for maps and charts. */
  isDark: boolean;
  navigate: (path: string) => void;
  /** Opens the quick-add sheet (the same one as the + buttons). */
  openQuickAdd: () => void;
}

export const ShellNewContext = createContext<ShellNewContextValue | null>(null);

export const useShellNew = (): ShellNewContextValue => {
  const ctx = useContext(ShellNewContext);
  if (!ctx) throw new Error('useShellNew must be used inside ShellNew');
  return ctx;
};

/** Binds the header search to this page's query while the page is mounted. */
export function usePageSearch(config: PageSearchConfig) {
  const { setPageSearch } = useShellNew();
  const { value, onChange, placeholder } = config;
  useEffect(() => { setPageSearch({ value, onChange, placeholder }); }, [value, onChange, placeholder, setPageSearch]);
  useEffect(() => () => setPageSearch(null), [setPageSearch]);
}

/** Sets the header's primary action while the page is mounted. `onClick` is read from the latest render. */
export function usePageAction(config: PageActionConfig) {
  const { setPageAction } = useShellNew();
  const onClickRef = useRef(config.onClick);
  onClickRef.current = config.onClick;
  const { label, icon } = config;
  useEffect(() => { setPageAction({ label, icon, onClick: () => onClickRef.current() }); }, [label, icon, setPageAction]);
  useEffect(() => () => setPageAction(null), [setPageAction]);
}

export type { ShellNewContextValue };
