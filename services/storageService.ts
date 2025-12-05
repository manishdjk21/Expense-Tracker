
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
        
        // Force Reload
        window.location.href = window.location.href;
    } catch (e) {
        console.error("Failed to reset data", e);
        alert("Failed to clear data completely. Please clear browser cache manually.");
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

// Intermediate structure for parsed rows
export interface ParsedCSVRow {
    date: Date;
    amount: number;
    type: TransactionType;
    category: string;
    subcategory: string;
    wallet: string;
    account: string;
    toAccount: string;
    currency: string;
    note: string;
    tags: string[];
}

export const parseCSV = async (file: File): Promise<ParsedCSVRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) { resolve([]); return; }

      try {
        const lines = text.split(/\r?\n/);
        const rows: ParsedCSVRow[] = [];
        
        // Auto-detect delimiter
        const sampleLine = lines.find(l => l.trim().length > 0) || '';
        const semiCount = (sampleLine.match(/;/g) || []).length;
        const commaCount = (sampleLine.match(/,/g) || []).length;
        const delimiter = semiCount > commaCount ? ';' : ',';

        const parseLine = (text: string) => {
            const result = [];
            let curr = '';
            let inQuote = false;
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                if (char === '"') {
                    inQuote = !inQuote;
                } else if (char === delimiter && !inQuote) {
                    result.push(curr.trim().replace(/^"|"$/g, ''));
                    curr = '';
                } else {
                    curr += char;
                }
            }
            result.push(curr.trim().replace(/^"|"$/g, ''));
            return result;
        };

        // Header Detection & Mapping
        let map = {
            wallet: -1,
            date: 0,
            category: 1,
            amount: 2,
            currency: -1,
            note: 3,
            type: 4,
            subcategory: -1, 
            account: -1,
            toAccount: -1,
            tags: 6
        };
        
        let startIndex = 0;

        if (lines.length > 0) {
            const headerRow = parseLine(lines[0].toLowerCase().trim());
            const hasDate = headerRow.some(h => h.includes('date'));
            
            if (hasDate) {
                startIndex = 1;
                map.wallet = headerRow.findIndex(h => h.includes('wallet') || h.includes('book'));
                map.date = headerRow.findIndex(h => h.includes('date'));
                map.amount = headerRow.findIndex(h => (h.includes('amount') || h.includes('value')) && !h.includes('target'));
                map.currency = headerRow.findIndex(h => h.includes('currency') && !h.includes('target'));
                map.category = headerRow.findIndex(h => h.includes('category') && !h.includes('sub'));
                map.subcategory = headerRow.findIndex(h => h.includes('subcategory'));
                map.account = headerRow.findIndex(h => h.includes('account') && !h.includes('to'));
                map.toAccount = headerRow.findIndex(h => h.includes('to account'));
                map.type = headerRow.findIndex(h => h.includes('type'));
                map.note = headerRow.findIndex(h => h.includes('note') || h.includes('description'));
                map.tags = headerRow.findIndex(h => h.includes('tag'));
            }
        }
        
        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const parts = parseLine(line);
          if (parts.length < 2) continue; 

          const dateStr = map.date > -1 ? parts[map.date] : '';
          const amountStr = map.amount > -1 ? parts[map.amount] : '';
          if (!amountStr || !dateStr) continue;

          const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, ''));
          if (isNaN(amount)) continue;

          // Smart Date Parsing
          let date = new Date(dateStr);
          if (isNaN(date.getTime())) {
              const dParts = dateStr.match(/(\d+)[/-](\d+)[/-](\d+)/);
              if (dParts) {
                  date = new Date(`${dParts[3]}-${dParts[2]}-${dParts[1]}`);
              }
          }
          if (isNaN(date.getTime())) continue; 

          let catName = map.category > -1 ? parts[map.category] : 'Uncategorized';
          let subCatName = map.subcategory > -1 ? parts[map.subcategory] : '';
          
          // Handle "Category: Subcategory" format
          if (!subCatName && catName.includes(':')) {
              const split = catName.split(':');
              catName = split[0].trim();
              subCatName = split[1].trim();
          } else if (!subCatName && catName.includes(' - ')) {
              const split = catName.split(' - ');
              catName = split[0].trim();
              subCatName = split[1].trim();
          }

          const typeStr = map.type > -1 ? parts[map.type]?.toLowerCase() : 'expense';
          const txType: TransactionType = typeStr.includes('income') ? 'income' : typeStr.includes('transfer') ? 'transfer' : 'expense';
          const wallet = map.wallet > -1 ? parts[map.wallet] : '';
          const account = map.account > -1 ? parts[map.account] : '';
          const toAccount = map.toAccount > -1 ? parts[map.toAccount] : '';
          const currency = map.currency > -1 ? parts[map.currency] : '';
          const note = map.note > -1 ? parts[map.note] : '';
          const tags = map.tags > -1 ? parts[map.tags].split(/[;,]/).map(t => t.trim()).filter(Boolean) : [];

          rows.push({
              date,
              amount: Math.abs(amount),
              type: txType,
              category: catName,
              subcategory: subCatName,
              wallet: wallet,
              account: account,
              toAccount: toAccount,
              currency: currency,
              note,
              tags
          });
        }
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (e) => reject(new Error("File reading failed"));
    reader.readAsText(file);
  });
};

