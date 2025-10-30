import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Warrant, ScraperConfig } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import Card from '../components/Card';
import { formatCurrency } from '../utils';
import WarrantModal from '../components/WarrantModal';
import PortfolioDistributionChart from '../components/PortfolioDistributionChart';
import ScraperConfigModal from '../components/ScraperConfigModal';

interface WarrantsProps {
  warrants: Warrant[];
  saveWarrant: (warrant: Omit<Warrant, 'id'> & { id?: string }) => void;
  deleteWarrant: (id: string) => void;
  scraperConfigs: ScraperConfig[];
  saveScraperConfig: (config: ScraperConfig) => void;
}

const COLORS = ['#6366F1', '#FBBF24', '#10B981', '#EF4444', '#3B82F6', '#8B5CF6'];

const SkeletonLoader: React.FC<{ className?: string }> = ({ className = 'w-24' }) => (
    <div className={`h-6 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse ${className}`} />
);

const Warrants: React.FC<WarrantsProps> = ({ warrants, saveWarrant, deleteWarrant, scraperConfigs, saveScraperConfig }) => {
    const [isWarrantModalOpen, setWarrantModalOpen] = useState(false);
    const [isScraperModalOpen, setIsScraperModalOpen] = useState(false);
    const [editingWarrant, setEditingWarrant] = useState<Warrant | null>(null);
    const [prices, setPrices] = useState<Record<string, number | null>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const refreshPrices = useCallback(async () => {
        setIsLoading(true);
    
        const scrapePrice = async (config: ScraperConfig): Promise<{ isin: string, price: number | null }> => {
            try {
                const response = await fetch(config.resource.url);
                if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
                
                const htmlString = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlString, 'text/html');
                
                const elements = doc.querySelectorAll(config.options.select);
                if (elements.length === 0 || config.options.index >= elements.length) {
                    throw new Error(`Element not found with selector "${config.options.select}" and index ${config.options.index}.`);
                }
                
                const targetElement = elements[config.options.index];
                const rawValue = config.options.attribute ? targetElement.getAttribute(config.options.attribute) : targetElement.textContent;
    
                if (!rawValue) throw new Error('No value or text content found in the selected element.');
                
                const priceString = rawValue.match(/[0-9.,\s]+/)?.[0]?.trim() || '';
                if (!priceString) throw new Error(`Could not find a number in the raw value: "${rawValue}"`);
                
                const numberString = priceString.replace(/\./g, '').replace(',', '.');
                const price = parseFloat(numberString);
    
                if (isNaN(price)) throw new Error(`Could not parse a valid number from: "${rawValue}"`);
                
                return { isin: config.id, price };
            } catch (error: any) {
                console.error(`Error scraping ${config.id} from ${config.resource.url}:`, error.message);
                return { isin: config.id, price: null };
            }
        };
        
        const pricePromises = scraperConfigs.map(scrapePrice);
        
        const results = await Promise.all(pricePromises);
        
        const newPrices: Record<string, number | null> = {};
        warrants.forEach(w => { newPrices[w.isin] = null; });
        results.forEach(result => { newPrices[result.isin] = result.price; });
    
        setPrices(newPrices);
        setLastUpdated(new Date());
        setIsLoading(false);
    }, [warrants, scraperConfigs]);

    useEffect(() => {
        refreshPrices();
    }, [refreshPrices]);

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
            if (new Date(grant.grantDate) > new Date(holding.grants[0].grantDate)) {
                holding.name = grant.name;
            }
        });

        const holdingsArray = Object.values(holdingsMap);
        const totalCurrentValue = holdingsArray.reduce((sum, holding) => {
            const currentPrice = prices[holding.isin] || 0;
            return sum + (holding.quantity * currentPrice);
        }, 0);
        
        const totalGrantValue = holdingsArray.reduce((sum, holding) => sum + holding.totalGrantValue, 0);

        const distributionData = holdingsArray.map((holding, index) => {
            const currentPrice = prices[holding.isin] || 0;
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
    
    const sortedGrants = [...warrants].sort((a,b) => new Date(b.grantDate).getTime() - new Date(a.grantDate).getTime());

    return (
        <div className="space-y-8">
            {isWarrantModalOpen && <WarrantModal onClose={() => setWarrantModalOpen(false)} onSave={(w) => { saveWarrant(w); setWarrantModalOpen(false); }} warrantToEdit={editingWarrant} />}
            {isScraperModalOpen && <ScraperConfigModal isOpen={isScraperModalOpen} onClose={() => setIsScraperModalOpen(false)} warrants={warrants} scraperConfigs={scraperConfigs} onSave={saveScraperConfig} />}
            
            <header className="flex flex-wrap justify-between items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-light-text dark:text-dark-text">Warrants</h2>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Track your employee warrants portfolio.</p>
                     {lastUpdated && !isLoading && (
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                            Last updated: {lastUpdated.toLocaleString()}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={refreshPrices} className={`${BTN_SECONDARY_STYLE} flex items-center gap-2`} disabled={isLoading}>
                         {isLoading ? (
                            <>
                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Refreshing...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined">refresh</span>
                                Refresh Prices
                            </>
                        )}
                    </button>
                    <button onClick={() => setIsScraperModalOpen(true)} className={`${BTN_SECONDARY_STYLE} flex items-center gap-2`}><span className="material-symbols-outlined">settings</span>Manage Scrapers</button>
                    <button onClick={() => handleOpenWarrantModal()} className={BTN_PRIMARY_STYLE}>Add Warrant Grant</button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Portfolio Value</p>
                    {isLoading ? <SkeletonLoader className="w-40 mt-1" /> : <p className="text-2xl font-bold">{formatCurrency(totalCurrentValue, 'EUR')}</p>}
                </Card>
                <Card>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Total Gain/Loss</p>
                    {isLoading ? (
                        <>
                            <SkeletonLoader className="w-32 mt-1" />
                            <SkeletonLoader className="w-16 mt-2 h-4" />
                        </>
                    ) : (
                        <>
                            <p className={`text-2xl font-bold ${totalGainLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(totalGainLoss, 'EUR')}</p>
                            <p className={`text-sm font-semibold ${totalGainLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>{totalGainLoss >= 0 ? '+' : ''}{totalGainLossPercent.toFixed(2)}%</p>
                        </>
                    )}
                </Card>
                <Card><p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Holdings</p><p className="text-2xl font-bold">{holdings.length}</p></Card>
            </div>
            
             <div className="p-3 text-center bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 rounded-lg text-sm">
                <span className="font-semibold">Note:</span> Price scraping is simulated for demonstration and does not reflect live market data. Configure scrapers to assign simulated prices to your warrants.
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
                                const currentValue = currentPrice !== undefined && currentPrice !== null ? holding.quantity * currentPrice : 0;
                                const gainLoss = currentPrice !== undefined && currentPrice !== null ? currentValue - holding.totalGrantValue : 0;
                                return (
                                <div key={holding.isin} className="grid grid-cols-3 items-center p-4">
                                    <div><p className="font-bold text-lg">{holding.isin}</p><p className="text-sm text-light-text-secondary dark:text-dark-text-secondary truncate">{holding.name}</p></div>
                                    <div className="text-center">
                                        <p className="font-semibold">{holding.quantity}</p>
                                        {isLoading ? <SkeletonLoader className="w-16 h-4 mx-auto mt-1" /> : (
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                                @ {currentPrice !== null ? formatCurrency(currentPrice, 'EUR') : 'N/A'}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        {isLoading ? <SkeletonLoader className="w-24 ml-auto" /> : (
                                            <p className="font-bold">{currentPrice !== null ? formatCurrency(currentValue, 'EUR') : 'N/A'}</p>
                                        )}
                                        {isLoading ? <SkeletonLoader className="w-16 h-4 ml-auto mt-1" /> : (
                                            currentPrice !== null ? (
                                                <p className={`text-sm font-semibold ${gainLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>{gainLoss >= 0 ? '+' : ''}{formatCurrency(gainLoss, 'EUR')}</p>
                                            ) : (
                                                <button onClick={() => setIsScraperModalOpen(true)} className="text-xs text-primary-500 hover:underline">Configure</button>
                                            )
                                        )}
                                    </div>
                                </div>
                            )})}
                        </div>
                    </Card>
                </div>
            </div>

            <Card>
                <h3 className="text-xl font-semibold text-light-text dark:text-dark-text mb-4">Grant History</h3>
                <table className="w-full text-left text-sm">
                    <thead><tr className="border-b border-black/10 dark:border-white/10"><th className="p-2 font-semibold">Grant Date</th><th className="p-2 font-semibold">ISIN</th><th className="p-2 font-semibold">Name</th><th className="p-2 font-semibold text-right">Quantity</th><th className="p-2 font-semibold text-right">Grant Price</th><th className="p-2 font-semibold text-right">Grant Value</th><th className="p-2"></th></tr></thead>
                    <tbody>{sortedGrants.map(grant => (<tr key={grant.id} className="border-b border-black/5 dark:border-white/5 last:border-b-0 hover:bg-black/5 dark:hover:bg-white/5 group"><td className="p-2">{new Date(grant.grantDate).toLocaleDateString()}</td><td className="p-2 font-semibold">{grant.isin}</td><td className="p-2">{grant.name}</td><td className="p-2 text-right">{grant.quantity}</td><td className="p-2 text-right">{formatCurrency(grant.grantPrice, 'EUR')}</td><td className="p-2 font-semibold text-right">{formatCurrency(grant.quantity * grant.grantPrice, 'EUR')}</td><td className="p-2 text-right opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => handleOpenWarrantModal(grant)} className="p-1 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/10 dark:hover:bg-white/10"><span className="material-symbols-outlined text-base">edit</span></button><button onClick={() => deleteWarrant(grant.id)} className="p-1 rounded-full text-red-500/80 hover:bg-red-500/10"><span className="material-symbols-outlined text-base">delete</span></button></td></tr>))}</tbody>
                </table>
            </Card>
        </div>
    );
};

export default Warrants;