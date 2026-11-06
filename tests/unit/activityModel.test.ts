import test from 'node:test';
import assert from 'node:assert/strict';
import {
  byCategory, heatColumns, heatLevelOf, heatStart, heatStats, spendByDay, byWeekday, changePercent, dayLabel, filterRows, flowPeriods, groupByDay, inRange, monthPeriods, previousRange, rangeStart, summarize, type ActivityRow,
} from '../../utils/activityModel';

const TODAY = new Date(2026, 10, 6); // Fri 6 Nov 2026
const row = (id: string, date: string, amount: number, category = 'Food', text = ''): ActivityRow => ({ id, date, amount, category, text: (text || `${category} ${id}`).toLowerCase(), item: id });

const rows = [
  row('a', '2026-11-06', -20, 'Food'),
  row('b', '2026-11-05', 1000, 'Salary'),
  row('c', '2026-10-20', -60, 'Rent'),
  row('d', '2026-09-01', -40, 'Food'),
  row('e', '2026-06-01', -10, 'Fun'),
  row('f', '2026-11-07', -99, 'Food'), // after today: never counted
];

test('a range ends today and starts the right number of days back', () => {
  assert.equal(rangeStart('30d', TODAY), '2026-10-08');
  assert.equal(rangeStart('all', TODAY), undefined);
  assert.deepEqual(inRange(rows, '30d', TODAY).map(r => r.id), ['a', 'b', 'c']);
  assert.deepEqual(inRange(rows, 'all', TODAY).map(r => r.id), ['a', 'b', 'c', 'd', 'e']);
});

test('the previous range is the same length straight before, and absent for all time', () => {
  assert.deepEqual(previousRange(rows, '30d', TODAY)!.map(r => r.id), []);
  assert.deepEqual(previousRange(rows, '90d', TODAY)!.map(r => r.id), ['e']);
  assert.deepEqual(previousRange(rows, '1y', TODAY)!.map(r => r.id), []);
  assert.equal(previousRange(rows, 'all', TODAY), undefined);
  assert.deepEqual(previousRange([row('x', '2026-09-20', -5)], '30d', TODAY)!.map(r => r.id), ['x']);
});

test('a summary adds money in and out and finds the largest of each', () => {
  const summary = summarize(rows.slice(0, 4));
  assert.equal(summary.in, 1000);
  assert.equal(summary.out, 120);
  assert.equal(summary.net, 880);
  assert.equal(summary.count, 4);
  assert.equal(summary.largestOut?.id, 'c');
  assert.equal(summary.largestIn?.id, 'b');
  assert.equal(summarize([]).largestOut, undefined);
});

test('change is a percentage, and absent when there was nothing before', () => {
  assert.equal(changePercent(150, 100), 50);
  assert.equal(changePercent(50, 100), -50);
  assert.equal(changePercent(10, 0), undefined);
});

test('filters combine: direction, category and a search that ignores case', () => {
  assert.deepEqual(filterRows(rows, { kind: 'in', query: '', category: undefined }).map(r => r.id), ['b']);
  assert.deepEqual(filterRows(rows, { kind: 'out', query: '', category: 'Food' }).map(r => r.id), ['a', 'd', 'f']);
  assert.deepEqual(filterRows(rows, { kind: 'all', query: '  SALARY ', category: undefined }).map(r => r.id), ['b']);
  assert.equal(filterRows(rows, { kind: 'all', query: '', category: 'Nope' }).length, 0);
});

const asFlows = (list: ActivityRow[]) => list.map(r => ({ date: r.date, amount: r.amount, category: r.category, source: r.id }));

test('periods are the last twelve weeks or months or eight quarters, oldest first, ending with today\'s', () => {
  assert.equal(flowPeriods(asFlows(rows), 'weeks', undefined, TODAY).length, 12);
  assert.equal(flowPeriods(asFlows(rows), 'quarters', undefined, TODAY).length, 8);
  const months = flowPeriods(asFlows(rows), 'months', undefined, TODAY);
  assert.equal(months.length, 12);
  assert.equal(months[11].id, '2026-11-01');
  assert.equal(months[11].isOpen, true);
  assert.equal(months[10].isOpen, false);
  assert.equal(months[11].long, new Date(2026, 10, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }));
});

