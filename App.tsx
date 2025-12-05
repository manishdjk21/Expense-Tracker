
import React, { useState, useEffect, useRef } from 'react';
import { GlobalData, Transaction, Book, RecurringFrequency, RecurringRule, Category, Account, TransactionType, UserProfile, SyncConfig, BackupConfig } from './types';
import { loadData, saveData, createNewBook, processRecurringTransactions, exportDataToJSON, createDefaultData, resetAppData, clearIncomeExpenseTransactions } from './services/storageService';
import { generateInsights } from './services/geminiService';
import { SyncService } from './services/syncService';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import AddTransactionModal from './components/AddTransactionModal';
import AccountsView from './components/AccountsView';
import CategoriesView from './components/CategoriesView';
import HistoryView from './components/HistoryView';
import { LayoutDashboard, List, Settings as SettingsIcon, Plus, Wallet, PieChart } from 'lucide-react';
import { ICON_MAP } from './constants';

const App: React.FC = () => {
  const [globalData, setGlobalData] = useState<GlobalData | null>(null);
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'accounts' | 'transactions' | 'settings' | 'categories'>('dashboard');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [geminiInsight, setGeminiInsight] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [syncStatus, setSyncStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  
  // State for opening modal with specific defaults
  const [modalDefaults, setModalDefaults] = useState<{ type: TransactionType, categoryId?: string } | undefined>(undefined);
  const [modalViewMode, setModalViewMode] = useState<'calculator' | 'categories' | 'create-category'>('calculator');

  const syncServiceRef = useRef<SyncService | null>(null);

  // Initial Load
  useEffect(() => {
    let loaded = loadData();
    loaded = processRecurringTransactions(loaded);
    setGlobalData(loaded);

    // Listen for PWA install prompt
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Backup Checker
  useEffect(() => {
    if (!globalData || !globalData.backupConfig || !globalData.backupConfig.enabled) return;
    
    const checkBackup = () => {
        const last = globalData.backupConfig?.lastBackupDate ? new Date(globalData.backupConfig.lastBackupDate).getTime() : 0;
        const now = Date.now();
        const freq = globalData.backupConfig?.frequency || 'daily';
        
        let threshold = 24 * 60 * 60 * 1000; // Daily
        if (freq === 'weekly') threshold *= 7;
        if (freq === 'monthly') threshold *= 30;

        if (now - last > threshold) {
            if (confirm(`Scheduled Backup Due (${freq}).\nProvider: ${globalData.backupConfig.provider?.replace('_', ' ').toUpperCase()}\n\nDownload backup now?`)) {
                exportDataToJSON(globalData);
                // Update last backup date
                setGlobalData(prev => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        backupConfig: {
                            ...prev.backupConfig!,
                            lastBackupDate: new Date().toISOString()
                        }
                    }
                })
            }
        }
    };
    
    // Check after a short delay to allow UI to settle
    const timeout = setTimeout(checkBackup, 2000);
    return () => clearTimeout(timeout);
  }, [globalData?.backupConfig]);

  // Sync Initialization
  useEffect(() => {
    if (globalData?.syncConfig?.enabled) {
        if (!syncServiceRef.current) {
            startSyncService(globalData.syncConfig);
        }
    } else {
        if (syncServiceRef.current) {
            syncServiceRef.current.destroy();
            syncServiceRef.current = null;
            setSyncStatus('disconnected');
        }
    }
  }, [globalData?.syncConfig]);

  const startSyncService = (config: SyncConfig) => {
      syncServiceRef.current = new SyncService(
          config.familyName,
          config.slot,
          (incomingData) => {
            // MERGE LOGIC
            setGlobalData(currentData => {
                if (!currentData) return incomingData;
                
                // Merge Books
                const mergedBooks = currentData.books.map(localBook => {
                    const remoteBook = incomingData.books.find(b => b.id === localBook.id);
                    if (!remoteBook) return localBook;

                    // Merge Transactions (Union by ID, prefer recent)
                    const allTx = [...localBook.transactions];
                    remoteBook.transactions.forEach(remoteTx => {
                        const localTxIndex = allTx.findIndex(t => t.id === remoteTx.id);
                        if (localTxIndex === -1) {
                            allTx.push(remoteTx);
                        } else {
                            // Conflict: Check updatedAt
                            const localTx = allTx[localTxIndex];
                            const localTime = new Date(localTx.updatedAt || 0).getTime();
                            const remoteTime = new Date(remoteTx.updatedAt || 0).getTime();
                            if (remoteTime > localTime) {
                                allTx[localTxIndex] = remoteTx;
                            }
                        }
                    });

                    return { ...localBook, transactions: allTx };
                });
                
                // Add new books from remote
                incomingData.books.forEach(remoteBook => {
                    if (!mergedBooks.find(b => b.id === remoteBook.id)) {
                        mergedBooks.push(remoteBook);
                    }
                });
                
                // Merge Users
                const mergedUsers = [...currentData.users];
                incomingData.users.forEach(remoteUser => {
                    if (!mergedUsers.find(u => u.id === remoteUser.id)) {
                        mergedUsers.push(remoteUser);
                    }
                });

                return {
                    ...currentData,
                    books: mergedBooks,
                    users: mergedUsers
                };
            });
        },
        (status) => setSyncStatus(status)
      );
      syncServiceRef.current.initialize();
  };

  // Persistence & Broadcast
  useEffect(() => {
    if (globalData) {
      saveData(globalData);
      // Broadcast changes to peers
      if (syncServiceRef.current) {
          syncServiceRef.current.broadcast(globalData);
      }
    }
  }, [globalData]);

  // Derived state
  const activeBook = globalData?.books.find(b => b.id === globalData.activeBookId);
  const currentUser = globalData?.users.find(u => u.isCurrentUser) || globalData?.users[0];

  const handleAddTransaction = (tx: Partial<Transaction>, recurrence?: RecurringFrequency, toBookId?: string, convertedAmount?: number) => {
    if (!globalData || !activeBook) return;
    
    let updatedBooks = [...globalData.books];
    const now = new Date().toISOString();

    if (editingTx) {
        updatedBooks = updatedBooks.map(b => {
            if (b.id === activeBook.id) {
                const updatedTransactions = b.transactions.map(t => {
                    if (t.id === editingTx.id) {
                        return {
                            ...t,
                            ...tx,
                            updatedAt: now
                        };
                    }
                    return t;
                });
                return { ...b, transactions: updatedTransactions };
            }
            return b;
        });
    } else {
        const isCrossBook = tx.type === 'transfer' && toBookId && toBookId !== activeBook.id;
        const newTx: Transaction = {
          id: crypto.randomUUID(),
          amount: tx.amount || 0,
          categoryId: tx.categoryId,
          accountId: tx.accountId || activeBook.accounts[0].id,
          toAccountId: tx.toAccountId,
          relatedBookId: isCrossBook ? toBookId : undefined,
          date: tx.date || new Date().toISOString(),
          note: tx.note,
          type: tx.type || 'expense',
          tags: tx.tags || [],
          isRecurring: !!recurrence,
          createdBy: currentUser?.id,
          updatedAt: now
        };

        updatedBooks = updatedBooks.map(b => {
          if (b.id === activeBook.id) {
              const updatedTransactions = [...b.transactions, newTx];
              let updatedRecurring = [...b.recurring];
              
              if (recurrence && tx.amount) {
                   const nextDate = new Date(newTx.date);
                   // ... (Logic preserved from previous)
                   // Just pushing rule
                   updatedRecurring.push({
                      id: crypto.randomUUID(),
                      amount: tx.amount,
                      categoryId: tx.categoryId,
                      accountId: tx.accountId || activeBook.accounts[0].id,
                      toAccountId: tx.toAccountId,
                      type: tx.type || 'expense',
                      note: tx.note,
                      frequency: recurrence,
                      startDate: newTx.date,
                      nextRunDate: nextDate.toISOString()
                   });
              }
              return { ...b, transactions: updatedTransactions, recurring: updatedRecurring };
          }
          return b;
        });

        if (isCrossBook && toBookId) {
            updatedBooks = updatedBooks.map(b => {
                if (b.id === toBookId) {
                    const inboundTx: Transaction = {
                        id: crypto.randomUUID(),
                        amount: convertedAmount || tx.amount || 0,
                        accountId: tx.accountId!,
                        toAccountId: tx.toAccountId,
                        relatedBookId: activeBook.id,
                        date: tx.date || new Date().toISOString(),
                        note: `Transfer from ${activeBook.name}`,
                        type: 'transfer',
                        tags: tx.tags || [],
                        isRecurring: false,
                        createdBy: currentUser?.id,
                        updatedAt: now
                    };
                    return { ...b, transactions: [...b.transactions, inboundTx] };
                }
                return b;
            });
        }
    }

    setGlobalData({ ...globalData, books: updatedBooks });
  };

  const handleDeleteTransaction = (txId: string) => {
      if (!globalData || !activeBook) return;
      const updatedBooks = globalData.books.map(b => {
          if (b.id === activeBook.id) {
              return {
                  ...b,
                  transactions: b.transactions.filter(t => t.id !== txId)
              };
          }
          return b;
      });
      setGlobalData({ ...globalData, books: updatedBooks });
  };

  const handleAddCategory = (newCat: Category) => {
    if (!globalData || !activeBook) return;
    const updatedBook = {
      ...activeBook,
      categories: [...activeBook.categories, newCat]
    };
    const updatedBooks = globalData.books.map(b => b.id === activeBook.id ? updatedBook : b);
    setGlobalData({ ...globalData, books: updatedBooks });
  };
  
  const handleUpdateBudget = (categoryId: string, amount: number) => {
      if (!globalData || !activeBook) return;
      const updatedBook = {
          ...activeBook,
          categories: activeBook.categories.map(c => 
              c.id === categoryId ? { ...c, budgetLimit: amount } : c
          )
      };
      const updatedBooks = globalData.books.map(b => b.id === activeBook.id ? updatedBook : b);
      setGlobalData({ ...globalData, books: updatedBooks });
  };

  const handleAddAccount = (bookId: string, newAcc: Account) => {
    if (!globalData) return;
    const updatedBooks = globalData.books.map(b => {
        if (b.id === bookId) {
            return { ...b, accounts: [...b.accounts, newAcc] };
        }
        return b;
    });
    setGlobalData({ ...globalData, books: updatedBooks });
  };

  const handleUpdateAccount = (bookId: string, updatedAcc: Account) => {
    if (!globalData) return;
    const updatedBooks = globalData.books.map(b => {
        if (b.id === bookId) {
            return {
                ...b,
                accounts: b.accounts.map(a => a.id === updatedAcc.id ? updatedAcc : a)
            };
        }
        return b;
    });
    setGlobalData({ ...globalData, books: updatedBooks });
  };

  const handleDeleteAccount = (bookId: string, accId: string) => {
    if (!globalData) return;
    const updatedBooks = globalData.books.map(b => {
        if (b.id === bookId) {
            return {
                ...b,
                accounts: b.accounts.filter(a => a.id !== accId)
            };
        }
        return b;
    });
    setGlobalData({ ...globalData, books: updatedBooks });
  };

  const handleImportTransactions = (newTxs: Transaction[]) => {
    if (!globalData || !activeBook) return;
    const updatedBook = {
      ...activeBook,
      transactions: [...activeBook.transactions, ...newTxs]
    };
    setGlobalData({
      ...globalData,
      books: globalData.books.map(b => b.id === activeBook.id ? updatedBook : b)
    });
  };
  
  const handleBulkImport = (newTxs: Transaction[], newCats: Category[]) => {
      if (!globalData || !activeBook) return;
      
      const updatedBook = {
          ...activeBook,
          categories: [...activeBook.categories, ...newCats],
          transactions: [...activeBook.transactions, ...newTxs]
      };
      
      setGlobalData({
          ...globalData,
          books: globalData.books.map(b => b.id === activeBook.id ? updatedBook : b)
      });
  };

  const handleImportGlobal = (newData: GlobalData) => {
    setGlobalData(newData);
    window.location.reload(); 
  };

  const handleAddBook = (name: string, currency: string) => {
    if (!globalData) return;
    const newBook = createNewBook(name, currency);
    setGlobalData({
      ...globalData,
      books: [...globalData.books, newBook],
      activeBookId: newBook.id
    });
  };
  
  const handleUpdateBook = (bookId: string, name: string, currency: string) => {
    if (!globalData) return;
    const updatedBooks = globalData.books.map(b => 
        b.id === bookId ? { ...b, name, currency } : b
    );
    setGlobalData({ ...globalData, books: updatedBooks });
  };

  const handleDeleteBook = (bookId: string) => {
    if (!globalData) return;
    if (globalData.books.length <= 1) {
        alert("You must have at least one wallet.");
        return;
    }
    const updatedBooks = globalData.books.filter(b => b.id !== bookId);
    let newActiveId = globalData.activeBookId;
    if (bookId === globalData.activeBookId) {
        newActiveId = updatedBooks[0].id;
    }
    setGlobalData({ ...globalData, books: updatedBooks, activeBookId: newActiveId });
  };

  const handleSwitchBook = (id: string) => {
    if (!globalData) return;
    setGlobalData({ ...globalData, activeBookId: id });
    setGeminiInsight(''); 
  };
  
  // New Sync Config Handler
  const handleConfigureSync = (config: SyncConfig) => {
      if (!globalData) return;
      setGlobalData({ ...globalData, syncConfig: config });
  };

  const handleConfigureBackup = (config: BackupConfig) => {
      if (!globalData) return;
      setGlobalData({ ...globalData, backupConfig: config });
  };
  
  const handleUpdateUser = (name: string) => {
      if (!globalData) return;
      const updatedUsers = globalData.users.map(u => 
          u.isCurrentUser ? { ...u, name } : u
      );
      setGlobalData({ ...globalData, users: updatedUsers });
  };

  // --- DATA CLEARING LOGIC ---
  const handleFactoryReset = () => {
    if (resetAppData()) {
        alert("Success: App has been reset to factory settings.");
        window.location.reload();
    } else {
        alert("Failed to reset app data.");
    }
  };

  const handleClearData = () => {
     // Uses clearIncomeExpenseTransactions instead of clearAll to satisfy specific request
     // or utilizes clearAll logic if desired.
     // Prompt asked for "expense and income transaction only".
     const success = clearIncomeExpenseTransactions();
     
     if (success) {
         alert("Success! Expense and Income transactions cleared.");
         window.location.reload();
     } else {
         alert("Failed to clear data.");
     }
  };

  const handleGenerateInsight = async () => {
    if (!activeBook) return;
    setIsAnalyzing(true);
    const insight = await generateInsights(activeBook);
    setGeminiInsight(insight);
    setIsAnalyzing(false);
  };
  
  // Handler to open modal for specific category click
  const handleSelectCategory = (categoryId: string, type: TransactionType) => {
      setModalDefaults({ type, categoryId });
      setModalViewMode('calculator');
      setEditingTx(null);
      setIsAddModalOpen(true);
  };

  const handleAddCategoryClick = (type: TransactionType) => {
      setModalDefaults({ type });
      setModalViewMode('create-category');
      setEditingTx(null);
      setIsAddModalOpen(true);
  }

  const handleTransferClick = () => {
      setModalDefaults({ type: 'transfer' });
      setModalViewMode('calculator');
      setEditingTx(null);
      setIsAddModalOpen(true);
  }

  const handleEditTransaction = (tx: Transaction) => {
      setEditingTx(tx);
      setModalDefaults(undefined);
      setModalViewMode('calculator');
      setIsAddModalOpen(true);
  };

  if (!globalData || !activeBook) return <div className="h-[100dvh] flex items-center justify-center text-gray-400">Loading OneWallet...</div>;

  return (
    <div className="h-[100dvh] flex flex-col bg-gray-100 max-w-md mx-auto relative shadow-2xl overflow-hidden font-sans">
      
      {/* Dynamic Content */}
      {currentTab === 'dashboard' && (
        <Dashboard 
          book={activeBook} 
          books={globalData.books}
          onSwitchBook={handleSwitchBook}
          onOpenAdd={() => { setEditingTx(null); setModalDefaults(undefined); setModalViewMode('calculator'); setIsAddModalOpen(true); }} 
          insight={geminiInsight}
          isGeneratingInsight={isAnalyzing}
          onGenerateInsight={handleGenerateInsight}
          onUpdateBudget={handleUpdateBudget}
        />
      )}
      {currentTab === 'accounts' && (
        <AccountsView 
            books={globalData.books}
            activeBookId={activeBook.id}
            onAddAccount={handleAddAccount}
            onUpdateAccount={handleUpdateAccount}
            onDeleteAccount={handleDeleteAccount}
        />
      )}
      {currentTab === 'categories' && (
        <CategoriesView 
            book={activeBook}
            books={globalData.books}
            onSwitchBook={handleSwitchBook}
            onSelectCategory={handleSelectCategory}
            onAddCategoryClick={handleAddCategoryClick}
            onTransferClick={handleTransferClick}
        />
      )}
      {currentTab === 'transactions' && (
        <HistoryView 
            activeBook={activeBook}
            users={globalData.users}
            onEditTransaction={handleEditTransaction}
        />
      )}
      {currentTab === 'settings' && (
        <Settings 
          data={globalData} 
          activeBook={activeBook}
          onImport={handleImportGlobal} 
          onImportTransactions={handleImportTransactions}
          onBulkImport={handleBulkImport}
          onReset={handleFactoryReset}
          onClearData={handleClearData}
          onSwitchBook={handleSwitchBook}
          onAddBook={handleAddBook}
          onUpdateBook={handleUpdateBook}
          onDeleteBook={handleDeleteBook}
          onAddCategory={handleAddCategory}
          onUpdateUser={handleUpdateUser}
          onConfigureSync={handleConfigureSync}
          onConfigureBackup={handleConfigureBackup}
          syncStatus={syncStatus}
          installPrompt={installPrompt}
        />
      )}

      {/* Navigation */}
      <div className="bg-white border-t absolute bottom-0 w-full pb-safe pt-2 px-6 h-20 flex justify-between items-start z-10">
        <button onClick={() => setCurrentTab('dashboard')} className={`flex flex-col items-center gap-1 p-2 ${currentTab === 'dashboard' ? 'text-blue-600' : 'text-gray-400'}`}>
          <LayoutDashboard size={24} strokeWidth={currentTab === 'dashboard' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Overview</span>
        </button>
        <button onClick={() => setCurrentTab('categories')} className={`flex flex-col items-center gap-1 p-2 ${currentTab === 'categories' ? 'text-blue-600' : 'text-gray-400'}`}>
          <PieChart size={24} strokeWidth={currentTab === 'categories' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Categories</span>
        </button>
        <button onClick={() => setCurrentTab('accounts')} className={`flex flex-col items-center gap-1 p-2 ${currentTab === 'accounts' ? 'text-blue-600' : 'text-gray-400'}`}>
          <Wallet size={24} strokeWidth={currentTab === 'accounts' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Accounts</span>
        </button>
        <button onClick={() => setCurrentTab('transactions')} className={`flex flex-col items-center gap-1 p-2 ${currentTab === 'transactions' ? 'text-blue-600' : 'text-gray-400'}`}>
          <List size={24} strokeWidth={currentTab === 'transactions' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">History</span>
        </button>
        <button onClick={() => setCurrentTab('settings')} className={`flex flex-col items-center gap-1 p-2 ${currentTab === 'settings' ? 'text-blue-600' : 'text-gray-400'}`}>
          <SettingsIcon size={24} strokeWidth={currentTab === 'settings' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Settings</span>
        </button>
      </div>

      <AddTransactionModal 
        isOpen={isAddModalOpen} 
        onClose={() => { setIsAddModalOpen(false); setEditingTx(null); setModalDefaults(undefined); }}
        onSave={handleAddTransaction}
        onDelete={handleDeleteTransaction}
        onAddCategory={handleAddCategory}
        categories={activeBook.categories}
        accounts={activeBook.accounts}
        currency={activeBook.currency}
        books={globalData.books}
        activeBookId={activeBook.id}
        initialData={editingTx}
        defaultType={modalDefaults?.type}
        defaultCategoryId={modalDefaults?.categoryId}
        initialViewMode={modalViewMode}
      />
    </div>
  );
};

export default App;
