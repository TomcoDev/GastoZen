import { GoogleGenerativeAI, GenerateContentResponse, GenerativeModel } from "@google/generative-ai"; // Asegúrate de importar GenerativeModel
import { Category, Account, GeminiParsedTransaction } from '../types';

// 1. CAMBIO RECOMENDADO: Usa un nombre más específico para tu variable de entorno.
// Asegúrate de que en tu archivo .env y en Netlify se llame GEMINI_API_KEY.
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("GEMINI_API_KEY no está configurada. Por favor, establece la variable de entorno.");
  // No es necesario continuar si la clave no está.
}

// Inicializa con tu clave. El '!' al final asume que la clave siempre existirá en este punto.
const genAI = new GoogleGenerativeAI(API_KEY!);

const MODEL_NAME = "gemini-pro";

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

  // El system instruction está perfecto, no necesita cambios.
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
    // 2. CAMBIO PRINCIPAL: Inicializa el modelo de esta manera.
    const model: GenerativeModel = genAI.getGenerativeModel({
        model: MODEL_NAME,
        systemInstruction: {
            role: "user", // El rol aquí debe ser 'user' o el que corresponda al prompt
            parts: [{ text: systemInstruction }],
        },
    });

    // 3. CAMBIO EN LA LLAMADA: Llama a generateContent desde el objeto 'model'.
    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: userInput }] }],
        generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
        }
    });

    const response = result.response;
    const jsonStr = response.text(); // El método para obtener el texto es text()

    if (!jsonStr) {
      throw new Error("La respuesta de Gemini está vacía.");
    }
    
    // Tu lógica para procesar el JSON está bien, no necesita cambios.
    const parsedData = JSON.parse(jsonStr) as GeminiParsedTransaction;

    // ... (el resto de tu lógica de validación se mantiene igual) ...
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
    // Tu manejo de errores está bien. Puedes simplificarlo si quieres.
    const detailedError = error instanceof Error ? error.message : JSON.stringify(error);
    throw new Error(`Falló el análisis de la transacción con IA. Por favor, inténtalo de nuevo o ingresa manualmente. Detalles: ${detailedError}`);
  }
};