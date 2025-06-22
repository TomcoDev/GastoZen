
export interface Category {
  id: string;
  name: string;
  color: string;
  type: 'income' | 'expense';
  icon?: string; // Optional: for icon representation
}

export interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit_card' | 'cash' | 'investment' | 'other';
  balance: number;
  color: string;
  icon?: string; // Optional
}

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  accountId: string;
  notes?: string;
}

export interface GeminiParsedTransaction {
  description: string;
  amount: number;
  type: TransactionType;
  categoryName?: string; // Gemini might suggest a category name
  date: string; // YYYY-MM-DD
  accountName?: string; // Gemini might suggest an account name
}

export interface GroundingChunkWeb {
  uri: string;
  title: string;
}

export interface GroundingChunk {
  web?: GroundingChunkWeb;
  // Other types of chunks can be added here if needed
}

export interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
  // Other grounding metadata fields
}
