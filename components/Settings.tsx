
import React, { useRef, useState, useEffect } from 'react';
import { GlobalData, Book, Category, SyncConfig, BackupConfig, Transaction } from '../types';
import { exportDataToJSON, exportTransactionsToCSV } from '../services/storageService';
import { Download, Upload, FileText, Trash2, Wallet, Plus, Check, ChevronRight, ChevronDown, Edit2, X, Save, RefreshCw, Circle, Smartphone, Cloud, HardDrive, AlertTriangle } from 'lucide-react';
import { ICON_MAP, ICON_KEYS, AVAILABLE_COLORS } from '../constants';

interface Props {
  data: GlobalData;
  activeBook: Book;
  onImport: (newData: GlobalData) => void;
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
  onConfigureSync: (config: SyncConfig) => void;
  onConfigureBackup?: (config: BackupConfig) => void;
  syncStatus: 'disconnected' | 'connecting' | 'connected';
  installPrompt: any;
}

const Settings: React.FC<Props> = ({ 
    data, activeBook, onImport, onImportTransactions, onBulkImport, onReset, onClearData,
    onSwitchBook, onAddBook, onUpdateBook, onDeleteBook, 
    onAddCategory, onUpdateUser, onConfigureSync, onConfigureBackup, syncStatus,
    installPrompt
}) => {
  const jsonInputRef = useRef<HTMLInputElement>(null);
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

  // Sync State
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [userName, setUserName] = useState('');
  
  const [familyName, setFamilyName] = useState(data.syncConfig?.familyName || '');
  const [userSlot, setUserSlot] = useState<1 | 2>(data.syncConfig?.slot || 1);
  const [isSyncExpanded, setIsSyncExpanded] = useState(!data.syncConfig?.enabled);

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

  const handleStartSync = () => {
      if (!familyName) return;
      onConfigureSync({
          familyName,
          slot: userSlot,
          enabled: true
      });
      setIsSyncExpanded(false);
  };

  const handleStopSync = () => {
      onConfigureSync({
          familyName: '',
          slot: 1,
          enabled: false
      });
      setFamilyName('');
      setUserSlot(1);
      setIsSyncExpanded(true);
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
      if (window.confirm("CRITICAL WARNING: This will delete ALL data (Wallets, Categories, Transactions) and reset the app to its initial install state. This action cannot be undone. Are you sure?")) {
          onReset();
      }
  };

  const mainCategories = activeBook.categories.filter(c => !c.parentId);

  return (
    <div className="flex-1 overflow-y-auto pb-24 p-4 no-scrollbar relative">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Settings</h2>

      {/* Install App Banner (Visible if supported) */}
      {installPrompt && (
        <section className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 shadow-lg mb-6 text-white flex items-center justify-between">
            <div>
                <h3 className="font-bold text-lg">Install OneWallet</h3>
                <p className="text-xs text-blue-100 opacity-90 mt-1">Get the native app experience on your home screen.</p>
            </div>
            <button 
              type="button"
              onClick={handleInstallClick}
              className="bg-white text-blue-600 px-4 py-2 rounded-lg font-bold text-xs shadow-md hover:bg-blue-50 transition-colors flex items-center gap-2"
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
                <div className="text-xs text-gray-400 mt-1">
                    {data.syncConfig?.enabled ? `Linked: ${data.syncConfig.familyName} (User ${data.syncConfig.slot})` : 'Offline Account'}
                </div>
            </div>
         </div>
      </section>

      {/* Cloud Backup & Export Section */}
      <section className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Data Management</h3>
        
        {/* Scheduled Cloud Backup UI */}
        <div className="mb-6 pb-6 border-b border-gray-100">
             <div className="flex items-center gap-2 mb-3">
                 <Cloud size={18} className="text-blue-500"/>
                 <h4 className="text-sm font-bold text-gray-700">Scheduled Backup</h4>
             </div>
             
             <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex gap-2 mb-4">
                     <button 
                        type="button"
                        onClick={() => handleBackupConfigChange('google_drive')}
                        className={`flex-1 py-3 px-2 rounded-lg text-xs font-bold border transition-all flex flex-col items-center gap-1 ${backupProvider === 'google_drive' ? 'bg-white border-blue-500 text-blue-600 shadow-sm' : 'bg-transparent border-transparent text-gray-500 hover:bg-white'}`}
                     >
                         <span>Google Drive</span>
                     </button>
                     <button 
                        type="button"
                        onClick={() => handleBackupConfigChange('dropbox')}
                        className={`flex-1 py-3 px-2 rounded-lg text-xs font-bold border transition-all flex flex-col items-center gap-1 ${backupProvider === 'dropbox' ? 'bg-white border-blue-600 text-blue-700 shadow-sm' : 'bg-transparent border-transparent text-gray-500 hover:bg-white'}`}
                     >
                         <span>Dropbox</span>
                     </button>
                     <button 
                        type="button"
                        onClick={() => handleBackupConfigChange(null)}
                        className={`py-3 px-4 rounded-lg text-xs font-bold border transition-all ${!backupProvider ? 'bg-gray-200 text-gray-600' : 'bg-transparent text-gray-400'}`}
                     >
                         Off
                     </button>
                </div>

                {backupProvider && (
                    <div className="flex items-center justify-between">
                         <span className="text-xs font-semibold text-gray-500">Frequency:</span>
                         <select 
                            value={backupFreq} 
                            onChange={(e) => handleBackupFreqChange(e.target.value as any)}
                            className="bg-white border border-gray-200 text-gray-700 text-xs font-bold py-1.5 px-3 rounded-lg outline-none"
                        >
                             <option value="daily">Daily</option>
                             <option value="weekly">Weekly</option>
                             <option value="monthly">Monthly</option>
                         </select>
                    </div>
                )}
             </div>
             {backupProvider && (
                 <div className="mt-2 text-[10px] text-gray-400 text-center">
                     * This requires manual authorization. You will be prompted to download the backup file when due.
                 </div>
             )}
        </div>

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

        {/* JSON Backup/Restore */}
        <div>
             <div className="flex items-center gap-2 mb-3">
                 <HardDrive size={18} className="text-purple-500"/>
                 <h4 className="text-sm font-bold text-gray-700">Full Backup (JSON)</h4>
             </div>
             <div className="grid grid-cols-2 gap-3">
                <button 
                    type="button"
                    onClick={() => exportDataToJSON(data)}
                    className="flex flex-col items-center justify-center p-3 bg-purple-50 rounded-xl text-purple-700 hover:bg-purple-100 transition-colors gap-1"
                >
                    <Download size={20} /> 
                    <span className="text-xs font-bold">Backup</span>
                </button>
                <button 
                    type="button"
                    onClick={() => jsonInputRef.current?.click()}
                    className="flex flex-col items-center justify-center p-3 bg-blue-50 rounded-xl text-blue-700 hover:bg-blue-100 transition-colors gap-1"
                >
                    <Upload size={20} />
                    <span className="text-xs font-bold">Restore</span>
                </button>
                <input type="file" accept=".json" ref={jsonInputRef} onChange={handleJsonUpload} className="hidden" />
             </div>
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
         <p className="text-[10px] text-red-400 mt-3 text-center leading-relaxed">
             * Clearing transactions removes expense and income history. Factory reset deletes EVERYTHING including categories and wallets.
         </p>
      </section>

      {/* Simplified Family Sync Section */}
      <section className="bg-white rounded-2xl p-6 shadow-sm mb-6 overflow-hidden">
         <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setIsSyncExpanded(!isSyncExpanded)}>
             <div className="flex items-center gap-2">
                 <RefreshCw size={18} className={`text-blue-600 ${syncStatus === 'connecting' ? 'animate-spin' : ''}`}/>
                 <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Family Sync</h3>
             </div>
             <div className="flex items-center gap-2">
                 {data.syncConfig?.enabled && (
                     <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${
                         syncStatus === 'connected' ? 'bg-green-100 text-green-700' : 
                         syncStatus === 'connecting' ? 'bg-yellow-100 text-yellow-700' : 
                         'bg-gray-100 text-gray-500'
                     }`}>
                         <Circle size={8} fill="currentColor" />
                         {syncStatus === 'connected' ? 'Connected' : syncStatus === 'connecting' ? 'Searching...' : 'Disconnected'}
                     </div>
                 )}
                 {isSyncExpanded ? <ChevronDown size={16} className="text-gray-400"/> : <ChevronRight size={16} className="text-gray-400"/>}
             </div>
         </div>
         
         {isSyncExpanded && (
             <div className="animate-in fade-in slide-in-from-top-2">
                 {!data.syncConfig?.enabled ? (
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-2">
                        <p className="text-xs text-blue-800 mb-4 font-medium leading-relaxed">
                            Easily sync with your partner. Enter the same Family Name on both devices.
                        </p>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-blue-400 uppercase">Family Name</label>
                                <input 
                                    value={familyName}
                                    onChange={e => setFamilyName(e.target.value)}
                                    placeholder="e.g. SmithWallet"
                                    className="w-full p-2 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 mt-1"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-blue-400 uppercase">I am...</label>
                                <div className="flex gap-2 mt-1">
                                    <button 
                                        type="button"
                                        onClick={() => setUserSlot(1)}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${userSlot === 1 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}
                                    >
                                        User 1 (Primary)
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setUserSlot(2)}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${userSlot === 2 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}
                                    >
                                        User 2 (Partner)
                                    </button>
                                </div>
                            </div>

                            <button 
                                type="button"
                                onClick={handleStartSync}
                                disabled={!familyName}
                                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm shadow-md disabled:opacity-50 hover:bg-blue-700 transition-colors"
                            >
                                Start Syncing
                            </button>
                        </div>
                    </div>
                 ) : (
                     <div className="space-y-3">
                         <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
                             You are connected as <b>User {data.syncConfig.slot}</b> in family <b>{data.syncConfig.familyName}</b>.
                         </div>
                         <button 
                            type="button"
                            onClick={handleStopSync}
                            className="w-full py-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg text-xs font-bold"
                         >
                             Stop Syncing
                         </button>
                     </div>
                 )}
             </div>
         )}
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
