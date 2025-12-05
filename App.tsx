
import React, { useState, useEffect, useRef } from 'react';
import { GlobalData, Transaction, Book, RecurringFrequency, Category, Account, TransactionType, BackupConfig } from './types';
import { loadData, processRecurringTransactions, exportDataToJSON, resetAppData, processCSVImport, createNewBook } from './services/storageService';
import { initializeFirebase, subscribeToWallet, saveWalletToCloud, checkWalletExists } from './services/firestore';
import { generateInsights } from './services/geminiService';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import AddTransactionModal from './components/AddTransactionModal';
import AccountsView from './components/AccountsView';
import CategoriesView from './components/CategoriesView';
import HistoryView from './components/HistoryView';
import { LayoutDashboard, List, Settings as SettingsIcon, Wallet, PieChart, Cloud, LogIn, ArrowRight, Loader2 } from 'lucide-react';

// Setup Screen Component
const SetupScreen: React.FC<{ onComplete: (walletId: string) => void }> = ({ onComplete }) => {
    const [step, setStep] = useState<1 | 2>(1);
    const [configJson, setConfigJson] = useState('');
    const [walletIdInput, setWalletIdInput] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Check if config exists in local storage
        const savedConfig = localStorage.getItem('firebase_config');
        if (savedConfig) {
            setConfigJson(savedConfig);
            // Attempt auto-connect
            try {
                const config = JSON.parse(savedConfig);
                initializeFirebase(config).then(success => {
                    if (success) {
                        setStep(2);
                    }
                });
            } catch(e) {
                // Invalid config in storage, let user fix it
            }
        }
    }, []);

    const handleConfigSubmit = async () => {
        try {
            const config = JSON.parse(configJson);
            const success = await initializeFirebase(config);
            if (success) {
                localStorage.setItem('firebase_config', configJson);
                setStep(2);
                setError('');
            } else {
                setError('Could not connect to Firebase. Check config.');
            }
        } catch (e) {
            setError('Invalid JSON format.');
        }
    };

    const handleJoinWallet = async () => {
        if (!walletIdInput) return;
        setIsChecking(true);
        // In a real app, we might verify existence, but for offline-first we can just bind to it.
        // However, checking gives better UX.
        try {
            const exists = await checkWalletExists(walletIdInput);
            // We allow joining even if it doesn't exist (it will be created locally first)
            // but we can warn the user.
            localStorage.setItem('wallet_id', walletIdInput);
            onComplete(walletIdInput);
        } catch (e) {
            setError("Connection failed. You can still join, data will sync when online.");
            localStorage.setItem('wallet_id', walletIdInput);
            onComplete(walletIdInput);
        }
        setIsChecking(false);
    };

    const handleCreateNew = () => {
        const newId = crypto.randomUUID().split('-')[0].toUpperCase();
        localStorage.setItem('wallet_id', newId);
        onComplete(newId);
    };

    return (
        <div className="h-[100dvh] flex flex-col items-center justify-center p-6 bg-gray-50 text-center">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mb-6 shadow-xl">
                <Cloud size={32} />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">OneWallet Cloud</h1>
            
            {step === 1 && (
                <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4">
                    <p className="text-sm text-gray-500 mb-6">
                        To enable real-time sync, paste your Firebase Project Configuration object below.
                    </p>
                    <textarea 
                        value={configJson}
                        onChange={e => setConfigJson(e.target.value)}
                        placeholder='{"apiKey": "...", "projectId": "..."}'
                        className="w-full h-32 p-3 border rounded-xl text-xs font-mono mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    {error && <div className="text-red-500 text-xs mb-4">{error}</div>}
                    <button 
                        onClick={handleConfigSubmit}
                        disabled={!configJson}
                        className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold disabled:opacity-50"
                    >
                        Connect Firebase
                    </button>
                    <div className="mt-4 text-[10px] text-gray-400">
                        Don't have one? Create a project at console.firebase.google.com
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4">
                    <p className="text-sm text-gray-500 mb-6">
                        Join a shared wallet or create a new one to start tracking.
                    </p>
                    
                    <div className="bg-white p-4 rounded-xl shadow-sm border mb-4">
                        <label className="text-xs font-bold text-gray-400 uppercase block mb-2 text-left">Join Existing</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={walletIdInput}
                                onChange={e => setWalletIdInput(e.target.value.toUpperCase())}
                                placeholder="ENTER ID"
                                className="flex-1 p-2 bg-gray-50 border rounded-lg text-center font-bold tracking-widest uppercase"
                            />
                            <button 
                                onClick={handleJoinWallet}
                                disabled={isChecking || !walletIdInput}
                                className="bg-blue-600 text-white px-4 rounded-lg flex items-center justify-center disabled:opacity-50"
                            >
                                {isChecking ? <Loader2 size={18} className="animate-spin"/> : <ArrowRight size={18}/>}
                            </button>
                        </div>
                    </div>

                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-gray-200"></div>
                        <span className="flex-shrink-0 mx-4 text-gray-300 text-xs font-bold">OR</span>
                        <div className="flex-grow border-t border-gray-200"></div>
                    </div>

                    <button 
                        onClick={handleCreateNew}
                        className="w-full py-3 bg-white border-2 border-dashed border-gray-300 text-gray-500 font-bold rounded-xl mt-4 hover:bg-gray-50 hover:border-gray-400 transition-all"
                    >
                        Create New Wallet
                    </button>
                </div>
            )}
        </div>
    )
}

