import { z } from 'zod';
import {
    PERSISTED_SLICE_KEYS,
    ENTITY_ARRAY_KEYS,
    ORDER_ARRAY_KEYS,
    OBJECT_SLICE_KEYS,
    DELTA_ELIGIBLE_KEYS,
    type PersistedSliceKey,
} from './sliceRegistry';

export {
    PERSISTED_SLICE_KEYS,
    ENTITY_ARRAY_KEYS,
    ORDER_ARRAY_KEYS,
    OBJECT_SLICE_KEYS,
    DELTA_ELIGIBLE_KEYS,
    type PersistedSliceKey,
};

// Calendar-valid "YYYY-MM-DD" (optionally followed by a time part). "2026-13-45" is rejected, not rolled over.
export const isValidDateString = (value: string): boolean => {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(value);
    if (!m) return false;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (mo < 1 || mo > 12 || d < 1) return false;
    return d <= new Date(Date.UTC(y, mo, 0)).getUTCDate();
};
const dateString = z.string().refine(isValidDateString, { message: 'must be a valid YYYY-MM-DD date' });

export const accountSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    balance: z.number().or(z.string().transform(v => parseFloat(v) || 0)),
    currency: z.string(),
    subType: z.string().optional(),
    status: z.string().optional(),
    includeInAnalytics: z.boolean().optional(),
    vacantMonths: z.array(z.string()).optional(),
}).passthrough();

export const transactionSchema = z.object({
    id: z.string(),
    accountId: z.string(),
    amount: z.number().or(z.string().transform(v => parseFloat(v) || 0)),
    date: dateString,
    description: z.string(),
    category: z.string().optional(),
    type: z.string().optional(),
    currency: z.string().optional(),
    assetId: z.string().optional(),
}).passthrough();

export const financialGoalSchema = z.object({
    id: z.string(),
    name: z.string(),
    amount: z.number().or(z.string().transform(v => parseFloat(v) || 0)),
    currency: z.string(),
    type: z.string().optional(),
}).passthrough();

export const recurringTransactionSchema = z.object({
    id: z.string(),
    accountId: z.string(),
    amount: z.number().or(z.string().transform(v => parseFloat(v) || 0)),
    frequency: z.string(),
    startDate: dateString,
}).passthrough();

const entityRecordSchema = z.record(z.string(), z.any());

export const entityDeltaSchema = z.object({
    upserts: z.array(entityRecordSchema).optional(),
    deletedIds: z.array(z.string()).optional(),
});

export const financialDataSchema = z.object({
    preferences: z.record(z.string(), z.any()).optional(),
    deltas: z.record(z.string(), entityDeltaSchema).optional(),
    accounts: z.array(accountSchema).optional(),
    transactions: z.array(transactionSchema).optional(),
    investmentTransactions: z.array(entityRecordSchema).optional(),
    recurringTransactions: z.array(recurringTransactionSchema).optional(),
    recurringTransactionOverrides: z.array(entityRecordSchema).optional(),
    financialGoals: z.array(financialGoalSchema).optional(),
    budgets: z.array(entityRecordSchema).optional(),
    tasks: z.array(entityRecordSchema).optional(),
    warrants: z.array(entityRecordSchema).optional(),
    memberships: z.array(entityRecordSchema).optional(),
    importExportHistory: z.array(entityRecordSchema).optional(),
    billsAndPayments: z.array(entityRecordSchema).optional(),
    invoices: z.array(entityRecordSchema).optional(),
    tags: z.array(entityRecordSchema).optional(),
    predictions: z.array(entityRecordSchema).optional(),
    enableBankingConnections: z.array(entityRecordSchema).optional(),
    incomeCategories: z.array(entityRecordSchema).optional(),
    expenseCategories: z.array(entityRecordSchema).optional(),
    accountOrder: z.array(z.string()).optional(),
    taskOrder: z.array(z.string()).optional(),
    goalOrder: z.array(z.string()).optional(),
    loanPaymentOverrides: z.record(z.string(), z.any()).optional(),
    manualWarrantPrices: z.record(z.string(), z.any()).optional(),
    priceHistory: z.record(z.string(), z.any()).optional(),
    userStats: z.record(z.string(), z.any()).optional(),
    userProfile: z.record(z.string(), z.any()).optional(),
    lastUpdatedAt: z.string().optional(),
}).passthrough();

export const validateFinancialDataPayload = (
    body: unknown
): { success: boolean; data?: z.infer<typeof financialDataSchema>; error?: string } => {
    if (!body || typeof body !== 'object') {
        return { success: false, error: 'Request body must be a non-empty object.' };
    }

    const payload = body as Record<string, any>;
    const targetData = payload.partial
        ? { ...(payload.data || {}), ...(payload.deltas ? { deltas: payload.deltas } : {}) }
        : payload;

    const result = financialDataSchema.safeParse(targetData);
    if (!result.success) {
        const issueMsg = result.error.issues
            .map(issue => `${issue.path.join('.') || 'root'}: ${issue.message}`)
            .join('; ');
        return { success: false, error: `Invalid payload structure: ${issueMsg}` };
    }

    if (targetData.deltas?.transactions?.upserts) {
        const txCheck = z.array(transactionSchema).safeParse(targetData.deltas.transactions.upserts);
        if (!txCheck.success) {
            const issueMsg = txCheck.error.issues
                .map(issue => `deltas.transactions.upserts.${issue.path.join('.')}: ${issue.message}`)
                .join('; ');
            return { success: false, error: `Invalid payload structure: ${issueMsg}` };
        }
    }

    return { success: true, data: result.data };
};

export const jsonPatchOperationSchema = z.object({
    op: z.enum(['add', 'remove', 'replace', 'move', 'copy', 'test']),
    path: z.string().startsWith('/'),
    value: z.any().optional(),
    from: z.string().startsWith('/').optional(),
});

export type JsonPatchOperation = z.infer<typeof jsonPatchOperationSchema>;

export const jsonPatchPayloadSchema = z.union([
    z.object({
        patch: z.array(jsonPatchOperationSchema).min(1),
        previousUpdatedAt: z.string().optional(),
    }),
    z.array(jsonPatchOperationSchema).min(1),
]);

export const validateJsonPatchPayload = (
    body: unknown
): { success: boolean; patch?: JsonPatchOperation[]; previousUpdatedAt?: string; error?: string } => {
    if (!body || (typeof body !== 'object' && !Array.isArray(body))) {
        return { success: false, error: 'Request body must be a non-empty object or array of patch operations.' };
    }

    const result = jsonPatchPayloadSchema.safeParse(body);
    if (!result.success) {
        const issueMsg = result.error.issues
            .map(issue => `${issue.path.join('.') || 'root'}: ${issue.message}`)
            .join('; ');
        return { success: false, error: `Invalid JSON Patch payload structure: ${issueMsg}` };
    }

    if (Array.isArray(result.data)) {
        return { success: true, patch: result.data };
    }

    return { success: true, patch: result.data.patch, previousUpdatedAt: result.data.previousUpdatedAt };
};

