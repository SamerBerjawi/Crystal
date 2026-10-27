import { createContext, createElement, Fragment, useContext, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { NvIconName } from './NvIcon';
import type { TabItem } from './ui';

/**
 * Page tabs live in the shell's top bar (decision Q7). A page declares its tabs with `usePageTabs` and the
 * shell renders them; on phones they sit under the header.
 */
export interface PageTabsConfig { items: TabItem<string>[]; value: string; onChange: (id: string) => void; label: string }

/**
 * The header search belongs to the page (UI_UX_DESIGN_REFERENCE.md §13): a page that registers one gets the
 * header field bound to its own query (transactions, accounts…). Pages that don't (the dashboard and the
 * placeholders) get a search over the app's pages.
 */
export interface PageSearchConfig { value: string; onChange: (value: string) => void; placeholder: string }

/** The page's primary action, shown as the header's violet button (§14 N4). Pages without one get "Add transaction". */
export interface PageActionConfig { label: string; icon: NvIconName; onClick: () => void }

interface ShellNewContextValue {
  setPageTabs: (tabs: PageTabsConfig | null) => void;
  setPageSearch: (search: PageSearchConfig | null) => void;
  setPageAction: (action: PageActionConfig | null) => void;
  /** The band's slot for page controls (filters, period, view tools), filled through `HeaderControls`. */
  headerSlot: HTMLElement | null;
  /** The theme in use (system resolved), for maps and charts. */
  isDark: boolean;
  /** The slot on the tabs row, right-aligned, filled through `HeaderTools`. */
  toolsSlot: HTMLElement | null;
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

export function usePageTabs<T extends string>(config: { items: TabItem<T>[]; value: T; onChange: (id: T) => void; label: string } | null) {
  const { setPageTabs } = useShellNew();
  const key = config ? `${config.label}|${config.value}|${config.items.map(i => i.id + i.label).join(',')}` : '';
  const onChange = config?.onChange;
  useEffect(() => {
    setPageTabs(config ? { ...config, onChange: onChange as (id: string) => void } : null);
    // Re-register only when what is shown changes; onChange is read from the latest render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, onChange, setPageTabs]);
  useEffect(() => () => setPageTabs(null), [setPageTabs]);
}

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

/** Renders the page's controls (filters, period, tools) inside the header band (§14 N5). */
export function HeaderControls({ children }: { children: ReactNode }) {
  const { headerSlot } = useShellNew();
  return headerSlot ? createPortal(children, headerSlot) : createElement(Fragment);
}

/** Renders the page's tools (select, export, sync) on the tabs row, right-aligned (§15 N6). */
export function HeaderTools({ children }: { children: ReactNode }) {
  const { toolsSlot } = useShellNew();
  return toolsSlot ? createPortal(children, toolsSlot) : createElement(Fragment);
}

export type { ShellNewContextValue };
