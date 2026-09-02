export {};

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`Test Failed: ${message}`);
    }
}

console.log('--- Running Partial Slice Data Merging Tests ---');

// Mock user current DB data
const currentData: Record<string, any> = {
    accounts: [{ id: 'acc-1', name: 'Checking', balance: 1000 }],
    transactions: [{ id: 'tx-1', amount: 50, description: 'Groceries' }],
    budgets: [{ id: 'b-1', category: 'Food', amount: 300 }],
    lastUpdatedAt: '2026-09-02T10:00:00.000Z',
};

// Test 1: Partial payload modifying ONLY budgets preserves accounts and transactions
const partialPayload: Record<string, any> = {
    budgets: [{ id: 'b-1', category: 'Food', amount: 350 }, { id: 'b-2', category: 'Rent', amount: 1200 }],
};
const nextUpdatedAt = '2026-09-02T10:05:00.000Z';
const mergedData: Record<string, any> = { ...currentData, ...partialPayload, lastUpdatedAt: nextUpdatedAt };

assert(mergedData.accounts.length === 1, 'Accounts must remain untouched');
assert(mergedData.transactions.length === 1, 'Transactions must remain untouched');
assert(mergedData.budgets.length === 2, 'Budgets slice must be updated');
assert(mergedData.budgets[0].amount === 350, 'Updated budget value must reflect in merged data');
assert(mergedData.lastUpdatedAt === nextUpdatedAt, 'lastUpdatedAt must be updated');
console.log('✓ Test 1 Passed: Partial slice merge preserves untouched slices and updates target slice');

// Test 2: Slice extraction from dirtySlices set
const dirtySlices = new Set(['budgets', 'preferences']);
const fullData: Record<string, any> = {
    accounts: [{ id: 'acc-1' }],
    transactions: [{ id: 'tx-1' }],
    budgets: [{ id: 'b-1' }],
    preferences: { currency: 'EUR' },
};

const extractedPayload: Record<string, any> = {};
for (const slice of dirtySlices) {
    if (slice in fullData) {
        extractedPayload[slice] = fullData[slice];
    }
}

assert(Object.keys(extractedPayload).length === 2, 'Payload must only contain the 2 dirty keys');
assert('budgets' in extractedPayload && 'preferences' in extractedPayload, 'Payload must have budgets and preferences');
assert(!('accounts' in extractedPayload) && !('transactions' in extractedPayload), 'Payload must NOT have untouched accounts or transactions');
console.log('✓ Test 2 Passed: Dirty slice extraction isolates only modified slices');

console.log('--- All Partial Sync Tests Executed Successfully ---');
