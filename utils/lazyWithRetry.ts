import React, { lazy } from 'react';

export function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    const key = 'crystal_chunk_reload_' + (typeof factory === 'function' ? factory.toString().slice(0, 60) : 'page');
    try {
      const mod = await factory();
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem(key);
        } catch {
          // ignore storage errors
        }
      }
      return mod;
    } catch (error) {
      if (typeof window !== 'undefined') {
        try {
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, '1');
            window.location.reload();
            return new Promise<{ default: T }>(() => {});
          }
          sessionStorage.removeItem(key);
        } catch {
          // ignore storage errors
        }
      }
      throw error;
    }
  });
}
