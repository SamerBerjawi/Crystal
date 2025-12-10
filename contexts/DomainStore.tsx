import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSyncExternalStore } from 'react';

export type DomainStore<T> = {
  getState: () => T;
  setState: (nextState: T) => void;
  subscribe: (listener: () => void) => () => void;
};

export const createDomainStore = <T,>(initialState: T): DomainStore<T> => {
  let state = initialState;
  const listeners = new Set<() => void>();

  return {
    getState: () => state,
    setState: (nextState: T) => {
      if (Object.is(state, nextState)) return;
      state = nextState;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

export const useDomainStore = <T,>(state: T) => {
  const storeRef = useRef<DomainStore<T>>();

  if (!storeRef.current) {
    storeRef.current = createDomainStore(state);
  }

  const store = storeRef.current;

  useEffect(() => {
    store.setState(state);
  }, [store, state]);

  return store;
};

export const useDomainSelector = <T, U>(
  store: DomainStore<T> | undefined,
  selector: (state: T) => U,
  equalityFn: (a: U, b: U) => boolean = Object.is
) => {
  if (!store) throw new Error('Domain selector used outside of a provider');

  const memoizedSelector = useMemo(() => selector, [selector]);

  const getSnapshot = useCallback(() => memoizedSelector(store.getState()), [memoizedSelector, store]);

  const selected = useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
  const lastSelectedRef = useRef(selected);

  return useMemo(() => {
    if (equalityFn(lastSelectedRef.current, selected)) {
      return lastSelectedRef.current;
    }

    lastSelectedRef.current = selected;
    return selected;
  }, [equalityFn, selected]);
};
