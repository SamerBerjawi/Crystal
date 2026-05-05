
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Account, InvestmentTransaction, Transaction, Warrant, InvestmentSubType, HoldingsOverview } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INVESTMENT_SUB_TYPE_STYLES } from '../constants';
import Card from '../components/Card';
import { formatCurrency, parseLocalDate, toLocalISOString } from '../utils';
import AddInvestmentTransactionModal from '../components/AddInvestmentTransactionModal';
import EditAccountModal from '../components/EditAccountModal';
import WarrantModal from '../components/WarrantModal';
import WarrantPriceModal from '../components/WarrantPriceModal';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { buildHoldingsOverview } from '../utils/investments';
import PageHeader from '../components/PageHeader';
import AccountsListSection from '../components/AccountsListSection';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import ConfirmationModal from '../components/ConfirmationModal';
import Modal from '../components/Modal';

const CACHE_KEYS = {
  INVESTMENT_INSIGHTS: 'crystal_investment_insights'
};

interface InvestmentsProps {
    accounts: Account[];
    cashAccounts: Account[];
    investmentTransactions: InvestmentTransaction[];
    saveInvestmentTransaction: (invTx: Omit<InvestmentTransaction, 'id'> & { id?: string }, cashTx?: Omit<Transaction, 'id'>, newAccount?: Omit<Account, 'id'>) => void;
    saveAccount: (account: Omit<Account, 'id'> & { id?: string }) => void;
    deleteInvestmentTransaction: (id: string) => void;
    saveTransaction: (transactions: (Omit<Transaction, 'id'> & { id?: string })[], idsToDelete?: string[]) => void;
    warrants: Warrant[];
    saveWarrant: (warrant: Omit<Warrant, 'id'> & { id?: string }) => void;
    deleteWarrant: (id: string) => void;
    manualPrices: Record<string, number | undefined>;
    onManualPriceChange: (isin: string, price: number | null | {date: string, price: number}[], date?: string) => void;
    prices: Record<string, number | null>;
    onOpenHoldingDetail: (symbol: string) => void;
    holdingsOverview?: HoldingsOverview;
    onToggleAccountStatus: (accountId: string) => void;
    deleteAccount: (accountId: string) => void;
    transactions: Transaction[];
    onViewAccount?: (accountId: string) => void;
}

