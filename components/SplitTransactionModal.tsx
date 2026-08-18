import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Transaction, Category } from '../types';
import { formatCurrency } from '../utils';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE } from '../constants';
import Icon from './ui/Icon';

interface SplitTransactionModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onSave: (updatedParent: Transaction, subTransactions: Transaction[]) => void;
  transaction: Transaction;
  incomeCategories: Category[];
  expenseCategories: Category[];
}

interface SplitItem {
  id: string;
  amount: string;
  category: string;
  description: string;
}

const SplitTransactionModal: React.FC<SplitTransactionModalProps> = ({
  isOpen = true,
  onClose,
  onSave,
  transaction,
  incomeCategories,
  expenseCategories,
}) => {
  const [splits, setSplits] = useState<SplitItem[]>([
    { id: '1', amount: (Math.abs(transaction.amount) / 2).toFixed(2), category: transaction.category, description: `${transaction.description} (Part 1)` },
    { id: '2', amount: (Math.abs(transaction.amount) / 2).toFixed(2), category: transaction.category, description: `${transaction.description} (Part 2)` },
  ]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 20);
    return () => clearTimeout(timer);
  }, []);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 250);
  };

  const allCategories = useMemo(() => [...incomeCategories, ...expenseCategories], [incomeCategories, expenseCategories]);
  const flatCategories = useMemo(() => {
    const flatten = (cats: Category[]): Category[] => {
      let res: Category[] = [];
      cats.forEach(c => {
        res.push(c);
        if (c.subCategories) res = res.concat(flatten(c.subCategories));
      });
      return res;
    };
    return flatten(allCategories);
  }, [allCategories]);

  const totalAmount = Math.abs(transaction.amount);
  const currentTotal = splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  const remaining = totalAmount - currentTotal;

  const handleAddSplit = () => {
    setSplits([...splits, { id: Date.now().toString(), amount: '0', category: '', description: '' }]);
  };

  const handleRemoveSplit = (id: string) => {
    if (splits.length <= 1) return;
    setSplits(splits.filter(s => s.id !== id));
  };

  const handleUpdateSplit = (id: string, updates: Partial<SplitItem>) => {
    setSplits(splits.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleSave = () => {
    if (Math.abs(remaining) > 0.01) {
      alert(`The split amounts must sum up to the original amount (${formatCurrency(totalAmount, transaction.currency)}). Remaining: ${formatCurrency(remaining, transaction.currency)}`);
      return;
    }

    const updatedParent: Transaction = {
      ...transaction,
      isSplitParent: true,
    };

    const subTransactions: Transaction[] = splits.map((s, index) => ({
      ...transaction,
      id: `split-${transaction.id}-${index}-${Date.now()}`,
      parentTransactionId: transaction.id,
      isSplitParent: false,
      isCombinedParent: false,
      amount: transaction.amount >= 0 ? parseFloat(s.amount) || 0 : -(parseFloat(s.amount) || 0),
      category: s.category || transaction.category,
      description: s.description?.trim() || `${transaction.description} (Part ${index + 1})`,
    }));

    onSave(updatedParent, subTransactions);
    handleClose();
  };

  const content = (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Sidebar Drawer */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div 
          className={`w-screen max-w-xl bg-light-card dark:bg-dark-card shadow-2xl border-l border-black/10 dark:border-white/10 flex flex-col transform transition-transform duration-300 ease-out ${
            isVisible ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Header */}
          <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-primary-500/5 to-transparent">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0 border border-primary-500/20 shadow-xs">
                <Icon name="call_split" className="text-2xl" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight truncate">
                  Split Transaction
                </h2>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5 font-medium">
                  Divide transaction across categories
                </p>
              </div>
            </div>
            <button 
              onClick={handleClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
              aria-label="Close drawer"
            >
              <Icon name="close" className="text-lg" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

              {/* Transaction Summary Card */}
              <div className="p-5 rounded-3xl bg-light-fill dark:bg-dark-fill/50 border border-black/5 dark:border-white/5 flex items-center justify-between">
                <div className="min-w-0 flex-1 pr-4">
                  <span className="text-2xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70 block mb-1">
                    Original Entry
                  </span>
                  <p className="font-bold text-base text-light-text dark:text-dark-text truncate">
                    {transaction.description}
                  </p>
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5">
                    {transaction.category}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-black tabular-nums text-light-text dark:text-dark-text">
                    {formatCurrency(totalAmount, transaction.currency)}
                  </p>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold mt-1 ${
                    Math.abs(remaining) < 0.01 
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                  }`}>
                    {Math.abs(remaining) < 0.01 ? 'Fully Allocated' : `Remaining: ${formatCurrency(remaining, transaction.currency)}`}
                  </span>
                </div>
              </div>

              {/* Split Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                    Split Allocations ({splits.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddSplit}
                    className="text-xs font-bold text-primary-500 hover:text-primary-600 flex items-center gap-1"
                  >
                    <Icon name="add" className="text-sm" />
                    <span>Add Split</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {splits.map((split, index) => (
                    <div 
                      key={split.id} 
                      className="p-4 rounded-2xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-sm space-y-3 relative group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-2xs font-bold uppercase tracking-wider text-primary-500">
                          Part {index + 1}
                        </span>
                        {splits.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSplit(split.id)}
                            className="text-rose-500 hover:bg-rose-500/10 p-1 rounded-lg transition-colors"
                            title="Remove split"
                          >
                            <Icon name="delete" className="text-base" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-2xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                            Description
                          </label>
                          <input
                            type="text"
                            value={split.description}
                            onChange={e => handleUpdateSplit(split.id, { description: e.target.value })}
                            placeholder={`Split ${index + 1}`}
                            className={`${INPUT_BASE_STYLE} h-11 text-xs`}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-2xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                            Category
                          </label>
                          <div className={SELECT_WRAPPER_STYLE}>
                            <select
                              value={split.category}
                              onChange={e => handleUpdateSplit(split.id, { category: e.target.value })}
                              className={`${SELECT_STYLE} h-11 text-xs font-semibold`}
                            >
                              <option value="">Select Category</option>
                              {flatCategories.map(cat => (
                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                              ))}
                            </select>
                            <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-2xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                          Amount
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">€</span>
                          <input
                            type="number"
                            step="0.01"
                            value={split.amount}
                            onChange={e => handleUpdateSplit(split.id, { amount: e.target.value })}
                            className={`${INPUT_BASE_STYLE} pl-8 h-11 text-sm font-bold font-mono`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Sticky Bottom Actions */}
            <div className="p-6 border-t border-black/5 dark:border-white/5 bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-md flex items-center justify-between gap-3">
              <button 
                type="button" 
                onClick={handleClose} 
                className={`${BTN_SECONDARY_STYLE} h-12 px-6 text-xs font-bold uppercase tracking-wider`}
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleSave} 
                disabled={Math.abs(remaining) > 0.01}
                className={`${BTN_PRIMARY_STYLE} h-12 px-8 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-primary-500/20 active:scale-95 disabled:opacity-50`}
              >
                <span>Confirm Split</span>
                <Icon name="check" className="text-base" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default SplitTransactionModal;
