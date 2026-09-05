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
        {/* Live Summary Metric Card */}
        <div className="p-4 rounded-2xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-sm flex items-center justify-between">
          <div className="min-w-0 flex-1 pr-3">
            <span className="text-2xs font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400 block mb-0.5">Combining {transactionsToCombine.length} Items</span>
            <p className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary truncate">
              A combined parent transaction will group these items as indented sub-transactions.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-mono font-bold text-light-text dark:text-dark-text">{formatCurrency(Math.abs(totalAmount), currency)}</p>
            <span className={`text-2xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full inline-block mt-1 ${totalAmount >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'}`}>
              {totalAmount >= 0 ? 'Net Income' : 'Net Expense'}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Combined Transaction Title
          </label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className={`${INPUT_BASE_STYLE} h-14 !text-xl font-bold`}
            placeholder="e.g., Combined Uber Trips"
            autoFocus
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">Category</label>
              <div className={SELECT_WRAPPER_STYLE}>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className={`${SELECT_STYLE} h-12 pr-8 font-bold`}
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
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">Account</label>
              <div className={SELECT_WRAPPER_STYLE}>
                <select
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  className={`${SELECT_STYLE} h-12 pr-8 font-bold`}
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
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className={`${INPUT_BASE_STYLE} h-12`}
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-bold tracking-wider text-slate-700 dark:text-slate-300 uppercase mb-2">
            Items to combine ({transactionsToCombine.length})
          </p>
          <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {transactionsToCombine.map((tx) => (
              <div key={tx.id} className="flex justify-between items-center p-3.5 rounded-2xl border border-black/5 dark:border-white/5 bg-light-fill dark:bg-dark-fill/50 text-sm">
                <div>
                  <p className="font-bold text-light-text dark:text-dark-text text-xs">{tx.description}</p>
                  <p className="text-2xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">{tx.category} • {tx.date}</p>
                </div>
                <p className={`font-mono font-bold text-xs ${tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {formatCurrency(tx.amount, tx.currency)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-black/5 dark:border-white/5">
          <button onClick={onClose} className={`${BTN_SECONDARY_STYLE} h-11 px-6 text-xs font-bold uppercase tracking-wider`}>Cancel</button>
          <button onClick={handleSave} className={`${BTN_PRIMARY_STYLE} h-11 px-6 text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary-500/20 active:scale-95`}>
            Confirm Combine
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default CombineTransactionsModal;
