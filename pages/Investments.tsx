import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Account, Currency, HoldingsOverview, InvestmentTransaction, PriceHistoryEntry, SmartPriceBinding, Transaction, Warrant } from '../types';
import { CURRENCY_OPTIONS } from '../constants';
import { convertCurrency, convertToMain, formatCurrency, parseLocalDate, toLocalISOString, getMainCurrency } from '../utils';
import { buildHoldingsOverview, formatHoldingType, historyWindow, holdingsInSegment, mergedPriceLog, portfolioBySegment, realizedGains, SEGMENT_NAMES, segmentOf, type InvestmentSegment, type SegmentName } from '../utils/investments';
import { buildPortfolioHistory } from '../utils/portfolioHistory';
import { fetchSmartPrice } from '../utils/smartPrice';
import { warnIgnored } from '../utils/logging';
import { fetchBestQuote } from '../src/services/twelveDataService';
import { usePreferencesContext } from '../contexts/DomainProviders';
import { useIsMobile } from '../hooks/useIsMobile';
import { useSafeState } from '../hooks/useSafeState';
import { setUrlTab, useUrlTab } from '../hooks/useUrlTab';
import { diversification, monthlyFlows, netInvestedOn, recentMonths } from '../utils/portfolioInsights';
import { Bars, Board, Donut, Section } from '../components/accounts/charts';
import { BrandMark as BrandMarkFor } from '../components/ServiceCard';
import PortfolioHero from '../components/investments/PortfolioHero';
import HoldingsTreemap from '../components/investments/HoldingsTreemap';
import { DiversificationCard, Movers, PositionStrip, WinRate, signedPct } from '../components/investments/PortfolioCards';
import AccountCard from '../components/AccountCard';
import AccountForm from '../components/AccountForm';
import BalanceAdjustmentModal from '../components/BalanceAdjustmentModal';
import HoldingPanel from '../components/HoldingPanel';
import HoldingsTable, { type HoldingRow } from '../components/HoldingsTable';
import InvestmentModal from '../components/InvestmentModal';
import PageHeader, { type PageStat } from '../components/PageHeader';
import WarrantPriceModal from '../components/WarrantPriceModal';
import { Button, IconButton } from '../components/ui/Actions';
import { Badge, DayGroup, ShowMore } from '../components/ui/Display';
import { Switch, TextInput } from '../components/ui/Fields';
import { Menu, type MenuAction } from '../components/ui/Menu';
import { Amount } from '../components/ui/Money';
import { ConfirmDialog } from '../components/ui/Overlays';
import SegmentedControl from '../components/ui/SegmentedControl';
import { EmptyState } from '../components/ui/States';

interface InvestmentsProps {
  accounts: Account[];
  cashAccounts: Account[];
  investmentTransactions: InvestmentTransaction[];
  saveInvestmentTransaction: (transaction: Omit<InvestmentTransaction, 'id'> & { id?: string }, cashTx?: Omit<Transaction, 'id'>, newAccount?: Omit<Account, 'id'>) => void;
  saveAccount: (accountData: Omit<Account, 'id'> & { id?: string }) => void;
  deleteInvestmentTransaction: (id: string) => void;
  saveTransaction: (transactions: (Omit<Transaction, 'id'> & { id?: string })[], transactionIdsToDelete?: string[]) => void;
  warrants: Warrant[];
  saveWarrant: (warrant: Omit<Warrant, 'id'> & { id?: string }) => void;
  deleteWarrant: (id: string) => void;
  manualPrices: Record<string, number | undefined>;
  onManualPriceChange: (isin: string, price: number | null | { date: string; price: number }[], date?: string) => void;
  prices: Record<string, number | null>;
  onToggleAccountStatus: (accountId: string) => void;
  deleteAccount: (id: string) => void;
  transactions: Transaction[];
  onViewAccount?: (accountId: string) => void;
  priceHistory?: Record<string, PriceHistoryEntry[]>;
  /** A holding reached by its own address opens in the panel (D-025). */
  linkedSymbol?: string;
  onCloseLinkedHolding?: () => void;
}

