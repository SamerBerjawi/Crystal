
import React, { useState, useMemo, useCallback } from 'react';
import { Account, InvestmentTransaction, Transaction, Warrant } from '../types';
import { BTN_PRIMARY_STYLE, BRAND_COLORS, BTN_SECONDARY_STYLE } from '../constants';
import Card from '../components/Card';
import { formatCurrency, parseDateAsUTC } from '../utils';
import AddInvestmentTransactionModal from '../components/AddInvestmentTransactionModal';
import PortfolioDistributionChart from '../components/PortfolioDistributionChart';
import WarrantModal from '../components/WarrantModal';
import WarrantPriceModal from '../components/WarrantPriceModal';

interface InvestmentsProps {
    accounts: Account[];
    cashAccounts: Account[];
    investmentTransactions: InvestmentTransaction[];
    saveInvestmentTransaction: (invTx: Omit<InvestmentTransaction, 'id'> & { id?: string }, cashTx?: Omit<Transaction, 'id'>, newAccount?: Omit<Account, 'id'>) => void;
    deleteInvestmentTransaction: (id: string) => void;
    saveTransaction: (transactions: (Omit<Transaction, 'id'> & { id?: string })[], idsToDelete?: string[]) => void;
    warrants: Warrant[];
    saveWarrant: (warrant: Omit<Warrant, 'id'> & { id?: string }) => void;
    deleteWarrant: (id: string) => void;
    manualPrices: Record<string, number | undefined>;
    onManualPriceChange: (isin: string, price: number | null) => void;
}

const InvestmentSummaryCard: React.FC<{ title: string; value: string; change?: string; changeColor?: string; icon: string }> = ({ title, value, change, changeColor, icon }) => (
    <Card className="flex items-start justify-between">
        <div>
            <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm font-medium">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {change && <p className={`text-sm font-semibold mt-1 ${changeColor}`}>{change}</p>}
        </div>
        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-primary-100 dark:bg-primary-900/50">
            <span className="material-symbols-outlined text-3xl text-primary-700 dark:text-primary-300">{icon}</span>
        </div>
    </Card>
);

