import { GoogleGenerativeAI } from "@google/generative-ai";
import { Category, Account, GeminiParsedTransaction } from '../types';

// 1. Declaramos process para que TypeScript no marque error 2339
declare const process: {
  env: {
    API_KEY: string;
  }
};

// 2. Usamos el acceso que definiste en tu vite.config.ts
const API_KEY = process.env.API_KEY; 
const genAI = new GoogleGenerativeAI(API_KEY || "");

export const parseTransactionWithGemini = async (
  userInput: string,
  categories: Category[],
  _accounts: Account[] // Usamos el guion bajo para silenciar el error 6133
): Promise<GeminiParsedTransaction | null> => {
  
  if (!API_KEY) {
    console.error("API_KEY no detectada. Verifica tu .env");
    return null;
  }

  const today = new Date().toISOString().split('T')[0];
  const categoryNames = categories.map(c => c.name);

  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    generationConfig: { responseMimeType: "application/json" }
  });

  const systemInstruction = `Eres un asistente contable de Paraguay. 
  REGLA DE ORO: Si el usuario dice "mil" (ej: 30mil), devuelve el número 30000.
  Categorías: ${JSON.stringify(categoryNames)}.
  Hoy es: ${today}.
  Responde solo con JSON: { "description": string, "amount": number, "type": "income"|"expense", "categoryName": string, "date": "YYYY-MM-DD" }`;

  try {
    const result = await model.generateContent([
      { text: systemInstruction },
      { text: `Entrada: "${userInput}"` }
    ]);
    
    const response = await result.response;
    const jsonStr = response.text().replace(/```json|```/g, "").trim();
    
    return JSON.parse(jsonStr) as GeminiParsedTransaction;

  } catch (error) {
    console.error("Error en Gemini:", error);
    return null;
  }
};