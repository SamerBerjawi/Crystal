import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCone, makeShocks, monthOffset, normalizeFireSettings, type ConeInput } from '../../utils/fireCone';

const TODAY = new Date(2026, 10, 12);
const base: ConeInput = { start: 1_000_000, monthlySaving: 0, annualSpending: 40_000, expectedReturn: 0, volatility: 0, planYears: 20, today: TODAY, maxWaitYears: 5, paths: 200 };

test('with no ups and downs the answer is arithmetic: 1M at 40k a year lasts 25 years', () => {
  assert.equal(buildCone({ ...base, planYears: 20 }).curve[0].odds, 1);
  assert.equal(buildCone({ ...base, planYears: 30 }).curve[0].odds, 0);
});

test('saving for longer turns a failing plan into a working one', () => {
  const cone = buildCone({ ...base, planYears: 30, monthlySaving: 2000, maxWaitYears: 12 });
  assert.equal(cone.curve[0].odds, 0);
  assert.ok(cone.earliest !== null && cone.earliest > 0);
  assert.equal(cone.curve[cone.earliest!].odds, 1);
});

test('the same inputs give the same picture', () => {
  const input = { ...base, expectedReturn: 0.05, volatility: 0.15, monthlySaving: 1000 };
  assert.deepEqual(buildCone(input), buildCone(input));
});

test('more volatility lowers the odds at the same average return', () => {
  const common = { ...base, expectedReturn: 0.05, planYears: 30, start: 1_100_000, paths: 600 };
  const calm = buildCone({ ...common, volatility: 0.05 }).curve[0].odds;
  const wild = buildCone({ ...common, volatility: 0.25 }).curve[0].odds;
  assert.ok(calm > wild, `${calm} vs ${wild}`);
});

test('the odds curve rises as the stopping year moves out', () => {
  const { curve } = buildCone({ ...base, expectedReturn: 0.05, volatility: 0.15, start: 600_000, monthlySaving: 2000, planYears: 30, maxWaitYears: 15, paths: 800 });
  curve.slice(1).forEach((point, i) => assert.ok(point.odds >= curve[i].odds - 0.03, `year ${point.years}`));
  assert.ok(curve[15].odds > curve[0].odds);
});

test('a planned one-off cost changes the outcome', () => {
  assert.equal(buildCone({ ...base }).curve[0].odds, 1);
  const hit = buildCone({ ...base, events: [{ label: 'House', date: '2027-03-01', amount: -500_000 }] });
  assert.equal(hit.curve[0].odds, 0);
  const past = buildCone({ ...base, events: [{ label: 'Old', date: '2020-03-01', amount: -500_000 }] });
  assert.equal(past.curve[0].odds, 1);
});

test("the fan is ordered and starts at today's value", () => {
  const cone = buildCone({ ...base, expectedReturn: 0.05, volatility: 0.15, monthlySaving: 500, retireInYears: 3 });
  assert.equal(cone.chosen.years, 3);
  cone.chosen.fan.forEach(p => { assert.ok(p.p10 <= p.p25 && p.p25 <= p.p50 && p.p50 <= p.p75 && p.p75 <= p.p90); });
  assert.equal(cone.chosen.fan[0].p50, 1_000_000);
});

test('growth follows the expected return, less the drag of ups and downs on the median', () => {
  const cone = buildCone({ ...base, expectedReturn: 0.05, volatility: 0.15, annualSpending: 0, planYears: 10, retireInYears: 0, paths: 4000, maxWaitYears: 0 });
  const median = cone.chosen.fan[10].p50;
  const expected = 1_000_000 * Math.exp(10 * (Math.log(1.05) - 0.15 ** 2 / 2));
  assert.ok(Math.abs(median / expected - 1) < 0.06, `${median} vs ${expected}`);
});

test('helpers', () => {
  assert.equal(monthOffset(TODAY, '2026-11-30'), 0);
  assert.equal(monthOffset(TODAY, '2027-01-01'), 2);
  assert.equal(makeShocks(10, 10, 1).length, 100);
});

test('settings are held to a sensible range and bad events are dropped', () => {
  const s = normalizeFireSettings({
    stopIn: 99, spending: -5, expectedReturn: 3, volatility: 'x', planYears: 1,
    events: [{ label: 'ok', date: '2030-05-01', amount: -1000 }, { label: 'no date', date: 'soon', amount: 5 }, { label: 'zero', date: '2030-05-01', amount: 0 }, null],
  });
  assert.equal(s.stopIn, 35);
  assert.equal(s.spending, 0);
  assert.equal(s.expectedReturn, 0.15);
  assert.equal(s.volatility, undefined);
  assert.equal(s.planYears, 5);
  assert.deepEqual(s.events?.map(e => e.label), ['ok']);
  assert.deepEqual(normalizeFireSettings(undefined).events, []);
});
