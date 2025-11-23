import React, { useMemo } from 'react';
import { Category, DisplayTransaction } from '../types';
import Card from './Card';
import { formatCurrency, convertToEur, parseDateAsUTC } from '../utils';

interface TransactionListProps {
  transactions: DisplayTransaction[];
  allCategories: Category[];
  onTransactionClick?: (transaction: DisplayTransaction) => void;
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
    return parseDateAsUTC(dateString).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
  };

  const preparedTransactions = useMemo(
    () =>
      transactions.map((tx) => {
        const isTransfer = tx.isTransfer;
        const description = isTransfer ? `${tx.fromAccountName} → ${tx.toAccountName}` : tx.description;
        const amountDisplay = isTransfer
          ? formatCurrency(tx.amount, tx.currency)
          : formatCurrency(convertToEur(tx.amount, tx.currency), 'EUR');
        const icon = getIconForCategory(tx.category);
        const formattedDate = formatDate(tx.date);

        return { tx, description, amountDisplay, icon, isTransfer, formattedDate };
      }),
    [transactions, allCategories]
  );

  return (
      <ul className="space-y-2 h-full">
        {preparedTransactions.map(({ tx, description, amountDisplay, icon, isTransfer, formattedDate }) => {
          return (
            <li
              key={tx.id}
              className="flex items-center justify-between group cursor-pointer hover:bg-light-fill dark:hover:bg-dark-fill p-2 -m-2 rounded-lg transition-all duration-200 hover:shadow-sm"
              onClick={() => onTransactionClick?.(tx)}
            >
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-light-fill dark:bg-dark-fill flex items-center justify-center">
                  <span className={`material-symbols-outlined ${isTransfer ? 'text-light-text-secondary dark:text-dark-text-secondary' : 'text-primary-500'}`}>
                      {isTransfer ? 'swap_horiz' : icon}
                  </span>
                  </div>
                  <div className="ml-4">
                    <p className="text-base font-medium text-light-text dark:text-dark-text">{description}</p>
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{formattedDate}</p>
                  </div>
                </div>
              <div className="flex items-center gap-2">
                <p
                  className={`text-base font-semibold ${
                    isTransfer ? 'text-light-text dark:text-dark-text' : (tx.type === 'income' ? 'text-semantic-green' : 'text-semantic-red')
                  }`}
                >
                  {amountDisplay}
                </p>
                <span className="material-symbols-outlined text-light-text-secondary dark:text-dark-text-secondary opacity-0 group-hover:opacity-100 transition-opacity">
                  chevron_right
                </span>
              </div>
            </li>
          )
        })}
      </ul>
  );
};

export default TransactionList;