
import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import { Account, InvestmentTransaction, Transaction, InvestmentSubType } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, INVESTMENT_SUB_TYPES, ALL_ACCOUNT_TYPES } from '../constants';
import { formatCurrency, toLocalISOString } from '../utils';

interface AddInvestmentTransactionModalProps {
  onClose: () => void;
  onSave: (invTx: Omit<InvestmentTransaction, 'id'> & { id?: string }, cashTx?: Omit<Transaction, 'id'>, newAccount?: Omit<Account, 'id'>) => void;
  accounts: Account[];
  cashAccounts: Account[];
  transactionToEdit?: InvestmentTransaction | null;
}

const AddInvestmentTransactionModal: React.FC<AddInvestmentTransactionModalProps> = ({ onClose, onSave, accounts, cashAccounts, transactionToEdit }) => {
    const isEditing = !!transactionToEdit;
    
    const [type, setType] = useState<'buy' | 'sell'>(isEditing ? transactionToEdit.type : 'buy');
    const [symbol, setSymbol] = useState(isEditing ? transactionToEdit.symbol : '');
    const [name, setName] = useState(isEditing ? transactionToEdit.name : '');
    const [quantity, setQuantity] = useState(isEditing ? String(transactionToEdit.quantity) : '');
    const [price, setPrice] = useState(isEditing ? String(transactionToEdit.price) : '');
    const [date, setDate] = useState(isEditing ? transactionToEdit.date : toLocalISOString(new Date()));
    const [createCashTx, setCreateCashTx] = useState(!isEditing);
    const [cashAccountId, setCashAccountId] = useState(cashAccounts.length > 0 ? cashAccounts[0].id : '');
    const [newAccountSubType, setNewAccountSubType] = useState<InvestmentSubType>('Stock');

    const isNewSymbol = useMemo(() => {
        if (isEditing || !symbol) return false;
        return !(accounts || []).some(acc => acc.symbol?.toUpperCase() === symbol.toUpperCase());
    }, [symbol, accounts, isEditing]);

    const groupedCashAccounts = useMemo(() => {
        const groups: Record<string, Account[]> = {};
        cashAccounts.forEach(acc => {
            if (!groups[acc.type]) groups[acc.type] = [];
            groups[acc.type].push(acc);
        });
        return groups;
    }, [cashAccounts]);

    useEffect(() => {
        if (!isEditing && symbol && accounts) {
            const existingAccount = accounts.find(acc => acc.symbol?.toUpperCase() === symbol.toUpperCase());
            if (existingAccount) {
                setName(existingAccount.name);
            }
        }
    }, [symbol, accounts, isEditing]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
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
            <form onSubmit={handleSubmit} className="space-y-6 pb-2">
                
                {/* 1. Transaction Type Toggle */}
                <div className="flex justify-center -mt-2">
                    <div className="bg-gray-100 dark:bg-white/5 p-1 rounded-2xl inline-flex relative shadow-inner border border-black/5 dark:border-white/5">
                        <button 
                            type="button" 
                            onClick={() => setType('buy')} 
                            className={`px-8 py-2 text-sm font-bold rounded-xl transition-all duration-200 z-10 ${type === 'buy' ? 'bg-green-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            Buy
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setType('sell')} 
                            className={`px-8 py-2 text-sm font-bold rounded-xl transition-all duration-200 z-10 ${type === 'sell' ? 'bg-red-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            Sell
                        </button>
                    </div>
                </div>
                
                {/* 2. Hero Amount (Total Value) */}
                <div className="flex flex-col items-center justify-center pt-2 pb-4">
                    <div className="text-center">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">Estimated Total</p>
                        <div className="flex items-baseline justify-center gap-1">
                            <span className="text-4xl font-light text-light-text-secondary dark:text-dark-text-secondary">€</span>
                            <span className="text-7xl font-bold text-light-text dark:text-dark-text tracking-tighter">
                                {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 3. Main Form Grid */}
                <div className="space-y-6">
                    <div className="bg-gray-50 dark:bg-white/5 p-6 rounded-2xl border border-black/5 dark:border-white/5 grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                        <div className="absolute -top-3 left-6 px-2 bg-light-card dark:bg-dark-card text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] border border-black/5 dark:border-white/5 rounded-md">Asset Details</div>

                        {/* Symbol */}
                        <div className="md:col-span-1">
                            <label htmlFor="inv-symbol" className={labelStyle}>Symbol / Ticker</label>
                            <div className="relative group">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg group-focus-within:text-primary-500">search</span>
                                <input 
                                    id="inv-symbol" 
                                    type="text" 
                                    value={symbol} 
                                    onChange={e => setSymbol(e.target.value)} 
                                    className={`${INPUT_BASE_STYLE} uppercase pl-10 font-mono h-11 tracking-widest`} 
                                    placeholder="Ticker..." 
                                    required 
                                    autoFocus 
                                />
                            </div>
                        </div>

                        {/* Date */}
                        <div className="md:col-span-1">
                            <label htmlFor="inv-date" className={labelStyle}>Date</label>
                            <div className="relative group">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg group-focus-within:text-primary-500">calendar_today</span>
                                <input id="inv-date" type="date" value={date} onChange={e => setDate(e.target.value)} className={`${INPUT_BASE_STYLE} pl-10 h-11`} required />
                            </div>
                        </div>

                        {/* New Asset Info */}
                        {isNewSymbol && (
                            <div className="md:col-span-2 p-4 bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-800/20 rounded-xl space-y-4 animate-fade-in-up">
                                <h4 className="font-bold text-primary-700 dark:text-primary-300 text-[11px] flex items-center gap-2 uppercase tracking-wider">
                                    <span className="material-symbols-outlined text-lg">new_label</span>
                                    Register New Asset
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="inv-name" className={labelStyle}>Company / Fund Name</label>
                                        <input id="inv-name" type="text" value={name} onChange={e => setName(e.target.value)} className={`${INPUT_BASE_STYLE} h-10`} placeholder="e.g., Apple Inc." required />
                                    </div>
                                    <div>
                                        <label htmlFor="inv-subtype" className={labelStyle}>Asset Category</label>
                                        <div className={SELECT_WRAPPER_STYLE}>
                                            <select id="inv-subtype" value={newAccountSubType} onChange={e => setNewAccountSubType(e.target.value as InvestmentSubType)} className={`${INPUT_BASE_STYLE} h-10 pl-4`} required>
                                                {INVESTMENT_SUB_TYPES.map(subType => (
                                                    <option key={subType} value={subType}>{subType}</option>
                                                ))}
                                            </select>
                                            <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Transaction Details */}
                        <div className="md:col-span-2 grid grid-cols-2 gap-6 pt-2">
                            <div>
                                <label htmlFor="inv-quantity" className={labelStyle}>Quantity</label>
                                <div className="relative group">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg group-focus-within:text-primary-500">shopping_cart</span>
                                    <input id="inv-quantity" type="number" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} className={`${INPUT_BASE_STYLE} font-mono pl-10 h-11`} placeholder="0.0000" required />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="inv-price" className={labelStyle}>Price per Unit</label>
                                <div className="relative group">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">€</span>
                                    <input id="inv-price" type="number" step="any" value={price} onChange={e => setPrice(e.target.value)} className={`${INPUT_BASE_STYLE} font-mono pl-8 h-11`} placeholder="0.00" required />
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Funding Section */}
                    {!isEditing && (
                        <div className={`p-6 rounded-2xl border transition-all duration-300 ${createCashTx ? 'bg-primary-50 dark:bg-primary-900/5 border-primary-100 dark:border-primary-800/20' : 'bg-transparent border-black/5 dark:border-white/5 opacity-60'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                                        <span className="material-symbols-outlined">payments</span>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-primary-900 dark:text-primary-300">Funding Source</h4>
                                        <p className="text-[10px] text-primary-700 dark:text-primary-500 font-medium tracking-wide">Sync with cash account</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer select-none">
                                    <input type="checkbox" checked={createCashTx} onChange={e => setCreateCashTx(e.target.checked)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                                </label>
                            </div>

                            {createCashTx && (
                                <div className="animate-fade-in pt-4 border-t border-primary-200 dark:border-primary-800/20">
                                    <label htmlFor="cash-account" className={labelStyle}>Select Funding Account</label>
                                    <div className={SELECT_WRAPPER_STYLE}>
                                        <select id="cash-account" value={cashAccountId} onChange={e => setCashAccountId(e.target.value)} className={`${INPUT_BASE_STYLE} h-11 pl-4`} required>
                                            <option className="bg-white dark:bg-gray-900 text-black dark:text-white" value="">Select cash account</option>
                                            {ALL_ACCOUNT_TYPES.map(type => {
                                                const group = groupedCashAccounts[type];
                                                if (!group || group.length === 0) return null;
                                                return (
                                                    <optgroup key={type} label={type} className="bg-gray-100 dark:bg-gray-800 font-bold text-[10px] uppercase tracking-wider text-gray-500">
                                                        {group.map(acc => <option key={acc.id} value={acc.id} className="bg-white dark:bg-gray-900 text-sm font-medium py-2">{acc.name}</option>)}
                                                    </optgroup>
                                                );
                                            })}
                                        </select>
                                        <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                <div className="flex justify-end gap-3 pt-6 border-t border-black/5 dark:border-white/5">
                    <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Discard</button>
                    <button type="submit" className={`${BTN_PRIMARY_STYLE} h-11 px-8`}>{isEditing ? 'Save Changes' : 'Execute Trade'}</button>
                </div>
            </form>
        </Modal>
    );
};

export default AddInvestmentTransactionModal;
