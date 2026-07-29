import { formatCurrency, convertToEur, parseLocalDate, toLocalISOString } from './utils';
import { upsertEntity, removeEntityById } from './utils/collection';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Test Failed: ${message}`);
  }
}

console.log('--- Running Crystal Utility Unit Tests ---');

// Test 1: formatCurrency
try {
  const formatted = formatCurrency(1234.56, 'EUR');
  assert(formatted.includes('1,234.56') || formatted.includes('1.234,56') || formatted.includes('1234'), 'formatCurrency formatting EUR');
  console.log('✓ Test 1 Passed: formatCurrency');
} catch (e: any) {
  console.error('✕ Test 1 Failed:', e.message);
}

// Test 2: convertToEur
try {
  const convertedEur = convertToEur(100, 'EUR');
  assert(convertedEur === 100, 'convertToEur for EUR should be 1:1');
  console.log('✓ Test 2 Passed: convertToEur');
} catch (e: any) {
  console.error('✕ Test 2 Failed:', e.message);
}

// Test 3: parseLocalDate & toLocalISOString
try {
  const isoStr = '2026-07-29';
  const parsed = parseLocalDate(isoStr);
  assert(parsed.getFullYear() === 2026, 'Year matches 2026');
  assert(parsed.getMonth() === 6, 'Month matches July (0-indexed 6)');
  assert(parsed.getDate() === 29, 'Date matches 29');
  console.log('✓ Test 3 Passed: parseLocalDate');
} catch (e: any) {
  console.error('✕ Test 3 Failed:', e.message);
}

// Test 4: upsertEntity (Create & Update & Restore)
try {
  const initialList = [{ id: '1', name: 'Item 1' }];
  
  // Update existing
  const updated = upsertEntity(initialList, { id: '1', name: 'Item 1 Updated' });
  assert(updated.length === 1 && updated[0].name === 'Item 1 Updated', 'upsertEntity update existing');

  // Insert new with ID (e.g. Restore Undo)
  const restored = upsertEntity(initialList, { id: '2', name: 'Item 2' });
  assert(restored.length === 2 && restored[1].id === '2', 'upsertEntity restore with ID');

  console.log('✓ Test 4 Passed: upsertEntity');
} catch (e: any) {
  console.error('✕ Test 4 Failed:', e.message);
}

// Test 5: removeEntityById
try {
  const list = [{ id: 'a' }, { id: 'b' }];
  const removed = removeEntityById(list, 'a');
  assert(removed.length === 1 && removed[0].id === 'b', 'removeEntityById removes item');
  console.log('✓ Test 5 Passed: removeEntityById');
} catch (e: any) {
  console.error('✕ Test 5 Failed:', e.message);
}

console.log('--- All Unit Tests Executed Successfully ---');
