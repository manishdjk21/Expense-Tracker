
import { GlobalData, Book, Transaction, Category, RecurringRule, TransactionType, Account } from '../types';
import { createNewBook, DEFAULT_CURRENCY, AVAILABLE_COLORS, ICON_KEYS, DEFAULT_ACCOUNTS } from '../constants';

export { createNewBook };

const STORAGE_KEY = 'onewallet_data_v2';

// Helper to migrate old v1 data to v2
const migrateData = (oldData: any): GlobalData => {
  const defaultBook = createNewBook("Personal", oldData.currency || DEFAULT_CURRENCY);
  
  if (oldData.transactions) {
    // Map old transactions to default account 'acc1' (Cash)
    defaultBook.transactions = oldData.transactions.map((t: any) => ({
      ...t,
      accountId: 'acc1', 
      tags: [],
      updatedAt: new Date().toISOString()
    }));
  }
  if (oldData.categories) {
    defaultBook.categories = oldData.categories;
  }

  const mainUser = { id: 'u1', name: 'Me', isCurrentUser: true };

  return {
    books: [defaultBook],
    activeBookId: defaultBook.id,
    users: [mainUser],
    deviceId: crypto.randomUUID()
  };
};

export const createDefaultData = (): GlobalData => {
  const initialBook = createNewBook("My Wallet", DEFAULT_CURRENCY);
  const mainUser = { id: 'u1', name: 'Me', isCurrentUser: true };
  
  return {
    books: [initialBook],
    activeBookId: initialBook.id,
    users: [mainUser],
    deviceId: crypto.randomUUID()
  };
};

export const resetAppData = () => {
    try {
        console.log("Resetting app data...");
        // Explicitly remove our key first
        localStorage.removeItem(STORAGE_KEY);
        // Then clear everything to be safe
        localStorage.clear();
        return true;
    } catch (e) {
        console.error("Failed to reset data", e);
        return false;
    }
};

export const clearAllTransactions = (): boolean => {
    try {
        const dataStr = localStorage.getItem(STORAGE_KEY);
        if (!dataStr) return false;
        
        const data: GlobalData = JSON.parse(dataStr);
        
        // Clear transactions in all books directly
        data.books = data.books.map(b => ({
            ...b,
            transactions: []
        }));
        
        // Save immediately to disk, bypassing React state
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
    } catch (e) {
        console.error("Failed to clear transactions", e);
        return false;
    }
};

export const clearIncomeExpenseTransactions = (): boolean => {
    try {
        const dataStr = localStorage.getItem(STORAGE_KEY);
        if (!dataStr) return false;
        
        const data: GlobalData = JSON.parse(dataStr);
        
        // Keep only transfers
        data.books = data.books.map(b => ({
            ...b,
            transactions: b.transactions.filter(t => t.type === 'transfer')
        }));
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
    } catch (e) {
        console.error("Failed to clear transactions", e);
        return false;
    }
};

export const loadData = (): GlobalData => {
  try {
    const dataStr = localStorage.getItem(STORAGE_KEY);
    // Check for old v1 data if v2 doesn't exist
    if (!dataStr) {
      const oldV1 = localStorage.getItem('onewallet_data_v1');
      if (oldV1) {
        const migrated = migrateData(JSON.parse(oldV1));
        saveData(migrated);
        return migrated;
      }
      return createDefaultData();
    }
    const parsed = JSON.parse(dataStr);
    
    // BACKWARD COMPATIBILITY
    // 1. Ensure users array
    if (!parsed.users) parsed.users = [{ id: 'u1', name: 'Me', isCurrentUser: true }];
    // 2. Ensure deviceId
    if (!parsed.deviceId) parsed.deviceId = crypto.randomUUID();
    // 3. Ensure books have colors
    parsed.books = parsed.books.map((b: Book) => {
        if (!b.color) {
            return { ...b, color: AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)] };
        }
        return b;
    });
    
    return parsed;
  } catch (e) {
    console.error("Failed to load data", e);
    return createDefaultData();
  }
};

