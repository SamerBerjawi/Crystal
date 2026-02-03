import { GoogleGenAI } from "@google/genai";

export type GenAiChat = any;
export type GenAiClient = any;
export type GenAiModule = any;

export const loadGenAiModule = async (): Promise<any> => {
  return { GoogleGenAI };
};
