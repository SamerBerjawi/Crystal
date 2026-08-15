import { useState, useEffect, useCallback } from 'react';

/** Tailwind `md` breakpoint in pixels */
const MD_BREAKPOINT = 768;

/**
 * Centralized responsive hook that mirrors the Tailwind `md:` breakpoint.
 * Returns `true` when the viewport is narrower than 768 px.
 *
 * Uses `matchMedia` for efficiency (no resize‑listener spam) and is
 * SSR‑safe (defaults to `false` on the server).
 */
export function useIsMobile(breakpoint = MD_BREAKPOINT): boolean {
  const query = `(max-width: ${breakpoint - 1}px)`;

  const getMatches = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  }, [query]);

  const [isMobile, setIsMobile] = useState(getMatches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);

    // Only update if value actually changed
    setIsMobile(prev => (prev === mql.matches ? prev : mql.matches));

    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return isMobile;
}

export default useIsMobile;
