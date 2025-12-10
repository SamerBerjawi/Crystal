import React, { useMemo, useState } from 'react';
import {
    Account,
    HoldingSummary,
    HoldingsOverview,
    InvestmentTransaction,
    Warrant
} from '../types';
import Card from '../components/Card';
import { formatCurrency, parseDateAsUTC } from '../utils';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INVESTMENT_SUB_TYPE_STYLES } from '../constants';
import WarrantPriceModal from '../components/WarrantPriceModal';
import { formatHoldingType } from '../utils/investments';

interface HoldingDetailProps {
    holdingSymbol: string;
    holdingsOverview: HoldingsOverview;
    accounts: Account[];
    investmentTransactions: InvestmentTransaction[];
    warrants: Warrant[];
    manualPrices: Record<string, number | undefined>;
    onManualPriceChange: (isin: string, price: number | null) => void;
    onBack: () => void;
}

const StatBlock: React.FC<{ label: string; value: string; helper?: string; positive?: boolean; negative?: boolean }> = ({ label, value, helper, positive, negative }) => (
    <div className="flex flex-col gap-1">
        <p className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">{label}</p>
        <p className={`text-xl font-bold ${positive ? 'text-green-600 dark:text-green-400' : negative ? 'text-red-600 dark:text-red-400' : 'text-light-text dark:text-dark-text'}`}>{value}</p>
        {helper && <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{helper}</p>}
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
    onBack
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
                amount: tx.quantity * tx.price,
                detail: `${tx.quantity} @ ${formatCurrency(tx.price, 'EUR')}`,
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
                amount: w.quantity * w.grantPrice,
                detail: `${w.quantity} @ ${formatCurrency(w.grantPrice, 'EUR')}`,
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
    const typeStyle = holding.type === 'Warrant'
        ? { color: 'text-purple-600 dark:text-purple-300', icon: 'card_membership' }
        : INVESTMENT_SUB_TYPE_STYLES[holding.subType || 'Stock'] || { color: 'text-gray-600', icon: 'category' };

    const holdingTypeLabel = holding.type === 'Warrant' ? 'Warrant' : formatHoldingType(relatedAccount?.subType || holding.subType);

    return (
        <div className="space-y-8 pb-12 animate-fade-in-up">
            {isPriceModalOpen && (
                <WarrantPriceModal
                    onClose={() => setIsPriceModalOpen(false)}
                    onSave={onManualPriceChange}
                    isin={holding.symbol}
                    name={holding.name}
                    manualPrice={manualPrices[holding.symbol]}
                />
            )}

            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className={`${BTN_SECONDARY_STYLE} flex items-center gap-2`}>
                        <span className="material-symbols-outlined">arrow_back</span>
                        Back
                    </button>
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center ${typeStyle.color}`}>
                            <span className="material-symbols-outlined text-2xl">{typeStyle.icon}</span>
                        </div>
                        <div>
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary uppercase font-bold tracking-wider">{holdingTypeLabel}</p>
                            <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">{holding.name} ({holding.symbol})</h1>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsPriceModalOpen(true)} className={`${BTN_PRIMARY_STYLE} flex items-center gap-2`}>
                        <span className="material-symbols-outlined">edit_note</span>
                        Update Price
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                        <StatBlock label="Current Price" value={formatCurrency(holding.currentPrice, 'EUR')} helper="Latest tracked value" />
                        <StatBlock label="Quantity" value={holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })} helper={holding.type === 'Warrant' ? 'Units granted' : 'Units held'} />
                        <StatBlock label="Market Value" value={formatCurrency(holding.currentValue, 'EUR')} helper={holding.color ? 'Updated with manual or live price' : undefined} />
                        <StatBlock label="Cost Basis" value={formatCurrency(holding.totalCost, 'EUR')} helper={holding.type === 'Warrant' ? 'Total grant value' : 'All purchases minus sells'} />
                        <StatBlock label="Average Cost" value={formatCurrency(averageCost, 'EUR')} helper="Per unit" />
                        <StatBlock label="Total Return" value={`${isPositive ? '+' : ''}${formatCurrency(gainLoss, 'EUR')}`} helper={`${isPositive ? '▲' : '▼'} ${Math.abs(gainLossPercent).toFixed(2)}%`} positive={isPositive} negative={!isPositive} />
                    </div>
                </Card>

                <Card className="flex flex-col gap-4">
                    <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Position Details</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-light-text-secondary dark:text-dark-text-secondary">Asset type</span>
                            <span className="font-medium text-light-text dark:text-dark-text">{holdingTypeLabel}</span>
                        </div>
                        {relatedAccount?.financialInstitution && (
                            <div className="flex justify-between text-sm">
                                <span className="text-light-text-secondary dark:text-dark-text-secondary">Institution</span>
                                <span className="font-medium text-light-text dark:text-dark-text">{relatedAccount.financialInstitution}</span>
                            </div>
                        )}
                        {holding.type === 'Warrant' ? (
                            <>
                                <div className="flex justify-between text-sm">
                                    <span className="text-light-text-secondary dark:text-dark-text-secondary">Grant price</span>
                                    <span className="font-medium text-light-text dark:text-dark-text">{formatCurrency(holding.totalCost / holding.quantity, 'EUR')}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-light-text-secondary dark:text-dark-text-secondary">Grant value</span>
                                    <span className="font-medium text-light-text dark:text-dark-text">{formatCurrency(holding.totalCost, 'EUR')}</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex justify-between text-sm">
                                    <span className="text-light-text-secondary dark:text-dark-text-secondary">Invested capital</span>
                                    <span className="font-medium text-light-text dark:text-dark-text">{formatCurrency(holding.totalCost, 'EUR')}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-light-text-secondary dark:text-dark-text-secondary">Unrealized {isPositive ? 'gain' : 'loss'}</span>
                                    <span className={`font-medium ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{`${isPositive ? '+' : ''}${formatCurrency(gainLoss, 'EUR')}`}</span>
                                </div>
                            </>
                        )}
                    </div>
                </Card>
            </div>

            <Card>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Activity</h3>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">All movements for this holding</p>
                    </div>
                </div>
                <div className="space-y-3">
                    {activity.length === 0 && (
                        <p className="text-light-text-secondary dark:text-dark-text-secondary">No activity recorded yet.</p>
                    )}
                    {activity.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-4">
                                <span className={`text-xs font-bold px-3 py-1 rounded-full ${item.badgeClass}`}>{item.label}</span>
                                <div>
                                    <p className="font-bold text-light-text dark:text-dark-text">{formatCurrency(item.amount, 'EUR')}</p>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{item.detail}</p>
                                </div>
                            </div>
                            <div className="text-right text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                {parseDateAsUTC(item.date).toLocaleDateString()}
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
};

export default HoldingDetail;
