import { test } from 'node:test';
import assert from 'node:assert/strict';
import { looksLikeAmount } from '../../utils/privacyMask';

test('recognises amounts with symbols and ISO codes on either side', () => {
    for (const t of ['€1,234.50', '-€12.00', '$ 9', '£3.20', '1.234,56 €', '120 CHF', 'CHF 120', '¥5000', '−€4', '0.5 BTC']) {
        assert.equal(looksLikeAmount(t), true, t);
    }
});
test('ignores ordinary text, dates and long prose', () => {
    for (const t of ['Dashboard', '2026-10-13', 'Updated 3 items', 'Save changes', 'x'.repeat(80) + ' €5']) {
        assert.equal(looksLikeAmount(t), false, t);
    }
});
