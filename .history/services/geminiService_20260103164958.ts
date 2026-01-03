import { GoogleGenerativeAI } from "@google/generative-ai";
import { Category, Account, GeminiParsedTransaction } from '../types';

// Esto le dice a TS que confíe en que process.env existe por tu vite.config.ts
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
    console.error("Error crítico: La API_KEY no se cargó desde el .env");
    return null;
  }

  try {
    // Usamos el modelo flash que es el estándar actual
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const today = new Date().toISOString().split('T')[0];
    const categoryNames = categories.map(c => c.name);

    // Creamos un prompt ultra simple pero estructurado
    const prompt = `Actúa como un asistente contable para Paraguay.
    Analiza esta frase: "${userInput}"
    Categorías disponibles: ${JSON.stringify(categoryNames)}.
    Fecha de hoy: ${today}.
    REGLA: Si dicen "mil", conviértelo a ceros (ej: 50mil -> 50000).
    Responde ÚNICAMENTE con un JSON que tenga:
    {
      "description": string,
      "amount": number,
      "type": "income" | "expense",
      "categoryName": string,
      "date": "YYYY-MM-DD"
    }`;

    // Llamada directa sin configuraciones extrañas de versión
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Limpiamos la respuesta de posibles bloques de código markdown
    const jsonStr = text.replace(/```json|```/g, "").trim();
    const data = JSON.parse(jsonStr);

    // Aseguramos que el monto sea un número para que tu Form no explote
    return {
      ...data,
      amount: Number(data.amount) || 0,
      date: data.date || today
    } as GeminiParsedTransaction;

  } catch (error) {
    console.error("Error detallado en Gemini:", error);
    return null;
  }
};