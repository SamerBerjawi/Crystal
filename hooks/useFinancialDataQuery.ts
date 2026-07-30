import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { FinancialData } from '../types';

export const FINANCIAL_DATA_QUERY_KEY = ['financialData'] as const;

export const fetchFinancialData = async (): Promise<FinancialData> => {
    const response = await fetch('/api/data', { credentials: 'include' });
    if (!response.ok) {
        throw new Error(`Failed to fetch financial data (${response.status})`);
    }
    return response.json();
};

export const saveFinancialDataPayload = async (payload: Record<string, unknown>): Promise<boolean> => {
    const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Failed to save financial data (${response.status})`);
    }
    return true;
};

export interface JsonPatchOperation {
    op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
    path: string;
    value?: any;
    from?: string;
}

export const patchFinancialDataPayload = async (
    patchOps: JsonPatchOperation[],
    previousUpdatedAt?: string
): Promise<boolean> => {
    const response = await fetch('/api/data', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ patch: patchOps, previousUpdatedAt }),
    });

    if (!response.ok) {
        throw new Error(`Failed to apply RFC 6902 JSON Patch (${response.status})`);
    }
    return true;
};

export const mutateCollectionPayload = async (
    collection: string,
    item: any,
    method: 'POST' | 'PUT' | 'DELETE' = 'POST',
    itemId?: string
): Promise<boolean> => {
    const url = itemId ? `/api/data/${collection}/${itemId}` : `/api/data/${collection}`;
    const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: method !== 'DELETE' ? JSON.stringify(item) : undefined,
    });

    if (!response.ok) {
        throw new Error(`Failed collection mutation for ${collection} (${response.status})`);
    }
    return true;
};

export const useFinancialDataQuery = (options?: Partial<UseQueryOptions<FinancialData, Error>>) => {
    return useQuery<FinancialData, Error>({
        queryKey: FINANCIAL_DATA_QUERY_KEY,
        queryFn: fetchFinancialData,
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
        retry: 1,
        ...options,
    });
};

export const useSaveFinancialDataMutation = (
    options?: UseMutationOptions<boolean, Error, Record<string, unknown>>
) => {
    const queryClient = useQueryClient();

    return useMutation<boolean, Error, Record<string, unknown>>({
        mutationFn: saveFinancialDataPayload,
        ...options,
        onSuccess: (data, variables, context, meta) => {
            queryClient.invalidateQueries({ queryKey: FINANCIAL_DATA_QUERY_KEY });
            if (options?.onSuccess) {
                options.onSuccess(data, variables, context, meta);
            }
        },
    });
};

export const useSavePartialFinancialDataMutation = (
    options?: UseMutationOptions<boolean, Error, Partial<FinancialData>>
) => {
    const queryClient = useQueryClient();

    return useMutation<boolean, Error, Partial<FinancialData>>({
        mutationFn: async (partialData) => {
            const patchOps: JsonPatchOperation[] = Object.entries(partialData).map(([key, value]) => ({
                op: 'replace',
                path: `/${key}`,
                value,
            }));
            return patchFinancialDataPayload(patchOps);
        },
        ...options,
        onSuccess: (data, variables, context, meta) => {
            queryClient.invalidateQueries({ queryKey: FINANCIAL_DATA_QUERY_KEY });
            if (options?.onSuccess) {
                options.onSuccess(data, variables, context, meta);
            }
        },
    });
};

export const usePatchFinancialDataMutation = (
    options?: UseMutationOptions<boolean, Error, { patch: JsonPatchOperation[]; previousUpdatedAt?: string }>
) => {
    const queryClient = useQueryClient();

    return useMutation<boolean, Error, { patch: JsonPatchOperation[]; previousUpdatedAt?: string }>({
        mutationFn: async ({ patch, previousUpdatedAt }) => patchFinancialDataPayload(patch, previousUpdatedAt),
        ...options,
        onSuccess: (data, variables, context, meta) => {
            queryClient.invalidateQueries({ queryKey: FINANCIAL_DATA_QUERY_KEY });
            if (options?.onSuccess) {
                options.onSuccess(data, variables, context, meta);
            }
        },
    });
};

export const useMutateCollectionMutation = (
    options?: UseMutationOptions<boolean, Error, { collection: string; item?: any; method?: 'POST' | 'PUT' | 'DELETE'; itemId?: string }>
) => {
    const queryClient = useQueryClient();

    return useMutation<
        boolean,
        Error,
        { collection: string; item?: any; method?: 'POST' | 'PUT' | 'DELETE'; itemId?: string }
    >({
        mutationFn: async ({ collection, item, method, itemId }) => mutateCollectionPayload(collection, item, method, itemId),
        ...options,
        onSuccess: (data, variables, context, meta) => {
            queryClient.invalidateQueries({ queryKey: FINANCIAL_DATA_QUERY_KEY });
            if (options?.onSuccess) {
                options.onSuccess(data, variables, context, meta);
            }
        },
    });
};
