
import React, { useState, useMemo, useCallback } from 'react';
import { Account, InvestmentTransaction, Transaction, Warrant, InvestmentSubType } from '../types';
import { BTN_PRIMARY_STYLE, BRAND_COLORS, BTN_SECONDARY_STYLE, INVESTMENT_SUB_TYPE_STYLES } from '../constants';
import Card from '../components/Card';
import { formatCurrency, parseDateAsUTC } from '../utils';
import AddInvestmentTransactionModal from '../components/AddInvestmentTransactionModal';
import PortfolioDistributionChart from '../components/PortfolioDistributionChart';
import WarrantModal from '../components/WarrantModal';
import WarrantPriceModal from '../components/WarrantPriceModal';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

// ... (Interface and Helper components remain same)

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
    prices
}) => {
    // ... (State and memoization logic remains same)
    
    // ...

    return (
        <div className="space-y-8 pb-12 animate-fade-in-up">
            {/* ... (Modals and Header) ... */}
            
            {/* Hero Metrics Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-gradient-to-br from-primary-600 to-primary-800 dark:from-primary-800 dark:to-primary-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                        <span className="material-symbols-outlined text-9xl">monitoring</span>
                    </div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                            <p className="text-white/70 font-bold uppercase tracking-wider text-sm mb-2">Total Portfolio Value</p>
                            <h2 className="text-5xl font-bold tracking-tight privacy-blur">{formatCurrency(totalValue, 'EUR')}</h2>
                        </div>
                        <div className="mt-8 flex flex-wrap gap-8">
                            <div>
                                <p className="text-white/70 text-xs font-bold uppercase mb-1">Total Return</p>
                                <p className="text-2xl font-semibold flex items-center gap-2 privacy-blur">
                                    {totalGainLoss >= 0 ? '+' : ''}{formatCurrency(totalGainLoss, 'EUR')}
                                    <span className={`text-sm px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md font-bold ${totalGainLoss >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                        {totalGainLoss >= 0 ? '▲' : '▼'} {Math.abs(totalGainLossPercent).toFixed(2)}%
                                    </span>
                                </p>
                            </div>
                            <div>
                                <p className="text-white/70 text-xs font-bold uppercase mb-1">Invested</p>
                                <p className="text-2xl font-semibold opacity-90 privacy-blur">{formatCurrency(investedCapital, 'EUR')}</p>
                            </div>
                            <div>
                                <p className="text-white/70 text-xs font-bold uppercase mb-1">Granted</p>
                                <p className="text-2xl font-semibold opacity-90 privacy-blur">{formatCurrency(grantedCapital, 'EUR')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ... (Metrics Cards) ... */}
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
                                    {holdings.map(holding => {
                                        const gainLoss = holding.currentValue - holding.totalCost;
                                        const gainLossPercent = holding.totalCost > 0 ? (gainLoss / holding.totalCost) * 100 : 0;
                                        const isPositive = gainLoss >= 0;
                                        const typeStyle = holding.type === 'Warrant' 
                                            ? { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', icon: 'card_membership' }
                                            : INVESTMENT_SUB_TYPE_STYLES[holding.subType || 'Stock'] 
                                                ? { bg: INVESTMENT_SUB_TYPE_STYLES[holding.subType || 'Stock'].color.replace('text-', 'bg-').replace('500', '100'), text: INVESTMENT_SUB_TYPE_STYLES[holding.subType || 'Stock'].color, icon: INVESTMENT_SUB_TYPE_STYLES[holding.subType || 'Stock'].icon }
                                                : { bg: 'bg-gray-100', text: 'text-gray-600', icon: 'category' };
                                        
                                        const currentPrice = holding.currentPrice;
                                        const hasPrice = currentPrice !== 0;

                                        return (
                                            <tr key={holding.symbol} className="group hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                                <td className="py-4 pl-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeStyle.bg} ${typeStyle.text} bg-opacity-20`}>
                                                            <span className="material-symbols-outlined">{typeStyle.icon}</span>
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-light-text dark:text-dark-text">{holding.symbol}</div>
                                                            <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{holding.name}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-4 text-right">
                                                    <div className="font-medium text-light-text dark:text-dark-text privacy-blur">{formatCurrency(holding.currentPrice, 'EUR')}</div>
                                                </td>
                                                <td className="py-4 text-right">
                                                    <div className="font-medium text-light-text dark:text-dark-text">{holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                                                </td>
                                                <td className="py-4 text-right">
                                                    <div className="font-bold text-light-text dark:text-dark-text privacy-blur">{formatCurrency(holding.currentValue, 'EUR')}</div>
                                                </td>
                                                <td className="py-4 text-right">
                                                    <div className={`font-bold privacy-blur ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                        {isPositive ? '+' : ''}{formatCurrency(gainLoss, 'EUR')}
                                                    </div>
                                                    <div className={`text-xs ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                        {isPositive ? '▲' : '▼'} {Math.abs(gainLossPercent).toFixed(2)}%
                                                    </div>
                                                </td>
                                                <td className="py-4 text-right">
                                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => handleOpenPriceModal(holding.symbol, holding.name, holding.currentPrice)} 
                                                            className="p-1.5 rounded-md text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/10 dark:hover:bg-white/10"
                                                            title="Update Price"
                                                        >
                                                            <span className="material-symbols-outlined text-lg">edit_note</span>
                                                        </button>
                                                        {holding.type === 'Warrant' && (
                                                            <button 
                                                                onClick={() => {
                                                                    const warrant = warrants.find(w => w.id === holding.warrantId);
                                                                    if(warrant) handleOpenWarrantModal(warrant);
                                                                }} 
                                                                className="p-1.5 rounded-md text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/10 dark:hover:bg-white/10"
                                                                title="Edit Grant"
                                                            >
                                                                <span className="material-symbols-outlined text-lg">edit</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {holdings.length === 0 && (
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
                                            <p className="font-bold text-light-text dark:text-dark-text privacy-blur">{formatCurrency(item.quantity * item.price, 'EUR')}</p>
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary privacy-blur">{item.quantity} @ {formatCurrency(item.price, 'EUR')}</p>
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
                                <span className="text-xl font-bold text-light-text dark:text-dark-text privacy-blur">{formatCurrency(totalValue, 'EUR')}</span>
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
                                        <span className="text-light-text dark:text-dark-text privacy-blur">{formatCurrency(item.value, 'EUR')}</span>
                                        <span className="text-light-text-secondary dark:text-dark-text-secondary w-10 text-right">{((item.value / totalValue) * 100).toFixed(0)}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* ... (Asset Type Breakdown) ... */}
                </div>
            </div>
        </div>
    );
};

export default Investments;
