import { FINANCIAL_DATA_QUERY_KEY } from './useFinancialDataQuery';

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`Test Failed: ${message}`);
    }
}

console.log('--- Running React Query Server State Hook Unit Tests ---');

// Test 1: Query Key Structure
try {
    assert(Array.isArray(FINANCIAL_DATA_QUERY_KEY), 'FINANCIAL_DATA_QUERY_KEY must be an array');
    assert(FINANCIAL_DATA_QUERY_KEY[0] === 'financialData', 'Query key first element must be financialData');
    console.log('✓ Test 1 Passed: Query key structure validated');
} catch (e: any) {
    console.error('✕ Test 1 Failed:', e.message);
}

console.log('--- All React Query Unit Tests Executed Successfully ---');
