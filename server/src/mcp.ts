import express, { Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { AuthRequest } from './middleware';
import { apiRateLimit, resolveApiToken, type Scope } from './apiTokens';
import { loadData } from './publicApi';
import { summaryView } from './apiViews';
import { toolsForScopes } from './toolRegistry';

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

    for (const tool of toolsForScopes(scopes)) {
        server.registerTool(tool.name, { title: tool.title, description: tool.description, ...(tool.inputSchema ? { inputSchema: tool.inputSchema } : {}), annotations: READ_ONLY },
            (async (args: any) => asText(tool.run(await load(userId), tool.inputSchema ? args : {}))) as any);
    }
    if (can('summary')) {
        server.registerResource('summary', 'crystal://summary', { title: 'Financial summary', description: 'Net worth, accounts and budgets.', mimeType: 'application/json' },
            async uri => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(summaryView(await load(userId)), null, 2) }] }));
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
