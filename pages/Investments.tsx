
import React, { useState, useMemo, useCallback } from 'react';
import { Account, InvestmentTransaction, Transaction, Warrant, InvestmentSubType, HoldingsOverview } from '../types';
import { BTN_PRIMARY_STYLE, BRAND_COLORS, BTN_SECONDARY_STYLE, INVESTMENT_SUB_TYPE_STYLES } from '../constants';
import Card from '../components/Card';
import { formatCurrency, parseDateAsUTC } from '../utils';
import AddInvestmentTransactionModal from '../components/AddInvestmentTransactionModal';
import PortfolioDistributionChart from '../components/PortfolioDistributionChart';
import WarrantModal from '../components/WarrantModal';
import WarrantPriceModal from '../components/WarrantPriceModal';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { buildHoldingsOverview } from '../utils/investments';
import PageHeader from '../components/PageHeader';

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
    onManualPriceChange: (isin: string, price: number | null, date?: string) => void;
    prices: Record<string, number | null>;
    onOpenHoldingDetail: (symbol: string) => void;
    holdingsOverview?: HoldingsOverview;
    onToggleAccountStatus: (accountId: string) => void;
    deleteAccount: (accountId: string) => void;
}

// Helper components for the redesign
const MetricCard: React.FC<{ label: string; value: string; subValue?: string; subLabel?: string; trend?: 'up' | 'down' | 'neutral'; icon?: string; colorClass?: string }> = ({ label, value, subValue, subLabel, trend, icon, colorClass = "bg-white dark:bg-dark-card" }) => (
    <div className={`p-5 rounded-2xl shadow-sm border border-black/5 dark:border-white/5 flex flex-col justify-between ${colorClass}`}>
        <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold uppercase tracking-wider opacity-70">{label}</span>
            {icon && <span className="material-symbols-outlined opacity-80">{icon}</span>}
        </div>
        <div>
            <div className="text-2xl font-bold tracking-tight">{value}</div>
            {subValue && (
                <div className={`text-sm font-medium mt-1 flex items-center gap-1 ${trend === 'up' ? 'text-green-600 dark:text-green-400' : trend === 'down' ? 'text-red-600 dark:text-red-400' : 'opacity-70'}`}>
                    {trend === 'up' && <span className="material-symbols-outlined text-xs">trending_up</span>}
                    {trend === 'down' && <span className="material-symbols-outlined text-xs">trending_down</span>}
                    <span>{subValue}</span>
                    {subLabel && <span className="text-xs opacity-70 ml-1 text-light-text dark:text-dark-text font-normal">{subLabel}</span>}
                </div>
            )}
        </div>
    </div>
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
    onManualPriceChange,
    prices,
    onOpenHoldingDetail,
    onToggleAccountStatus,
    deleteAccount
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isWarrantModalOpen, setWarrantModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<InvestmentTransaction | null>(null);
    const [editingWarrant, setEditingWarrant] = useState<Warrant | null>(null);
    const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
    const [editingPriceItem, setEditingPriceItem] = useState<{ symbol: string; name: string; currentPrice: number | null } | null>(null);

    // Include only Stocks, ETFs, Crypto for the Investments page
    const investmentAccounts = useMemo(() => (
        accounts || []
    ).filter(a => a.type === 'Investment' && ['Stock', 'ETF', 'Crypto'].includes(a.subType || '')), [accounts]);

    const activeInvestmentAccounts = useMemo(() => investmentAccounts.filter(a => a.status !== 'closed'), [investmentAccounts]);

    const activeOverview = useMemo(
        () => buildHoldingsOverview(activeInvestmentAccounts, investmentTransactions, warrants, prices),
        [activeInvestmentAccounts, investmentTransactions, warrants, prices]
    );

    const { holdings: activeHoldings, totalValue, totalCostBasis, investedCapital, grantedCapital, distributionData, typeBreakdown } = activeOverview;

    const displayHoldings = useMemo(
        () => buildHoldingsOverview(investmentAccounts, investmentTransactions, warrants, prices).holdings,
        [investmentAccounts, investmentTransactions, warrants, prices]
    );

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
    
    const recentActivity = useMemo(() => {
        const txs = investmentTransactions.map(tx => ({
            id: tx.id,
            date: tx.date,
            type: tx.type === 'buy' ? 'BUY' : 'SELL',
            symbol: tx.symbol,
            quantity: tx.quantity,
            price: tx.price,
            isWarrant: false,
            data: tx
        }));

        const grants = warrants.map(w => ({
            id: w.id,
            date: w.grantDate,
            type: 'GRANT',
            symbol: w.isin,
            quantity: w.quantity,
            price: w.grantPrice,
            isWarrant: true,
            data: w
        }));

        return [...txs, ...grants].sort((a, b) => parseDateAsUTC(b.date).getTime() - parseDateAsUTC(a.date).getTime());
    }, [investmentTransactions, warrants]);

    return (
        <div className="space-y-8 pb-12 animate-fade-in-up">
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
                    manualPrice={manualPrices[editingPriceItem.symbol]}
                />
            )}
            
            <PageHeader
                markerIcon="finance_chip"
                markerLabel="Portfolio Lab"
                title="Investments"
                subtitle="Performance, risk, and allocation snapshots with drill-downs into holdings and transactions."
                actions={
                    <div className="flex gap-3">
                        <button onClick={() => handleOpenWarrantModal()} className={`${BTN_SECONDARY_STYLE} flex items-center gap-2`}>
                             <span className="material-symbols-outlined text-lg">card_membership</span>
                             Add Grant
                        </button>
                        <button onClick={() => handleOpenModal()} className={`${BTN_PRIMARY_STYLE} flex items-center gap-2`}>
                            <span className="material-symbols-outlined text-lg">add</span>
                            Add Transaction
                        </button>
                    </div>
                }
            />

            {/* Hero Metrics Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-gradient-to-br from-primary-600 to-primary-800 dark:from-primary-800 dark:to-primary-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                        <span className="material-symbols-outlined text-9xl">monitoring</span>
                    </div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                            <p className="text-white/70 font-bold uppercase tracking-wider text-sm mb-2">Total Portfolio Value</p>
                            <h2 className="text-5xl font-bold tracking-tight">{formatCurrency(totalValue, 'EUR')}</h2>
                        </div>
                        <div className="mt-8 flex flex-wrap gap-8">
                            <div>
                                <p className="text-white/70 text-xs font-bold uppercase mb-1">Total Return</p>
                                <p className="text-2xl font-semibold flex items-center gap-2">
                                    {totalGainLoss >= 0 ? '+' : ''}{formatCurrency(totalGainLoss, 'EUR')}
                                    <span className={`text-sm px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md font-bold ${totalGainLoss >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                        {totalGainLoss >= 0 ? '▲' : '▼'} {Math.abs(totalGainLossPercent).toFixed(2)}%
                                    </span>
                                </p>
                            </div>
                            <div>
                                <p className="text-white/70 text-xs font-bold uppercase mb-1">Invested</p>
                                <p className="text-2xl font-semibold opacity-90">{formatCurrency(investedCapital, 'EUR')}</p>
                            </div>
                            <div>
                                <p className="text-white/70 text-xs font-bold uppercase mb-1">Granted</p>
                                <p className="text-2xl font-semibold opacity-90">{formatCurrency(grantedCapital, 'EUR')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-6">
                    <Card className="flex-1 flex flex-col justify-center relative overflow-hidden">
                         <div className="flex items-center justify-between">
                            <div>
                                <p className="text-light-text-secondary dark:text-dark-text-secondary font-bold text-xs uppercase tracking-wider mb-1">Top Asset Class</p>
                                <p className="text-2xl font-bold text-light-text dark:text-dark-text">{typeBreakdown[0]?.name || '—'}</p>
                                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">{typeBreakdown[0] ? `${((typeBreakdown[0].value / totalValue) * 100).toFixed(1)}% of Portfolio` : ''}</p>
                            </div>
                             <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                <span className="material-symbols-outlined text-2xl">pie_chart</span>
                            </div>
                         </div>
                    </Card>
                     <Card className="flex-1 flex flex-col justify-center relative overflow-hidden">
                         <div className="flex items-center justify-between">
                            <div>
                                <p className="text-light-text-secondary dark:text-dark-text-secondary font-bold text-xs uppercase tracking-wider mb-1">Total Holdings</p>
                                <p className="text-2xl font-bold text-light-text dark:text-dark-text">{activeHoldings.length}</p>
                                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">Active positions</p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                                <span className="material-symbols-outlined text-2xl">layers</span>
                            </div>
                         </div>
                    </Card>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Holdings Table */}
                <div className="lg:col-span-2 space-y-8">
                    <Card className="overflow-hidden">
                        <div className="flex justify-between items-center mb-6">
                             <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Your Holdings</h3>
                        </div>
                        <div className="overflow-x-auto -mx-6 px-6">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider border-b border-black/5 dark:border-white/5">
                                        <th className="pb-3 pl-2">Asset</th>
                                        <th className="pb-3 text-right">Price</th>
                                        <th className="pb-3 text-right">Quantity</th>
                                        <th className="pb-3 text-right">Value</th>
                                        <th className="pb-3 text-right">Return</th>
                                        <th className="pb-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                    {displayHoldings.map(holding => {
                                        const holdingAccount = accounts.find(acc => acc.symbol === holding.symbol);
                                        const gainLoss = holding.currentValue - holding.totalCost;
                                        const gainLossPercent = holding.totalCost > 0 ? (gainLoss / holding.totalCost) * 100 : 0;
                                        const isPositive = gainLoss >= 0;
                                        const isClosed = holdingAccount?.status === 'closed';
                                        const typeStyle = holding.type === 'Warrant' 
                                            ? { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', icon: 'card_membership' }
                                            : INVESTMENT_SUB_TYPE_STYLES[holding.subType || 'Stock'] 
                                                ? { bg: INVESTMENT_SUB_TYPE_STYLES[holding.subType || 'Stock'].color.replace('text-', 'bg-').replace('500', '100'), text: INVESTMENT_SUB_TYPE_STYLES[holding.subType || 'Stock'].color, icon: INVESTMENT_SUB_TYPE_STYLES[holding.subType || 'Stock'].icon }
                                                : { bg: 'bg-gray-100', text: 'text-gray-600', icon: 'category' };
                                        
                                        return (
                                            <tr
                                                key={holding.symbol}
                                                className={`group hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer ${isClosed ? 'opacity-60' : ''}`}
                                                onClick={() => onOpenHoldingDetail(holding.symbol)}
                                            >
                                                <td className="py-4 pl-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeStyle.bg} ${typeStyle.text} bg-opacity-20`}>
                                                            <span className="material-symbols-outlined">{typeStyle.icon}</span>
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-light-text dark:text-dark-text">{holding.symbol}</div>
                                                            <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                                                                <span>{holding.name}</span>
                                                                {isClosed && (
                                                                    <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-200 text-[10px] font-semibold uppercase tracking-wide">Inactive</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-4 text-right">
                                                    <div className="font-medium text-light-text dark:text-dark-text">{formatCurrency(holding.currentPrice, 'EUR')}</div>
                                                </td>
                                                <td className="py-4 text-right">
                                                    <div className="font-medium text-light-text dark:text-dark-text">{holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                                                </td>
                                                <td className="py-4 text-right">
                                                    <div className="font-bold text-light-text dark:text-dark-text">{formatCurrency(holding.currentValue, 'EUR')}</div>
                                                </td>
                                                <td className="py-4 text-right">
                                                    <div className={`font-bold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                        {isPositive ? '+' : ''}{formatCurrency(gainLoss, 'EUR')}
                                                    </div>
                                                    <div className={`text-xs ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                        {isPositive ? '▲' : '▼'} {Math.abs(gainLossPercent).toFixed(2)}%
                                                    </div>
                                                </td>
                                                <td className="py-4 text-right">
                                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleOpenPriceModal(holding.symbol, holding.name, holding.currentPrice); }}
                                                            className="p-1.5 rounded-md text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/10 dark:hover:bg-white/10"
                                                            title="Update Price"
                                                        >
                                                            <span className="material-symbols-outlined text-lg">edit_note</span>
                                                        </button>
                                                        {holding.type === 'Warrant' && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const warrant = warrants.find(w => w.id === holding.warrantId);
                                                                    if(warrant) handleOpenWarrantModal(warrant);
                                                                }}
                                                                className="p-1.5 rounded-md text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/10 dark:hover:bg-white/10"
                                                                title="Edit Grant"
                                                            >
                                                                <span className="material-symbols-outlined text-lg">edit</span>
                                                            </button>
                                                        )}
                                                        {holdingAccount && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onToggleAccountStatus(holdingAccount.id);
                                                                }}
                                                                className="p-1.5 rounded-md text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/10 dark:hover:bg-white/10"
                                                                title={holdingAccount.status === 'closed' ? 'Mark Active' : 'Mark Inactive'}
                                                            >
                                                                <span className="material-symbols-outlined text-lg">do_not_disturb_on</span>
                                                            </button>
                                                        )}
                                                        {holdingAccount && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (window.confirm(`Are you sure you want to delete ${holdingAccount.name}? This will remove all associated data.`)) {
                                                                        deleteAccount(holdingAccount.id);
                                                                    }
                                                                }}
                                                                className="p-1.5 rounded-md text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                                title="Delete Holding"
                                                            >
                                                                <span className="material-symbols-outlined text-lg">delete</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {displayHoldings.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="py-8 text-center text-light-text-secondary dark:text-dark-text-secondary">
                                                No investments found. Add a transaction to get started.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    <Card>
                         <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-4">Recent Activity</h3>
                         <div className="space-y-4">
                            {recentActivity.slice(0, 5).map(item => {
                                const isBuy = item.type === 'BUY';
                                const isGrant = item.type === 'GRANT';
                                const badgeClass = isGrant 
                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                    : isBuy 
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
                                
                                return (
                                    <div 
                                        key={item.id} 
                                        className="flex items-center justify-between p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-black/5 dark:hover:border-white/10" 
                                        onClick={() => item.isWarrant ? handleOpenWarrantModal(item.data as Warrant) : handleOpenModal(item.data as InvestmentTransaction)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-10 rounded-full flex items-center justify-center font-bold text-xs px-2 ${badgeClass}`}>
                                                {item.type}
                                            </div>
                                            <div>
                                                <p className="font-bold text-light-text dark:text-dark-text">{item.symbol}</p>
                                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{parseDateAsUTC(item.date).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-light-text dark:text-dark-text">{formatCurrency(item.quantity * item.price, 'EUR')}</p>
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{item.quantity} @ {formatCurrency(item.price, 'EUR')}</p>
                                        </div>
                                    </div>
                                );
                            })}
                            {recentActivity.length === 0 && <p className="text-center text-light-text-secondary dark:text-dark-text-secondary py-4">No recent activity.</p>}
                         </div>
                    </Card>
                </div>

                {/* Right Column: Analysis & Charts */}
                <div className="space-y-8">
                     {/* Asset Allocation */}
                    <Card>
                        <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-6">Allocation</h3>
                        <div className="h-64 relative">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <PieChart>
                                    <Pie
                                        data={distributionData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {distributionData.map(entry => (
                                            <Cell key={entry.name} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        formatter={(value: number) => formatCurrency(value, 'EUR')}
                                        contentStyle={{ backgroundColor: 'var(--light-card)', borderColor: 'rgba(0,0,0,0.1)', borderRadius: '8px' }}
                                        itemStyle={{ color: 'var(--light-text)' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary uppercase">Total</span>
                                <span className="text-xl font-bold text-light-text dark:text-dark-text">{formatCurrency(totalValue, 'EUR')}</span>
                            </div>
                        </div>
                        <div className="mt-6 space-y-3">
                            {distributionData.slice(0, 5).map(item => (
                                <div key={item.name} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                                        <span className="font-medium text-light-text dark:text-dark-text">{item.name}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-light-text dark:text-dark-text">{formatCurrency(item.value, 'EUR')}</span>
                                        <span className="text-light-text-secondary dark:text-dark-text-secondary w-10 text-right">{((item.value / totalValue) * 100).toFixed(0)}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* Asset Type Breakdown */}
                    <Card>
                        <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-6">By Type</h3>
                         <div className="space-y-4">
                            {typeBreakdown.map(type => (
                                <div key={type.name}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-medium text-light-text dark:text-dark-text">{type.name}</span>
                                        <span className="text-light-text-secondary dark:text-dark-text-secondary">{((type.value / totalValue) * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-100 dark:bg-white/10 rounded-full h-2 overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${(type.value / totalValue) * 100}%`, backgroundColor: type.color }}></div>
                                    </div>
                                </div>
                            ))}
                         </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default Investments;
