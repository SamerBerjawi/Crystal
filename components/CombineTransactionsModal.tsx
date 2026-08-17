import React, { useState, useMemo } from 'react';
import Modal from './Modal';
import { Transaction, Category, Account } from '../types';
import { formatCurrency } from '../utils';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE } from '../constants';
import Icon from './ui/Icon';

interface CombineTransactionsModalProps {
  onClose: () => void;
  onSave: (combinedParent: Transaction, updatedSubTransactions: Transaction[]) => void;
  transactionsToCombine: Transaction[];
  incomeCategories: Category[];
  expenseCategories: Category[];
  accounts: Account[];
}

const CombineTransactionsModal: React.FC<CombineTransactionsModalProps> = ({
  onClose,
  onSave,
  transactionsToCombine,
  incomeCategories,
  expenseCategories,
  accounts,
}) => {
  const firstTx = transactionsToCombine[0];
  
  const newestDate = useMemo(() => {
    if (!transactionsToCombine.length) return new Date().toISOString().split('T')[0];
    const dates = transactionsToCombine.map(t => new Date(t.date).getTime()).filter(n => !isNaN(n));
    return dates.length ? new Date(Math.max(...dates)).toISOString().split('T')[0] : firstTx?.date || new Date().toISOString().split('T')[0];
  }, [transactionsToCombine, firstTx]);

  const totalAmount = useMemo(() => {
    return transactionsToCombine.reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [transactionsToCombine]);

  const currency = firstTx?.currency || 'EUR';

  const [description, setDescription] = useState<string>(
    transactionsToCombine.length > 1
      ? `Combined: ${transactionsToCombine[0].description} & others`
      : firstTx?.description || 'Combined Transaction'
  );
  const [category, setCategory] = useState<string>(firstTx?.category || '');
  const [date, setDate] = useState<string>(newestDate);
  const [accountId, setAccountId] = useState<string>(firstTx?.accountId || (accounts[0]?.id || ''));

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

  const handleSave = () => {
    if (!description.trim()) {
      alert('Please enter a valid description for the combined transaction.');
      return;
    }

    const combinedParentId = `combined-parent-${Date.now()}`;
    const combinedType: 'income' | 'expense' = totalAmount >= 0 ? 'income' : 'expense';

    const combinedParent: Transaction = {
      id: combinedParentId,
      accountId,
      date,
      description: description.trim(),
      amount: totalAmount,
      category: category || firstTx?.category || 'General',
      type: combinedType,
      currency,
      isCombinedParent: true,
      isSplitParent: false,
    };

    const updatedSubTransactions: Transaction[] = transactionsToCombine.map(t => ({
      ...t,
      parentTransactionId: combinedParentId,
      isCombinedParent: false,
    }));

    onSave(combinedParent, updatedSubTransactions);
  };

  return (
    <Modal onClose={onClose} title="Combine Transactions" size="xl">
      <div className="space-y-6">
        <div className="bg-primary-500/5 dark:bg-primary-500/10 p-4 rounded-2xl border border-primary-500/10 flex justify-between items-center">
          <div>
            <p className="text-xs font-black tracking-widest text-primary-600 dark:text-primary-400 mb-1">Combining {transactionsToCombine.length} Items</p>
            <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
              A combined parent transaction will represent these items as indented sub-transactions.
            </p>
          </div>
          <div className="text-right shrink-0 ml-4">
            <p className="text-2xl font-mono font-bold">{formatCurrency(Math.abs(totalAmount), currency)}</p>
            <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md ${totalAmount >= 0 ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
              {totalAmount >= 0 ? 'Net Income' : 'Net Expense'}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xs font-semibold tracking-wider text-light-text-secondary dark:text-dark-text-secondary uppercase">
            Combined Parent Details
          </p>
          
          <div>
            <label className="block text-xs font-semibold mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className={INPUT_BASE_STYLE}
              placeholder="e.g., Combined Uber Trips"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Category</label>
              <div className={SELECT_WRAPPER_STYLE}>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
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

            <div>
              <label className="block text-xs font-semibold mb-1">Account</label>
              <div className={SELECT_WRAPPER_STYLE}>
                <select
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  className={`${SELECT_STYLE} pr-8`}
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
                <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className={INPUT_BASE_STYLE}
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-bold tracking-wider text-light-text-secondary dark:text-dark-text-secondary uppercase mb-2">
            Items to combine ({transactionsToCombine.length})
          </p>
          <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {transactionsToCombine.map((tx) => (
              <div key={tx.id} className="flex justify-between items-center p-3 rounded-xl border border-black/5 dark:border-white/5 bg-gray-50 dark:bg-white/5 text-sm">
                <div>
                  <p className="font-semibold text-light-text dark:text-dark-text">{tx.description}</p>
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{tx.category} • {tx.date}</p>
                </div>
                <p className={`font-mono font-bold ${tx.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(tx.amount, tx.currency)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
          <button onClick={handleSave} className={BTN_PRIMARY_STYLE}>
            Confirm Combine
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default CombineTransactionsModal;
