"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const middleware_1 = require("./middleware");
const schemas_1 = require("./schemas");
const dbNorm_1 = require("./dbNorm");
const router = express_1.default.Router();
// Native Database Aggregation: Category Totals Over Time (GET /api/data/aggregations/category-totals)
router.get('/aggregations/category-totals', middleware_1.authenticateToken, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ message: 'Authentication required.' });
    }
    const { startDate, endDate } = req.query;
    try {
        const categoryTotals = await (0, dbNorm_1.getCategoryTotalsSql)(userId, { startDate, endDate });
        res.json({ categoryTotals });
    }
    catch (err) {
        console.error('Failed to compute category totals aggregation:', err);
        res.status(500).json({ message: 'Failed to compute category totals aggregation' });
    }
});
// Get all financial data for a user
router.get('/', middleware_1.authenticateToken, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ message: 'Authentication required.' });
    }
    try {
        const data = await (0, dbNorm_1.fetchFinancialDataFromRelational)(userId);
        res.json(data);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch data' });
    }
});
// RFC 6902 JSON Patch endpoint (PATCH /api/data)
const handleJsonPatch = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ message: 'Authentication required.' });
    }
    const validation = (0, schemas_1.validateJsonPatchPayload)(req.body);
    if (!validation.success || !validation.patch) {
        return res.status(400).json({ message: validation.error || 'Invalid JSON Patch payload.' });
    }
    try {
        const patchResult = await (0, dbNorm_1.applyJsonPatchToRelational)(userId, validation.patch);
        if (!patchResult.success || !patchResult.doc) {
            return res.status(400).json({ message: patchResult.error || 'Failed to apply JSON Patch.' });
        }
        res.json({ message: 'Patch applied successfully', lastUpdatedAt: patchResult.doc.lastUpdatedAt, data: patchResult.doc });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to apply JSON Patch' });
    }
};
router.patch('/', middleware_1.authenticateToken, handleJsonPatch);
router.post('/patch', middleware_1.authenticateToken, handleJsonPatch);
// Fine-grained collection item creation / upsert (POST /api/data/:collection)
router.post('/:collection', middleware_1.authenticateToken, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ message: 'Authentication required.' });
    }
    const collection = String(req.params.collection);
    const item = req.body;
    if (!item || typeof item !== 'object') {
        return res.status(400).json({ message: 'Item payload must be an object.' });
    }
    try {
        const nextData = await (0, dbNorm_1.addOrUpdateRelationalItem)(userId, collection, item);
        res.json({ message: `Item added to ${collection} successfully`, lastUpdatedAt: nextData.lastUpdatedAt, data: nextData });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: `Failed to add item to ${collection}` });
    }
});
// Fine-grained collection item update by ID (PUT /api/data/:collection/:id)
router.put('/:collection/:id', middleware_1.authenticateToken, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ message: 'Authentication required.' });
    }
    const collection = String(req.params.collection);
    const id = String(req.params.id);
    const item = req.body || {};
    try {
        const nextData = await (0, dbNorm_1.addOrUpdateRelationalItem)(userId, collection, { ...item, id });
        res.json({ message: `Item ${id} in ${collection} updated successfully`, lastUpdatedAt: nextData.lastUpdatedAt, data: nextData });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: `Failed to update item ${id} in ${collection}` });
    }
});
// Fine-grained collection item deletion by ID (DELETE /api/data/:collection/:id)
router.delete('/:collection/:id', middleware_1.authenticateToken, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ message: 'Authentication required.' });
    }
    const collection = String(req.params.collection);
    const id = String(req.params.id);
    try {
        const nextData = await (0, dbNorm_1.removeRelationalItem)(userId, collection, id);
        res.json({ message: `Item ${id} removed from ${collection} successfully`, lastUpdatedAt: nextData.lastUpdatedAt, data: nextData });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: `Failed to remove item ${id} from ${collection}` });
    }
});
// Save all financial data (POST /api/data)
router.post('/', middleware_1.authenticateToken, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ message: 'Authentication required.' });
    }
    const body = req.body || {};
    const validation = (0, schemas_1.validateFinancialDataPayload)(body);
    if (!validation.success) {
        return res.status(400).json({ message: validation.error || 'Invalid financial data payload structure.' });
    }
    const allowEmpty = Boolean(body.allowEmpty);
    try {
        const currentData = await (0, dbNorm_1.fetchFinancialDataFromRelational)(userId);
        const isPartial = Boolean(body.partial);
        const incomingData = isPartial ? (body.data || {}) : { ...body };
        delete incomingData.partial;
        delete incomingData.data;
        delete incomingData.previousUpdatedAt;
        delete incomingData.allowEmpty;
        const hasMaterialData = (data) => {
            const arrayKeys = [
                'accounts',
                'transactions',
                'investmentTransactions',
                'recurringTransactions',
                'recurringTransactionOverrides',
                'financialGoals',
                'budgets',
                'tasks',
                'warrants',
                'memberships',
                'importExportHistory',
                'billsAndPayments',
                'invoices',
                'tags',
                'predictions',
                'enableBankingConnections',
                'incomeCategories',
                'expenseCategories',
                'accountOrder',
                'taskOrder',
            ];
            const objectKeys = ['loanPaymentOverrides', 'manualWarrantPrices', 'priceHistory', 'userStats'];
            if (arrayKeys.some(key => Array.isArray(data[key]) && data[key].length > 0)) {
                return true;
            }
            return objectKeys.some(key => {
                const value = data[key];
                return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
            });
        };
        if (!isPartial && !allowEmpty && hasMaterialData(currentData) && !hasMaterialData(incomingData)) {
            return res.status(409).json({
                message: 'Refusing to overwrite existing data with an empty payload.',
                currentUpdatedAt: currentData.lastUpdatedAt,
            });
        }
        const mergedData = await (0, dbNorm_1.syncFinancialDataToRelational)(userId, incomingData, isPartial);
        res.json({ message: 'Data saved successfully', lastUpdatedAt: mergedData.lastUpdatedAt, data: mergedData });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to save data' });
    }
});
exports.default = router;
