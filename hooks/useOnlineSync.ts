import { useEffect } from 'react';
import { syncPendingChanges } from '../api/sync';

export function useOnlineSync(token?: string | null) {
  useEffect(() => {
    async function trySync() {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await syncPendingChanges(token);
      }
    }

    trySync();

    function handleOnline() {
      void trySync();
    }

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [token]);
}
