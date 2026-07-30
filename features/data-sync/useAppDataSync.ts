import { useRef, useCallback } from 'react';
import { FinancialData } from '../../types';

export interface JsonPatchOp {
    op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
    path: string;
    value?: any;
    from?: string;
}

export interface UseAppDataSyncOptions {
    isAuthenticated: boolean;
    isDemoMode?: boolean;
    authorizedFetch: (url: string, init?: RequestInit) => Promise<Response>;
    saveDataMutation: { mutateAsync: (payload: Record<string, unknown>) => Promise<boolean> };
    savePartialMutation: { mutateAsync: (data: Partial<FinancialData>) => Promise<boolean> };
    patchDataMutation?: { mutateAsync: (variables: { patch: JsonPatchOp[]; previousUpdatedAt?: string }) => Promise<boolean> };
    mutateCollectionMutation?: { mutateAsync: (variables: { collection: string; item?: any; method?: 'POST' | 'PUT' | 'DELETE'; itemId?: string }) => Promise<boolean> };
    hasMaterialData: (data: FinancialData) => boolean;
    toLocalDateTimeString: (date: Date) => string;
}

export const useAppDataSync = ({
    isAuthenticated,
    isDemoMode,
    authorizedFetch,
    saveDataMutation,
    savePartialMutation,
    patchDataMutation,
    mutateCollectionMutation,
    hasMaterialData,
    toLocalDateTimeString,
}: UseAppDataSyncOptions) => {
    const lastUpdatedAtRef = useRef<string | undefined>(undefined);

    const postData = useCallback(
        async (payload: Record<string, unknown>, options?: { keepalive?: boolean; suppressErrors?: boolean }): Promise<boolean> => {
            if (!isAuthenticated || isDemoMode) return false;
            try {
                const response = await authorizedFetch('/api/data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    keepalive: options?.keepalive,
                });
                return response.ok;
            } catch (error) {
                return false;
            }
        },
        [authorizedFetch, isAuthenticated, isDemoMode]
    );

    const patchData = useCallback(
        async (patchOps: JsonPatchOp[], options?: { keepalive?: boolean; suppressErrors?: boolean }): Promise<boolean> => {
            if (!isAuthenticated || isDemoMode || patchOps.length === 0) return false;
            const now = toLocalDateTimeString(new Date());
            try {
                if (patchDataMutation) {
                    await patchDataMutation.mutateAsync({ patch: patchOps, previousUpdatedAt: lastUpdatedAtRef.current });
                    lastUpdatedAtRef.current = now;
                    return true;
                }
                const response = await authorizedFetch('/api/data', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ patch: patchOps, previousUpdatedAt: lastUpdatedAtRef.current }),
                    keepalive: options?.keepalive,
                });
                if (response.ok) {
                    lastUpdatedAtRef.current = now;
                }
                return response.ok;
            } catch (error) {
                return false;
            }
        },
        [authorizedFetch, isAuthenticated, isDemoMode, patchDataMutation, toLocalDateTimeString]
    );

    const mutateCollectionItem = useCallback(
        async (
            collection: string,
            item?: any,
            method: 'POST' | 'PUT' | 'DELETE' = 'POST',
            itemId?: string
        ): Promise<boolean> => {
            if (!isAuthenticated || isDemoMode) return false;
            const now = toLocalDateTimeString(new Date());
            try {
                if (mutateCollectionMutation) {
                    await mutateCollectionMutation.mutateAsync({ collection, item, method, itemId });
                    lastUpdatedAtRef.current = now;
                    return true;
                }
                const url = itemId ? `/api/data/${collection}/${itemId}` : `/api/data/${collection}`;
                const response = await authorizedFetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: method !== 'DELETE' ? JSON.stringify(item) : undefined,
                });
                if (response.ok) {
                    lastUpdatedAtRef.current = now;
                }
                return response.ok;
            } catch (error) {
                return false;
            }
        },
        [authorizedFetch, isAuthenticated, isDemoMode, mutateCollectionMutation, toLocalDateTimeString]
    );

    const saveData = useCallback(
        async (data: FinancialData, options?: { keepalive?: boolean; suppressErrors?: boolean; allowEmpty?: boolean }): Promise<boolean> => {
            if (!options?.allowEmpty && !hasMaterialData(data)) {
                console.warn('Skipping auto-save of empty data payload to prevent potential data loss.');
                return false;
            }
            const now = toLocalDateTimeString(new Date());
            const payload = {
                ...data,
                lastUpdatedAt: now,
                previousUpdatedAt: lastUpdatedAtRef.current,
                ...(options?.allowEmpty ? { allowEmpty: true } : {}),
            };

            try {
                if (!isAuthenticated || isDemoMode) {
                    const succeeded = await postData(payload, options);
                    if (succeeded) {
                        lastUpdatedAtRef.current = now;
                    }
                    return succeeded;
                }
                await saveDataMutation.mutateAsync(payload);
                lastUpdatedAtRef.current = now;
                return true;
            } catch (error) {
                return false;
            }
        },
        [postData, saveDataMutation, isAuthenticated, isDemoMode, hasMaterialData, toLocalDateTimeString]
    );

    const savePartialData = useCallback(
        async (data: Partial<FinancialData>, options?: { keepalive?: boolean; suppressErrors?: boolean }): Promise<boolean> => {
            const patchOps: JsonPatchOp[] = Object.entries(data).map(([key, value]) => ({
                op: 'replace',
                path: `/${key}`,
                value,
            }));
            if (patchOps.length === 0) return true;

            return patchData(patchOps, options);
        },
        [patchData]
    );

    return {
        lastUpdatedAtRef,
        postData,
        patchData,
        mutateCollectionItem,
        saveData,
        savePartialData,
    };
};
