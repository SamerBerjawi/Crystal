import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, Category } from "../../types";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '' 
});

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
       Example: "PURCHASE WWW.AMAZON.DE BERLIN" -> "Amazon"
       Example: "UBER * PENDING" -> "Uber"
       Example: "RETAIL BRUSSELS STARBUCKS" -> "Starbucks"
    
    2. Assign the most appropriate category from the provided list of categories.
       Categories: ${categoryNames.join(', ')}
       
    If uncertain, pick "Uncategorized" as the category.
    Return the results in a structured JSON format following the schema.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          text: `Categorize and clean these transactions: ${JSON.stringify(transactionDataForAI)}`
        }
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: "The tempId of the transaction" },
              merchant: { type: Type.STRING, description: "Clean merchant name" },
              category: { type: Type.STRING, description: "Appropriate category name from the list" }
            },
            required: ["id", "merchant", "category"]
          }
        }
      }
    });

    const result = JSON.parse(response.text || '[]');
    return result;
  } catch (error) {
    console.error("AI Enrichment Error:", error);
    return [];
  }
};
