"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const schemas_1 = require("./schemas");
function assert(condition, message) {
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
    const res = (0, schemas_1.validateFinancialDataPayload)(validBody);
    assert(res.success === true, 'Valid payload must pass schema validation');
    console.log('✓ Test 1 Passed: Valid payload accepted');
}
catch (e) {
    console.error('✕ Test 1 Failed:', e.message);
}
// Test 2: Corrupted payload with transactions as object ({}) instead of array ([])
try {
    const corruptedBody = {
        accounts: [],
        transactions: { id: 'invalid-object-instead-of-array' }, // INVALID: Object instead of Array
    };
    const res = (0, schemas_1.validateFinancialDataPayload)(corruptedBody);
    assert(res.success === false, 'Corrupted transactions object must fail validation');
    assert(res.error?.includes('transactions') === true, 'Error message must specify transactions field');
    console.log('✓ Test 2 Passed: Corrupted transactions object rejected with 400 validation error');
}
catch (e) {
    console.error('✕ Test 2 Failed:', e.message);
}
// Test 3: Partial payload wrapper validation
try {
    const partialBody = {
        partial: true,
        data: {
            accounts: [{ id: 'acc-2', name: 'Savings', type: 'Savings', balance: 5000, currency: 'USD' }],
        },
    };
    const res = (0, schemas_1.validateFinancialDataPayload)(partialBody);
    assert(res.success === true, 'Partial payload wrapper must pass schema validation');
    console.log('✓ Test 3 Passed: Partial payload wrapper accepted');
}
catch (e) {
    console.error('✕ Test 3 Failed:', e.message);
}
// Test 4: Empty body or null rejected
try {
    const res = (0, schemas_1.validateFinancialDataPayload)(null);
    assert(res.success === false, 'Null body must fail validation');
    console.log('✓ Test 4 Passed: Null payload rejected');
}
catch (e) {
    console.error('✕ Test 4 Failed:', e.message);
}
console.log('--- All Zod Schema Unit Tests Executed Successfully ---');
