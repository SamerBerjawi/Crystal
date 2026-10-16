import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLocalDateStrict } from '../../utils';
import { validateBackup } from '../../utils/validateBackup';

test('parseLocalDateStrict rejects invalid input instead of rolling over or using today', () => {
    for (const v of ['2026-13-45', '2026-02-30', 'abc', '', null, undefined, 123, {}]) {
        assert.equal(parseLocalDateStrict(v), null, String(v));
    }
});
test('parseLocalDateStrict accepts valid dates, including leap days and timestamps', () => {
    const d = parseLocalDateStrict('2028-02-29')!;
    assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate()], [2028, 1, 29]);
    assert.ok(parseLocalDateStrict('2026-10-13T09:00:00.000Z'));
    assert.equal(parseLocalDateStrict('2027-02-29'), null);
});
test('validateBackup accepts a well-formed backup', () => {
    assert.deepEqual(validateBackup({
        accounts: [{ id: 'a', name: 'x' }],
        transactions: [{ id: 't', accountId: 'a', date: '2026-10-01' }],
        userStats: {},
    }), []);
});
test('validateBackup reports wrong containers, bad dates and missing ids', () => {
    const problems = validateBackup({
        accounts: { id: 'a' },
        transactions: [{ id: 't1', date: '2026-13-45' }, { date: '2026-01-01' }, 'junk'],
        userStats: [],
    });
    assert.ok(problems.some(p => /"accounts" must be a list/.test(p)));
    assert.ok(problems.some(p => /transactions\[0\].*invalid date/.test(p)));
    assert.ok(problems.some(p => /transactions\[1\] has no id/.test(p)));
    assert.ok(problems.some(p => /transactions\[2\] is not a record/.test(p)));
    assert.ok(problems.some(p => /"userStats" must be an object/.test(p)));
});
test('validateBackup rejects non-objects', () => {
    assert.equal(validateBackup([]).length, 1);
    assert.equal(validateBackup(null).length, 1);
});
