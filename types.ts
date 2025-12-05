
export type TransactionType = 'expense' | 'income' | 'transfer';
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  isCurrentUser?: boolean; // Local device flag
}

export interface Account {
  id: string;
  name: string;
  type: 'cash' | 'card' | 'bank' | 'savings';
  initialBalance: number;
  color: string;
  icon: string;
}

export interface Category {
  id: string;
  parentId?: string; // For subcategories
  name: string;
  icon: string; // Lucide icon name
  color: string; // Hex color
  type: 'expense' | 'income';
  budgetLimit?: number;
}

export interface Transaction {
  id: string;
  amount: number;
  categoryId?: string; // Optional for transfers
  accountId: string; // From account
  toAccountId?: string; // Only for transfers
  relatedBookId?: string; // For cross-book transfers
  date: string; // ISO string
  note?: string;
  tags?: string[];
  type: TransactionType;
  isRecurring?: boolean;
  createdBy?: string; // User ID
  updatedAt?: string; // ISO string for sync
}

export interface RecurringRule {
  id: string;
  amount: number;
  categoryId?: string;
  accountId: string;
  toAccountId?: string;
  type: TransactionType;
  note?: string;
  frequency: RecurringFrequency;
  startDate: string;
  nextRunDate: string;
  endDate?: string;
}

export interface Book {
  id: string;
  name: string;
  currency: string;
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  recurring: RecurringRule[];
  color?: string; // Wallet Theme Color
}

export interface SyncConfig {
  familyName: string;
  slot: 1 | 2;
  enabled: boolean;
}

export interface BackupConfig {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    provider: 'google_drive' | 'dropbox' | 'local' | null;
    lastBackupDate?: string;
}

export interface GlobalData {
  books: Book[];
  activeBookId: string;
  users: UserProfile[];
  deviceId: string; // Kept for legacy/fallback
  syncConfig?: SyncConfig;
  backupConfig?: BackupConfig;
}

// Helper types for UI
export interface CategorySummary {
  id: string;
  name: string;
  amount: number;
  color: string;
  budget?: number;
}
