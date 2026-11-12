/*
 * Ask Crystal, server side: the pure parts. Nothing here touches the database or the network, so it is tested directly
 * (assistant.test.ts). The routes that use it are in assistant.ts.
 */

export const DEFAULT_OLLAMA_URL = 'http://ollama:11434';

/** The built-in engine: the Ollama container next to this server. Set by the operator, never by a user. */
export const builtinOrigin = (env: NodeJS.ProcessEnv = process.env) => (env.OLLAMA_URL || DEFAULT_OLLAMA_URL).trim().replace(/\/+$/, '');

export interface CatalogModel { name: string; label: string; approxGb: number; note: string }

/**
 * A short list of long-standing models that can call tools, which Ask Crystal needs. Sizes are approximate. The
 * Ollama library changes often, so this is a starting point: any model name can be typed in, and after a download
 * the engine is asked whether the model really supports tools (`modelSupportsTools`).
 */
export const CATALOG: CatalogModel[] = [
    { name: 'qwen3:4b', label: 'Qwen3 4B', approxGb: 2.5, note: 'A good balance for a NAS CPU. Start here.' },
    { name: 'qwen3:8b', label: 'Qwen3 8B', approxGb: 5.2, note: 'More accurate. Wants about 8 GB of free memory, or a GPU.' },
    { name: 'llama3.1:8b', label: 'Llama 3.1 8B', approxGb: 4.9, note: 'Solid all-rounder. About 8 GB of free memory.' },
    { name: 'llama3.2:3b', label: 'Llama 3.2 3B', approxGb: 2.0, note: 'Smallest and fastest, but weaker on multi-step questions.' },
    { name: 'phi4-mini', label: 'Phi-4 mini', approxGb: 2.5, note: 'Small and tool-capable.' },
];

export const MODEL_NAME = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;

/**
 * The OpenAI-style base a custom server is reached at. A bare address (http://host:11434) gets `/v1`, which is where
 * Ollama, LM Studio, llama.cpp and most others serve it. A pasted full endpoint is trimmed back to the base.
 */
export const normalizeOpenAiBase = (raw: string): string => {
    const url = new URL(raw.trim());
    let path = url.pathname.replace(/\/+$/, '').replace(/\/chat\/completions$/, '').replace(/\/models$/, '');
    if (path === '') path = '/v1';
    return `${url.origin}${path}`;
};

/** Private addresses are fine when the operator says so, or when this server has a single user, who owns the machine. */
export const privateUrlsAllowed = (userCount: number, env: NodeJS.ProcessEnv = process.env) =>
    env.ASSISTANT_ALLOW_PRIVATE_URLS === 'true' || userCount <= 1;

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
    tool_call_id?: string;
}

export interface ToolSpec { type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }

const MAX_MESSAGES = 80;
const MAX_CONTENT = 60_000;
const MAX_TOOLS = 24;

const fail = (message: string): never => { throw new Error(message); };
const str = (value: unknown, max: number, label: string): string => (typeof value === 'string' && value.length <= max ? value : fail(`${label} is not valid.`));

/** Checks a chat request from the browser and keeps only the fields the model needs. Throws with a message when invalid. */
export const sanitizeChatRequest = (body: any): { messages: ChatMessage[]; tools: ToolSpec[] } => {
    if (!body || !Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > MAX_MESSAGES) fail('Send between 1 and 80 messages.');
    const messages = body.messages.map((raw: any): ChatMessage => {
        if (!raw || typeof raw !== 'object') return fail('A message is not valid.');
        const role = raw.role;
        if (role === 'system' || role === 'user') return { role, content: str(raw.content, MAX_CONTENT, 'A message') };
        if (role === 'tool') return { role, content: str(raw.content, MAX_CONTENT, 'A tool result'), tool_call_id: str(raw.tool_call_id, 100, 'A tool call id') };
        if (role === 'assistant') {
            const calls = Array.isArray(raw.tool_calls) ? raw.tool_calls : [];
            if (calls.length > 8) fail('Too many tool calls in one message.');
            const message: ChatMessage = { role, content: raw.content == null ? (calls.length ? null : '') : str(raw.content, MAX_CONTENT, 'A message') };
            if (calls.length) {
                message.tool_calls = calls.map((call: any) => ({
                    id: str(call?.id, 100, 'A tool call id'),
                    type: 'function' as const,
                    function: { name: str(call?.function?.name, 64, 'A tool name'), arguments: str(call?.function?.arguments, 20_000, 'Tool arguments') },
                }));
            }
            return message;
        }
        return fail('A message has an unknown role.');
    });
    const rawTools: any[] = Array.isArray(body.tools) ? body.tools : [];
    if (rawTools.length > MAX_TOOLS) fail('Too many tools.');
    const tools = rawTools.map((tool: any): ToolSpec => {
        const fn = tool?.function;
        if (tool?.type !== 'function' || !fn || typeof fn.parameters !== 'object' || fn.parameters === null) return fail('A tool is not valid.');
        return { type: 'function', function: { name: str(fn.name, 64, 'A tool name'), description: str(fn.description ?? '', 2000, 'A tool description'), parameters: fn.parameters } };
    });
    if (JSON.stringify(tools).length > 60_000) fail('The tools are too large.');
    return { messages, tools };
};

export interface FriendlyError { message: string; code?: 'NO_TOOLS' | 'NO_MODEL' | 'AUTH' }

/** What the user should read when the model server answers with an error. */
export const friendlyUpstreamError = (status: number, bodyText: string): FriendlyError => {
    let detail = bodyText.trim();
    try {
        const parsed = JSON.parse(bodyText);
        detail = String(parsed?.error?.message ?? parsed?.error ?? parsed?.message ?? detail);
    } catch { /* keep the raw text */ }
    detail = detail.slice(0, 300);
    if (/does not support tools/i.test(detail)) return { code: 'NO_TOOLS', message: 'This model cannot use tools, which Ask Crystal needs to look up your numbers. Choose a model that supports tool calling, such as Qwen3 or Llama 3.1.' };
    if (status === 401 || status === 403) return { code: 'AUTH', message: 'The model server refused the key. Check the API key.' };
    if (status === 404 || /model .*not found|not found, try pulling/i.test(detail)) return { code: 'NO_MODEL', message: 'That model is not installed on the model server. Download it, or choose another.' };
    return { message: detail ? `The model server answered: ${detail}` : `The model server answered with status ${status}.` };
};

/** Whether the engine reports that a model can call tools (from Ollama's /api/show capabilities). Null when it does not say. */
export const modelSupportsTools = (show: any): boolean | null => (Array.isArray(show?.capabilities) ? show.capabilities.includes('tools') : null);
