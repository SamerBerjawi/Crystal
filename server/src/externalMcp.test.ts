import { exposeTools, externalToolName, textOfResult, SERVER_NAME } from './externalMcp';

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(`Test Failed: ${message}`);
}
const run = async (name: string, fn: () => Promise<void> | void) => {
    try { await fn(); console.log(`✓ ${name}`); } catch (e: any) { process.exitCode = 1; console.error(`✕ ${name}:`, e.message); }
};

(async () => {
    console.log('--- Running external MCP tests ---');

    await run('names are safe for a chat model and prefixed with the server', () => {
        assert(externalToolName('rates', 'get rate!') === 'rates__get_rate_', 'sanitised');
        assert(externalToolName('a', 'x'.repeat(100)).length === 64, 'capped');
        assert(SERVER_NAME.test('bank_rates') && !SERVER_NAME.test('Bank') && !SERVER_NAME.test('1x') && !SERVER_NAME.test('a-b'), 'server names');
    });

    await run('only tools that declare themselves read-only are offered', async () => {
        const calls: string[] = [];
        const { agentTools, exposed, hidden } = exposeTools('notes', [
            { name: 'search', description: 'Find', inputSchema: { type: 'object', properties: { q: { type: 'string' } } }, annotations: { readOnlyHint: true } },
            { name: 'delete_all', annotations: { readOnlyHint: false } },
            { name: 'unlabelled' },
        ], async name => { calls.push(name); return { content: [{ type: 'text', text: 'found it' }] }; });
        assert(exposed.join() === 'search' && hidden.join() === 'delete_all,unlabelled', 'split');
        assert(agentTools.length === 1 && agentTools[0].name === 'notes__search' && agentTools[0].origin === 'external', 'one tool, marked external');
        const out: any = await agentTools[0].run({ q: 'x' });
        assert(out.result === 'found it' && calls.join() === 'search', 'called by its own name');
        assert(agentTools[0].spec.function.parameters.type === 'object', 'has a schema');
    });

    await run('errors, long results and structured results are handled', async () => {
        assert(textOfResult({ content: [{ type: 'text', text: 'a' }, { type: 'image' }, { type: 'text', text: 'b' }] }).text === 'a\nb', 'text only');
        assert(textOfResult({ content: [], structuredContent: { x: 1 } }).text === '{"x":1}', 'structured');
        assert(textOfResult({ content: [{ type: 'text', text: 'x'.repeat(30000) }] }).text.includes('[Cut'), 'capped');
        const { agentTools } = exposeTools('s', [{ name: 't', annotations: { readOnlyHint: true } }], async () => ({ isError: true, content: [{ type: 'text', text: 'broke' }] }));
        let message = '';
        await agentTools[0].run({}).catch(e => { message = e.message; });
        assert(message === 'broke', 'isError throws');
    });
})();
