import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_ROUNDS, StreamAccumulator, parseTextToolCall, readChatStream, runAssistantTurn, systemPrompt, unverifiedFigures, visibleText,
  type ChatFn, type ChatMessage, type ChatResult, type ToolCall, type ToolStep,
} from '../../utils/assistantAgent';
import type { AssistantTool } from '../../utils/assistantTools';

const call = (name: string, args: unknown = {}, id = `c_${name}`): ToolCall => ({ id, type: 'function', function: { name, arguments: typeof args === 'string' ? args : JSON.stringify(args) } });

/** A model that plays back the replies it was given, and remembers what it was asked. */
const scripted = (...replies: (Partial<ChatResult> | Error)[]) => {
  const seen: { messages: ChatMessage[]; toolCount: number }[] = [];
  const chat: ChatFn = async (messages, tools) => {
    seen.push({ messages: structuredClone(messages), toolCount: tools.length });
    const next = replies[seen.length - 1] ?? { content: 'done' };
    if (next instanceof Error) throw next;
    return { content: next.content ?? '', toolCalls: next.toolCalls ?? [] };
  };
  return { chat, seen };
};

const spendTool: AssistantTool = {
  name: 'spending', description: 'Total spending', parameters: { type: 'object', properties: {} },
  run: args => (args.category === 'Dining' ? { total: 1234.56, summary: 'Spent €1,234.56 on Dining last month.' } : { error: 'There is no category called "eating out". The categories are: Dining, Groceries.' }),
};
const base = { history: [] as ChatMessage[], system: 'SYSTEM', tools: [spendTool] };

test('a lookup, then an answer built from it', async () => {
  const { chat, seen } = scripted({ toolCalls: [call('spending', { category: 'Dining' })] }, { content: 'You spent €1,234.56 on Dining last month.' });
  const steps: ToolStep[] = [];
  const result = await runAssistantTurn({ ...base, question: 'How much on dining?', chat, onStep: s => steps.push(s) });
  assert.equal(result.answer, 'You spent €1,234.56 on Dining last month.');
  assert.deepEqual(result.unverified, []);
  assert.equal(result.steps.length, 1);
  assert.equal(result.steps[0].status, 'done');
  assert.deepEqual(result.steps[0].args, { category: 'Dining' });
  assert.equal(result.steps[0].summary, 'Spent €1,234.56 on Dining last month.');
  assert.deepEqual(steps.map(s => s.status), ['running', 'done'], 'the page hears when a lookup starts and ends');
  const second = seen[1].messages;
  assert.equal(second[0].role, 'system');
  assert.equal(second[second.length - 2].role, 'assistant');
  assert.equal((second[second.length - 1] as any).role, 'tool');
  assert.match((second[second.length - 1] as any).content, /1234\.56/, 'the model is handed the real result');
  assert.deepEqual(result.remember.map(m => m.role), ['user', 'assistant']);
});

test('an error from a tool goes back to the model, which can correct itself', async () => {
  const { chat } = scripted(
    { toolCalls: [call('spending', { category: 'eating out' }, 'a')] },
    { toolCalls: [call('spending', { category: 'Dining' }, 'b')] },
    { content: 'You spent €1,234.56.' },
  );
  const result = await runAssistantTurn({ ...base, question: 'eating out?', chat });
  assert.deepEqual(result.steps.map(s => s.status), ['error', 'done']);
  assert.match(result.steps[0].summary!, /no category called/);
  assert.equal(result.answer, 'You spent €1,234.56.');
});

test('an unknown tool or broken arguments become errors, not crashes', async () => {
  const { chat, seen } = scripted(
    { toolCalls: [call('delete_everything', {}, 'a'), call('spending', '{not json', 'b'), call('spending', '[1]', 'c')] },
    { content: 'Sorry.' },
  );
  const result = await runAssistantTurn({ ...base, question: 'x', chat });
  assert.deepEqual(result.steps.map(s => s.status), ['error', 'error', 'error']);
  assert.match(result.steps[0].summary!, /no tool called "delete_everything"/);
  assert.match(result.steps[1].summary!, /not valid JSON/);
  assert.match(result.steps[2].summary!, /JSON object/);
  assert.equal(seen[1].messages.filter(m => m.role === 'tool').length, 3, 'every call gets a reply');
});

