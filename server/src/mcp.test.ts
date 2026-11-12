import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import express from 'express';
import { buildMcpServer, serveMcp } from './mcp';
import type { Scope } from './apiTokens';

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(`Test Failed: ${message}`);
}
const run = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); console.log(`✓ ${name}`); } catch (e: any) { process.exitCode = 1; console.error(`✕ ${name}:`, e.message); }
};

const data = {
    preferences: { currency: 'EUR' },
    accounts: [{ id: 'a1', name: 'Main', type: 'Checking', balance: 500, currency: 'EUR' }],
    transactions: [{ id: 't1', date: '2026-11-03', amount: -40, currency: 'EUR', type: 'expense', category: 'Food', accountId: 'a1', merchant: 'Shop' }],
};

const connect = async (userId: number, scopes: Scope[], loaded: number[] = []) => {
    const server = buildMcpServer(userId, scopes, async id => { loaded.push(id); return data; });
    const [a, b] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test', version: '1.0.0' });
    await Promise.all([server.connect(a), client.connect(b)]);
    return client;
};

(async () => {
    console.log('--- Running MCP server tests ---');

    await run('a token only sees the tools its scopes allow', async () => {
        const names = async (scopes: Scope[]) => (await (await connect(1, scopes)).listTools()).tools.map(t => t.name).sort().join();
        assert(await names(['summary']) === 'get_summary', 'summary only');
        assert(await names(['transactions']) === 'list_transactions,search_merchants,spending_by_category', 'transactions only');
        assert(await names(['investments', 'planning']) === 'get_investments,get_planning', 'investments and planning');
        assert((await connect(1, [])).getServerCapabilities()?.tools === undefined, 'no scopes, no tools capability');
    });

    await run('every tool is marked read-only', async () => {
        const { tools } = await (await connect(1, ['summary', 'transactions', 'investments', 'planning'])).listTools();
        assert(tools.length === 6 && tools.every(t => t.annotations?.readOnlyHint === true && t.annotations?.destructiveHint === false), 'read-only hints');
    });

    await run('tools answer from the right user\'s data', async () => {
        const loaded: number[] = [];
        const client = await connect(42, ['summary', 'transactions'], loaded);
        const summary: any = await client.callTool({ name: 'get_summary', arguments: {} });
        assert(JSON.parse(summary.content[0].text).netWorth === 500, 'net worth');
        const txs: any = await client.callTool({ name: 'list_transactions', arguments: { limit: 5 } });
        assert(JSON.parse(txs.content[0].text).items[0].id === 't1', 'ledger row');
        const spend: any = await client.callTool({ name: 'spending_by_category', arguments: { from: '2026-11-01' } });
        assert(JSON.parse(spend.content[0].text).total === 40, 'spending');
        assert(loaded.length === 3 && loaded.every(id => id === 42), 'always the token owner');
    });

    await run('bad input is rejected and a missing tool cannot be called', async () => {
        const client = await connect(1, ['transactions']);
        const bad: any = await client.callTool({ name: 'list_transactions', arguments: { from: 'yesterday' } }).catch(e => ({ isError: true, e }));
        assert(bad.isError === true, 'bad date refused');
        const missing: any = await client.callTool({ name: 'get_summary', arguments: {} }).catch(e => ({ isError: true, e }));
        assert(missing.isError === true, 'out-of-scope tool refused');
    });

    await run('resource and prompt follow the scopes', async () => {
        const client = await connect(1, ['summary', 'transactions']);
        const resource = await client.readResource({ uri: 'crystal://summary' });
        assert(JSON.parse((resource.contents[0] as { text: string }).text).netWorth === 500, 'summary resource');
        const prompts = await client.listPrompts();
        assert(prompts.prompts.some(p => p.name === 'monthly_review'), 'monthly review offered');
        assert((await connect(1, ['summary'])).getServerCapabilities()?.prompts === undefined, 'no prompt without transactions');
    });

    await run('works over real HTTP, statelessly, on repeated connections', async () => {
        const app = express();
        app.use(express.json());
        app.post('/mcp', (req, res) => { void serveMcp(req, res, 7, ['summary'], async () => data); });
        const http = app.listen(0);
        try {
            const port = (http.address() as { port: number }).port;
            for (let round = 0; round < 2; round++) {
                const client = new Client({ name: 'http-test', version: '1.0.0' });
                await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));
                const result: any = await client.callTool({ name: 'get_summary', arguments: {} });
                assert(JSON.parse(result.content[0].text).netWorth === 500, `answer on connection ${round + 1}`);
                await client.close();
            }
        } finally { http.close(); }
    });
})();
