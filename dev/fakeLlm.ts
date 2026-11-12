/*
 * A scripted stand-in for a language model, in the OpenAI chat format. The dev mock backend (CRYSTAL_MOCK_API=1)
 * serves it so Ask Crystal can be tried, and the interface checked, with no model installed. It is not a model: it
 * matches a few keywords in the question, calls the tool that fits, and reads the tool's own summary back.
 *
 * It asks for "eating out" on purpose, which is not a category, so the retry path (the tool's error listing the real
 * names, then a corrected call) is exercised too.
 */

type Message = { role: string; content?: string | null; tool_calls?: unknown[]; tool_call_id?: string };

export interface FakeReply { content?: string; toolCalls?: { name: string; arguments: Record<string, unknown> }[] }

const lastUser = (messages: Message[]) => [...messages].reverse().find(m => m.role === 'user')?.content ?? '';

export const fakeReply = (messages: Message[]): FakeReply => {
  const last = messages[messages.length - 1];
  const question = String(lastUser(messages)).toLowerCase();

  if (last?.role === 'tool') {
    const results = messages.slice(messages.map(m => m.role).lastIndexOf('assistant') + 1).filter(m => m.role === 'tool');
    const parsed = results.map(m => { try { return JSON.parse(String(m.content)); } catch { return {}; } });
    const failed = parsed.find(p => typeof p.error === 'string');
    if (failed && /no category called/.test(failed.error)) {
      const names = String(failed.error).split('categories are:')[1]?.split('.')[0]?.split(',').map(s => s.trim()) ?? [];
      const pick = names.find(n => /dining|restaurant/i.test(n)) ?? names[0];
      return { toolCalls: [{ name: 'spending', arguments: { period: /this month/.test(question) ? 'this_month' : 'last_month', ...(pick ? { category: pick } : {}) } }] };
    }
    const sentences = parsed.map(p => p.summary ?? p.error).filter(Boolean);
    return { content: sentences.length ? sentences.join(' ') : 'I looked, but there was nothing to report.' };
  }

  const amount = /(\d[\d,.]*)/.exec(question)?.[1]?.replace(/,/g, '');
  const period = /this month/.test(question) ? 'this_month' : /this year/.test(question) ? 'this_year' : 'last_month';
  if (/afford|can i buy/.test(question) && amount) return { toolCalls: [{ name: 'can_afford', arguments: { amount: Number(amount), date: /next week/.test(question) ? undefined : undefined } }] };
  if (/safe to spend|safe-to-spend/.test(question)) return { toolCalls: [{ name: 'safe_to_spend', arguments: {} }] };
  if (/budget/.test(question)) return { toolCalls: [{ name: 'budget_status', arguments: {} }] };
  if (/subscription/.test(question)) return { toolCalls: [{ name: 'subscriptions', arguments: {} }] };
  if (/net worth/.test(question)) return { toolCalls: [{ name: 'net_worth_history', arguments: { months: 12 } }] };
  if (/forecast|lowest|run out/.test(question)) return { toolCalls: [{ name: 'forecast', arguments: { days: 60 } }] };
  if (/eating out|dining|restaurant/.test(question)) return { toolCalls: [{ name: 'spending', arguments: { period, category: 'eating out' } }] };
  if (/spen|cost|paid/.test(question)) return { toolCalls: [{ name: 'spending', arguments: { period, group_by: 'category', limit: 3 } }] };
  if (/overview|how am i|net/.test(question)) return { toolCalls: [{ name: 'get_overview', arguments: {} }] };
  return { content: 'I can answer questions about spending, budgets, balances, forecasts and subscriptions. Try asking what you spent last month.' };
};

/** The reply as the lines of an OpenAI-style event stream. */
export const fakeStreamLines = (reply: FakeReply): string[] => {
  const chunk = (delta: unknown, finish: string | null = null) => `data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
  const lines: string[] = [];
  if (reply.toolCalls?.length) {
    reply.toolCalls.forEach((call, index) => lines.push(chunk({ tool_calls: [{ index, id: `call_${Date.now().toString(36)}_${index}`, type: 'function', function: { name: call.name, arguments: JSON.stringify(call.arguments) } }] })));
    lines.push(chunk({}, 'tool_calls'));
  } else {
    (reply.content ?? '').split(/(?<=\s)/).forEach(word => lines.push(chunk({ content: word })));
    lines.push(chunk({}, 'stop'));
  }
  lines.push('data: [DONE]\n\n');
  return lines;
};

/** The reply as one non-streamed chat completion. */
export const fakeCompletion = (reply: FakeReply) => ({
  choices: [{
    index: 0,
    finish_reason: reply.toolCalls?.length ? 'tool_calls' : 'stop',
    message: {
      role: 'assistant',
      content: reply.content ?? null,
      ...(reply.toolCalls?.length ? { tool_calls: reply.toolCalls.map((call, index) => ({ id: `call_${index}`, type: 'function', function: { name: call.name, arguments: JSON.stringify(call.arguments) } })) } : {}),
    },
  }],
});