export const mergeCSVData = (currentData: GlobalData, rows: ParsedCSVRow[], defaultBookId: string): { data: GlobalData, stats: string } => {
    // Deep clone to avoid direct mutation issues during loop
    const newData = JSON.parse(JSON.stringify(currentData));
    const stats = {
        walletsCreated: 0,
        txCreated: 0,
        catsCreated: 0
    };

    const activeBookName = newData.books.find((b: Book) => b.id === defaultBookId)?.name || "My Wallet";
    
    // Helpers
    const getOrCreateBook = (name: string, currency: string) => {
        let book = newData.books.find((b: Book) => b.name.toLowerCase() === name.toLowerCase());
        if (!book) {
            book = createNewBook(name, currency || DEFAULT_CURRENCY);
            newData.books.push(book);
            stats.walletsCreated++;
        }
        return book;
    };

    const getOrCreateAccount = (book: Book, accName: string) => {
        const normalizedName = accName || "Cash"; // Default to Cash if missing
        let acc = book.accounts.find((a: Account) => a.name.toLowerCase() === normalizedName.toLowerCase());
        if (!acc) {
            acc = {
                id: crypto.randomUUID(),
                name: normalizedName,
                type: 'cash',
                initialBalance: 0,
                color: AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)],
                icon: 'Wallet'
            };
            book.accounts.push(acc);
        }
        return acc;
    };

    const getOrCreateCategory = (book: Book, name: string, subName: string, type: TransactionType) => {
        // Parent
        let parent = book.categories.find((c: Category) => c.name.toLowerCase() === name.toLowerCase() && !c.parentId);
        if (!parent) {
            parent = {
                id: crypto.randomUUID(),
                name: name,
                type: type === 'transfer' ? 'expense' : type,
                color: AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)],
                icon: ICON_KEYS[Math.floor(Math.random() * ICON_KEYS.length)],
            };
            book.categories.push(parent);
            stats.catsCreated++;
        }

        // Subcategory
        if (subName) {
            let sub = book.categories.find((c: Category) => c.parentId === parent.id && c.name.toLowerCase() === subName.toLowerCase());
            if (!sub) {
                sub = {
                    id: crypto.randomUUID(),
                    name: subName,
                    type: parent.type,
                    parentId: parent.id,
                    color: parent.color,
                    icon: parent.icon
                };
                book.categories.push(sub);
                stats.catsCreated++;
            }
            return sub;
        }

        return parent;
    };

    rows.forEach(row => {
        const targetWalletName = row.wallet || activeBookName;
        const book = getOrCreateBook(targetWalletName, row.currency);
        const account = getOrCreateAccount(book, row.account);
        
        let toAccountId = undefined;
        if (row.type === 'transfer' && row.toAccount) {
            const toAcc = getOrCreateAccount(book, row.toAccount);
            toAccountId = toAcc.id;
        }

        const category = getOrCreateCategory(book, row.category, row.subcategory, row.type);

        const newTx: Transaction = {
             id: `imp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
             date: row.date.toISOString(),
             amount: row.amount,
             type: row.type,
             accountId: account.id,
             toAccountId: toAccountId,
             categoryId: row.type === 'transfer' ? undefined : category.id,
             note: row.note,
             tags: row.tags,
             updatedAt: new Date().toISOString()
        };

        book.transactions.push(newTx);
        stats.txCreated++;
    });

    const summary = `Import Complete!\n\nTransactions created: ${stats.txCreated}\nNew Wallets created: ${stats.walletsCreated}\nNew Categories created: ${stats.catsCreated}`;

    return { data: newData, stats: summary };
};
