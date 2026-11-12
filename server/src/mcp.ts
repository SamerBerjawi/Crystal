import express, { Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { AuthRequest } from './middleware';
import { apiRateLimit, resolveApiToken, type Scope } from './apiTokens';
import { loadData } from './publicApi';
import { investmentsView, merchantsView, planningView, spendingByCategoryView, summaryView, transactionsView } from './apiViews';

/*
 * Crystal as an MCP server, over Streamable HTTP at /api/mcp. It is read-only: a bearer API token (apiTokens.ts)
 * picks which tools exist, so a token without the transactions scope never even sees the ledger tools. Each request
 * is stateless: it builds a server, answers, and closes. Nothing here writes to the user's data.
 */

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional();
const asText = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] });

/** Builds the server for one user, with only the tools their token allows. */
export const buildMcpServer = (userId: number, scopes: readonly Scope[], load: (userId: number) => Promise<any> = loadData): McpServer => {
    const server = new McpServer({ name: 'crystal', version: '1.0.0' }, {
        instructions: 'Read-only access to one person\'s personal finances in Crystal. Amounts are in each record\'s own currency unless a field says "InMain". Dates are YYYY-MM-DD.',
    });
    const can = (scope: Scope) => scopes.includes(scope);

    if (can('summary')) {
        server.registerTool('get_summary', {
            title: 'Financial summary',
            description: 'Net worth, assets, debts, every open account with its balance, and this month\'s budgets with how much is used.',
            annotations: READ_ONLY,
        }, async () => asText(summaryView(await load(userId))));
        server.registerResource('summary', 'crystal://summary', { title: 'Financial summary', description: 'Net worth, accounts and budgets.', mimeType: 'application/json' },
            async uri => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(summaryView(await load(userId)), null, 2) }] }));
    }

    if (can('transactions')) {
        server.registerTool('list_transactions', {
            title: 'List transactions',
            description: 'The ledger, newest first. Filter by date range, category, account or type. Pages of up to 500; use offset for the next page.',
            inputSchema: { from: day, to: day, category: z.string().max(100).optional(), accountId: z.string().max(100).optional(), type: z.enum(['income', 'expense', 'transfer']).optional(), limit: z.number().int().min(1).max(500).optional(), offset: z.number().int().min(0).optional() },
            annotations: READ_ONLY,
        }, async args => asText(transactionsView(await load(userId), args)));
        server.registerTool('spending_by_category', {
            title: 'Spending by category',
            description: 'Total spending per top-level category in the main currency, largest first. Transfers and adjustments are left out.',
            inputSchema: { from: day, to: day },
            annotations: READ_ONLY,
        }, async args => asText(spendingByCategoryView(await load(userId), args)));
        server.registerTool('search_merchants', {
            title: 'Search merchants',
            description: 'Merchants matching a name, with how many payments, the total spent and the last date. Leave the query empty for the biggest merchants.',
            inputSchema: { query: z.string().max(100).optional(), from: day, to: day, limit: z.number().int().min(1).max(100).optional() },
            annotations: READ_ONLY,
        }, async args => asText(merchantsView(await load(userId), args)));
    }

    if (can('investments')) {
        server.registerTool('get_investments', {
            title: 'Investment holdings',
            description: 'Current holdings from the trade history, valued at cost (live prices are not available here).',
            annotations: READ_ONLY,
        }, async () => asText(investmentsView(await load(userId))));
    }

    if (can('planning')) {
        server.registerTool('get_planning', {
            title: 'Goals, bills and recurring payments',
            description: 'Savings goals with progress, recurring income and expenses with their next date, and bills and payments.',
            annotations: READ_ONLY,
        }, async () => asText(planningView(await load(userId))));
    }

    if (can('summary') && can('transactions')) {
        server.registerPrompt('monthly_review', {
            title: 'Monthly review',
            description: 'Review a month: where the money went, budgets, and what to change.',
            argsSchema: { month: z.string().regex(/^\d{4}-\d{2}$/, 'Use YYYY-MM').optional() },
        }, ({ month }) => ({
            messages: [{ role: 'user' as const, content: { type: 'text' as const, text:
                `Review my finances for ${month ?? 'last month'}. Use get_summary for net worth and budgets, spending_by_category for where the money went, and list_transactions for anything unusual. ` +
                'Give me the headline, the three biggest categories, any budget that ran high, and two concrete things to change. Keep it short and use my main currency.' } }],
        }));
    }

    return server;
};

/** Answers one MCP request for a user. Stateless: a server and transport per request, closed when the response ends. */
export const serveMcp = async (req: express.Request, res: Response, userId: number, scopes: readonly Scope[], load?: (userId: number) => Promise<any>) => {
    const server = buildMcpServer(userId, scopes, load);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { void transport.close(); void server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
};

const router = express.Router();

const deny = (res: Response, status: number, message: string) => res.status(status).json({ jsonrpc: '2.0', error: { code: -32001, message }, id: null });

router.post('/', apiRateLimit, async (req: AuthRequest, res: Response) => {
    try {
        const result = await resolveApiToken(req);
        if ('status' in result) {
            if (result.status === 401) res.set('WWW-Authenticate', 'Bearer');
            return deny(res, result.status, result.message);
        }
        await serveMcp(req, res, result.identity.userId, result.identity.scopes);
    } catch (error) {
        console.error('MCP request failed', error);
        if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null });
    }
});

// Stateless: there is no session to stream to or to end.
const notAllowed = (_req: express.Request, res: Response) => res.status(405).set('Allow', 'POST').json({ jsonrpc: '2.0', error: { code: -32000, message: 'Use POST.' }, id: null });
router.get('/', notAllowed);
router.delete('/', notAllowed);

export default router;
