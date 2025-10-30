import React from 'react';
import { Transaction, Category } from '../types';
import Card from './Card';
import { formatCurrency, convertToEur } from '../utils';

interface TransactionListProps {
  transactions: Transaction[];
  allCategories: Category[];
  onTransactionClick?: (transaction: Transaction) => void;
}

const findCategoryDetails = (name: string, categories: Category[]): { icon?: string; parentIcon?: string } => {
    for (const cat of categories) {
        if (cat.name === name) return { icon: cat.icon };
        if (cat.subCategories.length > 0) {
            const found = findCategoryDetails(name, cat.subCategories);
            if (found.icon) return { icon: found.icon, parentIcon: cat.icon };
        }
    }
    return {};
};


const TransactionList: React.FC<TransactionListProps> = ({ transactions, allCategories, onTransactionClick }) => {
  
  const getIconForCategory = (categoryName: string) => {
    if (categoryName === 'Transfer') return 'swap_horiz';
    const { icon, parentIcon } = findCategoryDetails(categoryName, allCategories);
    return icon || parentIcon || 'sell';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString.replace(/-/g, '/'));
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
      <ul className="space-y-2 h-full">
        {transactions.map((tx) => (
          <li 
            key={tx.id} 
            className="flex items-center justify-between group cursor-pointer hover:bg-light-fill dark:hover:bg-dark-fill p-2 -m-2 rounded-lg transition-colors duration-200"
            onClick={() => onTransactionClick?.(tx)}
          >
            <div className="flex items-center">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-light-fill dark:bg-dark-fill flex items-center justify-center">
                <span className="material-symbols-outlined text-primary-500">
                    {getIconForCategory(tx.category)}
                </span>
              </div>
              <div className="ml-4">
                <p className="text-base font-medium text-light-text dark:text-dark-text">{tx.description}</p>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{formatDate(tx.date)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <p
                className={`text-base font-semibold ${
                  tx.type === 'income' ? 'text-semantic-green' : 'text-semantic-red'
                }`}
              >
                {formatCurrency(convertToEur(tx.amount, tx.currency), 'EUR')}
              </p>
              <span className="material-symbols-outlined text-light-text-secondary dark:text-dark-text-secondary opacity-0 group-hover:opacity-100 transition-opacity">
                chevron_right
              </span>
            </div>
          </li>
        ))}
      </ul>
  );
};

export default TransactionList;