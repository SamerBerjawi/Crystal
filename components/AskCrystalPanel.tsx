import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { formatCurrency, getMainCurrency } from '../utils';
import { AssistantError, runAssistantTurn, systemPrompt, type ChatMessage, type ToolStep } from '../utils/assistantAgent';
import { fetchAssistantSettings, serverChat, type AssistantSettings } from '../utils/assistantApi';
import { buildAssistantTools, type AssistantData } from '../utils/assistantTools';
import { useAccountsContext, usePreferencesContext, useTransactionsContext, useWarrantsContext } from '../contexts/DomainProviders';
import { useBudgetsContext, useCategoryContext, useGoalsContext, useScheduleContext } from '../contexts/FinancialDataContext';
import { Button, IconButton } from './ui/Actions';
import { Badge } from './ui/Display';
import { controlStyles } from './ui/Fields';
import Icon from './ui/Icon';
import { PrivacyContext } from './ui/Money';
import { SidePanel } from './ui/Overlays';
import { Banner } from './ui/States';
import { cn } from '../lib/utils';

interface UiMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  steps: ToolStep[];
  unverified: string[];
  error?: { message: string; code?: string };
  pending?: boolean;
  stopped?: boolean;
}

type Readiness = 'loading' | 'ready' | 'setup' | 'unavailable';

/** How many earlier messages the model is shown. A small model loses the thread in a long one. */
const HISTORY_LIMIT = 8;

const TOOL_LABEL: Record<string, string> = {
  get_overview: 'Overview', list_accounts: 'Accounts', list_categories: 'Categories', spending: 'Spending', income: 'Income', search_transactions: 'Transactions',
  budget_status: 'Budgets', safe_to_spend: 'Safe to spend', forecast: 'Forecast', can_afford: 'Can I afford it', subscriptions: 'Subscriptions', net_worth_history: 'Net worth',
};

/** **bold** is the only formatting kept. The model's text is never treated as markup. */
const inline = (text: string) => text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => (part.startsWith('**') && part.endsWith('**') ? <strong key={index}>{part.slice(2, -2)}</strong> : <React.Fragment key={index}>{part}</React.Fragment>));

