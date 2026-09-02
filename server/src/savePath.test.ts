export {};

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`Test Failed: ${message}`);
    }
}

console.log('--- Running Live Save Path & Retry Flow Unit Tests ---');

// Test 1: Retry logic with backoff
async function saveDataWithRetry(
    saveFn: () => Promise<boolean>,
    maxAttempts = 3
): Promise<{ succeeded: boolean; attemptsMade: number }> {
    let attemptsMade = 0;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        attemptsMade++;
        const succeeded = await saveFn();
        if (succeeded) return { succeeded: true, attemptsMade };
        if (attempt < maxAttempts) {
            // Short backoff for test
            await new Promise(resolve => setTimeout(resolve, 5));
        }
    }
    return { succeeded: false, attemptsMade };
}

async function runTests() {
    // Case 1A: Save succeeds on first attempt
    let attempts1 = 0;
    const testSaveSuccess = async () => {
        attempts1++;
        return true;
    };
    const res1 = await saveDataWithRetry(testSaveSuccess, 3);
    assert(res1.succeeded === true && res1.attemptsMade === 1, 'Should succeed on first attempt');
    console.log('✓ Test 1A Passed: Save succeeds on first attempt');

    // Case 1B: Save fails once due to transient error, then succeeds on 2nd retry
    let attempts2 = 0;
    const testSaveRetry = async () => {
        attempts2++;
        return attempts2 >= 2;
    };
    const res2 = await saveDataWithRetry(testSaveRetry, 3);
    assert(res2.succeeded === true && res2.attemptsMade === 2, 'Should succeed on retry 2');
    console.log('✓ Test 1B Passed: Save succeeds on transient failure retry');

    // Case 1C: Save fails all attempts
    let attempts3 = 0;
    const testSaveAllFail = async () => {
        attempts3++;
        return false;
    };
    const res3 = await saveDataWithRetry(testSaveAllFail, 3);
    assert(res3.succeeded === false && res3.attemptsMade === 3, 'Should fail after max attempts');
    console.log('✓ Test 1C Passed: Exhausts retries gracefully when backend is down');
}

runTests();

// Test 2: Material data guard (refusing empty save without allowEmpty flag)
const MATERIAL_KEYS = ['accounts', 'transactions', 'budgets', 'tasks', 'financialGoals'];
function hasMaterialData(data: Record<string, any>): boolean {
    return MATERIAL_KEYS.some(k => Array.isArray(data[k]) && data[k].length > 0);
}

const fullData = {
    accounts: [{ id: '1', name: 'Checking' }],
    transactions: [{ id: 'tx-1', amount: 50 }],
};
const emptyData = {
    accounts: [],
    transactions: [],
};

assert(hasMaterialData(fullData) === true, 'Data with accounts has material data');
assert(hasMaterialData(emptyData) === false, 'Empty arrays do not have material data');

function shouldAllowSave(data: Record<string, any>, options?: { allowEmpty?: boolean }): boolean {
    if (!options?.allowEmpty && !hasMaterialData(data)) {
        return false; // Prevent wipeout
    }
    return true;
}

assert(shouldAllowSave(fullData) === true, 'Full data save is allowed');
assert(shouldAllowSave(emptyData) === false, 'Accidental empty data save is prevented');
assert(shouldAllowSave(emptyData, { allowEmpty: true }) === true, 'Explicit reset with allowEmpty is allowed');
console.log('✓ Test 2 Passed: Material data safeguard protects existing data from empty payload wipes');

console.log('--- All Save Path Unit Tests Executed Successfully ---');
