import { GoogleGenerativeAI } from "@google/generative-ai";
import { Category, Account, GeminiParsedTransaction } from '../types';

// 1. Esto le dice a TypeScript que confíe en que Vite inyectará estas variables
declare global {
  interface Window {
    process: {
      env: {
        API_KEY: string;
      }
    };
  }
}

// 2. Usamos el acceso que definiste en tu vite.config.ts
// @ts-ignore - Ignoramos el aviso de TS porque Vite hará el reemplazo en build-time
const API_KEY = process.env.API_KEY; 

const genAI = new GoogleGenerativeAI(API_KEY!);

export const parseTransactionWithGemini = async (
  userInput: string,
  categories: Category[],
  _accounts: Account[] // Agregamos el guion bajo para que TS no diga que no se usa
): Promise<GeminiParsedTransaction | null> => {
  
  if (!API_KEY) {
    console.error("API_KEY no detectada. Revisa tu .env");
    return null;
  }

  const today = new Date().toISOString().split('T')[0];
  const categoryNames = categories.map(c => c.name);

  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    generationConfig: { responseMimeType: "application/json" }
  });

  const systemInstruction = `Eres un asistente contable. 
  Convierte el texto en JSON. Categorías: ${JSON.stringify(categoryNames)}. 
  Hoy es: ${today}.
  Si dicen "mil", conviértelo a ceros (ej: 30mil -> 30000).`;

  try {
    const result = await model.generateContent([
      { text: systemInstruction },
      { text: `Entrada del usuario: "${userInput}"` }
    ]);
    
    const response = await result.response;
    const jsonStr = response.text().replace(/```json|```/g, "").trim();
    
    return JSON.parse(jsonStr) as GeminiParsedTransaction;

  } catch (error) {
    console.error("Error en Gemini:", error);
    return null;
  }
};