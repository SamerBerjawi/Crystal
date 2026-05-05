import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, User, Send, Sparkles, TrendingUp, AlertTriangle, Target, Briefcase, RefreshCw } from 'lucide-react';

const CACHE_KEYS = {
  INSIGHTS: 'crystal_ai_insights',
  HEALTH: 'crystal_ai_health',
  SUBSCRIPTIONS: 'crystal_ai_subscriptions'
};
import { Transaction, Account, Budget, RecurringTransaction } from '../types';
import Markdown from 'react-markdown';
import { getFinancialAssistantResponse, getPredictiveInsights, getFinancialHealthScore, getSubscriptionAudit, getAIConfig } from '../src/services/geminiService';
import Card from '../components/Card';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE } from '../constants';

interface AIAssistantProps {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  recurring: RecurringTransaction[];
  setCurrentPage?: (page: any) => void;
}

interface FinancialHealth {
  score: number;
  breakdown: { liquidity: number; savings: number; discipline: number };
  summary: string;
  improvements: string[];
  updatedAt?: string;
}

interface SubscriptionAudit {
  subscriptions: { name: string; amount: number; frequency: string; riskLevel: 'Low' | 'Medium' | 'High'; insight: string }[];
  updatedAt?: string;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ accounts, transactions, budgets, recurring, setCurrentPage }) => {
  const aiConfig = getAIConfig();
  const isEnabled = aiConfig.enabled !== false;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: isEnabled 
        ? 'Hello! I am **Crystal AI**, your personal financial assistant. How can I help you today? I can analyze your spending, predict future balances, or suggest ways to save.'
        : 'Crystal AI features are currently **disabled**. You can enable them in the AI Providers settings to start using the financial assistant.',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [insights, setInsights] = useState<any>(() => {
    const cached = localStorage.getItem(CACHE_KEYS.INSIGHTS);
    return cached ? JSON.parse(cached) : null;
  });
  const [health, setHealth] = useState<FinancialHealth | null>(() => {
    const cached = localStorage.getItem(CACHE_KEYS.HEALTH);
    return cached ? JSON.parse(cached) : null;
  });
  const [isHealthLoading, setIsHealthLoading] = useState(false);
  const [isInsightsLoading, setIsInsightsLoading] = useState(false);
  const [audit, setAudit] = useState<SubscriptionAudit | null>(() => {
    const cached = localStorage.getItem(CACHE_KEYS.SUBSCRIPTIONS);
    return cached ? JSON.parse(cached) : null;
  });
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const fetchPredictiveInsights = async (force = false) => {
    if (!isEnabled) return;
    if (insights && !force && !isInsightsLoading) return;
    setIsInsightsLoading(true);
    try {
      const res = await getPredictiveInsights({ transactions, accounts });
      const dataWithTimestamp = { ...res, updatedAt: new Date().toISOString() };
      setInsights(dataWithTimestamp);
      localStorage.setItem(CACHE_KEYS.INSIGHTS, JSON.stringify(dataWithTimestamp));
    } catch (err) {
      console.error('Failed to fetch predictive insights', err);
    } finally {
      setIsInsightsLoading(false);
    }
  };

  useEffect(() => {
    if (!insights) {
      fetchPredictiveInsights();
    }
  }, [transactions, accounts, insights]);

  const runHealthDiagnostic = async () => {
    setIsHealthLoading(true);
    try {
      const res = await getFinancialHealthScore({ transactions, accounts, budgets });
      const dataWithTimestamp = { ...res, updatedAt: new Date().toISOString() };
      setHealth(dataWithTimestamp);
      localStorage.setItem(CACHE_KEYS.HEALTH, JSON.stringify(dataWithTimestamp));
    } catch (err) {
      console.error('Health audit failed', err);
    } finally {
      setIsHealthLoading(false);
    }
  };

  const runSubscriptionAudit = async () => {
    setIsAuditLoading(true);
    try {
      const res = await getSubscriptionAudit(transactions);
      const dataWithTimestamp = { ...res, updatedAt: new Date().toISOString() };
      setAudit(dataWithTimestamp);
      localStorage.setItem(CACHE_KEYS.SUBSCRIPTIONS, JSON.stringify(dataWithTimestamp));
    } catch (err) {
      console.error('Subscription audit failed', err);
    } finally {
      setIsAuditLoading(false);
    }
  };

  const handleSend = async () => {
    if (!isEnabled) return;
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const aiResponseText = await getFinancialAssistantResponse(
        input,
        { accounts, transactions, budgets, recurring },
        history
      );

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: aiResponseText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('AI error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: 'Sorry, I encountered an error. Please check your connection and API key.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
      {/* Sidebar Insights */}
      <div className="w-full lg:w-80 flex flex-col gap-4 overflow-y-auto pr-2">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary-500" />
            AI Insights
          </h2>
          {isEnabled && (
            <button 
              onClick={() => fetchPredictiveInsights(true)}
              disabled={isInsightsLoading}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-light-text-secondary dark:text-dark-text-secondary transition-colors"
              title="Refresh Insights"
            >
              <RefreshCw className={`w-4 h-4 ${isInsightsLoading ? 'animate-spin text-primary-500' : ''}`} />
            </button>
          )}
        </div>

        {!isEnabled ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center bg-gray-50 dark:bg-white/5 rounded-3xl border border-dashed border-black/10 dark:border-white/10">
            <Bot className="w-10 h-10 text-gray-300 dark:text-gray-700 mb-3" />
            <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
              Insights are currently disabled.
            </p>
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-60 mt-1">
              Enable AI features in settings to get automated financial analysis.
            </p>
          </div>
        ) : insights ? (
          <>
            <Card className="bg-gradient-to-br from-primary-500/10 to-transparent border-primary-200 dark:border-primary-800">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm font-bold">30d Forecast</span>
                </div>
                {insights.updatedAt && (
                   <span className="text-[9px] text-light-text-secondary dark:text-dark-text-secondary opacity-50">
                     Updated {new Date(insights.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   </span>
                )}
              </div>
              <p className="text-2xl font-bold mb-1">
                ${insights.predictedBalance30d.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                Confidence: {(insights.confidenceScore * 100).toFixed(0)}%
              </p>
            </Card>

            {insights.anomalies?.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Recent Anomalies
                </h3>
                {insights.anomalies.map((anno: any, idx: number) => (
                  <Card key={idx} className="bg-amber-500/5 border-amber-200 dark:border-amber-900/30 p-3">
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">{anno.description}</p>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{anno.reason}</p>
                    <p className="text-xs font-mono mt-2 text-red-500">-${Math.abs(anno.amount)}</p>
                  </Card>
                ))}
              </div>
            )}

            <Card className="bg-primary-500/5">
              <h3 className="text-sm font-bold mb-2">Crystal's Tip</h3>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                {insights.insight}
              </p>
            </Card>

            <div className="flex flex-col gap-3 mt-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                <Target className="w-4 h-4 text-primary-500" />
                Diagnostic Reports
              </h3>
              
              {/* Financial Health Score */}
              {health ? (
                <Card className="border-primary-500/30">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold uppercase text-gray-500">Health Score</span>
                      {health.updatedAt && <span className="text-[8px] text-gray-400">Updated {new Date(health.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={runHealthDiagnostic} disabled={isHealthLoading} className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded">
                        <RefreshCw className={`w-3 h-3 text-primary-500 ${isHealthLoading ? 'animate-spin' : ''}`} />
                      </button>
                      <span className="text-2xl font-black text-primary-500">{health.score}</span>
                    </div>
                  </div>
                  <div className="space-y-1 mb-3">
                     {[
                       { label: 'Liquidity', val: health.breakdown.liquidity },
                       { label: 'Savings', val: health.breakdown.savings },
                       { label: 'Discipline', val: health.breakdown.discipline }
                     ].map(item => (
                       <div key={item.label} className="flex flex-col gap-1">
                          <div className="flex justify-between text-[10px] font-bold">
                            <span>{item.label}</span>
                            <span>{item.val}%</span>
                          </div>
                          <div className="h-1 bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-primary-500" style={{ width: `${item.val}%` }} />
                          </div>
                       </div>
                     ))}
                  </div>
                  <p className="text-[10px] italic leading-relaxed text-light-text-secondary dark:text-dark-text-secondary">
                    {health.summary}
                  </p>
                </Card>
              ) : (
                <button 
                  onClick={runHealthDiagnostic}
                  disabled={isHealthLoading}
                  className={`${BTN_SECONDARY_STYLE} !py-2.5 !h-auto text-xs w-full flex items-center justify-center gap-2`}
                >
                  {isHealthLoading ? <div className="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /> : <Briefcase className="w-3 h-3" />}
                  Check Financial Health
                </button>
              )}

              {/* Subscription Audit */}
              {audit ? (
                <Card className="border-indigo-500/30">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="text-xs font-bold text-indigo-500 flex items-center gap-2">
                      <Sparkles className="w-3 h-3" />
                      Subscription Audit
                    </h4>
                    <button onClick={runSubscriptionAudit} disabled={isAuditLoading} className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded">
                      <RefreshCw className={`w-3 h-3 text-indigo-500 ${isAuditLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  {audit.updatedAt && <div className="text-[8px] text-gray-400 mb-2 -mt-2">Last updated {new Date(audit.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                  <div className="flex flex-col gap-2">
                    {audit.subscriptions.map((sub, i) => (
                      <div key={i} className="text-[10px] flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                        <span className="font-medium truncate max-w-[100px]">{sub.name}</span>
                        <div className="flex items-center gap-1">
                          <span className={`${sub.riskLevel === 'High' ? 'text-red-500' : sub.riskLevel === 'Medium' ? 'text-amber-500' : 'text-green-500'}`}>
                            ${Math.abs(sub.amount)}
                          </span>
                          {sub.riskLevel === 'High' && <AlertTriangle className="w-2 h-2 text-red-500" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : (
                <button 
                  onClick={runSubscriptionAudit}
                  disabled={isAuditLoading}
                  className={`${BTN_SECONDARY_STYLE} !py-2.5 !h-auto text-xs w-full flex items-center justify-center gap-2`}
                >
                  {isAuditLoading ? <div className="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /> : <Send className="w-3 h-3" />}
                  Audit Subscriptions
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="animate-pulse flex flex-col gap-4">
            <div className="h-24 bg-gray-200 dark:bg-white/5 rounded-2xl" />
            <div className="h-32 bg-gray-200 dark:bg-white/5 rounded-2xl" />
            <div className="h-20 bg-gray-200 dark:bg-white/5 rounded-2xl" />
          </div>
        )}
      </div>

      {/* Main Chat Interface */}
      <Card className="flex-1 flex flex-col !p-0 overflow-hidden relative border border-black/5 dark:border-white/5 shadow-xl bg-white dark:bg-dark-card rounded-3xl">
        <div className="p-4 border-b border-black/5 dark:border-white/5 bg-gray-50 dark:bg-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white shadow-lg shadow-primary-500/20">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-light-text dark:text-dark-text">Crystal AI</h3>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-[10px] uppercase tracking-widest font-bold text-green-500">Online</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${
                  m.role === 'user'
                    ? 'bg-primary-500 text-white rounded-tr-none'
                    : 'bg-gray-100 dark:bg-white/5 text-light-text dark:text-dark-text rounded-tl-none border border-black/5 dark:border-white/5'
                }`}
              >
                <div className="flex items-center gap-2 mb-1 opacity-50">
                   {m.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                   <span className="text-[10px] font-bold uppercase">{m.role === 'user' ? 'You' : 'Crystal'}</span>
                </div>
                <div className="markdown-body prose prose-sm dark:prose-invert max-w-none">
                  <Markdown>{m.text}</Markdown>
                </div>
                <div className={`text-[9px] mt-2 ${m.role === 'user' ? 'text-white/70 text-right' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                  {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
               <div className="bg-gray-100 dark:bg-white/5 p-4 rounded-2xl rounded-tl-none animate-pulse flex items-center gap-2">
                 <div className="flex gap-1">
                   <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                   <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                   <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                 </div>
                 <span className="text-xs text-gray-400 font-medium italic">Crystal is thinking...</span>
               </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 bg-gray-50 dark:bg-white/5 border-t border-black/5 dark:border-white/5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isEnabled ? "Ask anything about your finances..." : "AI Features Disabled"}
              className={`${INPUT_BASE_STYLE} flex-1`}
              disabled={isLoading || !isEnabled}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim() || !isEnabled}
              className={`${BTN_PRIMARY_STYLE} !w-12 !h-12 !p-0 rounded-2xl flex items-center justify-center ${!isEnabled ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
            >
              <Send className="w-5 h-5 text-white" />
            </button>
          </form>
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar">
            {isEnabled && ['How much did I spend this month?', 'Can I afford a new car?', 'Show me anomalies'].map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setInput(suggestion)}
                className="whitespace-nowrap px-3 py-1.5 rounded-full bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 text-[11px] font-medium text-light-text-secondary dark:text-dark-text-secondary hover:bg-primary-500 hover:text-white hover:border-primary-500 transition-all"
              >
                {suggestion}
              </button>
            ))}
            {!isEnabled && (
              <button
                type="button"
                onClick={() => setCurrentPage?.('AI Providers')}
                className="whitespace-nowrap px-3 py-1.5 rounded-full bg-primary-500 text-white text-[11px] font-medium hover:bg-primary-600 transition-all"
              >
                Go to AI Settings
              </button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AIAssistant;
