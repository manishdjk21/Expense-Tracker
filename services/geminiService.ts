
import { GoogleGenAI } from "@google/genai";
import { Book } from '../types';

const getClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({ apiKey });
}

export const generateInsights = async (book: Book): Promise<string> => {
  const ai = getClient();
  if (!ai) return "API Key not configured.";

  const recentTransactions = book.transactions
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 50);

  const summary = recentTransactions.map(t => {
    if (t.type === 'transfer') return `${t.date.split('T')[0]}: Transfer of ${t.amount}`;
    const cat = book.categories.find(c => c.id === t.categoryId);
    return `${t.date.split('T')[0]}: ${t.type} of ${t.amount} for ${cat?.name || 'Unknown'}`;
  }).join('\n');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a financial advisor for the book "${book.name}" (${book.currency}). 
      Here are the last 50 transactions:
      ${summary}
      
      Provide a brief, encouraging, and actionable summary (max 3 sentences) of spending habits. 
      Point out if they are within budgets or overspending. Talk directly to the user.`,
    });
    return response.text || "Could not generate insights.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Unable to connect to AI service.";
  }
};
