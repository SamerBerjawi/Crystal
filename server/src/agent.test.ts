import { runAgentTurn, StreamAccumulator, unverifiedFigures, visibleText, parseTextToolCall, MAX_ROUNDS, type AgentTool, type ChatFn } from './agentLoop';
import { answerFromBrowser, askBrowser, buildAgentTools, sanitizeAgentRequest, startRun } from './agent';

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(`Test Failed: ${message}`);
}
const run = async (name: string, fn: () => Promise<void> | void) => {
    try { await fn(); console.log(`✓ ${name}`); } catch (e: any) { process.exitCode = 1; console.error(`✕ ${name}:`, e.message); }
};

const call = (name: string, args: unknown, id = `c_${name}`) => ({ id, type: 'function' as const, function: { name, arguments: JSON.stringify(args) } });
const scripted = (replies: { content?: string; toolCalls?: ReturnType<typeof call>[] }[]): ChatFn => {
    let i = 0;
    return async () => { const r = replies[Math.min(i++, replies.length - 1)]; return { content: r.content ?? '', toolCalls: r.toolCalls ?? [] }; };
};
const tool = (name: string, result: unknown, origin: AgentTool['origin'] = 'crystal'): AgentTool => ({
    name, origin, spec: { type: 'function', function: { name, description: name, parameters: { type: 'object', properties: {} } } }, run: async () => result,
});
const base = { question: 'q', history: [], system: 's' };

