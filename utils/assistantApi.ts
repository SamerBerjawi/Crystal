import { AssistantError, readChatStream, type ChatFn } from './assistantAgent';

/*
 * The browser's side of the conversation with this server's /api/assistant routes. Settings and model management are
 * here; the answers themselves are worked out in utils/assistantAgent.ts.
 */

export interface CatalogModel { name: string; label: string; approxGb: number; note: string }

export interface AssistantSettings {
  provider: 'builtin' | 'custom';
  baseUrl: string;
  model: string;
  hasKey: boolean;
  builtin: { reachable: boolean; version?: string };
  catalog: CatalogModel[];
  privateUrlsAllowed: boolean;
}

export interface InstalledModel { name: string; sizeBytes?: number; parameterSize?: string | null; quantization?: string | null }

const failure = async (response: Response, fallback: string): Promise<AssistantError> => {
  let message = fallback;
  let code: string | undefined;
  try {
    const body = await response.json();
    if (typeof body?.message === 'string' && body.message.trim()) message = body.message.trim();
    if (typeof body?.errorCode === 'string') code = body.errorCode;
  } catch { /* not JSON: keep the fallback */ }
  return new AssistantError(message, code, response.status);
};

const call = async (path: string, init: RequestInit = {}, fallback = 'Something went wrong. Try again.'): Promise<Response> => {
  let response: Response;
  try {
    response = await fetch(`/api/assistant${path}`, { credentials: 'include', ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
    throw new AssistantError('Could not reach your Crystal server.', 'NETWORK');
  }
  if (!response.ok) throw await failure(response, fallback);
  return response;
};

export const fetchAssistantSettings = async (): Promise<AssistantSettings> => (await call('', {}, 'Could not read the assistant settings.')).json();

export const saveAssistantSettings = async (body: { provider: 'builtin' | 'custom'; baseUrl?: string; model?: string | null; apiKey?: string }): Promise<AssistantSettings> =>
  (await call('', { method: 'PUT', body: JSON.stringify(body) }, 'Could not save the assistant settings.')).json();

export const listInstalledModels = async (): Promise<InstalledModel[]> => (await call('/models', {}, 'Could not list the models.').then(r => r.json())).models ?? [];

export const modelSupportsTools = async (model: string): Promise<boolean | null> =>
  (await call(`/models/info?model=${encodeURIComponent(model)}`).then(r => r.json())).supportsTools ?? null;

export const removeModel = async (model: string): Promise<void> => { await call('/models', { method: 'DELETE', body: JSON.stringify({ model }) }, 'Could not remove the model.'); };

export const testAssistant = async (): Promise<{ reply: string; supportsTools: boolean | null }> =>
  (await call('/test', { method: 'POST' }, 'The model did not answer.')).json();

/** What the engine's status line means, in words a person would use. The raw lines name layers by hash. */
export const describePullStatus = (status: string): string => {
  if (/^pulling manifest/i.test(status) || !status) return 'Starting';
  if (/^pulling /i.test(status)) return 'Downloading';
  if (/^verifying/i.test(status)) return 'Verifying the download';
  if (/^(writing manifest|removing)/i.test(status)) return 'Finishing';
  if (status === 'success') return 'Done';
  return status;
};

export interface PullProgress { status: string; percent: number | null; done: boolean; totalBytes: number; completedBytes: number }

/**
 * Turns the engine's download lines into one overall figure. A model arrives as several layers, each with its own
 * total, so progress is the completed bytes over the totals of the layers seen so far.
 */
export const createPullTracker = () => {
  const layers = new Map<string, { total: number; completed: number }>();
  return (line: { status?: string; digest?: string; total?: number; completed?: number; error?: string }): PullProgress => {
    if (line.error) throw new AssistantError(String(line.error));
    if (line.digest && typeof line.total === 'number' && line.total > 0) layers.set(line.digest, { total: line.total, completed: Math.min(line.completed ?? 0, line.total) });
    const totalBytes = [...layers.values()].reduce((sum, layer) => sum + layer.total, 0);
    const completedBytes = [...layers.values()].reduce((sum, layer) => sum + layer.completed, 0);
    const done = line.status === 'success';
    return {
      status: line.status ?? '',
      percent: done ? 100 : totalBytes > 0 ? Math.min(99, Math.floor((completedBytes / totalBytes) * 100)) : null,
      done, totalBytes, completedBytes,
    };
  };
};

/** Downloads a model into the built-in engine, reporting progress until it finishes, fails or is cancelled. */
export const pullModel = async (model: string, onProgress: (progress: PullProgress) => void, signal?: AbortSignal): Promise<void> => {
  const response = await call('/models/pull', { method: 'POST', body: JSON.stringify({ model }), signal }, 'Could not start the download.');
  if (!response.body) throw new AssistantError('The download did not start.');
  const track = createPullTracker();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = '';
  let finished = false;
  const handle = (text: string) => {
    if (!text.trim()) return;
    let line: any;
    try { line = JSON.parse(text); } catch { return; }
    const progress = track(line);
    if (progress.done) finished = true;
    onProgress(progress);
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffered += decoder.decode(value, { stream: true });
    const lines = buffered.split('\n');
    buffered = lines.pop() ?? '';
    lines.forEach(handle);
  }
  handle(buffered);
  if (!finished) throw new AssistantError('The download stopped before it finished. Start it again to resume.');
};

/** The model call used by the app: through this server, which holds the connection details. */
export const serverChat: ChatFn = async (messages, tools, { signal, onText }) => {
  const response = await call('/chat', { method: 'POST', body: JSON.stringify({ messages, tools, stream: true }), signal }, 'The model did not answer.');
  return readChatStream(response, onText);
};
