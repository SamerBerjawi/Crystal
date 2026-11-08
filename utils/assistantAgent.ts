import { toolSpecs, type AssistantTool } from './assistantTools';

/*
 * Ask Crystal's loop. The model is asked a question and may call tools (utils/assistantTools.ts) as often as it needs
 * before it answers. The model call itself is injected (`chat`), so this file has no network in it and is tested with
 * a scripted model (tests/unit/assistantAgent.test.ts).
 */

export interface ToolCall { id: string; type: 'function'; function: { name: string; arguments: string } }

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export interface ChatResult { content: string; toolCalls: ToolCall[] }

export interface ChatOptions {
  signal?: AbortSignal;
  /** The visible text of the reply so far (reasoning removed). */
  onText?: (visible: string) => void;
}

export type ChatFn = (messages: ChatMessage[], tools: ReturnType<typeof toolSpecs>, options: ChatOptions) => Promise<ChatResult>;

export interface ToolStep {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: 'running' | 'done' | 'error';
  /** The sentence the tool gave for its result, or the error. */
  summary?: string;
  result?: unknown;
}

export class AssistantError extends Error {
  code?: string;
  constructor(message: string, code?: string) { super(message); this.code = code; }
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
    '- You describe the numbers. You do not give investment, tax or legal advice, and you cannot change anything in the app.',
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
    if (json.error) throw new AssistantError(String(json.error?.message ?? json.error));
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

/** Reads a streamed chat response, reporting the visible text as it grows. */
export const readChatStream = async (response: Response, onText?: (visible: string) => void): Promise<ChatResult> => {
  const accumulator = new StreamAccumulator();
  if (!response.body || (response.headers.get('content-type') ?? '').includes('application/json')) {
    // A server that ignored `stream`: one JSON reply.
    const json = await response.json();
    const choice = json?.choices?.[0]?.message;
    accumulator.push(`data: ${JSON.stringify({ choices: [{ delta: { content: choice?.content ?? '', tool_calls: choice?.tool_calls?.map((c: any, i: number) => ({ index: i, ...c })) } }] })}`);
    return accumulator.result();
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffered += decoder.decode(value, { stream: true });
    const lines = buffered.split('\n');
    buffered = lines.pop() ?? '';
    const before = accumulator.content;
    for (const line of lines) accumulator.push(line.trim());
    if (accumulator.content !== before) onText?.(visibleText(accumulator.content));
  }
  if (buffered.trim()) accumulator.push(buffered.trim());
  return accumulator.result();
};

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
  tools: AssistantTool[];
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
  /** What to remember for the next question: the question and the answer. */
  remember: ChatMessage[];
  /** Figures in the answer that were not in any lookup. */
  unverified: string[];
}

const NO_ANSWER = 'I could not put an answer together. Try asking it a little differently.';

/** Runs one question to its answer, letting the model look things up first. */
export const runAssistantTurn = async (options: TurnOptions): Promise<TurnResult> => {
  const { question, history, tools, chat, system, signal, onText, onRoundStart, onStep } = options;
  const specs = toolSpecs(tools);
  const names = tools.map(tool => tool.name);
  const messages: ChatMessage[] = [{ role: 'system', content: system }, ...history, { role: 'user', content: question }];
  const steps: ToolStep[] = [];
  const evidence: string[] = [];
  let answer = '';

  for (let round = 0; round < MAX_ROUNDS; round++) {
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
      const step: ToolStep = { id: call.id, name: call.function.name, args: {}, status: 'running' };
      steps.push(step);
      onStep?.({ ...step });
      let output: unknown;
      try {
        const tool = tools.find(candidate => candidate.name === call.function.name);
        if (!tool) throw new Error(`There is no tool called "${call.function.name}". The tools are: ${names.join(', ')}.`);
        let args: unknown = {};
        try { args = call.function.arguments?.trim() ? JSON.parse(call.function.arguments) : {}; } catch { throw new Error('The arguments were not valid JSON.'); }
        if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('The arguments must be a JSON object.');
        step.args = args as Record<string, unknown>;
        output = tool.run(args as Record<string, unknown>);
      } catch (error) {
        output = { error: error instanceof Error ? error.message : 'The lookup failed.' };
      }
      const failed = !!output && typeof output === 'object' && 'error' in (output as object);
      step.status = failed ? 'error' : 'done';
      step.result = output;
      step.summary = failed ? String((output as { error: unknown }).error) : String((output as { summary?: unknown })?.summary ?? '');
      let text = JSON.stringify(output);
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
