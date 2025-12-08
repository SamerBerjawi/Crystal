
import React from 'react';
import Modal from './Modal';
import { Transaction, Account } from '../types';
import { formatCurrency, parseLocalDate } from '../utils';

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  transactions: Transaction[];
  accounts: Account[];
}

const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({ isOpen, onClose, title, transactions, accounts }) => {
  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    return parseLocalDate(dateString).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };
  
  if (transactions.length === 1) {
    const tx = transactions[0];
    const account = accounts.find(a => a.id === tx.accountId);

    const DetailRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
        <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4 items-center">
            <dt className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">{label}</dt>
            <dd className="mt-1 text-sm text-light-text dark:text-dark-text sm:mt-0 sm:col-span-2 text-right break-words">{value}</dd>
        </div>
    );

    return (
      <Modal onClose={onClose} title={title}>
        <div className="divide-y divide-black/10 dark:divide-white/10">
            <DetailRow 
                label="Amount" 
                value={
                    <span className={`font-semibold text-lg ${tx.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                        {formatCurrency(tx.amount, tx.currency)}
                    </span>
                }
            />
            <DetailRow label="Description" value={tx.description} />
            {tx.merchant && <DetailRow label="Merchant" value={tx.merchant} />}
            <DetailRow label="Date" value={formatDate(tx.date)} />
            <DetailRow label="Category" value={tx.category} />
            <DetailRow label="Account" value={account?.name || 'Unknown'} />
            <DetailRow label="Type" value={<span className="capitalize">{tx.type}</span>} />
             {tx.transferId && <DetailRow label="Transfer ID" value={<span className="font-mono text-xs">{tx.transferId}</span>} />}
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title={title}>
      <div className="max-h-[60vh] overflow-y-auto pr-2">
        {transactions.length > 0 ? (
          <ul className="space-y-4">
            {transactions.sort((a,b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime()).map((tx) => {
              const account = accounts.find(a => a.id === tx.accountId);
              return (
              <li key={tx.id} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                    tx.type === 'income' ? 'bg-green-100 dark:bg-green-900/50' : 'bg-red-100 dark:bg-red-900/50'
                  }`}>
                    <span className={`material-symbols-outlined ${
                      tx.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>{tx.transferId ? 'swap_horiz' : (tx.type === 'income' ? 'add' : 'remove')}</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-light-text dark:text-dark-text">{tx.description}</p>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{formatDate(tx.date)} &bull; {account?.name || tx.category}</p>
                  </div>
                </div>
                <p
                  className={`text-sm font-semibold whitespace-nowrap ${
                    tx.type === 'income' ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  {formatCurrency(tx.amount, tx.currency)}
                </p>
              </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-center py-12 text-light-text-secondary dark:text-dark-text-secondary">
            <p>No transactions found for this selection.</p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default TransactionDetailModal;
