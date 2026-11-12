import crypto from 'crypto';
import type { ChatMessage, ToolSpec } from './assistantCore';
import { chatSpec, parseToolArgs, SERVER_TOOLS } from './toolRegistry';
import type { AgentTool } from './agentLoop';

/*
 * What a server-side Ask Crystal run is made of: its tools, and the hand-off to the browser for the tools that only
 * run there (the app's own forecast and report models). The loop itself is in agentLoop.ts.
 */

/** A browser tool that already answers what a server tool does. The server tool is left out, so the model sees one choice. */
export const SHADOWED_BY: Record<string, string> = {
    get_summary: 'get_overview',
    list_transactions: 'search_transactions',
    spending_by_category: 'spending',
};

const CLIENT_TOOL_TIMEOUT_MS = 60_000;
const MAX_RUNS_PER_USER = 2;

interface Pending { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }
interface Run { userId: number; pending: Map<string, Pending> }

const runs = new Map<string, Run>();

export const startRun = (userId: number): { id: string; finish: () => void } | null => {
    if ([...runs.values()].filter(run => run.userId === userId).length >= MAX_RUNS_PER_USER) return null;
    const id = crypto.randomUUID();
    runs.set(id, { userId, pending: new Map() });
    return {
        id,
        finish: () => {
            const run = runs.get(id);
            run?.pending.forEach(p => { clearTimeout(p.timer); p.reject(new Error('The conversation ended.')); });
            runs.delete(id);
        },
    };
};

/** Asks the browser to run one of its tools. `send` writes the request onto the stream the browser is reading. */
export const askBrowser = (runId: string, callId: string, send: () => void): Promise<unknown> =>
    new Promise((resolve, reject) => {
        const run = runs.get(runId);
        if (!run) return reject(new Error('The conversation ended.'));
        const timer = setTimeout(() => { run.pending.delete(callId); reject(new Error('Your browser did not answer in time.')); }, CLIENT_TOOL_TIMEOUT_MS);
        run.pending.set(callId, { resolve, reject, timer });
        send();
    });

/** The browser's answer. False when the run or call is not this user's, or is already settled. */
export const answerFromBrowser = (userId: number, runId: string, callId: string, result: unknown): boolean => {
    const run = runs.get(runId);
    const pending = run?.userId === userId ? run.pending.get(callId) : undefined;
    if (!run || !pending) return false;
    clearTimeout(pending.timer);
    run.pending.delete(callId);
    pending.resolve(result);
    return true;
};

const MAX_RESULT_CHARS = 200_000;

/** The tools for one run: Crystal's own, outside MCP servers', and the browser's. */
export const buildAgentTools = (options: {
    load: () => Promise<any>;
    browser: { specs: ToolSpec[]; call: (callId: string, name: string, args: Record<string, unknown>) => Promise<unknown> } | null;
    external?: AgentTool[];
}): AgentTool[] => {
    const browserNames = new Set((options.browser?.specs ?? []).map(spec => spec.function.name));
    const tools: AgentTool[] = [];

    for (const spec of options.browser?.specs ?? []) {
        const name = spec.function.name;
        tools.push({
            name, spec, origin: 'browser',
            run: async args => {
                const result = await options.browser!.call(`b_${crypto.randomBytes(6).toString('hex')}`, name, args);
                if (JSON.stringify(result ?? null).length > MAX_RESULT_CHARS) throw new Error('That result was too large.');
                return result;
            },
        });
    }

    for (const tool of SERVER_TOOLS) {
        if (browserNames.has(tool.name) || browserNames.has(SHADOWED_BY[tool.name])) continue;
        tools.push({
            name: tool.name, spec: chatSpec(tool), origin: 'crystal',
            run: async args => {
                const parsed = parseToolArgs(tool, args);
                if ('message' in parsed) throw new Error(`Bad arguments. ${parsed.message}`);
                const result = tool.run(await options.load(), parsed.args);
                return { summary: tool.title, ...(result as object) };
            },
        });
    }

    for (const tool of options.external ?? []) {
        if (!tools.some(existing => existing.name === tool.name)) tools.push(tool);
    }
    return tools;
};

const name64 = /^[A-Za-z0-9_-]{1,64}$/;

/** Keeps the history to plain user and assistant text. Tool traffic from earlier turns is never accepted from a browser. */
export const sanitizeAgentRequest = (body: any): { question: string; history: ChatMessage[]; clientTools: ToolSpec[]; today: Date | null } => {
    const fail = (message: string): never => { throw new Error(message); };
    const question = typeof body?.question === 'string' ? body.question.trim() : '';
    if (!question || question.length > 4000) fail('Ask a question of up to 4000 characters.');
    const rawHistory: any[] = Array.isArray(body?.history) ? body.history : [];
    if (rawHistory.length > 40) fail('The conversation is too long. Start a new one.');
    const history = rawHistory.map((m): ChatMessage => {
        if ((m?.role !== 'user' && m?.role !== 'assistant') || typeof m.content !== 'string' || m.content.length > 20_000) return fail('A message in the history is not valid.');
        return { role: m.role, content: m.content };
    });
    const rawTools: any[] = Array.isArray(body?.clientTools) ? body.clientTools : [];
    if (rawTools.length > 24) fail('Too many tools.');
    const clientTools = rawTools.map((tool): ToolSpec => {
        const fn = tool?.function;
        if (tool?.type !== 'function' || !fn || typeof fn.name !== 'string' || !name64.test(fn.name) || typeof fn.parameters !== 'object' || fn.parameters === null) return fail('A tool is not valid.');
        return { type: 'function', function: { name: fn.name, description: String(fn.description ?? '').slice(0, 2000), parameters: fn.parameters } };
    });
    if (JSON.stringify(clientTools).length > 60_000) fail('The tools are too large.');
    const day = typeof body?.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : null;
    return { question, history, clientTools, today: day ? new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) : null };
};
