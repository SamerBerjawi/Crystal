import { getPendingChanges, removePendingChange } from '../db';
import { replayPendingFinancialChange } from './client';

export const syncPendingChanges = async (token?: string | null): Promise<void> => {
  try {
    const pendingChanges = await getPendingChanges();
    for (const change of pendingChanges) {
      let succeeded = false;
      if (change.entityType === 'financialData') {
        succeeded = await replayPendingFinancialChange(change, token);
      }

      if (succeeded && change.id !== undefined) {
        await removePendingChange(change.id);
      }

      if (!succeeded) {
        break;
      }
    }
  } catch (error) {
    console.error('Sync failed:', error);
  }
};