test('each period adds what came in and went out, ignoring days after today', () => {
  const flows = rows.map(r => ({ date: r.date, amount: r.amount, category: r.category, source: r.id }));
  const months = flowPeriods(flows, 'months', undefined, TODAY);
  assert.equal(months[11].inValue, 1000);
  assert.equal(months[11].outValue, 20);
  assert.equal(months[10].outValue, 60);
  assert.equal(months[9].outValue, 40);
  const weeks = flowPeriods(flows, 'weeks', undefined, TODAY);
  assert.equal(weeks[11].id, '2026-11-02');
  assert.equal(weeks[11].inValue, 1000);
});

test('a period knows its top categories and its biggest source', () => {
  const flows = [
    { date: '2026-11-02', amount: -30, category: 'Food', source: 'A' },
    { date: '2026-11-03', amount: -10, category: 'Fun', source: 'B' },
    { date: '2026-11-04', amount: 900, category: 'Salary', source: 'Acme' },
    { date: '2026-11-05', amount: 100, category: 'Gift', source: 'Gran' },
  ];
  const now = flowPeriods(flows, 'months', undefined, TODAY)[11];
  assert.deepEqual(now.categories.map(c => c.name), ['Food', 'Fun']);
  assert.equal(now.categories[0].share, 0.75);
  assert.deepEqual(now.topSource, { name: 'Acme', value: 900 });
});

test('the balance at the end of each period works back from today', () => {
  const flows = [{ date: '2026-10-15', amount: -100, category: '', source: '' }, { date: '2026-11-03', amount: 500, category: '', source: '' }, { date: '2026-11-04', amount: -50, category: '', source: '' }];
  const months = flowPeriods(flows, 'months', 1000, TODAY);
  assert.equal(months[11].balance, 1000);
  assert.equal(months[10].balance, 1000 - 450);
  assert.equal(months[9].balance, 1000 - 450 + 100);
  assert.equal(flowPeriods(flows, 'months', undefined, TODAY)[11].balance, undefined);
});

test('monthly totals a page already has become periods', () => {
  const periods = monthPeriods([{ month: '2026-10', in: 5, out: 2 }, { month: '2026-11', in: 7, out: 0 }], TODAY);
  assert.deepEqual(periods.map(p => [p.id, p.inValue, p.outValue, p.isOpen]), [['2026-10', 5, 2, false], ['2026-11', 7, 0, true]]);
  assert.match(periods[0].long, /2026/);
});

test('categories are split largest first, folding the tail into Other', () => {
  assert.deepEqual(byCategory(rows.slice(0, 5), 'out').map(x => x.value), [60, 60, 10]);
  assert.deepEqual(byCategory(rows.slice(0, 5), 'out').map(x => x.label).sort(), ['Food', 'Fun', 'Rent']);
  assert.deepEqual(byCategory(rows.slice(0, 5), 'in'), [{ label: 'Salary', value: 1000 }]);
  const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((name, i) => row(name, '2026-11-01', -(10 + i), name));
  const folded = byCategory(many, 'out', 3);
  assert.equal(folded.length, 3);
  assert.equal(folded[2].label, 'Other');
  assert.equal(folded.reduce((s, x) => s + x.value, 0), 10 + 11 + 12 + 13 + 14 + 15 + 16);
  assert.equal(byCategory([row('u', '2026-11-01', -5, '')], 'out')[0].label, 'Uncategorised');
});

