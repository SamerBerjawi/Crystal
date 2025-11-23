export type GenAiChat = {
  sendMessageStream: (params: { message: string }) => AsyncIterable<{ text: string }>;
};

export type GenAiClient = {
  chats: { create: (params: { model: string; config?: Record<string, unknown> }) => GenAiChat };
  models: { generateContent: (params: Record<string, unknown>) => Promise<{ text: string }> };
};

export type GenAiModule = {
  GoogleGenAI: new (params: { apiKey: string }) => GenAiClient;
  Type: Record<string, unknown>;
};

let genAiPromise: Promise<GenAiModule> | null = null;

export const loadGenAiModule = async (): Promise<GenAiModule> => {
  if (!genAiPromise) {
    genAiPromise = import(/* @vite-ignore */ 'https://esm.run/@google/genai@1.27.0').then((mod) => mod as unknown as GenAiModule);
  }
  return genAiPromise;
};