const App: React.FC = () => {
  const [globalData, setGlobalData] = useState<GlobalData | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'accounts' | 'transactions' | 'settings' | 'categories'>('dashboard');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [geminiInsight, setGeminiInsight] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  
  // State for opening modal with specific defaults
  const [modalDefaults, setModalDefaults] = useState<{ type: TransactionType, categoryId?: string } | undefined>(undefined);
  const [modalViewMode, setModalViewMode] = useState<'calculator' | 'categories' | 'create-category'>('calculator');

  // Initialization Check
  useEffect(() => {
      const savedConfig = localStorage.getItem('firebase_config');
      const savedWalletId = localStorage.getItem('wallet_id');

      if (savedConfig && savedWalletId) {
          initializeFirebase(JSON.parse(savedConfig)).then(success => {
              if (success) {
                  setWalletId(savedWalletId);
                  setIsSetupComplete(true);
              }
          });
      }
      
      // PWA Prompt
      const handler = (e: any) => {
        e.preventDefault();
        setInstallPrompt(e);
      };
      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Sync Logic
  useEffect(() => {
      if (!isSetupComplete || !walletId) return;

      const unsubscribe = subscribeToWallet(walletId, (newData) => {
          let processed = processRecurringTransactions(newData);
          setGlobalData(processed);
      });

      // Initial local load to speed up UI while connecting
      const local = loadData();
      if (!globalData && local) {
          // Check if we have pending changes to push? 
          // For simplicity in this transition, we trust Firestore as truth if it exists,
          // OR if Firestore is empty, we push local data.
          checkWalletExists(walletId).then(exists => {
              if (!exists) {
                  console.log("New wallet detected, pushing local data...");
                  saveWalletToCloud(walletId, local);
                  setGlobalData(local);
              }
          });
      }

      return () => unsubscribe();
  }, [isSetupComplete, walletId]);

  // Persist changes to Cloud
  useEffect(() => {
    if (globalData && isSetupComplete && walletId) {
       saveWalletToCloud(walletId, globalData);
    }
  }, [globalData, isSetupComplete, walletId]);


  // Derived state
  const activeBook = globalData?.books.find(b => b.id === globalData.activeBookId);
  const currentUser = globalData?.users.find(u => u.isCurrentUser) || globalData?.users[0];

  const handleSetupComplete = (id: string) => {
      setWalletId(id);
      setIsSetupComplete(true);
      
      // If we have local data but just joined a NEW ID, we should push it.
      const local = loadData();
      saveWalletToCloud(id, local);
  };

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
      setGlobalData(prevData => {
          if (!prevData) return null;
          const activeBookId = prevData.activeBookId;
          const updatedBooks = prevData.books.map(b => {
              if (b.id === activeBookId) {
                  return {
                      ...b,
                      transactions: b.transactions.filter(t => t.id !== txId)
                  };
              }
              return b;
          });
          return { ...prevData, books: updatedBooks };
      });
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
  
  const handleCSVImport = (csvText: string) => {
    if (!globalData) return;
    try {
        const { data: updatedData, count } = processCSVImport(csvText, globalData);
        setGlobalData(updatedData);
        alert(`Successfully imported ${count} transactions.`);
    } catch (e: any) {
        alert("Import Failed: " + e.message);
    }
  };

  const handleImportGlobal = (newData: GlobalData) => {
    setGlobalData(newData);
    // When importing full JSON, we immediately push to cloud
    if (walletId) saveWalletToCloud(walletId, newData);
  };

  const handleAddBook = (name: string, currency: string) => {
    if (!globalData) return;
    const newBook = createNewBook(name, currency); // Removed unused variable
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

  const handleFactoryReset = () => {
    resetAppData();
    localStorage.removeItem('firebase_config');
    localStorage.removeItem('wallet_id');
    window.location.reload();
  };

  const handleClearData = () => {
     if (!globalData) return;
     
     const updatedBooks = globalData.books.map(b => ({
         ...b,
         transactions: b.transactions.filter(t => t.type === 'transfer')
     }));
     setGlobalData({ ...globalData, books: updatedBooks });
  };

  const handleGenerateInsight = async () => {
    if (!activeBook) return;
    setIsAnalyzing(true);
    const insight = await generateInsights(activeBook);
    setGeminiInsight(insight);
    setIsAnalyzing(false);
  };
  
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
  };

  const handleEditTransaction = (tx: Transaction) => {
      setEditingTx(tx);
      setModalDefaults(undefined);
      setModalViewMode('calculator');
      setIsAddModalOpen(true);
  };

  const handleLogout = () => {
      localStorage.removeItem('wallet_id');
      window.location.reload();
  }

  if (!isSetupComplete) {
      return <SetupScreen onComplete={handleSetupComplete} />;
  }

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
          onImportCSV={handleCSVImport}
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
          onConfigureBackup={handleConfigureBackup}
          installPrompt={installPrompt}
          walletId={walletId}
          onLogout={handleLogout}
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
