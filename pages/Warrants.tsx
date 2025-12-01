
import React, { useState, useMemo, useCallback } from 'react';
import { Warrant } from '../types';
import { BTN_PRIMARY_STYLE } from '../constants';
import Card from '../components/Card';
import { formatCurrency, parseDateAsUTC } from '../utils';
import WarrantModal from '../components/WarrantModal';
import WarrantPriceModal from '../components/WarrantPriceModal';
import PortfolioDistributionChart from '../components/PortfolioDistributionChart';

interface WarrantsProps {
  warrants: Warrant[];
  saveWarrant: (warrant: Omit<Warrant, 'id'> & { id?: string }) => void;
  deleteWarrant: (id: string) => void;
  // Props lifted up to App.tsx
  prices: Record<string, number | null>;
  manualPrices: Record<string, number | undefined>;
  lastUpdated: Date | null;
  onManualPriceChange: (isin: string, price: number | null) => void;
}

const COLORS = ['#6366F1', '#FBBF24', '#10B981', '#EF4444', '#3B82F6', '#8B5CF6'];

const SkeletonLoader: React.FC<{ className?: string }> = ({ className = 'w-24' }) => (
    <div className={`h-6 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse ${className}`} />
);

const Warrants: React.FC<WarrantsProps> = ({ warrants, saveWarrant, deleteWarrant, prices, manualPrices, lastUpdated, onManualPriceChange }) => {
    const [isWarrantModalOpen, setWarrantModalOpen] = useState(false);
    const [editingWarrant, setEditingWarrant] = useState<Warrant | null>(null);
    const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
    const [editingHoldingForPrice, setEditingHoldingForPrice] = useState<{isin: string, name: string} | null>(null);

    const handleOpenPriceModal = useCallback((isin: string, name: string) => {
        setEditingHoldingForPrice({ isin, name });
        setIsPriceModalOpen(true);
    }, []);
    
    const { holdings, totalCurrentValue, totalGrantValue, distributionData } = useMemo(() => {
        const holdingsMap: Record<string, {
            isin: string;
            name: string;
            quantity: number;
            totalGrantValue: number;
            grants: Warrant[];
        }> = {};

        warrants.forEach(grant => {
            if (!holdingsMap[grant.isin]) {
                holdingsMap[grant.isin] = { isin: grant.isin, name: grant.name, quantity: 0, totalGrantValue: 0, grants: [] };
            }
            const holding = holdingsMap[grant.isin];
            holding.quantity += grant.quantity;
            holding.totalGrantValue += grant.quantity * grant.grantPrice;
            holding.grants.push(grant);
            if (parseDateAsUTC(grant.grantDate) > parseDateAsUTC(holding.grants[0].grantDate)) {
                holding.name = grant.name;
            }
        });

        const holdingsArray = Object.values(holdingsMap);
        const totalCurrentValue = holdingsArray.reduce((sum, holding) => {
            const currentPrice = prices[holding.isin] ?? 0;
            return sum + (holding.quantity * currentPrice);
        }, 0);
        
        const totalGrantValue = holdingsArray.reduce((sum, holding) => sum + holding.totalGrantValue, 0);

        const distributionData = holdingsArray.map((holding, index) => {
            const currentPrice = prices[holding.isin] ?? 0;
            return {
                name: holding.isin,
                value: holding.quantity * currentPrice,
                color: COLORS[index % COLORS.length]
            };
        }).filter(d => d.value > 0).sort((a,b) => b.value - a.value);

        return { holdings: holdingsArray, totalCurrentValue, totalGrantValue, distributionData };
    }, [warrants, prices]);
    
    const handleOpenWarrantModal = (warrant?: Warrant) => {
        setEditingWarrant(warrant || null);
        setWarrantModalOpen(true);
    };

    const totalGainLoss = totalCurrentValue - totalGrantValue;
    const totalGainLossPercent = totalGrantValue > 0 ? (totalGainLoss / totalGrantValue) * 100 : 0;
    
    const sortedGrants = [...warrants].sort((a,b) => parseDateAsUTC(b.grantDate).getTime() - parseDateAsUTC(a.grantDate).getTime());

    return (
        <div className="space-y-8">
            {isWarrantModalOpen && <WarrantModal onClose={() => setWarrantModalOpen(false)} onSave={(w) => { saveWarrant(w); setWarrantModalOpen(false); }} warrantToEdit={editingWarrant} />}
            {isPriceModalOpen && editingHoldingForPrice && (
                <WarrantPriceModal
                    onClose={() => setIsPriceModalOpen(false)}
                    onSave={onManualPriceChange}
                    isin={editingHoldingForPrice.isin}
                    name={editingHoldingForPrice.name}
                    scrapedPrice={prices[editingHoldingForPrice.isin]}
                    manualPrice={manualPrices[editingHoldingForPrice.isin]}
                />
            )}
            
            <header className="flex flex-wrap justify-between items-center gap-4">
                <div>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Track your employee warrants portfolio.</p>
                    {lastUpdated && (
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                            Last updated: {lastUpdated.toLocaleString()}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => handleOpenWarrantModal()} className={BTN_PRIMARY_STYLE}>Add Warrant Grant</button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Portfolio Value</p>
                    <p className="text-2xl font-bold">{formatCurrency(totalCurrentValue, 'EUR')}</p>
                </Card>
                <Card>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Total Gain/Loss</p>
                    <>
                        <p className={`text-2xl font-bold ${totalGainLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(totalGainLoss, 'EUR')}</p>
                        <p className={`text-sm font-semibold ${totalGainLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>{totalGainLoss >= 0 ? '+' : ''}{totalGainLossPercent.toFixed(2)}%</p>
                    </>
                </Card>
                <Card><p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Holdings</p><p className="text-2xl font-bold">{holdings.length}</p></Card>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <div className="lg:col-span-2">
                    <Card className="h-full">
                        <h3 className="text-xl font-semibold text-light-text dark:text-dark-text mb-4">Portfolio Distribution</h3>
                        <PortfolioDistributionChart data={distributionData} totalValue={totalCurrentValue} />
                    </Card>
                </div>
                <div className="lg:col-span-3">
                    <Card>
                        <h3 className="text-xl font-semibold text-light-text dark:text-dark-text mb-4">Holdings</h3>
                        <div className="divide-y divide-black/5 dark:divide-white/5">
                            {holdings.map(holding => {
                                const currentPrice = prices[holding.isin];
                                const hasPrice = currentPrice !== undefined && currentPrice !== null;
                                const currentValue = hasPrice ? holding.quantity * currentPrice : 0;
                                const gainLoss = hasPrice ? currentValue - holding.totalGrantValue : 0;
                                const manualPrice = manualPrices[holding.isin];
                                return (
                                <div key={holding.isin} className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 items-center p-4">
                                    <div className="col-span-2 sm:col-span-1">
                                        <p className="font-bold text-lg">{holding.isin}</p>
                                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary truncate">{holding.name}</p>
                                    </div>
                                    <div className="text-left sm:text-center">
                                        <p className="font-semibold">{holding.quantity}</p>
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                            @ {hasPrice ? formatCurrency(currentPrice as number, 'EUR') : 'N/A'}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold">{hasPrice ? formatCurrency(currentValue, 'EUR') : 'N/A'}</p>
                                        {hasPrice ? (
                                            <p className={`text-sm font-semibold ${gainLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>{gainLoss >= 0 ? '+' : ''}{formatCurrency(gainLoss, 'EUR')}</p>
                                        ) : (
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Set a manual price to see gains</p>
                                        )}
                                        <div className="mt-2 flex justify-end items-center gap-2">
                                            {manualPrice !== undefined ? (
                                                <span className="text-xs bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-200 px-2 py-1 rounded-full">
                                                    Manual: {formatCurrency(manualPrice, 'EUR')}
                                                </span>
                                            ) : (
                                                 <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Live price</span>
                                            )}
                                            <button onClick={() => handleOpenPriceModal(holding.isin, holding.name)} className="p-1 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/10 dark:hover:bg-white/10" title="Set Manual Price">
                                                <span className="material-symbols-outlined text-base">edit_note</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )})}
                        </div>
                    </Card>
                </div>
            </div>

            <Card>
                <h3 className="text-xl font-semibold text-light-text dark:text-dark-text mb-4">Grant History</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead><tr className="border-b border-black/10 dark:border-white/10"><th className="p-2 font-semibold">Grant Date</th><th className="p-2 font-semibold">ISIN</th><th className="p-2 font-semibold">Name</th><th className="p-2 font-semibold text-right">Quantity</th><th className="p-2 font-semibold text-right">Grant Price</th><th className="p-2 font-semibold text-right">Grant Value</th><th className="p-2"></th></tr></thead>
                        <tbody>{sortedGrants.map(grant => (<tr key={grant.id} className="border-b border-black/5 dark:divide-white/5 last:border-b-0 hover:bg-black/5 dark:hover:bg-white/5 group"><td className="p-2">{parseDateAsUTC(grant.grantDate).toLocaleDateString()}</td><td className="p-2 font-semibold">{grant.isin}</td><td className="p-2">{grant.name}</td><td className="p-2 text-right">{grant.quantity}</td><td className="p-2 text-right">{formatCurrency(grant.grantPrice, 'EUR')}</td><td className="p-2 font-semibold text-right">{formatCurrency(grant.quantity * grant.grantPrice, 'EUR')}</td><td className="p-2 text-right opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => handleOpenWarrantModal(grant)} className="p-1 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/10 dark:hover:bg-white/10"><span className="material-symbols-outlined text-base">edit</span></button><button onClick={() => deleteWarrant(grant.id)} className="p-1 rounded-full text-red-500/80 hover:bg-red-500/10"><span className="material-symbols-outlined text-base">delete</span></button></td></tr>))}</tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default Warrants;
