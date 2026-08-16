
import React, { useState, useMemo } from 'react';
import Modal from './Modal';
import { Transaction, Category, Currency } from '../types';
import { formatCurrency } from '../utils';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE } from '../constants';
import Icon from './ui/Icon';

interface SplitTransactionModalProps {
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
  };

  return (
    <Modal onClose={onClose} title="Split Transaction" size="2xl">
      <div className="space-y-6">
        <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-black/5 dark:border-white/10">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1">Original Transaction</p>
              <p className="font-bold text-lg">{transaction.description}</p>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{transaction.category}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-mono font-black">{formatCurrency(totalAmount, transaction.currency)}</p>
              <p className={`text-xs font-semibold ${Math.abs(remaining) < 0.01 ? 'text-green-500' : 'text-red-500'}`}>
                {Math.abs(remaining) < 0.01 ? 'Fully Allocated' : `Remaining: ${formatCurrency(remaining, transaction.currency)}`}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {splits.map((split, index) => (
            <div key={split.id} className="grid grid-cols-12 gap-3 items-end p-3 rounded-xl border border-black/5 dark:border-white/5 bg-white dark:bg-dark-card shadow-sm relative group">
              <div className="col-span-5">
                <label className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary ml-1 mb-1 block">Description</label>
                <input
                  type="text"
                  value={split.description}
                  onChange={e => handleUpdateSplit(split.id, { description: e.target.value })}
                  placeholder={`Split ${index + 1}`}
                  className={INPUT_BASE_STYLE}
                />
              </div>
              <div className="col-span-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary ml-1 mb-1 block">Category</label>
                <div className={SELECT_WRAPPER_STYLE}>
                  <select
                    value={split.category}
                    onChange={e => handleUpdateSplit(split.id, { category: e.target.value })}
                    className={`${SELECT_STYLE} pr-8`}
                  >
                    <option value="">Select Category</option>
                    {flatCategories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                  <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                </div>
              </div>
              <div className="col-span-3 text-right">
                <label className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mr-1 mb-1 block">Amount</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={split.amount}
                    onChange={e => handleUpdateSplit(split.id, { amount: e.target.value })}
                    className={`${INPUT_BASE_STYLE} text-right font-mono font-bold`}
                  />
                </div>
              </div>
              <div className="col-span-1 flex justify-center pb-2">
                <button
                  onClick={() => handleRemoveSplit(split.id)}
                  disabled={splits.length <= 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-30"
                >
                  <Icon name="delete" className="text-lg" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-2">
          <button
            onClick={handleAddSplit}
            className="flex items-center gap-2 text-sm font-bold text-primary-500 hover:text-primary-600 transition-colors"
          >
            <Icon name="add_circle" />
            Add Split
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
            <button
              onClick={handleSave}
              className={BTN_PRIMARY_STYLE}
              disabled={Math.abs(remaining) > 0.01}
            >
              Confirm Split
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default SplitTransactionModal;
