
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Account, InvestmentTransaction, Transaction, Warrant, InvestmentSubType, HoldingsOverview } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INVESTMENT_SUB_TYPE_STYLES, SELECT_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE } from '../constants';
import Card from '../components/Card';
import { formatCurrency, parseLocalDate, toLocalISOString } from '../utils';
import AddInvestmentTransactionModal from '../components/AddInvestmentTransactionModal';
import EditAccountModal from '../components/EditAccountModal';
import WarrantModal from '../components/WarrantModal';
import WarrantPriceModal from '../components/WarrantPriceModal';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area } from 'recharts';
import { buildHoldingsOverview } from '../utils/investments';
import PageHeader from '../components/PageHeader';
import AccountsListSection from '../components/AccountsListSection';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import ConfirmationModal from '../components/ConfirmationModal';
import Modal from '../components/Modal';
import { motion, AnimatePresence } from 'motion/react';

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

type InvestmentSegment = 'all' | 'Stock' | 'ETF' | 'Crypto' | 'Warrant';

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
    const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
    const [itemToDelete, setItemToDelete] = useState<{ id: string; isWarrant: boolean } | null>(null);
    const [isUpdatingAllPrices, setIsUpdatingAllPrices] = useState(false);
    const [activeSegment, setActiveSegment] = useState<InvestmentSegment>('all');

    const twelveDataApiKey = usePreferencesSelector(p => p.twelveDataApiKey || '');

    // Include only Stocks, ETFs, Crypto for the Investments page
    const investmentAccounts = useMemo(() => (
        accounts || []
    ).filter(a => a.type === 'Investment' && ['Stock', 'ETF', 'Crypto'].includes(a.subType || '')), [accounts]);

    const activeInvestmentAccounts = useMemo(() => investmentAccounts.filter(a => a.status !== 'closed'), [investmentAccounts]);
    const closedInvestmentAccounts = useMemo(() => investmentAccounts.filter(a => a.status === 'closed'), [investmentAccounts]);
    const [showInactiveHoldings, setShowInactiveHoldings] = useState(false);

    // Filter accounts and warrants based on active segment
    const filteredInvestmentAccounts = useMemo(() => {
        if (activeSegment === 'all') return activeInvestmentAccounts;
        if (activeSegment === 'Warrant') return [];
        return activeInvestmentAccounts.filter(a => a.subType === activeSegment);
    }, [activeInvestmentAccounts, activeSegment]);

    const filteredWarrants = useMemo(() => {
        if (activeSegment === 'all' || activeSegment === 'Warrant') return warrants;
        return [];
    }, [warrants, activeSegment]);

    const activeOverview = useMemo(() => buildHoldingsOverview(filteredInvestmentAccounts, investmentTransactions, filteredWarrants, prices), [filteredInvestmentAccounts, investmentTransactions, filteredWarrants, prices]);
    const { holdings: allActiveHoldings, totalValue, totalCostBasis, investedCapital, grantedCapital, distributionData, typeBreakdown } = activeOverview;
    const activeHoldings = useMemo(() => allActiveHoldings.filter(h => h.quantity > 0.000001 || h.type === 'Warrant'), [allActiveHoldings]);

    // Global overview for sparkline and summary
    const globalOverview = useMemo(() => buildHoldingsOverview(activeInvestmentAccounts, investmentTransactions, warrants, prices), [activeInvestmentAccounts, investmentTransactions, warrants, prices]);

    const displayHoldings = useMemo(
        () => {
            const overview = activeSegment === 'all' 
                ? buildHoldingsOverview(investmentAccounts, investmentTransactions, warrants, prices)
                : buildHoldingsOverview(
                    activeSegment === 'Warrant' ? [] : investmentAccounts.filter(a => a.subType === (activeSegment as any)),
                    investmentTransactions,
                    activeSegment === 'Warrant' ? warrants : [],
                    prices
                );
            
            const allHoldings = overview.holdings;
            if (showInactiveHoldings) {
                return allHoldings;
            }
            return allHoldings.filter(h => h.quantity > 0.000001 || h.type === 'Warrant');
        },
        [investmentAccounts, investmentTransactions, warrants, prices, showInactiveHoldings, activeSegment]
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

    // Segment Values for Header
    const segmentValues = useMemo(() => {
        const stocks = buildHoldingsOverview(activeInvestmentAccounts.filter(a => a.subType === 'Stock'), investmentTransactions, [], prices);
        const etfs = buildHoldingsOverview(activeInvestmentAccounts.filter(a => a.subType === 'ETF'), investmentTransactions, [], prices);
        const crypto = buildHoldingsOverview(activeInvestmentAccounts.filter(a => a.subType === 'Crypto'), investmentTransactions, [], prices);
        const warrantsOnly = buildHoldingsOverview([], [], warrants, prices);
        
        return {
            all: globalOverview.totalValue,
            Stock: stocks.totalValue,
            ETF: etfs.totalValue,
            Crypto: crypto.totalValue,
            Warrant: warrantsOnly.totalValue
        };
    }, [activeInvestmentAccounts, investmentTransactions, warrants, prices, globalOverview.totalValue]);

    const segmentMetrics = useMemo(() => {
        const totalGainLoss = totalValue - totalCostBasis;
        const totalGainLossPercent = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;
        
        let details = [
            { label: 'Invested Capital', value: formatCurrency(investedCapital, 'EUR'), icon: 'payments' },
            { label: 'Gain/Loss', value: `${totalGainLoss >= 0 ? '+' : ''}${formatCurrency(totalGainLoss, 'EUR')}`, icon: 'show_chart' },
            { label: 'Performance', value: `${totalGainLossPercent >= 0 ? '+' : ''}${totalGainLossPercent.toFixed(1)}%`, icon: 'trending_up' },
        ];

        if (activeSegment === 'Warrant') {
            details = [
                { label: 'Granted Value', value: formatCurrency(grantedCapital, 'EUR'), icon: 'card_membership' },
                { label: 'Active Grants', value: activeHoldings.length.toString(), icon: 'list_alt' },
                { label: 'Unrealized PnL', value: formatCurrency(totalGainLoss, 'EUR'), icon: 'show_chart' },
            ];
        }

        return { totalValue, details };
    }, [activeOverview, activeSegment, grantedCapital, activeHoldings.length]);

    const trendData = useMemo(() => {
        // Mock trend data for investments since we don't have historical snapshots here
        // We'll base it on current value with some random fluctuations for the sparkline effect
        const data = [];
        const baseValue = globalOverview.totalValue;
        for (let i = 0; i < 30; i++) {
            data.push({
                date: i.toString(),
                value: baseValue * (1 + (Math.sin(i / 2) * 0.05) + (Math.random() * 0.02))
            });
        }
        return data;
    }, [globalOverview.totalValue]);

    const segments: { id: InvestmentSegment; label: string; icon: string; color: string }[] = [
        { id: 'all', label: 'All Assets', icon: 'dashboard', color: 'indigo' },
        { id: 'Stock', label: 'Stocks', icon: 'show_chart', color: 'blue' },
        { id: 'ETF', label: 'ETFs', icon: 'account_tree', color: 'teal' },
        { id: 'Crypto', label: 'Crypto', icon: 'currency_bitcoin', color: 'amber' },
        { id: 'Warrant', label: 'Warrants', icon: 'card_membership', color: 'rose' },
    ];

    const heroGradient = activeSegment === 'Stock'
        ? 'from-blue-500 via-blue-600 to-indigo-700'
        : activeSegment === 'ETF'
            ? 'from-teal-500 via-emerald-600 to-cyan-700'
            : activeSegment === 'Crypto'
                ? 'from-amber-500 via-orange-600 to-yellow-700'
                : activeSegment === 'Warrant'
                    ? 'from-rose-500 via-rose-600 to-pink-700'
                    : 'from-indigo-600 via-violet-700 to-purple-800';

    return (
        <div className="relative">
            <div className="relative z-10 space-y-6 pb-12 animate-fade-in-up">
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

                {/* --- Consolidated Header & Portfolio --- */}
                <div className="bg-white dark:bg-dark-card rounded-3xl p-6 border border-black/5 dark:border-white/5 shadow-sm overflow-hidden relative group">
                    <div className={`absolute -top-24 -right-24 w-64 h-64 blur-3xl opacity-20 transition-colors duration-1000 bg-gradient-to-br ${heroGradient}`} />

                    <div className="relative z-10 flex flex-col lg:flex-row lg:items-start justify-between gap-8">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-8 flex-1">
                            <div onClick={() => setActiveSegment('all')} className="cursor-pointer group/nw">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-primary-500 text-sm">candlestick_chart</span>
                                    <span className="text-[10px] font-semibold tracking-wider text-light-text-secondary dark:text-dark-text-secondary">Portfolio Assets</span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <h2 className="text-4xl font-bold tracking-tight privacy-blur text-light-text dark:text-dark-text group-hover/nw:text-primary-500 transition-colors">
                                        {formatCurrency(segmentValues.all, 'EUR')}
                                    </h2>
                                    {activeSegment === 'all' && (
                                        <motion.div layoutId="active-indicator" className="w-1.5 h-1.5 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                                    )}
                                </div>
                                <div className="h-6 mt-3 opacity-40 group-hover/nw:opacity-80 transition-opacity">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={trendData}>
                                            <Area type="monotone" dataKey="value" stroke={activeSegment === 'all' ? "#6366f1" : "#94a3b8"} strokeWidth={2} fill="transparent" animationDuration={2000} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="hidden lg:block w-px h-16 bg-black/5 dark:bg-white/10" />

                            {/* Segment Grid - High Density Tiles */}
                            <div className="flex-[2] grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {segments.filter(s => s.id !== 'all').map(seg => {
                                    const isActive = activeSegment === seg.id;
                                    const val = segmentValues[seg.id as keyof typeof segmentValues];
                                    return (
                                        <div key={seg.id} onClick={() => setActiveSegment(seg.id)} className={`group cursor-pointer p-4 rounded-2xl transition-all border ${isActive ? 'bg-primary-500/5 border-primary-500/20' : 'hover:bg-black/5 dark:hover:bg-white/5 border-transparent'}`}>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-primary-500/10 text-primary-500' : 'bg-gray-100 dark:bg-white/5 text-light-text-secondary'}`}>
                                                    <span className="material-symbols-outlined text-lg">{seg.icon}</span>
                                                </div>
                                                {isActive && <motion.div layoutId="active-indicator" className="w-1.5 h-1.5 rounded-full bg-primary-500 shadow-[0_0_6px_rgba(99,102,241,0.8)]" />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className={`text-[10px] font-semibold tracking-wider ${isActive ? 'text-primary-500' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>{seg.label}</span>
                                                <span className={`text-lg font-bold tracking-tight privacy-blur ${isActive ? 'text-light-text dark:text-dark-text' : 'text-light-text-secondary group-hover:text-light-text dark:group-hover:text-dark-text'}`}>
                                                    {formatCurrency(val, 'EUR')}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="shrink-0 flex gap-3">
                            <button onClick={() => handleUpdateAllPrices()} disabled={isUpdatingAllPrices} className={`${BTN_SECONDARY_STYLE} !px-4 flex items-center gap-2`} title="Sync Market Prices">
                                 <span className={`material-symbols-outlined text-lg ${isUpdatingAllPrices ? 'animate-spin' : ''}`}>sync</span>
                            </button>
                            <button onClick={() => handleOpenWarrantModal()} className={`${BTN_SECONDARY_STYLE} !px-4 hidden sm:flex items-center gap-2`} title="Add Equity Grant">
                                 <span className="material-symbols-outlined text-lg">card_membership</span>
                            </button>
                            <button onClick={() => handleOpenModal()} className={`${BTN_PRIMARY_STYLE} flex items-center gap-2 animate-glow`}>
                                <span className="material-symbols-outlined text-xl">add</span>
                                <span>Trade</span>
                            </button>
                        </div>
                    </div>

                    {/* Integrated Details Tray */}
                    <div className="mt-6 pt-6 border-t border-black/5 dark:border-white/5 flex flex-wrap items-center justify-between gap-6">
                        <AnimatePresence mode="wait">
                            <motion.div key={activeSegment} initial={{ opacity: 0, x: -1 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 1 }} className="flex flex-wrap items-center gap-x-8 gap-y-3">
                                {segmentMetrics.details.map((detail, i) => (
                                     <div key={i} className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary-500/5 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-base text-primary-500/70">{detail.icon}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black tracking-widest text-light-text-secondary/70 uppercase">{detail.label}</span>
                                            <span className="text-sm font-black text-light-text dark:text-dark-text privacy-blur">{detail.value}</span>
                                        </div>
                                     </div>
                                ))}
                            </motion.div>
                        </AnimatePresence>

                        <div className="flex items-center gap-3 flex-wrap">
                             <label className="flex items-center gap-2 text-[10px] bg-light-fill dark:bg-dark-fill px-4 h-9 rounded-xl font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                <input type="checkbox" checked={showInactiveHoldings} onChange={(event) => setShowInactiveHoldings(event.target.checked)} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                                <span>Inactive</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                    {/* Main Table Column */}
                    <div className="xl:col-span-8 space-y-8">
                        <Card className="!p-0 overflow-hidden border-none shadow-sm">
                            <div className="px-6 py-5 flex justify-between items-center border-b border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
                                <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary">
                                    <span className="material-symbols-outlined text-primary-500">list_alt</span>
                                    <span>{activeSegment === 'all' ? 'All Holdings' : `${segments.find(s => s.id === activeSegment)?.label} Positions`}</span>
                                </div>
                            </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-white dark:bg-dark-card">
                                    <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] border-b border-black/5 dark:border-white/5">
                                        <th className="py-4 pl-4 sm:pl-6">Instrument</th>
                                        <th className="py-4 text-right hidden sm:table-cell">Last Price</th>
                                        <th className="py-4 text-right hidden lg:table-cell">Qty</th>
                                        <th className="py-4 text-right hidden md:table-cell">Cost</th>
                                        <th className="py-4 text-right">Market</th>
                                        <th className="py-4 text-right pr-4 sm:pr-6">G/L</th>
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
                                                                <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-xs shrink-0 ${holding.type === 'Warrant' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'}`}>
                                                                    {holding.symbol.substring(0, 2)}
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="font-bold text-sm text-light-text dark:text-dark-text truncate">{holding.symbol}</p>
                                                                    <p className="text-[10px] text-gray-400 truncate font-medium">{holding.name}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-4 text-right hidden sm:table-cell">
                                                            <span className="text-sm font-mono dark:text-white privacy-blur">{formatCurrency(holding.currentPrice, 'EUR')}</span>
                                                        </td>
                                                        <td className="py-4 text-right hidden lg:table-cell">
                                                            <span className="text-sm font-medium dark:text-gray-300">{holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                                                        </td>
                                                        <td className="py-4 text-right hidden md:table-cell">
                                                            <span className="text-sm font-mono text-gray-500 privacy-blur">{formatCurrency(holding.totalCost, 'EUR')}</span>
                                                        </td>
                                                        <td className="py-4 text-right">
                                                            <span className="text-sm font-bold dark:text-white privacy-blur">{formatCurrency(holding.currentValue, 'EUR')}</span>
                                                        </td>
                                                        <td className="py-4 text-right pr-6">
                                                            <div className={`text-sm font-bold privacy-blur ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                                {isPositive ? '+' : ''}{gainLossPercent.toFixed(1)}%
                                                            </div>
                                                            <div className="text-[10px] text-gray-400 privacy-blur hidden sm:block">
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
                    <Card className="bg-white dark:bg-dark-card border-black/5 dark:border-white/5 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary">Exposure Breakdown</h3>
                            <button className="text-[10px] font-bold text-primary-500 uppercase tracking-widest hover:underline">Analysis</button>
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
                                        contentStyle={{ 
                                            backgroundColor: 'var(--tooltip-bg, rgba(0,0,0,0.8))', 
                                            borderColor: 'transparent', 
                                            borderRadius: '12px', 
                                            border: 'none', 
                                            color: 'var(--tooltip-text, #fff)',
                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                        }}
                                        itemStyle={{ fontSize: '12px' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary uppercase font-bold tracking-widest">Total</span>
                                <span className="text-lg font-bold text-light-text dark:text-dark-text privacy-blur">{formatCurrency(totalValue, 'EUR')}</span>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {distributionData.slice(0, 4).map(item => (
                                <div key={item.name} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                                        <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary group-hover:text-light-text dark:group-hover:text-dark-text transition-colors">{item.name}</span>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-light-text dark:text-dark-text privacy-blur">{formatPercent(item.value, 0)}%</p>
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
                </div>
            </div>

            {/* Closed Accounts Section */}
            {closedInvestmentAccounts.length > 0 && activeSegment === 'all' && (
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
    </div>
);
};

export default Investments;