const SEGMENT_LABELS: Record<SegmentName, string> = { Stock: 'Stocks', ETF: 'ETFs', Crypto: 'Crypto', Warrant: 'Warrants', 'Spare Change': 'Spare change', 'Pension Fund': 'Pension', Other: 'Other' };
/** Colour follows the segment, so filtering never repaints one. */
const SEGMENT_COLORS: Record<SegmentName, string> = { Stock: 'var(--chart-1)', ETF: 'var(--chart-3)', Crypto: 'var(--chart-4)', Warrant: 'var(--chart-5)', 'Spare Change': 'var(--chart-2)', 'Pension Fund': 'var(--primary)', Other: 'var(--muted)' };
const RANGES = [{ id: '30', label: '1M' }, { id: '91', label: '3M' }, { id: '182', label: '6M' }, { id: '365', label: '1Y' }, { id: 'all', label: 'All' }];
const RANGE_WORDS: Record<string, string> = { '30': 'in a month', '91': 'in 3 months', '182': 'in 6 months', '365': 'in a year', all: 'since the start' };
const SUPPORTED_CURRENCIES = CURRENCY_OPTIONS.map(option => option.split(' ')[0]);
const ACTIVITY_STEP = 25;
const ALLOCATION_ROWS = 6;
const POSITION_CARDS = 8;
const ACTIVITY_KINDS = [{ id: 'all', label: 'All' }, { id: 'Buy', label: 'Buys' }, { id: 'Sell', label: 'Sells' }, { id: 'Grant', label: 'Grants' }];
const monthName = (month: string) => parseLocalDate(`${month}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const monthShort = (month: string) => parseLocalDate(`${month}-01`).toLocaleDateString(undefined, { month: 'short' });

const shortDate = (date: string) => parseLocalDate(date.slice(0, 10)).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const percentOf = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

/** Rivet's portfolio view with warrants, pension and spare change, on one page for every screen (D-025). */
const Investments: React.FC<InvestmentsProps> = ({
  accounts, cashAccounts, investmentTransactions, saveInvestmentTransaction, saveAccount, deleteInvestmentTransaction, saveTransaction, warrants, saveWarrant, deleteWarrant,
  manualPrices, onManualPriceChange, prices, onToggleAccountStatus, deleteAccount, transactions, onViewAccount, priceHistory = {}, linkedSymbol, onCloseLinkedHolding,
}) => {
  const { preferences, setPreferences } = usePreferencesContext();
  const isPhone = useIsMobile();
  const urlTab = useUrlTab();
  const tab = urlTab === 'holdings' || urlTab === 'activity' ? urlTab : 'portfolio';
  const [segment, setSegment] = useState<InvestmentSegment>('all');
  const [range, setRange] = useState('182');
  const [showInactive, setShowInactive] = useState(false);
  const [activityShown, setActivityShown] = useState(ACTIVITY_STEP);
  const [openSymbol, setOpenSymbol] = useState<string | null>(linkedSymbol ?? null);
  const [tradeForm, setTradeForm] = useState<{ mode?: 'trade' | 'grant'; symbol?: string; trade?: InvestmentTransaction; grant?: Warrant } | null>(null);
  const [priceTarget, setPriceTarget] = useState<{ symbol: string; name: string; entry?: PriceHistoryEntry } | null>(null);
  const [accountForm, setAccountForm] = useState<Account | null>(null);
  const [adjustingAccount, setAdjustingAccount] = useState<Account | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  const [activityToDelete, setActivityToDelete] = useState<{ id: string; isGrant: boolean; label: string } | null>(null);
  const [isUpdatingPrices, setUpdatingPrices] = useSafeState(false);

  useEffect(() => setOpenSymbol(linkedSymbol ?? null), [linkedSymbol]);

  // Moves price bindings saved in this browser into the synced preferences.
  useEffect(() => {
    try {
      const stored = localStorage.getItem('smartPriceBindings');
      if (!stored) return;
      const local = JSON.parse(stored) as Record<string, SmartPriceBinding>;
      const merged = { ...(preferences.smartPriceBindings || {}) };
      let hasNew = false;
      Object.entries(local).forEach(([symbol, binding]) => {
        if (!merged[symbol] && binding?.url && binding.selector) {
          merged[symbol] = binding;
          hasNew = true;
        }
      });
      if (hasNew) setPreferences(prev => ({ ...prev, smartPriceBindings: merged }));
    } catch (error) {
      warnIgnored('moving local price bindings', error);
    }
  }, [preferences.smartPriceBindings, setPreferences]);

  const rates = preferences.conversionRates;
  const configs = preferences.investmentPriceConfigs;
  const toEur = useCallback((amount: number, currency: Currency) => convertToMain(amount, currency, rates), [rates]);
  const currencyOf = useCallback((symbol: string): Currency => configs?.[symbol]?.currency ?? 'EUR', [configs]);

  const investmentAccounts = useMemo(() => accounts.filter(account => account.type === 'Investment'), [accounts]);
  const activeAccounts = useMemo(() => investmentAccounts.filter(account => account.status !== 'closed'), [investmentAccounts]);
  const closedAccounts = useMemo(() => investmentAccounts.filter(account => account.status === 'closed'), [investmentAccounts]);
  const accountBySymbol = useMemo(() => new Map(investmentAccounts.filter(account => account.symbol).map(account => [account.symbol!, account])), [investmentAccounts]);
  const transactionsByAccount = useMemo(() => transactions.reduce((groups, transaction) => {
    (groups[transaction.accountId] = groups[transaction.accountId] || []).push(transaction);
    return groups;
  }, {} as Record<string, Transaction[]>), [transactions]);

  const overview: HoldingsOverview = useMemo(() => buildHoldingsOverview(activeAccounts, investmentTransactions, warrants, prices, { currencyOf, toEur }), [activeAccounts, investmentTransactions, warrants, prices, currencyOf, toEur]);
  const everything: HoldingsOverview = useMemo(() => buildHoldingsOverview(investmentAccounts, investmentTransactions, warrants, prices, { currencyOf, toEur }), [investmentAccounts, investmentTransactions, warrants, prices, currencyOf, toEur]);
  const figures = useMemo(() => portfolioBySegment(overview, activeAccounts, toEur), [overview, activeAccounts, toEur]);
  const presentSegments = SEGMENT_NAMES.filter(name => figures[name].value !== 0 || figures[name].cost !== 0);
  const activeSegment = segment === 'all' || presentSegments.includes(segment) ? segment : 'all';
  const current = figures[activeSegment];
  const gain = current.value - current.unpricedValue - (current.cost - current.unpricedCost);
  const gainPct = percentOf(gain, current.cost - current.unpricedCost);

  const heldHoldings = useMemo(() => holdingsInSegment(overview.holdings, activeSegment).filter(holding => holding.quantity > 0.000001 || holding.type === 'Warrant'), [overview, activeSegment]);
  const shownHoldings = useMemo(
    () => (showInactive ? holdingsInSegment(everything.holdings, activeSegment) : heldHoldings).slice().sort((a, b) => b.currentValue - a.currentValue),
    [showInactive, everything, heldHoldings, activeSegment]
  );
  const accountRows = useMemo(() => activeAccounts.filter(account => !account.symbol && (activeSegment === 'all' || segmentOf({ type: 'Standard', subType: account.subType }) === activeSegment)), [activeAccounts, activeSegment]);
  const logFor = useCallback((symbol: string) => mergedPriceLog(priceHistory[symbol], accountBySymbol.get(symbol)?.priceHistory), [priceHistory, accountBySymbol]);

  const portfolioHistory = useMemo(() => buildPortfolioHistory({
    holdings: heldHoldings,
    warrants: activeSegment === 'all' || activeSegment === 'Warrant' ? warrants : [],
    investmentTransactions,
    allSegments: activeSegment === 'all',
    priceHistoryFor: logFor,
    prices,
    nonSymbolAccounts: accountRows,
    transactionsByAccount,
    toEur,
    currencyOf,
    currentValuation: current.value,
    today: toLocalISOString(new Date()),
  }), [heldHoldings, activeSegment, warrants, investmentTransactions, logFor, prices, accountRows, transactionsByAccount, toEur, currencyOf, current.value]);
  const chartWindow = useMemo(() => historyWindow(portfolioHistory, range === 'all' ? null : Number(range), new Date()), [portfolioHistory, range]);
  const chartData = useMemo(() => chartWindow.points.map(point => ({ date: shortDate(point.date), value: point.price })), [chartWindow]);
  const [allocationView, setAllocationView] = useState<'type' | 'currency'>('type');

  const currencyAllocation = useMemo(() => {
    const byCurr = new Map<string, number>();
    heldHoldings.forEach(holding => {
      const c = holding.currency || getMainCurrency();
      byCurr.set(c, (byCurr.get(c) || 0) + holding.currentValue);
    });
    accountRows.forEach(account => {
      const c = account.currency || getMainCurrency();
      byCurr.set(c, (byCurr.get(c) || 0) + toEur(account.balance, account.currency));
    });
    const palette = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
    return [...byCurr.entries()]
      .filter(([, val]) => val > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([curr, val], i) => ({ id: curr, label: curr, value: val, color: palette[i % palette.length] }));
  }, [heldHoldings, accountRows, toEur]);

  const allocation = useMemo(() => {
    if (activeSegment === 'all') return presentSegments.map(name => ({ id: name, label: SEGMENT_LABELS[name], value: figures[name].value, color: SEGMENT_COLORS[name] })).filter(row => row.value > 0).sort((a, b) => b.value - a.value);
    const rows = [
      ...heldHoldings.map(holding => ({ id: holding.symbol, label: holding.name || holding.symbol, value: holding.currentValue })),
      ...accountRows.map(account => ({ id: account.id, label: account.name, value: toEur(account.balance, account.currency) })),
    ].filter(row => row.value > 0).sort((a, b) => b.value - a.value).map(row => ({ ...row, color: SEGMENT_COLORS[activeSegment] }));
    if (rows.length <= ALLOCATION_ROWS) return rows;
    const rest = rows.slice(ALLOCATION_ROWS - 1);
    return [...rows.slice(0, ALLOCATION_ROWS - 1), { id: 'rest', label: `${rest.length} others`, value: rest.reduce((sum, row) => sum + row.value, 0), color: 'var(--muted)' }];
  }, [activeSegment, presentSegments, figures, heldHoldings, accountRows, toEur]);
  const biggest = useMemo(() => {
    const rows = [
      ...heldHoldings.map(holding => ({ label: holding.name || holding.symbol, value: holding.currentValue })),
      ...accountRows.map(account => ({ label: account.name, value: toEur(account.balance, account.currency) })),
    ];
    return rows.reduce<{ label: string; value: number } | null>((top, row) => (!top || row.value > top.value ? row : top), null);
  }, [heldHoldings, accountRows, toEur]);
  const movers = useMemo(
    () => heldHoldings.filter(holding => !holding.priceUnavailable).map(holding => ({ holding, gain: holding.currentValue - holding.totalCost })).sort((a, b) => Math.abs(b.gain) - Math.abs(a.gain)).slice(0, 5),
    [heldHoldings]
  );

  const symbolsInView = useMemo(() => new Set(holdingsInSegment(everything.holdings, activeSegment).map(holding => holding.symbol)), [everything, activeSegment]);
  const tradesInView = useMemo(() => investmentTransactions.filter(trade => activeSegment === 'all' || symbolsInView.has(trade.symbol)), [investmentTransactions, activeSegment, symbolsInView]);
  const grantsInView = useMemo(() => warrants.filter(grant => activeSegment === 'all' || symbolsInView.has(grant.isin)), [warrants, activeSegment, symbolsInView]);
  const realized = useMemo(() => realizedGains(tradesInView, grantsInView, toEur, currencyOf), [tradesInView, grantsInView, toEur, currencyOf]);
  const activity = useMemo(() => [
    ...tradesInView.map(trade => ({
      id: trade.id, date: trade.date, kind: trade.type?.toLowerCase() === 'buy' ? 'Buy' : 'Sell', symbol: trade.symbol, name: trade.name, quantity: trade.quantity, price: trade.price, currency: (trade.currency ?? currencyOf(trade.symbol)) as Currency, trade, grant: undefined as Warrant | undefined,
    })),
    ...grantsInView.map(grant => ({
      id: grant.id, date: grant.grantDate, kind: 'Grant', symbol: grant.isin, name: grant.name, quantity: grant.quantity, price: grant.grantPrice, currency: currencyOf(grant.isin), trade: undefined as InvestmentTransaction | undefined, grant,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1)), [tradesInView, grantsInView, currencyOf]);

  // What the page draws, beyond the figures above.
  const [activityKind, setActivityKind] = useState('all');
  const pricedCost = current.cost - current.unpricedCost;
  const heroPoints = useMemo(() => {
    // Net invested only means something when every position in view came from trades and grants.
    const invested = accountRows.length === 0 && (tradesInView.length > 0 || grantsInView.length > 0)
      ? netInvestedOn(chartWindow.points.map(point => point.date), tradesInView, grantsInView, toEur, getMainCurrency())
      : null;
    return chartWindow.points.map((point, index) => ({ date: point.date, value: point.price, invested: invested?.[index] }));
  }, [chartWindow, accountRows.length, tradesInView, grantsInView, toEur]);
  const trendOf = useCallback((symbol: string, days: number) => historyWindow(logFor(symbol), days, new Date()).points.map(point => point.price), [logFor]);
  const returnOf = (holding: { priceUnavailable?: boolean; currentValue: number; totalCost: number }) => (holding.priceUnavailable || holding.totalCost <= 0 ? null : ((holding.currentValue - holding.totalCost) / holding.totalCost) * 100);
  const positions = useMemo(() => heldHoldings.slice().sort((a, b) => b.currentValue - a.currentValue).slice(0, POSITION_CARDS).map(holding => {
    const trend = trendOf(holding.symbol, 90);
    return {
      holding,
      trend,
      returnPct: returnOf(holding),
      trendPct: trend.length > 1 && trend[0] > 0 ? ((trend[trend.length - 1] - trend[0]) / trend[0]) * 100 : null,
      weight: percentOf(holding.currentValue, current.value),
    };
  }), [heldHoldings, trendOf, current.value]);
  const moverRows = useMemo(() => movers.map(({ holding, gain: holdingGain }) => ({ holding, gain: holdingGain, pct: percentOf(holdingGain, holding.totalCost), trend: trendOf(holding.symbol, 30) })), [movers, trendOf]);
  const treemapItems = useMemo(() => [
    ...heldHoldings.map(holding => ({ id: holding.symbol, label: holding.symbol, sublabel: holding.name, value: holding.currentValue, returnPct: returnOf(holding) })),
    ...accountRows.map(account => ({ id: `account:${account.id}`, label: account.name, sublabel: account.subType || 'Account', value: toEur(account.balance, account.currency), returnPct: null })),
  ], [heldHoldings, accountRows, toEur]);
  const spread = useMemo(() => diversification(treemapItems.map(item => item.value)), [treemapItems]);
  // The last 12 months, or the 12 up to the latest trade when nothing happened this year.
  const flowMonths = useMemo(() => {
    const latest = [...tradesInView.map(trade => trade.date), ...grantsInView.map(grant => grant.grantDate)].filter(Boolean).sort().pop();
    const recent = recentMonths(12);
    if (!latest || latest.slice(0, 7) >= recent[0]) return recent;
    return recentMonths(12, parseLocalDate(latest.slice(0, 10)));
  }, [tradesInView, grantsInView]);
  const flowPeriod = flowMonths[flowMonths.length - 1] === recentMonths(1)[0] ? 'Last 12 months' : `${monthShort(flowMonths[0])} ${flowMonths[0].slice(0, 4)} to ${monthShort(flowMonths[11])} ${flowMonths[11].slice(0, 4)}`;
  const flows = useMemo(() => monthlyFlows(tradesInView, grantsInView, toEur, flowMonths, getMainCurrency()), [tradesInView, grantsInView, toEur, flowMonths]);
  const hasFlows = flows.some(row => row.bought || row.sold || row.granted);
  const flowBars = useMemo(() => flows.map(row => ({ name: monthShort(row.month), Bought: row.bought, Sold: row.sold, ...(grantsInView.length ? { Granted: row.granted } : {}) })), [flows, grantsInView.length]);
  const flowTotals = useMemo(() => flows.reduce((sum, row) => ({ bought: sum.bought + row.bought, sold: sum.sold + row.sold, granted: sum.granted + row.granted }), { bought: 0, sold: 0, granted: 0 }), [flows]);
  const shownActivity = useMemo(() => (activityKind === 'all' ? activity : activity.filter(item => item.kind === activityKind)), [activity, activityKind]);
  const activityByMonth = useMemo(() => {
    const groups: { month: string; items: typeof activity }[] = [];
    shownActivity.slice(0, activityShown).forEach(item => {
      const month = item.date.slice(0, 7);
      const last = groups[groups.length - 1];
      if (last && last.month === month) last.items.push(item);
      else groups.push({ month, items: [item] });
    });
    return groups;
  }, [shownActivity, activityShown]);
  const openTile = (id: string) => {
    if (id.startsWith('account:')) onViewAccount?.(id.slice('account:'.length));
    else setOpenSymbol(id);
  };
  const segmentByLabel = useMemo(() => new Map(SEGMENT_NAMES.map(name => [SEGMENT_LABELS[name], name])), []);

  const openHolding = useMemo(() => (openSymbol ? everything.holdings.find(holding => holding.symbol === openSymbol) ?? null : null), [openSymbol, everything]);
  const closeHolding = () => {
    setOpenSymbol(null);
    if (linkedSymbol) onCloseLinkedHolding?.();
  };

  const updateAllPrices = useCallback(async () => {
    const targets = heldHoldings;
    if (isUpdatingPrices || targets.length === 0) return;
    setUpdatingPrices(true);
    try {
      let localBindings: Record<string, SmartPriceBinding> = {};
      try {
        localBindings = JSON.parse(localStorage.getItem('smartPriceBindings') || '{}');
      } catch (error) {
        warnIgnored('reading local price bindings', error);
      }
      const settled = await Promise.allSettled(targets.map(async holding => {
        const config = configs?.[holding.symbol];
        const binding = preferences.smartPriceBindings?.[holding.symbol] || config?.binding || localBindings[holding.symbol];
        let price: number;
        if (binding?.url && binding.selector) {
          price = await fetchSmartPrice(holding.symbol, binding);
        } else {
          if (!preferences.twelveDataApiKey) throw new Error('Missing Twelve Data API key');
          const quote = await fetchBestQuote(config?.ticker || holding.symbol, preferences.twelveDataApiKey, config?.exchange, SUPPORTED_CURRENCIES);
          // The price log stays in the holding's currency, whatever the quote came in.
          price = convertCurrency(quote.price, quote.currency, currencyOf(holding.symbol), rates);
        }
        onManualPriceChange(holding.symbol, price, toLocalISOString(new Date()));
      }));
      const failed = settled.flatMap((result, index) => (result.status === 'rejected' ? [targets[index].symbol] : []));
      if (failed.length > 0) toast.warning(`Updated ${targets.length - failed.length} of ${targets.length}. Failed: ${failed.join(', ')}`);
      else toast.success(`Updated ${targets.length} ${targets.length === 1 ? 'price' : 'prices'}`);
    } catch (error) {
      console.error('Failed to update holdings prices', error);
      toast.error("Couldn't update prices. Try again.");
    } finally {
      setUpdatingPrices(false);
    }
  }, [heldHoldings, isUpdatingPrices, configs, preferences.smartPriceBindings, preferences.twelveDataApiKey, currencyOf, rates, onManualPriceChange, setUpdatingPrices]);

  const handleSaveAdjustment = (adjustmentAmount: number, date: string, notes: string) => {
    if (!adjustingAccount) return;
    saveTransaction([{
      accountId: adjustingAccount.id, date, description: 'Balance Adjustment', merchant: notes || 'Manual balance correction', amount: adjustmentAmount,
      category: adjustmentAmount >= 0 ? 'Income' : 'Miscellaneous', type: adjustmentAmount >= 0 ? 'income' : 'expense', currency: adjustingAccount.currency, isBalanceAdjustment: true,
    }], []);
    setAdjustingAccount(null);
  };

  const holdingRows: HoldingRow[] = useMemo(() => shownHoldings.map(holding => ({
    holding,
    trend: historyWindow(logFor(holding.symbol), 30, new Date()).points.map(point => ({ value: point.price })),
    menu: [
      { id: 'details', label: 'Details', icon: 'view', onAction: () => setOpenSymbol(holding.symbol) },
      { id: 'price', label: 'Log or fetch a price', icon: 'pencil-edit-02', onAction: () => setPriceTarget({ symbol: holding.symbol, name: holding.name }) },
      { id: 'trade', label: 'Trade', icon: 'arrow-data-transfer-horizontal', onAction: () => setTradeForm({ mode: 'trade', symbol: holding.symbol }) },
    ],
  })), [shownHoldings, logFor]);

  const [holdingQuery, setHoldingQuery] = useState('');
  const filteredHoldingRows = useMemo(() => {
    const query = holdingQuery.trim().toLowerCase();
    return query ? holdingRows.filter(row => `${row.holding.symbol} ${row.holding.name}`.toLowerCase().includes(query)) : holdingRows;
  }, [holdingRows, holdingQuery]);

  const accountMenu = (account: Account): MenuAction[] => [
    { id: 'open', label: 'Open account', icon: 'link-square-02', onAction: () => onViewAccount?.(account.id) },
    { id: 'edit', label: 'Edit', icon: 'pencil-edit-02', onAction: () => setAccountForm(account) },
    ...(account.status === 'closed' ? [] : [{ id: 'adjust', label: 'Adjust balance', icon: 'sliders-horizontal', onAction: () => setAdjustingAccount(account) }]),
    { id: 'status', label: account.status === 'closed' ? 'Reopen' : 'Close', icon: account.status === 'closed' ? 'square-unlock-02' : 'square-lock-02', startsGroup: true, onAction: () => onToggleAccountStatus(account.id) },
    { id: 'delete', label: 'Delete', icon: 'delete-02', isDestructive: true, onAction: () => setAccountToDelete(account) },
  ];

  const stats: PageStat[] = [
    { label: 'Portfolio value', icon: 'chart-line-data-01', value: current.value, format: 'money', currency: getMainCurrency() },
    { label: 'Gain or loss', icon: gain >= 0 ? 'chart-line-data-01' : 'chart-decrease', value: gain, format: 'money', currency: getMainCurrency(), badge: `${gain >= 0 ? '+' : '−'}${Math.abs(gainPct).toFixed(1)}%`, badgeTone: gain >= 0 ? 'pine' : 'tomato' },
    { label: 'Realised', icon: 'coins-01', value: realized.total, format: 'money', currency: getMainCurrency() },
  ];

  const hasNothing = investmentAccounts.length === 0 && warrants.length === 0 && investmentTransactions.length === 0;
  const addMenu: MenuAction[] = [
    { id: 'trade', label: 'Trade', icon: 'arrow-data-transfer-horizontal', onAction: () => setTradeForm({ mode: 'trade' }) },
    { id: 'grant', label: 'Equity grant', icon: 'award-01', onAction: () => setTradeForm({ mode: 'grant' }) },
  ];
  const segmentItems = [{ id: 'all', label: 'All' }, ...presentSegments.map(name => ({ id: name, label: SEGMENT_LABELS[name] }))];

  return (
    <div className="space-y-6 pb-8 max-md:space-y-4">
      <PageHeader
        title="Investments"
        stats={tab === 'portfolio' && !hasNothing ? [] : stats}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon="refresh" isBusy={isUpdatingPrices} isDisabled={heldHoldings.length === 0} onPress={updateAllPrices}>Update prices</Button>
            <Menu title="Add" trigger={<Button icon="add-01">Add</Button>} items={addMenu} />
          </div>
        }
      />

      {hasNothing ? (
        <EmptyState icon="chart-line-data-01" title="No investments yet" description="Add a trade or an equity grant to start your portfolio." actionLabel="Add a trade" onAction={() => setTradeForm({ mode: 'trade' })} />
      ) : (
        <>
          {presentSegments.length > 1 && <SegmentedControl scrollable items={segmentItems} activeId={activeSegment} onChange={id => setSegment(id as InvestmentSegment)} />}
          {current.unpricedValue > 0 && <p className="type-caption text-muted"><Amount value={current.unpricedValue} currency={getMainCurrency()} /> is valued at its last trade, because there's no current price. It's left out of the gain.</p>}

          {tab === 'portfolio' && (
            <Board>
              <PortfolioHero
                className="col-span-12 @4xl:col-span-8 @4xl:row-span-2"
                points={heroPoints}
                currency={getMainCurrency()}
                value={current.value}
                gain={gain}
                gainPct={gainPct}
                ranges={RANGES}
                range={range}
                onRangeChange={setRange}
                rangeWords={RANGE_WORDS[range]}
                figures={[
                  { label: 'Cost basis', value: <Amount value={pricedCost} currency={getMainCurrency()} />, note: `${heldHoldings.length + accountRows.length} positions` },
                  { label: 'Realised', value: <Amount value={realized.total} currency={getMainCurrency()} tone="flow" />, note: realized.sales.length ? `${realized.sales.length} ${realized.sales.length === 1 ? 'sale' : 'sales'}` : 'No sales yet' },
                  { label: 'Total return', value: <Amount value={gain + realized.total} currency={getMainCurrency()} tone="flow" />, note: pricedCost > 0 ? `${signedPct(percentOf(gain + realized.total, pricedCost))} on cost` : undefined },
                ]}
              />

              <Section
                span="side"
                rows={2}
                title="Allocation"
                subtitle={allocationView === 'type' && activeSegment === 'all' ? 'Pick a slice to focus on it' : undefined}
                action={currencyAllocation.length > 1 ? (
                  <SegmentedControl items={[{ id: 'type', label: 'Type' }, { id: 'currency', label: 'Currency' }]} activeId={allocationView} onChange={id => setAllocationView(id as 'type' | 'currency')} />
                ) : undefined}
              >
                <Donut
                  stacked
                  size={190}
                  centerLabel={activeSegment === 'all' ? 'Portfolio' : SEGMENT_LABELS[activeSegment]}
                  currency={getMainCurrency()}
                  items={(allocationView === 'currency' && currencyAllocation.length > 1 ? currencyAllocation : allocation).map(row => ({ label: row.label, value: row.value, color: row.color }))}
                  onPick={allocationView === 'type' && activeSegment === 'all' ? label => { const name = segmentByLabel.get(label); if (name) setSegment(name); } : undefined}
                />
              </Section>

              {positions.length > 0 && (
                <Section
                  span="full"
                  title="Top positions"
                  subtitle="Largest first, with the last 90 days of prices"
                  action={<Button variant="ghost" size="sm" icon="arrow-right-01" onPress={() => setUrlTab('holdings')}>All holdings</Button>}
                >
                  <PositionStrip items={positions} currency={getMainCurrency()} onOpen={setOpenSymbol} />
                </Section>
              )}

              {treemapItems.length > 0 && (
                <Section span={moverRows.length > 0 ? 'wide' : 'full'} title="Portfolio map" subtitle={`${treemapItems.length} positions, sized by value`}>
                  <HoldingsTreemap items={treemapItems} currency={getMainCurrency()} total={current.value} onOpen={openTile} height={isPhone ? 260 : 320} />
                </Section>
              )}

              {moverRows.length > 0 && (
                <Section span="side" title="Movers" subtitle="Return on what you paid">
                  <Movers rows={moverRows} currency={getMainCurrency()} onOpen={setOpenSymbol} />
                </Section>
              )}

              {hasFlows && (
                <Section
                  span="half"
                  title="Money in and out"
                  subtitle={<>{flowPeriod}: bought <Amount value={flowTotals.bought} currency={getMainCurrency()} />, sold <Amount value={flowTotals.sold} currency={getMainCurrency()} /></>}
                >
                  <Bars
                    data={flowBars}
                    currency={getMainCurrency()}
                    bars={[
                      { key: 'Bought', label: 'Bought', color: 'var(--chart-1)' },
                      { key: 'Sold', label: 'Sold', color: 'var(--chart-4)' },
                      ...(grantsInView.length ? [{ key: 'Granted', label: 'Granted', color: 'var(--chart-3)' }] : []),
                    ]}
                  />
                </Section>
              )}

              {spread.count > 0 && (
                <Section span={hasFlows ? 'half' : 'full'} title="Diversification" subtitle="How many equal positions your spread is worth">
                  <DiversificationCard figures={spread} biggest={biggest && biggest.value > 0 ? { label: biggest.label, share: percentOf(biggest.value, current.value) } : undefined} />
                </Section>
              )}
            </Board>
          )}

          {tab === 'holdings' && (
            <>
              <section aria-label="Holdings" className="surface-card min-w-0 rounded-[var(--radius-xl)] p-6 max-md:p-5">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="type-card-title text-ink">Holdings</h2>
                    <p className="type-caption text-muted">
                      {heldHoldings.length} held · {moverRows.filter(row => row.gain >= 0).length} up · {moverRows.filter(row => row.gain < 0).length} down on cost
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <TextInput label={<span className="sr-only">Search holdings</span>} placeholder="Search by name or symbol" value={holdingQuery} onChange={setHoldingQuery} className="w-64 max-sm:w-full [&_label]:mb-0" />
                    <Switch isSelected={showInactive} onChange={setShowInactive}>Show sold</Switch>
                  </div>
                </div>
                <HoldingsTable
                  rows={filteredHoldingRows}
                  total={current.value}
                  onOpen={holding => setOpenSymbol(holding.symbol)}
                  empty={<p className="type-body py-8 text-center text-muted">{holdingQuery ? `Nothing matches “${holdingQuery}”.` : 'No holdings in this view.'}</p>}
                />
              </section>
              {accountRows.length > 0 && (
                <section aria-label="Accounts" className="space-y-3">
                  <h2 className="type-card-title text-ink">Accounts</h2>
                  {accountRows.map(account => <AccountCard key={account.id} account={account} transactions={transactionsByAccount[account.id] || []} layout="row" menuItems={accountMenu(account)} onOpen={() => onViewAccount?.(account.id)} />)}
                </section>
              )}
              {closedAccounts.length > 0 && activeSegment === 'all' && (
                <section aria-label="Closed portfolios" className="space-y-3">
                  <h2 className="type-card-title text-ink">Closed portfolios</h2>
                  {closedAccounts.map(account => <AccountCard key={account.id} account={account} transactions={transactionsByAccount[account.id] || []} layout="row" menuItems={accountMenu(account)} onOpen={() => onViewAccount?.(account.id)} />)}
                </section>
              )}
            </>
          )}

          {tab === 'activity' && (
            <Board>
              {hasFlows && (
                <Section
                  span="full"
                  title="Trading by month"
                  subtitle={<>{flowPeriod}: bought <Amount value={flowTotals.bought} currency={getMainCurrency()} />, sold <Amount value={flowTotals.sold} currency={getMainCurrency()} />{flowTotals.granted > 0 && <>, granted <Amount value={flowTotals.granted} currency={getMainCurrency()} /></>}</>}
                >
                  <Bars
                    data={flowBars}
                    currency={getMainCurrency()}
                    bars={[
                      { key: 'Bought', label: 'Bought', color: 'var(--chart-1)' },
                      { key: 'Sold', label: 'Sold', color: 'var(--chart-4)' },
                      ...(grantsInView.length ? [{ key: 'Granted', label: 'Granted', color: 'var(--chart-3)' }] : []),
                    ]}
                  />
                </Section>
              )}

              <Section
                span="wide"
                rows={2}
                title="Activity"
                subtitle={`${shownActivity.length} ${shownActivity.length === 1 ? 'entry' : 'entries'}`}
                action={<SegmentedControl items={ACTIVITY_KINDS} activeId={activityKind} onChange={id => { setActivityKind(id); setActivityShown(ACTIVITY_STEP); }} />}
              >
                {shownActivity.length === 0 ? <p className="type-body py-8 text-center text-muted">No {activityKind === 'all' ? 'trades or grants' : ACTIVITY_KINDS.find(kind => kind.id === activityKind)?.label.toLowerCase()} in this view.</p> : (
                  <>
                    <div className="space-y-3">
                      {activityByMonth.map(group => {
                        const net = group.items.reduce((sum, item) => sum + toEur(item.quantity * item.price, item.currency) * (item.kind === 'Sell' ? -1 : 1), 0);
                        return (
                          <DayGroup key={group.month} label={monthName(group.month)} total={<>net <Amount value={net} currency={getMainCurrency()} tone="flow" /></>}>
                            <ul className="divide-y divide-line">
                              {group.items.map(item => (
                                <li key={item.id} className="flex min-h-14 items-center gap-3 py-1">
                                  <BrandMarkFor name={item.name || item.symbol} />
                                  <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-2">
                                      <span className="type-body-strong truncate text-ink">{item.name || item.symbol}</span>
                                      <Badge tone={item.kind === 'Sell' ? 'attention' : item.kind === 'Grant' ? 'blue' : 'positive'}>{item.kind}</Badge>
                                    </span>
                                    <span className="type-caption block truncate text-muted">{item.quantity.toLocaleString()} at <Amount value={item.price} currency={item.currency} />, {shortDate(item.date)}</span>
                                  </span>
                                  <span className="type-figure-row shrink-0 text-ink"><Amount value={item.quantity * item.price} currency={item.currency} /></span>
                                  <Menu
                                    title={item.symbol}
                                    trigger={<IconButton icon="more-horizontal" label={`Actions for ${item.kind.toLowerCase()} of ${item.symbol}`} tooltipPlacement="left" />}
                                    items={[
                                      { id: 'open', label: 'Open holding', icon: 'view', onAction: () => setOpenSymbol(item.symbol) },
                                      { id: 'edit', label: 'Edit', icon: 'pencil-edit-02', onAction: () => setTradeForm({ trade: item.trade, grant: item.grant }) },
                                      { id: 'delete', label: 'Delete', icon: 'delete-02', isDestructive: true, startsGroup: true, onAction: () => setActivityToDelete({ id: item.id, isGrant: !!item.grant, label: `${item.kind.toLowerCase()} of ${item.symbol}` }) },
                                    ]}
                                  />
                                </li>
                              ))}
                            </ul>
                          </DayGroup>
                        );
                      })}
                    </div>
                    <ShowMore remaining={shownActivity.length - activityShown} onPress={() => setActivityShown(count => count + ACTIVITY_STEP)} />
                  </>
                )}
              </Section>

              <Section span="side" rows={2} title="Realised gains" subtitle={realized.sales.length ? <>Total <Amount value={realized.total} currency={getMainCurrency()} tone="flow" /></> : undefined}>
                {realized.sales.length === 0 ? <p className="type-body text-muted">Gains appear here when you sell.</p> : (
                  <>
                    <WinRate wins={realized.wins} losses={realized.losses} />
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4">
                      {realized.biggestWin && <div><dt className="type-label text-muted">Biggest win</dt><dd className="type-figure-row text-money-in"><Amount value={realized.biggestWin.gain} currency={getMainCurrency()} tone="flow" /></dd><dd className="type-caption text-muted">{realized.biggestWin.symbol}</dd></div>}
                      {realized.biggestLoss && <div><dt className="type-label text-muted">Biggest loss</dt><dd className="type-figure-row text-money-out"><Amount value={realized.biggestLoss.gain} currency={getMainCurrency()} tone="flow" /></dd><dd className="type-caption text-muted">{realized.biggestLoss.symbol}</dd></div>}
                    </dl>
                    <ul className="mt-3 divide-y divide-line border-t border-line">
                      {realized.sales.slice(0, 10).map(sale => (
                        <li key={sale.id} className="flex min-h-12 items-center justify-between gap-3 py-1">
                          <span className="min-w-0">
                            <span className="type-body-strong block truncate text-ink">{sale.symbol}</span>
                            <span className="type-caption block text-muted">{sale.quantity.toLocaleString()} sold {shortDate(sale.date)}</span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className={`type-figure-row block ${sale.gain >= 0 ? 'text-money-in' : 'text-money-out'}`}>{signedPct(sale.gainPercent)}</span>
                            <span className="type-caption block text-muted"><Amount value={sale.gain} currency={getMainCurrency()} tone="flow" /></span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Section>
            </Board>
          )}
        </>
      )}

      {openHolding && (
        <HoldingPanel
          holding={openHolding}
          account={accountBySymbol.get(openHolding.symbol)}
          trades={investmentTransactions.filter(trade => trade.symbol === openHolding.symbol)}
          grants={warrants.filter(grant => grant.isin === openHolding.symbol)}
          priceLog={logFor(openHolding.symbol)}
          onClose={closeHolding}
          onLogPrice={entry => setPriceTarget({ symbol: openHolding.symbol, name: openHolding.name, entry })}
          onDeletePrice={date => onManualPriceChange(openHolding.symbol, null, date)}
          onTrade={() => setTradeForm({ mode: 'trade', symbol: openHolding.symbol })}
          onEditTrade={trade => setTradeForm({ trade })}
          onEditGrant={grant => setTradeForm({ grant })}
          weight={percentOf(openHolding.currentValue, figures.all.value)}
        />
      )}
      {tradeForm && (
        <InvestmentModal
          onClose={() => setTradeForm(null)}
          onSaveTrade={saveInvestmentTransaction}
          onSaveGrant={saveWarrant}
          accounts={accounts}
          cashAccounts={cashAccounts}
          holdings={overview.holdings}
          initialMode={tradeForm.mode}
          initialSymbol={tradeForm.symbol}
          transactionToEdit={tradeForm.trade}
          warrantToEdit={tradeForm.grant}
        />
      )}
      {priceTarget && (
        <WarrantPriceModal
          onClose={() => setPriceTarget(null)}
          onSave={onManualPriceChange}
          isin={priceTarget.symbol}
          name={priceTarget.name}
          initialEntry={priceTarget.entry}
          manualPrice={manualPrices[priceTarget.symbol]}
        />
      )}
      {accountForm && <AccountForm account={accountForm} accounts={accounts} warrants={warrants} onClose={() => setAccountForm(null)} onSave={account => { saveAccount(account); setAccountForm(null); }} onDelete={id => { setAccountToDelete(accounts.find(account => account.id === id) ?? null); setAccountForm(null); }} />}
      {adjustingAccount && <BalanceAdjustmentModal onClose={() => setAdjustingAccount(null)} onSave={handleSaveAdjustment} account={adjustingAccount} />}
      <ConfirmDialog
        isOpen={!!accountToDelete}
        onClose={() => setAccountToDelete(null)}
        onConfirm={() => { if (accountToDelete) deleteAccount(accountToDelete.id); setAccountToDelete(null); }}
        title={`Delete ${accountToDelete?.name ?? 'this account'}?`}
        message="This deletes the account and its history. You can't undo it."
        confirmLabel="Delete"
        isDestructive
      />
      <ConfirmDialog
        isOpen={!!activityToDelete}
        onClose={() => setActivityToDelete(null)}
        onConfirm={() => {
          if (activityToDelete?.isGrant) deleteWarrant(activityToDelete.id);
          else if (activityToDelete) deleteInvestmentTransaction(activityToDelete.id);
          setActivityToDelete(null);
        }}
        title={`Delete ${activityToDelete?.label ?? 'this entry'}?`}
        message="Your holding and gains are worked out again without it. You can't undo this."
        confirmLabel="Delete"
        isDestructive
      />
    </div>
  );
};

export default Investments;
