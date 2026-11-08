import { CATALOG, MODEL_NAME, builtinOrigin, friendlyUpstreamError, modelSupportsTools, normalizeOpenAiBase, privateUrlsAllowed, sanitizeChatRequest } from './assistantCore';

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(`Test Failed: ${message}`);
}
const run = (name: string, fn: () => void) => {
    try { fn(); console.log(`✓ ${name}`); } catch (e: any) { process.exitCode = 1; console.error(`✕ ${name}:`, e.message); }
};
const throws = (fn: () => unknown) => { try { fn(); return false; } catch { return true; } };

console.log('--- Running Ask Crystal server tests ---');

run('a bare server address gets /v1, a pasted endpoint is trimmed back to the base', () => {
    assert(normalizeOpenAiBase('http://192.168.1.10:11434') === 'http://192.168.1.10:11434/v1', 'bare address');
    assert(normalizeOpenAiBase('http://192.168.1.10:11434/') === 'http://192.168.1.10:11434/v1', 'trailing slash');
    assert(normalizeOpenAiBase('https://api.openai.com/v1/chat/completions') === 'https://api.openai.com/v1', 'full endpoint');
    assert(normalizeOpenAiBase('https://openrouter.ai/api/v1/') === 'https://openrouter.ai/api/v1', 'prefixed base');
    assert(normalizeOpenAiBase('http://lm.local:1234/v1/models') === 'http://lm.local:1234/v1', 'models endpoint');
    assert(throws(() => normalizeOpenAiBase('not a url')), 'garbage is rejected');
});

run('the built-in engine address comes from the operator, with a sensible default', () => {
    assert(builtinOrigin({}) === 'http://ollama:11434', 'default');
    assert(builtinOrigin({ OLLAMA_URL: 'http://gpu-box:11434/' }) === 'http://gpu-box:11434', 'override, trailing slash trimmed');
});

run('private addresses: allowed for a sole user or by the operator, refused otherwise', () => {
    assert(privateUrlsAllowed(1, {}) === true, 'one user');
    assert(privateUrlsAllowed(0, {}) === true, 'no users yet');
    assert(privateUrlsAllowed(2, {}) === false, 'two users');
    assert(privateUrlsAllowed(5, { ASSISTANT_ALLOW_PRIVATE_URLS: 'true' }) === true, 'operator opt-in');
    assert(privateUrlsAllowed(5, { ASSISTANT_ALLOW_PRIVATE_URLS: 'false' }) === false, 'explicit off');
});

run('chat requests are validated and reduced to the fields the model needs', () => {
    const ok = sanitizeChatRequest({
        messages: [
            { role: 'system', content: 'be brief', extra: 'dropped' },
            { role: 'user', content: 'hi' },
            { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'spending', arguments: '{}' }, junk: 1 }] },
            { role: 'tool', tool_call_id: 'c1', content: '{"total":5}' },
        ],
        tools: [{ type: 'function', function: { name: 'spending', description: 'x', parameters: { type: 'object', properties: {} } } }],
    });
    assert(ok.messages.length === 4 && !('extra' in ok.messages[0]), 'extra fields dropped');
    assert(ok.messages[2].content === null && ok.messages[2].tool_calls?.[0].function.name === 'spending', 'tool call kept');
    assert(ok.tools.length === 1, 'tools kept');
    assert(throws(() => sanitizeChatRequest({ messages: [] })), 'empty');
    assert(throws(() => sanitizeChatRequest({})), 'no body');
    assert(throws(() => sanitizeChatRequest({ messages: [{ role: 'god', content: 'x' }] })), 'unknown role');
    assert(throws(() => sanitizeChatRequest({ messages: [{ role: 'user', content: 5 }] })), 'non-string content');
    assert(throws(() => sanitizeChatRequest({ messages: [{ role: 'tool', content: 'x' }] })), 'tool result without an id');
    assert(throws(() => sanitizeChatRequest({ messages: Array(81).fill({ role: 'user', content: 'x' }) })), 'too many messages');
    assert(throws(() => sanitizeChatRequest({ messages: [{ role: 'user', content: 'x'.repeat(60_001) }] })), 'huge message');
    assert(throws(() => sanitizeChatRequest({ messages: [{ role: 'user', content: 'x' }], tools: [{ type: 'function', function: { name: 'a' } }] })), 'tool without parameters');
    assert(throws(() => sanitizeChatRequest({ messages: [{ role: 'user', content: 'x' }], tools: Array(25).fill({ type: 'function', function: { name: 'a', description: '', parameters: {} } }) })), 'too many tools');
});

run('model-server errors become messages a person can act on', () => {
    const noTools = friendlyUpstreamError(400, JSON.stringify({ error: 'registry.ollama.ai/library/gemma:2b does not support tools' }));
    assert(noTools.code === 'NO_TOOLS' && /Qwen3|Llama 3.1/.test(noTools.message), 'no tools');
    assert(friendlyUpstreamError(401, '{"error":{"message":"bad key"}}').code === 'AUTH', 'auth');
    assert(friendlyUpstreamError(404, '{"error":"model \\"x\\" not found, try pulling it first"}').code === 'NO_MODEL', 'missing model');
    assert(friendlyUpstreamError(500, 'boom').message.includes('boom'), 'plain text');
    assert(friendlyUpstreamError(502, '').message.includes('502'), 'empty body names the status');
    assert(friendlyUpstreamError(500, 'x'.repeat(2000)).message.length < 400, 'long bodies are cut');
});

run('tool support is read from the engine capabilities, and unknown stays unknown', () => {
    assert(modelSupportsTools({ capabilities: ['completion', 'tools'] }) === true, 'has tools');
    assert(modelSupportsTools({ capabilities: ['completion'] }) === false, 'lacks tools');
    assert(modelSupportsTools({}) === null, 'older engine says nothing');
    assert(modelSupportsTools(null) === null, 'no answer');
});

run('every catalog entry is a downloadable name and has a size', () => {
    assert(CATALOG.length >= 3, 'has entries');
    assert(CATALOG.every(m => MODEL_NAME.test(m.name) && m.approxGb > 0 && m.label && m.note), 'valid entries');
    assert(new Set(CATALOG.map(m => m.name)).size === CATALOG.length, 'unique');
    assert(!MODEL_NAME.test('../etc/passwd') && !MODEL_NAME.test('a b') && !MODEL_NAME.test('-x'), 'unsafe names refused');
    assert(MODEL_NAME.test('hf.co/user/repo:Q4_K_M'), 'registry paths are fine');
});
