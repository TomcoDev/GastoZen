import { GoogleGenerativeAI } from "@google/generative-ai";
import { Category, Account, GeminiParsedTransaction } from '../types';

declare const process: {
  env: {
    API_KEY: string;
  }
};

const API_KEY = process.env.API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY || "");

export const parseTransactionWithGemini = async (
  userInput: string,
  categories: Category[],
  _accounts: Account[]
): Promise<GeminiParsedTransaction | null> => {
  
  if (!API_KEY || API_KEY === "undefined") {
    console.error("API_KEY no detectada.");
    return null;
  }

  // Usaremos 'gemini-1.5-flash' pero con la configuración estándar
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const today = new Date().toISOString().split('T')[0];
  const categoryNames = categories.map(c => c.name);

  const systemInstruction = `Eres un asistente contable de Paraguay. 
  Convierte el texto en JSON. Categorías: ${JSON.stringify(categoryNames)}. 
  REGLA: Si dicen "mil", pon ceros (30mil -> 30000).`;

  try {
    const result = await model.generateContent([
      systemInstruction,
      `Entrada: "${userInput}"`
    ]);
    
    const response = await result.response;
    const text = response.text();
    const jsonStr = text.replace(/```json|```/g, "").trim();
    
    return JSON.parse(jsonStr) as GeminiParsedTransaction;

  } catch (error) {
    console.error("Error en Gemini:", error);
    return null;
  }
};