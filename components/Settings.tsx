
import React, { useRef, useState, useEffect } from 'react';
import { GlobalData, Book, Category, BackupConfig, Transaction } from '../types';
import { exportDataToJSON, exportTransactionsToCSV } from '../services/storageService';
import { Download, Upload, FileText, Trash2, Wallet, Plus, Check, ChevronRight, ChevronDown, Edit2, X, Save, RefreshCw, Circle, Smartphone, Cloud, HardDrive, AlertTriangle, FileSpreadsheet, LogOut, Copy } from 'lucide-react';
import { ICON_MAP, ICON_KEYS, AVAILABLE_COLORS } from '../constants';

interface Props {
  data: GlobalData;
  activeBook: Book;
  onImport: (newData: GlobalData) => void;
  onImportCSV: (csvText: string) => void;
  onImportTransactions: (txs: any[]) => void;
  onBulkImport: (txs: Transaction[], cats: Category[]) => void;
  onReset: () => void;
  onClearData: () => void;
  onSwitchBook: (id: string) => void;
  onAddBook: (name: string, currency: string) => void;
  onUpdateBook: (id: string, name: string, currency: string) => void;
  onDeleteBook: (id: string) => void;
  onAddCategory: (cat: Category) => void;
  onUpdateUser: (name: string) => void;
  onConfigureBackup?: (config: BackupConfig) => void;
  installPrompt: any;
  walletId: string | null;
  onLogout: () => void;
}

