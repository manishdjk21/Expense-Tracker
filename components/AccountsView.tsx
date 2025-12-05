import React, { useState, useMemo } from 'react';
import { Book, Account, Transaction } from '../types';
import { ArrowLeft, Edit2, Save, Trash2, Plus, X, Check, Wallet, ArrowRightLeft, ShoppingBag, ChevronDown } from 'lucide-react';
import { ICON_MAP, ICON_KEYS, AVAILABLE_COLORS } from '../constants';

interface Props {
  books: Book[];
  activeBookId: string;
  onUpdateAccount: (bookId: string, account: Account) => void;
  onAddAccount: (bookId: string, account: Account) => void;
  onDeleteAccount: (bookId: string, accountId: string) => void;
}

const AccountsView: React.FC<Props> = ({ books, activeBookId, onUpdateAccount, onAddAccount, onDeleteAccount }) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null); // For detail view context
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('');
  const [formIcon, setFormIcon] = useState('');
  const [formBalance, setFormBalance] = useState('0');
  const [targetBookId, setTargetBookId] = useState<string>(activeBookId); // For creating new account

  // Calculate live balances for all accounts in all books
  const allBalances = useMemo(() => {
    const bals: Record<string, Record<string, number>> = {}; // BookId -> AccountId -> Balance
    
    books.forEach(book => {
        bals[book.id] = {};
        book.accounts.forEach(a => bals[book.id][a.id] = a.initialBalance);
        
        book.transactions.forEach(t => {
            if (t.type === 'income') {
                if (bals[book.id][t.accountId] !== undefined) bals[book.id][t.accountId] += t.amount;
            } else if (t.type === 'expense') {
                if (bals[book.id][t.accountId] !== undefined) bals[book.id][t.accountId] -= t.amount;
            } else if (t.type === 'transfer') {
                // Deduct from source
                if (bals[book.id][t.accountId] !== undefined) bals[book.id][t.accountId] -= t.amount;
                // Add to dest (if in this book)
                if (t.toAccountId && bals[book.id][t.toAccountId] !== undefined) {
                    bals[book.id][t.toAccountId] += t.amount;
                }
            }
        });
    });
    return bals;
  }, [books]);

  // Derived state for Detail View
  const selectedBook = books.find(b => b.id === selectedBookId);
  const selectedAccount = selectedBook?.accounts.find(a => a.id === selectedAccountId);

  // Reset form when opening create or edit
  const openCreate = () => {
      setFormName('');
      setFormColor('#10b981');
      setFormIcon('Wallet');
      setFormBalance('0');
      setTargetBookId(activeBookId);
      setIsCreating(true);
  };

  const openEdit = (bookId: string, acc: Account) => {
      setFormName(acc.name);
      setFormColor(acc.color);
      setFormIcon(acc.icon);
      setFormBalance(acc.initialBalance.toString());
      setTargetBookId(bookId);
      setIsEditing(true);
  };

  const handleSave = () => {
      if (!formName) return;
      
      const newAccData = {
          name: formName,
          color: formColor,
          icon: formIcon,
          initialBalance: parseFloat(formBalance) || 0
      };

      if (isCreating) {
          onAddAccount(targetBookId, {
              id: crypto.randomUUID(),
              type: 'cash', 
              ...newAccData
          });
          setIsCreating(false);
      } else if (isEditing && selectedAccount && selectedBookId) {
          onUpdateAccount(selectedBookId, {
              ...selectedAccount,
              ...newAccData
          });
          setIsEditing(false);
      }
  };

  const handleDelete = () => {
      if (selectedAccount && selectedBookId && confirm(`Delete account "${selectedAccount.name}"? Transactions will remain but account details will be lost.`)) {
          onDeleteAccount(selectedBookId, selectedAccount.id);
          setSelectedAccountId(null);
          setSelectedBookId(null);
          setIsEditing(false);
      }
  };

  // Render Transaction List for specific account
  const renderHistory = () => {
      if (!selectedAccount || !selectedBook) return null;
      
      const history = selectedBook.transactions
        .filter(t => t.accountId === selectedAccount.id || t.toAccountId === selectedAccount.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      if (history.length === 0) {
          return <div className="p-8 text-center text-gray-400 text-sm">No transactions yet.</div>;
      }

      return (
          <div className="space-y-3 pb-24">
              {history.map(tx => {
                  const isTransfer = tx.type === 'transfer';
                  // Logic to determine direction for this account
                  let isPositive = false;
                  if (tx.type === 'income') isPositive = true;
                  if (isTransfer && tx.toAccountId === selectedAccount.id) isPositive = true;

                  const cat = selectedBook.categories.find(c => c.id === tx.categoryId);
                  let Icon = cat ? ICON_MAP[cat.icon] : (isTransfer ? ArrowRightLeft : ShoppingBag);
                  
                  // Label logic
                  let label = cat?.name || 'Unknown';
                  if (isTransfer) {
                      const otherAccId = tx.accountId === selectedAccount.id ? tx.toAccountId : tx.accountId;
                      const otherAcc = selectedBook.accounts.find(a => a.id === otherAccId);
                      const otherBook = tx.relatedBookId ? 'External Wallet' : null;
                      
                      if (isPositive) label = `From: ${otherAcc?.name || otherBook || 'Unknown'}`;
                      else label = `To: ${otherAcc?.name || otherBook || 'Unknown'}`;
                  }

                  return (
                      <div key={tx.id} className="bg-white p-3 rounded-xl shadow-sm flex items-center justify-between border-l-4" style={{ borderLeftColor: isTransfer ? '#94a3b8' : (cat?.color || '#ccc') }}>
                          <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 text-gray-500">
                                  <Icon size={14} />
                              </div>
                              <div>
                                  <div className="font-semibold text-gray-800 text-sm">{label}</div>
                                  <div className="text-[10px] text-gray-400">
                                      {new Date(tx.date).toLocaleDateString()}
                                  </div>
                              </div>
                          </div>
                          <div className={`font-bold text-sm ${isPositive ? 'text-green-500' : 'text-gray-800'}`}>
                              {isPositive ? '+' : '-'}{selectedBook.currency}{tx.amount.toLocaleString()}
                          </div>
                      </div>
                  );
              })}
          </div>
      );
  };

  // DETAIL VIEW
  if (selectedAccountId && selectedAccount && selectedBookId && selectedBook) {
      const AccIcon = ICON_MAP[selectedAccount.icon] || Wallet;
      const balance = allBalances[selectedBookId][selectedAccount.id] || 0;

      return (
          <div className="flex-1 flex flex-col bg-gray-100 h-full overflow-hidden">
              {/* Header */}
              <div className="bg-white p-4 flex items-center justify-between shadow-sm z-10">
                  <button onClick={() => { setSelectedAccountId(null); setSelectedBookId(null); setIsEditing(false); }} className="p-2 -ml-2 text-gray-600">
                      <ArrowLeft size={20} />
                  </button>
                  <span className="font-bold text-gray-800">{isEditing ? 'Edit Account' : selectedAccount.name}</span>
                  {!isEditing ? (
                      <button onClick={() => openEdit(selectedBookId, selectedAccount)} className="p-2 -mr-2 text-blue-600">
                          <Edit2 size={18} />
                      </button>
                  ) : (
                      <div className="w-8"></div> // Spacer
                  )}
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar p-4">
                  {isEditing ? (
                      <div className="bg-white rounded-2xl p-4 space-y-4 shadow-sm">
                          <div>
                              <label className="text-xs font-bold text-gray-400 uppercase">Account Name</label>
                              <input 
                                  value={formName}
                                  onChange={e => setFormName(e.target.value)}
                                  className="w-full mt-1 p-2 border rounded-lg text-sm font-semibold"
                                  placeholder="e.g. Savings"
                              />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-gray-400 uppercase">Initial Balance</label>
                              <input 
                                  type="number"
                                  value={formBalance}
                                  onChange={e => setFormBalance(e.target.value)}
                                  className="w-full mt-1 p-2 border rounded-lg text-sm font-semibold"
                              />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Color</label>
                              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                  {AVAILABLE_COLORS.map(c => (
                                      <button 
                                          key={c} 
                                          onClick={() => setFormColor(c)} 
                                          className={`w-8 h-8 rounded-full shrink-0 transition-transform ${formColor === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`} 
                                          style={{backgroundColor: c}} 
                                      />
                                  ))}
                              </div>
                          </div>
                          <div>
                               <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Icon</label>
                               <div className="grid grid-cols-6 gap-2 h-32 overflow-y-auto border p-2 rounded-lg bg-gray-50">
                                   {ICON_KEYS.map(k => {
                                       const Icon = ICON_MAP[k];
                                       return (
                                       <button 
                                           key={k} 
                                           onClick={() => setFormIcon(k)} 
                                           className={`p-2 rounded-lg flex justify-center hover:bg-white transition-colors ${formIcon === k ? 'bg-blue-100 text-blue-600 ring-1 ring-blue-300' : 'text-gray-400'}`}
                                       >
                                           <Icon size={20} />
                                       </button>
                                       )
                                   })}
                               </div>
                          </div>
                          <div className="flex gap-3 pt-4">
                              <button onClick={handleDelete} className="p-3 text-red-500 bg-red-50 rounded-xl flex-1 font-bold text-sm flex items-center justify-center gap-2">
                                  <Trash2 size={16}/> Delete
                              </button>
                              <button onClick={handleSave} className="p-3 text-white bg-blue-600 rounded-xl flex-[2] font-bold text-sm flex items-center justify-center gap-2">
                                  <Save size={16}/> Save Changes
                              </button>
                          </div>
                      </div>
                  ) : (
                      <>
                        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6 text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-50" style={{backgroundColor: selectedAccount.color}}></div>
                            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-3 text-white shadow-lg" style={{backgroundColor: selectedAccount.color}}>
                                <AccIcon size={32} />
                            </div>
                            <h2 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Current Balance</h2>
                            <div className="text-3xl font-bold text-gray-800">{selectedBook.currency}{balance.toLocaleString()}</div>
                            <div className="text-xs font-semibold text-gray-400 mt-2 bg-gray-50 inline-block px-2 py-1 rounded-md">{selectedBook.name}</div>
                        </div>
                        
                        <h3 className="text-sm font-bold text-gray-700 mb-3 px-1">Recent Transactions</h3>
                        {renderHistory()}
                      </>
                  )}
              </div>
          </div>
      );
  }

  // LIST VIEW
  return (
    <div className="flex-1 overflow-y-auto pb-24 p-4 no-scrollbar">
       <div className="flex items-center justify-between mb-6">
           <h2 className="text-2xl font-bold text-gray-800">Accounts</h2>
           <button onClick={openCreate} className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100">
               <Plus size={24} />
           </button>
       </div>

       {isCreating && (
          <div className="bg-white rounded-2xl p-4 mb-6 shadow-lg border border-blue-100 animate-in fade-in slide-in-from-top-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">New Account</h3>
              <div className="space-y-3">
                  {/* Wallet Selection */}
                  <div className="bg-gray-50 rounded-lg p-2 flex items-center justify-between border">
                      <span className="text-xs font-bold text-gray-500 ml-1">Wallet</span>
                      <div className="relative">
                          <select 
                            value={targetBookId} 
                            onChange={(e) => setTargetBookId(e.target.value)}
                            className="bg-transparent text-sm font-bold text-gray-800 outline-none appearance-none pr-4 text-right"
                          >
                            {books.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                          <ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                      </div>
                  </div>

                  <input 
                      autoFocus
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      className="w-full p-2 border rounded-lg text-sm"
                      placeholder="Account Name"
                  />
                  <input 
                      type="number"
                      value={formBalance}
                      onChange={e => setFormBalance(e.target.value)}
                      className="w-full p-2 border rounded-lg text-sm"
                      placeholder="Initial Balance"
                  />
                  <div className="flex gap-2 justify-end pt-2">
                      <button onClick={() => setIsCreating(false)} className="px-4 py-2 text-gray-500 text-sm font-bold">Cancel</button>
                      <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-md">Create</button>
                  </div>
              </div>
          </div>
       )}

       <div className="space-y-6">
           {books.map(book => {
               const bookBalances = allBalances[book.id] || {};
               const totalBookBalance = Object.values(bookBalances).reduce((sum: number, val: number) => sum + val, 0);
               const isActive = book.id === activeBookId;

               return (
                   <div key={book.id}>
                        {/* Wallet Header */}
                        <div className="flex items-center justify-between mb-2 px-1">
                            <div className="flex items-center gap-2">
                                <span className={`text-sm font-bold ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>{book.name}</span>
                                {isActive && <span className="bg-blue-100 text-blue-600 text-[10px] px-1.5 py-0.5 rounded font-bold">Active</span>}
                            </div>
                            <span className="text-sm font-bold text-gray-800">{book.currency}{totalBookBalance.toLocaleString()}</span>
                        </div>

                        <div className="grid gap-3">
                            {book.accounts.map(acc => {
                                const Icon = ICON_MAP[acc.icon] || Wallet;
                                const bal = bookBalances[acc.id] || 0;
                                return (
                                    <button 
                                        key={acc.id}
                                        onClick={() => { setSelectedAccountId(acc.id); setSelectedBookId(book.id); }}
                                        className="bg-white p-4 rounded-xl shadow-sm flex items-center justify-between hover:bg-gray-50 transition-colors border border-transparent hover:border-blue-100 group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-md transition-transform group-hover:scale-110" style={{ backgroundColor: acc.color }}>
                                                <Icon size={20} />
                                            </div>
                                            <div className="text-left">
                                                <div className="font-bold text-gray-800">{acc.name}</div>
                                                <div className="text-xs text-gray-400">
                                                    {acc.type.charAt(0).toUpperCase() + acc.type.slice(1)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-lg text-gray-700">{book.currency}{bal.toLocaleString()}</div>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                   </div>
               )
           })}
       </div>
    </div>
  );
};

export default AccountsView;