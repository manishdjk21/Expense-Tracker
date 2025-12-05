
import React, { useState, useMemo } from 'react';
import { Book, Transaction, GlobalData, UserProfile } from '../types';
import { ChevronLeft, ChevronRight, Calendar, ArrowRightLeft, ShoppingBag } from 'lucide-react';
import { ICON_MAP } from '../constants';

interface Props {
  activeBook: Book;
  users: UserProfile[];
  onEditTransaction: (tx: Transaction) => void;
}

type Period = 'month' | 'year';

const HistoryView: React.FC<Props> = ({ activeBook, users, onEditTransaction }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [period, setPeriod] = useState<Period>('month');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Helper: Get date range and label
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

  const filteredTransactions = useMemo(() => {
    return activeBook.transactions
        .filter(t => {
            const d = new Date(t.date);
            return d >= start && d <= end;
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeBook.transactions, start, end]);

  // Group by Date for cleaner UI
  const groupedTransactions = useMemo(() => {
      const groups: Record<string, Transaction[]> = {};
      filteredTransactions.forEach(tx => {
          const dateKey = new Date(tx.date).toLocaleDateString();
          if (!groups[dateKey]) groups[dateKey] = [];
          groups[dateKey].push(tx);
      });
      return groups;
  }, [filteredTransactions]);

  const sortedDates = Object.keys(groupedTransactions).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  const walletColor = activeBook.color || '#3b82f6';

  return (
    <div className="flex-1 flex flex-col bg-gray-50 h-full overflow-hidden">
      
      {/* Date Header */}
      <div className="bg-white p-4 shadow-sm z-20">
        <div className="flex items-center justify-between">
            <button onClick={handlePrev} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"><ChevronLeft/></button>
            <div className="relative">
                <button 
                    onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm uppercase tracking-wide transition-colors"
                    style={{ color: walletColor, backgroundColor: `${walletColor}15` }}
                >
                    <Calendar size={16}/> {label}
                </button>
                
                {isDatePickerOpen && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white shadow-xl rounded-xl p-2 border border-gray-100 w-40 z-50 animate-in fade-in zoom-in-95 duration-200">
                        <button onClick={() => { setPeriod('month'); setIsDatePickerOpen(false); }} className={`w-full text-left px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${period === 'month' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}>Monthly</button>
                        <button onClick={() => { setPeriod('year'); setIsDatePickerOpen(false); }} className={`w-full text-left px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${period === 'year' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}>Yearly</button>
                    </div>
                )}
            </div>
            <button onClick={handleNext} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"><ChevronRight/></button>
        </div>
      </div>

      {/* Transactions List */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4 no-scrollbar">
         {filteredTransactions.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                 <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <ShoppingBag size={24} className="opacity-30" />
                 </div>
                 <p className="text-sm font-medium">No transactions this period</p>
             </div>
         ) : (
            <div className="space-y-6">
                {sortedDates.map(dateKey => {
                    const txs = groupedTransactions[dateKey];
                    // Calculate header label (Today, Yesterday, etc.)
                    const dateObj = new Date(txs[0].date);
                    const today = new Date();
                    const yesterday = new Date();
                    yesterday.setDate(today.getDate() - 1);
                    
                    let dateLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
                    if (dateObj.toDateString() === today.toDateString()) dateLabel = "Today";
                    else if (dateObj.toDateString() === yesterday.toDateString()) dateLabel = "Yesterday";

                    return (
                        <div key={dateKey}>
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">{dateLabel}</h3>
                            <div className="space-y-3">
                                {txs.map(tx => {
                                    const cat = activeBook.categories.find(c => c.id === tx.categoryId);
                                    const acc = activeBook.accounts.find(a => a.id === tx.accountId);
                                    const toAcc = activeBook.accounts.find(a => a.id === tx.toAccountId);
                                    const Icon = cat ? ICON_MAP[cat.icon] : (tx.type === 'transfer' ? ICON_MAP['ArrowRightLeft'] : ICON_MAP['ShoppingBag']);
                                    const creator = users.find(u => u.id === tx.createdBy);

                                    let transferLabel = '';
                                    if (tx.type === 'transfer') {
                                        if (tx.relatedBookId) {
                                            // Cross-book logic if needed, simplify for UI
                                            transferLabel = `Transfer`;
                                        } else {
                                            transferLabel = `To: ${toAcc?.name || 'Unknown'}`;
                                        }
                                    }

                                    return (
                                        <div 
                                            key={tx.id} 
                                            onClick={() => onEditTransaction(tx)}
                                            className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between border border-transparent hover:border-gray-100 active:scale-[0.99] transition-all cursor-pointer"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div 
                                                    className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm"
                                                    style={{ backgroundColor: cat?.color || (tx.type === 'transfer' ? '#94a3b8' : '#ccc') }}
                                                >
                                                    {Icon && <Icon size={18} />}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-800 text-sm">
                                                        {tx.type === 'transfer' ? transferLabel : (cat?.name || 'Unknown')}
                                                    </div>
                                                    <div className="text-[10px] text-gray-400 flex items-center gap-1 font-medium">
                                                        {acc ? acc.name : 'External'}
                                                        {creator && <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{creator.name}</span>}
                                                        {tx.isRecurring && <span className="text-blue-500">↻</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`font-bold text-sm ${tx.type === 'income' ? 'text-green-500' : tx.type === 'expense' ? 'text-gray-800' : 'text-blue-500'}`}>
                                                {tx.type === 'expense' ? '-' : '+'}{activeBook.currency}{tx.amount.toLocaleString()}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>
         )}
      </div>
    </div>
  );
};

export default HistoryView;
