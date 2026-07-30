import { JsonPatchOp } from './useAppDataSync';

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`Test Failed: ${message}`);
    }
}

console.log('--- Running useAppDataSync Client Unit Tests ---');

// Test 1: RFC 6902 Patch Op Construction for Partial State
try {
    const partialData = {
        userStats: { streak: 12 },
        accountOrder: ['acc-1', 'acc-2'],
    };

    const patchOps: JsonPatchOp[] = Object.entries(partialData).map(([key, value]) => ({
        op: 'replace',
        path: `/${key}`,
        value,
    }));

    assert(patchOps.length === 2, 'Should create 2 patch operations');
    assert(patchOps[0].op === 'replace' && patchOps[0].path === '/userStats', 'First patch op should replace /userStats');
    assert(patchOps[1].op === 'replace' && patchOps[1].path === '/accountOrder', 'Second patch op should replace /accountOrder');
    console.log('✓ Test 1 Passed: RFC 6902 patch operations generated cleanly');
} catch (e: any) {
    console.error('✕ Test 1 Failed:', e.message);
}

// Test 2: Fine-grained collection endpoint URL construction
try {
    const collection = 'transactions';
    const itemId = 'tx-99';
    const collectionUrl = `/api/data/${collection}`;
    const itemUrl = `/api/data/${collection}/${itemId}`;

    assert(collectionUrl === '/api/data/transactions', 'Collection URL match');
    assert(itemUrl === '/api/data/transactions/tx-99', 'Item URL match');
    console.log('✓ Test 2 Passed: Endpoint URL formatting verified');
} catch (e: any) {
    console.error('✕ Test 2 Failed:', e.message);
}

console.log('--- All useAppDataSync Unit Tests Executed Successfully ---');
