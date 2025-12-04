import { useEffect, useMemo, useRef } from 'react';

export function useThrottledCallback<T extends (...args: any[]) => void>(callback: T, delay: number): T {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastArgsRef = useRef<Parameters<T> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useMemo(() => {
    const throttled = (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        lastArgsRef.current = args;
        return;
      }

      callbackRef.current(...args);
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        if (lastArgsRef.current) {
          callbackRef.current(...lastArgsRef.current);
          lastArgsRef.current = null;
        }
      }, delay);
    };

    return throttled as T;
  }, [delay]) as T;
}
