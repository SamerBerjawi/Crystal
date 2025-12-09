
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

    const labelStyle = "block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1.5";
    const modalTitle = isEditing ? 'Edit Transaction' : 'Add Transaction';
    const totalValue = (parseFloat(quantity) || 0) * (parseFloat(price) || 0);

    return (
        <Modal onClose={onClose} title={modalTitle}>
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Transaction Type Toggle */}
                <div className="flex bg-gray-100 dark:bg-white/10 p-1 rounded-xl">
                    <button 
                        type="button" 
                        onClick={() => setType('buy')} 
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${type === 'buy' ? 'bg-green-500 text-white shadow-md' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    >
                        Buy
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setType('sell')} 
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${type === 'sell' ? 'bg-red-500 text-white shadow-md' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    >
                        Sell
                    </button>
                </div>
                
                {/* Asset Identifier */}
                <div>
                    <label htmlFor="inv-symbol" className={labelStyle}>Symbol / Ticker</label>
                    <div className="relative">
                        <input 
                            id="inv-symbol" 
                            type="text" 
                            value={symbol} 
                            onChange={e => setSymbol(e.target.value)} 
                            className={`${INPUT_BASE_STYLE} uppercase pl-10 font-mono`} 
                            placeholder="AAPL" 
                            required 
                            autoFocus 
                        />
                         <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none">search</span>
                    </div>
                </div>

                {isNewSymbol && (
                    <div className="p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-900/50 rounded-xl space-y-4 animate-fade-in-up">
                        <h4 className="font-bold text-primary-700 dark:text-primary-200 text-sm flex items-center gap-2">
                             <span className="material-symbols-outlined text-lg">new_label</span>
                            New Asset Detected
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="inv-name" className={labelStyle}>Asset Name</label>
                                <input id="inv-name" type="text" value={name} onChange={e => setName(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g., Apple Inc." required />
                            </div>
                            <div>
                                <label htmlFor="inv-subtype" className={labelStyle}>Asset Type</label>
                                <div className={SELECT_WRAPPER_STYLE}>
                                    <select id="inv-subtype" value={newAccountSubType} onChange={e => setNewAccountSubType(e.target.value as InvestmentSubType)} className={INPUT_BASE_STYLE} required>
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

                {/* Amount Inputs */}
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="inv-quantity" className={labelStyle}>Quantity</label>
                        <input id="inv-quantity" type="number" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} className={`${INPUT_BASE_STYLE} font-mono`} placeholder="0" required />
                    </div>
                    <div>
                        <label htmlFor="inv-price" className={labelStyle}>Price per Unit</label>
                        <input id="inv-price" type="number" step="any" value={price} onChange={e => setPrice(e.target.value)} className={`${INPUT_BASE_STYLE} font-mono`} placeholder="0.00" required />
                    </div>
                </div>

                {/* Total Preview */}
                 <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-black/5 dark:border-white/5">
                    <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">Estimated Total</p>
                    <p className="text-2xl font-bold font-mono tracking-tight">{formatCurrency(totalValue, 'EUR')}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="inv-date" className={labelStyle}>Date</label>
                        <input id="inv-date" type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT_BASE_STYLE} required />
                    </div>
                </div>
                
                {!isEditing && (
                    <div className="p-4 bg-white dark:bg-black/20 rounded-xl border border-black/10 dark:border-white/10 space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={createCashTx} onChange={e => setCreateCashTx(e.target.checked)} className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500 border-gray-300" />
                            <span className="font-bold text-sm text-light-text dark:text-dark-text">Deduct from Cash Account</span>
                        </label>
                        {createCashTx && (
                             <div className="animate-fade-in-up">
                                <label htmlFor="cash-account" className={labelStyle}>Funding Account</label>
                                <div className={SELECT_WRAPPER_STYLE}>
                                    <select id="cash-account" value={cashAccountId} onChange={e => setCashAccountId(e.target.value)} className={INPUT_BASE_STYLE} required>
                                        <option value="">Select cash account</option>
                                        {ALL_ACCOUNT_TYPES.map(type => {
                                            const group = groupedCashAccounts[type];
                                            if (!group || group.length === 0) return null;
                                            return (
                                                <optgroup key={type} label={type}>
                                                    {group.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
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
                
                <div className="flex justify-end gap-3 pt-4 border-t border-black/5 dark:border-white/5">
                    <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                    <button type="submit" className={BTN_PRIMARY_STYLE}>{isEditing ? 'Save Changes' : 'Confirm Transaction'}</button>
                </div>
            </form>
        </Modal>
    );
};

export default AddInvestmentTransactionModal;