// Investments main component
const Investments: React.FC<InvestmentsProps> = ({
    accounts,
    cashAccounts,
    investmentTransactions,
    saveInvestmentTransaction,
    saveAccount,
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
    deleteAccount,
    transactions,
    onViewAccount
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isWarrantModalOpen, setWarrantModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<InvestmentTransaction | null>(null);
    const [editingWarrant, setEditingWarrant] = useState<Warrant | null>(null);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
    const [editingPriceItem, setEditingPriceItem] = useState<{ symbol: string; name: string; currentPrice: number | null } | null>(null);
    const [isAccountModalOpen, setAccountModalOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, account: Account } | null>(null);
    const [isWatchlistModalOpen, setIsWatchlistModalOpen] = useState(false);
    const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
    const [itemToDelete, setItemToDelete] = useState<{ id: string; isWarrant: boolean } | null>(null);
    const [isUpdatingAllPrices, setIsUpdatingAllPrices] = useState(false);

    const twelveDataApiKey = usePreferencesSelector(p => p.twelveDataApiKey || '');

    // Include only Stocks, ETFs, Crypto for the Investments page
    const investmentAccounts = useMemo(() => (
        accounts || []
    ).filter(a => a.type === 'Investment' && ['Stock', 'ETF', 'Crypto'].includes(a.subType || '')), [accounts]);

    const activeInvestmentAccounts = useMemo(() => investmentAccounts.filter(a => a.status !== 'closed'), [investmentAccounts]);
    const closedInvestmentAccounts = useMemo(() => investmentAccounts.filter(a => a.status === 'closed'), [investmentAccounts]);
    const [showInactiveHoldings, setShowInactiveHoldings] = useState(false);

    const activeOverview = useMemo(() => buildHoldingsOverview(activeInvestmentAccounts, investmentTransactions, warrants, prices), [activeInvestmentAccounts, investmentTransactions, warrants, prices]);
    const { holdings: allActiveHoldings, totalValue, totalCostBasis, investedCapital, grantedCapital, distributionData, typeBreakdown } = activeOverview;
    const activeHoldings = useMemo(() => allActiveHoldings.filter(h => h.quantity > 0.000001 || h.type === 'Warrant'), [allActiveHoldings]);

    const displayHoldings = useMemo(
        () => {
            const allHoldings = buildHoldingsOverview(investmentAccounts, investmentTransactions, warrants, prices).holdings;
            if (showInactiveHoldings) {
                return allHoldings;
            }
            // By default only show things we currently own or are active warrants
            return allHoldings.filter(h => h.quantity > 0.000001 || h.type === 'Warrant');
        },
        [investmentAccounts, investmentTransactions, warrants, prices, showInactiveHoldings]
    );

    const accountBySymbol = useMemo(() => {
        const map = new Map<string, Account>();
        investmentAccounts.forEach(account => {
            if (account.symbol) {
                map.set(account.symbol, account);
            }
        });
        return map;
    }, [investmentAccounts]);
    
    const transactionsByAccount = useMemo(() => transactions.reduce((acc, transaction) => {
        (acc[transaction.accountId] = acc[transaction.accountId] || []).push(transaction);
        return acc;
    }, {} as Record<string, Transaction[]>), [transactions]);

    const safeTotalValue = totalValue > 0 ? totalValue : 0;
    const formatPercent = (value: number, digits = 1) => (
        safeTotalValue > 0 ? ((value / safeTotalValue) * 100).toFixed(digits) : '0.0'
    );

    const handleOpenModal = (tx?: InvestmentTransaction) => {
        setEditingTransaction(tx || null);
        setIsModalOpen(true);
    };
    
    const handleOpenWarrantModal = (warrant?: Warrant) => {
         setEditingWarrant(warrant || null);
         setWarrantModalOpen(true);
    }

    const handleOpenAccountModal = (account: Account) => {
        setEditingAccount(account);
        setAccountModalOpen(true);
    };

    const handleOpenPriceModal = useCallback((symbol: string, name: string, currentPrice: number | null) => {
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

        return [...txs, ...grants].sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());
    }, [investmentTransactions, warrants]);
    
    const handleContextMenu = (event: React.MouseEvent, account: Account) => {
        event.preventDefault();
        setContextMenu({ x: event.clientX, y: event.clientY, account });
    };

    const handleAccountClick = (accountId: string) => {
        if (onViewAccount) onViewAccount(accountId);
    };

    const normalizeDecimalString = useCallback((rawValue: string): string => {
        const cleaned = rawValue
            .replace(/\s+/g, '')
            .replace(/\u00A0/g, '')
            .replace(/[^0-9.,-]/g, '');

        const lastDot = cleaned.lastIndexOf('.');
        const lastComma = cleaned.lastIndexOf(',');
        const decimalSeparator = lastDot > lastComma ? '.' : (lastComma > lastDot ? ',' : null);

        if (decimalSeparator) {
            const thousandsSeparator = decimalSeparator === '.' ? ',' : '.';
            const withoutThousands = cleaned.split(thousandsSeparator).join('');
            return withoutThousands.replace(decimalSeparator, '.');
        }

        return cleaned.replace(/,/g, '.');
    }, []);

    const parsePriceFromText = useCallback((text: string): number | null => {
        const numericPart = text.match(/-?\d[\d.,-]*/);
        if (!numericPart) return null;

        const normalized = normalizeDecimalString(numericPart[0]);
        const parsed = parseFloat(normalized);
        return isNaN(parsed) ? null : parsed;
    }, [normalizeDecimalString]);

    const fetchFromTwelveData = useCallback(async (symbol: string): Promise<number> => {
        if (!twelveDataApiKey) {
            throw new Error('Missing Twelve Data API key');
        }

        const fetchPrice = async (query: string) => {
            const response = await fetch(query);
            const data = await response.json();
            if (data.status === 'error' || data.code) {
                throw new Error(data.message || 'Unable to fetch price');
            }
            const parsed = parseFloat(data.price);
            if (isNaN(parsed)) throw new Error('Invalid price returned');
            return parsed;
        };

        const upperSymbol = symbol.toUpperCase();
        const candidates = upperSymbol.includes('/')
            ? [upperSymbol]
            : [`${upperSymbol}/EUR`, `${upperSymbol}/USD`, upperSymbol];

        for (const candidate of candidates) {
            const queryParams = new URLSearchParams({
                symbol: candidate,
                apikey: twelveDataApiKey,
            });

            if (!candidate.toUpperCase().endsWith('/EUR')) {
                queryParams.set('currency', 'EUR');
            }

            try {
                return await fetchPrice(`https://api.twelvedata.com/price?${queryParams.toString()}`);
            } catch {
                continue;
            }
        }

        throw new Error('Price not available from Twelve Data');
    }, [twelveDataApiKey]);

    const fetchFromSmartBinding = useCallback(async (symbol: string, binding: { url: string; selector: string; cookies?: string }) => {
        const encodedUrl = encodeURIComponent(binding.url);
        const cookieParam = binding.cookies ? `&cookies=${encodeURIComponent(binding.cookies)}` : '';
        const response = await fetch(`/api/smart-fetch?url=${encodedUrl}${cookieParam}`);
        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const element = doc.querySelector(binding.selector);
        if (!element) {
            throw new Error(`Saved selector for ${symbol} no longer matches`);
        }
        const price = parsePriceFromText(element.textContent || '');
        if (price === null) {
            throw new Error(`Could not parse price for ${symbol}`);
        }
        return price;
    }, [parsePriceFromText]);

    const handleUpdateAllPrices = useCallback(async () => {
        if (isUpdatingAllPrices || displayHoldings.length === 0) return;

        setIsUpdatingAllPrices(true);
        try {
            const smartBindingsRaw = localStorage.getItem('smartPriceBindings');
            const smartBindings = smartBindingsRaw
                ? JSON.parse(smartBindingsRaw) as Record<string, { url: string; selector: string; cookies?: string }>
                : {};

            const settled = await Promise.allSettled(displayHoldings.map(async (holding) => {
                const binding = smartBindings[holding.symbol];
                const nextPrice = binding
                    ? await fetchFromSmartBinding(holding.symbol, binding)
                    : await fetchFromTwelveData(holding.symbol);
                onManualPriceChange(holding.symbol, nextPrice, toLocalISOString(new Date()));
                return { symbol: holding.symbol, source: binding ? 'Custom site' : 'Twelve Data' };
            }));

            const successCount = settled.filter(result => result.status === 'fulfilled').length;
            const failed = settled
                .map((result, index) => ({ result, symbol: displayHoldings[index].symbol }))
                .filter(item => item.result.status === 'rejected');

            if (failed.length > 0) {
                const failedSymbols = failed.map(item => item.symbol).join(', ');
                window.alert(`Updated ${successCount}/${displayHoldings.length} holdings. Failed: ${failedSymbols}`);
            } else {
                window.alert(`Updated prices for ${successCount} holdings.`);
            }
        } catch (error) {
            console.error('Failed to update holdings prices', error);
            window.alert('Unable to update prices right now. Please try again.');
        } finally {
            setIsUpdatingAllPrices(false);
        }
    }, [displayHoldings, fetchFromSmartBinding, fetchFromTwelveData, isUpdatingAllPrices, onManualPriceChange]);

    const holdingsByType = useMemo(() => {
        const groups = new Map<string, typeof displayHoldings>();
        displayHoldings.forEach((holding) => {
            const key = holding.type === 'Warrant' ? 'Warrants' : (holding.subType || 'Other');
            const existing = groups.get(key) || [];
            existing.push(holding);
            groups.set(key, existing);
        });
        return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [displayHoldings]);

    return (
        <div className="space-y-8 pb-12 animate-fade-in-up">
            {isModalOpen && (
                <AddInvestmentTransactionModal
                    onClose={() => setIsModalOpen(false)}
                    onSave={saveInvestmentTransaction}
                    accounts={accounts}
                    cashAccounts={cashAccounts}
                    transactionToEdit={editingTransaction}
                    holdings={activeHoldings}
                />
            )}
            {isWarrantModalOpen && (
                <WarrantModal 
                    onClose={() => setWarrantModalOpen(false)} 
                    onSave={(w) => { saveWarrant(w); setWarrantModalOpen(false); }} 
                    warrantToEdit={editingWarrant} 
                />
            )}
            {isAccountModalOpen && editingAccount && (
                <EditAccountModal
                    onClose={() => setAccountModalOpen(false)}
                    onSave={(account) => { saveAccount(account); setAccountModalOpen(false); }}
                    onDelete={(accountId) => {
                        const acc = accounts.find(a => a.id === accountId);
                        if (acc) setAccountToDelete(acc);
                        setAccountModalOpen(false);
                    }}
                    account={editingAccount}
                    accounts={accounts}
                    warrants={warrants}
                    onToggleStatus={onToggleAccountStatus}
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

            <ConfirmationModal
                isOpen={!!accountToDelete}
                onClose={() => setAccountToDelete(null)}
                onConfirm={() => {
                    if (accountToDelete) {
                        deleteAccount(accountToDelete.id);
                        setAccountToDelete(null);
                    }
                }}
                title="Delete Account"
                message={`Are you sure you want to delete ${accountToDelete?.name}? This will remove all associated transactions and data. This action cannot be undone.`}
                confirmButtonText="Delete Account"
            />
            
            <ConfirmationModal
                isOpen={!!itemToDelete}
                onClose={() => setItemToDelete(null)}
                onConfirm={() => {
                    if (itemToDelete) {
                        if (itemToDelete.isWarrant) {
                            deleteWarrant(itemToDelete.id);
                        } else {
                            deleteInvestmentTransaction(itemToDelete.id);
                        }
                        setItemToDelete(null);
                    }
                }}
                title="Delete Activity"
                message="Are you sure you want to delete this activity? This will recalculate your holdings basis."
                confirmButtonText="Delete"
            />

            {isWatchlistModalOpen && (
                <Modal onClose={() => setIsWatchlistModalOpen(false)} title="Manage Watchlist" size="lg">
                    <div className="p-8 text-center space-y-4">
                        <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full flex items-center justify-center mx-auto">
                            <span className="material-symbols-outlined text-3xl">visibility</span>
                        </div>
                        <h3 className="text-xl font-bold dark:text-white">Watchlist feature coming soon</h3>
                        <p className="text-light-text-secondary dark:text-dark-text-secondary max-w-sm mx-auto">
                            We're building a powerful watchlist with real-time alerts and research integration. Stay tuned!
                        </p>
                        <button onClick={() => setIsWatchlistModalOpen(false)} className={`${BTN_PRIMARY_STYLE} px-8`}>Close</button>
                    </div>
                </Modal>
            )}
            
            <PageHeader
                markerIcon="finance_chip"
                markerLabel="Investment Dashboard"
                title="Portfolio"
                subtitle="High-density overview of your holdings, performance metrics, and market exposure."
                actions={
                    <div className="flex gap-3">
                        <button onClick={() => handleUpdateAllPrices()} disabled={isUpdatingAllPrices} className={`${BTN_SECONDARY_STYLE} flex items-center gap-2`}>
                             <span className={`material-symbols-outlined text-lg ${isUpdatingAllPrices ? 'animate-spin' : ''}`}>sync</span>
                             Update Prices
                        </button>
                        <button onClick={() => handleOpenWarrantModal()} className={`${BTN_SECONDARY_STYLE} flex items-center gap-2`}>
                             <span className="material-symbols-outlined text-lg">card_membership</span>
                             Add Grant
                        </button>
                        <button onClick={() => handleOpenModal()} className={`${BTN_PRIMARY_STYLE} flex items-center gap-2`}>
                            <span className="material-symbols-outlined text-lg">add</span>
                            Trade
                        </button>
                    </div>
                }
            />

            {/* Performance Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="!p-4 border-l-4 border-primary-500">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Portfolio Value</p>
                    <div className="flex items-baseline gap-2">
                        <h4 className="text-2xl font-bold dark:text-white privacy-blur">{formatCurrency(totalValue, 'EUR')}</h4>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${totalGainLoss >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>
                            {totalGainLossPercent >= 0 ? '+' : ''}{totalGainLossPercent.toFixed(1)}%
                        </span>
                    </div>
                </Card>
                <Card className="!p-4 overflow-hidden">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Net Flow / PnL</p>
                    <h4 className={`text-2xl font-bold privacy-blur ${totalGainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {totalGainLoss >= 0 ? '+' : ''}{formatCurrency(totalGainLoss, 'EUR')}
                    </h4>
                </Card>
                <Card className="!p-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Invested Capital</p>
                    <h4 className="text-2xl font-bold dark:text-white privacy-blur">{formatCurrency(investedCapital, 'EUR')}</h4>
                </Card>
                <Card className="!p-4">
                    <div className="flex justify-between items-center mb-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Holdings</p>
                        <span className="material-symbols-outlined text-sm text-primary-500">data_thresholding</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <h4 className="text-2xl font-bold dark:text-white">{activeHoldings.length}</h4>
                        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-tight">Active positions</span>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                {/* Main Table Column */}
                <div className="xl:col-span-8 space-y-8">
                    <Card className="!p-0 overflow-hidden border-none shadow-sm">
                        <div className="px-6 py-5 flex justify-between items-center border-b border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-primary-500">list_alt</span>
                                <h3 className="font-bold text-light-text dark:text-dark-text">Assets & Holdings</h3>
                            </div>
                            <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary cursor-pointer hover:opacity-80">
                                <input
                                    type="checkbox"
                                    checked={showInactiveHoldings}
                                    onChange={(event) => setShowInactiveHoldings(event.target.checked)}
                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                Show inactive
                            </label>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-white dark:bg-dark-card">
                                    <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] border-b border-black/5 dark:border-white/5">
                                        <th className="py-4 pl-6">Instrument</th>
                                        <th className="py-4 text-right">Last Price</th>
                                        <th className="py-4 text-right">Quantity</th>
                                        <th className="py-4 text-right">Cost Basis</th>
                                        <th className="py-4 text-right">Market Value</th>
                                        <th className="py-4 text-right pr-6">Gain/Loss</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-black/5 dark:divide-white/5 bg-white dark:bg-dark-card">
                                    {holdingsByType.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-12 text-center text-gray-400 italic">
                                                No active holdings found. Start by adding a transaction.
                                            </td>
                                        </tr>
                                    ) : (
                                        holdingsByType.flatMap(([typeName, holdings]) => ([
                                            <tr key={`group-${typeName}`} className="bg-gray-50/80 dark:bg-white/[0.02]">
                                                <td colSpan={6} className="py-2 pl-6 text-[10px] font-black uppercase tracking-widest text-primary-600 dark:text-primary-400">
                                                    {typeName}
                                                </td>
                                            </tr>,
                                            ...holdings.map(holding => {
                                                const gainLoss = holding.currentValue - holding.totalCost;
                                                const gainLossPercent = holding.totalCost > 0 ? (gainLoss / holding.totalCost) * 100 : 0;
                                                const isPositive = gainLoss >= 0;
                                                const holdingAccount = accountBySymbol.get(holding.symbol);
                                                const isClosed = holdingAccount?.status === 'closed';

                                                return (
                                                    <tr 
                                                        key={holding.symbol} 
                                                        className={`group hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-colors cursor-pointer ${isClosed ? 'opacity-50' : ''}`}
                                                        onClick={() => onOpenHoldingDetail(holding.symbol)}
                                                    >
                                                        <td className="py-4 pl-6">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-xs ${holding.type === 'Warrant' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'}`}>
                                                                    {holding.symbol.substring(0, 2)}
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="font-bold text-sm text-light-text dark:text-dark-text truncate">{holding.symbol}</p>
                                                                    <p className="text-[10px] text-gray-400 truncate font-medium">{holding.name}</p>
                                                                </div>
                                                                <div className="hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button
                                                                        onClick={(event) => { event.stopPropagation(); handleOpenPriceModal(holding.symbol, holding.name, holding.currentPrice); }}
                                                                        className="p-1.5 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-primary-600 dark:hover:text-primary-400"
                                                                        title="Update price"
                                                                        aria-label={`Update price for ${holding.symbol}`}
                                                                    >
                                                                        <span className="material-symbols-outlined text-base">payments</span>
                                                                    </button>
                                                                    {holdingAccount && (
                                                                        <>
                                                                            <button
                                                                                onClick={(event) => { event.stopPropagation(); handleOpenAccountModal(holdingAccount); }}
                                                                                className="p-1.5 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-primary-600 dark:hover:text-primary-400"
                                                                                title="Edit account"
                                                                                aria-label={`Edit ${holding.symbol} account`}
                                                                            >
                                                                                <span className="material-symbols-outlined text-base">edit</span>
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-4 text-right">
                                                            <span className="text-sm font-mono dark:text-white privacy-blur">{formatCurrency(holding.currentPrice, 'EUR')}</span>
                                                        </td>
                                                        <td className="py-4 text-right">
                                                            <span className="text-sm font-medium dark:text-gray-300">{holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                                                        </td>
                                                        <td className="py-4 text-right">
                                                            <span className="text-sm font-mono text-gray-500 privacy-blur">{formatCurrency(holding.totalCost, 'EUR')}</span>
                                                        </td>
                                                        <td className="py-4 text-right">
                                                            <span className="text-sm font-bold dark:text-white privacy-blur">{formatCurrency(holding.currentValue, 'EUR')}</span>
                                                        </td>
                                                        <td className="py-4 text-right pr-6">
                                                            <div className={`text-sm font-bold privacy-blur ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                                {isPositive ? '+' : ''}{gainLossPercent.toFixed(1)}%
                                                            </div>
                                                            <div className="text-[10px] text-gray-400 privacy-blur">
                                                                {isPositive ? '+' : ''}{formatCurrency(gainLoss, 'EUR')}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ]))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    <Card className="!p-0 overflow-hidden">
                        <div className="px-6 py-5 border-b border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
                            <h3 className="font-bold text-light-text dark:text-dark-text flex items-center gap-3">
                                <span className="material-symbols-outlined text-primary-500">history</span>
                                Activity Log
                            </h3>
                        </div>
                        <div className="divide-y divide-black/5 dark:divide-white/5">
                            {recentActivity.slice(0, 10).map(item => (
                                <div 
                                    key={item.id} 
                                    className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer group"
                                    onClick={() => item.isWarrant ? handleOpenWarrantModal(item.data as Warrant) : handleOpenModal(item.data as InvestmentTransaction)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${item.type === 'BUY' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : item.type === 'SELL' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'}`}>
                                            {item.type.substring(0, 1)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold dark:text-white uppercase tracking-tight">{item.symbol}</p>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{item.type} • {parseLocalDate(item.date).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex items-center gap-6">
                                        <div className="hidden sm:block">
                                            <p className="text-sm font-medium dark:text-gray-300 privacy-blur">{item.quantity} units @ {formatCurrency(item.price, 'EUR')}</p>
                                        </div>
                                        <div className="min-w-[100px]">
                                            <p className="text-sm font-bold dark:text-white privacy-blur">{formatCurrency(item.quantity * item.price, 'EUR')}</p>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setItemToDelete({ id: item.id, isWarrant: item.isWarrant }); }}
                                                className="p-1 text-gray-400 hover:text-red-500"
                                            >
                                                <span className="material-symbols-outlined text-lg">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* Sidebar Column */}
                <div className="xl:col-span-4 space-y-8">
                     {/* Exposure Chart */}
                    <Card className="bg-gray-900 text-white border-none shadow-xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-400">Exposure Breakdown</h3>
                            <button className="text-[10px] font-bold text-primary-400 uppercase tracking-widest hover:underline">Analysis</button>
                        </div>
                        <div className="h-48 relative mb-6">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={distributionData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={70}
                                        paddingAngle={4}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {distributionData.map(entry => (
                                            <Cell key={entry.name} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px' }}
                                        itemStyle={{ color: '#fff', fontSize: '12px' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Total</span>
                                <span className="text-lg font-bold privacy-blur">{formatCurrency(totalValue, 'EUR')}</span>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {distributionData.slice(0, 4).map(item => (
                                <div key={item.name} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                                        <span className="text-xs font-bold text-gray-300 group-hover:text-white transition-colors">{item.name}</span>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold privacy-blur">{formatPercent(item.value, 0)}%</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* Performance Rankings */}
                    <Card>
                        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-6">Relative Performance</h3>
                        <div className="space-y-4">
                            {displayHoldings
                                .map(h => ({ ...h, gain: h.totalCost > 0 ? ((h.currentValue - h.totalCost) / h.totalCost) * 100 : 0 }))
                                .sort((a, b) => b.gain - a.gain)
                                .slice(0, 5)
                                .map((h, i) => (
                                    <div key={h.symbol} className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-black text-gray-300 w-4">{i + 1}</span>
                                            <div>
                                                <p className="text-xs font-bold dark:text-white">{h.symbol}</p>
                                                <p className="text-[10px] text-gray-400 font-medium">{h.name}</p>
                                            </div>
                                        </div>
                                        <div className={`text-xs font-black ${h.gain >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {h.gain >= 0 ? '▲' : '▼'} {Math.abs(h.gain).toFixed(1)}%
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </Card>

                    {/* Watchlist */}
                    <Card className="bg-primary-50/30 dark:bg-primary-900/5 border-dashed border-primary-200/50 dark:border-primary-800/30">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-[10px] font-bold text-primary-600 dark:text-primary-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">visibility</span>
                                Watchlist
                            </h3>
                            <button onClick={() => setIsWatchlistModalOpen(true)} className="text-[10px] font-bold text-primary-600 dark:text-primary-400 uppercase tracking-widest hover:underline">Manage</button>
                        </div>
                        <div className="p-6 text-center border-t border-black/5 dark:border-white/5 mt-2">
                            <span className="material-symbols-outlined text-primary-200 dark:text-primary-800 text-3xl">add_circle</span>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-2">No items observed</p>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Closed Accounts Section */}
            {closedInvestmentAccounts.length > 0 && (
                <div className="opacity-60 hover:opacity-100 transition-opacity duration-300 mt-12 pt-8 border-t border-black/5 dark:border-white/5">
                    <AccountsListSection 
                        title="Closed Portfolios"
                        accounts={closedInvestmentAccounts}
                        transactionsByAccount={transactionsByAccount}
                        warrants={warrants}
                        linkedEnableBankingAccountIds={new Set(accounts.filter(a => !!a.linkedAccountId).map(a => a.id))}
                        onAccountClick={handleAccountClick}
                        onEditClick={handleOpenAccountModal}
                        onAdjustBalanceClick={() => {}}
                        sortBy="name"
                        accountOrder={[]}
                        onContextMenu={handleContextMenu}
                        isCollapsible={true}
                        defaultExpanded={false}
                        layoutMode="stacked"
                    />
                </div>
            )}
        </div>
    );
};

export default Investments;
