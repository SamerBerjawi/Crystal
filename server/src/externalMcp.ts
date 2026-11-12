import { Readable } from 'stream';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { safeRequestStream } from './urlGuard';
import type { AgentTool } from './agentLoop';

/*
 * Outside MCP servers that Ask Crystal may call, such as a bank-rate service or a notes app. The person adds them;
 * Crystal only ever lists their tools and calls the ones that say they are read-only. Every request goes through the
 * same address checks as the model connection, redirects are never followed, and what comes back is treated as data.
 */

const CONNECT_TIMEOUT_MS = 8_000;
const CALL_TIMEOUT_MS = 30_000;
const RESULT_LIMIT = 20_000;

export const SERVER_NAME = /^[a-z][a-z0-9_]{0,23}$/;

/** `slug__tool`, limited to what a chat model accepts as a function name. */
export const externalToolName = (slug: string, tool: string) => `${slug}__${tool}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64);

/** A fetch the MCP client can use that goes through the address guard instead of the open network. */
export const guardedFetch = (allowPrivate: boolean) => async (input: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const headers: Record<string, string> = {};
    new Headers(init.headers as HeadersInit | undefined).forEach((value, key) => { headers[key] = value; });
    const method = (init.method ?? 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'POST' && method !== 'DELETE') throw new Error('Method not allowed.');
    const upstream = await safeRequestStream(url, {
        method, headers,
        body: typeof init.body === 'string' ? init.body : undefined,
        idleTimeoutMs: CALL_TIMEOUT_MS,
        allowPrivate,
    });
    init.signal?.addEventListener('abort', () => upstream.abort(), { once: true });
    const responseHeaders = new Headers();
    for (const [key, value] of Object.entries(upstream.headers)) if (value !== undefined) responseHeaders.set(key, Array.isArray(value) ? value.join(', ') : value);
    const empty = upstream.status === 204 || upstream.status === 202 || upstream.status === 304;
    return new Response(empty ? null : (Readable.toWeb(upstream.stream) as ReadableStream), { status: upstream.status, headers: responseHeaders });
};

/** The text of a tool result, capped. A result that says it is an error becomes one. */
export const textOfResult = (result: any): { text: string; isError: boolean } => {
    const parts: string[] = Array.isArray(result?.content) ? result.content.filter((c: any) => c?.type === 'text' && typeof c.text === 'string').map((c: any) => c.text) : [];
    let text = parts.join('\n');
    if (!text && result?.structuredContent) text = JSON.stringify(result.structuredContent);
    if (text.length > RESULT_LIMIT) text = `${text.slice(0, RESULT_LIMIT)}\n[Cut: the result was longer than ${RESULT_LIMIT} characters.]`;
    return { text, isError: Boolean(result?.isError) };
};

export interface ListedTool { name: string; description?: string; inputSchema?: any; annotations?: { readOnlyHint?: boolean } }

/** Splits a server's tools into what Crystal will offer (declared read-only) and what it will not. */
export const exposeTools = (slug: string, tools: ListedTool[], call: (name: string, args: Record<string, unknown>, signal?: AbortSignal) => Promise<any>) => {
    const readOnly = tools.filter(tool => tool.annotations?.readOnlyHint === true);
    const agentTools: AgentTool[] = readOnly.map(tool => {
        const name = externalToolName(slug, tool.name);
        const schema = tool.inputSchema && typeof tool.inputSchema === 'object' ? { ...tool.inputSchema } : { type: 'object', properties: {} };
        delete schema.$schema;
        return {
            name, origin: 'external' as const,
            spec: { type: 'function' as const, function: { name, description: `[${slug}] ${tool.description ?? tool.name}`.slice(0, 2000), parameters: { type: 'object', properties: {}, ...schema } } },
            run: async (args, signal) => {
                const { text, isError } = textOfResult(await call(tool.name, args, signal));
                if (isError) throw new Error(text || 'The server reported an error.');
                return { summary: `${slug}: ${tool.name}`, result: text };
            },
        };
    });
    return { agentTools, exposed: readOnly.map(t => t.name), hidden: tools.filter(t => t.annotations?.readOnlyHint !== true).map(t => t.name) };
};

export interface ExternalConnection { agentTools: AgentTool[]; exposed: string[]; hidden: string[]; close: () => Promise<void> }

export const connectExternal = async (server: { name: string; url: string; token?: string | null }, allowPrivate: boolean): Promise<ExternalConnection> => {
    const transport = new StreamableHTTPClientTransport(new URL(server.url), {
        fetch: guardedFetch(allowPrivate) as any,
        requestInit: server.token ? { headers: { Authorization: `Bearer ${server.token}` } } : undefined,
    });
    const client = new Client({ name: 'crystal', version: '1.0.0' });
    const close = async () => { await client.close().catch(() => undefined); };
    try {
        await client.connect(transport, { timeout: CONNECT_TIMEOUT_MS });
        const listed = await client.listTools(undefined, { timeout: CONNECT_TIMEOUT_MS });
        const { agentTools, exposed, hidden } = exposeTools(server.name, listed.tools as ListedTool[], (name, args, signal) =>
            client.callTool({ name, arguments: args }, undefined, { timeout: CALL_TIMEOUT_MS, signal }));
        return { agentTools, exposed, hidden, close };
    } catch (error) {
        await close();
        throw error;
    }
};
