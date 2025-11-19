
import React from 'react';
import Modal from './Modal';
import { formatCurrency } from '../utils';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';

interface ForecastItem {
    id: string;
    date: string;
    accountName: string;
    description: string;
    amount: number;
    balance: number;
    type: 'Recurring' | 'Bill/Payment' | 'Financial Goal';
    originalItem: any;
}

interface ForecastDayModalProps {
    isOpen: boolean;
    onClose: () => void;
    date: string;
    items: ForecastItem[];
    onEditItem: (item: ForecastItem) => void;
    onAddTransaction: () => void;
}

const ForecastDayModal: React.FC<ForecastDayModalProps> = ({ isOpen, onClose, date, items, onEditItem, onAddTransaction }) => {
    if (!isOpen) return null;

    const formattedDate = new Date(date.replace(/-/g, '/')).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    
    const dayTotal = items.reduce((sum, item) => sum + item.amount, 0);

    return (
        <Modal onClose={onClose} title={`Forecast Details`}>
            <div className="space-y-4">
                <div className="text-center border-b border-black/10 dark:border-white/10 pb-4">
                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">{formattedDate}</h3>
                    <p className={`text-2xl font-bold mt-1 ${dayTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(dayTotal, 'EUR', { showPlusSign: true })} <span className="text-sm font-normal text-light-text-secondary dark:text-dark-text-secondary">Net Change</span>
                    </p>
                </div>

                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                    {items.length > 0 ? (
                        items.map(item => (
                            <div 
                                key={item.id} 
                                onClick={() => onEditItem(item)}
                                className="flex items-center justify-between p-3 rounded-lg bg-light-bg dark:bg-dark-bg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                        item.type === 'Recurring' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' :
                                        item.type === 'Financial Goal' ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/50 dark:text-yellow-400' :
                                        'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400'
                                    }`}>
                                        <span className="material-symbols-outlined">
                                            {item.type === 'Recurring' ? 'repeat' : item.type === 'Financial Goal' ? 'flag' : 'receipt_long'}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm text-light-text dark:text-dark-text">{item.description}</p>
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{item.accountName} • {item.type}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`font-semibold text-sm ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {formatCurrency(item.amount, 'EUR')}
                                    </p>
                                    <span className="text-xs text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-center py-8 text-light-text-secondary dark:text-dark-text-secondary">No scheduled transactions for this date.</p>
                    )}
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t border-black/10 dark:border-white/10">
                     <button onClick={onClose} className={BTN_SECONDARY_STYLE}>Close</button>
                     <button onClick={onAddTransaction} className={BTN_PRIMARY_STYLE}>Add New Item</button>
                </div>
            </div>
        </Modal>
    );
};

export default ForecastDayModal;
