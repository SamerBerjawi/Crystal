
import React, { useMemo, useState } from 'react';
import {
    Account,
    HoldingSummary,
    HoldingsOverview,
    InvestmentTransaction,
    Transaction,
    Warrant,
    PriceHistoryEntry
} from '../types';
import Card from '../components/Card';
import { formatCurrency, parseLocalDate } from '../utils';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INVESTMENT_SUB_TYPE_STYLES } from '../constants';
import WarrantPriceModal from '../components/WarrantPriceModal';
import AddInvestmentTransactionModal from '../components/AddInvestmentTransactionModal';
import WarrantModal from '../components/WarrantModal';
import { formatHoldingType } from '../utils/investments';
import PriceHistoryChart from '../components/PriceHistoryChart';

interface HoldingDetailProps {
    holdingSymbol: string;
    holdingsOverview: HoldingsOverview;
    accounts: Account[];
    cashAccounts: Account[];
    investmentTransactions: InvestmentTransaction[];
    saveInvestmentTransaction: (invTx: Omit<InvestmentTransaction, 'id'> & { id?: string }, cashTx?: Omit<Transaction, 'id'>, newAccount?: Omit<Account, 'id'>) => void;
    warrants: Warrant[];
    saveWarrant: (warrant: Omit<Warrant, 'id'> & { id?: string }) => void;
    manualPrices: Record<string, number | undefined>;
    onManualPriceChange: (isin: string, price: number | null | {date: string, price: number}[], date?: string) => void;
    onBack: () => void;
    priceHistory?: Record<string, PriceHistoryEntry[]>;
}

