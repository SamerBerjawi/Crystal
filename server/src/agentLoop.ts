import type { ChatMessage, ToolSpec } from './assistantCore';

/*
 * Ask Crystal's agent loop, on the server. The model may call tools as often as it needs before it answers. The model
 * call (`chat`) and every tool are injected, so this file has no network or database in it and is tested with a
 * scripted model (agentLoop.test.ts). A tool runs here, in an outside MCP server, or back in the browser: the loop
 * does not care which.
 */

export interface ToolCall { id: string; type: 'function'; function: { name: string; arguments: string } }
export interface ChatResult { content: string; toolCalls: ToolCall[] }
export type ChatFn = (messages: ChatMessage[], tools: ToolSpec[], options: { signal?: AbortSignal; onText?: (visible: string) => void }) => Promise<ChatResult>;

/** Where a tool runs. Shown to the person, so they can see which lookups left the server. */
export type ToolOrigin = 'crystal' | 'browser' | 'external';

export interface AgentTool {
    name: string;
    spec: ToolSpec;
    origin: ToolOrigin;
    run: (args: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>;
}

export interface ToolStep {
    id: string;
    name: string;
    origin: ToolOrigin;
    args: Record<string, unknown>;
    status: 'running' | 'done' | 'error';
    summary?: string;
    result?: unknown;
}

/** Lookups in one answer. A question that needs more than this is too big for a small model to hold together. */
export const MAX_ROUNDS = 6;
const RESULT_LIMIT = 8000;

export const systemPrompt = (today: Date, currency: string, model?: string | null) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  // Both forms: the words for reading, and the YYYY-MM-DD the tools expect.
  const date = `${today.toLocaleDateString('en-GB', { weekday: 'long' })} ${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const lines = [
    `You are Crystal, the assistant inside the user's own personal finance app. Today is ${date}. The main currency is ${currency}.`,
    'Answer questions about the user\'s money by calling the tools. Rules:',
    '- Every number you state must come from a tool result. Never calculate, estimate or recall figures yourself. Copy them exactly as the tool wrote them (the *_display values and the summary).',
    '- For a period give the tool `period`, `month` or start and end. Do not work dates out yourself, except to write them as YYYY-MM-DD.',
    '- If a tool returns an error, read it and call the tool again with a corrected argument.',
    '- If the question needs something you cannot look up (for example when the user moved), ask one short question.',
    '- Answer in two or three plain sentences. Name the period and say when there is no data.',
    '- You describe the numbers. You do not give investment, tax or legal advice, and you cannot change anything in the app. The one exception: you can suggest renaming a merchant or filing it under another category. A suggestion only waits in the Tidy-ups queue until the user approves it, so say it is waiting for approval, never that it is done.',
  ];
  // Qwen3 can think at length before answering. For a lookup that is wasted time on a small machine.
  if (model && /qwen3/i.test(model)) lines.push('/no_think');
  return lines.join('\n');
};

/** Removes a model's reasoning, including a reasoning block that has not closed yet while it streams. */
export const visibleText = (raw: string) => raw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/i, '').replace(/^\s+/, '');

/** Some small models write the call as JSON text instead of a tool call. Accept that when it names a real tool. */
export const parseTextToolCall = (content: string, names: string[]): ToolCall | null => {
  const text = visibleText(content).trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  if (!text.startsWith('{') || !text.endsWith('}')) return null;
  try {
    const parsed = JSON.parse(text);
    const name = parsed.name ?? parsed.tool ?? parsed.function?.name;
    const args = parsed.arguments ?? parsed.parameters ?? parsed.function?.arguments ?? {};
    if (typeof name !== 'string' || !names.includes(name)) return null;
    return { id: `text_${Date.now().toString(36)}`, type: 'function', function: { name, arguments: typeof args === 'string' ? args : JSON.stringify(args) } };
  } catch {
    return null;
  }
};

