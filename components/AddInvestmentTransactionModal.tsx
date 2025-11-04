import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import { Account, InvestmentTransaction, Transaction, AccountType, InvestmentSubType } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, INVESTMENT_SUB_TYPES } from '../constants';
import { formatCurrency } from '../utils';
import { v4 as uuidv4 } from 'uuid';

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
    const [date, setDate] = useState(isEditing ? transactionToEdit.date : new Date().toISOString().split('T')[0]);
    const [createCashTx, setCreateCashTx] = useState(!isEditing);
    const [cashAccountId, setCashAccountId] = useState(cashAccounts.length > 0 ? cashAccounts[0].id : '');
    const [newAccountSubType, setNewAccountSubType] = useState<InvestmentSubType>('Stock');

    const isNewSymbol = useMemo(() => {
        if (isEditing || !symbol) return false;
        return !(accounts || []).some(acc => acc.symbol?.toUpperCase() === symbol.toUpperCase());
    }, [symbol, accounts, isEditing]);

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
                balance: 0, // Will be dynamically calculated
                currency: 'EUR',
            };
        }

        onSave(invTxData, cashTxData, newAccountData);
        onClose();
    };

    const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";
    const modalTitle = isEditing ? 'Edit Investment Transaction' : 'Add Investment Transaction';
    const totalValue = (parseFloat(quantity) || 0) * (parseFloat(price) || 0);

    return (
        <Modal onClose={onClose} title={modalTitle}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex bg-light-bg dark:bg-dark-bg p-1 rounded-lg">
                    <button type="button" onClick={() => setType('buy')} className={`w-full py-2 rounded text-sm font-semibold ${type === 'buy' ? 'bg-green-500 text-white' : ''}`}>Buy</button>
                    <button type="button" onClick={() => setType('sell')} className={`w-full py-2 rounded text-sm font-semibold ${type === 'sell' ? 'bg-red-500 text-white' : ''}`}>Sell</button>
                </div>
                
                <div>
                    <label htmlFor="inv-symbol" className={labelStyle}>Symbol / Ticker</label>
                    <input id="inv-symbol" type="text" value={symbol} onChange={e => setSymbol(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g., AAPL" required />
                </div>

                {isNewSymbol && (
                    <div className="p-4 bg-primary-500/10 rounded-lg space-y-4">
                        <h4 className="font-semibold text-primary-700 dark:text-primary-200">New Asset Detected</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="inv-name" className={labelStyle}>Asset Name</label>
                                <input id="inv-name" type="text" value={name} onChange={e => setName(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g., Apple Inc." required />
                            </div>
                            <div>
                                <label htmlFor="inv-subtype" className={labelStyle}>Investment Type</label>
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

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="inv-quantity" className={labelStyle}>Quantity</label>
                        <input id="inv-quantity" type="number" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} className={INPUT_BASE_STYLE} placeholder="0.00" required />
                    </div>
                    <div>
                        <label htmlFor="inv-price" className={labelStyle}>Price per Unit</label>
                        <input id="inv-price" type="number" step="any" value={price} onChange={e => setPrice(e.target.value)} className={INPUT_BASE_STYLE} placeholder="0.00" required />
                    </div>
                </div>

                 <div className="p-4 rounded-lg bg-light-bg dark:bg-dark-bg text-center">
                    <p className={labelStyle}>Total Value</p>
                    <p className="text-2xl font-bold">{formatCurrency(totalValue, 'EUR')}</p>
                </div>

                <div>
                    <label htmlFor="inv-date" className={labelStyle}>Transaction Date</label>
                    <input id="inv-date" type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT_BASE_STYLE} required />
                </div>
                
                {!isEditing && (
                    <div className="p-4 bg-black/5 dark:bg-white/5 rounded-lg space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={createCashTx} onChange={e => setCreateCashTx(e.target.checked)} className="w-4 h-4 rounded text-primary-500 focus:ring-primary-500" />
                            <span className="font-medium">Create linked cash transaction</span>
                        </label>
                        {createCashTx && (
                             <div>
                                <label htmlFor="cash-account" className={labelStyle}>Cash Account</label>
                                <div className={SELECT_WRAPPER_STYLE}>
                                    <select id="cash-account" value={cashAccountId} onChange={e => setCashAccountId(e.target.value)} className={INPUT_BASE_STYLE} required>
                                        <option value="">Select cash account</option>
                                        {cashAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                    </select>
                                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                
                <div className="flex justify-end gap-4 pt-4">
                    <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                    <button type="submit" className={BTN_PRIMARY_STYLE}>{isEditing ? 'Save Changes' : 'Add Transaction'}</button>
                </div>
            </form>
        </Modal>
    );
};

export default AddInvestmentTransactionModal;