import { validateFinancialDataPayload, validateJsonPatchPayload } from './schemas';

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`Test Failed: ${message}`);
    }
}

console.log('--- Running Zod Schema Validation Unit Tests ---');

// Test 1: Valid full payload passes validation
try {
    const validBody = {
        accounts: [{ id: 'acc-1', name: 'Checking', type: 'Checking', balance: 1500, currency: 'EUR' }],
        transactions: [{ id: 'tx-1', accountId: 'acc-1', amount: 50, date: '2026-07-29', description: 'Grocery' }],
        userStats: { streak: 5 },
    };

    const res = validateFinancialDataPayload(validBody);
    assert(res.success === true, 'Valid payload must pass schema validation');
    console.log('✓ Test 1 Passed: Valid payload accepted');
} catch (e: any) {
    process.exitCode = 1; console.error('✕ Test 1 Failed:', e.message);
}

// Test 2: Corrupted payload with transactions as object ({}) instead of array ([])
try {
    const corruptedBody = {
        accounts: [],
        transactions: { id: 'invalid-object-instead-of-array' }, // INVALID: Object instead of Array
    };

    const res = validateFinancialDataPayload(corruptedBody);
    assert(res.success === false, 'Corrupted transactions object must fail validation');
    assert(res.error?.includes('transactions') === true, 'Error message must specify transactions field');
    console.log('✓ Test 2 Passed: Corrupted transactions object rejected with 400 validation error');
} catch (e: any) {
    process.exitCode = 1; console.error('✕ Test 2 Failed:', e.message);
}

// Test 3: Partial payload wrapper validation
try {
    const partialBody = {
        partial: true,
        data: {
            accounts: [{ id: 'acc-2', name: 'Savings', type: 'Savings', balance: 5000, currency: 'USD' }],
        },
    };

    const res = validateFinancialDataPayload(partialBody);
    assert(res.success === true, 'Partial payload wrapper must pass schema validation');
    console.log('✓ Test 3 Passed: Partial payload wrapper accepted');
} catch (e: any) {
    process.exitCode = 1; console.error('✕ Test 3 Failed:', e.message);
}

// Test 4: Empty body or null rejected
try {
    const res = validateFinancialDataPayload(null);
    assert(res.success === false, 'Null body must fail validation');
    console.log('✓ Test 4 Passed: Null payload rejected');
} catch (e: any) {
    process.exitCode = 1; console.error('✕ Test 4 Failed:', e.message);
}

// Test 5: Corrupted preferences string or non-object array elements rejected
try {
    const badPrefs = validateFinancialDataPayload({ partial: true, data: { preferences: 'corrupted' } });
    assert(badPrefs.success === false, 'Non-object preferences must fail validation');
    const badArrayItem = validateFinancialDataPayload({ partial: true, data: { budgets: ['not-an-object'] } });
    assert(badArrayItem.success === false, 'Primitive item in entity array must fail validation');
    console.log('✓ Test 5 Passed: Corrupted preferences and primitive entity items rejected');
} catch (e: any) {
    process.exitCode = 1; console.error('✕ Test 5 Failed:', e.message);
}

// Test 6: Partial delta payload and JSON Patch payload validation
try {
    const validDelta = validateFinancialDataPayload({
        partial: true,
        data: {},
        deltas: {
            transactions: {
                upserts: [{ id: 'tx-99', accountId: 'acc-1', amount: -25, date: '2026-11-09', description: 'Delta tx' }],
                deletedIds: ['tx-old'],
            },
        },
    });
    assert(validDelta.success === true, 'Valid delta payload must pass schema validation');

    const badDeltaTx = validateFinancialDataPayload({
        partial: true,
        data: {},
        deltas: {
            transactions: {
                upserts: [{ id: 'tx-bad', accountId: 'acc-1', amount: -25, date: '2026-13-45', description: 'Bad date' }],
            },
        },
    });
    assert(badDeltaTx.success === false, 'Invalid transaction date inside deltas.transactions.upserts must fail');

    const validPatch = validateJsonPatchPayload({
        patch: [{ op: 'replace', path: '/transactions/tx-1', value: { id: 'tx-1', amount: -30 } }],
        previousUpdatedAt: '2026-11-09T12:00:00Z',
    });
    assert(validPatch.success === true && validPatch.patch?.length === 1, 'Valid JSON Patch payload must pass');
    console.log('✓ Test 6 Passed: Delta payloads and JSON Patch operations validated');
} catch (e: any) {
    process.exitCode = 1; console.error('✕ Test 6 Failed:', e.message);
}

// Test 7: Preferences schema validation, passthrough, and value coercion
try {
    const payloadWithCoercion = {
        accounts: [{ id: 'acc-c1', name: 'Savings', type: 'Savings', balance: '1234.56', currency: 'EUR' }],
        preferences: {
            currency: 'EUR',
            autoLockMinutes: '15',
            onboardingCompleted: true,
            ignoredSubscriptions: ['sub-1', 'sub-2'],
            customField: 'preserved-by-passthrough',
        },
    };

    const res = validateFinancialDataPayload(payloadWithCoercion);
    assert(res.success === true, 'Payload with coercible values must pass validation');
    assert(res.data?.accounts?.[0]?.balance === 1234.56, 'String balance must be coerced to number');
    assert(res.data?.preferences?.autoLockMinutes === 15, 'String autoLockMinutes must be coerced to number');
    assert((res.data?.preferences as any)?.customField === 'preserved-by-passthrough', 'Passthrough fields in preferences must be preserved');

    const invalidPrefs = validateFinancialDataPayload({
        preferences: {
            onboardingCompleted: 'not-a-boolean' as any,
        },
    });
    assert(invalidPrefs.success === false, 'Invalid preferences types must fail validation');
    console.log('✓ Test 7 Passed: Preferences schema validation, passthrough, and type coercion verified');
} catch (e: any) {
    process.exitCode = 1; console.error('✕ Test 7 Failed:', e.message);
}

console.log('--- All Zod Schema Unit Tests Executed Successfully ---');
