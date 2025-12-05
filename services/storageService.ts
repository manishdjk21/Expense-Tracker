
import { GlobalData, Book, Transaction, Category, RecurringRule, TransactionType, Account } from '../types';
import { createNewBook, DEFAULT_CURRENCY, AVAILABLE_COLORS, ICON_KEYS, DEFAULT_ACCOUNTS, ICON_MAP, DEFAULT_CATEGORIES } from '../constants';

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
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('onewallet_data_v1'); // Remove legacy key
        localStorage.clear(); // Nuclear option to be sure
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

export const exportTransactionsToCSV = (primaryBook: Book, allBooks: Book[] = []) => {
  // If allBooks provided, export all. Otherwise just the single book.
  const booksToExport = allBooks.length > 0 ? allBooks : [primaryBook];
  
  // Added 'Target Wallet' column
  const headers = ['Wallet', 'Date', 'Type', 'Amount', 'Currency', 'Category', 'Subcategory', 'Account', 'Target Wallet', 'To Account', 'Target Amount', 'Target Currency', 'Note', 'Tags'];
  
  let allRows: string[] = [];

  booksToExport.forEach(b => {
      const rows = b.transactions.map(t => {
          let categoryName = '';
          let subCategoryName = '';
          
          if (t.categoryId) {
             const cat = b.categories.find(c => c.id === t.categoryId);
             if (cat) {
                 if (cat.parentId) {
                     const parent = b.categories.find(p => p.id === cat.parentId);
                     categoryName = parent?.name || '';
                     subCategoryName = cat.name;
                 } else {
                     categoryName = cat.name;
                 }
             }
          }

          const account = b.accounts.find(a => a.id === t.accountId)?.name || 'Unknown';
          
          // Target Details
          let targetWallet = '';
          let toAccount = '';
          let targetAmount = '';
          let targetCurrency = '';

          if (t.type === 'transfer') {
              // 1. Determine Target Book/Wallet
              let targetBook: Book | undefined;
              
              if (t.relatedBookId) {
                  targetBook = allBooks.find(bk => bk.id === t.relatedBookId);
              } else {
                  // Internal transfer or implicit within same book
                  targetBook = b;
              }

              // 2. Resolve Account Name and Wallet Name if we can find the account explicitly
              if (t.toAccountId) {
                  // Try to find account in the assumed target book first
                  let acc = targetBook?.accounts.find(a => a.id === t.toAccountId);
                  
                  // If not found, search all books (maybe data inconsistency or implicit cross-book)
                  if (!acc && allBooks.length > 0) {
                      for (const curr of allBooks) {
                          acc = curr.accounts.find(a => a.id === t.toAccountId);
                          if (acc) {
                              targetBook = curr;
                              break;
                          }
                      }
                  }

                  if (acc) {
                      toAccount = acc.name;
                      targetWallet = targetBook?.name || '';
                  } else {
                      toAccount = 'Unknown';
                      targetWallet = targetBook?.name || '';
                  }
              }

              // 3. Resolve Target Amount/Currency
              if (targetBook) {
                   targetCurrency = targetBook.currency;
                   // Try to find paired transaction
                   if (targetBook.id !== b.id) {
                        const pair = targetBook.transactions.find(tx => 
                            tx.relatedBookId === b.id && 
                            Math.abs(new Date(tx.date).getTime() - new Date(t.date).getTime()) < 5000 && // rough sync buffer
                            tx.type === 'transfer'
                        );
                        if (pair) {
                            targetAmount = pair.amount.toString();
                        }
                   }
              }
          }

          const note = (t.note || '').replace(/"/g, '""'); 
          const tags = (t.tags || []).join(';');
          
          return [
              `"${b.name}"`, // Wallet Name
              `"${t.date}"`,
              `"${t.type}"`,
              t.amount,
              `"${b.currency}"`,
              `"${categoryName}"`,
              `"${subCategoryName}"`,
              `"${account}"`,
              `"${targetWallet}"`, // New Column
              `"${toAccount}"`,
              targetAmount,
              `"${targetCurrency}"`,
              `"${note}"`,
              `"${tags}"`
          ].join(',');
      });
      allRows = [...allRows, ...rows];
  });

  const csvContent = [headers.join(','), ...allRows].join('\n');
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  
  const fileNamePrefix = booksToExport.length > 1 ? 'onewallet_full_export' : `onewallet_export_${booksToExport[0].name.replace(/\s+/g, '_')}`;
  link.download = `${fileNamePrefix}_${new Date().toISOString().split('T')[0]}.csv`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(href);
};

// --- CSV IMPORT UTILITIES ---

// Basic CSV Line Parser dealing with quotes
const parseCSVLine = (line: string): string[] => {
    const result = [];
    let startValueIndex = 0;
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
            inQuotes = !inQuotes;
        } else if (line[i] === ',' && !inQuotes) {
            let val = line.substring(startValueIndex, i).trim();
            // Remove surrounding quotes if present
            if (val.startsWith('"') && val.endsWith('"')) {
                val = val.substring(1, val.length - 1).replace(/""/g, '"');
            }
            result.push(val);
            startValueIndex = i + 1;
        }
    }
    // Push last value
    let lastVal = line.substring(startValueIndex).trim();
    if (lastVal.startsWith('"') && lastVal.endsWith('"')) {
        lastVal = lastVal.substring(1, lastVal.length - 1).replace(/""/g, '"');
    }
    result.push(lastVal);
    return result;
};

