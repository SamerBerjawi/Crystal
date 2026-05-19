import { useEffect, useRef, useState, useCallback, Dispatch, SetStateAction } from 'react';

/**
 * A hook that returns a callback to check if the component is currently mounted.
 * Useful for checking before resolving async promises or timer callbacks.
 */
export function useIsMounted() {
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return useCallback(() => isMounted.current, []);
}

/**
 * A safe alternative to useState that guards against setting state on unmounted components
 * to avoid memory leaks and stale state presentation mismatches on rapid transition.
 */
export function useSafeState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>] {
  const [state, setState] = useState(initialState);
  const isMounted = useIsMounted();

  const safeSetState = useCallback((value: SetStateAction<S>) => {
    if (isMounted()) {
      setState(value);
    }
  }, [isMounted]);

  return [state, safeSetState];
}
