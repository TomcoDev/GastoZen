/// <reference types="vite/client" />
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Category, Account, GeminiParsedTransaction } from '../types';

// Ahora TS reconocerá .env gracias a la referencia superior
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY; 
const genAI = new GoogleGenerativeAI(API_KEY!);

export const parseTransactionWithGemini = async (
  userInput: string,
  categories: Category[],
  _accounts: Account[] // Agregamos _ para que TS no reclame si no se usa
): Promise<GeminiParsedTransaction | null> => {
  
  if (!API_KEY) throw new Error("API Key no configurada.");
  
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
      { text: `Entrada: "${userInput}"` }
    ]);
    
    const response = await result.response;
    const jsonStr = response.text().replace(/```json|```/g, "").trim();
    
    return JSON.parse(jsonStr) as GeminiParsedTransaction;

  } catch (error) {
    console.error("Error en Gemini:", error);
    return null; // Retornamos null para que el componente sepa que falló
  }
};