export const processCSVImport = (csvText: string, currentData: GlobalData): { data: GlobalData, count: number } => {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) return { data: currentData, count: 0 };

    // 1. Identify Headers
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[\s_"]/g, ''));
    
    // Map headers to standard keys
    const mapIndex: Record<string, number> = {};
    headers.forEach((h, i) => {
        if (h.includes('date')) mapIndex['date'] = i;
        else if (h.includes('amount') && !h.includes('target')) mapIndex['amount'] = i;
        else if (h.includes('subcategory')) mapIndex['subcategory'] = i;
        else if (h.includes('category')) mapIndex['category'] = i;
        else if (h.includes('note') || h.includes('desc')) mapIndex['note'] = i;
        else if (h.includes('tag')) mapIndex['tags'] = i;
        else if (h.includes('account') && !h.includes('to')) mapIndex['account'] = i; // Source account only
        else if (h.includes('wallet') || h.includes('book')) mapIndex['wallet'] = i;
        else if (h.includes('currency') && !h.includes('target')) mapIndex['currency'] = i;
        else if (h.includes('type')) mapIndex['type'] = i; // expense/income/transfer
    });

    if (mapIndex['date'] === undefined || mapIndex['amount'] === undefined) {
        throw new Error("CSV must contain at least 'Date' and 'Amount' columns.");
    }

    let updatedBooks = [...currentData.books];
    let importCount = 0;

    // 2. Process Rows
    for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        if (row.length < headers.length) continue;

        const dateStr = row[mapIndex['date']];
        const amountStr = row[mapIndex['amount']];
        
        let date = new Date(dateStr);
        if (isNaN(date.getTime())) date = new Date(); // Fallback to today

        let amount = parseFloat(amountStr.replace(/[^0-9.-]/g, ''));
        if (isNaN(amount)) continue;

        // Determine Type
        let type: TransactionType = 'expense';
        const typeStr = mapIndex['type'] !== undefined ? row[mapIndex['type']].toLowerCase() : '';
        if (typeStr.includes('inc') || typeStr.includes('credit') || amount > 0) type = 'income';
        if (typeStr.includes('exp') || typeStr.includes('debit') || amount < 0) type = 'expense';
        if (typeStr.includes('trans')) type = 'transfer';
        
        // Handle signed amounts in CSV where usually expenses are negative
        if (mapIndex['type'] === undefined) {
             if (amount < 0) {
                 type = 'expense';
                 amount = Math.abs(amount);
             } else {
                 type = 'income';
             }
        } else {
            amount = Math.abs(amount);
        }

        // Wallet Logic
        let walletName = mapIndex['wallet'] !== undefined ? row[mapIndex['wallet']] : 'Imported Wallet';
        if (!walletName) walletName = updatedBooks[0].name; // Default to first book if empty
        
        let bookIndex = updatedBooks.findIndex(b => b.name.toLowerCase() === walletName.toLowerCase());
        
        if (bookIndex === -1) {
            // Create New Book
            const currency = mapIndex['currency'] !== undefined ? row[mapIndex['currency']] : DEFAULT_CURRENCY;
            const newBook = createNewBook(walletName, currency || '$');
            updatedBooks.push(newBook);
            bookIndex = updatedBooks.length - 1;
        }

        const book = updatedBooks[bookIndex];

        // Account Logic
        let accountName = mapIndex['account'] !== undefined ? row[mapIndex['account']] : 'Cash';
        if (!accountName) accountName = 'Cash';
        let accountId = book.accounts.find(a => a.name.toLowerCase() === accountName.toLowerCase())?.id;
        
        if (!accountId) {
            // Create New Account
            const newAcc: Account = {
                id: crypto.randomUUID(),
                name: accountName,
                type: 'cash',
                initialBalance: 0,
                color: AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)],
                icon: 'Wallet'
            };
            book.accounts.push(newAcc);
            accountId = newAcc.id;
        }

        // Category Logic
        let categoryId: string | undefined = undefined;
        if (type !== 'transfer') {
            const catName = mapIndex['category'] !== undefined ? row[mapIndex['category']] : 'Uncategorized';
            const subCatName = mapIndex['subcategory'] !== undefined ? row[mapIndex['subcategory']] : '';
            
            // Find Main Category
            let mainCat = book.categories.find(c => c.name.toLowerCase() === catName.toLowerCase() && !c.parentId && c.type === type);
            
            if (!mainCat && catName) {
                mainCat = {
                    id: crypto.randomUUID(),
                    name: catName,
                    icon: 'ShoppingBag',
                    color: AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)],
                    type: type as 'expense' | 'income'
                };
                book.categories.push(mainCat);
            }

            if (mainCat) {
                if (subCatName) {
                    // Find Subcategory
                    let subCat = book.categories.find(c => c.parentId === mainCat!.id && c.name.toLowerCase() === subCatName.toLowerCase());
                    if (!subCat) {
                        subCat = {
                            id: crypto.randomUUID(),
                            parentId: mainCat.id,
                            name: subCatName,
                            icon: mainCat.icon,
                            color: mainCat.color,
                            type: type as 'expense' | 'income'
                        };
                        book.categories.push(subCat);
                    }
                    categoryId = subCat.id;
                } else {
                    categoryId = mainCat.id;
                }
            }
        }

        // Create Transaction
        const newTx: Transaction = {
            id: crypto.randomUUID(),
            amount: amount,
            date: date.toISOString(),
            type: type,
            accountId: accountId,
            categoryId: categoryId,
            note: mapIndex['note'] !== undefined ? row[mapIndex['note']] : '',
            tags: mapIndex['tags'] !== undefined ? row[mapIndex['tags']].split(';').map(s => s.trim()).filter(s => s) : [],
            updatedAt: new Date().toISOString()
        };

        book.transactions.push(newTx);
        importCount++;
    }

    return { 
        data: { ...currentData, books: updatedBooks },
        count: importCount
    };
};
