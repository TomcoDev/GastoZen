
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Category, Account, GeminiParsedTransaction } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY para Gemini no está configurada. Por favor, establece la variable de entorno process.env.API_KEY.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! }); 

const MODEL_NAME = 'gemini-2.5-flash-preview-04-17';

export const parseTransactionWithGemini = async (
  userInput: string,
  categories: Category[],
  accounts: Account[]
): Promise<GeminiParsedTransaction | null> => {
  if (!API_KEY) {
    throw new Error("La API Key de Gemini no está configurada.");
  }
  
  const today = new Date().toISOString().split('T')[0];
  const categoryNames = categories.map(c => c.name);
  // const accountNames = accounts.map(a => a.name);

  const systemInstruction = `Eres un asistente financiero experto. Analiza la siguiente entrada del usuario, que describe una transacción financiera.
Extrae la siguiente información y devuélvela como un objeto JSON:
1. "description": Una descripción concisa de la transacción.
2. "amount": El valor monetario de la transacción como un número positivo.
3. "type": Determina si es un "income" (ingreso) o "expense" (gasto).
4. "categoryName": Sugiere el nombre de categoría más apropiado de la lista proporcionada. Si ninguna categoría específica encaja bien, usa "Gasto Diverso" para gastos u "Otro Ingreso" para ingresos. Intenta coincidir exactamente con la lista si es posible.
5. "date": Si se menciona una fecha (ej., "ayer", "martes pasado", "5 de enero"), proporciónala en formato "YYYY-MM-DD". Si no se menciona ninguna fecha, usa la fecha de hoy: ${today}.
6. "accountName": (Opcional) Si se menciona una cuenta por su nombre (ej., "de cuenta corriente", "con tarjeta de crédito"), sugiere su nombre. De lo contrario, deja nulo u omite.

Categorías Disponibles: ${JSON.stringify(categoryNames)}

Entrada del Usuario: "${userInput}"

Responde ÚNICAMENTE con el objeto JSON. No incluyas ningún otro texto o markdown.
Ejemplo de Salida JSON:
{
  "description": "Almuerzo con colegas",
  "amount": 25.50,
  "type": "expense",
  "categoryName": "Alimentación",
  "date": "${today}",
  "accountName": null
}`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: "user", parts: [{ text: userInput }] }], 
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.2, 
      }
    });

    if (!response.text) {
      throw new Error("La respuesta de Gemini no contiene texto.");
    }
    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    
    const parsedData = JSON.parse(jsonStr) as GeminiParsedTransaction;

    if (typeof parsedData.amount !== 'number' || parsedData.amount < 0) {
        const numericAmount = parseFloat(String(parsedData.amount));
        if (isNaN(numericAmount) || numericAmount < 0) {
            throw new Error("Monto inválido desde la IA");
        }
        parsedData.amount = numericAmount;
    }
    if (parsedData.type !== 'income' && parsedData.type !== 'expense') {
        const matchedCategory = categories.find(c => c.name === parsedData.categoryName);
        if (matchedCategory) {
            parsedData.type = matchedCategory.type;
        } else {
            if (/(pagado|gastado|comprado|costo)/i.test(parsedData.description)) parsedData.type = 'expense';
            else if (/(recibido|ganado|salario|bono)/i.test(parsedData.description)) parsedData.type = 'income';
            else parsedData.type = 'expense'; 
        }
    }
    if (!parsedData.date || !/^\d{4}-\d{2}-\d{2}$/.test(parsedData.date)) {
        parsedData.date = today;
    }

    return parsedData;

  } catch (error) {
    console.error("Error analizando transacción con Gemini:", error);
    let errorMessage = "Falló el análisis de la transacción con IA. Por favor, inténtalo de nuevo o ingresa manualmente.";
    if (error instanceof Error) {
        // Check if the error message already contains the nested error message from Gemini
        if (error.message && error.message.includes("INVALID_ARGUMENT")) {
             try {
                const nestedError = JSON.parse(error.message.substring(error.message.indexOf("{")));
                if (nestedError && nestedError.error && nestedError.error.message) {
                    errorMessage += ` Detalles: ${nestedError.error.message}`;
                } else {
                    errorMessage += ` Detalles: ${error.message}`;
                }
            } catch (e) {
                 errorMessage += ` Detalles: ${error.message}`;
            }
        } else {
            errorMessage += ` Detalles: ${error.message}`;
        }
    }
    throw new Error(errorMessage);
  }
};
