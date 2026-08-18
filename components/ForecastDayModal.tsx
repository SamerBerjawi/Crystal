import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency, getPreferredTimeZone, parseLocalDate } from '../utils';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import Icon from './ui/Icon';

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
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => setIsVisible(true), 20);
            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
        }
    }, [isOpen]);

    // Handle ESC key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                handleClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 250);
    };

    if (!isOpen && !isVisible) return null;

    const timeZone = getPreferredTimeZone();
    const formattedDate = parseLocalDate(date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone
    });
    
    const dayTotal = items.reduce((sum, item) => sum + item.amount, 0);

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
                    className={`w-screen max-w-lg bg-light-card dark:bg-dark-card shadow-2xl border-l border-black/10 dark:border-white/10 flex flex-col transform transition-transform duration-300 ease-out ${
                        isVisible ? 'translate-x-0' : 'translate-x-full'
                    }`}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-primary-500/5 to-transparent">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0 border border-primary-500/20 shadow-xs">
                                <Icon name="calendar_month" className="text-2xl" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight truncate">
                                    Forecast Day Details
                                </h2>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5 font-medium">
                                    {formattedDate}
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

                    {/* Scrollable Body */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

                            {/* Net Daily Trajectory Card */}
                            <div className="p-6 rounded-3xl bg-light-fill dark:bg-dark-fill/50 border border-black/5 dark:border-white/5 text-center relative overflow-hidden">
                                <span className="text-2xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70 block mb-1">
                                    Projected Net Daily Delta
                                </span>
                                <p className={`text-3xl font-black tabular-nums tracking-tight ${dayTotal >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {formatCurrency(dayTotal, 'EUR', { showPlusSign: true })}
                                </p>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-black/5 dark:bg-white/5 mt-3 text-light-text-secondary dark:text-dark-text-secondary">
                                    <Icon name="event_upcoming" className="text-sm" />
                                    <span>{items.length} Event{items.length !== 1 ? 's' : ''} on this day</span>
                                </span>
                            </div>

                            {/* Forecast Event Items */}
                            <div className="space-y-3">
                                <span className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                                    Scheduled Occurrences
                                </span>

                                {items.length > 0 ? (
                                    items.map(item => (
                                        <div 
                                            key={item.id} 
                                            onClick={() => {
                                                handleClose();
                                                onEditItem(item);
                                            }}
                                            className="p-4 rounded-2xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md hover:border-primary-500/20 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                                        >
                                            <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                                                    item.type === 'Recurring' 
                                                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' 
                                                        : item.type === 'Financial Goal' 
                                                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' 
                                                            : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                                                }`}>
                                                    <Icon name={item.type === 'Recurring' ? 'repeat' : item.type === 'Financial Goal' ? 'flag' : 'receipt_long'} className="text-lg" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-bold text-xs text-light-text dark:text-dark-text truncate group-hover:text-primary-500 transition-colors">
                                                        {item.description}
                                                    </p>
                                                    <p className="text-2xs text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5 font-medium">
                                                        {item.accountName} • {item.type}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="text-right shrink-0">
                                                <p className={`font-black text-sm tabular-nums ${item.amount >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                    {formatCurrency(item.amount, 'EUR', { showPlusSign: true })}
                                                </p>
                                                <span className="text-2xs font-bold text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    Configure &rarr;
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-8 text-center bg-white dark:bg-dark-card rounded-2xl border border-black/5 dark:border-white/5 opacity-60">
                                        <Icon name="event_busy" className="text-3xl text-gray-400 mx-auto mb-2" />
                                        <p className="text-xs font-semibold text-light-text dark:text-dark-text">No occurrences on this date</p>
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* Sticky Bottom Actions */}
                        <div className="p-6 border-t border-black/5 dark:border-white/5 bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-md flex items-center justify-between gap-3">
                            <button 
                                type="button" 
                                onClick={handleClose} 
                                className={`${BTN_SECONDARY_STYLE} h-12 px-6 text-xs font-bold uppercase tracking-wider`}
                            >
                                Close
                            </button>
                            <button 
                                type="button" 
                                onClick={() => {
                                    handleClose();
                                    onAddTransaction();
                                }} 
                                className={`${BTN_PRIMARY_STYLE} h-12 px-8 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-primary-500/20 active:scale-95`}
                            >
                                <span>Add New Item</span>
                                <Icon name="add" className="text-base" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
};

export default ForecastDayModal;
