
import React, { useMemo, useState } from 'react';
import {
    Account,
    HoldingSummary,
    HoldingsOverview,
    InvestmentTransaction,
    Warrant,
    PriceHistoryEntry
} from '../types';
import Card from '../components/Card';
import { formatCurrency, parseDateAsUTC } from '../utils';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INVESTMENT_SUB_TYPE_STYLES } from '../constants';
import WarrantPriceModal from '../components/WarrantPriceModal';
import { formatHoldingType } from '../utils/investments';
import PageHeader from '../components/PageHeader';
import PriceHistoryChart from '../components/PriceHistoryChart';

interface HoldingDetailProps {
    holdingSymbol: string;
    holdingsOverview: HoldingsOverview;
    accounts: Account[];
    investmentTransactions: InvestmentTransaction[];
    warrants: Warrant[];
    manualPrices: Record<string, number | undefined>;
    onManualPriceChange: (isin: string, price: number | null, date?: string) => void;
    onBack: () => void;
    priceHistory?: Record<string, PriceHistoryEntry[]>;
}

const StatBlock: React.FC<{ label: string; value: string; helper?: string; positive?: boolean; negative?: boolean }> = ({ label, value, helper, positive, negative }) => (
    <div className="flex flex-col">
        <p className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1">{label}</p>
        <p className={`text-xl font-bold ${positive ? 'text-green-600 dark:text-green-400' : negative ? 'text-red-600 dark:text-red-400' : 'text-light-text dark:text-dark-text'}`}>{value}</p>
        {helper && <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">{helper}</p>}
    </div>
);

const HoldingDetail: React.FC<HoldingDetailProps> = ({
    holdingSymbol,
    holdingsOverview,
    accounts,
    investmentTransactions,
    warrants,
    manualPrices,
    onManualPriceChange,
    onBack,
    priceHistory = {}
}) => {
    const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);

    const holding: HoldingSummary | undefined = useMemo(
        () => holdingsOverview.holdings.find(h => h.symbol === holdingSymbol),
        [holdingsOverview, holdingSymbol]
    );

    const relatedAccount = useMemo(() => accounts.find(acc => acc.symbol === holdingSymbol), [accounts, holdingSymbol]);

    const activity = useMemo(() => {
        const txs = investmentTransactions
            .filter(tx => tx.symbol === holdingSymbol)
            .map(tx => ({
                id: tx.id,
                date: tx.date,
                label: tx.type === 'buy' ? 'Buy' : 'Sell',
                quantity: tx.quantity,
                amount: tx.quantity * tx.price,
                detail: `@ ${formatCurrency(tx.price, 'EUR')}`,
                price: tx.price,
                badgeClass: tx.type === 'buy'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }));

        const grants = warrants
            .filter(w => w.isin === holdingSymbol)
            .map(w => ({
                id: w.id,
                date: w.grantDate,
                label: 'Grant',
                quantity: w.quantity,
                amount: w.quantity * w.grantPrice,
                detail: `@ ${formatCurrency(w.grantPrice, 'EUR')}`,
                price: w.grantPrice,
                badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
            }));

        return [...txs, ...grants].sort((a, b) => parseDateAsUTC(b.date).getTime() - parseDateAsUTC(a.date).getTime());
    }, [holdingSymbol, investmentTransactions, warrants]);

    if (!holding) {
        return (
            <div className="space-y-6">
                <button onClick={onBack} className={`${BTN_SECONDARY_STYLE} flex items-center gap-2`}>
                    <span className="material-symbols-outlined">arrow_back</span>
                    Back to Investments
                </button>
                <Card>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary">Holding not found. It may have been removed or fully sold.</p>
                </Card>
            </div>
        );
    }

    const averageCost = holding.quantity > 0 ? holding.totalCost / holding.quantity : 0;
    const gainLoss = holding.currentValue - holding.totalCost;
    const gainLossPercent = holding.totalCost > 0 ? (gainLoss / holding.totalCost) * 100 : 0;
    const isPositive = gainLoss >= 0;
    
    // Style logic
    const isWarrant = holding.type === 'Warrant';
    const subType = holding.subType || 'Stock';
    const typeStyle = isWarrant
        ? { color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30', icon: 'card_membership' }
        : INVESTMENT_SUB_TYPE_STYLES[subType] 
            ? { 
                color: INVESTMENT_SUB_TYPE_STYLES[subType].color, 
                bg: INVESTMENT_SUB_TYPE_STYLES[subType].color.replace('text-', 'bg-').replace('500', '100') + ' dark:' + INVESTMENT_SUB_TYPE_STYLES[subType].color.replace('text-', 'bg-').replace('500', '900/20'),
                icon: INVESTMENT_SUB_TYPE_STYLES[subType].icon 
              }
            : { color: 'text-gray-600', bg: 'bg-gray-100', icon: 'category' };

    const holdingTypeLabel = isWarrant ? 'Warrant' : formatHoldingType(relatedAccount?.subType || holding.subType);
    
    // Only show price history chart if there is data
    const historyData = priceHistory[holding.symbol] || [];

    return (
        <div className="space-y-6 pb-12 animate-fade-in-up">
            {isPriceModalOpen && (
                <WarrantPriceModal
                    onClose={() => setIsPriceModalOpen(false)}
                    onSave={onManualPriceChange}
                    isin={holding.symbol}
                    name={holding.name}
                    manualPrice={manualPrices[holding.symbol]}
                />
            )}

            {/* Navigation & Header */}
            <div className="flex flex-col gap-6">
                <button onClick={onBack} className="text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-500 flex items-center gap-1 transition-colors self-start">
                     <span className="material-symbols-outlined text-lg">arrow_back</span>
                     <span className="text-sm font-medium">Investments</span>
                </button>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${typeStyle.bg} ${typeStyle.color} border border-current/10 shadow-sm`}>
                            <span className="material-symbols-outlined text-4xl">{typeStyle.icon}</span>
                        </div>
                        <div>
                             <div className="flex items-center gap-2 mb-1">
                                <h1 className="text-3xl font-bold text-light-text dark:text-dark-text tracking-tight">{holding.name}</h1>
                                <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded font-mono">
                                    {holding.symbol}
                                </span>
                             </div>
                             <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary font-medium">
                                 {holdingTypeLabel} {relatedAccount?.financialInstitution ? `• ${relatedAccount.financialInstitution}` : ''}
                             </p>
                        </div>
                    </div>
                    <button onClick={() => setIsPriceModalOpen(true)} className={`${BTN_PRIMARY_STYLE} flex items-center gap-2`}>
                        <span className="material-symbols-outlined text-lg">edit_note</span>
                        Update Price
                    </button>
                </div>
            </div>

            {/* Hero Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-gradient-to-br from-white to-gray-50 dark:from-dark-card dark:to-black/20 border border-black/5 dark:border-white/5 relative overflow-hidden group">
                     <div className="absolute top-0 right-0 p-6 opacity-5 dark:opacity-[0.02] pointer-events-none group-hover:scale-110 transition-transform duration-500">
                         <span className="material-symbols-outlined text-8xl">account_balance_wallet</span>
                     </div>
                     <div className="relative z-10">
                         <p className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1">Current Value</p>
                         <h2 className="text-4xl font-extrabold text-light-text dark:text-dark-text tracking-tight">{formatCurrency(holding.currentValue, 'EUR')}</h2>
                         <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-2">
                             {holding.quantity.toLocaleString()} units @ {formatCurrency(holding.currentPrice, 'EUR')}
                         </p>
                     </div>
                </Card>

                <Card className="bg-gradient-to-br from-white to-gray-50 dark:from-dark-card dark:to-black/20 border border-black/5 dark:border-white/5 relative overflow-hidden group">
                     <div className="absolute top-0 right-0 p-6 opacity-5 dark:opacity-[0.02] pointer-events-none group-hover:scale-110 transition-transform duration-500">
                         <span className="material-symbols-outlined text-8xl">trending_up</span>
                     </div>
                     <div className="relative z-10">
                         <p className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1">Total Return</p>
                         <div className="flex items-baseline gap-3">
                             <h2 className={`text-4xl font-extrabold tracking-tight ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                 {isPositive ? '+' : ''}{formatCurrency(gainLoss, 'EUR')}
                             </h2>
                             <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${isPositive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                 {isPositive ? '▲' : '▼'} {Math.abs(gainLossPercent).toFixed(2)}%
                             </span>
                         </div>
                         <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-2">
                             Invested Capital: {formatCurrency(holding.totalCost, 'EUR')}
                         </p>
                     </div>
                </Card>
            </div>
            
            {/* Price History Chart */}
            {historyData.length > 1 && (
                <Card>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-4 border-b border-black/5 dark:border-white/5 pb-2">Price History</h3>
                    <PriceHistoryChart history={historyData} />
                </Card>
            )}

            {/* Key Statistics */}
            <Card>
                <h3 className="text-sm font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-6 border-b border-black/5 dark:border-white/5 pb-2">Position Details</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                    <StatBlock label="Quantity" value={holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })} />
                    <StatBlock label="Current Price" value={formatCurrency(holding.currentPrice, 'EUR')} />
                    <StatBlock label="Average Cost" value={formatCurrency(averageCost, 'EUR')} helper="Per Unit" />
                    <StatBlock label="Total Cost Basis" value={formatCurrency(holding.totalCost, 'EUR')} />
                </div>
            </Card>

            {/* Activity History */}
            <Card className="flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Activity History</h3>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Transactions & Grants</p>
                    </div>
                </div>
                
                <div className="divide-y divide-black/5 dark:divide-white/5">
                    {activity.length === 0 ? (
                        <div className="py-8 text-center text-light-text-secondary dark:text-dark-text-secondary italic">
                            No activity recorded for this asset.
                        </div>
                    ) : (
                        activity.map(item => (
                            <div key={item.id} className="flex items-center justify-between py-4 group hover:bg-black/5 dark:hover:bg-white/5 -mx-6 px-6 transition-colors">
                                <div className="flex items-center gap-4">
                                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md min-w-[50px] text-center ${item.badgeClass}`}>
                                        {item.label}
                                    </span>
                                    <div>
                                        <p className="text-sm font-bold text-light-text dark:text-dark-text">
                                            {item.quantity.toLocaleString()} units <span className="text-light-text-secondary dark:text-dark-text-secondary font-normal">{item.detail}</span>
                                        </p>
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                            {parseDateAsUTC(item.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                        </p>
                                    </div>
                                </div>
                                <p className="font-mono font-medium text-light-text dark:text-dark-text">
                                    {formatCurrency(item.amount, 'EUR')}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </Card>
        </div>
    );
};

export default HoldingDetail;
