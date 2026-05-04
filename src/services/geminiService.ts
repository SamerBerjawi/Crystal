import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, Category, Account, Budget, RecurringTransaction, AIConfig } from "../../types";

const getAIConfig = (): AIConfig => {
  try {
    const config = localStorage.getItem('crystal_ai_config');
    return config ? JSON.parse(config) : { provider: 'gemini', model: 'gemini-1.5-flash' };
  } catch {
    return { provider: 'gemini', model: 'gemini-1.5-flash' };
  }
};

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '' 
});

const callAI = async (params: {
    systemInstruction: string;
    prompt: string;
    responseMimeType?: string;
    responseSchema?: any;
    chatHistory?: { role: 'user' | 'model'; parts: { text: string }[] }[];
}) => {
    const config = getAIConfig();
    
    if (config.provider === 'gemini') {
        const response = await ai.models.generateContent({
            model: config.model || "gemini-1.5-flash",
            contents: [
                ...(params.chatHistory || []),
                { role: 'user', parts: [{ text: params.prompt }] }
            ],
            config: {
                systemInstruction: params.systemInstruction,
                responseMimeType: params.responseMimeType as any,
                responseSchema: params.responseSchema
            }
        });
        return response.text;
    }

    // For Groq/OpenRouter (OpenAI Compatible)
    const endpoint = config.provider === 'groq' 
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : 'https://openrouter.ai/api/v1/chat/completions';

    const messages = [
        { role: 'system', content: params.systemInstruction },
        ...(params.chatHistory || []).map(h => ({ 
            role: h.role === 'model' ? 'assistant' : 'user', 
            content: h.parts[0].text 
        })),
        { role: 'user', content: params.prompt }
    ];

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
            ...(config.provider === 'openrouter' ? { 'HTTP-Referer': window.location.origin, 'X-Title': 'Crystal Finance' } : {})
        },
        body: JSON.stringify({
            model: config.model,
            messages,
            response_format: params.responseMimeType === 'application/json' ? { type: 'json_object' } : undefined
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'AI Provider Error');
    }

    const result = await response.json();
    return result.choices[0].message.content;
};

interface EnrichmentResult {
  id: string;
  merchant: string;
  category: string;
}

export const enrichTransactionsWithAI = async (
  transactions: (Transaction | Omit<Transaction, 'id'>)[],
  categories: Category[]
): Promise<EnrichmentResult[]> => {
  if (transactions.length === 0) return [];

  const categoryNames = categories.map(c => c.name);
  
  const transactionDataForAI = transactions.map((tx, index) => ({
    tempId: (tx as any).id || `temp-${index}`,
    rawDescription: tx.description,
    rawMerchant: tx.merchant,
    amount: tx.amount,
  }));

  const systemInstruction = `
    You are a financial expert. Your task is to clean and categorize bank transactions.
    
    For each transaction provided:
    1. Extract a clean, recognizable merchant name from the description or raw merchant field.
    2. Assign the most appropriate category from the provided list of categories.
       Categories: ${categoryNames.join(', ')}
       
    If uncertain, pick "Uncategorized" as the category.
    Return ONLY a JSON array.
  `;

  try {
    const text = await callAI({
        systemInstruction,
        prompt: `Categorize and clean these transactions: ${JSON.stringify(transactionDataForAI)}`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              merchant: { type: Type.STRING },
              category: { type: Type.STRING }
            },
            required: ["id", "merchant", "category"]
          }
        }
    });

    return JSON.parse(text || '[]');
  } catch (error) {
    console.error("AI Enrichment Error:", error);
    return [];
  }
};

export const getFinancialAssistantResponse = async (
  prompt: string,
  context: {
    accounts: Account[];
    transactions: Transaction[];
    budgets: Budget[];
    recurring: RecurringTransaction[];
  },
  chatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[] = []
) => {
  const summary = {
    accountBalances: context.accounts.map(a => ({ name: a.name, balance: a.balance, currency: a.currency })),
    recentSpending: context.transactions.slice(0, 20).map(t => ({ merchant: t.merchant, amount: t.amount, date: t.date })),
    activeBudgets: context.budgets.map(b => ({ category: b.categoryName, limit: b.amount })),
  };

  const systemInstruction = `
    You are "Crystal AI", a highly sophisticated financial assistant. 
    You have access to the user's financial data: ${JSON.stringify(summary)}.
    
    Be concise, professional, yet helpful. Use markdown for formatting. 
    Never give specific legal or real-world regulated financial advice without a disclaimer.
  `;

  return await callAI({
      systemInstruction,
      prompt,
      chatHistory
  });
};

