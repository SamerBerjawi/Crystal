import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Task } from '../../types';
import { dueLabel, placeTask, sortTasks, statusAfterTick, taskStats } from '../../utils/tasksModel';

const today = new Date(2026, 9, 15);
const task = (over: Partial<Task>): Task => ({ id: 't', title: 'Task', status: 'To Do', priority: 'Medium', ...over });

test('stats count open, finished, urgent and late tasks', () => {
  const stats = taskStats([
    task({ id: 'a', priority: 'High', dueDate: '2026-10-17' }),
    task({ id: 'b', dueDate: '2026-10-01' }),
    task({ id: 'c', status: 'Done', priority: 'High', dueDate: '2026-10-16' }),
    task({ id: 'd', status: 'In Progress' }),
  ], today);
  assert.deepEqual(stats, { total: 4, open: 3, completed: 1, rate: 25, pendingHigh: 1, dueSoon: 1, overdue: 1 });
  assert.equal(taskStats([], today).rate, 0);
});

test('sorting follows priority, date or your own order', () => {
  const tasks = [task({ id: 'low', priority: 'Low', dueDate: '2026-10-20' }), task({ id: 'high', priority: 'High' }), task({ id: 'mid', dueDate: '2026-10-16' })];
  const ids = (list: Task[]) => list.map(item => item.id);
  assert.deepEqual(ids(sortTasks(tasks, 'priority', [])), ['high', 'mid', 'low']);
  assert.deepEqual(ids(sortTasks(tasks, 'due', [])), ['mid', 'low', 'high']);
  assert.deepEqual(ids(sortTasks(tasks, 'manual', ['mid', 'low'])), ['mid', 'low', 'high']);
});

test('a task lands where you drop it, in either direction', () => {
  assert.deepEqual(placeTask(['a', 'b', 'c'], 'a', 'c'), ['b', 'c', 'a']);
  assert.deepEqual(placeTask(['a', 'b', 'c'], 'c', 'a'), ['c', 'a', 'b']);
  assert.deepEqual(placeTask(['a', 'b'], 'x', 'a'), ['a', 'b']);
});

test('ticking finishes a task, and unticking reopens it', () => {
  assert.equal(statusAfterTick(task({})), 'Done');
  assert.equal(statusAfterTick(task({ status: 'In Progress' })), 'Done');
  assert.equal(statusAfterTick(task({ status: 'Done' })), 'To Do');
});

test('due dates read in plain words', () => {
  assert.deepEqual(dueLabel('2026-10-13', today), { text: '2 days overdue', isLate: true, isSoon: false });
  assert.equal(dueLabel('2026-10-14', today).text, '1 day overdue');
  assert.equal(dueLabel('2026-10-15', today).text, 'Today');
  assert.equal(dueLabel('2026-10-16', today).text, 'Tomorrow');
  assert.equal(dueLabel('2026-10-20', today).text, 'In 5 days');
});
