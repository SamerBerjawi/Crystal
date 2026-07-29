import { toLocalISOString } from '../utils';

export const createAutoBackupSnapshot = (data: Record<string, any>): string => {
  const timestamp = toLocalISOString(new Date()).replace(/:/g, '-');
  const backupKey = `crystal_autobackup_${timestamp}`;
  const payload = JSON.stringify({
    version: '1.0',
    createdAt: new Date().toISOString(),
    data,
  });

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(backupKey, payload);

      // Keep only last 5 auto-backups to preserve storage space
      const keys = Object.keys(localStorage).filter(k => k.startsWith('crystal_autobackup_')).sort();
      while (keys.length > 5) {
        const oldestKey = keys.shift();
        if (oldestKey) localStorage.removeItem(oldestKey);
      }
    } catch (e) {
      console.warn('Auto-backup storage limit reached', e);
    }
  }

  return backupKey;
};
