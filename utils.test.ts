import { formatCurrency, convertToEur, parseLocalDate, toLocalISOString, escapeHtml, sanitizeInput, safeAdd, safeSubtract, safeMultiply, safeDivide, safeRound, toCents, fromCents, formatDate } from './utils';
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

// Test 6: escapeHtml & sanitizeInput
try {
  const maliciousInput = '<script>alert("xss")</script>&"\'';
  const escaped = escapeHtml(maliciousInput);
  assert(!escaped.includes('<script>'), 'escapeHtml removes unescaped opening tag');
  assert(escaped.includes('&lt;script&gt;'), 'escapeHtml escapes script tag');
  assert(escaped.includes('&amp;'), 'escapeHtml escapes ampersand');
  assert(escaped.includes('&quot;'), 'escapeHtml escapes double quote');
  assert(escaped.includes('&#039;'), 'escapeHtml escapes single quote');

  const sanitized = sanitizeInput('  <img src=x onerror=alert(1)>  ');
  assert(sanitized.includes('&lt;img'), 'sanitizeInput trims and escapes raw html input');

  console.log('✓ Test 6 Passed: escapeHtml & sanitizeInput');
} catch (e: any) {
  console.error('✕ Test 6 Failed:', e.message);
}

// Test 7: Floating-Point Math & Arbitrary Precision Safety
try {
  // Check IEEE 754 precision problem resolution (0.1 + 0.2 === 0.3)
  const addRes = safeAdd(0.1, 0.2);
  assert(addRes === 0.3, `safeAdd(0.1, 0.2) must equal 0.3, got ${addRes}`);

  const subRes = safeSubtract(1.0, 0.9);
  assert(subRes === 0.1, `safeSubtract(1.0, 0.9) must equal 0.1, got ${subRes}`);

  const multRes = safeMultiply(19.99, 100);
  assert(multRes === 1999, `safeMultiply(19.99, 100) must equal 1999, got ${multRes}`);

  const divRes = safeDivide(10, 3);
  assert(divRes === 3.33333333, `safeDivide(10, 3) must equal 3.33333333, got ${divRes}`);

  // Minor unit cents conversions
  const cents = toCents(19.99);
  assert(cents === 1999, `toCents(19.99) must equal 1999, got ${cents}`);

  const amount = fromCents(1999);
  assert(amount === 19.99, `fromCents(1999) must equal 19.99, got ${amount}`);

  const roundHalfUp = safeRound(2.675, 2);
  assert(roundHalfUp === 2.68, `safeRound(2.675, 2) must round to 2.68, got ${roundHalfUp}`);

  console.log('✓ Test 7 Passed: Floating-Point Math & Arbitrary Precision Safety');
} catch (e: any) {
  console.error('✕ Test 7 Failed:', e.message);
}

// Test 8: formatDate with various user preferences
try {
  const testIso = '2026-07-29';
  
  const dmy = formatDate(testIso, 'DD/MM/YYYY');
  assert(dmy === '29/07/2026', `DD/MM/YYYY formatting: expected 29/07/2026, got ${dmy}`);

  const mdy = formatDate(testIso, 'MM/DD/YYYY');
  assert(mdy === '07/29/2026', `MM/DD/YYYY formatting: expected 07/29/2026, got ${mdy}`);

  const ymd = formatDate(testIso, 'YYYY-MM-DD');
  assert(ymd === '2026-07-29', `YYYY-MM-DD formatting: expected 2026-07-29, got ${ymd}`);

  const dotDmy = formatDate(testIso, 'DD.MM.YYYY');
  assert(dotDmy === '29.07.2026', `DD.MM.YYYY formatting: expected 29.07.2026, got ${dotDmy}`);

  const styled = formatDate(testIso, { format: 'DD/MM/YYYY', style: 'short' });
  assert(styled.includes('Jul') && styled.includes('29'), `Short style format check: got ${styled}`);

  console.log('✓ Test 8 Passed: formatDate with user preference formats');
} catch (e: any) {
  console.error('✕ Test 8 Failed:', e.message);
}

console.log('--- All Unit Tests Executed Successfully ---');