test('a model that never stops looking things up is made to answer', async () => {
  const forever = Array.from({ length: MAX_ROUNDS }, (_, i) => ({ toolCalls: [call('spending', { category: 'Dining' }, `c${i}`)] }));
  forever[MAX_ROUNDS - 1] = { content: 'Here is what I found.' } as any;
  const { chat, seen } = scripted(...forever);
  const result = await runAssistantTurn({ ...base, question: 'x', chat });
  assert.equal(seen.length, MAX_ROUNDS);
  assert.equal(seen[MAX_ROUNDS - 1].toolCount, 0, 'the last round has no tools to call');
  assert.equal(seen[0].toolCount, 1);
  assert.equal(result.answer, 'Here is what I found.');
});

test('an empty reply becomes a plain message, never a blank answer', async () => {
  const { chat } = scripted({ content: '   ' });
  const result = await runAssistantTurn({ ...base, question: 'x', chat });
  assert.match(result.answer, /could not put an answer together/);
  assert.deepEqual(result.unverified, []);
});

test('a tool call written as JSON text still runs, and reasoning is hidden', async () => {
  const { chat } = scripted(
    { content: '<think>I should look this up</think>```json\n{"name":"spending","arguments":{"category":"Dining"}}\n```' },
    { content: '<think>Total is 1234.56</think>You spent €1,234.56.' },
  );
  const result = await runAssistantTurn({ ...base, question: 'x', chat });
  assert.equal(result.steps.length, 1);
  assert.equal(result.answer, 'You spent €1,234.56.');
  assert.equal(parseTextToolCall('{"name":"other","arguments":{}}', ['spending']), null, 'only real tools');
  assert.equal(parseTextToolCall('Sure! {"name":"spending"}', ['spending']), null, 'prose around it is not a call');
});

test('earlier questions are carried, and an abort stops the turn', async () => {
  const history: ChatMessage[] = [{ role: 'user', content: 'and in March?' }, { role: 'assistant', content: 'March was €50.' }];
  const { chat, seen } = scripted({ content: 'ok' });
  await runAssistantTurn({ ...base, history, question: 'and April?', chat });
  assert.deepEqual(seen[0].messages.map(m => m.role), ['system', 'user', 'assistant', 'user']);
  const aborted = scripted(Object.assign(new Error('aborted'), { name: 'AbortError' }));
  await assert.rejects(runAssistantTurn({ ...base, question: 'x', chat: aborted.chat }), /aborted/);
});

test('reasoning is stripped, even while it is still being written', () => {
  assert.equal(visibleText('<think>hmm</think>Answer'), 'Answer');
  assert.equal(visibleText('<think>still thinking'), '');
  assert.equal(visibleText('Fine <think>x</think>then'), 'Fine then');
});

test('streamed text and tool calls are put back together', () => {
  const acc = new StreamAccumulator();
  const send = (delta: unknown) => acc.push(`data: ${JSON.stringify({ choices: [{ delta }] })}`);
  send({ content: 'Let me ' });
  send({ content: 'check.' });
  send({ tool_calls: [{ index: 0, id: 'call_1', function: { name: 'spend', arguments: '{"cat' } }] });
  send({ tool_calls: [{ index: 0, function: { arguments: 'egory":"Dining"}' } }] });
  send({ tool_calls: [{ index: 1, id: 'call_2', function: { name: 'forecast', arguments: '{}' } }] });
  acc.push('data: [DONE]');
  acc.push(': keep-alive');
  const result = acc.result();
  assert.equal(result.content, 'Let me check.');
  assert.deepEqual(result.toolCalls.map(c => [c.id, c.function.name, c.function.arguments]), [['call_1', 'spend', '{"category":"Dining"}'], ['call_2', 'forecast', '{}']]);
  assert.throws(() => acc.push(`data: ${JSON.stringify({ error: { message: 'model crashed' } })}`), /model crashed/);
  const whole = new StreamAccumulator();
  whole.push(`data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ function: { name: 'a', arguments: { x: 1 } } }] } }] })}`);
  assert.equal(whole.result().toolCalls[0].function.arguments, '{"x":1}', 'a server that sends arguments as an object');
});

