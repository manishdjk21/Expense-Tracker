
import React, { useState, useEffect, useRef } from 'react';
import { Category, TransactionType, Account, Transaction, RecurringFrequency, Book } from '../types';
import { X, Check, Delete, RefreshCw, Calendar, Tag, ChevronDown, Repeat, Plus, ShoppingBag, Book as BookIcon, Wallet, Trash2 } from 'lucide-react';
import { ICON_MAP, ICON_KEYS, AVAILABLE_COLORS } from '../constants';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tx: Partial<Transaction>, recurrence?: RecurringFrequency, toBookId?: string, convertedAmount?: number) => void;
  onDelete?: (txId: string) => void;
  onAddCategory: (cat: Category) => void;
  categories: Category[];
  accounts: Account[];
  currency: string;
  books: Book[];
  activeBookId: string;
  initialData?: Transaction | null;
  defaultType?: TransactionType;
  defaultCategoryId?: string;
  initialViewMode?: 'calculator' | 'categories' | 'create-category';
}

const AddTransactionModal: React.FC<Props> = ({ isOpen, onClose, onSave, onDelete, onAddCategory, categories, accounts, currency, books, activeBookId, initialData, defaultType, defaultCategoryId, initialViewMode }) => {
  const [amountStr, setAmountStr] = useState('0');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string>(accounts[0]?.id || '');
  
  // Transfer State
  const [targetBookId, setTargetBookId] = useState<string>(activeBookId);
  const [targetAccount, setTargetAccount] = useState<string>(''); 
  const [receivedAmountStr, setReceivedAmountStr] = useState('0');
  const [activeField, setActiveField] = useState<'source' | 'target'>('source');

  const [type, setType] = useState<TransactionType>('expense');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [tags, setTags] = useState('');
  const [note, setNote] = useState('');
  const [viewMode, setViewMode] = useState<'calculator' | 'categories' | 'create-category'>('calculator');
  const [recurrence, setRecurrence] = useState<RecurringFrequency | null>(null);
  
  // Category Creation State
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('ShoppingBag');
  const [newCatColor, setNewCatColor] = useState('#fbbf24');
  const [newCatParent, setNewCatParent] = useState<string | null>(null);

  const dateInputRef = useRef<HTMLInputElement>(null);

  // Initialize form state
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Edit Mode
        setAmountStr(initialData.amount.toString());
        setType(initialData.type);
        setDate(initialData.date.split('T')[0]);
        setNote(initialData.note || '');
        setTags(initialData.tags ? initialData.tags.join(', ') : '');
        setSelectedAccount(initialData.accountId);
        
        // Category / Subcategory
        if (initialData.categoryId) {
           const cat = categories.find(c => c.id === initialData.categoryId);
           if (cat) {
               if (cat.parentId) {
                   setSelectedCategory(cat.parentId);
                   setSelectedSubCategory(cat.id);
               } else {
                   setSelectedCategory(cat.id);
                   setSelectedSubCategory(null);
               }
           }
        } else {
            setSelectedCategory(null);
            setSelectedSubCategory(null);
        }

        // Transfer details
        if (initialData.type === 'transfer') {
            if (initialData.relatedBookId) {
                setTargetBookId(initialData.relatedBookId);
            } else {
                setTargetBookId(activeBookId);
            }
            if (initialData.toAccountId) {
                setTargetAccount(initialData.toAccountId);
            }
        } else {
            setTargetBookId(activeBookId);
        }

        setRecurrence(null); // Editing recurrence rules is complex, defaulting to simple edit for now
        setViewMode('calculator');
        
      } else {
        // Create Mode
        setAmountStr('0');
        // Use defaults if provided
        setType(defaultType || 'expense');
        setSelectedCategory(defaultCategoryId || null);
        setSelectedSubCategory(null);

        setSelectedAccount(accounts[0]?.id || '');
        setDate(new Date().toISOString().split('T')[0]);
        setTags('');
        setNote('');
        setViewMode(initialViewMode || 'calculator');
        setRecurrence(null);
        setTargetBookId(activeBookId);
        setReceivedAmountStr('0');
        setActiveField('source');
        
        // Set default target account from active book initially
        const secondaryAcc = accounts.length > 1 ? accounts[1].id : accounts[0]?.id || '';
        setTargetAccount(secondaryAcc);
        
        resetCreateForm();
      }
    }
  }, [isOpen, initialData, accounts, activeBookId, categories, defaultType, defaultCategoryId, initialViewMode]);

  // When target book changes, update available accounts (only if not editing or if user manually changed book)
  useEffect(() => {
    const book = books.find(b => b.id === targetBookId);
    if (book && book.accounts.length > 0) {
        // Check if we need to auto-select (Create mode or manual change)
        // If editing, we rely on initialData first, but if user changes book, we default.
        const currentTargetAccountValid = book.accounts.some(a => a.id === targetAccount);

        if (!currentTargetAccountValid) {
            if (targetBookId === activeBookId && selectedAccount === book.accounts[0].id && book.accounts.length > 1) {
                setTargetAccount(book.accounts[1].id);
            } else {
                setTargetAccount(book.accounts[0].id);
            }
        }
    } else {
        if (!initialData) setTargetAccount('');
    }
  }, [targetBookId, books, activeBookId, selectedAccount]);

  const resetCreateForm = () => {
    setNewCatName('');
    setNewCatIcon('ShoppingBag');
    setNewCatColor('#fbbf24');
    setNewCatParent(null);
  };

  if (!isOpen) return null;

  const targetBook = books.find(b => b.id === targetBookId);
  const activeBook = books.find(b => b.id === activeBookId);
  const targetBookAccounts = targetBook ? targetBook.accounts : [];
  const isCurrencyMismatch = targetBook && activeBook && targetBook.currency !== activeBook.currency;

  // Filter only Top-Level categories for the main picker
  const filteredCategories = categories.filter(c => c.type === type && !c.parentId);
  
  // Filter Subcategories for the selected parent
  const subCategories = selectedCategory 
    ? categories.filter(c => c.parentId === selectedCategory) 
    : [];

  const safeEvaluate = (str: string): number => {
    try {
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict";return (${str})`)();
      return isFinite(result) ? result : 0;
    } catch (e) {
      return 0;
    }
  };

  const handleCalculatorInput = (val: string) => {
    const setTargetStr = (activeField === 'source' || !isCurrencyMismatch) ? setAmountStr : setReceivedAmountStr;
    const currentStr = (activeField === 'source' || !isCurrencyMismatch) ? amountStr : receivedAmountStr;

    if (val === 'Recur') {
        const cycle: (RecurringFrequency | null)[] = [null, 'daily', 'weekly', 'monthly', 'yearly'];
        const idx = cycle.indexOf(recurrence);
        const next = cycle[(idx + 1) % cycle.length];
        setRecurrence(next);
    } else if (val === 'BS') {
      setTargetStr(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
    } else if (val === 'Date') {
        if (dateInputRef.current) {
            try {
                dateInputRef.current.showPicker();
            } catch (e) {
                dateInputRef.current.focus();
            }
        }
    } else if (val === '=') {
        const res = safeEvaluate(currentStr);
        setTargetStr(String(res));
    } else if (val === 'Done') {
        handleSubmit();
    } else if (['+', '-', '*', '/'].includes(val)) {
        setTargetStr(prev => {
             const lastChar = prev.slice(-1);
             if (['+', '-', '*', '/'].includes(lastChar)) {
                 return prev.slice(0, -1) + val;
             }
             return prev + val;
        });
    } else {
      setTargetStr(prev => prev === '0' ? val : prev + val);
    }
  };

  const handleSubmit = () => {
    let amountVal = parseFloat(amountStr);
    if (/[+\-*/]/.test(amountStr)) {
        amountVal = safeEvaluate(amountStr);
    }

    if (!amountVal || amountVal <= 0) return;
    if (type !== 'transfer' && !selectedCategory) {
        setViewMode('categories');
        return;
    }
    if (type === 'transfer') {
        if (!targetAccount) return;
        if (targetBookId === activeBookId && selectedAccount === targetAccount) return; // Same account transfer
    }

    const finalCategoryId = selectedSubCategory || selectedCategory;

    // Handle currency conversion amount
    let finalConvertedAmount: number | undefined = undefined;
    if (type === 'transfer' && isCurrencyMismatch) {
        let receivedVal = parseFloat(receivedAmountStr);
        if (/[+\-*/]/.test(receivedAmountStr)) {
            receivedVal = safeEvaluate(receivedAmountStr);
        }
        finalConvertedAmount = receivedVal > 0 ? receivedVal : undefined;
    }

    onSave({
      amount: amountVal,
      categoryId: type === 'transfer' ? undefined : finalCategoryId!,
      accountId: selectedAccount,
      toAccountId: type === 'transfer' ? targetAccount : undefined,
      date: new Date(date).toISOString(),
      note: note,
      type,
      tags: tags.split(',').map(t => t.trim()).filter(t => t),
      isRecurring: !!recurrence
    }, recurrence || undefined, targetBookId, finalConvertedAmount);
    
    onClose();
  };
  
  const handleDeleteTx = () => {
      if (initialData && onDelete) {
          if (confirm("Are you sure you want to delete this transaction?")) {
              onDelete(initialData.id);
              onClose();
          }
      }
  };

  const handleCreateCategory = () => {
    if (!newCatName) return;
    const newCat: Category = {
        id: crypto.randomUUID(),
        name: newCatName,
        icon: newCatIcon,
        color: newCatColor,
        type: type === 'transfer' ? 'expense' : type,
        parentId: newCatParent || undefined
    };
    onAddCategory(newCat);
    if (newCatParent) {
        setSelectedSubCategory(newCat.id);
    } else {
        setSelectedCategory(newCat.id);
        setSelectedSubCategory(null);
    }
    setViewMode('calculator');
    resetCreateForm();
  };

  const formattedDate = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
  });

  const calcKeys = [
    { label: '÷', val: '/', cls: 'text-blue-600 bg-gray-50' },
    { label: '7', val: '7', cls: 'bg-white' },
    { label: '8', val: '8', cls: 'bg-white' },
    { label: '9', val: '9', cls: 'bg-white' },
    { label: <Delete size={20}/>, val: 'BS', cls: 'text-red-500 bg-gray-50' },
    
    { label: '×', val: '*', cls: 'text-blue-600 bg-gray-50' },
    { label: '4', val: '4', cls: 'bg-white' },
    { label: '5', val: '5', cls: 'bg-white' },
    { label: '6', val: '6', cls: 'bg-white' },
    { label: <Calendar size={20}/>, val: 'Date', cls: 'text-gray-600 bg-gray-50' },

    { label: '-', val: '-', cls: 'text-blue-600 bg-gray-50' },
    { label: '1', val: '1', cls: 'bg-white' },
    { label: '2', val: '2', cls: 'bg-white' },
    { label: '3', val: '3', cls: 'bg-white' },
    { label: <Check size={28}/>, val: 'Done', cls: `${type === 'transfer' ? 'bg-cyan-500' : 'bg-red-500'} text-white row-span-2 rounded-br-2xl` }, 

    { label: '+', val: '+', cls: 'text-blue-600 bg-gray-50 rounded-bl-2xl' }, 
    { 
      label: <div className="flex flex-col items-center"><Repeat size={18} /><span className="text-[9px] font-bold uppercase">{recurrence ? recurrence.slice(0,3) : 'Off'}</span></div>, 
      val: 'Recur', 
      cls: recurrence ? 'bg-blue-100 text-blue-600' : 'bg-white text-gray-400' 
    },
    { label: '0', val: '0', cls: 'bg-white' },
    { label: '.', val: '.', cls: 'bg-white' },
  ];

  const currentCategory = categories.find(c => c.id === selectedCategory);
  const CategoryIcon = currentCategory ? ICON_MAP[currentCategory.icon] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-md h-[95vh] sm:h-auto sm:max-h-[90vh] sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <div className="flex items-center justify-between p-3 bg-gray-50 z-10 border-b">
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-200 rounded-full">
            <X size={20} />
          </button>
          
          <div className="flex bg-gray-200 p-1 rounded-lg">
            {(['expense', 'income', 'transfer'] as const).map(t => (
               <button 
                key={t}
                onClick={() => { setType(t); setSelectedCategory(null); setSelectedSubCategory(null); setViewMode('calculator'); }}
                className={`px-4 py-1.5 text-xs font-bold uppercase rounded-md transition-all ${
                  type === t 
                  ? (t === 'expense' ? 'bg-red-500 text-white shadow' : t === 'income' ? 'bg-green-500 text-white shadow' : 'bg-cyan-500 text-white shadow') 
                  : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="w-10 flex justify-end">
              {initialData && onDelete && (
                  <button onClick={handleDeleteTx} className="p-2 text-red-400 hover:bg-red-50 rounded-full">
                      <Trash2 size={20} />
                  </button>
              )}
          </div> 
        </div>

        {/* --- DYNAMIC CONTENT --- */}
        {type === 'transfer' ? (
          // TRANSFER LAYOUT
          <div className="flex-1 flex flex-col">
            
            {/* Split Account Selection Header */}
            <div className="flex h-32">
                {/* FROM Account */}
                <div className="flex-1 bg-cyan-500 flex flex-col justify-center px-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Wallet size={80} color="white"/></div>
                    <span className="text-cyan-100 text-xs font-bold uppercase mb-1">From account</span>
                    <div className="relative">
                        <select 
                            value={selectedAccount}
                            onChange={(e) => setSelectedAccount(e.target.value)}
                            className="w-full bg-transparent text-white font-bold text-lg outline-none appearance-none z-10 relative"
                        >
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.id} className="text-gray-800">{acc.name}</option>
                            ))}
                        </select>
                        <ChevronDown size={16} className="text-cyan-100 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none"/>
                    </div>
                    <div className="text-cyan-100/80 text-xs mt-1">{activeBook?.currency} {activeBook?.name}</div>
                </div>

                {/* TO Account */}
                <div className="flex-1 bg-lime-500 flex flex-col justify-center px-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Wallet size={80} color="white"/></div>
                    <span className="text-lime-100 text-xs font-bold uppercase mb-1">To account</span>
                    
                    {/* Optional Book Selector for Cross-Book */}
                    {books.length > 1 && (
                         <div className="relative mb-1 w-fit">
                            <select 
                                value={targetBookId}
                                onChange={(e) => setTargetBookId(e.target.value)}
                                className="bg-lime-600/30 rounded px-1 text-lime-50 text-[10px] outline-none appearance-none pr-3"
                            >
                                {books.map(b => (
                                    <option key={b.id} value={b.id} className="text-gray-800">{b.name}</option>
                                ))}
                            </select>
                            <ChevronDown size={10} className="text-lime-200 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none"/>
                         </div>
                    )}

                    <div className="relative">
                        <select 
                            value={targetAccount}
                            onChange={(e) => setTargetAccount(e.target.value)}
                            className="w-full bg-transparent text-white font-bold text-lg outline-none appearance-none z-10 relative"
                        >
                            {targetBookAccounts.map(acc => (
                                <option key={acc.id} value={acc.id} className="text-gray-800">{acc.name}</option>
                            ))}
                        </select>
                        <ChevronDown size={16} className="text-lime-100 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none"/>
                    </div>
                     <div className="text-lime-100/80 text-xs mt-1">{targetBook?.currency} {targetBook?.name}</div>
                </div>
            </div>

            {/* Split Amount Input */}
            <div className="flex border-b">
                {/* Withdrawal Amount */}
                <button 
                    onClick={() => setActiveField('source')}
                    className={`flex-1 py-6 px-4 flex flex-col items-center justify-center transition-colors ${activeField === 'source' ? 'bg-cyan-50' : 'bg-white'}`}
                >
                    <span className="text-xs font-bold text-cyan-500 uppercase mb-1">Withdrawal</span>
                    <div className="text-2xl font-bold text-cyan-600 break-all">
                        {amountStr.replace(/\*/g, '×').replace(/\//g, '÷')}
                        <span className="text-sm ml-1 text-cyan-400">{activeBook?.currency}</span>
                    </div>
                </button>

                {/* Deposit Amount */}
                <button 
                    onClick={() => setActiveField('target')}
                    className={`flex-1 py-6 px-4 flex flex-col items-center justify-center border-l transition-colors ${activeField === 'target' ? 'bg-lime-50' : 'bg-white'}`}
                >
                    <span className="text-xs font-bold text-lime-600 uppercase mb-1">Deposit</span>
                    <div className="text-2xl font-bold text-lime-600 break-all">
                         {isCurrencyMismatch 
                            ? (receivedAmountStr === '' ? '0' : receivedAmountStr).replace(/\*/g, '×').replace(/\//g, '÷') 
                            : amountStr.replace(/\*/g, '×').replace(/\//g, '÷')
                         }
                         <span className="text-sm ml-1 text-lime-500">{targetBook?.currency}</span>
                    </div>
                </button>
            </div>

            {/* Notes Section */}
            <div className="p-4 bg-white flex-1">
                <input 
                    type="text" 
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Notes..."
                    className="w-full p-4 bg-gray-50 rounded-xl text-center text-gray-600 outline-none placeholder:text-gray-300 border focus:border-cyan-100 focus:bg-white transition-all"
                />
            </div>

          </div>
        ) : (
          // STANDARD LAYOUT (Expense/Income)
          <>
            <div className="bg-white py-6 flex flex-col items-center justify-center border-b shrink-0">
                 <div className="flex items-baseline justify-center gap-1 w-full truncate px-4">
                    <span className="text-2xl text-gray-400 font-medium">{currency}</span>
                    <span className={`text-5xl font-bold tracking-tight break-all text-center ${
                      type === 'income' ? 'text-green-600' : 'text-gray-800'
                    }`}>
                      {amountStr.replace(/\*/g, '×').replace(/\//g, '÷')}
                    </span>
                 </div>
            </div>

            <div className="bg-white p-4 space-y-3 shrink-0">
                 <div className="flex gap-3">
                    <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2 flex flex-col justify-center relative border border-gray-100">
                        <span className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">Account</span>
                        <select 
                            value={selectedAccount}
                            onChange={(e) => setSelectedAccount(e.target.value)}
                            className="bg-transparent font-semibold text-sm text-gray-700 outline-none w-full appearance-none z-10"
                        >
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none mt-2" />
                    </div>
                    
                    <button 
                        onClick={() => setViewMode(prev => prev === 'categories' ? 'calculator' : 'categories')}
                        className={`flex-1 rounded-xl px-3 py-2 flex items-center justify-between border transition-all ${
                            viewMode === 'categories' ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'
                        }`}
                    >
                        <div className="flex flex-col items-start overflow-hidden">
                             <span className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">Category</span>
                             <div className="flex items-center gap-2">
                                 {selectedCategory ? (
                                    <>
                                        {CategoryIcon && <CategoryIcon size={16} className={type === 'expense' ? 'text-red-500' : 'text-green-500'} />}
                                        <span className="font-semibold text-sm text-gray-700 truncate">{currentCategory?.name}</span>
                                    </>
                                 ) : (
                                     <span className="text-sm text-gray-400 italic">Select...</span>
                                 )}
                             </div>
                        </div>
                        <ChevronDown size={14} className="text-gray-400 mt-2" />
                    </button>
                </div>

                <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <Tag size={16} />
                    </div>
                    <input 
                        type="text" 
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        placeholder="Add tags..."
                        className="w-full pl-9 pr-3 py-3 bg-gray-50 rounded-xl text-sm outline-none placeholder:text-gray-400 font-medium border border-transparent focus:bg-white focus:border-blue-100 transition-all"
                    />
                </div>

                {selectedCategory && (
                    <div className="overflow-x-auto no-scrollbar py-1">
                         <div className="flex gap-2">
                            {subCategories.map(sub => {
                                const isSelected = selectedSubCategory === sub.id;
                                const SubIcon = ICON_MAP[sub.icon] || ICON_MAP['ShoppingBag'];
                                return (
                                    <button
                                        key={sub.id}
                                        onClick={() => setSelectedSubCategory(isSelected ? null : sub.id)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium whitespace-nowrap transition-all ${
                                            isSelected 
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' 
                                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                        }`}
                                    >
                                        <SubIcon size={14} />
                                        {sub.name}
                                    </button>
                                );
                            })}
                            <button
                               onClick={() => {
                                   setNewCatParent(selectedCategory);
                                   const p = categories.find(c => c.id === selectedCategory);
                                   if (p) { setNewCatColor(p.color); setNewCatIcon(p.icon); }
                                   setViewMode('create-category');
                               }}
                               className="flex items-center gap-1 px-3 py-2 rounded-lg border border-dashed border-gray-300 text-gray-500 text-xs font-bold hover:bg-gray-50 whitespace-nowrap"
                            >
                                <Plus size={12}/> New
                            </button>
                        </div>
                    </div>
                )}
            </div>
          </>
        )}

        {/* Dynamic Bottom Area */}
        <div className="flex-1 bg-gray-100 relative overflow-hidden flex flex-col border-t border-gray-200">
            {viewMode === 'create-category' ? (
                 <div className="flex-1 overflow-y-auto p-4 bg-white">
                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">
                        {newCatParent ? 'Create Subcategory' : 'Create Category'}
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-gray-500">Name</label>
                            <input 
                                autoFocus
                                type="text" 
                                value={newCatName}
                                onChange={e => setNewCatName(e.target.value)}
                                className="w-full p-2 border rounded-lg text-sm mt-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="Category Name"
                            />
                        </div>
                        
                        <div>
                            <label className="text-xs font-semibold text-gray-500 mb-1 block">Color</label>
                            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                {AVAILABLE_COLORS.map(c => (
                                    <button 
                                        key={c} 
                                        onClick={() => setNewCatColor(c)} 
                                        className={`w-8 h-8 rounded-full shrink-0 transition-transform ${newCatColor === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`} 
                                        style={{backgroundColor: c}} 
                                    />
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-gray-500 mb-1 block">Icon</label>
                            <div className="grid grid-cols-6 gap-2 h-32 overflow-y-auto border p-2 rounded-lg bg-gray-50">
                                {ICON_KEYS.map(k => {
                                    const Icon = ICON_MAP[k];
                                    return (
                                    <button 
                                        key={k} 
                                        onClick={() => setNewCatIcon(k)} 
                                        className={`p-2 rounded-lg flex justify-center hover:bg-white transition-colors ${newCatIcon === k ? 'bg-blue-100 text-blue-600 ring-1 ring-blue-300' : 'text-gray-400'}`}
                                    >
                                        <Icon size={20} />
                                    </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                             <button 
                                onClick={() => { setViewMode('calculator'); resetCreateForm(); }}
                                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleCreateCategory}
                                disabled={!newCatName}
                                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm disabled:opacity-50"
                            >
                                Create
                            </button>
                        </div>
                    </div>
                 </div>
            ) : viewMode === 'categories' ? (
                <div className="flex-1 overflow-y-auto p-4 bg-white">
                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Select Category</h3>
                    <div className="grid grid-cols-4 gap-3">
                      {filteredCategories.map(cat => {
                        const Icon = ICON_MAP[cat.icon] || ICON_MAP['ShoppingBag'];
                        return (
                          <button 
                            key={cat.id}
                            onClick={() => { setSelectedCategory(cat.id); setSelectedSubCategory(null); setViewMode('calculator'); }}
                            className={`flex flex-col items-center gap-1 p-3 rounded-2xl border transition-all ${
                              selectedCategory === cat.id ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                            }`}
                          >
                            <div className="w-10 h-10 rounded-full flex items-center justify-center mb-1" style={{ backgroundColor: cat.color + '20', color: cat.color }}>
                              <Icon size={20} />
                            </div>
                            <span className="text-[10px] font-bold text-gray-600 truncate w-full text-center leading-tight">{cat.name}</span>
                          </button>
                        )
                      })}
                      {/* Add Category Tile */}
                      <button 
                        onClick={() => {
                            setNewCatParent(null);
                            setViewMode('create-category');
                        }}
                        className="flex flex-col items-center gap-1 p-3 rounded-2xl border border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100"
                      >
                         <div className="w-10 h-10 rounded-full flex items-center justify-center mb-1 bg-gray-200 text-gray-500">
                             <Plus size={20} />
                         </div>
                         <span className="text-[10px] font-bold text-gray-500">New</span>
                      </button>
                    </div>
                </div>
            ) : (
                <div className="h-full grid grid-cols-5 gap-px bg-gray-200">
                     {calcKeys.map((k, i) => (
                        <button
                          key={i}
                          onClick={() => handleCalculatorInput(k.val)}
                          className={`flex items-center justify-center text-xl font-medium active:bg-gray-100 transition-colors ${k.cls}`}
                        >
                          {k.label}
                        </button>
                      ))}
                </div>
            )}
        </div>

        {/* Bottom Date Display */}
        <div className="bg-gray-50 border-t p-2 text-center relative">
            <div className="flex flex-col items-center">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {formattedDate}
                </span>
                {recurrence && (
                    <span className="text-[10px] font-bold text-blue-600 uppercase flex items-center gap-1 mt-0.5">
                        <Repeat size={10} /> {recurrence}
                    </span>
                )}
            </div>
            {/* Hidden Date Input for Native Picker */}
            <input 
                type="date" 
                ref={dateInputRef}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="absolute opacity-0 pointer-events-none bottom-0 left-0" 
            />
        </div>

      </div>
    </div>
  );
};

export default AddTransactionModal;
