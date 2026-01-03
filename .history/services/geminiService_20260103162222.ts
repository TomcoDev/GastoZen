import { GoogleGenerativeAI } from "@google/generative-ai";
import { Category, Account, GeminiParsedTransaction } from '../types';

// Asegúrate de que en tu .env esté como VITE_GEMINI_API_KEY
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || process.env.API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY!);

export const parseTransactionWithGemini = async (
  userInput: string,
  categories: Category[],
  accounts: Account[]
): Promise<GeminiParsedTransaction | null> => {
  
  if (!API_KEY) throw new Error("API Key no configurada.");
  
  const today = new Date().toISOString().split('T')[0];
  const categoryNames = categories.map(c => c.name);

  // Cambiamos a gemini-1.5-flash que es más estable y rápido
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    generationConfig: { responseMimeType: "application/json" }
  });

  const systemInstruction = `Eres un experto financiero de Paraguay. 
  Tu tarea es convertir texto en un objeto JSON para un sistema contable.
  REGLA CRÍTICA: Si el usuario dice "mil" (ej. 30mil), conviértelo a número (30000).
  
  Categorías disponibles: ${JSON.stringify(categoryNames)}.
  Fecha de hoy: ${today}.

  Responde solo con este formato JSON:
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
    const parsedData = JSON.parse(jsonStr) as GeminiParsedTransaction;

    // Validación extra para asegurar que el formulario reciba datos limpios
    return {
      ...parsedData,
      amount: Number(parsedData.amount) || 0,
      date: parsedData.date || today,
      type: parsedData.type || 'expense'
    };

  } catch (error) {
    console.error("Error analizando con Gemini:", error);
    throw new Error("No pude entender la transacción. ¿Podrías intentar escribir el monto en números?");
  }
};