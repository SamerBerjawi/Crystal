
import React, { useMemo, useState } from 'react';
import { InvestmentTransaction, Warrant, Transaction, Account } from '../types';
import { formatCurrency, parseDateAsUTC } from '../utils';
import Card from '../components/Card';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import WarrantPriceModal from '../components/WarrantPriceModal';
import AddInvestmentTransactionModal from '../components/AddInvestmentTransactionModal';
import WarrantModal from '../components/WarrantModal';

interface InvestmentDetailProps {
  symbol: string;
  transactions: InvestmentTransaction[];
  warrants: Warrant[];
  currentPrice: number | null;
  onManualPriceChange: (isin: string, price: number | null) => void;
  onAddTransaction: (invTx: Omit<InvestmentTransaction, 'id'> & { id?: string }, cashTx?: Omit<Transaction, 'id'>, newAccount?: Omit<Account, 'id'>) => void;
  onEditTransaction: (invTx: Omit<InvestmentTransaction, 'id'> & { id?: string }, cashTx?: Omit<Transaction, 'id'>, newAccount?: Omit<Account, 'id'>) => void;
  onDeleteTransaction: (id: string) => void;
  onBack: () => void;
}

const InvestmentDetail: React.FC<InvestmentDetailProps> = ({ 
  symbol, 
  transactions, 
  warrants, 
  currentPrice, 
  onManualPriceChange, 
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
  onBack 
}) => {
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<InvestmentTransaction | null>(null);

  // Combine and sort history
  const history = useMemo(() => {
    const combined = [
      ...transactions.map(t => ({ ...t, kind: 'transaction' as const })),
      ...warrants.map(w => ({ 
        id: w.id, 
        date: w.grantDate, 
        type: 'buy' as const, // Treat grant as buy for calculation
        quantity: w.quantity, 
        price: w.grantPrice, 
        symbol: w.isin, 
        name: w.name, 
        kind: 'warrant' as const 
      }))
    ];
    return combined.sort((a, b) => parseDateAsUTC(a.date).getTime() - parseDateAsUTC(b.date).getTime());
  }, [transactions, warrants]);

  const { totalQuantity, totalCost, avgCost } = useMemo(() => {
    let qty = 0;
    let cost = 0;
    
    history.forEach(item => {
       if (item.type === 'buy') {
           qty += item.quantity;
           cost += item.quantity * item.price;
       } else {
           // Sell logic: reduce cost proportionally
           if (qty > 0) {
               const avg = cost / qty;
               cost -= item.quantity * avg;
               qty -= item.quantity;
           }
       }
    });
    
    return { 
        totalQuantity: qty, 
        totalCost: cost, 
        avgCost: qty > 0 ? cost / qty : 0 
    };
  }, [history]);

  const marketValue = (currentPrice || 0) * totalQuantity;
  const totalReturn = marketValue - totalCost;
  const returnPercent = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;
  const isProfit = totalReturn >= 0;

  // Chart Data: Quantity over time
  const chartData = useMemo(() => {
     let runningQty = 0;
     const data = history.map(item => {
         if (item.type === 'buy') runningQty += item.quantity;
         else runningQty -= item.quantity;
         return {
             date: item.date,
             quantity: runningQty,
             value: runningQty * (currentPrice || item.price) // Estimate value based on current price if available, else transaction price
         };
     });
     // Add a "today" point
     if (data.length > 0) {
         data.push({ date: new Date().toISOString().split('T')[0], quantity: runningQty, value: runningQty * (currentPrice || 0) });
     }
     return data;
  }, [history, currentPrice]);

  const handleEdit = (item: any) => {
      if (item.kind === 'transaction') {
          setEditingTransaction(item);
          setIsTransactionModalOpen(true);
      }
      // Warrant editing not fully implemented in this view for brevity, but pattern is same
  };

  return (
    <div className="space-y-8 animate-fade-in-up pb-12">
       {isPriceModalOpen && (
          <WarrantPriceModal 
            onClose={() => setIsPriceModalOpen(false)} 
            onSave={onManualPriceChange} 
            isin={symbol} 
            name={history[0]?.name || symbol} 
            manualPrice={currentPrice ?? undefined} 
          />
       )}
       {isTransactionModalOpen && (
          <AddInvestmentTransactionModal
            onClose={() => setIsTransactionModalOpen(false)}
            onSave={(inv, cash, acc) => { onEditTransaction(inv, cash, acc); setIsTransactionModalOpen(false); }}
            accounts={[]} // Not needed for edit context usually or pass from parent if needed
            cashAccounts={[]}
            transactionToEdit={editingTransaction}
          />
       )}

       {/* Header */}
       <header className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              <span className="material-symbols-outlined text-light-text-secondary dark:text-dark-text-secondary">arrow_back</span>
          </button>
          <div>
              <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">{symbol}</h1>
              <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm">{history[0]?.name || 'Asset Details'}</p>
          </div>
          <div className="ml-auto flex gap-2">
               <button onClick={() => setIsPriceModalOpen(true)} className={BTN_SECONDARY_STYLE}>Update Price</button>
               {/* Add Transaction Logic could be complex here as it needs account context, simplified for display */}
          </div>
       </header>

       {/* Hero Card */}
       <div className={`rounded-3xl p-8 text-white shadow-xl relative overflow-hidden bg-gradient-to-br ${isProfit ? 'from-emerald-600 to-teal-800' : 'from-rose-600 to-red-800'}`}>
           <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-6">
               <div>
                   <p className="opacity-80 font-bold uppercase tracking-wider text-sm mb-1">Total Value</p>
                   <h2 className="text-5xl font-bold tracking-tight">{formatCurrency(marketValue, 'EUR')}</h2>
               </div>
               <div className="text-right">
                   <p className="opacity-80 font-bold uppercase tracking-wider text-xs mb-1">Total Return</p>
                   <p className="text-2xl font-semibold flex items-center gap-2 justify-end">
                        {isProfit ? '+' : ''}{formatCurrency(totalReturn, 'EUR')}
                        <span className="text-sm bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-sm">
                            {returnPercent.toFixed(2)}%
                        </span>
                   </p>
               </div>
           </div>
           {/* Background Deco */}
           <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
               <span className="material-symbols-outlined text-[10rem]">show_chart</span>
           </div>
       </div>

       {/* Metrics Grid */}
       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           <Card>
               <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary uppercase font-bold tracking-wider mb-1">Current Price</p>
               <p className="text-xl font-bold text-light-text dark:text-dark-text">{formatCurrency(currentPrice || 0, 'EUR')}</p>
           </Card>
           <Card>
               <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary uppercase font-bold tracking-wider mb-1">Quantity</p>
               <p className="text-xl font-bold text-light-text dark:text-dark-text">{totalQuantity.toLocaleString()}</p>
           </Card>
           <Card>
               <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary uppercase font-bold tracking-wider mb-1">Avg. Cost</p>
               <p className="text-xl font-bold text-light-text dark:text-dark-text">{formatCurrency(avgCost, 'EUR')}</p>
           </Card>
           <Card>
               <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary uppercase font-bold tracking-wider mb-1">Invested</p>
               <p className="text-xl font-bold text-light-text dark:text-dark-text">{formatCurrency(totalCost, 'EUR')}</p>
           </Card>
       </div>

       {/* Chart Section */}
       <Card className="h-80 flex flex-col">
           <h3 className="text-lg font-bold mb-4">Position History</h3>
           <div className="flex-grow w-full min-h-0">
               <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={chartData}>
                       <defs>
                           <linearGradient id="colorQty" x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                               <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                           </linearGradient>
                       </defs>
                       <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} vertical={false} />
                       <XAxis 
                           dataKey="date" 
                           tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, {month:'short', year:'2-digit'})}
                           tick={{fill: 'currentColor', opacity: 0.5, fontSize: 11}}
                           axisLine={false}
                           tickLine={false}
                       />
                       <YAxis 
                           hide 
                           domain={['auto', 'auto']}
                       />
                       <Tooltip 
                           contentStyle={{ backgroundColor: 'var(--light-card)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                           formatter={(val: number) => [val.toLocaleString(), 'Quantity']}
                           labelFormatter={(label) => new Date(label).toLocaleDateString()}
                       />
                       <Area type="stepAfter" dataKey="quantity" stroke="#6366F1" fill="url(#colorQty)" strokeWidth={2} />
                   </AreaChart>
               </ResponsiveContainer>
           </div>
       </Card>

       {/* Transaction History */}
       <Card>
           <h3 className="text-lg font-bold mb-4">History</h3>
           <div className="overflow-x-auto">
               <table className="w-full text-left text-sm">
                   <thead>
                       <tr className="text-xs text-light-text-secondary dark:text-dark-text-secondary border-b border-black/5 dark:border-white/5 uppercase tracking-wider">
                           <th className="pb-3 pl-2">Date</th>
                           <th className="pb-3">Type</th>
                           <th className="pb-3 text-right">Quantity</th>
                           <th className="pb-3 text-right">Price</th>
                           <th className="pb-3 text-right">Total</th>
                           <th className="pb-3 w-10"></th>
                       </tr>
                   </thead>
                   <tbody className="divide-y divide-black/5 dark:divide-white/5">
                       {history.map((item, idx) => (
                           <tr key={item.id || idx} className="group hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                               <td className="py-3 pl-2 font-medium">{parseDateAsUTC(item.date).toLocaleDateString()}</td>
                               <td className="py-3 capitalize">
                                   <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${item.kind === 'warrant' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : item.type === 'buy' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                                       {item.kind === 'warrant' ? 'Grant' : item.type}
                                   </span>
                               </td>
                               <td className="py-3 text-right font-mono">{item.quantity}</td>
                               <td className="py-3 text-right font-mono">{formatCurrency(item.price, 'EUR')}</td>
                               <td className="py-3 text-right font-bold font-mono">{formatCurrency(item.quantity * item.price, 'EUR')}</td>
                               <td className="py-3 text-right">
                                   <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                       {item.kind === 'transaction' && (
                                           <button onClick={() => handleEdit(item)} className="p-1 text-light-text-secondary hover:text-primary-500 transition-colors">
                                               <span className="material-symbols-outlined text-base">edit</span>
                                           </button>
                                       )}
                                       {item.kind === 'transaction' && (
                                            <button onClick={() => onDeleteTransaction(item.id)} className="p-1 text-light-text-secondary hover:text-red-500 transition-colors">
                                                <span className="material-symbols-outlined text-base">delete</span>
                                            </button>
                                       )}
                                   </div>
                               </td>
                           </tr>
                       ))}
                   </tbody>
               </table>
           </div>
       </Card>
    </div>
  );
};

export default InvestmentDetail;
