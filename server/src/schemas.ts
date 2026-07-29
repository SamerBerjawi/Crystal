import { z } from 'zod';

export const accountSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    balance: z.number().or(z.string().transform(v => parseFloat(v) || 0)),
    currency: z.string(),
    subType: z.string().optional(),
    status: z.string().optional(),
    includeInAnalytics: z.boolean().optional(),
}).passthrough();

export const transactionSchema = z.object({
    id: z.string(),
    accountId: z.string(),
    amount: z.number().or(z.string().transform(v => parseFloat(v) || 0)),
    date: z.string(),
    description: z.string(),
    category: z.string().optional(),
    type: z.string().optional(),
    currency: z.string().optional(),
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
    startDate: z.string(),
}).passthrough();

export const financialDataSchema = z.object({
    accounts: z.array(accountSchema).optional(),
    transactions: z.array(transactionSchema).optional(),
    investmentTransactions: z.array(z.any()).optional(),
    recurringTransactions: z.array(recurringTransactionSchema).optional(),
    recurringTransactionOverrides: z.array(z.any()).optional(),
    financialGoals: z.array(financialGoalSchema).optional(),
    budgets: z.array(z.any()).optional(),
    tasks: z.array(z.any()).optional(),
    warrants: z.array(z.any()).optional(),
    memberships: z.array(z.any()).optional(),
    importExportHistory: z.array(z.any()).optional(),
    billsAndPayments: z.array(z.any()).optional(),
    invoices: z.array(z.any()).optional(),
    tags: z.array(z.any()).optional(),
    predictions: z.array(z.any()).optional(),
    enableBankingConnections: z.array(z.any()).optional(),
    incomeCategories: z.array(z.any()).optional(),
    expenseCategories: z.array(z.any()).optional(),
    accountOrder: z.array(z.string()).optional(),
    taskOrder: z.array(z.string()).optional(),
    loanPaymentOverrides: z.record(z.any()).optional(),
    manualWarrantPrices: z.record(z.any()).optional(),
    priceHistory: z.record(z.any()).optional(),
    userStats: z.record(z.any()).optional(),
    lastUpdatedAt: z.string().optional(),
}).passthrough();

export const validateFinancialDataPayload = (
    body: unknown
): { success: boolean; data?: z.infer<typeof financialDataSchema>; error?: string } => {
    if (!body || typeof body !== 'object') {
        return { success: false, error: 'Request body must be a non-empty object.' };
    }

    const payload = body as Record<string, any>;
    const targetData = payload.partial ? (payload.data || {}) : payload;

    const result = financialDataSchema.safeParse(targetData);
    if (!result.success) {
        const issueMsg = result.error.issues
            .map(issue => `${issue.path.join('.') || 'root'}: ${issue.message}`)
            .join('; ');
        return { success: false, error: `Invalid payload structure: ${issueMsg}` };
    }

    return { success: true, data: result.data };
};
