import test from 'node:test';
import assert from 'node:assert/strict';
import { mapWithConcurrency } from '../../utils/concurrency';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test('mapWithConcurrency never exceeds the limit and keeps input order', async () => {
  let active = 0;
  let peak = 0;
  const out = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async n => {
    active += 1; peak = Math.max(peak, active);
    await sleep(5 * (7 - n));
    active -= 1;
    return n * 10;
  });
  assert.deepEqual(out, [10, 20, 30, 40, 50, 60]);
  assert.equal(peak, 2);
});

test('mapWithConcurrency handles empty input and rejects on the first error without starting more work', async () => {
  assert.deepEqual(await mapWithConcurrency([], 3, async () => 1), []);
  const started: number[] = [];
  await assert.rejects(mapWithConcurrency([1, 2, 3, 4, 5], 1, async n => { started.push(n); if (n === 2) throw new Error('boom'); return n; }), /boom/);
  assert.deepEqual(started, [1, 2]);
});
