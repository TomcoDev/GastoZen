import { GoogleGenerativeAI } from "@google/generative-ai";
import { Category, Account, GeminiParsedTransaction } from '../types';

// Esto soluciona el error "La propiedad env no existe en ImportMeta"
// porque tu Vite usa process.env según tu vite.config.ts
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
  _accounts: Account[] // El guion bajo silencia el error de "variable no usada"
): Promise<GeminiParsedTransaction | null> => {
  
  if (!API_KEY) {
    console.error("API_KEY no detectada. Revisa tu archivo .env");
    return null;
  }

  const today = new Date().toISOString().split('T')[0];
  const categoryNames = categories.map(c => c.name);

  // Usamos gemini-1.5-flash: es el más rápido para esto
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    generationConfig: { responseMimeType: "application/json" }
  });

  const systemInstruction = `Eres un asistente contable para Paraguay.
  Convierte el texto en JSON. 
  REGLA DE ORO: Si dicen "mil", conviértelo a ceros (ej: 30mil -> 30000).
  Categorías: ${JSON.stringify(categoryNames)}. 
  Hoy es: ${today}.
  
  Responde SOLAMENTE el JSON con este formato:
  {
    "description": "string",
    "amount": number,
    "type": "income" | "expense",
    "categoryName": "string",
    "date": "YYYY-MM-DD",
    "accountName": "string" | null
  }`;

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