
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Modal from './Modal';
import { Account, InvestmentTransaction, Transaction, InvestmentSubType, HoldingSummary } from '../types';
import { INPUT_BASE_STYLE, SELECT_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, INVESTMENT_SUB_TYPES, ALL_ACCOUNT_TYPES } from '../constants';
import { formatCurrency, toLocalISOString } from '../utils';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { fetchSymbolMetadata } from '../src/services/twelveDataService';
import { useDebounce } from '../hooks/useDebounce';

interface AddInvestmentTransactionModalProps {
  onClose: () => void;
  onSave: (invTx: Omit<InvestmentTransaction, 'id'> & { id?: string }, cashTx?: Omit<Transaction, 'id'>, newAccount?: Omit<Account, 'id'>) => void;
  accounts: Account[];
  cashAccounts: Account[];
  transactionToEdit?: InvestmentTransaction | null;
  holdings?: HoldingSummary[];
}

const AddInvestmentTransactionModal: React.FC<AddInvestmentTransactionModalProps> = ({ onClose, onSave, accounts, cashAccounts, transactionToEdit, holdings }) => {
    const isEditing = !!(transactionToEdit && transactionToEdit.id);
    const twelveDataApiKey = usePreferencesSelector(p => p.twelveDataApiKey || '');
    
    const [type, setType] = useState<'buy' | 'sell'>(isEditing ? transactionToEdit.type : 'buy');
    const [symbol, setSymbol] = useState(isEditing ? transactionToEdit.symbol : '');
    const [name, setName] = useState(isEditing ? transactionToEdit.name : '');
    const [quantity, setQuantity] = useState(isEditing ? String(transactionToEdit.quantity) : '');
    const [price, setPrice] = useState(isEditing ? String(transactionToEdit.price) : '');
    const [date, setDate] = useState(isEditing ? transactionToEdit.date : toLocalISOString(new Date()));
    const [createCashTx, setCreateCashTx] = useState(!isEditing);
    const [cashAccountId, setCashAccountId] = useState(cashAccounts.length > 0 ? cashAccounts[0].id : '');
    const [newAccountSubType, setNewAccountSubType] = useState<InvestmentSubType>('Stock');
    const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const debouncedSymbol = useDebounce(symbol, 600);

    const investmentAccounts = useMemo(() => 
        accounts.filter(a => a.type === 'Investment' && a.symbol), 
    [accounts]);

    const activeHolding = useMemo(() => {
        if (!symbol) return null;
        if (holdings) {
            const h = holdings.find(h => h.symbol?.toUpperCase() === symbol.toUpperCase());
            if (h) return h;
        }
        return investmentAccounts.find(acc => acc.symbol?.toUpperCase() === symbol.toUpperCase());
    }, [symbol, investmentAccounts, holdings]);

    const currentQuantity = activeHolding && 'quantity' in activeHolding ? (activeHolding.quantity ?? 0) : 0;

    const isNewSymbol = useMemo(() => {
        if (isEditing || !symbol) return false;
        return !activeHolding;
    }, [symbol, activeHolding, isEditing]);

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
        if (!sym || !twelveDataApiKey || isEditing) return;
        
        setIsFetchingMetadata(true);
        try {
            const metadata = await fetchSymbolMetadata(sym, twelveDataApiKey);
            if (metadata) {
                if (!name) setName(metadata.name);
                setNewAccountSubType(mapTwelveDataType(metadata.type));
            }
        } catch (err) {
            console.error('Failed to fetch symbol metadata', err);
        } finally {
            setIsFetchingMetadata(false);
        }
    }, [twelveDataApiKey, isEditing, name]);

    useEffect(() => {
        if (debouncedSymbol && isNewSymbol) {
            fetchMetadata(debouncedSymbol);
        }
    }, [debouncedSymbol, isNewSymbol, fetchMetadata]);

    useEffect(() => {
        if (!isEditing && symbol && accounts) {
            const existingAccount = accounts.find(acc => acc.symbol?.toUpperCase() === symbol.toUpperCase());
            if (existingAccount) {
                setName(existingAccount.name);
                setNewAccountSubType(existingAccount.subType as InvestmentSubType || 'Stock');
            }
        }
    }, [symbol, accounts, isEditing]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const q = parseFloat(quantity);
        if (type === 'sell' && activeHolding && q > currentQuantity) {
            if (!window.confirm(`You are trying to sell ${q} units but you only have ${currentQuantity} units. Proceed anyway?`)) {
                return;
            }
        }
        
        const invTxData: Omit<InvestmentTransaction, 'id'> & { id?: string } = {
            id: isEditing ? transactionToEdit.id : undefined,
            symbol: symbol.toUpperCase(),
            name,
            quantity: parseFloat(quantity),
            price: parseFloat(price),
            date,
            type
        };

        let cashTxData: Omit<Transaction, 'id'> | undefined;
        if (createCashTx && !isEditing) {
            const value = parseFloat(quantity) * parseFloat(price);
            const amount = type === 'buy' ? -value : value;
            const cashAccount = cashAccounts.find(a => a.id === cashAccountId);
            if (cashAccount) {
                 cashTxData = {
                    accountId: cashAccountId,
                    date,
                    description: `${type === 'buy' ? 'Buy' : 'Sell'} ${quantity} ${symbol.toUpperCase()}`,
                    amount,
                    category: type === 'buy' ? 'Investments' : 'Investment Income',
                    type: amount >= 0 ? 'income' : 'expense',
                    currency: cashAccount.currency,
                };
            }
        }

        let newAccountData: Omit<Account, 'id'> | undefined;
        if (isNewSymbol) {
            newAccountData = {
                name: name,
                type: 'Investment',
                subType: newAccountSubType,
                symbol: symbol.toUpperCase(),
                balance: 0, 
                currency: 'EUR',
            };
        }

        onSave(invTxData, cashTxData, newAccountData);
        onClose();
    };

    const labelStyle = "block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-2";
    const modalTitle = isEditing ? 'Edit Transaction' : 'Add Transaction';
    const totalValue = (parseFloat(quantity) || 0) * (parseFloat(price) || 0);

    return (
        <Modal onClose={onClose} title={modalTitle} size="lg">
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[2.5rem]">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-500/10 blur-[80px] rounded-full" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-rose-500/10 blur-[80px] rounded-full" />
            </div>

            <form onSubmit={handleSubmit} className="relative z-10 space-y-8 pb-4">
                
                {/* 1. Transaction Type Toggle */}
                <div className="flex bg-gray-100 dark:bg-white/10 p-1.5 rounded-[1.25rem] border border-black/5 dark:border-white/5 space-x-1">
                    <button 
                        type="button" 
                        onClick={() => setType('buy')} 
                        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all ${type === 'buy' ? 'bg-white dark:bg-dark-card text-emerald-600 shadow-md ring-1 ring-emerald-500/10' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 opacity-60'}`}
                    >
                        Execute Buy
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setType('sell')} 
                        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all ${type === 'sell' ? 'bg-white dark:bg-dark-card text-rose-600 shadow-md ring-1 ring-rose-500/10' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 opacity-60'}`}
                    >
                        Execute Sell
                    </button>
                </div>
                
                {/* 2. Hero Amount Section */}
                <div className="bg-white dark:bg-black/20 p-8 rounded-[2.5rem] border border-black/5 dark:border-white/5 space-y-4 flex flex-col items-center shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-light-text-secondary dark:text-dark-text-secondary opacity-70">Projected Total Value</p>
                    <div className="relative group w-full max-w-[320px] flex justify-center py-2">
                        <div className="text-7xl font-black tracking-tighter tabular-nums flex items-baseline gap-3 text-light-text dark:text-dark-text">
                            <span className="text-3xl text-gray-300 dark:text-gray-700 font-medium">€</span>
                            {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>
                    <div className="h-1 w-16 bg-primary-500/20 rounded-full" />
                </div>

                {/* 3. Asset Details Card */}
                <div className="p-6 bg-light-fill dark:bg-dark-fill/50 rounded-3xl border border-black/5 dark:border-white/5 space-y-8">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary-500 text-lg">database</span>
                        Asset Parameters
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="relative space-y-2">
                            <label htmlFor="inv-symbol" className={labelStyle}>Symbol / Identification</label>
                            <div className="relative group">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg group-focus-within:text-primary-500 transition-colors">search</span>
                                <input 
                                    id="inv-symbol" 
                                    type="text" 
                                    value={symbol} 
                                    onChange={e => {
                                        setSymbol(e.target.value);
                                        setShowSuggestions(true);
                                    }} 
                                    onFocus={() => setShowSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                    className={`${INPUT_BASE_STYLE} uppercase pl-12 font-black h-14 tracking-widest !text-xl`} 
                                    placeholder="TICKER..." 
                                    required 
                                    autoFocus 
                                />
                                {isFetchingMetadata && (
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                        <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                )}
                            </div>
                            
                            {showSuggestions && filteredSuggestions.length > 0 && (
                                <div className="absolute z-[100] w-full mt-2 bg-white dark:bg-dark-card border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden py-2 backdrop-blur-xl">
                                    {filteredSuggestions.map(acc => (
                                        <button
                                            key={acc.id}
                                            type="button"
                                            className="w-full text-left px-5 py-4 hover:bg-primary-50 dark:hover:bg-primary-500/10 flex flex-col transition-colors group"
                                            onClick={() => {
                                                setSymbol(acc.symbol || '');
                                                setName(acc.name);
                                                setNewAccountSubType(acc.subType as InvestmentSubType || 'Stock');
                                                setShowSuggestions(false);
                                            }}
                                        >
                                            <span className="font-black text-sm text-light-text dark:text-dark-text group-hover:text-primary-600 dark:group-hover:text-primary-400 group-active:scale-95 transition-transform">{acc.symbol}</span>
                                            <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary truncate font-black uppercase tracking-widest opacity-60">{acc.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="inv-date" className={labelStyle}>Fiscal Execution Date</label>
                            <input id="inv-date" type="date" value={date} onChange={e => setDate(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black uppercase tracking-tighter`} required />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label htmlFor="inv-quantity" className={labelStyle}>Operational Quantity</label>
                            <input id="inv-quantity" type="number" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} className={`${INPUT_BASE_STYLE} font-black pl-5 h-14 text-xl tabular-nums`} placeholder="0.0000" required />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="inv-price" className={labelStyle}>Price per Unit</label>
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-lg pointer-events-none select-none">€</span>
                                <input id="inv-price" type="number" step="any" value={price} onChange={e => setPrice(e.target.value)} className={`${INPUT_BASE_STYLE} font-black pl-10 h-14 text-xl tabular-nums`} placeholder="0.00" required />
                            </div>
                        </div>
                    </div>

                    {(activeHolding && type === 'sell') || isNewSymbol ? (
                        <div className="p-5 bg-white dark:bg-black/20 rounded-2xl border border-black/5 dark:border-white/5 space-y-6">
                            {activeHolding && type === 'sell' && (
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-emerald-500">inventory_2</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 dark:text-emerald-400">Available Inventory</span>
                                            <p className="text-lg font-black tabular-nums">{currentQuantity.toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        {[0.25, 0.5, 1].map(p => (
                                            <button key={p} type="button" onClick={() => setQuantity(String(currentQuantity * p))} className="flex-1 sm:flex-none px-4 py-2 text-[10px] font-black bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-xl hover:brightness-95 active:scale-95 transition-all uppercase tracking-widest">
                                                {p * 100}%
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {isNewSymbol && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                                    <div className="space-y-2">
                                        <label htmlFor="inv-name" className={labelStyle}>Asset Designation</label>
                                        <input id="inv-name" type="text" value={name} onChange={e => setName(e.target.value)} className={`${INPUT_BASE_STYLE} h-12 text-sm font-black uppercase`} placeholder="COMPANY NAME" required />
                                    </div>
                                    <div className="space-y-2">
                                        <label className={labelStyle}>Instrument Sub-Type</label>
                                        <div className={SELECT_WRAPPER_STYLE}>
                                            <select id="inv-subtype" value={newAccountSubType} onChange={e => setNewAccountSubType(e.target.value as InvestmentSubType)} className={`${SELECT_STYLE} h-12 text-sm font-black uppercase tracking-widest`} required>
                                                {INVESTMENT_SUB_TYPES.map(subType => <option key={subType} value={subType}>{subType}</option>)}
                                            </select>
                                            <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>
                
                {/* Funding Source Section */}
                {!isEditing && (
                    <div className={`p-6 rounded-[2rem] border transition-all duration-500 group ${createCashTx ? 'bg-primary-500/5 dark:bg-primary-500/10 border-primary-500/20 shadow-sm' : 'bg-transparent border-black/5 dark:border-white/5 opacity-40 grayscale hover:grayscale-0 hover:opacity-100'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${createCashTx ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                                    <span className="material-symbols-outlined">payments</span>
                                </div>
                                <div className="space-y-0.5">
                                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-light-text dark:text-dark-text">Funding Pipeline</h4>
                                    <p className="text-[9px] text-light-text-secondary dark:text-dark-text-secondary font-black tracking-widest uppercase opacity-60">Automated Ledger Posting</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer select-none">
                                <input type="checkbox" checked={createCashTx} onChange={e => setCreateCashTx(e.target.checked)} className="sr-only peer" />
                                <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-[28px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-500"></div>
                            </label>
                        </div>

                        {createCashTx && (
                            <div className="pt-6 mt-6 border-t border-primary-500/10 animate-fade-in space-y-2">
                                <label className={labelStyle}>Origin / Target Node</label>
                                <div className={SELECT_WRAPPER_STYLE}>
                                    <select id="cash-account" value={cashAccountId} onChange={e => setCashAccountId(e.target.value)} className={`${SELECT_STYLE} h-14 font-black uppercase tracking-tight`} required>
                                        <option value="" disabled className="text-gray-400">SELECT LIQUIDITY NODE...</option>
                                        {Object.entries(groupedCashAccounts).map(([type, group]) => (
                                            <optgroup key={type} label={type} className="font-black uppercase tracking-widest bg-gray-50 dark:bg-dark-bg p-2 text-[10px]">
                                                {group.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                            </optgroup>
                                        ))}
                                    </select>
                                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">account_balance_wallet</span></div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                
                <div className="flex justify-end gap-3 pt-6 border-t border-black/5 dark:border-white/5">
                    <button type="button" onClick={onClose} className={`${BTN_SECONDARY_STYLE} h-12 px-8 uppercase tracking-widest text-[10px] font-black`}>Retract</button>
                    <button type="submit" className={`${BTN_PRIMARY_STYLE} h-12 px-10 gap-3 group animate-glow uppercase tracking-widest text-[10px] font-black`}>
                        {isEditing ? 'Commit Changes' : 'Execute Order'}
                        <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">rocket_launch</span>
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default AddInvestmentTransactionModal;
