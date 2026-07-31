"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const patch_1 = require("./patch");
const schemas_1 = require("./schemas");
function assert(condition, message) {
    if (!condition) {
        throw new Error(`Test Failed: ${message}`);
    }
}
console.log('--- Running RFC 6902 JSON Patch Unit Tests ---');
// Test 1: parseJsonPointer
try {
    const tokens = (0, patch_1.parseJsonPointer)('/transactions/0/amount');
    assert(tokens.length === 3 && tokens[0] === 'transactions' && tokens[1] === '0' && tokens[2] === 'amount', 'Pointer parsing failed');
    assert((0, patch_1.parseJsonPointer)('/foo~1bar/baz~0qux')[0] === 'foo/bar', 'Escaped pointer parsing failed for ~1');
    assert((0, patch_1.parseJsonPointer)('/foo~1bar/baz~0qux')[1] === 'baz~qux', 'Escaped pointer parsing failed for ~0');
    console.log('✓ Test 1 Passed: parseJsonPointer works correctly');
}
catch (e) {
    console.error('✕ Test 1 Failed:', e.message);
}
// Test 2: JSON Patch - add operation
try {
    const doc = { accounts: [{ id: 'acc-1', name: 'Checking' }] };
    const patch = [{ op: 'add', path: '/accounts/-', value: { id: 'acc-2', name: 'Savings' } }];
    const res = (0, patch_1.applyJsonPatch)(doc, patch);
    assert(res.success === true, 'Patch add should succeed');
    assert(res.doc.accounts.length === 2, 'Array length should be 2 after add');
    assert(res.doc.accounts[1].id === 'acc-2', 'Second item ID should be acc-2');
    console.log('✓ Test 2 Passed: JSON Patch "add" operation works correctly');
}
catch (e) {
    console.error('✕ Test 2 Failed:', e.message);
}
// Test 3: JSON Patch - replace & remove operations
try {
    const doc = { userStats: { streak: 5 }, tasks: [{ id: 't1' }, { id: 't2' }] };
    const patch = [
        { op: 'replace', path: '/userStats/streak', value: 10 },
        { op: 'remove', path: '/tasks/0' },
    ];
    const res = (0, patch_1.applyJsonPatch)(doc, patch);
    assert(res.success === true, 'Patch replace/remove should succeed');
    assert(res.doc.userStats.streak === 10, 'Streak should be replaced with 10');
    assert(res.doc.tasks.length === 1 && res.doc.tasks[0].id === 't2', 'Task t1 should be removed');
    console.log('✓ Test 3 Passed: JSON Patch "replace" and "remove" operations work correctly');
}
catch (e) {
    console.error('✕ Test 3 Failed:', e.message);
}
// Test 4: JSON Patch - move & copy operations
try {
    const doc = { a: { title: 'First' }, b: {} };
    const patch = [
        { op: 'copy', from: '/a/title', path: '/b/copiedTitle' },
        { op: 'move', from: '/a/title', path: '/a/movedTitle' },
    ];
    const res = (0, patch_1.applyJsonPatch)(doc, patch);
    assert(res.success === true, 'Patch copy/move should succeed');
    assert(res.doc.b.copiedTitle === 'First', 'Copied title should exist in b');
    assert(res.doc.a.movedTitle === 'First', 'Moved title should exist in a');
    assert(res.doc.a.title === undefined, 'Original title should be undefined after move');
    console.log('✓ Test 4 Passed: JSON Patch "move" and "copy" operations work correctly');
}
catch (e) {
    console.error('✕ Test 4 Failed:', e.message);
}
// Test 5: JSON Patch - test operation
try {
    const doc = { count: 42 };
    const validTestRes = (0, patch_1.applyJsonPatch)(doc, [{ op: 'test', path: '/count', value: 42 }]);
    assert(validTestRes.success === true, 'Test op with matching value should succeed');
    const invalidTestRes = (0, patch_1.applyJsonPatch)(doc, [{ op: 'test', path: '/count', value: 99 }]);
    assert(invalidTestRes.success === false, 'Test op with mismatched value should fail');
    console.log('✓ Test 5 Passed: JSON Patch "test" operation works correctly');
}
catch (e) {
    console.error('✕ Test 5 Failed:', e.message);
}
// Test 6: Fine-grained collection helpers
try {
    let doc = { transactions: [{ id: 'tx-1', amount: 100 }] };
    doc = (0, patch_1.addOrUpdateCollectionItem)(doc, 'transactions', { id: 'tx-1', amount: 150 });
    assert(doc.transactions.length === 1 && doc.transactions[0].amount === 150, 'Collection item should be updated');
    doc = (0, patch_1.addOrUpdateCollectionItem)(doc, 'transactions', { id: 'tx-2', amount: 200 });
    assert(doc.transactions.length === 2 && doc.transactions[1].id === 'tx-2', 'New collection item should be added');
    doc = (0, patch_1.removeCollectionItem)(doc, 'transactions', 'tx-1');
    assert(doc.transactions.length === 1 && doc.transactions[0].id === 'tx-2', 'Item tx-1 should be removed');
    console.log('✓ Test 6 Passed: Fine-grained collection helpers work correctly');
}
catch (e) {
    console.error('✕ Test 6 Failed:', e.message);
}
// Test 7: Schema validation for JSON Patch payloads
try {
    const payload = {
        patch: [{ op: 'replace', path: '/userStats/streak', value: 7 }],
        previousUpdatedAt: '2026-07-30T00:00:00.000Z',
    };
    const validated = (0, schemas_1.validateJsonPatchPayload)(payload);
    assert(validated.success === true, 'Payload should pass schema validation');
    assert(validated.patch?.length === 1, 'Patch operations count should be 1');
    assert(validated.previousUpdatedAt === '2026-07-30T00:00:00.000Z', 'previousUpdatedAt parsed');
    console.log('✓ Test 7 Passed: validateJsonPatchPayload works correctly');
}
catch (e) {
    console.error('✕ Test 7 Failed:', e.message);
}
console.log('--- All JSON Patch Unit Tests Executed Successfully ---');
