import test from 'node:test';
import assert from 'node:assert/strict';
import { runServerAgent } from '../../utils/assistantApi';
import type { AssistantTool } from '../../utils/assistantTools';

const tool = (name: string, run: (args: Record<string, any>) => unknown): AssistantTool => ({ name, description: name, parameters: { type: 'object', properties: {} }, run });
const stream = (lines: object[], chunk = 17) => {
  const bytes = new TextEncoder().encode(lines.map(l => JSON.stringify(l)).join('\n') + '\n');
  return new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += chunk) controller.enqueue(bytes.slice(i, i + chunk)); controller.close(); } });
};
const withFetch = async (handler: (url: string, init: RequestInit) => Response, run: () => Promise<void>) => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: any, init: any) => handler(String(url), init)) as typeof fetch;
  try { await run(); } finally { globalThis.fetch = original; }
};
const base = { question: 'q', history: [], today: new Date(2026, 10, 12) };

test('streams the agent, runs browser tools for the server and returns the result', async () => {
  const posted: any[] = [];
  const seen: string[] = [];
  const done = { type: 'done', answer: 'You have 100.', steps: [{ id: 's1', name: 'forecast', origin: 'browser', args: {}, status: 'done' }], remember: [{ role: 'user', content: 'q' }], unverified: [] };
  await withFetch((url, init) => {
    if (url.endsWith('/agent/result')) { posted.push(JSON.parse(String(init.body))); return new Response('{}'); }
    const request = JSON.parse(String(init.body));
    assert.equal(request.today, '2026-11-12');
    assert.deepEqual(request.clientTools.map((t: any) => t.function.name), ['forecast']);
    return new Response(stream([
      { type: 'run', runId: 'r1' }, { type: 'round' }, { type: 'text', text: 'Looking' },
      { type: 'tool_request', callId: 'b_1', name: 'forecast', args: { days: 7 } },
      { type: 'notice', message: 'Skipped "rates".' },
      { type: 'step', step: done.steps[0] }, done,
    ]));
  }, async () => {
    const result = await runServerAgent({ ...base, tools: [tool('forecast', args => ({ summary: 'ok', days: args.days }))], onText: t => seen.push(`text:${t}`), onRoundStart: () => seen.push('round'), onNotice: n => seen.push(`notice:${n}`) });
    assert.equal(result.answer, 'You have 100.');
    assert.deepEqual(seen, ['round', 'text:Looking', 'notice:Skipped "rates".']);
    await new Promise(resolve => setTimeout(resolve, 10));
  });
  assert.equal(posted.length, 1);
  assert.deepEqual(posted[0], { runId: 'r1', callId: 'b_1', result: { summary: 'ok', days: 7 } });
});

test('a browser tool that throws, or is unknown, answers with an error the model can read', async () => {
  const posted: any[] = [];
  await withFetch((url, init) => {
    if (url.endsWith('/agent/result')) { posted.push(JSON.parse(String(init.body))); return new Response('{}'); }
    return new Response(stream([{ type: 'run', runId: 'r' }, { type: 'tool_request', callId: 'a', name: 'boom', args: {} }, { type: 'tool_request', callId: 'b', name: 'missing', args: {} }, { type: 'done', answer: 'x', steps: [], remember: [], unverified: [] }]));
  }, async () => {
    await runServerAgent({ ...base, tools: [tool('boom', () => { throw new Error('nope'); })] });
    await new Promise(resolve => setTimeout(resolve, 10));
  });
  assert.equal(posted.find(p => p.callId === 'a').result.error, 'nope');
  assert.match(posted.find(p => p.callId === 'b').result.error, /no tool called "missing"/);
});

test('history sent to the server is plain text only', async () => {
  let sent: any;
  await withFetch((_url, init) => { sent = JSON.parse(String(init.body)); return new Response(stream([{ type: 'done', answer: 'x', steps: [], remember: [], unverified: [] }])); }, async () => {
    await runServerAgent({ ...base, history: [{ role: 'user', content: 'a' }, { role: 'assistant', content: null, tool_calls: [] } as any, { role: 'tool', tool_call_id: 'x', content: 'secret' } as any, { role: 'assistant', content: 'b' }], tools: [] });
  });
  assert.deepEqual(sent.history, [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }]);
});

test('server errors and a stream that stops early become readable failures', async () => {
  await withFetch(() => new Response(stream([{ type: 'error', message: 'The model refused.', code: 'AUTH' }])), async () => {
    await assert.rejects(runServerAgent({ ...base, tools: [] }), (error: any) => error.message === 'The model refused.' && error.code === 'AUTH');
  });
  await withFetch(() => new Response(stream([{ type: 'run', runId: 'r' }])), async () => {
    await assert.rejects(runServerAgent({ ...base, tools: [] }), /stopped before it finished/);
  });
  await withFetch(() => new Response(JSON.stringify({ message: 'Choose a model first.', errorCode: 'NO_MODEL' }), { status: 400 }), async () => {
    await assert.rejects(runServerAgent({ ...base, tools: [] }), (error: any) => error.code === 'NO_MODEL');
  });
});
