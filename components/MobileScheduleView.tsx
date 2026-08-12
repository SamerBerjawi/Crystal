import React, { useState } from 'react';
import { ScheduledItem, Currency, RecurringTransaction } from '../types';
import { formatCurrency } from '../utils';
import Icon from './ui/Icon';
import SwipeableRow from './SwipeableRow';
import PullToRefresh from './PullToRefresh';
import FloatingActionButton from './FloatingActionButton';

interface MobileScheduleViewProps {
  scheduledItems: ScheduledItem[];
  totalIncome: number;
  totalExpense: number;
  netFlow: number;
  onProcessItem: (item: ScheduledItem) => void;
  onEditItem: (item: ScheduledItem) => void;
  onDeleteItem: (item: ScheduledItem) => void;
  onAddRecurring: () => void;
  onAddBill: () => void;
  preferredCurrency?: string;
  onRefreshData?: () => Promise<void>;
}

export const MobileScheduleView: React.FC<MobileScheduleViewProps> = ({
  scheduledItems,
  totalIncome,
  totalExpense,
  netFlow,
  onProcessItem,
  onEditItem,
  onDeleteItem,
  onAddRecurring,
  onAddBill,
  preferredCurrency = 'EUR',
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'income' | 'expense'>('all');
  const curr = preferredCurrency as Currency;

  const handleRefresh = async () => {
    if (onRefreshData) {
      await onRefreshData();
    } else {
      await new Promise((res) => setTimeout(res, 800));
    }
  };

  const filteredItems = scheduledItems.filter((item) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'income') return item.type === 'income' || item.type === 'deposit';
    return item.type === 'expense' || item.type === 'payment';
  });

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-5 pb-24 animate-fade-in md:hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70">
              Calendar & Obligations
            </p>
            <h1 className="text-2xl font-extrabold text-light-text dark:text-white tracking-tight">
              Schedule & Bills
            </h1>
          </div>

          <button
            onClick={onAddBill}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/25 flex items-center justify-center active:scale-95 touch-feedback transition-all"
            aria-label="Add Scheduled Payment"
          >
            <Icon name="add" className="text-2xl" />
          </button>
        </div>

        {/* 3 Summary Pill Cards */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-white/80 dark:bg-dark-card/80 backdrop-blur-md rounded-2xl border border-black/5 dark:border-white/10 shadow-sm text-center">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-60">
              Incoming
            </p>
            <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 privacy-blur mt-0.5">
              +{formatCurrency(totalIncome, curr)}
            </p>
          </div>

          <div className="border-x border-black/5 dark:border-white/10 px-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-60">
              Outgoing
            </p>
            <p className="text-xs font-black text-rose-600 dark:text-rose-400 privacy-blur mt-0.5">
              -{formatCurrency(totalExpense, curr)}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-60">
              Net Flow
            </p>
            <p
              className={`text-xs font-black privacy-blur mt-0.5 ${
                netFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatCurrency(netFlow, curr, { showPlusSign: true })}
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5">
          {[
            { id: 'all', label: 'All Items' },
            { id: 'expense', label: 'Expenses / Bills' },
            { id: 'income', label: 'Income' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all min-h-[38px] touch-feedback ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-dark-card text-orange-600 dark:text-orange-400 shadow-sm'
                  : 'text-light-text-secondary dark:text-dark-text-secondary opacity-60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scheduled Items List (Wrapped in SwipeableRow) */}
        <div className="space-y-2.5">
          {filteredItems.map((item) => {
            const isExpense = item.type === 'expense' || item.type === 'payment';
            const itemCurrency = ((item.originalItem as any)?.currency || curr) as Currency;
            const frequency = item.isRecurring ? (item.originalItem as RecurringTransaction).frequency : undefined;

            return (
              <SwipeableRow
                key={item.id}
                leftActions={[
                  {
                    icon: 'check',
                    bgClass: 'bg-emerald-500',
                    label: 'Pay Now',
                    onAction: () => onProcessItem(item),
                  },
                ]}
                rightActions={[
                  {
                    icon: 'edit',
                    bgClass: 'bg-amber-500',
                    label: 'Edit',
                    onAction: () => onEditItem(item),
                  },
                  {
                    icon: 'delete',
                    bgClass: 'bg-rose-500',
                    label: 'Delete',
                    onAction: () => onDeleteItem(item),
                  },
                ]}
              >
                <div
                  onClick={() => onEditItem(item)}
                  className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-md rounded-2xl p-3.5 border border-black/5 dark:border-white/10 shadow-sm flex items-center justify-between gap-3 min-h-[64px] touch-feedback cursor-pointer"
                >
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border border-black/5 dark:border-white/10 ${
                      isExpense
                        ? 'bg-rose-500/10 text-rose-500'
                        : 'bg-emerald-500/10 text-emerald-500'
                    }`}
                  >
                    <Icon name={isExpense ? 'schedule' : 'arrow_downward'} className="text-xl" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-light-text dark:text-white truncate">
                      {item.description}
                    </p>
                    <p className="text-[10px] font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-70 truncate mt-0.5">
                      Due: {item.date} {frequency ? `• ${frequency}` : ''}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className={`text-xs font-extrabold privacy-blur ${
                        isExpense ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {isExpense ? '-' : '+'}{formatCurrency(Math.abs(item.amount), itemCurrency)}
                    </p>
                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 block mt-1">
                      {item.isRecurring ? 'Recurring' : 'Bill'}
                    </span>
                  </div>
                </div>
              </SwipeableRow>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="text-center py-12 bg-white/60 dark:bg-dark-card/60 rounded-3xl border border-black/5 dark:border-white/5 p-6">
              <Icon name="event_available" className="text-4xl text-gray-400 mb-2" />
              <p className="text-sm font-bold text-light-text dark:text-white">No scheduled payments</p>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                All upcoming bills and recurring payments are clear.
              </p>
            </div>
          )}
        </div>

        <FloatingActionButton onClick={onAddBill} label="Add Bill" />
      </div>
    </PullToRefresh>
  );
};