/** Builds one reply out of the lines of an OpenAI-style event stream. */
export class StreamAccumulator {
  content = '';
  private calls: { id?: string; name: string; args: string }[] = [];

  push(line: string) {
    if (!line.startsWith('data:')) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') return;
    let json: any;
    try { json = JSON.parse(payload); } catch { return; }
    if (json.error) throw new Error(String(json.error?.message ?? json.error));
    const choice = json.choices?.[0];
    const delta = choice?.delta ?? choice?.message;
    if (!delta) return;
    if (typeof delta.content === 'string') this.content += delta.content;
    for (const piece of delta.tool_calls ?? []) {
      let entry = typeof piece.index === 'number' ? this.calls[piece.index] : undefined;
      if (!entry && piece.id) entry = this.calls.find(call => call.id === piece.id);
      if (!entry && !(typeof piece.index !== 'number' && !piece.id && !piece.function?.name)) {
        entry = { id: piece.id, name: '', args: '' };
        if (typeof piece.index === 'number') this.calls[piece.index] = entry; else this.calls.push(entry);
      }
      entry ??= this.calls[this.calls.length - 1];
      if (!entry) continue;
      if (piece.id) entry.id = piece.id;
      if (piece.function?.name) entry.name += piece.function.name;
      const args = piece.function?.arguments;
      if (typeof args === 'string') entry.args += args;
      else if (args && typeof args === 'object') entry.args = JSON.stringify(args);
    }
  }

  result(): ChatResult {
    const toolCalls = this.calls.filter(Boolean).filter(call => call.name).map((call, index): ToolCall => ({
      id: call.id || `call_${index}`, type: 'function', function: { name: call.name, arguments: call.args || '{}' },
    }));
    return { content: this.content, toolCalls };
  }
}

