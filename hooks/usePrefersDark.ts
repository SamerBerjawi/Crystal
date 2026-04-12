import { useSyncExternalStore } from 'react';

const MEDIA_QUERY = '(prefers-color-scheme: dark)';

const subscribe = (callback: () => void) => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }

  const mediaQuery = window.matchMedia(MEDIA_QUERY);
  mediaQuery.addEventListener('change', callback);

  return () => {
    mediaQuery.removeEventListener('change', callback);
  };
};

const getSnapshot = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia(MEDIA_QUERY).matches;
};

export const usePrefersDark = () => useSyncExternalStore(subscribe, getSnapshot, () => false);