(async () => {
    console.log('--- Running agent loop tests ---');

    await run('answers after a lookup and keeps the steps', async () => {
        const result = await runAgentTurn({ ...base, tools: [tool('get_summary', { summary: 'ok', netWorth: 1234.5 })], chat: scripted([{ toolCalls: [call('get_summary', {})] }, { content: 'Your net worth is 1,234.50.' }]) });
        assert(result.answer === 'Your net worth is 1,234.50.' && result.steps.length === 1 && result.steps[0].status === 'done', 'answer and step');
        assert(result.unverified.length === 0, 'figure found in the lookup');
    });

    await run('flags a figure no lookup contained', async () => {
        const result = await runAgentTurn({ ...base, tools: [tool('get_summary', { summary: 'ok', netWorth: 1234.5 })], chat: scripted([{ toolCalls: [call('get_summary', {})] }, { content: 'You have 9,999.00.' }]) });
        assert(result.unverified.join() === '9,999.00', `unverified ${result.unverified}`);
    });

    await run('an unknown tool or a throwing tool becomes an error the model can read', async () => {
        const broken: AgentTool = { ...tool('boom', null), run: async () => { throw new Error('nope'); } };
        const result = await runAgentTurn({ ...base, tools: [broken], chat: scripted([{ toolCalls: [call('missing', {}, 'a'), call('boom', {}, 'b')] }, { content: 'done' }]) });
        assert(result.steps.map(s => s.status).join() === 'error,error', 'both errors');
        assert(result.steps[0].summary!.includes('no tool called "missing"') && result.steps[1].summary === 'nope', 'messages');
    });

    await run('stops looking after the round limit and still answers', async () => {
        let asked = 0;
        const chat: ChatFn = async (_m, tools) => { asked++; return tools.length ? { content: '', toolCalls: [call('t', {}, `c${asked}`)] } : { content: 'Best I have.', toolCalls: [] }; };
        const result = await runAgentTurn({ ...base, tools: [tool('t', { summary: 'x' })], chat });
        assert(asked === MAX_ROUNDS && result.answer === 'Best I have.', `rounds ${asked}`);
    });

    await run('a tool written as JSON text is accepted, reasoning is hidden', async () => {
        assert(parseTextToolCall('{"name":"get_summary","arguments":{}}', ['get_summary'])?.function.name === 'get_summary', 'text call');
        assert(parseTextToolCall('{"name":"other"}', ['get_summary']) === null, 'unknown name');
        assert(visibleText('<think>hmm</think>Hello') === 'Hello' && visibleText('<think>still') === '', 'think blocks');
    });

    await run('stream accumulator joins text and tool call pieces', () => {
        const acc = new StreamAccumulator();
        acc.push('data: ' + JSON.stringify({ choices: [{ delta: { content: 'Hi ' } }] }));
        acc.push('data: ' + JSON.stringify({ choices: [{ delta: { content: 'there', tool_calls: [{ index: 0, id: 'x', function: { name: 'get_', arguments: '{"a"' } }] } }] }));
        acc.push('data: ' + JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'summary', arguments: ':1}' } }] } }] }));
        acc.push('data: [DONE]');
        const r = acc.result();
        assert(r.content === 'Hi there' && r.toolCalls[0].function.name === 'get_summary' && r.toolCalls[0].function.arguments === '{"a":1}', 'joined');
        assert(unverifiedFigures('You spent 12.50 and 1,234.', ['{"a":"12.50","b":1234}']).length === 0, 'figures checked');
    });

    await run('browser tools wait for the browser, and only the owner can answer', async () => {
        const started = startRun(5)!;
        let requested: string | null = null;
        const waiting = askBrowser(started.id, 'c1', () => { requested = 'c1'; });
        assert(requested === 'c1', 'request sent');
        assert(!answerFromBrowser(6, started.id, 'c1', { x: 1 }), 'another user cannot answer');
        assert(answerFromBrowser(5, started.id, 'c1', { x: 1 }), 'owner answers');
        assert(JSON.stringify(await waiting) === '{"x":1}', 'result delivered');
        assert(!answerFromBrowser(5, started.id, 'c1', {}), 'a call settles once');
        const dangling = askBrowser(started.id, 'c2', () => {});
        started.finish();
        let ended = false;
        await dangling.catch(() => { ended = true; });
        assert(ended, 'finishing the run rejects what is still waiting');
    });

    await run('a user can only run two at once', () => {
        const a = startRun(9)!, b = startRun(9)!;
        assert(a && b && startRun(9) === null, 'third refused');
        a.finish(); b.finish();
        const again = startRun(9);
        assert(again !== null, 'free again');
        again!.finish();
    });

    await run('the toolbox prefers browser tools and drops the server tools they cover', () => {
        const spec = (name: string) => ({ type: 'function' as const, function: { name, description: '', parameters: { type: 'object' } } });
        const names = (specs: ReturnType<typeof spec>[]) => buildAgentTools({ load: async () => ({}), browser: specs.length ? { specs, call: async () => ({}) } : null }).map(t => t.name).sort().join();
        const all = names([]);
        assert(all === 'get_investments,get_planning,get_summary,list_transactions,search_merchants,spending_by_category', 'server tools alone');
        const hybrid = names([spec('get_overview'), spec('search_transactions'), spec('spending'), spec('forecast')]);
        assert(hybrid === 'forecast,get_investments,get_overview,get_planning,search_merchants,search_transactions,spending', `hybrid ${hybrid}`);
    });

    await run('server tools check their arguments and answer from the data', async () => {
        const tools = buildAgentTools({ load: async () => ({ accounts: [{ id: 'a', name: 'Main', type: 'Checking', balance: 10, currency: 'EUR' }] }), browser: null });
        const summary = tools.find(t => t.name === 'get_summary')!;
        assert((await summary.run({}) as any).netWorth === 10, 'answers');
        const list = tools.find(t => t.name === 'list_transactions')!;
        let refused = false;
        await list.run({ from: 'yesterday' }).catch(() => { refused = true; });
        assert(refused, 'bad date refused');
    });

    await run('requests are cleaned: no tool traffic in history, sane limits', () => {
        const ok = sanitizeAgentRequest({ question: ' hi ', history: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }], clientTools: [], today: '2026-11-12' });
        assert(ok.question === 'hi' && ok.history.length === 2 && ok.today!.getMonth() === 10, 'accepted');
        const bad = (body: any) => { try { sanitizeAgentRequest(body); return false; } catch { return true; } };
        assert(bad({ question: '' }), 'empty');
        assert(bad({ question: 'x', history: [{ role: 'tool', content: 'x' }] }), 'tool role refused');
        assert(bad({ question: 'x', history: [{ role: 'system', content: 'x' }] }), 'system role refused');
        assert(bad({ question: 'x', clientTools: [{ type: 'function', function: { name: 'bad name!', parameters: {} } }] }), 'bad tool name');
        assert(sanitizeAgentRequest({ question: 'x', today: 'soon' }).today === null, 'bad date ignored');
    });
})();