const argsText = (args: Record<string, unknown>) => Object.entries(args).map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`).join(', ');

interface AskCrystalPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Opens Settings, Connections, where the model is chosen. */
  onOpenSettings: () => void;
}

/** Plain-language questions about your own money. The answers are worked out in your browser from your data. */
const AskCrystalPanel: React.FC<AskCrystalPanelProps> = ({ isOpen, onClose, onOpenSettings }) => {
  const isPrivate = useContext(PrivacyContext);
  const { transactions } = useTransactionsContext();
  const { accounts } = useAccountsContext();
  const { preferences } = usePreferencesContext();
  const { warrants } = useWarrantsContext();
  const { incomeCategories, expenseCategories } = useCategoryContext();
  const { budgets } = useBudgetsContext();
  const { financialGoals } = useGoalsContext();
  const { recurringTransactions, recurringTransactionOverrides, billsAndPayments, loanPaymentOverrides } = useScheduleContext();

  // Read when a question is asked, so the answer uses the data as it is then, not as it was when the panel mounted.
  const dataRef = useRef<Omit<AssistantData, 'today'> | undefined>(undefined);
  dataRef.current = {
    accounts, transactions, incomeCategories, expenseCategories, budgets, recurringTransactions, recurringOverrides: recurringTransactionOverrides,
    bills: billsAndPayments, loanPaymentOverrides, warrants, goals: financialGoals, preferences,
  };

  const [readiness, setReadiness] = useState<Readiness>('loading');
  const [settings, setSettings] = useState<AssistantSettings | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isBusy, setBusy] = useState(false);
  const history = useRef<ChatMessage[]>([]);
  const controller = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setReadiness(current => (current === 'ready' ? current : 'loading'));
    fetchAssistantSettings()
      .then(next => {
        if (cancelled) return;
        setSettings(next);
        const connected = next.provider === 'custom' ? !!next.baseUrl : next.builtin.reachable;
        setReadiness(connected && next.model ? 'ready' : 'setup');
      })
      .catch(() => { if (!cancelled) setReadiness('unavailable'); });
    return () => { cancelled = true; };
  }, [isOpen]);

  useEffect(() => { if (isOpen && readiness === 'ready') setTimeout(() => input.current?.focus(), 50); }, [isOpen, readiness]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages]);

  const currency = getMainCurrency();
  const suggestions = useMemo(() => [
    'What did I spend last month?',
    'How are my budgets doing?',
    `Can I afford ${formatCurrency(500, currency)} next week?`,
    'What is safe to spend right now?',
    'Which subscriptions cost the most?',
  ], [currency]);

  const patch = useCallback((id: string, change: Partial<UiMessage> | ((message: UiMessage) => Partial<UiMessage>)) => {
    setMessages(list => list.map(message => (message.id === id ? { ...message, ...(typeof change === 'function' ? change(message) : change) } : message)));
  }, []);

  const ask = useCallback(async (raw: string) => {
    const question = raw.trim();
    if (!question || isBusy || !dataRef.current) return;
    const stamp = Date.now();
    const answerId = `a${stamp}`;
    setMessages(list => [...list, { id: `q${stamp}`, role: 'user', text: question, steps: [], unverified: [] }, { id: answerId, role: 'assistant', text: '', steps: [], unverified: [], pending: true }]);
    setDraft('');
    setBusy(true);
    const abort = new AbortController();
    controller.current = abort;
    const today = new Date();
    try {
      const result = await runAssistantTurn({
        question,
        history: history.current.slice(-HISTORY_LIMIT),
        tools: buildAssistantTools({ ...dataRef.current, today }),
        chat: serverChat,
        system: systemPrompt(today, currency, settings?.model),
        signal: abort.signal,
        onRoundStart: () => patch(answerId, { text: '' }),
        onText: visible => patch(answerId, { text: visible }),
        onStep: step => patch(answerId, message => ({ steps: message.steps.some(s => s.id === step.id) ? message.steps.map(s => (s.id === step.id ? step : s)) : [...message.steps, step] })),
      });
      history.current = [...history.current, ...result.remember].slice(-HISTORY_LIMIT);
      patch(answerId, { text: result.answer, steps: result.steps, unverified: result.unverified, pending: false });
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') patch(answerId, message => ({ pending: false, stopped: true, text: message.text }));
      else patch(answerId, { pending: false, error: { message: error instanceof Error ? error.message : 'Something went wrong.', code: error instanceof AssistantError ? error.code : undefined } });
    } finally {
      controller.current = null;
      setBusy(false);
    }
  }, [currency, isBusy, patch, settings?.model]);

  const stop = () => controller.current?.abort();
  const clear = () => { controller.current?.abort(); history.current = []; setMessages([]); };

  const submit = (event: React.FormEvent) => { event.preventDefault(); void ask(draft); };
  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void ask(draft); }
  };

  const composer = readiness === 'ready' ? (
    <form onSubmit={submit} className="flex items-end gap-2">
      <label className="sr-only" htmlFor="ask-crystal-input">Ask Crystal a question</label>
      <textarea
        id="ask-crystal-input"
        ref={input}
        rows={1}
        value={draft}
        onChange={event => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask about your money"
        className={cn(controlStyles, 'max-h-32 min-h-11 resize-none px-3 py-2.5 text-[.9375rem] font-medium max-md:text-base')}
      />
      {isBusy
        ? <IconButton icon="stop" label="Stop" onPress={stop} />
        : <Button type="submit" icon="arrow-up-01" isDisabled={!draft.trim()}>Ask</Button>}
    </form>
  ) : null;

  return (
    <SidePanel isOpen={isOpen} onClose={onClose} title="Ask Crystal" description="Answers come from your own numbers, worked out on this device." footer={composer}>
      <div className="flex min-h-full flex-col gap-4" role="log" aria-live="polite" aria-label="Conversation">
        {readiness === 'loading' && <p className="type-caption text-muted">Checking the assistant...</p>}

        {readiness === 'unavailable' && (
          <Banner tone="attention">Ask Crystal needs your Crystal server, so it isn't available in the demo or when the server can't be reached.</Banner>
        )}

        {readiness === 'setup' && (
          <div className="surface-card rounded-[var(--radius-xl)] p-5">
            <h3 className="type-card-title text-ink">Choose a model to start</h3>
            <p className="type-body mt-1 text-muted">
              {settings && settings.provider === 'builtin' && !settings.builtin.reachable
                ? 'The built-in engine is not running. You can start it, or connect a model server you already have.'
                : 'Download a model, or connect one you already run. Your questions go only to the model you pick.'}
            </p>
            <Button className="mt-3" icon="settings-05" onPress={() => { onClose(); onOpenSettings(); }}>Set up the assistant</Button>
          </div>
        )}

        {readiness === 'ready' && messages.length === 0 && (
          <div>
            <p className="type-body text-muted">Ask in your own words. Crystal looks the numbers up in your data, so they match what you see in the app.</p>
            <ul className="mt-3 flex flex-col gap-2" aria-label="Suggested questions">
              {suggestions.map(text => (
                <li key={text}>
                  <button type="button" onClick={() => void ask(text)} className="w-full cursor-pointer rounded-[var(--radius-md)] border border-line bg-inset px-3 py-2.5 text-left type-body text-ink transition-colors hover:bg-pill-hover hover:text-on-pill">{text}</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {messages.map(message => message.role === 'user' ? (
          <div key={message.id} className="ml-auto max-w-[85%] rounded-[var(--radius-lg)] bg-pill px-3.5 py-2.5 type-body text-on-pill">{message.text}</div>
        ) : (
          <div key={message.id} className="max-w-full">
            <div className="rounded-[var(--radius-lg)] bg-inset px-3.5 py-3">
              {message.pending && !message.text && (
                <p className="type-caption text-muted">{message.steps.length ? `Looking up ${TOOL_LABEL[message.steps[message.steps.length - 1].name]?.toLowerCase() ?? 'your data'}...` : 'Thinking...'}</p>
              )}
              {message.text && <p className={cn('type-body whitespace-pre-wrap break-words text-ink', isPrivate && 'privacy-blur')}>{inline(message.text)}</p>}
              {message.stopped && <p className="type-caption text-muted">Stopped.</p>}
              {message.error && (
                <div className="space-y-2">
                  <p className="type-body text-ink">{message.error.message}</p>
                  {(message.error.code === 'NO_TOOLS' || message.error.code === 'NO_MODEL') && (
                    <Button size="sm" variant="secondary" onPress={() => { onClose(); onOpenSettings(); }}>Choose another model</Button>
                  )}
                </div>
              )}
            </div>
            {message.unverified.length > 0 && (
              <p className="mt-1.5 flex items-start gap-1.5 type-caption text-muted">
                <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
                <span>I could not match {message.unverified.length === 1 ? 'this figure' : 'these figures'} to your data: <span className={isPrivate ? 'privacy-blur' : undefined}>{message.unverified.join(', ')}</span>. Check {message.unverified.length === 1 ? 'it' : 'them'} against the lookups below.</span>
              </p>
            )}
            {message.steps.length > 0 && !message.pending && (
              <details className="mt-1.5 type-caption text-muted">
                <summary className="cursor-pointer select-none">How I found this ({message.steps.length} {message.steps.length === 1 ? 'lookup' : 'lookups'})</summary>
                <ol className="mt-1.5 space-y-2">
                  {message.steps.map(step => (
                    <li key={step.id} className="rounded-[var(--radius-sm)] border border-line px-2.5 py-2">
                      <p className="flex flex-wrap items-center gap-2 text-ink">
                        <span className="type-body-strong">{TOOL_LABEL[step.name] ?? step.name}</span>
                        {step.status === 'error' && <Badge tone="attention">Retried</Badge>}
                      </p>
                      {Object.keys(step.args).length > 0 && <p className="break-words">{argsText(step.args)}</p>}
                      {step.summary && <p className={cn('mt-0.5 break-words', isPrivate && 'privacy-blur')}>{step.summary}</p>}
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>
      {messages.length > 0 && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="ghost" icon="delete-02" onPress={clear}>Clear conversation</Button>
        </div>
      )}
    </SidePanel>
  );
};

export default AskCrystalPanel;
