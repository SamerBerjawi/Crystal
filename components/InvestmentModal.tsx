import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Account, 
  InvestmentTransaction, 
  Transaction, 
  InvestmentSubType, 
  HoldingSummary, 
  Warrant, 
  PaymentTerm 
} from '../types';
import { 
  INPUT_BASE_STYLE, 
  SELECT_STYLE, 
  BTN_PRIMARY_STYLE, 
  BTN_SECONDARY_STYLE, 
  SELECT_WRAPPER_STYLE, 
  SELECT_ARROW_STYLE, 
  INVESTMENT_SUB_TYPES 
} from '../constants';
import { formatCurrency, toLocalISOString } from '../utils';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { fetchSymbolMetadata } from '../src/services/twelveDataService';
import { useDebounce } from '../hooks/useDebounce';
import { useConfirm } from './ConfirmationModal';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import Icon from './ui/Icon';

export interface InvestmentModalProps {
  onClose: () => void;
  // Trade Save Handler
  onSaveTrade?: (
    invTx: Omit<InvestmentTransaction, 'id'> & { id?: string }, 
    cashTx?: Omit<Transaction, 'id'>, 
    newAccount?: Omit<Account, 'id'>
  ) => void;
  // Grant Save Handler
  onSaveGrant?: (warrant: Omit<Warrant, 'id'> & { id?: string }) => void;
  // Legacy alias for trade or grant save
  onSave?: (
    data: any, 
    cashTx?: Omit<Transaction, 'id'>, 
    newAccount?: Omit<Account, 'id'>
  ) => void;
  accounts?: Account[];
  cashAccounts?: Account[];
  transactionToEdit?: InvestmentTransaction | null;
  warrantToEdit?: Warrant | null;
  holdings?: HoldingSummary[];
  initialMode?: 'trade' | 'grant';
}

type TradeTabType = 'order' | 'settlement';
type GrantTabType = 'grant' | 'tax';