const Investments: React.FC<InvestmentsProps> = ({ 
    accounts, 
    cashAccounts, 
    investmentTransactions, 
    saveInvestmentTransaction, 
    deleteInvestmentTransaction, 
    saveTransaction, 
    warrants,
    saveWarrant,
    deleteWarrant,
    manualPrices,
    onManualPriceChange
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isWarrantModalOpen, setWarrantModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<InvestmentTransaction | null>(null);
    const [editingWarrant, setEditingWarrant] = useState<Warrant | null>(null);
    const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
    const [editingPriceItem, setEditingPriceItem] = useState<{ symbol: string; name: string; currentPrice: number | null } | null>(null);

    const investmentAccounts = useMemo(() => (accounts || []).filter(a => a.type === 'Investment'), [accounts]);

    const { holdings, totalValue, totalCostBasis, distributionData } = useMemo(() => {
        const holdingsMap: Record<string, {
            symbol: string;
            name: string;
            quantity: number;
            totalCost: number;
            currentValue: number;
            currentPrice: number; // Derived from account balance / quantity if available
            type: 'Standard' | 'Warrant';
            warrantId?: string;
        }> = {};

        // 1. Process Standard Investments
        investmentAccounts.forEach(acc => {
            if (acc.symbol) {
                // If account has balance and we can infer quantity from transactions, we can infer price.
                // But here we rely on the `account.balance` being the source of truth for current value 
                // (updated by App.tsx via API or manual overrides)
                holdingsMap[acc.symbol] = {
                    symbol: acc.symbol,
                    name: acc.name,
                    quantity: 0,
                    totalCost: 0,
                    currentValue: acc.balance,
                    currentPrice: 0, 
                    type: 'Standard'
                };
            }
        });
        
        [...investmentTransactions].sort((a,b) => parseDateAsUTC(a.date).getTime() - parseDateAsUTC(b.date).getTime()).forEach(tx => {
            if (!holdingsMap[tx.symbol]) return;
            
            const holding = holdingsMap[tx.symbol];
            if (tx.type === 'buy') {
                holding.quantity += tx.quantity;
                holding.totalCost += tx.quantity * tx.price;
            } else { // sell
                const avgCost = holding.quantity > 0 ? holding.totalCost / holding.quantity : 0;
                holding.totalCost -= tx.quantity * avgCost;
                holding.quantity -= tx.quantity;
            }
        });
        
        // Update inferred price for standard investments
        Object.values(holdingsMap).forEach(h => {
            if (h.type === 'Standard' && h.quantity > 0) {
                h.currentPrice = h.currentValue / h.quantity;
            }
        });

        // 2. Process Warrants
        warrants.forEach(w => {
             // Warrants might share symbols or be unique. If unique, add entry. If shared, merge? 
             // Usually warrants have specific ISINs. We'll treat them as separate rows if ISIN differs.
             if (!holdingsMap[w.isin]) {
                 holdingsMap[w.isin] = {
                     symbol: w.isin,
                     name: w.name,
                     quantity: 0,
                     totalCost: 0,
                     currentValue: 0, // Calculated below
                     currentPrice: 0,
                     type: 'Warrant',
                     warrantId: w.id // Keep ID for editing
                 };
             }
             
             const holding = holdingsMap[w.isin];
             holding.quantity += w.quantity;
             holding.totalCost += w.quantity * w.grantPrice; // Treat grant price as cost basis
             
             // Check for manual price override for this warrant
             // Note: App.tsx updates Account balances, but warrants might not have an Account entity if just in the warrants array.
             // However, the user prompt implies warrants should be considered ETFs (Accounts). 
             // If they are strictly in the `warrants` array, we need to calculate value here using `manualPrices`.
             const price = manualPrices[w.isin] ?? 0;
             holding.currentValue += w.quantity * price;
             holding.currentPrice = price;
        });

        const filteredHoldings = Object.values(holdingsMap).filter(h => h.quantity > 0.000001);

        const totalValue = filteredHoldings.reduce((sum, holding) => sum + holding.currentValue, 0);
        const totalCostBasis = filteredHoldings.reduce((sum, holding) => sum + holding.totalCost, 0);

        const distributionData = filteredHoldings.map((holding, index) => ({
                name: holding.symbol,
                value: holding.currentValue,
                color: BRAND_COLORS[index % BRAND_COLORS.length]
            })).filter(d => d.value > 0).sort((a,b) => b.value - a.value);

        return { holdings: filteredHoldings, totalValue, totalCostBasis, distributionData };
    }, [investmentAccounts, investmentTransactions, warrants, manualPrices]);

    const handleOpenModal = (tx?: InvestmentTransaction) => {
        setEditingTransaction(tx || null);
        setIsModalOpen(true);
    };
    
    const handleOpenWarrantModal = (warrant?: Warrant) => {
         setEditingWarrant(warrant || null);
         setWarrantModalOpen(true);
    }

    const handleOpenPriceModal = useCallback((symbol: string, name: string, currentPrice: number) => {
        setEditingPriceItem({ symbol, name, currentPrice });
        setIsPriceModalOpen(true);
    }, []);

    const totalGainLoss = totalValue - totalCostBasis;
    const totalGainLossPercent = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;

    const sortedTransactions = [...investmentTransactions].sort((a, b) => parseDateAsUTC(b.date).getTime() - parseDateAsUTC(a.date).getTime());

    return (
        <div className="space-y-8">
            {isModalOpen && (
                <AddInvestmentTransactionModal
                    onClose={() => setIsModalOpen(false)}
                    onSave={saveInvestmentTransaction}
                    accounts={accounts}
                    cashAccounts={cashAccounts}
                    transactionToEdit={editingTransaction}
                />
            )}
            {isWarrantModalOpen && (
                <WarrantModal 
                    onClose={() => setWarrantModalOpen(false)} 
                    onSave={(w) => { saveWarrant(w); setWarrantModalOpen(false); }} 
                    warrantToEdit={editingWarrant} 
                />
            )}
            {isPriceModalOpen && editingPriceItem && (
                <WarrantPriceModal
                    onClose={() => setIsPriceModalOpen(false)}
                    onSave={onManualPriceChange}
                    isin={editingPriceItem.symbol}
                    name={editingPriceItem.name}
                    scrapedPrice={null} // We don't have scraped price here easily without passing more props, assume manual for now
                    manualPrice={manualPrices[editingPriceItem.symbol]}
                />
            )}

            <header className="flex justify-between items-center">
                <div>
                    
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Track your portfolio performance and transactions.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => handleOpenWarrantModal()} className={BTN_SECONDARY_STYLE}>Add Grant</button>
                    <button onClick={() => handleOpenModal()} className={BTN_PRIMARY_STYLE}>Add Transaction</button>
                </div>
            </header>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <InvestmentSummaryCard title="Portfolio Value" value={formatCurrency(totalValue, 'EUR')} icon="account_balance" />
                <InvestmentSummaryCard 
                    title="Total Gain / Loss" 
                    value={formatCurrency(totalGainLoss, 'EUR')} 
                    change={`${totalGainLoss >= 0 ? '+' : ''}${totalGainLossPercent.toFixed(2)}%`}
                    changeColor={totalGainLoss >= 0 ? 'text-green-500' : 'text-red-500'}
                    icon={totalGainLoss >= 0 ? 'trending_up' : 'trending_down'}
                />
                <InvestmentSummaryCard title="Assets" value={String(holdings.length)} icon="wallet" />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <div className="lg:col-span-2">
                    <Card className="h-full">
                        <h3 className="text-xl font-semibold text-light-text dark:text-dark-text mb-4">Portfolio Distribution</h3>
                        <PortfolioDistributionChart data={distributionData} totalValue={totalValue} />
                    </Card>
                </div>
                <div className="lg:col-span-3">
                    <Card>
                        <h3 className="text-xl font-semibold text-light-text dark:text-dark-text mb-4">Holdings</h3>
                        <div className="divide-y divide-black/5 dark:divide-white/5">
                            {holdings.map(holding => {
                                const gainLoss = holding.currentValue - holding.totalCost;
                                return (
                                <div key={holding.symbol} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center p-4 group hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-lg">{holding.symbol}</p>
                                            {holding.type === 'Warrant' && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 uppercase">Warrant</span>}
                                        </div>
                                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary truncate max-w-[150px]">{holding.name}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-semibold">{holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}</p>
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                            @ {formatCurrency(holding.currentPrice, 'EUR')}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold">{formatCurrency(holding.currentValue, 'EUR')}</p>
                                        <p className={`text-sm font-semibold ${gainLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {gainLoss >= 0 ? '+' : ''}{formatCurrency(gainLoss, 'EUR')}
                                        </p>
                                    </div>
                                    <div className="text-right pl-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                        <button 
                                            onClick={() => handleOpenPriceModal(holding.symbol, holding.name, holding.currentPrice)} 
                                            className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" 
                                            title="Set Manual Price"
                                        >
                                            <span className="material-symbols-outlined text-lg">edit_note</span>
                                        </button>
                                        {holding.type === 'Warrant' && (
                                             <button 
                                                onClick={() => {
                                                    const warrant = warrants.find(w => w.id === holding.warrantId);
                                                    if(warrant) handleOpenWarrantModal(warrant);
                                                }} 
                                                className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" 
                                                title="Edit Grant"
                                            >
                                                <span className="material-symbols-outlined text-lg">edit</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )})}
                         </div>
                         {holdings.length === 0 && <p className="text-center py-8 text-light-text-secondary dark:text-dark-text-secondary">No holdings to display.</p>}
                    </Card>
                </div>
            </div>

            <Card>
                <h3 className="text-xl font-semibold text-light-text dark:text-dark-text mb-4">Recent Transactions</h3>
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-black/10 dark:border-white/10">
                            <th className="p-2 font-semibold">Date</th>
                            <th className="p-2 font-semibold">Symbol</th>
                            <th className="p-2 font-semibold">Type</th>
                            <th className="p-2 font-semibold text-right">Amount</th>
                            <th className="p-2 font-semibold text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedTransactions.slice(0, 10).map(tx => (
                        <tr key={tx.id} className="border-b border-black/5 dark:border-white/5 last:border-b-0 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer" onClick={() => handleOpenModal(tx)}>
                            <td className="p-2">{parseDateAsUTC(tx.date).toLocaleDateString(undefined, { timeZone: 'UTC' })}</td>
                            <td className="p-2 font-bold">{tx.symbol}</td>
                            <td className={`p-2 font-semibold capitalize ${tx.type === 'buy' ? 'text-green-500' : 'text-red-500'}`}>{tx.type}</td>
                            <td className="p-2 text-right">{tx.quantity} @ {formatCurrency(tx.price, 'EUR')}</td>
                            <td className="p-2 font-semibold text-right">{formatCurrency(tx.quantity * tx.price, 'EUR')}</td>
                        </tr>
                        ))}
                    </tbody>
                </table>
                {investmentTransactions.length === 0 && <p className="text-center py-8 text-light-text-secondary dark:text-dark-text-secondary">No investment transactions yet.</p>}
            </Card>
        </div>
    );
};

export default Investments;