
import React from 'react';
import { Account, DisplayTransaction, Category } from '../types';
import { formatCurrency, convertToEur } from '../utils';
import Card from './Card';
import CurrentBalanceCard from './CurrentBalanceCard';
import TransactionList from './TransactionList';
import { BTN_PRIMARY_STYLE, ACCOUNT_TYPE_STYLES } from '../constants';

interface GeneralAccountViewProps {
  account: Account;
  displayTransactionsList: DisplayTransaction[];
  allCategories: Category[];
  onAddTransaction: () => void;
  onTransactionClick: (tx: DisplayTransaction) => void;
  onBack: () => void;
}

const GeneralAccountView: React.FC<GeneralAccountViewProps> = ({
  account,
  displayTransactionsList,
  allCategories,
  onAddTransaction,
  onTransactionClick,
  onBack
}) => {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4 w-full">
          <button onClick={onBack} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex items-center gap-4 w-full">
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${ACCOUNT_TYPE_STYLES[account.type]?.color || 'bg-gray-200 text-gray-600'} bg-opacity-10 border border-current`}>
              <span className="material-symbols-outlined text-4xl">{account.icon || 'wallet'}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">{account.name}</h1>
              <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                <span>{account.type}</span>
                {account.last4 && <><span>•</span><span className="font-mono">**** {account.last4}</span></>}
              </div>
            </div>
            <div className="ml-auto">
              <button onClick={onAddTransaction} className={BTN_PRIMARY_STYLE}>Add Transaction</button>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CurrentBalanceCard balance={account.balance} currency={account.currency} />
        <Card className="flex flex-col justify-between">
          <div>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary font-medium">Total Income</p>
            {/* Placeholder calculation - ideally passed from parent or calculated here if performance allows */}
            <p className="text-2xl font-bold text-green-500 mt-1">{formatCurrency(convertToEur(12345, account.currency), 'EUR')}</p>
          </div>
          <p className="text-xs text-right mt-2 text-light-text-secondary">Last 12 months</p>
        </Card>
        <Card className="flex flex-col justify-between">
          <div>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary font-medium">Total Expenses</p>
            <p className="text-2xl font-bold text-red-500 mt-1">{formatCurrency(convertToEur(5432, account.currency), 'EUR')}</p>
          </div>
          <p className="text-xs text-right mt-2 text-light-text-secondary">Last 12 months</p>
        </Card>
      </div>

      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-light-text dark:text-dark-text">Transaction History</h3>
        </div>
        <Card className="p-0 overflow-hidden">
          <TransactionList transactions={displayTransactionsList} allCategories={allCategories} onTransactionClick={onTransactionClick} />
        </Card>
      </div>
    </div>
  );
};

export default GeneralAccountView;