const InvestmentModal: React.FC<InvestmentModalProps> = ({
  onClose,
  onSaveTrade,
  onSaveGrant,
  onSave,
  accounts = [],
  cashAccounts = [],
  transactionToEdit,
  warrantToEdit,
  holdings = [],
  initialMode = 'trade',
}) => {
  const { confirm, ConfirmDialog } = useConfirm();
  const twelveDataApiKey = usePreferencesSelector(p => p.twelveDataApiKey || '');

  // Determine initial mode based on provided edit records or initialMode prop
  const isEditingTrade = !!(transactionToEdit && transactionToEdit.id);
  const isEditingGrant = !!(warrantToEdit && warrantToEdit.id);
  const isEditing = isEditingTrade || isEditingGrant;

  const [mode, setMode] = useState<'trade' | 'grant'>(
    isEditingGrant ? 'grant' : (isEditingTrade ? 'trade' : initialMode)
  );

  const [isVisible, setIsVisible] = useState(false);
  const [activeTradeTab, setActiveTradeTab] = useState<TradeTabType>('order');
  const [activeGrantTab, setActiveGrantTab] = useState<GrantTabType>('grant');

  // --- 1. TRADE STATE ---
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>(
    transactionToEdit?.type || 'buy'
  );
  const [symbol, setSymbol] = useState(transactionToEdit?.symbol || '');
  const [tradeName, setTradeName] = useState(transactionToEdit?.name || '');
  const [tradeQuantity, setTradeQuantity] = useState(
    transactionToEdit?.quantity ? String(transactionToEdit.quantity) : ''
  );
  const [tradePrice, setTradePrice] = useState(
    transactionToEdit?.price ? String(transactionToEdit.price) : ''
  );
  const [tradeDate, setTradeDate] = useState(
    transactionToEdit?.date || toLocalISOString(new Date())
  );
  const [createCashTx, setCreateCashTx] = useState(!isEditingTrade);
  const [cashAccountId, setCashAccountId] = useState(
    cashAccounts.length > 0 ? cashAccounts[0].id : ''
  );
  const [newAccountSubType, setNewAccountSubType] = useState<InvestmentSubType>('Stock');
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // --- 2. GRANT / WARRANT STATE ---
  const [isin, setIsin] = useState(warrantToEdit?.isin || '');
  const [grantName, setGrantName] = useState(warrantToEdit?.name || '');
  const [grantDate, setGrantDate] = useState(
    warrantToEdit?.grantDate || toLocalISOString(new Date())
  );
  const [grantQuantity, setGrantQuantity] = useState(
    warrantToEdit?.quantity ? String(warrantToEdit.quantity) : ''
  );
  const [grantPrice, setGrantPrice] = useState(
    warrantToEdit?.grantPrice !== undefined ? String(warrantToEdit.grantPrice) : '10.00'
  );
  const [taxType, setTaxType] = useState<'amount' | 'percentage'>(
    warrantToEdit?.taxType || 'percentage'
  );
  const [taxValue, setTaxValue] = useState(
    warrantToEdit?.taxValue !== undefined ? String(warrantToEdit.taxValue) : '0'
  );
  const [taxPayments, setTaxPayments] = useState<PaymentTerm[]>(
    warrantToEdit?.taxPayments || []
  );

  // Smooth slide-in transition on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Handle ESC key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCloseDrawer = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 250);
  };

  // Sync edits if props change
  useEffect(() => {
    if (transactionToEdit) {
      setMode('trade');
      setTradeType(transactionToEdit.type);
      setSymbol(transactionToEdit.symbol);
      setTradeName(transactionToEdit.name);
      setTradeQuantity(String(transactionToEdit.quantity));
      setTradePrice(String(transactionToEdit.price));
      setTradeDate(transactionToEdit.date);
    }
  }, [transactionToEdit]);

  useEffect(() => {
    if (warrantToEdit) {
      setMode('grant');
      setIsin(warrantToEdit.isin);
      setGrantName(warrantToEdit.name);
      setGrantDate(warrantToEdit.grantDate);
      setGrantQuantity(String(warrantToEdit.quantity));
      setGrantPrice(String(warrantToEdit.grantPrice));
      setTaxType(warrantToEdit.taxType || 'percentage');
      setTaxValue(String(warrantToEdit.taxValue ?? 0));
      setTaxPayments(warrantToEdit.taxPayments || []);
    }
  }, [warrantToEdit]);

  // Symbol Suggestions & Metadata Fetching
  const debouncedSymbol = useDebounce(symbol, 600);

  const investmentAccounts = useMemo(() => 
    accounts.filter(a => a.type === 'Investment' && a.symbol), 
  [accounts]);

  const activeHolding = useMemo(() => {
    if (!symbol) return null;
    if (holdings && holdings.length > 0) {
      const h = holdings.find(h => h.symbol?.toUpperCase() === symbol.toUpperCase());
      if (h) return h;
    }
    return investmentAccounts.find(acc => acc.symbol?.toUpperCase() === symbol.toUpperCase());
  }, [symbol, investmentAccounts, holdings]);

  const currentQuantity = activeHolding && 'quantity' in activeHolding ? (activeHolding.quantity ?? 0) : 0;

  const isNewSymbol = useMemo(() => {
    if (isEditingTrade || !symbol) return false;
    return !activeHolding;
  }, [symbol, activeHolding, isEditingTrade]);

  const groupedCashAccounts = useMemo(() => {
    const groups: Record<string, Account[]> = {};
    cashAccounts.forEach(acc => {
      if (!groups[acc.type]) groups[acc.type] = [];
      groups[acc.type].push(acc);
    });
    return groups;
  }, [cashAccounts]);

  const filteredSuggestions = useMemo(() => {
    if (!symbol || !showSuggestions) return [];
    return investmentAccounts.filter(acc => 
      acc.symbol?.toLowerCase().includes(symbol.toLowerCase()) || 
      acc.name.toLowerCase().includes(symbol.toLowerCase())
    ).slice(0, 5);
  }, [symbol, investmentAccounts, showSuggestions]);

  const mapTwelveDataType = (twType: string): InvestmentSubType => {
    const t = twType.toLowerCase();
    if (t.includes('etf')) return 'ETF';
    if (t.includes('crypto')) return 'Crypto';
    return 'Stock';
  };

  const fetchMetadata = useCallback(async (sym: string) => {
    if (!sym || !twelveDataApiKey || isEditingTrade) return;
    
    setIsFetchingMetadata(true);
    try {
      const metadata = await fetchSymbolMetadata(sym, twelveDataApiKey);
      if (metadata) {
        if (!tradeName) setTradeName(metadata.name);
        setNewAccountSubType(mapTwelveDataType(metadata.type));
      }
    } catch (err) {
      console.error('Failed to fetch symbol metadata', err);
    } finally {
      setIsFetchingMetadata(false);
    }
  }, [twelveDataApiKey, isEditingTrade, tradeName]);

  useEffect(() => {
    if (debouncedSymbol && isNewSymbol) {
      fetchMetadata(debouncedSymbol);
    }
  }, [debouncedSymbol, isNewSymbol, fetchMetadata]);

  useEffect(() => {
    if (!isEditingTrade && symbol && accounts.length > 0) {
      const existingAccount = accounts.find(acc => acc.symbol?.toUpperCase() === symbol.toUpperCase());
      if (existingAccount) {
        setTradeName(existingAccount.name);
        setNewAccountSubType(existingAccount.subType as InvestmentSubType || 'Stock');
      }
    }
  }, [symbol, accounts, isEditingTrade]);

  // Calculations for Trade & Grant
  const totalTradeValue = useMemo(() => {
    const q = parseFloat(tradeQuantity) || 0;
    const p = parseFloat(tradePrice) || 0;
    return q * p;
  }, [tradeQuantity, tradePrice]);

  const totalGrantValue = useMemo(() => {
    const q = parseFloat(grantQuantity) || 0;
    const p = parseFloat(grantPrice) || 0;
    return q * p;
  }, [grantQuantity, grantPrice]);

  const calculatedTaxAmount = useMemo(() => {
    const val = parseFloat(taxValue) || 0;
    return taxType === 'percentage' 
      ? (totalGrantValue * val) / 100 
      : val;
  }, [taxType, taxValue, totalGrantValue]);

  const totalPaidTaxes = useMemo(() => {
    return taxPayments.reduce((sum, p) => sum + p.amount, 0);
  }, [taxPayments]);

  const remainingTaxBalance = calculatedTaxAmount - totalPaidTaxes;
  const isBalanceZero = Math.abs(remainingTaxBalance) < 0.01;

  // Tax Installment Handlers
  const handleAddPayment = () => {
    const newPayment: PaymentTerm = {
      id: uuidv4(),
      label: `Tax Payment ${taxPayments.length + 1}`,
      percentage: 0,
      amount: remainingTaxBalance > 0 ? remainingTaxBalance : 0,
      dueDate: toLocalISOString(new Date()),
      status: 'pending'
    };
    setTaxPayments([...taxPayments, newPayment]);
  };

  const handleRemovePayment = (id: string) => {
    setTaxPayments(taxPayments.filter(p => p.id !== id));
  };

  const handleUpdatePayment = (id: string, updates: Partial<PaymentTerm>) => {
    setTaxPayments(taxPayments.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const handleClearFields = () => {
    if (mode === 'trade') {
      setSymbol('');
      setTradeName('');
      setTradeQuantity('');
      setTradePrice('');
      toast.info('Trade fields cleared');
    } else {
      setIsin('');
      setGrantName('');
      setGrantQuantity('');
      setGrantPrice('10.00');
      setTaxValue('0');
      setTaxPayments([]);
      toast.info('Grant fields cleared');
    }
  };

  // Submit Trade
  const handleTradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim()) {
      toast.error('Please specify a ticker symbol');
      return;
    }
    const q = parseFloat(tradeQuantity);
    const p = parseFloat(tradePrice);
    if (isNaN(q) || q <= 0 || isNaN(p) || p <= 0) {
      toast.error('Please provide valid positive quantity and price');
      return;
    }

    if (tradeType === 'sell' && activeHolding && q > currentQuantity) {
      const confirmed = await confirm({
        title: 'Exceeds Current Quantity',
        message: `You are trying to sell ${q} units but you only currently hold ${currentQuantity} units. Proceed anyway?`,
        confirmLabel: 'Proceed',
        variant: 'warning',
        icon: 'warning',
      });
      if (!confirmed) {
        return;
      }
    }
    
    const invTxData: Omit<InvestmentTransaction, 'id'> & { id?: string } = {
      id: isEditingTrade && transactionToEdit ? transactionToEdit.id : undefined,
      symbol: symbol.toUpperCase().trim(),
      name: tradeName.trim() || symbol.toUpperCase().trim(),
      quantity: q,
      price: p,
      date: tradeDate,
      type: tradeType
    };

    let cashTxData: Omit<Transaction, 'id'> | undefined;
    if (createCashTx && !isEditingTrade) {
      const value = q * p;
      const amount = tradeType === 'buy' ? -value : value;
      const cashAccount = cashAccounts.find(a => a.id === cashAccountId);
      if (cashAccount) {
        cashTxData = {
          date: tradeDate,
          amount,
          currency: 'EUR',
          description: `${tradeType === 'buy' ? 'Buy' : 'Sell'} ${q} ${symbol.toUpperCase()}`,
          category: 'Investments',
          accountId: cashAccount.id,
          type: tradeType === 'buy' ? 'expense' : 'income',
        };
      }
    }

    let newAccountData: Omit<Account, 'id'> | undefined;
    if (isNewSymbol) {
      newAccountData = {
        name: tradeName.trim() || symbol.toUpperCase().trim(),
        type: 'Investment',
        subType: newAccountSubType,
        balance: 0,
        currency: 'EUR',
        symbol: symbol.toUpperCase().trim(),
      };
    }

    if (onSaveTrade) {
      onSaveTrade(invTxData, cashTxData, newAccountData);
    } else if (onSave) {
      onSave(invTxData, cashTxData, newAccountData);
    }

    handleCloseDrawer();
  };

  // Submit Grant
  const handleGrantSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isin.trim()) {
      toast.error('Please specify a ticker or ISIN identifier');
      return;
    }
    const q = parseFloat(grantQuantity);
    const p = parseFloat(grantPrice);
    if (isNaN(q) || q <= 0 || isNaN(p) || p <= 0) {
      toast.error('Please provide valid positive quantity and grant price');
      return;
    }

    if (!isBalanceZero && taxPayments.length > 0) {
      toast.error(`Please balance scheduled tax payments. Remaining unpaid: €${remainingTaxBalance.toFixed(2)}`);
      return;
    }

    const warrantData: Omit<Warrant, 'id'> & { id?: string } = {
      id: isEditingGrant && warrantToEdit ? warrantToEdit.id : undefined,
      isin: isin.toUpperCase().trim(),
      name: grantName.trim() || isin.toUpperCase().trim(),
      grantDate,
      quantity: q,
      grantPrice: p,
      taxType,
      taxValue: parseFloat(taxValue) || 0,
      taxAmount: calculatedTaxAmount,
      taxPayments,
    };

    if (onSaveGrant) {
      onSaveGrant(warrantData);
    } else if (onSave) {
      onSave(warrantData);
    }

    handleCloseDrawer();
  };

  const labelStyle = "block text-xs font-bold text-gray-500 dark:text-gray-400 tracking-wider mb-1.5";

  const drawerContent = (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Backdrop Blur Overlay */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleCloseDrawer}
      />

      {/* Right-Side Full Height Slide-out Drawer */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div 
          className={`w-screen max-w-full sm:max-w-xl md:max-w-2xl h-screen bg-light-card dark:bg-dark-card text-gray-900 dark:text-white shadow-2xl border-l border-black/10 dark:border-white/10 flex flex-col justify-between transform transition-transform duration-300 ease-out ${
            isVisible ? 'translate-x-0' : 'translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header matching CategoryModal */}
          <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-indigo-500/5 to-transparent shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div 
                className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md transition-transform hover:scale-105 ${
                  mode === 'trade' ? 'bg-indigo-600' : 'bg-amber-600'
                }`}
              >
                <Icon name={mode === 'trade' ? 'trending_up' : 'verified'} className="text-2xl" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight truncate">
                    {mode === 'trade' 
                      ? (isEditingTrade ? 'Edit Investment Trade' : 'New Investment Trade') 
                      : (isEditingGrant ? 'Edit Equity Grant' : 'New Equity Grant')}
                  </h2>
                  <span className={`px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider ${
                    mode === 'trade'
                      ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  }`}>
                    {mode === 'trade' ? (tradeType === 'buy' ? 'Buy' : 'Sell') : 'Grant'}
                  </span>
                </div>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5 font-medium">
                  {mode === 'trade' ? 'Log market acquisition or disposition' : 'Record employee equity or warrant vesting'}
                </p>
              </div>
            </div>
            <button 
              onClick={handleCloseDrawer}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
              aria-label="Close drawer"
            >
              <Icon name="close" className="text-lg" />
            </button>
          </div>

            {/* Mode Switcher (Trade vs. Grant) */}
            {!isEditing && (
              <div className="px-5 sm:px-6 pt-1 pb-2">
                <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-black/5 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => setMode('trade')}
                    className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      mode === 'trade'
                        ? 'bg-white dark:bg-dark-card text-indigo-600 dark:text-indigo-400 shadow-sm'
                        : 'text-light-text-secondary dark:text-dark-text-secondary opacity-60 hover:opacity-100'
                    }`}
                  >
                    <Icon name="show_chart" className="text-xs" />
                    <span>Market Trade (Buy / Sell)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('grant')}
                    className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      mode === 'grant'
                        ? 'bg-white dark:bg-dark-card text-amber-600 dark:text-amber-400 shadow-sm'
                        : 'text-light-text-secondary dark:text-dark-text-secondary opacity-60 hover:opacity-100'
                    }`}
                  >
                    <Icon name="verified" className="text-xs" />
                    <span>Equity Grant (Warrant / RSU)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Hero Identity & Valuation Card */}
            <div className="px-5 sm:px-6 py-3 space-y-3">
              {mode === 'trade' ? (
                /* TRADE HERO */
                <div className="p-4.5 rounded-3xl bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    {/* Buy / Sell Selector */}
                    <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-black/5 dark:border-white/5">
                      <button
                        type="button"
                        onClick={() => setTradeType('buy')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                          tradeType === 'buy'
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : 'text-gray-500 hover:text-emerald-600'
                        }`}
                      >
                        <Icon name="arrow_downward" className="text-xs" />
                        <span>Buy</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTradeType('sell')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                          tradeType === 'sell'
                            ? 'bg-rose-500 text-white shadow-xs'
                            : 'text-gray-500 hover:text-rose-600'
                        }`}
                      >
                        <Icon name="arrow_upward" className="text-xs" />
                        <span>Sell</span>
                      </button>
                    </div>

                    <div className="text-right">
                      <span className="text-2xs font-bold uppercase tracking-wider text-gray-400 block">
                        Total Order Value
                      </span>
                      <span className="text-lg sm:text-xl font-black font-mono text-gray-900 dark:text-white tabular-nums">
                        €{totalTradeValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Ticker & Name Input with TwelveData Autocomplete */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-black/5 dark:border-white/5">
                    <div className="relative">
                      <label htmlFor="trade-symbol" className={labelStyle}>Ticker / Symbol</label>
                      <div className="relative">
                        <input
                          id="trade-symbol"
                          type="text"
                          value={symbol}
                          onChange={e => {
                            setSymbol(e.target.value.toUpperCase());
                            setShowSuggestions(true);
                          }}
                          onFocus={() => setShowSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                          className={`${INPUT_BASE_STYLE} font-black uppercase tracking-wider !h-10 text-sm`}
                          placeholder="AAPL, BTC, VWCE"
                          required
                          autoFocus
                          autoComplete="off"
                        />
                        {isFetchingMetadata && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Icon name="sync" className="animate-spin text-gray-400 text-sm" />
                          </div>
                        )}
                      </div>

                      {/* Dropdown Suggestions */}
                      {filteredSuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-dark-card rounded-2xl shadow-xl border border-black/10 dark:border-white/10 py-1.5 z-50 animate-fade-in">
                          {filteredSuggestions.map(acc => (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => {
                                setSymbol(acc.symbol || '');
                                setTradeName(acc.name);
                                setNewAccountSubType(acc.subType as InvestmentSubType || 'Stock');
                                setShowSuggestions(false);
                              }}
                              className="w-full text-left px-3.5 py-2 hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-between text-xs cursor-pointer"
                            >
                              <span className="font-bold text-gray-900 dark:text-white">{acc.symbol}</span>
                              <span className="text-gray-500 dark:text-gray-400 truncate max-w-[140px]">{acc.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="col-span-1 sm:col-span-2">
                      <label htmlFor="trade-name" className={labelStyle}>Asset Designation / Name</label>
                      <input
                        id="trade-name"
                        type="text"
                        value={tradeName}
                        onChange={e => setTradeName(e.target.value)}
                        className={`${INPUT_BASE_STYLE} !h-10 text-xs font-semibold`}
                        placeholder="e.g. Apple Inc, Vanguard FTSE All-World"
                        required
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  {/* Quantity & Price Row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="trade-quantity" className={labelStyle}>Quantity Units</label>
                      <input
                        id="trade-quantity"
                        type="number"
                        step="any"
                        value={tradeQuantity}
                        onChange={e => setTradeQuantity(e.target.value)}
                        className={`${INPUT_BASE_STYLE} !h-10 text-sm font-black font-mono tabular-nums`}
                        placeholder="0.00"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="trade-price" className={labelStyle}>Unit Price (€)</label>
                      <div className="relative">
                        <input
                          id="trade-price"
                          type="number"
                          step="any"
                          value={tradePrice}
                          onChange={e => setTradePrice(e.target.value)}
                          className={`${INPUT_BASE_STYLE} !h-10 text-sm font-black font-mono tabular-nums pl-8`}
                          placeholder="0.00"
                          required
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">€</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* GRANT HERO */
                <div className="p-4.5 rounded-3xl bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                        <Icon name="verified" className="text-base" />
                      </div>
                      <div>
                        <span className="text-2xs font-bold uppercase tracking-wider text-gray-400 block">
                          Total Grant Valuation
                        </span>
                        <span className="text-lg sm:text-xl font-black font-mono text-gray-900 dark:text-white tabular-nums">
                          €{totalGrantValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <span className="text-2xs font-mono font-bold px-2 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      Equity Instrument
                    </span>
                  </div>

                  {/* ISIN & Security Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-black/5 dark:border-white/5">
                    <div>
                      <label htmlFor="grant-isin" className={labelStyle}>ISIN / Ticker</label>
                      <input
                        id="grant-isin"
                        type="text"
                        value={isin}
                        onChange={e => setIsin(e.target.value.toUpperCase())}
                        className={`${INPUT_BASE_STYLE} font-black uppercase tracking-wider !h-10 text-sm`}
                        placeholder="WAR-2026, ISIN"
                        required
                        autoFocus
                        autoComplete="off"
                      />
                    </div>

                    <div className="col-span-1 sm:col-span-2">
                      <label htmlFor="grant-name" className={labelStyle}>Asset Designation</label>
                      <input
                        id="grant-name"
                        type="text"
                        value={grantName}
                        onChange={e => setGrantName(e.target.value)}
                        className={`${INPUT_BASE_STYLE} !h-10 text-xs font-semibold`}
                        placeholder="e.g. Series B Warrant Package"
                        required
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  {/* Quantity & Strike Price */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="grant-quantity" className={labelStyle}>Grant Quantity</label>
                      <input
                        id="grant-quantity"
                        type="number"
                        step="any"
                        value={grantQuantity}
                        onChange={e => setGrantQuantity(e.target.value)}
                        className={`${INPUT_BASE_STYLE} !h-10 text-sm font-black font-mono tabular-nums`}
                        placeholder="0"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="grant-price" className={labelStyle}>Grant / Strike Price (€)</label>
                      <div className="relative">
                        <input
                          id="grant-price"
                          type="number"
                          step="any"
                          value={grantPrice}
                          onChange={e => setGrantPrice(e.target.value)}
                          className={`${INPUT_BASE_STYLE} !h-10 text-sm font-black font-mono tabular-nums pl-8`}
                          placeholder="10.00"
                          required
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">€</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Segmented Navigation Tabs */}
            <div className="px-5 sm:px-6 flex gap-1 border-t border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] overflow-x-auto no-scrollbar">
              {mode === 'trade' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTradeTab('order')}
                    className={`py-3 px-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      activeTradeTab === 'order'
                        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-500/5'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon name="tune" className="text-sm" />
                    <span>Order & Classification</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTradeTab('settlement')}
                    className={`py-3 px-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      activeTradeTab === 'settlement'
                        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-500/5'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon name="account_balance" className="text-sm" />
                    <span>Cash Settlement & Ledger</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveGrantTab('grant')}
                    className={`py-3 px-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      activeGrantTab === 'grant'
                        ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/5'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon name="event" className="text-sm" />
                    <span>Grant Schedule & Parameters</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveGrantTab('tax')}
                    className={`py-3 px-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      activeGrantTab === 'tax'
                        ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/5'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon name="receipt_long" className="text-sm" />
                    <span>Tax Strategy & Installments</span>
                  </button>
                </>
              )}
            </div>

          {/* 2. Scrollable Body Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar">
            {mode === 'trade' ? (
              /* TRADE FORM */
              <form id="trade-form" onSubmit={handleTradeSubmit} className="space-y-5">
                {activeTradeTab === 'order' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                        <div className="flex items-center gap-2">
                          <Icon name="calendar_today" className="text-sm text-indigo-500" />
                          <span className="text-xs font-bold text-gray-900 dark:text-white">Execution Parameters</span>
                        </div>
                        <span className="text-2xs text-indigo-500 font-semibold uppercase">Order</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="trade-date" className={labelStyle}>Execution Date</label>
                          <input
                            id="trade-date"
                            type="date"
                            value={tradeDate}
                            onChange={e => setTradeDate(e.target.value)}
                            className={`${INPUT_BASE_STYLE} !h-10 text-xs font-medium`}
                            required
                          />
                        </div>

                        <div>
                          <label className={labelStyle}>Asset Class Sub-Type</label>
                          <div className={SELECT_WRAPPER_STYLE}>
                            <select
                              value={newAccountSubType}
                              onChange={e => setNewAccountSubType(e.target.value as InvestmentSubType)}
                              className={`${SELECT_STYLE} !h-10 text-xs font-bold`}
                            >
                              {INVESTMENT_SUB_TYPES.map(sub => (
                                <option key={sub} value={sub}>{sub}</option>
                              ))}
                            </select>
                            <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                          </div>
                        </div>
                      </div>

                      {/* Current Holding Recap */}
                      {activeHolding && (
                        <div className="p-3 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-2xl border border-indigo-500/20 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon name="inventory_2" className="text-indigo-500 text-sm" />
                            <span className="text-xs font-bold text-gray-900 dark:text-white">Currently in Portfolio:</span>
                          </div>
                          <span className="text-xs font-black font-mono text-indigo-600 dark:text-indigo-400">
                            {currentQuantity} units
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTradeTab === 'settlement' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                        <div className="flex items-center gap-2">
                          <Icon name="account_balance_wallet" className="text-sm text-indigo-500" />
                          <span className="text-xs font-bold text-gray-900 dark:text-white">Cashflow Routing</span>
                        </div>
                        <span className="text-2xs text-indigo-500 font-semibold uppercase">Settlement</span>
                      </div>

                      {!isEditingTrade ? (
                        <>
                          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
                            <div>
                              <p className="text-xs font-bold text-gray-900 dark:text-white">
                                Settle to Cash Ledger
                              </p>
                              <p className="text-2xs text-gray-500 dark:text-gray-400">
                                Automatically log a {tradeType === 'buy' ? 'debit' : 'credit'} transaction in cash account
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => setCreateCashTx(!createCashTx)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                                createCashTx ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-gray-700'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                                  createCashTx ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>

                          {createCashTx && (
                            <div className="space-y-2">
                              <label className={labelStyle}>Settlement Cash Account</label>
                              <div className={SELECT_WRAPPER_STYLE}>
                                <select
                                  value={cashAccountId}
                                  onChange={e => setCashAccountId(e.target.value)}
                                  className={`${SELECT_STYLE} !h-10 text-xs font-bold`}
                                  required
                                >
                                  {Object.entries(groupedCashAccounts).map(([accType, group]) => (
                                    <optgroup key={accType} label={accType}>
                                      {group.map(acc => (
                                        <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance, 'EUR')})</option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>
                                <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 text-xs text-gray-500 dark:text-gray-400 font-medium">
                          Editing historical trade entry. Settle adjustments directly via the cash accounts ledger if required.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </form>
            ) : (
              /* GRANT FORM */
              <form id="grant-form" onSubmit={handleGrantSubmit} className="space-y-5">
                {activeGrantTab === 'grant' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                        <div className="flex items-center gap-2">
                          <Icon name="calendar_today" className="text-sm text-amber-500" />
                          <span className="text-xs font-bold text-gray-900 dark:text-white">Grant Parameters</span>
                        </div>
                        <span className="text-2xs text-amber-500 font-semibold uppercase">Schedule</span>
                      </div>

                      <div>
                        <label htmlFor="grant-date" className={labelStyle}>Grant / Allocation Date</label>
                        <input
                          id="grant-date"
                          type="date"
                          value={grantDate}
                          onChange={e => setGrantDate(e.target.value)}
                          className={`${INPUT_BASE_STYLE} !h-10 text-xs font-medium`}
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeGrantTab === 'tax' && (
                  <div className="space-y-4 animate-fade-in">
                    {/* Tax Calculation Card */}
                    <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                        <div className="flex items-center gap-2">
                          <Icon name="receipt_long" className="text-sm text-amber-500" />
                          <span className="text-xs font-bold text-gray-900 dark:text-white">Tax Obligation Setup</span>
                        </div>
                        <span className="text-2xs text-amber-500 font-semibold uppercase">Fiscal</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelStyle}>Tax Calculation Type</label>
                          <div className={SELECT_WRAPPER_STYLE}>
                            <select
                              value={taxType}
                              onChange={e => setTaxType(e.target.value as 'percentage' | 'amount')}
                              className={`${SELECT_STYLE} !h-10 text-xs font-bold`}
                            >
                              <option value="percentage">Percentage Rate (%)</option>
                              <option value="amount">Fixed Amount (€)</option>
                            </select>
                            <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                          </div>
                        </div>

                        <div>
                          <label className={labelStyle}>
                            {taxType === 'percentage' ? 'Tax Rate (%)' : 'Total Tax Amount (€)'}
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={taxValue}
                            onChange={e => setTaxValue(e.target.value)}
                            className={`${INPUT_BASE_STYLE} !h-10 text-xs font-black font-mono tabular-nums`}
                            placeholder="0"
                          />
                        </div>
                      </div>

                      {/* Tax Liability Balance Recap */}
                      <div className="grid grid-cols-3 gap-2 p-3 bg-white dark:bg-white/[0.03] rounded-2xl border border-black/5 dark:border-white/5 text-center">
                        <div>
                          <span className="text-2xs font-bold text-gray-400 block uppercase">Tax Liability</span>
                          <span className="text-xs font-black font-mono text-gray-900 dark:text-white">
                            €{calculatedTaxAmount.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-2xs font-bold text-gray-400 block uppercase">Scheduled</span>
                          <span className="text-xs font-black font-mono text-indigo-500">
                            €{totalPaidTaxes.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-2xs font-bold text-gray-400 block uppercase">Balance Due</span>
                          <span className={`text-xs font-black font-mono ${isBalanceZero ? 'text-emerald-500' : 'text-rose-500'}`}>
                            €{remainingTaxBalance.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Tax Payment Terms / Installment Schedule */}
                    <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">Installment Terms</span>
                        <button
                          type="button"
                          onClick={handleAddPayment}
                          className="px-2.5 py-1 text-2xs font-bold rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Icon name="add" className="text-xs" />
                          <span>Add Installment</span>
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {taxPayments.map((payment, index) => (
                          <div
                            key={payment.id}
                            className="p-3 rounded-2xl bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <input
                                type="text"
                                value={payment.label}
                                onChange={e => handleUpdatePayment(payment.id, { label: e.target.value })}
                                className="bg-transparent border-none p-0 text-xs font-bold text-gray-900 dark:text-white focus:ring-0 w-full"
                                placeholder={`Payment ${index + 1}`}
                              />
                              <button
                                type="button"
                                onClick={() => handleRemovePayment(payment.id)}
                                className="text-gray-400 hover:text-rose-500 p-1 cursor-pointer"
                              >
                                <Icon name="delete" className="text-xs" />
                              </button>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-2xs text-gray-400 font-bold block mb-0.5">Amount (€)</label>
                                <input
                                  type="number"
                                  step="any"
                                  value={payment.amount}
                                  onChange={e => handleUpdatePayment(payment.id, { amount: parseFloat(e.target.value) || 0 })}
                                  className={`${INPUT_BASE_STYLE} !h-8 !text-2xs font-mono font-bold`}
                                />
                              </div>
                              <div>
                                <label className="text-2xs text-gray-400 font-bold block mb-0.5">Due Date</label>
                                <input
                                  type="date"
                                  value={payment.dueDate}
                                  onChange={e => handleUpdatePayment(payment.id, { dueDate: e.target.value })}
                                  className={`${INPUT_BASE_STYLE} !h-8 !text-2xs font-medium`}
                                />
                              </div>
                              <div>
                                <label className="text-2xs text-gray-400 font-bold block mb-0.5">Status</label>
                                <select
                                  value={payment.status}
                                  onChange={e => handleUpdatePayment(payment.id, { status: e.target.value as any })}
                                  className={`${SELECT_STYLE} !h-8 !text-2xs font-bold`}
                                >
                                  <option value="pending">Pending</option>
                                  <option value="paid">Paid</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        ))}

                        {taxPayments.length === 0 && (
                          <p className="text-2xs text-gray-400 dark:text-gray-500 text-center py-2">
                            No tax installment schedule added. Click "Add Installment" to define payment milestones.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </form>
            )}
          </div>

          {/* 3. Sticky Drawer Footer */}
          <div className="p-6 border-t border-black/5 dark:border-white/5 bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={handleClearFields}
              className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary hover:text-rose-500 transition-colors cursor-pointer"
            >
              Clear Fields
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCloseDrawer}
                className={`${BTN_SECONDARY_STYLE} h-12 px-6 text-xs font-bold uppercase tracking-wider cursor-pointer`}
              >
                Cancel
              </button>

              <button
                type="submit"
                form={mode === 'trade' ? 'trade-form' : 'grant-form'}
                className={`${BTN_PRIMARY_STYLE} h-12 px-8 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg ${
                  mode === 'trade' ? 'shadow-indigo-500/20' : 'shadow-amber-500/20'
                } active:scale-95 cursor-pointer`}
              >
                <span>
                  {mode === 'trade'
                    ? (isEditingTrade ? 'Save Trade' : 'Confirm Trade')
                    : (isEditingGrant ? 'Save Grant' : 'Commit Grant')}
                </span>
                <Icon name="check" className="text-base" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <ConfirmDialog />
    </div>
  );

  return createPortal(drawerContent, document.body);
};

export default InvestmentModal;