export const getPredictiveInsights = async (context: {
  transactions: Transaction[];
  accounts: Account[];
}) => {
  const systemInstruction = `
    Analyze the user's financial patterns. Return JSON object with:
    - anomalies: Array of { date, description, amount, reason }
    - predictedBalance30d: Number
    - confidenceScore: 0 to 1
    - insight: String summary
  `;

  const dataSubset = context.transactions.slice(0, 50).map(t => ({ date: t.date, amount: t.amount, category: t.category, merchant: t.merchant }));

  const text = await callAI({
    systemInstruction,
    prompt: `Data: ${JSON.stringify(dataSubset)}`,
    responseMimeType: "application/json"
  });

  return JSON.parse(text || '{}');
};

export const getPersonalizedChallenges = async (
  transactions: Transaction[],
  accounts: Account[],
  budgets: Budget[]
) => {
  const systemInstruction = `
    Create 3 unique "Saving Challenges".
    Return JSON array of { title, description, potentialSavings, durationDays, category, difficulty, actionPlan }.
  `;

  const topCategories = transactions.slice(0, 50).map(tx => tx.category);

  const text = await callAI({
    systemInstruction,
    prompt: `Categories: ${JSON.stringify(topCategories)}`,
    responseMimeType: "application/json"
  });

  const challenges = JSON.parse(text || '[]');
  return { challenges };
};

export const getInvestmentAnalysis = async (holdings: any[]) => {
  const systemInstruction = `
    Analyze portfolio. 
    Return JSON: { sentiment: 'Positive' | 'Neutral' | 'Negative', score: number, summary: string, marketContext: string, keyRisks: string[], opportunities: string[] }
  `;

  const text = await callAI({
    systemInstruction,
    prompt: `Holdings: ${JSON.stringify(holdings)}`,
    responseMimeType: "application/json"
  });

  return JSON.parse(text || '{}');
};

export const getFinancialHealthScore = async (context: {
  transactions: Transaction[];
  accounts: Account[];
  budgets: Budget[];
}) => {
  const systemInstruction = `
    Analyze the user's financial data and provide a "Financial Health Score" (0-100).
    Break it down into:
    1. Liquidity (Cash flow vs Debt)
    2. Savings Rate
    3. Budget Adherence
    Return JSON: { score: number, breakdown: { liquidity: number, savings: number, discipline: number }, summary: string, improvements: string[] }
  `;

  const summary = {
    totalBalance: context.accounts.reduce((sum, a) => sum + a.balance, 0),
    monthlySpending: Math.abs(context.transactions.slice(0, 50).filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)),
    budgetCount: context.budgets.length
  };

  const text = await callAI({
    systemInstruction,
    prompt: `Data: ${JSON.stringify(summary)}`,
    responseMimeType: "application/json"
  });

  return JSON.parse(text || '{}');
};

export const getSubscriptionAudit = async (transactions: Transaction[]) => {
  const systemInstruction = `
    Analyze the transactions for recurring subscription services.
    Identify active subscriptions and price trends.
    Return JSON: { subscriptions: Array<{ name: string, amount: number, frequency: string, riskLevel: 'Low' | 'Medium' | 'High', insight: string }> }
  `;

  const potentialSubscriptions = transactions.filter(t => t.amount < 0).slice(0, 100).map(t => ({ merchant: t.merchant, amount: t.amount, date: t.date }));

  const text = await callAI({
    systemInstruction,
    prompt: `Transactions: ${JSON.stringify(potentialSubscriptions)}`,
    responseMimeType: "application/json"
  });

  return JSON.parse(text || '{}');
};
