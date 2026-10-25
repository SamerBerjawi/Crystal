import { createContext, useContext, useEffect } from 'react';
import type { TabItem } from './ui';

/**
 * Page tabs live in the shell's top bar (decision Q7). A page declares its tabs with `usePageTabs` and the
 * shell renders them; on phones they sit under the header.
 */
export interface PageTabsConfig { items: TabItem<string>[]; value: string; onChange: (id: string) => void; label: string }

interface ShellNewContextValue {
  setPageTabs: (tabs: PageTabsConfig | null) => void;
  navigate: (path: string) => void;
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

export type { ShellNewContextValue };
