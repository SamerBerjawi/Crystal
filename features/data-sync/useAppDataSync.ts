import { useRef, useCallback } from 'react';
import { FinancialData } from '../../types';

export interface UseAppDataSyncOptions {
    isAuthenticated: boolean;
    isDemoMode?: boolean;
    authorizedFetch: (url: string, init?: RequestInit) => Promise<Response>;
    saveDataMutation: { mutateAsync: (payload: Record<string, unknown>) => Promise<boolean> };
    savePartialMutation: { mutateAsync: (data: Partial<FinancialData>) => Promise<boolean> };
    hasMaterialData: (data: FinancialData) => boolean;
    toLocalDateTimeString: (date: Date) => string;
}

export const useAppDataSync = ({
    isAuthenticated,
    isDemoMode,
    authorizedFetch,
    saveDataMutation,
    savePartialMutation,
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
            const now = toLocalDateTimeString(new Date());
            try {
                if (!isAuthenticated || isDemoMode) {
                    const payload = { partial: true, data, lastUpdatedAt: now, previousUpdatedAt: lastUpdatedAtRef.current };
                    const succeeded = await postData(payload, options);
                    if (succeeded) {
                        lastUpdatedAtRef.current = now;
                    }
                    return succeeded;
                }
                await savePartialMutation.mutateAsync(data);
                lastUpdatedAtRef.current = now;
                return true;
            } catch (error) {
                return false;
            }
        },
        [postData, savePartialMutation, isAuthenticated, isDemoMode, toLocalDateTimeString]
    );

    return {
        lastUpdatedAtRef,
        postData,
        saveData,
        savePartialData,
    };
};
