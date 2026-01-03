import { GoogleGenerativeAI } from "@google/generative-ai";
import { Category, Account, GeminiParsedTransaction } from '../types';

// Esto silencia los errores de TypeScript sobre process.env
declare const process: {
  env: {
    API_KEY: string;
  }
};

// Accedemos a la llave que inyecta tu vite.config.ts
const API_KEY = process.env.API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY || "");

export const parseTransactionWithGemini = async (
  userInput: string,
  categories: Category[],
  _accounts: Account[]
): Promise<GeminiParsedTransaction | null> => {
  
  if (!API_KEY || API_KEY === "undefined") {
    console.error("API_KEY no detectada. Revisa tu archivo .env y REINICIA el comando 'npm run dev'");
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
  Categorías: ${JSON.stringify(categoryNames)}. Hoy es: ${today}.
  Responde solo con JSON.`;

  try {
    const result = await model.generateContent([
      { text: systemInstruction },
      { text: `Entrada: "${userInput}"` }
    ]);
    
    const response = await result.response;
    // Limpiamos la respuesta por si Gemini incluye markdown
    const jsonStr = response.text().replace(/```json|```/g, "").trim();
    return JSON.parse(jsonStr) as GeminiParsedTransaction;

  } catch (error) {
    console.error("Error en Gemini:", error);
    return null;
  }
};