test('weekdays start on Monday and only count money out', () => {
  const days = byWeekday([row('fri', '2026-11-06', -20), row('fri2', '2026-10-30', -5), row('mon', '2026-11-02', -7), row('in', '2026-11-03', 500)]);
  assert.deepEqual(days.map(d => d.name), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  assert.equal(days[4].out, 25);
  assert.equal(days[4].count, 2);
  assert.equal(days[0].out, 7);
  assert.equal(days[1].out, 0);
});

test('days are labelled Today, Yesterday, then by date', () => {
  assert.equal(dayLabel('2026-11-06', TODAY), 'Today');
  assert.equal(dayLabel('2026-11-05', TODAY), 'Yesterday');
  assert.match(dayLabel('2026-10-20', TODAY), /20/);
  assert.doesNotMatch(dayLabel('2026-10-20', TODAY), /2026/);
  assert.match(dayLabel('2025-10-20', TODAY), /2025/);
});

test('rows group by day, newest first, each day with its net', () => {
  const groups = groupByDay([row('1', '2026-11-05', 100), row('2', '2026-11-06', -30), row('3', '2026-11-06', -20)], TODAY);
  assert.deepEqual(groups.map(g => g.date), ['2026-11-06', '2026-11-05']);
  assert.equal(groups[0].net, -50);
  assert.equal(groups[0].rows.length, 2);
  assert.equal(groups[0].label, 'Today');
});

const fromTx = (id: string, date: string, amount: number, transferId?: string): ActivityRow<{ transferId?: string }> => ({ id, date, amount, category: '', text: id, item: { transferId } });

test('spend by day adds what went out and leaves transfers out of it', () => {
  const days = spendByDay([fromTx('a', '2026-11-05', -20), fromTx('b', '2026-11-05', -5), fromTx('c', '2026-11-05', -500, 'x'), fromTx('d', '2026-11-05', 100), fromTx('e', '2026-11-04', 10)]);
  assert.deepEqual(days.get('2026-11-05'), { out: 25, count: 4 });
  assert.deepEqual(days.get('2026-11-04'), { out: 0, count: 1 });
});

test('the calendar starts where the range does, and all time starts at the first transaction within three years', () => {
  assert.equal(heatStart('30d', undefined, TODAY).getTime(), new Date(2026, 9, 8).getTime());
  assert.equal(heatStart('1y', undefined, TODAY).getTime(), new Date(2025, 10, 7).getTime());
  assert.equal(heatStart('all', '2026-03-01', TODAY).getTime(), new Date(2026, 2, 1).getTime());
  assert.ok(heatStart('all', '2001-01-01', TODAY).getFullYear() >= 2023);
  assert.equal(heatStart('all', undefined, TODAY).getTime(), TODAY.getTime());
});

test('a day is level 0 with no spend, and levels 1 to 4 by how busy it is among the days shown', () => {
  const level = heatLevelOf([0, 10, 20, 30, 40, 50, 60, 70, 80]);
  assert.equal(level(0), 0);
  assert.equal(level(10), 1);
  assert.equal(level(80), 4);
  assert.ok(level(40) >= 2 && level(40) <= 3);
  assert.equal(heatLevelOf([0, 40])(40), 4);
});

test('calendar columns are whole weeks from Sunday, the days outside the range are empty', () => {
  const spend = new Map([['2026-11-05', { out: 50, count: 1 }], ['2026-10-30', { out: 10, count: 1 }]]);
  const { columns } = heatColumns(spend, new Date(2026, 9, 28), TODAY); // Wed 28 Oct to Fri 6 Nov
  assert.equal(columns.length, 2);
  assert.ok(columns.every(column => column.bins.length === 7 && column.bins[0].date.getDay() === 0));
  assert.equal(columns[0].bins[0].date.getDate(), 25); // Sunday before the start
  assert.equal(columns[0].bins[0].count, 0); // before the range
  assert.equal(columns[1].bins[4].date.getDate(), 5);
  assert.equal(columns[1].bins[4].count, 4); // the busiest day
  assert.equal(columns[0].bins[5].count, 1); // 30 Oct, the lightest
});

test('stats count quiet days, the longest streak, the average and the busiest day', () => {
  const spend = new Map([['2026-11-02', { out: 30, count: 1 }], ['2026-11-04', { out: 90, count: 1 }]]);
  const stats = heatStats(spend, new Date(2026, 10, 1), new Date(2026, 10, 6));
  assert.equal(stats.days, 6);
  assert.equal(stats.quiet, 4);
  assert.equal(stats.longestStreak, 2);
  assert.equal(stats.average, 20);
  assert.deepEqual(stats.busiest, { date: '2026-11-04', value: 90 });
  assert.equal(heatStats(new Map(), new Date(2026, 10, 1), new Date(2026, 10, 2)).busiest, null);
});
