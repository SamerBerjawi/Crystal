import React, { useState, useMemo } from 'react';
import { Account, InvestmentTransaction, Transaction } from '../types';
import { BTN_PRIMARY_STYLE } from '../constants';
import Card from '../components/Card';
import { formatCurrency } from '../utils';
import AddInvestmentTransactionModal from '../components/AddInvestmentTransactionModal';
import PortfolioDistributionChart from '../components/PortfolioDistributionChart';

interface InvestmentsProps {
    accounts: Account[];
    cashAccounts: Account[];
    investmentTransactions: InvestmentTransaction[];
    saveInvestmentTransaction: (invTx: Omit<InvestmentTransaction, 'id'> & { id?: string }, cashTx?: Omit<Transaction, 'id'>, newAccount?: Omit<Account, 'id'>) => void;
    deleteInvestmentTransaction: (id: string) => void;
}

const COLORS = ['#6366F1', '#FBBF24', '#10B981', '#EF4444', '#3B82F6', '#8B5CF6'];

const InvestmentSummaryCard: React.FC<{ title: string; value: string; change?: string; changeColor?: string; icon: string }> = ({ title, value, change, changeColor, icon }) => (
    <Card className="flex items-start justify-between">
        <div>
            <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm font-medium">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {change && <p className={`text-sm font-semibold mt-1 ${changeColor}`}>{change}</p>}
        </div>
        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-primary-100 dark:bg-primary-900/50">
            <span className="material-symbols-outlined text-3xl text-primary-500">{icon}</span>
        </div>
    </Card>
);

const Investments: React.FC<InvestmentsProps> = ({ accounts, cashAccounts, investmentTransactions, saveInvestmentTransaction, deleteInvestmentTransaction }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<InvestmentTransaction | null>(null);

    const investmentAccounts = useMemo(() => (accounts || []).filter(a => a.type === 'Investment' || a.type === 'Crypto'), [accounts]);

    const { holdings, totalValue, totalCostBasis, distributionData } = useMemo(() => {
        const holdingsMap: Record<string, {
            symbol: string;
            name: string;
            quantity: number;
            totalCost: number;
            currentValue: number;
        }> = {};

        // Initialize from accounts
        investmentAccounts.forEach(acc => {
            if (acc.symbol) {
                holdingsMap[acc.symbol] = {
                    symbol: acc.symbol,
                    name: acc.name,
                    quantity: 0,
                    totalCost: 0,
                    currentValue: acc.balance,
                };
            }
        });
        
        [...investmentTransactions].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).forEach(tx => {
            if (!holdingsMap[tx.symbol]) return; // Should not happen if accounts are created correctly
            
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

        const filteredHoldings = Object.values(holdingsMap).filter(h => h.quantity > 0.000001);

        const totalValue = filteredHoldings.reduce((sum, holding) => sum + holding.currentValue, 0);
        const totalCostBasis = filteredHoldings.reduce((sum, holding) => sum + holding.totalCost, 0);

        const distributionData = filteredHoldings.map((holding, index) => ({
                name: holding.symbol,
                value: holding.currentValue,
                color: COLORS[index % COLORS.length]
            })).filter(d => d.value > 0).sort((a,b) => b.value - a.value);

        return { holdings: filteredHoldings, totalValue, totalCostBasis, distributionData };
    }, [investmentAccounts, investmentTransactions]);

    const handleOpenModal = (tx?: InvestmentTransaction) => {
        setEditingTransaction(tx || null);
        setIsModalOpen(true);
    };

    const totalGainLoss = totalValue - totalCostBasis;
    const totalGainLossPercent = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;

    const sortedTransactions = [...investmentTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
            <header className="flex justify-between items-center">
                <div>
                    
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Track your portfolio performance and transactions.</p>
                </div>
                <button onClick={() => handleOpenModal()} className={BTN_PRIMARY_STYLE}>Add Transaction</button>
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
                <InvestmentSummaryCard title="Investment Accounts" value={String(investmentAccounts.length)} icon="wallet" />
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
                                const avgPrice = holding.quantity > 0 ? holding.currentValue / holding.quantity : 0;
                                return (
                                <div key={holding.symbol} className="grid grid-cols-3 items-center p-4">
                                    <div>
                                        <p className="font-bold text-lg">{holding.symbol}</p>
                                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary truncate">{holding.name}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-semibold">{holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })}</p>
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                            @ {formatCurrency(avgPrice, 'EUR')}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold">{formatCurrency(holding.currentValue, 'EUR')}</p>
                                        <p className={`text-sm font-semibold ${gainLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {gainLoss >= 0 ? '+' : ''}{formatCurrency(gainLoss, 'EUR')}
                                        </p>
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
                        <tr key={tx.id} className="border-b border-black/5 dark:border-white/5 last:border-b-0 hover:bg-black/5 dark:hover:bg-white/5">
                            <td className="p-2">{new Date(tx.date).toLocaleDateString()}</td>
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