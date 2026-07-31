"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateJsonPatchPayload = exports.jsonPatchPayloadSchema = exports.jsonPatchOperationSchema = exports.validateFinancialDataPayload = exports.financialDataSchema = exports.recurringTransactionSchema = exports.financialGoalSchema = exports.transactionSchema = exports.accountSchema = void 0;
const zod_1 = require("zod");
exports.accountSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    type: zod_1.z.string(),
    balance: zod_1.z.number().or(zod_1.z.string().transform(v => parseFloat(v) || 0)),
    currency: zod_1.z.string(),
    subType: zod_1.z.string().optional(),
    status: zod_1.z.string().optional(),
    includeInAnalytics: zod_1.z.boolean().optional(),
}).passthrough();
exports.transactionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    accountId: zod_1.z.string(),
    amount: zod_1.z.number().or(zod_1.z.string().transform(v => parseFloat(v) || 0)),
    date: zod_1.z.string(),
    description: zod_1.z.string(),
    category: zod_1.z.string().optional(),
    type: zod_1.z.string().optional(),
    currency: zod_1.z.string().optional(),
}).passthrough();
exports.financialGoalSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    amount: zod_1.z.number().or(zod_1.z.string().transform(v => parseFloat(v) || 0)),
    currency: zod_1.z.string(),
    type: zod_1.z.string().optional(),
}).passthrough();
exports.recurringTransactionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    accountId: zod_1.z.string(),
    amount: zod_1.z.number().or(zod_1.z.string().transform(v => parseFloat(v) || 0)),
    frequency: zod_1.z.string(),
    startDate: zod_1.z.string(),
}).passthrough();
exports.financialDataSchema = zod_1.z.object({
    accounts: zod_1.z.array(exports.accountSchema).optional(),
    transactions: zod_1.z.array(exports.transactionSchema).optional(),
    investmentTransactions: zod_1.z.array(zod_1.z.any()).optional(),
    recurringTransactions: zod_1.z.array(exports.recurringTransactionSchema).optional(),
    recurringTransactionOverrides: zod_1.z.array(zod_1.z.any()).optional(),
    financialGoals: zod_1.z.array(exports.financialGoalSchema).optional(),
    budgets: zod_1.z.array(zod_1.z.any()).optional(),
    tasks: zod_1.z.array(zod_1.z.any()).optional(),
    warrants: zod_1.z.array(zod_1.z.any()).optional(),
    memberships: zod_1.z.array(zod_1.z.any()).optional(),
    importExportHistory: zod_1.z.array(zod_1.z.any()).optional(),
    billsAndPayments: zod_1.z.array(zod_1.z.any()).optional(),
    invoices: zod_1.z.array(zod_1.z.any()).optional(),
    tags: zod_1.z.array(zod_1.z.any()).optional(),
    predictions: zod_1.z.array(zod_1.z.any()).optional(),
    enableBankingConnections: zod_1.z.array(zod_1.z.any()).optional(),
    incomeCategories: zod_1.z.array(zod_1.z.any()).optional(),
    expenseCategories: zod_1.z.array(zod_1.z.any()).optional(),
    accountOrder: zod_1.z.array(zod_1.z.string()).optional(),
    taskOrder: zod_1.z.array(zod_1.z.string()).optional(),
    loanPaymentOverrides: zod_1.z.record(zod_1.z.any()).optional(),
    manualWarrantPrices: zod_1.z.record(zod_1.z.any()).optional(),
    priceHistory: zod_1.z.record(zod_1.z.any()).optional(),
    userStats: zod_1.z.record(zod_1.z.any()).optional(),
    lastUpdatedAt: zod_1.z.string().optional(),
}).passthrough();
const validateFinancialDataPayload = (body) => {
    if (!body || typeof body !== 'object') {
        return { success: false, error: 'Request body must be a non-empty object.' };
    }
    const payload = body;
    const targetData = payload.partial ? (payload.data || {}) : payload;
    const result = exports.financialDataSchema.safeParse(targetData);
    if (!result.success) {
        const issueMsg = result.error.issues
            .map(issue => `${issue.path.join('.') || 'root'}: ${issue.message}`)
            .join('; ');
        return { success: false, error: `Invalid payload structure: ${issueMsg}` };
    }
    return { success: true, data: result.data };
};
exports.validateFinancialDataPayload = validateFinancialDataPayload;
exports.jsonPatchOperationSchema = zod_1.z.object({
    op: zod_1.z.enum(['add', 'remove', 'replace', 'move', 'copy', 'test']),
    path: zod_1.z.string().startsWith('/'),
    value: zod_1.z.any().optional(),
    from: zod_1.z.string().startsWith('/').optional(),
});
exports.jsonPatchPayloadSchema = zod_1.z.union([
    zod_1.z.object({
        patch: zod_1.z.array(exports.jsonPatchOperationSchema).min(1),
        previousUpdatedAt: zod_1.z.string().optional(),
    }),
    zod_1.z.array(exports.jsonPatchOperationSchema).min(1),
]);
const validateJsonPatchPayload = (body) => {
    if (!body || (typeof body !== 'object' && !Array.isArray(body))) {
        return { success: false, error: 'Request body must be a non-empty object or array of patch operations.' };
    }
    const result = exports.jsonPatchPayloadSchema.safeParse(body);
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
exports.validateJsonPatchPayload = validateJsonPatchPayload;
