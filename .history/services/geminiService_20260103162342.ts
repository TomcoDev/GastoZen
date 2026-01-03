import { GoogleGenerativeAI } from "@google/generative-ai";
import { Category, Account, GeminiParsedTransaction } from '../types';

// Usamos el nombre exacto de tu .env con el prefijo de Vite
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY; 
const genAI = new GoogleGenerativeAI(API_KEY!);

export const parseTransactionWithGemini = async (
  userInput: string,
  categories: Category[],
  accounts: Account[]
): Promise<GeminiParsedTransaction | null> => {
  
  if (!API_KEY) throw new Error("La API Key no se cargó. Verifica que empiece con VITE_ en tu .env");
  
  const today = new Date().toISOString().split('T')[0];
  const categoryNames = categories.map(c => c.name);

  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash", // Modelo correcto y estable
    generationConfig: { responseMimeType: "application/json" }
  });

  const systemInstruction = `Eres un asistente contable para Paraguay.
  REGLA DE ORO: Si el usuario dice "mil" (ej: 30mil, 100 mil), devuelve el número completo (30000, 100000).
  
  Categorías: ${JSON.stringify(categoryNames)}.
  Hoy es: ${today}.

  Responde solo con JSON:
  {
    "description": "string",
    "amount": number,
    "type": "income" | "expense",
    "categoryName": "string",
    "date": "YYYY-MM-DD"
  }`;

  try {
    const result = await model.generateContent([
      { text: systemInstruction },
      { text: `Usuario dice: "${userInput}"` }
    ]);
    
    const response = await result.response;
    const jsonStr = response.text().replace(/```json|```/g, "").trim();
    
    return JSON.parse(jsonStr) as GeminiParsedTransaction;

  } catch (error) {
    console.error("Fallo en Gemini:", error);
    throw new Error("No se pudo procesar. Intenta escribir '30000' en lugar de '30mil'.");
  }
};