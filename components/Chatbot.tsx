import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat } from '@google/genai';
// FIX: Import InvestmentTransaction type to use in the ChatbotProps interface.
import { Account, Transaction, Budget, FinancialGoal, RecurringTransaction, InvestmentTransaction } from '../types';

interface ChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  financialData: {
    accounts: Account[];
    transactions: Transaction[];
    budgets: Budget[];
    financialGoals: FinancialGoal[];
    recurringTransactions: RecurringTransaction[];
    // FIX: Add investmentTransactions to the financialData prop to match the data passed from App.tsx.
    investmentTransactions: InvestmentTransaction[];
  };
}

interface Message {
  sender: 'user' | 'ai';
  text: string;
}

const Chatbot: React.FC<ChatbotProps> = ({ isOpen, onClose, financialData }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false); // For initial setup
  const [isStreaming, setIsStreaming] = useState(false); // For message responses
  const chatRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    if (isOpen) {
      // Use a timeout to allow the component to mount before starting the transition
      const timer = setTimeout(() => setIsMounted(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsMounted(false); // Reset on close
    }
  }, [isOpen]);

  // A simple markdown to HTML converter
  const simpleMarkdownToHtml = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
      .replace(/\n/g, '<br />'); // Newlines
  };

  useEffect(() => {
    if (isOpen) {
      const initializeChat = async () => {
        setIsLoading(true);

        if (!process.env.API_KEY) {
            setMessages([{ sender: 'ai', text: "The AI Assistant is not configured. An API key is required to use this feature. Please see Settings > AI Assistant for configuration instructions." }]);
            setIsConfigured(false);
            setIsLoading(false);
            return;
        }
        setIsConfigured(true);

        try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          
          // Optimize data sent to the model
          const recentTransactions = financialData.transactions
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 30); // Limit context for faster processing

          const dataSummary = {
              accounts: financialData.accounts.map(({ name, type, balance, currency }) => ({ name, type, balance, currency })),
              recent_transactions: recentTransactions.map(({ id, importId, ...rest }) => rest),
              investment_transactions: financialData.investmentTransactions.map(({ id, ...rest }) => rest),
              budgets: financialData.budgets.map(({ categoryName, amount }) => ({ categoryName, amount })),
              financial_goals: financialData.financialGoals.map(({ name, type, amount, currentAmount, date, startDate }) => ({ name, type, amount, currentAmount, date, startDate })),
              recurring_transactions: financialData.recurringTransactions.map(({ description, amount, type, frequency, nextDueDate }) => ({ description, amount, type, frequency, nextDueDate })),
          };

          const systemInstruction = `You are a helpful personal finance assistant for an app called Crystal. Analyze the user's financial data provided in the following JSON to answer their questions. Your answers must be short, straightforward, and easy to understand. Use markdown for emphasis if needed (e.g., **bold**). Avoid long paragraphs. Today's date is ${new Date().toLocaleDateString()}. Financial Data: ${JSON.stringify(dataSummary)}`;
          
          const newChat = ai.chats.create({
            model: 'gemini-flash-lite-latest',
            config: {
                systemInstruction: systemInstruction,
            },
          });
          chatRef.current = newChat;

          setMessages([{ sender: 'ai', text: "Hello! I'm your Crystal AI assistant. How can I help you with your finances today?" }]);
        } catch (error) {
          console.error("Failed to initialize AI chat:", error);
          setMessages([{ sender: 'ai', text: "Sorry, I'm having trouble connecting right now. Please try again later." }]);
        } finally {
          setIsLoading(false);
        }
      };
      initializeChat();
    } else {
        setMessages([]);
        chatRef.current = null;
    }
  }, [isOpen, financialData]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming || !chatRef.current) return;

    const userMessage: Message = { sender: 'user', text: input };
    setMessages(prev => [...prev, userMessage, { sender: 'ai', text: '' }]); // Add user message and empty AI placeholder
    setInput('');
    setIsStreaming(true);

    try {
      const stream = await chatRef.current.sendMessageStream({ message: input });

      for await (const chunk of stream) {
        const chunkText = chunk.text;
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          lastMessage.text += chunkText;
          return newMessages;
        });
      }

    } catch (error) {
      console.error("Error sending message to Gemini:", error);
      const errorMessage: Message = { sender: 'ai', text: "I'm sorry, I encountered an error. Please try asking again." };
      setMessages(prev => [...prev.slice(0, -1), errorMessage]); // Replace placeholder with error
    } finally {
      setIsStreaming(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed bottom-24 right-6 w-full max-w-sm h-[60vh] z-50 flex flex-col transition-all duration-300 ease-out ${isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      <div className="bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-xl rounded-xl shadow-2xl border border-light-separator dark:border-dark-separator flex flex-col h-full">
        <header className="flex items-center justify-between p-4 border-b border-light-separator dark:border-dark-separator">
          <h2 className="text-lg font-semibold">Crystal AI Assistant</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="text-center text-light-text-secondary dark:text-dark-text-secondary">
                <svg className="animate-spin h-6 w-6 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 * 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <p>Assistant is getting ready...</p>
              </div>
            </div>
          ) : messages.map((msg, index) => (
            <div key={index} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-sm px-4 py-2 rounded-2xl ${msg.sender === 'user' ? 'bg-primary-500 text-white rounded-br-none' : 'bg-light-fill dark:bg-dark-fill shadow-sm rounded-bl-none'}`}>
                {msg.text ? (
                    <p className="text-sm" dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(msg.text) }} />
                ) : (
                    <div className="flex items-center gap-2 py-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:0.2s]"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:0.4s]"></div>
                    </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="p-4 border-t border-light-separator dark:border-dark-separator">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your finances..."
              className="flex-1 bg-light-fill dark:bg-dark-fill rounded-full py-2 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 border border-transparent focus:border-transparent"
              disabled={isStreaming || isLoading || !isConfigured}
            />
            <button
              type="submit"
              className="w-10 h-10 flex-shrink-0 bg-primary-500 text-white rounded-full flex items-center justify-center hover:bg-primary-600 disabled:bg-primary-300 disabled:cursor-not-allowed transition-colors"
              disabled={isStreaming || isLoading || !input.trim() || !isConfigured}
            >
              <span className="material-symbols-outlined">arrow_upward</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;