import { z } from 'zod';
import type { Scope } from './apiTokens';
import { investmentsView, merchantsView, planningView, spendingByCategoryView, summaryView, transactionsView } from './apiViews';

/*
 * The one list of tools Crystal offers outside the app's own screens. The MCP endpoint (mcp.ts) and Ask Crystal's
 * server-side agent (agent.ts) both read it, so an outside client and the in-app assistant give the same answers.
 * A tool is a pure function of the user's data and its arguments, and only ever reads.
 */

export interface ServerTool {
    name: string;
    title: string;
    description: string;
    /** The API token scope that unlocks it. The in-app agent has every scope: it acts as the signed-in user. */
    scope: Scope;
    inputSchema?: z.ZodRawShape;
    run: (data: any, args: any) => unknown;
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional();

export const SERVER_TOOLS: ServerTool[] = [
    {
        name: 'get_summary', title: 'Financial summary', scope: 'summary',
        description: 'Net worth, assets, debts, every open account with its balance, and this month\'s budgets with how much is used.',
        run: data => summaryView(data),
    },
    {
        name: 'list_transactions', title: 'List transactions', scope: 'transactions',
        description: 'The ledger, newest first. Filter by date range, category, account or type. Pages of up to 500; use offset for the next page.',
        inputSchema: { from: day, to: day, category: z.string().max(100).optional(), accountId: z.string().max(100).optional(), type: z.enum(['income', 'expense', 'transfer']).optional(), limit: z.number().int().min(1).max(500).optional(), offset: z.number().int().min(0).optional() },
        run: (data, args) => transactionsView(data, args),
    },
    {
        name: 'spending_by_category', title: 'Spending by category', scope: 'transactions',
        description: 'Total spending per top-level category in the main currency, largest first. Transfers and adjustments are left out.',
        inputSchema: { from: day, to: day },
        run: (data, args) => spendingByCategoryView(data, args),
    },
    {
        name: 'search_merchants', title: 'Search merchants', scope: 'transactions',
        description: 'Merchants matching a name, with how many payments, the total spent and the last date. Leave the query empty for the biggest merchants.',
        inputSchema: { query: z.string().max(100).optional(), from: day, to: day, limit: z.number().int().min(1).max(100).optional() },
        run: (data, args) => merchantsView(data, args),
    },
    {
        name: 'get_investments', title: 'Investment holdings', scope: 'investments',
        description: 'Current holdings from the trade history, valued at cost (live prices are not available here).',
        run: data => investmentsView(data),
    },
    {
        name: 'get_planning', title: 'Goals, bills and recurring payments', scope: 'planning',
        description: 'Savings goals with progress, recurring income and expenses with their next date, and bills and payments.',
        run: data => planningView(data),
    },
];

export const toolsForScopes = (scopes: readonly Scope[]) => SERVER_TOOLS.filter(tool => scopes.includes(tool.scope));

/** The tool as a chat model wants it: an OpenAI-style function with a JSON schema for its arguments. */
export const chatSpec = (tool: ServerTool) => {
    const schema = z.toJSONSchema(z.object(tool.inputSchema ?? {})) as Record<string, unknown>;
    delete schema.$schema;
    return { type: 'function' as const, function: { name: tool.name, description: tool.description, parameters: schema } };
};

/** Checks arguments the way the MCP endpoint does, so a model cannot pass what a client could not. */
export const parseToolArgs = (tool: ServerTool, args: unknown): { ok: true; args: any } | { ok: false; message: string } => {
    const parsed = z.object(tool.inputSchema ?? {}).safeParse(args ?? {});
    return parsed.success ? { ok: true, args: parsed.data } : { ok: false, message: parsed.error.issues.map(i => `${i.path.join('.') || 'arguments'}: ${i.message}`).join('; ') };
};
