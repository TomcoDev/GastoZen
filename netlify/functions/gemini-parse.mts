import type { Context, Config } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface ParseRequestBody {
  userInput: string;
  categoryNames: string[];
  today: string;
}

export default async (req: Request, context: Context) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get API key from environment variable (server-side only)
  const apiKey = Netlify.env.get("GEMINI_API_KEY");

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "API key not configured" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const body: ParseRequestBody = await req.json();
    const { userInput, categoryNames, today } = body;

    if (!userInput || !categoryNames || !today) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash"
    });

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

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error with Gemini API:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to parse transaction",
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

export const config: Config = {
  path: "/api/gemini-parse"
};
