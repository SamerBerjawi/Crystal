import { useEffect, useState } from 'react';

const TAB_EVENT = 'crystal:tab';

const readTab = () => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('tab'));

/** Moves between a hub's tabs that share one page. The tab lives in the URL, so reload and Back keep it. */
export const setUrlTab = (tab: string | null) => {
  const url = new URL(window.location.href);
  if (tab) url.searchParams.set('tab', tab);
  else url.searchParams.delete('tab');
  window.history.replaceState(window.history.state, '', url);
  window.dispatchEvent(new Event(TAB_EVENT));
};

export const useUrlTab = () => {
  const [tab, setTab] = useState(readTab);

  useEffect(() => {
    const sync = () => setTab(readTab());
    window.addEventListener('popstate', sync);
    window.addEventListener(TAB_EVENT, sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener(TAB_EVENT, sync);
    };
  }, []);

  return tab;
};