const Settings: React.FC<Props> = ({ 
    data, activeBook, onImport, onImportCSV, onImportTransactions, onBulkImport, onReset, onClearData,
    onSwitchBook, onAddBook, onUpdateBook, onDeleteBook, 
    onAddCategory, onUpdateUser, onConfigureBackup,
    installPrompt, walletId, onLogout
}) => {
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [newBookName, setNewBookName] = useState('');
  const [newBookCurrency, setNewBookCurrency] = useState('€');
  const [isAddingBook, setIsAddingBook] = useState(false);
  
  // Edit Book State
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [editBookName, setEditBookName] = useState('');
  const [editBookCurrency, setEditBookCurrency] = useState('');

  // Category Management State
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [newCatParent, setNewCatParent] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('ShoppingBag');
  const [newCatColor, setNewCatColor] = useState('#fbbf24');
  const [newCatType, setNewCatType] = useState<'expense' | 'income'>('expense');

  // User State
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [userName, setUserName] = useState('');
  
  // Backup State
  const [backupFreq, setBackupFreq] = useState<'daily' | 'weekly' | 'monthly'>(data.backupConfig?.frequency || 'daily');
  const [backupProvider, setBackupProvider] = useState<'google_drive' | 'dropbox' | 'local' | null>(data.backupConfig?.provider || null);

  const currentUser = data.users.find(u => u.isCurrentUser);

  // handlers for file upload, books, categories... (Same as before)
  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.books && json.activeBookId) {
           onImport(json);
           alert("Full backup restored!");
        } else {
           alert("Invalid backup format (v2 required)");
        }
      } catch (err) { alert("Invalid JSON"); }
    };
    reader.readAsText(file);
    if (jsonInputRef.current) jsonInputRef.current.value = '';
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          if (event.target?.result) {
              onImportCSV(event.target.result as string);
          }
      };
      reader.readAsText(file);
      if (csvInputRef.current) csvInputRef.current.value = '';
  };

  const handleCreateBook = () => {
    if (newBookName) {
      onAddBook(newBookName, newBookCurrency);
      setNewBookName('');
      setIsAddingBook(false);
    }
  };
  
  const openEditBook = (e: React.MouseEvent, book: Book) => {
      e.stopPropagation();
      setEditingBook(book);
      setEditBookName(book.name);
      setEditBookCurrency(book.currency);
  };
  
  const handleSaveBookEdit = () => {
      if (editingBook && editBookName) {
          onUpdateBook(editingBook.id, editBookName, editBookCurrency);
          setEditingBook(null);
      }
  };
  
  const handleDeleteBook = () => {
      if (editingBook) {
          if (confirm(`Are you sure you want to delete "${editingBook.name}"? This will delete all accounts and transactions within it.`)) {
             onDeleteBook(editingBook.id);
             setEditingBook(null);
          }
      }
  };

  const handleSaveCategory = () => {
    if (!newCatName) return;
    const newCat: Category = {
      id: crypto.randomUUID(),
      name: newCatName,
      icon: newCatIcon,
      color: newCatColor,
      type: newCatType,
      parentId: newCatParent || undefined
    };
    onAddCategory(newCat);
    setNewCatName('');
    setIsAddingCat(false);
    setNewCatParent(null);
  };

  const openAddCategory = (parent?: Category) => {
    setNewCatParent(parent?.id || null);
    setNewCatType(parent?.type || 'expense');
    setNewCatColor(parent?.color || '#fbbf24');
    setNewCatIcon(parent?.icon || 'ShoppingBag');
    setIsAddingCat(true);
  };

  const handleUpdateUserName = () => {
      if (userName && currentUser) {
          onUpdateUser(userName);
          setIsEditingUser(false);
      }
  };

  const handleBackupConfigChange = (provider: 'google_drive' | 'dropbox' | 'local' | null) => {
      setBackupProvider(provider);
      if (onConfigureBackup) {
          onConfigureBackup({
              enabled: !!provider,
              frequency: backupFreq,
              provider: provider,
              lastBackupDate: data.backupConfig?.lastBackupDate
          });
      }
  };

  const handleBackupFreqChange = (freq: 'daily' | 'weekly' | 'monthly') => {
      setBackupFreq(freq);
      if (onConfigureBackup && backupProvider) {
          onConfigureBackup({
              enabled: true,
              frequency: freq,
              provider: backupProvider,
              lastBackupDate: data.backupConfig?.lastBackupDate
          });
      }
  };

  const handleInstallClick = () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.then((choiceResult: any) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the A2HS prompt');
      }
    });
  };

  const confirmClearTransactions = () => {
      if (window.confirm("WARNING: Are you sure you want to delete ALL expense and income transactions? This action cannot be undone.")) {
          onClearData();
      }
  };

  const confirmFactoryReset = () => {
      if (window.confirm("CRITICAL WARNING: This will delete ALL data locally and disconnect from cloud. Are you sure?")) {
          onReset();
      }
  };

  const copyWalletId = () => {
      if (walletId) {
          navigator.clipboard.writeText(walletId);
          alert("Wallet ID copied to clipboard!");
      }
  };

  const mainCategories = activeBook.categories.filter(c => !c.parentId);

  return (
    <div className="flex-1 overflow-y-auto pb-24 p-4 no-scrollbar relative">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Settings</h2>

      {/* Sync Status Banner */}
      <section className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 shadow-lg mb-6 text-white relative overflow-hidden">
          <div className="relative z-10">
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                      <Cloud size={20} className="text-indigo-200"/>
                      <h3 className="font-bold text-lg">Cloud Sync Active</h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold bg-white/20 px-2 py-1 rounded-full">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      Online
                  </div>
              </div>
              <div className="mt-4 bg-white/10 p-3 rounded-xl flex items-center justify-between">
                  <div>
                      <div className="text-[10px] text-indigo-200 uppercase font-bold">Wallet ID</div>
                      <div className="font-mono text-sm font-bold tracking-wider">{walletId}</div>
                  </div>
                  <button onClick={copyWalletId} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                      <Copy size={16}/>
                  </button>
              </div>
              <div className="mt-2 text-[10px] text-indigo-200">
                  Share this ID with family members to join this wallet.
              </div>
          </div>
          <button 
             onClick={onLogout}
             className="absolute top-4 right-4 p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full"
             title="Switch Wallet"
          >
              <LogOut size={16} />
          </button>
      </section>

      {/* Install App Banner (Visible if supported) */}
      {installPrompt && (
        <section className="bg-white border border-blue-100 rounded-2xl p-6 shadow-sm mb-6 flex items-center justify-between">
            <div>
                <h3 className="font-bold text-sm text-blue-900">Install App</h3>
                <p className="text-xs text-blue-400 mt-1">Add to home screen</p>
            </div>
            <button 
              type="button"
              onClick={handleInstallClick}
              className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg font-bold text-xs hover:bg-blue-100 transition-colors flex items-center gap-2"
            >
                <Smartphone size={16} /> Install
            </button>
        </section>
      )}

      {/* User Account Section */}
      <section className="bg-white rounded-2xl p-6 shadow-sm mb-6">
         <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">My Profile</h3>
            {!isEditingUser && (
                <button type="button" onClick={() => { setUserName(currentUser?.name || ''); setIsEditingUser(true); }} className="text-blue-600">
                    <Edit2 size={16}/>
                </button>
            )}
         </div>

         <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
                <span className="text-2xl font-bold">{currentUser?.name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1">
                {isEditingUser ? (
                    <div className="flex items-center gap-2">
                        <input 
                            autoFocus
                            value={userName}
                            onChange={e => setUserName(e.target.value)}
                            className="border rounded p-1 text-sm font-bold text-gray-800 w-full"
                        />
                        <button type="button" onClick={handleUpdateUserName} className="bg-blue-600 text-white p-1 rounded"><Check size={14}/></button>
                    </div>
                ) : (
                    <h3 className="text-lg font-bold text-gray-800">{currentUser?.name}</h3>
                )}
            </div>
         </div>
      </section>

      {/* Data Management Section */}
      <section className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Data Management</h3>
        
        {/* CSV Export */}
        <div className="mb-6 pb-6 border-b border-gray-100">
             <div className="flex items-center gap-2 mb-3">
                 <FileText size={18} className="text-green-600"/>
                 <h4 className="text-sm font-bold text-gray-700">Export Transactions</h4>
             </div>
             <button 
                type="button"
                onClick={() => exportTransactionsToCSV(activeBook, data.books)}
                className="w-full py-3 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-colors"
             >
                 <Download size={16}/> Download CSV
             </button>
        </div>

        {/* Import & Backup */}
        <div>
             <div className="flex items-center gap-2 mb-3">
                 <HardDrive size={18} className="text-purple-500"/>
                 <h4 className="text-sm font-bold text-gray-700">Import / Backup</h4>
             </div>
             <div className="grid grid-cols-2 gap-3 mb-3">
                <button 
                    type="button"
                    onClick={() => exportDataToJSON(data)}
                    className="flex flex-col items-center justify-center p-3 bg-purple-50 rounded-xl text-purple-700 hover:bg-purple-100 transition-colors gap-1"
                >
                    <Download size={20} /> 
                    <span className="text-xs font-bold">Backup JSON</span>
                </button>
                <button 
                    type="button"
                    onClick={() => jsonInputRef.current?.click()}
                    className="flex flex-col items-center justify-center p-3 bg-blue-50 rounded-xl text-blue-700 hover:bg-blue-100 transition-colors gap-1"
                >
                    <Upload size={20} />
                    <span className="text-xs font-bold">Restore JSON</span>
                </button>
                <input type="file" accept=".json" ref={jsonInputRef} onChange={handleJsonUpload} className="hidden" />
             </div>

             {/* CSV Import Button */}
             <button 
                type="button"
                onClick={() => csvInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 p-3 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-100 transition-colors font-bold text-xs"
             >
                <FileSpreadsheet size={18} /> Import CSV
             </button>
             <input type="file" accept=".csv" ref={csvInputRef} onChange={handleCSVUpload} className="hidden" />
        </div>
      </section>

      {/* Danger Zone */}
      <section className="bg-red-50 rounded-2xl p-6 shadow-sm mb-6 border border-red-100">
         <div className="flex items-center gap-2 mb-4">
             <AlertTriangle size={18} className="text-red-500"/>
             <h3 className="text-sm font-bold text-red-600">Danger Zone</h3>
         </div>
         <div className="space-y-3">
             <button 
                 onClick={confirmClearTransactions}
                 className="w-full py-3 bg-white border border-red-200 text-red-600 rounded-xl flex items-center justify-center gap-2 text-xs font-bold hover:bg-red-50 transition-colors"
             >
                 <Trash2 size={16}/> Clear Transactions Only
             </button>
             <button 
                 onClick={confirmFactoryReset}
                 className="w-full py-3 bg-red-600 text-white rounded-xl flex items-center justify-center gap-2 text-xs font-bold hover:bg-red-700 transition-colors shadow-sm"
             >
                 <RefreshCw size={16}/> Factory Reset App
             </button>
         </div>
      </section>

      {/* Book Management (Same as before) */}
      <section className="bg-white rounded-2xl p-6 shadow-sm mb-6">
         <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Wallet Books</h3>
            <button type="button" onClick={() => setIsAddingBook(!isAddingBook)} className="text-blue-600"><Plus size={20}/></button>
         </div>

         {isAddingBook && (
           <div className="bg-gray-50 p-4 rounded-xl mb-4 flex flex-col gap-3">
              <input 
                type="text" 
                placeholder="Book Name (e.g. Business)" 
                className="p-2 rounded border text-sm"
                value={newBookName}
                onChange={e => setNewBookName(e.target.value)}
              />
              <div className="flex gap-2">
                 {['$', '€', '£', '₹', '¥'].map(c => (
                   <button 
                    type="button"
                    key={c}
                    onClick={() => setNewBookCurrency(c)}
                    className={`w-8 h-8 rounded-full text-sm font-bold ${newBookCurrency === c ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}
                   >
                     {c}
                   </button>
                 ))}
              </div>
              <button type="button" onClick={handleCreateBook} className="bg-blue-600 text-white py-2 rounded-lg text-sm font-bold">Create Wallet</button>
           </div>
         )}

         <div className="space-y-2">
            {data.books.map(book => (
              <div 
                key={book.id}
                onClick={() => onSwitchBook(book.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer ${
                  book.id === activeBook.id ? 'bg-blue-50 border border-blue-200 shadow-sm' : 'bg-white hover:bg-gray-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                   <div className={`p-2 rounded-full ${book.id === activeBook.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                      <Wallet size={18} />
                   </div>
                   <div className="text-left">
                     <div className={`font-semibold text-sm ${book.id === activeBook.id ? 'text-blue-900' : 'text-gray-700'}`}>{book.name}</div>
                     <div className="text-xs text-gray-400">{book.currency} • {book.accounts.length} Accounts</div>
                   </div>
                </div>
                <div className="flex items-center gap-2">
                     {book.id === activeBook.id && <Check size={18} className="text-blue-600"/>}
                     <button type="button" onClick={(e) => openEditBook(e, book)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded-full transition-colors">
                         <Edit2 size={16} />
                     </button>
                </div>
              </div>
            ))}
         </div>
      </section>

      {/* Edit Book Modal Overlay */}
      {editingBook && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
             <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
                 <div className="flex justify-between items-center mb-2">
                     <h3 className="font-bold text-lg text-gray-800">Edit Wallet</h3>
                     <button type="button" onClick={() => setEditingBook(null)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                 </div>
                 
                 <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">Wallet Name</label>
                    <input 
                        type="text" 
                        value={editBookName}
                        onChange={e => setEditBookName(e.target.value)}
                        className="w-full mt-1 p-3 border rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                 </div>

                 <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Currency</label>
                    <div className="flex gap-2">
                        {['$', '€', '£', '₹', '¥'].map(c => (
                        <button 
                            type="button"
                            key={c}
                            onClick={() => setEditBookCurrency(c)}
                            className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${editBookCurrency === c ? 'bg-blue-600 text-white shadow-lg scale-105' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            {c}
                        </button>
                        ))}
                    </div>
                 </div>

                 <div className="flex gap-3 pt-4">
                     <button 
                        type="button"
                        onClick={handleDeleteBook}
                        className="p-3 text-red-500 bg-red-50 hover:bg-red-100 rounded-xl flex-1 font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                     >
                         <Trash2 size={18}/> Delete
                     </button>
                     <button 
                        type="button"
                        onClick={handleSaveBookEdit}
                        disabled={!editBookName}
                        className="p-3 text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex-[2] font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                     >
                         <Save size={18}/> Save Changes
                     </button>
                 </div>
             </div>
          </div>
      )}

      {/* Category Management */}
      <section className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex justify-between items-center mb-4">
           <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Categories</h3>
           <button type="button" onClick={() => openAddCategory()} className="text-blue-600 flex items-center gap-1 text-xs font-bold">
             <Plus size={16}/> Add New
           </button>
        </div>

        {isAddingCat && (
          <div className="bg-gray-50 p-4 rounded-xl mb-4 border border-blue-100">
             <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase">{newCatParent ? 'New Subcategory' : 'New Category'}</h4>
             <div className="space-y-3">
               <input 
                 type="text" 
                 placeholder="Name" 
                 value={newCatName} 
                 onChange={e => setNewCatName(e.target.value)}
                 className="w-full p-2 text-sm border rounded"
               />
               {!newCatParent && (
                 <div className="flex gap-2">
                   <button type="button" onClick={() => setNewCatType('expense')} className={`flex-1 py-1 text-xs font-bold rounded ${newCatType === 'expense' ? 'bg-red-500 text-white' : 'bg-gray-200'}`}>Expense</button>
                   <button type="button" onClick={() => setNewCatType('income')} className={`flex-1 py-1 text-xs font-bold rounded ${newCatType === 'income' ? 'bg-green-500 text-white' : 'bg-gray-200'}`}>Income</button>
                 </div>
               )}
               <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {AVAILABLE_COLORS.map(c => (
                    <button type="button" key={c} onClick={() => setNewCatColor(c)} className={`w-6 h-6 rounded-full shrink-0 ${newCatColor === c ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`} style={{backgroundColor: c}} />
                  ))}
               </div>
               <div className="grid grid-cols-6 gap-2 h-32 overflow-y-auto border p-2 rounded bg-white">
                  {ICON_KEYS.map(k => {
                    const Icon = ICON_MAP[k];
                    return (
                      <button type="button" key={k} onClick={() => setNewCatIcon(k)} className={`p-1.5 rounded hover:bg-gray-100 flex justify-center ${newCatIcon === k ? 'bg-blue-100 text-blue-600' : 'text-gray-500'}`}>
                        <Icon size={18} />
                      </button>
                    )
                  })}
               </div>
               <div className="flex gap-2">
                 <button type="button" onClick={handleSaveCategory} className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-bold">Save</button>
                 <button type="button" onClick={() => setIsAddingCat(false)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded text-sm font-bold">Cancel</button>
               </div>
             </div>
          </div>
        )}

        <div className="space-y-1">
          {mainCategories.map(cat => {
            const Icon = ICON_MAP[cat.icon];
            const subs = activeBook.categories.filter(s => s.parentId === cat.id);
            const isExpanded = expandedCat === cat.id;

            return (
              <div key={cat.id} className="border-b last:border-0 border-gray-100">
                <div className="flex items-center justify-between py-3 hover:bg-gray-50 px-2 rounded-lg transition-colors cursor-pointer" onClick={() => setExpandedCat(isExpanded ? null : cat.id)}>
                   <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full flex items-center justify-center text-white" style={{backgroundColor: cat.color}}>
                       {Icon && <Icon size={16}/>}
                     </div>
                     <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                   </div>
                   <div className="flex items-center gap-2">
                      {subs.length > 0 && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{subs.length}</span>}
                      {isExpanded ? <ChevronDown size={16} className="text-gray-400"/> : <ChevronRight size={16} className="text-gray-400"/>}
                   </div>
                </div>
                {isExpanded && (
                  <div className="pl-12 pr-2 pb-3 space-y-2">
                    {subs.map(sub => {
                       const SubIcon = ICON_MAP[sub.icon];
                       return (
                         <div key={sub.id} className="flex items-center gap-2 text-sm text-gray-600 py-1">
                            <div className="text-gray-400"><SubIcon size={14}/></div>
                            {sub.name}
                         </div>
                       )
                    })}
                    <button type="button" onClick={() => openAddCategory(cat)} className="text-xs text-blue-600 font-medium flex items-center gap-1 mt-2">
                      <Plus size={12}/> Add Subcategory
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <div className="text-center pt-2 text-[10px] text-gray-300">
         OneWallet v2.0 • Offline Storage
      </div>
    </div>
  );
};

export default Settings;
