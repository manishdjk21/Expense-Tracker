
import { Category, Account, Book } from './types';
import { 
  ShoppingBag, Utensils, Car, Home, Zap, HeartPulse, 
  Gamepad2, GraduationCap, Plane, Gift, Smartphone, 
  Briefcase, TrendingUp, PiggyBank, Wallet, CreditCard, 
  Landmark, RefreshCw, ArrowRightLeft, Calculator, Calendar,
  Coffee, ShoppingCart, Fuel, Bus, Wifi, Droplet, Pill,
  Music, Film, Camera, Baby, Dog, Hammer, BookOpen, Star
} from 'lucide-react';

export const DEFAULT_CURRENCY = '$';

export const AVAILABLE_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#84cc16', // Lime
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#d946ef', // Fuchsia
  '#f43f5e', // Rose
  '#64748b', // Slate
];

export const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'acc1', name: 'Cash', type: 'cash', initialBalance: 0, color: '#10b981', icon: 'Wallet' },
  { id: 'acc2', name: 'Card', type: 'card', initialBalance: 0, color: '#3b82f6', icon: 'CreditCard' },
  { id: 'acc3', name: 'Bank', type: 'bank', initialBalance: 0, color: '#6366f1', icon: 'Landmark' },
];

export const DEFAULT_CATEGORIES: Category[] = [
  // Expenses
  { id: 'c1', name: 'Food', icon: 'Utensils', color: '#fbbf24', type: 'expense', budgetLimit: 500 },
  { id: 'c1-1', parentId: 'c1', name: 'Groceries', icon: 'ShoppingCart', color: '#fbbf24', type: 'expense' },
  { id: 'c1-2', parentId: 'c1', name: 'Restaurant', icon: 'Utensils', color: '#fbbf24', type: 'expense' },
  { id: 'c1-3', parentId: 'c1', name: 'Coffee', icon: 'Coffee', color: '#fbbf24', type: 'expense' },

  { id: 'c2', name: 'Transport', icon: 'Car', color: '#60a5fa', type: 'expense', budgetLimit: 200 },
  { id: 'c2-1', parentId: 'c2', name: 'Fuel', icon: 'Fuel', color: '#60a5fa', type: 'expense' },
  { id: 'c2-2', parentId: 'c2', name: 'Public Transport', icon: 'Bus', color: '#60a5fa', type: 'expense' },
  { id: 'c2-3', parentId: 'c2', name: 'Maintenance', icon: 'Car', color: '#60a5fa', type: 'expense' },

  { id: 'c3', name: 'Shopping', icon: 'ShoppingBag', color: '#f472b6', type: 'expense' },
  { id: 'c3-1', parentId: 'c3', name: 'Clothes', icon: 'ShoppingBag', color: '#f472b6', type: 'expense' },
  { id: 'c3-2', parentId: 'c3', name: 'Electronics', icon: 'Smartphone', color: '#f472b6', type: 'expense' },

  { id: 'c4', name: 'Housing', icon: 'Home', color: '#34d399', type: 'expense', budgetLimit: 1000 },
  { id: 'c4-1', parentId: 'c4', name: 'Rent', icon: 'Home', color: '#34d399', type: 'expense' },
  { id: 'c4-2', parentId: 'c4', name: 'Maintenance', icon: 'Home', color: '#34d399', type: 'expense' },

  { id: 'c5', name: 'Bills', icon: 'Zap', color: '#a78bfa', type: 'expense' },
  { id: 'c5-1', parentId: 'c5', name: 'Internet', icon: 'Wifi', color: '#a78bfa', type: 'expense' },
  { id: 'c5-2', parentId: 'c5', name: 'Water/Electricity', icon: 'Droplet', color: '#a78bfa', type: 'expense' },

  { id: 'c6', name: 'Health', icon: 'HeartPulse', color: '#f87171', type: 'expense' },
  { id: 'c6-1', parentId: 'c6', name: 'Doctor', icon: 'HeartPulse', color: '#f87171', type: 'expense' },
  { id: 'c6-2', parentId: 'c6', name: 'Pharmacy', icon: 'Pill', color: '#f87171', type: 'expense' },

  { id: 'c7', name: 'Entertainment', icon: 'Gamepad2', color: '#818cf8', type: 'expense' },
  { id: 'c8', name: 'Education', icon: 'GraduationCap', color: '#fb923c', type: 'expense' },
  
  // Income
  { id: 'i1', name: 'Salary', icon: 'Briefcase', color: '#4ade80', type: 'income' },
  { id: 'i2', name: 'Investment', icon: 'TrendingUp', color: '#22d3ee', type: 'income' },
  { id: 'i3', name: 'Gifts', icon: 'Gift', color: '#e879f9', type: 'income' },
];

export const createNewBook = (name: string, currency: string): Book => ({
  id: crypto.randomUUID(),
  name,
  currency,
  transactions: [],
  categories: DEFAULT_CATEGORIES,
  accounts: DEFAULT_ACCOUNTS,
  recurring: [],
  color: AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)] // Random wallet color
});

export const ICON_MAP: Record<string, any> = {
  ShoppingBag, Utensils, Car, Home, Zap, HeartPulse, 
  Gamepad2, GraduationCap, Plane, Gift, Smartphone, 
  Briefcase, TrendingUp, PiggyBank, Wallet, CreditCard, 
  Landmark, RefreshCw, ArrowRightLeft, Calculator, Calendar,
  Coffee, ShoppingCart, Fuel, Bus, Wifi, Droplet, Pill,
  Music, Film, Camera, Baby, Dog, Hammer, BookOpen, Star
};

export const ICON_KEYS = Object.keys(ICON_MAP);
