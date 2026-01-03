// 1. Cambiamos a la librería oficial
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Category, Account, GeminiParsedTransaction } from '../types';

// En Vite/React usa import.meta.env si process.env falla
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY no encontrada. Revisa tus variables de entorno.");
}

// 2. Inicialización oficial
const genAI = new GoogleGenerativeAI(API_KEY!);

export const parseTransactionWithGemini = async (
  userInput: string,
  categories: Category[],
  accounts: Account[]
): Promise<GeminiParsedTransaction | null> => {
  
  if (!API_KEY) throw new Error("La API Key de Gemini no está configurada.");
  
  const today = new Date().toISOString().split('T')[0];
  const categoryNames = categories.map(c => c.name);

  // 3. Definimos el modelo correcto (Flash es ideal para transacciones)
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    // Pasamos las instrucciones de sistema aquí para mejor precisión
    systemInstruction: `Eres un asistente financiero experto. Analiza la entrada del usuario y devuelve ÚNICAMENTE un JSON.
    Categorías disponibles: ${JSON.stringify(categoryNames)}.
    Fecha de hoy: ${today}.`
  });

  const prompt = `Analiza esta transacción: "${userInput}". 
  Devuelve un JSON con: description, amount (número), type (income/expense), categoryName, date (YYYY-MM-DD), accountName.`;

  try {
    // 4. Llamada con formato actualizado
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let jsonStr = response.text().trim();

    // Limpieza de Markdown si la IA lo incluye
    jsonStr = jsonStr.replace(/```json|```/g, "").trim();
    
    const parsedData = JSON.parse(jsonStr) as GeminiParsedTransaction;

    // Lógica de validación (Mantenemos tu lógica de limpieza)
    if (typeof parsedData.amount !== 'number') {
        parsedData.amount = parseFloat(String(parsedData.amount)) || 0;
    }

    if (parsedData.type !== 'income' && parsedData.type !== 'expense') {
        const matched = categories.find(c => c.name === parsedData.categoryName);
        parsedData.type = matched ? matched.type : 'expense';
    }

    parsedData.date = /^\d{4}-\d{2}-\d{2}$/.test(parsedData.date) ? parsedData.date : today;

    return parsedData;

  } catch (error) {
    console.error("Error en Gemini:", error);
    throw new Error("No se pudo procesar la transacción. Intenta de nuevo.");
  }
};