const NUMBER = /\d{1,3}(?:[ ,.  ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g;

/** Every value a written number could mean ("1.234" is 1234 in one country and 1.234 in another). */
const readNumber = (token: string): number[] => {
  const compact = token.replace(/[   ]/g, '');
  const lastDot = compact.lastIndexOf('.'), lastComma = compact.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    return [Number(compact.split(thousands).join('').replace(decimal, '.'))];
  }
  const separator = lastDot >= 0 ? '.' : lastComma >= 0 ? ',' : '';
  if (!separator) return [Number(compact)];
  const parts = compact.split(separator);
  const grouped = parts.slice(1).every(part => part.length === 3);
  const asGrouped = Number(parts.join(''));
  const asDecimal = Number(`${parts.slice(0, -1).join('')}.${parts[parts.length - 1]}`);
  if (parts.length > 2) return [asGrouped];
  return grouped ? [asGrouped, asDecimal] : [asDecimal];
};

/**
 * Figures in an answer that no tool result contained. A model can misquote a number it was handed, or invent one, and
 * the person reading cannot tell. Small whole numbers (counts, days), years and percentages are not checked: they are
 * usually the model's own wording, not a looked-up amount.
 */
export const unverifiedFigures = (answer: string, evidence: string[]): string[] => {
  const known: number[] = [];
  for (const text of evidence) for (const match of text.matchAll(NUMBER)) known.push(...readNumber(match[0]));
  // "1,235" can only be whole: a rounded 1,234.56 is fine. "12.50" is exact.
  const found = (value: number) => known.some(k => Math.abs(k - value) < 0.005 || (Number.isInteger(value) && Math.abs(k - value) <= 0.5));
  const missing = new Set<string>();
  for (const match of answer.matchAll(NUMBER)) {
    const token = match[0];
    if (answer[(match.index ?? 0) + token.length] === '%') continue;
    const values = readNumber(token);
    const isWhole = values.every(Number.isInteger);
    // Counts, days and years are the model's own wording; only amounts are worth checking.
    if (isWhole && (values[0] < 100 || (values[0] >= 1900 && values[0] <= 2100 && !/[ ,.\u00a0]/.test(token)))) continue;
    if (!values.some(found)) missing.add(token);
  }
  return [...missing];
};


export interface TurnOptions {
    question: string;
    /** Earlier questions and answers, as plain text. Tool traffic from earlier turns is not carried over. */
    history: ChatMessage[];
    tools: AgentTool[];
    chat: ChatFn;
    system: string;
    signal?: AbortSignal;
    onText?: (visible: string) => void;
    /** A new round of the model starts: any text shown so far was only a preamble to a tool call. */
    onRoundStart?: () => void;
    onStep?: (step: ToolStep) => void;
}

export interface TurnResult {
    answer: string;
    steps: ToolStep[];
    remember: ChatMessage[];
    /** Figures in the answer that were not in any lookup. */
    unverified: string[];
}

export const NO_ANSWER = 'I could not put an answer together. Try asking it a little differently.';

/** Runs one question to its answer, letting the model look things up first. */
export const runAgentTurn = async (options: TurnOptions): Promise<TurnResult> => {
    const { question, history, tools, chat, system, signal, onText, onRoundStart, onStep } = options;
    const specs = tools.map(tool => tool.spec);
    const names = tools.map(tool => tool.name);
    const messages: ChatMessage[] = [{ role: 'system', content: system }, ...history, { role: 'user', content: question }];
    const steps: ToolStep[] = [];
    const evidence: string[] = [];
    let answer = '';

    for (let round = 0; round < MAX_ROUNDS; round++) {
        if (signal?.aborted) throw new Error('Cancelled');
        onRoundStart?.();
        // The last round may not call tools, so the model has to answer with what it has.
        const lastRound = round === MAX_ROUNDS - 1;
        const reply = await chat(messages, lastRound ? [] : specs, { signal, onText });
        let calls = reply.toolCalls;
        if (calls.length === 0 && !lastRound) {
            const fromText = parseTextToolCall(reply.content, names);
            if (fromText) { calls = [fromText]; reply.content = ''; }
        }
        if (calls.length === 0) {
            answer = visibleText(reply.content).trim();
            break;
        }
        messages.push({ role: 'assistant', content: reply.content || null, tool_calls: calls });
        for (const call of calls) {
            const tool = tools.find(candidate => candidate.name === call.function.name);
            const step: ToolStep = { id: call.id, name: call.function.name, origin: tool?.origin ?? 'crystal', args: {}, status: 'running' };
            steps.push(step);
            onStep?.({ ...step });
            let output: unknown;
            try {
                if (!tool) throw new Error(`There is no tool called "${call.function.name}". The tools are: ${names.join(', ')}.`);
                let args: unknown = {};
                try { args = call.function.arguments?.trim() ? JSON.parse(call.function.arguments) : {}; } catch { throw new Error('The arguments were not valid JSON.'); }
                if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('The arguments must be a JSON object.');
                step.args = args as Record<string, unknown>;
                output = await tool.run(args as Record<string, unknown>, signal);
            } catch (error) {
                if (signal?.aborted) throw error;
                output = { error: error instanceof Error ? error.message : 'The lookup failed.' };
            }
            const failed = !!output && typeof output === 'object' && 'error' in (output as object);
            step.status = failed ? 'error' : 'done';
            step.result = output;
            step.summary = failed ? String((output as { error: unknown }).error) : String((output as { summary?: unknown })?.summary ?? '');
            let text = JSON.stringify(output) ?? 'null';
            if (text.length > RESULT_LIMIT) text = JSON.stringify({ summary: step.summary, note: 'The full result was too long, so only the summary is shown. Ask a narrower question.' });
            evidence.push(text);
            messages.push({ role: 'tool', tool_call_id: call.id, content: text });
            onStep?.({ ...step });
        }
    }

    if (!answer) answer = NO_ANSWER;
    return {
        answer,
        steps,
        remember: [{ role: 'user', content: question }, { role: 'assistant', content: answer }],
        unverified: answer === NO_ANSWER ? [] : unverifiedFigures(answer, evidence),
    };
};