const HoldingDetail: React.FC<HoldingDetailProps> = ({
    holdingSymbol,
    holdingsOverview,
    accounts,
    cashAccounts,
    investmentTransactions,
    saveInvestmentTransaction,
    warrants,
    saveWarrant,
    onManualPriceChange,
    onBack,
    priceHistory = {}
}) => {
    const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<{ date: string, price: number } | undefined>(undefined);
    const [editingTransaction, setEditingTransaction] = useState<InvestmentTransaction | null>(null);
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [editingWarrant, setEditingWarrant] = useState<Warrant | null>(null);
    const [isWarrantModalOpen, setIsWarrantModalOpen] = useState(false);

    const holding: HoldingSummary | undefined = useMemo(
        () => holdingsOverview.holdings.find(h => h.symbol === holdingSymbol),
        [holdingsOverview, holdingSymbol]
    );

    const relatedAccount = useMemo(() => accounts.find(acc => acc.symbol === holdingSymbol), [accounts, holdingSymbol]);

    // Combine transactions and grants for activity feed
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
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                isWarrant: false,
                data: tx
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
                badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                isWarrant: true,
                data: w
            }));

        return [...txs, ...grants].sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());
    }, [holdingSymbol, investmentTransactions, warrants]);

    // Price History for Table
    const sortedPriceHistory = useMemo(() => {
        const history = priceHistory[holdingSymbol] || [];
        return [...history].sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());
    }, [priceHistory, holdingSymbol]);

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

    const handleEditPrice = (entry: { date: string, price: number }) => {
        setEditingEntry(entry);
        setIsPriceModalOpen(true);
    };

    const handleAddPrice = () => {
        setEditingEntry(undefined);
        setIsPriceModalOpen(true);
    };

    const handleOpenTransactionModal = (transaction?: InvestmentTransaction) => {
        setEditingTransaction(transaction || null);
        setIsTransactionModalOpen(true);
    };

    const handleOpenWarrantModal = (warrant?: Warrant) => {
        setEditingWarrant(warrant || null);
        setIsWarrantModalOpen(true);
    };

    const handleDeletePrice = (date: string) => {
        if(window.confirm(`Are you sure you want to delete the price log for ${date}?`)) {
            onManualPriceChange(holding.symbol, null, date);
        }
    };

    return (
        <div className="space-y-8 pb-12 animate-fade-in-up">
            {isPriceModalOpen && (
                <WarrantPriceModal
                    onClose={() => setIsPriceModalOpen(false)}
                    onSave={onManualPriceChange}
                    isin={holding.symbol}
                    name={holding.name}
                    initialEntry={editingEntry}
                />
            )}
            {isTransactionModalOpen && (
                <AddInvestmentTransactionModal
                    onClose={() => setIsTransactionModalOpen(false)}
                    onSave={saveInvestmentTransaction}
                    accounts={accounts}
                    cashAccounts={cashAccounts}
                    transactionToEdit={editingTransaction}
                />
            )}
            {isWarrantModalOpen && (
                <WarrantModal
                    onClose={() => setIsWarrantModalOpen(false)}
                    onSave={(w) => { saveWarrant(w); setIsWarrantModalOpen(false); }}
                    warrantToEdit={editingWarrant}
                />
            )}

            {/* Navigation & Header */}
            <div className="flex flex-col gap-6">
                <button onClick={onBack} className="text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-500 flex items-center gap-2 transition-colors self-start group">
                     <div className="p-1 rounded-full group-hover:bg-black/5 dark:group-hover:bg-white/10 transition-colors">
                        <span className="material-symbols-outlined text-lg">arrow_back</span>
                     </div>
                     <span className="text-sm font-medium">Investments Portfolio</span>
                </button>

                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div className="flex items-center gap-5">
                        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${typeStyle.bg} ${typeStyle.color} border border-current/10 shadow-sm`}>
                            <span className="material-symbols-outlined text-5xl">{typeStyle.icon}</span>
                        </div>
                        <div>
                             <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-3xl font-extrabold text-light-text dark:text-dark-text tracking-tight">{holding.name}</h1>
                                <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded font-mono tracking-wide border border-black/5 dark:border-white/10">
                                    {holding.symbol}
                                </span>
                             </div>
                             <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary font-medium flex items-center gap-2">
                                 <span>{holdingTypeLabel}</span>
                                 {relatedAccount?.financialInstitution && (
                                    <>
                                        <span className="w-1 h-1 rounded-full bg-current opacity-40"></span>
                                        <span>{relatedAccount.financialInstitution}</span>
                                    </>
                                 )}
                             </p>
                        </div>
                    </div>
                    <div className="flex gap-3 w-full lg:w-auto">
                        <button onClick={handleAddPrice} className={`${BTN_PRIMARY_STYLE} flex-1 lg:flex-none justify-center`}>
                            <span className="material-symbols-outlined text-xl mr-2">edit_note</span>
                            Log Price
                        </button>
                    </div>
                </div>
            </div>

            {/* Performance Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {/* Current Value - Primary Hero */}
                <div className="md:col-span-2 xl:col-span-1 bg-gradient-to-br from-indigo-600 to-blue-700 text-white p-6 rounded-2xl shadow-lg shadow-indigo-500/20 relative overflow-hidden group">
                     {/* Decorative Background */}
                     <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
                     <div className="absolute bottom-0 right-0 p-4 opacity-10 pointer-events-none transform group-hover:scale-110 transition-transform duration-500 origin-bottom-right">
                         <span className="material-symbols-outlined text-[8rem] leading-none">account_balance_wallet</span>
                     </div>
                     
                     <div className="relative z-10 flex flex-col h-full justify-between">
                         <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-indigo-200 mb-1">Current Value</p>
                            <h2 className="text-4xl font-black tracking-tight">{formatCurrency(holding.currentValue, 'EUR')}</h2>
                         </div>
                         <div className="mt-4 inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10 w-fit">
                             <span className="material-symbols-outlined text-sm">layers</span>
                             <span className="text-sm font-medium">{holding.quantity.toLocaleString()} units</span>
                         </div>
                     </div>
                </div>

                {/* Total Return - Performance Indicator */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm relative overflow-hidden group flex flex-col justify-between">
                     <div className={`absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-500 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                         <span className="material-symbols-outlined text-8xl">trending_up</span>
                     </div>
                     
                     <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1">Total Return</p>
                        <p className={`text-3xl font-black tracking-tight ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {isPositive ? '+' : ''}{formatCurrency(gainLoss, 'EUR')}
                        </p>
                     </div>
                     
                     <div className="mt-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-sm font-bold ${isPositive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                            <span className="material-symbols-outlined text-base">{isPositive ? 'arrow_upward' : 'arrow_downward'}</span>
                            {Math.abs(gainLossPercent).toFixed(2)}%
                        </span>
                     </div>
                </div>

                {/* Avg Cost */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1">Avg Cost</p>
                        <p className="text-2xl font-bold text-light-text dark:text-dark-text">{formatCurrency(averageCost, 'EUR')}</p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1 font-medium">Per Unit</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                         <span className="material-symbols-outlined text-2xl">history</span>
                    </div>
                </div>
                
                 {/* Current Price */}
                 <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1">Market Price</p>
                        <p className="text-2xl font-bold text-light-text dark:text-dark-text">{formatCurrency(holding.currentPrice, 'EUR')}</p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1 font-medium">Last Logged</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                         <span className="material-symbols-outlined text-2xl">sell</span>
                    </div>
                </div>
            </div>
            
            {/* Price History Chart */}
            {historyData.length > 1 && (
                <Card>
                    <div className="flex justify-between items-center mb-6 border-b border-black/5 dark:border-white/5 pb-4">
                        <h3 className="text-lg font-bold text-light-text dark:text-dark-text flex items-center gap-2">
                             <span className="material-symbols-outlined text-primary-500">show_chart</span>
                             Performance Trend
                        </h3>
                    </div>
                    <PriceHistoryChart history={historyData} />
                </Card>
            )}

            {/* Split View: Activity & Price Logs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Transaction History */}
                <Card className="flex flex-col h-full max-h-[600px]">
                    <div className="flex justify-between items-center mb-4 border-b border-black/5 dark:border-white/5 pb-4">
                        <h3 className="text-lg font-bold text-light-text dark:text-dark-text flex items-center gap-2">
                             <span className="material-symbols-outlined text-blue-500">receipt_long</span>
                             Transaction History
                        </h3>
                    </div>
                    
                    <div className="flex-grow overflow-y-auto pr-1 custom-scrollbar">
                        <div className="space-y-3">
                            {activity.length === 0 ? (
                                <div className="py-12 text-center text-light-text-secondary dark:text-dark-text-secondary italic bg-gray-50 dark:bg-white/5 rounded-xl border border-dashed border-black/5 dark:border-white/10">
                                    No transaction activity recorded.
                                </div>
                            ) : (
                                activity.map(item => (
                                    <div key={item.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors border border-black/5 dark:border-white/5">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-[10px] uppercase shadow-sm ${item.badgeClass}`}>
                                                {item.label}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-light-text dark:text-dark-text">
                                                    {item.quantity.toLocaleString()} units
                                                </p>
                                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-medium opacity-80">
                                                    {parseLocalDate(item.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <p className="font-mono font-bold text-sm text-light-text dark:text-dark-text">
                                                    {formatCurrency(item.amount, 'EUR')}
                                                </p>
                                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                                    {item.detail}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    if (item.isWarrant) {
                                                        handleOpenWarrantModal(item.data as Warrant);
                                                    } else {
                                                        handleOpenTransactionModal(item.data as InvestmentTransaction);
                                                    }
                                                }}
                                                className="p-1.5 rounded-md text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/10 dark:hover:bg-white/10"
                                                title={item.isWarrant ? 'Edit Grant' : 'Edit Transaction'}
                                            >
                                                <span className="material-symbols-outlined text-lg">
                                                    {item.isWarrant ? 'card_membership' : 'edit_note'}
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </Card>

                {/* Price History Logs */}
                <Card className="flex flex-col h-full max-h-[600px]">
                    <div className="flex justify-between items-center mb-4 border-b border-black/5 dark:border-white/5 pb-4">
                        <h3 className="text-lg font-bold text-light-text dark:text-dark-text flex items-center gap-2">
                             <span className="material-symbols-outlined text-purple-500">history</span>
                             Price Log
                        </h3>
                         <button onClick={handleAddPrice} className="text-xs font-bold text-primary-500 hover:text-primary-600 bg-primary-50 dark:bg-primary-900/20 px-3 py-1.5 rounded-lg transition-colors">
                            + Add Entry
                        </button>
                    </div>

                    <div className="flex-grow overflow-y-auto pr-1 custom-scrollbar">
                         <div className="space-y-2">
                             {sortedPriceHistory.length === 0 ? (
                                <div className="py-12 text-center text-light-text-secondary dark:text-dark-text-secondary italic bg-gray-50 dark:bg-white/5 rounded-xl border border-dashed border-black/5 dark:border-white/10">
                                    No price history available.
                                </div>
                             ) : (
                                 sortedPriceHistory.map((entry, index) => (
                                     <div key={`${entry.date}-${index}`} className="group flex items-center justify-between p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-black/5 dark:hover:border-white/10">
                                         <div className="flex items-center gap-3">
                                             <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary">
                                                 <span className="material-symbols-outlined text-sm">calendar_today</span>
                                             </div>
                                             <span className="text-sm font-medium text-light-text dark:text-dark-text">
                                                 {parseLocalDate(entry.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                             </span>
                                         </div>
                                         
                                         <div className="flex items-center gap-4">
                                             <span className="font-mono font-bold text-sm text-light-text dark:text-dark-text">
                                                 {formatCurrency(entry.price, 'EUR')}
                                             </span>
                                             <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                 <button 
                                                    onClick={() => handleEditPrice(entry)} 
                                                    className="p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/20 text-blue-500 transition-colors"
                                                    title="Edit"
                                                 >
                                                     <span className="material-symbols-outlined text-lg">edit</span>
                                                 </button>
                                                 <button 
                                                    onClick={() => handleDeletePrice(entry.date)} 
                                                    className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
                                                    title="Delete"
                                                 >
                                                     <span className="material-symbols-outlined text-lg">delete</span>
                                                 </button>
                                             </div>
                                         </div>
                                     </div>
                                 ))
                             )}
                         </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default HoldingDetail;