export const saveData = (data: GlobalData) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save data", e);
  }
};

export const processRecurringTransactions = (data: GlobalData): GlobalData => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let dataChanged = false;
  const newBooks = data.books.map(book => {
    const newTx: Transaction[] = [];
    const updatedRecurring = book.recurring.map(rule => {
      const nextRun = new Date(rule.nextRunDate);
      nextRun.setHours(0, 0, 0, 0);

      if (nextRun <= today) {
        // Time to run!
        if (rule.endDate && new Date(rule.endDate) < nextRun) {
            return rule; // Expired
        }

        const tx: Transaction = {
          id: `rec-${Date.now()}-${Math.random()}`,
          amount: rule.amount,
          categoryId: rule.categoryId,
          accountId: rule.accountId,
          toAccountId: rule.toAccountId,
          date: nextRun.toISOString(),
          note: rule.note || 'Recurring',
          type: rule.type,
          isRecurring: true,
          tags: ['recurring'],
          updatedAt: new Date().toISOString()
        };
        newTx.push(tx);
        dataChanged = true;

        // Calculate next run
        const nextDate = new Date(nextRun);
        if (rule.frequency === 'daily') nextDate.setDate(nextDate.getDate() + 1);
        if (rule.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
        if (rule.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
        if (rule.frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);

        return { ...rule, nextRunDate: nextDate.toISOString() };
      }
      return rule;
    });

    if (newTx.length > 0) {
      return {
        ...book,
        transactions: [...book.transactions, ...newTx],
        recurring: updatedRecurring
      };
    }
    return book;
  });

  if (dataChanged) {
    const newData = { ...data, books: newBooks };
    saveData(newData);
    return newData;
  }
  return data;
};

export const exportDataToJSON = (data: GlobalData) => {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = `onewallet_backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(href);
};

export const exportTransactionsToCSV = (book: Book, allBooks: Book[] = []) => {
  // Added 'Wallet' as the first column
  const headers = ['Wallet', 'Date', 'Type', 'Amount', 'Currency', 'Category', 'Subcategory', 'Account', 'To Account', 'Target Amount', 'Target Currency', 'Note', 'Tags'];
  
  const rows = book.transactions.map(t => {
      let categoryName = '';
      let subCategoryName = '';
      
      if (t.categoryId) {
         const cat = book.categories.find(c => c.id === t.categoryId);
         if (cat) {
             if (cat.parentId) {
                 const parent = book.categories.find(p => p.id === cat.parentId);
                 categoryName = parent?.name || '';
                 subCategoryName = cat.name;
             } else {
                 categoryName = cat.name;
             }
         }
      }

      const account = book.accounts.find(a => a.id === t.accountId)?.name || 'Unknown';
      const toAccount = t.toAccountId ? (book.accounts.find(a => a.id === t.toAccountId)?.name || 'External') : '';
      
      let targetAmount = '';
      let targetCurrency = '';

      if (t.type === 'transfer' && t.relatedBookId && allBooks.length > 0) {
           const targetBook = allBooks.find(b => b.id === t.relatedBookId);
           if (targetBook) {
               targetCurrency = targetBook.currency;
               // Try to find paired transaction: Same date, same type, related to this book
               const pair = targetBook.transactions.find(tx => 
                   tx.relatedBookId === book.id && 
                   tx.date === t.date && 
                   tx.type === 'transfer'
               );
               if (pair) {
                   targetAmount = pair.amount.toString();
               }
           }
      }

      const note = (t.note || '').replace(/"/g, '""'); 
      const tags = (t.tags || []).join(';');
      
      return [
          `"${book.name}"`, // Wallet Name
          `"${t.date}"`,
          `"${t.type}"`,
          t.amount,
          `"${book.currency}"`,
          `"${categoryName}"`,
          `"${subCategoryName}"`,
          `"${account}"`,
          `"${toAccount}"`,
          targetAmount,
          `"${targetCurrency}"`,
          `"${note}"`,
          `"${tags}"`
      ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = `onewallet_export_${book.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(href);
};
