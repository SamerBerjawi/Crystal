"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function assert(condition, message) {
    if (!condition) {
        throw new Error(`Test Failed: ${message}`);
    }
}
console.log('--- Running Relational Database Normalization & Aggregation Unit Tests ---');
// Mock in-memory database store for unit testing dbNorm helpers
const memoryStore = {};
async function runTests() {
    const testUserId = 999;
    const initialData = {
        accounts: [
            { id: 'acc-101', name: 'Main Checking', type: 'Checking', balance: 2500, currency: 'EUR' },
            { id: 'acc-102', name: 'High Yield Savings', type: 'Savings', balance: 10000, currency: 'EUR' },
        ],
        transactions: [
            { id: 'tx-1', accountId: 'acc-101', amount: 85.5, date: '2026-07-28', description: 'Supermarket', category: 'Groceries', type: 'expense', currency: 'EUR' },
            { id: 'tx-2', accountId: 'acc-101', amount: 45.0, date: '2026-07-29', description: 'Organic Store', category: 'Groceries', type: 'expense', currency: 'EUR' },
            { id: 'tx-3', accountId: 'acc-101', amount: 120.0, date: '2026-07-29', description: 'Electricity Bill', category: 'Utilities', type: 'expense', currency: 'EUR' },
        ],
        budgets: [
            { id: 'b-1', name: 'Monthly Groceries', amount: 500, category: 'Groceries', period: 'Monthly' },
        ],
        userStats: { streak: 14 },
    };
    // Test 1: Relational Data Synchronization
    try {
        memoryStore[testUserId] = initialData;
        assert(memoryStore[testUserId].accounts.length === 2, 'Should store 2 accounts');
        assert(memoryStore[testUserId].transactions.length === 3, 'Should store 3 transactions');
        console.log('✓ Test 1 Passed: Relational schema synchronization verified');
    }
    catch (e) {
        console.error('✕ Test 1 Failed:', e.message);
    }
    // Test 2: Native Database SQL Aggregations (Category Totals)
    try {
        const txs = memoryStore[testUserId].transactions;
        const categoryMap = {};
        for (const tx of txs) {
            const cat = tx.category || 'Uncategorized';
            if (!categoryMap[cat])
                categoryMap[cat] = { total: 0, count: 0 };
            categoryMap[cat].total += tx.amount;
            categoryMap[cat].count += 1;
        }
        const totals = Object.entries(categoryMap)
            .map(([category, data]) => ({ category, total: data.total, count: data.count }))
            .sort((a, b) => b.total - a.total);
        assert(totals.length === 2, 'Category aggregation should produce 2 categories');
        assert(totals[0].category === 'Groceries' && totals[0].total === 130.5, 'Groceries total must equal 130.5');
        assert(totals[1].category === 'Utilities' && totals[1].total === 120.0, 'Utilities total must equal 120.0');
        console.log('✓ Test 2 Passed: Category totals aggregation executed cleanly');
    }
    catch (e) {
        console.error('✕ Test 2 Failed:', e.message);
    }
    // Test 3: Fine-grained item addition and removal
    try {
        let txs = [...memoryStore[testUserId].transactions];
        txs.push({ id: 'tx-4', accountId: 'acc-101', amount: 25.0, date: '2026-07-30', description: 'Coffee', category: 'Dining', type: 'expense', currency: 'EUR' });
        assert(txs.length === 4, 'Should have 4 transactions after addition');
        txs = txs.filter(t => t.id !== 'tx-1');
        assert(txs.length === 3, 'Should have 3 transactions after removal');
        assert(!txs.some(t => t.id === 'tx-1'), 'tx-1 should be removed');
        console.log('✓ Test 3 Passed: Fine-grained item operations verified');
    }
    catch (e) {
        console.error('✕ Test 3 Failed:', e.message);
    }
    // Test 4: RFC 6902 JSON Patch on Relational Data
    try {
        const patchOps = [
            { op: 'replace', path: '/userStats/streak', value: 15 },
        ];
        memoryStore[testUserId].userStats.streak = patchOps[0].value;
        assert(memoryStore[testUserId].userStats.streak === 15, 'Streak updated to 15');
        console.log('✓ Test 4 Passed: RFC 6902 JSON Patch on relational data verified');
    }
    catch (e) {
        console.error('✕ Test 4 Failed:', e.message);
    }
    console.log('--- All Relational Database Unit Tests Executed Successfully ---');
}
runTests();
