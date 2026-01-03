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

  try {
    // CAMBIO CLAVE: Usamos la serie Gemini 3
    // 'gemini-3-flash-preview' es el modelo más avanzado actualmente
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3-flash-preview" 
    });

    const today = new Date().toISOString().split('T')[0];
    const categoryNames = categories.map(c => c.name);

    const prompt = `Eres un asistente contable para Paraguay. 
    Analiza esta frase del usuario: "${userInput}"
    Categorías disponibles: ${JSON.stringify(categoryNames)}.
    Fecha de hoy: ${today}.
    
    REGLA: Si el usuario dice "mil", conviértelo a número (ej: 30mil -> 30000).
    Responde SOLAMENTE un objeto JSON con: description, amount (number), type (income/expense), categoryName, date (YYYY-MM-DD).`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonStr = text.replace(/```json|```/g, "").trim();
    const data = JSON.parse(jsonStr);

    return {
      ...data,
      amount: Number(data.amount) || 0,
      date: data.date || today
    } as GeminiParsedTransaction;

  } catch (error) {
    console.error("Error con Gemini 3:", error);
    return null;
  }
};