test('a response is read in pieces that can split a line anywhere', async () => {
  const lines = [
    `data: ${JSON.stringify({ choices: [{ delta: { content: '<think>x</think>Hel' } }] })}\n\n`,
    `data: ${JSON.stringify({ choices: [{ delta: { content: 'lo' } }] })}\n\ndata: [DONE]\n\n`,
  ].join('');
  const bytes = new TextEncoder().encode(lines);
  const stream = new ReadableStream<Uint8Array>({ start(controller) { for (let i = 0; i < bytes.length; i += 17) controller.enqueue(bytes.slice(i, i + 17)); controller.close(); } });
  const seen: string[] = [];
  const result = await readChatStream(new Response(stream), text => seen.push(text));
  assert.equal(visibleText(result.content), 'Hello');
  assert.equal(seen[seen.length - 1], 'Hello');
  const plain = await readChatStream(new Response(JSON.stringify({ choices: [{ message: { content: 'hi', tool_calls: [{ id: 'x', type: 'function', function: { name: 'a', arguments: '{}' } }] } }] }), { headers: { 'content-type': 'application/json' } }));
  assert.equal(plain.content, 'hi');
  assert.equal(plain.toolCalls[0].id, 'x');
});

test('figures that no lookup contained are flagged; figures that did are not', () => {
  const evidence = [JSON.stringify({ total: 1234.56, total_display: '€1,234.56', groups: [{ amount: 900 }] })];
  assert.deepEqual(unverifiedFigures('You spent €1,234.56, of which 900 was rent.', evidence), []);
  assert.deepEqual(unverifiedFigures('You spent €1,243.56.', evidence), ['1,243.56'], 'a transposed digit');
  assert.deepEqual(unverifiedFigures('You spent about €1,235.', evidence), [], 'rounding a whole number is fine');
  assert.deepEqual(unverifiedFigures('Spent 1.234,56 euros', evidence), [], 'European notation');
  assert.deepEqual(unverifiedFigures('That was 37 payments over 12 days, 62% of the total in 2026.', evidence), [], 'counts, years and percentages are not checked');
  assert.deepEqual(unverifiedFigures('You spent €2,000.00 and €77.77.', evidence), ['2,000.00', '77.77']);
  assert.deepEqual(unverifiedFigures('Nothing to report.', evidence), []);
});

test('the prompt knows the date and the currency, and quiets qwen3', () => {
  const prompt = systemPrompt(new Date(2026, 10, 7), 'EUR', 'qwen3:4b');
  assert.match(prompt, /Today is Saturday 2026-11-07/);
  assert.match(prompt, /main currency is EUR/);
  assert.match(prompt, /\/no_think/);
  assert.doesNotMatch(systemPrompt(new Date(), 'EUR', 'llama3.1:8b'), /no_think/);
});

import { createPullTracker, describePullStatus } from '../../utils/assistantApi';

test('a download shows one steady percentage across its layers', () => {
  const track = createPullTracker();
  assert.equal(track({ status: 'pulling manifest' }).percent, null, 'nothing is known yet');
  assert.equal(track({ status: 'pulling aaa', digest: 'aaa', total: 1000, completed: 0 }).percent, 0);
  assert.equal(track({ status: 'pulling aaa', digest: 'aaa', total: 1000, completed: 500 }).percent, 50);
  assert.equal(track({ status: 'pulling bbb', digest: 'bbb', total: 1000, completed: 0 }).percent, 25, 'a second layer appears: 500 of 2000');
  assert.equal(track({ status: 'pulling bbb', digest: 'bbb', total: 1000, completed: 1000 }).percent, 75);
  const last = track({ status: 'pulling aaa', digest: 'aaa', total: 1000, completed: 5000 });
  assert.equal(last.percent, 99, 'never 100 until the engine says success; over-reporting is capped');
  assert.equal(track({ status: 'verifying sha256 digest' }).done, false);
  const done = track({ status: 'success' });
  assert.deepEqual([done.done, done.percent], [true, 100]);
  assert.throws(() => track({ error: 'pull model manifest: file does not exist' }), /file does not exist/);
});

test('the engine\'s status lines are put in plain words', () => {
  assert.equal(describePullStatus(''), 'Starting');
  assert.equal(describePullStatus('pulling manifest'), 'Starting');
  assert.equal(describePullStatus('pulling 6a0746a1ec1a'), 'Downloading');
  assert.equal(describePullStatus('verifying sha256 digest'), 'Verifying the download');
  assert.equal(describePullStatus('writing manifest'), 'Finishing');
  assert.equal(describePullStatus('removing any unused layers'), 'Finishing');
  assert.equal(describePullStatus('success'), 'Done');
});
