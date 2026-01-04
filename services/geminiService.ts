import { Category, Account, GeminiParsedTransaction } from '../types';

export const parseTransactionWithGemini = async (
  userInput: string,
  categories: Category[],
  _accounts: Account[]
): Promise<GeminiParsedTransaction | null> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const categoryNames = categories.map(c => c.name);

    // Call the serverless function instead of the Gemini API directly
    const response = await fetch('/api/gemini-parse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userInput,
        categoryNames,
        today,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error from serverless function:", errorData.error);
      return null;
    }

    const data = await response.json();

    return {
      ...data,
      amount: Number(data.amount) || 0,
      date: data.date || today
    } as GeminiParsedTransaction;

  } catch (error) {
    console.error("Error parsing transaction:", error);
    return null;
  }
};