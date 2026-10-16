import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount } from '../../utils/parseAmount';

const cases: [string, number][] = [
    ['-12,50', -12.5], ['1.234,56', 1234.56], ['1,234.56', 1234.56], ['-45.10', -45.1], ['1234.56', 1234.56],
    ['1 234,56', 1234.56], ["1'234.56", 1234.56], ['(45.10)', -45.1], ['€ 12,50', 12.5], ['12.50-', -12.5],
    ['1.234', 1234], ['1,234', 1234], ['0,125', 0.125], ['12', 12], ['1.234.567,89', 1234567.89], ['−3,5', -3.5],
];
for (const [input, expected] of cases) {
    test(`parseAmount(${JSON.stringify(input)}) = ${expected}`, () => assert.equal(parseAmount(input), expected));
}
test('non-numbers are NaN', () => {
    for (const v of ['', 'abc', '-', undefined, null]) assert.ok(Number.isNaN(parseAmount(v)), String(v));
});
