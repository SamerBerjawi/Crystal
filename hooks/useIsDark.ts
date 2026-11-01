import { useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
};

/** Follows the theme class on the page, for things drawn outside CSS such as maps. */
export const useIsDark = () => useSyncExternalStore(subscribe, () => document.documentElement.classList.contains('dark'));
