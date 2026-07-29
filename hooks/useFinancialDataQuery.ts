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
            const payload = { partial: true, data: partialData };
            return saveFinancialDataPayload(payload);
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
