
import React, { useState, useMemo } from 'react';
import { Book, TransactionType, Category } from '../types';
import { ChevronLeft, ChevronRight, Calendar, Plus, ArrowRightLeft, ChevronDown, Check } from 'lucide-react';
import { ICON_MAP } from '../constants';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface Props {
  book: Book;
  books: Book[];
  onSwitchBook: (id: string) => void;
  onSelectCategory: (categoryId: string, type: TransactionType) => void;
  onAddCategoryClick: (type: TransactionType) => void;
  onTransferClick: () => void;
}

type Period = 'month' | 'year';

interface CategoryBubbleProps {
    cat?: Category; 
    amount?: number; 
    currency?: string; 
    onClick: () => void;
    isAddButton?: boolean;
}

const CategoryBubble: React.FC<CategoryBubbleProps> = ({ cat, amount, currency, onClick, isAddButton }) => {
    if (isAddButton) {
        return (
            <button 
                onClick={onClick}
                className="flex flex-col items-center gap-2 p-2 rounded-2xl hover:bg-white/50 transition-colors group"
            >
                <div 
                    className="w-14 h-14 rounded-full flex items-center justify-center bg-gray-200 text-gray-500 shadow-sm transition-transform group-hover:scale-105 border-2 border-dashed border-gray-300"
                >
                    <Plus size={24} />
                </div>
                <div className="text-center">
                    <div className="text-xs font-bold text-gray-400">New</div>
                    <div className="text-xs font-medium text-transparent">_</div>
                </div>
            </button>
        )
    }

    if (!cat) return <div className="p-2"></div>;

    const Icon = ICON_MAP[cat.icon] || ICON_MAP['ShoppingBag'];
    return (
        <button 
            onClick={onClick}
            className="flex flex-col items-center gap-2 p-2 rounded-2xl hover:bg-white/50 transition-colors"
        >
            <div 
                className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-md transition-transform hover:scale-105"
                style={{ backgroundColor: cat.color }}
            >
                <Icon size={24} />
            </div>
            <div className="text-center">
                <div className="text-xs font-bold text-gray-700 truncate w-20">{cat.name}</div>
                <div className={`text-xs font-medium ${amount && amount > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                    {currency}{amount?.toLocaleString() || '0'}
                </div>
            </div>
        </button>
    )
}

const CategoriesView: React.FC<Props> = ({ book, books, onSwitchBook, onSelectCategory, onAddCategoryClick, onTransferClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [period, setPeriod] = useState<Period>('month');
  const [viewType, setViewType] = useState<TransactionType>('expense');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isWalletSelectorOpen, setIsWalletSelectorOpen] = useState(false);

  // Helper: Get date range
  const { start, end, label } = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    let start, end, label;

    if (period === 'month') {
      start = new Date(y, m, 1);
      end = new Date(y, m + 1, 0, 23, 59, 59);
      label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else {
      start = new Date(y, 0, 1);
      end = new Date(y, 11, 31, 23, 59, 59);
      label = start.toLocaleDateString('en-US', { year: 'numeric' });
    }
    return { start, end, label };
  }, [currentDate, period]);

  // Aggregate Data
  const { categoryTotals, totalIncome, totalExpense } = useMemo(() => {
    const catTotals: Record<string, number> = {};
    let tInc = 0;
    let tExp = 0;

    book.transactions.forEach(t => {
      const tDate = new Date(t.date);
      if (tDate >= start && tDate <= end) {
        if (t.type === 'income') tInc += t.amount;
        if (t.type === 'expense') tExp += t.amount;
        
        if (t.type === viewType && t.categoryId) {
          // Find the category to check if it has a parent
          const cat = book.categories.find(c => c.id === t.categoryId);
          if (cat) {
              // If it's a subcategory, attribute amount to parent, otherwise to itself
              const targetId = cat.parentId || cat.id;
              catTotals[targetId] = (catTotals[targetId] || 0) + t.amount;
          }
        }
      }
    });

    return { categoryTotals: catTotals, totalIncome: tInc, totalExpense: tExp };
  }, [book, start, end, viewType]);

  // Prepare Grid Items
  const categoriesList = book.categories.filter(c => c.type === viewType && !c.parentId);
  
  // Combine categories and the "Add New" button into a single list to layout
  const allItems = [
      ...categoriesList.map(c => ({ type: 'category' as const, data: c })),
      { type: 'add_button' as const }
  ];

  // We want the summary widget to be visually at position 5 (index 4).
  // So we need to ensure there are exactly 4 items rendered before it.
  const preCenterItems = allItems.slice(0, 4);
  const postCenterItems = allItems.slice(4);

  // Fillers needed if we have fewer than 4 items before center
  const fillersNeeded = 4 - preCenterItems.length;
  const fillers = Array.from({ length: fillersNeeded > 0 ? fillersNeeded : 0 });


  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (period === 'month') newDate.setMonth(newDate.getMonth() - 1);
    else newDate.setFullYear(newDate.getFullYear() - 1);
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (period === 'month') newDate.setMonth(newDate.getMonth() + 1);
    else newDate.setFullYear(newDate.getFullYear() + 1);
    setCurrentDate(newDate);
  };

  const currentTotal = viewType === 'expense' ? totalExpense : totalIncome;
  const otherTotal = viewType === 'expense' ? totalIncome : totalExpense;
  const otherLabel = viewType === 'expense' ? 'Income' : 'Expense';

  // Chart data for the ring
  const chartData = [
    { name: 'Main', value: currentTotal || 1, color: viewType === 'expense' ? '#ef4444' : '#10b981' }, // Red for expense, Green for income
    { name: 'Remaining', value: 0, color: '#f3f4f6' } 
  ];

  return (
    <div className="flex-1 flex flex-col bg-gray-50 h-full overflow-hidden">
      
      {/* Header */}
      <div className="bg-white p-3 shadow-sm z-20 flex items-center justify-between relative">
         {/* Transfer Button */}
         <button 
            onClick={onTransferClick} 
            className="p-2.5 bg-gray-100 text-gray-600 rounded-full hover:bg-blue-50 hover:text-blue-600 transition-colors"
            title="Transfer"
         >
            <ArrowRightLeft size={20} />
         </button>
         
         {/* Date Nav */}
         <div className="flex items-center gap-2">
            <button onClick={handlePrev} className="p-2 text-gray-400 hover:text-gray-800"><ChevronLeft size={20}/></button>
            <div className="relative">
                <button 
                    onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full font-bold text-xs uppercase tracking-wide bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                    <Calendar size={14}/> {label}
                </button>
                
                {isDatePickerOpen && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white shadow-xl rounded-xl p-2 border border-gray-100 w-40 z-50">
                        <button onClick={() => { setPeriod('month'); setIsDatePickerOpen(false); }} className={`w-full text-left px-4 py-2 text-sm font-semibold rounded-lg ${period === 'month' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>Monthly</button>
                        <button onClick={() => { setPeriod('year'); setIsDatePickerOpen(false); }} className={`w-full text-left px-4 py-2 text-sm font-semibold rounded-lg ${period === 'year' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>Yearly</button>
                    </div>
                )}
            </div>
            <button onClick={handleNext} className="p-2 text-gray-400 hover:text-gray-800"><ChevronRight size={20}/></button>
         </div>
         
         {/* Wallet Name & Switcher */}
         <div className="relative">
             <button 
                onClick={() => setIsWalletSelectorOpen(!isWalletSelectorOpen)}
                className="flex flex-col items-end min-w-[40px] focus:outline-none"
             >
                 <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                    Wallet <ChevronDown size={10} className={`transition-transform ${isWalletSelectorOpen ? 'rotate-180' : ''}`}/>
                 </span>
                 <div className="flex items-center gap-1">
                     <div className="w-2 h-2 rounded-full" style={{ backgroundColor: book.color || '#3b82f6' }} />
                     <span className="text-xs font-bold text-gray-700 truncate max-w-[80px]">{book.name}</span>
                 </div>
             </button>

             {isWalletSelectorOpen && (
                 <>
                     <div className="fixed inset-0 z-30" onClick={() => setIsWalletSelectorOpen(false)}></div>
                     <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 p-1 z-40 animate-in fade-in zoom-in-95 duration-200">
                         {books.map(b => (
                             <button
                                key={b.id}
                                onClick={() => { onSwitchBook(b.id); setIsWalletSelectorOpen(false); }}
                                className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${b.id === book.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}`}
                             >
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm shrink-0" style={{backgroundColor: b.color || '#3b82f6'}}>
                                    {b.currency}
                                </div>
                                <span className="text-xs font-bold truncate flex-1 text-left">{b.name}</span>
                                {b.id === book.id && <Check size={14} className="text-blue-500"/>}
                             </button>
                         ))}
                     </div>
                 </>
             )}
         </div>
      </div>

      {/* Main Grid Area */}
      <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
          <div className="grid grid-cols-3 gap-4">
              
              {/* 1. Pre-Center Items */}
              {preCenterItems.map((item, idx) => {
                  if (item.type === 'category') {
                      const cat = item.data;
                      return (
                        <CategoryBubble 
                            key={cat.id} 
                            cat={cat} 
                            amount={categoryTotals[cat.id] || 0} 
                            currency={book.currency}
                            onClick={() => onSelectCategory(cat.id, viewType)}
                        />
                      );
                  } else {
                      return <CategoryBubble key="add-btn" isAddButton onClick={() => onAddCategoryClick(viewType)} />;
                  }
              })}

              {/* 2. Fillers (Empty Divs) */}
              {fillers.map((_, i) => <div key={`filler-${i}`}></div>)}

              {/* 3. The Summary Center */}
              <div 
                onClick={() => setViewType(prev => prev === 'expense' ? 'income' : 'expense')}
                className="aspect-square rounded-full bg-white shadow-lg flex flex-col items-center justify-center relative cursor-pointer active:scale-95 transition-transform z-10 p-2"
              >
                 {/* Chart Ring */}
                 <div className="absolute inset-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius="85%"
                                outerRadius="100%"
                                startAngle={90}
                                endAngle={-270}
                                dataKey="value"
                                stroke="none"
                            >
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                 </div>

                 <div className="text-center z-10 flex flex-col items-center justify-center h-full w-full rounded-full">
                     <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                        {viewType}
                     </span>
                     <span className={`text-xl font-bold ${viewType === 'expense' ? 'text-red-500' : 'text-green-500'} break-all px-2`}>
                        {book.currency}{currentTotal.toLocaleString()}
                     </span>
                     <div className="mt-2 pt-2 border-t border-gray-100 w-1/2"></div>
                     <span className="text-[10px] font-semibold text-gray-400 mt-1">
                        {otherLabel}: {book.currency}{otherTotal.toLocaleString()}
                     </span>
                 </div>
              </div>

              {/* 4. Post-Center Items */}
              {postCenterItems.map((item, idx) => {
                   if (item.type === 'category') {
                      const cat = item.data;
                      return (
                        <CategoryBubble 
                            key={cat.id} 
                            cat={cat} 
                            amount={categoryTotals[cat.id] || 0} 
                            currency={book.currency}
                            onClick={() => onSelectCategory(cat.id, viewType)}
                        />
                      );
                  } else {
                      return <CategoryBubble key="add-btn-post" isAddButton onClick={() => onAddCategoryClick(viewType)} />;
                  }
              })}

          </div>
      </div>
    </div>
  );
};

export default CategoriesView;
