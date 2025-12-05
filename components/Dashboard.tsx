
import React, { useMemo, useState } from 'react';
import { Book } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Sparkles, ArrowRightLeft, TrendingUp, TrendingDown, Wallet, ChevronDown, Check, Settings2, X, AlertCircle } from 'lucide-react';
import { ICON_MAP } from '../constants';

interface Props {
  book: Book;
  books: Book[];
  onSwitchBook: (id: string) => void;
  onOpenAdd: () => void;
  insight: string;
  isGeneratingInsight: boolean;
  onGenerateInsight: () => void;
  onUpdateBudget: (categoryId: string, amount: number) => void;
}

const Dashboard: React.FC<Props> = ({ book, books, onSwitchBook, onOpenAdd, insight, isGeneratingInsight, onGenerateInsight, onUpdateBudget }) => {
  const [isWalletSelectorOpen, setIsWalletSelectorOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);

  const { totalBalance, income, expense, chartData, budgetProgress, allExpenseCategories } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    const catMap: Record<string, number> = {};
    const accBalances: Record<string, number> = {};
    
    // Initialize account balances
    book.accounts.forEach(acc => accBalances[acc.id] = acc.initialBalance);

    book.transactions.forEach(t => {
      // Balance updates
      if (t.type === 'income') {
        inc += t.amount;
        if (accBalances[t.accountId] !== undefined) {
          accBalances[t.accountId] += t.amount;
        }
      } else if (t.type === 'expense') {
        exp += t.amount;
        if (accBalances[t.accountId] !== undefined) {
          accBalances[t.accountId] -= t.amount;
        }
        if (t.categoryId) {
          if (!catMap[t.categoryId]) catMap[t.categoryId] = 0;
          catMap[t.categoryId] += t.amount;
        }
      } else if (t.type === 'transfer') {
        if (accBalances[t.accountId] !== undefined) {
            accBalances[t.accountId] -= t.amount;
        }
        if (t.toAccountId && accBalances[t.toAccountId] !== undefined) {
            accBalances[t.toAccountId] += t.amount;
        }
      }
    });

    const total = Object.values(accBalances).reduce((sum, val) => sum + val, 0);

    const chart = Object.keys(catMap).map(catId => {
      const cat = book.categories.find(c => c.id === catId);
      return {
        name: cat?.name || 'Unknown',
        value: catMap[catId],
        color: cat?.color || '#cbd5e1'
      };
    }).sort((a, b) => b.value - a.value);

    // Budget Calculations
    const budgets = book.categories
      .filter(c => c.budgetLimit && c.budgetLimit > 0)
      .map(c => ({
        id: c.id,
        name: c.name,
        limit: c.budgetLimit!,
        spent: catMap[c.id] || 0,
        color: c.color
      }));
      
    const allExpenseCategories = book.categories.filter(c => c.type === 'expense' && !c.parentId);

    return { 
      totalBalance: total, 
      income: inc, 
      expense: exp, 
      chartData: chart, 
      budgetProgress: budgets,
      allExpenseCategories
    };
  }, [book]);

  const walletColor = book.color || '#3b82f6';

  return (
    <div className="flex-1 overflow-y-auto pb-24 no-scrollbar bg-gray-50 relative">
      
      {/* Modern Hero Section */}
      <div className="pt-6 px-6 pb-6 rounded-b-[2.5rem] bg-white shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4 relative z-20">
            <div className="relative">
                <button 
                    onClick={() => setIsWalletSelectorOpen(!isWalletSelectorOpen)}
                    className="text-left group focus:outline-none"
                >
                    <h1 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        {book.name} 
                        <ChevronDown size={14} className={`transition-transform duration-200 ${isWalletSelectorOpen ? 'rotate-180 text-blue-500' : 'text-gray-300'}`}/>
                    </h1>
                    <div className="flex items-center gap-1 mt-0.5">
                        <div className="w-2 h-2 rounded-full" style={{backgroundColor: walletColor}}></div>
                        <span className="text-[10px] text-gray-300 font-mono group-hover:text-blue-500 transition-colors">Switch Wallet</span>
                    </div>
                </button>

                {/* Dropdown Menu */}
                {isWalletSelectorOpen && (
                     <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 animate-in fade-in zoom-in-95 duration-200 origin-top-left">
                         <div className="text-[10px] font-bold text-gray-400 uppercase px-3 py-2">My Wallets</div>
                         <div className="max-h-60 overflow-y-auto no-scrollbar space-y-1">
                             {books.map(b => (
                                 <button
                                    key={b.id}
                                    onClick={() => { onSwitchBook(b.id); setIsWalletSelectorOpen(false); }}
                                    className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all ${b.id === book.id ? 'bg-blue-50 ring-1 ring-blue-100' : 'hover:bg-gray-50'}`}
                                 >
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm" style={{backgroundColor: b.color || '#3b82f6'}}>
                                        {b.currency}
                                    </div>
                                    <div className="text-left flex-1 min-w-0">
                                        <div className={`text-xs font-bold truncate ${b.id === book.id ? 'text-blue-700' : 'text-gray-700'}`}>{b.name}</div>
                                        <div className="text-[10px] text-gray-400">{b.accounts.length} accounts</div>
                                    </div>
                                    {b.id === book.id && <Check size={14} className="text-blue-500 mr-1"/>}
                                 </button>
                             ))}
                         </div>
                     </div>
                )}
            </div>
            
            <div className="p-2 bg-gray-50 rounded-full text-gray-400">
                <Wallet size={20} />
            </div>
        </div>

        {/* Click outside overlay to close dropdown */}
        {isWalletSelectorOpen && <div className="fixed inset-0 z-10" onClick={() => setIsWalletSelectorOpen(false)}></div>}

        <div 
            className="rounded-3xl p-6 text-white shadow-lg relative overflow-hidden transition-all duration-300"
            style={{ 
                background: `linear-gradient(135deg, ${walletColor}, ${walletColor}DD)`,
                boxShadow: `0 10px 25px -5px ${walletColor}55` 
            }}
        >
            <div className="relative z-10">
                <span className="text-white/80 text-xs font-medium uppercase tracking-wide">Total Balance</span>
                <div className="text-4xl font-bold mt-1 mb-6 tracking-tight">
                    {book.currency}{totalBalance.toLocaleString()}
                </div>
                
                <div className="flex items-center gap-4 bg-white/10 p-3 rounded-2xl backdrop-blur-sm border border-white/10">
                    <div className="flex-1 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white">
                            <TrendingDown size={16} />
                        </div>
                        <div>
                             <div className="text-[10px] text-white/70 uppercase font-bold">Income</div>
                             <div className="text-sm font-bold text-white">+{income.toLocaleString()}</div>
                        </div>
                    </div>
                    <div className="w-px h-8 bg-white/10"></div>
                    <div className="flex-1 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white">
                            <TrendingUp size={16} />
                        </div>
                        <div>
                             <div className="text-[10px] text-white/70 uppercase font-bold">Expense</div>
                             <div className="text-sm font-bold text-white">-{expense.toLocaleString()}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Decorative Circles */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/5 rounded-full blur-xl pointer-events-none"></div>
        </div>
      </div>

      {/* Budgets Section */}
      <div className="px-6 mb-6">
         <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
           <div className="flex items-center justify-between mb-4">
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Monthly Budgets</h3>
               <button onClick={() => setIsBudgetModalOpen(true)} className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded transition-colors">
                   <Settings2 size={12} /> Manage
               </button>
           </div>
           
           {budgetProgress.length > 0 ? (
               <div className="space-y-4">
               {budgetProgress.map(b => {
                 const pct = Math.min((b.spent / b.limit) * 100, 100);
                 const isOver = b.spent > b.limit;
                 return (
                   <div key={b.id} onClick={() => setIsBudgetModalOpen(true)} className="cursor-pointer active:scale-99 transition-transform">
                     <div className="flex justify-between text-xs mb-1.5">
                       <span className="font-bold text-gray-700">{b.name}</span>
                       <span className={isOver ? 'text-red-500 font-bold' : 'text-gray-400 font-medium'}>
                         {book.currency}{b.spent} <span className="text-gray-300">/ {b.limit}</span>
                       </span>
                     </div>
                     <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                       <div 
                         className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-red-500' : ''}`}
                         style={{ width: `${pct}%`, backgroundColor: isOver ? undefined : b.color }}
                       />
                     </div>
                   </div>
                 )
               })}
             </div>
           ) : (
             <div className="text-center py-6 text-gray-400 text-xs">
                 <div className="flex justify-center mb-2"><AlertCircle size={20} className="text-gray-300"/></div>
                 No budgets set. Click "Manage" to start.
             </div>
           )}
         </div>
      </div>

      {/* Expense Chart */}
      <div className="px-6 mb-6">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
           <h3 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-wider">Spending Structure</h3>
           {chartData.length > 0 ? (
             <div className="flex items-center">
               <div className="h-40 w-40 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={4}
                        dataKey="value"
                        cornerRadius={4}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <span className="text-xs font-bold text-gray-400">EXP</span>
                  </div>
               </div>
               <div className="flex-1 ml-6 space-y-3">
                  {chartData.slice(0, 4).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-gray-600 font-medium truncate max-w-[80px]">{item.name}</span>
                      </div>
                      <span className="font-bold text-gray-800">{book.currency}{item.value.toLocaleString()}</span>
                    </div>
                  ))}
               </div>
             </div>
           ) : (
             <div className="text-center py-10 text-gray-400 text-sm">No expenses this period</div>
           )}
        </div>
      </div>

      {/* AI Insights */}
      <div className="px-6 mb-6">
        <div className="bg-indigo-600 rounded-3xl p-6 shadow-lg text-white relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold flex items-center gap-2 text-indigo-100 text-sm uppercase tracking-wider">
                <Sparkles size={16} className="text-yellow-300" />
                AI Advisor
                </h3>
                <button 
                onClick={onGenerateInsight}
                disabled={isGeneratingInsight}
                className="bg-white/10 hover:bg-white/20 text-[10px] px-3 py-1.5 rounded-full transition-colors font-bold uppercase tracking-wide disabled:opacity-50"
                >
                {isGeneratingInsight ? 'Analyzing...' : 'Analyze'}
                </button>
            </div>
            <p className="text-sm text-indigo-100 leading-relaxed opacity-90 font-medium">
                {insight || "Tap Analyze to get smart, AI-powered financial advice based on your recent spending."}
            </p>
          </div>
           {/* Decor */}
           <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-500 rounded-full blur-3xl opacity-50"></div>
        </div>
      </div>

      {/* Budget Management Modal */}
      {isBudgetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
             <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[80vh] flex flex-col">
                 <div className="p-4 border-b flex justify-between items-center">
                     <h3 className="font-bold text-lg text-gray-800">Manage Budgets</h3>
                     <button onClick={() => setIsBudgetModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                         <X size={20} />
                     </button>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto p-4 space-y-3">
                     {allExpenseCategories.map(cat => {
                         const Icon = ICON_MAP[cat.icon];
                         return (
                             <div key={cat.id} className="flex items-center gap-3">
                                 <div className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm shrink-0" style={{backgroundColor: cat.color}}>
                                     {Icon && <Icon size={18} />}
                                 </div>
                                 <div className="flex-1 min-w-0">
                                     <div className="text-sm font-bold text-gray-700 truncate">{cat.name}</div>
                                 </div>
                                 <div className="w-24">
                                     <input 
                                        type="number"
                                        placeholder="0"
                                        value={cat.budgetLimit || ''}
                                        onChange={(e) => onUpdateBudget(cat.id, parseFloat(e.target.value) || 0)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-right text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                                     />
                                 </div>
                             </div>
                         )
                     })}
                 </div>

                 <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
                     <button onClick={() => setIsBudgetModalOpen(false)} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow hover:bg-blue-700 transition-colors">
                         Done
                     </button>
                 </div>
             </div>
          </div>
      )}

    </div>
  );
};

export default Dashboard;
